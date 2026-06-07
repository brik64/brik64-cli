#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

WEB="$TMP_DIR/brik64.com"
mkdir -p "$WEB/public/cli/releases" "$WEB/src/app/changelog" "$WEB/src/app/download" "$WEB/src/app/sdks"
git -C "$TMP_DIR" init -q brik64.com
git -C "$WEB" config user.email "release-test@brik64.com"
git -C "$WEB" config user.name "BRIK64 Release Test"

cat > "$WEB/public/cli/install.sh" <<'SH'
VERSION="${1:-${BRIK64_VERSION:-0.1.0-beta.8}}"
SHA256_0_1_0_BETA_8="9691aad414c40c0bac0dd3f1f087f1a235b87dc29c68b466812763b59b90aa76"
if [ "$VERSION" != "0.1.0-beta.8" ]; then
  fail "this installer currently serves 0.1.0-beta.8 only; set BRIK64_VERSION=0.1.0-beta.8"
fi
EXPECTED_SHA="$SHA256_0_1_0_BETA_8"
SH

cat > "$WEB/public/cli/beta.json" <<'JSON'
{
  "schemaVersion": "brik64.cli_channel.v1",
  "channel": "beta",
  "currentVersion": "0.1.0-beta.8",
  "releaseManifest": "/cli/releases/0.1.0-beta.8.json",
  "claimBoundary": "old"
}
JSON

cat > "$WEB/src/app/changelog/page.tsx" <<'TSX'
const releases = [
  {
    date: "June 2026",
    version: "0.1.0-beta.8",
    title: "BRIK64 CLI 0.1.0-beta.8",
    notes: ["old"],
  },
];
TSX

cat > "$WEB/src/app/download/page.tsx" <<'TSX'
export const text = "Beta8 curl -fsSL https://brik64.com/cli/install.sh | bash -s 0.1.0-beta.8";
TSX

cat > "$WEB/src/app/sdks/page.tsx" <<'TSX'
export const text = "npm install @brik64/core@0.1.0-beta.8 && pip install brik64==0.1.0b8 && cargo add brik64-core --version 0.1.0-beta.8";
TSX

git -C "$WEB" add .
git -C "$WEB" commit -q -m "fixture"

(
  cd "$ROOT"
  BRIK64_WEB_REPO_ROOT="$WEB" node scripts/release/sync-web-release-surface.js
)

REPORT="$ROOT/evidence/release-web-surface-sync/report.json"
jq -e '
  .decision=="PASS_RELEASE_WEB_SURFACE_SYNC_DRY_RUN"
  and .version=="0.1.0-beta.9"
  and .changedBeforeCommit==true
  and .pushed==false
' "$REPORT" >/dev/null

grep -q '0.1.0-beta.9' "$WEB/public/cli/install.sh"
grep -q 'SHA256_0_1_0_BETA_9' "$WEB/public/cli/install.sh"
jq -e '.currentVersion=="0.1.0-beta.9" and .releaseManifest=="/cli/releases/0.1.0-beta.9.json"' "$WEB/public/cli/beta.json" >/dev/null
test -f "$WEB/public/cli/releases/0.1.0-beta.9.json"
grep -q 'version: "0.1.0-beta.9"' "$WEB/src/app/changelog/page.tsx"
grep -q '@brik64/core@0.1.0-beta.9' "$WEB/src/app/sdks/page.tsx"
grep -q 'brik64==0.1.0b9' "$WEB/src/app/sdks/page.tsx"

git -C "$WEB" add .
git -C "$WEB" commit -q -m "sync beta9"
(
  cd "$ROOT"
  BRIK64_WEB_REPO_ROOT="$WEB" node scripts/release/sync-web-release-surface.js
)
jq -e '
  .decision=="PASS_RELEASE_WEB_SURFACE_SYNC_DRY_RUN"
  and .version=="0.1.0-beta.9"
  and .changedBeforeCommit==false
' "$REPORT" >/dev/null

printf 'PASS release web surface sync\n'
