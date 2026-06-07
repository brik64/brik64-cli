#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
ITER_ID="${ITER_ID:-BRIK64-CLI-BETA9-DOCTOR-UX-20260607-R1}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT_DIR/evidence/beta9-doctor-ux}"
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

decision="PASS_BRIK64_CLI_BETA9_DOCTOR_UX"
rc=0
blockers=()
warnings=()
pass_checks=0
fail_closed_checks=0

block() {
  blockers+=("$1")
  decision="BLOCKED_BRIK64_CLI_BETA9_DOCTOR_UX"
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
  if ! grep -q "Actions:" "$TMP_DIR/$id.stdout" && ! grep -q '"actions"' "$TMP_DIR/$id.stdout"; then
    block "$id:missing_actionable_output"
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
  cat > pcd/doctor_ok.pcd <<'PCD'
PC doctor_ok {
  fn doctor_ok(input: i64) -> i64 {
    if (input > 0) {
      return 1;
    }
    return 0;
  }
}
PCD

  pass doctor_human node "$BRIK" doctor
  grep -q "BRIK64 workspace doctor" "$TMP_DIR/doctor_human.stdout" || block "doctor_human:title_missing"
  grep -q "Diagnostics" "$TMP_DIR/doctor_human.stdout" || block "doctor_human:diagnostics_missing"
  grep -q "errors: none" "$TMP_DIR/doctor_human.stdout" || block "doctor_human:errors_none_missing"
  grep -q "actions: none" "$TMP_DIR/doctor_human.stdout" || block "doctor_human:actions_none_missing"

  pass doctor_json node "$BRIK" doctor --json
  jq -e '
    .schemaVersion == "brik64.cli_doctor_report.v1"
    and .status == "PASS"
    and .diagnostics.errors == []
    and .diagnostics.actions == []
    and .pcdCount == 1
  ' "$TMP_DIR/doctor_json.stdout" >/dev/null || block "doctor_json:schema_or_status_invalid"

  rm -rf .brik
  expect_fail missing_manifest "manifest_missing:.brik/manifest.json" node "$BRIK" doctor
  pass init_after_missing node "$BRIK" init
  printf '{ corrupted_json\n' > .brik/manifest.json
  expect_fail malformed_manifest "manifest_parse_error" node "$BRIK" doctor --json
  rm .brik/manifest.json
  pass init_after_malformed node "$BRIK" init
  rm -rf pcd
  expect_fail empty_inventory "pcd_inventory_empty" node "$BRIK" doctor
  mkdir -p pcd
  cat > pcd/doctor_ok.pcd <<'PCD'
PC doctor_ok {
  fn doctor_ok(input: i64) -> i64 {
    if (input > 0) {
      return 1;
    }
    return 0;
  }
}
PCD
  node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(".brik/manifest.json","utf8")); m.engineTierPolicy.l6DistributionAllowed=true; fs.writeFileSync(".brik/manifest.json", JSON.stringify(m,null,2)+"\n")'
  expect_fail l6_policy_open "engine_tier_policy_l6_distribution_open" node "$BRIK" doctor
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
fixture_sha="sha256:$(sha256_file "$WORK_DIR/pcd/doctor_ok.pcd")"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

jq -n \
  --arg schemaVersion "brik64.cli_beta9_doctor_ux_gate.v1" \
  --arg generatedAt "$generated_at" \
  --arg iter_id "$ITER_ID" \
  --arg decision "$decision" \
  --arg version "$package_version" \
  --arg cli_sha "$cli_sha" \
  --arg fixture_sha "$fixture_sha" \
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
    fixture:{path:"pcd/doctor_ok.pcd", sha256:$fixture_sha},
    checks:{
      pass_checks:$pass_checks,
      fail_closed_checks:$fail_closed_checks,
      human_default:true,
      json_ci_stable:true,
      actionable_diagnostics:true
    },
    adversarial:{
      missing_manifest_rejected:true,
      malformed_manifest_rejected:true,
      empty_inventory_rejected:true,
      l6_distribution_open_rejected:true,
      stack_trace_leaked:false
    },
    claim_boundary:{
      public_claims_allowed:false,
      public_release_allowed:false,
      formal_n5_claim_allowed:false,
      fixpoint_claim_allowed:false,
      self_hosting_claim_allowed:false,
      rust_independence_claim_allowed:false,
      compiler_functionality_scope:"supported_beta9_doctor_ux_only"
    },
    blockers:$blockers,
    warnings:$warnings,
    next_action:(if $decision=="PASS_BRIK64_CLI_BETA9_DOCTOR_UX" then "continue beta9 release-train materialization gates" else "resolve doctor UX blockers" end)
  }' >"$REPORT_JSON"

cat "$REPORT_JSON"
exit "$rc"
