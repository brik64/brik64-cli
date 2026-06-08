#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.1.0-beta.11"
OUT_DIR="$ROOT_DIR/evidence/beta11-package"
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
local_gate="$ROOT_DIR/evidence/beta11-adversarial/report.json"
local_gate_decision="$(test -f "$local_gate" && json_field "$local_gate" '.decision' || true)"

failures=()
[[ "$package_version" == "$VERSION" ]] || failures+=("package_version_drift:$package_version")
[[ "$manifest_version" == "$VERSION" ]] || failures+=("brik_manifest_version_drift:$manifest_version")
[[ "$local_gate_decision" == "PASS_BETA11_ADVERSARIAL_GATE" ]] || failures+=("beta11_adversarial_gate_missing_or_invalid:$local_gate_decision")

if [[ "${#failures[@]}" -gt 0 ]]; then
  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR"
  printf '%s\n' "${failures[@]}" | jq -Rsc \
    --arg version "$VERSION" \
    '{
      schemaVersion:"brik64.cli_beta11_package_manifest.v1",
      version:$version,
      decision:"FAIL_BRIK64_CLI_BETA11_PACKAGE_BUILT",
      releaseEligible:false,
      failures:(split("\n") | map(select(length > 0)))
    }' > "$MANIFEST_PATH"
  printf 'beta11_package_input_gate_failed:%s\n' "${failures[*]}" >&2
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
  "pcd/cli_beta11_semantic_polymer_contract.pcd"
  "engines/l4plus-n5/serial.txt"
  "engines/l4plus-n5/checksums.tsv"
  "engines/l4plus-n5/runtime-bundle.manifest.json"
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
    description:"BRIK64 CLI beta11 candidate for local modular PCD workflows and diagnostics.",
    bin:{brik:"src/brik.js"},
    engines:{node:">=20"},
    distribution:"curl_and_github_release_assets"
  }' > "$STAGE_DIR/package.json"
chmod 755 "$STAGE_DIR/src/brik.js"

if [[ -e "$STAGE_DIR/evidence" ]]; then
  echo "package_contains_evidence_payload" >&2
  exit 1
fi

find "$STAGE_DIR" -type d -exec chmod 755 {} +
find "$STAGE_DIR" -type f -exec chmod 644 {} +
chmod 755 "$STAGE_DIR/src/brik.js"
find "$STAGE_DIR" -exec touch -t 202606070000 {} +

(
  cd "$STAGE_ROOT"
  find "$STAGE_NAME" -type f | LC_ALL=C sort | COPYFILE_DISABLE=1 tar --format ustar -cf - -T -
) | gzip -n > "$PACKAGE_PATH"
package_sha="$(sha256_file "$PACKAGE_PATH")"

find "$STAGE_DIR" -type f | sort | while read -r file; do
  rel="${file#$STAGE_DIR/}"
  printf '%s  %s\n' "$(sha256_file "$file")" "$rel"
done > "$OUT_DIR/stage-checksums.tsv"

jq -n \
  --arg version "$VERSION" \
  --arg packagePath "evidence/beta11-package/$PACKAGE_NAME" \
  --arg packageSha "$package_sha" \
  --argjson packageBytes "$(file_size "$PACKAGE_PATH")" \
  '{
    schemaVersion:"brik64.cli_beta11_package_manifest.v1",
    version:$version,
    decision:"PASS_BRIK64_CLI_BETA11_PACKAGE_BUILT",
    releaseEligible:false,
    lane:"cli_0_1_beta11",
    generationClaim:"assisted_generation_non_claim",
    package:{path:$packagePath, sha256:$packageSha, bytes:$packageBytes},
    inputGates:[{
      decision:"PASS_BETA11_ADVERSARIAL_GATE",
      report:"evidence/beta11-adversarial/report.json",
      packaged:false
    }],
    requiredPublicReleaseGates:[
      "beta11_package_smoke",
      "beta11_github_release",
      "curl_gcp_installer_beta11",
      "web_docs_changelog_beta11",
      "skills_beta11",
      "sdk_beta11_marketplaces_or_deferrals",
      "public_claim_scan",
      "live_release_train_verify"
    ],
    boundary:"Beta10 local package candidate only. Public release remains blocked until GitHub, curl/GCP, docs, web, changelog, SDK, skills and live verification pass atomically."
  }' > "$MANIFEST_PATH"

{
  printf '%s  %s\n' "$package_sha" "$PACKAGE_NAME"
  printf '%s  %s\n' "$(sha256_file "$MANIFEST_PATH")" "package.manifest.json"
  printf '%s  %s\n' "$(sha256_file "$OUT_DIR/stage-checksums.tsv")" "stage-checksums.tsv"
} > "$OUT_DIR/SHA256SUMS"

printf 'decision=PASS_BRIK64_CLI_BETA11_PACKAGE_BUILT\n'
printf 'releaseEligible=false\n'
printf 'package=evidence/beta11-package/%s\n' "$PACKAGE_NAME"
printf 'sha256=%s\n' "$package_sha"
