#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

FIXTURE="$TMP_DIR/fixture"
mkdir -p "$FIXTURE"
cat >"$FIXTURE/package.json" <<'JSON'
{
  "name": "@brik64/cli",
  "version": "0.1.0-beta.17"
}
JSON

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-promote-remote-result.js" \
  >"$TMP_DIR/missing.stdout" 2>"$TMP_DIR/missing.stderr"
missing_rc=$?
set -e

if [[ "$missing_rc" -eq 0 ]]; then
  echo "missing_remote_promotion_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_RESULT_PROMOTION"
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and (.blockers | index("remote_promotion_gate_not_pass:1"))
' "$FIXTURE/evidence/beta17-fixpoint/remote_promotion_manifest.json" >/dev/null

bash "$ROOT/scripts/tests/test_beta17_fixpoint_remote_promotion_gate.sh" >/tmp/brik64-beta17-promotion-gate-fixture.out
mkdir -p "$FIXTURE/evidence/beta17-fixpoint-remote-attempt"
cp -R "$ROOT/evidence/beta17-fixpoint-remote-attempt/." "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/" 2>/dev/null || true

if [[ ! -f "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json" ]]; then
  # The promotion-gate test cleans its temp fixture, so build the blocked fixture
  # shape directly here for the promotion script.
  mkdir -p "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts"
  for name in host-probe.stdout host-probe.stderr remote-ref.stdout remote-ref.stderr endpoint-status.stdout endpoint-status.stderr attempt-1.stdout attempt-1.stderr attempt-1.stage-result; do
    printf '%s\n' "$name transcript" >"$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/$name.txt"
  done
  cat >"$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stage-result.json" <<'JSON'
{
  "schemaVersion": "brik64.beta17_fixpoint_stage_result.v1",
  "version": "0.1.0-beta.17",
  "fixtureMaterializer": true
}
JSON
  sha_ref() {
    local file="$1"
    local rel="${file#$FIXTURE/}"
    local sha
    sha="$(shasum -a 256 "$file" | awk '{print $1}')"
    local bytes
    bytes="$(wc -c <"$file" | tr -d ' ')"
    jq -n --arg path "$rel" --arg sha "$sha" --argjson bytes "$bytes" \
      '{path:$path,sha256:$sha,bytes:$bytes}'
  }
  jq -n \
    --slurpfile hostStdout <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/host-probe.stdout.txt") \
    --slurpfile hostStderr <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/host-probe.stderr.txt") \
    --slurpfile remoteStdout <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/remote-ref.stdout.txt") \
    --slurpfile remoteStderr <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/remote-ref.stderr.txt") \
    --slurpfile endpointStdout <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/endpoint-status.stdout.txt") \
    --slurpfile endpointStderr <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/endpoint-status.stderr.txt") \
    --slurpfile attemptStdout <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stdout.txt") \
    --slurpfile attemptStderr <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stderr.txt") \
    --slurpfile resultRef <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stage-result.json") \
    --slurpfile stageResult "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stage-result.json" '
    {
      schemaVersion:"brik64.beta17_fixpoint.remote_attempt.v1",
      version:"0.1.0-beta.17",
      decision:"PASS_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT",
      publicationAllowed:false,
      skipped:false,
      claimBoundary:{
        publicReleaseAllowed:false,
        definitiveFixpointAllowed:false,
        formalN5ClaimAllowed:false,
        universalCorrectnessClaimAllowed:false
      },
      remote:{
        transcripts:{
          hostProbeStdout:$hostStdout[0],
          hostProbeStderr:$hostStderr[0],
          remoteRefStdout:$remoteStdout[0],
          remoteRefStderr:$remoteStderr[0],
          endpointStatusStdout:$endpointStdout[0],
          endpointStatusStderr:$endpointStderr[0]
        }
      },
      attempts:[
        {
          stageResult:{present:true,resultRef:$resultRef[0]},
          stdoutTranscript:$attemptStdout[0],
          stderrTranscript:$attemptStderr[0],
          stageResultValidation:{accepted:true,blockers:[],normalized:$stageResult[0]}
        }
      ],
      blockers:[]
    }' >"$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json"
fi

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-promote-remote-result.js" \
  >"$TMP_DIR/fixture.stdout" 2>"$TMP_DIR/fixture.stderr"
fixture_rc=$?
set -e

if [[ "$fixture_rc" -eq 0 ]]; then
  echo "fixture_remote_result_promotion_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_RESULT_PROMOTION"
  and (.blockers | index("remote_promotion_gate_not_pass:1"))
  and ((.promoted.stage1ArtifactManifest // null) == null)
' "$FIXTURE/evidence/beta17-fixpoint/remote_promotion_manifest.json" >/dev/null

rm -rf "$ROOT/evidence/beta17-fixpoint-stage-request" "$ROOT/evidence/beta17-fixpoint" "$ROOT/evidence/beta17-fixpoint-remote-attempt" "$ROOT/evidence/beta17-fixpoint-remote-promotion"

echo "PASS beta17 fixpoint remote result promotion"
