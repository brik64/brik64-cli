#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'src', 'brik.js');
const version = '0.1.0-beta.15.4';
const evidenceDir = path.join(root, 'evidence', 'beta15_4-rust-polymer-domain');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta15-4-rust-polymer-'));
const records = [];

function run(id, command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || work,
    env: { ...process.env, BRIK64_NO_BANNER: '1', ...(options.env || {}) },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const record = {
    id,
    command: [command, ...args],
    cwd: options.cwd || work,
    status: result.status === null ? 124 : result.status,
    elapsedMs: Date.now() - started,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
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

function write(file, content) {
  const full = path.join(work, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function read(file) {
  return fs.readFileSync(path.join(work, file), 'utf8');
}

function assert(condition, message, detail = {}) {
  if (!condition) {
    const error = new Error(message);
    error.detail = detail;
    throw error;
  }
}

function runGeneratedTests(target, outDir) {
  const dir = path.join(work, outDir);
  if (target === 'ts') {
    run(`test:${outDir}:ts`, process.execPath, ['program.test.mjs'], { cwd: dir });
    return;
  }
  if (target === 'python') {
    const testFile = fs.readdirSync(path.join(dir, 'tests')).find((name) => /^test_.*\.py$/.test(name));
    run(`test:${outDir}:python`, 'python3', [path.join('tests', testFile)], {
      cwd: dir,
      env: { PYTHONPATH: dir }
    });
    return;
  }
  if (target === 'rust') {
    const record = run(`test:${outDir}:rust`, 'cargo', ['test', '--quiet'], { cwd: dir });
    assert(!/\bwarning:/.test(record.stderr), 'rust_generated_warning', { outDir, stderr: record.stderr });
  }
}

function writeFixtures() {
  write('pcd/core/risk_floor_core.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC risk_floor_core {
    domain score: i64 [0, 255];
    fn risk_floor_core(score: i64) -> i64 {
        if (score > 200) return MC_01.SUB8(score, 10);
        return MC_00.ADD8(score, 5);
    }
}
`);

  write('pcd/core/risk_limit_core.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC risk_limit_core {
    domain amount: i64 [0, 255];
    domain divisor: i64 [1, 255];
    fn risk_limit_core(amount: i64, divisor: i64) -> tuple_u8_u8 {
        return MC_03.DIV8(amount, divisor);
    }
}
`);

  write('pcd/extended/ratio_extended.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC ratio_extended {
    boundary MC_67.FDIV;
    boundary MC_66.FMUL;
    domain numerator: f64 [1.0, 1000.0];
    domain denominator: f64 [1.0, 1000.0];
    fn ratio_extended(numerator: f64, denominator: f64) -> f64 {
        return MC_66.FMUL(MC_67.FDIV(numerator, denominator), 100.0);
    }
}
`);

  write('pcd/extended/sqrt_extended.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC sqrt_extended {
    boundary MC_70.FSQRT;
    domain input: f64 [0.0, 1000.0];
    fn sqrt_extended(input: f64) -> f64 {
        return MC_70.FSQRT(input);
    }
}
`);
}

function adversarialChecks() {
  write('adversarial/corrupt.pcd', 'PC corrupt { fn run(input: i64) -> i64 { return MC_999.NOPE(input); } }\n');
  const invalid = run('adversarial:invalid_monomer', process.execPath, [cli, 'certify', 'adversarial/corrupt.pcd'], { allowFailure: true });
  assert(invalid.status !== 0, 'invalid_monomer_unexpected_success');
  assert(/unsupported_monomer|pcd_parse_error|unknown_monomer/i.test(`${invalid.stdout}\n${invalid.stderr}`), 'invalid_monomer_error_not_actionable', invalid);

  const traversal = run('adversarial:path_traversal_emit', process.execPath, [
    cli,
    'emit',
    'polymers/app_system.polymer.pcd',
    '--target',
    'ts',
    '--out',
    '../outside',
    '--tests'
  ], { allowFailure: true });
  assert(traversal.status !== 0, 'path_traversal_unexpected_success');

  fs.copyFileSync(path.join(work, 'polymers', 'app_system.polymer.pcd.cert.json'), path.join(work, 'polymers', 'app_system.polymer.pcd.cert.json.bak'));
  fs.appendFileSync(path.join(work, 'polymers', 'app_system.polymer.pcd'), '\n// tamper\n');
  const stale = run('adversarial:stale_cert', process.execPath, [cli, 'verify', 'polymers/app_system.polymer.pcd'], { allowFailure: true });
  assert(stale.status !== 0, 'stale_cert_unexpected_success');
}

fs.mkdirSync(evidenceDir, { recursive: true });

try {
  run('version', process.execPath, [cli, '--version'], { expect: `BRIK64 CLI ${version}` });
  run('init', process.execPath, [cli, 'init'], { expect: 'created=.brik/manifest.json' });
  writeFixtures();

  const pcdFiles = [
    'pcd/core/risk_floor_core.pcd',
    'pcd/core/risk_limit_core.pcd',
    'pcd/extended/ratio_extended.pcd',
    'pcd/extended/sqrt_extended.pcd'
  ];
  for (const file of pcdFiles) {
    run(`certify:${file}`, process.execPath, [cli, 'certify', file]);
    run(`verify:${file}`, process.execPath, [cli, 'verify', file]);
  }

  run('polymerize:core', process.execPath, [
    cli,
    'polymerize',
    'pcd/core/risk_floor_core.pcd',
    'pcd/core/risk_limit_core.pcd',
    '--inline',
    '--root',
    'risk_floor_core',
    '--out',
    'polymers/core_logic.polymer.pcd'
  ], { expect: 'polymer=polymers/core_logic.polymer.pcd' });

  run('polymerize:extended', process.execPath, [
    cli,
    'polymerize',
    'pcd/extended/ratio_extended.pcd',
    'pcd/extended/sqrt_extended.pcd',
    '--inline',
    '--root',
    'ratio_extended',
    '--out',
    'polymers/extended_logic.polymer.pcd'
  ], { expect: 'polymer=polymers/extended_logic.polymer.pcd' });

  run('polymerize:app_system', process.execPath, [
    cli,
    'polymerize',
    'polymers/core_logic.polymer.pcd',
    'polymers/extended_logic.polymer.pcd',
    '--inline',
    '--root',
    'risk_floor_core',
    '--out',
    'polymers/app_system.polymer.pcd'
  ], { expect: 'polymer=polymers/app_system.polymer.pcd' });

  for (const file of ['polymers/core_logic.polymer.pcd', 'polymers/extended_logic.polymer.pcd', 'polymers/app_system.polymer.pcd']) {
    run(`certify:${file}`, process.execPath, [cli, 'certify', file]);
    run(`verify:${file}`, process.execPath, [cli, 'verify', file]);
  }

  const appPolymer = read('polymers/app_system.polymer.pcd');
  assert(appPolymer.includes('fn risk_floor_core'), 'app_polymer_missing_core_root');
  assert(appPolymer.includes('fn ratio_extended'), 'app_polymer_missing_extended_body');
  assert(appPolymer.includes('boundary MC_67.FDIV'), 'app_polymer_missing_extended_boundary');

  const emitMatrix = [
    ['ts', 'out/app-ts'],
    ['python', 'out/app-python'],
    ['rust', 'out/app-rust']
  ];
  for (const [target, outDir] of emitMatrix) {
    run(`emit:app:${target}`, process.execPath, [cli, 'emit', 'polymers/app_system.polymer.pcd', '--target', target, '--out', outDir, '--tests']);
    runGeneratedTests(target, outDir);
  }

  const rustProgram = fs.readFileSync(path.join(work, 'out/app-rust/src/lib.rs'), 'utf8');
  assert(!/assert_domain\([^)]*numerator/.test(rustProgram), 'rust_app_assert_domain_references_extended_domain');
  assert(!/assert_domain\([^)]*denominator/.test(rustProgram), 'rust_app_assert_domain_references_extended_domain');
  assert(!/assert_domain\([^)]*input/.test(rustProgram), 'rust_app_assert_domain_references_non_root_domain');

  const doctor = JSON.parse(run('doctor', process.execPath, [cli, 'doctor', '--json']).stdout);
  assert(doctor.status === 'PASS', 'doctor_status_not_pass', doctor);

  adversarialChecks();

  const report = {
    schemaVersion: 'brik64.cli_beta15_4_rust_polymer_domain_gate.v1',
    version,
    decision: 'PASS_BRIK64_CLI_BETA15_4_RUST_POLYMER_DOMAIN_GATE',
    evidenceLevel: 'NIVEL 3',
    releaseEligible: false,
    workdir: work,
    checked: [
      'core_polymer_certify_verify',
      'extended_polymer_certify_verify',
      'app_system_polymer_certify_verify',
      'app_system_emit_ts_python_rust',
      'rust_app_polymer_cargo_test',
      'rust_app_domain_assertion_scope',
      'doctor_pass',
      'invalid_monomer_fail_closed',
      'path_traversal_fail_closed',
      'stale_cert_fail_closed'
    ],
    records: records.map((record) => ({
      id: record.id,
      status: record.status,
      elapsedMs: record.elapsedMs,
      stdout: record.stdout.slice(0, 1600),
      stderr: record.stderr.slice(0, 1600)
    }))
  };
  fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write('decision=PASS_BRIK64_CLI_BETA15_4_RUST_POLYMER_DOMAIN_GATE\n');
} catch (error) {
  const report = {
    schemaVersion: 'brik64.cli_beta15_4_rust_polymer_domain_gate.v1',
    version,
    decision: 'FAIL_BRIK64_CLI_BETA15_4_RUST_POLYMER_DOMAIN_GATE',
    evidenceLevel: 'NIVEL 3',
    releaseEligible: false,
    workdir: work,
    error: error.message,
    detail: error.detail || null,
    records: records.map((record) => ({
      id: record.id,
      status: record.status,
      elapsedMs: record.elapsedMs,
      stdout: record.stdout.slice(0, 1600),
      stderr: record.stderr.slice(0, 1600)
    }))
  };
  fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

