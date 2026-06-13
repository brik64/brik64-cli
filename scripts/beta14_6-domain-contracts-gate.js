#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'src', 'brik.js');
const VERSION = '0.1.0-beta.14.6';
const evidenceDir = path.join(ROOT, 'evidence', 'beta14_6-domain-contracts');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function run(cwd, args, options = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, BRIK64_NO_BANNER: '1' },
    maxBuffer: 8 * 1024 * 1024
  });
  const ok = options.expectFail ? result.status !== 0 : result.status === 0;
  return {
    ok,
    status: result.status,
    args,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function runNative(cwd, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env },
    maxBuffer: 8 * 1024 * 1024
  });
  const ok = options.optionalMissing && result.error && result.error.code === 'ENOENT'
    ? true
    : options.expectFail ? result.status !== 0 : result.status === 0;
  return {
    ok,
    status: result.status,
    command,
    args,
    skipped: Boolean(options.optionalMissing && result.error && result.error.code === 'ENOENT'),
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta146-gate.'));
  const checks = [];
  const add = (name, check) => checks.push({ name, ...check });
  add('node_syntax', runNative(ROOT, process.execPath, ['--check', CLI]));
  add('init', run(tmp, ['init']));
  add('template_domain_gate', run(tmp, ['template', '--type', 'domain-gate', '--out', 'pcd/bounded_gate.pcd']));
  add('domain_inspect_json', run(tmp, ['domain', 'inspect', 'pcd/bounded_gate.pcd', '--json']));
  add('domain_validate', run(tmp, ['domain', 'validate', 'pcd/bounded_gate.pcd']));
  add('certify_domain_gate', run(tmp, ['certify', 'pcd/bounded_gate.pcd']));
  add('verify_domain_gate', run(tmp, ['verify', 'pcd/bounded_gate.pcd', '--json']));

  write(path.join(tmp, 'pcd', 'missing_domain.pcd'), [
    '// brik64.pcd_file.v1',
    'PC missing_domain {',
    '    fn missing_domain(x: i64) -> i64 {',
    '        return x + 1;',
    '    }',
    '}',
    ''
  ].join('\n'));
  add('certify_missing_domain_fails', run(tmp, ['certify', 'pcd/missing_domain.pcd'], { expectFail: true }));
  add('domain_add_missing_domain', run(tmp, ['domain', 'add', 'pcd/missing_domain.pcd', '--param', 'x', '--min', '0', '--max', '10']));
  add('certify_after_domain_add', run(tmp, ['certify', 'pcd/missing_domain.pcd']));

  write(path.join(tmp, 'pcd', 'param_domain.pcd'), [
    '// brik64.pcd_file.v1',
    'PC param_domain {',
    '    domain_param MAX_X: i64;',
    '    domain x: i64 [0, MAX_X];',
    '    fn param_domain(x: i64) -> i64 {',
    '        return x + 1;',
    '    }',
    '}',
    ''
  ].join('\n'));
  add('domain_sheet_param', run(tmp, ['domain', 'sheet', 'pcd/param_domain.pcd', '--out', 'technical-sheet.json']));
  const sheetPath = path.join(tmp, 'technical-sheet.json');
  const sheet = JSON.parse(fs.readFileSync(sheetPath, 'utf8'));
  sheet.domainParams.MAX_X = 42;
  fs.writeFileSync(sheetPath, JSON.stringify(sheet, null, 2) + '\n');
  add('domain_validate_with_sheet', run(tmp, ['domain', 'validate', 'pcd/param_domain.pcd', '--technical-sheet', 'technical-sheet.json']));

  for (const target of ['ts', 'python', 'rust']) {
    add(`emit_${target}`, run(tmp, ['emit', 'pcd/bounded_gate.pcd', '--target', target, '--out', `out-${target}`, '--tests']));
  }
  add('run_ts_generated_tests', runNative(tmp, process.execPath, ['out-ts/program.test.mjs']));
  add('run_python_generated_tests', runNative(tmp, 'python3', ['out-python/test_program.py'], { optionalMissing: true }));
  add('rust_compile_generated_tests', runNative(tmp, 'rustc', ['out-rust/program_test.rs', '-o', 'out-rust/program_test'], { optionalMissing: true }));
  if (fs.existsSync(path.join(tmp, 'out-rust', 'program_test'))) {
    add('run_rust_generated_tests', runNative(tmp, path.join(tmp, 'out-rust', 'program_test'), []));
  }

  add('polymerize_domain_inputs', run(tmp, ['polymerize', 'pcd/bounded_gate.pcd', 'pcd/missing_domain.pcd', '--out', 'polymer.pcd', '--json']));
  const polymerManifest = path.join(tmp, 'polymer.pcd.manifest.json');
  add('polymer_manifest_has_domain_hash', {
    ok: fs.existsSync(polymerManifest) && JSON.parse(fs.readFileSync(polymerManifest, 'utf8')).composite_domain_sha256,
    status: fs.existsSync(polymerManifest) ? 0 : 1,
    args: ['assert', 'polymer_manifest_has_domain_hash'],
    stdout: '',
    stderr: ''
  });

  const failed = checks.filter((check) => !check.ok);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const report = {
    schemaVersion: 'brik64.beta14_6_domain_contracts_gate.v1',
    version: VERSION,
    generatedAt: '2026-06-13T00:00:00.000Z',
    workspace: '[ephemeral]',
    decision: failed.length === 0 ? 'PASS_BETA14_6_DOMAIN_CONTRACTS_GATE' : 'FAIL_BETA14_6_DOMAIN_CONTRACTS_GATE',
    checks: checks.map((check) => ({
      name: check.name,
      ok: check.ok,
      status: check.status,
      skipped: check.skipped || false,
      args: check.args || [check.command],
      stdout_sha256: sha256(check.stdout || ''),
      stderr_sha256: sha256(check.stderr || ''),
      stderr_tail: (check.stderr || '').split('\n').slice(-4).join('\n')
    }))
  };
  fs.writeFileSync(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`${report.decision}\n`);
  process.stdout.write(`report=${path.relative(ROOT, path.join(evidenceDir, 'report.json'))}\n`);
  if (failed.length > 0) {
    for (const check of failed) process.stderr.write(`failed=${check.name}\n${check.stderr || check.stdout || ''}\n`);
    process.exit(1);
  }
}

main();
