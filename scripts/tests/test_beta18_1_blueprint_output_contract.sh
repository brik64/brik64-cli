#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

assert_json() {
  local file="$1"
  local expr="$2"
  node - "$file" "$expr" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const expr = process.argv[3];
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Function('j', `return (${expr});`)(j)) {
  console.error(`assertion_failed:${expr}`);
  process.exit(1);
}
NODE
}

mkdir -p "$tmpdir/pcd-certifiable"
cat >"$tmpdir/pcd-certifiable/simple.js" <<'JS'
function approve(x) {
  if (x > 10) return x;
  return 0;
}
JS

(
  cd "$tmpdir/pcd-certifiable"
  node "$BRIK" blueprint . --out brik64-blueprint --mermaid --evidence --json > blueprint.json
  assert_json blueprint.json "j.mode === 'pcd_certified'"
  assert_json blueprint.json "j.blueprintSource === 'certified_polymers'"
  assert_json blueprint.json "j.counts.pcdInventoryRows > 0"
  assert_json blueprint.json "j.counts.certifiedPcdCount > 0"
  assert_json blueprint.json "j.counts.polymerCount > 0"
  test -s brik64-blueprint/pcd-inventory.csv
  test -f brik64-blueprint/pcd/polymers/app-system.polymer.pcd
  test -f brik64-blueprint/pcd/polymers/app-system.polymer.pcd.cert.json
  grep -q "Mode: pcd_certified" brik64-blueprint/BRIK64_AUDIT_REPORT.md
  grep -q "certified_polymers" brik64-blueprint/system-blueprint.md
)

mkdir -p "$tmpdir/sdk-first/lib/actions"
cat >"$tmpdir/sdk-first/lib/actions/pricing.ts" <<'TS'
const DEFAULT_COMMISSION_RATE = 0.18;

export function quoteRentalPrice(baseCents: number, nights: number, discountRate: number) {
  const gross = baseCents * nights;
  const discount = Math.max(0, gross * discountRate);
  const net = gross - discount;
  if (net > 100000 && nights > 14) return JSON.stringify({ tier: "review", net });
  return JSON.stringify({ tier: "standard", net: net + (net * DEFAULT_COMMISSION_RATE) });
}
TS

(
  cd "$tmpdir/sdk-first"
  node "$BRIK" blueprint . --out brik64-blueprint --mermaid --evidence --json > blueprint.json
  assert_json blueprint.json "j.mode === 'sdk_logic'"
  assert_json blueprint.json "j.blueprintSource === 'sdk_logic_inventory'"
  assert_json blueprint.json "j.counts.pcdInventoryRows === 0"
  assert_json blueprint.json "j.counts.sdkLogicModules > 0"
  assert_json blueprint.json "j.counts.unsupportedCount > 0"
  test -f brik64-blueprint/sdk-logic-modules.json
  grep -q "Mode: sdk_logic" brik64-blueprint/BRIK64_AUDIT_REPORT.md
  grep -q "SDK_LOGIC_BLUEPRINT" brik64-blueprint/BRIK64_AUDIT_REPORT.md
)

mkdir -p "$tmpdir/inspection-draft"
(
  cd "$tmpdir/inspection-draft"
  node "$BRIK" blueprint . --out brik64-blueprint --mermaid --evidence --json > blueprint.json
  assert_json blueprint.json "j.mode === 'inspection_draft'"
  assert_json blueprint.json "j.blueprintSource === 'repository_inspection'"
  assert_json blueprint.json "j.counts.pcdInventoryRows === 0"
  assert_json blueprint.json "j.counts.certifiedPcdCount === 0"
  assert_json blueprint.json "j.counts.polymerCount === 0"
  grep -q "Mode: inspection_draft" brik64-blueprint/BRIK64_AUDIT_REPORT.md
  grep -q "INSPECTION_DRAFT" brik64-blueprint/BRIK64_AUDIT_REPORT.md
)

echo "PASS_BRIK64_CLI_BETA18_1_BLUEPRINT_OUTPUT_CONTRACT"
