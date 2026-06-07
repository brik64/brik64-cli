#!/usr/bin/env bash
set -euo pipefail

VERSION="0.1.0-beta.9"
PACKAGE_URL="file:///Users/carlosjperez/Documents/GitHub/brik64-cli-beta9/evidence/beta9-curl-gcp-staging/releases/0.1.0-beta.9/brik64-cli-0.1.0-beta.9.tgz"
PACKAGE_SHA="aa135949297c2fb9a91e38d03f5b8c1f10bf4fb023c1163c35f39073b46118c5"
PREFIX="${BRIK64_INSTALL_PREFIX:-$HOME/.brik64}"

if ! command -v node >/dev/null 2>&1; then
  printf 'BRIK64 CLI %s requires Node.js 20 or newer. Install Node.js, then rerun this installer.\n' "$VERSION" >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  printf 'BRIK64 CLI %s requires Node.js 20 or newer. Detected Node.js %s.\n' "$VERSION" "$(node --version)" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/brik64-install.XXXXXX")"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

case "$PACKAGE_URL" in
  file://*) cp "${PACKAGE_URL#file://}" "$TMP_DIR/brik64-cli.tgz" ;;
  *) curl -fsSL "$PACKAGE_URL" -o "$TMP_DIR/brik64-cli.tgz" ;;
esac

ACTUAL_SHA="$(shasum -a 256 "$TMP_DIR/brik64-cli.tgz" | awk '{print $1}')"
if [ "$ACTUAL_SHA" != "$PACKAGE_SHA" ]; then
  printf 'BRIK64 CLI checksum mismatch for %s.\n' "$VERSION" >&2
  exit 1
fi

mkdir -p "$PREFIX"
tar -xzf "$TMP_DIR/brik64-cli.tgz" -C "$PREFIX"
ln -sfn "$PREFIX/brik64-cli-$VERSION/src/brik.js" "$PREFIX/brik64"
"$PREFIX/brik64" --version
