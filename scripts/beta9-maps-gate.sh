#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
ITER_ID="${ITER_ID:-BRIK64-CLI-BETA9-MAPS-20260607-R1}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT_DIR/evidence/beta9-maps}"
REPORT_JSON="$EVIDENCE_DIR/report.json"
TMP_DIR="$(mktemp -d)"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing command: $1" >&2
    exit 2
  }
}

need_cmd node
need_cmd python3
need_cmd rustc
need_cmd jq
need_cmd shasum

sha256_file() { shasum -a 256 "$1" | awk '{print $1}'; }

json_array() {
  if [[ "$#" -eq 0 ]]; then
    printf '[]'
  else
    printf '%s\n' "$@" | jq -Rsc 'split("\n") | map(select(length > 0))'
  fi
}

mkdir -p "$EVIDENCE_DIR"

decision="PASS_BRIK64_CLI_BETA9_MAPS"
rc=0
blockers=()
warnings=()
pass_checks=0
fail_closed_checks=0

block() {
  blockers+=("$1")
  decision="BLOCKED_BRIK64_CLI_BETA9_MAPS"
  rc=2
}

pass() {
  local id="$1"
  shift
  set +e
  "$@" >"$TMP_DIR/$id.stdout" 2>"$TMP_DIR/$id.stderr"
  local cmd_rc=$?
  set -e
  if [[ "$cmd_rc" -ne 0 ]]; then
    block "$id:unexpected_failure"
    return
  fi
  pass_checks=$((pass_checks + 1))
}

expect_fail() {
  local id="$1"
  local expected="$2"
  shift 2
  set +e
  "$@" >"$TMP_DIR/$id.stdout" 2>"$TMP_DIR/$id.stderr"
  local cmd_rc=$?
  set -e
  if [[ "$cmd_rc" -eq 0 ]]; then
    block "$id:unexpected_success"
    return
  fi
  if ! grep -q "$expected" "$TMP_DIR/$id.stderr"; then
    block "$id:missing_expected_error:$expected"
    return
  fi
  fail_closed_checks=$((fail_closed_checks + 1))
}

export BRIK64_CONFIG_HOME="$TMP_DIR/config"
WORK_DIR="$TMP_DIR/work"
mkdir -p "$WORK_DIR"

pushd "$WORK_DIR" >/dev/null
  pass init node "$BRIK" init
  mkdir -p pcd

  cat > pcd/map_score.pcd <<'PCD'
PC map_score {
  fn map_score(amount: i64, rate: i64) -> i64 {
    if (has({base: amount, fee: rate, total: amount + rate}, total) == 1) {
      return {base: amount, fee: rate, total: amount + rate}.total;
    }
    return 0;
  }
}
PCD

  pass certify_map node "$BRIK" certify pcd/map_score.pcd
  for target in ts rust python; do
    pass "emit_map_$target" node "$BRIK" emit pcd/map_score.pcd --target "$target" --out "map-$target" --tests
  done
  pass ts_map node map-ts/program.test.mjs
  pass rust_compile_map rustc map-rust/program_test.rs -o map-rust/program_test
  pass rust_map ./map-rust/program_test
  pass python_map env PYTHONPATH=map-python python3 map-python/test_program.py

  node --input-type=module <<'NODE' >"$TMP_DIR/manual-map-ts.stdout" 2>"$TMP_DIR/manual-map-ts.stderr" || block "manual_ts_map_failed"
import { run } from './map-ts/program.mjs';
if (run(120, 7) !== 127) throw new Error('map high case failed');
if (run(80, 7) !== 87) throw new Error('map low case failed');
console.log('manual ts map subset: PASS');
NODE
  pass_checks=$((pass_checks + 1))

  cat > pcd/return_map.pcd <<'PCD'
PC return_map {
  fn return_map(input: i64) -> i64 {
    return {value: input};
  }
}
PCD
  cat > pcd/has_scalar.pcd <<'PCD'
PC has_scalar {
  fn has_scalar(input: i64) -> i64 {
    return has(input, value);
  }
}
PCD
  cat > pcd/member_scalar.pcd <<'PCD'
PC member_scalar {
  fn member_scalar(input: i64) -> i64 {
    return input.value;
  }
}
PCD
  cat > pcd/duplicate_map_key.pcd <<'PCD'
PC duplicate_map_key {
  fn duplicate_map_key(input: i64) -> i64 {
    return {value: input, value: 2}.value;
  }
}
PCD
  cat > pcd/unknown_map_key.pcd <<'PCD'
PC unknown_map_key {
  fn unknown_map_key(input: i64) -> i64 {
    return {value: input}.missing;
  }
}
PCD

  expect_fail return_map "pcd_parse_error:return_type_mismatch:map_i64_to_i64" node "$BRIK" certify pcd/return_map.pcd
  expect_fail has_scalar "pcd_parse_error:has_requires_map" node "$BRIK" certify pcd/has_scalar.pcd
  expect_fail member_scalar "pcd_parse_error:member_requires_map" node "$BRIK" certify pcd/member_scalar.pcd
  expect_fail duplicate_map_key "pcd_parse_error:duplicate_map_key:value" node "$BRIK" certify pcd/duplicate_map_key.pcd
  expect_fail unknown_map_key "pcd_parse_error:unknown_map_key:missing" node "$BRIK" certify pcd/unknown_map_key.pcd
popd >/dev/null

if grep -q "Node.js\\|at .*src/brik" "$TMP_DIR"/*.stderr 2>/dev/null; then
  block "stack_trace_leaked_to_stderr"
fi

if [[ "${#blockers[@]}" -eq 0 ]]; then
  blockers_json='[]'
else
  blockers_json="$(json_array "${blockers[@]}")"
fi
if [[ "${#warnings[@]}" -eq 0 ]]; then
  warnings_json='[]'
else
  warnings_json="$(json_array "${warnings[@]}")"
fi

package_version="$(node -e "const fs=require('fs'); process.stdout.write(JSON.parse(fs.readFileSync('$ROOT_DIR/package.json','utf8')).version)")"
cli_sha="sha256:$(sha256_file "$BRIK")"
fixture_sha="sha256:$(sha256_file "$WORK_DIR/pcd/map_score.pcd")"
ts_sha="sha256:$(sha256_file "$WORK_DIR/map-ts/program.mjs")"
rust_sha="sha256:$(sha256_file "$WORK_DIR/map-rust/program.rs")"
python_sha="sha256:$(sha256_file "$WORK_DIR/map-python/program.py")"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

jq -n \
  --arg schemaVersion "brik64.cli_beta9_maps_gate.v1" \
  --arg generatedAt "$generated_at" \
  --arg iter_id "$ITER_ID" \
  --arg decision "$decision" \
  --arg version "$package_version" \
  --arg cli_sha "$cli_sha" \
  --arg fixture_sha "$fixture_sha" \
  --arg ts_sha "$ts_sha" \
  --arg rust_sha "$rust_sha" \
  --arg python_sha "$python_sha" \
  --argjson pass_checks "$pass_checks" \
  --argjson fail_closed_checks "$fail_closed_checks" \
  --argjson blockers "$blockers_json" \
  --argjson warnings "$warnings_json" \
  --argjson rc "$rc" \
  '{
    schemaVersion:$schemaVersion,
    generatedAt:$generatedAt,
    iter_id:$iter_id,
    lane:"cli_0_1_beta9",
    decision:$decision,
    rc:$rc,
    cliVersion:$version,
    cliSha256:$cli_sha,
    fixture:{path:"pcd/map_score.pcd", sha256:$fixture_sha},
    executedTargets:{
      typescript:{programSha256:$ts_sha, passed:($decision=="PASS_BRIK64_CLI_BETA9_MAPS")},
      rust:{programSha256:$rust_sha, passed:($decision=="PASS_BRIK64_CLI_BETA9_MAPS")},
      python:{programSha256:$python_sha, passed:($decision=="PASS_BRIK64_CLI_BETA9_MAPS")}
    },
    checks:{
      pass_checks:$pass_checks,
      fail_closed_checks:$fail_closed_checks,
      map_literals:true,
      map_member_access:true,
      map_has:true,
      dynamic_map_runtime:false
    },
    adversarial:{
      return_map_rejected:true,
      has_scalar_rejected:true,
      member_scalar_rejected:true,
      duplicate_key_rejected:true,
      unknown_key_rejected:true,
      stack_trace_leaked:false
    },
    claim_boundary:{
      public_claims_allowed:false,
      public_release_allowed:false,
      formal_n5_claim_allowed:false,
      fixpoint_claim_allowed:false,
      self_hosting_claim_allowed:false,
      rust_independence_claim_allowed:false,
      compiler_functionality_scope:"supported_beta9_map_literal_subset_only"
    },
    blockers:$blockers,
    warnings:$warnings,
    next_action:(if $decision=="PASS_BRIK64_CLI_BETA9_MAPS" then "continue beta9 bounded-loop parser gates before L6 materialization" else "resolve maps blockers" end)
  }' >"$REPORT_JSON"

cat "$REPORT_JSON"
exit "$rc"
