#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
cd "$ROOT"

node --check scripts/l6plus-pcd-artifact-factory-audit.js

node <<'NODE'
const assert = require('assert');
const {
  parseCapabilities,
  requiredCapability,
  requiredResultMarker,
} = require('./scripts/l6plus-pcd-artifact-factory-audit');

assert(parseCapabilities(`BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY\tinstalled\t${requiredCapability},cli,sdk\n`).includes(requiredCapability));
assert(parseCapabilities('BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\tinstalled\tbeta15_7_ready,beta16_native_ready\n').includes('beta16_native_ready'));
assert.strictEqual(requiredResultMarker, 'BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT');
console.log('PASS l6plus PCD artifact factory audit module checks');
NODE

PASS_STATUS="$TMP_DIR/pass-status.txt"
cat >"$PASS_STATUS" <<'TXT'
BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY	installed	l6plus_pcd_artifact_factory,cli,sdk,harness,engine
BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT	available
TXT

PASS_ROOT="$TMP_DIR/pass-root"
mkdir -p "$PASS_ROOT"
BRIK64_CLI_ROOT="$PASS_ROOT" node "$ROOT/scripts/l6plus-pcd-artifact-factory-audit.js" \
  --fixture-status-file "$PASS_STATUS" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"
jq -e '
  .decision=="PASS_L6PLUS_PCD_ARTIFACT_FACTORY_AUDIT"
  and (.observedCapabilities | index("l6plus_pcd_artifact_factory"))
  and .claimBoundary.publicReleaseAllowed==false
' "$PASS_ROOT/evidence/l6plus-pcd-artifact-factory-audit/report.json" >/dev/null

LEGACY_STATUS="$TMP_DIR/legacy-status.txt"
cat >"$LEGACY_STATUS" <<'TXT'
BRIK64_L6_CLI_MATERIALIZER_ENDPOINT	installed	beta15_7_ready,beta16_native_ready,beta16_1_ready
BRIK64_L6_CLI_MATERIALIZATION_RESULT	available
TXT

LEGACY_ROOT="$TMP_DIR/legacy-root"
mkdir -p "$LEGACY_ROOT"
if BRIK64_CLI_ROOT="$LEGACY_ROOT" node "$ROOT/scripts/l6plus-pcd-artifact-factory-audit.js" \
  --fixture-status-file "$LEGACY_STATUS" \
  >"$TMP_DIR/legacy.stdout" 2>"$TMP_DIR/legacy.stderr"; then
  echo "legacy-only factory audit unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_L6PLUS_PCD_ARTIFACT_FACTORY_AUDIT"
  and (.blockers | index("l6plus_pcd_artifact_factory_capability_missing:beta15_7_ready,beta16_1_ready,beta16_native_ready"))
  and (.blockers | index("l6plus_pcd_artifact_factory_result_marker_missing:BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT"))
' "$LEGACY_ROOT/evidence/l6plus-pcd-artifact-factory-audit/report.json" >/dev/null

UNSUPPORTED_STATUS="$TMP_DIR/unsupported-status.txt"
cat >"$UNSUPPORTED_STATUS" <<'TXT'
brik64_l6plus_fail_closed:unsupported_or_missing_input
TXT

UNSUPPORTED_ROOT="$TMP_DIR/unsupported-root"
mkdir -p "$UNSUPPORTED_ROOT"
if BRIK64_CLI_ROOT="$UNSUPPORTED_ROOT" node "$ROOT/scripts/l6plus-pcd-artifact-factory-audit.js" \
  --fixture-status-file "$UNSUPPORTED_STATUS" \
  >"$TMP_DIR/unsupported.stdout" 2>"$TMP_DIR/unsupported.stderr"; then
  echo "unsupported factory audit unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_L6PLUS_PCD_ARTIFACT_FACTORY_AUDIT"
  and (.blockers | index("l6plus_pcd_artifact_factory_capability_missing:missing"))
  and (.blockers | index("l6plus_pcd_artifact_factory_result_marker_missing:BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT"))
' "$UNSUPPORTED_ROOT/evidence/l6plus-pcd-artifact-factory-audit/report.json" >/dev/null

echo "PASS l6plus PCD artifact factory audit tests"
