#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIK="$ROOT_DIR/src/brik.js"
PACKAGE_VERSION="$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync("package.json","utf8")).version)')"
tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT
export BRIK64_CONFIG_HOME="$tmpdir/config"

node "$BRIK" --version | grep -q "BRIK64 CLI 0.1.0-beta.8"
node "$BRIK" --version | node -e 'let s=""; process.stdin.on("data", (d) => { s += d; }); process.stdin.on("end", () => { s = s.replace(/\x1b\[[0-9;]*m/g, ""); if (!s.includes("█████████████") || !s.includes("▒▒▒▒▒▒▒▒▒▒▒▒")) process.exit(1); });'
node "$BRIK" --help | grep -q "status=public_beta"
node "$BRIK" --help | grep -q "polymerize <files>"
node "$BRIK" --help | grep -q "verify <file.pcd>"
node "$BRIK" --help | grep -q "migrate <file.pcd>"
node "$BRIK" doctor | grep -q "BRIK64 workspace doctor"
node "$BRIK" doctor --json | grep -q '"status": "PASS"'
node "$BRIK" doctor --json | grep -q '"localRuntime": "available"'
node "$BRIK" doctor --json | grep -q '"internalArtifactFactory": "private"'
node "$BRIK" engine status | grep -q '"runtimeMode": "portable_bir_bundle"'
node "$BRIK" engine status | grep -q '"nativeExecutableIncluded": false'

if [ "${BRIK64_RELEASE_GATES:-0}" = "1" ]; then
  beta8_functionality_out="$(bash "$ROOT_DIR/scripts/beta8-compiler-functionality-gate.sh")"
  grep -q "PASS_BRIK64_CLI_BETA8_COMPILER_FUNCTIONALITY" <<<"$beta8_functionality_out"
  beta8_adversarial_out="$(bash "$ROOT_DIR/scripts/beta8-adversarial-gate.sh")"
  grep -q "PASS_BRIK64_CLI_BETA8_ADVERSARIAL" <<<"$beta8_adversarial_out"
  beta8_package_out="$(bash "$ROOT_DIR/scripts/build-beta8-package.sh")"
  grep -q "PASS_BRIK64_CLI_BETA8_PACKAGE_BUILT" <<<"$beta8_package_out"
  beta8_package_smoke_out="$(bash "$ROOT_DIR/scripts/beta8-package-smoke.sh")"
  grep -q "decision=PASS_BRIK64_CLI_BETA8_LOCAL_PACKAGE_SMOKE" <<<"$beta8_package_smoke_out"
  node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync("evidence/beta8-package/package.manifest.json","utf8")); if (r.releaseEligible !== false || !r.requiredPublicReleaseGates.includes("curl_gcp_installer_beta8")) process.exit(1)'
  node "$ROOT_DIR/scripts/release-manifest-validate.js" --allow-dirty | grep -q "decision=PASS_RELEASE_MANIFEST_VALIDATE"
fi

(
  cd "$tmpdir"
  node "$BRIK" init
  test -f .brik/manifest.json
  test ! -f AGENTS.md
  node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(".brik/manifest.json","utf8")); if (m.engineTierPolicy.registeredManagedRuntime !== "managed_platform") process.exit(1)'
  node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(".brik/manifest.json","utf8")); if (m.preferred_engine !== "auto" || m.polymer_strategy !== "local_ast" || m.managed_platform.routing !== "local_default") process.exit(1)'
  node "$BRIK" account status | grep -q "tier: free"
  if node "$BRIK" login --token-env BRIK64_MISSING_TOKEN >/tmp/brik-login.out 2>/tmp/brik-login.err; then
    echo "login should require token env" >&2
    exit 1
  fi
  grep -q "login_token_env_missing" /tmp/brik-login.err
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
node "$BRIK" verify program.pcd | grep -q "verification=PASS"
node "$BRIK" verify program.pcd --json | grep -q '"schemaVersion": "brik64.cli_local_verify_report.v1"'
if node "$BRIK" verify program.pcd --cloud >/tmp/brik-verify-cloud.out 2>/tmp/brik-verify-cloud.err; then
  echo "cloud verify should require managed entitlement" >&2
  exit 1
fi
grep -q "managed_entitlement_required" /tmp/brik-verify-cloud.err

node "$BRIK" polymerize program.pcd --out polymer.pcd --json | grep -q '"schemaVersion": "brik64.cli_polymer_manifest.v1"'
test -f polymer.pcd
test -f polymer.pcd.manifest.json
node "$BRIK" certify polymer.pcd
if node "$BRIK" polymerize program.pcd --cloud >/tmp/brik-poly-cloud.out 2>/tmp/brik-poly-cloud.err; then
  echo "cloud polymerize should require managed entitlement" >&2
  exit 1
fi
grep -q "managed_entitlement_required" /tmp/brik-poly-cloud.err

for target in ts rust python; do
  out="out-$target"
  node "$BRIK" emit program.pcd --target "$target" --out "$out" --tests >/tmp/brik-emit-$target.out
  grep -q "generated=" "/tmp/brik-emit-$target.out"
  grep -q "tests=" "/tmp/brik-emit-$target.out"
done

test -f "$tmpdir/out-ts/program.mjs"
test -f "$tmpdir/out-ts/program.test.mjs"
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
test ! -e "$tmpdir/escaped-out/program.mjs"

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
perl -0pi -e 's/return 2;/return 3;/' stale.pcd
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

cat >legacy.pcd <<'PCD'
pc legacy {
    fn legacy(input) {
        return 5;
    }
}
PCD
if node "$BRIK" certify legacy.pcd >/tmp/brik-legacy-cert.out 2>/tmp/brik-legacy-cert.err; then
  echo "legacy PCD should require migration before certify" >&2
  exit 1
fi
grep -q "brik64 migrate" /tmp/brik-legacy-cert.err
node "$BRIK" migrate legacy.pcd --out legacy.beta7.pcd --json | grep -q '"detectedSyntax": "legacy_lowercase_pc"'
node "$BRIK" certify legacy.beta7.pcd

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
if cmp -s out-ts/program.mjs out-variant/program.mjs; then
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
