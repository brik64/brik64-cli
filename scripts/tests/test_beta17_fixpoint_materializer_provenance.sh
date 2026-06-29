#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FIXTURE="$TMP_DIR/workspace"
mkdir -p "$FIXTURE/generated" "$FIXTURE/pcd" "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher"
cat >"$FIXTURE/generated/beta17-materializer.js" <<'JS'
#!/usr/bin/env node
console.log("BRIK64_BETA17_FIXPOINT_STAGE_RESULT\t<base64-json>");
JS
printf '%s\n' '// brik64.pcd_file.v1' 'PC stage_one { fn run() -> i64 { return 1; } }' >"$FIXTURE/pcd/stage1.pcd"
printf '%s\n' '// brik64.pcd_file.v1' 'PC stage_two { fn run() -> i64 { return 1; } }' >"$FIXTURE/pcd/stage2.pcd"

node --check scripts/beta17-fixpoint-materializer-provenance.js

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-materializer-provenance.js" \
  --materializer generated/beta17-materializer.js \
  --pcd pcd/stage1.pcd \
  --pcd pcd/stage2.pcd \
  --l6-serial BRIK64-L6PLUS-N5-TEST-SERIAL \
  >/tmp/brik64-beta17-materializer-provenance.stdout \
  2>/tmp/brik64-beta17-materializer-provenance.stderr

jq -e '
  .decision=="PASS_BETA17_FIXPOINT_MATERIALIZER_PROVENANCE"
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .provenance.path=="evidence/beta17-fixpoint-remote-dispatcher/materializer-provenance.json"
  and .provenance.materializerRef.path=="generated/beta17-materializer.js"
  and .provenance.inputPcdCount==2
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/materializer-provenance-report.json" >/dev/null

jq -e '
  .schemaVersion=="brik64.beta17_fixpoint.materializer_provenance.v1"
  and .status=="MATERIALIZER_PROVENANCE_NON_CLAIM"
  and .materializerMode=="l6plus_fixpoint_stage_materializer"
  and .generatedFromPcdPolymer==true
  and .fixtureOrTemplate==false
  and .l6plusEngineSerial=="BRIK64-L6PLUS-N5-TEST-SERIAL"
  and .claimBoundary.publicReleaseAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .claimBoundary.formalN5ClaimAllowed==false
  and .claimBoundary.universalCorrectnessClaimAllowed==false
  and .materializerRef.path=="generated/beta17-materializer.js"
  and (.inputPcds | length)==2
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/materializer-provenance.json" >/dev/null

node - "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/materializer-provenance.json" <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const file = process.argv[2];
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const body = `${data.inputPcds.map((item) => `${item.sha256}\t${item.bytes}\t${item.path}`).join('\n')}\n`;
const expected = crypto.createHash('sha256').update(body).digest('hex');
if (data.pcdInputSetSha256 !== expected) {
  console.error('pcd_input_set_sha_mismatch');
  process.exit(1);
}
NODE

BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-materializer-provenance.js" \
  --validate \
  --input "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/materializer-provenance.json" \
  >/tmp/brik64-beta17-materializer-provenance-validate.stdout \
  2>/tmp/brik64-beta17-materializer-provenance-validate.stderr

jq -e '
  .decision=="PASS_BETA17_FIXPOINT_MATERIALIZER_PROVENANCE"
  and .provenance.path=="evidence/beta17-fixpoint-remote-dispatcher/materializer-provenance.json"
' "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/materializer-provenance-report.json" >/dev/null

cp "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/materializer-provenance.json" \
  "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/original-provenance.json"

set +e
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-materializer-provenance.js" \
  --materializer generated/missing.js \
  --pcd pcd/stage1.pcd \
  --out "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/missing-materializer.json" \
  >/tmp/brik64-beta17-materializer-provenance-missing.stdout \
  2>/tmp/brik64-beta17-materializer-provenance-missing.stderr
missing_rc=$?
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-materializer-provenance.js" \
  --materializer generated/beta17-materializer.js \
  --pcd ../outside.pcd \
  --out "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/outside-pcd.json" \
  >/tmp/brik64-beta17-materializer-provenance-outside.stdout \
  2>/tmp/brik64-beta17-materializer-provenance-outside.stderr
outside_rc=$?
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-materializer-provenance.js" \
  --materializer generated/beta17-materializer.js \
  --pcd pcd/stage1.pcd \
  --l6-serial BAD-SERIAL \
  --out "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/bad-serial.json" \
  >/tmp/brik64-beta17-materializer-provenance-bad-serial.stdout \
  2>/tmp/brik64-beta17-materializer-provenance-bad-serial.stderr
bad_serial_rc=$?
printf '%s\n' 'tampered pcd after provenance generation' >>"$FIXTURE/pcd/stage1.pcd"
BRIK64_CLI_ROOT="$FIXTURE" node "$ROOT/scripts/beta17-fixpoint-materializer-provenance.js" \
  --validate \
  --input "$FIXTURE/evidence/beta17-fixpoint-remote-dispatcher/original-provenance.json" \
  >/tmp/brik64-beta17-materializer-provenance-tampered.stdout \
  2>/tmp/brik64-beta17-materializer-provenance-tampered.stderr
tampered_rc=$?
set -e

if [[ "$missing_rc" -eq 0 || "$outside_rc" -eq 0 || "$bad_serial_rc" -eq 0 || "$tampered_rc" -eq 0 ]]; then
  echo "beta17_materializer_provenance_adversarial_unexpected_pass" >&2
  exit 1
fi

grep -q "materializer_file_missing:generated/missing.js" /tmp/brik64-beta17-materializer-provenance-missing.stderr
grep -q "input_pcd_path_invalid:../outside.pcd" /tmp/brik64-beta17-materializer-provenance-outside.stderr
grep -q "provenance_l6plus_serial_invalid" /tmp/brik64-beta17-materializer-provenance-bad-serial.stderr
grep -q "provenance_input_pcd_0_file_sha256_mismatch:pcd/stage1.pcd" /tmp/brik64-beta17-materializer-provenance-tampered.stderr

echo "PASS beta17 fixpoint materializer provenance"
