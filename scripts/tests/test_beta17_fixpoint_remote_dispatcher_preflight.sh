#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FIXTURE="$TMP_DIR/workspace"
mkdir -p "$FIXTURE/artifacts" "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher"
printf '%s\n' 'beta17 real dispatcher materializer placeholder for preflight hash binding' \
  >"$FIXTURE/artifacts/beta17-dispatcher.js"

sha_ref() {
  local file="$1"
  jq -n \
    --arg path "${file#$FIXTURE/}" \
    --arg sha "$(shasum -a 256 "$file" | awk '{print $1}')" \
    --argjson bytes "$(wc -c <"$file" | tr -d ' ')" \
    '{path:$path, sha256:$sha, bytes:$bytes}'
}

materializer_sha="$(shasum -a 256 "$FIXTURE/artifacts/beta17-dispatcher.js" | awk '{print $1}')"
materializer_bytes="$(wc -c <"$FIXTURE/artifacts/beta17-dispatcher.js" | tr -d ' ')"
cat >"$FIXTURE/artifacts/beta17-dispatcher.provenance.json" <<JSON
{
  "schemaVersion": "brik64.beta17_fixpoint.materializer_provenance.v1",
  "version": "0.1.0-beta.17",
  "status": "MATERIALIZER_PROVENANCE_NON_CLAIM",
  "materializerMode": "l6plus_fixpoint_stage_materializer",
  "generatedFromPcdPolymer": true,
  "fixtureOrTemplate": false,
  "l6plusEngineSerial": "BRIK64-L6PLUS-N5-TEST-SERIAL",
  "pcdInputSetSha256": "1111111111111111111111111111111111111111111111111111111111111111",
  "materializerRef": {
    "path": "artifacts/beta17-dispatcher.js",
    "sha256": "$materializer_sha",
    "bytes": $materializer_bytes
  },
  "claimBoundary": {
    "publicReleaseAllowed": false,
    "definitiveFixpointAllowed": false,
    "formalN5ClaimAllowed": false,
    "universalCorrectnessClaimAllowed": false
  }
}
JSON

jq -n \
  --arg sha "$materializer_sha" \
  --argjson bytes "$materializer_bytes" \
  --slurpfile localRef <(sha_ref "$FIXTURE/artifacts/beta17-dispatcher.js") \
  --slurpfile provenanceRef <(sha_ref "$FIXTURE/artifacts/beta17-dispatcher.provenance.json") '
  {
    schemaVersion:"brik64.beta17_fixpoint.remote_dispatcher_deploy_plan.v1",
    version:"0.1.0-beta.17",
    status:"DEPLOY_PLAN_NON_CLAIM",
    capability:"beta17_fixpoint_stage_dispatcher",
    wrapperMode:"beta17_fixpoint_stage_dispatcher",
    wrapperPath:"/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5",
    materializerRemotePath:"/opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_beta17_fixpoint_stage_materializer.js",
    materializerSha256:$sha,
    materializerBytes:$bytes,
    localMaterializerRef:$localRef[0],
    materializerProvenanceRef:$provenanceRef[0],
    resultMarker:"BRIK64_BETA17_FIXPOINT_STAGE_RESULT",
    materializerMode:"l6plus_fixpoint_stage_materializer",
    generatedFromPcdPolymer:true,
    fixtureOrTemplate:false,
    supportedCommands:[
      "beta17-fixpoint-stage-materialize",
      "fixpoint-stage-materialize",
      "materialize"
    ],
    nonAcceptableSubstitutes:[
      "beta15.7 or beta16 materializer endpoint",
      "fixture or TEMPLATE_NON_CLAIM stage result",
      "manual artifact patch not regenerated from PCD/polymer through L6+N5"
    ],
    claimBoundary:{
      publicReleaseAllowed:false,
      definitiveFixpointAllowed:false,
      formalN5ClaimAllowed:false,
      universalCorrectnessClaimAllowed:false
    }
  }' >"$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/deploy-plan.json"

node --check scripts/beta17-fixpoint-remote-dispatcher-preflight.js

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-preflight.js" \
  >/tmp/brik64-beta17-dispatcher-preflight-pass.stdout \
  2>/tmp/brik64-beta17-dispatcher-preflight-pass.stderr

jq -e '
  .decision=="PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_PREFLIGHT"
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .required.capability=="beta17_fixpoint_stage_dispatcher"
  and .required.resultMarker=="BRIK64_BETA17_FIXPOINT_STAGE_RESULT"
  and (.required.supportedCommands | index("beta17-fixpoint-stage-materialize"))
  and .plan.materializerRemotePath=="/opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_beta17_fixpoint_stage_materializer.js"
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/preflight-report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/deploy-plan.json" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
data = json.loads(path.read_text())
data["capability"] = "beta16_native_ready"
path.with_name("bad-capability.json").write_text(json.dumps(data, indent=2) + "\n")
data["capability"] = "beta17_fixpoint_stage_dispatcher"
data["materializerRemotePath"] = "/opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_beta16_cli_native_stage1_materialization_capability.js"
path.with_name("bad-legacy.json").write_text(json.dumps(data, indent=2) + "\n")
data["materializerRemotePath"] = "/opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_beta17_fixpoint_stage_materializer.js"
data["fixtureOrTemplate"] = True
path.with_name("bad-fixture.json").write_text(json.dumps(data, indent=2) + "\n")
data["fixtureOrTemplate"] = False
prov_path = path.parent.parent.parent / "artifacts" / "beta17-dispatcher.provenance.json"
prov = json.loads(prov_path.read_text())
prov["materializerRef"]["sha256"] = "2" * 64
bad_prov_path = prov_path.with_name("bad-provenance.json")
bad_prov_path.write_text(json.dumps(prov, indent=2) + "\n")
data["materializerProvenanceRef"] = {
    "path": "artifacts/bad-provenance.json",
    "sha256": __import__("hashlib").sha256(bad_prov_path.read_bytes()).hexdigest(),
    "bytes": bad_prov_path.stat().st_size,
}
path.with_name("bad-provenance-plan.json").write_text(json.dumps(data, indent=2) + "\n")
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-preflight.js" \
  --plan "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-capability.json" \
  --out "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-capability-report.json" \
  >/tmp/brik64-beta17-dispatcher-preflight-bad-cap.stdout \
  2>/tmp/brik64-beta17-dispatcher-preflight-bad-cap.stderr
bad_cap_rc=$?
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-preflight.js" \
  --plan "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-legacy.json" \
  --out "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-legacy-report.json" \
  >/tmp/brik64-beta17-dispatcher-preflight-bad-legacy.stdout \
  2>/tmp/brik64-beta17-dispatcher-preflight-bad-legacy.stderr
bad_legacy_rc=$?
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-preflight.js" \
  --plan "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-fixture.json" \
  --out "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-fixture-report.json" \
  >/tmp/brik64-beta17-dispatcher-preflight-bad-fixture.stdout \
  2>/tmp/brik64-beta17-dispatcher-preflight-bad-fixture.stderr
bad_fixture_rc=$?
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-preflight.js" \
  --plan "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-provenance-plan.json" \
  --out "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-provenance-report.json" \
  >/tmp/brik64-beta17-dispatcher-preflight-bad-provenance.stdout \
  2>/tmp/brik64-beta17-dispatcher-preflight-bad-provenance.stderr
bad_provenance_rc=$?
set -e

if [[ "$bad_cap_rc" -eq 0 || "$bad_legacy_rc" -eq 0 || "$bad_fixture_rc" -eq 0 || "$bad_provenance_rc" -eq 0 ]]; then
  echo "beta17_dispatcher_preflight_adversarial_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_PREFLIGHT"
  and (.blockers | index("deploy_plan_capability_invalid:beta16_native_ready"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-capability-report.json" >/dev/null

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_PREFLIGHT"
  and (.blockers | index("deploy_plan_materializer_remote_path_legacy_family"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-legacy-report.json" >/dev/null

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_PREFLIGHT"
  and (.blockers | index("deploy_plan_fixture_or_template_not_allowed"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-fixture-report.json" >/dev/null

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_PREFLIGHT"
  and (.blockers | index("deploy_plan_materializer_provenance_materializer_sha256_mismatch"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-provenance-report.json" >/dev/null

echo "PASS beta17 fixpoint remote dispatcher preflight"
