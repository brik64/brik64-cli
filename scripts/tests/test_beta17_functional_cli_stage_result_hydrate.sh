#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

sha256_text() {
  python3 - "$1" <<'PY'
import hashlib, sys
print(hashlib.sha256(sys.argv[1].encode()).hexdigest())
PY
}

write_fixture() {
  local dir="$1"
  local mode="${2:-valid}"
  mkdir -p "$dir/evidence/beta17-functional-cli-stage-request" \
    "$dir/evidence/beta17-functional-cli-stage-result" \
    "$dir/pcd/beta17/release" "$dir/pcd"
  cat >"$dir/pcd/beta17/release/functional_cli_stage_materialization_contract.pcd" <<'PCD'
// brik64.pcd_file.v1
PC functional_cli_stage_materialization_contract { fn run() -> i64 { return 1; } }
PCD
  cat >"$dir/pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd" <<'PCD'
// brik64.pcd_file.v1
PC fixpoint_stage1_materialization_contract { fn run() -> i64 { return 1; } }
PCD
  cat >"$dir/pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd" <<'PCD'
// brik64.pcd_file.v1
PC fixpoint_stage2_regeneration_contract { fn run() -> i64 { return 1; } }
PCD
  cat >"$dir/pcd/cli_core.pcd" <<'PCD'
// brik64.pcd_file.v1
PC cli_core { fn run() -> i64 { return 1; } }
PCD
  cat >"$dir/pcd/cli_polymer.pcd" <<'PCD'
// brik64.pcd_file.v1
PC cli_polymer { fn run() -> i64 { return 1; } }
PCD
  python3 - "$dir" "$mode" <<'PY'
import base64, hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
mode = sys.argv[2]
pcd_paths = [
  "pcd/beta17/release/functional_cli_stage_materialization_contract.pcd",
  "pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd",
  "pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd",
  "pcd/cli_core.pcd",
  "pcd/cli_polymer.pcd",
]
input_pcds = []
for ref in pcd_paths:
    body = (root / ref).read_bytes()
    input_pcds.append({"path": ref, "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body)})
input_hash_body = "".join(f"{item['sha256']}\t{item['bytes']}\t{item['path']}\n" for item in input_pcds)
pcd_hash = hashlib.sha256(input_hash_body.encode()).hexdigest()
request_line_sha = "1" * 64
request_manifest = {
    "schemaVersion": "brik64.beta17_functional_cli_stage_request_manifest.v1",
    "version": "0.1.0-beta.17",
    "decision": "PASS_BETA17_FUNCTIONAL_CLI_STAGE_REQUEST_BUNDLE",
    "requestLineSha256": request_line_sha,
    "pcdInputSetSha256": pcd_hash,
    "inputPcds": input_pcds,
}
(root / "evidence/beta17-functional-cli-stage-request/request.manifest.json").write_text(json.dumps(request_manifest, indent=2) + "\n")
header = "\n".join([
    "#!/usr/bin/env node",
    "const version = '0.1.0-beta.17';",
    "const commandHandlers = new Map(); // command dispatcher",
    "commandHandlers.set('certify', () => 'certify command');",
    "commandHandlers.set('verify', () => 'verify command');",
    "commandHandlers.set('emit', () => 'emit command');",
    "commandHandlers.set('polymerize', () => 'polymerize command');",
    "commandHandlers.set('lift', () => 'lift command');",
    "commandHandlers.set('monomers', () => 'monomers command');",
    "commandHandlers.set('engine status', () => 'engine status command');",
    "const command = process.argv.slice(2).join(' ');",
])
artifact = (header + "\n" + "\n".join(f"// filler {i}" for i in range(5000))).encode()
artifact_sha = hashlib.sha256(artifact).hexdigest()
result = {
    "schemaVersion": "brik64.beta17_functional_cli_stage_result.v1",
    "version": "0.1.0-beta.17",
    "l6plusEngineSerial": "BRIK64-L6PLUS-N5-20260629-HYDRATE-001",
    "materializerMode": "l6plus_functional_cli_stage_materializer",
    "generatedByL6PlusN5": True,
    "generatedFromPcdPolymer": True,
    "nodeEntrypointPresent": True,
    "versionBound": True,
    "argvHandlingPresent": True,
    "commandDispatcherPresent": True,
    "functionalStageMinSizePass": True,
    "functionalStageArtifactGatePass": True,
    "packageCandidateReferencesArtifact": True,
    "publicClaimBoundaryClosed": True,
    "pcdInputSetSha256": pcd_hash,
    "functionalCliStageRequestSha256": request_line_sha,
    "stage1ArtifactSha256": artifact_sha,
    "stage1ArtifactBytes": len(artifact),
    "stage1ArtifactBase64": base64.b64encode(artifact).decode(),
    "generationTraceSha256": "2" * 64,
    "remoteWrapperSha256": "3" * 64,
    "wrapperExecTargetSha256": "4" * 64,
    "stage1Artifact": {"path": "evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs", "sha256": artifact_sha, "bytes": len(artifact)},
    "stage1Manifest": {"path": "evidence/beta17-fixpoint/stage1_artifact_manifest.json", "sha256": "", "bytes": 0},
    "functionalStageReport": {"path": "evidence/beta17-fixpoint-functional-stage-artifact/report.json", "sha256": "", "bytes": 0},
    "packageManifest": {"path": "evidence/beta17-package/package.manifest.json", "sha256": "", "bytes": 0},
    "inputPcds": input_pcds,
    "claimBoundary": {
        "publicReleaseAllowed": False,
        "definitiveFixpointAllowed": False,
        "formalN5ClaimAllowed": False,
        "universalCorrectnessClaimAllowed": False,
        "selfHostingClaimAllowed": False,
        "rustIndependenceClaimAllowed": False,
    },
}
def bound_json_sha_bytes(value):
    body = (json.dumps(value, indent=2) + "\n").encode()
    return hashlib.sha256(body).hexdigest(), len(body)
stage1_manifest = {
    "schemaVersion": "brik64.beta17_fixpoint.stage1_artifact_manifest.v1",
    "version": result["version"],
    "generatedByL6PlusN5": True,
    "generatedFromPcdPolymer": True,
    "artifact": result["stage1Artifact"],
    "stage1ArtifactSha256": result["stage1ArtifactSha256"],
    "functionalCliStageRequestSha256": result["functionalCliStageRequestSha256"],
    "pcdInputSetSha256": result["pcdInputSetSha256"],
    "claimBoundary": {
        "publicReleaseAllowed": False,
        "definitiveFixpointAllowed": False,
        "formalN5ClaimAllowed": False,
        "universalCorrectnessClaimAllowed": False,
        "publicClaimsAllowed": False,
        "selfHostingClaimAllowed": False,
        "rustIndependenceClaimAllowed": False,
    },
}
functional_report = {
    "schemaVersion": "brik64.beta17_fixpoint.functional_stage_artifact_gate.v1",
    "generatedAt": "1970-01-01T00:00:00.000Z",
    "version": result["version"],
    "decision": "PASS_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE",
    "releaseEligibleStageArtifact": True,
    "artifact": result["stage1Artifact"],
    "checks": {
        "hydratedFromFunctionalCliStageResult": True,
        "generatedByL6PlusN5": True,
        "nodeEntrypoint": True,
        "argvHandling": True,
        "commandDispatcher": True,
    },
    "blockers": [],
    "claimBoundary": stage1_manifest["claimBoundary"],
}
package_manifest = {
    "schemaVersion": "brik64.cli_beta17_package_manifest.v1",
    "version": result["version"],
    "decision": "PASS_BRIK64_CLI_BETA17_FUNCTIONAL_ARTIFACT_READY",
    "releaseEligible": True,
    "publicationAllowed": False,
    "package": None,
    "stageArtifact": {**result["stage1Artifact"], "functionalCliArtifact": True},
    "functionalStageArtifactReport": result["functionalStageReport"],
    "blockers": ["publication_requires_public_surface_sync_and_external_audit"],
    "claimBoundary": {
        "publicReleaseAllowed": False,
        "publicClaimsAllowed": False,
        "l6MaterializationClaimAllowed": True,
        "formalN5ClaimAllowed": False,
        "fixpointClaimAllowed": False,
        "selfHostingClaimAllowed": False,
        "rustIndependenceClaimAllowed": False,
    },
}
result["stage1Manifest"]["sha256"], result["stage1Manifest"]["bytes"] = bound_json_sha_bytes(stage1_manifest)
result["functionalStageReport"]["sha256"], result["functionalStageReport"]["bytes"] = bound_json_sha_bytes(functional_report)
result["packageManifest"]["sha256"], result["packageManifest"]["bytes"] = bound_json_sha_bytes(package_manifest)
if mode == "unsafe":
    result["stage1Artifact"]["path"] = "../stage1.mjs"
if mode == "invalid":
    result["generatedByL6PlusN5"] = False
line = "BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT\t" + base64.b64encode(json.dumps(result).encode()).decode() + "\n"
(root / "evidence/beta17-functional-cli-stage-result/result.line").write_text(line)
PY
}

PASS_ROOT="$TMP_DIR/pass"
write_fixture "$PASS_ROOT" valid
BRIK64_CLI_ROOT="$PASS_ROOT" node "$ROOT/scripts/beta17-functional-cli-stage-result-hydrate.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"
jq -e '
  .decision=="PASS_BETA17_FUNCTIONAL_CLI_STAGE_RESULT_HYDRATION"
  and .hydrated==true
  and .claimBoundary.publicReleaseAllowed==false
' "$PASS_ROOT/evidence/beta17-functional-cli-stage-result/hydrate-report.json" >/dev/null
test -s "$PASS_ROOT/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs"
jq -e '.decision=="PASS_BRIK64_CLI_BETA17_FUNCTIONAL_ARTIFACT_READY" and .releaseEligible==true and .publicationAllowed==false' \
  "$PASS_ROOT/evidence/beta17-package/package.manifest.json" >/dev/null

MISSING_ROOT="$TMP_DIR/missing"
mkdir -p "$MISSING_ROOT"
if BRIK64_CLI_ROOT="$MISSING_ROOT" node "$ROOT/scripts/beta17-functional-cli-stage-result-hydrate.js" \
  >"$TMP_DIR/missing.stdout" 2>"$TMP_DIR/missing.stderr"; then
  echo "missing result unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_FUNCTIONAL_CLI_STAGE_RESULT_HYDRATION"
  and (.blockers | index("missing_functional_cli_stage_result_line:evidence/beta17-functional-cli-stage-result/result.line"))
' "$MISSING_ROOT/evidence/beta17-functional-cli-stage-result/hydrate-report.json" >/dev/null

INVALID_ROOT="$TMP_DIR/invalid"
write_fixture "$INVALID_ROOT" invalid
if BRIK64_CLI_ROOT="$INVALID_ROOT" node "$ROOT/scripts/beta17-functional-cli-stage-result-hydrate.js" \
  >"$TMP_DIR/invalid.stdout" 2>"$TMP_DIR/invalid.stderr"; then
  echo "invalid result unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_FUNCTIONAL_CLI_STAGE_RESULT_HYDRATION"
  and (.blockers | index("functional_cli_stage_generatedByL6PlusN5_not_true"))
' "$INVALID_ROOT/evidence/beta17-functional-cli-stage-result/hydrate-report.json" >/dev/null

UNSAFE_ROOT="$TMP_DIR/unsafe"
write_fixture "$UNSAFE_ROOT" unsafe
if BRIK64_CLI_ROOT="$UNSAFE_ROOT" node "$ROOT/scripts/beta17-functional-cli-stage-result-hydrate.js" \
  >"$TMP_DIR/unsafe.stdout" 2>"$TMP_DIR/unsafe.stderr"; then
  echo "unsafe result unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_FUNCTIONAL_CLI_STAGE_RESULT_HYDRATION"
  and (.blockers | index("functional_cli_stage_stage1Artifact_ref_path_invalid"))
' "$UNSAFE_ROOT/evidence/beta17-functional-cli-stage-result/hydrate-report.json" >/dev/null

echo "PASS beta17 functional CLI stage result hydration tests"
