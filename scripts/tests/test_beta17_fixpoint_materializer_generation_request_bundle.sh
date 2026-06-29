#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

node --check scripts/beta17-fixpoint-materializer-generation-request-bundle.js
node scripts/beta17-fixpoint-materializer-generation-request-bundle.js >/tmp/brik64-beta17-materializer-generation-request.out
node scripts/beta17-fixpoint-materializer-generation-request-bundle.js --verify

node <<'NODE'
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const {
  buildRequest,
  requestLineSha256,
  requiredResultMarker,
  validateRequest,
} = require('./scripts/beta17-fixpoint-materializer-generation-request-bundle');

const requestPath = 'evidence/beta17-fixpoint-materializer-generation-request/request.json';
const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));

assert.strictEqual(validateRequest(request).accepted, true);
assert.strictEqual(request.version, '0.1.0-beta.17');
assert.strictEqual(request.requestType, 'generate_beta17_fixpoint_stage_materializer');
assert.strictEqual(request.materializerMode, 'l6plus_fixpoint_stage_materializer');
assert.strictEqual(request.status, 'REQUEST_NON_CLAIM');
assert.strictEqual(request.claimBoundary.publicReleaseAllowed, false);
assert.strictEqual(request.claimBoundary.definitiveFixpointAllowed, false);
assert.strictEqual(request.requiredResultLine, `${requiredResultMarker}\\t<base64-json>`);
assert.strictEqual(request.requiredGeneratedMaterializerMarker, 'BRIK64_BETA17_FIXPOINT_STAGE_RESULT');
assert(request.requiredBindings.includes('generatedMaterializerContainsStageResultMarker'));
assert(request.requiredBindings.includes('generatedMaterializerIsNotFixture'));

const manifest = JSON.parse(fs.readFileSync('evidence/beta17-fixpoint-materializer-generation-request/request.manifest.json', 'utf8'));
assert.strictEqual(manifest.decision, 'PASS_BETA17_FIXPOINT_MATERIALIZER_GENERATION_REQUEST_BUNDLE');
assert.strictEqual(manifest.requestLineSha256, requestLineSha256(request));

for (const item of request.inputPcds) {
  const content = Buffer.from(item.contentBase64, 'base64');
  const actual = crypto.createHash('sha256').update(content).digest('hex');
  assert.strictEqual(actual, item.sha256);
}

let tampered = structuredClone(request);
tampered.inputPcds[0].contentBase64 = Buffer.from('tampered materializer generation pcd').toString('base64');
let result = validateRequest(tampered);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_input_pcd_0_bytes_mismatch'));
assert(result.blockers.includes('request_input_pcd_0_content_sha256_mismatch'));

tampered = structuredClone(request);
tampered.inputPcds = tampered.inputPcds.filter((item) => item.path !== 'pcd/beta17/release/fixpoint_materializer_generation_contract.pcd');
result = validateRequest(tampered);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_input_pcds_incomplete'));
assert(result.blockers.includes('request_required_input_pcd_missing:pcd/beta17/release/fixpoint_materializer_generation_contract.pcd'));

tampered = structuredClone(request);
tampered.outputRefs.generatedMaterializer = '../generated.js';
result = validateRequest(tampered);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_output_ref_invalid:generatedMaterializer'));

tampered = structuredClone(request);
tampered.requiredBindings = tampered.requiredBindings.filter((item) => item !== 'generatedMaterializerIsNotFixture');
result = validateRequest(tampered);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_required_binding_missing:generatedMaterializerIsNotFixture'));

tampered = structuredClone(request);
tampered.claimBoundary.definitiveFixpointAllowed = true;
result = validateRequest(tampered);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('claim_boundary_fixpoint_open'));

tampered = structuredClone(request);
tampered.requiredGeneratedMaterializerMarker = 'BRIK64_L6_CLI_MATERIALIZATION_RESULT';
result = validateRequest(tampered);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_generated_materializer_marker_invalid'));

assert.throws(
  () => buildRequest({ outputRefs: { generationReport: 'http://example.invalid/report.json' } }),
  /unsafe_output_ref:generationReport/
);

console.log('PASS beta17 fixpoint materializer generation request adversarial checks');
NODE
