#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.1.0-beta.8"
PKG_DIR="$ROOT_DIR/evidence/beta8-package"
OUT_DIR="$ROOT_DIR/evidence/beta8-package-smoke"
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
need_cmd python3
need_cmd rustc
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
[[ "$manifest_decision" == "PASS_BRIK64_CLI_BETA8_PACKAGE_BUILT" ]] || { echo "package_decision_drift:$manifest_decision" >&2; exit 1; }
[[ "$release_eligible" == "false" ]] || { echo "beta8_candidate_should_not_be_public_release_eligible" >&2; exit 1; }
[[ "$(sha256_file "$package_path")" == "$package_sha" ]] || { echo "package_hash_mismatch" >&2; exit 1; }

run_pass extract "" tar -xzf "$package_path" -C "$TMP_DIR"
EXTRACTED="$TMP_DIR/brik64-cli-$VERSION"
BRIK="$EXTRACTED/src/brik.js"
CONFIG_HOME="$TMP_DIR/config"
WORK_DIR="$TMP_DIR/work"
mkdir -p "$WORK_DIR"

run_pass version "BRIK64 CLI $VERSION" node "$BRIK" --version
run_pass help "emit <file.pcd>" node "$BRIK" --help
grep -q -- "--target <ts|rust|python>" "$TMP_DIR/help.stdout" "$TMP_DIR/help.stderr" || {
  echo "help:missing:--target <ts|rust|python>" >&2
  exit 1
}
cat > "$WORK_DIR/program.pcd" <<'PCD'
PC packaged_program {
  fn packaged_program(input) {
    if ((input >= 5) && (input != 9)) {
      return input * 2;
    } else {
      return input + 3;
    }
  }
}
PCD

pushd "$WORK_DIR" >/dev/null
  run_pass init "created=.brik/manifest.json" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" init
  run_pass certify "certificate=program.pcd.cert.json" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" certify program.pcd
  for target in ts rust python; do
    run_pass "emit_$target" "generated=" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" emit program.pcd --target "$target" --out "out-$target" --tests
  done
  run_pass ts_generated "brik64 generated ts test: PASS" node out-ts/program.test.ts
  run_pass rust_compile "" rustc out-rust/program_test.rs -o out-rust/program_test
  run_pass rust_generated "brik64 generated rust test: PASS" ./out-rust/program_test
  run_pass python_generated "brik64 generated python test: PASS" env PYTHONPATH=out-python python3 out-python/test_program.py
  run_pass verify "verification=PASS" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" verify program.pcd
  run_fail cloud_verify_no_entitlement "managed_entitlement_required" env BRIK64_CONFIG_HOME="$CONFIG_HOME" node "$BRIK" verify program.pcd --cloud
popd >/dev/null

jq -n \
  --arg version "$VERSION" \
  --arg packagePath "$package_rel" \
  --arg packageSha "$package_sha" \
  '{
    schemaVersion:"brik64.cli_beta8_package_smoke.v1",
    version:$version,
    decision:"PASS_BRIK64_CLI_BETA8_LOCAL_PACKAGE_SMOKE",
    releaseEligible:false,
    lane:"cli_0_1_beta8",
    package:{path:$packagePath, sha256:$packageSha},
    checks:[
      "extract",
      "version",
      "help",
      "init",
      "certify",
      "emit_ts",
      "emit_rust",
      "emit_python",
      "generated_ts_exec",
      "generated_rust_exec",
      "generated_python_exec",
      "verify",
      "cloud_verify_no_entitlement"
    ],
    claim_boundary:{
      public_claims_allowed:false,
      public_release_allowed:false,
      local_package_smoke_passed:true,
      fixpoint_claim_allowed:false,
      n5_formal_claim_allowed:false,
      rust_independence_claim_allowed:false
    },
    next_action:"run platform smoke, sync gates and public release train"
  }' > "$OUT_DIR/report.json"

printf 'decision=PASS_BRIK64_CLI_BETA8_LOCAL_PACKAGE_SMOKE\n'
printf 'checks=13\n'
