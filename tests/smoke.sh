#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

node "$BRIK" --version | grep -q "BRIK64 CLI 0.1.0-beta.3"
node "$BRIK" --help | grep -q "status=public_beta"

(
  cd "$tmpdir"
  node "$BRIK" init
  test -f .brik/manifest.json
  test ! -f AGENTS.md
)

cat >"$tmpdir/program.pcd" <<'PCD'
program sample
monomer ADD
PCD

if node "$BRIK" emit "$tmpdir/program.pcd" >/tmp/brik-emit.out 2>/tmp/brik-emit.err; then
  echo "emit should require certificate" >&2
  exit 1
fi
grep -q "certificate_required" /tmp/brik-emit.err

node "$BRIK" certify "$tmpdir/program.pcd"
node "$BRIK" emit "$tmpdir/program.pcd" | grep -q "pcd_sha256="

for target in ts rust python; do
  out="$tmpdir/out-$target"
  node "$BRIK" emit "$tmpdir/program.pcd" --target "$target" --out "$out" --tests >/tmp/brik-emit-$target.out
  grep -q "generated=" "/tmp/brik-emit-$target.out"
  grep -q "tests=" "/tmp/brik-emit-$target.out"
done

test -f "$tmpdir/out-ts/program.ts"
test -f "$tmpdir/out-ts/program.test.ts"
test -f "$tmpdir/out-rust/program.rs"
test -f "$tmpdir/out-rust/program_test.rs"
test -f "$tmpdir/out-python/program.py"
test -f "$tmpdir/out-python/test_program.py"

if node "$BRIK" emit "$tmpdir/program.pcd" --target go --out "$tmpdir/out-go" --tests >/tmp/brik-emit-go.out 2>/tmp/brik-emit-go.err; then
  echo "unsupported target should fail closed" >&2
  exit 1
fi
grep -q "unsupported_target" /tmp/brik-emit-go.err

echo "brik64-cli bootstrap smoke: PASS"
