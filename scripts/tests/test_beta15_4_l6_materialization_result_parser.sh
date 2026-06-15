#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

node <<'NODE'
const assert = require('assert');
const {
  parseMaterializationResult,
  validateMaterializationResult,
} = require('./scripts/beta15_4-l6-materialization-result');

const good = {
  version: '0.1.0-beta.15.4',
  generatedByL6PlusN5: true,
  pcdToArtifactHashBound: true,
  artifactToPackageHashBound: true,
  packageToReleaseManifestHashBound: true,
  sealReportPass: true,
  generatedArtifactSha256: 'a'.repeat(64),
  packageSha256: 'b'.repeat(64),
  releaseManifestSha256: 'c'.repeat(64),
  compositeSha256: 'd'.repeat(64),
  inputPcds: [{ path: 'pcd/beta15_4/release/l6_cli_materialization_contract.pcd', sha256: 'e'.repeat(64) }],
};
const encoded = Buffer.from(JSON.stringify(good)).toString('base64');
const parsed = parseMaterializationResult(`noise\nBRIK64_L6_CLI_MATERIALIZATION_RESULT\t${encoded}\n`);
assert.deepStrictEqual(parsed.version, good.version);
assert.strictEqual(validateMaterializationResult(parsed, good.version).accepted, true);

const badVersion = { ...good, version: '0.1.0-beta.15.3' };
assert.strictEqual(validateMaterializationResult(badVersion, good.version).accepted, false);
assert(validateMaterializationResult(badVersion, good.version).blockers.includes('materialization_result_version_mismatch:0.1.0-beta.15.3'));

const badHash = { ...good, packageSha256: 'not-a-sha' };
assert.strictEqual(validateMaterializationResult(badHash, good.version).accepted, false);
assert(validateMaterializationResult(badHash, good.version).blockers.includes('materialization_result_package_sha256_invalid'));

const missingBinding = { ...good, pcdToArtifactHashBound: false };
assert.strictEqual(validateMaterializationResult(missingBinding, good.version).accepted, false);
assert(validateMaterializationResult(missingBinding, good.version).blockers.includes('materialization_result_pcdToArtifactHashBound_not_true'));

assert.strictEqual(parseMaterializationResult('no materialization line'), null);
console.log('PASS beta15.4 L6 materialization result parser');
NODE
