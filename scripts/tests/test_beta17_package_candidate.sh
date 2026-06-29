#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

write_fixture() {
  local dir="$1"
  mkdir -p "$dir/evidence/beta17-fixpoint/generated/stage1" \
    "$dir/evidence/beta17-fixpoint/generated/stage2" \
    "$dir/evidence/beta17-fixpoint-readiness"
  cat >"$dir/package.json" <<'JSON'
{ "name": "@brik64/cli", "version": "0.1.0-beta.16.1" }
JSON
  cat >"$dir/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs" <<'JS'
// candidate stage artifact
export const brik64Beta17StageArtifact = {
  version: "0.1.0-beta.17",
  generatedByL6PlusN5: true
};
JS
  cp "$dir/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs" \
    "$dir/evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs"
  local stage_sha
  stage_sha="$(sha256_file "$dir/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs")"
  local stage_bytes
  stage_bytes="$(wc -c <"$dir/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs" | tr -d ' ')"

  cat >"$dir/evidence/beta17-fixpoint/stage1_artifact_manifest.json" <<JSON
{
  "schemaVersion": "brik64.beta17_fixpoint.stage1_artifact_manifest.v1",
  "version": "0.1.0-beta.17",
  "generatedByL6PlusN5": true,
  "artifact": {
    "path": "evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs",
    "sha256": "$stage_sha",
    "bytes": $stage_bytes
  }
}
JSON
  cat >"$dir/evidence/beta17-fixpoint/stage2_regeneration_manifest.json" <<JSON
{ "schemaVersion": "brik64.beta17_fixpoint.stage2_regeneration_manifest.v1", "version": "0.1.0-beta.17" }
JSON
  cat >"$dir/evidence/beta17-fixpoint/byte_identical_report.json" <<JSON
{ "schemaVersion": "brik64.beta17_fixpoint.byte_identical_report.v1", "decision": "PASS_BETA17_FIXPOINT_BYTE_IDENTICAL" }
JSON
  cat >"$dir/evidence/beta17-fixpoint/seal_report.json" <<JSON
{ "schemaVersion": "brik64.beta17_fixpoint.seal_report.v1", "decision": "PASS_BETA17_FIXPOINT_SEAL" }
JSON
  cat >"$dir/evidence/beta17-fixpoint/evidence_pack_manifest.json" <<JSON
{ "schemaVersion": "brik64.beta17_fixpoint.evidence_pack_manifest.v1", "decision": "PASS_FIXTURE" }
JSON
  cat >"$dir/evidence/beta17-fixpoint-readiness/report.json" <<JSON
{
  "schemaVersion": "brik64.beta17_fixpoint_readiness_gate.v1",
  "version": "0.1.0-beta.17",
  "decision": "BLOCKED_BETA17_FIXPOINT_READINESS_GATE",
  "blockers": ["public_surface_sync_not_pass:BLOCKED_BETA17_PUBLIC_SURFACE_SYNC"]
}
JSON
  mkdir -p "$dir/evidence/beta17-fixpoint-functional-stage-artifact"
  cat >"$dir/evidence/beta17-fixpoint-functional-stage-artifact/report.json" <<JSON
{
  "schemaVersion": "brik64.beta17_fixpoint.functional_stage_artifact_gate.v1",
  "version": "0.1.0-beta.17",
  "decision": "BLOCKED_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE",
  "releaseEligibleStageArtifact": false,
  "blockers": ["stage1_artifact_too_small:$stage_bytes:50000"]
}
JSON
}

PASS_ROOT="$TMP_DIR/pass"
write_fixture "$PASS_ROOT"
BRIK64_CLI_ROOT="$PASS_ROOT" node "$ROOT/scripts/build-beta17-package-candidate.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"
jq -e '
  .decision=="PASS_BRIK64_CLI_BETA17_PACKAGE_CANDIDATE_BUILT"
  and .version=="0.1.0-beta.17"
  and .releaseEligible==false
  and .publicationAllowed==false
  and .stageArtifact.functionalCliArtifact==false
  and (.blockers | index("functional_stage_artifact_not_pass:BLOCKED_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE"))
  and any(.blockers[]; startswith("functional_stage_artifact:stage1_artifact_too_small:"))
  and (.blockers | index("readiness_not_pass:BLOCKED_BETA17_FIXPOINT_READINESS_GATE"))
  and .claimBoundary.fixpointClaimAllowed==false
' "$PASS_ROOT/evidence/beta17-package/package.manifest.json" >/dev/null
jq -e '
  .version=="0.1.0-beta.17"
  and .state=="candidate"
  and .claimBoundary.fixpointClaimAllowed==false
' "$PASS_ROOT/evidence/beta17-package/release.manifest.candidate.json" >/dev/null
test -f "$PASS_ROOT/evidence/beta17-package/brik64-cli-0.1.0-beta.17.tgz"

# Break attempt 1: missing Stage1 manifest fails closed.
MISSING_ROOT="$TMP_DIR/missing"
write_fixture "$MISSING_ROOT"
rm "$MISSING_ROOT/evidence/beta17-fixpoint/stage1_artifact_manifest.json"
if BRIK64_CLI_ROOT="$MISSING_ROOT" node "$ROOT/scripts/build-beta17-package-candidate.js" \
  >"$TMP_DIR/missing.stdout" 2>"$TMP_DIR/missing.stderr"; then
  echo "missing Stage1 manifest unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="FAIL_BRIK64_CLI_BETA17_PACKAGE_CANDIDATE_BUILT"
  and (.failures | index("missing_stage1_artifact_manifest"))
' "$MISSING_ROOT/evidence/beta17-package/package.manifest.json" >/dev/null

# Break attempt 2: Stage1 artifact SHA drift fails closed.
SHA_ROOT="$TMP_DIR/sha"
write_fixture "$SHA_ROOT"
printf "tampered\n" >>"$SHA_ROOT/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs"
if BRIK64_CLI_ROOT="$SHA_ROOT" node "$ROOT/scripts/build-beta17-package-candidate.js" \
  >"$TMP_DIR/sha.stdout" 2>"$TMP_DIR/sha.stderr"; then
  echo "Stage1 SHA drift unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="FAIL_BRIK64_CLI_BETA17_PACKAGE_CANDIDATE_BUILT"
  and (.failures | index("stage1_artifact_sha256_mismatch"))
' "$SHA_ROOT/evidence/beta17-package/package.manifest.json" >/dev/null

# Break attempt 3: candidate manifest remains blocked by publication preflight.
if BRIK64_CLI_ROOT="$PASS_ROOT" node "$ROOT/scripts/beta17-fixpoint-publication-preflight.js" \
  --manifest "$PASS_ROOT/evidence/beta17-package/release.manifest.candidate.json" \
  >"$TMP_DIR/preflight.stdout" 2>"$TMP_DIR/preflight.stderr"; then
  echo "candidate package unexpectedly passed publication preflight" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_PUBLICATION_PREFLIGHT"
  and (.blockers | index("package_manifest_release_eligible_false"))
  and (.blockers | index("package_manifest_publication_allowed_false"))
' "$PASS_ROOT/evidence/beta17-fixpoint-publication-preflight/report.json" >/dev/null

echo "PASS beta17 package candidate tests"
