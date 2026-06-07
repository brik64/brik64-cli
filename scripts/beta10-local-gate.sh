#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.1.0-beta.10"
OUT_DIR="${EVIDENCE_DIR:-$ROOT_DIR/evidence/beta10-local-gate}"
TMP_DIR="$(mktemp -d)"
BRIK="$ROOT_DIR/src/brik.js"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

mkdir -p "$OUT_DIR"

run_test() {
  local id="$1"
  shift
  "$@" >"$TMP_DIR/$id.stdout" 2>"$TMP_DIR/$id.stderr"
}

decision="PASS_BRIK64_CLI_BETA10_LOCAL_GATE"
failures=()

package_version="$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync("package.json","utf8")).version)')"
[[ "$package_version" == "$VERSION" ]] || failures+=("package_version_drift:$package_version")

if ! bash "$ROOT_DIR/tests/smoke.sh" >"$OUT_DIR/smoke.stdout" 2>"$OUT_DIR/smoke.stderr"; then
  failures+=("smoke_failed")
fi

WORK="$TMP_DIR/work"
mkdir -p "$WORK"
pushd "$WORK" >/dev/null
  node "$BRIK" init >/dev/null
  cat > helper.pcd <<'PCD'
PC helper {
  const BUMP: i64 = 4;
  fn helper(input) {
    return input + BUMP;
  }
}
PCD
  cat > root.pcd <<'PCD'
use helper;
PC root {
  const LIMIT: i64 = 2;
  fn root(input) {
    repeat LIMIT {
      if (helper(input) > 5) {
        return 1;
      }
    }
    return 0;
  }
}
PCD
  run_test explain node "$BRIK" explain root.pcd --json
  grep -q '"status": "PASS"' "$TMP_DIR/explain.stdout" || failures+=("explain_json_failed")
  run_test certify node "$BRIK" certify root.pcd
  run_test emit node "$BRIK" emit root.pcd --target ts --out out-ts --tests
  node out-ts/program.test.mjs >/dev/null || failures+=("generated_ts_test_failed")
  mkdir -p pcd
  cp root.pcd pcd/root.pcd
  cp helper.pcd pcd/helper.pcd
  run_test lock node "$BRIK" lock --json
  grep -q '"schemaVersion": "brik64.cli_lockfile.v1"' "$TMP_DIR/lock.stdout" || failures+=("lock_json_failed")
  run_test telemetry node "$BRIK" telemetry status
  grep -q '"networkSent": false' "$TMP_DIR/telemetry.stdout" || failures+=("telemetry_network_boundary_failed")
  run_test feedback node "$BRIK" feedback --dry-run --category bug --message 'token=abc user@example.com'
  grep -q '\[redacted' "$TMP_DIR/feedback.stdout" || failures+=("feedback_redaction_failed")
popd >/dev/null

if [[ "${#failures[@]}" -gt 0 ]]; then
  decision="BLOCKED_BRIK64_CLI_BETA10_LOCAL_GATE"
fi
failures_json="[]"
if [[ "${#failures[@]}" -gt 0 ]]; then
  failures_json="$(printf '%s\n' "${failures[@]}" | jq -Rsc 'split("\n") | map(select(length > 0))')"
fi

jq -n \
  --arg schemaVersion "brik64.cli_beta10_local_gate.v1" \
  --arg version "$VERSION" \
  --arg decision "$decision" \
  --argjson failures "$failures_json" \
  '{
    schemaVersion:$schemaVersion,
    version:$version,
    decision:$decision,
    releaseEligible:false,
    lane:"cli_0_1_beta",
    generationClaim:"assisted_generation_non_claim",
    gates:[
      "PASS_BETA10_IMPORT_DAG_GATE",
      "PASS_BETA10_CONST_GATE",
      "PASS_BETA10_EXPLAIN_LOCK_GATE",
      "PASS_BETA10_PRIVACY_REDACTION_GATE"
    ],
    failures:$failures,
    publicClaimsAllowed:false,
    networkTelemetrySent:false,
    boundary:"Local beta10 gate only. Public release still requires package, GitHub, curl/GCP, docs, web, SDKs, skills, changelog and live verification."
  }' > "$OUT_DIR/report.json"

printf 'decision=%s\n' "$decision"
[[ "$decision" == "PASS_BRIK64_CLI_BETA10_LOCAL_GATE" ]]
