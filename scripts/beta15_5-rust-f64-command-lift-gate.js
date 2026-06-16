#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'src', 'brik.js');
const version = '0.1.0-beta.15.5';
const evidenceDir = path.join(root, 'evidence', 'beta15_5-rust-f64-command-lift');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta15-5-gate-'));
const records = [];

function run(id, command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || work,
    env: { ...process.env, BRIK64_NO_BANNER: '1', ...(options.env || {}) },
    encoding: 'utf8',
    timeout: options.timeoutMs || 90000,
    maxBuffer: 64 * 1024 * 1024
  });
  const record = {
    id,
    command: [command, ...args],
    cwd: options.cwd || work,
    status: result.error?.code === 'ETIMEDOUT' ? 124 : (result.status === null ? 124 : result.status),
    elapsedMs: Date.now() - started,
    stdout: result.stdout || '',
    stderr: result.error?.code === 'ETIMEDOUT' ? `command_timeout:${options.timeoutMs || 90000}` : (result.stderr || '')
  };
  records.push(record);
  if (!options.allowFailure && record.status !== 0) {
    throw new Error(`${id}:rc=${record.status}\n${record.stderr || record.stdout}`);
  }
  if (options.expect && !`${record.stdout}\n${record.stderr}`.includes(options.expect)) {
    throw new Error(`${id}:missing:${options.expect}\n${record.stderr || record.stdout}`);
  }
  return record;
}

function write(file, content) {
  const full = path.join(work, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function assert(condition, message, detail = {}) {
  if (!condition) {
    const error = new Error(message);
    error.detail = detail;
    throw error;
  }
}

function runGenerated(target, outDir) {
  const cwd = path.join(work, outDir);
  if (target === 'ts') run(`generated:${outDir}:ts`, process.execPath, ['program.test.mjs'], { cwd });
  if (target === 'python') run(`generated:${outDir}:python`, 'python3', ['-m', 'pytest', '-q'], { cwd, env: { PYTHONPATH: cwd } });
  if (target === 'rust') run(`generated:${outDir}:rust`, 'cargo', ['test', '--quiet'], { cwd });
}

function writeFixtures() {
  write('pcd/core/access_gate.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC access_gate {
  domain role_code: i64 [0, 255];
  domain risk_score: i64 [0, 255];
  fn access_gate(role_code: i64, risk_score: i64) -> i64 {
    if (role_code == 1) return MC_07.CLAMP(MC_01.SUB8(100, risk_score), 0, 100);
    return 0;
  }
}
`);
  write('pcd/extended/billing_amount.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC billing_amount {
  boundary MC_67.FDIV;
  boundary MC_66.FMUL;
  domain amount: f64 [0.0, 130000.0];
  domain days: f64 [1.0, 31.0];
  fn billing_amount(amount: f64, days: f64) -> f64 {
    if (amount <= 0.0) return 0.0;
    return MC_07.CLAMP(MC_66.FMUL(MC_67.FDIV(amount, days), 30.0), 0.0, 130000.0);
  }
}
`);
}

function certifyVerify(file) {
  run(`certify:${file}`, process.execPath, [cli, 'certify', file]);
  run(`verify:${file}`, process.execPath, [cli, 'verify', file]);
}

function commandHelpMatrix() {
  const commands = ['init', 'doctor', 'engine', 'account', 'certify', 'verify', 'emit', 'polymerize', 'monomers', 'lift', 'template', 'update', 'ledger', 'lock', 'domain', 'adoption', 'explain', 'skill', 'telemetry', 'errors', 'feedback', 'exit-codes'];
  for (const command of commands) {
    run(`help:${command}`, process.execPath, [cli, 'help', command]);
  }
}

function liftRoundtrip() {
  write('src/pure.py', `def clamp_amount(amount, bonus):\n    if amount <= 0:\n        return 0\n    return min(max(amount + bonus, 0), 130000)\n`);
  write('src/pure.js', `function clampAmount(amount, bonus) { if (amount <= 0) return 0; return Math.min(Math.max(amount + bonus, 0), 130000); }\n`);
  write('src/pure.rs', `pub fn clamp_amount(amount: i64, bonus: i64) -> i64 { if amount <= 0 { return 0; } return amount + bonus; }\n`);
  const liftResults = [];
  for (const [language, source] of [['python', 'src/pure.py'], ['js', 'src/pure.js'], ['rust', 'src/pure.rs']]) {
    const out = `.brik/lift-preview/${language}`;
    const report = JSON.parse(run(`lift:${language}`, process.execPath, [cli, 'lift', language, source, '--preview', '--out', out, '--json']).stdout);
    liftResults.push(report);
    assert(report.candidateCount > 0, `lift_candidate_missing:${language}`, report);
    const candidatesDir = path.join(work, out, 'candidates');
    for (const file of fs.readdirSync(candidatesDir).filter((name) => name.endsWith('.pcd'))) {
      const rel = path.relative(work, path.join(candidatesDir, file));
      certifyVerify(rel);
      for (const target of ['ts', 'python', 'rust']) {
        const out = `out/lift-${language}-${file.replace(/[^A-Za-z0-9_-]/g, '_')}-${target}`;
        run(`emit:lift:${language}:${file}:${target}`, process.execPath, [cli, 'emit', rel, '--target', target, '--out', out, '--tests']);
        runGenerated(target, out);
      }
    }
  }
  return {
    attemptedModules: liftResults.length,
    liftCandidates: liftResults.reduce((sum, item) => sum + item.candidateCount, 0),
    certifiedLiftedPcds: liftResults.reduce((sum, item) => sum + item.candidateCount, 0),
    semanticRoundtripPass: liftResults.reduce((sum, item) => sum + item.candidateCount, 0) * 3
  };
}

fs.mkdirSync(evidenceDir, { recursive: true });

try {
  run('version', process.execPath, [cli, '--version'], { expect: `BRIK64 CLI ${version}` });
  run('init', process.execPath, [cli, 'init'], { expect: 'created=.brik/manifest.json' });
  commandHelpMatrix();
  writeFixtures();
  certifyVerify('pcd/core/access_gate.pcd');
  certifyVerify('pcd/extended/billing_amount.pcd');
  run('polymerize:core', process.execPath, [cli, 'polymerize', 'pcd/core/access_gate.pcd', '--inline', '--out', 'polymer/core.polymer.pcd'], { expect: 'polymer=polymer/core.polymer.pcd' });
  run('polymerize:extended', process.execPath, [cli, 'polymerize', 'pcd/extended/billing_amount.pcd', '--inline', '--out', 'polymer/extended.polymer.pcd'], { expect: 'polymer=polymer/extended.polymer.pcd' });
  run('polymerize:app', process.execPath, [cli, 'polymerize', 'polymer/core.polymer.pcd', 'polymer/extended.polymer.pcd', '--inline', '--root', 'access_gate', '--out', 'polymer/app.polymer.pcd'], { expect: 'polymer=polymer/app.polymer.pcd' });
  for (const file of ['polymer/core.polymer.pcd', 'polymer/extended.polymer.pcd', 'polymer/app.polymer.pcd']) certifyVerify(file);
  for (const file of ['polymer/core.polymer.pcd', 'polymer/extended.polymer.pcd', 'polymer/app.polymer.pcd']) {
    for (const target of ['ts', 'python', 'rust']) {
      const out = `out/${path.basename(file, '.pcd').replace(/[^A-Za-z0-9_-]/g, '_')}-${target}`;
      run(`emit:${file}:${target}`, process.execPath, [cli, 'emit', file, '--target', target, '--out', out, '--tests']);
      runGenerated(target, out);
    }
  }
  const rustExtended = fs.readFileSync(path.join(work, 'out/extended_polymer-rust/src/lib.rs'), 'utf8');
  assert(rustExtended.includes('.max(0.0).min(130000.0)'), 'rust_f64_clamp_literals_missing');
  assert(!/L[456]\+?N5|l[456]plus|engines\/l[456]/i.test(run('engine_status', process.execPath, [cli, 'engine', 'status']).stdout), 'engine_status_private_language_leak');
  const overflow = run('domain_overflow', process.execPath, [cli, 'certify', 'overflow.pcd'], { allowFailure: true });
  assert(overflow.status !== 0, 'domain_overflow_unexpected_success');
  write('adversarial/bad.pcd', 'PC bad { domain x: i64 [0, 99999999999999999999]; fn bad(x: i64) -> i64 { return x; } }\n');
  const overflow2 = run('domain_overflow_real', process.execPath, [cli, 'certify', 'adversarial/bad.pcd'], { allowFailure: true });
  assert(overflow2.status !== 0 && /domain_bound_out_of_range/.test(`${overflow2.stdout}\n${overflow2.stderr}`), 'domain_overflow_not_actionable', overflow2);
  const doctorProject = JSON.parse(run('doctor_project', process.execPath, [cli, 'doctor', '--scope', 'project', '--json']).stdout);
  assert(doctorProject.status === 'PASS', 'doctor_project_not_pass', doctorProject);
  const doctorAll = run('doctor_all', process.execPath, [cli, 'doctor', '--scope', 'all', '--json'], { allowFailure: true });
  assert(doctorAll.status !== 0, 'doctor_all_expected_adversarial_failure');
  const liftMetrics = liftRoundtrip();

  const report = {
    schemaVersion: 'brik64.cli_beta15_5_rust_f64_command_lift_gate.v1',
    version,
    decision: 'PASS_BRIK64_CLI_BETA15_5_RUST_F64_COMMAND_LIFT_GATE',
    evidenceLevel: 'NIVEL 3',
    releaseEligible: false,
    workdir: work,
    liftMetrics,
    checked: [
      'version_beta15_5',
      'command_help_matrix',
      'rust_f64_polymer_extended_and_app',
      'ts_python_rust_polymer_tests',
      'engine_status_public_output',
      'domain_bound_overflow_fail_closed',
      'doctor_scope_project_pass_all_fail',
      'lift_roundtrip_python_js_rust'
    ],
    records: records.map((record) => ({
      id: record.id,
      status: record.status,
      elapsedMs: record.elapsedMs,
      stdout: record.stdout.slice(0, 1200),
      stderr: record.stderr.slice(0, 1200)
    }))
  };
  fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write('decision=PASS_BRIK64_CLI_BETA15_5_RUST_F64_COMMAND_LIFT_GATE\n');
} catch (error) {
  const report = {
    schemaVersion: 'brik64.cli_beta15_5_rust_f64_command_lift_gate.v1',
    version,
    decision: 'FAIL_BRIK64_CLI_BETA15_5_RUST_F64_COMMAND_LIFT_GATE',
    evidenceLevel: 'NIVEL 3',
    releaseEligible: false,
    error: error.message,
    detail: error.detail || null,
    records: records.map((record) => ({
      id: record.id,
      status: record.status,
      elapsedMs: record.elapsedMs,
      stdout: record.stdout.slice(0, 1200),
      stderr: record.stderr.slice(0, 1200)
    }))
  };
  fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
