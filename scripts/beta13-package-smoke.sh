#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.1.0-beta.13"
PKG_DIR="$ROOT_DIR/evidence/beta13-package"
OUT_DIR="$ROOT_DIR/evidence/beta13-package-smoke"
MANIFEST="$PKG_DIR/package.manifest.json"
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
need_cmd tar
need_cmd shasum

sha256_file() { shasum -a 256 "$1" | awk '{print $1}'; }

run_pass() {
  local id="$1"
  local expected="${2:-}"
  shift 2
  "$@" >"$TMP_DIR/$id.stdout" 2>"$TMP_DIR/$id.stderr" || {
    rc=$?
    printf '%s:rc=%s\n' "$id" "$rc" >&2
    cat "$TMP_DIR/$id.stderr" >&2
    exit "$rc"
  }
  if [[ -n "$expected" ]] && ! grep -q "$expected" "$TMP_DIR/$id.stdout" "$TMP_DIR/$id.stderr"; then
    printf '%s:missing:%s\n' "$id" "$expected" >&2
    exit 1
  fi
}

run_fail() {
  local id="$1"
  local expected="$2"
  shift 2
  set +e
  "$@" >"$TMP_DIR/$id.stdout" 2>"$TMP_DIR/$id.stderr"
  local cmd_rc=$?
  set -e
  if [[ "$cmd_rc" -eq 0 ]]; then
    printf '%s:unexpected_success\n' "$id" >&2
    exit 1
  fi
  if ! grep -q "$expected" "$TMP_DIR/$id.stdout" "$TMP_DIR/$id.stderr"; then
    printf '%s:missing:%s\n' "$id" "$expected" >&2
    exit 1
  fi
}

mkdir -p "$OUT_DIR"

manifest_version="$(jq -r '.version' "$MANIFEST")"
manifest_decision="$(jq -r '.decision' "$MANIFEST")"
release_eligible="$(jq -r '.releaseEligible' "$MANIFEST")"
package_rel="$(jq -r '.package.path' "$MANIFEST")"
package_sha="$(jq -r '.package.sha256' "$MANIFEST")"
package_path="$ROOT_DIR/$package_rel"

[[ "$manifest_version" == "$VERSION" ]] || { echo "manifest_version_drift:$manifest_version" >&2; exit 1; }
[[ "$manifest_decision" == "PASS_BRIK64_CLI_BETA13_PACKAGE_BUILT" ]] || { echo "package_decision_drift:$manifest_decision" >&2; exit 1; }
[[ "$release_eligible" == "false" ]] || { echo "beta13_candidate_should_not_be_public_release_eligible" >&2; exit 1; }
[[ "$(sha256_file "$package_path")" == "$package_sha" ]] || { echo "package_hash_mismatch" >&2; exit 1; }

run_pass extract "" tar -xzf "$package_path" -C "$TMP_DIR"
EXTRACTED="$TMP_DIR/brik64-cli-$VERSION"
BRIK="$EXTRACTED/src/brik.js"
CONFIG_HOME="$TMP_DIR/config"
WORK_DIR="$TMP_DIR/work"
mkdir -p "$WORK_DIR"

if [[ -e "$EXTRACTED/evidence" ]]; then
  echo "package_contains_evidence_payload" >&2
  exit 1
fi

run_pass version "BRIK64 CLI $VERSION" node "$BRIK" --version
run_pass help "explain <file.pcd>" node "$BRIK" --help
run_pass telemetry_help "telemetry status" node "$BRIK" --help

pushd "$WORK_DIR" >/dev/null
  run_pass init "created=.brik/manifest.json" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" init
  mkdir -p pcd
  cat > pcd/leaf.pcd <<'PCD'
PC leaf {
  fn leaf(input: i64) -> i64 {
    return input + 1;
  }
}
PCD
  cat > pcd/mid.pcd <<'PCD'
use leaf;
PC mid {
  fn mid(input: i64) -> i64 {
    return leaf(input) + 3;
  }
}
PCD
  cat > pcd/root.pcd <<'PCD'
use mid;
PC root {
  fn root(input: i64) -> i64 {
    if (mid(input) > 10) {
      return mid(input);
    }
    return 0;
  }
}
PCD
  cat > pcd/repeat_const.pcd <<'PCD'
PC repeat_const {
  const LIMIT: i64 = 2;
  fn repeat_const(input: i64) -> i64 {
    repeat LIMIT {
      return input + 1;
    }
    return 0;
  }
}
PCD
  run_pass explain "status: PASS" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" explain pcd/root.pcd
  run_pass explain_const "status: PASS" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" explain pcd/repeat_const.pcd
  run_pass explain_json "\"schemaVersion\": \"brik64.cli_explain_report.v1\"" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" explain pcd/root.pcd --json
  run_pass lock "\"schemaVersion\": \"brik64.cli_lockfile.v1\"" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" lock --json
  run_pass telemetry_status "\"enabled\": false" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" telemetry status
  run_pass telemetry_explain "networkSent=false" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" telemetry explain
  run_pass feedback "\\[redacted" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" feedback --dry-run --category bug --message 'token=abc user@example.com'
  cat > sample.js <<'JS'
function addFee(x) { return x + 40; }
const half = (value) => value / 2;
JS
  run_pass lift_js "\"schemaVersion\": \"brik64.cli_lift_preview.v1\"" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" lift js sample.js --preview --json
  run_pass adoption_report "\"schemaVersion\": \"brik64.cli_adoption_report.v1\"" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" adoption report --json
  run_pass certify "certificate=pcd/root.pcd.cert.json" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" certify pcd/root.pcd
  run_pass emit_ts "generated=" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" emit pcd/root.pcd --target ts --out out-ts --tests
  run_pass ts_generated "brik64 generated ts test: PASS" node out-ts/program.test.mjs
  cat > pcd/cycle_a.pcd <<'PCD'
use cycle_b;
PC cycle_a {
  fn cycle_a(input: i64) -> i64 {
    return cycle_b(input);
  }
}
PCD
  cat > pcd/cycle_b.pcd <<'PCD'
use cycle_a;
PC cycle_b {
  fn cycle_b(input: i64) -> i64 {
    return cycle_a(input);
  }
}
PCD
  run_fail import_cycle "import_cycle" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" explain pcd/cycle_a.pcd --json
popd >/dev/null

jq -n \
  --arg version "$VERSION" \
  --arg packagePath "$package_rel" \
  --arg packageSha "$package_sha" \
  '{
    schemaVersion:"brik64.cli_beta13_package_smoke.v1",
    version:$version,
    decision:"PASS_BRIK64_CLI_BETA13_LOCAL_PACKAGE_SMOKE",
    releaseEligible:false,
    lane:"cli_0_1_beta13",
    package:{path:$packagePath, sha256:$packageSha},
    checks:[
      "extract",
      "package_content_snapshot",
      "version",
      "help",
      "init",
      "explain",
      "explain_json",
      "lock_json",
      "telemetry_status",
      "telemetry_explain",
      "feedback_redaction",
      "lift_js_preview",
      "adoption_report_json",
      "certify",
      "emit_ts",
      "generated_ts_exec",
      "import_cycle_fail_closed"
    ],
    claim_boundary:{
      public_claims_allowed:false,
      public_release_allowed:false,
      local_package_smoke_passed:true,
      fixpoint_claim_allowed:false,
      n5_formal_claim_allowed:false,
      rust_independence_claim_allowed:false
    },
    next_action:"run release train dry-run, final GitHub Release asset publication, curl/GCP staging and live verification"
  }' > "$OUT_DIR/report.json"

printf 'decision=PASS_BRIK64_CLI_BETA13_LOCAL_PACKAGE_SMOKE\n'
printf 'checks=17\n'
