#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

node --check "$ROOT/scripts/beta17-target-aware-factory-result-gate.js"

write_fixture() {
  local dir="$1"
  local mode="$2"
  mkdir -p "$dir/scripts" "$dir/evidence/beta17-functional-cli-stage-attempt/transcripts" \
    "$dir/evidence/beta17-functional-cli-stage-request"
  cp "$ROOT/scripts/beta17-target-aware-factory-result-gate.js" "$dir/scripts/"
  cp "$ROOT/scripts/beta17-functional-cli-stage-result.js" "$dir/scripts/"
  python3 - "$dir" "$mode" <<'PY'
import base64, hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
mode = sys.argv[2]
input_pcds = [
  {"path": "pcd/cli_core.pcd", "sha256": "a" * 64, "bytes": 10},
  {"path": "pcd/cli_polymer.pcd", "sha256": "b" * 64, "bytes": 20},
]
pcd_hash = hashlib.sha256(("".join(f"{i['sha256']}\t{i['bytes']}\t{i['path']}\n" for i in input_pcds)).encode()).hexdigest()
request_sha = "c" * 64
manifest = {
  "schemaVersion": "brik64.beta17_functional_cli_stage_request_manifest.v1",
  "version": "0.1.0-beta.17",
  "requestLineSha256": request_sha,
  "pcdInputSetSha256": pcd_hash,
  "inputPcds": input_pcds,
}
(root / "evidence/beta17-functional-cli-stage-request/request.manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
artifact = ("\n".join([
  "#!/usr/bin/env node",
  "const version = '0.1.0-beta.17';",
  "const args = process.argv;",
  "const commands = ['certify','verify','emit','polymerize','lift','monomers','engine status'];",
]) + "\n" + "\n".join(f"// filler {i}" for i in range(6000))).encode()
artifact_sha = hashlib.sha256(artifact).hexdigest()
closed = {
  "publicReleaseAllowed": False,
  "definitiveFixpointAllowed": False,
  "formalN5ClaimAllowed": False,
  "universalCorrectnessClaimAllowed": False,
  "selfHostingClaimAllowed": False,
  "rustIndependenceClaimAllowed": False,
}
result = {
  "schemaVersion": "brik64.beta17_functional_cli_stage_result.v1",
  "version": "0.1.0-beta.17",
  "l6plusEngineSerial": "BRIK64-L6PLUS-N5-20260629-TARGET-AWARE-001",
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
  "functionalCliStageRequestSha256": request_sha,
  "stage1ArtifactSha256": artifact_sha,
  "stage1ArtifactBytes": len(artifact),
  "stage1ArtifactBase64": base64.b64encode(artifact).decode(),
  "generationTraceSha256": "d" * 64,
  "remoteWrapperSha256": "e" * 64,
  "wrapperExecTargetSha256": "f" * 64,
  "stage1Artifact": {"path": "evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs", "sha256": artifact_sha, "bytes": len(artifact)},
  "stage1Manifest": {"path": "evidence/beta17-fixpoint/stage1_artifact_manifest.json", "sha256": "1" * 64, "bytes": 1},
  "functionalStageReport": {"path": "evidence/beta17-fixpoint-functional-stage-artifact/report.json", "sha256": "2" * 64, "bytes": 1},
  "packageManifest": {"path": "evidence/beta17-package/package.manifest.json", "sha256": "3" * 64, "bytes": 1},
  "inputPcds": input_pcds,
  "claimBoundary": closed,
}
functional_line = "BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT\t" + base64.b64encode(json.dumps(result).encode()).decode() + "\n"
if mode == "pass":
    factory = {
      "schemaVersion": "brik64.l6plus_pcd_artifact_factory_result.v1",
      "version": "0.1.0-beta.17",
      "artifactKind": "cli",
      "capability": "l6plus_pcd_artifact_factory",
      "targetResultLineBase64": base64.b64encode(functional_line.encode()).decode(),
      "artifactContentBase64": base64.b64encode(artifact).decode(),
    }
elif mode == "generic":
    generic = b'{"schemaVersion":"brik64.generated_artifact.v1","version":"0.1.0-beta.17","artifactKind":"cli"}\n'
    factory = {
      "schemaVersion": "brik64.l6plus_pcd_artifact_factory_result.v1",
      "version": "0.1.0-beta.17",
      "artifactKind": "cli",
      "capability": "l6plus_pcd_artifact_factory",
      "generatedArtifactBytes": len(generic),
      "generatedArtifactSha256": hashlib.sha256(generic).hexdigest(),
      "artifactContentBase64": base64.b64encode(generic).decode(),
    }
else:
    raise SystemExit("unsupported_fixture_mode")
line = "BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT\t" + base64.b64encode(json.dumps(factory).encode()).decode() + "\n"
(root / "evidence/beta17-functional-cli-stage-attempt/transcripts/factory-attempt.stdout.txt").write_text(line)
PY
}

PASS_ROOT="$TMP_DIR/pass"
write_fixture "$PASS_ROOT" pass
BRIK64_CLI_ROOT="$PASS_ROOT" node "$PASS_ROOT/scripts/beta17-target-aware-factory-result-gate.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"
jq -e '
  .decision=="PASS_BETA17_TARGET_AWARE_FACTORY_RESULT_GATE"
  and .targetFunctionalCliStageResultObserved==true
  and .publicationAllowed==false
' "$PASS_ROOT/evidence/beta17-target-aware-factory-result-gate/report.json" >/dev/null

GENERIC_ROOT="$TMP_DIR/generic"
write_fixture "$GENERIC_ROOT" generic
if BRIK64_CLI_ROOT="$GENERIC_ROOT" node "$GENERIC_ROOT/scripts/beta17-target-aware-factory-result-gate.js" \
  >"$TMP_DIR/generic.stdout" 2>"$TMP_DIR/generic.stderr"; then
  echo "generic factory result unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_TARGET_AWARE_FACTORY_RESULT_GATE"
  and (.blockers | index("factory_result_missing_target_functional_cli_stage_result_line"))
  and (.blockers | index("factory_result_not_target_aware"))
' "$GENERIC_ROOT/evidence/beta17-target-aware-factory-result-gate/report.json" >/dev/null

MISSING_ROOT="$TMP_DIR/missing"
mkdir -p "$MISSING_ROOT/scripts"
cp "$ROOT/scripts/beta17-target-aware-factory-result-gate.js" "$MISSING_ROOT/scripts/"
cp "$ROOT/scripts/beta17-functional-cli-stage-result.js" "$MISSING_ROOT/scripts/"
if BRIK64_CLI_ROOT="$MISSING_ROOT" node "$MISSING_ROOT/scripts/beta17-target-aware-factory-result-gate.js" \
  >"$TMP_DIR/missing.stdout" 2>"$TMP_DIR/missing.stderr"; then
  echo "missing transcript unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_TARGET_AWARE_FACTORY_RESULT_GATE"
  and (.blockers | index("missing_factory_transcript:evidence/beta17-functional-cli-stage-attempt/transcripts/factory-attempt.stdout.txt"))
' "$MISSING_ROOT/evidence/beta17-target-aware-factory-result-gate/report.json" >/dev/null

echo "PASS beta17 target-aware factory result gate tests"
