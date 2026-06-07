#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
ITER_ID="${ITER_ID:-BRIK64-CLI-BETA9-BOUNDED-LOOPS-20260607-R1}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT_DIR/evidence/beta9-bounded-loops}"
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

decision="PASS_BRIK64_CLI_BETA9_BOUNDED_LOOPS"
rc=0
blockers=()
warnings=()
pass_checks=0
fail_closed_checks=0

block() {
  blockers+=("$1")
  decision="BLOCKED_BRIK64_CLI_BETA9_BOUNDED_LOOPS"
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

  cat > pcd/repeat_score.pcd <<'PCD'
PC repeat_score {
  fn repeat_score(amount: i64, rate: i64) -> i64 {
    repeat 3 {
      if (amount > 100) {
        return amount + rate + 3;
      }
    }
    return amount - rate;
  }
}
PCD

  pass certify_repeat node "$BRIK" certify pcd/repeat_score.pcd
  for target in ts rust python; do
    pass "emit_repeat_$target" node "$BRIK" emit pcd/repeat_score.pcd --target "$target" --out "repeat-$target" --tests
  done
  pass ts_repeat node repeat-ts/program.test.mjs
  pass rust_compile_repeat rustc repeat-rust/program_test.rs -o repeat-rust/program_test
  pass rust_repeat ./repeat-rust/program_test
  pass python_repeat env PYTHONPATH=repeat-python python3 repeat-python/test_program.py

  node --input-type=module <<'NODE' >"$TMP_DIR/manual-repeat-ts.stdout" 2>"$TMP_DIR/manual-repeat-ts.stderr" || block "manual_ts_repeat_failed"
import { run } from './repeat-ts/program.mjs';
if (run(120, 7) !== 130) throw new Error('repeat high case failed');
if (run(80, 7) !== 73) throw new Error('repeat low case failed');
console.log('manual ts repeat subset: PASS');
NODE
  pass_checks=$((pass_checks + 1))

  cat > pcd/repeat_nonliteral.pcd <<'PCD'
PC repeat_nonliteral {
  fn repeat_nonliteral(input: i64) -> i64 {
    repeat input {
      return input;
    }
    return 0;
  }
}
PCD
  cat > pcd/repeat_zero.pcd <<'PCD'
PC repeat_zero {
  fn repeat_zero(input: i64) -> i64 {
    repeat 0 {
      return input;
    }
    return 0;
  }
}
PCD
  cat > pcd/repeat_too_large.pcd <<'PCD'
PC repeat_too_large {
  fn repeat_too_large(input: i64) -> i64 {
    repeat 65 {
      return input;
    }
    return 0;
  }
}
PCD
  cat > pcd/repeat_empty.pcd <<'PCD'
PC repeat_empty {
  fn repeat_empty(input: i64) -> i64 {
    repeat 1 {
    }
    return input;
  }
}
PCD

  expect_fail repeat_nonliteral "pcd_parse_error:repeat_requires_literal_bound" node "$BRIK" certify pcd/repeat_nonliteral.pcd
  expect_fail repeat_zero "pcd_parse_error:repeat_bound_out_of_range" node "$BRIK" certify pcd/repeat_zero.pcd
  expect_fail repeat_too_large "pcd_parse_error:repeat_bound_out_of_range" node "$BRIK" certify pcd/repeat_too_large.pcd
  expect_fail repeat_empty "pcd_parse_error:repeat_empty_body" node "$BRIK" certify pcd/repeat_empty.pcd
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
fixture_sha="sha256:$(sha256_file "$WORK_DIR/pcd/repeat_score.pcd")"
ts_sha="sha256:$(sha256_file "$WORK_DIR/repeat-ts/program.mjs")"
rust_sha="sha256:$(sha256_file "$WORK_DIR/repeat-rust/program.rs")"
python_sha="sha256:$(sha256_file "$WORK_DIR/repeat-python/program.py")"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

jq -n \
  --arg schemaVersion "brik64.cli_beta9_bounded_loops_gate.v1" \
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
    fixture:{path:"pcd/repeat_score.pcd", sha256:$fixture_sha},
    executedTargets:{
      typescript:{programSha256:$ts_sha, passed:($decision=="PASS_BRIK64_CLI_BETA9_BOUNDED_LOOPS")},
      rust:{programSha256:$rust_sha, passed:($decision=="PASS_BRIK64_CLI_BETA9_BOUNDED_LOOPS")},
      python:{programSha256:$python_sha, passed:($decision=="PASS_BRIK64_CLI_BETA9_BOUNDED_LOOPS")}
    },
    checks:{
      pass_checks:$pass_checks,
      fail_closed_checks:$fail_closed_checks,
      repeat_literal_bound:true,
      repeat_bound_max:64,
      for_loop_general:false,
      while_loop_general:false
    },
    adversarial:{
      nonliteral_bound_rejected:true,
      zero_bound_rejected:true,
      too_large_bound_rejected:true,
      empty_body_rejected:true,
      stack_trace_leaked:false
    },
    claim_boundary:{
      public_claims_allowed:false,
      public_release_allowed:false,
      formal_n5_claim_allowed:false,
      fixpoint_claim_allowed:false,
      self_hosting_claim_allowed:false,
      rust_independence_claim_allowed:false,
      compiler_functionality_scope:"supported_beta9_repeat_literal_subset_only"
    },
    blockers:$blockers,
    warnings:$warnings,
    next_action:(if $decision=="PASS_BRIK64_CLI_BETA9_BOUNDED_LOOPS" then "continue beta9 local PCD imports and scaffolds before L6 materialization" else "resolve bounded loop blockers" end)
  }' >"$REPORT_JSON"

cat "$REPORT_JSON"
exit "$rc"
