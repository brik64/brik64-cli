#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORT="$ROOT/evidence/release-github-verified-signature/report.json"
TMP_DIR="$(mktemp -d)"
trap 'if [[ -f "$TMP_DIR/report.backup" ]]; then cp "$TMP_DIR/report.backup" "$REPORT"; fi; rm -rf "$TMP_DIR"' EXIT

cp "$REPORT" "$TMP_DIR/report.backup"

python3 - "$REPORT" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
data = json.loads(path.read_text())
data["commit"] = "0" * 40
data["decision"] = "PASS_RELEASE_GITHUB_VERIFIED_SIGNATURE"
data.setdefault("boundary", {})["publicReleaseAllowed"] = True
data.setdefault("verification", {})["verified"] = True
data["verification"]["reason"] = "valid"
path.write_text(json.dumps(data, indent=2) + "\n")
PY

node "$ROOT/scripts/release-train-publish-plan.js" >"$TMP_DIR/stdout" 2>"$TMP_DIR/stderr"

CURRENT_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
jq -e --arg head "$CURRENT_HEAD" '
  .decision=="PASS_RELEASE_GITHUB_VERIFIED_SIGNATURE"
  and .commit==$head
  and .boundary.publicReleaseAllowed==true
' "$REPORT" >/dev/null

jq -e --arg head "$CURRENT_HEAD" '
  .decision=="PASS_PUBLISH_PLAN_DRY_RUN"
  and .signatureReport.commit==$head
  and (.failures | length)==0
  and ((.warnings // []) | index("pre_publish_live_verify_manifest_digest_drift"))
' "$ROOT/evidence/release-train-publish-plan/report.json" >/dev/null

if grep -q "github_verified_signature_commit_drift" "$TMP_DIR/stdout" "$TMP_DIR/stderr"; then
  echo "publish plan still reported signature commit drift after refresh" >&2
  exit 1
fi
