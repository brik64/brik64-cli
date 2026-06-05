#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.7';
const outDir = path.join(root, 'evidence', 'beta7-package');
const stagingName = `brik64-cli-${version}`;
const staging = path.join(outDir, 'stage', stagingName);
const packageName = `brik64-cli-${version}.tgz`;

const baseInclude = [
  '.brik/manifest.json',
  'CHANGELOG.md',
  'README.md',
  'src/brik.js',
  'pcd/cli_core.pcd',
  'pcd/cli_polymer.pcd',
  'pcd/cli_account_session.pcd',
  'pcd/cli_migrate.pcd',
  'pcd/cli_polymerize.pcd',
  'pcd/cli_verify.pcd',
  'evidence/beta7-feature-parity/report.json'
];

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

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

function writeStagedJson(relativePath, value) {
  const dest = path.join(staging, relativePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `${JSON.stringify(value, null, 2)}\n`);
  return {
    path: relativePath,
    sha256: sha256File(dest),
    bytes: fs.statSync(dest).size,
    source: 'sanitized_distribution_metadata'
  };
}

function run(args, cwd = root) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function assertBeta7Inputs() {
  const packageJson = readJson('package.json');
  const brikManifest = readJson('.brik/manifest.json');
  const featureGate = readJson('evidence/beta7-feature-parity/report.json');
  const runtimeBundle = readJson('engines/l4plus-n5/runtime-bundle.manifest.json');
  const failures = [];

  if (packageJson.version !== version) failures.push(`package_version_drift:${packageJson.version}`);
  if (brikManifest.cliVersion !== version) failures.push(`brik_manifest_version_drift:${brikManifest.cliVersion}`);
  if (brikManifest.lane !== 'cli_0_1_beta') failures.push(`lane_drift:${brikManifest.lane}`);
  if (brikManifest.engineTierPolicy?.l6DistributionAllowed !== false) failures.push('private_factory_distribution_boundary_open');
  if (featureGate.version !== version) failures.push(`feature_gate_version_drift:${featureGate.version}`);
  if (featureGate.decision !== 'PASS_BETA7_FEATURE_PARITY_GATE') failures.push(`feature_gate_not_pass:${featureGate.decision}`);
  if (featureGate.generationClaim !== 'assisted_generation_non_claim') failures.push(`generation_claim_drift:${featureGate.generationClaim}`);
  if (featureGate.managedRuntimeBoundary?.endpointImplemented !== false) failures.push('managed_endpoint_claim_open');
  if (featureGate.releaseBoundary?.independentToolchainClosureAllowed !== false) failures.push('independent_toolchain_closure_claim_open');
  if (runtimeBundle.runtimeMode !== 'portable_bir_bundle') failures.push(`runtime_mode_drift:${runtimeBundle.runtimeMode}`);
  if (runtimeBundle.nativeExecutableIncluded !== false) failures.push('native_runtime_claim_open');

  for (const input of baseInclude) {
    if (!fs.existsSync(path.join(root, input))) failures.push(`missing_package_input:${input}`);
  }

  if (failures.length > 0) throw new Error(`beta7_package_input_gate_failed:${failures.join(',')}`);
}

function main() {
  assertBeta7Inputs();
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  const runtimeBundle = readJson('engines/l4plus-n5/runtime-bundle.manifest.json');
  const runtimeInclude = runtimeBundle.artifacts
    .map((artifact) => artifact.path)
    .filter((artifactPath) => [
      'engines/l4plus-n5/serial.txt',
      'engines/l4plus-n5/checksums.tsv'
    ].includes(artifactPath));
  const include = [...new Set([...baseInclude, ...runtimeInclude])].sort();
  const artifacts = include.map(copy);
  const publicRuntimeManifest = {
    schemaVersion: 'brik64.cli_portable_runtime_bundle.v1',
    decision: 'PASS_PORTABLE_RUNTIME_BUNDLE_PACKAGED',
    releaseEligible: false,
    runtimeMode: runtimeBundle.runtimeMode,
    nativeExecutableIncluded: false,
    cliVersion: version,
    runtime: 'local_runtime',
    serial: runtimeBundle.serial,
    artifacts: runtimeInclude.map((artifactPath) => {
      const file = path.join(staging, artifactPath);
      return {
        path: artifactPath,
        sha256: sha256File(file),
        bytes: fs.statSync(file).size
      };
    }),
    limitations: [
      'This bundle packages portable local runtime metadata for CLI inspection.',
      'It does not include a native executable runtime.',
      'It does not authorize universal correctness claims.'
    ]
  };
  artifacts.push(writeStagedJson('engines/l4plus-n5/runtime-bundle.manifest.json', publicRuntimeManifest));
  const packageMetadata = {
    name: '@brik64/cli',
    version,
    private: true,
    bin: {
      brik: 'src/brik.js'
    },
    engines: {
      node: '>=20'
    },
    distribution: 'curl_and_github_release_assets'
  };
  const packageMetadataPath = path.join(staging, 'package.json');
  fs.writeFileSync(packageMetadataPath, `${JSON.stringify(packageMetadata, null, 2)}\n`);
  artifacts.push({
    path: 'package.json',
    sha256: sha256File(packageMetadataPath),
    bytes: fs.statSync(packageMetadataPath).size,
    source: 'sanitized_distribution_metadata'
  });
  fs.chmodSync(path.join(staging, 'src/brik.js'), 0o755);

  const packagePath = path.join(outDir, packageName);
  run(['tar', '-czf', packagePath, '-C', path.join(outDir, 'stage'), stagingName]);
  const tarSha = sha256File(packagePath);
  const manifest = {
    schemaVersion: 'brik64.cli_beta7_package_manifest.v1',
    version,
    decision: 'PASS_BETA7_PACKAGE_BUILT',
    releaseEligible: false,
    lane: 'cli_0_1_beta',
    generationClaim: 'assisted_generation_non_claim',
    package: {
      path: path.relative(root, packagePath),
      sha256: tarSha,
      bytes: fs.statSync(packagePath).size
    },
    artifacts,
    requiredPublicReleaseGates: [
      'curl_gcp_installer_beta7',
      'github_release_beta7',
      'web_docs_changelog_beta7',
      'skills_beta7',
      'sdk_no_change_or_beta7_publication_evidence',
      'cross_platform_smoke_supported_targets'
    ],
    boundary: 'Beta7 local package candidate only. Public release remains blocked until curl/GCP, GitHub, web, docs, changelog, skills, SDK and supported-platform smoke evidence are synchronized.'
  };
  fs.writeFileSync(path.join(outDir, 'package.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'SHA256SUMS'), `${tarSha}  ${packageName}\n${sha256File(path.join(outDir, 'package.manifest.json'))}  package.manifest.json\n`);
  process.stdout.write(`decision=${manifest.decision}\n`);
  process.stdout.write(`releaseEligible=${manifest.releaseEligible}\n`);
  process.stdout.write(`package=${manifest.package.path}\n`);
  process.stdout.write(`sha256=${tarSha}\n`);
}

try {
  main();
} catch (error) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'package.manifest.json'), `${JSON.stringify({
    schemaVersion: 'brik64.cli_beta7_package_manifest.v1',
    version,
    decision: 'FAIL_BETA7_PACKAGE_BUILT',
    releaseEligible: false,
    error: error.message
  }, null, 2)}\n`);
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
