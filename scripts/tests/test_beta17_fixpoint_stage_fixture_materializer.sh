#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

rm -rf evidence/beta17-fixpoint evidence/beta17-fixpoint-stage-request evidence/beta17-fixpoint-readiness

node scripts/beta17-fixpoint-evidence-pack-init.js >/tmp/brik64-beta17-evidence-init.out
node scripts/beta17-fixpoint-stage-request-bundle.js >/tmp/brik64-beta17-stage-request.out
node scripts/beta17-fixpoint-stage-fixture-materializer.js \
  evidence/beta17-fixpoint-stage-request/request.json \
  >/tmp/brik64-beta17-stage-result.out

node <<'NODE'
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const {
  parseStageResult,
  validateStageResult,
} = require('./scripts/beta17-fixpoint-stage-result');

function requestLineSha256(request) {
  return crypto.createHash('sha256')
    .update(`BRIK64_BETA17_FIXPOINT_STAGE_REQUEST\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`)
    .digest('hex');
}

const request = JSON.parse(fs.readFileSync('evidence/beta17-fixpoint-stage-request/request.json', 'utf8'));
const output = fs.readFileSync('/tmp/brik64-beta17-stage-result.out', 'utf8');
const result = parseStageResult(output);
assert(result, 'stage result line missing');
assert.strictEqual(result.fixtureMaterializer, true);
assert.strictEqual(result.stage1ArtifactSha256, result.stage2ArtifactSha256);
assert.strictEqual(result.stage1ArtifactBytes, result.stage2ArtifactBytes);

const validation = validateStageResult(result, {
  workspaceRoot: process.cwd(),
  pcdInputSetSha256: request.pcdInputSetSha256,
  materializerRequestSha256: requestLineSha256(request),
  remoteWrapperSha256: result.remoteWrapperSha256,
  wrapperExecTargetSha256: result.wrapperExecTargetSha256,
  requiredInputPcdPaths: request.requiredInputPcdPaths,
});
assert.strictEqual(validation.accepted, true, validation.blockers.join(','));

for (const refName of [
  'stage1Artifact',
  'stage2Artifact',
  'stage1Manifest',
  'stage2Manifest',
  'byteIdenticalReport',
  'harnessReport',
  'sealReport',
]) {
  assert(fs.existsSync(result[refName].path), `${refName} missing`);
}

console.log('PASS beta17 fixture materializer result validation');
NODE

set +e
npm run gate:beta17:fixpoint-readiness >/tmp/brik64-beta17-readiness.stdout 2>/tmp/brik64-beta17-readiness.stderr
gate_rc=$?
set -e

if [[ "$gate_rc" -eq 0 ]]; then
  echo "fixture_materializer_unexpectedly_satisfied_readiness_gate" >&2
  exit 1
fi

grep -q "BLOCKED_BETA17_FIXPOINT_READINESS_GATE" /tmp/brik64-beta17-readiness.stdout
grep -q "canonical_motor_not_pcd_bound" /tmp/brik64-beta17-readiness.stderr

rm -rf evidence/beta17-fixpoint evidence/beta17-fixpoint-stage-request evidence/beta17-fixpoint-readiness

echo "PASS beta17 fixpoint fixture materializer"
