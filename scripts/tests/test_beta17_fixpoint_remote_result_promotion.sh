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

rm -rf "$FIXTURE/evidence/beta17-fixpoint" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-attempt" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-promotion"
mkdir -p "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts"
mkdir -p "$FIXTURE/pcd/beta17/release" "$FIXTURE/pcd"
cp "$ROOT/pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd" \
  "$FIXTURE/pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd"
cp "$ROOT/pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd" \
  "$FIXTURE/pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd"
cp "$ROOT/pcd/cli_core.pcd" "$FIXTURE/pcd/cli_core.pcd"
cp "$ROOT/pcd/cli_polymer.pcd" "$FIXTURE/pcd/cli_polymer.pcd"
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-stage-request-bundle.js" >/dev/null

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-stage-fixture-materializer.js" \
  "$FIXTURE/evidence/beta17-fixpoint-stage-request/request.json" >"$TMP_DIR/positive-result.line"

python3 - "$TMP_DIR/positive-result.line" "$FIXTURE" <<'PY'
import base64, hashlib, json, pathlib, sys

line_path = pathlib.Path(sys.argv[1])
fixture = pathlib.Path(sys.argv[2])
prefix = "BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t"
line = line_path.read_text().strip()
assert line.startswith(prefix)
stage = json.loads(base64.b64decode(line[len(prefix):]).decode("utf-8"))

def strip_fixture(value):
    if isinstance(value, dict):
        value.pop("fixtureMaterializer", None)
        for child in value.values():
            strip_fixture(child)
    elif isinstance(value, list):
        for child in value:
            strip_fixture(child)

def sha_bytes(path):
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data)

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n")

strip_fixture(stage)
source_map = {
    "stage1Artifact": "evidence/beta17-source/generated/stage1/brik64-cli-stage1.mjs",
    "stage2Artifact": "evidence/beta17-source/generated/stage2/brik64-cli-stage2.mjs",
    "stage1Manifest": "evidence/beta17-source/stage1_artifact_manifest.json",
    "stage2Manifest": "evidence/beta17-source/stage2_regeneration_manifest.json",
    "byteIdenticalReport": "evidence/beta17-source/byte_identical_report.json",
    "harnessReport": "evidence/beta17-source/harness_report.json",
    "sealReport": "evidence/beta17-source/seal_report.json",
}
for key, source_rel in source_map.items():
    original = fixture / stage[key]["path"]
    target = fixture / source_rel
    target.parent.mkdir(parents=True, exist_ok=True)
    if original.suffix == ".json":
        data = json.loads(original.read_text())
        strip_fixture(data)
        write_json(target, data)
    else:
        target.write_bytes(original.read_bytes())
    digest, size = sha_bytes(target)
    stage[key] = {"path": source_rel, "sha256": digest, "bytes": size}

stage_result_path = fixture / "evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stage-result.json"
write_json(stage_result_path, stage)
stage_result_sha, stage_result_bytes = sha_bytes(stage_result_path)

for name in [
    "host-probe.stdout", "host-probe.stderr", "remote-ref.stdout",
    "remote-ref.stderr", "endpoint-status.stdout", "endpoint-status.stderr",
    "attempt-1.stdout", "attempt-1.stderr",
]:
    p = fixture / f"evidence/beta17-fixpoint-remote-attempt/transcripts/{name}.txt"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(f"{name} transcript\n")

def ref(rel):
    p = fixture / rel
    digest, size = sha_bytes(p)
    return {"path": rel, "sha256": digest, "bytes": size}

request_rel = "evidence/beta17-fixpoint-stage-request/request.json"
request = json.loads((fixture / request_rel).read_text())
request_line = "BRIK64_BETA17_FIXPOINT_STAGE_REQUEST\t" + base64.b64encode(
    json.dumps(request, separators=(",", ":")).encode()
).decode() + "\n"
request_line_sha = hashlib.sha256(request_line.encode()).hexdigest()

report = {
    "schemaVersion": "brik64.beta17_fixpoint.remote_attempt.v1",
    "version": "0.1.0-beta.17",
    "decision": "PASS_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT",
    "publicationAllowed": False,
    "skipped": False,
    "claimBoundary": {
        "publicReleaseAllowed": False,
        "definitiveFixpointAllowed": False,
        "formalN5ClaimAllowed": False,
        "universalCorrectnessClaimAllowed": False,
    },
    "request": {**ref(request_rel), "pcdInputSetSha256": request["pcdInputSetSha256"]},
    "expectedContext": {
        "pcdInputSetSha256": request["pcdInputSetSha256"],
        "materializerRequestSha256": request_line_sha,
        "remoteWrapperSha256": "7" * 64,
        "wrapperExecTargetSha256": "8" * 64,
        "requiredInputPcdPaths": request["requiredInputPcdPaths"],
    },
    "remote": {
        "transcripts": {
            "hostProbeStdout": ref("evidence/beta17-fixpoint-remote-attempt/transcripts/host-probe.stdout.txt"),
            "hostProbeStderr": ref("evidence/beta17-fixpoint-remote-attempt/transcripts/host-probe.stderr.txt"),
            "remoteRefStdout": ref("evidence/beta17-fixpoint-remote-attempt/transcripts/remote-ref.stdout.txt"),
            "remoteRefStderr": ref("evidence/beta17-fixpoint-remote-attempt/transcripts/remote-ref.stderr.txt"),
            "endpointStatusStdout": ref("evidence/beta17-fixpoint-remote-attempt/transcripts/endpoint-status.stdout.txt"),
            "endpointStatusStderr": ref("evidence/beta17-fixpoint-remote-attempt/transcripts/endpoint-status.stderr.txt"),
        }
    },
    "attempts": [{
        "command": ["positive-fixture"],
        "status": 0,
        "stageResult": {
            "present": True,
            "resultRef": {
                "path": "evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stage-result.json",
                "sha256": stage_result_sha,
                "bytes": stage_result_bytes,
            },
        },
        "stdoutTranscript": ref("evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stdout.txt"),
        "stderrTranscript": ref("evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stderr.txt"),
        "stageResultValidation": {"accepted": True, "blockers": [], "normalized": stage},
    }],
    "blockers": [],
}
write_json(fixture / "evidence/beta17-fixpoint-remote-attempt/report.json", report)
PY

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-promote-remote-result.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"

jq -e '
  .decision=="PASS_BETA17_FIXPOINT_REMOTE_RESULT_PROMOTION"
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and (.blockers | length)==0
  and .promoted.stage1Artifact.path=="evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs"
  and .promoted.stage2Artifact.path=="evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs"
' "$FIXTURE/evidence/beta17-fixpoint/remote_promotion_manifest.json" >/dev/null

test -f "$FIXTURE/evidence/beta17-fixpoint/stage1_artifact_manifest.json"
test -f "$FIXTURE/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs"

rm -rf "$ROOT/evidence/beta17-fixpoint-stage-request" "$ROOT/evidence/beta17-fixpoint" "$ROOT/evidence/beta17-fixpoint-remote-attempt" "$ROOT/evidence/beta17-fixpoint-remote-promotion"

echo "PASS beta17 fixpoint remote result promotion"
