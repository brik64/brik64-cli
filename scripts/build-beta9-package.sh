#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.1.0-beta.9"
OUT_DIR="$ROOT_DIR/evidence/beta9-package"
STAGE_ROOT="$OUT_DIR/stage"
STAGE_NAME="brik64-cli-$VERSION"
STAGE_DIR="$STAGE_ROOT/$STAGE_NAME"
PACKAGE_NAME="brik64-cli-$VERSION.tgz"
PACKAGE_PATH="$OUT_DIR/$PACKAGE_NAME"
RELEASE_MANIFEST="$OUT_DIR/release-manifest.candidate.json"
L6_REPORT="$ROOT_DIR/evidence/beta9-l6-materialization/report.json"

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
file_size() { wc -c < "$1" | tr -d '[:space:]'; }
read_json_field() { jq -r "$2" "$1"; }

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

package_version="$(read_json_field "$ROOT_DIR/package.json" '.version')"
manifest_version="$(read_json_field "$ROOT_DIR/.brik/manifest.json" '.cliVersion')"
l6_decision="$(read_json_field "$L6_REPORT" '.decision')"
l6_generated_hash="$(read_json_field "$L6_REPORT" '.hashes.generatedArtifactHash')"
l6_remote_rc="$(read_json_field "$L6_REPORT" '.remote.rc')"

required_reports=(
  "evidence/beta9-typed-interface/report.json:PASS_BRIK64_CLI_BETA9_TYPED_INTERFACE"
  "evidence/beta9-collections/report.json:PASS_BRIK64_CLI_BETA9_COLLECTIONS"
  "evidence/beta9-maps/report.json:PASS_BRIK64_CLI_BETA9_MAPS"
  "evidence/beta9-bounded-loops/report.json:PASS_BRIK64_CLI_BETA9_BOUNDED_LOOPS"
  "evidence/beta9-scaffolds/report.json:PASS_BRIK64_CLI_BETA9_SCAFFOLDS"
  "evidence/beta9-local-imports/report.json:PASS_BRIK64_CLI_BETA9_LOCAL_IMPORTS"
  "evidence/beta9-doctor-ux/report.json:PASS_BRIK64_CLI_BETA9_DOCTOR_UX"
)

failures=()
[[ "$package_version" == "$VERSION" ]] || failures+=("package_version_drift:$package_version")
[[ "$manifest_version" == "$VERSION" ]] || failures+=("brik_manifest_version_drift:$manifest_version")
[[ "$l6_remote_rc" == "0" ]] || failures+=("l6_remote_rc_not_zero:$l6_remote_rc")
[[ "$l6_generated_hash" =~ ^sha256:[0-9a-f]{64}$ ]] || failures+=("l6_generated_artifact_hash_missing")
[[ "$l6_decision" == "BLOCKED_BETA9_PCD_L6_MATERIALIZATION" || "$l6_decision" == "PASS_BETA9_PCD_L6_MATERIALIZATION" ]] || failures+=("l6_decision_unexpected:$l6_decision")

for item in "${required_reports[@]}"; do
  report="${item%%:*}"
  expected="${item#*:}"
  if [[ ! -f "$ROOT_DIR/$report" ]]; then
    failures+=("required_report_missing:$report")
    continue
  fi
  actual="$(read_json_field "$ROOT_DIR/$report" '.decision')"
  [[ "$actual" == "$expected" ]] || failures+=("required_report_decision_drift:$report:$actual")
done

if [[ "${#failures[@]}" -gt 0 ]]; then
  mkdir -p "$OUT_DIR"
  printf '%s\n' "${failures[@]}" | jq -Rsc \
    --arg version "$VERSION" \
    '{
      schemaVersion:"brik64.cli_beta9_package_manifest.v1",
      version:$version,
      decision:"FAIL_BRIK64_CLI_BETA9_PACKAGE_BUILT",
      releaseEligible:false,
      failures:(split("\n") | map(select(length > 0)))
    }' > "$OUT_DIR/package.manifest.json"
  printf 'beta9_package_input_gate_failed:%s\n' "${failures[*]}" >&2
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
  "pcd/cli_beta9_transpiler_contract.pcd"
  "engines/l4plus-n5/serial.txt"
  "engines/l4plus-n5/checksums.tsv"
  "engines/l4plus-n5/runtime-bundle.manifest.json"
  "evidence/beta9-typed-interface/report.json"
  "evidence/beta9-collections/report.json"
  "evidence/beta9-maps/report.json"
  "evidence/beta9-bounded-loops/report.json"
  "evidence/beta9-scaffolds/report.json"
  "evidence/beta9-local-imports/report.json"
  "evidence/beta9-doctor-ux/report.json"
  "evidence/beta9-l6-materialization/report.json"
  "evidence/beta9-l6-materialization/generated"
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
    description:"BRIK64 CLI beta9 candidate for local PCD workflows and bounded compiler emission.",
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
  --arg packagePath "evidence/beta9-package/$PACKAGE_NAME" \
  --arg packageSha "$package_sha" \
  --arg l6GeneratedHash "$l6_generated_hash" \
  '{
    schemaVersion:"brik64.release_manifest.v1",
    releaseId:("brik64-" + $version),
    version:$version,
    channel:"beta",
    state:"draft",
    package:{path:$packagePath, sha256:$packageSha},
    l6Materialization:{generatedArtifactHash:$l6GeneratedHash, report:"evidence/beta9-l6-materialization/report.json"},
    publicSurfaces:{
      githubRelease:{required:true, status:"pending"},
      curlInstaller:{required:true, status:"pending"},
      channelManifest:{required:true, status:"pending"},
      web:{required:true, status:"pending"},
      docs:{required:true, status:"pending"},
      skills:{required:true, status:"pending"},
      sdks:{required:true, status:"pending"}
    },
    releaseEligible:false,
    boundary:"Beta9 package candidate only. Public release remains blocked until GitHub, curl/GCP, docs, web, changelog, SDK, skills and live verification pass atomically."
  }' > "$RELEASE_MANIFEST"
release_manifest_sha="$(sha256_file "$RELEASE_MANIFEST")"

jq -n \
  --arg version "$VERSION" \
  --arg packagePath "evidence/beta9-package/$PACKAGE_NAME" \
  --arg packageSha "$package_sha" \
  --argjson packageBytes "$(file_size "$PACKAGE_PATH")" \
  --arg l6GeneratedHash "$l6_generated_hash" \
  --arg releaseManifestPath "evidence/beta9-package/release-manifest.candidate.json" \
  --arg releaseManifestSha "$release_manifest_sha" \
  '{
    schemaVersion:"brik64.cli_beta9_package_manifest.v1",
    version:$version,
    decision:"PASS_BRIK64_CLI_BETA9_PACKAGE_BUILT",
    releaseEligible:false,
    lane:"cli_0_1_beta9",
    generationClaim:"assisted_generation_non_claim",
    package:{path:$packagePath, sha256:$packageSha, bytes:$packageBytes},
    l6Materialization:{generatedArtifactHash:$l6GeneratedHash, report:"evidence/beta9-l6-materialization/report.json"},
    releaseManifest:{path:$releaseManifestPath, sha256:$releaseManifestSha},
    inputGates:[
      "PASS_BRIK64_CLI_BETA9_TYPED_INTERFACE",
      "PASS_BRIK64_CLI_BETA9_COLLECTIONS",
      "PASS_BRIK64_CLI_BETA9_MAPS",
      "PASS_BRIK64_CLI_BETA9_BOUNDED_LOOPS",
      "PASS_BRIK64_CLI_BETA9_SCAFFOLDS",
      "PASS_BRIK64_CLI_BETA9_LOCAL_IMPORTS",
      "PASS_BRIK64_CLI_BETA9_DOCTOR_UX"
    ],
    requiredPublicReleaseGates:[
      "beta9_package_smoke",
      "beta9_github_release",
      "curl_gcp_installer_beta9",
      "web_docs_changelog_beta9",
      "skills_beta9",
      "sdk_beta9_marketplaces",
      "public_claim_scan",
      "live_release_train_verify"
    ],
    boundary:"Beta9 local package candidate only. Public release remains blocked until package, platform, installer, GitHub, SDK, docs, web, changelog, skills and public-claim gates pass together."
  }' > "$OUT_DIR/package.manifest.json"

node - "$L6_REPORT" "$package_sha" "$release_manifest_sha" <<'NODE'
const fs = require('fs');
const [file, packageSha, releaseManifestSha] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
report.hashes.packageHash = `sha256:${packageSha}`;
report.hashes.releaseManifestHash = `sha256:${releaseManifestSha}`;
report.decision = 'PASS_BETA9_PCD_L6_MATERIALIZATION';
report.blockers = [];
report.releaseEligible = false;
report.requiredNextAction = 'Run beta9 package smoke, release readiness and public surface sync gates before publication.';
fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
NODE

{
  printf '%s  %s\n' "$package_sha" "$PACKAGE_NAME"
  printf '%s  %s\n' "$(sha256_file "$OUT_DIR/package.manifest.json")" "package.manifest.json"
  printf '%s  %s\n' "$release_manifest_sha" "release-manifest.candidate.json"
  printf '%s  %s\n' "$(sha256_file "$OUT_DIR/stage-checksums.tsv")" "stage-checksums.tsv"
} > "$OUT_DIR/SHA256SUMS"

printf 'decision=PASS_BRIK64_CLI_BETA9_PACKAGE_BUILT\n'
printf 'releaseEligible=false\n'
printf 'package=evidence/beta9-package/%s\n' "$PACKAGE_NAME"
printf 'sha256=%s\n' "$package_sha"
