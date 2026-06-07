#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
ITER_ID="${ITER_ID:-BRIK64-CLI-BETA9-SCAFFOLDS-20260607-R1}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT_DIR/evidence/beta9-scaffolds}"
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
need_cmd npm
need_cmd cargo
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

decision="PASS_BRIK64_CLI_BETA9_SCAFFOLDS"
rc=0
blockers=()
warnings=()
pass_checks=0
fail_closed_checks=0

block() {
  blockers+=("$1")
  decision="BLOCKED_BRIK64_CLI_BETA9_SCAFFOLDS"
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

file_required() {
  local id="$1"
  local file="$2"
  if [[ ! -s "$file" ]]; then
    block "$id:missing_file:$file"
    return
  fi
  pass_checks=$((pass_checks + 1))
}

export BRIK64_CONFIG_HOME="$TMP_DIR/config"
WORK_DIR="$TMP_DIR/work"
mkdir -p "$WORK_DIR"

pushd "$WORK_DIR" >/dev/null
  pass init node "$BRIK" init
  mkdir -p pcd

  cat > pcd/scaffold_score.pcd <<'PCD'
PC scaffold_score {
  fn scaffold_score(amount: i64, rate: i64) -> i64 {
    repeat 2 {
      if (has({base: amount, fee: rate, total: amount + rate}, total) == 1) {
        return [amount, rate, amount + rate][2];
      }
    }
    return amount - rate;
  }
}
PCD

  pass certify_scaffold node "$BRIK" certify pcd/scaffold_score.pcd
  for target in ts rust python; do
    pass "emit_scaffold_$target" node "$BRIK" emit pcd/scaffold_score.pcd --target "$target" --out "scaffold-$target" --tests
  done

  file_required ts_package scaffold-ts/package.json
  file_required ts_tsconfig scaffold-ts/tsconfig.json
  file_required ts_src_program scaffold-ts/src/program.mjs
  file_required rust_cargo scaffold-rust/Cargo.toml
  file_required rust_src_lib scaffold-rust/src/lib.rs
  file_required python_pyproject scaffold-python/pyproject.toml
  file_required python_package scaffold-python/brik64_generated/program.py
  file_required python_test scaffold-python/tests/test_program.py

  pass ts_root_test node scaffold-ts/program.test.mjs
  pass ts_package_test npm --prefix scaffold-ts test --silent
  pass rust_root_compile rustc scaffold-rust/program_test.rs -o scaffold-rust/program_test
  pass rust_root_test ./scaffold-rust/program_test
  pass rust_cargo_test cargo test --manifest-path scaffold-rust/Cargo.toml --quiet
  pass python_root_test env PYTHONPATH=scaffold-python python3 scaffold-python/test_program.py
  pass python_package_test env PYTHONPATH=scaffold-python python3 scaffold-python/tests/test_program.py

  node - <<'NODE' >"$TMP_DIR/assert-package-json.stdout" 2>"$TMP_DIR/assert-package-json.stderr" || block "package_json_assertion_failed"
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('scaffold-ts/package.json', 'utf8'));
const tsconfig = JSON.parse(fs.readFileSync('scaffold-ts/tsconfig.json', 'utf8'));
if (pkg.private !== true) throw new Error('package must stay private');
if (pkg.type !== 'module') throw new Error('package type module missing');
if (!tsconfig.compilerOptions || tsconfig.compilerOptions.strict !== true) throw new Error('strict tsconfig missing');
NODE
  pass_checks=$((pass_checks + 1))
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
fixture_sha="sha256:$(sha256_file "$WORK_DIR/pcd/scaffold_score.pcd")"
ts_package_sha="sha256:$(sha256_file "$WORK_DIR/scaffold-ts/package.json")"
rust_cargo_sha="sha256:$(sha256_file "$WORK_DIR/scaffold-rust/Cargo.toml")"
python_pyproject_sha="sha256:$(sha256_file "$WORK_DIR/scaffold-python/pyproject.toml")"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

jq -n \
  --arg schemaVersion "brik64.cli_beta9_scaffolds_gate.v1" \
  --arg generatedAt "$generated_at" \
  --arg iter_id "$ITER_ID" \
  --arg decision "$decision" \
  --arg version "$package_version" \
  --arg cli_sha "$cli_sha" \
  --arg fixture_sha "$fixture_sha" \
  --arg ts_package_sha "$ts_package_sha" \
  --arg rust_cargo_sha "$rust_cargo_sha" \
  --arg python_pyproject_sha "$python_pyproject_sha" \
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
    fixture:{path:"pcd/scaffold_score.pcd", sha256:$fixture_sha},
    scaffoldHashes:{
      typescriptPackageJson:$ts_package_sha,
      rustCargoToml:$rust_cargo_sha,
      pythonPyprojectToml:$python_pyproject_sha
    },
    checks:{
      pass_checks:$pass_checks,
      fail_closed_checks:$fail_closed_checks,
      typescript_package_json:true,
      typescript_tsconfig:true,
      rust_cargo_toml:true,
      rust_src_lib:true,
      python_pyproject:true,
      python_package_layout:true
    },
    claim_boundary:{
      public_claims_allowed:false,
      public_release_allowed:false,
      formal_n5_claim_allowed:false,
      fixpoint_claim_allowed:false,
      self_hosting_claim_allowed:false,
      rust_independence_claim_allowed:false,
      compiler_functionality_scope:"supported_beta9_target_scaffold_subset_only"
    },
    blockers:$blockers,
    warnings:$warnings,
    next_action:(if $decision=="PASS_BRIK64_CLI_BETA9_SCAFFOLDS" then "continue beta9 local PCD imports before L6 materialization" else "resolve scaffold blockers" end)
  }' >"$REPORT_JSON"

cat "$REPORT_JSON"
exit "$rc"
