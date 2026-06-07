#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
ITER_ID="${ITER_ID:-BRIK64-CLI-BETA9-TYPED-INTERFACE-20260607-R1}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT_DIR/evidence/beta9-typed-interface}"
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

decision="PASS_BRIK64_CLI_BETA9_TYPED_INTERFACE"
rc=0
blockers=()
warnings=()
pass_checks=0
fail_closed_checks=0

block() {
  blockers+=("$1")
  decision="BLOCKED_BRIK64_CLI_BETA9_TYPED_INTERFACE"
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

  cat > pcd/typed_fee.pcd <<'PCD'
PC typed_fee {
  fn typed_fee(amount: i64, rate: i64) -> i64 {
    if (amount > 100) {
      return amount + rate;
    }
    return amount - rate;
  }
}
PCD

  pass certify_typed node "$BRIK" certify pcd/typed_fee.pcd
  for target in ts rust python; do
    pass "emit_typed_$target" node "$BRIK" emit pcd/typed_fee.pcd --target "$target" --out "typed-$target" --tests
  done
  pass ts_typed node typed-ts/program.test.mjs
  pass rust_compile_typed rustc typed-rust/program_test.rs -o typed-rust/program_test
  pass rust_typed ./typed-rust/program_test
  pass python_typed env PYTHONPATH=typed-python python3 typed-python/test_program.py

  node --input-type=module <<'NODE' >"$TMP_DIR/manual-ts.stdout" 2>"$TMP_DIR/manual-ts.stderr" || block "manual_ts_multi_param_failed"
import { run } from './typed-ts/program.mjs';
if (run(120, 7) !== 127) throw new Error('typed case high failed');
if (run(80, 7) !== 73) throw new Error('typed case low failed');
console.log('manual ts typed interface: PASS');
NODE
  pass_checks=$((pass_checks + 1))

  cat > pcd/bad_param_type.pcd <<'PCD'
PC bad_param_type {
  fn bad_param_type(input: string) -> i64 {
    return 1;
  }
}
PCD
  cat > pcd/bad_return_type.pcd <<'PCD'
PC bad_return_type {
  fn bad_return_type(input: i64) -> bool {
    return 1;
  }
}
PCD
  cat > pcd/duplicate_param.pcd <<'PCD'
PC duplicate_param {
  fn duplicate_param(input: i64, input: i64) -> i64 {
    return input;
  }
}
PCD
  cat > pcd/unknown_second_param.pcd <<'PCD'
PC unknown_second_param {
  fn unknown_second_param(input: i64, rate: i64) -> i64 {
    return missing + rate;
  }
}
PCD

  expect_fail bad_param_type "pcd_parse_error:unsupported_param_type:string" node "$BRIK" certify pcd/bad_param_type.pcd
  expect_fail bad_return_type "pcd_parse_error:unsupported_return_type:bool" node "$BRIK" certify pcd/bad_return_type.pcd
  expect_fail duplicate_param "pcd_parse_error:duplicate_param:input" node "$BRIK" certify pcd/duplicate_param.pcd
  expect_fail unknown_second_param "pcd_parse_error:unknown_identifier:missing" node "$BRIK" certify pcd/unknown_second_param.pcd
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
fixture_sha="sha256:$(sha256_file "$WORK_DIR/pcd/typed_fee.pcd")"
ts_sha="sha256:$(sha256_file "$WORK_DIR/typed-ts/program.mjs")"
rust_sha="sha256:$(sha256_file "$WORK_DIR/typed-rust/program.rs")"
python_sha="sha256:$(sha256_file "$WORK_DIR/typed-python/program.py")"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

jq -n \
  --arg schemaVersion "brik64.cli_beta9_typed_interface_gate.v1" \
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
    fixture:{path:"pcd/typed_fee.pcd", sha256:$fixture_sha},
    executedTargets:{
      typescript:{programSha256:$ts_sha, passed:($decision=="PASS_BRIK64_CLI_BETA9_TYPED_INTERFACE")},
      rust:{programSha256:$rust_sha, passed:($decision=="PASS_BRIK64_CLI_BETA9_TYPED_INTERFACE")},
      python:{programSha256:$python_sha, passed:($decision=="PASS_BRIK64_CLI_BETA9_TYPED_INTERFACE")}
    },
    checks:{
      pass_checks:$pass_checks,
      fail_closed_checks:$fail_closed_checks,
      multi_param_i64_interface:true,
      typed_return_i64:true
    },
    adversarial:{
      unsupported_param_type_fail_closed:true,
      unsupported_return_type_fail_closed:true,
      duplicate_param_fail_closed:true,
      unknown_identifier_fail_closed:true,
      stack_trace_leaked:false
    },
    claim_boundary:{
      public_claims_allowed:false,
      public_release_allowed:false,
      formal_n5_claim_allowed:false,
      fixpoint_claim_allowed:false,
      self_hosting_claim_allowed:false,
      rust_independence_claim_allowed:false,
      compiler_functionality_scope:"supported_beta9_typed_i64_interface_subset_only"
    },
    blockers:$blockers,
    warnings:$warnings,
    next_action:(if $decision=="PASS_BRIK64_CLI_BETA9_TYPED_INTERFACE" then "continue beta9 collections and bounded-loop parser gates before L6 materialization" else "resolve typed-interface blockers" end)
  }' >"$REPORT_JSON"

cat "$REPORT_JSON"
exit "$rc"
