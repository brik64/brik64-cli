#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'src', 'brik.js');
const version = '0.1.0-beta.15.7';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta15-7-semantic-'));
const evidenceDir = path.join(root, 'evidence', 'beta15_7-semantic-correctness');
const records = [];

function run(id, command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || work,
    env: { ...process.env, BRIK64_NO_BANNER: '1', ...(options.env || {}) },
    encoding: 'utf8',
    timeout: options.timeoutMs || 120000,
    maxBuffer: 64 * 1024 * 1024
  });
  const record = {
    id,
    command: [command, ...args],
    cwd: options.cwd || work,
    status: result.error?.code === 'ETIMEDOUT' ? 124 : (result.status === null ? 124 : result.status),
    elapsedMs: Date.now() - started,
    stdout: result.stdout || '',
    stderr: result.error?.code === 'ETIMEDOUT' ? `command_timeout:${options.timeoutMs || 120000}` : (result.stderr || '')
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

function write(rel, content) {
  const file = path.join(work, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function assert(condition, message, detail = {}) {
  if (!condition) {
    const error = new Error(message);
    error.detail = detail;
    throw error;
  }
}

function assertFailContains(id, args, expected) {
  const result = run(id, process.execPath, [cli, ...args], { allowFailure: true });
  assert(result.status !== 0, `${id}:unexpected_success`, result);
  assert(`${result.stdout}\n${result.stderr}`.includes(expected), `${id}:missing_expected_error:${expected}`, result);
}

function certifyVerify(file) {
  run(`certify:${file}`, process.execPath, [cli, 'certify', file]);
  run(`verify:${file}`, process.execPath, [cli, 'verify', file]);
}

function emitAndRun(file, target, outDir) {
  run(`emit:${file}:${target}`, process.execPath, [cli, 'emit', file, '--target', target, '--out', outDir, '--tests']);
  const cwd = path.join(work, outDir);
  if (target === 'ts') run(`generated:${target}:${outDir}`, process.execPath, ['program.test.mjs'], { cwd });
  if (target === 'python') run(`generated:${target}:${outDir}`, 'python3', ['-m', 'pytest', '-q'], { cwd, env: { PYTHONPATH: cwd } });
  if (target === 'rust') run(`generated:${target}:${outDir}`, 'cargo', ['test', '--quiet'], { cwd });
}

function findFile(rootDir, name) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
      continue;
    }
    if (entry.isFile() && entry.name === name) return full;
  }
  return null;
}

function writeFixtures() {
  write('invalid/type_mismatch_return.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC type_mismatch_return {
  domain x: i64 [0, 10];
  fn type_mismatch_return(x: i64) -> i64 {
    return 1.5;
  }
}
`);
  write('invalid/i64_f64_coercion.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC i64_f64_coercion {
  domain x: i64 [0, 10];
  fn i64_f64_coercion(x: i64) -> i64 {
    return x + 1.5;
  }
}
`);
  write('invalid/missing_return_path.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC missing_return_path {
  domain x: i64 [0, 10];
  fn missing_return_path(x: i64) -> i64 {
    if (x > 5) return x;
  }
}
`);
  write('invalid/reserved_fn_if.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC reserved_fn_if {
  domain x: i64 [0, 10];
  fn if(x: i64) -> i64 {
    return x;
  }
}
`);
  write('invalid/missing_header.pcd', `PC missing_header {
  domain x: i64 [0, 10];
  fn missing_header(x: i64) -> i64 {
    return x;
  }
}
`);
  write('valid/i64_division_guarded.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC i64_division_guarded {
  domain numerator: i64 [-1000, 1000];
  domain denominator: i64 [-1000, 1000];
  fn i64_division_guarded(numerator: i64, denominator: i64) -> i64 {
    if (denominator == 0) return 0;
    return numerator / denominator;
  }
}
`);
  write('valid/f64_division_guarded.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC f64_division_guarded {
  domain numerator: f64 [-1000.0, 1000.0];
  domain denominator: f64 [-1000.0, 1000.0];
  fn f64_division_guarded(numerator: f64, denominator: f64) -> f64 {
    if (denominator == 0.0) return 0.0;
    return numerator / denominator;
  }
}
`);
  write('legacy/no_header_lowercase.pcd', `pc legacy_gate {
  fn legacy_gate(x) -> i64 {
    return x;
  }
}
`);
  write('src/temp.rs', `pub fn temp_guard(temp_c: i64) -> i64 {
  if temp_c > 45 {
    return 1;
  }
  return 0;
}
`);
  write('src/temp_float.rs', `pub fn temp_guard(temp_c: i64) -> i64 {
  if temp_c > 45.0 {
    return 1;
  }
  return 0;
}
`);
}

fs.mkdirSync(evidenceDir, { recursive: true });

try {
  run('version', process.execPath, [cli, '--version'], { expect: `BRIK64 CLI ${version}` });
  run('init', process.execPath, [cli, 'init'], { expect: 'created=.brik/manifest.json' });
  writeFixtures();

  assertFailContains('invalid:type_mismatch_return', ['certify', 'invalid/type_mismatch_return.pcd'], 'return_type_mismatch');
  assertFailContains('invalid:i64_f64_coercion', ['certify', 'invalid/i64_f64_coercion.pcd'], 'numeric_literal_type_mismatch');
  assertFailContains('invalid:missing_return_path', ['certify', 'invalid/missing_return_path.pcd'], 'non_exhaustive_return');
  assertFailContains('invalid:reserved_fn_if', ['certify', 'invalid/reserved_fn_if.pcd'], 'reserved_identifier');
  assertFailContains('invalid:missing_header', ['certify', 'invalid/missing_header.pcd'], 'missing_pcd_header');

  certifyVerify('valid/i64_division_guarded.pcd');
  certifyVerify('valid/f64_division_guarded.pcd');
  for (const target of ['ts', 'python', 'rust']) {
    emitAndRun('valid/i64_division_guarded.pcd', target, `out/i64-${target}`);
    emitAndRun('valid/f64_division_guarded.pcd', target, `out/f64-${target}`);
  }
  const tsProgram = fs.readFileSync(path.join(work, 'out/i64-ts/program.mjs'), 'utf8');
  const pythonProgramPath = findFile(path.join(work, 'out/i64-python'), 'program.py');
  assert(pythonProgramPath, 'python_program_file_missing');
  const pythonProgram = fs.readFileSync(pythonProgramPath, 'utf8');
  assert(tsProgram.includes('brik64IntDiv('), 'ts_integer_division_helper_missing');
  assert(pythonProgram.includes('brik64_int_div('), 'python_integer_division_helper_missing');

  run('migrate:dry_run', process.execPath, [cli, 'migrate', 'legacy/no_header_lowercase.pcd', '--dry-run', '--json'], { expect: '"detectedSyntax"' });
  run('migrate:write', process.execPath, [cli, 'migrate', 'legacy/no_header_lowercase.pcd', '--write'], { expect: 'migrated=legacy/no_header_lowercase.pcd' });
  certifyVerify('legacy/no_header_lowercase.pcd');

  const liftOk = JSON.parse(run('lift:rust:i64_literal', process.execPath, [cli, 'lift', 'rust', 'src/temp.rs', '--preview', '--out', '.brik/lift-preview/rust-ok', '--json']).stdout);
  assert(liftOk.candidateCount === 1, 'rust_i64_lift_candidate_missing', liftOk);
  const liftedCandidate = path.join('.brik', 'lift-preview', 'rust-ok', 'candidates', 'temp_guard.pcd');
  certifyVerify(liftedCandidate);

  const liftBlocked = JSON.parse(run('lift:rust:f64_literal_blocked', process.execPath, [cli, 'lift', 'rust', 'src/temp_float.rs', '--preview', '--out', '.brik/lift-preview/rust-f64', '--json']).stdout);
  assert(liftBlocked.candidateCount === 0, 'rust_f64_lift_candidate_should_be_blocked', liftBlocked);
  assert(liftBlocked.warningCodes.includes('numeric_literal_type_mismatch'), 'rust_f64_lift_warning_missing', liftBlocked);

  const engine = JSON.parse(run('engine:l4plus_status', process.execPath, [cli, 'engine', 'status', '--json']).stdout);
  assert(engine.engine === 'L4+N5', 'engine_l4plus_missing', engine);
  assert(engine.runtimeProfile === 'l4plus_n5_local', 'engine_runtime_profile_missing', engine);
  assert(engine.localRuntime === 'available', 'engine_local_runtime_missing', engine);

  const report = {
    schemaVersion: 'brik64.cli_beta15_7_semantic_correctness_gate.v1',
    version,
    decision: 'PASS_BRIK64_CLI_BETA15_7_SEMANTIC_CORRECTNESS_GATE',
    evidenceLevel: 'NIVEL 3',
    workdir: work,
    checked: [
      'strict_return_type_mismatch',
      'implicit_numeric_coercion_rejected',
      'non_exhaustive_return_rejected',
      'reserved_identifier_rejected',
      'pcd_header_required',
      'migrate_write_repairs_header',
      'integer_division_parity_ts_python_rust',
      'f64_division_parity_ts_python_rust',
      'lift_numeric_precision_blocks_f64_to_i64_candidate',
      'l4plus_n5_runtime_packaged'
    ],
    records
  };
  fs.writeFileSync(path.join(evidenceDir, 'gate-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(report.decision);
} catch (error) {
  const report = {
    schemaVersion: 'brik64.cli_beta15_7_semantic_correctness_gate.v1',
    version,
    decision: 'FAIL_BRIK64_CLI_BETA15_7_SEMANTIC_CORRECTNESS_GATE',
    error: error.message,
    detail: error.detail || null,
    workdir: work,
    records
  };
  fs.writeFileSync(path.join(evidenceDir, 'gate-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(error.stack || error.message);
  process.exit(1);
}
