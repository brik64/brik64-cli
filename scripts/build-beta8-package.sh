#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.1.0-beta.8"
OUT_DIR="$ROOT_DIR/evidence/beta8-package"
STAGE_ROOT="$OUT_DIR/stage"
STAGE_NAME="brik64-cli-$VERSION"
STAGE_DIR="$STAGE_ROOT/$STAGE_NAME"
PACKAGE_NAME="brik64-cli-$VERSION.tgz"
PACKAGE_PATH="$OUT_DIR/$PACKAGE_NAME"

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

read_json_field() {
  local file="$1"
  local expr="$2"
  jq -r "$expr" "$file"
}

copy_input() {
  local relative="$1"
  local source="$ROOT_DIR/$relative"
  local dest="$STAGE_DIR/$relative"
  if [[ ! -e "$source" ]]; then
    echo "missing_package_input:$relative" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$dest")"
  cp "$source" "$dest"
}

package_version="$(read_json_field "$ROOT_DIR/package.json" '.version')"
manifest_version="$(read_json_field "$ROOT_DIR/.brik/manifest.json" '.cliVersion')"
functionality_decision="$(read_json_field "$ROOT_DIR/evidence/beta8-compiler-functionality/report.json" '.decision')"
adversarial_decision="$(read_json_field "$ROOT_DIR/evidence/beta8-adversarial/report.json" '.decision')"

failures=()
[[ "$package_version" == "$VERSION" ]] || failures+=("package_version_drift:$package_version")
[[ "$manifest_version" == "$VERSION" ]] || failures+=("brik_manifest_version_drift:$manifest_version")
[[ "$functionality_decision" == "PASS_BRIK64_CLI_BETA8_COMPILER_FUNCTIONALITY" ]] || failures+=("functionality_gate_not_pass:$functionality_decision")
[[ "$adversarial_decision" == "PASS_BRIK64_CLI_BETA8_ADVERSARIAL" ]] || failures+=("adversarial_gate_not_pass:$adversarial_decision")

if [[ "${#failures[@]}" -gt 0 ]]; then
  mkdir -p "$OUT_DIR"
  jq -n \
    --arg version "$VERSION" \
    --argjson failures "$(printf '%s\n' "${failures[@]}" | jq -Rsc 'split("\n") | map(select(length > 0))')" \
    '{
      schemaVersion:"brik64.cli_beta8_package_manifest.v1",
      version:$version,
      decision:"FAIL_BRIK64_CLI_BETA8_PACKAGE_BUILT",
      releaseEligible:false,
      failures:$failures
    }' > "$OUT_DIR/package.manifest.json"
  printf 'beta8_package_input_gate_failed:%s\n' "${failures[*]}" >&2
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
  "pcd/cli_core.pcd"
  "pcd/cli_polymer.pcd"
  "pcd/cli_account_session.pcd"
  "pcd/cli_migrate.pcd"
  "pcd/cli_polymerize.pcd"
  "pcd/cli_verify.pcd"
  "engines/l4plus-n5/serial.txt"
  "engines/l4plus-n5/checksums.tsv"
  "engines/l4plus-n5/runtime-bundle.manifest.json"
  "evidence/beta8-compiler-functionality/report.json"
  "evidence/beta8-adversarial/report.json"
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
    description:"BRIK64 CLI public beta candidate for local PCD workflows and bounded compiler emission.",
    bin:{brik:"src/brik.js"},
    engines:{node:">=20"},
    distribution:"curl_and_github_release_assets"
  }' > "$STAGE_DIR/package.json"
chmod 755 "$STAGE_DIR/src/brik.js"

tar -czf "$PACKAGE_PATH" -C "$STAGE_ROOT" "$STAGE_NAME"
package_sha="$(sha256_file "$PACKAGE_PATH")"

find "$STAGE_DIR" -type f | sort | while read -r file; do
  rel="${file#$STAGE_DIR/}"
  printf '%s  %s\n' "$(sha256_file "$file")" "$rel"
done > "$OUT_DIR/stage-checksums.tsv"

jq -n \
  --arg version "$VERSION" \
  --arg packagePath "evidence/beta8-package/$PACKAGE_NAME" \
  --arg packageSha "$package_sha" \
  --argjson packageBytes "$(stat -f '%z' "$PACKAGE_PATH")" \
  '{
    schemaVersion:"brik64.cli_beta8_package_manifest.v1",
    version:$version,
    decision:"PASS_BRIK64_CLI_BETA8_PACKAGE_BUILT",
    releaseEligible:false,
    lane:"cli_0_1_beta8",
    generationClaim:"internal_generation_non_claim",
    package:{path:$packagePath, sha256:$packageSha, bytes:$packageBytes},
    inputGates:[
      "PASS_BRIK64_CLI_BETA8_COMPILER_FUNCTIONALITY",
      "PASS_BRIK64_CLI_BETA8_ADVERSARIAL"
    ],
    requiredPublicReleaseGates:[
      "beta8_package_smoke",
      "platform_smoke",
      "curl_gcp_installer_beta8",
      "github_release_beta8",
      "web_docs_changelog_beta8",
      "skills_beta8",
      "sdk_beta8_or_no_change_evidence",
      "public_claim_scan"
    ],
    boundary:"Beta8 local package candidate only. Public release remains blocked until package, platform, installer, GitHub, SDK, docs, web, changelog, skills and public-claim gates pass together."
  }' > "$OUT_DIR/package.manifest.json"

{
  printf '%s  %s\n' "$package_sha" "$PACKAGE_NAME"
  printf '%s  %s\n' "$(sha256_file "$OUT_DIR/package.manifest.json")" "package.manifest.json"
  printf '%s  %s\n' "$(sha256_file "$OUT_DIR/stage-checksums.tsv")" "stage-checksums.tsv"
} > "$OUT_DIR/SHA256SUMS"

printf 'decision=PASS_BRIK64_CLI_BETA8_PACKAGE_BUILT\n'
printf 'releaseEligible=false\n'
printf 'package=evidence/beta8-package/%s\n' "$PACKAGE_NAME"
printf 'sha256=%s\n' "$package_sha"
