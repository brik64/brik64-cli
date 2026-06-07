#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

run_case() {
  local name="$1"
  local expected_rc="$2"
  local assertion="$3"
  shift 3
  set +e
  "$@" >/tmp/brik64-beta9-pcd-l6.out 2>&1
  local rc=$?
  set -e
  if [[ "$rc" != "$expected_rc" ]]; then
    echo "FAIL $name rc=$rc expected=$expected_rc" >&2
    cat /tmp/brik64-beta9-pcd-l6.out >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
  if ! jq -e "$assertion" "$TMP_DIR/$name/gate.json" >/dev/null; then
    echo "FAIL $name assertion" >&2
    cat "$TMP_DIR/$name/gate.json" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
  echo "PASS $name"
  PASS_COUNT=$((PASS_COUNT + 1))
}

case_missing_report_blocks() {
  local dir="$TMP_DIR/missing"
  mkdir -p "$dir"
  run_case missing 2 '
    .decision=="BLOCKED_BETA9_PCD_L6_MATERIALIZATION_GATE"
    and (.blockers|index("manual_surface_pending_pcd_generation"))
    and (.blockers|index("beta9_l6_materialization_report_missing"))
  ' env \
    BRIK64_BETA9_L6_MATERIALIZATION_REPORT="$dir/no-report.json" \
    BRIK64_BETA9_PCD_L6_GATE_REPORT="$dir/gate.json" \
    node "$ROOT/scripts/beta9-pcd-l6-materialization-gate.js"
}

case_invalid_claim_boundary_blocks() {
  local dir="$TMP_DIR/invalid"
  mkdir -p "$dir"
  node - "$ROOT" "$dir/report.json" <<'NODE'
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const out = process.argv[3];
function sha(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}
function hashJson(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}
const inventory = fs.readdirSync(path.join(root, 'pcd'))
  .filter((name) => name.endsWith('.pcd'))
  .sort()
  .map((name) => ({ path: path.relative(root, path.join(root, 'pcd', name)), sha256: sha(path.join(root, 'pcd', name)) }));
fs.writeFileSync(out, `${JSON.stringify({
  decision: 'PASS_BETA9_PCD_L6_MATERIALIZATION',
  version: '0.1.0-beta.9',
  lane: 'cli_0_1_beta',
  generationClaim: 'assisted_generation_non_claim',
  factory: { serial: 'BRIK64-L6PLUS-N5-TEST', stage1Hash: `sha256:${'a'.repeat(64)}` },
  hashes: {
    pcdInventoryHash: hashJson(inventory),
    cliPolymerHash: sha(path.join(root, 'pcd', 'cli_polymer.pcd')),
    beta9ContractHash: sha(path.join(root, 'pcd', 'cli_beta9_transpiler_contract.pcd')),
    generatedArtifactHash: `sha256:${'b'.repeat(64)}`,
    packageHash: `sha256:${'c'.repeat(64)}`,
    releaseManifestHash: `sha256:${'d'.repeat(64)}`
  },
  claimBoundary: {
    publicClaimsAllowed: true,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
    pureBrik64ChainClaimAllowed: false
  }
}, null, 2)}\n`);
NODE
  run_case invalid 2 '
    .decision=="BLOCKED_BETA9_PCD_L6_MATERIALIZATION_GATE"
    and (.blockers|index("beta9_l6_materialization_claimBoundaryClosed_invalid"))
  ' env \
    BRIK64_BETA9_L6_MATERIALIZATION_REPORT="$dir/report.json" \
    BRIK64_BETA9_PCD_L6_GATE_REPORT="$dir/gate.json" \
    node "$ROOT/scripts/beta9-pcd-l6-materialization-gate.js"
}

case_valid_fixture_passes() {
  local dir="$TMP_DIR/valid"
  mkdir -p "$dir"
  node - "$ROOT" "$dir/report.json" <<'NODE'
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const out = process.argv[3];
function sha(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}
function hashJson(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}
const inventory = fs.readdirSync(path.join(root, 'pcd'))
  .filter((name) => name.endsWith('.pcd'))
  .sort()
  .map((name) => ({ path: path.relative(root, path.join(root, 'pcd', name)), sha256: sha(path.join(root, 'pcd', name)) }));
fs.writeFileSync(out, `${JSON.stringify({
  decision: 'PASS_BETA9_PCD_L6_MATERIALIZATION',
  version: '0.1.0-beta.9',
  lane: 'cli_0_1_beta',
  generationClaim: 'assisted_generation_non_claim',
  factory: { serial: 'BRIK64-L6PLUS-N5-TEST', stage1Hash: `sha256:${'a'.repeat(64)}` },
  hashes: {
    pcdInventoryHash: hashJson(inventory),
    cliPolymerHash: sha(path.join(root, 'pcd', 'cli_polymer.pcd')),
    beta9ContractHash: sha(path.join(root, 'pcd', 'cli_beta9_transpiler_contract.pcd')),
    generatedArtifactHash: `sha256:${'b'.repeat(64)}`,
    packageHash: `sha256:${'c'.repeat(64)}`,
    releaseManifestHash: `sha256:${'d'.repeat(64)}`
  },
  claimBoundary: {
    publicClaimsAllowed: false,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
    pureBrik64ChainClaimAllowed: false
  }
}, null, 2)}\n`);
NODE
  run_case valid 0 '
    .decision=="PASS_BETA9_PCD_L6_MATERIALIZATION_GATE"
    and .blockers==[]
    and .expected.version=="0.1.0-beta.9"
  ' env \
    BRIK64_BETA9_L6_MATERIALIZATION_REPORT="$dir/report.json" \
    BRIK64_BETA9_PCD_L6_GATE_REPORT="$dir/gate.json" \
    node "$ROOT/scripts/beta9-pcd-l6-materialization-gate.js"
}

case_missing_report_blocks
case_invalid_claim_boundary_blocks
case_valid_fixture_passes

echo "SUMMARY pass=$PASS_COUNT fail=$FAIL_COUNT"
[[ "$FAIL_COUNT" -eq 0 ]]
