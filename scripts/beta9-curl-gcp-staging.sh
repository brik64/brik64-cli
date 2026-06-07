#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.1.0-beta.9"
OUT_DIR="$ROOT_DIR/evidence/beta9-curl-gcp-staging"
PACKAGE_MANIFEST="$ROOT_DIR/evidence/beta9-package/package.manifest.json"
PACKAGE_PATH="$ROOT_DIR/$(jq -r '.package.path' "$PACKAGE_MANIFEST")"
PACKAGE_SHA="$(jq -r '.package.sha256' "$PACKAGE_MANIFEST")"
PACKAGE_BASENAME="$(basename "$PACKAGE_PATH")"
PACKAGE_COPY="$OUT_DIR/releases/$VERSION/$PACKAGE_BASENAME"
INSTALLER="$OUT_DIR/install.sh"
CHANNEL="$OUT_DIR/beta.json"
REPORT="$ROOT_DIR/evidence/beta9-public-surfaces/curl-gcp-installer.json"

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

sha256_file() { shasum -a 256 "$1" | awk '{print $1}'; }

if [[ "$(jq -r '.version' "$PACKAGE_MANIFEST")" != "$VERSION" ]]; then
  echo "package_manifest_version_drift" >&2
  exit 1
fi
if [[ "$(sha256_file "$PACKAGE_PATH")" != "$PACKAGE_SHA" ]]; then
  echo "package_hash_mismatch" >&2
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$(dirname "$PACKAGE_COPY")"
cp "$PACKAGE_PATH" "$PACKAGE_COPY"

PACKAGE_URL="file://$PACKAGE_COPY"

cat > "$CHANNEL" <<JSON
{
  "schemaVersion": "brik64.cli_channel_manifest.v1",
  "channel": "beta",
  "currentVersion": "$VERSION",
  "package": {
    "url": "$PACKAGE_URL",
    "sha256": "$PACKAGE_SHA",
    "runtime": "node>=20"
  }
}
JSON

cat > "$INSTALLER" <<SH
#!/usr/bin/env bash
set -euo pipefail

VERSION="$VERSION"
PACKAGE_URL="$PACKAGE_URL"
PACKAGE_SHA="$PACKAGE_SHA"
PREFIX="\${BRIK64_INSTALL_PREFIX:-\$HOME/.brik64}"

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

case "\$PACKAGE_URL" in
  file://*) cp "\${PACKAGE_URL#file://}" "\$TMP_DIR/brik64-cli.tgz" ;;
  *) curl -fsSL "\$PACKAGE_URL" -o "\$TMP_DIR/brik64-cli.tgz" ;;
esac

ACTUAL_SHA="\$(shasum -a 256 "\$TMP_DIR/brik64-cli.tgz" | awk '{print \$1}')"
if [ "\$ACTUAL_SHA" != "\$PACKAGE_SHA" ]; then
  printf 'BRIK64 CLI checksum mismatch for %s.\\n' "\$VERSION" >&2
  exit 1
fi

mkdir -p "\$PREFIX"
tar -xzf "\$TMP_DIR/brik64-cli.tgz" -C "\$PREFIX"
ln -sfn "\$PREFIX/brik64-cli-\$VERSION/src/brik.js" "\$PREFIX/brik64"
"\$PREFIX/brik64" --version
SH
chmod 0755 "$INSTALLER"

TMP_HOME="$(mktemp -d "${TMPDIR:-/tmp}/brik64-beta9-install.XXXXXX")"
SMOKE_OUT="$(mktemp -d "${TMPDIR:-/tmp}/brik64-beta9-smoke.XXXXXX")"
trap 'rm -rf "$TMP_HOME" "$SMOKE_OUT"' EXIT
BRIK64_INSTALL_PREFIX="$TMP_HOME/prefix" "$INSTALLER" > "$SMOKE_OUT/install.stdout" 2> "$SMOKE_OUT/install.stderr"
"$TMP_HOME/prefix/brik64" --version > "$SMOKE_OUT/version.stdout"
installed_version="$(grep -Eo 'BRIK64 CLI [0-9A-Za-z.-]+' "$SMOKE_OUT/version.stdout" | tail -1 | awk '{print $3}')"
if [[ "$installed_version" != "$VERSION" ]]; then
  echo "staged_install_version_drift:$installed_version" >&2
  exit 1
fi

installer_sha="$(sha256_file "$INSTALLER")"
channel_sha="$(sha256_file "$CHANNEL")"
package_copy_sha="$(sha256_file "$PACKAGE_COPY")"

jq -n \
  --arg schemaVersion "brik64.beta9_curl_gcp_installer_surface.v1" \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg decision "STAGED_BETA9_CURL_GCP_INSTALLER" \
  --arg version "$VERSION" \
  --arg installerPath "evidence/beta9-curl-gcp-staging/install.sh" \
  --arg installerSha "sha256:$installer_sha" \
  --arg channelPath "evidence/beta9-curl-gcp-staging/beta.json" \
  --arg channelSha "sha256:$channel_sha" \
  --arg packagePath "evidence/beta9-curl-gcp-staging/releases/$VERSION/$PACKAGE_BASENAME" \
  --arg packageSha "sha256:$package_copy_sha" \
  --arg installedVersion "$installed_version" \
  '{
    schemaVersion:$schemaVersion,
    generatedAt:$generatedAt,
    decision:$decision,
    version:$version,
    releaseEligible:false,
    publicSurfacePassed:false,
    reason:"curl/GCP installer is staged locally only; public GCP objects and brik64.com routes are not updated.",
    artifacts:{
      installer:{path:$installerPath, sha256:$installerSha},
      channelManifest:{path:$channelPath, sha256:$channelSha},
      package:{path:$packagePath, sha256:$packageSha}
    },
    checks:{
      package_hash_matches:true,
      channel_manifest_version:true,
      staged_install_smoke:true,
      staged_install_version:$installedVersion,
      public_gcp_uploaded:false,
      brik64_com_live_updated:false
    },
    requiredNextAction:"Upload package, beta.json and install.sh to the public GCP/curl surface only inside the final atomic release train."
  }' > "$REPORT"

cat "$REPORT"
