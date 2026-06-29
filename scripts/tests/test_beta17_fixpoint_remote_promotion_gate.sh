#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

FIXTURE="$TMP_DIR/fixture"
mkdir -p "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts" \
  "$FIXTURE/evidence/beta17-fixpoint-stage-request" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher"
mkdir -p "$FIXTURE/pcd/beta17/release"
cp "$ROOT/pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd" \
  "$FIXTURE/pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd"
cp "$ROOT/pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd" \
  "$FIXTURE/pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd"
cp "$ROOT/pcd/cli_core.pcd" "$FIXTURE/pcd/cli_core.pcd"
cp "$ROOT/pcd/cli_polymer.pcd" "$FIXTURE/pcd/cli_polymer.pcd"
cat >"$FIXTURE/package.json" <<'JSON'
{
  "name": "@brik64/cli",
  "version": "0.1.0-beta.17"
}
JSON

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-promotion-gate.js" \
  >"$TMP_DIR/missing.stdout" 2>"$TMP_DIR/missing.stderr"
missing_rc=$?
set -e

if [[ "$missing_rc" -eq 0 ]]; then
  echo "missing_remote_attempt_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_PROMOTION_GATE"
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and (.blockers | index("missing_remote_attempt_report:evidence/beta17-fixpoint-remote-attempt/report.json"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-promotion/report.json" >/dev/null

node "$ROOT/scripts/beta17-fixpoint-stage-request-bundle.js" >/dev/null
cp -R "$ROOT/evidence/beta17-fixpoint-stage-request/." "$FIXTURE/evidence/beta17-fixpoint-stage-request/"
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-stage-fixture-materializer.js" \
  "$FIXTURE/evidence/beta17-fixpoint-stage-request/request.json" >"$TMP_DIR/fixture-result.line"

for name in host-probe.stdout host-probe.stderr remote-ref.stdout remote-ref.stderr endpoint-status.stdout endpoint-status.stderr attempt-1.stdout attempt-1.stderr; do
  printf '%s\n' "$name transcript" >"$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/$name.txt"
done
cp "$TMP_DIR/fixture-result.line" "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stdout.txt"

fixture_result_json="$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stage-result.json"
python3 - "$TMP_DIR/fixture-result.line" "$fixture_result_json" <<'PY'
import base64, json, sys
line = open(sys.argv[1], "r", encoding="utf-8").read().strip()
prefix = "BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t"
assert line.startswith(prefix)
payload = json.loads(base64.b64decode(line[len(prefix):]).decode("utf-8"))
with open(sys.argv[2], "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
    fh.write("\n")
PY

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

request_ref_json="$(sha_ref "$FIXTURE/evidence/beta17-fixpoint-stage-request/request.json")"
request_pcd_input_set_sha="$(jq -r '.pcdInputSetSha256' "$FIXTURE/evidence/beta17-fixpoint-stage-request/request.json")"
request_line_sha="$(node -e '
const fs = require("fs");
const crypto = require("crypto");
const request = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const line = `BRIK64_BETA17_FIXPOINT_STAGE_REQUEST\t${Buffer.from(JSON.stringify(request)).toString("base64")}\n`;
process.stdout.write(crypto.createHash("sha256").update(line).digest("hex"));
' "$FIXTURE/evidence/beta17-fixpoint-stage-request/request.json")"
cat >"$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-script.sh" <<'SH'
#!/usr/bin/env bash
echo install beta17 dispatcher
SH
install_script_ref_json="$(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-script.sh")"
materializer_sha="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
materializer_remote_path="/opt/brik64/engines/l6plus-n5/beta17/beta17-materializer.js"
jq -n \
  --slurpfile installScriptRef <(printf "%s\n" "$install_script_ref_json") \
  --arg materializerSha "$materializer_sha" \
  --arg materializerRemotePath "$materializer_remote_path" '
  {
    schemaVersion:"brik64.beta17_fixpoint.remote_dispatcher_install_report.v1",
    version:"0.1.0-beta.17",
    decision:"PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL",
    executed:true,
    publicationAllowed:false,
    claimBoundary:{
      publicReleaseAllowed:false,
      definitiveFixpointAllowed:false,
      formalN5ClaimAllowed:false,
      universalCorrectnessClaimAllowed:false
    },
    plan:{
      capability:"beta17_fixpoint_stage_dispatcher",
      materializerSha256:$materializerSha,
      materializerRemotePath:$materializerRemotePath,
      localMaterializerRef:{path:"generated/beta17-materializer.js",sha256:$materializerSha,bytes:128},
      materializerProvenanceRef:{path:"generated/beta17-materializer.provenance.json",sha256:"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",bytes:128}
    },
    installScript:{
      path:$installScriptRef[0].path,
      sha256:$installScriptRef[0].sha256,
      bytes:$installScriptRef[0].bytes,
      requiredResultMarker:"BRIK64_BETA17_FIXPOINT_STAGE_RESULT",
      validation:{
        accepted:true,
        blockers:[],
        requiredCapability:"beta17_fixpoint_stage_dispatcher",
        requiredCommands:["beta17-fixpoint-stage-status","beta17-fixpoint-stage-materialize"],
        materializerExecBinding:("/usr/bin/node " + $materializerRemotePath)
      }
    }
  }' >"$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-report.json"
install_report_ref_json="$(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-report.json")"

jq -n \
  --arg host_stdout_path "evidence/beta17-fixpoint-remote-attempt/transcripts/host-probe.stdout.txt" \
  --slurpfile hostStdout <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/host-probe.stdout.txt") \
  --slurpfile hostStderr <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/host-probe.stderr.txt") \
  --slurpfile remoteStdout <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/remote-ref.stdout.txt") \
  --slurpfile remoteStderr <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/remote-ref.stderr.txt") \
  --slurpfile endpointStdout <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/endpoint-status.stdout.txt") \
  --slurpfile endpointStderr <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/endpoint-status.stderr.txt") \
  --slurpfile attemptStdout <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stdout.txt") \
  --slurpfile attemptStderr <(sha_ref "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stderr.txt") \
  --slurpfile resultRef <(sha_ref "$fixture_result_json") \
  --slurpfile installReportRef <(printf "%s\n" "$install_report_ref_json") \
  --slurpfile installScriptRef <(printf "%s\n" "$install_script_ref_json") \
  --slurpfile stageResult "$fixture_result_json" \
  --slurpfile requestRef <(printf "%s\n" "$request_ref_json") \
  --arg materializerSha "$materializer_sha" \
  --arg materializerRemotePath "$materializer_remote_path" \
  --arg pcdInputSetSha "$request_pcd_input_set_sha" \
  --arg requestLineSha "$request_line_sha" '
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
    request:($requestRef[0] + {pcdInputSetSha256:$pcdInputSetSha}),
    installEvidence:{
      reportRef:$installReportRef[0],
      decision:"PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL",
      executed:true,
      materializerSha256:$materializerSha,
      materializerRemotePath:$materializerRemotePath,
      installScriptRef:$installScriptRef[0]
    },
    expectedContext:{
      pcdInputSetSha256:$pcdInputSetSha,
      materializerRequestSha256:$requestLineSha,
      remoteWrapperSha256:"5",
      wrapperExecTargetSha256:"6",
      requiredInputPcdPaths:[
        "pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd",
        "pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd",
        "pcd/cli_core.pcd",
        "pcd/cli_polymer.pcd"
      ]
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
        command:["fixture"],
        status:0,
        stageResult:{present:true,resultRef:$resultRef[0]},
        stdoutTranscript:$attemptStdout[0],
        stderrTranscript:$attemptStderr[0],
        stageResultValidation:{accepted:true,blockers:[],normalized:$stageResult[0]}
      }
    ],
    blockers:[]
  }' >"$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json"

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-promotion-gate.js" \
  >"$TMP_DIR/fixture.stdout" 2>"$TMP_DIR/fixture.stderr"
fixture_rc=$?
set -e

if [[ "$fixture_rc" -eq 0 ]]; then
  echo "fixture_remote_attempt_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_PROMOTION_GATE"
  and (.blockers | index("accepted_remote_attempt_fixture_materializer_not_claim_bearing"))
  and (.blockers | index("accepted_remote_stage_result_fixture_materializer_not_claim_bearing"))
  and (.blockers | index("accepted_stage_result_file_fixture_materializer_not_claim_bearing"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-promotion/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json" "$fixture_result_json" "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stdout.txt" <<'PY'
import base64, json, sys
report_path, stage_path, stdout_path = sys.argv[1], sys.argv[2], sys.argv[3]
report = json.load(open(report_path))
stage = json.load(open(stage_path))

def strip_fixture(value):
    if isinstance(value, dict):
        value.pop("fixtureMaterializer", None)
        for child in value.values():
            strip_fixture(child)
    elif isinstance(value, list):
        for child in value:
            strip_fixture(child)

strip_fixture(stage)
with open(stage_path, "w", encoding="utf-8") as fh:
    json.dump(stage, fh, indent=2)
    fh.write("\n")
with open(stdout_path, "w", encoding="utf-8") as fh:
    encoded = base64.b64encode(json.dumps(stage).encode("utf-8")).decode("ascii")
    fh.write(f"BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t{encoded}\n")

attempt = report["attempts"][0]
strip_fixture(attempt)
attempt["stageResultValidation"]["accepted"] = True
attempt["stageResultValidation"]["blockers"] = []
attempt["stageResultValidation"]["normalized"] = stage
report["decision"] = "PASS_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT"
report["blockers"] = []
with open(report_path, "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=2)
    fh.write("\n")
PY

cp "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-report.json" \
  "$TMP_DIR/original-install-report.json"
python3 - "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-report.json" "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json" <<'PY'
import hashlib, json, pathlib, sys
install_path = pathlib.Path(sys.argv[1])
attempt_path = pathlib.Path(sys.argv[2])
install = json.loads(install_path.read_text())
install["decision"] = "PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL_DRY_RUN"
install["executed"] = False
install_path.write_text(json.dumps(install, indent=2) + "\n")
attempt = json.loads(attempt_path.read_text())
data = install_path.read_bytes()
attempt["installEvidence"]["reportRef"]["sha256"] = hashlib.sha256(data).hexdigest()
attempt["installEvidence"]["reportRef"]["bytes"] = len(data)
attempt_path.write_text(json.dumps(attempt, indent=2) + "\n")
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-promotion-gate.js" \
  >"$TMP_DIR/install-not-executed.stdout" 2>"$TMP_DIR/install-not-executed.stderr"
install_not_executed_rc=$?
set -e

if [[ "$install_not_executed_rc" -eq 0 ]]; then
  echo "install_not_executed_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_PROMOTION_GATE"
  and (.blockers | index("remote_attempt_install_report_not_executed:PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL_DRY_RUN"))
  and (.blockers | index("remote_attempt_install_report_executed_false"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-promotion/report.json" >/dev/null

cp "$TMP_DIR/original-install-report.json" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-report.json"
python3 - "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-report.json" "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json" <<'PY'
import hashlib, json, pathlib, sys
install_path = pathlib.Path(sys.argv[1])
attempt_path = pathlib.Path(sys.argv[2])
attempt = json.loads(attempt_path.read_text())
data = install_path.read_bytes()
attempt["installEvidence"]["reportRef"]["sha256"] = hashlib.sha256(data).hexdigest()
attempt["installEvidence"]["reportRef"]["bytes"] = len(data)
attempt["installEvidence"]["decision"] = "PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL"
attempt["installEvidence"]["executed"] = True
attempt_path.write_text(json.dumps(attempt, indent=2) + "\n")
PY

python3 - "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json" "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stdout.txt" "$TMP_DIR/original-attempt-1.stdout.txt" <<'PY'
import base64, hashlib, json, sys
report_path, stdout_path, original_path = sys.argv[1], sys.argv[2], sys.argv[3]
original = open(stdout_path, "r", encoding="utf-8").read()
open(original_path, "w", encoding="utf-8").write(original)
report = json.load(open(report_path))
payload = json.loads(base64.b64decode(original.split("\t", 1)[1]).decode("utf-8"))
payload["stage2ArtifactSha256"] = "f" * 64
encoded = base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")
mutated = f"BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t{encoded}\n"
with open(stdout_path, "w", encoding="utf-8") as fh:
    fh.write(mutated)
report["attempts"][0]["stdoutTranscript"]["sha256"] = hashlib.sha256(mutated.encode("utf-8")).hexdigest()
report["attempts"][0]["stdoutTranscript"]["bytes"] = len(mutated.encode("utf-8"))
with open(report_path, "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=2)
    fh.write("\n")
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-promotion-gate.js" \
  >"$TMP_DIR/stdout-mismatch.stdout" 2>"$TMP_DIR/stdout-mismatch.stderr"
stdout_mismatch_rc=$?
set -e

if [[ "$stdout_mismatch_rc" -eq 0 ]]; then
  echo "stdout_stage_result_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_PROMOTION_GATE"
  and (.blockers | index("accepted_attempt_stdout_stage_result_mismatch"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-promotion/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json" "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stdout.txt" "$TMP_DIR/original-attempt-1.stdout.txt" <<'PY'
import hashlib, json, sys
report_path, stdout_path, original_stdout_path = sys.argv[1], sys.argv[2], sys.argv[3]
original = open(original_stdout_path, "r", encoding="utf-8").read()
with open(stdout_path, "w", encoding="utf-8") as fh:
    fh.write(original)
report = json.load(open(report_path))
data = original.encode("utf-8")
report["attempts"][0]["stdoutTranscript"]["sha256"] = hashlib.sha256(data).hexdigest()
report["attempts"][0]["stdoutTranscript"]["bytes"] = len(data)
with open(report_path, "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=2)
    fh.write("\n")
PY

python3 - "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json" <<'PY'
import json, sys
path = sys.argv[1]
report = json.load(open(path))
report["attempts"][0]["stdoutTranscript"]["bytes"] += 1
with open(path, "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=2)
    fh.write("\n")
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-promotion-gate.js" \
  >"$TMP_DIR/stdout-bytes-mismatch.stdout" 2>"$TMP_DIR/stdout-bytes-mismatch.stderr"
stdout_bytes_mismatch_rc=$?
set -e

if [[ "$stdout_bytes_mismatch_rc" -eq 0 ]]; then
  echo "stdout_bytes_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_PROMOTION_GATE"
  and (.blockers | index("accepted_attempt_stdout_transcript_bytes_mismatch:evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stdout.txt"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-promotion/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json" "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stdout.txt" <<'PY'
import json, pathlib, sys
report_path, stdout_path = sys.argv[1], pathlib.Path(sys.argv[2])
report = json.load(open(report_path))
report["attempts"][0]["stdoutTranscript"]["bytes"] = len(stdout_path.read_bytes())
with open(report_path, "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=2)
    fh.write("\n")
PY

python3 - "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json" <<'PY'
import json, sys
path = sys.argv[1]
report = json.load(open(path))
report["expectedContext"]["materializerRequestSha256"] = "0" * 64
with open(path, "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=2)
    fh.write("\n")
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-promotion-gate.js" \
  >"$TMP_DIR/request-context-mismatch.stdout" 2>"$TMP_DIR/request-context-mismatch.stderr"
request_context_mismatch_rc=$?
set -e

if [[ "$request_context_mismatch_rc" -eq 0 ]]; then
  echo "request_context_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_PROMOTION_GATE"
  and (.blockers | index("remote_attempt_expected_context_request_sha256_mismatch"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-promotion/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json" "$request_line_sha" <<'PY'
import json, sys
path, request_line_sha = sys.argv[1], sys.argv[2]
report = json.load(open(path))
report["expectedContext"]["materializerRequestSha256"] = request_line_sha
with open(path, "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=2)
    fh.write("\n")
PY

python3 - "$fixture_result_json" <<'PY'
import json, sys
path = sys.argv[1]
stage = json.load(open(path))
stage["stage2ArtifactSha256"] = "e" * 64
with open(path, "w", encoding="utf-8") as fh:
    json.dump(stage, fh, indent=2)
    fh.write("\n")
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-promotion-gate.js" \
  >"$TMP_DIR/tampered-result.stdout" 2>"$TMP_DIR/tampered-result.stderr"
tampered_result_rc=$?
set -e

if [[ "$tampered_result_rc" -eq 0 ]]; then
  echo "tampered_stage_result_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_PROMOTION_GATE"
  and ([.blockers[] | select(startswith("accepted_stage_result_revalidation_failed:"))] | length)==1
' "$FIXTURE/evidence/beta17-fixpoint-remote-promotion/report.json" >/dev/null

rm -rf "$ROOT/evidence/beta17-fixpoint-stage-request" "$ROOT/evidence/beta17-fixpoint"

echo "PASS beta17 fixpoint remote promotion gate"
