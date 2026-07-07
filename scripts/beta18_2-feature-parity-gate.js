#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const outDir = path.join(root, 'evidence', 'beta18_2-feature-parity');
const reportPath = path.join(outDir, 'report.json');

function run(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const error = new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
    error.result = result;
    throw error;
  }
  return result.stdout;
}

function main() {
  const failures = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta18-2-feature-'));
  const brik = path.join(root, 'src', 'brik.js');
  try {
    const env = { ...process.env, BRIK64_CONFIG_HOME: path.join(tmp, 'config') };
    run('node', [brik, 'init', '--profile', 'regulated', '--structure', 'modular', '--json'], { cwd: tmp, env });
    fs.writeFileSync(path.join(tmp, 'pcd', 'core', 'pricing.pcd'), `// brik64.pcd_file.v1
PC pricing {
  domain amount: i64 [0, 100000];
  fn run(amount: i64) -> i64 {
    if (amount <= 0) return 0;
    return MC_00.ADD8(amount, 1);
  }
}
`);
    fs.writeFileSync(path.join(tmp, 'pcd', 'core', 'pricing_v2.pcd'), `// brik64.pcd_file.v1
PC pricing {
  domain amount: i64 [0, 100000];
  fn run(amount: i64) -> i64 {
    if (amount <= 0) return 0;
    return MC_02.MUL8(amount, 2);
  }
}
`);
    const checks = [
      ['certify', ['certify', 'pcd/core/pricing.pcd']],
      ['explain', ['explain', 'pcd/core/pricing.pcd', '--suggest', '--fix-plan', '--json']],
      ['native_test', ['test', 'pcd/core/pricing.pcd', '--generate-scenarios', '--json']],
      ['diff', ['diff', 'pcd/core/pricing.pcd', 'pcd/core/pricing_v2.pcd', '--impact', '--json']],
      ['doc', ['doc', 'pcd/core/pricing.pcd', '--format', 'markdown', '--out', 'docs/brik64', '--json']],
      ['lint_policy', ['lint-policy', '.', '--policy', 'all', '--json']],
      ['audit', ['audit', '.', '--out', '.brik/audit', '--json']],
    ];
    const outputs = {};
    for (const [name, args] of checks) {
      outputs[name] = run('node', [brik, ...args], { cwd: tmp, env });
    }
    if (!outputs.native_test.includes('PASS_BRIK64_NATIVE_TEST')) failures.push('native_test_decision_missing');
    if (!outputs.audit.includes('BRIK64_AUDIT_REPORT.md')) failures.push('audit_report_path_missing');
    if (!fs.existsSync(path.join(tmp, '.brik', 'audit', 'blueprint', 'BRIK64_BLUEPRINT_PLAN.md'))) failures.push('blueprint_plan_missing');
  } catch (error) {
    failures.push(`feature_parity_exception:${error.message}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const report = {
    schemaVersion: 'brik64.cli_beta18_2_feature_parity_gate.v1',
    version,
    decision: failures.length === 0 ? 'PASS_BETA18_2_FEATURE_PARITY_GATE' : 'FAIL_BETA18_2_FEATURE_PARITY_GATE',
    publicationAllowed: failures.length === 0,
    failures,
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`decision=${report.decision}`);
  if (failures.length) {
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }
}

main();
