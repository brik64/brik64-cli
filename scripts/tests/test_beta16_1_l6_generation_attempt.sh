#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

mkbase() {
  local base="$1"
  mkdir -p "$base/pcd/beta15" "$base/pcd/beta16_1/release" "$base/pcd" "$base/release"
  cat >"$base/package.json" <<'JSON'
{ "version": "0.1.0-beta.16.1" }
JSON
  cat >"$base/pcd/beta15/l6plus_materialization_command.contract.json" <<'JSON'
{ "schema": "brik64.beta15_cli_l6plus_materialization_command_contract.v1" }
JSON
  cat >"$base/pcd/beta15/manifest.json" <<'JSON'
{ "schema": "brik64.cli_beta_fixpoint_source_manifest.v1", "version": "0.1.0-beta.16.1" }
JSON
  cat >"$base/pcd/beta15/cli_polymer.pcd" <<'PCD'
// brik64.pcd_file.v1
PC beta16_1_cli_polymer {
  fn run(x: i64) -> i64 { return x; }
}
PCD
  cat >"$base/pcd/beta16_1/release/l6_cli_materialization_contract.pcd" <<'PCD'
// brik64.pcd_file.v1
PC l6_cli_materialization_contract {
  fn run(x: i64) -> i64 { return x; }
}
PCD
  cat >"$base/pcd/beta16_1/release/l6_cli_materialization_result_contract.pcd" <<'PCD'
// brik64.pcd_file.v1
PC l6_cli_materialization_result_contract {
  fn run(x: i64) -> i64 { return x; }
}
PCD
  cat >"$base/pcd/cli_core.pcd" <<'PCD'
// brik64.pcd_file.v1
PC cli_core {
  fn run(x: i64) -> i64 { return x; }
}
PCD
  cat >"$base/pcd/cli_polymer.pcd" <<'PCD'
// brik64.pcd_file.v1
PC cli_polymer {
  fn run(x: i64) -> i64 { return x; }
}
PCD
  cat >"$base/release/manifest.json" <<'JSON'
{ "version": "0.1.0-beta.15.6" }
JSON
}

MISMATCH="$TMP_DIR/mismatch"
mkbase "$MISMATCH"
if BRIK64_CLI_ROOT="$MISMATCH" BRIK64_L6_SKIP_REMOTE=1 node "$ROOT/scripts/beta16_1-l6-generation-attempt.js" >/tmp/beta16_1_l6_mismatch.out 2>/tmp/beta16_1_l6_mismatch.err; then
  echo "expected release mismatch fixture to fail closed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA16_1_L6_GENERATION_GATE"
  and .publicationAllowed==false
  and (.blockers | index("release_manifest_version_mismatch:0.1.0-beta.15.6:0.1.0-beta.16.1"))
  and (.blockers | index("missing_package_artifact:evidence/beta16_1-package/brik64-cli-0.1.0-beta.16.1.tgz"))
  and (.blockers | index("remote_l6plus_probe_failed"))
  and (.blockers | index("generated_artifact_missing"))
' "$MISMATCH/evidence/beta16_1-l6-generation/gate-report.json" >/dev/null
for file in gate-report.json l6plus_engine_manifest.json input_pcd_hashes.tsv generated_artifact_manifest.json package.manifest.json seal_report.json hashes.json
do
  test -f "$MISMATCH/evidence/beta16_1-l6-generation/$file"
done

MISSING_PCD="$TMP_DIR/missing-pcd"
mkbase "$MISSING_PCD"
rm "$MISSING_PCD/pcd/beta16_1/release/l6_cli_materialization_result_contract.pcd"
if BRIK64_CLI_ROOT="$MISSING_PCD" BRIK64_L6_SKIP_REMOTE=1 node "$ROOT/scripts/beta16_1-l6-generation-attempt.js" >/tmp/beta16_1_l6_missing.out 2>/tmp/beta16_1_l6_missing.err; then
  echo "expected missing PCD fixture to fail closed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA16_1_L6_GENERATION_GATE"
  and (.blockers | index("missing_input_pcd:pcd/beta16_1/release/l6_cli_materialization_result_contract.pcd"))
' "$MISSING_PCD/evidence/beta16_1-l6-generation/gate-report.json" >/dev/null

ALIGNED_NO_PACKAGE="$TMP_DIR/aligned-no-package"
mkbase "$ALIGNED_NO_PACKAGE"
cat >"$ALIGNED_NO_PACKAGE/release/manifest.json" <<'JSON'
{ "version": "0.1.0-beta.16.1" }
JSON
if BRIK64_CLI_ROOT="$ALIGNED_NO_PACKAGE" BRIK64_L6_SKIP_REMOTE=1 node "$ROOT/scripts/beta16_1-l6-generation-attempt.js" >/tmp/beta16_1_l6_aligned.out 2>/tmp/beta16_1_l6_aligned.err; then
  echo "expected aligned-but-no-package fixture to fail closed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA16_1_L6_GENERATION_GATE"
  and (.blockers | index("release_manifest_version_mismatch:0.1.0-beta.15.6:0.1.0-beta.16.1") | not)
  and (.blockers | index("missing_package_artifact:evidence/beta16_1-package/brik64-cli-0.1.0-beta.16.1.tgz"))
' "$ALIGNED_NO_PACKAGE/evidence/beta16_1-l6-generation/gate-report.json" >/dev/null

PATCH_VERSION="$TMP_DIR/patch-version"
mkbase "$PATCH_VERSION"
cat >"$PATCH_VERSION/package.json" <<'JSON'
{ "version": "0.1.0-beta.16.1" }
JSON
cat >"$PATCH_VERSION/release/manifest.json" <<'JSON'
{ "version": "0.1.0-beta.16.1" }
JSON
if BRIK64_CLI_ROOT="$PATCH_VERSION" BRIK64_L6_SKIP_REMOTE=1 node "$ROOT/scripts/beta16_1-l6-generation-attempt.js" >/tmp/beta16_1_l6_patch_version.out 2>/tmp/beta16_1_l6_patch_version.err; then
  echo "expected patch-version fixture without package to fail closed" >&2
  exit 1
fi
jq -e '
  .version=="0.1.0-beta.16.1"
  and .decision=="BLOCKED_BETA16_1_L6_GENERATION_GATE"
  and (.blockers | index("release_manifest_version_mismatch:0.1.0-beta.15.6:0.1.0-beta.16.1") | not)
  and (.blockers | index("missing_package_artifact:evidence/beta16_1-package/brik64-cli-0.1.0-beta.16.1.tgz"))
' "$PATCH_VERSION/evidence/beta16_1-l6-generation/gate-report.json" >/dev/null
jq -e '
  .version=="0.1.0-beta.16.1"
  and .requiredResultVersion=="0.1.0-beta.16.1"
  and .outputRefs.package=="evidence/beta16_1-package/brik64-cli-0.1.0-beta.16.1.tgz"
' "$PATCH_VERSION/evidence/beta16_1-l6-materializer-request/request.json" >/dev/null

REMOTE_VERSION_GAP="$TMP_DIR/remote-version-gap"
mkbase "$REMOTE_VERSION_GAP"
mkdir -p "$REMOTE_VERSION_GAP/evidence/beta16_1-package"
printf 'beta16.1 package fixture\n' >"$REMOTE_VERSION_GAP/evidence/beta16_1-package/brik64-cli-0.1.0-beta.16.1.tgz"
cat >"$REMOTE_VERSION_GAP/release/manifest.json" <<'JSON'
{ "version": "0.1.0-beta.16.1" }
JSON

FAKE_BIN="$TMP_DIR/fake-bin"
mkdir -p "$FAKE_BIN"
cat >"$FAKE_BIN/ssh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
script="${*: -1}"
case "$script" in
  *"healthcheck"*"/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5 --version"*"/opt/brik64/engines/l6plus-n5/bin/audit"*)
    printf '%s\n' 'serial=BRIK64-L6PLUS-N5-TEST'
    printf '%s\n' '{"decision":"PASS"}'
    ;;
  *"BRIK64_REMOTE_REF"*)
    printf '%s\n' 'BRIK64_REMOTE_REF	wrapper	aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa	905	/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5'
    printf '%s\n' 'BRIK64_REMOTE_REF	wrapper_exec_target	bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb	851	/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus'
    printf '%s\n' 'BRIK64_WRAPPER_MODE	cli_materializer_dispatcher'
    ;;
  *"endpoint-status"*|*"cli-materializer-status"*)
    printf '%s\n' 'BRIK64_L6_CLI_MATERIALIZER_ENDPOINT	installed	beta15_6_ready'
    printf '%s\n' 'BRIK64_L6_CLI_MATERIALIZATION_RESULT	available'
    ;;
  *"l6-cli-materialize"*)
    printf '%s\n' 'brik64_l6plus_fail_closed:version_mismatch:0.1.0-beta.16.1' >&2
    ;;
  *"beta16.1-cli-materialize"*|*"materialize"*|*"compile"*)
    printf '%s\n' 'brik64_l6plus_fail_closed:unsupported_or_missing_input' >&2
    ;;
  *)
    printf 'unexpected fake ssh script: %s\n' "$script" >&2
    exit 64
    ;;
esac
SH
chmod +x "$FAKE_BIN/ssh"

if PATH="$FAKE_BIN:$PATH" BRIK64_CLI_ROOT="$REMOTE_VERSION_GAP" node "$ROOT/scripts/beta16_1-l6-generation-attempt.js" >/tmp/beta16_1_l6_remote_gap.out 2>/tmp/beta16_1_l6_remote_gap.err; then
  echo "expected beta15.6-only remote materializer fixture to fail closed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA16_1_L6_GENERATION_GATE"
  and (.blockers | index("remote_l6plus_materializer_version_not_supported:0.1.0-beta.16.1"))
  and (.blockers | index("remote_l6plus_materializer_endpoint_status:beta15_6_ready"))
  and (.blockers | index("remote_l6plus_materialization_contract_unavailable"))
  and .remoteCapability.wrapperMode=="cli_materializer_dispatcher"
  and .remoteCapability.endpointStatus.statusTag=="beta15_6_ready"
  and (.attempts[] | select(.command[1]=="l6-cli-materialize") | .observed | contains("version_mismatch:0.1.0-beta.16.1"))
' "$REMOTE_VERSION_GAP/evidence/beta16_1-l6-generation/gate-report.json" >/dev/null

REMOTE_READY="$TMP_DIR/remote-ready"
mkbase "$REMOTE_READY"
mkdir -p "$REMOTE_READY/evidence/beta16_1-package"
printf 'beta16.1 package fixture\n' >"$REMOTE_READY/evidence/beta16_1-package/brik64-cli-0.1.0-beta.16.1.tgz"
cat >"$REMOTE_READY/release/manifest.json" <<'JSON'
{ "version": "0.1.0-beta.16.1" }
JSON

FAKE_READY_BIN="$TMP_DIR/fake-ready-bin"
mkdir -p "$FAKE_READY_BIN"
cat >"$FAKE_READY_BIN/ssh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
script="${*: -1}"
case "$script" in
  *"healthcheck"*"/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5 --version"*"/opt/brik64/engines/l6plus-n5/bin/audit"*)
    printf '%s\n' 'serial=BRIK64-L6PLUS-N5-TEST'
    printf '%s\n' '{"decision":"PASS"}'
    ;;
  *"BRIK64_REMOTE_REF"*)
    printf '%s\n' 'BRIK64_REMOTE_REF	wrapper	aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa	905	/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5'
    printf '%s\n' 'BRIK64_REMOTE_REF	wrapper_exec_target	bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb	851	/opt/brik64/engines/l6plus-n5/current/native/linux-x86_64/brikc_cli_l6plus'
    printf '%s\n' 'BRIK64_WRAPPER_MODE	cli_materializer_dispatcher'
    ;;
  *"endpoint-status"*|*"cli-materializer-status"*)
    printf '%s\n' 'BRIK64_L6_CLI_MATERIALIZER_ENDPOINT	installed	beta16_1_ready'
    printf '%s\n' 'BRIK64_L6_CLI_MATERIALIZATION_RESULT	available'
    ;;
  *"l6-cli-materialize"*)
    encoded="$(printf '%s' "$script" | sed -n 's/.*printf %s "\([^"]*\)" | base64.*/\1/p')"
    node - "$encoded" <<'NODE'
const crypto = require('crypto');
const encoded = process.argv[2];
const request = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const requestLine = `BRIK64_L6_CLI_MATERIALIZATION_REQUEST\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`;
const generatedObject = {
  schemaVersion: 'brik64.cli_beta16_1_l6_generated_artifact.v1',
  version: request.version,
  materializerMode: request.materializerMode,
  source: {
    pcdInputSetSha256: request.pcdInputSetSha256,
    materializerRequestSha256: sha(requestLine),
    inputPcds: request.inputPcds.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })),
  },
  outputBindings: request.outputArtifacts,
  claimBoundary: request.claimBoundary,
};
const generatedArtifactContent = `// brik64 generated materialization unit\nexport const brik64CliMaterialization = ${JSON.stringify(generatedObject, null, 2)};\n`;
const generatedArtifactSha256 = sha(generatedArtifactContent);
const packageSha256 = request.outputArtifacts.package.sha256;
const releaseManifestSha256 = request.outputArtifacts.releaseManifest.sha256;
const generationTraceSha256 = sha([
  request.pcdInputSetSha256,
  sha(requestLine),
  generatedArtifactSha256,
  packageSha256,
  releaseManifestSha256,
  'a'.repeat(64),
  'b'.repeat(64),
].join('\n'));
const compositeSha256 = sha([
  request.pcdInputSetSha256,
  sha(requestLine),
  generatedArtifactSha256,
  packageSha256,
  releaseManifestSha256,
  generationTraceSha256,
].join('\n'));
const sealObject = {
  schemaVersion: 'brik64.cli_beta16_1_l6_seal_report.v1',
  version: request.version,
  decision: 'PASS_BETA16_1_L6_SEAL',
  compositeSha256,
  generationTraceSha256,
  claimBoundary: request.claimBoundary,
  blockers: [],
};
const sealContent = `${JSON.stringify(sealObject, null, 2)}\n`;
const result = {
  schemaVersion: 'brik64.l6plus_cli_materialization_result.v1',
  version: request.version,
  l6plusEngineSerial: 'BRIK64-L6PLUS-N5-TEST',
  materializerMode: request.materializerMode,
  generatedByL6PlusN5: true,
  pcdToArtifactHashBound: true,
  artifactToPackageHashBound: true,
  packageToReleaseManifestHashBound: true,
  sealReportPass: true,
  generatedArtifactSha256,
  packageSha256,
  releaseManifestSha256,
  compositeSha256,
  generationTraceSha256,
  pcdInputSetSha256: request.pcdInputSetSha256,
  materializerRequestSha256: sha(requestLine),
  remoteWrapperSha256: 'a'.repeat(64),
  wrapperExecTargetSha256: 'b'.repeat(64),
  generatedArtifact: {
    path: request.outputRefs.generatedArtifact,
    sha256: generatedArtifactSha256,
    bytes: Buffer.byteLength(generatedArtifactContent),
  },
  package: request.outputArtifacts.package,
  releaseManifest: request.outputArtifacts.releaseManifest,
  sealReport: {
    path: request.outputRefs.sealReport,
    sha256: sha(sealContent),
    bytes: Buffer.byteLength(sealContent),
  },
  inputPcds: request.inputPcds.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })),
  generatedArtifactContentBase64: Buffer.from(generatedArtifactContent).toString('base64'),
  sealReportContentBase64: Buffer.from(sealContent).toString('base64'),
  claimBoundary: request.claimBoundary,
};
process.stdout.write(`BRIK64_L6_CLI_MATERIALIZATION_RESULT\t${Buffer.from(JSON.stringify(result)).toString('base64')}\n`);
NODE
    ;;
  *"beta16.1-cli-materialize"*|*"materialize"*|*"compile"*)
    printf '%s\n' 'brik64_l6plus_fail_closed:unsupported_secondary_path' >&2
    ;;
  *)
    printf 'unexpected fake ssh script: %s\n' "$script" >&2
    exit 64
    ;;
esac
SH
chmod +x "$FAKE_READY_BIN/ssh"

PATH="$FAKE_READY_BIN:$PATH" BRIK64_CLI_ROOT="$REMOTE_READY" node "$ROOT/scripts/beta16_1-l6-generation-attempt.js" >/tmp/beta16_1_l6_remote_ready.out 2>/tmp/beta16_1_l6_remote_ready.err
jq -e '
  .decision=="PASS_BETA16_1_L6_GENERATION_GATE"
  and .publicationAllowed==true
  and .releasePublicationAllowed==true
  and (.blockers | length == 0)
  and .remoteCapability.endpointStatus.statusTag=="beta16_1_ready"
  and .remoteCapability.materializerContractAccepted==true
' "$REMOTE_READY/evidence/beta16_1-l6-generation/gate-report.json" >/dev/null
test -f "$REMOTE_READY/evidence/beta16_1-l6-generation/generated/brik64-cli.mjs"
test -f "$REMOTE_READY/evidence/beta16_1-l6-generation/seal_report.json"
jq -e '
  .generatedByL6PlusN5==true
  and .pcdToArtifactHashBound==true
  and ([.inputPcds[].path] | index("pcd/beta16_1/release/l6_cli_materialization_contract.pcd"))
  and ([.inputPcds[].path] | index("pcd/beta16_1/release/l6_cli_materialization_result_contract.pcd"))
' "$REMOTE_READY/evidence/beta16_1-l6-generation/generated_artifact_manifest.json" >/dev/null

echo "PASS beta16.1 L6 generation attempt fail-closed coverage"
