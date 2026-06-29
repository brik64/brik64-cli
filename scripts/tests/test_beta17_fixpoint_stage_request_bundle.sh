#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

node scripts/beta17-fixpoint-stage-request-bundle.js >/tmp/brik64-beta17-stage-request-bundle.out
node scripts/beta17-fixpoint-stage-request-bundle.js --verify

node <<'NODE'
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const { validateRequest } = require('./scripts/beta17-fixpoint-stage-request-bundle');

const requestPath = 'evidence/beta17-fixpoint-stage-request/request.json';
const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));

assert.strictEqual(validateRequest(request).accepted, true);
assert.strictEqual(request.version, '0.1.0-beta.17');
assert.strictEqual(request.lane, 'l6plus_n5_self_host_fixpoint');
assert.strictEqual(request.materializerMode, 'l6plus_fixpoint_stage_materializer');
assert.strictEqual(request.status, 'REQUEST_NON_CLAIM');
assert.strictEqual(request.claimBoundary.publicReleaseAllowed, false);
assert.strictEqual(request.claimBoundary.definitiveFixpointAllowed, false);
assert(request.requiredBindings.includes('byteIdentical'));
assert(request.requiredBindings.includes('stage2GeneratedByStage1'));

for (const item of request.inputPcds) {
  const content = Buffer.from(item.contentBase64, 'base64');
  const actual = crypto.createHash('sha256').update(content).digest('hex');
  assert.strictEqual(actual, item.sha256);
}

const tamperedContent = structuredClone(request);
tamperedContent.inputPcds[0].contentBase64 = Buffer.from('tampered beta17 pcd source').toString('base64');
let result = validateRequest(tamperedContent);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_input_pcd_0_bytes_mismatch'));
assert(result.blockers.includes('request_input_pcd_0_content_sha256_mismatch'));

const missingRequired = structuredClone(request);
missingRequired.inputPcds = missingRequired.inputPcds.filter((item) => item.path !== 'pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd');
result = validateRequest(missingRequired);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_input_pcds_incomplete'));
assert(result.blockers.includes('request_required_input_pcd_missing:pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd'));

const unsafeOutput = structuredClone(request);
unsafeOutput.outputRefs.stage2Artifact = '../stage2.mjs';
result = validateRequest(unsafeOutput);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_output_ref_invalid:stage2Artifact'));

const missingBinding = structuredClone(request);
missingBinding.requiredBindings = missingBinding.requiredBindings.filter((item) => item !== 'byteIdentical');
result = validateRequest(missingBinding);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_required_binding_missing:byteIdentical'));

const openBoundary = structuredClone(request);
openBoundary.claimBoundary.definitiveFixpointAllowed = true;
result = validateRequest(openBoundary);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('claim_boundary_fixpoint_open'));

const wrongSetHash = structuredClone(request);
wrongSetHash.pcdInputSetSha256 = '0'.repeat(64);
result = validateRequest(wrongSetHash);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_pcd_input_set_sha256_mismatch'));

console.log('PASS beta17 fixpoint stage request bundle adversarial checks');
NODE
