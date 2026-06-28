#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

FIXTURE="$TMP_DIR/fixture"
mkdir -p "$FIXTURE/evidence/beta17-fixpoint" "$FIXTURE/release"

cat >"$FIXTURE/package.json" <<'JSON'
{
  "name": "@brik64/cli",
  "version": "0.1.0-beta.17"
}
JSON

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/missing.stdout" 2>"$TMP_DIR/missing.stderr"
missing_rc=$?
set -e

if [[ "$missing_rc" -eq 0 ]]; then
  echo "missing_evidence_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and .claimBoundary.definitiveFixpointAllowed==false
  and .claimBoundary.publicReleaseAllowed==false
  and (.blockers | index("missing_canonical_motor_manifest:evidence/beta17-fixpoint/canonical_motor_manifest.json"))
  and (.blockers | index("missing_stage2_regeneration_manifest:evidence/beta17-fixpoint/stage2_regeneration_manifest.json"))
  and (.blockers | index("missing_remote_promotion_manifest:evidence/beta17-fixpoint/remote_promotion_manifest.json"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

cat >"$FIXTURE/evidence/beta17-fixpoint/canonical_motor_manifest.json" <<'JSON'
{ "pcdBound": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/canonical_harness_manifest.json" <<'JSON'
{ "pcdBound": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/input_pcd_hashes.tsv" <<'EOF_HASHES'
pcd/beta17/motor.pcd	aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
pcd/beta17/harness.pcd	bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
EOF_HASHES
cat >"$FIXTURE/evidence/beta17-fixpoint/stage1_artifact_manifest.json" <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByL6PlusN5": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/stage2_regeneration_manifest.json" <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByStage1": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/byte_identical_report.json" <<'JSON'
{ "decision": "PASS_BYTE_IDENTICAL_REGENERATION", "byteIdentical": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/harness_report.json" <<'JSON'
{ "decision": "PASS_BETA17_FIXPOINT_HARNESS", "adversarialCases": 3 }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/seal_report.json" <<'JSON'
{ "decision": "PASS_BETA17_FIXPOINT_SEAL", "sealed": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/remote_promotion_manifest.json" <<'JSON'
{
  "decision": "PASS_BETA17_FIXPOINT_REMOTE_RESULT_PROMOTION",
  "claimBoundary": {
    "definitiveFixpointAllowed": false,
    "publicReleaseAllowed": false,
    "formalN5ClaimAllowed": false,
    "universalCorrectnessClaimAllowed": false
  },
  "promoted": {
    "stage1ArtifactManifest": {
      "path": "evidence/beta17-fixpoint/stage1_artifact_manifest.json",
      "sha256": "__STAGE1_SHA__"
    },
    "stage2RegenerationManifest": {
      "path": "evidence/beta17-fixpoint/stage2_regeneration_manifest.json",
      "sha256": "__STAGE2_SHA__"
    },
    "byteIdenticalReport": {
      "path": "evidence/beta17-fixpoint/byte_identical_report.json",
      "sha256": "__BYTE_SHA__"
    },
    "harnessReport": {
      "path": "evidence/beta17-fixpoint/harness_report.json",
      "sha256": "__HARNESS_SHA__"
    },
    "sealReport": {
      "path": "evidence/beta17-fixpoint/seal_report.json",
      "sha256": "__SEAL_SHA__"
    }
  }
}
JSON
python3 - "$FIXTURE/evidence/beta17-fixpoint" <<'PY'
import hashlib, pathlib, sys
root = pathlib.Path(sys.argv[1])
manifest = root / "remote_promotion_manifest.json"
text = manifest.read_text()
for token, filename in {
    "__STAGE1_SHA__": "stage1_artifact_manifest.json",
    "__STAGE2_SHA__": "stage2_regeneration_manifest.json",
    "__BYTE_SHA__": "byte_identical_report.json",
    "__HARNESS_SHA__": "harness_report.json",
    "__SEAL_SHA__": "seal_report.json",
}.items():
    digest = hashlib.sha256((root / filename).read_bytes()).hexdigest()
    text = text.replace(token, digest)
manifest.write_text(text)
PY
cat >"$FIXTURE/evidence/beta17-fixpoint/public_surface_sync_report.json" <<'JSON'
{ "decision": "PASS_BETA17_PUBLIC_SURFACE_SYNC", "synced": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/external_audit_report.json" <<'JSON'
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

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"

jq -e '
  .decision=="PASS_BETA17_FIXPOINT_READINESS_GATE"
  and .claimBoundary.definitiveFixpointAllowed==true
  and .claimBoundary.publicReleaseAllowed==true
  and .claimBoundary.formalN5ClaimAllowed==false
  and .checks.byteIdentical==true
  and .checks.harnessHasAdversarial==true
  and .checks.remotePromotionPass==true
  and .checks.remotePromotionClaimsClosed==true
  and (.blockers | length)==0
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint/remote_promotion_manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
data["promoted"]["stage1ArtifactManifest"]["sha256"] = "0" * 64
json.dump(data, open(path, "w"), indent=2)
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/promotion-mismatch.stdout" 2>"$TMP_DIR/promotion-mismatch.stderr"
promotion_mismatch_rc=$?
set -e

if [[ "$promotion_mismatch_rc" -eq 0 ]]; then
  echo "promotion_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("remote_promotion_ref_sha256_mismatch:stage1ArtifactManifest"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
manifest = root / "remote_promotion_manifest.json"
data = json.load(open(manifest))
data["promoted"]["stage1ArtifactManifest"]["sha256"] = hashlib.sha256((root / "stage1_artifact_manifest.json").read_bytes()).hexdigest()
json.dump(data, open(manifest, "w"), indent=2)
PY

cat >"$FIXTURE/evidence/beta17-fixpoint/external_audit_report.json" <<'JSON'
{ "decision": "PASS_BETA17_EXTERNAL_AUDIT", "pass": true }
JSON

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/weak-external-audit.stdout" 2>"$TMP_DIR/weak-external-audit.stderr"
weak_external_audit_rc=$?
set -e

if [[ "$weak_external_audit_rc" -eq 0 ]]; then
  echo "weak_external_audit_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("external_audit_missing_clean_public_install"))
  and (.blockers | index("external_audit_missing_functional_tests"))
  and (.blockers | index("external_audit_missing_generated_code_tests"))
  and (.blockers | index("external_audit_missing_adversarial_tests"))
  and (.blockers | index("external_audit_missing_public_surface_scan"))
  and (.blockers | index("external_audit_missing_claim_safe_scan"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

cat >"$FIXTURE/evidence/beta17-fixpoint/external_audit_report.json" <<'JSON'
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

cat >"$FIXTURE/evidence/beta17-fixpoint/stage1_artifact_manifest.json" <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByL6PlusN5": true, "fixtureMaterializer": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/stage2_regeneration_manifest.json" <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByStage1": true, "fixtureMaterializer": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/byte_identical_report.json" <<'JSON'
{ "decision": "PASS_BYTE_IDENTICAL_REGENERATION", "byteIdentical": true, "fixtureMaterializer": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/harness_report.json" <<'JSON'
{ "decision": "PASS_BETA17_FIXPOINT_HARNESS", "adversarialCases": 3, "fixtureMaterializer": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/seal_report.json" <<'JSON'
{ "decision": "PASS_BETA17_FIXPOINT_SEAL", "sealed": true, "fixtureMaterializer": true }
JSON

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/fixture.stdout" 2>"$TMP_DIR/fixture.stderr"
fixture_rc=$?
set -e

if [[ "$fixture_rc" -eq 0 ]]; then
  echo "fixture_evidence_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("stage1_fixture_materializer_not_claim_bearing"))
  and (.blockers | index("stage2_fixture_materializer_not_claim_bearing"))
  and (.blockers | index("byte_identity_fixture_materializer_not_claim_bearing"))
  and (.blockers | index("harness_fixture_materializer_not_claim_bearing"))
  and (.blockers | index("seal_fixture_materializer_not_claim_bearing"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

cat >"$FIXTURE/evidence/beta17-fixpoint/stage1_artifact_manifest.json" <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByL6PlusN5": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/stage2_regeneration_manifest.json" <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByStage1": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/byte_identical_report.json" <<'JSON'
{ "decision": "PASS_BYTE_IDENTICAL_REGENERATION", "byteIdentical": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/harness_report.json" <<'JSON'
{ "decision": "PASS_BETA17_FIXPOINT_HARNESS", "adversarialCases": 3 }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/seal_report.json" <<'JSON'
{ "decision": "PASS_BETA17_FIXPOINT_SEAL", "sealed": true }
JSON

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  --version 0.1.0-beta.16.1 >"$TMP_DIR/wrong-version.stdout" 2>"$TMP_DIR/wrong-version.stderr"
wrong_version_rc=$?
set -e

if [[ "$wrong_version_rc" -eq 0 ]]; then
  echo "wrong_version_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("beta17_version_context_required:0.1.0-beta.16.1"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

echo "PASS beta17 fixpoint readiness gate"
