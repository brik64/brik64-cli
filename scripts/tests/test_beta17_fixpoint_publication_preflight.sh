#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

write_pass_fixture() {
  local dir="$1"
  local version="${2:-0.1.0-beta.17}"
  local package_text="${3:-beta17 package}"
  mkdir -p "$dir/release" "$dir/evidence/beta17-package" \
    "$dir/evidence/beta17-fixpoint" \
    "$dir/evidence/beta17-fixpoint-readiness" \
    "$dir/evidence/beta17-fixpoint-external-audit-status"

  printf "%s" "$package_text" >"$dir/evidence/beta17-package/brik64-cli-$version.tgz"
  local package_sha
  package_sha="$(sha256_file "$dir/evidence/beta17-package/brik64-cli-$version.tgz")"
  local package_bytes
  package_bytes="$(wc -c <"$dir/evidence/beta17-package/brik64-cli-$version.tgz" | tr -d ' ')"

  cat >"$dir/package.json" <<JSON
{ "name": "@brik64/cli", "version": "$version" }
JSON

  cat >"$dir/release/manifest.json" <<JSON
{
  "schemaVersion": "brik64.release_manifest.v1",
  "releaseId": "brik64-$version",
  "version": "$version",
  "channel": "beta",
  "state": "candidate",
  "cli": {
    "package": {
      "path": "evidence/beta17-package/brik64-cli-$version.tgz",
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
  "version": "$version",
  "decision": "PASS_BRIK64_CLI_BETA17_PACKAGE_BUILT",
  "package": {
    "path": "evidence/beta17-package/brik64-cli-$version.tgz",
    "sha256": "$package_sha",
    "bytes": $package_bytes
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
{ "decision": "PASS_FIXTURE", "ref": "$ref", "version": "$version" }
JSON
  done
  cat >"$dir/evidence/beta17-fixpoint/input_pcd_hashes.tsv" <<'TSV'
sha256	path
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa	pcd/beta17/motor.pcd
TSV

  cat >"$dir/evidence/beta17-fixpoint-readiness/report.json" <<JSON
{
  "schemaVersion": "brik64.beta17_fixpoint_readiness_gate.v1",
  "version": "$version",
  "decision": "PASS_BETA17_FIXPOINT_READINESS_GATE",
  "blockers": [],
  "claimBoundary": {
    "publicReleaseAllowed": true,
    "definitiveFixpointAllowed": false,
    "formalN5ClaimAllowed": false,
    "universalCorrectnessClaimAllowed": false
  }
}
JSON

  cat >"$dir/evidence/beta17-fixpoint/public_surface_sync_report.json" <<JSON
{
  "schemaVersion": "brik64.beta17_fixpoint.public_surface_sync_report.v1",
  "version": "$version",
  "decision": "PASS_BETA17_PUBLIC_SURFACE_SYNC",
  "synced": true,
  "blockers": [],
  "claimBoundary": {
    "publicReleaseAllowed": true,
    "definitiveFixpointAllowed": false,
    "formalN5ClaimAllowed": false,
    "universalCorrectnessClaimAllowed": false
  }
}
JSON

  cat >"$dir/evidence/beta17-fixpoint-external-audit-status/report.json" <<JSON
{
  "schemaVersion": "brik64.beta17_fixpoint.external_audit_status_gate.v1",
  "version": "$version",
  "decision": "PASS_BETA17_EXTERNAL_AUDIT_STATUS_GATE",
  "blockers": [],
  "claimBoundary": {
    "publicReleaseAllowed": true,
    "definitiveFixpointAllowed": false,
    "formalN5ClaimAllowed": false,
    "universalCorrectnessClaimAllowed": false
  }
}
JSON
}

PASS_ROOT="$TMP_DIR/pass"
write_pass_fixture "$PASS_ROOT"
BRIK64_CLI_ROOT="$PASS_ROOT" node "$ROOT/scripts/beta17-fixpoint-publication-preflight.js" \
  >"$TMP_DIR/pass.stdout" 2>"$TMP_DIR/pass.stderr"
jq -e '
  .decision=="PASS_BETA17_PUBLICATION_PREFLIGHT"
  and .publicationAllowed==true
  and .claimBoundary.publicReleaseAllowed==true
  and .claimBoundary.definitiveFixpointAllowed==false
  and (.blockers | length)==0
' "$PASS_ROOT/evidence/beta17-fixpoint-publication-preflight/report.json" >/dev/null

# Break attempt 1: stale release manifest version fails closed.
STALE_ROOT="$TMP_DIR/stale"
write_pass_fixture "$STALE_ROOT" "0.1.0-beta.16.1"
if BRIK64_CLI_ROOT="$STALE_ROOT" node "$ROOT/scripts/beta17-fixpoint-publication-preflight.js" \
  >"$TMP_DIR/stale.stdout" 2>"$TMP_DIR/stale.stderr"; then
  echo "stale manifest unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_PUBLICATION_PREFLIGHT"
  and .publicationAllowed==false
  and (.blockers | index("release_manifest_version_mismatch:0.1.0-beta.16.1"))
  and (.blockers | index("package_json_version_mismatch:0.1.0-beta.16.1"))
  and .claimBoundary.publicReleaseAllowed==false
' "$STALE_ROOT/evidence/beta17-fixpoint-publication-preflight/report.json" >/dev/null

# Break attempt 2: package bytes/hash drift fails closed.
SHA_ROOT="$TMP_DIR/sha-drift"
write_pass_fixture "$SHA_ROOT"
printf "tampered" >"$SHA_ROOT/evidence/beta17-package/brik64-cli-0.1.0-beta.17.tgz"
if BRIK64_CLI_ROOT="$SHA_ROOT" node "$ROOT/scripts/beta17-fixpoint-publication-preflight.js" \
  >"$TMP_DIR/sha.stdout" 2>"$TMP_DIR/sha.stderr"; then
  echo "package SHA drift unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_PUBLICATION_PREFLIGHT"
  and (.blockers | index("cli_package_sha256_mismatch"))
  and (.blockers | index("cli_package_bytes_mismatch"))
' "$SHA_ROOT/evidence/beta17-fixpoint-publication-preflight/report.json" >/dev/null

# Break attempt 3: readiness failure blocks publication and propagates blockers.
READINESS_ROOT="$TMP_DIR/readiness"
write_pass_fixture "$READINESS_ROOT"
python3 - "$READINESS_ROOT/evidence/beta17-fixpoint-readiness/report.json" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
data = json.loads(path.read_text())
data["decision"] = "BLOCKED_BETA17_FIXPOINT_READINESS_GATE"
data["blockers"] = ["public_surface_sync_not_pass:BLOCKED_BETA17_PUBLIC_SURFACE_SYNC"]
path.write_text(json.dumps(data, indent=2) + "\n")
PY
if BRIK64_CLI_ROOT="$READINESS_ROOT" node "$ROOT/scripts/beta17-fixpoint-publication-preflight.js" \
  >"$TMP_DIR/readiness.stdout" 2>"$TMP_DIR/readiness.stderr"; then
  echo "blocked readiness unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_PUBLICATION_PREFLIGHT"
  and (.blockers | index("readiness_not_pass:BLOCKED_BETA17_FIXPOINT_READINESS_GATE"))
  and (.blockers | index("readiness:public_surface_sync_not_pass:BLOCKED_BETA17_PUBLIC_SURFACE_SYNC"))
' "$READINESS_ROOT/evidence/beta17-fixpoint-publication-preflight/report.json" >/dev/null

# Break attempt 4: public sync and external audit status must both be green.
SYNC_ROOT="$TMP_DIR/sync"
write_pass_fixture "$SYNC_ROOT"
python3 - "$SYNC_ROOT/evidence/beta17-fixpoint/public_surface_sync_report.json" "$SYNC_ROOT/evidence/beta17-fixpoint-external-audit-status/report.json" <<'PY'
import json, pathlib, sys
sync = pathlib.Path(sys.argv[1])
status = pathlib.Path(sys.argv[2])
sync_data = json.loads(sync.read_text())
sync_data["decision"] = "BLOCKED_BETA17_PUBLIC_SURFACE_SYNC"
sync_data["blockers"] = ["live_verify_version_mismatch:0.1.0-beta.16.1"]
sync.write_text(json.dumps(sync_data, indent=2) + "\n")
status_data = json.loads(status.read_text())
status_data["decision"] = "BLOCKED_BETA17_EXTERNAL_AUDIT_STATUS_GATE"
status_data["blockers"] = ["public_surface_sync_not_pass:BLOCKED_BETA17_PUBLIC_SURFACE_SYNC"]
status.write_text(json.dumps(status_data, indent=2) + "\n")
PY
if BRIK64_CLI_ROOT="$SYNC_ROOT" node "$ROOT/scripts/beta17-fixpoint-publication-preflight.js" \
  >"$TMP_DIR/sync.stdout" 2>"$TMP_DIR/sync.stderr"; then
  echo "blocked public sync unexpectedly passed" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_PUBLICATION_PREFLIGHT"
  and (.blockers | index("public_surface_sync_not_pass:BLOCKED_BETA17_PUBLIC_SURFACE_SYNC"))
  and (.blockers | index("external_audit_status_not_pass:BLOCKED_BETA17_EXTERNAL_AUDIT_STATUS_GATE"))
' "$SYNC_ROOT/evidence/beta17-fixpoint-publication-preflight/report.json" >/dev/null

echo "PASS beta17 publication preflight tests"
