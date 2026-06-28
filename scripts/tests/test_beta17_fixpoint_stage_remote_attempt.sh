#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

rm -rf evidence/beta17-fixpoint-stage-request evidence/beta17-fixpoint-remote-attempt

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
