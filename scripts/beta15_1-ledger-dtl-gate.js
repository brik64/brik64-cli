#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const brik = path.join(root, 'src', 'brik.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta15-1-'));

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [brik, ...args], {
    cwd: options.cwd || tmp,
    encoding: 'utf8',
    env: { ...process.env, BRIK64_NO_BANNER: '1' },
    maxBuffer: 8 * 1024 * 1024
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

function runGeneratedPythonTests() {
  const script = `
import importlib.util
import pathlib
import sys

root = pathlib.Path.cwd()
count = 0
for test_file in sorted(root.glob("**/tests/test_*.py")):
    spec = importlib.util.spec_from_file_location(test_file.stem, test_file)
    module = importlib.util.module_from_spec(spec)
    sys.path.insert(0, str(test_file.parent.parent))
    spec.loader.exec_module(module)
    for name in sorted(dir(module)):
        if name.startswith("test_") and callable(getattr(module, name)):
            getattr(module, name)()
            count += 1
if count == 0:
    raise SystemExit("no_generated_tests_executed")
print(f"generated_python_tests={count}")
`;
  return spawnSync('python3', ['-c', script], { cwd: tmp, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
}

try {
  run(['init']);
  write('pcd/a.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC a {
    domain input: i64 [0, 255];
    fn a(input: i64) -> i64 {
        if (input == 0) return 1;
        return 2;
    }
}
`);
  write('pcd/b.pcd', `// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC b {
    domain input: i64 [0, 255];
    fn b(input: i64) -> i64 {
        if (input == 0) return 3;
        return 4;
    }
}
`);

  run(['certify', 'pcd/a.pcd']);
  run(['certify', 'pcd/b.pcd']);
  const noRoot = run(['polymerize', 'pcd/a.pcd', 'pcd/b.pcd', '--inline', '--out', 'pcd/polymer.pcd'], { allowFailure: true });
  assert(noRoot.status !== 0, 'polymerize_without_root_should_fail');
  assert(String(noRoot.stderr).includes('polymerize_root_required'), 'polymerize_missing_root_error');

  run(['polymerize', 'pcd/a.pcd', 'pcd/b.pcd', '--inline', '--root', 'b', '--out', 'pcd/polymer.pcd']);
  const polymer = fs.readFileSync(path.join(tmp, 'pcd/polymer.pcd'), 'utf8');
  assert(polymer.includes('brik64-cli 0.1.0-beta.15.1'), 'polymer_version_metadata_stale');
  run(['certify', 'pcd/polymer.pcd']);

  run(['emit', 'pcd/a.pcd', '--target', 'python', '--out', 'src/core/a', '--tests']);
  run(['emit', 'pcd/b.pcd', '--target', 'python', '--out', 'src/core/b', '--tests']);
  assert(fs.existsSync(path.join(tmp, 'src/core/a/tests/test_a.py')), 'python_directory_mode_test_name_a_missing');
  assert(fs.existsSync(path.join(tmp, 'src/core/b/tests/test_b.py')), 'python_directory_mode_test_name_b_missing');
  assert(!fs.existsSync(path.join(tmp, 'src/core/a/test_a.py')), 'python_root_test_a_should_not_exist');
  assert(!fs.existsSync(path.join(tmp, 'src/core/b/test_b.py')), 'python_root_test_b_should_not_exist');
  const py = runGeneratedPythonTests();
  assert(py.status === 0, `generated_python_tests_failed:${py.stdout}${py.stderr}`);

  run(['lock', '--json']);
  const ledger = JSON.parse(run(['ledger', 'verify', '--json']).stdout);
  assert(ledger.status === 'PASS', 'ledger_should_verify');
  assert(ledger.eventCount >= 7, 'ledger_event_count_too_low');
  const exportReport = JSON.parse(run(['ledger', 'export', '--redacted']).stdout);
  assert(exportReport.redacted === true, 'ledger_export_not_redacted');
  assert(JSON.stringify(exportReport).includes('"absolutePathIncluded":false'), 'ledger_redaction_contract_missing');

  const eventsPath = path.join(tmp, '.brik/ledger/events.jsonl');
  const originalEvents = fs.readFileSync(eventsPath, 'utf8').trim().split('\n');
  const first = JSON.parse(originalEvents[0]);
  first.payload.extra = 'tamper';
  fs.writeFileSync(eventsPath, `${[JSON.stringify(first), ...originalEvents.slice(1)].join('\n')}\n`);
  const tamperedEdit = run(['ledger', 'verify', '--json'], { allowFailure: true });
  assert(tamperedEdit.status !== 0, 'tampered_edit_ledger_should_fail');
  assert(String(tamperedEdit.stdout).includes('ledger_event_hash_mismatch'), 'tamper_edit_error_missing');

  fs.writeFileSync(eventsPath, `${originalEvents.join('\n')}\n`);
  fs.writeFileSync(eventsPath, `${originalEvents.slice(1).join('\n')}\n`);
  const tamperedDelete = run(['ledger', 'verify', '--json'], { allowFailure: true });
  assert(tamperedDelete.status !== 0, 'tampered_delete_ledger_should_fail');
  assert(String(tamperedDelete.stdout).includes('ledger_sequence_mismatch'), 'tamper_delete_error_missing');

  fs.writeFileSync(eventsPath, `${originalEvents.join('\n')}\n`);
  if (originalEvents.length > 1) {
    const reordered = [originalEvents[1], originalEvents[0], ...originalEvents.slice(2)];
    fs.writeFileSync(eventsPath, `${reordered.join('\n')}\n`);
    const tamperedReorder = run(['ledger', 'verify', '--json'], { allowFailure: true });
    assert(tamperedReorder.status !== 0, 'tampered_reorder_ledger_should_fail');
    assert(String(tamperedReorder.stdout).includes('ledger_prev_hash_mismatch'), 'tamper_reorder_error_missing');
  }

  fs.writeFileSync(eventsPath, `${originalEvents.join('\n')}\n`);
  fs.rmSync(path.join(tmp, '.brik/ledger'), { recursive: true, force: true });
  const missingLedger = run(['ledger', 'verify', '--json'], { allowFailure: true });
  assert(missingLedger.status !== 0, 'missing_ledger_should_fail');
  assert(String(missingLedger.stdout).includes('ledger_events_missing'), 'missing_ledger_error_missing');

  process.stdout.write('decision=PASS_BRIK64_CLI_BETA15_1_LEDGER_DTL_GATE\n');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
