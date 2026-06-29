#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

make_live_report() {
  local dir="$1"
  local version="$2"
  local decision="${3:-PASS_RELEASE_TRAIN_LIVE_VERIFY}"
  local publication_allowed="${4:-true}"
  mkdir -p "$dir/evidence/release-train-live-verify"
  cat >"$dir/evidence/release-train-live-verify/report.json" <<JSON
{
  "schemaVersion": "brik64.release_train_live_verify_report.v1",
  "releaseId": "brik64-$version",
  "version": "$version",
  "decision": "$decision",
  "publicationAllowed": $publication_allowed,
  "observations": [
    { "id": "curl_installer", "url": "https://brik64.com/cli/install.sh", "statusCode": 200, "sha256": "$(printf curl | shasum -a 256 | awk '{print $1}')", "bytes": 4 },
    { "id": "channel_manifest", "url": "https://brik64.com/cli/beta.json", "statusCode": 200, "sha256": "$(printf manifest | shasum -a 256 | awk '{print $1}')", "bytes": 8 },
    { "id": "docs_install", "url": "https://docs.brik64.com/cli/install", "statusCode": 200, "sha256": "$(printf docs | shasum -a 256 | awk '{print $1}')", "bytes": 4 },
    { "id": "web_home", "url": "https://brik64.com/download", "statusCode": 200, "sha256": "$(printf web | shasum -a 256 | awk '{print $1}')", "bytes": 3 },
    { "id": "web_changelog", "url": "https://brik64.com/changelog", "statusCode": 200, "sha256": "$(printf changelog | shasum -a 256 | awk '{print $1}')", "bytes": 9 },
    { "id": "public_skill", "url": "https://raw.githubusercontent.com/brik64/brik64-tools-skills/main/skills/brik64/SKILL.md", "statusCode": 200, "sha256": "$(printf skill | shasum -a 256 | awk '{print $1}')", "bytes": 5 }
  ],
  "failures": []
}
JSON
}

PASS_ROOT="$TMP_DIR/pass"
make_live_report "$PASS_ROOT" "0.1.0-beta.17"
BRIK64_CLI_ROOT="$PASS_ROOT" node "$ROOT/scripts/beta17-fixpoint-public-surface-sync-report.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"
jq -e '
  .decision=="PASS_BETA17_PUBLIC_SURFACE_SYNC"
  and .synced==true
  and .claimBoundary.publicReleaseAllowed==true
  and .claimBoundary.definitiveFixpointAllowed==false
  and (.surfaceChecks | length)==5
  and all(.surfaceChecks[]; .pass==true and .version=="0.1.0-beta.17")
' "$PASS_ROOT/evidence/beta17-fixpoint/public_surface_sync_report.json" >/dev/null

# Break attempt 1: missing live report fails closed and writes a blocked report.
MISSING_ROOT="$TMP_DIR/missing"
mkdir -p "$MISSING_ROOT"
if BRIK64_CLI_ROOT="$MISSING_ROOT" node "$ROOT/scripts/beta17-fixpoint-public-surface-sync-report.js" \
  >"$TMP_DIR/missing.stdout" 2>"$TMP_DIR/missing.stderr"; then
  echo "missing live report unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_PUBLIC_SURFACE_SYNC"
  and .synced==false
  and (.blockers | index("missing_live_verify_report:evidence/release-train-live-verify/report.json"))
  and .claimBoundary.publicReleaseAllowed==false
' "$MISSING_ROOT/evidence/beta17-fixpoint/public_surface_sync_report.json" >/dev/null

# Break attempt 2: stale version fails closed.
STALE_ROOT="$TMP_DIR/stale"
make_live_report "$STALE_ROOT" "0.1.0-beta.16.1"
if BRIK64_CLI_ROOT="$STALE_ROOT" node "$ROOT/scripts/beta17-fixpoint-public-surface-sync-report.js" \
  >"$TMP_DIR/stale.stdout" 2>"$TMP_DIR/stale.stderr"; then
  echo "stale live report unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_PUBLIC_SURFACE_SYNC"
  and (.blockers | index("live_verify_version_mismatch:0.1.0-beta.16.1"))
' "$STALE_ROOT/evidence/beta17-fixpoint/public_surface_sync_report.json" >/dev/null

# Break attempt 3: missing skills observation fails closed.
MISSING_SURFACE_ROOT="$TMP_DIR/missing-surface"
make_live_report "$MISSING_SURFACE_ROOT" "0.1.0-beta.17"
python3 - "$MISSING_SURFACE_ROOT/evidence/release-train-live-verify/report.json" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
data = json.loads(path.read_text())
data["observations"] = [item for item in data["observations"] if item["id"] != "public_skill"]
path.write_text(json.dumps(data, indent=2) + "\n")
PY
if BRIK64_CLI_ROOT="$MISSING_SURFACE_ROOT" node "$ROOT/scripts/beta17-fixpoint-public-surface-sync-report.js" \
  >"$TMP_DIR/missing-surface.stdout" 2>"$TMP_DIR/missing-surface.stderr"; then
  echo "missing surface observation unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_PUBLIC_SURFACE_SYNC"
  and (.blockers | index("surface_missing_observation:skills:public_skill"))
  and (.surfaceChecks[] | select(.id=="skills").pass)==false
' "$MISSING_SURFACE_ROOT/evidence/beta17-fixpoint/public_surface_sync_report.json" >/dev/null

echo "PASS beta17 public surface sync report"
