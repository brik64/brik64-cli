#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

FIXTURE="$TMP_DIR/fixture"
mkdir -p "$FIXTURE/pcd/beta17/release"
cp "$ROOT/pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd" \
  "$FIXTURE/pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd"
cp "$ROOT/pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd" \
  "$FIXTURE/pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd"

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-stage-contract-gate.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"

jq -e '
  .decision=="PASS_BETA17_FIXPOINT_STAGE_CONTRACT_GATE"
  and (.contracts | length)==2
  and .claimBoundary.publicReleaseAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and (.blockers | length)==0
' "$FIXTURE/evidence/beta17-fixpoint-stage-contract/report.json" >/dev/null

python3 - "$FIXTURE/pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
text = text.replace("byte_identical_hash_match,", "")
text = text.replace("        if (byte_identical_hash_match == 0) { return 0; }\n", "")
path.write_text(text)
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-stage-contract-gate.js" \
  >"$TMP_DIR/fail.stdout" 2>"$TMP_DIR/fail.stderr"
fail_rc=$?
set -e

if [[ "$fail_rc" -eq 0 ]]; then
  echo "stage2_missing_byte_identity_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_STAGE_CONTRACT_GATE"
  and (.blockers | index("stage2:missing_required_condition:byte_identical_hash_match"))
  and (.blockers | index("stage2:missing_fail_closed_guard:byte_identical_hash_match"))
' "$FIXTURE/evidence/beta17-fixpoint-stage-contract/report.json" >/dev/null

echo "PASS beta17 fixpoint stage contract gate"
