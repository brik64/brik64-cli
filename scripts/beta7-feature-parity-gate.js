#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const brik = path.join(root, 'src', 'brik.js');
const outDir = path.join(root, 'evidence', 'beta7-feature-parity');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function run(args, cwd, env = {}) {
  return spawnSync(args[0], args.slice(1), {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

function pass(name, args, cwd, contains, env) {
  const result = run(args, cwd, env);
  if (result.status !== 0) throw new Error(`${name}:rc=${result.status}:stderr=${result.stderr}`);
  const output = `${result.stdout}\n${result.stderr}`;
  if (contains && !output.includes(contains)) throw new Error(`${name}:missing:${contains}`);
  return result;
}

function failClosed(name, args, cwd, contains, env) {
  const result = run(args, cwd, env);
  if (result.status === 0) throw new Error(`${name}:unexpected_pass`);
  const output = `${result.stdout}\n${result.stderr}`;
  if (contains && !output.includes(contains)) throw new Error(`${name}:missing:${contains}:output=${output}`);
  return result;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta7-feature-parity-'));
  const configHome = path.join(tmp, 'config');
  const work = path.join(tmp, 'work');
  fs.mkdirSync(work);

  const checks = [];
  pass('version', ['node', brik, '--version'], work, 'BRIK64 CLI 0.1.0-beta.7');
  checks.push('version');
  pass('help-polymerize', ['node', brik, '--help'], work, 'polymerize <files>');
  checks.push('help-polymerize');
  pass('init', ['node', brik, 'init'], work, 'created=.brik/manifest.json');
  checks.push('init');

  fs.mkdirSync(path.join(work, 'pcd'));
  fs.writeFileSync(path.join(work, 'pcd', 'inventory.pcd'), 'PC inventory { fn inventory(input) { return 1; } }\n');
  fs.writeFileSync(path.join(work, 'program.pcd'), 'PC sample { fn sample(input) { if (input == 0) { return 1; } return 2; } }\n');
  fs.writeFileSync(path.join(work, 'other.pcd'), 'PC other { fn other(input) { return 3; } }\n');
  fs.writeFileSync(path.join(work, 'legacy.pcd'), 'pc legacy { fn legacy(input) { return 5; } }\n');

  pass('doctor-human', ['node', brik, 'doctor'], work, 'BRIK64 workspace doctor');
  checks.push('doctor-human');
  pass('doctor-json', ['node', brik, 'doctor', '--json'], work, '"schemaVersion": "brik64.cli_doctor_report.v1"');
  checks.push('doctor-json');
  pass('account-status', ['node', brik, 'account', 'status'], work, 'tier: free', { BRIK64_CONFIG_HOME: configHome });
  checks.push('account-status');
  failClosed('cloud-verify-no-entitlement', ['node', brik, 'verify', 'program.pcd', '--cloud'], work, 'managed_entitlement_required', { BRIK64_CONFIG_HOME: configHome });
  checks.push('cloud-verify-no-entitlement');
  failClosed('cloud-polymerize-no-entitlement', ['node', brik, 'polymerize', 'program.pcd', '--cloud'], work, 'managed_entitlement_required', { BRIK64_CONFIG_HOME: configHome });
  checks.push('cloud-polymerize-no-entitlement');

  pass('certify', ['node', brik, 'certify', 'program.pcd'], work, 'certificate=program.pcd.cert.json');
  checks.push('certify');
  pass('verify-local', ['node', brik, 'verify', 'program.pcd'], work, 'verification=PASS');
  checks.push('verify-local');
  pass('emit-ts', ['node', brik, 'emit', 'program.pcd', '--target', 'ts', '--out', 'out-ts', '--tests'], work, 'generated=out-ts/program.ts');
  checks.push('emit-ts');
  pass('polymerize-local', ['node', brik, 'polymerize', 'program.pcd', 'other.pcd', '--out', 'polymer.pcd', '--json'], work, '"schemaVersion": "brik64.cli_polymer_manifest.v1"');
  checks.push('polymerize-local');
  pass('certify-polymer', ['node', brik, 'certify', 'polymer.pcd'], work, 'certificate=polymer.pcd.cert.json');
  checks.push('certify-polymer');
  failClosed('legacy-certify-suggests-migrate', ['node', brik, 'certify', 'legacy.pcd'], work, 'brik64 migrate');
  checks.push('legacy-certify-suggests-migrate');
  pass('migrate-legacy', ['node', brik, 'migrate', 'legacy.pcd', '--out', 'legacy.beta7.pcd', '--json'], work, '"detectedSyntax": "legacy_lowercase_pc"');
  checks.push('migrate-legacy');
  pass('certify-migrated', ['node', brik, 'certify', 'legacy.beta7.pcd'], work, 'certificate=legacy.beta7.pcd.cert.json');
  checks.push('certify-migrated');

  const polymer = fs.readFileSync(path.join(work, 'polymer.pcd'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(work, 'polymer.pcd.manifest.json'), 'utf8'));
  if (manifest.output_sha256 !== sha256(polymer)) throw new Error('polymer_manifest_hash_mismatch');
  checks.push('polymer-manifest-hash');

  const report = {
    schemaVersion: 'brik64.cli_beta7_feature_parity_gate.v1',
    version: '0.1.0-beta.7',
    decision: 'PASS_BETA7_FEATURE_PARITY_GATE',
    lane: 'cli_0_1_beta',
    generationClaim: 'assisted_generation_non_claim',
    checks,
    localRuntime: {
      parsesPcd: true,
      certifiesCandidate: true,
      emitsTargets: ['ts'],
      polymerizes: true,
      verifiesLocal: true,
      migratesLegacy: true
    },
    managedRuntimeBoundary: {
      cloudVerifyWithoutEntitlement: 'fail_closed',
      cloudPolymerizeWithoutEntitlement: 'fail_closed',
      endpointImplemented: false
    },
    releaseBoundary: {
      universalCorrectnessClaimAllowed: false,
      independentToolchainClosureAllowed: false
    }
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`checks=${checks.length}\n`);
}

try {
  main();
} catch (error) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify({
    schemaVersion: 'brik64.cli_beta7_feature_parity_gate.v1',
    version: '0.1.0-beta.7',
    decision: 'FAIL_BETA7_FEATURE_PARITY_GATE',
    error: error.message
  }, null, 2)}\n`);
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
