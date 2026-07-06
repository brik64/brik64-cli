#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

cat >"$tmpdir/simple.js" <<'JS'
function approve(x) {
  if (x > 10) return x;
  return 0;
}
JS

(
  cd "$tmpdir"
  node "$BRIK" lift js simple.js --preview --json > simple-lift.json
  node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync("simple-lift.json","utf8")); if (j.candidateCount !== 1 || j.semanticCoveragePercent !== 100 || j.warningCodes.length !== 0) process.exit(1);'
  node "$BRIK" init >/dev/null
  node "$BRIK" certify .brik/lift-preview/js-*/candidates/approve.pcd >/dev/null
  node "$BRIK" verify .brik/lift-preview/js-*/candidates/approve.pcd --json | grep -q '"status": "PASS"'
)

mkdir -p "$tmpdir/complex/lib/actions"
cat >"$tmpdir/complex/lib/actions/pricing.ts" <<'TS'
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
  cd "$tmpdir/complex"
  node "$BRIK" lift ts lib/actions/pricing.ts --preview --json > pricing-lift.json
  node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync("pricing-lift.json","utf8")); const codes=new Set(j.warningCodes || []); if (j.candidateCount !== 0) process.exit(1); if (!codes.has("operation_not_extracted")) process.exit(1); if (!j.operationCoverage || !j.operationCoverage.sourceOperationFamilies.includes("arithmetic") || !j.operationCoverage.sourceOperationFamilies.includes("structured_data")) process.exit(1);'
  node "$BRIK" blueprint . --out blueprint --mermaid --evidence --json > blueprint.json
  test -f blueprint/BRIK64_BLUEPRINT_PLAN.md
  test -f blueprint/system-blueprint.md
  test -f blueprint/BRIK64_AUDIT_REPORT.md
  test -f blueprint/architecture-map.mmd
  test -f blueprint/operation-coverage.json
  test -f blueprint/unsupported-logic.json
  node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync("blueprint.json","utf8")); if (j.operationCoverage.unsupportedCount < 1) process.exit(1); if (!j.operationCoverage.families.includes("arithmetic")) process.exit(1);'
  if grep -q 'whole-application proof claimed: yes' blueprint/BRIK64_AUDIT_REPORT.md; then
    exit 1
  fi
)

echo "PASS_BRIK64_CLI_BETA18_BLUEPRINT_LIFT"
