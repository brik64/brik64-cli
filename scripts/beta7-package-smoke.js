#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.7';
const outDir = path.join(root, 'evidence', 'beta7-package-smoke');
const pkgDir = path.join(root, 'evidence', 'beta7-package');
const manifestPath = path.join(pkgDir, 'package.manifest.json');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function run(args, cwd, env = {}) {
  return spawnSync(args[0], args.slice(1), {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

function requirePass(name, args, cwd, contains, env) {
  const result = run(args, cwd, env);
  if (result.status !== 0) throw new Error(`${name}:rc=${result.status}:stderr=${result.stderr}`);
  if (contains && !`${result.stdout}\n${result.stderr}`.includes(contains)) {
    throw new Error(`${name}:missing:${contains}`);
  }
  return result;
}

function requireFailClosed(name, args, cwd, contains, env) {
  const result = run(args, cwd, env);
  if (result.status === 0) throw new Error(`${name}:unexpected_pass`);
  if (contains && !`${result.stdout}\n${result.stderr}`.includes(contains)) {
    throw new Error(`${name}:missing:${contains}`);
  }
  return result;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const packagePath = path.join(root, manifest.package.path);
  if (manifest.version !== version) throw new Error(`manifest_version_drift:${manifest.version}`);
  if (manifest.decision !== 'PASS_BETA7_PACKAGE_BUILT') throw new Error(`package_decision_drift:${manifest.decision}`);
  if (manifest.releaseEligible !== false) throw new Error('beta7_candidate_should_not_be_public_release_eligible');
  if (sha256File(packagePath) !== manifest.package.sha256) throw new Error('package_hash_mismatch');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta7-package-smoke-'));
  requirePass('extract', ['tar', '-xzf', packagePath, '-C', tmp], root);
  const extracted = path.join(tmp, `brik64-cli-${version}`);
  const brik = path.join(extracted, 'src/brik.js');
  const configHome = path.join(tmp, 'config');

  requirePass('version', ['node', brik, '--version'], extracted, `BRIK64 CLI ${version}`);
  requirePass('help', ['node', brik, '--help'], extracted, 'polymerize <files>');
  requirePass('engine-status', ['node', brik, 'engine', 'status'], extracted, '"runtimeMode": "portable_bir_bundle"');

  const work = path.join(tmp, 'work');
  fs.mkdirSync(work);
  requirePass('init', ['node', brik, 'init'], work, 'created=.brik/manifest.json');
  fs.mkdirSync(path.join(work, 'pcd'));
  fs.writeFileSync(path.join(work, 'pcd/inventory.pcd'), 'PC inventory { fn inventory(input) { return 1; } }\n');
  fs.writeFileSync(path.join(work, 'program.pcd'), 'PC sample { fn sample(input) { if (input == 0) { return 1; } return 2; } }\n');
  fs.writeFileSync(path.join(work, 'other.pcd'), 'PC other { fn other(input) { return 3; } }\n');
  fs.writeFileSync(path.join(work, 'legacy.pcd'), 'pc legacy { fn legacy(input) { return 5; } }\n');

  requirePass('doctor-human', ['node', brik, 'doctor'], work, 'BRIK64 workspace doctor');
  requirePass('doctor-json', ['node', brik, 'doctor', '--json'], work, '"schemaVersion": "brik64.cli_doctor_report.v1"');
  requirePass('account-status', ['node', brik, 'account', 'status'], work, 'tier: free', { BRIK64_CONFIG_HOME: configHome });
  requirePass('certify', ['node', brik, 'certify', 'program.pcd'], work, 'certificate=program.pcd.cert.json');
  requirePass('verify', ['node', brik, 'verify', 'program.pcd'], work, 'verification=PASS');
  requirePass('polymerize', ['node', brik, 'polymerize', 'program.pcd', 'other.pcd', '--out', 'polymer.pcd', '--json'], work, '"schemaVersion": "brik64.cli_polymer_manifest.v1"');
  requirePass('migrate', ['node', brik, 'migrate', 'legacy.pcd', '--out', 'legacy.beta7.pcd', '--json'], work, '"detectedSyntax": "legacy_lowercase_pc"');
  requireFailClosed('cloud-verify-no-entitlement', ['node', brik, 'verify', 'program.pcd', '--cloud'], work, 'managed_entitlement_required', { BRIK64_CONFIG_HOME: configHome });

  const report = {
    schemaVersion: 'brik64.cli_beta7_package_smoke.v1',
    version,
    decision: 'PASS_BETA7_LOCAL_PACKAGE_SMOKE',
    releaseEligible: false,
    lane: 'cli_0_1_beta',
    generationClaim: 'assisted_generation_non_claim',
    package: manifest.package,
    checks: [
      'extract',
      'version',
      'help',
      'engine-status',
      'init',
      'doctor-human',
      'doctor-json',
      'account-status',
      'certify',
      'verify',
      'polymerize',
      'migrate',
      'cloud-verify-no-entitlement'
    ],
    boundary: 'Beta7 package smoke covers the local distributable candidate. It is not public release evidence until public surfaces and SDK/skill/docs gates pass together.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`checks=${report.checks.length}\n`);
}

try {
  main();
} catch (error) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify({
    schemaVersion: 'brik64.cli_beta7_package_smoke.v1',
    version,
    decision: 'FAIL_BETA7_LOCAL_PACKAGE_SMOKE',
    releaseEligible: false,
    error: error.message
  }, null, 2)}\n`);
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
