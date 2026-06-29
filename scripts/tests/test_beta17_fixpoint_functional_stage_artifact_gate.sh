#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

write_fixture() {
  local dir="$1"
  local body_mode="${2:-functional}"
  mkdir -p "$dir/evidence/beta17-fixpoint/generated/stage1" "$dir/evidence/beta17-fixpoint"
  local artifact="$dir/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs"
  if [[ "$body_mode" == "metadata" ]]; then
    cat >"$artifact" <<'JS'
// brik64 beta17 generated stage artifact
export const brik64Beta17StageArtifact = {
  version: "0.1.0-beta.17",
  generatedByL6PlusN5: true
};
JS
  else
    cat >"$artifact" <<'JS'
#!/usr/bin/env node
const version = "0.1.0-beta.17";
const monomers = Array.from({ length: 128 }, (_, index) => ({
  id: `MC_${String(index).padStart(2, "0")}`,
  name: `MONOMER_${index}`,
  tier: index < 64 ? "core" : "extended",
}));
const commandHandlers = new Map([
  ["--version", () => console.log(version)],
  ["--help", () => console.log("brik64 certify verify emit polymerize lift monomers engine")],
  ["certify", () => console.log("certify command")],
  ["verify", () => console.log("verify command")],
  ["emit", () => console.log("emit command")],
  ["polymerize", () => console.log("polymerize command")],
  ["lift", () => console.log("lift command")],
  ["doctor", () => console.log(JSON.stringify({ status: "PASS", version }))],
  ["engine status --json", () => console.log(JSON.stringify({
    engine: "L4+N5",
    runtimeProfile: "l4plus_n5_local",
    localRuntime: "available",
    releaseEligible: true,
  }))],
  ["monomers list --json", () => console.log(JSON.stringify({
    totalCount: monomers.length,
    coreCount: 64,
    extendedCount: 64,
    monomers,
  }))],
]);
const command = process.argv.slice(2).join(" ") || "--version";
if (commandHandlers.has(command)) {
  commandHandlers.get(command)();
  process.exit(0);
}
console.error(`unsupported command: ${command}`);
process.exit(1);
JS
    python3 - "$artifact" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
with path.open("a") as fh:
    for index in range(3200):
        fh.write(f"// generated command table filler {index}\n")
PY
  fi
  local sha bytes
  sha="$(sha256_file "$artifact")"
  bytes="$(wc -c <"$artifact" | tr -d ' ')"
  cat >"$dir/evidence/beta17-fixpoint/stage1_artifact_manifest.json" <<JSON
{
  "schemaVersion": "brik64.beta17_fixpoint.stage1_artifact_manifest.v1",
  "version": "0.1.0-beta.17",
  "generatedByL6PlusN5": true,
  "artifact": {
    "path": "evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs",
    "sha256": "$sha",
    "bytes": $bytes
  }
}
JSON
}

PASS_ROOT="$TMP_DIR/pass"
write_fixture "$PASS_ROOT" functional
BRIK64_CLI_ROOT="$PASS_ROOT" node "$ROOT/scripts/beta17-fixpoint-functional-stage-artifact-gate.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"
jq -e '
  .decision=="PASS_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE"
  and .releaseEligibleStageArtifact==true
  and .checks.artifactMinSize==true
  and .checks.nodeEntrypoint==true
  and .checks.argvHandling==true
  and .checks.commandDispatcher==true
  and .checks.execVersion==true
  and .checks.execHelp==true
  and .checks.execEngineStatusJson==true
  and .checks.execMonomersListJson==true
  and .checks.execBaseCommands.certify==true
  and .checks.execBaseCommands.verify==true
  and .checks.execBaseCommands.emit==true
  and .checks.execBaseCommands.polymerize==true
  and .checks.execBaseCommands.lift==true
  and .claimBoundary.definitiveFixpointAllowed==false
' "$PASS_ROOT/evidence/beta17-fixpoint-functional-stage-artifact/report.json" >/dev/null

# Break attempt 1: missing Stage1 manifest fails closed.
MISSING_ROOT="$TMP_DIR/missing"
mkdir -p "$MISSING_ROOT"
if BRIK64_CLI_ROOT="$MISSING_ROOT" node "$ROOT/scripts/beta17-fixpoint-functional-stage-artifact-gate.js" \
  >"$TMP_DIR/missing.stdout" 2>"$TMP_DIR/missing.stderr"; then
  echo "missing manifest unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE"
  and (.blockers | index("missing_stage1_artifact_manifest:evidence/beta17-fixpoint/stage1_artifact_manifest.json"))
' "$MISSING_ROOT/evidence/beta17-fixpoint-functional-stage-artifact/report.json" >/dev/null

# Break attempt 2: SHA drift fails closed.
SHA_ROOT="$TMP_DIR/sha"
write_fixture "$SHA_ROOT" functional
printf "tampered\n" >>"$SHA_ROOT/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs"
if BRIK64_CLI_ROOT="$SHA_ROOT" node "$ROOT/scripts/beta17-fixpoint-functional-stage-artifact-gate.js" \
  >"$TMP_DIR/sha.stdout" 2>"$TMP_DIR/sha.stderr"; then
  echo "SHA drift unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE"
  and (.blockers | index("stage1_artifact_sha256_mismatch"))
  and (.blockers | index("stage1_artifact_bytes_mismatch"))
' "$SHA_ROOT/evidence/beta17-fixpoint-functional-stage-artifact/report.json" >/dev/null

# Break attempt 3: metadata-only Stage1 is not a functional CLI artifact.
METADATA_ROOT="$TMP_DIR/metadata"
write_fixture "$METADATA_ROOT" metadata
if BRIK64_CLI_ROOT="$METADATA_ROOT" node "$ROOT/scripts/beta17-fixpoint-functional-stage-artifact-gate.js" \
  >"$TMP_DIR/metadata.stdout" 2>"$TMP_DIR/metadata.stderr"; then
  echo "metadata-only artifact unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE"
  and any(.blockers[]; startswith("stage1_artifact_too_small:"))
  and (.blockers | index("stage1_artifact_missing_node_entrypoint"))
  and (.blockers | index("stage1_artifact_missing_argv_handling"))
' "$METADATA_ROOT/evidence/beta17-fixpoint-functional-stage-artifact/report.json" >/dev/null

# Break attempt 4: a large dispatcher stub must not pass without executable command semantics.
STUB_ROOT="$TMP_DIR/stub"
write_fixture "$STUB_ROOT" functional
cat >"$STUB_ROOT/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs" <<'JS'
#!/usr/bin/env node
const BRIK64_VERSION = '0.1.0-beta.17';
const command = process.argv.slice(2).join(" ");
const commandDispatcher = new Map();
commandDispatcher.set('certify', () => 'certify command');
commandDispatcher.set('verify', () => 'verify command');
commandDispatcher.set('emit', () => 'emit command');
commandDispatcher.set('polymerize', () => 'polymerize command');
commandDispatcher.set('lift', () => 'lift command');
commandDispatcher.set('monomers', () => 'monomers command');
commandDispatcher.set('engine status', () => 'engine status command');
if (require.main === module) console.log(commandDispatcher.get(command) ? commandDispatcher.get(command)() : BRIK64_VERSION);
JS
python3 - "$STUB_ROOT/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
with path.open("a") as fh:
    for index in range(5000):
        fh.write(f"// generated stub filler {index}\n")
PY
sha="$(sha256_file "$STUB_ROOT/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs")"
bytes="$(wc -c <"$STUB_ROOT/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs" | tr -d ' ')"
python3 - "$STUB_ROOT/evidence/beta17-fixpoint/stage1_artifact_manifest.json" "$sha" "$bytes" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
data = json.loads(path.read_text())
data["artifact"]["sha256"] = sys.argv[2]
data["artifact"]["bytes"] = int(sys.argv[3])
path.write_text(json.dumps(data, indent=2) + "\n")
PY
if BRIK64_CLI_ROOT="$STUB_ROOT" node "$ROOT/scripts/beta17-fixpoint-functional-stage-artifact-gate.js" \
  >"$TMP_DIR/stub.stdout" 2>"$TMP_DIR/stub.stderr"; then
  echo "large dispatcher stub unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_FUNCTIONAL_STAGE_ARTIFACT_GATE"
  and (.checks.artifactMinSize==true)
  and (.checks.commandDispatcher==true)
  and (.checks.execHelp==false)
  and (.checks.execEngineStatusJson==false)
  and (.checks.execMonomersListJson==false)
  and any(.blockers[]; startswith("stage1_artifact_exec_help_failed:"))
  and any(.blockers[]; startswith("stage1_artifact_exec_engine_status_json_failed:"))
  and any(.blockers[]; startswith("stage1_artifact_exec_monomers_list_json_failed:"))
' "$STUB_ROOT/evidence/beta17-fixpoint-functional-stage-artifact/report.json" >/dev/null

echo "PASS beta17 functional stage artifact gate tests"
