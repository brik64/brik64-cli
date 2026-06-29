#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

node scripts/beta17-functional-cli-stage-request-bundle.js >/tmp/brik64-beta17-functional-cli-stage-request.out
node scripts/beta17-functional-cli-stage-request-bundle.js --verify

node <<'NODE'
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const { validateRequest } = require('./scripts/beta17-functional-cli-stage-request-bundle');

const requestPath = 'evidence/beta17-functional-cli-stage-request/request.json';
const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));

assert.strictEqual(validateRequest(request).accepted, true);
assert.strictEqual(request.version, '0.1.0-beta.17');
assert.strictEqual(request.requestType, 'generate_beta17_functional_cli_stage_artifact');
assert.strictEqual(request.materializerMode, 'l6plus_functional_cli_stage_materializer');
assert.strictEqual(request.status, 'REQUEST_NON_CLAIM');
assert.strictEqual(request.claimBoundary.publicReleaseAllowed, false);
assert.strictEqual(request.claimBoundary.definitiveFixpointAllowed, false);
assert(request.requiredInputPcdPaths.includes('pcd/beta17/release/functional_cli_stage_materialization_contract.pcd'));
assert(request.requiredBindings.includes('functionalStageArtifactGatePass'));
assert(request.requiredBindings.includes('packageCandidateReferencesArtifact'));
assert(request.functionalRequirements.requiredTextMarkers.includes('#!/usr/bin/env node'));
assert(request.functionalRequirements.requiredTextMarkers.includes('process.argv'));
assert(request.functionalRequirements.requiredSemanticMarkers.includes('certify command'));
assert(request.functionalRequirements.minArtifactBytes >= 50000);

for (const item of request.inputPcds) {
  const content = Buffer.from(item.contentBase64, 'base64');
  const actual = crypto.createHash('sha256').update(content).digest('hex');
  assert.strictEqual(actual, item.sha256);
}

const tamperedContent = structuredClone(request);
tamperedContent.inputPcds[0].contentBase64 = Buffer.from('tampered functional cli stage pcd').toString('base64');
let result = validateRequest(tamperedContent);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_input_pcd_0_bytes_mismatch'));
assert(result.blockers.includes('request_input_pcd_0_content_sha256_mismatch'));

const unsafeOutput = structuredClone(request);
unsafeOutput.outputRefs.stage1Artifact = '../generated/stage1.mjs';
result = validateRequest(unsafeOutput);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_output_ref_invalid:stage1Artifact'));

const missingBinding = structuredClone(request);
missingBinding.requiredBindings = missingBinding.requiredBindings.filter((item) => item !== 'functionalStageArtifactGatePass');
result = validateRequest(missingBinding);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_required_binding_missing:functionalStageArtifactGatePass'));

const openBoundary = structuredClone(request);
openBoundary.claimBoundary.selfHostingClaimAllowed = true;
result = validateRequest(openBoundary);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('claim_boundary_self_hosting_open'));

const weakMinSize = structuredClone(request);
weakMinSize.functionalRequirements.minArtifactBytes = 1000;
result = validateRequest(weakMinSize);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_min_artifact_bytes_too_low'));

const missingMarker = structuredClone(request);
missingMarker.functionalRequirements.requiredTextMarkers = missingMarker.functionalRequirements.requiredTextMarkers.filter((item) => item !== 'process.argv');
result = validateRequest(missingMarker);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_required_text_marker_missing:process.argv'));

const wrongSetHash = structuredClone(request);
wrongSetHash.pcdInputSetSha256 = '0'.repeat(64);
result = validateRequest(wrongSetHash);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_pcd_input_set_sha256_mismatch'));

console.log('PASS beta17 functional CLI stage request bundle adversarial checks');
NODE
