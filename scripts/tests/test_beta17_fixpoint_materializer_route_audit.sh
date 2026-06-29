#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FIXTURE="$TMP_DIR/workspace"
mkdir -p \
  "$FIXTURE/scripts" \
  "$FIXTURE/generated" \
  "$FIXTURE/pcd/beta17/release" \
  "$FIXTURE/evidence/beta17-fixpoint/generated/stage1" \
  "$FIXTURE/evidence/beta17-fixpoint/generated/stage2" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-attempt" \
  "$FIXTURE/evidence/beta17-fixpoint-materializer-route-audit"

printf '%s\n' '// brik64.pcd_file.v1' 'PC stage_one { fn run() -> i64 { return 1; } }' \
  >"$FIXTURE/pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd"
printf '%s\n' '// brik64.pcd_file.v1' 'PC stage_two { fn run() -> i64 { return 1; } }' \
  >"$FIXTURE/pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd"
printf '%s\n' '// brik64.pcd_file.v1' 'PC cli_core { fn run() -> i64 { return 1; } }' \
  >"$FIXTURE/pcd/cli_core.pcd"
printf '%s\n' '// brik64.pcd_file.v1' 'PC cli_polymer { fn run() -> i64 { return 1; } }' \
  >"$FIXTURE/pcd/cli_polymer.pcd"

cat >"$FIXTURE/scripts/beta17-fixpoint-stage-fixture-materializer.js" <<'JS'
#!/usr/bin/env node
const fixtureMaterializer = true;
console.log("BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t<base64-json>");
JS

cat >"$FIXTURE/scripts/remote_l6_beta15_7_cli_materializer.js" <<'JS'
#!/usr/bin/env node
console.log("BRIK64_L6_CLI_MATERIALIZATION_RESULT\tlegacy");
JS

cat >"$FIXTURE/scripts/remote_l6_beta16_1_cli_materializer.js" <<'JS'
#!/usr/bin/env node
console.log("BRIK64_L6_CLI_MATERIALIZATION_RESULT\tlegacy");
JS

cat >"$FIXTURE/generated/beta17-materializer.js" <<'JS'
#!/usr/bin/env node
console.log("BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t" + Buffer.from(JSON.stringify({ decision: "NON_CLAIM_TEST_VECTOR" })).toString("base64"));
JS

node --check scripts/beta17-fixpoint-materializer-route-audit.js

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-materializer-route-audit.js" \
  --materializer generated/beta17-materializer.js \
  >/tmp/brik64-beta17-route-audit-blocked.stdout \
  2>/tmp/brik64-beta17-route-audit-blocked.stderr
blocked_rc=$?
set -e

if [[ "$blocked_rc" -eq 0 ]]; then
  echo "beta17_route_audit_unexpected_pass_without_provenance_remote_or_stage" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_MATERIALIZER_ROUTE_AUDIT"
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .stageRequest.accepted==true
  and (.candidateRoutes[] | select(.id=="beta17_fixture_materializer") | .classification=="rejected_fixture_non_claim")
  and (.candidateRoutes[] | select(.id=="remote_l6_beta15_7_cli_materializer") | .classification=="rejected_legacy_cli_materializer")
  and (.candidateRoutes[] | select(.id=="generated_materializer") | .classification=="candidate_local_materializer")
  and (.blockers | index("no_beta17_fixpoint_materializer_route_ready"))
' "$FIXTURE/evidence/beta17-fixpoint-materializer-route-audit/report.json" >/dev/null

cat >"$FIXTURE/generated/placeholder-materializer.js" <<'JS'
#!/usr/bin/env node
console.log("BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t<base64-json>");
JS

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-materializer-route-audit.js" \
  --materializer generated/placeholder-materializer.js \
  --out evidence/beta17-fixpoint-materializer-route-audit/placeholder-report.json \
  >/tmp/brik64-beta17-route-audit-placeholder.stdout \
  2>/tmp/brik64-beta17-route-audit-placeholder.stderr
placeholder_rc=$?
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-materializer-route-audit.js" \
  --materializer scripts/beta17-fixpoint-stage-fixture-materializer.js \
  --out evidence/beta17-fixpoint-materializer-route-audit/fixture-report.json \
  >/tmp/brik64-beta17-route-audit-fixture.stdout \
  2>/tmp/brik64-beta17-route-audit-fixture.stderr
fixture_rc=$?
set -e

if [[ "$placeholder_rc" -eq 0 || "$fixture_rc" -eq 0 ]]; then
  echo "beta17_route_audit_adversarial_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_MATERIALIZER_ROUTE_AUDIT"
  and (.blockers | index("generated_materializer:generated_materializer_placeholder_result_marker"))
' "$FIXTURE/evidence/beta17-fixpoint-materializer-route-audit/placeholder-report.json" >/dev/null

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_MATERIALIZER_ROUTE_AUDIT"
  and (.blockers | index("generated_materializer:generated_materializer_fixture_or_template_content"))
' "$FIXTURE/evidence/beta17-fixpoint-materializer-route-audit/fixture-report.json" >/dev/null

BRIK64_CLI_ROOT="$FIXTURE" node - <<'NODE'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildRequest } = require('./scripts/beta17-fixpoint-stage-request-bundle');
const root = process.env.BRIK64_CLI_ROOT;
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}
function ref(relativePath, content) {
  write(path.join(root, relativePath), content);
  return {
    path: relativePath,
    sha256: sha256(Buffer.from(content)),
    bytes: Buffer.byteLength(content),
  };
}
const request = buildRequest();
const materializerRequestSha256 = sha256(`BRIK64_BETA17_FIXPOINT_STAGE_REQUEST\t${Buffer.from(JSON.stringify(request)).toString('base64')}\n`);
const artifactBody = 'export const beta17Stage = "real-shape-test-vector";\n';
const stage1Artifact = ref(request.outputRefs.stage1Artifact, artifactBody);
const stage2Artifact = ref(request.outputRefs.stage2Artifact, artifactBody);
const stage1Manifest = {
  schemaVersion: 'brik64.beta17_fixpoint.stage1_artifact_manifest.v1',
  artifact: { sha256: stage1Artifact.sha256 },
};
const stage2Manifest = {
  schemaVersion: 'brik64.beta17_fixpoint.stage2_regeneration_manifest.v1',
  stage1ArtifactSha256: stage1Artifact.sha256,
  artifact: { sha256: stage2Artifact.sha256 },
};
const byteIdenticalReport = { decision: 'PASS_BYTE_IDENTICAL_REGENERATION', stage1ArtifactSha256: stage1Artifact.sha256, stage2ArtifactSha256: stage2Artifact.sha256 };
const harnessReport = { decision: 'PASS_BETA17_FIXPOINT_HARNESS', adversarialCases: 3 };
const sealReport = { decision: 'PASS_BETA17_FIXPOINT_SEAL' };
writeJson(path.join(root, request.outputRefs.stage1Manifest), stage1Manifest);
writeJson(path.join(root, request.outputRefs.stage2Manifest), stage2Manifest);
writeJson(path.join(root, request.outputRefs.byteIdenticalReport), byteIdenticalReport);
writeJson(path.join(root, request.outputRefs.harnessReport), harnessReport);
writeJson(path.join(root, request.outputRefs.sealReport), sealReport);
function fileRef(relativePath) {
  const file = path.join(root, relativePath);
  const body = fs.readFileSync(file);
  return { path: relativePath, sha256: sha256(body), bytes: body.length };
}
const result = {
  schemaVersion: 'brik64.beta17_fixpoint_stage_result.v1',
  version: '0.1.0-beta.17',
  l6plusEngineSerial: 'BRIK64-L6PLUS-N5-TEST-REAL-SHAPE',
  materializerMode: 'l6plus_fixpoint_stage_materializer',
  generatedByL6PlusN5: true,
  stage2GeneratedByStage1: true,
  byteIdentical: true,
  byteIdenticalSha256Match: true,
  byteIdenticalSizeMatch: true,
  harnessPass: true,
  adversarialCases: 3,
  sealReportPass: true,
  pcdInputSetSha256: request.pcdInputSetSha256,
  materializerRequestSha256,
  stage1ArtifactSha256: stage1Artifact.sha256,
  stage2ArtifactSha256: stage2Artifact.sha256,
  stage1ArtifactBytes: stage1Artifact.bytes,
  stage2ArtifactBytes: stage2Artifact.bytes,
  compositeSha256: sha256('composite'),
  generationTraceSha256: sha256('trace'),
  remoteWrapperSha256: sha256('wrapper'),
  wrapperExecTargetSha256: sha256('exec-target'),
  stage1Artifact,
  stage2Artifact,
  stage1Manifest: fileRef(request.outputRefs.stage1Manifest),
  stage2Manifest: fileRef(request.outputRefs.stage2Manifest),
  byteIdenticalReport: fileRef(request.outputRefs.byteIdenticalReport),
  harnessReport: fileRef(request.outputRefs.harnessReport),
  sealReport: fileRef(request.outputRefs.sealReport),
  inputPcds: request.inputPcds.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })),
  claimBoundary: {
    publicReleaseAllowed: false,
    formalN5ClaimAllowed: false,
    universalCorrectnessClaimAllowed: false,
  },
};
write(path.join(root, 'evidence/beta17-fixpoint/stage-output.txt'), `BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t${Buffer.from(JSON.stringify(result)).toString('base64')}\n`);
NODE

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-materializer-route-audit.js" \
  --materializer generated/beta17-materializer.js \
  --stage-output evidence/beta17-fixpoint/stage-output.txt \
  --out evidence/beta17-fixpoint-materializer-route-audit/pass-report.json \
  >/tmp/brik64-beta17-route-audit-pass.stdout \
  2>/tmp/brik64-beta17-route-audit-pass.stderr

jq -e '
  .decision=="PASS_BETA17_FIXPOINT_MATERIALIZER_ROUTE_AUDIT"
  and .publicationAllowed==false
  and (.candidateRoutes[] | select(.id=="stage_result") | .classification=="accepted_stage_result")
  and (.blockers | length)==0
' "$FIXTURE/evidence/beta17-fixpoint-materializer-route-audit/pass-report.json" >/dev/null

echo "PASS beta17 fixpoint materializer route audit"
