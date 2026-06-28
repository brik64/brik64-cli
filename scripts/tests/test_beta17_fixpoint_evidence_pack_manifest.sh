#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

FIXTURE="$TMP_DIR/fixture"
mkdir -p "$FIXTURE/evidence/beta17-fixpoint/generated/stage1"
cat >"$FIXTURE/package.json" <<'JSON'
{
  "name": "@brik64/cli",
  "version": "0.1.0-beta.17"
}
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/stage1_artifact_manifest.json" <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByL6PlusN5": true }
JSON
printf 'stage1 artifact\n' >"$FIXTURE/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs"

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-evidence-pack-manifest.js" \
  --status TEST_NON_CLAIM >"$TMP_DIR/manifest.stdout" 2>"$TMP_DIR/manifest.stderr"

grep -q "BETA17_EVIDENCE_PACK_MANIFEST_READY" "$TMP_DIR/manifest.stdout"

jq -e '
  .schemaVersion=="brik64.beta17_fixpoint.evidence_pack_manifest.v1"
  and .version=="0.1.0-beta.17"
  and .status=="TEST_NON_CLAIM"
  and .claimBoundary.publicReleaseAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .claimBoundary.formalN5ClaimAllowed==false
  and ([.files[] | select(.path=="evidence/beta17-fixpoint/stage1_artifact_manifest.json")] | length)==1
  and ([.files[] | select(.path=="evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs")] | length)==1
' "$FIXTURE/evidence/beta17-fixpoint/evidence_pack_manifest.json" >/dev/null

stage1_sha="$(shasum -a 256 "$FIXTURE/evidence/beta17-fixpoint/stage1_artifact_manifest.json" | awk '{print $1}')"
jq -e --arg sha "$stage1_sha" '
  ([.files[] | select(.path=="evidence/beta17-fixpoint/stage1_artifact_manifest.json") | .sha256] | first)==$sha
' "$FIXTURE/evidence/beta17-fixpoint/evidence_pack_manifest.json" >/dev/null

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-evidence-pack-manifest.js" \
  --status TEST_NON_CLAIM >/dev/null

jq -e '
  ([.files[] | select(.path=="evidence/beta17-fixpoint/evidence_pack_manifest.json")] | length)==0
' "$FIXTURE/evidence/beta17-fixpoint/evidence_pack_manifest.json" >/dev/null

echo "PASS beta17 evidence pack manifest generator"
