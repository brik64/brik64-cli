#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const cli = path.join(repoRoot, 'src', 'brik.js');
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta11-doctor-empty-'));

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: workdir,
    encoding: 'utf8',
    ...options
  });
}

function assert(condition, message, detail = {}) {
  if (!condition) {
    console.error(JSON.stringify({
      schemaVersion: 'brik64.beta11_doctor_empty_workspace_gate.v1',
      decision: 'FAIL_BETA11_DOCTOR_EMPTY_WORKSPACE',
      message,
      detail,
      workdir
    }, null, 2));
    process.exit(1);
  }
}

const init = run(['init']);
assert(init.status === 0, 'init_failed', { status: init.status, stdout: init.stdout, stderr: init.stderr });

const human = run(['doctor']);
assert(human.status === 65, 'doctor_human_should_fail_closed_on_empty_inventory', {
  status: human.status,
  stdout: human.stdout,
  stderr: human.stderr
});
assert(human.stdout.includes('BRIK64 workspace doctor'), 'doctor_human_header_missing', { stdout: human.stdout });
assert(human.stdout.includes('status: FAIL'), 'doctor_human_fail_status_missing', { stdout: human.stdout });
assert(human.stdout.includes('pcd_inventory_empty'), 'doctor_human_empty_inventory_missing', { stdout: human.stdout });
assert(
  human.stdout.includes('Add at least one .pcd file under ./pcd'),
  'doctor_human_action_missing',
  { stdout: human.stdout }
);
assert(!human.stdout.includes('release eligible: yes'), 'doctor_human_must_not_report_release_eligible', { stdout: human.stdout });

const machine = run(['doctor', '--json']);
assert(machine.status === 65, 'doctor_json_should_fail_closed_on_empty_inventory', {
  status: machine.status,
  stdout: machine.stdout,
  stderr: machine.stderr
});
let report;
try {
  report = JSON.parse(machine.stdout);
} catch (error) {
  assert(false, 'doctor_json_parse_failed', { stdout: machine.stdout, error: error.message });
}
assert(report.schemaVersion === 'brik64.cli_doctor_report.v1', 'doctor_json_schema_mismatch', { report });
assert(report.status === 'FAIL', 'doctor_json_status_should_fail', { report });
assert(report.pcdCount === 0, 'doctor_json_pcd_count_should_be_zero', { report });
assert(report.releaseEligible === false, 'doctor_json_release_eligible_must_be_false', { report });
assert(
  Array.isArray(report.diagnostics?.errors) && report.diagnostics.errors.includes('pcd_inventory_empty'),
  'doctor_json_empty_inventory_error_missing',
  { report }
);
assert(
  Array.isArray(report.diagnostics?.actions) &&
    report.diagnostics.actions.some((action) => action.includes('Add at least one .pcd file under ./pcd')),
  'doctor_json_action_missing',
  { report }
);

console.log(JSON.stringify({
  schemaVersion: 'brik64.beta11_doctor_empty_workspace_gate.v1',
  decision: 'PASS_BETA11_DOCTOR_EMPTY_WORKSPACE',
  workdir,
  checks: [
    'empty_workspace_human_fail_closed',
    'empty_workspace_json_fail_closed',
    'release_eligible_false',
    'actionable_recovery_message'
  ]
}, null, 2));
