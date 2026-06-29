#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

node --check scripts/beta17-fixpoint-materializer-generation-result.js

node <<'NODE'
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {
  parseMaterializerGenerationResult,
  REQUIRED_STAGE_RESULT_MARKER,
  validateMaterializerGenerationResult,
} = require('./scripts/beta17-fixpoint-materializer-generation-result');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function inputSetHash(inputPcds) {
  return sha256(`${inputPcds.map((item) => `${item.sha256}\t${item.bytes}\t${item.path}`).join('\n')}\n`);
}

const materializerBody = `#!/usr/bin/env node\nconsole.log(\"${REQUIRED_STAGE_RESULT_MARKER}\\t\" + Buffer.from(JSON.stringify({ ok: true })).toString(\"base64\"));\n`;
const materializerSha = sha256(materializerBody);
const inputPcds = [
  { path: 'pcd/beta17/release/fixpoint_materializer_generation_contract.pcd', sha256: 'a'.repeat(64), bytes: 101 },
  { path: 'pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd', sha256: 'b'.repeat(64), bytes: 102 },
  { path: 'pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd', sha256: 'c'.repeat(64), bytes: 103 },
  { path: 'pcd/cli_core.pcd', sha256: 'd'.repeat(64), bytes: 104 },
  { path: 'pcd/cli_polymer.pcd', sha256: 'e'.repeat(64), bytes: 105 },
];
const good = {
  schemaVersion: 'brik64.beta17_fixpoint_materializer_generation_result.v1',
  version: '0.1.0-beta.17',
  l6plusEngineSerial: 'BRIK64-L6PLUS-N5-20260629-MATERIALIZER-001',
  materializerMode: 'l6plus_fixpoint_stage_materializer',
  generatedByL6PlusN5: true,
  generatedFromPcdPolymer: true,
  generatedMaterializerContainsStageResultMarker: true,
  generatedMaterializerIsNotFixture: true,
  pcdInputSetSha256: inputSetHash(inputPcds),
  materializerGenerationRequestSha256: '1'.repeat(64),
  generatedMaterializerSha256: materializerSha,
  generatedMaterializerBytes: Buffer.byteLength(materializerBody),
  generationTraceSha256: '2'.repeat(64),
  remoteWrapperSha256: '3'.repeat(64),
  wrapperExecTargetSha256: '4'.repeat(64),
  generatedMaterializer: {
    path: 'generated/beta17-fixpoint-stage-materializer.js',
    sha256: materializerSha,
    bytes: Buffer.byteLength(materializerBody),
  },
  generationReport: {
    path: 'evidence/beta17-fixpoint-materializer-generation/generation-report.json',
    sha256: '5'.repeat(64),
    bytes: 77,
  },
  inputPcds,
  claimBoundary: {
    publicReleaseAllowed: false,
    definitiveFixpointAllowed: false,
    formalN5ClaimAllowed: false,
    universalCorrectnessClaimAllowed: false,
  },
};

const encoded = Buffer.from(JSON.stringify(good)).toString('base64');
const parsed = parseMaterializerGenerationResult(`noise\nBRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT\t${encoded}\n`);
assert.deepStrictEqual(parsed.version, good.version);
assert.strictEqual(validateMaterializerGenerationResult(parsed).accepted, true);
assert.strictEqual(validateMaterializerGenerationResult(parsed, {
  pcdInputSetSha256: good.pcdInputSetSha256,
  materializerGenerationRequestSha256: good.materializerGenerationRequestSha256,
  remoteWrapperSha256: good.remoteWrapperSha256,
  wrapperExecTargetSha256: good.wrapperExecTargetSha256,
  requiredInputPcdPaths: inputPcds.map((item) => item.path),
}).accepted, true);

for (const [mutator, blocker] of [
  [(x) => { x.version = '0.1.0-beta.16.1'; }, 'materializer_generation_result_version_mismatch:0.1.0-beta.16.1'],
  [(x) => { x.generatedByL6PlusN5 = false; }, 'materializer_generation_generatedByL6PlusN5_not_true'],
  [(x) => { x.generatedFromPcdPolymer = false; }, 'materializer_generation_generatedFromPcdPolymer_not_true'],
  [(x) => { x.generatedMaterializerContainsStageResultMarker = false; }, 'materializer_generation_generatedMaterializerContainsStageResultMarker_not_true'],
  [(x) => { x.generatedMaterializerIsNotFixture = false; }, 'materializer_generation_generatedMaterializerIsNotFixture_not_true'],
  [(x) => { x.generatedMaterializerSha256 = 'not-a-sha'; }, 'materializer_generation_generated_materializer_sha256_invalid'],
  [(x) => { x.generatedMaterializerBytes = 0; }, 'materializer_generation_generated_materializer_bytes_invalid'],
  [(x) => { x.claimBoundary.definitiveFixpointAllowed = true; }, 'materializer_generation_claim_boundary_fixpoint_open'],
  [(x) => { x.generatedMaterializer.path = '../materializer.js'; }, 'materializer_generation_generatedMaterializer_ref_path_invalid'],
  [(x) => { delete x.generatedMaterializer.bytes; }, 'materializer_generation_generatedMaterializer_ref_bytes_invalid'],
]) {
  const candidate = structuredClone(good);
  mutator(candidate);
  const result = validateMaterializerGenerationResult(candidate);
  assert.strictEqual(result.accepted, false, blocker);
  assert(result.blockers.includes(blocker), `${blocker} not found in ${result.blockers.join(',')}`);
}

const wrongRequestHash = validateMaterializerGenerationResult(good, { materializerGenerationRequestSha256: 'f'.repeat(64) });
assert.strictEqual(wrongRequestHash.accepted, false);
assert(wrongRequestHash.blockers.includes('materializer_generation_request_sha256_mismatch'));

const missingRequiredPcd = validateMaterializerGenerationResult(
  { ...good, inputPcds: good.inputPcds.slice(0, 1) },
  { requiredInputPcdPaths: good.inputPcds.map((item) => item.path) },
);
assert.strictEqual(missingRequiredPcd.accepted, false);
assert(missingRequiredPcd.blockers.includes('materializer_generation_required_input_pcd_missing:pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd'));

const detachedInputSet = structuredClone(good);
detachedInputSet.inputPcds[0].bytes += 1;
const detachedInputSetResult = validateMaterializerGenerationResult(detachedInputSet);
assert.strictEqual(detachedInputSetResult.accepted, false);
assert(detachedInputSetResult.blockers.includes('materializer_generation_input_pcd_set_sha256_mismatch'));

const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brik64-beta17-materializer-generation-'));
const withFiles = structuredClone(good);
function writeFileRef(ref, body) {
  const absolute = path.join(workspaceRoot, ref.path);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, body);
  ref.sha256 = sha256(body);
  ref.bytes = Buffer.byteLength(body);
}
writeFileRef(withFiles.generatedMaterializer, materializerBody);
writeFileRef(withFiles.generationReport, JSON.stringify({
  generatedMaterializerSha256: withFiles.generatedMaterializerSha256,
  materializerGenerationRequestSha256: withFiles.materializerGenerationRequestSha256,
}));
for (const item of withFiles.inputPcds) {
  writeFileRef(item, item.path);
}
withFiles.pcdInputSetSha256 = inputSetHash(withFiles.inputPcds);
assert.strictEqual(validateMaterializerGenerationResult(withFiles, { workspaceRoot }).accepted, true);

fs.writeFileSync(path.join(workspaceRoot, withFiles.generatedMaterializer.path), 'console.log("no marker");\n');
let tamperedFile = validateMaterializerGenerationResult(withFiles, { workspaceRoot });
assert.strictEqual(tamperedFile.accepted, false);
assert(tamperedFile.blockers.includes('materializer_generation_generatedMaterializer_ref_file_sha256_mismatch:generated/beta17-fixpoint-stage-materializer.js'));
assert(tamperedFile.blockers.includes('materializer_generation_generated_materializer_missing_stage_result_marker'));

fs.writeFileSync(path.join(workspaceRoot, withFiles.generatedMaterializer.path), `console.log(\"${REQUIRED_STAGE_RESULT_MARKER}\\t<base64-json>\");\n`);
withFiles.generatedMaterializer.sha256 = sha256(fs.readFileSync(path.join(workspaceRoot, withFiles.generatedMaterializer.path)));
withFiles.generatedMaterializer.bytes = fs.statSync(path.join(workspaceRoot, withFiles.generatedMaterializer.path)).size;
withFiles.generatedMaterializerSha256 = withFiles.generatedMaterializer.sha256;
withFiles.generatedMaterializerBytes = withFiles.generatedMaterializer.bytes;
let placeholder = validateMaterializerGenerationResult(withFiles, { workspaceRoot });
assert.strictEqual(placeholder.accepted, false);
assert(placeholder.blockers.includes('materializer_generation_generated_materializer_placeholder_marker'));

writeFileRef(withFiles.generatedMaterializer, materializerBody);
withFiles.generatedMaterializerSha256 = withFiles.generatedMaterializer.sha256;
withFiles.generatedMaterializerBytes = withFiles.generatedMaterializer.bytes;
writeFileRef(withFiles.generationReport, JSON.stringify({
  generatedMaterializerSha256: '0'.repeat(64),
  materializerGenerationRequestSha256: withFiles.materializerGenerationRequestSha256,
}));
let badReport = validateMaterializerGenerationResult(withFiles, { workspaceRoot });
assert.strictEqual(badReport.accepted, false);
assert(badReport.blockers.includes('materializer_generation_report_materializer_sha256_mismatch'));

assert.strictEqual(parseMaterializerGenerationResult('missing marker'), null);
assert.strictEqual(parseMaterializerGenerationResult('BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT\tnot-base64-json'), null);

console.log('PASS beta17 fixpoint materializer generation result');
NODE
