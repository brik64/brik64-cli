#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

mkbase() {
  local base="$1"
  mkdir -p "$base/pcd/beta15" "$base/pcd" "$base/release"
  cat >"$base/package.json" <<'JSON'
{ "version": "0.1.0-beta.15.7" }
JSON
  cat >"$base/pcd/beta15/l6plus_materialization_command.contract.json" <<'JSON'
{ "schema": "brik64.beta15_cli_l6plus_materialization_command_contract.v1" }
JSON
  cat >"$base/pcd/beta15/manifest.json" <<'JSON'
{ "schema": "brik64.cli_beta_fixpoint_source_manifest.v1", "version": "0.1.0-beta.15.7" }
JSON
  cat >"$base/pcd/beta15/cli_polymer.pcd" <<'PCD'
// brik64.pcd_file.v1
PC beta15_7_cli_polymer {
  fn run(x: i64) -> i64 { return x; }
}
PCD
  cat >"$base/pcd/cli_core.pcd" <<'PCD'
// brik64.pcd_file.v1
PC cli_core {
  fn run(x: i64) -> i64 { return x; }
}
PCD
  cat >"$base/pcd/cli_polymer.pcd" <<'PCD'
// brik64.pcd_file.v1
PC cli_polymer {
  fn run(x: i64) -> i64 { return x; }
}
PCD
  cat >"$base/release/manifest.json" <<'JSON'
{ "version": "0.1.0-beta.15.6" }
JSON
}

MISMATCH="$TMP_DIR/mismatch"
mkbase "$MISMATCH"
if BRIK64_CLI_ROOT="$MISMATCH" BRIK64_L6_SKIP_REMOTE=1 node "$ROOT/scripts/beta15_7-l6-generation-attempt.js" >/tmp/beta15_7_l6_mismatch.out 2>/tmp/beta15_7_l6_mismatch.err; then
  echo "expected release mismatch fixture to fail closed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA15_7_L6_GENERATION_GATE"
  and .publicationAllowed==false
  and (.blockers | index("release_manifest_version_mismatch:0.1.0-beta.15.6:0.1.0-beta.15.7"))
  and (.blockers | index("missing_package_artifact:evidence/beta15_7-package/brik64-cli-0.1.0-beta.15.7.tgz"))
  and (.blockers | index("remote_l6plus_probe_failed"))
  and (.blockers | index("generated_artifact_missing"))
' "$MISMATCH/evidence/beta15_7-l6-generation/gate-report.json" >/dev/null
for file in gate-report.json l6plus_engine_manifest.json input_pcd_hashes.tsv generated_artifact_manifest.json package.manifest.json seal_report.json hashes.json
do
  test -f "$MISMATCH/evidence/beta15_7-l6-generation/$file"
done

MISSING_PCD="$TMP_DIR/missing-pcd"
mkbase "$MISSING_PCD"
rm "$MISSING_PCD/pcd/beta15/cli_polymer.pcd"
if BRIK64_CLI_ROOT="$MISSING_PCD" BRIK64_L6_SKIP_REMOTE=1 node "$ROOT/scripts/beta15_7-l6-generation-attempt.js" >/tmp/beta15_7_l6_missing.out 2>/tmp/beta15_7_l6_missing.err; then
  echo "expected missing PCD fixture to fail closed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA15_7_L6_GENERATION_GATE"
  and (.blockers | index("missing_input_pcd:pcd/beta15/cli_polymer.pcd"))
' "$MISSING_PCD/evidence/beta15_7-l6-generation/gate-report.json" >/dev/null

ALIGNED_NO_PACKAGE="$TMP_DIR/aligned-no-package"
mkbase "$ALIGNED_NO_PACKAGE"
cat >"$ALIGNED_NO_PACKAGE/release/manifest.json" <<'JSON'
{ "version": "0.1.0-beta.15.7" }
JSON
if BRIK64_CLI_ROOT="$ALIGNED_NO_PACKAGE" BRIK64_L6_SKIP_REMOTE=1 node "$ROOT/scripts/beta15_7-l6-generation-attempt.js" >/tmp/beta15_7_l6_aligned.out 2>/tmp/beta15_7_l6_aligned.err; then
  echo "expected aligned-but-no-package fixture to fail closed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA15_7_L6_GENERATION_GATE"
  and (.blockers | index("release_manifest_version_mismatch:0.1.0-beta.15.6:0.1.0-beta.15.7") | not)
  and (.blockers | index("missing_package_artifact:evidence/beta15_7-package/brik64-cli-0.1.0-beta.15.7.tgz"))
' "$ALIGNED_NO_PACKAGE/evidence/beta15_7-l6-generation/gate-report.json" >/dev/null

echo "PASS beta15.7 L6 generation attempt fail-closed coverage"
