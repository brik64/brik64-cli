#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

node scripts/beta15_4-l6-materializer-request-bundle.js >/tmp/brik64-beta15-4-request-bundle.out
node scripts/beta15_4-l6-materializer-request-bundle.js --verify

node <<'NODE'
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const { validateRequest } = require('./scripts/beta15_4-l6-materializer-request-bundle');

const requestPath = 'evidence/beta15_4-l6-materializer-request/request.json';
const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));

assert.strictEqual(validateRequest(request).accepted, true);
assert.strictEqual(request.version, '0.1.0-beta.15.4');
assert.strictEqual(request.materializerMode, 'l6plus_pcd_polymer_materializer');
assert.strictEqual(request.inputPcds.length, 6);
assert.strictEqual(request.claimBoundary.publicClaimsAllowed, false);

for (const item of request.inputPcds) {
  const content = Buffer.from(item.contentBase64, 'base64');
  const actual = crypto.createHash('sha256').update(content).digest('hex');
  assert.strictEqual(actual, item.sha256);
}

const tamperedContent = structuredClone(request);
tamperedContent.inputPcds[0].contentBase64 = Buffer.from('tampered pcd source').toString('base64');
let result = validateRequest(tamperedContent);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_input_pcd_0_bytes_mismatch'));
assert(result.blockers.includes('request_input_pcd_0_content_sha256_mismatch'));

const missingRequired = structuredClone(request);
missingRequired.inputPcds = missingRequired.inputPcds.filter((item) => item.path !== 'pcd/cli_polymer.pcd');
result = validateRequest(missingRequired);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_input_pcds_incomplete'));
assert(result.blockers.includes('request_required_input_pcd_missing:pcd/cli_polymer.pcd'));

const unsafeOutput = structuredClone(request);
unsafeOutput.outputRefs.package = '../package.tgz';
result = validateRequest(unsafeOutput);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_output_ref_invalid:package'));

const wrongSetHash = structuredClone(request);
wrongSetHash.pcdInputSetSha256 = '0'.repeat(64);
result = validateRequest(wrongSetHash);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('request_pcd_input_set_sha256_mismatch'));

console.log('PASS beta15.4 L6 materializer request bundle adversarial checks');
NODE
