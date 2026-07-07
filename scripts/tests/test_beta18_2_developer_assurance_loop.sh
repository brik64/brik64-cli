#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT
export BRIK64_CONFIG_HOME="$tmpdir/config"

cd "$tmpdir"
node "$BRIK" init --profile regulated --structure modular --json | grep -q '"profile": "regulated"'

cat >pricing.pcd <<'PCD'
// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC pricing_gate {
    domain amount: i64 [0, 100000];
    domain limit: i64 [0, 100000];
    fn pricing_gate(amount: i64, limit: i64) -> i64 {
        if (amount <= 0) return 0;
        if (amount > limit) return 0;
        return MC_00.ADD8(amount, 1);
    }
}
PCD

cp pricing.pcd pricing_v2.pcd
perl -0pi -e 's/return MC_00\.ADD8\(amount, 1\);/return MC_02.MUL8(amount, 2);/' pricing_v2.pcd

node "$BRIK" explain pricing.pcd --suggest --fix-plan --json | grep -q '"suggestions"'
node "$BRIK" certify pricing.pcd | grep -q 'certificate='
node "$BRIK" verify pricing.pcd --json | grep -q '"status": "PASS"'
node "$BRIK" test pricing.pcd --generate-scenarios --json | grep -q '"decision": "PASS_BRIK64_NATIVE_TEST"'
node "$BRIK" diff pricing.pcd pricing_v2.pcd --impact --json | grep -q '"status": "CHANGED"'
node "$BRIK" doc pricing.pcd --format markdown --out docs/brik64 --json | grep -q '"status": "PASS"'
test -f docs/brik64/pricing.md
node "$BRIK" lint-policy pricing.pcd --policy all --json | grep -Eq '"status": "(PASS|WARN)"'
node "$BRIK" audit . --out .brik/audit --json | tee audit.json | grep -q '"schemaVersion": "brik64.cli_audit_aggregate.v1"'
grep -q '"auditReport": ".brik/audit/BRIK64_AUDIT_REPORT.md"' audit.json
test -f .brik/audit/BRIK64_AUDIT_REPORT.md
test -f .brik/audit/blueprint/BRIK64_BLUEPRINT_PLAN.md

echo "PASS_BRIK64_CLI_BETA18_2_DEVELOPER_ASSURANCE_LOOP"
