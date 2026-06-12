#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const brik = path.join(root, 'src', 'brik.js');
const version = '0.1.0-beta.14.1';
const evidenceDir = path.join(root, 'evidence', 'beta14_1-audit-closure');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta14-1-'));
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
    throw new Error(`${message}:${JSON.stringify(detail).slice(0, 600)}`);
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

function expectPass(id, args, options = {}) {
  const result = run(process.execPath, [brik, ...args], options);
  assert(result.rc === 0, `${id}:expected_pass`, result);
  assert(!/(^|\n)\s+at .*\(|Node\.js v\d+\./.test(result.stderr), `${id}:stack_trace_leaked`, result);
  return result;
}

function expectCommandPass(id, command, args, options = {}) {
  const result = run(command, args, options);
  assert(result.rc === 0, `${id}:expected_pass`, result);
  assert(!/(^|\n)\s+at .*\(|Node\.js v\d+\./.test(result.stderr), `${id}:stack_trace_leaked`, result);
  return result;
}

function expectFail(id, args, expected, options = {}) {
  const result = run(process.execPath, [brik, ...args], options);
  assert(result.rc !== 0, `${id}:expected_failure`, result);
  assert(`${result.stdout}\n${result.stderr}`.includes(expected), `${id}:missing_expected:${expected}`, result);
  assert(!/(^|\n)\s+at .*\(|Node\.js v\d+\./.test(result.stderr), `${id}:stack_trace_leaked`, result);
  return result;
}

function initWork(name) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(dir, { recursive: true });
  expectPass(`${name}:init`, ['init'], { cwd: dir });
  return dir;
}

record('version_and_quiet_output', () => {
  const result = expectPass('version', ['--version', '--quiet']);
  assert(result.stdout.includes(`BRIK64 CLI ${version}`), 'version_mismatch', result);
  assert(!result.stdout.includes('████'), 'quiet_banner_not_suppressed', result);
});

record('template_help_and_exit_codes', () => {
  const work = initWork('template');
  expectPass('template', ['template', '--type', 'numeric-monomer', '--out', 'pcd/add8.pcd'], { cwd: work });
  expectPass('certify-template', ['certify', 'pcd/add8.pcd'], { cwd: work });
  const help = expectPass('help-certify', ['help', 'certify', '--quiet'], { cwd: work });
  assert(help.stdout.includes('certify <file.pcd>'), 'per_command_help_missing', help);
  const codes = expectPass('help-exit-codes', ['help', 'exit-codes', '--quiet'], { cwd: work });
  assert(codes.stdout.includes('65  PCD parse'), 'exit_codes_missing', codes);
});

record('parser_numeric_monomers_inline_if_and_fail_closed_extended', () => {
  const work = initWork('monomers');
  write(path.join(work, 'calc.pcd'), `PC calc {
  fn calc(a: i64, b: i64) -> i64 {
    if (b == 0) return MC_00.ADD8(a, 1);
    return MC_04.MOD8(MC_02.MUL8(a, b), 10);
  }
}
`);
  write(path.join(work, 'string_bad.pcd'), `PC bad {
  fn bad(a: i64, b: i64) -> i64 {
    return MC_40.CONCAT(a, b);
  }
}
`);
  expectPass('certify-monomer', ['certify', 'calc.pcd'], { cwd: work });
  expectPass('emit-ts', ['emit', 'calc.pcd', '--target', 'ts', '--out', 'out-ts', '--tests'], { cwd: work });
  expectCommandPass('run-ts-test', process.execPath, ['out-ts/program.test.mjs'], { cwd: work });
  expectFail('unsupported-string-monomer', ['certify', 'string_bad.pcd'], 'unsupported_monomer_call:MC_40.CONCAT', { cwd: work });
});

record('doctor_and_lock_report_bad_file_names', () => {
  const work = initWork('doctor-lock');
  write(path.join(work, 'pcd', 'ok.pcd'), `PC ok { fn ok(input: i64) -> i64 { return input + 1; } }\n`);
  write(path.join(work, 'pcd', 'bad.pcd'), `PC bad { fn bad(input: i64) -> i64 { return MC_40.CONCAT(input, input); } }\n`);
  const doctor = expectFail('doctor-invalid', ['doctor', '--json'], 'pcd/bad.pcd', { cwd: work });
  assert(doctor.stdout.includes('"invalid": 1'), 'doctor_invalid_count_missing', doctor);
  expectFail('lock-default-fail-file', ['lock'], 'pcd/bad.pcd', { cwd: work });
  const partial = expectPass('lock-skip-errors', ['lock', '--skip-errors', '--json'], { cwd: work });
  const lock = JSON.parse(partial.stdout);
  assert(lock.partial === true && lock.errors.length === 1 && lock.pcds.length === 1, 'partial_lock_contract_mismatch', lock);
  const scoped = expectPass('lock-files', ['lock', '--files', 'pcd/ok.pcd', '--json'], { cwd: work });
  assert(JSON.parse(scoped.stdout).pcds.length === 1, 'scoped_lock_count_mismatch', scoped);
});

record('migrate_dry_run_and_legacy_function', () => {
  const work = initWork('migrate');
  write(path.join(work, 'legacy.pcd'), `pcd legacy(a: i64, b: i64) -> i64 {
if (a <= 0) return 0;
return a + b;
}
`);
  const dry = expectPass('migrate-dry', ['migrate', 'legacy.pcd', '--dry-run', '--out', 'legacy.new.pcd', '--json'], { cwd: work });
  const report = JSON.parse(dry.stdout);
  assert(report.dryRun === true && report.detectedSyntax === 'legacy_pcd_function', 'migrate_dry_contract_mismatch', report);
  assert(!fs.existsSync(path.join(work, 'legacy.new.pcd')), 'dry_run_wrote_file');
  expectPass('migrate-write', ['migrate', 'legacy.pcd', '--out', 'legacy.new.pcd'], { cwd: work });
  expectPass('certify-migrated', ['certify', 'legacy.new.pcd'], { cwd: work });
});

record('polymerize_inline_and_collision', () => {
  const work = initWork('polymer');
  write(path.join(work, 'a.pcd'), `PC a { fn a(input: i64) -> i64 { return input + 1; } }\n`);
  write(path.join(work, 'b.pcd'), `PC b { fn b(input: i64) -> i64 { return input * 2; } }\n`);
  expectPass('poly-inline', ['polymerize', 'a.pcd', 'b.pcd', '--inline', '--out', 'polymer.pcd', '--json'], { cwd: work });
  const output = fs.readFileSync(path.join(work, 'polymer.pcd'), 'utf8');
  assert(output.includes('fn a(') && output.includes('fn b('), 'inline_functions_missing', { output });
  write(path.join(work, 'c.pcd'), `PC c { fn a(input: i64) -> i64 { return input; } }\n`);
  expectFail('poly-collision', ['polymerize', 'a.pcd', 'c.pcd', '--inline', '--out', 'bad.pcd'], 'polymer_inline_name_collision:a', { cwd: work });
});

record('lift_best_effort_and_stub_only', () => {
  const work = initWork('lift');
  write(path.join(work, 'pricing.js'), `function discount(price, quantity) {
  if (quantity <= 0) return 0;
  if (quantity >= 10) return price - 5;
  return price;
}
`);
  const best = expectPass('lift-best', ['lift', 'js', 'pricing.js', '--preview', '--json'], { cwd: work });
  const manifest = JSON.parse(best.stdout);
  assert(manifest.candidates[0].translationStatus === 'best_effort_simple_body', 'lift_translation_status_missing', manifest);
  const pcd = fs.readFileSync(path.join(work, '.brik', 'lift-preview', 'js-' + manifest.source.sourceSha256.slice(0, 8), 'candidates', 'discount.pcd'), 'utf8');
  assert(pcd.includes('if (quantity <= 0) return 0;'), 'lift_if_body_missing', { pcd });
  const stub = expectPass('lift-stub', ['lift', 'js', 'pricing.js', '--preview', '--stub-only', '--out', 'stub', '--json'], { cwd: work });
  assert(JSON.parse(stub.stdout).candidates[0].translationStatus === 'stub', 'stub_status_missing', stub);
});

record('skill_check_version', () => {
  const work = initWork('skill');
  write(path.join(work, 'SKILL.md'), `---\nname: brik64\n---\nCurrent public CLI: ${version}\n`);
  expectPass('skill-aligned', ['skill', 'check-version', '--path', 'SKILL.md', '--json'], { cwd: work });
  write(path.join(work, 'SKILL.md'), `Current public CLI: 0.1.0-beta.5\n`);
  expectFail('skill-drift', ['skill', 'check-version', '--path', 'SKILL.md'], 'skill_check=FAIL', { cwd: work });
});

fs.mkdirSync(evidenceDir, { recursive: true });
const report = {
  schemaVersion: 'brik64.cli_beta14_1_audit_closure_gate.v1',
  version,
  decision: failures.length === 0 ? 'PASS_BETA14_1_AUDIT_CLOSURE_GATE' : 'FAIL_BETA14_1_AUDIT_CLOSURE_GATE',
  evidenceLevel: failures.length === 0 ? 3 : 1,
  checks,
  failures,
  boundary: 'Beta14.1 audit closure gate. Local candidate/product UX evidence only; not formal correctness, N5, self-hosting, or fixpoint evidence.'
};
fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`decision=${report.decision}\n`);
process.stdout.write(`checks=${checks.length}\n`);
if (failures.length) {
  process.stdout.write(`failures=${failures.join(',')}\n`);
  process.exit(1);
}
