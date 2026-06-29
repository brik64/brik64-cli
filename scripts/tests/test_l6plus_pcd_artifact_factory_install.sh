#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
cd "$ROOT"

node --check scripts/l6plus-pcd-artifact-factory-install.js

node <<'NODE'
const assert = require('assert');
const {
  buildFactorySource,
  buildInstallScript,
  executeConfirmation,
  parseInstallResult,
  requestMarker,
  requiredCapability,
  requiredResultMarker,
  validateInstallScript,
} = require('./scripts/l6plus-pcd-artifact-factory-install');

const source = buildFactorySource();
assert(source.includes(requestMarker));
assert(source.includes(requiredResultMarker));
assert(source.includes(requiredCapability));
assert(source.includes('SUPPORTED_ARTIFACT_KINDS'));
assert(source.includes("'cli'"));
assert(source.includes("'sdk'"));
assert(source.includes("'engine'"));
assert(!source.includes('publicReleaseAllowed: true'));
assert(!source.includes('definitiveFixpointAllowed: true'));
const options = {
  host: 'root@example.invalid',
  wrapper: '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5',
  remoteFactory: '/opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_pcd_artifact_factory.js',
  factorySha256: 'a'.repeat(64),
};
const script = buildInstallScript(options);
assert(script.includes('artifact-factory-status'));
assert(script.includes('artifact-factory-materialize'));
assert(script.includes(requiredCapability));
assert.deepStrictEqual(validateInstallScript(script, options).blockers, []);
assert.strictEqual(executeConfirmation, 'INSTALL_L6PLUS_PCD_ARTIFACT_FACTORY_NON_CLAIM');
const parsed = parseInstallResult(`BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL_RESULT\tinstalled\t${options.factorySha256}\t${options.host}\n`);
assert.deepStrictEqual(parsed, { status: 'installed', sha256: options.factorySha256, host: options.host });
assert.strictEqual(parseInstallResult('missing'), null);
console.log('PASS l6plus PCD artifact factory install module checks');
NODE

BRIK64_CLI_ROOT="$TMP_ROOT" node scripts/l6plus-pcd-artifact-factory-install.js \
  >/tmp/brik64-l6plus-factory-install-dry-run.stdout \
  2>/tmp/brik64-l6plus-factory-install-dry-run.stderr

jq -e '
  .decision=="PASS_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL_DRY_RUN"
  and .executed==false
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .factory.requiredCapability=="l6plus_pcd_artifact_factory"
  and .factory.resultMarker=="BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT"
  and .installScript.validation.accepted==true
  and (.nextAction | contains("audit:l6plus:pcd-artifact-factory"))
' "$TMP_ROOT/evidence/l6plus-pcd-artifact-factory-install/install-report.json" >/dev/null

grep -q "BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_ENDPOINT" \
  "$TMP_ROOT/evidence/l6plus-pcd-artifact-factory-install/install-script.sh"
grep -q "artifact-factory-materialize" \
  "$TMP_ROOT/evidence/l6plus-pcd-artifact-factory-install/install-script.sh"
grep -q "BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT" \
  "$TMP_ROOT/evidence/l6plus-pcd-artifact-factory-install/l6plus-pcd-artifact-factory.js"

set +e
BRIK64_CLI_ROOT="$TMP_ROOT" node scripts/l6plus-pcd-artifact-factory-install.js \
  --remote-factory /tmp/bad-factory.js \
  >/tmp/brik64-l6plus-factory-install-bad-path.stdout \
  2>/tmp/brik64-l6plus-factory-install-bad-path.stderr
bad_path_rc=$?
set -e
if [[ "$bad_path_rc" -eq 0 ]]; then
  echo "bad_remote_factory_path_unexpected_pass" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL"
  and (.blockers | index("remote_factory_path_invalid"))
' "$TMP_ROOT/evidence/l6plus-pcd-artifact-factory-install/install-report.json" >/dev/null

set +e
BRIK64_CLI_ROOT="$TMP_ROOT" node scripts/l6plus-pcd-artifact-factory-install.js \
  --execute \
  >/tmp/brik64-l6plus-factory-install-no-confirm.stdout \
  2>/tmp/brik64-l6plus-factory-install-no-confirm.stderr
no_confirm_rc=$?
set -e
if [[ "$no_confirm_rc" -eq 0 ]]; then
  echo "execute_without_confirmation_unexpected_pass" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL"
  and (.blockers | index("execute_confirmation_missing"))
' "$TMP_ROOT/evidence/l6plus-pcd-artifact-factory-install/install-report.json" >/dev/null

echo "PASS l6plus PCD artifact factory install tests"
