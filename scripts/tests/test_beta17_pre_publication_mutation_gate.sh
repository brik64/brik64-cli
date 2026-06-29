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
  local state="${2:-public}"
  mkdir -p "$dir/release" "$dir/evidence/beta17-package" \
    "$dir/evidence/beta17-fixpoint" \
    "$dir/evidence/beta17-fixpoint-required-inputs"

  printf "beta17 package" >"$dir/evidence/beta17-package/brik64-cli-0.1.0-beta.17.tgz"
  local package_sha
  package_sha="$(sha256_file "$dir/evidence/beta17-package/brik64-cli-0.1.0-beta.17.tgz")"
  local package_bytes
  package_bytes="$(wc -c <"$dir/evidence/beta17-package/brik64-cli-0.1.0-beta.17.tgz" | tr -d ' ')"

  cat >"$dir/package.json" <<'JSON'
{ "name": "@brik64/cli", "version": "0.1.0-beta.17" }
JSON

  cat >"$dir/release/manifest.json" <<JSON
{
  "schemaVersion": "brik64.release_manifest.v1",
  "releaseId": "brik64-0.1.0-beta.17",
  "version": "0.1.0-beta.17",
  "channel": "beta",
  "state": "$state",
  "cli": {
    "package": {
      "path": "evidence/beta17-package/brik64-cli-0.1.0-beta.17.tgz",
      "sha256": "$package_sha",
      "bytes": $package_bytes
    }
  },
  "claimBoundary": {
    "publicClaimsAllowed": false,
    "formalN5ClaimAllowed": false,
    "fixpointClaimAllowed": false,
    "selfHostingClaimAllowed": false,
    "rustIndependenceClaimAllowed": false
  }
}
JSON

  cat >"$dir/evidence/beta17-package/package.manifest.json" <<JSON
{
  "schemaVersion": "brik64.cli_beta17_package_manifest.v1",
  "version": "0.1.0-beta.17",
  "decision": "PASS_BRIK64_CLI_BETA17_PACKAGE_CANDIDATE_BUILT",
  "releaseEligible": true,
  "publicationAllowed": false,
  "package": {
    "path": "evidence/beta17-package/brik64-cli-0.1.0-beta.17.tgz",
    "sha256": "$package_sha",
    "bytes": $package_bytes
  },
  "claimBoundary": {
    "publicReleaseAllowed": false,
    "publicClaimsAllowed": false,
    "l6MaterializationClaimAllowed": true,
    "formalN5ClaimAllowed": false,
    "fixpointClaimAllowed": false,
    "selfHostingClaimAllowed": false,
    "rustIndependenceClaimAllowed": false
  }
}
JSON

  cat >"$dir/evidence/beta17-fixpoint-required-inputs/report.json" <<'JSON'
{
  "schemaVersion": "brik64.beta17_fixpoint.required_inputs_report.v1",
  "version": "0.1.0-beta.17",
  "decision": "PASS_BETA17_FIXPOINT_REQUIRED_INPUTS",
  "publicationAllowed": false,
  "blockers": [],
  "claimBoundary": {
    "publicReleaseAllowed": false,
    "definitiveFixpointAllowed": false,
    "formalN5ClaimAllowed": false,
    "universalCorrectnessClaimAllowed": false
  }
}
JSON

  for ref in \
    canonical_motor_manifest.json \
    canonical_harness_manifest.json \
    stage1_artifact_manifest.json \
    stage2_regeneration_manifest.json \
    byte_identical_report.json \
    harness_report.json \
    seal_report.json \
    remote_promotion_manifest.json \
    evidence_pack_manifest.json; do
    cat >"$dir/evidence/beta17-fixpoint/$ref" <<JSON
{ "decision": "PASS_FIXTURE", "ref": "$ref", "version": "0.1.0-beta.17" }
JSON
  done
  cat >"$dir/evidence/beta17-fixpoint/input_pcd_hashes.tsv" <<'TSV'
sha256	path
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa	pcd/beta17/motor.pcd
TSV
}

PASS_ROOT="$TMP_DIR/pass"
write_fixture "$PASS_ROOT"
BRIK64_CLI_ROOT="$PASS_ROOT" node "$ROOT/scripts/beta17-pre-publication-mutation-gate.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"
jq -e '
  .decision=="PASS_BETA17_PRE_PUBLICATION_MUTATION_GATE"
  and .publicationMutationAllowed==true
  and .publicationAllowed==false
  and .claimBoundary.publicReleaseAllowed==false
  and (.blockers | length)==0
' "$PASS_ROOT/evidence/beta17-pre-publication-mutation-gate/report.json" >/dev/null

# Break attempt 1: candidate manifest cannot mutate public surfaces.
CANDIDATE_ROOT="$TMP_DIR/candidate"
write_fixture "$CANDIDATE_ROOT" "candidate"
if BRIK64_CLI_ROOT="$CANDIDATE_ROOT" node "$ROOT/scripts/beta17-pre-publication-mutation-gate.js" \
  >"$TMP_DIR/candidate.stdout" 2>"$TMP_DIR/candidate.stderr"; then
  echo "candidate manifest unexpectedly passed pre-publication mutation gate" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_PRE_PUBLICATION_MUTATION_GATE"
  and (.blockers | index("release_manifest_state_not_public:candidate"))
' "$CANDIDATE_ROOT/evidence/beta17-pre-publication-mutation-gate/report.json" >/dev/null

# Break attempt 2: package hash drift fails closed.
SHA_ROOT="$TMP_DIR/sha"
write_fixture "$SHA_ROOT"
printf "tampered" >"$SHA_ROOT/evidence/beta17-package/brik64-cli-0.1.0-beta.17.tgz"
if BRIK64_CLI_ROOT="$SHA_ROOT" node "$ROOT/scripts/beta17-pre-publication-mutation-gate.js" \
  >"$TMP_DIR/sha.stdout" 2>"$TMP_DIR/sha.stderr"; then
  echo "package hash drift unexpectedly passed pre-publication mutation gate" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_PRE_PUBLICATION_MUTATION_GATE"
  and (.blockers | index("cli_package_sha256_mismatch"))
  and (.blockers | index("cli_package_bytes_mismatch"))
' "$SHA_ROOT/evidence/beta17-pre-publication-mutation-gate/report.json" >/dev/null

# Break attempt 3: opening public claims before live verification fails closed.
CLAIM_ROOT="$TMP_DIR/claim"
write_fixture "$CLAIM_ROOT"
python3 - "$CLAIM_ROOT/release/manifest.json" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
data = json.loads(path.read_text())
data["claimBoundary"]["publicClaimsAllowed"] = True
path.write_text(json.dumps(data, indent=2) + "\n")
PY
if BRIK64_CLI_ROOT="$CLAIM_ROOT" node "$ROOT/scripts/beta17-pre-publication-mutation-gate.js" \
  >"$TMP_DIR/claim.stdout" 2>"$TMP_DIR/claim.stderr"; then
  echo "claim-open manifest unexpectedly passed pre-publication mutation gate" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_PRE_PUBLICATION_MUTATION_GATE"
  and (.blockers | index("manifest_public_claims_open_before_live_verify"))
' "$CLAIM_ROOT/evidence/beta17-pre-publication-mutation-gate/report.json" >/dev/null

echo "PASS beta17 pre-publication mutation gate tests"
