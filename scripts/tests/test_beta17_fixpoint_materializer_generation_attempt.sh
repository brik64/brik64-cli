#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

rm -rf evidence/beta17-fixpoint-materializer-generation-request \
  evidence/beta17-fixpoint-materializer-generation-attempt

node --check scripts/beta17-fixpoint-materializer-generation-attempt.js

node <<'NODE'
const assert = require('assert');
const {
  attemptedGenerationCommands,
  hydrateMaterializerGenerationResult,
  parseEndpointCapabilities,
  parseEndpointSignals,
  parseWrapperMode,
  requiredEndpointCapability,
  requiredResultMarker,
  safeRelativePath,
} = require('./scripts/beta17-fixpoint-materializer-generation-attempt');
const fs = require('fs');
const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

assert.strictEqual(requiredEndpointCapability, 'beta17_fixpoint_materializer_generator');
assert.strictEqual(requiredResultMarker, 'BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT');
assert.deepStrictEqual(attemptedGenerationCommands, [
  'beta17-fixpoint-materializer-generate',
  'fixpoint-materializer-generate',
  'generate-materializer',
]);
assert.deepStrictEqual(
  parseEndpointCapabilities('BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\tinstalled\tbeta15_7_ready,beta16_native_ready,beta16_1_ready\n'),
  ['beta15_7_ready', 'beta16_native_ready', 'beta16_1_ready'],
);
assert.deepStrictEqual(
  parseEndpointCapabilities('BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\\tinstalled\\tbeta17_fixpoint_materializer_generator,beta17_fixpoint_stage_dispatcher\n'),
  ['beta17_fixpoint_materializer_generator', 'beta17_fixpoint_stage_dispatcher'],
);
assert.deepStrictEqual(parseEndpointCapabilities('no endpoint'), []);
assert.deepStrictEqual(
  parseEndpointSignals([
    'BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\\tinstalled\\tbeta17_fixpoint_materializer_generator',
    'BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT\\tavailable',
  ].join('\n')),
  [
    {
      marker: 'BRIK64_L6_CLI_MATERIALIZER_ENDPOINT',
      fields: ['installed', 'beta17_fixpoint_materializer_generator'],
    },
    {
      marker: 'BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT',
      fields: ['available'],
    },
  ],
);
assert.strictEqual(parseWrapperMode('BRIK64_WRAPPER_MODE\tbeta17_fixpoint_materializer_generator\n'), 'beta17_fixpoint_materializer_generator');
assert.strictEqual(parseWrapperMode('BRIK64_WRAPPER_MODE\tunknown\n'), 'unknown');
assert.strictEqual(safeRelativePath('generated/beta17-test-materializer.js'), true);
assert.strictEqual(safeRelativePath('../outside.js'), false);

fs.rmSync('evidence/beta17-fixpoint-materializer-generation-attempt-hydration-test', { recursive: true, force: true });
const content = Buffer.from('BRIK64_BETA17_FIXPOINT_STAGE_RESULT\n');
const hydrationResult = {
  generatedMaterializer: {
    path: 'evidence/beta17-fixpoint-materializer-generation-attempt-hydration-test/materializer.js',
    sha256: sha256(content),
    bytes: content.length,
  },
  generatedMaterializerContentBase64: content.toString('base64'),
};
const hydration = hydrateMaterializerGenerationResult(hydrationResult);
assert.deepStrictEqual(hydration.blockers, []);
assert.strictEqual(
  fs.readFileSync('evidence/beta17-fixpoint-materializer-generation-attempt-hydration-test/materializer.js', 'utf8'),
  'BRIK64_BETA17_FIXPOINT_STAGE_RESULT\n',
);
const badHashHydration = hydrateMaterializerGenerationResult({
  generatedMaterializer: {
    path: 'evidence/beta17-fixpoint-materializer-generation-attempt-hydration-test/bad-hash.js',
    sha256: '0'.repeat(64),
    bytes: content.length,
  },
  generatedMaterializerContentBase64: content.toString('base64'),
});
assert.ok(badHashHydration.blockers.includes('materializer_generation_generatedMaterializer_content_sha256_mismatch'));
const outsideHydration = hydrateMaterializerGenerationResult({
  generatedMaterializer: {
    path: '../outside.js',
    sha256: sha256(content),
    bytes: content.length,
  },
  generatedMaterializerContentBase64: content.toString('base64'),
});
assert.ok(outsideHydration.blockers.includes('unsafe_result_ref:../outside.js'));
fs.rmSync('evidence/beta17-fixpoint-materializer-generation-attempt-hydration-test', { recursive: true, force: true });
console.log('PASS beta17 materializer generation endpoint parser checks');
NODE

node scripts/beta17-fixpoint-materializer-generation-request-bundle.js >/tmp/brik64-beta17-materializer-generation-request.out

set +e
BRIK64_L6_SKIP_REMOTE=1 node scripts/beta17-fixpoint-materializer-generation-attempt.js \
  >/tmp/brik64-beta17-materializer-generation-attempt.stdout \
  2>/tmp/brik64-beta17-materializer-generation-attempt.stderr
rc=$?
set -e

if [[ "$rc" -eq 0 ]]; then
  echo "materializer_generation_attempt_skip_unexpected_pass" >&2
  exit 1
fi

grep -q "BLOCKED_BETA17_FIXPOINT_MATERIALIZER_GENERATION_ATTEMPT" \
  /tmp/brik64-beta17-materializer-generation-attempt.stdout
grep -q "remote_l6plus_probe_failed" \
  /tmp/brik64-beta17-materializer-generation-attempt.stderr
grep -q "remote_l6plus_beta17_materializer_generation_result_unavailable" \
  /tmp/brik64-beta17-materializer-generation-attempt.stderr

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_MATERIALIZER_GENERATION_ATTEMPT"
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .skipped==true
  and (.blockers | index("remote_l6plus_probe_failed"))
  and (.blockers | index("remote_l6plus_beta17_materializer_generation_result_unavailable"))
  and .remoteEndpointContract.requiredEndpointCapability=="beta17_fixpoint_materializer_generator"
  and .remoteEndpointContract.requiredWrapperMode=="beta17_fixpoint_materializer_generator"
  and .remoteEndpointContract.requiredResultMarker=="BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT"
  and (.remoteEndpointContract.attemptedGenerationCommands | index("beta17-fixpoint-materializer-generate"))
  and (.remoteEndpointContract.attemptedGenerationCommands | index("fixpoint-materializer-generate"))
  and (.remoteEndpointContract.attemptedGenerationCommands | index("generate-materializer"))
  and (.remoteEndpointContract.nonAcceptableSubstitutes | index("beta17 stage dispatcher without materializer-generation endpoint"))
  and (.nextAction | contains("beta17_fixpoint_materializer_generator"))
  and (.nextAction | contains("BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT"))
  and .request.path=="evidence/beta17-fixpoint-materializer-generation-request/request.json"
  and (.request.requestLineSha256 | type)=="string"
  and (.remote.transcripts.hostProbeStderr.path=="evidence/beta17-fixpoint-materializer-generation-attempt/transcripts/host-probe.stderr.txt")
  and (.remote.transcripts.hostProbeStderr.bytes > 0)
  and (.remote.transcripts.remoteRefStderr.path=="evidence/beta17-fixpoint-materializer-generation-attempt/transcripts/remote-ref.stderr.txt")
  and (.remote.transcripts.endpointStatusStderr.path=="evidence/beta17-fixpoint-materializer-generation-attempt/transcripts/endpoint-status.stderr.txt")
' evidence/beta17-fixpoint-materializer-generation-attempt/report.json >/dev/null

test -f evidence/beta17-fixpoint-materializer-generation-attempt/transcripts/host-probe.stderr.txt
grep -q "remote probe skipped by BRIK64_L6_SKIP_REMOTE=1" \
  evidence/beta17-fixpoint-materializer-generation-attempt/transcripts/host-probe.stderr.txt

rm -rf evidence/beta17-fixpoint-materializer-generation-request \
  evidence/beta17-fixpoint-materializer-generation-attempt

echo "PASS beta17 fixpoint materializer generation attempt skip gate"
