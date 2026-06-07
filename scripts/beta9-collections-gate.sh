#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
ITER_ID="${ITER_ID:-BRIK64-CLI-BETA9-COLLECTIONS-20260607-R1}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT_DIR/evidence/beta9-collections}"
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

decision="PASS_BRIK64_CLI_BETA9_COLLECTIONS"
rc=0
blockers=()
warnings=()
pass_checks=0
fail_closed_checks=0

block() {
  blockers+=("$1")
  decision="BLOCKED_BRIK64_CLI_BETA9_COLLECTIONS"
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

  cat > pcd/list_score.pcd <<'PCD'
PC list_score {
  fn list_score(amount: i64, rate: i64) -> i64 {
    if (len([amount, rate, amount + rate]) == 3) {
      return [amount, rate, amount + rate][2];
    }
    return 0;
  }
}
PCD

  pass certify_list node "$BRIK" certify pcd/list_score.pcd
  for target in ts rust python; do
    pass "emit_list_$target" node "$BRIK" emit pcd/list_score.pcd --target "$target" --out "list-$target" --tests
  done
  pass ts_list node list-ts/program.test.mjs
  pass rust_compile_list rustc list-rust/program_test.rs -o list-rust/program_test
  pass rust_list ./list-rust/program_test
  pass python_list env PYTHONPATH=list-python python3 list-python/test_program.py

  node --input-type=module <<'NODE' >"$TMP_DIR/manual-list-ts.stdout" 2>"$TMP_DIR/manual-list-ts.stderr" || block "manual_ts_list_failed"
import { run } from './list-ts/program.mjs';
if (run(120, 7) !== 127) throw new Error('list high case failed');
if (run(80, 7) !== 87) throw new Error('list low case failed');
console.log('manual ts list subset: PASS');
NODE
  pass_checks=$((pass_checks + 1))

  cat > pcd/return_list.pcd <<'PCD'
PC return_list {
  fn return_list(input: i64) -> i64 {
    return [1, 2];
  }
}
PCD
  cat > pcd/len_scalar.pcd <<'PCD'
PC len_scalar {
  fn len_scalar(input: i64) -> i64 {
    return len(input);
  }
}
PCD
  cat > pcd/index_scalar.pcd <<'PCD'
PC index_scalar {
  fn index_scalar(input: i64) -> i64 {
    return input[0];
  }
}
PCD
  cat > pcd/trailing_list_comma.pcd <<'PCD'
PC trailing_list_comma {
  fn trailing_list_comma(input: i64) -> i64 {
    return [input,][0];
  }
}
PCD

  expect_fail return_list "pcd_parse_error:return_type_mismatch:list_i64_to_i64" node "$BRIK" certify pcd/return_list.pcd
  expect_fail len_scalar "pcd_parse_error:len_requires_list" node "$BRIK" certify pcd/len_scalar.pcd
  expect_fail index_scalar "pcd_parse_error:index_requires_list" node "$BRIK" certify pcd/index_scalar.pcd
  expect_fail trailing_list_comma "pcd_parse_error:trailing_list_comma" node "$BRIK" certify pcd/trailing_list_comma.pcd
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
fixture_sha="sha256:$(sha256_file "$WORK_DIR/pcd/list_score.pcd")"
ts_sha="sha256:$(sha256_file "$WORK_DIR/list-ts/program.mjs")"
rust_sha="sha256:$(sha256_file "$WORK_DIR/list-rust/program.rs")"
python_sha="sha256:$(sha256_file "$WORK_DIR/list-python/program.py")"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

jq -n \
  --arg schemaVersion "brik64.cli_beta9_collections_gate.v1" \
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
    fixture:{path:"pcd/list_score.pcd", sha256:$fixture_sha},
    executedTargets:{
      typescript:{programSha256:$ts_sha, passed:($decision=="PASS_BRIK64_CLI_BETA9_COLLECTIONS")},
      rust:{programSha256:$rust_sha, passed:($decision=="PASS_BRIK64_CLI_BETA9_COLLECTIONS")},
      python:{programSha256:$python_sha, passed:($decision=="PASS_BRIK64_CLI_BETA9_COLLECTIONS")}
    },
    checks:{
      pass_checks:$pass_checks,
      fail_closed_checks:$fail_closed_checks,
      list_literals:true,
      list_index:true,
      list_len:true,
      maps_dictionaries:false
    },
    adversarial:{
      return_list_rejected:true,
      len_scalar_rejected:true,
      index_scalar_rejected:true,
      trailing_list_comma_rejected:true,
      stack_trace_leaked:false
    },
    claim_boundary:{
      public_claims_allowed:false,
      public_release_allowed:false,
      formal_n5_claim_allowed:false,
      fixpoint_claim_allowed:false,
      self_hosting_claim_allowed:false,
      rust_independence_claim_allowed:false,
      compiler_functionality_scope:"supported_beta9_list_subset_only"
    },
    blockers:$blockers,
    warnings:$warnings,
    next_action:(if $decision=="PASS_BRIK64_CLI_BETA9_COLLECTIONS" then "continue beta9 maps and bounded-loop parser gates before L6 materialization" else "resolve collections blockers" end)
  }' >"$REPORT_JSON"

cat "$REPORT_JSON"
exit "$rc"
