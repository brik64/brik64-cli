#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

FIXTURE="$TMP_DIR/fixture"
mkdir -p "$FIXTURE/release" "$FIXTURE/evidence/beta15_4-package" \
  "$FIXTURE/evidence/beta15_4-package-smoke" \
  "$FIXTURE/evidence/beta15_4-rust-polymer-domain" \
  "$FIXTURE/evidence/beta15_4-stale-public-surface" \
  "$FIXTURE/evidence/beta15_4-pre-public-rc"

cp "$ROOT/package.json" "$FIXTURE/package.json"
cp "$ROOT/README.md" "$FIXTURE/README.md"
cp "$ROOT/CHANGELOG.md" "$FIXTURE/CHANGELOG.md"

cat >"$FIXTURE/evidence/beta15_4-rust-polymer-domain/report.json" <<'JSON'
{"decision":"PASS_BRIK64_CLI_BETA15_4_RUST_POLYMER_DOMAIN_GATE"}
JSON
cat >"$FIXTURE/evidence/beta15_4-stale-public-surface/report.json" <<'JSON'
{"decision":"PASS_BRIK64_CLI_BETA15_4_STALE_PUBLIC_SURFACE_GATE"}
JSON
cat >"$FIXTURE/evidence/beta15_4-pre-public-rc/report.json" <<'JSON'
{"decision":"PASS_BRIK64_CLI_BETA15_4_PRE_PUBLIC_RC_GATE"}
JSON
cat >"$FIXTURE/evidence/beta15_4-package/package.manifest.json" <<'JSON'
{"decision":"PASS_BRIK64_CLI_BETA15_4_PACKAGE_BUILT"}
JSON
cat >"$FIXTURE/evidence/beta15_4-package-smoke/report.json" <<'JSON'
{"decision":"PASS_BRIK64_CLI_BETA15_4_PACKAGE_SMOKE"}
JSON

make_manifest() {
  local state="$1"
  local binding="$2"
  local commit="$3"
  cat >"$FIXTURE/release/manifest.json" <<JSON
{
  "schemaVersion": "brik64.release_manifest.v1",
  "releaseId": "brik64-0.1.0-beta.15.4",
  "version": "0.1.0-beta.15.4",
  "state": "$state",
  "source": {
    "commit": "$commit",
    "commitBinding": "$binding"
  },
  "releaseNotes": [
    {"type":"fixed","surface":"cli","text":"Generated Rust app-polymer output keeps assertions scoped to generated functions."}
  ],
  "publicSurfaces": {
    "githubRelease": {"required": true},
    "curlInstaller": {"required": true},
    "channelManifest": {"required": true},
    "web": {"required": true},
    "docs": {"required": true},
    "skills": {"required": true}
  },
  "sdks": [
    {"marketplace":"npm","version":"0.1.0-beta.15.4"},
    {"marketplace":"pypi","version":"0.1.0b15.post4"},
    {"marketplace":"crates.io","version":"0.1.0-beta.15.4"}
  ],
  "verification": {
    "requiredEvidence": [
      {"id":"rust","path":"evidence/beta15_4-rust-polymer-domain/report.json","decision":"PASS_BRIK64_CLI_BETA15_4_RUST_POLYMER_DOMAIN_GATE"},
      {"id":"stale","path":"evidence/beta15_4-stale-public-surface/report.json","decision":"PASS_BRIK64_CLI_BETA15_4_STALE_PUBLIC_SURFACE_GATE"},
      {"id":"rc","path":"evidence/beta15_4-pre-public-rc/report.json","decision":"PASS_BRIK64_CLI_BETA15_4_PRE_PUBLIC_RC_GATE"},
      {"id":"pkg","path":"evidence/beta15_4-package/package.manifest.json","decision":"PASS_BRIK64_CLI_BETA15_4_PACKAGE_BUILT"},
      {"id":"smoke","path":"evidence/beta15_4-package-smoke/report.json","decision":"PASS_BRIK64_CLI_BETA15_4_PACKAGE_SMOKE"}
    ]
  }
}
JSON
}

BASE_COMMIT="10e51bfa351e9297b017b44745e03f5682917052"
HEAD_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"

make_manifest draft candidate_base_commit "$BASE_COMMIT"
(
  cd "$FIXTURE"
  BRIK64_CLI_ROOT="$FIXTURE" BRIK64_RELEASE_MANIFEST_EXPECTED_HEAD="$HEAD_COMMIT" \
    node "$ROOT/scripts/release-manifest-validate.js" --allow-dirty \
    >/tmp/brik64_manifest_binding_draft.out
)
jq -e '.decision=="PASS_RELEASE_MANIFEST_VALIDATE"' \
  "$FIXTURE/evidence/release-manifest-validate/report.json" >/dev/null

make_manifest public candidate_base_commit "$BASE_COMMIT"
set +e
(
  cd "$FIXTURE"
  BRIK64_CLI_ROOT="$FIXTURE" BRIK64_RELEASE_MANIFEST_EXPECTED_HEAD="$HEAD_COMMIT" \
    node "$ROOT/scripts/release-manifest-validate.js" --allow-dirty \
    >/tmp/brik64_manifest_binding_public_candidate.out
)
public_candidate_rc=$?
set -e
if [[ "$public_candidate_rc" -eq 0 ]]; then
  echo "public_candidate_binding_unexpected_pass" >&2
  exit 1
fi
jq -e '
  .decision=="FAIL_RELEASE_MANIFEST_VALIDATE"
  and (.failures | index("source_commit_binding_invalid_for_public:candidate_base_commit"))
' "$FIXTURE/evidence/release-manifest-validate/report.json" >/dev/null

make_manifest public release_ref_exact "$BASE_COMMIT"
set +e
(
  cd "$FIXTURE"
  BRIK64_CLI_ROOT="$FIXTURE" BRIK64_RELEASE_MANIFEST_EXPECTED_HEAD="$HEAD_COMMIT" \
    node "$ROOT/scripts/release-manifest-validate.js" --allow-dirty \
    >/tmp/brik64_manifest_binding_public_stale.out
)
public_stale_rc=$?
set -e
if [[ "$public_stale_rc" -eq 0 ]]; then
  echo "public_stale_commit_unexpected_pass" >&2
  exit 1
fi
jq -e '
  .decision=="FAIL_RELEASE_MANIFEST_VALIDATE"
  and any(.failures[]; startswith("source_commit_not_current_head:"))
' "$FIXTURE/evidence/release-manifest-validate/report.json" >/dev/null

make_manifest public release_ref_exact "$HEAD_COMMIT"
python3 - "$FIXTURE/README.md" <<'PY'
import sys
path = sys.argv[1]
text = open(path).read()
text = text.replace(
    "Current beta candidate: `0.1.0-beta.15.4`",
    "Current public beta: `0.1.0-beta.15.4`",
)
open(path, "w").write(text)
PY
(
  cd "$FIXTURE"
  BRIK64_CLI_ROOT="$FIXTURE" BRIK64_RELEASE_MANIFEST_EXPECTED_HEAD="$HEAD_COMMIT" \
    node "$ROOT/scripts/release-manifest-validate.js" --allow-dirty \
    >/tmp/brik64_manifest_binding_public_exact.out
)
jq -e '.decision=="PASS_RELEASE_MANIFEST_VALIDATE"' \
  "$FIXTURE/evidence/release-manifest-validate/report.json" >/dev/null

echo "PASS release manifest source commit binding gate"
