#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.1.0-beta.15.5"
PKG_DIR="$ROOT_DIR/evidence/beta15_5-package"
OUT_DIR="$ROOT_DIR/evidence/beta15_5-package-smoke"
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
need_cmd python3

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
[[ "$manifest_decision" == "PASS_BRIK64_CLI_BETA15_5_PACKAGE_BUILT" ]] || { echo "package_decision_drift:$manifest_decision" >&2; exit 1; }
[[ "$release_eligible" == "false" ]] || { echo "beta15_5_candidate_should_not_be_public_release_eligible" >&2; exit 1; }
[[ "$(sha256_file "$package_path")" == "$package_sha" ]] || { echo "package_hash_mismatch" >&2; exit 1; }

run_pass extract "" tar -xzf "$package_path" -C "$TMP_DIR"
EXTRACTED="$TMP_DIR/brik64-cli-$VERSION"
BRIK="$EXTRACTED/src/brik.js"
WORK_DIR="$TMP_DIR/work"
mkdir -p "$WORK_DIR"

[[ -f "$EXTRACTED/evidence/beta15_5-pre-public-rc/report.json" ]] || {
  echo "package_missing_beta15_5_pre_public_evidence" >&2
  exit 1
}
jq -e '.decision == "PASS_BRIK64_CLI_BETA15_5_PRE_PUBLIC_RC_GATE"' "$EXTRACTED/evidence/beta15_5-pre-public-rc/report.json" >/dev/null || {
  echo "package_beta15_5_pre_public_gate_not_pass" >&2
  exit 1
}
[[ -f "$EXTRACTED/pcd/beta15_5/cli/rust_f64_polymer_codegen.pcd" ]] || {
  echo "package_missing_beta15_5_pcd_contracts" >&2
  exit 1
}
[[ -f "$EXTRACTED/pcd/beta15_5/harness/lift_roundtrip_gate.pcd" ]] || {
  echo "package_missing_beta15_5_lift_roundtrip_contract" >&2
  exit 1
}
[[ -f "$EXTRACTED/pcd/beta15_5/release/public_surface_sync.pcd" ]] || {
  echo "package_missing_beta15_5_public_surface_contract" >&2
  exit 1
}
[[ -f "$EXTRACTED/evidence/beta15_5-rust-f64-command-lift/report.json" ]] || {
  echo "package_missing_beta15_5_rust_f64_command_lift_evidence" >&2
  exit 1
}
jq -e '.decision == "PASS_BRIK64_CLI_BETA15_5_RUST_F64_COMMAND_LIFT_GATE"' "$EXTRACTED/evidence/beta15_5-rust-f64-command-lift/report.json" >/dev/null || {
  echo "package_beta15_5_rust_f64_command_lift_gate_not_pass" >&2
  exit 1
}

run_pass version "BRIK64 CLI $VERSION" node "$BRIK" --version
run_pass help "inspect/verify local append-only" node "$BRIK" --help

pushd "$WORK_DIR" >/dev/null
  run_pass init "created=.brik/manifest.json" env BRIK64_NO_BANNER=1 node "$BRIK" init
  mkdir -p pcd
  cat > pcd/a.pcd <<'PCD'
// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC a {
    domain input: i64 [0, 255];
    fn a(input: i64) -> i64 {
        if (input == 0) return 1;
        return 2;
    }
}
PCD
  cat > pcd/b.pcd <<'PCD'
// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC b {
    domain input: i64 [0, 255];
    fn b(input: i64) -> i64 {
        if (input == 0) return 3;
        return 4;
    }
}
PCD
  run_pass certify_a "certificate=pcd/a.pcd.cert.json" env BRIK64_NO_BANNER=1 node "$BRIK" certify pcd/a.pcd
  run_pass certify_b "certificate=pcd/b.pcd.cert.json" env BRIK64_NO_BANNER=1 node "$BRIK" certify pcd/b.pcd
  run_fail polymer_no_root "polymerize_root_required" env BRIK64_NO_BANNER=1 node "$BRIK" polymerize pcd/a.pcd pcd/b.pcd --inline --out pcd/polymer.pcd
  run_pass polymer_root "polymer=pcd/polymer.pcd" env BRIK64_NO_BANNER=1 node "$BRIK" polymerize pcd/a.pcd pcd/b.pcd --inline --root b --out pcd/polymer.pcd
  run_pass certify_polymer "certificate=pcd/polymer.pcd.cert.json" env BRIK64_NO_BANNER=1 node "$BRIK" certify pcd/polymer.pcd
  run_pass emit_a "tests=out/a/tests/test_a.py" env BRIK64_NO_BANNER=1 node "$BRIK" emit pcd/a.pcd --target python --out out/a --tests
  run_pass emit_b "tests=out/b/tests/test_b.py" env BRIK64_NO_BANNER=1 node "$BRIK" emit pcd/b.pcd --target python --out out/b --tests
  test -f out/a/brik64_generated_a/program.py
  test -f out/b/brik64_generated_b/program.py
  test -f out/a/tests/test_a.py
  test -f out/b/tests/test_b.py
  run_pass generated_python_tests "generated_python_tests=" python3 - <<'PY'
import importlib.util
import pathlib
import sys

root = pathlib.Path.cwd()
count = 0
for test_file in sorted(root.glob("**/tests/test_*.py")):
    spec = importlib.util.spec_from_file_location(test_file.stem, test_file)
    module = importlib.util.module_from_spec(spec)
    sys.path.insert(0, str(test_file.parent.parent))
    spec.loader.exec_module(module)
    for name in sorted(dir(module)):
        if name.startswith("test_") and callable(getattr(module, name)):
            getattr(module, name)()
            count += 1
if count == 0:
    raise SystemExit("no_generated_tests_executed")
print(f"generated_python_tests={count}")
PY
  run_pass ledger_verify '"status": "PASS"' env BRIK64_NO_BANNER=1 node "$BRIK" ledger verify --json
  events=".brik/ledger/events.jsonl"
  head=".brik/ledger/head.json"
  mv "$head" "$head.bak"
  run_fail ledger_missing_head "ledger_head_missing" env BRIK64_NO_BANNER=1 node "$BRIK" ledger verify --json
  mv "$head.bak" "$head"
  cp "$events" "$events.bak"
  python3 - "$events" <<'PY'
import json, sys
path = sys.argv[1]
lines = [line for line in open(path).read().splitlines() if line.strip()]
event = json.loads(lines[0])
event.setdefault("payload", {})["tampered"] = True
lines[0] = json.dumps(event, separators=(",", ":"))
open(path, "w").write("\n".join(lines) + "\n")
PY
  run_fail ledger_tamper "ledger_event_hash_mismatch" env BRIK64_NO_BANNER=1 node "$BRIK" ledger verify --json
  mv "$events.bak" "$events"
  mkdir -p .brik/audit
  python3 - <<'PY'
import json
path = ".brik/manifest.json"
manifest = json.load(open(path))
manifest["claimBoundary"] = {"releaseAllowed": False}
json.dump(manifest, open(path, "w"), indent=2)
open(".brik/audit/FINAL_AUDIT_REPORT.md", "w").write("# Audit\n\nRELEASE READY\n")
PY
  run_fail claim_contradiction "claim_report_release_ready_contradiction" env BRIK64_NO_BANNER=1 node "$BRIK" doctor --json
popd >/dev/null

jq -n \
  --arg version "$VERSION" \
  '{
    schemaVersion:"brik64.cli_beta15_5_package_smoke_report.v1",
    version:$version,
    decision:"PASS_BRIK64_CLI_BETA15_5_PACKAGE_SMOKE",
    releaseEligible:false,
    checked:[
      "package_sha",
      "embedded_beta15_5_evidence",
      "embedded_beta15_5_rust_polymer_domain_gate",
      "version",
      "ledger_help",
      "certify",
      "polymer_explicit_root",
      "python_emit_package_layout",
      "generated_python_tests",
      "ledger_missing_head_fail_closed",
      "ledger_tamper_fail_closed",
      "claim_report_contradiction_fail_closed"
    ]
  }' > "$OUT_DIR/report.json"

printf 'decision=PASS_BRIK64_CLI_BETA15_5_PACKAGE_SMOKE\n'
