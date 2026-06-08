#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta12-feature-parity');
const version = '0.1.0-beta.12';

function run(id, command, args) {
  const started = Date.now();
  const result = childProcess.spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20
  });
  return {
    id,
    rc: result.status,
    elapsedMs: Date.now() - started,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    stdoutTail: (result.stdout || '').slice(-4000),
    stderrTail: (result.stderr || '').slice(-4000)
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const checks = [
    run('semantic_polymerize', 'npm', ['run', 'gate:beta12:semantic-polymerize']),
    run('rust_emitter_clean', 'npm', ['run', 'gate:beta12:rust-emitter-clean']),
    run('doctor_empty_workspace', 'npm', ['run', 'gate:beta12:doctor-empty-workspace']),
    run('adversarial', 'npm', ['run', 'gate:beta12:adversarial'])
  ];
  const failures = checks.filter((check) => check.rc !== 0).map((check) => check.id);
  const report = {
    schemaVersion: 'brik64.cli_beta12_feature_parity_gate.v1',
    version,
    decision: failures.length === 0 ? 'PASS_BETA12_FEATURE_PARITY' : 'FAIL_BETA12_FEATURE_PARITY',
    releaseEligible: failures.length === 0,
    checks,
    failures,
    boundary: 'Beta12 feature parity gate covers current public CLI behavior only. It does not assert formal certification or toolchain independence.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  if (failures.length) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length) process.exit(1);
}

main();
