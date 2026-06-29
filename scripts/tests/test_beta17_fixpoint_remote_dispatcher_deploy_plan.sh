#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FIXTURE="$TMP_DIR/workspace"
mkdir -p "$FIXTURE/generated" "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher"
cat >"$FIXTURE/generated/beta17-materializer.js" <<'JS'
#!/usr/bin/env node
console.log("BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t<base64-json>");
JS

node --check scripts/beta17-fixpoint-remote-dispatcher-deploy-plan.js

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-deploy-plan.js" \
  --materializer generated/beta17-materializer.js \
  >/tmp/brik64-beta17-dispatcher-plan.stdout \
  2>/tmp/brik64-beta17-dispatcher-plan.stderr

jq -e '
  .decision=="PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_DEPLOY_PLAN"
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .plan.outputPath=="evidence/beta17-fixpoint-remote-dispatcher/deploy-plan.json"
  and .plan.capability=="beta17_fixpoint_stage_dispatcher"
  and .plan.materializerRef.path=="generated/beta17-materializer.js"
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/deploy-plan-report.json" >/dev/null

jq -e '
  .schemaVersion=="brik64.beta17_fixpoint.remote_dispatcher_deploy_plan.v1"
  and .status=="DEPLOY_PLAN_NON_CLAIM"
  and .capability=="beta17_fixpoint_stage_dispatcher"
  and .generatedFromPcdPolymer==true
  and .fixtureOrTemplate==false
  and .claimBoundary.publicReleaseAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .localMaterializerRef.path=="generated/beta17-materializer.js"
  and (.supportedCommands | index("beta17-fixpoint-stage-materialize"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/deploy-plan.json" >/dev/null

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-preflight.js" \
  >/tmp/brik64-beta17-dispatcher-plan-preflight.stdout \
  2>/tmp/brik64-beta17-dispatcher-plan-preflight.stderr

jq -e '
  .decision=="PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_PREFLIGHT"
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/preflight-report.json" >/dev/null

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-deploy-plan.js" \
  --materializer generated/missing.js \
  --report "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/missing-report.json" \
  >/tmp/brik64-beta17-dispatcher-plan-missing.stdout \
  2>/tmp/brik64-beta17-dispatcher-plan-missing.stderr
missing_rc=$?
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-deploy-plan.js" \
  --materializer ../outside.js \
  --report "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/outside-report.json" \
  >/tmp/brik64-beta17-dispatcher-plan-outside.stdout \
  2>/tmp/brik64-beta17-dispatcher-plan-outside.stderr
outside_rc=$?
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-deploy-plan.js" \
  --materializer generated/beta17-materializer.js \
  --remote-path /opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_beta16_cli_native_stage1_materialization_capability.js \
  --report "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/legacy-report.json" \
  --check-only \
  >/tmp/brik64-beta17-dispatcher-plan-legacy.stdout \
  2>/tmp/brik64-beta17-dispatcher-plan-legacy.stderr
legacy_rc=$?
set -e

if [[ "$missing_rc" -eq 0 || "$outside_rc" -eq 0 || "$legacy_rc" -eq 0 ]]; then
  echo "beta17_dispatcher_deploy_plan_adversarial_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_DEPLOY_PLAN"
  and (.blockers | index("materializer_file_missing:generated/missing.js"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/missing-report.json" >/dev/null

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_DEPLOY_PLAN"
  and (.blockers | index("materializer_path_outside_workspace:../outside.js"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/outside-report.json" >/dev/null

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_DEPLOY_PLAN"
  and (.blockers | index("deploy_plan_materializer_remote_path_legacy_family"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/legacy-report.json" >/dev/null

echo "PASS beta17 fixpoint remote dispatcher deploy plan"
