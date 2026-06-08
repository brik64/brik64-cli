#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"; rm -rf "$ROOT/evidence/release-web-pages-deploy"' EXIT

BIN="$TMP_DIR/bin"
mkdir -p "$BIN"

cat >"$BIN/gh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

if [[ "$*" == workflow\ run* ]]; then
  exit 0
fi

if [[ "$*" == run\ list* ]]; then
  cat <<'JSON'
[
  {
    "databaseId": 123456,
    "status": "completed",
    "conclusion": "success",
    "createdAt": "2099-01-01T00:00:00Z",
    "url": "https://github.com/brik64-admin/brik64.com/actions/runs/123456",
    "headSha": "abc123"
  }
]
JSON
  exit 0
fi

if [[ "$*" == run\ watch* ]]; then
  if [[ "${BRIK64_FAKE_GH_WATCH_FAIL:-0}" == "1" ]]; then
    exit 1
  fi
  exit 0
fi

echo "unexpected gh invocation: $*" >&2
exit 2
SH
chmod +x "$BIN/gh"

(
  cd "$ROOT"
  PATH="$BIN:$PATH" \
  BRIK64_WEB_DEPLOY_WAIT_SECONDS=2 \
  BRIK64_WEB_DEPLOY_INTERVAL_SECONDS=1 \
    node scripts/release/dispatch-web-pages-deploy.js
)

jq -e '
  .decision=="PASS_RELEASE_WEB_PAGES_DEPLOY"
  and .run.databaseId==123456
  and (.failures | length)==0
' "$ROOT/evidence/release-web-pages-deploy/report.json" >/dev/null

if (
  cd "$ROOT"
  PATH="$BIN:$PATH" \
  BRIK64_FAKE_GH_WATCH_FAIL=1 \
  BRIK64_WEB_DEPLOY_WAIT_SECONDS=2 \
  BRIK64_WEB_DEPLOY_INTERVAL_SECONDS=1 \
    node scripts/release/dispatch-web-pages-deploy.js
); then
  echo "expected failing deploy watch to fail closed" >&2
  exit 1
fi

jq -e '
  .decision=="FAIL_RELEASE_WEB_PAGES_DEPLOY"
  and (.failures | index("web_pages_deploy_failed:1"))
' "$ROOT/evidence/release-web-pages-deploy/report.json" >/dev/null

printf 'PASS release web pages deploy dispatch\n'
