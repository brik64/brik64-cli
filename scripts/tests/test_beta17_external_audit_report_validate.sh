#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

mkdir -p "$TMP_DIR/artifacts"
for artifact in audit-log generated-code-quality adversarial-results public-surface-scan claim-safe-scan
do
  echo "beta17 $artifact evidence" >"$TMP_DIR/artifacts/$artifact.json"
done

audit_log_sha="$(shasum -a 256 "$TMP_DIR/artifacts/audit-log.json" | awk '{print $1}')"
generated_code_sha="$(shasum -a 256 "$TMP_DIR/artifacts/generated-code-quality.json" | awk '{print $1}')"
adversarial_sha="$(shasum -a 256 "$TMP_DIR/artifacts/adversarial-results.json" | awk '{print $1}')"
public_surface_sha="$(shasum -a 256 "$TMP_DIR/artifacts/public-surface-scan.json" | awk '{print $1}')"
claim_safe_sha="$(shasum -a 256 "$TMP_DIR/artifacts/claim-safe-scan.json" | awk '{print $1}')"

cat >"$TMP_DIR/pass.json" <<JSON
{
  "decision": "PASS_BETA17_EXTERNAL_AUDIT",
  "cleanPublicInstall": { "pass": true },
  "functionalTests": { "pass": true },
  "generatedCodeTests": { "pass": true },
  "adversarialTests": { "pass": true },
  "publicSurfaceScan": { "pass": true },
  "claimSafeScan": { "pass": true },
  "artifacts": {
    "auditLog": { "path": "artifacts/audit-log.json", "sha256": "$audit_log_sha" },
    "generatedCodeQuality": { "path": "artifacts/generated-code-quality.json", "sha256": "$generated_code_sha" },
    "adversarialResults": { "path": "artifacts/adversarial-results.json", "sha256": "$adversarial_sha" },
    "publicSurfaceScan": { "path": "artifacts/public-surface-scan.json", "sha256": "$public_surface_sha" },
    "claimSafeScan": { "path": "artifacts/claim-safe-scan.json", "sha256": "$claim_safe_sha" }
  }
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
  and .checks.externalAuditArtifact_auditLog==true
  and .checks.externalAuditArtifact_generatedCodeQuality==true
  and .checks.externalAuditArtifact_adversarialResults==true
  and .checks.externalAuditArtifact_publicSurfaceScan==true
  and .checks.externalAuditArtifact_claimSafeScan==true
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
  and (.blockers | index("external_audit_missing_artifact_ref:auditLog"))
  and (.blockers | index("external_audit_missing_artifact_ref:generatedCodeQuality"))
  and (.blockers | index("external_audit_missing_artifact_ref:adversarialResults"))
  and (.blockers | index("external_audit_missing_artifact_ref:publicSurfaceScan"))
  and (.blockers | index("external_audit_missing_artifact_ref:claimSafeScan"))
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

python3 - "$TMP_DIR/pass.json" "$TMP_DIR/bad-hash.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
data["artifacts"]["auditLog"]["sha256"] = "0" * 64
json.dump(data, open(sys.argv[2], "w"), indent=2)
PY

set +e
node "$ROOT/scripts/beta17-external-audit-report-validate.js" "$TMP_DIR/bad-hash.json" \
  >"$TMP_DIR/bad-hash.validation.json"
bad_hash_rc=$?
set -e

if [[ "$bad_hash_rc" -eq 0 ]]; then
  echo "bad_hash_external_audit_validation_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_EXTERNAL_AUDIT_VALIDATION"
  and (.blockers | index("external_audit_artifact_sha256_mismatch:auditLog"))
' "$TMP_DIR/bad-hash.validation.json" >/dev/null

echo "PASS beta17 external audit report validator"
