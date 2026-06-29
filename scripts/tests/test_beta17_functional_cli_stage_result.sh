#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

node <<'NODE'
const assert = require('assert');
const crypto = require('crypto');
const {
  parseFunctionalCliStageResult,
  validateFunctionalCliStageResult,
} = require('./scripts/beta17-functional-cli-stage-result');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function inputSetHash(inputPcds) {
  return sha256(`${inputPcds.map((item) => `${item.sha256}\t${item.bytes}\t${item.path}`).join('\n')}\n`);
}

function makeArtifact(extra = '') {
  const header = [
    '#!/usr/bin/env node',
    'const version = "0.1.0-beta.17";',
    'const commandHandlers = new Map(); // command dispatcher',
    'commandHandlers.set("certify", () => "certify command");',
    'commandHandlers.set("verify", () => "verify command");',
    'commandHandlers.set("emit", () => "emit command");',
    'commandHandlers.set("polymerize", () => "polymerize command");',
    'commandHandlers.set("lift", () => "lift command");',
    'commandHandlers.set("monomers", () => "monomers command");',
    'commandHandlers.set("engine status", () => "engine status command");',
    'const command = process.argv.slice(2).join(" ");',
    'if (commandHandlers.has(command)) console.log(commandHandlers.get(command)());',
    extra,
  ].join('\n');
  const filler = Array.from({ length: 2600 }, (_, index) => `// generated functional CLI filler ${index}`).join('\n');
  return Buffer.from(`${header}\n${filler}\n`);
}

const artifact = makeArtifact();
const artifactSha = sha256(artifact);
const inputPcds = [
  { path: 'pcd/beta17/release/functional_cli_stage_materialization_contract.pcd', sha256: 'a'.repeat(64), bytes: 101 },
  { path: 'pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd', sha256: 'b'.repeat(64), bytes: 102 },
  { path: 'pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd', sha256: 'c'.repeat(64), bytes: 103 },
  { path: 'pcd/cli_core.pcd', sha256: 'd'.repeat(64), bytes: 104 },
  { path: 'pcd/cli_polymer.pcd', sha256: 'e'.repeat(64), bytes: 105 },
];
const good = {
  schemaVersion: 'brik64.beta17_functional_cli_stage_result.v1',
  version: '0.1.0-beta.17',
  l6plusEngineSerial: 'BRIK64-L6PLUS-N5-20260629-FUNCTIONAL-CLI-001',
  materializerMode: 'l6plus_functional_cli_stage_materializer',
  generatedByL6PlusN5: true,
  generatedFromPcdPolymer: true,
  nodeEntrypointPresent: true,
  versionBound: true,
  argvHandlingPresent: true,
  commandDispatcherPresent: true,
  functionalStageMinSizePass: true,
  functionalStageArtifactGatePass: true,
  packageCandidateReferencesArtifact: true,
  publicClaimBoundaryClosed: true,
  pcdInputSetSha256: inputSetHash(inputPcds),
  functionalCliStageRequestSha256: '1'.repeat(64),
  stage1ArtifactSha256: artifactSha,
  stage1ArtifactBytes: artifact.length,
  stage1ArtifactBase64: artifact.toString('base64'),
  generationTraceSha256: '2'.repeat(64),
  remoteWrapperSha256: '3'.repeat(64),
  wrapperExecTargetSha256: '4'.repeat(64),
  stage1Artifact: { path: 'evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs', sha256: artifactSha, bytes: artifact.length },
  stage1Manifest: { path: 'evidence/beta17-fixpoint/stage1_artifact_manifest.json', sha256: '5'.repeat(64), bytes: 500 },
  functionalStageReport: { path: 'evidence/beta17-fixpoint-functional-stage-artifact/report.json', sha256: '6'.repeat(64), bytes: 600 },
  packageManifest: { path: 'evidence/beta17-package/package.manifest.json', sha256: '7'.repeat(64), bytes: 700 },
  inputPcds,
  claimBoundary: {
    publicReleaseAllowed: false,
    definitiveFixpointAllowed: false,
    formalN5ClaimAllowed: false,
    universalCorrectnessClaimAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  },
};

const encoded = Buffer.from(JSON.stringify(good)).toString('base64');
const parsed = parseFunctionalCliStageResult(`noise\nBRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT\t${encoded}\n`);
assert.strictEqual(parsed.version, '0.1.0-beta.17');
assert.strictEqual(validateFunctionalCliStageResult(parsed).accepted, true);
assert.strictEqual(validateFunctionalCliStageResult(parsed, {
  pcdInputSetSha256: good.pcdInputSetSha256,
  functionalCliStageRequestSha256: good.functionalCliStageRequestSha256,
  remoteWrapperSha256: good.remoteWrapperSha256,
  wrapperExecTargetSha256: good.wrapperExecTargetSha256,
  requiredInputPcdPaths: inputPcds.map((item) => item.path),
}).accepted, true);

for (const [mutator, blocker] of [
  [(x) => { x.version = '0.1.0-beta.16.1'; }, 'functional_cli_stage_result_version_mismatch:0.1.0-beta.16.1'],
  [(x) => { x.generatedByL6PlusN5 = false; }, 'functional_cli_stage_generatedByL6PlusN5_not_true'],
  [(x) => { x.claimBoundary.publicReleaseAllowed = true; }, 'functional_cli_stage_claim_boundary_public_release_open'],
  [(x) => { x.stage1ArtifactSha256 = '8'.repeat(64); }, 'functional_cli_stage_artifact_sha256_mismatch'],
  [(x) => { x.stage1Artifact.path = '../stage1.mjs'; }, 'functional_cli_stage_stage1Artifact_ref_path_invalid'],
  [(x) => { x.functionalStageMinSizePass = false; }, 'functional_cli_stage_functionalStageMinSizePass_not_true'],
]) {
  const candidate = structuredClone(good);
  mutator(candidate);
  const result = validateFunctionalCliStageResult(candidate);
  assert.strictEqual(result.accepted, false, blocker);
  assert(result.blockers.includes(blocker), `${blocker} not found in ${result.blockers.join(',')}`);
}

const missingMarker = structuredClone(good);
const noArgvArtifact = makeArtifact('').toString('utf8').replace('process.argv', 'process.env.BRIK64_ARGS');
missingMarker.stage1ArtifactBase64 = Buffer.from(noArgvArtifact).toString('base64');
missingMarker.stage1ArtifactSha256 = sha256(Buffer.from(noArgvArtifact));
missingMarker.stage1Artifact.sha256 = missingMarker.stage1ArtifactSha256;
missingMarker.stage1Artifact.bytes = Buffer.byteLength(noArgvArtifact);
missingMarker.stage1ArtifactBytes = Buffer.byteLength(noArgvArtifact);
let result = validateFunctionalCliStageResult(missingMarker);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('functional_cli_stage_artifact_missing_text_marker:process.argv'));

const candidateStub = structuredClone(good);
const stubArtifact = makeArtifact('console.error("candidate package is not public-release eligible yet");');
candidateStub.stage1ArtifactBase64 = stubArtifact.toString('base64');
candidateStub.stage1ArtifactSha256 = sha256(stubArtifact);
candidateStub.stage1Artifact.sha256 = candidateStub.stage1ArtifactSha256;
candidateStub.stage1Artifact.bytes = stubArtifact.length;
candidateStub.stage1ArtifactBytes = stubArtifact.length;
result = validateFunctionalCliStageResult(candidateStub);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('functional_cli_stage_artifact_candidate_only_stub'));

const wrongRequest = validateFunctionalCliStageResult(good, { functionalCliStageRequestSha256: '9'.repeat(64) });
assert.strictEqual(wrongRequest.accepted, false);
assert(wrongRequest.blockers.includes('functional_cli_stage_request_sha256_mismatch'));

const detachedInputSet = structuredClone(good);
detachedInputSet.inputPcds[0].bytes += 1;
result = validateFunctionalCliStageResult(detachedInputSet);
assert.strictEqual(result.accepted, false);
assert(result.blockers.includes('functional_cli_stage_input_pcd_set_sha256_mismatch'));

const missingRequiredPcd = validateFunctionalCliStageResult(
  { ...good, inputPcds: good.inputPcds.slice(0, 2) },
  { requiredInputPcdPaths: good.inputPcds.map((item) => item.path) },
);
assert.strictEqual(missingRequiredPcd.accepted, false);
assert(missingRequiredPcd.blockers.includes('functional_cli_stage_required_input_pcd_missing:pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd'));

assert.strictEqual(parseFunctionalCliStageResult('no result line'), null);
assert.strictEqual(parseFunctionalCliStageResult('BRIK64_BETA17_FUNCTIONAL_CLI_STAGE_RESULT\tnot-base64-json'), null);

console.log('PASS beta17 functional CLI stage result parser');
NODE
