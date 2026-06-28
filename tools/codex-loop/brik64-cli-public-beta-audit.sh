#!/usr/bin/env bash
set -euo pipefail

echo "# BRIK64 CLI public beta audit"
echo "repo=$(pwd)"

AUDIT_ROOT="${CODEX_LOOP_AUDIT_ROOT:-.codex-loop-runs/public-beta-audit-$(date +%Y%m%dT%H%M%S)}"
mkdir -p "$AUDIT_ROOT"

curl -fsSL https://brik64.com/cli/beta.json -o "$AUDIT_ROOT/beta.json"
VERSION="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(m.currentVersion)' "$AUDIT_ROOT/beta.json")"
MANIFEST_URL="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log("https://brik64.com"+m.releaseManifest)' "$AUDIT_ROOT/beta.json")"
curl -fsSL "$MANIFEST_URL" -o "$AUDIT_ROOT/release.json"

PKG_URL="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(m.package.url)' "$AUDIT_ROOT/release.json")"
EXPECTED_SHA="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(m.package.sha256)' "$AUDIT_ROOT/release.json")"
PLATFORM="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(m.package.platform||"unknown")' "$AUDIT_ROOT/release.json")"
PKG="$AUDIT_ROOT/$(basename "$PKG_URL")"
curl -fL "$PKG_URL" -o "$PKG"

if command -v shasum >/dev/null 2>&1; then
  ACTUAL_SHA="$(shasum -a 256 "$PKG" | awk '{print $1}')"
else
  ACTUAL_SHA="$(sha256sum "$PKG" | awk '{print $1}')"
fi

if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
  echo "FAILED: package sha mismatch expected=$EXPECTED_SHA actual=$ACTUAL_SHA"
  exit 2
fi

echo "version=$VERSION" | tee "$AUDIT_ROOT/summary.txt"
echo "platform=$PLATFORM" | tee -a "$AUDIT_ROOT/summary.txt"
echo "sha256=$ACTUAL_SHA" | tee -a "$AUDIT_ROOT/summary.txt"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m | tr '[:upper:]' '[:lower:]')"
if [ "$PLATFORM" = "linux-x64" ] && { [ "$OS" != "linux" ] || { [ "$ARCH" != "x86_64" ] && [ "$ARCH" != "amd64" ]; }; }; then
  echo "NEEDS_LINUX_RUNTIME: public package is $PLATFORM but current host is $OS/$ARCH"
  echo "This is metadata/hash evidence only; run this audit on Linux x64 for functional evidence."
  exit 0
fi

EXTRACT="$AUDIT_ROOT/extract"
mkdir -p "$EXTRACT"
tar -xzf "$PKG" -C "$EXTRACT"
CLI_ROOT="$(find "$EXTRACT" -maxdepth 2 -type f -path '*/src/brik.js' -print -quit | xargs dirname | xargs dirname)"
if [ -z "$CLI_ROOT" ] || [ ! -f "$CLI_ROOT/src/brik.js" ]; then
  echo "FAILED: package did not contain src/brik.js"
  exit 2
fi

node "$CLI_ROOT/src/brik.js" --version | tee "$AUDIT_ROOT/version.out"
node "$CLI_ROOT/src/brik.js" engine status --json | tee "$AUDIT_ROOT/engine-status.json"
node "$CLI_ROOT/src/brik.js" doctor --json | tee "$AUDIT_ROOT/doctor.json"
node "$CLI_ROOT/src/brik.js" monomers list --json | tee "$AUDIT_ROOT/monomers-list.json"
node "$CLI_ROOT/src/brik.js" monomers test --all --json | tee "$AUDIT_ROOT/monomers-test.json"

echo "PUBLIC BETA AUDIT COMPLETE: metadata, runtime identity, engine, doctor and monomer checks passed"
