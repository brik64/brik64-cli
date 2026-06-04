#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta5-publication-preflight');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function optional(file) {
  if (!fs.existsSync(file)) return null;
  return {
    path: path.relative(root, file),
    sha256: sha256File(file),
    bytes: fs.statSync(file).size
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const artifacts = {
    buildChain: optional(path.join(root, 'evidence/beta5-local-candidate/build-chain.manifest.json')),
    hardenedCandidate: optional(path.join(root, 'evidence/beta5-local-candidate/brik64-beta5.candidate.hardened.js')),
    l4RuntimeBundle: optional(path.join(root, 'engines/l4plus-n5/runtime-bundle.manifest.json')),
    sdkSync: optional(path.join(root, 'evidence/beta5-sdk-sync/report.json')),
    skillsSync: optional(path.join(root, 'evidence/beta5-skills-sync/report.json')),
    docsWebSync: optional(path.join(root, 'evidence/beta5-docs-web-sync/report.json')),
    marketplacePackageGate: optional(path.join(root, 'evidence/beta5-marketplace-packages/report.json')),
    releaseSurfaceGate: optional(path.join(root, 'evidence/beta5-release-surface-gate/report.json'))
    ,
    localPackageManifest: optional(path.join(root, 'evidence/beta5-package/package.manifest.json')),
    localPackageSmoke: optional(path.join(root, 'evidence/beta5-package-smoke/report.json')),
    crossPlatformSmoke: optional(path.join(root, 'evidence/beta5-cross-platform-smoke/report.json')),
    signedChecksums: optional(path.join(root, 'evidence/beta5-release-checksums/report.json'))
  };
  const missing = Object.entries(artifacts)
    .filter(([, value]) => value === null)
    .map(([key]) => key);
  const marketplacePackagesPassed = artifacts.marketplacePackageGate
    && JSON.parse(fs.readFileSync(path.join(root, artifacts.marketplacePackageGate.path), 'utf8')).decision === 'PASS_MARKETPLACE_PACKAGE_GATE';
  const crossPlatformSmokePassed = artifacts.crossPlatformSmoke
    && JSON.parse(fs.readFileSync(path.join(root, artifacts.crossPlatformSmoke.path), 'utf8')).decision === 'PASS_CROSS_PLATFORM_SMOKE';
  const signedChecksumsPassed = artifacts.signedChecksums
    && JSON.parse(fs.readFileSync(path.join(root, artifacts.signedChecksums.path), 'utf8')).decision === 'PASS_SIGNED_CHECKSUMS';
  const blockers = [
    ...missing.map((key) => `publication_artifact_missing:${key}`),
    'github_release_not_created',
    'release_tag_not_created',
    ...(signedChecksumsPassed ? [] : ['signed_checksums_not_created']),
    'marketplace_publication_not_authorized',
    ...(artifacts.localPackageManifest && artifacts.localPackageSmoke ? [] : ['cli_package_not_smoked_for_beta5_publication']),
    ...(marketplacePackagesPassed ? [] : [
      'npm_package_not_packed_for_beta5_publication',
      'pypi_package_not_built_for_beta5_publication',
      'cargo_package_not_packed_for_beta5_publication'
    ]),
    ...(crossPlatformSmokePassed ? [] : ['cross_platform_release_smoke_missing'])
  ];
  const manifest = {
    schemaVersion: 'brik64.cli_beta5_publication_preflight.v1',
    version: '0.1.0-beta.5',
    decision: blockers.length === 0 ? 'PASS_PUBLICATION_PREFLIGHT' : 'BLOCKED_PUBLICATION_PREFLIGHT',
    releaseEligible: false,
    githubReleaseAllowed: false,
    marketplacePublicationAllowed: false,
    artifacts,
    blockers,
    boundary: 'Candidate manifest only. No GitHub Release, signed tag, curl publication or marketplace publication is authorized by this report.'
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`decision=${manifest.decision}\n`);
  process.stdout.write('githubReleaseAllowed=false\n');
  process.stdout.write('marketplacePublicationAllowed=false\n');
  process.stdout.write(`blockers=${blockers.join(',')}\n`);
  if (process.argv.includes('--release')) process.exit(1);
}

main();
