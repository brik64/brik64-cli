#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

rm -rf evidence/beta17-fixpoint-stage-request evidence/beta17-fixpoint-remote-attempt

grep -q "stageResultRaw" scripts/beta17-fixpoint-stage-remote-attempt.js
grep -q "resultRef" scripts/beta17-fixpoint-stage-remote-attempt.js
if grep -q "parseStageResult(raw)" scripts/beta17-fixpoint-stage-remote-attempt.js; then
  echo "remote_attempt_must_not_validate_truncated_observed_output" >&2
  exit 1
fi

node <<'NODE'
const assert = require('assert');
const {
  attemptedMaterializationCommands,
  parseEndpointCapabilities,
  parseWrapperMode,
  requiredEndpointCapability,
  requiredStageResultMarker,
} = require('./scripts/beta17-fixpoint-stage-remote-attempt');

assert.strictEqual(requiredEndpointCapability, 'beta17_fixpoint_stage_dispatcher');
assert.strictEqual(requiredStageResultMarker, 'BRIK64_BETA17_FIXPOINT_STAGE_RESULT');
assert.deepStrictEqual(attemptedMaterializationCommands, [
  'beta17-fixpoint-stage-materialize',
  'fixpoint-stage-materialize',
  'materialize',
]);
assert.deepStrictEqual(
  parseEndpointCapabilities('BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\tinstalled\tbeta15_7_ready,beta16_native_ready,beta16_1_ready\n'),
  ['beta15_7_ready', 'beta16_native_ready', 'beta16_1_ready'],
);
assert.deepStrictEqual(
  parseEndpointCapabilities('BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\\tinstalled\\tbeta15_7_ready,beta16_native_ready,beta16_1_ready\n'),
  ['beta15_7_ready', 'beta16_native_ready', 'beta16_1_ready'],
);
assert.deepStrictEqual(
  parseEndpointCapabilities('BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\tinstalled\tbeta17_fixpoint_stage_dispatcher\n'),
  ['beta17_fixpoint_stage_dispatcher'],
);
assert.deepStrictEqual(parseEndpointCapabilities('no endpoint'), []);
assert.strictEqual(parseWrapperMode('BRIK64_WRAPPER_MODE\tunknown\n'), 'unknown');
console.log('PASS beta17 remote endpoint parser checks');
NODE

node scripts/beta17-fixpoint-stage-request-bundle.js >/tmp/brik64-beta17-stage-request.out

set +e
BRIK64_L6_SKIP_REMOTE=1 node scripts/beta17-fixpoint-stage-remote-attempt.js \
  >/tmp/brik64-beta17-remote-attempt.stdout \
  2>/tmp/brik64-beta17-remote-attempt.stderr
rc=$?
set -e

if [[ "$rc" -eq 0 ]]; then
  echo "remote_attempt_skip_unexpected_pass" >&2
  exit 1
fi

grep -q "BLOCKED_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT" /tmp/brik64-beta17-remote-attempt.stdout
grep -q "remote_l6plus_probe_failed" /tmp/brik64-beta17-remote-attempt.stderr
grep -q "remote_l6plus_beta17_stage_result_unavailable" /tmp/brik64-beta17-remote-attempt.stderr

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT"
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .skipped==true
  and (.blockers | index("remote_l6plus_probe_failed"))
  and (.blockers | index("remote_l6plus_beta17_stage_result_unavailable"))
  and .remoteEndpointContract.requiredEndpointCapability=="beta17_fixpoint_stage_dispatcher"
  and .remoteEndpointContract.requiredWrapperMode=="beta17_fixpoint_stage_dispatcher"
  and .remoteEndpointContract.requiredStageResultMarker=="BRIK64_BETA17_FIXPOINT_STAGE_RESULT"
  and (.remoteEndpointContract.attemptedMaterializationCommands | index("beta17-fixpoint-stage-materialize"))
  and (.remoteEndpointContract.attemptedMaterializationCommands | index("fixpoint-stage-materialize"))
  and (.remoteEndpointContract.attemptedMaterializationCommands | index("materialize"))
  and (.remoteEndpointContract.nonAcceptableSubstitutes | index("beta15.7 or beta16 materializer endpoint"))
  and (.nextAction | contains("beta17_fixpoint_stage_dispatcher"))
  and (.nextAction | contains("BRIK64_BETA17_FIXPOINT_STAGE_RESULT"))
  and .request.path=="evidence/beta17-fixpoint-stage-request/request.json"
  and (.remote.transcripts.hostProbeStderr.path=="evidence/beta17-fixpoint-remote-attempt/transcripts/host-probe.stderr.txt")
  and (.remote.transcripts.hostProbeStderr.bytes > 0)
  and (.remote.transcripts.remoteRefStderr.path=="evidence/beta17-fixpoint-remote-attempt/transcripts/remote-ref.stderr.txt")
  and (.remote.transcripts.endpointStatusStderr.path=="evidence/beta17-fixpoint-remote-attempt/transcripts/endpoint-status.stderr.txt")
' evidence/beta17-fixpoint-remote-attempt/report.json >/dev/null

test -f evidence/beta17-fixpoint-remote-attempt/transcripts/host-probe.stderr.txt
grep -q "remote probe skipped by BRIK64_L6_SKIP_REMOTE=1" \
  evidence/beta17-fixpoint-remote-attempt/transcripts/host-probe.stderr.txt

rm -rf evidence/beta17-fixpoint-stage-request evidence/beta17-fixpoint-remote-attempt

echo "PASS beta17 fixpoint remote attempt skip gate"
