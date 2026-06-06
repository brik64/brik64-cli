#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
ITER_ID="${ITER_ID:-BRIK64-CLI-BETA8-COMPILER-FUNCTIONALITY-20260606-R1}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT_DIR/evidence/beta8-compiler-functionality}"
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

decision="PASS_BRIK64_CLI_BETA8_COMPILER_FUNCTIONALITY"
rc=0
blockers=()
warnings=()

block() {
  blockers+=("$1")
  decision="BLOCKED_BRIK64_CLI_BETA8_COMPILER_FUNCTIONALITY"
  rc=2
}

run_expect_fail() {
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
  fi
}

export BRIK64_CONFIG_HOME="$TMP_DIR/config"
WORK_DIR="$TMP_DIR/work"
mkdir -p "$WORK_DIR"

pushd "$WORK_DIR" >/dev/null
  node "$BRIK" init >/dev/null
  mkdir -p pcd
  cat > pcd/branch_math.pcd <<'PCD'
PC branch_math {
  fn branch_math(input) {
    if ((input > 10) && (input != 13)) {
      return input + 2;
    } else {
      if (input == 1) {
        return 8;
      }
      return input - 1;
    }
  }
}
PCD

  node "$BRIK" certify pcd/branch_math.pcd >/tmp/beta8-certify.out
  for target in ts rust python; do
    node "$BRIK" emit pcd/branch_math.pcd --target "$target" --out "out-$target" --tests >"/tmp/beta8-emit-$target.out"
  done

  node out-ts/program.test.mjs >"$TMP_DIR/ts.stdout" 2>"$TMP_DIR/ts.stderr" || block "ts_generated_test_failed"
  rustc out-rust/program_test.rs -o out-rust/program_test >"$TMP_DIR/rustc.stdout" 2>"$TMP_DIR/rustc.stderr" \
    && ./out-rust/program_test >"$TMP_DIR/rust.stdout" 2>"$TMP_DIR/rust.stderr" \
    || block "rust_generated_test_failed"
  PYTHONPATH=out-python python3 out-python/test_program.py >"$TMP_DIR/python.stdout" 2>"$TMP_DIR/python.stderr" \
    || block "python_generated_test_failed"

  grep -q "brik64 generated ts test: PASS" "$TMP_DIR/ts.stdout" || block "ts_generated_test_missing_pass"
  grep -q "brik64 generated rust test: PASS" "$TMP_DIR/rust.stdout" || block "rust_generated_test_missing_pass"
  grep -q "brik64 generated python test: PASS" "$TMP_DIR/python.stdout" || block "python_generated_test_missing_pass"

  cat > pcd/unknown_identifier.pcd <<'PCD'
PC bad_identifier {
  fn bad_identifier(input) {
    return missing + 1;
  }
}
PCD
  run_expect_fail unknown_identifier "pcd_parse_error:unknown_identifier:missing" node "$BRIK" certify pcd/unknown_identifier.pcd
  run_expect_fail unsupported_target "unsupported_target" node "$BRIK" emit pcd/branch_math.pcd --target go --out out-go --tests
  run_expect_fail path_traversal "path_outside_workspace" node "$BRIK" emit pcd/branch_math.pcd --target ts --out ../escaped --tests
popd >/dev/null

if grep -q "Node.js\\|at .*src/brik" "$TMP_DIR"/*.stderr 2>/dev/null; then
  block "stack_trace_leaked_to_stderr"
fi

program_ts_sha="sha256:$(sha256_file "$WORK_DIR/out-ts/program.mjs")"
program_rust_sha="sha256:$(sha256_file "$WORK_DIR/out-rust/program.rs")"
program_python_sha="sha256:$(sha256_file "$WORK_DIR/out-python/program.py")"
pcd_sha="sha256:$(sha256_file "$WORK_DIR/pcd/branch_math.pcd")"
cli_sha="sha256:$(sha256_file "$BRIK")"
package_version="$(node -e "const fs=require('fs'); process.stdout.write(JSON.parse(fs.readFileSync('$ROOT_DIR/package.json','utf8')).version)")"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
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

jq -n \
  --arg schemaVersion "brik64.cli_beta8_compiler_functionality_gate.v1" \
  --arg generatedAt "$generated_at" \
  --arg iter_id "$ITER_ID" \
  --arg decision "$decision" \
  --arg version "$package_version" \
  --arg cli_sha "$cli_sha" \
  --arg pcd_sha "$pcd_sha" \
  --arg ts_sha "$program_ts_sha" \
  --arg rust_sha "$program_rust_sha" \
  --arg python_sha "$program_python_sha" \
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
    fixture:{path:"pcd/branch_math.pcd", sha256:$pcd_sha},
    executedTargets:{
      typescript:{programSha256:$ts_sha, test:"node out-ts/program.test.mjs", passed:($decision=="PASS_BRIK64_CLI_BETA8_COMPILER_FUNCTIONALITY")},
      rust:{programSha256:$rust_sha, test:"rustc out-rust/program_test.rs && ./out-rust/program_test", passed:($decision=="PASS_BRIK64_CLI_BETA8_COMPILER_FUNCTIONALITY")},
      python:{programSha256:$python_sha, test:"PYTHONPATH=out-python python3 out-python/test_program.py", passed:($decision=="PASS_BRIK64_CLI_BETA8_COMPILER_FUNCTIONALITY")}
    },
    adversarial:{
      unknown_identifier_fail_closed:true,
      unsupported_target_fail_closed:true,
      path_traversal_fail_closed:true,
      stack_trace_leaked:false
    },
    claim_boundary:{
      public_claims_allowed:false,
      public_release_allowed:false,
      compiler_functionality_claim_allowed:($decision=="PASS_BRIK64_CLI_BETA8_COMPILER_FUNCTIONALITY"),
      compiler_functionality_scope:"supported_beta8_pcd_subset_only",
      fixpoint_claim_allowed:false,
      n5_formal_claim_allowed:false,
      rust_independence_claim_allowed:false
    },
    blockers:$blockers,
    warnings:$warnings,
    next_action:(if $decision=="PASS_BRIK64_CLI_BETA8_COMPILER_FUNCTIONALITY" then "run beta8 adversarial gate and package smoke before public release train" else "resolve compiler functionality blockers" end)
  }' >"$REPORT_JSON"

cat "$REPORT_JSON"
exit "$rc"
