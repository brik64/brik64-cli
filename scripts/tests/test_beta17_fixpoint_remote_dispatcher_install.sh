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
console.log("BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t" + Buffer.from(JSON.stringify({ decision: "NON_CLAIM_TEST_VECTOR" })).toString("base64"));
JS
materializer_sha="$(shasum -a 256 "$FIXTURE/generated/beta17-materializer.js" | awk '{print $1}')"
materializer_bytes="$(wc -c <"$FIXTURE/generated/beta17-materializer.js" | tr -d ' ')"
mkdir -p "$FIXTURE/pcd"
printf '%s\n' '// brik64.pcd_file.v1' 'PC stage_one { fn run() -> i64 { return 1; } }' >"$FIXTURE/pcd/stage1.pcd"
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-materializer-provenance.js" \
  --materializer generated/beta17-materializer.js \
  --pcd pcd/stage1.pcd \
  --l6-serial BRIK64-L6PLUS-N5-TEST-SERIAL \
  --out "$FIXTURE/generated/beta17-materializer.provenance.json" \
  >/tmp/brik64-beta17-install-provenance.stdout \
  2>/tmp/brik64-beta17-install-provenance.stderr

node --check scripts/beta17-fixpoint-remote-dispatcher-install.js

node <<'NODE'
const {
  installResultMarker,
  parseInstallResult,
  validateInstallExecution,
} = require('./scripts/beta17-fixpoint-remote-dispatcher-install');
const plan = { materializerSha256: 'a'.repeat(64) };
const host = 'root@example.invalid';
const pass = validateInstallExecution(plan, {
  scpResult: { status: 0 },
  sshResult: {
    status: 0,
    stdout: `${installResultMarker}\tinstalled\t${plan.materializerSha256}\t${host}\n`,
    stderr: '',
  },
}, host);
if (pass.blockers.length !== 0 || pass.installResult.sha256 !== plan.materializerSha256) {
  throw new Error('valid_install_result_unexpected_blocker');
}
const parsed = parseInstallResult(`${installResultMarker}\tinstalled\t${plan.materializerSha256}\t${host}\n`);
if (!parsed || parsed.status !== 'installed' || parsed.host !== host) {
  throw new Error('install_result_parse_failed');
}
const missing = validateInstallExecution(plan, {
  scpResult: { status: 0 },
  sshResult: { status: 0, stdout: 'ok without marker\n', stderr: '' },
}, host);
if (!missing.blockers.includes('install_result_marker_missing')) {
  throw new Error('missing_install_marker_unexpected_pass');
}
const mismatch = validateInstallExecution(plan, {
  scpResult: { status: 0 },
  sshResult: {
    status: 0,
    stdout: `${installResultMarker}\tinstalled\t${'b'.repeat(64)}\t${host}\n`,
    stderr: '',
  },
}, host);
if (!mismatch.blockers.includes('install_result_materializer_sha256_mismatch')) {
  throw new Error('install_sha_mismatch_unexpected_pass');
}
NODE

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-remote-dispatcher-deploy-plan.js" \
  --materializer generated/beta17-materializer.js \
  --provenance generated/beta17-materializer.provenance.json \
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
