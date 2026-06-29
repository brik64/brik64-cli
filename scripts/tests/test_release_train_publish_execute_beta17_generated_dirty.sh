#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
FILES=(
  "evidence/beta17-fixpoint-required-inputs/report.json"
  "evidence/beta17-pre-publication-mutation-gate/report.json"
  "evidence/release-train-publish-execute/report.json"
)

restore() {
  for file in "${FILES[@]}"; do
    if [[ -f "$TMP_DIR/${file//\//__}" ]]; then
      cp "$TMP_DIR/${file//\//__}" "$ROOT/$file"
    fi
  done
  rm -rf "$TMP_DIR"
}
trap restore EXIT

for file in "${FILES[@]}"; do
  mkdir -p "$(dirname "$TMP_DIR/${file//\//__}")"
  cp "$ROOT/$file" "$TMP_DIR/${file//\//__}"
done

python3 - "$ROOT/evidence/beta17-fixpoint-required-inputs/report.json" "$ROOT/evidence/beta17-pre-publication-mutation-gate/report.json" <<'PY'
import json
import pathlib
import sys

for raw in sys.argv[1:]:
    path = pathlib.Path(raw)
    data = json.loads(path.read_text())
    data["testDirtyTouch"] = "release-train-publish-execute-generated-dirty-regression"
    path.write_text(json.dumps(data, indent=2) + "\n")
PY

node "$ROOT/scripts/release-train-publish-execute.js" >"$TMP_DIR/stdout" 2>"$TMP_DIR/stderr"

jq -e '
  (.decision=="PASS_RELEASE_TRAIN_PUBLISH_EXECUTE_DRY_RUN"
   or .decision=="PASS_RELEASE_TRAIN_PUBLISH_EXECUTE_DRY_RUN_WITH_BLOCKERS")
  and (.failures | length)==0
  and (.dirtyFiles | index("evidence/beta17-fixpoint-required-inputs/report.json") | not)
  and (.dirtyFiles | index("evidence/beta17-pre-publication-mutation-gate/report.json") | not)
' "$ROOT/evidence/release-train-publish-execute/report.json" >/dev/null
