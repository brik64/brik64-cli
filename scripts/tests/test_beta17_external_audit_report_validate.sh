#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

cat >"$TMP_DIR/pass.json" <<'JSON'
{
  "decision": "PASS_BETA17_EXTERNAL_AUDIT",
  "cleanPublicInstall": { "pass": true },
  "functionalTests": { "pass": true },
  "generatedCodeTests": { "pass": true },
  "adversarialTests": { "pass": true },
  "publicSurfaceScan": { "pass": true },
  "claimSafeScan": { "pass": true }
}
JSON

node "$ROOT/scripts/beta17-external-audit-report-validate.js" "$TMP_DIR/pass.json" \
  >"$TMP_DIR/pass.validation.json"

jq -e '
  .decision=="PASS_BETA17_EXTERNAL_AUDIT_VALIDATION"
  and .checks.externalAuditPass==true
  and .checks.externalAuditCleanPublicInstall==true
  and .checks.externalAuditFunctionalTests==true
  and .checks.externalAuditGeneratedCodeTests==true
  and .checks.externalAuditAdversarialTests==true
  and .checks.externalAuditPublicSurfaceScan==true
  and .checks.externalAuditClaimSafeScan==true
  and (.blockers | length)==0
' "$TMP_DIR/pass.validation.json" >/dev/null

cat >"$TMP_DIR/weak.json" <<'JSON'
{ "decision": "PASS_BETA17_EXTERNAL_AUDIT", "pass": true }
JSON

set +e
node "$ROOT/scripts/beta17-external-audit-report-validate.js" "$TMP_DIR/weak.json" \
  >"$TMP_DIR/weak.validation.json"
weak_rc=$?
set -e

if [[ "$weak_rc" -eq 0 ]]; then
  echo "weak_external_audit_validation_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_EXTERNAL_AUDIT_VALIDATION"
  and (.blockers | index("external_audit_missing_clean_public_install"))
  and (.blockers | index("external_audit_missing_functional_tests"))
  and (.blockers | index("external_audit_missing_generated_code_tests"))
  and (.blockers | index("external_audit_missing_adversarial_tests"))
  and (.blockers | index("external_audit_missing_public_surface_scan"))
  and (.blockers | index("external_audit_missing_claim_safe_scan"))
' "$TMP_DIR/weak.validation.json" >/dev/null

cat >"$TMP_DIR/partial.json" <<'JSON'
{
  "decision": "FAIL_BETA17_EXTERNAL_AUDIT",
  "cleanPublicInstall": { "pass": true },
  "functionalTests": { "pass": true },
  "generatedCodeTests": { "pass": false },
  "adversarialTests": { "pass": true },
  "publicSurfaceScan": { "pass": true },
  "claimSafeScan": { "pass": true }
}
JSON

set +e
node "$ROOT/scripts/beta17-external-audit-report-validate.js" "$TMP_DIR/partial.json" \
  >"$TMP_DIR/partial.validation.json"
partial_rc=$?
set -e

if [[ "$partial_rc" -eq 0 ]]; then
  echo "partial_external_audit_validation_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_EXTERNAL_AUDIT_VALIDATION"
  and (.blockers | index("external_audit_not_pass:FAIL_BETA17_EXTERNAL_AUDIT"))
  and (.blockers | index("external_audit_missing_generated_code_tests"))
' "$TMP_DIR/partial.validation.json" >/dev/null

echo "PASS beta17 external audit report validator"
