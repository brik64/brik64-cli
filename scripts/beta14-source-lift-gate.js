#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const brik = path.join(root, 'src', 'brik.js');
const version = '0.1.0-beta.14';
const evidenceDir = path.join(root, 'evidence', 'beta14-source-lift');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta14-'));
const checks = [];
const failures = [];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

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
    command: [command, ...args].join(' '),
    cwd: options.cwd || root,
    rc: result.status === null ? 124 : result.status,
    elapsedMs: Date.now() - started,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function tail(result) {
  return {
    rc: result.rc,
    stdoutTail: result.stdout.slice(-1200),
    stderrTail: result.stderr.slice(-1200)
  };
}

function assert(condition, message, detail = {}) {
  if (!condition) {
    const suffix = Object.keys(detail).length ? `:${JSON.stringify(detail).slice(0, 600)}` : '';
    throw new Error(`${message}${suffix}`);
  }
}

function record(id, fn) {
  const started = Date.now();
  try {
    const detail = fn() || {};
    checks.push({ id, status: 'PASS', elapsedMs: Date.now() - started, ...detail });
  } catch (error) {
    failures.push(`${id}:${error.message}`);
    checks.push({ id, status: 'FAIL', elapsedMs: Date.now() - started, error: error.message });
  }
}

function expectPass(id, command, args, options = {}) {
  const result = run(command, args, options);
  assert(result.rc === 0, `${id}:expected_pass`, tail(result));
  assert(!/(^|\n)\s+at .*\(|Node\.js v\d+\./.test(result.stderr), `${id}:stack_trace_leaked`, tail(result));
  return result;
}

function expectFail(id, command, args, expected, options = {}) {
  const result = run(command, args, options);
  assert(result.rc !== 0, `${id}:expected_failure`, tail(result));
  assert(`${result.stdout}\n${result.stderr}`.includes(expected), `${id}:missing_expected:${expected}`, tail(result));
  assert(!/(^|\n)\s+at .*\(|Node\.js v\d+\./.test(result.stderr), `${id}:stack_trace_leaked`, tail(result));
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
  assert(result.stdout.includes(`BRIK64 CLI ${version}`), 'version_mismatch', tail(result));
});

record('pcd:multi_function_emit_all_targets', () => {
  const work = initWork('multi-function');
  write(path.join(work, 'pcd', 'multi.pcd'), `PC multi {
  fn double(input: i64) -> i64 {
    return input * 2;
  }
  fn multi(input: i64) -> i64 {
    if (input > 3) {
      return double(input) + 1;
    } else {
      return input - 1;
    }
  }
}
`);
  expectPass('certify', process.execPath, [brik, 'certify', 'pcd/multi.pcd'], { cwd: work });
  expectPass('emit-ts', process.execPath, [brik, 'emit', 'pcd/multi.pcd', '--target', 'ts', '--out', 'out-ts', '--tests'], { cwd: work });
  expectPass('exec-ts', process.execPath, ['out-ts/program.test.mjs'], { cwd: work });
  expectPass('emit-python', process.execPath, [brik, 'emit', 'pcd/multi.pcd', '--target', 'python', '--out', 'out-python', '--tests'], { cwd: work });
  expectPass('exec-python', 'python3', ['out-python/test_program.py'], { cwd: work });
  expectPass('emit-rust', process.execPath, [brik, 'emit', 'pcd/multi.pcd', '--target', 'rust', '--out', 'out-rust', '--tests'], { cwd: work });
  expectPass('cargo-test', 'cargo', ['test', '--quiet'], { cwd: path.join(work, 'out-rust') });
  const clippy = expectPass('cargo-clippy', 'cargo', ['clippy', '--quiet', '--', '-D', 'warnings'], { cwd: path.join(work, 'out-rust') });
  return { rustClippyStdoutSha256: sha256(clippy.stdout) };
});

record('pcd:multi_function_fail_closed', () => {
  const work = initWork('multi-fail');
  write(path.join(work, 'missing_entry.pcd'), `PC missing_entry {
  fn helper(input) {
    return input;
  }
  fn other(input) {
    return helper(input);
  }
}
`);
  write(path.join(work, 'cycle.pcd'), `PC cycle {
  fn helper(input) {
    return cycle(input);
  }
  fn cycle(input) {
    return helper(input);
  }
}
`);
  expectFail('missing-entry', process.execPath, [brik, 'certify', 'missing_entry.pcd'], 'pcd_parse_error:missing_entrypoint:missing_entry', { cwd: work });
  expectFail('cycle', process.execPath, [brik, 'certify', 'cycle.pcd'], 'pcd_parse_error:local_function_cycle', { cwd: work });
});

record('migrate:force_overwrite_explicit_only', () => {
  const work = initWork('migrate');
  write(path.join(work, 'old.pcd'), `pc old {
  fn old(input) {
    return input + 1;
  }
}
`);
  expectPass('migrate-first', process.execPath, [brik, 'migrate', 'old.pcd', '--out', 'migrated.pcd'], { cwd: work });
  expectFail('migrate-existing', process.execPath, [brik, 'migrate', 'old.pcd', '--out', 'migrated.pcd'], 'output_exists:migrated.pcd', { cwd: work });
  expectPass('migrate-force', process.execPath, [brik, 'migrate', 'old.pcd', '--out', 'migrated.pcd', '--force'], { cwd: work });
  expectPass('migrate-short-force', process.execPath, [brik, 'migrate', 'old.pcd', '--out', 'migrated.pcd', '-f'], { cwd: work });
});

record('lift:js_ts_python_preview_and_privacy', () => {
  const work = initWork('lift');
  write(path.join(work, 'sample.js'), 'function addFee(x) { return x + 40; }\nconst half = (value) => value / 2;\nclass Unsupported {}\n');
  write(path.join(work, 'sample.ts'), 'function score(input: number): number { return input * 3; }\n');
  write(path.join(work, 'sample.py'), 'def rebate(value: int) -> int:\n    return value - 5\n');
  for (const [language, file] of [['js', 'sample.js'], ['ts', 'sample.ts'], ['python', 'sample.py']]) {
    const result = expectPass(`lift-${language}`, process.execPath, [brik, 'lift', language, file, '--preview', '--json'], { cwd: work });
    const manifest = JSON.parse(result.stdout);
    assert(manifest.schemaVersion === 'brik64.cli_lift_preview.v1', `${language}:schema_mismatch`);
    assert(manifest.previewOnly === true, `${language}:preview_flag_missing`);
    assert(manifest.certificatesGenerated === false, `${language}:certificates_generated`);
    assert(manifest.networkSent === false, `${language}:network_sent`);
    assert(manifest.source.rawSourceIncluded === false, `${language}:raw_source_included`);
    assert(manifest.source.absolutePathIncluded === false, `${language}:absolute_path_included`);
    assert(manifest.candidateCount >= 1, `${language}:candidate_missing`, manifest);
  }
  const adoption = expectPass('adoption-json', process.execPath, [brik, 'adoption', 'report', '--json', '--out', 'adoption.json'], { cwd: work });
  const report = JSON.parse(adoption.stdout);
  assert(report.schemaVersion === 'brik64.cli_adoption_report.v1', 'adoption_schema_mismatch');
  assert(report.generatedCandidates >= 3, 'adoption_candidate_count_low', report);
  assert(report.privacy.networkSent === false, 'adoption_network_sent');
  assert(report.privacy.rawSourceIncluded === false, 'adoption_raw_source_included');
});

record('lift:fail_closed_inputs', () => {
  const work = initWork('lift-fail');
  write(path.join(work, 'sample.js'), 'function ok(x) { return x + 1; }\n');
  write(path.join(work, 'binary.js'), 'abc\0def');
  expectFail('preview-required', process.execPath, [brik, 'lift', 'js', 'sample.js'], 'lift_preview_required', { cwd: work });
  expectFail('unsupported-language', process.execPath, [brik, 'lift', 'go', 'sample.js', '--preview'], 'lift_language_unsupported:go', { cwd: work });
  expectFail('binary-source', process.execPath, [brik, 'lift', 'js', 'binary.js', '--preview'], 'lift_binary_input', { cwd: work });
  expectFail('outside-workspace', process.execPath, [brik, 'lift', 'js', '../outside.js', '--preview'], 'path_outside_workspace', { cwd: work });
});

fs.mkdirSync(evidenceDir, { recursive: true });
const report = {
  schemaVersion: 'brik64.cli_beta14_source_lift_gate.v1',
  version,
  decision: failures.length === 0 ? 'PASS_BETA14_SOURCE_LIFT_GATE' : 'FAIL_BETA14_SOURCE_LIFT_GATE',
  releaseEligible: failures.length === 0,
  evidenceLevel: failures.length === 0 ? 3 : 1,
  checks,
  failures,
  boundary: 'Beta14 source lift is local preview only. It generates PCD candidates, not certificates or formal correctness claims.'
};
fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`decision=${report.decision}\n`);
process.stdout.write(`checks=${checks.length}\n`);
if (failures.length) {
  process.stdout.write(`failures=${failures.join(',')}\n`);
  process.exit(1);
}
