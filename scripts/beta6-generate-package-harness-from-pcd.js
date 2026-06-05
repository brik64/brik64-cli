#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta6-package-harness');
const generatedDir = path.join(outDir, 'generated');
const harnessPcd = path.join(root, 'pcd', 'beta6_package_harness.pcd');
const fullContractPcd = path.join(root, 'pcd', 'l6_full_cli_generation_factory.pcd');
const cliPolymerPcd = path.join(root, 'pcd', 'cli_polymer.pcd');
const manifestPath = path.join(root, '.brik', 'manifest.json');
const fullContractReport = path.join(root, 'evidence', 'beta6-l6-full-generation-contract', 'report.json');
const hetznerReport = path.join(root, 'evidence', 'beta6-l6-hetzner-generation', 'report.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(file) {
  return fs.readFileSync(file);
}

function rel(file) {
  return path.relative(root, file);
}

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

function extractMetadata(source) {
  const metadata = {};
  const reads = [];
  const writes = [];
  const requires = [];
  const invariants = [];
  const failures = [];
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    let match = /^\/\/ ([a-zA-Z0-9_]+) = "([^"]*)"$/.exec(trimmed);
    if (match) metadata[match[1]] = match[2];
    match = /^\/\/ reads "([^"]*)"$/.exec(trimmed);
    if (match) reads.push(match[1]);
    match = /^\/\/ writes "([^"]*)"$/.exec(trimmed);
    if (match) writes.push(match[1]);
    match = /^\/\/ requires (.*)$/.exec(trimmed);
    if (match) requires.push(match[1]);
    match = /^\/\/ invariant (.*)$/.exec(trimmed);
    if (match) invariants.push(match[1]);
    match = /^\/\/ failure (.*)$/.exec(trimmed);
    if (match) failures.push(match[1]);
  }
  return { metadata, reads, writes, requires, invariants, failures };
}

function artifact(file) {
  return {
    path: rel(file),
    sha256: sha256(read(file)),
    bytes: fs.statSync(file).size
  };
}

function generateHarness(sourceHash, contractHash) {
  return `#!/usr/bin/env node
// generated_from=pcd/beta6_package_harness.pcd
// product_artifact=BRIK64 CLI 0.1.0-beta.6
// harness_role=internal generator for BRIK64 CLI beta6 package/release manifests
// pcd_sha256=${sourceHash}
// contract_sha256=${contractHash}
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
    pcdSha256: '${sourceHash}',
    fullGenerationContractSha256: '${contractHash}',
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
  process.stdout.write(JSON.stringify(manifest, null, 2) + '\\n');
  if (!manifest.releaseEligible) process.exitCode = 2;
}

module.exports = { build };
`;
}

function generateTest() {
  return `const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { build } = require('./beta6-package-harness.generated.js');

test('beta6 package harness is ready once L6 full generation gates pass', () => {
  const root = path.resolve(__dirname, '..', '..', '..');
  const manifest = build(root);
  assert.equal(manifest.version, '0.1.0-beta.6');
  assert.equal(manifest.productArtifact, 'BRIK64 CLI 0.1.0-beta.6');
  assert.equal(manifest.generatedFrom, 'pcd/beta6_package_harness.pcd');
  assert.equal(manifest.releaseEligible, true);
  assert.equal(manifest.decision, 'PASS_BETA6_PACKAGE_HARNESS_READY');
  assert.deepEqual(manifest.blockers, []);
  assert.ok(manifest.inputs.length >= 6);
});
`;
}

function runNodeTest(file) {
  const result = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8' });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(generatedDir, { recursive: true });
  const required = [harnessPcd, fullContractPcd, cliPolymerPcd, manifestPath, fullContractReport, hetznerReport];
  const missing = required.filter((file) => !fs.existsSync(file)).map(rel);
  if (missing.length > 0) {
    throw new Error(`beta6_package_harness_input_missing:${missing.join(',')}`);
  }

  const pcdSource = fs.readFileSync(harnessPcd, 'utf8');
  const metadata = extractMetadata(pcdSource);
  const pcdHash = sha256(Buffer.from(pcdSource));
  const contractHash = sha256(read(fullContractPcd));
  const harnessJs = path.join(generatedDir, 'beta6-package-harness.generated.js');
  const harnessTest = path.join(generatedDir, 'beta6-package-harness.test.js');
  write(harnessJs, generateHarness(pcdHash, contractHash));
  fs.chmodSync(harnessJs, 0o755);
  write(harnessTest, generateTest());
  const testResult = runNodeTest(harnessTest);
  const outputManifest = JSON.parse(spawnSync(process.execPath, [harnessJs, root], {
    cwd: root,
    encoding: 'utf8'
  }).stdout);
  writeJson(path.join(generatedDir, 'package-harness.manifest.json'), outputManifest);

  const report = {
    schemaVersion: 'brik64.beta6_package_harness_generation_report.v1',
    version: '0.1.0-beta.6',
    generatedAt: new Date().toISOString(),
    lane: 'prototype_non_claim_until_l6_materialized',
    decision: testResult.status === 0
      ? 'PASS_BETA6_PACKAGE_HARNESS_GENERATED_FROM_PCD'
      : 'BLOCKED_BETA6_PACKAGE_HARNESS_TEST_FAILED',
    releaseEligible: false,
    generatorBoundary: 'bootstrap_non_claim_generator; final harness must be materialized by serialized L6+N5',
    sourcePcd: artifact(harnessPcd),
    fullGenerationContract: artifact(fullContractPcd),
    metadata,
    generatedArtifacts: [artifact(harnessJs), artifact(harnessTest), artifact(path.join(generatedDir, 'package-harness.manifest.json'))],
    generatedOutput: outputManifest,
    test: testResult,
    requiredNextAction: 'Materialize this harness through the L6+N5 full generation endpoint and bind artifact/package/release hashes before beta6 publication.'
  };
  writeJson(path.join(outDir, 'report.json'), report);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`report=${rel(path.join(outDir, 'report.json'))}\n`);
  if (testResult.status !== 0) process.exitCode = 2;
}

main();
