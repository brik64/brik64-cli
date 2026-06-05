#!/usr/bin/env node
// generated_from=pcd/beta6_package_harness.pcd
// product_artifact=BRIK64 CLI 0.1.0-beta.6
// harness_role=internal generator for BRIK64 CLI beta6 package/release manifests
// pcd_sha256=692679f70716c0300b412e42c3c58ce4a5e16b0f57c029b5c4da1b5b56d7591b
// contract_sha256=42a41e720a48a4a80aad939e363363e278779a38c149098d3552bd9ce5d27420
// releaseEligible=false
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(file) {
  return fs.readFileSync(file);
}

function artifact(root, relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) {
    throw new Error('beta6_package_harness_input_missing:' + relativePath);
  }
  return {
    path: relativePath,
    sha256: sha256(read(file)),
    bytes: fs.statSync(file).size
  };
}

function build(rootDir) {
  const root = path.resolve(rootDir || process.cwd());
  const inputs = [
    '.brik/manifest.json',
    'pcd/cli_polymer.pcd',
    'pcd/l6_full_cli_generation_factory.pcd',
    'pcd/beta6_package_harness.pcd',
    'evidence/beta6-l6-full-generation-contract/report.json',
    'evidence/beta6-l6-hetzner-generation/report.json'
  ].map((item) => artifact(root, item));
  const hetzner = JSON.parse(read(path.join(root, 'evidence/beta6-l6-hetzner-generation/report.json')));
  const fullContract = JSON.parse(read(path.join(root, 'evidence/beta6-l6-full-generation-contract/report.json')));
  const releaseEligible = hetzner.decision === 'PASS_L6_FULL_CLI_GENERATION_READY'
    && fullContract.decision === 'PASS_BETA6_L6_FULL_GENERATION_CONTRACT_RECORDED';
  const manifest = {
    schemaVersion: 'brik64.beta6_package_harness_output.v1',
    version: '0.1.0-beta.6',
    productArtifact: 'BRIK64 CLI 0.1.0-beta.6',
    harnessRole: 'internal generator for BRIK64 CLI beta6 package/release manifests',
    generatedFrom: 'pcd/beta6_package_harness.pcd',
    pcdSha256: '692679f70716c0300b412e42c3c58ce4a5e16b0f57c029b5c4da1b5b56d7591b',
    fullGenerationContractSha256: '42a41e720a48a4a80aad939e363363e278779a38c149098d3552bd9ce5d27420',
    releaseEligible,
    decision: releaseEligible ? 'PASS_BETA6_PACKAGE_HARNESS_READY' : 'BLOCKED_BETA6_PACKAGE_HARNESS_L6_NOT_READY',
    inputs,
    blockers: releaseEligible ? [] : ['l6_full_cli_generation_endpoint_missing'],
    boundary: 'Generated harness output only. Public release requires L6+N5 full generation PASS and signed release manifest.'
  };
  return manifest;
}

if (require.main === module) {
  const manifest = build(process.argv[2]);
  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
  if (!manifest.releaseEligible) process.exitCode = 2;
}

module.exports = { build };
