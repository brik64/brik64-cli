#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync("release/manifest.json","utf8")).version)' "$ROOT")"
SMOKE_SCRIPT="$(node -e 'const v=process.argv[1]; const m=v.match(/-beta\.(\d+)(?:\.(\d+))?(?:\.\d+)*$/); if (!m) process.exit(1); process.stdout.write(m[2] ? `smoke:beta${m[1]}.${m[2]}:package` : `smoke:beta${m[1]}:package`)' "$VERSION")"

jq -e --arg script "$SMOKE_SCRIPT" '.scripts[$script] | type == "string"' "$ROOT/package.json" >/dev/null

COMMAND="$(jq -r --arg script "$SMOKE_SCRIPT" '.scripts[$script]' "$ROOT/package.json")"
case "$COMMAND" in
  *scripts/beta17-package-smoke.sh*) ;;
  *)
    echo "unexpected beta17 smoke script command: $COMMAND" >&2
    exit 1
    ;;
esac

test -x "$ROOT/scripts/beta17-package-smoke.sh"
