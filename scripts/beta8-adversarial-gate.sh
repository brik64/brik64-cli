#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
ITER_ID="${ITER_ID:-BRIK64-CLI-BETA8-ADVERSARIAL-20260606-R1}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT_DIR/evidence/beta8-adversarial}"
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

decision="PASS_BRIK64_CLI_BETA8_ADVERSARIAL"
rc=0
blockers=()
warnings=()
pass_checks=0
fail_closed_checks=0

block() {
  blockers+=("$1")
  decision="BLOCKED_BRIK64_CLI_BETA8_ADVERSARIAL"
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

  cat > pcd/edge_precedence.pcd <<'PCD'
PC edge_precedence {
  fn edge_precedence(input) {
    if (((input + 2) * 3 >= 15) || (input == -4)) {
      return (input * input) - 1;
    } else {
      return -input + 7;
    }
  }
}
PCD

  pass certify_edge node "$BRIK" certify pcd/edge_precedence.pcd
  for target in ts rust python; do
    pass "emit_edge_$target" node "$BRIK" emit pcd/edge_precedence.pcd --target "$target" --out "edge-$target" --tests
  done
  pass ts_edge node edge-ts/program.test.ts
  pass rust_compile_edge rustc edge-rust/program_test.rs -o edge-rust/program_test
  pass rust_edge ./edge-rust/program_test
  pass python_edge env PYTHONPATH=edge-python python3 edge-python/test_program.py

  : > pcd/empty.pcd
  printf 'PC zero { fn zero(input) { return input; } }\0' > pcd/binary.pcd
  python3 - <<'PY'
from pathlib import Path
Path("pcd/too_large.pcd").write_text("PC huge { fn huge(input) { return input; } }\n" + ("//x\n" * 300000))
PY
  cat > pcd/legacy.pcd <<'PCD'
pc legacy {
  fn legacy(input) {
    return input;
  }
}
PCD
  cat > pcd/missing_fn.pcd <<'PCD'
PC missing_fn {
  return 1;
}
PCD
  cat > pcd/too_many_params.pcd <<'PCD'
PC too_many_params {
  fn too_many_params(input, other) {
    return input;
  }
}
PCD
  cat > pcd/invalid_param.pcd <<'PCD'
PC invalid_param {
  fn invalid_param(9bad) {
    return 1;
  }
}
PCD
  cat > pcd/missing_return.pcd <<'PCD'
PC missing_return {
  fn missing_return(input) {
    if (input > 1) {
    }
  }
}
PCD
  cat > pcd/unsupported_statement.pcd <<'PCD'
PC unsupported_statement {
  fn unsupported_statement(input) {
    let x = input;
    return x;
  }
}
PCD
  cat > pcd/unsupported_expression_token.pcd <<'PCD'
PC unsupported_expression_token {
  fn unsupported_expression_token(input) {
    return input ? 1 : 0;
  }
}
PCD
  cat > pcd/malformed_expression.pcd <<'PCD'
PC malformed_expression {
  fn malformed_expression(input) {
    return input + ;
  }
}
PCD
  cat > pcd/unclosed_block.pcd <<'PCD'
PC unclosed_block {
  fn unclosed_block(input) {
    if (input > 1) {
      return 1;
  }
}
PCD

  expect_fail empty "pcd_empty" node "$BRIK" certify pcd/empty.pcd
  expect_fail binary "pcd_binary_input" node "$BRIK" certify pcd/binary.pcd
  expect_fail too_large "pcd_too_large" node "$BRIK" certify pcd/too_large.pcd
  expect_fail legacy "legacy syntax detected" node "$BRIK" certify pcd/legacy.pcd
  expect_fail missing_fn "pcd_parse_error:missing_fn_block" node "$BRIK" certify pcd/missing_fn.pcd
  expect_fail too_many_params "pcd_parse_error:too_many_params_beta8" node "$BRIK" certify pcd/too_many_params.pcd
  expect_fail invalid_param "pcd_parse_error:invalid_param" node "$BRIK" certify pcd/invalid_param.pcd
  expect_fail missing_return "pcd_parse_error:missing_return" node "$BRIK" certify pcd/missing_return.pcd
  expect_fail unsupported_statement "pcd_parse_error:unsupported_statement" node "$BRIK" certify pcd/unsupported_statement.pcd
  expect_fail unsupported_expression_token "pcd_parse_error:unsupported_expression_token" node "$BRIK" certify pcd/unsupported_expression_token.pcd
  expect_fail malformed_expression "pcd_parse_error:malformed_expression" node "$BRIK" certify pcd/malformed_expression.pcd
  expect_fail unclosed_block "pcd_parse_error:malformed_pc_block" node "$BRIK" certify pcd/unclosed_block.pcd
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
edge_sha="sha256:$(sha256_file "$WORK_DIR/pcd/edge_precedence.pcd")"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

jq -n \
  --arg schemaVersion "brik64.cli_beta8_adversarial_gate.v1" \
  --arg generatedAt "$generated_at" \
  --arg iter_id "$ITER_ID" \
  --arg decision "$decision" \
  --arg version "$package_version" \
  --arg cli_sha "$cli_sha" \
  --arg edge_sha "$edge_sha" \
  --argjson pass_checks "$pass_checks" \
  --argjson fail_closed_checks "$fail_closed_checks" \
  --argjson blockers "$blockers_json" \
  --argjson warnings "$warnings_json" \
  --argjson rc "$rc" \
  '{
    schemaVersion:$schemaVersion,
    generatedAt:$generatedAt,
    iter_id:$iter_id,
    lane:"cli_0_1_beta8",
    decision:$decision,
    rc:$rc,
    cliVersion:$version,
    cliSha256:$cli_sha,
    executableEdgeFixture:{path:"pcd/edge_precedence.pcd", sha256:$edge_sha},
    passChecks:$pass_checks,
    failClosedChecks:$fail_closed_checks,
    generatedTargetExecution:{
      typescript:true,
      rust:true,
      python:true
    },
    failClosedSurface:[
      "empty_pcd",
      "binary_input",
      "too_large_input",
      "legacy_syntax",
      "missing_fn",
      "too_many_params",
      "invalid_param",
      "missing_return",
      "unsupported_statement",
      "unsupported_expression_token",
      "malformed_expression",
      "unclosed_block"
    ],
    claim_boundary:{
      public_claims_allowed:false,
      public_release_allowed:false,
      adversarial_gate_passed:($decision=="PASS_BRIK64_CLI_BETA8_ADVERSARIAL"),
      compiler_functionality_scope:"supported_beta8_pcd_subset_only",
      fixpoint_claim_allowed:false,
      n5_formal_claim_allowed:false,
      rust_independence_claim_allowed:false
    },
    blockers:$blockers,
    warnings:$warnings,
    next_action:(if $decision=="PASS_BRIK64_CLI_BETA8_ADVERSARIAL" then "run beta8 package smoke and release-train sync gates" else "resolve beta8 adversarial blockers" end)
  }' >"$REPORT_JSON"

cat "$REPORT_JSON"
exit "$rc"
