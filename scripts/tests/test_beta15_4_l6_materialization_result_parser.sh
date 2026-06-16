#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

node <<'NODE'
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {
  parseMaterializationResult,
  validateMaterializationResult,
} = require('./scripts/beta15_4-l6-materialization-result');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const good = {
  version: '0.1.0-beta.15.4',
  l6plusEngineSerial: 'BRIK64-L6PLUS-N5-20260605-BETA6MP-660de957',
  materializerMode: 'l6plus_pcd_polymer_materializer',
  generatedByL6PlusN5: true,
  pcdToArtifactHashBound: true,
  artifactToPackageHashBound: true,
  packageToReleaseManifestHashBound: true,
  sealReportPass: true,
  generatedArtifactSha256: 'a'.repeat(64),
  packageSha256: 'b'.repeat(64),
  releaseManifestSha256: 'c'.repeat(64),
  compositeSha256: 'd'.repeat(64),
  generationTraceSha256: '1'.repeat(64),
  pcdInputSetSha256: '2'.repeat(64),
  remoteWrapperSha256: '3'.repeat(64),
  wrapperExecTargetSha256: '4'.repeat(64),
  generatedArtifact: {
    path: 'evidence/beta15_4-l6-generation/generated/brik64-cli.mjs',
    sha256: 'a'.repeat(64),
  },
  package: {
    path: 'evidence/beta15_4-package/brik64-cli-0.1.0-beta.15.4.tar.gz',
    sha256: 'b'.repeat(64),
  },
  releaseManifest: {
    path: 'release/manifest.json',
    sha256: 'c'.repeat(64),
  },
  sealReport: {
    path: 'evidence/beta15_4-l6-generation/seal_report.json',
    sha256: '5'.repeat(64),
  },
  inputPcds: [
    { path: 'pcd/beta15_4/release/l6_cli_materialization_contract.pcd', sha256: 'e'.repeat(64) },
    { path: 'pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd', sha256: 'f'.repeat(64) },
  ],
};
const encoded = Buffer.from(JSON.stringify(good)).toString('base64');
const parsed = parseMaterializationResult(`noise\nBRIK64_L6_CLI_MATERIALIZATION_RESULT\t${encoded}\n`);
assert.deepStrictEqual(parsed.version, good.version);
assert.strictEqual(validateMaterializationResult(parsed, good.version).accepted, true);
assert.strictEqual(validateMaterializationResult(parsed, good.version, {
  pcdInputSetSha256: good.pcdInputSetSha256,
  remoteWrapperSha256: good.remoteWrapperSha256,
  wrapperExecTargetSha256: good.wrapperExecTargetSha256,
  requiredInputPcdPaths: [
    'pcd/beta15_4/release/l6_cli_materialization_contract.pcd',
    'pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd',
  ],
}).accepted, true);

const badVersion = { ...good, version: '0.1.0-beta.15.3' };
assert.strictEqual(validateMaterializationResult(badVersion, good.version).accepted, false);
assert(validateMaterializationResult(badVersion, good.version).blockers.includes('materialization_result_version_mismatch:0.1.0-beta.15.3'));

const badHash = { ...good, packageSha256: 'not-a-sha' };
assert.strictEqual(validateMaterializationResult(badHash, good.version).accepted, false);
assert(validateMaterializationResult(badHash, good.version).blockers.includes('materialization_result_package_sha256_invalid'));

const missingBinding = { ...good, pcdToArtifactHashBound: false };
assert.strictEqual(validateMaterializationResult(missingBinding, good.version).accepted, false);
assert(validateMaterializationResult(missingBinding, good.version).blockers.includes('materialization_result_pcdToArtifactHashBound_not_true'));

const missingSerial = { ...good };
delete missingSerial.l6plusEngineSerial;
assert.strictEqual(validateMaterializationResult(missingSerial, good.version).accepted, false);
assert(validateMaterializationResult(missingSerial, good.version).blockers.includes('materialization_result_l6plus_engine_serial_invalid'));

const manualMode = { ...good, materializerMode: 'manual_packager' };
assert.strictEqual(validateMaterializationResult(manualMode, good.version).accepted, false);
assert(validateMaterializationResult(manualMode, good.version).blockers.includes('materialization_result_materializer_mode_invalid'));

const missingTrace = { ...good };
delete missingTrace.generationTraceSha256;
assert.strictEqual(validateMaterializationResult(missingTrace, good.version).accepted, false);
assert(validateMaterializationResult(missingTrace, good.version).blockers.includes('materialization_result_generation_trace_sha256_invalid'));

const missingArtifactRef = { ...good };
delete missingArtifactRef.generatedArtifact;
assert.strictEqual(validateMaterializationResult(missingArtifactRef, good.version).accepted, false);
assert(validateMaterializationResult(missingArtifactRef, good.version).blockers.includes('materialization_result_generatedArtifact_ref_missing'));

const unsafePackageRef = { ...good, package: { ...good.package, path: '../package.tgz' } };
assert.strictEqual(validateMaterializationResult(unsafePackageRef, good.version).accepted, false);
assert(validateMaterializationResult(unsafePackageRef, good.version).blockers.includes('materialization_result_package_ref_path_invalid'));

const mismatchedReleaseManifestRef = {
  ...good,
  releaseManifest: { ...good.releaseManifest, sha256: '9'.repeat(64) },
};
assert.strictEqual(validateMaterializationResult(mismatchedReleaseManifestRef, good.version).accepted, false);
assert(validateMaterializationResult(mismatchedReleaseManifestRef, good.version).blockers.includes('materialization_result_releaseManifest_ref_sha256_mismatch'));

const wrongInputSet = validateMaterializationResult(good, good.version, {
  pcdInputSetSha256: '9'.repeat(64),
  remoteWrapperSha256: good.remoteWrapperSha256,
  wrapperExecTargetSha256: good.wrapperExecTargetSha256,
});
assert.strictEqual(wrongInputSet.accepted, false);
assert(wrongInputSet.blockers.includes('materialization_result_pcd_input_set_sha256_mismatch'));

const wrongWrapper = validateMaterializationResult(good, good.version, {
  pcdInputSetSha256: good.pcdInputSetSha256,
  remoteWrapperSha256: '9'.repeat(64),
  wrapperExecTargetSha256: good.wrapperExecTargetSha256,
});
assert.strictEqual(wrongWrapper.accepted, false);
assert(wrongWrapper.blockers.includes('materialization_result_remote_wrapper_sha256_mismatch'));

const wrongExecTarget = validateMaterializationResult(good, good.version, {
  pcdInputSetSha256: good.pcdInputSetSha256,
  remoteWrapperSha256: good.remoteWrapperSha256,
  wrapperExecTargetSha256: '9'.repeat(64),
});
assert.strictEqual(wrongExecTarget.accepted, false);
assert(wrongExecTarget.blockers.includes('materialization_result_wrapper_exec_target_sha256_mismatch'));

const missingRequiredPcd = validateMaterializationResult(
  {
    ...good,
    inputPcds: good.inputPcds.filter((item) => item.path !== 'pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd'),
  },
  good.version,
  {
    requiredInputPcdPaths: [
      'pcd/beta15_4/release/l6_cli_materialization_contract.pcd',
      'pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd',
    ],
  },
);
assert.strictEqual(missingRequiredPcd.accepted, false);
assert(missingRequiredPcd.blockers.includes('materialization_result_required_input_pcd_missing:pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd'));

const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta15-4-materialization-'));
const files = {
  generatedArtifact: ['evidence/beta15_4-l6-generation/generated/brik64-cli.mjs', 'artifact-body'],
  package: ['evidence/beta15_4-package/brik64-cli-0.1.0-beta.15.4.tar.gz', 'package-body'],
  releaseManifest: ['release/manifest.json', '{"version":"0.1.0-beta.15.4"}'],
  sealReport: ['evidence/beta15_4-l6-generation/seal_report.json', '{"decision":"PASS"}'],
};
const withFiles = { ...good };
for (const [field, [relativePath, body]] of Object.entries(files)) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, body);
  withFiles[field] = { path: relativePath, sha256: sha256(body) };
}
withFiles.generatedArtifactSha256 = withFiles.generatedArtifact.sha256;
withFiles.packageSha256 = withFiles.package.sha256;
withFiles.releaseManifestSha256 = withFiles.releaseManifest.sha256;
assert.strictEqual(validateMaterializationResult(withFiles, good.version, { workspaceRoot }).accepted, true);

fs.rmSync(path.join(workspaceRoot, withFiles.package.path));
const missingPackageFile = validateMaterializationResult(withFiles, good.version, { workspaceRoot });
assert.strictEqual(missingPackageFile.accepted, false);
assert(missingPackageFile.blockers.includes('materialization_result_package_ref_file_missing'));

fs.writeFileSync(path.join(workspaceRoot, withFiles.package.path), 'tampered-package-body');
const tamperedPackageFile = validateMaterializationResult(withFiles, good.version, { workspaceRoot });
assert.strictEqual(tamperedPackageFile.accepted, false);
assert(tamperedPackageFile.blockers.includes('materialization_result_package_ref_file_sha256_mismatch'));
fs.rmSync(workspaceRoot, { recursive: true, force: true });

assert.strictEqual(parseMaterializationResult('no materialization line'), null);
console.log('PASS beta15.4 L6 materialization result parser');
NODE
