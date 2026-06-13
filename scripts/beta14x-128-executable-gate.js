#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const brik = path.join(root, 'src', 'brik.js');
const version = '0.1.0-beta.14.3';
const evidenceDir = path.join(root, 'evidence', 'beta14x-128-executable');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta14x-128-'));
const checks = [];
const failures = [];

function run(command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BRIK64_CONFIG_HOME: path.join(scratch, 'config'), BRIK64_NO_BANNER: '1', ...(options.env || {}) }
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

function assert(condition, message, detail = {}) {
  if (!condition) throw new Error(`${message}:${JSON.stringify(detail).slice(0, 1000)}`);
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
  assert(result.rc === 0, `${id}:expected_pass`, result);
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
  expectPass(`${name}:init`, process.execPath, [brik, 'init'], { cwd: dir });
  return dir;
}

function literalFor(type, index) {
  if (type === 'f64') return index === 0 ? '4.0' : '2.0';
  if (type === 'bool') return index === 0 ? '1' : '0';
  return String(index + 2);
}

function fixtureFor(monomer) {
  const safe = `${monomer.id}_${monomer.name}`.replace(/[^A-Za-z0-9_]/g, '_');
  const args = monomer.inputTypes.map((type, index) => literalFor(type, index)).join(', ');
  const needsBoundary = monomer.boundary !== 'pure_local_candidate' && monomer.boundary !== 'contract_local';
  const returnType = !needsBoundary && monomer.outputType === 'f64' ? 'f64' : 'i64';
  return [
    '// brik64.pcd_file.v1',
    `// generated_by: brik64-cli ${version} beta14x 128 executable gate`,
    '// claim_boundary: local_candidate_or_boundary_contract',
    `PC ${safe} {`,
    needsBoundary ? `    boundary ${monomer.key};` : null,
    `    fn ${safe}() -> ${returnType} {`,
    `        return ${monomer.key}(${args});`,
    '    }',
    '}',
    ''
  ].filter(Boolean).join('\n');
}

record('registry:128', () => {
  const report = JSON.parse(expectPass('monomers-list', process.execPath, [brik, 'monomers', 'list', '--json']).stdout);
  assert(report.coreCount === 64, 'core_count_mismatch', report);
  assert(report.extendedCount === 64, 'extended_count_mismatch', report);
  assert(report.totalCount === 128, 'total_count_mismatch', report);
  assert(report.monomers.length === 128, 'monomer_list_length_mismatch', report);
  return { total: report.totalCount };
});

record('pcd_or_boundary_executable:128', () => {
  const work = initWork('matrix');
  const registry = JSON.parse(expectPass('monomers-list', process.execPath, [brik, 'monomers', 'list', '--json'], { cwd: work }).stdout);
  const matrix = [];
  for (const monomer of registry.monomers) {
    const file = path.join(work, 'pcd', `${monomer.id}_${monomer.name}.pcd`);
    write(file, fixtureFor(monomer));
    expectPass(`certify:${monomer.key}`, process.execPath, [brik, 'certify', path.relative(work, file)], { cwd: work });
    expectPass(`verify:${monomer.key}`, process.execPath, [brik, 'verify', path.relative(work, file)], { cwd: work });
    matrix.push({
      key: monomer.key,
      boundary: monomer.boundary,
      fixture: path.relative(work, file),
      certify: 'PASS',
      verify: 'PASS'
    });
  }
  return { executableTotal: matrix.length, matrix };
});

record('target_parity:representative_rust_ts_python', () => {
  const work = initWork('targets');
  const registry = JSON.parse(expectPass('monomers-list-targets', process.execPath, [brik, 'monomers', 'list', '--json'], { cwd: work }).stdout);
  const representative = [
    'MC_11.NOT8',
    'MC_64.FADD',
    'MC_70.FSQRT',
    'MC_79.FLOOR',
    'MC_85.HTTP_GET',
    'MC_104.DIR_LIST',
    'MC_112.SPAWN',
    'MC_127.JSON_EMIT'
  ].map((key) => registry.monomers.find((monomer) => monomer.key === key));
  for (const monomer of representative) {
    const file = path.join(work, 'pcd', `${monomer.id}_${monomer.name}.pcd`);
    write(file, fixtureFor(monomer));
    expectPass(`certify-target:${monomer.key}`, process.execPath, [brik, 'certify', path.relative(work, file)], { cwd: work });
    for (const target of ['ts', 'python', 'rust']) {
      expectPass(`emit:${target}:${monomer.key}`, process.execPath, [brik, 'emit', path.relative(work, file), '--target', target, '--out', `out-${target}-${monomer.id}`, '--tests'], { cwd: work });
    }
    expectPass(`run-ts:${monomer.key}`, process.execPath, [`out-ts-${monomer.id}/program.test.mjs`], { cwd: work });
    expectPass(`run-python:${monomer.key}`, 'python3', [`out-python-${monomer.id}/test_program.py`], { cwd: work });
    expectPass(`run-rust:${monomer.key}`, 'cargo', ['test', '--quiet'], { cwd: path.join(work, `out-rust-${monomer.id}`) });
  }
  return { representativeCount: representative.length, targets: ['ts', 'python', 'rust'] };
});

record('lift:directory_and_rust_preview', () => {
  const work = initWork('lift');
  write(path.join(work, 'src-js', 'math.js'), 'function clampScore(x) { return Math.min(Math.max(x, 0), 255); }\n');
  write(path.join(work, 'src-py', 'math.py'), 'def clamp_score(x: int) -> int:\n    return min(max(x, 0), 255)\n');
  write(path.join(work, 'src-rs', 'math.rs'), 'pub fn plus_one(x: i64) -> i64 { return x + 1; }\n');
  for (const [language, dir] of [['js', 'src-js'], ['python', 'src-py'], ['rust', 'src-rs']]) {
    const manifest = JSON.parse(expectPass(`lift:${language}`, process.execPath, [brik, 'lift', language, dir, '--preview', '--json'], { cwd: work }).stdout);
    assert(manifest.candidateCount >= 1, `lift_candidate_missing:${language}`, manifest);
    assert(manifest.source.fileCount >= 1, `lift_file_count_missing:${language}`, manifest);
    for (const candidate of manifest.candidates) {
      assert(!String(candidate.file).includes('beta14.2'), `lift_stale_candidate:${language}`, candidate);
    }
  }
});

fs.mkdirSync(evidenceDir, { recursive: true });
const report = {
  schemaVersion: 'brik64.beta14x_128_executable_gate.v1',
  version,
  decision: failures.length === 0 ? 'PASS_BETA14X_128_EXECUTABLE_GATE' : 'FAIL_BETA14X_128_EXECUTABLE_GATE',
  beta15Blocked: failures.length !== 0,
  checks,
  failures,
  claimBoundary: '128 executable means PCD local execution or explicit deterministic boundary-contract execution, not real external IO execution.'
};
fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`decision=${report.decision}\n`);
process.stdout.write(`checks=${checks.length}\n`);
if (failures.length > 0) {
  process.stdout.write(`failures=${failures.join(',')}\n`);
  process.exit(1);
}
