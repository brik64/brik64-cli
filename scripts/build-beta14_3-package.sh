#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.1.0-beta.14.3"
OUT_DIR="$ROOT_DIR/evidence/beta14_3-package"
STAGE_ROOT="$OUT_DIR/stage"
STAGE_NAME="brik64-cli-$VERSION"
STAGE_DIR="$STAGE_ROOT/$STAGE_NAME"
PACKAGE_NAME="brik64-cli-$VERSION.tgz"
PACKAGE_PATH="$OUT_DIR/$PACKAGE_NAME"
MANIFEST_PATH="$OUT_DIR/package.manifest.json"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing command: $1" >&2
    exit 2
  }
}

need_cmd node
need_cmd jq
need_cmd tar
need_cmd gzip
need_cmd shasum

sha256_file() { shasum -a 256 "$1" | awk '{print $1}'; }
file_size() { wc -c < "$1" | tr -d '[:space:]'; }
json_field() { jq -r "$2" "$1"; }

copy_input() {
  local relative="$1"
  local source="$ROOT_DIR/$relative"
  local dest="$STAGE_DIR/$relative"
  if [[ ! -e "$source" ]]; then
    echo "missing_package_input:$relative" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$dest")"
  cp -R "$source" "$dest"
}

package_version="$(json_field "$ROOT_DIR/package.json" '.version')"
manifest_version="$(json_field "$ROOT_DIR/.brik/manifest.json" '.cliVersion')"
local_gate="$ROOT_DIR/evidence/beta14-source-lift/report.json"
audit_gate="$ROOT_DIR/evidence/beta14_3-audit-closure/report.json"
audit_gate_fallback="$ROOT_DIR/evidence/beta14_2-audit-closure/report.json"
monomer_gate="$ROOT_DIR/evidence/beta14_3-monomer-128/report.json"
local_gate_decision="$(test -f "$local_gate" && json_field "$local_gate" '.decision' || true)"
audit_gate_decision="$(test -f "$audit_gate" && json_field "$audit_gate" '.decision' || true)"
if [[ -z "$audit_gate_decision" && -f "$audit_gate_fallback" ]]; then
  audit_gate_decision="$(json_field "$audit_gate_fallback" '.decision')"
fi
monomer_gate_decision="$(test -f "$monomer_gate" && json_field "$monomer_gate" '.decision' || true)"

failures=()
[[ "$package_version" == "$VERSION" ]] || failures+=("package_version_drift:$package_version")
[[ "$manifest_version" == "$VERSION" ]] || failures+=("brik_manifest_version_drift:$manifest_version")
[[ "$local_gate_decision" == "PASS_BETA14_SOURCE_LIFT_GATE" ]] || failures+=("beta14_source_lift_gate_missing_or_invalid:$local_gate_decision")
[[ "$audit_gate_decision" == "PASS_BETA14_3_AUDIT_CLOSURE_GATE" || "$audit_gate_decision" == "PASS_BETA14_2_AUDIT_CLOSURE_GATE" ]] || failures+=("beta14_3_audit_closure_gate_missing_or_invalid:$audit_gate_decision")
[[ "$monomer_gate_decision" == "PASS_BETA14_3_MONOMER_128_GATE" ]] || failures+=("beta14_3_monomer_128_gate_missing_or_invalid:$monomer_gate_decision")

if [[ "${#failures[@]}" -gt 0 ]]; then
  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR"
  printf '%s\n' "${failures[@]}" | jq -Rsc \
    --arg version "$VERSION" \
    '{
      schemaVersion:"brik64.cli_beta14_3_package_manifest.v1",
      version:$version,
      decision:"FAIL_BRIK64_CLI_BETA14_3_PACKAGE_BUILT",
      releaseEligible:false,
      failures:(split("\n") | map(select(length > 0)))
    }' > "$MANIFEST_PATH"
  printf 'beta14_package_input_gate_failed:%s\n' "${failures[*]}" >&2
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$STAGE_DIR"

inputs=(
  ".brik/manifest.json"
  "README.md"
  "CHANGELOG.md"
  "LICENSE"
  "NOTICE"
  "SECURITY.md"
  "src/brik.js"
  "pcd/README.md"
  "pcd/cli_core.pcd"
  "pcd/cli_polymer.pcd"
  "pcd/cli_account_session.pcd"
  "pcd/cli_migrate.pcd"
  "pcd/cli_polymerize.pcd"
  "pcd/cli_verify.pcd"
  "pcd/cli_beta9_transpiler_contract.pcd"
  "pcd/cli_beta10_modular_diagnostics_contract.pcd"
  "pcd/cli_beta12_security_telemetry_contract.pcd"
  "pcd/cli_beta14_release_contract.pcd"
  "pcd/beta14_3"
  "evidence/beta14_3-monomer-128/report.json"
  "evidence/beta14_3-l6-generation/gate-report.json"
  "evidence/beta14_3-l6-generation/l6plus_engine_manifest.json"
  "evidence/beta14_3-l6-generation/materialization-probe.json"
  "evidence/beta14_3-l6-generation/materialization-attempt-report.json"
  "evidence/beta14_3-l6-generation/generated_artifact_manifest.json"
  "evidence/beta14_3-l6-generation/seal_report.json"
  "evidence/beta14_3-l6-generation/hashes.json"
  "evidence/beta14_3-l6-generation/input_pcd_hashes.tsv"
  "evidence/beta14_3-l6-generation/materialization-SHA256SUMS"
  "evidence/beta14_3-l6-generation/materialization-failures.txt"
  "evidence/beta14_3-l6-generation/materialization-out-files.txt"
  "evidence/beta14_3-l6-generation/materialization-out.tgz"
  "evidence/beta14_3-l6-generation/materialization-stdout.txt"
  "evidence/beta14_3-l6-generation/serial.txt"
  "engines/l4plus-n5/serial.txt"
  "engines/l4plus-n5/checksums.tsv"
  "engines/l4plus-n5/runtime-bundle.manifest.json"
  "engines/l4plus-n5/manifest/claim_boundary.json"
  "engines/l4plus-n5/evidence/l4plus_n5_critical_artifact_lock.json"
  "engines/l4plus-n5/evidence/l4plus_n5_critical_freeze_certificate.json"
  "engines/l4plus-n5/evidence/l4plus_n5_critical_freeze_report.json"
  "engines/l4plus-n5/evidence/l4plus_n5_burn_in_report.json"
  "engines/l4plus-n5/pcd/engine.manifest.json"
  "engines/l4plus-n5/pcd/engine.pcd"
  "engines/l4plus-n5/pcd/l4plus_engine_runtime.bir"
  "engines/l4plus-n5/pcd/l4plus_engine_runtime.bir.asm"
  "engines/l4plus-n5/pcd/l4plus_engine_runtime.cert.json"
  "engines/l4plus-n5/pcd/harness.manifest.json"
  "engines/l4plus-n5/pcd/harness.pcd"
  "engines/l4plus-n5/pcd/l4plus_n5_harness.bir"
  "engines/l4plus-n5/pcd/l4plus_n5_harness.cert.json"
  "engines/l4plus-n5/pcd/runtime_adapter.manifest.json"
  "engines/l4plus-n5/pcd/runtime_adapter.pcd"
  "engines/l4plus-n5/pcd/l4plus_n5_runtime_adapter.bir"
  "engines/l4plus-n5/pcd/l4plus_n5_runtime_adapter.cert.json"
)

for input in "${inputs[@]}"; do
  copy_input "$input"
done

jq -n \
  --arg version "$VERSION" \
  '{
    name:"@brik64/cli",
    version:$version,
    private:true,
	    description:"BRIK64 CLI beta14.3 candidate for local PCD workflows, 128 monomer registry inspection, lift previews, and secure evidence review.",
    bin:{brik:"src/brik.js"},
    engines:{node:">=20"},
    distribution:"curl_and_github_release_assets"
  }' > "$STAGE_DIR/package.json"
chmod 755 "$STAGE_DIR/src/brik.js"

if [[ -e "$STAGE_DIR/evidence" ]]; then
  if [[ ! -e "$STAGE_DIR/evidence/beta14_3-monomer-128/report.json" ]]; then
    echo "package_contains_unexpected_evidence_payload" >&2
    exit 1
  fi
fi

find "$STAGE_DIR" -type d -exec chmod 755 {} +
find "$STAGE_DIR" -type f -exec chmod 644 {} +
chmod 755 "$STAGE_DIR/src/brik.js"
find "$STAGE_DIR" -exec touch -t 202606070000 {} +

node - "$STAGE_ROOT" "$STAGE_NAME" "$PACKAGE_PATH" <<'NODE'
const fs = require('fs');
const path = require('path');

const [stageRoot, stageName, packagePath] = process.argv.slice(2);
const root = path.join(stageRoot, stageName);
const blocks = [];
const crcTable = new Uint32Array(256);

for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function writeString(buffer, offset, length, value) {
  const bytes = Buffer.from(value);
  bytes.copy(buffer, offset, 0, Math.min(bytes.length, length));
}

function writeOctal(buffer, offset, length, value) {
  const text = value.toString(8).padStart(length - 1, '0').slice(-(length - 1));
  writeString(buffer, offset, length - 1, text);
  buffer[offset + length - 1] = 0;
}

function header(name, size, mode) {
  const buffer = Buffer.alloc(512, 0);
  const normalized = name.replace(/\\/g, '/');
  if (Buffer.byteLength(normalized) > 100) {
    throw new Error(`tar_path_too_long:${normalized}`);
  }
  writeString(buffer, 0, 100, normalized);
  writeOctal(buffer, 100, 8, mode);
  writeOctal(buffer, 108, 8, 0);
  writeOctal(buffer, 116, 8, 0);
  writeOctal(buffer, 124, 12, size);
  writeOctal(buffer, 136, 12, 1781308800);
  buffer.fill(0x20, 148, 156);
  buffer[156] = '0'.charCodeAt(0);
  writeString(buffer, 257, 6, 'ustar');
  writeString(buffer, 263, 2, '00');
  writeString(buffer, 265, 32, 'brik64');
  writeString(buffer, 297, 32, 'brik64');
  let checksum = 0;
  for (const byte of buffer) checksum += byte;
  const checksumText = checksum.toString(8).padStart(6, '0').slice(-6);
  writeString(buffer, 148, 6, checksumText);
  buffer[154] = 0;
  buffer[155] = 0x20;
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function gzipStored(buffer) {
  const parts = [Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff])];
  for (let offset = 0; offset < buffer.length; offset += 65535) {
    const chunk = buffer.subarray(offset, Math.min(offset + 65535, buffer.length));
    const header = Buffer.alloc(5);
    header[0] = offset + chunk.length >= buffer.length ? 0x01 : 0x00;
    header.writeUInt16LE(chunk.length, 1);
    header.writeUInt16LE((~chunk.length) & 0xffff, 3);
    parts.push(header, chunk);
  }
  const trailer = Buffer.alloc(8);
  trailer.writeUInt32LE(crc32(buffer), 0);
  trailer.writeUInt32LE(buffer.length >>> 0, 4);
  parts.push(trailer);
  return Buffer.concat(parts);
}

for (const file of listFiles(root)) {
  const rel = path.relative(stageRoot, file);
  const body = fs.readFileSync(file);
  const mode = rel.endsWith('/src/brik.js') ? 0o755 : 0o644;
  blocks.push(header(rel, body.length, mode), body);
  const padding = (512 - (body.length % 512)) % 512;
  if (padding) blocks.push(Buffer.alloc(padding, 0));
}

blocks.push(Buffer.alloc(1024, 0));
const tarball = Buffer.concat(blocks);
fs.writeFileSync(packagePath, gzipStored(tarball));
NODE
package_sha="$(sha256_file "$PACKAGE_PATH")"

find "$STAGE_DIR" -type f | sort | while read -r file; do
  rel="${file#$STAGE_DIR/}"
  printf '%s  %s\n' "$(sha256_file "$file")" "$rel"
done > "$OUT_DIR/stage-checksums.tsv"

jq -n \
  --arg version "$VERSION" \
  --arg packagePath "evidence/beta14_3-package/$PACKAGE_NAME" \
  --arg packageSha "$package_sha" \
  --argjson packageBytes "$(file_size "$PACKAGE_PATH")" \
  '{
    schemaVersion:"brik64.cli_beta14_3_package_manifest.v1",
    version:$version,
    decision:"PASS_BRIK64_CLI_BETA14_3_PACKAGE_BUILT",
    releaseEligible:false,
	    lane:"cli_0_1_beta14_3",
	    generationClaim:"assisted_generation_non_claim",
	    package:{path:$packagePath, sha256:$packageSha, bytes:$packageBytes},
	    claimBoundary:{
	      publicClaimsAllowed:false,
	      publicReleaseAllowed:false,
	      fixpointClaimAllowed:false,
	      n5FormalClaimAllowed:false,
	      rustIndependenceClaimAllowed:false,
	      blocker:"public_surface_sync_pending"
	    },
	    inputGates:[{
      decision:"PASS_BETA14_SOURCE_LIFT_GATE",
      report:"evidence/beta14-source-lift/report.json",
      packaged:false
    },{
      decision:"PASS_BETA14_3_MONOMER_128_GATE",
      report:"evidence/beta14_3-monomer-128/report.json",
      packaged:true
    },{
      decision:"BLOCKED_BETA14_3_L6_GENERATION_GATE",
      report:"evidence/beta14_3-l6-generation/gate-report.json",
      packaged:true
    },{
      decision:"PASS_BETA14_3_AUDIT_CLOSURE_GATE_OR_PRIOR_BETA14_2_BASELINE",
      report:"evidence/beta14_2-audit-closure/report.json",
      packaged:false
    }],
    requiredPublicReleaseGates:[
      "beta14_3_package_smoke",
      "beta14_3_github_release",
      "curl_gcp_installer_beta14_3",
      "web_docs_changelog_beta14_3",
      "skills_beta14_3",
      "sdk_beta14_3_marketplaces_or_deferrals",
      "public_claim_scan",
      "live_release_train_verify"
    ],
	    boundary:"Beta14.3 local package candidate only. Public release remains blocked until full L6 CLI materialization, package smoke, GitHub, curl/GCP, docs, web, changelog, SDK, skills, marketplace publication and live verification pass atomically."
  }' > "$MANIFEST_PATH"

{
  printf '%s  %s\n' "$package_sha" "$PACKAGE_NAME"
  printf '%s  %s\n' "$(sha256_file "$MANIFEST_PATH")" "package.manifest.json"
  printf '%s  %s\n' "$(sha256_file "$OUT_DIR/stage-checksums.tsv")" "stage-checksums.tsv"
} > "$OUT_DIR/SHA256SUMS"

printf 'decision=PASS_BRIK64_CLI_BETA14_3_PACKAGE_BUILT\n'
printf 'releaseEligible=false\n'
printf 'package=evidence/beta14_3-package/%s\n' "$PACKAGE_NAME"
printf 'sha256=%s\n' "$package_sha"
