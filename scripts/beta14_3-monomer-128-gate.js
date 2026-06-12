#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const brik = path.join(root, 'src', 'brik.js');
const version = '0.1.0-beta.14.3';
const evidenceDir = path.join(root, 'evidence', 'beta14_3-monomer-128');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta14-3-'));
const checks = [];
const failures = [];

function run(args, options = {}) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [brik, ...args], {
    cwd: options.cwd || root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, BRIK64_CONFIG_HOME: path.join(scratch, 'config'), BRIK64_NO_BANNER: '1' }
  });
  return {
    rc: result.status === null ? 124 : result.status,
    elapsedMs: Date.now() - started,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function assert(condition, message, detail = {}) {
  if (!condition) {
    throw new Error(`${message}:${JSON.stringify(detail).slice(0, 800)}`);
  }
}

function record(id, fn) {
  const started = Date.now();
  try {
    const extra = fn() || {};
    checks.push({ id, status: 'PASS', elapsedMs: Date.now() - started, ...extra });
  } catch (error) {
    failures.push(`${id}:${error.message}`);
    checks.push({ id, status: 'FAIL', elapsedMs: Date.now() - started, error: error.message });
  }
}

function expectPass(id, args, options = {}) {
  const result = run(args, options);
  assert(result.rc === 0, `${id}:expected_pass`, result);
  assert(!/(^|\n)\s+at .*\(|Node\.js v\d+\./.test(result.stderr), `${id}:stack_trace_leaked`, result);
  return result;
}

function expectFail(id, args, expected, options = {}) {
  const result = run(args, options);
  assert(result.rc !== 0, `${id}:expected_failure`, result);
  assert(`${result.stdout}\n${result.stderr}`.includes(expected), `${id}:missing_expected:${expected}`, result);
  assert(!/(^|\n)\s+at .*\(|Node\.js v\d+\./.test(result.stderr), `${id}:stack_trace_leaked`, result);
  return result;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function initWork(name) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(dir, { recursive: true });
  expectPass(`${name}:init`, ['init'], { cwd: dir });
  return dir;
}

record('version:beta14_3', () => {
  const result = expectPass('version', ['--version']);
  assert(result.stdout.includes(`BRIK64 CLI ${version}`), 'version_mismatch', result);
});

record('registry:128_counts', () => {
  const result = expectPass('monomers-list', ['monomers', 'list', '--json']);
  const report = JSON.parse(result.stdout);
  assert(report.coreCount === 64, 'core_count_mismatch', report);
  assert(report.extendedCount === 64, 'extended_count_mismatch', report);
  assert(report.totalCount === 128, 'total_count_mismatch', report);
  assert(report.monomers.length === 128, 'monomer_list_count_mismatch', report);
  return { coreCount: report.coreCount, extendedCount: report.extendedCount, totalCount: report.totalCount };
});

record('registry:test_all_128', () => {
  const result = expectPass('monomers-test-all', ['monomers', 'test', '--all', '--json']);
  const report = JSON.parse(result.stdout);
  assert(report.total === 128 && report.passed === 128 && report.failed === 0, 'monomer_test_all_mismatch', report);
  return { total: report.total, passed: report.passed };
});

record('registry:explain_core_and_extended', () => {
  const core = JSON.parse(expectPass('explain-core', ['monomers', 'explain', 'MC_00.ADD8', '--json']).stdout);
  const extended = JSON.parse(expectPass('explain-extended', ['monomers', 'explain', 'MC_127.JSON_EMIT', '--json']).stdout);
  assert(core.monomer.tier === 'core' && core.monomer.pcdExecutable === true, 'core_explain_mismatch', core);
  assert(extended.monomer.tier === 'extended' && extended.monomer.boundary === 'contract_external', 'extended_explain_mismatch', extended);
});

record('pcd:extended_float_emit_targets', () => {
  const work = initWork('extended-float');
  write(path.join(work, 'float.pcd'), `PC float_gate {
  fn float_gate(x: f64, y: f64) -> f64 {
    if (y == 0) return MC_64.FADD(x, 1);
    return MC_66.FMUL(MC_65.FSUB(x, y), 2);
  }
}
`);
  expectPass('certify-float', ['certify', 'float.pcd'], { cwd: work });
  expectPass('verify-float', ['verify', 'float.pcd'], { cwd: work });
  for (const target of ['ts', 'python', 'rust']) {
    expectPass(`emit-${target}`, ['emit', 'float.pcd', '--target', target, '--out', `out-${target}`, '--tests'], { cwd: work });
  }
});

record('pcd:external_boundary_fail_closed', () => {
  const work = initWork('external-boundary');
  write(path.join(work, 'net.pcd'), `PC net_gate {
  fn net_gate(x: i64) -> i64 {
    return MC_85.HTTP_GET(x);
  }
}
`);
  expectFail('external-boundary', ['certify', 'net.pcd'], 'external_effect_requires_extended_boundary:MC_85.HTTP_GET', { cwd: work });
});

record('pcd:source_scaffold_present', () => {
  const base = path.join(root, 'pcd', 'beta14_3');
  const required = [
    'cli/cli_entrypoint.pcd',
    'cli/cli_monomers.pcd',
    'monomers/core/MC_00_ADD8.pcd',
    'monomers/core/MC_63_ENV.pcd',
    'monomers/extended/MC_64_FADD.pcd',
    'monomers/extended/MC_127_JSON_EMIT.pcd',
    'harness/monomer_128_matrix.pcd',
    'release/beta14_3_release_train.pcd'
  ];
  for (const relative of required) {
    assert(fs.existsSync(path.join(base, relative)), `pcd_scaffold_missing:${relative}`);
  }
  const all = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else if (file.endsWith('.pcd')) all.push(file);
    }
  }
  walk(base);
  assert(all.length === 147, 'pcd_scaffold_count_mismatch', { count: all.length });
  return { pcdCount: all.length };
});

record('l6:evidence_fail_closed_until_materialized', () => {
  const manifestPath = path.join(root, 'evidence', 'beta14_3-l6-generation', 'l6plus_engine_manifest.json');
  const sealPath = path.join(root, 'evidence', 'beta14_3-l6-generation', 'seal_report.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const seal = JSON.parse(fs.readFileSync(sealPath, 'utf8'));
  assert(
    ['PENDING_REMOTE_L6_PREFLIGHT', 'PASS_REMOTE_L6_PREFLIGHT_NON_CLAIM'].includes(manifest.status),
    'l6_manifest_status_invalid',
    manifest
  );
  assert(manifest.publicationAllowed === false, 'l6_manifest_publication_boundary_open', manifest);
  assert(
    ['BLOCKED_PENDING_L6_MATERIALIZATION', 'BLOCKED_PENDING_FULL_L6_CLI_MATERIALIZATION'].includes(seal.decision),
    'seal_not_fail_closed',
    seal
  );
  assert(seal.publicationAllowed === false, 'seal_publication_boundary_open', seal);
});

fs.mkdirSync(evidenceDir, { recursive: true });
const report = {
  schemaVersion: 'brik64.cli_beta14_3_monomer_128_gate.v1',
  version,
  decision: failures.length === 0 ? 'PASS_BETA14_3_MONOMER_128_GATE' : 'FAIL_BETA14_3_MONOMER_128_GATE',
  evidenceLevel: failures.length === 0 ? 3 : 1,
  checks,
  failures,
  boundary: 'Registry and parser gate only. This is not L6+N5 generation evidence, self-hosting, fixpoint, formal proof, or public release authorization.'
};
fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`decision=${report.decision}\n`);
process.stdout.write(`checks=${checks.length}\n`);
if (failures.length) {
  process.stdout.write(`failures=${failures.join(',')}\n`);
  process.exit(1);
}
