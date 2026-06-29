#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

rm -rf evidence/beta17-fixpoint-materializer-generator-endpoint

node --check scripts/beta17-fixpoint-materializer-generator-endpoint-install.js

node <<'NODE'
const assert = require('assert');
const {
  buildEndpointSource,
  buildGeneratedStageMaterializerSource,
  buildInstallScript,
  executeConfirmation,
  parseInstallResult,
  requiredCapability,
  resultMarker,
  validateInstallScript,
} = require('./scripts/beta17-fixpoint-materializer-generator-endpoint-install');

const endpoint = buildEndpointSource();
assert(endpoint.includes(resultMarker));
assert(endpoint.includes('generatedMaterializerContentBase64'));
assert(endpoint.includes('BRIK64_BETA17_FIXPOINT_STAGE_RESULT'));
assert(endpoint.includes('brik64.beta17_fixpoint.materializer_provenance.v1'));
assert(endpoint.includes('MATERIALIZER_PROVENANCE_NON_CLAIM'));
assert(endpoint.includes('generatedFromPcdPolymer: true'));
assert(endpoint.includes('fixtureOrTemplate: false'));
assert(endpoint.includes('materializerRef: generatedMaterializer'));
assert(!endpoint.includes('TEMPLATE_NON_CLAIM'));
assert(!endpoint.includes('fixtureMaterializer'));
const stageMaterializer = buildGeneratedStageMaterializerSource();
assert(stageMaterializer.includes('BRIK64_BETA17_FIXPOINT_STAGE_RESULT'));
assert(!stageMaterializer.includes('fixtureMaterializer'));
const options = {
  host: 'root@example.invalid',
  wrapper: '/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5',
  remoteEndpoint: '/opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_beta17_materializer_generator_endpoint.js',
  endpointSha256: 'a'.repeat(64),
};
const script = buildInstallScript(options);
const valid = validateInstallScript(script, options);
assert.deepStrictEqual(valid.blockers, []);
assert(script.includes(requiredCapability));
assert(script.includes('beta17-fixpoint-materializer-generation-status'));
assert(script.includes('beta17-fixpoint-materializer-generate'));
assert.strictEqual(executeConfirmation, 'INSTALL_BETA17_MATERIALIZER_GENERATOR_ENDPOINT_NON_CLAIM');
const missingMarker = validateInstallScript(script.replaceAll(resultMarker, 'REMOVED_RESULT_MARKER'), options);
assert(missingMarker.blockers.includes(`install_script_missing:${resultMarker}`));
const wrongExec = validateInstallScript(script.replaceAll(options.remoteEndpoint, '/opt/brik64/engines/l6plus-n5/current/artifacts/generated/other.js'), options);
assert(wrongExec.blockers.includes(`install_script_missing:${options.remoteEndpoint}`));
const parsed = parseInstallResult(`BRIK64_BETA17_MATERIALIZER_GENERATOR_INSTALL_RESULT\tinstalled\t${options.endpointSha256}\t${options.host}\n`);
assert.deepStrictEqual(parsed, { status: 'installed', sha256: options.endpointSha256, host: options.host });
assert.strictEqual(parseInstallResult('missing'), null);
console.log('PASS beta17 materializer generator endpoint module checks');
NODE

node scripts/beta17-fixpoint-materializer-generator-endpoint-install.js \
  >/tmp/brik64-beta17-generator-endpoint-dry-run.stdout \
  2>/tmp/brik64-beta17-generator-endpoint-dry-run.stderr

jq -e '
  .decision=="PASS_BETA17_MATERIALIZER_GENERATOR_ENDPOINT_INSTALL_DRY_RUN"
  and .executed==false
  and .publicationAllowed==false
  and .claimBoundary.definitiveFixpointAllowed==false
  and .endpoint.requiredCapability=="beta17_fixpoint_materializer_generator"
  and .endpoint.resultMarker=="BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT"
  and .installScript.validation.accepted==true
  and (.nextAction | contains("attempt:beta17:fixpoint:materializer-generation"))
' evidence/beta17-fixpoint-materializer-generator-endpoint/install-report.json >/dev/null

grep -q "BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_ENDPOINT" \
  evidence/beta17-fixpoint-materializer-generator-endpoint/install-script.sh
grep -q "beta17-fixpoint-materializer-generate" \
  evidence/beta17-fixpoint-materializer-generator-endpoint/install-script.sh
grep -q "BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT" \
  evidence/beta17-fixpoint-materializer-generator-endpoint/beta17-materializer-generator-endpoint.js
grep -q "BRIK64_BETA17_FIXPOINT_STAGE_RESULT" \
  evidence/beta17-fixpoint-materializer-generator-endpoint/beta17-materializer-generator-endpoint.js
grep -q "brik64.beta17_fixpoint.materializer_provenance.v1" \
  evidence/beta17-fixpoint-materializer-generator-endpoint/beta17-materializer-generator-endpoint.js
grep -q "MATERIALIZER_PROVENANCE_NON_CLAIM" \
  evidence/beta17-fixpoint-materializer-generator-endpoint/beta17-materializer-generator-endpoint.js
grep -q "materializerRef: generatedMaterializer" \
  evidence/beta17-fixpoint-materializer-generator-endpoint/beta17-materializer-generator-endpoint.js
if grep -q "TEMPLATE_NON_CLAIM\\|fixtureMaterializer" \
  evidence/beta17-fixpoint-materializer-generator-endpoint/beta17-materializer-generator-endpoint.js; then
  echo "endpoint_must_not_contain_fixture_or_template_marker" >&2
  exit 1
fi

set +e
node scripts/beta17-fixpoint-materializer-generator-endpoint-install.js \
  --remote-endpoint /tmp/bad-endpoint.js \
  >/tmp/brik64-beta17-generator-endpoint-bad-path.stdout \
  2>/tmp/brik64-beta17-generator-endpoint-bad-path.stderr
bad_path_rc=$?
set -e
if [[ "$bad_path_rc" -eq 0 ]]; then
  echo "bad_remote_endpoint_path_unexpected_pass" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_MATERIALIZER_GENERATOR_ENDPOINT_INSTALL"
  and (.blockers | index("remote_endpoint_path_invalid"))
' evidence/beta17-fixpoint-materializer-generator-endpoint/install-report.json >/dev/null

set +e
node scripts/beta17-fixpoint-materializer-generator-endpoint-install.js \
  --execute \
  >/tmp/brik64-beta17-generator-endpoint-no-confirm.stdout \
  2>/tmp/brik64-beta17-generator-endpoint-no-confirm.stderr
no_confirm_rc=$?
set -e
if [[ "$no_confirm_rc" -eq 0 ]]; then
  echo "execute_without_confirmation_unexpected_pass" >&2
  exit 1
fi
jq -e '
  .decision=="BLOCKED_BETA17_MATERIALIZER_GENERATOR_ENDPOINT_INSTALL"
  and (.blockers | index("execute_confirmation_missing"))
' evidence/beta17-fixpoint-materializer-generator-endpoint/install-report.json >/dev/null

node scripts/beta17-fixpoint-materializer-generator-endpoint-install.js >/dev/null

echo "PASS beta17 materializer generator endpoint install"
