#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.6';
const outDir = path.join(root, 'evidence', 'beta6-package');
const stagingName = `brik64-cli-${version}`;
const staging = path.join(outDir, 'stage', stagingName);
const packageName = `brik64-cli-${version}.tgz`;

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const baseInclude = [
  '.brik/manifest.json',
  'CHANGELOG.md',
  'README.md',
  'package.json',
  'src/brik.js',
  'pcd/cli_core.pcd',
  'pcd/cli_polymer.pcd',
  'pcd/beta6_package_harness.pcd',
  'pcd/l6_full_cli_generation_factory.pcd',
  'engines/l4plus-n5/runtime-bundle.manifest.json',
  'evidence/beta6-l6-hetzner-generation/report.json',
  'evidence/beta6-l6-full-generation-contract/report.json',
  'evidence/beta6-l6-full-materialization-attempt/report.json',
  'evidence/beta6-package-harness/report.json',
  'evidence/beta6-package-harness/generated/package-harness.manifest.json'
];

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function copy(relativePath) {
  const source = path.join(root, relativePath);
  if (!fs.existsSync(source)) throw new Error(`missing_package_input:${relativePath}`);
  const dest = path.join(staging, relativePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
  return {
    path: relativePath,
    sha256: sha256File(source),
    bytes: fs.statSync(source).size
  };
}

function run(args, cwd = root) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function assertBeta6Inputs() {
  const packageJson = readJson('package.json');
  const brikManifest = readJson('.brik/manifest.json');
  const l6Hetzner = readJson('evidence/beta6-l6-hetzner-generation/report.json');
  const l6Contract = readJson('evidence/beta6-l6-full-generation-contract/report.json');
  const materialization = readJson('evidence/beta6-l6-full-materialization-attempt/report.json');
  const packageHarness = readJson('evidence/beta6-package-harness/report.json');
  const harnessManifest = readJson('evidence/beta6-package-harness/generated/package-harness.manifest.json');

  const failures = [];
  if (packageJson.version !== version) failures.push(`package_version_drift:${packageJson.version}`);
  if (brikManifest.cliVersion !== version) failures.push(`brik_manifest_version_drift:${brikManifest.cliVersion}`);
  if (brikManifest.engineTierPolicy?.l6DistributionAllowed !== false) failures.push('l6_distribution_boundary_open');
  if (l6Hetzner.decision !== 'PASS_L6_FULL_CLI_GENERATION_READY') failures.push(`l6_hetzner_not_ready:${l6Hetzner.decision}`);
  if (l6Contract.decision !== 'PASS_BETA6_L6_FULL_GENERATION_CONTRACT_RECORDED') failures.push(`l6_contract_not_recorded:${l6Contract.decision}`);
  if (materialization.decision !== 'PASS_BETA6_L6_FULL_HARNESS_MATERIALIZED') failures.push(`l6_materialization_not_pass:${materialization.decision}`);
  if (materialization.releaseEligible !== false) failures.push('l6_materialization_release_boundary_open');
  if (packageHarness.decision !== 'PASS_BETA6_PACKAGE_HARNESS_GENERATED_FROM_PCD') failures.push(`package_harness_not_generated:${packageHarness.decision}`);
  if (harnessManifest.decision !== 'PASS_BETA6_PACKAGE_HARNESS_READY') failures.push(`harness_manifest_not_ready:${harnessManifest.decision}`);
  if (harnessManifest.version !== version) failures.push(`harness_manifest_version_drift:${harnessManifest.version}`);
  if (failures.length > 0) throw new Error(`beta6_package_input_gate_failed:${failures.join(',')}`);
}

function main() {
  assertBeta6Inputs();
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  const runtimeBundle = readJson('engines/l4plus-n5/runtime-bundle.manifest.json');
  const l4Artifacts = runtimeBundle.artifacts.map((artifact) => artifact.path);
  const include = [...new Set([...baseInclude, ...l4Artifacts])].sort();
  const artifacts = include.map(copy);
  fs.chmodSync(path.join(staging, 'src/brik.js'), 0o755);

  const packagePath = path.join(outDir, packageName);
  run(['tar', '-czf', packagePath, '-C', path.join(outDir, 'stage'), stagingName]);
  const tarSha = sha256File(packagePath);
  const manifest = {
    schemaVersion: 'brik64.cli_beta6_package_manifest.v1',
    version,
    decision: 'PASS_BETA6_PACKAGE_BUILT',
    releaseEligible: true,
    lane: 'cli_0_1_beta',
    generationClaim: 'assisted_generation_non_claim',
    package: {
      path: path.relative(root, packagePath),
      sha256: tarSha,
      bytes: fs.statSync(packagePath).size
    },
    artifacts,
    boundary: 'Beta6 CLI package is eligible for public distribution only as Carril A assisted_generation_non_claim. It does not imply self-hosting, fixpoint, formal N5, or Windows-native support.'
  };
  fs.writeFileSync(path.join(outDir, 'package.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'SHA256SUMS'), `${tarSha}  ${packageName}\n${sha256File(path.join(outDir, 'package.manifest.json'))}  package.manifest.json\n`);
  process.stdout.write(`decision=${manifest.decision}\n`);
  process.stdout.write(`package=${manifest.package.path}\n`);
  process.stdout.write(`sha256=${tarSha}\n`);
}

main();
