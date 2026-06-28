#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'src', 'brik.js');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const evidenceDir = path.join(root, 'evidence', 'beta16_1-full-release-audit');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta15-7-full-audit-'));
const records = [];

function run(id, command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || work,
    env: { ...process.env, BRIK64_NO_BANNER: '1', ...(options.env || {}) },
    encoding: 'utf8',
    timeout: options.timeoutMs || 120000,
    maxBuffer: 96 * 1024 * 1024,
  });
  const record = {
    id,
    command: [command, ...args],
    cwd: options.cwd || work,
    status: result.error?.code === 'ETIMEDOUT' ? 124 : (result.status === null ? 124 : result.status),
    elapsedMs: Date.now() - started,
    stdout: result.stdout || '',
    stderr: result.error?.code === 'ETIMEDOUT' ? `command_timeout:${options.timeoutMs || 120000}` : (result.stderr || ''),
  };
  records.push(record);
  if (!options.allowFailure && record.status !== 0) {
    throw new Error(`${id}:rc=${record.status}\n${record.stderr || record.stdout}`);
  }
  const combined = `${record.stdout}\n${record.stderr}`;
  if (options.expect && !combined.includes(options.expect)) {
    throw new Error(`${id}:missing:${options.expect}\n${combined}`);
  }
  if (options.expectRegex && !options.expectRegex.test(combined)) {
    throw new Error(`${id}:missing_regex:${options.expectRegex}\n${combined}`);
  }
  return record;
}

function assert(condition, message, detail = {}) {
  if (!condition) {
    const error = new Error(message);
    error.detail = detail;
    throw error;
  }
}

function write(file, content) {
  const full = path.join(work, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

function parseJsonRecord(record) {
  return JSON.parse(record.stdout);
}

function expectFail(id, args, expected) {
  const record = run(id, process.execPath, [cli, ...args], { allowFailure: true });
  assert(record.status !== 0, `${id}:unexpected_success`, record);
  const combined = `${record.stdout}\n${record.stderr}`;
  if (expected instanceof RegExp) {
    assert(expected.test(combined), `${id}:missing_expected_error`, { expected: String(expected), combined });
  } else {
    assert(combined.includes(expected), `${id}:missing_expected_error`, { expected, combined });
  }
  return record;
}

function certifyVerify(file) {
  run(`certify:${file}`, process.execPath, [cli, 'certify', file]);
  const verify = parseJsonRecord(run(`verify:${file}`, process.execPath, [cli, 'verify', file, '--json']));
  assert(verify.status === 'PASS', `verify_not_pass:${file}`, verify);
}

function findFile(start, name) {
  const entries = fs.readdirSync(start, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(start, entry.name);
    if (entry.isFile() && entry.name === name) return full;
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    }
  }
  return null;
}

function runGenerated(target, outDir) {
  const cwd = path.join(work, outDir);
  if (target === 'ts') {
    const test = findFile(cwd, 'program.test.mjs');
    assert(Boolean(test), `generated_ts_test_missing:${outDir}`);
    run(`generated:${outDir}:ts`, process.execPath, [test], { cwd });
    return;
  }
  if (target === 'python') {
    run(`generated:${outDir}:python`, 'python3', ['-m', 'pytest', '-q'], { cwd, env: { PYTHONPATH: cwd } });
    return;
  }
  if (target === 'rust') {
    const cargo = findFile(cwd, 'Cargo.toml');
    assert(Boolean(cargo), `generated_rust_cargo_missing:${outDir}`);
    run(`generated:${outDir}:rust`, 'cargo', ['test', '--quiet'], { cwd: path.dirname(cargo) });
  }
}

function emitAndTest(file, target, outDir) {
  run(`emit:${file}:${target}`, process.execPath, [cli, 'emit', file, '--target', target, '--out', outDir, '--tests']);
  runGenerated(target, outDir);
}

function commandHelpMatrix() {
  const commands = ['init', 'doctor', 'engine', 'account', 'certify', 'verify', 'emit', 'polymerize', 'monomers', 'lift', 'template', 'update', 'ledger', 'lock', 'domain', 'adoption', 'explain', 'skill', 'telemetry', 'errors', 'feedback', 'exit-codes'];
  for (const command of commands) run(`help:${command}`, process.execPath, [cli, 'help', command]);
}

function writeValidPcds() {
  write('pcd/core/integer_division_gate.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC integer_division_gate {
  domain x: i64 [0, 1000];
  domain y: i64 [1, 1000];
  fn integer_division_gate(x: i64, y: i64) -> i64 {
    if (x > 10) return x / y;
    return MC_00.ADD8(x, 1);
  }
}
`);
  write('pcd/core/local_function_gate.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC local_function_gate {
  domain x: i64 [0, 255];
  fn helper(x: i64) -> i64 { return MC_00.ADD8(x, 2); }
  fn local_function_gate(x: i64) -> i64 {
    if (x == 0) return 0;
    return helper(x);
  }
}
`);
  write('pcd/extended/float_amount_gate.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC float_amount_gate {
  boundary MC_66.FMUL;
  boundary MC_67.FDIV;
  domain amount: f64 [0.0, 130000.0];
  domain days: f64 [1.0, 31.0];
  fn float_amount_gate(amount: f64, days: f64) -> f64 {
    if (amount <= 0.0) return 0.0;
    return MC_07.CLAMP(MC_66.FMUL(MC_67.FDIV(amount, days), 30.0), 0.0, 130000.0);
  }
}
`);
}

function runDirectFunctionalChecks() {
  run('version', process.execPath, [cli, '--version'], { expect: `BRIK64 CLI ${version}` });
  assert(/^0\.1\.0-beta\.16\.1$/.test(version), 'version_not_beta16_1_family', { version });
  const engine = parseJsonRecord(run('engine_status', process.execPath, [cli, 'engine', 'status', '--json']));
  assert(engine.engine === 'L4+N5', 'engine_not_l4plus_n5', engine);
  assert(engine.runtimeProfile === 'l4plus_n5_local', 'runtime_profile_not_l4plus_n5_local', engine);
  assert(engine.localRuntime === 'available', 'local_runtime_not_available', engine);
  assert(engine.releaseEligible === true, 'engine_not_release_eligible', engine);
  assert(!/L[56]\+?N5|l[56]plus|fixpoint|self-hosting/i.test(JSON.stringify(engine.limitations || [])), 'engine_status_private_claim_leak', engine);
  commandHelpMatrix();
  run('init', process.execPath, [cli, 'init'], { expect: 'created=.brik/manifest.json' });
  writeValidPcds();
  for (const file of [
    'pcd/core/integer_division_gate.pcd',
    'pcd/core/local_function_gate.pcd',
    'pcd/extended/float_amount_gate.pcd',
  ]) {
    certifyVerify(file);
  }
  const monomers = parseJsonRecord(run('monomers_all', process.execPath, [cli, 'monomers', 'test', '--all', '--json']));
  assert(monomers.total === 128 && monomers.passed === 128 && monomers.failed === 0, 'monomer_128_matrix_not_pass', monomers);
  const doctor = parseJsonRecord(run('doctor_project', process.execPath, [cli, 'doctor', '--scope', 'project', '--json']));
  assert(doctor.status === 'PASS', 'doctor_project_not_pass', doctor);
  for (const file of ['pcd/core/integer_division_gate.pcd', 'pcd/extended/float_amount_gate.pcd']) {
    for (const target of ['ts', 'python', 'rust']) {
      emitAndTest(file, target, `out/${path.basename(file, '.pcd')}-${target}`);
    }
  }
  run('polymerize_core', process.execPath, [cli, 'polymerize', 'pcd/core/integer_division_gate.pcd', 'pcd/core/local_function_gate.pcd', '--inline', '--root', 'integer_division_gate', '--out', 'polymer/core.polymer.pcd'], { expect: 'polymer=polymer/core.polymer.pcd' });
  run('polymerize_extended', process.execPath, [cli, 'polymerize', 'pcd/extended/float_amount_gate.pcd', '--inline', '--root', 'float_amount_gate', '--out', 'polymer/extended.polymer.pcd'], { expect: 'polymer=polymer/extended.polymer.pcd' });
  run('polymerize_app', process.execPath, [cli, 'polymerize', 'polymer/core.polymer.pcd', 'polymer/extended.polymer.pcd', '--inline', '--root', 'integer_division_gate', '--out', 'polymer/app.polymer.pcd'], { expect: 'polymer=polymer/app.polymer.pcd' });
  for (const file of ['polymer/core.polymer.pcd', 'polymer/extended.polymer.pcd', 'polymer/app.polymer.pcd']) certifyVerify(file);
  for (const target of ['ts', 'python', 'rust']) emitAndTest('polymer/app.polymer.pcd', target, `out/app-polymer-${target}`);
}

function runLiftRoundtripChecks() {
  write('src/score.ts', 'export function score(x: number): number { if (x > 0) return x + 1; return 0; }\n');
  write('src/score.js', 'function score(x) { if (x > 0) return x + 1; return 0; }\n');
  write('src/score.py', 'def score(x: int) -> int:\n    if x > 0:\n        return x + 1\n    return 0\n');
  write('src/score.rs', 'pub fn score(x: i64) -> i64 { if x > 0 { return x + 1; } return 0; }\n');
  const reports = [];
  for (const [language, source] of [
    ['ts', 'src/score.ts'],
    ['js', 'src/score.js'],
    ['python', 'src/score.py'],
    ['rust', 'src/score.rs'],
  ]) {
    const out = `.brik/lift-preview/${language}`;
    const report = parseJsonRecord(run(`lift:${language}`, process.execPath, [cli, 'lift', language, source, '--preview', '--out', out, '--json']));
    reports.push(report);
    assert(report.candidateCount >= 1, `lift_candidate_missing:${language}`, report);
    assert(report.certificationEligibleCandidateCount >= 1, `lift_candidate_not_certification_eligible:${language}`, report);
    const candidatesDir = path.join(work, out, 'candidates');
    for (const candidate of fs.readdirSync(candidatesDir).filter((file) => file.endsWith('.pcd'))) {
      const rel = path.relative(work, path.join(candidatesDir, candidate));
      certifyVerify(rel);
      for (const target of ['ts', 'python', 'rust']) emitAndTest(rel, target, `out/lift-${language}-${target}`);
    }
  }
  write('src/unsupported.ts', `export function risky(price: number, tier: string): number {
  if (tier === "premium" && price > 0) return price * 0.8;
  return price;
}
`);
  const unsupported = parseJsonRecord(run('lift:unsupported_warning', process.execPath, [cli, 'lift', 'ts', 'src/unsupported.ts', '--preview', '--out', '.brik/lift-preview/unsupported', '--json']));
  assert(unsupported.warningCodes.includes('lift_string_logic_not_represented') || unsupported.warningCodes.includes('unsupported_lift_construct'), 'unsupported_lift_warning_missing', unsupported);
  assert(unsupported.semanticCoveragePercent < 100 || unsupported.certificationEligibleCandidateCount === 0, 'unsupported_lift_report_too_optimistic', unsupported);
  return reports;
}

function runAdversarialChecks() {
  write('adversarial/missing_header.pcd', 'PC bad { fn bad(x: i64) -> i64 { return x; } }\n');
  expectFail('adversarial:missing_header', ['certify', 'adversarial/missing_header.pcd'], 'missing_pcd_header');
  write('adversarial/return_type_mismatch.pcd', `// brik64.pcd_file.v1
PC mismatch { fn mismatch(x: i64) -> i64 { return 1.5; } }
`);
  expectFail('adversarial:return_type_mismatch', ['certify', 'adversarial/return_type_mismatch.pcd'], 'return_type_mismatch');
  write('adversarial/implicit_numeric_coercion.pcd', `// brik64.pcd_file.v1
PC coercion { fn coercion(x: i64) -> i64 { return x + 1.5; } }
`);
  expectFail('adversarial:implicit_numeric_coercion', ['certify', 'adversarial/implicit_numeric_coercion.pcd'], /implicit_numeric_coercion|numeric_literal_type_mismatch/);
  write('adversarial/non_exhaustive_return.pcd', `// brik64.pcd_file.v1
PC nonret { fn nonret(x: i64) -> i64 { if (x > 0) return x; } }
`);
  expectFail('adversarial:non_exhaustive_return', ['certify', 'adversarial/non_exhaustive_return.pcd'], 'non_exhaustive_return');
  write('adversarial/reserved_identifier.pcd', `// brik64.pcd_file.v1
PC reserved { fn if(x: i64) -> i64 { return x; } }
`);
  expectFail('adversarial:reserved_identifier', ['certify', 'adversarial/reserved_identifier.pcd'], 'reserved_identifier');
  write('adversarial/unsupported_monomer.pcd', `// brik64.pcd_file.v1
PC unsupported { fn unsupported(x: i64) -> i64 { return MC_999.NOPE(x); } }
`);
  expectFail('adversarial:unsupported_monomer', ['certify', 'adversarial/unsupported_monomer.pcd'], 'unsupported_monomer_call');
  write('adversarial/boundary_missing.pcd', `// brik64.pcd_file.v1
PC boundary_missing { fn boundary_missing(x: i64) -> i64 { return MC_85.HTTP_GET(x); } }
`);
  expectFail('adversarial:boundary_missing', ['certify', 'adversarial/boundary_missing.pcd'], /effect_boundary_required|external_effect_requires_extended_boundary/);
  write('adversarial/empty.pcd', '');
  expectFail('adversarial:empty_pcd', ['certify', 'adversarial/empty.pcd'], 'pcd_empty');
  expectFail('adversarial:path_traversal_emit', ['emit', 'pcd/core/integer_division_gate.pcd', '--target', 'ts', '--out', '../escape', '--tests'], 'path_outside_workspace');
  const outside = path.join(work, '..', `outside-${process.pid}.pcd`);
  fs.writeFileSync(outside, '// brik64.pcd_file.v1\nPC outside { fn outside(x: i64) -> i64 { return x; } }\n');
  try {
    fs.symlinkSync(outside, path.join(work, 'adversarial', 'symlink-outside.pcd'));
    expectFail('adversarial:symlink_outside', ['certify', 'adversarial/symlink-outside.pcd'], 'path_outside_workspace');
  } finally {
    fs.rmSync(outside, { force: true });
  }
  fs.copyFileSync(path.join(work, 'pcd/core/integer_division_gate.pcd'), path.join(work, 'adversarial/stale.pcd'));
  run('adversarial:certify_stale_source', process.execPath, [cli, 'certify', 'adversarial/stale.pcd']);
  fs.appendFileSync(path.join(work, 'adversarial/stale.pcd'), '\n// tamper\n');
  expectFail('adversarial:stale_cert_emit', ['emit', 'adversarial/stale.pcd', '--target', 'ts', '--out', 'out/stale', '--tests'], 'certificate_hash_mismatch');
  const ledgerPass = parseJsonRecord(run('ledger_verify_before_tamper', process.execPath, [cli, 'ledger', 'verify', '--json']));
  assert(ledgerPass.status === 'PASS', 'ledger_before_tamper_not_pass', ledgerPass);
  const ledgerPath = path.join(work, '.brik', 'ledger', 'events.jsonl');
  const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n');
  const first = JSON.parse(lines[0]);
  first.payload = { ...(first.payload || {}), tampered: true };
  lines[0] = JSON.stringify(first);
  fs.writeFileSync(ledgerPath, `${lines.join('\n')}\n`);
  expectFail('adversarial:ledger_tamper', ['ledger', 'verify', '--json'], 'ledger_event_hash_mismatch');
}

fs.mkdirSync(evidenceDir, { recursive: true });

try {
  runDirectFunctionalChecks();
  const liftReports = runLiftRoundtripChecks();
  runAdversarialChecks();
  const report = {
    schemaVersion: 'brik64.cli_beta16_1_full_release_audit_gate.v1',
    version,
    decision: 'PASS_BRIK64_CLI_BETA16_1_FULL_RELEASE_AUDIT_GATE',
    evidenceLevel: 'NIVEL 3',
    releaseEligible: false,
    publicationAllowed: false,
    workdir: work,
    checked: [
      'version_and_l4plus_n5_engine_status',
      'command_help_matrix',
      'monomer_128_matrix',
      'certify_verify_core_extended',
      'emit_ts_python_rust_generated_tests',
      'polymer_core_extended_app_system',
      'lift_ts_js_python_rust_roundtrip',
      'unsupported_lift_warning_contract',
      'type_safety_fail_closed',
      'pcd_header_contract',
      'boundary_and_monomer_fail_closed',
      'path_and_symlink_traversal_fail_closed',
      'stale_certificate_fail_closed',
      'ledger_tamper_fail_closed',
    ],
    lift: liftReports.map((item) => ({
      language: item.language,
      candidateCount: item.candidateCount,
      certificationEligibleCandidateCount: item.certificationEligibleCandidateCount,
      semanticCoveragePercent: item.semanticCoveragePercent,
    })),
    records: records.map((record) => ({
      id: record.id,
      status: record.status,
      elapsedMs: record.elapsedMs,
      stdout: record.stdout.slice(0, 1600),
      stderr: record.stderr.slice(0, 1600),
    })),
    claimBoundary: 'Local candidate audit gate only. Does not establish formal certification, N5, fixpoint, self-hosting, or universal correctness.',
  };
  fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write('decision=PASS_BRIK64_CLI_BETA16_1_FULL_RELEASE_AUDIT_GATE\n');
} catch (error) {
  const report = {
    schemaVersion: 'brik64.cli_beta16_1_full_release_audit_gate.v1',
    version,
    decision: 'FAIL_BRIK64_CLI_BETA16_1_FULL_RELEASE_AUDIT_GATE',
    evidenceLevel: 'NIVEL 3',
    releaseEligible: false,
    publicationAllowed: false,
    workdir: work,
    error: error.message,
    detail: error.detail || null,
    records: records.map((record) => ({
      id: record.id,
      status: record.status,
      elapsedMs: record.elapsedMs,
      stdout: record.stdout.slice(0, 1600),
      stderr: record.stderr.slice(0, 1600),
    })),
  };
  fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
