#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

FIXTURE="$TMP_DIR/fixture"
mkdir -p "$FIXTURE/evidence/beta17-fixpoint" "$FIXTURE/release"

write_external_audit_report() {
  local base="$1"
  mkdir -p "$base/evidence/beta17-fixpoint/audit-artifacts"
  for artifact in audit-log generated-code-quality adversarial-results public-surface-scan claim-safe-scan
  do
    echo "beta17 $artifact evidence" >"$base/evidence/beta17-fixpoint/audit-artifacts/$artifact.json"
  done
  local audit_log_sha generated_code_sha adversarial_sha public_surface_sha claim_safe_sha
  audit_log_sha="$(shasum -a 256 "$base/evidence/beta17-fixpoint/audit-artifacts/audit-log.json" | awk '{print $1}')"
  generated_code_sha="$(shasum -a 256 "$base/evidence/beta17-fixpoint/audit-artifacts/generated-code-quality.json" | awk '{print $1}')"
  adversarial_sha="$(shasum -a 256 "$base/evidence/beta17-fixpoint/audit-artifacts/adversarial-results.json" | awk '{print $1}')"
  public_surface_sha="$(shasum -a 256 "$base/evidence/beta17-fixpoint/audit-artifacts/public-surface-scan.json" | awk '{print $1}')"
  claim_safe_sha="$(shasum -a 256 "$base/evidence/beta17-fixpoint/audit-artifacts/claim-safe-scan.json" | awk '{print $1}')"
  cat >"$base/evidence/beta17-fixpoint/external_audit_report.json" <<JSON
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
  local base="$1"
  python3 - "$base" <<'PY'
import hashlib, json, pathlib, sys
base = pathlib.Path(sys.argv[1])
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

cat >"$FIXTURE/package.json" <<'JSON'
{
  "name": "@brik64/cli",
  "version": "0.1.0-beta.17"
}
JSON

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/missing.stdout" 2>"$TMP_DIR/missing.stderr"
missing_rc=$?
set -e

if [[ "$missing_rc" -eq 0 ]]; then
  echo "missing_evidence_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and .claimBoundary.definitiveFixpointAllowed==false
  and .claimBoundary.publicReleaseAllowed==false
  and (.blockers | index("missing_canonical_motor_manifest:evidence/beta17-fixpoint/canonical_motor_manifest.json"))
  and (.blockers | index("missing_stage2_regeneration_manifest:evidence/beta17-fixpoint/stage2_regeneration_manifest.json"))
  and (.blockers | index("missing_remote_promotion_manifest:evidence/beta17-fixpoint/remote_promotion_manifest.json"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

cat >"$FIXTURE/evidence/beta17-fixpoint/canonical_motor_manifest.json" <<'JSON'
{ "pcdBound": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/canonical_harness_manifest.json" <<'JSON'
{ "pcdBound": true }
JSON
mkdir -p "$FIXTURE/pcd/beta17"
cat >"$FIXTURE/pcd/beta17/motor.pcd" <<'PCD'
PC beta17_motor { fn run() -> i64 { return 17; } }
PCD
cat >"$FIXTURE/pcd/beta17/harness.pcd" <<'PCD'
PC beta17_harness { fn run() -> i64 { return 1; } }
PCD
motor_pcd_sha="$(shasum -a 256 "$FIXTURE/pcd/beta17/motor.pcd" | awk '{print $1}')"
harness_pcd_sha="$(shasum -a 256 "$FIXTURE/pcd/beta17/harness.pcd" | awk '{print $1}')"
cat >"$FIXTURE/evidence/beta17-fixpoint/input_pcd_hashes.tsv" <<'EOF_HASHES'
EOF_HASHES
{
  printf 'pcd/beta17/motor.pcd\t%s\n' "$motor_pcd_sha"
  printf 'pcd/beta17/harness.pcd\t%s\n' "$harness_pcd_sha"
} >>"$FIXTURE/evidence/beta17-fixpoint/input_pcd_hashes.tsv"
cat >"$FIXTURE/evidence/beta17-fixpoint/stage1_artifact_manifest.json" <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByL6PlusN5": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/stage2_regeneration_manifest.json" <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByStage1": true }
JSON
mkdir -p "$FIXTURE/evidence/beta17-fixpoint/generated/stage1" "$FIXTURE/evidence/beta17-fixpoint/generated/stage2"
printf 'beta17 stage artifact\n' >"$FIXTURE/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs"
cp "$FIXTURE/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs" \
  "$FIXTURE/evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs"
stage1_artifact_sha="$(shasum -a 256 "$FIXTURE/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs" | awk '{print $1}')"
stage2_artifact_sha="$(shasum -a 256 "$FIXTURE/evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs" | awk '{print $1}')"
stage1_artifact_bytes="$(wc -c <"$FIXTURE/evidence/beta17-fixpoint/generated/stage1/brik64-cli-stage1.mjs" | tr -d ' ')"
stage2_artifact_bytes="$(wc -c <"$FIXTURE/evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs" | tr -d ' ')"
cat >"$FIXTURE/evidence/beta17-fixpoint/stage1_artifact_manifest.json" <<JSON
{
  "version": "0.1.0-beta.17",
  "generatedByL6PlusN5": true,
  "stage1ArtifactSha256": "$stage1_artifact_sha"
}
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/stage2_regeneration_manifest.json" <<JSON
{
  "version": "0.1.0-beta.17",
  "generatedByStage1": true,
  "stage2ArtifactSha256": "$stage2_artifact_sha",
  "generatedFromStage1ArtifactSha256": "$stage1_artifact_sha"
}
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/byte_identical_report.json" <<JSON
{
  "decision": "PASS_BYTE_IDENTICAL_REGENERATION",
  "byteIdentical": true,
  "stage1ArtifactSha256": "$stage1_artifact_sha",
  "stage2ArtifactSha256": "$stage2_artifact_sha",
  "stage1ArtifactBytes": $stage1_artifact_bytes,
  "stage2ArtifactBytes": $stage2_artifact_bytes
}
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/harness_report.json" <<'JSON'
{ "decision": "PASS_BETA17_FIXPOINT_HARNESS", "adversarialCases": 3 }
JSON
input_pcd_set_sha="$(shasum -a 256 "$FIXTURE/evidence/beta17-fixpoint/input_pcd_hashes.tsv" | awk '{print $1}')"
cat >"$FIXTURE/evidence/beta17-fixpoint/seal_report.json" <<JSON
{
  "decision": "PASS_BETA17_FIXPOINT_SEAL",
  "sealed": true,
  "stage1ArtifactSha256": "$stage1_artifact_sha",
  "stage2ArtifactSha256": "$stage2_artifact_sha",
  "inputPcdSetSha256": "$input_pcd_set_sha"
}
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/remote_promotion_manifest.json" <<'JSON'
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
python3 - "$FIXTURE/evidence/beta17-fixpoint" <<'PY'
import hashlib, json, pathlib, sys
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
    digest = hashlib.sha256((root / filename).read_bytes()).hexdigest()
    text = text.replace(token, digest)
data = json.loads(text)
for key in ("stage1Artifact", "stage2Artifact"):
    ref = data["promoted"][key]
    source_path = ref["path"].replace("evidence/beta17-fixpoint/", "evidence/beta17-source/")
    ref["source"] = {
        "path": source_path,
        "sha256": ref["sha256"],
    }
    ref["target"] = {
        "path": ref["path"],
        "sha256": ref["sha256"],
        "bytes": (root.parent.parent / ref["path"]).stat().st_size,
    }
manifest.write_text(json.dumps(data, indent=2) + "\n")
PY
cat >"$FIXTURE/evidence/beta17-fixpoint/public_surface_sync_report.json" <<'JSON'
{
  "decision": "PASS_BETA17_PUBLIC_SURFACE_SYNC",
  "synced": true,
  "surfaceChecks": [
    { "id": "cli_installer", "version": "0.1.0-beta.17", "pass": true },
    { "id": "cli_manifest", "version": "0.1.0-beta.17", "pass": true },
    { "id": "docs", "version": "0.1.0-beta.17", "pass": true },
    { "id": "web_changelog", "version": "0.1.0-beta.17", "pass": true },
    { "id": "skills", "version": "0.1.0-beta.17", "pass": true }
  ]
}
JSON
write_external_audit_report "$FIXTURE"
write_evidence_pack_manifest "$FIXTURE"

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"

jq -e '
  .decision=="PASS_BETA17_FIXPOINT_READINESS_GATE"
  and .claimBoundary.definitiveFixpointAllowed==true
  and .claimBoundary.publicReleaseAllowed==true
  and .claimBoundary.formalN5ClaimAllowed==false
  and .checks.byteIdentical==true
  and .checks.byteIdentityBindsStage1Artifact==true
  and .checks.byteIdentityBindsStage2Artifact==true
  and .checks.byteIdentityStageSizesMatch==true
  and .checks.stage1ManifestBindsArtifact==true
  and .checks.stage2ManifestBindsArtifact==true
  and .checks.stage2ManifestBindsStage1Artifact==true
  and .checks.harnessHasAdversarial==true
  and .checks.remotePromotionPass==true
  and .checks.remotePromotionClaimsClosed==true
  and (.blockers | length)==0
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint/byte_identical_report.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
data["stage2ArtifactSha256"] = "0" * 64
json.dump(data, open(path, "w"), indent=2)
PY
write_evidence_pack_manifest "$FIXTURE"

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/byte-mismatch.stdout" 2>"$TMP_DIR/byte-mismatch.stderr"
byte_mismatch_rc=$?
set -e

if [[ "$byte_mismatch_rc" -eq 0 ]]; then
  echo "byte_identity_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("byte_identity_stage2_artifact_sha256_mismatch"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

cat >"$FIXTURE/evidence/beta17-fixpoint/byte_identical_report.json" <<JSON
{
  "decision": "PASS_BYTE_IDENTICAL_REGENERATION",
  "byteIdentical": true,
  "stage1ArtifactSha256": "$stage1_artifact_sha",
  "stage2ArtifactSha256": "$stage2_artifact_sha",
  "stage1ArtifactBytes": $stage1_artifact_bytes,
  "stage2ArtifactBytes": $stage2_artifact_bytes
}
JSON
write_evidence_pack_manifest "$FIXTURE"

python3 - "$FIXTURE/evidence/beta17-fixpoint/stage2_regeneration_manifest.json" "$FIXTURE/evidence/beta17-fixpoint/remote_promotion_manifest.json" <<'PY'
import hashlib, json, pathlib, sys
stage2_path = pathlib.Path(sys.argv[1])
promotion_path = pathlib.Path(sys.argv[2])
stage2 = json.load(open(stage2_path))
stage2["generatedFromStage1ArtifactSha256"] = "0" * 64
json.dump(stage2, open(stage2_path, "w"), indent=2)
promotion = json.load(open(promotion_path))
promotion["promoted"]["stage2RegenerationManifest"]["sha256"] = hashlib.sha256(stage2_path.read_bytes()).hexdigest()
json.dump(promotion, open(promotion_path, "w"), indent=2)
PY
write_evidence_pack_manifest "$FIXTURE"

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/stage2-from-stage1-mismatch.stdout" 2>"$TMP_DIR/stage2-from-stage1-mismatch.stderr"
stage2_from_stage1_mismatch_rc=$?
set -e

if [[ "$stage2_from_stage1_mismatch_rc" -eq 0 ]]; then
  echo "stage2_from_stage1_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("stage2_manifest_stage1_artifact_sha256_mismatch"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

cat >"$FIXTURE/evidence/beta17-fixpoint/stage2_regeneration_manifest.json" <<JSON
{
  "version": "0.1.0-beta.17",
  "generatedByStage1": true,
  "stage2ArtifactSha256": "$stage2_artifact_sha",
  "generatedFromStage1ArtifactSha256": "$stage1_artifact_sha"
}
JSON
python3 - "$FIXTURE/evidence/beta17-fixpoint/stage2_regeneration_manifest.json" "$FIXTURE/evidence/beta17-fixpoint/remote_promotion_manifest.json" <<'PY'
import hashlib, json, pathlib, sys
stage2_path = pathlib.Path(sys.argv[1])
promotion_path = pathlib.Path(sys.argv[2])
promotion = json.load(open(promotion_path))
promotion["promoted"]["stage2RegenerationManifest"]["sha256"] = hashlib.sha256(stage2_path.read_bytes()).hexdigest()
json.dump(promotion, open(promotion_path, "w"), indent=2)
PY
write_evidence_pack_manifest "$FIXTURE"

python3 - "$FIXTURE/evidence/beta17-fixpoint/public_surface_sync_report.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
for entry in data["surfaceChecks"]:
    if entry["id"] == "docs":
        entry["version"] = "0.1.0-beta.16.1"
json.dump(data, open(path, "w"), indent=2)
PY
write_evidence_pack_manifest "$FIXTURE"

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/public-sync-mismatch.stdout" 2>"$TMP_DIR/public-sync-mismatch.stderr"
public_sync_mismatch_rc=$?
set -e

if [[ "$public_sync_mismatch_rc" -eq 0 ]]; then
  echo "public_sync_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("public_surface_sync_version_mismatch:docs:0.1.0-beta.16.1"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint/public_surface_sync_report.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
for entry in data["surfaceChecks"]:
    if entry["id"] == "docs":
        entry["version"] = "0.1.0-beta.17"
json.dump(data, open(path, "w"), indent=2)
PY
write_evidence_pack_manifest "$FIXTURE"

python3 - "$FIXTURE/evidence/beta17-fixpoint/evidence_pack_manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
data["packSha256"] = "0" * 64
json.dump(data, open(path, "w"), indent=2)
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/pack-digest-mismatch.stdout" 2>"$TMP_DIR/pack-digest-mismatch.stderr"
pack_digest_mismatch_rc=$?
set -e

if [[ "$pack_digest_mismatch_rc" -eq 0 ]]; then
  echo "pack_digest_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("evidence_pack_manifest_pack_sha256_mismatch"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

write_evidence_pack_manifest "$FIXTURE"

python3 - "$FIXTURE/evidence/beta17-fixpoint/seal_report.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
data["stage2ArtifactSha256"] = "0" * 64
json.dump(data, open(path, "w"), indent=2)
PY
write_evidence_pack_manifest "$FIXTURE"

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/seal-mismatch.stdout" 2>"$TMP_DIR/seal-mismatch.stderr"
seal_mismatch_rc=$?
set -e

if [[ "$seal_mismatch_rc" -eq 0 ]]; then
  echo "seal_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("seal_stage2_artifact_sha256_mismatch"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
seal = root / "seal_report.json"
data = json.load(open(seal))
data["stage2ArtifactSha256"] = hashlib.sha256((root / "generated/stage2/brik64-cli-stage2.mjs").read_bytes()).hexdigest()
json.dump(data, open(seal, "w"), indent=2)
PY
write_evidence_pack_manifest "$FIXTURE"

python3 - "$FIXTURE/evidence/beta17-fixpoint/evidence_pack_manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
for entry in data["files"]:
    if entry["path"] == "evidence/beta17-fixpoint/stage1_artifact_manifest.json":
        entry["sha256"] = "0" * 64
json.dump(data, open(path, "w"), indent=2)
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/pack-sha-mismatch.stdout" 2>"$TMP_DIR/pack-sha-mismatch.stderr"
pack_sha_mismatch_rc=$?
set -e

if [[ "$pack_sha_mismatch_rc" -eq 0 ]]; then
  echo "pack_sha_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("evidence_pack_manifest_sha256_mismatch:evidence/beta17-fixpoint/stage1_artifact_manifest.json"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

write_evidence_pack_manifest "$FIXTURE"

python3 - "$FIXTURE/evidence/beta17-fixpoint/evidence_pack_manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
data["files"] = [
    entry for entry in data["files"]
    if entry["path"] != "evidence/beta17-fixpoint/external_audit_report.json"
]
json.dump(data, open(path, "w"), indent=2)
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/pack-missing-ref.stdout" 2>"$TMP_DIR/pack-missing-ref.stderr"
pack_missing_ref_rc=$?
set -e

if [[ "$pack_missing_ref_rc" -eq 0 ]]; then
  echo "pack_missing_ref_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("evidence_pack_manifest_missing_ref:evidence/beta17-fixpoint/external_audit_report.json"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

write_evidence_pack_manifest "$FIXTURE"

python3 - "$FIXTURE/evidence/beta17-fixpoint/remote_promotion_manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
data["promoted"]["stage2Artifact"]["sha256"] = "0" * 64
json.dump(data, open(path, "w"), indent=2)
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/artifact-mismatch.stdout" 2>"$TMP_DIR/artifact-mismatch.stderr"
artifact_mismatch_rc=$?
set -e

if [[ "$artifact_mismatch_rc" -eq 0 ]]; then
  echo "artifact_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("remote_promotion_ref_file_sha256_mismatch:stage2Artifact:evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
manifest = root / "remote_promotion_manifest.json"
data = json.load(open(manifest))
data["promoted"]["stage2Artifact"]["sha256"] = hashlib.sha256((root / "generated/stage2/brik64-cli-stage2.mjs").read_bytes()).hexdigest()
json.dump(data, open(manifest, "w"), indent=2)
PY
write_evidence_pack_manifest "$FIXTURE"

python3 - "$FIXTURE/evidence/beta17-fixpoint/remote_promotion_manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
data["promoted"]["stage2Artifact"].pop("target", None)
json.dump(data, open(path, "w"), indent=2)
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/promoted-target-missing.stdout" 2>"$TMP_DIR/promoted-target-missing.stderr"
promoted_target_missing_rc=$?
set -e

if [[ "$promoted_target_missing_rc" -eq 0 ]]; then
  echo "promoted_target_missing_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("remote_promotion_missing_target_ref:stage2Artifact"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
manifest = root / "remote_promotion_manifest.json"
data = json.load(open(manifest))
stage2 = root / "generated/stage2/brik64-cli-stage2.mjs"
data["promoted"]["stage2Artifact"]["target"] = {
    "path": "evidence/beta17-fixpoint/generated/stage2/brik64-cli-stage2.mjs",
    "sha256": hashlib.sha256(stage2.read_bytes()).hexdigest(),
    "bytes": stage2.stat().st_size,
}
json.dump(data, open(manifest, "w"), indent=2)
PY
write_evidence_pack_manifest "$FIXTURE"

python3 - "$FIXTURE/evidence/beta17-fixpoint/remote_promotion_manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
data["promoted"]["stage2Artifact"].pop("source", None)
json.dump(data, open(path, "w"), indent=2)
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/promoted-source-missing.stdout" 2>"$TMP_DIR/promoted-source-missing.stderr"
promoted_source_missing_rc=$?
set -e

if [[ "$promoted_source_missing_rc" -eq 0 ]]; then
  echo "promoted_source_missing_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("remote_promotion_missing_source_ref:stage2Artifact"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
manifest = root / "remote_promotion_manifest.json"
data = json.load(open(manifest))
stage2 = root / "generated/stage2/brik64-cli-stage2.mjs"
data["promoted"]["stage2Artifact"]["source"] = {
    "path": "evidence/beta17-source/generated/stage2/brik64-cli-stage2.mjs",
    "sha256": hashlib.sha256(stage2.read_bytes()).hexdigest(),
}
json.dump(data, open(manifest, "w"), indent=2)
PY
write_evidence_pack_manifest "$FIXTURE"

cat >"$FIXTURE/evidence/beta17-fixpoint/input_pcd_hashes.tsv" <<'EOF_HASHES'
pcd/beta17/motor.pcd	0000000000000000000000000000000000000000000000000000000000000000
EOF_HASHES
write_evidence_pack_manifest "$FIXTURE"

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/input-pcd-mismatch.stdout" 2>"$TMP_DIR/input-pcd-mismatch.stderr"
input_pcd_mismatch_rc=$?
set -e

if [[ "$input_pcd_mismatch_rc" -eq 0 ]]; then
  echo "input_pcd_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("input_pcd_hashes_sha256_mismatch:pcd/beta17/motor.pcd"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

{
  printf 'pcd/beta17/motor.pcd\t%s\n' "$motor_pcd_sha"
  printf 'pcd/beta17/harness.pcd\t%s\n' "$harness_pcd_sha"
} >"$FIXTURE/evidence/beta17-fixpoint/input_pcd_hashes.tsv"
write_evidence_pack_manifest "$FIXTURE"

python3 - "$FIXTURE/evidence/beta17-fixpoint/remote_promotion_manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
data["promoted"]["stage1ArtifactManifest"]["sha256"] = "0" * 64
json.dump(data, open(path, "w"), indent=2)
PY

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/promotion-mismatch.stdout" 2>"$TMP_DIR/promotion-mismatch.stderr"
promotion_mismatch_rc=$?
set -e

if [[ "$promotion_mismatch_rc" -eq 0 ]]; then
  echo "promotion_mismatch_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("remote_promotion_ref_sha256_mismatch:stage1ArtifactManifest"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

python3 - "$FIXTURE/evidence/beta17-fixpoint" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
manifest = root / "remote_promotion_manifest.json"
data = json.load(open(manifest))
data["promoted"]["stage1ArtifactManifest"]["sha256"] = hashlib.sha256((root / "stage1_artifact_manifest.json").read_bytes()).hexdigest()
json.dump(data, open(manifest, "w"), indent=2)
PY
write_evidence_pack_manifest "$FIXTURE"

cat >"$FIXTURE/evidence/beta17-fixpoint/external_audit_report.json" <<'JSON'
{ "decision": "PASS_BETA17_EXTERNAL_AUDIT", "pass": true }
JSON

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/weak-external-audit.stdout" 2>"$TMP_DIR/weak-external-audit.stderr"
weak_external_audit_rc=$?
set -e

if [[ "$weak_external_audit_rc" -eq 0 ]]; then
  echo "weak_external_audit_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("external_audit_missing_clean_public_install"))
  and (.blockers | index("external_audit_missing_functional_tests"))
  and (.blockers | index("external_audit_missing_generated_code_tests"))
  and (.blockers | index("external_audit_missing_adversarial_tests"))
  and (.blockers | index("external_audit_missing_public_surface_scan"))
  and (.blockers | index("external_audit_missing_claim_safe_scan"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

write_external_audit_report "$FIXTURE"
write_evidence_pack_manifest "$FIXTURE"

cat >"$FIXTURE/evidence/beta17-fixpoint/stage1_artifact_manifest.json" <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByL6PlusN5": true, "fixtureMaterializer": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/stage2_regeneration_manifest.json" <<'JSON'
{ "version": "0.1.0-beta.17", "generatedByStage1": true, "fixtureMaterializer": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/byte_identical_report.json" <<'JSON'
{ "decision": "PASS_BYTE_IDENTICAL_REGENERATION", "byteIdentical": true, "fixtureMaterializer": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/harness_report.json" <<'JSON'
{ "decision": "PASS_BETA17_FIXPOINT_HARNESS", "adversarialCases": 3, "fixtureMaterializer": true }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/seal_report.json" <<'JSON'
{ "decision": "PASS_BETA17_FIXPOINT_SEAL", "sealed": true, "fixtureMaterializer": true }
JSON

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  >"$TMP_DIR/fixture.stdout" 2>"$TMP_DIR/fixture.stderr"
fixture_rc=$?
set -e

if [[ "$fixture_rc" -eq 0 ]]; then
  echo "fixture_evidence_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("stage1_fixture_materializer_not_claim_bearing"))
  and (.blockers | index("stage2_fixture_materializer_not_claim_bearing"))
  and (.blockers | index("byte_identity_fixture_materializer_not_claim_bearing"))
  and (.blockers | index("harness_fixture_materializer_not_claim_bearing"))
  and (.blockers | index("seal_fixture_materializer_not_claim_bearing"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

cat >"$FIXTURE/evidence/beta17-fixpoint/stage1_artifact_manifest.json" <<JSON
{
  "version": "0.1.0-beta.17",
  "generatedByL6PlusN5": true,
  "stage1ArtifactSha256": "$stage1_artifact_sha"
}
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/stage2_regeneration_manifest.json" <<JSON
{
  "version": "0.1.0-beta.17",
  "generatedByStage1": true,
  "stage2ArtifactSha256": "$stage2_artifact_sha",
  "generatedFromStage1ArtifactSha256": "$stage1_artifact_sha"
}
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/byte_identical_report.json" <<JSON
{
  "decision": "PASS_BYTE_IDENTICAL_REGENERATION",
  "byteIdentical": true,
  "stage1ArtifactSha256": "$stage1_artifact_sha",
  "stage2ArtifactSha256": "$stage2_artifact_sha",
  "stage1ArtifactBytes": $stage1_artifact_bytes,
  "stage2ArtifactBytes": $stage2_artifact_bytes
}
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/harness_report.json" <<'JSON'
{ "decision": "PASS_BETA17_FIXPOINT_HARNESS", "adversarialCases": 3 }
JSON
cat >"$FIXTURE/evidence/beta17-fixpoint/seal_report.json" <<JSON
{
  "decision": "PASS_BETA17_FIXPOINT_SEAL",
  "sealed": true,
  "stage1ArtifactSha256": "$stage1_artifact_sha",
  "stage2ArtifactSha256": "$stage2_artifact_sha",
  "inputPcdSetSha256": "$input_pcd_set_sha"
}
JSON

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-readiness-gate.js" \
  --version 0.1.0-beta.16.1 >"$TMP_DIR/wrong-version.stdout" 2>"$TMP_DIR/wrong-version.stderr"
wrong_version_rc=$?
set -e

if [[ "$wrong_version_rc" -eq 0 ]]; then
  echo "wrong_version_unexpected_pass" >&2
  exit 1
fi

jq -e '
  .decision=="BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
  and (.blockers | index("beta17_version_context_required:0.1.0-beta.16.1"))
' "$FIXTURE/evidence/beta17-fixpoint-readiness/report.json" >/dev/null

echo "PASS beta17 fixpoint readiness gate"
