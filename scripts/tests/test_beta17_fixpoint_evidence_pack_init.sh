#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

FIXTURE="$TMP_DIR/fixture"
mkdir -p "$FIXTURE"

cat >"$FIXTURE/package.json" <<'JSON'
{
  "name": "@brik64/cli",
  "version": "0.1.0-beta.17"
}
JSON

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-evidence-pack-init.js" \
  >"$TMP_DIR/init.stdout" 2>"$TMP_DIR/init.stderr"

grep -q "BETA17_FIXPOINT_EVIDENCE_TEMPLATE_READY" "$TMP_DIR/init.stdout"

for required in \
  canonical_motor_manifest.json \
  canonical_harness_manifest.json \
  input_pcd_hashes.tsv \
  stage1_artifact_manifest.json \
  stage2_regeneration_manifest.json \
  byte_identical_report.json \
  harness_report.json \
  seal_report.json \
  public_surface_sync_report.json \
  external_audit_report.json \
  evidence_pack_manifest.json \
  template_summary.json \
  README.md
do
  test -f "$FIXTURE/evidence/beta17-fixpoint/$required"
done

jq -e '
  .status=="TEMPLATE_NON_CLAIM"
  and .claimBoundary.publicReleaseAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and (.written | length) >= 11
' "$FIXTURE/evidence/beta17-fixpoint/template_summary.json" >/dev/null

jq -e '
  .schemaVersion=="brik64.beta17_fixpoint.evidence_pack_manifest.v1"
  and .version=="0.1.0-beta.17"
  and .claimBoundary.publicReleaseAllowed==false
  and .claimBoundary.formalN5ClaimAllowed==false
  and ([.files[] | select(.path=="evidence/beta17-fixpoint/canonical_motor_manifest.json")] | length)==1
  and ([.files[] | select(.path=="evidence/beta17-fixpoint/external_audit_report.json")] | length)==1
' "$FIXTURE/evidence/beta17-fixpoint/evidence_pack_manifest.json" >/dev/null

jq -e '
  .decision=="TEMPLATE_NON_CLAIM"
  and (.requiredReplacement | contains("docs/ops/BETA17_EXTERNAL_AUDIT_PROMPT.md"))
' "$FIXTURE/evidence/beta17-fixpoint/external_audit_report.json" >/dev/null

jq -e '
  .requiredContract.cleanPublicInstall==false
  and .requiredContract.functionalTests==false
  and .requiredContract.generatedCodeTests==false
  and .requiredContract.adversarialTests==false
  and .requiredContract.publicSurfaceScan==false
  and .requiredContract.claimSafeScan==false
  and .requiredContract.artifactRefs.auditLog==false
  and .requiredContract.artifactRefs.generatedCodeQuality==false
  and .requiredContract.artifactRefs.adversarialResults==false
  and .requiredContract.artifactRefs.publicSurfaceScan==false
  and .requiredContract.artifactRefs.claimSafeScan==false
' "$FIXTURE/evidence/beta17-fixpoint/external_audit_report.json" >/dev/null

grep -q "docs/ops/BETA17_EXTERNAL_AUDIT_PROMPT.md" "$FIXTURE/evidence/beta17-fixpoint/README.md"

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/gate.stdout" 2>"$TMP_DIR/gate.stderr"
gate_rc=$?
set -e

if [[ "$gate_rc" -eq 0 ]]; then
  echo "template_evidence_unexpectedly_passed_gate" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and .claimBoundary.publicReleaseAllowed==false
  and (.blockers | index("canonical_motor_not_pcd_bound"))
  and (.blockers | index("stage1_not_generated_by_l6plus_n5"))
  and (.blockers | index("stage2_not_regenerated_by_stage1"))
  and (.blockers | index("byte_identity_not_proven:TEMPLATE_NON_CLAIM"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-evidence-pack-init.js" \
  >"$TMP_DIR/second.stdout" 2>"$TMP_DIR/second.stderr"
second_rc=$?
set -e

if [[ "$second_rc" -eq 0 ]]; then
  echo "second_init_without_force_unexpectedly_passed" >&2
  exit 1
fi
grep -q "already exists" "$TMP_DIR/second.stderr"

echo "PASS beta17 fixpoint evidence pack init"
