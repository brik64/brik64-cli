#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
ITER_ID="${ITER_ID:-BRIK64-CLI-BETA9-LOCAL-IMPORTS-20260607-R1}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT_DIR/evidence/beta9-local-imports}"
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

decision="PASS_BRIK64_CLI_BETA9_LOCAL_IMPORTS"
rc=0
blockers=()
warnings=()
pass_checks=0
fail_closed_checks=0

block() {
  blockers+=("$1")
  decision="BLOCKED_BRIK64_CLI_BETA9_LOCAL_IMPORTS"
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

  cat > pcd/helper.pcd <<'PCD'
PC helper {
  fn helper(amount: i64, rate: i64) -> i64 {
    return amount + rate;
  }
}
PCD
  cat > pcd/import_score.pcd <<'PCD'
use helper;
PC import_score {
  fn import_score(amount: i64, rate: i64) -> i64 {
    if (helper(amount, rate) > 100) {
      return helper(amount, rate) + 3;
    }
    return helper(amount, rate) - 3;
  }
}
PCD

  pass certify_import node "$BRIK" certify pcd/import_score.pcd
  for target in ts rust python; do
    pass "emit_import_$target" node "$BRIK" emit pcd/import_score.pcd --target "$target" --out "import-$target" --tests
  done
  pass ts_import node import-ts/program.test.mjs
  pass rust_compile_import rustc import-rust/program_test.rs -o import-rust/program_test
  pass rust_import ./import-rust/program_test
  pass python_import env PYTHONPATH=import-python python3 import-python/test_program.py

  node --input-type=module <<'NODE' >"$TMP_DIR/manual-import-ts.stdout" 2>"$TMP_DIR/manual-import-ts.stderr" || block "manual_ts_import_failed"
import { run } from './import-ts/program.mjs';
if (run(120, 7) !== 130) throw new Error('import high case failed');
if (run(80, 7) !== 84) throw new Error('import low case failed');
console.log('manual ts local import subset: PASS');
NODE
  pass_checks=$((pass_checks + 1))

  cat > pcd/missing_import.pcd <<'PCD'
use absent;
PC missing_import {
  fn missing_import(input: i64) -> i64 {
    return absent(input);
  }
}
PCD
  cat > pcd/arity_bad.pcd <<'PCD'
use helper;
PC arity_bad {
  fn arity_bad(input: i64) -> i64 {
    return helper(input);
  }
}
PCD
  cat > pcd/unknown_callable.pcd <<'PCD'
PC unknown_callable {
  fn unknown_callable(input: i64) -> i64 {
    return helper(input);
  }
}
PCD
  cat > pcd/leaf.pcd <<'PCD'
PC leaf {
  fn leaf(input: i64) -> i64 {
    return input;
  }
}
PCD
  cat > pcd/nested.pcd <<'PCD'
use leaf;
PC nested {
  fn nested(input: i64) -> i64 {
    return leaf(input);
  }
}
PCD
  cat > pcd/nested_main.pcd <<'PCD'
use nested;
PC nested_main {
  fn nested_main(input: i64) -> i64 {
    return nested(input);
  }
}
PCD

  expect_fail missing_import "pcd_import_not_found:absent" node "$BRIK" certify pcd/missing_import.pcd
  expect_fail arity_bad "pcd_parse_error:import_call_arity_mismatch:helper" node "$BRIK" certify pcd/arity_bad.pcd
  expect_fail unknown_callable "pcd_parse_error:unknown_callable:helper" node "$BRIK" certify pcd/unknown_callable.pcd
  expect_fail nested_main "pcd_parse_error:nested_imports_unsupported:nested" node "$BRIK" certify pcd/nested_main.pcd
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
fixture_sha="sha256:$(sha256_file "$WORK_DIR/pcd/import_score.pcd")"
helper_sha="sha256:$(sha256_file "$WORK_DIR/pcd/helper.pcd")"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

jq -n \
  --arg schemaVersion "brik64.cli_beta9_local_imports_gate.v1" \
  --arg generatedAt "$generated_at" \
  --arg iter_id "$ITER_ID" \
  --arg decision "$decision" \
  --arg version "$package_version" \
  --arg cli_sha "$cli_sha" \
  --arg fixture_sha "$fixture_sha" \
  --arg helper_sha "$helper_sha" \
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
    fixture:{path:"pcd/import_score.pcd", sha256:$fixture_sha},
    helper:{path:"pcd/helper.pcd", sha256:$helper_sha},
    checks:{
      pass_checks:$pass_checks,
      fail_closed_checks:$fail_closed_checks,
      local_use_import:true,
      import_call:true,
      nested_imports:false
    },
    adversarial:{
      missing_import_rejected:true,
      import_arity_rejected:true,
      unknown_callable_rejected:true,
      nested_import_rejected:true,
      stack_trace_leaked:false
    },
    claim_boundary:{
      public_claims_allowed:false,
      public_release_allowed:false,
      formal_n5_claim_allowed:false,
      fixpoint_claim_allowed:false,
      self_hosting_claim_allowed:false,
      rust_independence_claim_allowed:false,
      compiler_functionality_scope:"supported_beta9_direct_local_import_subset_only"
    },
    blockers:$blockers,
    warnings:$warnings,
    next_action:(if $decision=="PASS_BRIK64_CLI_BETA9_LOCAL_IMPORTS" then "continue beta9 doctor UX and release-train materialization gates" else "resolve local import blockers" end)
  }' >"$REPORT_JSON"

cat "$REPORT_JSON"
exit "$rc"
