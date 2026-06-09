#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const brik = path.join(root, 'src', 'brik.js');
const version = '0.1.0-beta.14';
const evidenceDir = path.join(root, 'evidence', 'beta14-functional');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta14-'));
process.env.BRIK64_CONFIG_HOME = path.join(scratch, 'config');
const checks = [];
const failures = [];

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function run(command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, ...(options.env || {}) }
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
    const suffix = Object.keys(detail).length ? `:${JSON.stringify(detail).slice(0, 500)}` : '';
    throw new Error(`${message}${suffix}`);
  }
}

function record(id, fn) {
  const started = Date.now();
  try {
    checks.push({ id, status: 'PASS', elapsedMs: Date.now() - started, ...(fn() || {}) });
  } catch (error) {
    failures.push(`${id}:${error.message}`);
    checks.push({ id, status: 'FAIL', elapsedMs: Date.now() - started, error: error.message });
  }
}

function expectPass(id, command, args, options = {}) {
  const result = run(command, args, options);
  assert(result.rc === 0, `${id}:expected_pass`, result);
  assert(!/(^|\n)\s+at .*\(|Node\.js v\d+\./.test(result.stderr), `${id}:stack_trace_leaked`, result);
  return result;
}

function expectFail(id, command, args, expected, options = {}) {
  const result = run(command, args, options);
  assert(result.rc !== 0, `${id}:expected_failure`, result);
  assert(`${result.stdout}\n${result.stderr}`.includes(expected), `${id}:missing_expected:${expected}`, result);
  assert(!/(^|\n)\s+at .*\(|Node\.js v\d+\./.test(result.stderr), `${id}:stack_trace_leaked`, result);
  return result;
}

function initWork(name) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(dir, { recursive: true });
  expectPass(`${name}:init`, process.execPath, [brik, 'init'], { cwd: dir });
  return dir;
}

record('version:beta14', () => {
  const result = expectPass('version', process.execPath, [brik, '--version']);
  assert(result.stdout.includes(`BRIK64 CLI ${version}`), 'version_mismatch', result);
});

record('pcd:i32_emit_file_outputs', () => {
  const work = initWork('i32-file-output');
  write(path.join(work, 'score.pcd'), `PC score {
  fn score(input: i32) -> i32 {
    if (input > 10) {
      return input + 1;
    }
    return input - 1;
  }
}
`);
  expectPass('certify-i32', process.execPath, [brik, 'certify', 'score.pcd'], { cwd: work });
  expectPass('emit-ts-file', process.execPath, [brik, 'emit', 'score.pcd', '--target', 'ts', '--out', 'score.mjs', '--tests'], { cwd: work });
  expectPass('run-ts-file-test', process.execPath, ['score.test.mjs'], { cwd: work });
  expectPass('emit-python-file', process.execPath, [brik, 'emit', 'score.pcd', '--target', 'python', '--out', 'score.py', '--tests'], { cwd: work });
  expectPass('run-python-file-test', 'python3', ['test_score.py'], { cwd: work });
  expectPass('emit-rust-file', process.execPath, [brik, 'emit', 'score.pcd', '--target', 'rust', '--out', 'score.rs', '--tests'], { cwd: work });
  expectPass('rustc-program', 'rustc', ['--crate-type', 'lib', 'score.rs'], { cwd: work });
  assert(fs.existsSync(path.join(work, 'score.mjs')), 'ts_exact_file_missing');
  assert(fs.existsSync(path.join(work, 'score.py')), 'python_exact_file_missing');
  assert(fs.existsSync(path.join(work, 'score.rs')), 'rust_exact_file_missing');
  assert(!fs.existsSync(path.join(work, 'score.mjs', 'program.mjs')), 'emit_created_file_path_as_directory');
});

record('pcd:unsupported_type_fail_closed', () => {
  const work = initWork('unsupported-type');
  write(path.join(work, 'bad.pcd'), `PC bad {
  fn bad(input: u128) -> i64 {
    return input;
  }
}
`);
  expectFail('unsupported-param', process.execPath, [brik, 'certify', 'bad.pcd'], 'unsupported_param_type:u128', { cwd: work });
});

record('routing:cloud_fail_closed', () => {
  const work = initWork('cloud-routing');
  write(path.join(work, 'ok.pcd'), `PC ok {
  fn ok(input: i64) -> i64 {
    return input + 1;
  }
}
`);
  expectPass('certify-ok', process.execPath, [brik, 'certify', 'ok.pcd'], { cwd: work });
  expectFail('verify-cloud-no-session', process.execPath, [brik, 'verify', 'ok.pcd', '--cloud'], 'managed_entitlement_required', { cwd: work });
  expectFail('polymerize-cloud-no-session', process.execPath, [brik, 'polymerize', 'ok.pcd', '--cloud'], 'managed_entitlement_required', { cwd: work });
});

fs.mkdirSync(evidenceDir, { recursive: true });
const report = {
  schemaVersion: 'brik64.cli_beta14_functional_gate.v1',
  version,
  decision: failures.length === 0 ? 'PASS_BETA14_FUNCTIONAL_GATE' : 'FAIL_BETA14_FUNCTIONAL_GATE',
  evidenceLevel: failures.length === 0 ? 3 : 1,
  checks,
  failures,
  boundary: 'Beta14 public beta functional gate. This is not formal correctness, N5, fixpoint, or production-stable evidence.'
};
fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`decision=${report.decision}\n`);
process.stdout.write(`checks=${checks.length}\n`);
if (failures.length) {
  process.stdout.write(`failures=${failures.join(',')}\n`);
  process.exit(1);
}
