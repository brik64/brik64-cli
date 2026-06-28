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
  parseStageResult,
  validateStageResult,
} = require('./scripts/beta17-fixpoint-stage-result');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const artifactBody = 'stage artifact body';
const artifactSha = sha256(artifactBody);
const good = {
  schemaVersion: 'brik64.beta17_fixpoint_stage_result.v1',
  version: '0.1.0-beta.17',
  l6plusEngineSerial: 'BRIK64-L6PLUS-N5-20260628-FIXPOINT-001',
  materializerMode: 'l6plus_fixpoint_stage_materializer',
  generatedByL6PlusN5: true,
  stage2GeneratedByStage1: true,
  byteIdentical: true,
  byteIdenticalSha256Match: true,
  byteIdenticalSizeMatch: true,
  harnessPass: true,
  adversarialCases: 3,
  sealReportPass: true,
  pcdInputSetSha256: '1'.repeat(64),
  materializerRequestSha256: '2'.repeat(64),
  stage1ArtifactSha256: artifactSha,
  stage2ArtifactSha256: artifactSha,
  stage1ArtifactBytes: Buffer.byteLength(artifactBody),
  stage2ArtifactBytes: Buffer.byteLength(artifactBody),
  compositeSha256: '3'.repeat(64),
  generationTraceSha256: '4'.repeat(64),
  remoteWrapperSha256: '5'.repeat(64),
  wrapperExecTargetSha256: '6'.repeat(64),
  stage1Artifact: { path: 'evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs', sha256: artifactSha },
  stage2Artifact: { path: 'evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs', sha256: artifactSha },
  stage1Manifest: { path: 'evidence/beta17-fixpoint/stage1_artifact_manifest.json', sha256: '7'.repeat(64) },
  stage2Manifest: { path: 'evidence/beta17-fixpoint/stage2_regeneration_manifest.json', sha256: '8'.repeat(64) },
  byteIdenticalReport: { path: 'evidence/beta17-fixpoint/byte_identical_report.json', sha256: '9'.repeat(64) },
  harnessReport: { path: 'evidence/beta17-fixpoint/harness_report.json', sha256: 'a'.repeat(64) },
  sealReport: { path: 'evidence/beta17-fixpoint/seal_report.json', sha256: 'b'.repeat(64) },
  inputPcds: [
    { path: 'pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd', sha256: 'c'.repeat(64) },
    { path: 'pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd', sha256: 'd'.repeat(64) },
  ],
  claimBoundary: {
    publicReleaseAllowed: false,
    formalN5ClaimAllowed: false,
    universalCorrectnessClaimAllowed: false,
  },
};

const encoded = Buffer.from(JSON.stringify(good)).toString('base64');
const parsed = parseStageResult(`noise\nBRIK64_BETA17_FIXPOINT_STAGE_RESULT\t${encoded}\n`);
assert.deepStrictEqual(parsed.version, good.version);
assert.strictEqual(validateStageResult(parsed).accepted, true);
assert.strictEqual(validateStageResult(parsed, {
  pcdInputSetSha256: good.pcdInputSetSha256,
  materializerRequestSha256: good.materializerRequestSha256,
  remoteWrapperSha256: good.remoteWrapperSha256,
  wrapperExecTargetSha256: good.wrapperExecTargetSha256,
  requiredInputPcdPaths: [
    'pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd',
    'pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd',
  ],
}).accepted, true);

for (const [mutator, blocker] of [
  [(x) => { x.version = '0.1.0-beta.16.1'; }, 'stage_result_version_mismatch:0.1.0-beta.16.1'],
  [(x) => { x.stage2GeneratedByStage1 = false; }, 'stage_result_stage2GeneratedByStage1_not_true'],
  [(x) => { x.byteIdentical = false; }, 'stage_result_byteIdentical_not_true'],
  [(x) => { x.byteIdenticalSha256Match = false; }, 'stage_result_byteIdenticalSha256Match_not_true'],
  [(x) => { x.stage2ArtifactSha256 = 'e'.repeat(64); }, 'stage_result_stage1_stage2_sha256_mismatch'],
  [(x) => { x.stage2ArtifactBytes = x.stage1ArtifactBytes + 1; }, 'stage_result_stage1_stage2_size_mismatch'],
  [(x) => { x.adversarialCases = 2; }, 'stage_result_adversarial_cases_insufficient'],
  [(x) => { x.claimBoundary.publicReleaseAllowed = true; }, 'stage_result_claim_boundary_public_release_open'],
  [(x) => { x.stage2Artifact.path = '../stage2.mjs'; }, 'stage_result_stage2Artifact_ref_path_invalid'],
]) {
  const candidate = structuredClone(good);
  mutator(candidate);
  const result = validateStageResult(candidate);
  assert.strictEqual(result.accepted, false, blocker);
  assert(result.blockers.includes(blocker), `${blocker} not found in ${result.blockers.join(',')}`);
}

const wrongRequestHash = validateStageResult(good, { materializerRequestSha256: 'f'.repeat(64) });
assert.strictEqual(wrongRequestHash.accepted, false);
assert(wrongRequestHash.blockers.includes('stage_result_materializer_request_sha256_mismatch'));

const missingRequiredPcd = validateStageResult(
  { ...good, inputPcds: good.inputPcds.slice(0, 1) },
  { requiredInputPcdPaths: good.inputPcds.map((item) => item.path) },
);
assert.strictEqual(missingRequiredPcd.accepted, false);
assert(missingRequiredPcd.blockers.includes('stage_result_required_input_pcd_missing:pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd'));

const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta17-stage-result-'));
const withFiles = structuredClone(good);
const files = [
  [withFiles.stage1Artifact, artifactBody],
  [withFiles.stage2Artifact, artifactBody],
  [withFiles.stage1Manifest, '{"version":"0.1.0-beta.17"}'],
  [withFiles.stage2Manifest, '{"generatedByStage1":true}'],
  [withFiles.byteIdenticalReport, '{"byteIdentical":true}'],
  [withFiles.harnessReport, '{"decision":"PASS"}'],
  [withFiles.sealReport, '{"decision":"PASS"}'],
];
for (const [ref, body] of files) {
  const absolute = path.join(workspaceRoot, ref.path);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, body);
  ref.sha256 = sha256(body);
}
for (const item of withFiles.inputPcds) {
  const absolute = path.join(workspaceRoot, item.path);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, item.path);
  item.sha256 = sha256(item.path);
}
assert.strictEqual(validateStageResult(withFiles, { workspaceRoot }).accepted, true);

fs.writeFileSync(path.join(workspaceRoot, withFiles.stage2Artifact.path), 'tampered');
const tamperedFile = validateStageResult(withFiles, { workspaceRoot });
assert.strictEqual(tamperedFile.accepted, false);
assert(tamperedFile.blockers.includes(`stage_result_stage2Artifact_ref_file_sha256_mismatch:${withFiles.stage2Artifact.path}`));
fs.rmSync(workspaceRoot, { recursive: true, force: true });

assert.strictEqual(parseStageResult('no result line'), null);
console.log('PASS beta17 fixpoint stage result parser');
NODE
