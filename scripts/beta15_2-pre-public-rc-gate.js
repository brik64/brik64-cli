#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const brik = path.join(root, 'src', 'brik.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta15-2-'));

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [brik, ...args], {
    cwd: options.cwd || tmp,
    encoding: 'utf8',
    env: { ...process.env, BRIK64_NO_BANNER: '1' },
    maxBuffer: 16 * 1024 * 1024
  });
  if (options.allowFailure) return result;
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error(`command_failed:${args.join(' ')}`);
  }
  return result;
}

function write(relative, content) {
  const file = path.join(tmp, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runPython(script) {
  const result = spawnSync('python3', ['-c', script], {
    cwd: tmp,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error('python_check_failed');
  }
  return result;
}

try {
  run(['init']);
  write('pcd/boundary_gate.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC boundary_gate {
    domain latitude_scaled: i64 [4100, 4200];
    domain longitude_scaled: i64 [150, 250];
    domain response_code: i64 [200, 599];

    fn geofence(latitude_scaled: i64, longitude_scaled: i64, response_code: i64) -> i64 {
        if (response_code == 200) {
            if (latitude_scaled >= 4100) {
                if (longitude_scaled >= 150) {
                    return 1;
                }
            }
        }
        return 0;
    }

    fn boundary_gate(latitude_scaled: i64, longitude_scaled: i64, response_code: i64) -> i64 {
        return geofence(latitude_scaled, longitude_scaled, response_code);
    }
}
`);

  run(['certify', 'pcd/boundary_gate.pcd']);
  run(['emit', 'pcd/boundary_gate.pcd', '--target', 'python', '--out', 'generated/boundary', '--tests']);
  const generatedTest = fs.readFileSync(path.join(tmp, 'generated/boundary/tests/test_boundary_gate.py'), 'utf8');
  assert(generatedTest.includes('above_max'), 'generated_tests_must_include_above_max_domain_case');
  assert(generatedTest.includes('below_min'), 'generated_tests_must_include_below_min_domain_case');

  runPython(`
import sys
from pathlib import Path
sys.path.insert(0, str(Path("generated/boundary").resolve()))
from brik64_generated_boundary_gate.program import run, geofence

assert run(4138, 205, 200) == 1
for args in [
    (4300, 205, 200),
    (4138, 300, 200),
    (4099, 205, 200),
    (4138, 149, 200),
]:
    failed = False
    try:
        run(*args)
    except ValueError as exc:
        failed = "domain_out_of_bounds" in str(exc)
    assert failed, ("run_domain_bypass", args)

for args in [
    (4300, 205, 200),
    (4138, 300, 200),
]:
    failed = False
    try:
        geofence(*args)
    except ValueError as exc:
        failed = "domain_out_of_bounds" in str(exc)
    assert failed, ("helper_domain_bypass", args)
`);

  runPython(`
import importlib.util
import pathlib
import sys
root = pathlib.Path("generated/boundary").resolve()
sys.path.insert(0, str(root))
for test_file in sorted((root / "tests").glob("test_*.py")):
    spec = importlib.util.spec_from_file_location(test_file.stem, test_file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for name in sorted(dir(module)):
        if name.startswith("test_") and callable(getattr(module, name)):
            getattr(module, name)()
`);

  write('.brik/audit/FINAL_AUDIT_REPORT.md', '# Final Audit\\n\\nThe system is RELEASE READY.\\n');
  const doctorContradiction = run(['doctor', '--json'], { allowFailure: true });
  assert(doctorContradiction.status !== 0, 'doctor_must_fail_release_ready_contradiction');
  assert(doctorContradiction.stdout.includes('claim_report_release_ready_contradiction'), 'doctor_missing_claim_contradiction_error');
  fs.writeFileSync(path.join(tmp, '.brik/audit/FINAL_AUDIT_REPORT.md'), '# Final Audit\\n\\nThe system is a local candidate only.\\n');
  const doctorClean = run(['doctor', '--json']);
  const doctor = JSON.parse(doctorClean.stdout);
  assert(doctor.status === 'PASS', 'doctor_should_pass_after_claim_report_superseded');
  assert(doctor.releaseEligible === false, 'doctor_release_eligible_must_remain_false');

  const ledger = JSON.parse(run(['ledger', 'verify', '--json']).stdout);
  assert(ledger.status === 'PASS', 'ledger_should_verify_before_tamper');
  const eventsPath = path.join(tmp, '.brik/ledger/events.jsonl');
  const events = fs.readFileSync(eventsPath, 'utf8').trim().split('\n');
  const first = JSON.parse(events[0]);
  first.payload.injected = 'tamper';
  fs.writeFileSync(eventsPath, `${[JSON.stringify(first), ...events.slice(1)].join('\n')}\n`);
  const tampered = run(['ledger', 'verify', '--json'], { allowFailure: true });
  assert(tampered.status !== 0, 'ledger_tamper_should_fail');
  assert(tampered.stdout.includes('ledger_event_hash_mismatch'), 'ledger_tamper_error_missing');

  process.stdout.write('decision=PASS_BRIK64_CLI_BETA15_2_PRE_PUBLIC_RC_GATE\n');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
