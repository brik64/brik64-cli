#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const brik = path.join(root, 'src', 'brik.js');
const version = '0.1.0-beta.15.3';
const stalePatterns = [
  { pattern: /Beta14\.2/g, reason: 'stale_help_beta14_2' },
  { pattern: /0\.0\.0-beta15\.1-local/g, reason: 'stale_generated_package_beta15_1' }
];
const records = [];

function run(id, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [brik, ...args], {
    cwd: options.cwd || root,
    env: { ...process.env, BRIK64_NO_BANNER: '1', ...(options.env || {}) },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const record = {
    id,
    args,
    status: result.status,
    elapsedMs: Date.now() - started,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
  records.push(record);
  if (result.status !== 0) {
    throw new Error(`${id}:rc=${result.status}\n${record.stderr || record.stdout}`);
  }
  return record;
}

function assertNoStale(id, text) {
  for (const entry of stalePatterns) {
    const matches = text.match(entry.pattern);
    if (matches) {
      throw new Error(`${id}:${entry.reason}:${matches[0]}`);
    }
  }
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta15-3-stale-gate-'));

try {
  const versionOut = run('version', ['--version']).stdout;
  if (!versionOut.includes(version)) throw new Error(`version_mismatch:${versionOut.trim()}`);

  for (const command of ['lift', 'template']) {
    const output = run(`help_${command}`, ['help', command]).stdout;
    assertNoStale(`help_${command}`, output);
  }

  run('init', ['init'], { cwd: tmp });
  run('template_numeric', ['template', '--type', 'numeric-monomer', '--out', 'pcd/numeric_gate.pcd'], { cwd: tmp });
  run('certify_numeric', ['certify', 'pcd/numeric_gate.pcd'], { cwd: tmp });

  const targets = ['ts', 'python', 'rust'];
  for (const target of targets) {
    run(`emit_${target}`, ['emit', 'pcd/numeric_gate.pcd', '--target', target, '--out', `emitted/${target}`, '--tests'], { cwd: tmp });
  }

  const generatedFiles = [
    path.join(tmp, 'emitted', 'ts', 'package.json'),
    path.join(tmp, 'emitted', 'python', 'pyproject.toml'),
    path.join(tmp, 'emitted', 'rust', 'Cargo.toml'),
    path.join(tmp, 'emitted', 'ts', 'program.mjs'),
    path.join(tmp, 'emitted', 'python', 'brik64_generated_numeric_gate', 'program.py'),
    path.join(tmp, 'emitted', 'rust', 'program.rs')
  ];

  for (const file of generatedFiles) {
    assertNoStale(path.relative(tmp, file), read(file));
  }

  const packageJson = JSON.parse(read(path.join(tmp, 'emitted', 'ts', 'package.json')));
  if (packageJson.version !== '0.0.0') throw new Error(`ts_local_version_not_neutral:${packageJson.version}`);

  const pyproject = read(path.join(tmp, 'emitted', 'python', 'pyproject.toml'));
  if (!/^version = "0\.0\.0"$/m.test(pyproject)) throw new Error('python_local_version_not_neutral');

  const cargoToml = read(path.join(tmp, 'emitted', 'rust', 'Cargo.toml'));
  if (!/^version = "0\.0\.0"$/m.test(cargoToml)) throw new Error('rust_local_version_not_neutral');

  const report = {
    schemaVersion: 'brik64.cli_beta15_3_stale_public_surface_gate.v1',
    version,
    decision: 'PASS_BRIK64_CLI_BETA15_3_STALE_PUBLIC_SURFACE_GATE',
    evidenceLevel: 'NIVEL 3',
    checked: [
      'help_lift_no_stale_beta',
      'help_template_no_stale_beta',
      'generated_ts_package_neutral_local_version',
      'generated_python_package_neutral_local_version',
      'generated_rust_package_neutral_local_version',
      'generated_programs_no_stale_beta15_1'
    ],
    records: records.map((record) => ({
      id: record.id,
      status: record.status,
      elapsedMs: record.elapsedMs
    }))
  };
  const outDir = path.join(root, 'evidence', 'beta15_3-stale-public-surface');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write('decision=PASS_BRIK64_CLI_BETA15_3_STALE_PUBLIC_SURFACE_GATE\n');
} catch (error) {
  const outDir = path.join(root, 'evidence', 'beta15_3-stale-public-surface');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify({
    schemaVersion: 'brik64.cli_beta15_3_stale_public_surface_gate.v1',
    version,
    decision: 'FAIL_BRIK64_CLI_BETA15_3_STALE_PUBLIC_SURFACE_GATE',
    evidenceLevel: 'NIVEL 3',
    error: error.message,
    records: records.map((record) => ({
      id: record.id,
      status: record.status,
      elapsedMs: record.elapsedMs,
      stdout: record.stdout.slice(0, 1200),
      stderr: record.stderr.slice(0, 1200)
    }))
  }, null, 2)}\n`);
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
