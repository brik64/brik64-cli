#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.15.6';
const evidenceDir = path.join(root, 'evidence', 'beta15_6-pre-public-rc');
const records = [];

function run(id, command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, BRIK64_NO_BANNER: '1' },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const record = {
    id,
    command: [command, ...args].join(' '),
    status: result.status === null ? 124 : result.status,
    elapsedMs: Date.now() - started,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
  records.push(record);
  if (record.status !== 0) throw new Error(`${id}:rc=${record.status}\n${record.stderr || record.stdout}`);
  if (options.expect && !`${record.stdout}\n${record.stderr}`.includes(options.expect)) {
    throw new Error(`${id}:missing:${options.expect}\n${record.stderr || record.stdout}`);
  }
  return record;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function assert(condition, message, detail = {}) {
  if (!condition) {
    const error = new Error(message);
    error.detail = detail;
    throw error;
  }
}

fs.mkdirSync(evidenceDir, { recursive: true });

try {
  run('version', process.execPath, ['src/brik.js', '--version'], { expect: `BRIK64 CLI ${version}` });
  run('node_check_cli', process.execPath, ['--check', 'src/brik.js']);
  run('node_check_beta15_6_gate', process.execPath, ['--check', 'scripts/beta15_6-rust-f64-command-lift-gate.js']);
  run('node_check_self', process.execPath, ['--check', 'scripts/beta15_6-pre-public-rc-gate.js']);
  for (const pcd of [
    'pcd/beta15_6/cli/rust_f64_polymer_codegen.pcd',
    'pcd/beta15_6/harness/lift_roundtrip_gate.pcd',
    'pcd/beta15_6/release/public_surface_sync.pcd'
  ]) {
    run(`certify_contract:${pcd}`, process.execPath, ['src/brik.js', 'certify', pcd]);
    run(`verify_contract:${pcd}`, process.execPath, ['src/brik.js', 'verify', pcd]);
  }
  run('gate_beta15_6_rust_f64_command_lift', process.execPath, ['scripts/beta15_6-rust-f64-command-lift-gate.js'], {
    expect: 'PASS_BRIK64_CLI_BETA15_6_RUST_F64_COMMAND_LIFT_GATE'
  });
  run('smoke', 'bash', ['tests/smoke.sh'], { expect: 'brik64-cli bootstrap smoke: PASS' });
  const monomers = JSON.parse(run('monomers_all', process.execPath, ['src/brik.js', 'monomers', 'test', '--all', '--json']).stdout);
  assert(monomers.cliVersion === version, 'monomer_report_version_mismatch', monomers);
  assert(monomers.total === 128 && monomers.passed === 128 && monomers.failed === 0, 'monomer_128_gate_mismatch', monomers);
  const gate = readJson('evidence/beta15_6-rust-f64-command-lift/report.json');
  assert(gate.decision === 'PASS_BRIK64_CLI_BETA15_6_RUST_F64_COMMAND_LIFT_GATE', 'beta15_6_gate_not_pass', gate);
  const report = {
    schemaVersion: 'brik64.cli_beta15_6_pre_public_rc_report.v1',
    version,
    decision: 'PASS_BRIK64_CLI_BETA15_6_PRE_PUBLIC_RC_GATE',
    evidenceLevel: 'NIVEL 3',
    releaseEligible: false,
    claimBoundary: 'candidate only until L6 generation, package, SDKs, docs, web, skills, and live release verification pass atomically.',
    checked: [
      'node_syntax',
      'pcd_contracts_certified',
      'beta15_6_rust_f64_command_lift',
      'smoke',
      'monomers_128_registry'
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
  process.stdout.write('decision=PASS_BRIK64_CLI_BETA15_6_PRE_PUBLIC_RC_GATE\n');
} catch (error) {
  const report = {
    schemaVersion: 'brik64.cli_beta15_6_pre_public_rc_report.v1',
    version,
    decision: 'FAIL_BRIK64_CLI_BETA15_6_PRE_PUBLIC_RC_GATE',
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
