#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FIXTURE="$TMP_DIR/workspace"
mkdir -p \
  "$FIXTURE/generated" \
  "$FIXTURE/pcd/beta17/release" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-attempt" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-promotion" \
  "$FIXTURE/evidence/beta17-fixpoint"

printf '%s\n' '// brik64.pcd_file.v1' 'PC stage_one { fn run() -> i64 { return 1; } }' \
  >"$FIXTURE/pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd"
printf '%s\n' '// brik64.pcd_file.v1' 'PC stage_two { fn run() -> i64 { return 1; } }' \
  >"$FIXTURE/pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd"
printf '%s\n' '// brik64.pcd_file.v1' 'PC cli_core { fn run() -> i64 { return 1; } }' \
  >"$FIXTURE/pcd/cli_core.pcd"
printf '%s\n' '// brik64.pcd_file.v1' 'PC cli_polymer { fn run() -> i64 { return 1; } }' \
  >"$FIXTURE/pcd/cli_polymer.pcd"

cat >"$FIXTURE/generated/beta17-materializer.js" <<'JS'
#!/usr/bin/env node
console.log("BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t" + Buffer.from(JSON.stringify({ decision: "NON_CLAIM_TEST_VECTOR" })).toString("base64"));
JS

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-materializer-provenance.js" \
  --materializer generated/beta17-materializer.js \
  --pcd pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd \
  --pcd pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd \
  --pcd pcd/cli_core.pcd \
  --pcd pcd/cli_polymer.pcd \
  --l6-serial BRIK64-L6PLUS-N5-TEST-SERIAL \
  --out "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/materializer-provenance.json" \
  >/tmp/brik64-beta17-required-inputs-provenance.stdout \
  2>/tmp/brik64-beta17-required-inputs-provenance.stderr

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-deploy-plan.js" \
  --materializer generated/beta17-materializer.js \
  --provenance evidence/beta17-fixpoint-remote-dispatcher/materializer-provenance.json \
  >/tmp/brik64-beta17-required-inputs-plan.stdout \
  2>/tmp/brik64-beta17-required-inputs-plan.stderr

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-install.js" \
  --host root@example.invalid \
  >/tmp/brik64-beta17-required-inputs-install.stdout \
  2>/tmp/brik64-beta17-required-inputs-install.stderr

cat >"$FIXTURE/evidence/beta17-fixpoint-remote-attempt/report.json" <<'JSON'
{
  "schemaVersion": "brik64.beta17_fixpoint.remote_attempt.v1",
  "version": "0.1.0-beta.17",
  "decision": "BLOCKED_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT",
  "claimBoundary": {
    "publicReleaseAllowed": false,
    "definitiveFixpointAllowed": false,
    "formalN5ClaimAllowed": false,
    "universalCorrectnessClaimAllowed": false
  },
  "attempts": [],
  "installEvidence": null
}
JSON

node --check scripts/beta17-fixpoint-required-inputs-gate.js

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-required-inputs-gate.js" \
  --materializer generated/beta17-materializer.js \
  >/tmp/brik64-beta17-required-inputs.stdout \
  2>/tmp/brik64-beta17-required-inputs.stderr
required_rc=$?
set -e

if [[ "$required_rc" -eq 0 ]]; then
  echo "beta17_required_inputs_unexpected_pass_without_stage_promotion" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REQUIRED_INPUTS"
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .canonicalPcds.presentCount==4
  and (.evidence[] | select(.id=="generated_materializer") | .ref.exists)==true
  and (.blockers | index("dispatcher_install_report_not_executed_pass:PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL_DRY_RUN"))
  and (.blockers | index("dispatcher_install_report_not_executed"))
  and (.blockers | index("remote_stage_attempt_not_pass:BLOCKED_BETA17_FIXPOINT_REMOTE_STAGE_ATTEMPT"))
  and (.blockers | index("remote_stage_attempt_accepted_attempt_count_invalid"))
  and (.blockers | index("remote_stage_attempt_install_evidence_missing"))
  and (.blockers | index("remote_promotion_report_missing:evidence/beta17-fixpoint-remote-promotion/report.json"))
  and (.blockers | index("remote_promotion_manifest_missing:evidence/beta17-fixpoint/remote_promotion_manifest.json"))
' "$FIXTURE/evidence/beta17-fixpoint-required-inputs/report.json" >/dev/null

cat >"$FIXTURE/generated/placeholder-materializer.js" <<'JS'
#!/usr/bin/env node
console.log("BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t<base64-json>");
JS

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-required-inputs-gate.js" \
  --materializer generated/placeholder-materializer.js \
  --out "$FIXTURE/evidence/beta17-fixpoint-required-inputs/placeholder-report.json" \
  >/tmp/brik64-beta17-required-inputs-placeholder.stdout \
  2>/tmp/brik64-beta17-required-inputs-placeholder.stderr
placeholder_rc=$?
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-required-inputs-gate.js" \
  --materializer ../outside.js \
  --out "$FIXTURE/evidence/beta17-fixpoint-required-inputs/outside-report.json" \
  >/tmp/brik64-beta17-required-inputs-outside.stdout \
  2>/tmp/brik64-beta17-required-inputs-outside.stderr
outside_rc=$?
set -e

if [[ "$placeholder_rc" -eq 0 || "$outside_rc" -eq 0 ]]; then
  echo "beta17_required_inputs_adversarial_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REQUIRED_INPUTS"
  and (.blockers | index("generated_materializer_contains_placeholder_result"))
' "$FIXTURE/evidence/beta17-fixpoint-required-inputs/placeholder-report.json" >/dev/null

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REQUIRED_INPUTS"
  and (.blockers | index("generated_materializer_path_invalid:../outside.js"))
' "$FIXTURE/evidence/beta17-fixpoint-required-inputs/outside-report.json" >/dev/null

echo "PASS beta17 fixpoint required inputs gate"
