#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

sha256_file() { shasum -a 256 "$1" | awk '{print $1}'; }

make_request() {
  local version="$1"
  local out="$2"
  local pcd_a="$TMP_DIR/l6_cli_materialization_contract.pcd"
  local pcd_b="$TMP_DIR/l6_cli_materialization_result_contract.pcd"
  printf '%s\n' '// brik64.pcd_file.v1' 'PC l6_cli_materialization_contract { fn run(x: i64) -> i64 { return x; } }' >"$pcd_a"
  printf '%s\n' '// brik64.pcd_file.v1' 'PC l6_cli_materialization_result_contract { fn run(x: i64) -> i64 { return x; } }' >"$pcd_b"
  node - "$version" "$out" "$pcd_a" "$pcd_b" <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const [version, out, pcdA, pcdB] = process.argv.slice(2);
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
function pcd(path, rel) {
  const content = fs.readFileSync(path);
  return {
    path: rel,
    sha256: sha(content),
    bytes: content.length,
    contentBase64: content.toString('base64'),
  };
}
const inputPcds = [
  pcd(pcdA, 'pcd/beta15_7/release/l6_cli_materialization_contract.pcd'),
  pcd(pcdB, 'pcd/beta15_7/release/l6_cli_materialization_result_contract.pcd'),
];
const request = {
  schemaVersion: 'brik64.l6plus_cli_materialization_request.v1',
  version,
  materializerMode: 'l6plus_pcd_polymer_materializer',
  pcdInputSetSha256: sha(inputPcds.map((item) => `${item.sha256}  ${item.path}`).join('\n') + '\n'),
  inputPcds,
  outputRefs: {
    generatedArtifact: `evidence/beta15_7-l6-generation/generated/brik64-cli-${version}.mjs`,
    package: `evidence/beta15_7-package/brik64-cli-${version}.tgz`,
    releaseManifest: 'release/manifest.json',
    sealReport: 'evidence/beta15_7-l6-generation/seal_report.json',
  },
  outputArtifacts: {
    package: {
      path: `evidence/beta15_7-package/brik64-cli-${version}.tgz`,
      sha256: 'a'.repeat(64),
      bytes: 7,
    },
    releaseManifest: {
      path: 'release/manifest.json',
      sha256: 'b'.repeat(64),
      bytes: 9,
    },
  },
  claimBoundary: {
    publicClaimsAllowed: false,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false,
  },
};
fs.writeFileSync(out, JSON.stringify(request, null, 2));
NODE
}

run_materializer() {
  local request="$1"
  BRIK64_L6_SERIAL_PATH="$TMP_DIR/serial.txt" \
  BRIK64_L6_WRAPPER_PATH="$TMP_DIR/wrapper" \
  BRIK64_L6_EXEC_TARGET="$TMP_DIR/exec-target" \
    node "$ROOT/scripts/remote_l6_beta15_7_cli_materializer.js" "@@FILE:$request"
}

printf '%s\n' 'BRIK64-L6PLUS-N5-TEST' >"$TMP_DIR/serial.txt"
printf '%s\n' '#!/usr/bin/env bash' 'exit 0' >"$TMP_DIR/wrapper"
printf '%s\n' 'exec-target' >"$TMP_DIR/exec-target"
chmod +x "$TMP_DIR/wrapper"

for version in "0.1.0-beta.15.7" "0.1.0-beta.15.7.1"; do
  request="$TMP_DIR/request-$version.json"
  make_request "$version" "$request"
  out="$TMP_DIR/out-$version.txt"
  run_materializer "$request" >"$out"
  node - "$version" "$out" "$request" <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const [version, outPath, requestPath] = process.argv.slice(2);
const line = fs.readFileSync(outPath, 'utf8').trim();
if (!line.startsWith('BRIK64_L6_CLI_MATERIALIZATION_RESULT\t')) {
  throw new Error(`missing_result_line:${line}`);
}
const result = JSON.parse(Buffer.from(line.split('\t')[1], 'base64').toString('utf8'));
const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const requestLine = `BRIK64_L6_CLI_MATERIALIZATION_REQUEST\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`;
if (result.version !== version) throw new Error(`result_version_mismatch:${result.version}:${version}`);
if (result.materializerRequestSha256 !== sha(requestLine)) throw new Error('materializer_request_sha_mismatch');
if (result.packageSha256 !== 'a'.repeat(64)) throw new Error('package_hash_mismatch');
if (result.releaseManifestSha256 !== 'b'.repeat(64)) throw new Error('release_hash_mismatch');
if (!result.generatedByL6PlusN5 || !result.pcdToArtifactHashBound || !result.sealReportPass) {
  throw new Error('result_binding_flags_missing');
}
const generated = Buffer.from(result.generatedArtifactContentBase64, 'base64').toString('utf8');
if (!generated.includes(`"version": "${version}"`)) throw new Error('generated_artifact_version_missing');
NODE
done

bad="$TMP_DIR/request-bad.json"
make_request "0.1.0-beta.15.8" "$bad"
if run_materializer "$bad" >"$TMP_DIR/bad.out" 2>"$TMP_DIR/bad.err"; then
  echo "expected out-of-family version to fail closed" >&2
  exit 1
fi
grep -q 'version_mismatch:0.1.0-beta.15.8' "$TMP_DIR/bad.err"

unsafe="$TMP_DIR/request-unsafe.json"
make_request "0.1.0-beta.15.7.2" "$unsafe"
node - "$unsafe" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const request = JSON.parse(fs.readFileSync(file, 'utf8'));
request.outputRefs.generatedArtifact = '../escape.mjs';
fs.writeFileSync(file, JSON.stringify(request, null, 2));
NODE
if run_materializer "$unsafe" >"$TMP_DIR/unsafe.out" 2>"$TMP_DIR/unsafe.err"; then
  echo "expected unsafe output ref to fail closed" >&2
  exit 1
fi
grep -q 'unsafe_output_ref:generatedArtifact' "$TMP_DIR/unsafe.err"

printf 'decision=PASS_REMOTE_L6_BETA15_7_CLI_MATERIALIZER_TEST\n'
