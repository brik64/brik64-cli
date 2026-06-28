#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(cd "$ROOT_DIR" && node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync("package.json","utf8")).version)')"
PKG_DIR="$ROOT_DIR/evidence/beta16_1-package"
OUT_DIR="$ROOT_DIR/evidence/beta16_1-package-smoke"
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
    local rc=$?
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
  local rc=$?
  set -e
  if [[ "$rc" -eq 0 ]]; then
    printf '%s:unexpected_success\n' "$id" >&2
    exit 1
  fi
  if ! grep -q "$expected" "$TMP_DIR/$id.stdout" "$TMP_DIR/$id.stderr"; then
    printf '%s:missing:%s\n' "$id" "$expected" >&2
    cat "$TMP_DIR/$id.stderr" >&2
    exit 1
  fi
}

mkdir -p "$OUT_DIR"

manifest_version="$(jq -r '.version' "$MANIFEST")"
manifest_decision="$(jq -r '.decision' "$MANIFEST")"
release_eligible="$(jq -r '.releaseEligible' "$MANIFEST")"
publication_allowed="$(jq -r '.publicationAllowed' "$MANIFEST")"
public_release_allowed="$(jq -r '.claimBoundary.publicReleaseAllowed' "$MANIFEST")"
package_rel="$(jq -r '.package.path' "$MANIFEST")"
package_sha="$(jq -r '.package.sha256' "$MANIFEST")"
package_path="$ROOT_DIR/$package_rel"

[[ "$manifest_version" == "$VERSION" ]] || { echo "manifest_version_drift:$manifest_version" >&2; exit 1; }
[[ "$manifest_decision" == "PASS_BRIK64_CLI_BETA16_1_PACKAGE_BUILT" ]] || { echo "package_decision_drift:$manifest_decision" >&2; exit 1; }
[[ "$release_eligible" == "false" ]] || { echo "beta16_1_source_candidate_package_must_not_be_release_eligible" >&2; exit 1; }
[[ "$publication_allowed" == "false" ]] || { echo "beta16_1_source_candidate_package_must_not_allow_publication" >&2; exit 1; }
[[ "$public_release_allowed" == "false" ]] || { echo "beta16_1_source_candidate_claim_boundary_open" >&2; exit 1; }
[[ "$(sha256_file "$package_path")" == "$package_sha" ]] || { echo "package_hash_mismatch" >&2; exit 1; }

run_pass extract "" tar -xzf "$package_path" -C "$TMP_DIR"
EXTRACTED="$TMP_DIR/brik64-cli-$VERSION"
BRIK="$EXTRACTED/src/brik.js"
WORK_DIR="$TMP_DIR/work"
mkdir -p "$WORK_DIR"

[[ ! -e "$EXTRACTED/evidence" ]] || {
  echo "package_contains_mutable_evidence" >&2
  exit 1
}
[[ -f "$EXTRACTED/engines/l4plus-n5/runtime-bundle.manifest.json" ]] || {
  echo "package_missing_l4plus_n5_runtime_bundle" >&2
  exit 1
}
[[ -f "$EXTRACTED/pcd/beta15/cli_polymer.pcd" ]] || {
  echo "package_missing_beta15_cli_polymer" >&2
  exit 1
}
[[ -f "$EXTRACTED/pcd/beta15_6/cli/rust_f64_polymer_codegen.pcd" ]] || {
  echo "package_missing_beta15_6_regression_contract" >&2
  exit 1
}

run_pass version "BRIK64 CLI $VERSION" node "$BRIK" --version
run_pass engine_status '"runtimeProfile": "l4plus_n5_local"' env BRIK64_NO_BANNER=1 node "$BRIK" engine status --json
run_pass engine_status_engine '"engine": "L4+N5"' env BRIK64_NO_BANNER=1 node "$BRIK" engine status --json

node - "$EXTRACTED" <<'NODE'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'engines/l4plus-n5/runtime-bundle.manifest.json'), 'utf8'));
const failures = [];
for (const artifact of manifest.artifacts || []) {
  const artifactPath = path.join(root, artifact.path);
  if (!fs.existsSync(artifactPath)) {
    failures.push(`missing:${artifact.path}`);
    continue;
  }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex');
  if (actual !== artifact.sha256) failures.push(`sha:${artifact.path}`);
}
if (failures.length) {
  console.error(`l4_bundle_integrity_failed:${failures.join(',')}`);
  process.exit(1);
}
console.log(`l4_bundle_integrity=PASS artifacts=${manifest.artifacts.length}`);
NODE

pushd "$WORK_DIR" >/dev/null
  run_pass init "created=.brik/manifest.json" env BRIK64_NO_BANNER=1 node "$BRIK" init
  mkdir -p pcd
  cat > pcd/beta16_1_smoke.pcd <<'PCD'
// brik64.pcd_file.v1
// claim_boundary: local_candidate_only
PC beta16_1_smoke {
  domain input: i64 [0, 255];
  fn beta16_1_smoke(input: i64) -> i64 {
    if (input == 0) return 1;
    return 2;
  }
}
PCD
  run_pass certify "certificate=pcd/beta16_1_smoke.pcd.cert.json" env BRIK64_NO_BANNER=1 node "$BRIK" certify pcd/beta16_1_smoke.pcd --prototype-non-claim
  run_pass verify '"status": "PASS"' env BRIK64_NO_BANNER=1 node "$BRIK" verify pcd/beta16_1_smoke.pcd --json
  run_pass emit_python "tests=out/tests/test_beta16_1_smoke.py" env BRIK64_NO_BANNER=1 node "$BRIK" emit pcd/beta16_1_smoke.pcd --target python --out out --tests
  test -f out/brik64_generated_beta16_1_smoke/program.py
  test -f out/tests/test_beta16_1_smoke.py
  run_pass generated_python_tests "generated_python_tests=" python3 - <<'PY'
import importlib.util
import pathlib
import sys

root = pathlib.Path.cwd()
count = 0
for test_file in sorted(root.glob("**/tests/test_*.py")):
    sys.path.insert(0, str(test_file.parent.parent))
    spec = importlib.util.spec_from_file_location(test_file.stem, test_file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for name in sorted(dir(module)):
        if name.startswith("test_") and callable(getattr(module, name)):
            getattr(module, name)()
            count += 1
if count == 0:
    raise SystemExit("no_generated_tests_executed")
print(f"generated_python_tests={count}")
PY
  cat > source_floor_div.py <<'PY'
def floor_div_gate(x: int, y: int) -> int:
    if x > 10:
        return x // y
    return x + 1
PY
  run_pass lift_python_floor_div "" env BRIK64_NO_BANNER=1 node "$BRIK" lift python source_floor_div.py --preview --json
  if grep -q 'pcd_parse_error:malformed_expression' "$TMP_DIR/lift_python_floor_div.stdout" "$TMP_DIR/lift_python_floor_div.stderr"; then
    echo "python_floor_division_lift_malformed_expression" >&2
    exit 1
  fi
  jq -e '
    .language=="python"
    and .candidateCount >= 1
    and .certificationEligibleCandidateCount >= 1
    and ([.candidates[] | select(.function=="floor_div_gate" and .certificationEligible==true)] | length) >= 1
  ' "$TMP_DIR/lift_python_floor_div.stdout" >/dev/null || {
    echo "python_floor_division_lift_candidate_not_certification_eligible" >&2
    cat "$TMP_DIR/lift_python_floor_div.stdout" >&2
    exit 1
  }
  floor_div_candidate="$(find .brik/lift-preview -name floor_div_gate.pcd -print -quit)"
  [[ -n "$floor_div_candidate" && -f "$floor_div_candidate" ]] || {
    echo "python_floor_division_lift_candidate_missing" >&2
    exit 1
  }
  grep -q 'return x / y;' "$floor_div_candidate" || {
    echo "python_floor_division_lift_integer_division_missing" >&2
    exit 1
  }
  run_pass certify_lifted_floor_div "certificate=" env BRIK64_NO_BANNER=1 node "$BRIK" certify "$floor_div_candidate"
  run_pass ledger_verify '"status": "PASS"' env BRIK64_NO_BANNER=1 node "$BRIK" ledger verify --json
  cp .brik/ledger/events.jsonl .brik/ledger/events.jsonl.bak
  python3 - <<'PY'
import json
path = ".brik/ledger/events.jsonl"
lines = [line for line in open(path).read().splitlines() if line.strip()]
event = json.loads(lines[0])
event.setdefault("payload", {})["tampered"] = True
lines[0] = json.dumps(event, separators=(",", ":"))
open(path, "w").write("\n".join(lines) + "\n")
PY
  run_fail ledger_tamper "ledger_event_hash_mismatch" env BRIK64_NO_BANNER=1 node "$BRIK" ledger verify --json
popd >/dev/null

jq -n \
  --arg version "$VERSION" \
  '{
    schemaVersion:"brik64.cli_beta16_1_package_smoke_report.v1",
    version:$version,
    decision:"PASS_BRIK64_CLI_BETA16_1_PACKAGE_SMOKE",
    releaseEligible:false,
    publicationAllowed:false,
    checked:[
      "package_sha",
      "mutable_evidence_excluded_from_package",
      "l4plus_n5_runtime_bundle_integrity",
      "version",
      "engine_status",
      "init",
      "certify",
      "verify",
      "python_emit_package_layout",
      "generated_python_tests",
      "python_floor_division_lift_package_regression",
      "ledger_verify",
      "ledger_tamper_fail_closed"
    ]
  }' > "$OUT_DIR/report.json"

printf 'decision=PASS_BRIK64_CLI_BETA16_1_PACKAGE_SMOKE\n'
