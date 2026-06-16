#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

FIXTURE="$TMP_DIR/fixture"
mkdir -p "$FIXTURE/evidence/beta15_4-l6-generation" "$FIXTURE/release"

cat >"$FIXTURE/package.json" <<'JSON'
{
  "name": "@brik64/cli",
  "version": "0.1.0-beta.15.4"
}
JSON

cat >"$FIXTURE/release/manifest.json" <<'JSON'
{
  "schemaVersion": "brik64.release_manifest.v1",
  "version": "0.1.0-beta.15.2"
}
JSON

cat >"$FIXTURE/evidence/beta15_4-l6-generation/gate-report.json" <<'JSON'
{
  "version": "0.1.0-beta.15.4",
  "decision": "PASS_BETA15_4_L6_GENERATION_GATE",
  "publicationAllowed": true,
  "releasePublicationAllowed": true,
  "blockers": [],
  "claimBoundary": {
    "formalN5ClaimAllowed": false,
    "fixpointClaimAllowed": false,
    "selfHostingClaimAllowed": false,
    "rustIndependenceClaimAllowed": false
  }
}
JSON

cat >"$FIXTURE/evidence/beta15_4-l6-generation/generated_artifact_manifest.json" <<'JSON'
{
  "version": "0.1.0-beta.15.4",
  "pcdToArtifactHashBound": true
}
JSON

cat >"$FIXTURE/evidence/beta15_4-l6-generation/package.manifest.json" <<'JSON'
{
  "version": "0.1.0-beta.15.4",
  "artifactToPackageHashBound": true,
  "packageToReleaseManifestHashBound": true
}
JSON

for file in l6plus_engine_manifest.json input_pcd_hashes.tsv seal_report.json hashes.json; do
  printf 'fixture %s\n' "$file" >"$FIXTURE/evidence/beta15_4-l6-generation/$file"
done

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/cli-l6-generation-required-gate.js" \
  >"$TMP_DIR/stale.stdout" 2>"$TMP_DIR/stale.stderr"
stale_rc=$?
set -e

if [[ "$stale_rc" -eq 0 ]]; then
  echo "stale_release_manifest_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_CLI_L6_GENERATION_REQUIRED_GATE"
  and (.blockers | index("release_manifest_version_context_mismatch:0.1.0-beta.15.2:0.1.0-beta.15.4"))
  and .checks.releaseManifestVersionContext==false
' "$FIXTURE/evidence/cli-l6-generation-required/report.json" >/dev/null

python3 - "$FIXTURE/release/manifest.json" <<'PY'
import json
import sys
path = sys.argv[1]
data = json.load(open(path))
data["version"] = "0.1.0-beta.15.4"
json.dump(data, open(path, "w"), indent=2)
PY

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/cli-l6-generation-required-gate.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"

jq -e '
  .decision=="PASS_CLI_L6_GENERATION_REQUIRED_GATE"
  and .checks.releaseManifestVersionContext==true
  and (.blockers | length)==0
' "$FIXTURE/evidence/cli-l6-generation-required/report.json" >/dev/null

echo "PASS cli L6 generation required release manifest drift gate"
