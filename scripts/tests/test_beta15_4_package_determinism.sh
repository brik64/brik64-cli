#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

npm run package:beta15.4:local >/tmp/brik64_beta15_4_package_determinism_a.log
cp evidence/beta15_4-package/package.manifest.json "$TMP_DIR/package-a.json"
cp evidence/beta15_4-package/SHA256SUMS "$TMP_DIR/SHA256SUMS-a"
cp evidence/beta15_4-package/stage-checksums.tsv "$TMP_DIR/stage-checksums-a.tsv"

npm run package:beta15.4:local >/tmp/brik64_beta15_4_package_determinism_b.log
cp evidence/beta15_4-package/package.manifest.json "$TMP_DIR/package-b.json"
cp evidence/beta15_4-package/SHA256SUMS "$TMP_DIR/SHA256SUMS-b"
cp evidence/beta15_4-package/stage-checksums.tsv "$TMP_DIR/stage-checksums-b.tsv"

sha_a="$(jq -r '.package.sha256' "$TMP_DIR/package-a.json")"
sha_b="$(jq -r '.package.sha256' "$TMP_DIR/package-b.json")"

if [[ "$sha_a" != "$sha_b" ]]; then
  echo "package_sha_not_deterministic:$sha_a:$sha_b" >&2
  exit 1
fi

cmp -s "$TMP_DIR/SHA256SUMS-a" "$TMP_DIR/SHA256SUMS-b" || {
  echo "sha256sums_not_deterministic" >&2
  exit 1
}

cmp -s "$TMP_DIR/stage-checksums-a.tsv" "$TMP_DIR/stage-checksums-b.tsv" || {
  echo "stage_checksums_not_deterministic" >&2
  exit 1
}

echo "PASS beta15.4 package deterministic under frozen inputs"
