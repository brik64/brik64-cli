#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const outDir = path.join(root, 'evidence', 'beta18_2-package-smoke');
const reportPath = path.join(outDir, 'report.json');

function writeReport(report) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function run(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const error = new Error(`${command} ${args.join(' ')} failed`);
    error.result = result;
    throw error;
  }
  return result.stdout;
}

function main() {
  const failures = [];
  const manifestPath = path.join(root, 'evidence', 'beta18_2-package', 'package.manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    failures.push('package_manifest_missing');
  }
  const packagePath = manifest?.package?.path ? path.join(root, manifest.package.path) : null;
  if (!packagePath || !fs.existsSync(packagePath)) failures.push('package_tarball_missing');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta18-2-package-smoke-'));
  try {
    if (packagePath && fs.existsSync(packagePath)) {
      run('tar', ['-xzf', packagePath, '-C', tmp]);
      const brik = path.join(tmp, 'package', 'src', 'brik.js');
      const home = path.join(tmp, 'home');
      const work = path.join(tmp, 'work');
      fs.mkdirSync(work, { recursive: true });
      const env = { ...process.env, HOME: home, BRIK64_CONFIG_HOME: path.join(tmp, 'config') };

      const versionOut = run('node', [brik, '--version'], { cwd: work, env });
      if (!versionOut.includes(version)) failures.push('version_output_mismatch');

      run('node', [brik, 'init', '--profile', 'startup', '--structure', 'modular', '--json'], { cwd: work, env });
      fs.writeFileSync(path.join(work, 'pcd', 'core', 'gate.pcd'), `// brik64.pcd_file.v1
PC gate {
  domain amount: i32 [0, 1000];
  fn run(amount: i32) -> i32 {
    if (amount > 100) { return MC_00.ADD8(amount, 1); }
    return amount;
  }
}
`);
      run('node', [brik, 'certify', 'pcd/core/gate.pcd'], { cwd: work, env });
      const native = JSON.parse(run('node', [brik, 'test', 'pcd/core/gate.pcd', '--generate-scenarios', '--json'], { cwd: work, env }));
      if (native.decision !== 'PASS_BRIK64_NATIVE_TEST') failures.push(`native_test_decision_invalid:${native.decision || 'missing'}`);
      const audit = JSON.parse(run('node', [brik, 'audit', '.', '--out', '.brik/audit', '--json'], { cwd: work, env }));
      if (!audit.auditReport || !audit.outputs?.blueprintPlan) failures.push('audit_output_paths_missing');
      if (!fs.existsSync(path.join(work, '.brik', 'audit', 'BRIK64_AUDIT_REPORT.md'))) failures.push('audit_report_not_written');
      if (!fs.existsSync(path.join(work, '.brik', 'audit', 'blueprint', 'BRIK64_BLUEPRINT_PLAN.md'))) failures.push('blueprint_plan_not_written');
    }
  } catch (error) {
    failures.push(`smoke_exception:${error.message}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  const report = {
    schemaVersion: 'brik64.cli_beta18_2_package_smoke.v1',
    version,
    decision: failures.length === 0 ? 'PASS_BRIK64_CLI_BETA18_2_PACKAGE_SMOKE' : 'FAIL_BRIK64_CLI_BETA18_2_PACKAGE_SMOKE',
    releaseEligible: failures.length === 0,
    failures,
  };
  writeReport(report);
  console.log(`decision=${report.decision}`);
  if (failures.length) {
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }
}

main();
