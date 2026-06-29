#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK_BASE="$(mktemp -d)"
TMP_DIR="$WORK_BASE/main"
mkdir -p "$TMP_DIR"
trap 'rm -rf "$WORK_BASE"' EXIT

copy_file() {
  local source="$1"
  local dest="$TMP_DIR/$source"
  mkdir -p "$(dirname "$dest")"
  cp "$ROOT/$source" "$dest"
}

copy_file "pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd"
copy_file "pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd"
copy_file "pcd/cli_core.pcd"
copy_file "pcd/cli_polymer.pcd"
copy_file "evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs"
copy_file "evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs"

mkdir -p "$TMP_DIR/evidence/beta17-fixpoint-remote-attempt/transcripts"

FIXTURE_ROOT="$TMP_DIR" node <<'NODE'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.env.FIXTURE_ROOT;
function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
}
function bytes(file) {
  return fs.statSync(path.join(root, file)).size;
}
const inputPcds = [
  'pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd',
  'pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd',
  'pcd/cli_core.pcd',
  'pcd/cli_polymer.pcd',
].map((file) => ({ path: file, sha256: sha(file), bytes: bytes(file) }));
const stage1Path = 'evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs';
const stage2Path = 'evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs';
const stageResult = {
  schemaVersion: 'brik64.beta17_fixpoint_stage_result.v1',
  version: '0.1.0-beta.17',
  l6plusEngineSerial: 'BRIK64-L6PLUS-N5-TEST',
  generatedByL6PlusN5: true,
  stage2GeneratedByStage1: true,
  byteIdentical: true,
  harnessPass: true,
  adversarialCases: 3,
  sealReportPass: true,
  pcdInputSetSha256: crypto.createHash('sha256').update(inputPcds.map((entry) => `${entry.path}\t${entry.sha256}`).join('\n')).digest('hex'),
  stage1ArtifactSha256: sha(stage1Path),
  stage2ArtifactSha256: sha(stage2Path),
  stage1ArtifactBytes: bytes(stage1Path),
  stage2ArtifactBytes: bytes(stage2Path),
  stage1Artifact: { path: stage1Path, sha256: sha(stage1Path), bytes: bytes(stage1Path) },
  stage2Artifact: { path: stage2Path, sha256: sha(stage2Path), bytes: bytes(stage2Path) },
  inputPcds,
};
fs.writeFileSync(
  path.join(root, 'evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stage-result.json'),
  `${JSON.stringify(stageResult, null, 2)}\n`,
);
fs.mkdirSync(path.join(root, 'evidence/beta17-fixpoint'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'evidence/beta17-fixpoint/remote_promotion_manifest.json'),
  `${JSON.stringify({
    schemaVersion: 'brik64.beta17_fixpoint.remote_promotion_manifest.v1',
    version: '0.1.0-beta.17',
    decision: 'PASS_BETA17_FIXPOINT_REMOTE_RESULT_PROMOTION',
    publicationAllowed: false,
    claimBoundary: {
      definitiveFixpointAllowed: false,
      publicReleaseAllowed: false,
      formalN5ClaimAllowed: false,
      universalCorrectnessClaimAllowed: false,
    },
    promoted: {
      byteIdenticalReport: { path: 'evidence/beta17-fixpoint/byte_identical_report.json', sha256: '0'.repeat(64), bytes: 1 },
      sealReport: { path: 'evidence/beta17-fixpoint/seal_report.json', sha256: '1'.repeat(64), bytes: 1 },
    },
  }, null, 2)}\n`,
);
NODE

OUTPUT="$(BRIK64_CLI_ROOT="$TMP_DIR" node "$ROOT/scripts/beta17-fixpoint-readiness-evidence-refresh.js")"
printf '%s\n' "$OUTPUT" | grep -q 'decision=PASS_BETA17_FIXPOINT_READINESS_EVIDENCE_REFRESH'

FIXTURE_ROOT="$TMP_DIR" node <<'NODE'
const fs = require('fs');
const path = require('path');
const root = process.env.FIXTURE_ROOT;
function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), 'utf8'));
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
for (const ref of [
  'evidence/beta17-fixpoint/canonical_motor_manifest.json',
  'evidence/beta17-fixpoint/canonical_harness_manifest.json',
  'evidence/beta17-fixpoint/input_pcd_hashes.tsv',
  'evidence/beta17-fixpoint/evidence_pack_manifest.json',
  'evidence/beta17-fixpoint/public_surface_sync_report.json',
  'evidence/beta17-fixpoint/external_audit_report.json',
  'evidence/beta17-fixpoint/readiness_evidence_refresh_report.json',
]) {
  assert(fs.existsSync(path.join(root, ref)), `missing ${ref}`);
}
assert(readJson('evidence/beta17-fixpoint/canonical_motor_manifest.json').pcdBound === true, 'motor manifest must be pcd-bound');
assert(readJson('evidence/beta17-fixpoint/canonical_harness_manifest.json').pcdBound === true, 'harness manifest must be pcd-bound');
const publicSync = readJson('evidence/beta17-fixpoint/public_surface_sync_report.json');
assert(publicSync.decision === 'BLOCKED_BETA17_PUBLIC_SURFACE_SYNC', 'public sync must stay blocked');
assert(publicSync.synced === false, 'public sync must not be marked synced');
const externalAudit = readJson('evidence/beta17-fixpoint/external_audit_report.json');
assert(externalAudit.decision === 'BLOCKED_BETA17_EXTERNAL_AUDIT', 'external audit must stay blocked');
assert(externalAudit.pass === false, 'external audit must not pass');
assert(externalAudit.claimBoundary.publicReleaseAllowed === false, 'external audit must close public release boundary');
const byteIdentity = readJson('evidence/beta17-fixpoint/byte_identical_report.json');
assert(byteIdentity.stage1ArtifactSha256 && byteIdentity.stage2ArtifactSha256, 'byte identity must bind artifact sha fields');
assert(byteIdentity.stage1ArtifactBytes > 0 && byteIdentity.stage2ArtifactBytes > 0, 'byte identity must bind artifact byte fields');
const seal = readJson('evidence/beta17-fixpoint/seal_report.json');
assert(seal.stage1ArtifactSha256 && seal.stage2ArtifactSha256, 'seal must bind artifact sha fields');
assert(seal.inputPcdSetSha256 && seal.pcdInputSetSha256, 'seal must bind input hash fields');
const pack = readJson('evidence/beta17-fixpoint/evidence_pack_manifest.json');
const refs = new Set(pack.files.map((entry) => entry.path));
assert(refs.has('evidence/beta17-fixpoint/canonical_motor_manifest.json'), 'pack must include motor manifest');
assert(refs.has('evidence/beta17-fixpoint/canonical_harness_manifest.json'), 'pack must include harness manifest');
assert(refs.has('evidence/beta17-fixpoint/readiness_evidence_refresh_report.json'), 'pack must include refresh report');
const remotePromotion = readJson('evidence/beta17-fixpoint/remote_promotion_manifest.json');
assert(remotePromotion.promoted.byteIdenticalReport.sha256 === byteIdentity.stage1Artifact.sha256 || remotePromotion.promoted.byteIdenticalReport.sha256.length === 64, 'remote promotion byte report ref must be refreshed');
assert(remotePromotion.promoted.byteIdenticalReport.sha256 !== '0'.repeat(64), 'remote promotion byte report must not keep stale hash');
assert(remotePromotion.promoted.sealReport.sha256 !== '1'.repeat(64), 'remote promotion seal report must not keep stale hash');
NODE

# Break attempt 1: missing stage result fails closed.
MISSING_STAGE="$WORK_BASE/missing-stage"
mkdir -p "$MISSING_STAGE"
if BRIK64_CLI_ROOT="$MISSING_STAGE" node "$ROOT/scripts/beta17-fixpoint-readiness-evidence-refresh.js" >"$TMP_DIR/missing.out" 2>"$TMP_DIR/missing.err"; then
  echo "expected missing stage result to fail" >&2
  exit 1
fi
grep -q 'missing_stage_result' "$TMP_DIR/missing.err"

# Break attempt 2: stage result without input PCDs fails closed.
EMPTY_INPUTS="$WORK_BASE/empty-inputs"
cp -R "$TMP_DIR" "$EMPTY_INPUTS"
FIXTURE_ROOT="$EMPTY_INPUTS" node <<'NODE'
const fs = require('fs');
const path = require('path');
const file = path.join(process.env.FIXTURE_ROOT, 'evidence/beta17-fixpoint-remote-attempt/transcripts/attempt-1.stage-result.json');
const value = JSON.parse(fs.readFileSync(file, 'utf8'));
value.inputPcds = [];
fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
NODE
if BRIK64_CLI_ROOT="$EMPTY_INPUTS" node "$ROOT/scripts/beta17-fixpoint-readiness-evidence-refresh.js" >"$TMP_DIR/empty.out" 2>"$TMP_DIR/empty.err"; then
  echo "expected empty input PCD list to fail" >&2
  exit 1
fi
grep -q 'stage_result_input_pcds_missing' "$TMP_DIR/empty.err"

# Break attempt 3: input PCD drift fails closed.
DRIFT="$WORK_BASE/drift"
cp -R "$TMP_DIR" "$DRIFT"
printf '\n// tamper\n' >> "$DRIFT/pcd/cli_core.pcd"
if BRIK64_CLI_ROOT="$DRIFT" node "$ROOT/scripts/beta17-fixpoint-readiness-evidence-refresh.js" >"$TMP_DIR/drift.out" 2>"$TMP_DIR/drift.err"; then
  echo "expected input PCD hash drift to fail" >&2
  exit 1
fi
grep -q 'input_pcd_sha256_mismatch:pcd/cli_core.pcd' "$TMP_DIR/drift.err"

echo "PASS test_beta17_fixpoint_readiness_evidence_refresh"
