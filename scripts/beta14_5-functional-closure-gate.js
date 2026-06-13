#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'src', 'brik.js');
const version = '0.1.0-beta.14.5';
const evidenceDir = path.join(root, 'evidence', 'beta14_5-functional-closure');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    env: { ...process.env, BRIK64_NO_BANNER: '1', ...(options.env || {}) }
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error([
      `command failed: ${command} ${args.join(' ')}`,
      `cwd=${options.cwd || root}`,
      `status=${result.status}`,
      `stdout=${result.stdout}`,
      `stderr=${result.stderr}`
    ].join('\n'));
  }
  return result;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function parseJson(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${label} did not emit JSON\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
}

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta14-5-gate-'));
run('node', [cli, 'init'], { cwd: workspace });

const versionResult = run('node', [cli, '--version'], { cwd: workspace });
if (!versionResult.stdout.includes(version)) {
  throw new Error(`version mismatch: expected ${version}, got ${versionResult.stdout}`);
}

write(path.join(workspace, 'ts-src', 'math.ts'), [
  'export function clampScore(x: number): number {',
  '  return Math.floor(Math.min(Math.max(Math.abs(x), 0), 255));',
  '}',
  ''
].join('\n'));
const tsLift = parseJson(run('node', [cli, 'lift', 'ts', 'ts-src', '--preview', '--json', '--out', '.brik/lift-preview/ts'], { cwd: workspace }), 'ts lift');
if (tsLift.candidateCount < 1) {
  throw new Error(`ts lift did not produce a candidate: ${JSON.stringify(tsLift)}`);
}
run('node', [cli, 'certify', '.brik/lift-preview/ts/candidates/clampScore.pcd'], { cwd: workspace });

write(path.join(workspace, 'py-src', 'math.py'), [
  'def clamp_score(x):',
  '    return min(max(abs(x), 0), 255)',
  ''
].join('\n'));
const pyLift = parseJson(run('node', [cli, 'lift', 'python', 'py-src', '--preview', '--json', '--out', '.brik/lift-preview/python'], { cwd: workspace }), 'python lift');
if (pyLift.candidateCount < 1) {
  throw new Error(`python lift did not produce a candidate: ${JSON.stringify(pyLift)}`);
}
run('node', [cli, 'certify', '.brik/lift-preview/python/candidates/clamp_score.pcd'], { cwd: workspace });

write(path.join(workspace, 'rs-src', 'math.rs'), [
  'pub fn adjust(x: i64) -> i64 {',
  '    if x > 10 {',
  '        return x - 1;',
  '    }',
  '    return x + 1;',
  '}',
  ''
].join('\n'));
const rustLift = parseJson(run('node', [cli, 'lift', 'rust', 'rs-src', '--preview', '--json', '--out', '.brik/lift-preview/rust'], { cwd: workspace }), 'rust lift');
if (rustLift.candidateCount < 1) {
  throw new Error(`rust lift did not produce a candidate: ${JSON.stringify(rustLift)}`);
}
const rustPcd = fs.readFileSync(path.join(workspace, '.brik', 'lift-preview', 'rust', 'candidates', 'adjust.pcd'), 'utf8');
if (!rustPcd.includes('if (x > 10) return x - 1;') || !rustPcd.includes('return x + 1;')) {
  throw new Error(`rust lift did not preserve simple if/fallback body:\n${rustPcd}`);
}
run('node', [cli, 'certify', '.brik/lift-preview/rust/candidates/adjust.pcd'], { cwd: workspace });

write(path.join(workspace, 'pcd', 'gate.pcd'), [
  'PC gate {',
  '  fn run(x: i64, y: i64) -> i64 {',
  '    return MC_00.ADD8(x, y);',
  '  }',
  '}',
  ''
].join('\n'));
run('node', [cli, 'certify', 'pcd/gate.pcd'], { cwd: workspace });
run('node', [cli, 'verify', 'pcd/gate.pcd'], { cwd: workspace });
run('node', [cli, 'emit', 'pcd/gate.pcd', '--target', 'python', '--out', 'out-python', '--tests'], { cwd: workspace });
run('python3', ['test_program.py'], { cwd: path.join(workspace, 'out-python') });
const generatedPytest = fs.readFileSync(path.join(workspace, 'out-python', 'tests', 'test_program.py'), 'utf8');
if (!generatedPytest.includes('def test_generated_cases_pass():')) {
  throw new Error('generated python tests are not pytest-discoverable');
}
const pytestProbe = run('python3', ['-c', 'import pytest; print(pytest.__version__)'], {
  cwd: path.join(workspace, 'out-python'),
  allowFailure: true
});
const pytestStatus = pytestProbe.status === 0
  ? run('python3', ['-m', 'pytest', '-q'], { cwd: path.join(workspace, 'out-python') }).status
  : 'SKIPPED_PYTEST_NOT_INSTALLED';

const invalidTs = run('node', [cli, 'lift', 'ts', 'missing-src', '--preview', '--json'], { cwd: workspace, allowFailure: true });
if (invalidTs.status === 0) {
  throw new Error('missing source lift unexpectedly succeeded');
}

const report = {
  schemaVersion: 'brik64.beta14_5_functional_closure_gate.v1',
  version,
  decision: 'PASS_BETA14_5_FUNCTIONAL_CLOSURE_GATE',
  workspace,
  checks: {
    tsMathLift: tsLift.candidateCount,
    pythonMinMaxAbsLift: pyLift.candidateCount,
    rustDirectoryLift: rustLift.candidateCount,
    pythonPytestHarness: pytestStatus === 0 ? 'PASS' : pytestStatus,
    failClosedMissingSource: invalidTs.status
  }
};
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
