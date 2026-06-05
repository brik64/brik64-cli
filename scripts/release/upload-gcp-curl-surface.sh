#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MANIFEST_PATH="${1:-"$ROOT/release/manifest.json"}"
DRY_RUN="${BRIK64_RELEASE_DRY_RUN:-0}"
BUCKET="${BRIK64_GCP_RELEASE_BUCKET:-brik64-cli-releases}"
PREFIX="${BRIK64_GCP_RELEASE_PREFIX:-cli}"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/brik64-gcp-release.XXXXXX")"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

need_file() {
  if [ ! -f "$1" ]; then
    printf 'missing required file: %s\n' "$1" >&2
    exit 1
  fi
}

need_file "$MANIFEST_PATH"

VERSION="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.version)' "$MANIFEST_PATH")"
BETA_NUMBER="$(node -e 'const v=process.argv[1]; const m=v.match(/-beta\.(\d+)$/); if (!m) { console.error(`unsupported beta version: ${v}`); process.exit(1); } process.stdout.write(m[1])' "$VERSION")"
PACKAGE_DIR="$ROOT/evidence/beta${BETA_NUMBER}-package"
CHECKSUM_DIR="$ROOT/evidence/beta${BETA_NUMBER}-release-checksums"
PACKAGE_MANIFEST="$PACKAGE_DIR/package.manifest.json"
need_file "$PACKAGE_MANIFEST"
PACKAGE_RELATIVE_PATH="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.package.path)' "$PACKAGE_MANIFEST")"
PACKAGE_PATH="$ROOT/$PACKAGE_RELATIVE_PATH"
CHECKSUMS="$CHECKSUM_DIR/SHA256SUMS"
if [ ! -f "$CHECKSUMS" ]; then
  CHECKSUMS="$PACKAGE_DIR/SHA256SUMS"
fi
need_file "$PACKAGE_PATH"
need_file "$CHECKSUMS"

PACKAGE_SHA="$(shasum -a 256 "$PACKAGE_PATH" | awk '{print $1}')"
PACKAGE_BASENAME="$(basename "$PACKAGE_PATH")"
PACKAGE_OBJECT="gs://${BUCKET}/${PREFIX}/releases/${VERSION}/${PACKAGE_BASENAME}"
PACKAGE_URL="https://storage.googleapis.com/${BUCKET}/${PREFIX}/releases/${VERSION}/${PACKAGE_BASENAME}"

cat > "$WORK_DIR/beta.json" <<JSON
{
  "schemaVersion": "brik64.cli_channel_manifest.v1",
  "channel": "beta",
  "currentVersion": "${VERSION}",
  "package": {
    "url": "${PACKAGE_URL}",
    "sha256": "${PACKAGE_SHA}",
    "runtime": "node>=20"
  }
}
JSON

cat > "$WORK_DIR/install.sh" <<SH
#!/usr/bin/env bash
set -euo pipefail

VERSION="${VERSION}"
PACKAGE_URL="${PACKAGE_URL}"
PACKAGE_SHA="${PACKAGE_SHA}"

if ! command -v node >/dev/null 2>&1; then
  printf 'BRIK64 CLI %s requires Node.js 20 or newer. Install Node.js, then rerun this installer.\\n' "\$VERSION" >&2
  exit 1
fi

NODE_MAJOR="\$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "\$NODE_MAJOR" -lt 20 ]; then
  printf 'BRIK64 CLI %s requires Node.js 20 or newer. Detected Node.js %s.\\n' "\$VERSION" "\$(node --version)" >&2
  exit 1
fi

TMP_DIR="\$(mktemp -d "\${TMPDIR:-/tmp}/brik64-install.XXXXXX")"
cleanup() { rm -rf "\$TMP_DIR"; }
trap cleanup EXIT

curl -fsSL "\$PACKAGE_URL" -o "\$TMP_DIR/brik64-cli.tgz"
ACTUAL_SHA="\$(shasum -a 256 "\$TMP_DIR/brik64-cli.tgz" | awk '{print \$1}')"
if [ "\$ACTUAL_SHA" != "\$PACKAGE_SHA" ]; then
  printf 'BRIK64 CLI checksum mismatch for %s.\\n' "\$VERSION" >&2
  exit 1
fi

npm install -g "\$TMP_DIR/brik64-cli.tgz"
brik64 --version
SH

chmod 0755 "$WORK_DIR/install.sh"

if [ "$DRY_RUN" = "1" ]; then
  printf 'dry_run=true\n'
  printf 'version=%s\n' "$VERSION"
  printf 'package_object=%s\n' "$PACKAGE_OBJECT"
  printf 'channel_object=gs://%s/%s/beta.json\n' "$BUCKET" "$PREFIX"
  printf 'installer_object=gs://%s/%s/install.sh\n' "$BUCKET" "$PREFIX"
  exit 0
fi

if [ -n "${BRIK64_GCP_RELEASE_CREDENTIALS:-}" ]; then
  CREDENTIALS_FILE="$WORK_DIR/gcp-credentials.json"
  printf '%s' "$BRIK64_GCP_RELEASE_CREDENTIALS" > "$CREDENTIALS_FILE"
  export GOOGLE_APPLICATION_CREDENTIALS="$CREDENTIALS_FILE"
fi

if command -v gcloud >/dev/null 2>&1; then
  gcloud storage cp "$PACKAGE_PATH" "$PACKAGE_OBJECT"
  gcloud storage cp "$WORK_DIR/beta.json" "gs://${BUCKET}/${PREFIX}/beta.json"
  gcloud storage cp "$WORK_DIR/install.sh" "gs://${BUCKET}/${PREFIX}/install.sh"
elif command -v gsutil >/dev/null 2>&1; then
  gsutil cp "$PACKAGE_PATH" "$PACKAGE_OBJECT"
  gsutil cp "$WORK_DIR/beta.json" "gs://${BUCKET}/${PREFIX}/beta.json"
  gsutil cp "$WORK_DIR/install.sh" "gs://${BUCKET}/${PREFIX}/install.sh"
else
  printf 'missing gcloud or gsutil for GCP release upload\n' >&2
  exit 1
fi

printf 'uploaded=true\n'
printf 'version=%s\n' "$VERSION"
