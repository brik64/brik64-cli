#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TMP_DIR="$(mktemp -d)"
cleanup() {
  cp "$TMP_DIR/package.json" package.json
  rm -rf evidence/beta17-fixpoint evidence/beta17-fixpoint-readiness
  if [[ -f "$TMP_DIR/release-train-dry-run-report.json" ]]; then
    mkdir -p evidence/release-train-dry-run
    cp "$TMP_DIR/release-train-dry-run-report.json" evidence/release-train-dry-run/report.json
  else
    rm -rf evidence/release-train-dry-run
  fi
  if [[ -f "$TMP_DIR/cli-l6-generation-required-report.json" ]]; then
    mkdir -p evidence/cli-l6-generation-required
    cp "$TMP_DIR/cli-l6-generation-required-report.json" evidence/cli-l6-generation-required/report.json
  else
    rm -rf evidence/cli-l6-generation-required
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

write_external_audit_report() {
  mkdir -p evidence/beta17-fixpoint/audit-artifacts
  for artifact in audit-log generated-code-quality adversarial-results public-surface-scan claim-safe-scan
  do
    echo "beta17 $artifact evidence" >"evidence/beta17-fixpoint/audit-artifacts/$artifact.json"
  done
  local audit_log_sha generated_code_sha adversarial_sha public_surface_sha claim_safe_sha
  audit_log_sha="$(shasum -a 256 evidence/beta17-fixpoint/audit-artifacts/audit-log.json | awk '{print $1}')"
  generated_code_sha="$(shasum -a 256 evidence/beta17-fixpoint/audit-artifacts/generated-code-quality.json | awk '{print $1}')"
  adversarial_sha="$(shasum -a 256 evidence/beta17-fixpoint/audit-artifacts/adversarial-results.json | awk '{print $1}')"
  public_surface_sha="$(shasum -a 256 evidence/beta17-fixpoint/audit-artifacts/public-surface-scan.json | awk '{print $1}')"
  claim_safe_sha="$(shasum -a 256 evidence/beta17-fixpoint/audit-artifacts/claim-safe-scan.json | awk '{print $1}')"
  cat >evidence/beta17-fixpoint/external_audit_report.json <<JSON
{
  "decision": "PASS_BETA17_EXTERNAL_AUDIT",
  "cleanPublicInstall": { "pass": true },
  "functionalTests": { "pass": true },
  "generatedCodeTests": { "pass": true },
  "adversarialTests": { "pass": true },
  "publicSurfaceScan": { "pass": true },
  "claimSafeScan": { "pass": true },
  "artifacts": {
    "auditLog": { "path": "evidence/beta17-fixpoint/audit-artifacts/audit-log.json", "sha256": "$audit_log_sha" },
    "generatedCodeQuality": { "path": "evidence/beta17-fixpoint/audit-artifacts/generated-code-quality.json", "sha256": "$generated_code_sha" },
    "adversarialResults": { "path": "evidence/beta17-fixpoint/audit-artifacts/adversarial-results.json", "sha256": "$adversarial_sha" },
    "publicSurfaceScan": { "path": "evidence/beta17-fixpoint/audit-artifacts/public-surface-scan.json", "sha256": "$public_surface_sha" },
    "claimSafeScan": { "path": "evidence/beta17-fixpoint/audit-artifacts/claim-safe-scan.json", "sha256": "$claim_safe_sha" }
  }
}
JSON
}

write_evidence_pack_manifest() {
  python3 - <<'PY'
import hashlib, json, pathlib
base = pathlib.Path(".")
root = base / "evidence" / "beta17-fixpoint"
files = []
for path in sorted(root.rglob("*")):
    if not path.is_file() or path.name == "evidence_pack_manifest.json":
        continue
    rel = path.relative_to(base).as_posix()
    files.append({"path": rel, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
pack = {
    "schemaVersion": "brik64.beta17_fixpoint.evidence_pack_manifest.v1",
    "version": "0.1.0-beta.17",
    "status": "TEST_FIXTURE_CLAIM_BOUNDARY_CLOSED",
    "files": files,
    "claimBoundary": {
        "publicReleaseAllowed": False,
        "definitiveFixpointAllowed": False,
        "formalN5ClaimAllowed": False,
        "universalCorrectnessClaimAllowed": False,
    },
}
pack["packSha256"] = hashlib.sha256((json.dumps({"files": files}, indent=2) + "\n").encode()).hexdigest()
(root / "evidence_pack_manifest.json").write_text(json.dumps(pack, indent=2) + "\n")
PY
}

cp package.json "$TMP_DIR/package.json"
if [[ -f evidence/release-train-dry-run/report.json ]]; then
  cp evidence/release-train-dry-run/report.json "$TMP_DIR/release-train-dry-run-report.json"
fi
if [[ -f evidence/cli-l6-generation-required/report.json ]]; then
  cp evidence/cli-l6-generation-required/report.json "$TMP_DIR/cli-l6-generation-required-report.json"
fi

node <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '0.1.0-beta.17';
fs.writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
NODE

rm -rf evidence/beta17-fixpoint evidence/beta17-fixpoint-readiness evidence/release-train-dry-run

set +e
node scripts/release-train-dry-run.js --allow-dirty >"$TMP_DIR/missing.stdout" 2>"$TMP_DIR/missing.stderr"
missing_rc=$?
set -e

if [[ "$missing_rc" -eq 0 ]]; then
  echo "beta17_release_train_missing_readiness_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="FAIL_RELEASE_TRAIN_DRY_RUN"
  and .publicationAllowed==false
  and (.failures | index("command_failed:beta17_fixpoint_readiness:1"))
  and (.failures | index("candidate_beta17_fixpoint_readiness_invalid:BLOCKED_BETA17_FIXPOINT_READINESS_GATE"))
  and ([.requiredEvidence[] | select(.id=="beta17_fixpoint_readiness") | .pass] | first)==false
' evidence/release-train-dry-run/report.json >/dev/null

mkdir -p evidence/beta17-fixpoint
cat >evidence/beta17-fixpoint/canonical_motor_manifest.json <<'JSON'
{ "pcdBound": true }
JSON
cat >evidence/beta17-fixpoint/canonical_harness_manifest.json <<'JSON'
{ "pcdBound": true }
JSON
stage1_contract_sha="$(shasum -a 256 pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd | awk '{print $1}')"
stage2_contract_sha="$(shasum -a 256 pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd | awk '{print $1}')"
{
  printf 'pcd/beta17/release/fixpoint_stage1_materialization_contract.pcd\t%s\n' "$stage1_contract_sha"
  printf 'pcd/beta17/release/fixpoint_stage2_regeneration_contract.pcd\t%s\n' "$stage2_contract_sha"
} >evidence/beta17-fixpoint/input_pcd_hashes.tsv
cat >evidence/beta17-fixpoint/stage1_artifact_manifest.json <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByL6PlusN5": true }
JSON
cat >evidence/beta17-fixpoint/stage2_regeneration_manifest.json <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByStage1": true }
JSON
mkdir -p evidence/beta17-fixpoint/generated/stage1 evidence/beta17-fixpoint/generated/stage2
printf 'beta17 stage artifact\n' >evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs
cp evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs \
  evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs
cat >evidence/beta17-fixpoint/byte_identical_report.json <<'JSON'
{ "decision": "PASS_BYTE_IDENTICAL_REGENERATION", "byteIdentical": true }
JSON
cat >evidence/beta17-fixpoint/harness_report.json <<'JSON'
{ "decision": "PASS_BETA17_FIXPOINT_HARNESS", "adversarialCases": 3 }
JSON
cat >evidence/beta17-fixpoint/seal_report.json <<'JSON'
{ "decision": "PASS_BETA17_FIXPOINT_SEAL", "sealed": true }
JSON
cat >evidence/beta17-fixpoint/remote_promotion_manifest.json <<'JSON'
{
  "decision": "PASS_BETA17_FIXPOINT_REMOTE_RESULT_PROMOTION",
  "claimBoundary": {
    "definitiveFixpointAllowed": false,
    "publicReleaseAllowed": false,
    "formalN5ClaimAllowed": false,
    "universalCorrectnessClaimAllowed": false
  },
  "promoted": {
    "stage1ArtifactManifest": {
      "path": "evidence/beta17-fixpoint/stage1_artifact_manifest.json",
      "sha256": "__STAGE1_SHA__"
    },
    "stage2RegenerationManifest": {
      "path": "evidence/beta17-fixpoint/stage2_regeneration_manifest.json",
      "sha256": "__STAGE2_SHA__"
    },
    "byteIdenticalReport": {
      "path": "evidence/beta17-fixpoint/byte_identical_report.json",
      "sha256": "__BYTE_SHA__"
    },
    "harnessReport": {
      "path": "evidence/beta17-fixpoint/harness_report.json",
      "sha256": "__HARNESS_SHA__"
    },
    "sealReport": {
      "path": "evidence/beta17-fixpoint/seal_report.json",
      "sha256": "__SEAL_SHA__"
    },
    "stage1Artifact": {
      "path": "evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs",
      "sha256": "__STAGE1_ARTIFACT_SHA__"
    },
    "stage2Artifact": {
      "path": "evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs",
      "sha256": "__STAGE2_ARTIFACT_SHA__"
    }
  }
}
JSON
python3 - evidence/beta17-fixpoint <<'PY'
import hashlib, pathlib, sys
root = pathlib.Path(sys.argv[1])
manifest = root / "remote_promotion_manifest.json"
text = manifest.read_text()
for token, filename in {
    "__STAGE1_SHA__": "stage1_artifact_manifest.json",
    "__STAGE2_SHA__": "stage2_regeneration_manifest.json",
    "__BYTE_SHA__": "byte_identical_report.json",
    "__HARNESS_SHA__": "harness_report.json",
    "__SEAL_SHA__": "seal_report.json",
    "__STAGE1_ARTIFACT_SHA__": "generated/stage1/brik64-cli-stage1.mjs",
    "__STAGE2_ARTIFACT_SHA__": "generated/stage2/brik64-cli-stage2.mjs",
}.items():
    text = text.replace(token, hashlib.sha256((root / filename).read_bytes()).hexdigest())
manifest.write_text(text)
PY
cat >evidence/beta17-fixpoint/public_surface_sync_report.json <<'JSON'
{ "decision": "PASS_BETA17_PUBLIC_SURFACE_SYNC", "synced": true }
JSON
write_external_audit_report
write_evidence_pack_manifest

node scripts/release-train-dry-run.js --allow-dirty >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"

jq -e '
  .decision=="PASS_RELEASE_TRAIN_DRY_RUN"
  and .publicationAllowed==false
  and ([.commands[] | select(.name=="beta17_fixpoint_readiness") | .rc] | first)==0
  and ([.requiredEvidence[] | select(.id=="beta17_fixpoint_readiness") | .pass] | first)==true
' evidence/release-train-dry-run/report.json >/dev/null

echo "PASS beta17 release train readiness regression"
