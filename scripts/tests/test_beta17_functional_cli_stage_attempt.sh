#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

write_fixture() {
  local dir="$1"
  local mode="${2:-valid}"
  mkdir -p "$dir/evidence/beta17-functional-cli-stage-request" \
    "$dir/evidence/beta17-functional-cli-stage-result" \
    "$dir/pcd/beta17/release" "$dir/pcd" "$dir/scripts"
  cp "$ROOT/scripts/beta17-functional-cli-stage-result.js" "$dir/scripts/"
  cp "$ROOT/scripts/beta17-functional-cli-stage-result-hydrate.js" "$dir/scripts/"
  cp "$ROOT/scripts/beta17-fixpoint-functional-stage-artifact-gate.js" "$dir/scripts/"
  cp "$ROOT/scripts/beta17-functional-cli-stage-attempt.js" "$dir/scripts/"
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
(root / "evidence/beta17-functional-cli-stage-request/request.line").write_text(
    "BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_REQUEST\t" + base64.b64encode(b"{}").decode() + "\n"
)
request_manifest = {
    "schemaVersion": "brik64.beta17_functional_cli_stage_request_manifest.v1",
    "version": "0.1.0-beta.17",
    "decision": "PASS_BETA17_FUNCTIONAL_CLI_STAGE_REQUEST_BUNDLE",
    "requestLineSha256": request_line_sha,
    "pcdInputSetSha256": pcd_hash,
    "inputPcds": input_pcds,
}
(root / "evidence/beta17-functional-cli-stage-request/request.manifest.json").write_text(json.dumps(request_manifest, indent=2) + "\n")
monomers = [{"id": f"MC_{i:02d}", "name": f"TEST_{i:02d}"} for i in range(128)]
header = "\n".join([
    "#!/usr/bin/env node",
    "const version = '0.1.0-beta.17';",
    "const monomers = " + json.dumps(monomers) + ";",
    "const commandHandlers = new Map(); // command dispatcher",
    "commandHandlers.set('--version', () => version);",
    "commandHandlers.set('--help', () => 'BRIK64 CLI commands: certify verify emit polymerize lift monomers engine');",
    "commandHandlers.set('certify', () => 'certify command');",
    "commandHandlers.set('verify', () => 'verify command');",
    "commandHandlers.set('emit', () => 'emit command');",
    "commandHandlers.set('polymerize', () => 'polymerize command');",
    "commandHandlers.set('lift', () => 'lift command');",
    "commandHandlers.set('monomers list --json', () => JSON.stringify({ totalCount: monomers.length, monomers }));",
    "commandHandlers.set('engine status --json', () => JSON.stringify({ engine: 'L4+N5', runtimeProfile: 'l4plus_n5_local', localRuntime: 'available' }));",
    "const command = process.argv.slice(2).join(' ');",
    "console.log(commandHandlers.get(command) ? commandHandlers.get(command)() : version);",
])
artifact = (header + "\n" + "\n".join(f"// functional cli filler {i}" for i in range(5000))).encode()
artifact_sha = hashlib.sha256(artifact).hexdigest()
result = {
    "schemaVersion": "brik64.beta17_functional_cli_stage_result.v1",
    "version": "0.1.0-beta.17",
    "l6plusEngineSerial": "BRIK64-L6PLUS-N5-20260629-ATTEMPT-001",
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
closed = {
    "publicReleaseAllowed": False,
    "definitiveFixpointAllowed": False,
    "formalN5ClaimAllowed": False,
    "universalCorrectnessClaimAllowed": False,
    "publicClaimsAllowed": False,
    "selfHostingClaimAllowed": False,
    "rustIndependenceClaimAllowed": False,
}
stage1_manifest = {
    "schemaVersion": "brik64.beta17_fixpoint.stage1_artifact_manifest.v1",
    "version": result["version"],
    "generatedByL6PlusN5": True,
    "generatedFromPcdPolymer": True,
    "artifact": result["stage1Artifact"],
    "stage1ArtifactSha256": result["stage1ArtifactSha256"],
    "functionalCliStageRequestSha256": result["functionalCliStageRequestSha256"],
    "pcdInputSetSha256": result["pcdInputSetSha256"],
    "claimBoundary": closed,
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
    "claimBoundary": closed,
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
if mode == "invalid":
    result["generatedFromPcdPolymer"] = False
line = "BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT\t" + base64.b64encode(json.dumps(result).encode()).decode() + "\n"
(root / "evidence/beta17-functional-cli-stage-result/result.line").write_text(line)
PY
}

PASS_ROOT="$TMP_DIR/pass"
write_fixture "$PASS_ROOT" valid
if ! BRIK64_CLI_ROOT="$PASS_ROOT" node "$PASS_ROOT/scripts/beta17-functional-cli-stage-attempt.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"; then
  echo "valid functional stage attempt unexpectedly failed" >&2
  cat "$TMP_DIR/pass.stdout" >&2 || true
  cat "$TMP_DIR/pass.stderr" >&2 || true
  jq '.' "$PASS_ROOT/evidence/beta17-functional-cli-stage-attempt/report.json" >&2 || true
  jq '.' "$PASS_ROOT/evidence/beta17-functional-cli-stage-result/hydrate-report.json" >&2 || true
  exit 1
fi
jq -e '
  .decision=="PASS_BETA17_FUNCTIONAL_CLI_STAGE_ATTEMPT"
  and .hydrated==true
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
' "$PASS_ROOT/evidence/beta17-functional-cli-stage-attempt/report.json" >/dev/null
jq -e '.decision=="PASS_BETA17_FUNCTIONAL_CLI_STAGE_RESULT_HYDRATION"' \
  "$PASS_ROOT/evidence/beta17-functional-cli-stage-result/hydrate-report.json" >/dev/null

MISSING_ROOT="$TMP_DIR/missing"
mkdir -p "$MISSING_ROOT/scripts"
cp "$ROOT/scripts/beta17-functional-cli-stage-attempt.js" "$MISSING_ROOT/scripts/"
cp "$ROOT/scripts/beta17-functional-cli-stage-result.js" "$MISSING_ROOT/scripts/"
cp "$ROOT/scripts/beta17-functional-cli-stage-result-hydrate.js" "$MISSING_ROOT/scripts/"
cp "$ROOT/scripts/beta17-fixpoint-functional-stage-artifact-gate.js" "$MISSING_ROOT/scripts/"
if BRIK64_CLI_ROOT="$MISSING_ROOT" node "$MISSING_ROOT/scripts/beta17-functional-cli-stage-attempt.js" \
  >"$TMP_DIR/missing.stdout" 2>"$TMP_DIR/missing.stderr"; then
  echo "missing functional stage attempt unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_FUNCTIONAL_CLI_STAGE_ATTEMPT"
  and (.blockers | index("missing_functional_cli_stage_request_line:evidence/beta17-functional-cli-stage-request/request.line"))
  and (.blockers | index("functional_cli_stage_result_unavailable"))
' "$MISSING_ROOT/evidence/beta17-functional-cli-stage-attempt/report.json" >/dev/null

INVALID_ROOT="$TMP_DIR/invalid"
write_fixture "$INVALID_ROOT" invalid
if BRIK64_CLI_ROOT="$INVALID_ROOT" node "$INVALID_ROOT/scripts/beta17-functional-cli-stage-attempt.js" \
  --result-line "$INVALID_ROOT/evidence/beta17-functional-cli-stage-result/result.line" \
  >"$TMP_DIR/invalid.stdout" 2>"$TMP_DIR/invalid.stderr"; then
  echo "invalid functional stage attempt unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_FUNCTIONAL_CLI_STAGE_ATTEMPT"
  and (.blockers | index("functional_cli_stage_generatedFromPcdPolymer_not_true"))
' "$INVALID_ROOT/evidence/beta17-functional-cli-stage-attempt/report.json" >/dev/null

REMOTE_SKIP_ROOT="$TMP_DIR/remote-skip"
write_fixture "$REMOTE_SKIP_ROOT" valid
rm -f "$REMOTE_SKIP_ROOT/evidence/beta17-functional-cli-stage-result/result.line"
if BRIK64_CLI_ROOT="$REMOTE_SKIP_ROOT" BRIK64_L6_SKIP_REMOTE=1 node "$REMOTE_SKIP_ROOT/scripts/beta17-functional-cli-stage-attempt.js" \
  >"$TMP_DIR/remote-skip.stdout" 2>"$TMP_DIR/remote-skip.stderr"; then
  echo "remote-skip attempt without result unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_FUNCTIONAL_CLI_STAGE_ATTEMPT"
  and (.blockers | index("functional_cli_stage_result_unavailable"))
  and .remoteAttempt.skipped==true
  and .remoteAttempt.reason=="remote_skipped_by_BRIK64_L6_SKIP_REMOTE"
' "$REMOTE_SKIP_ROOT/evidence/beta17-functional-cli-stage-attempt/report.json" >/dev/null

echo "PASS beta17 functional CLI stage attempt tests"
