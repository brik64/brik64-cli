#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

write_public_sync() {
  local root="$1"
  local decision="${2:-PASS_BETA17_PUBLIC_SURFACE_SYNC}"
  local synced="${3:-true}"
  mkdir -p "$root/evidence/beta17-fixpoint"
  cat >"$root/evidence/beta17-fixpoint/public_surface_sync_report.json" <<JSON
{
  "schemaVersion": "brik64.beta17_fixpoint.public_surface_sync_report.v1",
  "version": "0.1.0-beta.17",
  "decision": "$decision",
  "synced": $synced,
  "surfaceChecks": [
    { "id": "cli_installer", "version": "0.1.0-beta.17", "pass": true },
    { "id": "cli_manifest", "version": "0.1.0-beta.17", "pass": true },
    { "id": "docs", "version": "0.1.0-beta.17", "pass": true },
    { "id": "web_changelog", "version": "0.1.0-beta.17", "pass": true },
    { "id": "skills", "version": "0.1.0-beta.17", "pass": true }
  ]
}
JSON
}

write_external_audit() {
  local root="$1"
  local decision="${2:-PASS_BETA17_EXTERNAL_AUDIT}"
  local generated_code_pass="${3:-true}"
  mkdir -p "$root/evidence/beta17-fixpoint/audit-artifacts"
  for artifact in auditLog generatedCodeQuality adversarialResults publicSurfaceScan claimSafeScan; do
    printf 'beta17 %s evidence\n' "$artifact" >"$root/evidence/beta17-fixpoint/audit-artifacts/$artifact.md"
  done
  ROOT_FOR_AUDIT="$root" DECISION="$decision" GENERATED_CODE_PASS="$generated_code_pass" python3 <<'PY'
import hashlib, json, os, pathlib
root = pathlib.Path(os.environ["ROOT_FOR_AUDIT"])
artifact_dir = root / "evidence/beta17-fixpoint/audit-artifacts"
def ref(name):
    path = artifact_dir / f"{name}.md"
    data = path.read_bytes()
    return {
        "path": f"evidence/beta17-fixpoint/audit-artifacts/{name}.md",
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
    }
report = {
    "schemaVersion": "brik64.beta17_fixpoint.external_audit_report.v1",
    "version": "0.1.0-beta.17",
    "decision": os.environ["DECISION"],
    "pass": os.environ["DECISION"] == "PASS_BETA17_EXTERNAL_AUDIT",
    "cleanPublicInstall": {"pass": True},
    "functionalTests": {"pass": True},
    "generatedCodeTests": {"pass": os.environ["GENERATED_CODE_PASS"] == "true"},
    "adversarialTests": {"pass": True},
    "publicSurfaceScan": {"pass": True},
    "claimSafeScan": {"pass": True},
    "artifacts": {
        "auditLog": ref("auditLog"),
        "generatedCodeQuality": ref("generatedCodeQuality"),
        "adversarialResults": ref("adversarialResults"),
        "publicSurfaceScan": ref("publicSurfaceScan"),
        "claimSafeScan": ref("claimSafeScan"),
    },
}
(root / "evidence/beta17-fixpoint/external_audit_report.json").write_text(json.dumps(report, indent=2) + "\n")
PY
}

PASS_ROOT="$TMP_DIR/pass"
write_public_sync "$PASS_ROOT"
write_external_audit "$PASS_ROOT"
BRIK64_CLI_ROOT="$PASS_ROOT" node "$ROOT/scripts/beta17-fixpoint-external-audit-status-gate.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"
jq -e '
  .decision=="PASS_BETA17_EXTERNAL_AUDIT_STATUS_GATE"
  and .checks.publicSurfaceSyncPass==true
  and .checks.externalAuditValidationPass==true
  and .claimBoundary.publicReleaseAllowed==true
  and .claimBoundary.definitiveFixpointAllowed==false
  and (.blockers | length)==0
' "$PASS_ROOT/evidence/beta17-fixpoint-external-audit-status/report.json" >/dev/null

# Break attempt 1: external audit cannot pass before public sync.
BLOCKED_SYNC_ROOT="$TMP_DIR/blocked-sync"
write_public_sync "$BLOCKED_SYNC_ROOT" "BLOCKED_BETA17_PUBLIC_SURFACE_SYNC" "false"
write_external_audit "$BLOCKED_SYNC_ROOT"
if BRIK64_CLI_ROOT="$BLOCKED_SYNC_ROOT" node "$ROOT/scripts/beta17-fixpoint-external-audit-status-gate.js" \
  >"$TMP_DIR/blocked-sync.stdout" 2>"$TMP_DIR/blocked-sync.stderr"; then
  echo "blocked public sync unexpectedly passed external audit status" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_EXTERNAL_AUDIT_STATUS_GATE"
  and (.blockers | index("public_surface_sync_not_pass:BLOCKED_BETA17_PUBLIC_SURFACE_SYNC"))
  and (.blockers | index("public_surface_sync_not_synced"))
  and (.blockers | index("external_audit_blocked_until_public_surface_sync_passes"))
  and .claimBoundary.publicReleaseAllowed==false
' "$BLOCKED_SYNC_ROOT/evidence/beta17-fixpoint-external-audit-status/report.json" >/dev/null

# Break attempt 2: incomplete generated-code audit fails closed.
INCOMPLETE_AUDIT_ROOT="$TMP_DIR/incomplete-audit"
write_public_sync "$INCOMPLETE_AUDIT_ROOT"
write_external_audit "$INCOMPLETE_AUDIT_ROOT" "PASS_BETA17_EXTERNAL_AUDIT" "false"
if BRIK64_CLI_ROOT="$INCOMPLETE_AUDIT_ROOT" node "$ROOT/scripts/beta17-fixpoint-external-audit-status-gate.js" \
  >"$TMP_DIR/incomplete.stdout" 2>"$TMP_DIR/incomplete.stderr"; then
  echo "incomplete external audit unexpectedly passed status gate" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_EXTERNAL_AUDIT_STATUS_GATE"
  and (.blockers | index("external_audit_missing_generated_code_tests"))
  and .checks.externalAuditGeneratedCodeTests==false
' "$INCOMPLETE_AUDIT_ROOT/evidence/beta17-fixpoint-external-audit-status/report.json" >/dev/null

# Break attempt 3: missing external audit report fails closed.
MISSING_AUDIT_ROOT="$TMP_DIR/missing-audit"
write_public_sync "$MISSING_AUDIT_ROOT"
if BRIK64_CLI_ROOT="$MISSING_AUDIT_ROOT" node "$ROOT/scripts/beta17-fixpoint-external-audit-status-gate.js" \
  >"$TMP_DIR/missing.stdout" 2>"$TMP_DIR/missing.stderr"; then
  echo "missing external audit unexpectedly passed status gate" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_EXTERNAL_AUDIT_STATUS_GATE"
  and (.blockers | index("missing_external_audit_report:evidence/beta17-fixpoint/external_audit_report.json"))
' "$MISSING_AUDIT_ROOT/evidence/beta17-fixpoint-external-audit-status/report.json" >/dev/null

echo "PASS beta17 external audit status gate"
