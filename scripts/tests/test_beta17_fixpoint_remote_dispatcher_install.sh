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

node --check scripts/beta17-fixpoint-remote-dispatcher-install.js

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-deploy-plan.js" \
  --materializer generated/beta17-materializer.js \
  >/tmp/brik64-beta17-install-plan.stdout \
  2>/tmp/brik64-beta17-install-plan.stderr

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-install.js" \
  --host root@example.invalid \
  >/tmp/brik64-beta17-install-dry-run.stdout \
  2>/tmp/brik64-beta17-install-dry-run.stderr

jq -e '
  .decision=="PASS_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL_DRY_RUN"
  and .executed==false
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .plan.capability=="beta17_fixpoint_stage_dispatcher"
  and .installScript.path=="evidence/beta17-fixpoint-remote-dispatcher/install-script.sh"
  and .installScript.requiredResultMarker=="BRIK64_BETA17_FIXPOINT_STAGE_RESULT"
  and (.nextAction | contains("--execute --confirm INSTALL_BETA17_FIXPOINT_DISPATCHER_NON_CLAIM"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-report.json" >/dev/null

grep -q "BRIK64_BETA17_FIXPOINT_STAGE_ENDPOINT" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-script.sh"
grep -q "BRIK64_BETA17_DISPATCHER_INSTALL_RESULT" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-script.sh"
grep -q "beta17-fixpoint-stage-materialize" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-script.sh"
if grep -q "beta16_native_ready" "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/install-script.sh"; then
  echo "install_script_must_not_reference_beta16_endpoint" >&2
  exit 1
fi

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-install.js" \
  --host root@example.invalid \
  --execute \
  --out-dir "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/no-confirm" \
  >/tmp/brik64-beta17-install-no-confirm.stdout \
  2>/tmp/brik64-beta17-install-no-confirm.stderr
no_confirm_rc=$?
set -e

if [[ "$no_confirm_rc" -eq 0 ]]; then
  echo "install_execute_without_confirmation_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL"
  and .executed==false
  and (.blockers | index("install_execute_confirmation_missing"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/no-confirm/install-report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/deploy-plan.json" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
data = json.loads(path.read_text())
data["capability"] = "beta16_native_ready"
path.with_name("bad-deploy-plan.json").write_text(json.dumps(data, indent=2) + "\n")
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-install.js" \
  --plan "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-deploy-plan.json" \
  --out-dir "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-plan" \
  >/tmp/brik64-beta17-install-bad-plan.stdout \
  2>/tmp/brik64-beta17-install-bad-plan.stderr
bad_plan_rc=$?
set -e

if [[ "$bad_plan_rc" -eq 0 ]]; then
  echo "install_bad_plan_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL"
  and (.blockers | index("deploy_plan_capability_invalid:beta16_native_ready"))
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-plan/install-report.json" >/dev/null

printf '%s\n' 'tampered after deploy-plan generation' >>"$FIXTURE/generated/beta17-materializer.js"

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-install.js" \
  --out-dir "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/tampered" \
  >/tmp/brik64-beta17-install-tampered.stdout \
  2>/tmp/brik64-beta17-install-tampered.stderr
tampered_rc=$?
set -e

if [[ "$tampered_rc" -eq 0 ]]; then
  echo "install_tampered_materializer_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_REMOTE_DISPATCHER_INSTALL"
  and (
    (.blockers | index("deploy_plan_local_materializer_ref_file_sha256_mismatch:generated/beta17-materializer.js"))
    or (.blockers | index("install_local_materializer_sha256_mismatch"))
  )
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/tampered/install-report.json" >/dev/null

echo "PASS beta17 fixpoint remote dispatcher install"
