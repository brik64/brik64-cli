#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
PACKAGE_VERSION="$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync("package.json","utf8")).version)')"
tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

node "$BRIK" --version | grep -q "BRIK64 CLI 0.1.0-beta.6"
node "$BRIK" --version | node -e 'let s=""; process.stdin.on("data", (d) => { s += d; }); process.stdin.on("end", () => { s = s.replace(/\x1b\[[0-9;]*m/g, ""); if (!s.includes("█████████████") || !s.includes("▒▒▒▒▒▒▒▒▒▒▒▒")) process.exit(1); });'
node "$BRIK" --help | grep -q "status=public_beta"
node "$BRIK" doctor | grep -q '"status": "PASS"'
node "$BRIK" doctor | grep -q '"publicOfflineRuntime": "L4+N5"'
node "$BRIK" doctor | grep -q '"internalArtifactFactory": "L6+N5"'
node "$BRIK" engine status | grep -q '"runtimeMode": "portable_bir_bundle"'
node "$BRIK" engine status | grep -q '"nativeExecutableIncluded": false'

if [ "${BRIK64_RELEASE_GATES:-0}" = "1" ]; then
  if [ "${GITHUB_ACTIONS:-false}" != "true" ]; then
    node "$ROOT_DIR/scripts/beta6-sdk-sync-gate.js" | grep -q "decision=PASS_SDK_BETA6_SYNC"
    node "$ROOT_DIR/scripts/beta6-skills-sync-gate.js" | grep -q "decision=PASS_SKILLS_BETA6_SYNC"
    node "$ROOT_DIR/scripts/beta6-docs-web-sync-gate.js" | grep -q "decision=PASS_DOCS_WEB_BETA6_SYNC"
    node "$ROOT_DIR/scripts/beta6-marketplace-package-gate.js" | grep -q "decision=PASS_MARKETPLACE_PACKAGE_GATE"
  fi
  node "$ROOT_DIR/scripts/build-beta6-package.js" | grep -q "PASS_BETA6_PACKAGE_BUILT"
  node "$ROOT_DIR/scripts/beta6-package-smoke.js" | grep -q "decision=PASS_BETA6_LOCAL_PACKAGE_SMOKE"
  if [ "$PACKAGE_VERSION" != "0.1.0-beta.6" ]; then
    node "$ROOT_DIR/scripts/build-beta5-candidate.js" | grep -q "releaseEligible=false"
    node "$ROOT_DIR/scripts/beta5-publication-preflight.js" | grep -q "decision=BLOCKED_PUBLICATION_PREFLIGHT"
    if node "$ROOT_DIR/scripts/beta5-publication-preflight.js" --release >/tmp/brik-publication-preflight.out 2>/tmp/brik-publication-preflight.err; then
      echo "publication preflight should fail closed in release mode" >&2
      exit 1
    fi
    grep -q "githubReleaseAllowed=false" /tmp/brik-publication-preflight.out
    node "$ROOT_DIR/scripts/beta5-release-surface-gate.js" | grep -q "decision=PASS_RELEASE_SURFACE_GATE"
    node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync("evidence/beta5-release-surface-gate/report.json","utf8")); if (r.releaseEligible !== true || !r.buildChain.changelogBound || !r.buildChain.matrixBound) process.exit(1)'
    node "$ROOT_DIR/scripts/beta5-release-surface-gate.js" --release | grep -q "decision=PASS_RELEASE_SURFACE_GATE"
  fi
  node "$ROOT_DIR/scripts/release-manifest-validate.js" --allow-dirty | grep -q "decision=PASS_RELEASE_MANIFEST_VALIDATE"
  if [ "$PACKAGE_VERSION" != "0.1.0-beta.6" ]; then
    if node "$ROOT_DIR/scripts/beta5-l6-factory-bridge.js" >/tmp/brik-l6-preflight.out 2>/tmp/brik-l6-preflight.err; then
      echo "offline L6 preflight should block without live route2 probe" >&2
      exit 1
    fi
    grep -q "decision=BLOCKED_L6_FACTORY_BRIDGE" /tmp/brik-l6-preflight.out
    node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync("evidence/beta5-l6-factory-bridge/preflight-report.json","utf8")); if (r.checks.offlineContract !== true || r.releaseEligible !== false) process.exit(1)'
  fi
fi

(
  cd "$tmpdir"
  node "$BRIK" init
  test -f .brik/manifest.json
  test ! -f AGENTS.md
  node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(".brik/manifest.json","utf8")); if (m.engineTierPolicy.registeredManagedRuntime !== "L5+N5") process.exit(1)'
  if node "$BRIK" doctor >/tmp/brik-empty-doctor.out 2>/tmp/brik-empty-doctor.err; then
    echo "doctor should require PCD inventory" >&2
    exit 1
  fi
  grep -q "pcd_inventory_empty" /tmp/brik-empty-doctor.err
)

cat >"$tmpdir/program.pcd" <<'PCD'
// beta5 minimal valid PCD
PC sample {
    fn sample(input) {
        if (input == 0) {
            return 1;
        }
        return 2;
    }
}
PCD

(
cd "$tmpdir"

if node "$BRIK" emit program.pcd >/tmp/brik-emit.out 2>/tmp/brik-emit.err; then
  echo "emit should require certificate" >&2
  exit 1
fi
grep -q "certificate_required" /tmp/brik-emit.err

node "$BRIK" certify program.pcd
node "$BRIK" emit program.pcd | grep -q "pcd_sha256="

for target in ts rust python; do
  out="out-$target"
  node "$BRIK" emit program.pcd --target "$target" --out "$out" --tests >/tmp/brik-emit-$target.out
  grep -q "generated=" "/tmp/brik-emit-$target.out"
  grep -q "tests=" "/tmp/brik-emit-$target.out"
done

test -f "$tmpdir/out-ts/program.ts"
test -f "$tmpdir/out-ts/program.test.ts"
test -f "$tmpdir/out-rust/program.rs"
test -f "$tmpdir/out-rust/program_test.rs"
test -f "$tmpdir/out-python/program.py"
test -f "$tmpdir/out-python/test_program.py"

if node "$BRIK" emit program.pcd --target go --out out-go --tests >/tmp/brik-emit-go.out 2>/tmp/brik-emit-go.err; then
  echo "unsupported target should fail closed" >&2
  exit 1
fi
grep -q "unsupported_target" /tmp/brik-emit-go.err

if node "$BRIK" emit program.pcd --target ts --out ../escaped-out --tests >/tmp/brik-out-traversal.out 2>/tmp/brik-out-traversal.err; then
  echo "output path traversal should fail closed" >&2
  exit 1
fi
grep -q "path_outside_workspace" /tmp/brik-out-traversal.err
test ! -e "$tmpdir/escaped-out/program.ts"

mkdir readonly
chmod 500 readonly
if node "$BRIK" emit program.pcd --target ts --out readonly/child --tests >/tmp/brik-readonly.out 2>/tmp/brik-readonly.err; then
  chmod 700 readonly
  echo "read-only output should fail closed" >&2
  exit 1
fi
chmod 700 readonly
grep -q "filesystem_mkdir_error" /tmp/brik-readonly.err
if grep -q "at Object\\.mkdirSync\\|Node\\.js" /tmp/brik-readonly.err; then
  echo "filesystem errors should not expose node stack traces" >&2
  exit 1
fi

cp program.pcd stale.pcd
node "$BRIK" certify stale.pcd
printf '\n        return 3;\n' >> stale.pcd
if node "$BRIK" emit stale.pcd >/tmp/brik-stale.out 2>/tmp/brik-stale.err; then
  echo "stale certificate should fail closed" >&2
  exit 1
fi
grep -q "certificate_hash_mismatch" /tmp/brik-stale.err

touch empty.pcd
if node "$BRIK" certify empty.pcd >/tmp/brik-empty.out 2>/tmp/brik-empty.err; then
  echo "empty PCD should fail closed" >&2
  exit 1
fi
grep -q "pcd_empty" /tmp/brik-empty.err

printf 'not a pcd\n' > corrupt.pcd
if node "$BRIK" certify corrupt.pcd >/tmp/brik-corrupt.out 2>/tmp/brik-corrupt.err; then
  echo "corrupt PCD should fail closed" >&2
  exit 1
fi
grep -q "pcd_parse_error" /tmp/brik-corrupt.err

cat >variant.pcd <<'PCD'
PC variant {
    fn variant(input) {
        if (input == 1) {
            return 8;
        }
        return 13;
    }
}
PCD
node "$BRIK" certify variant.pcd
node "$BRIK" emit variant.pcd --target ts --out out-variant --tests >/tmp/brik-emit-variant.out
if cmp -s out-ts/program.ts out-variant/program.ts; then
  echo "different valid PCDs should emit different outputs" >&2
  exit 1
fi

printf '{ corrupted_json\n' > .brik/manifest.json
if node "$BRIK" certify program.pcd >/tmp/brik-bad-manifest.out 2>/tmp/brik-bad-manifest.err; then
  echo "corrupt manifest should fail closed" >&2
  exit 1
fi
grep -q "manifest_parse_error" /tmp/brik-bad-manifest.err

rm .brik/manifest.json
node "$BRIK" init >/tmp/brik-reinit.out
node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(".brik/manifest.json","utf8")); m.engineTierPolicy.l6DistributionAllowed=true; fs.writeFileSync(".brik/manifest.json", JSON.stringify(m,null,2)+"\n")'
if node "$BRIK" doctor >/tmp/brik-bad-tier.out 2>/tmp/brik-bad-tier.err; then
  echo "doctor should fail closed on L6 distribution" >&2
  exit 1
fi
grep -q "engine_tier_policy_l6_distribution_open" /tmp/brik-bad-tier.err
)

echo "brik64-cli bootstrap smoke: PASS"
