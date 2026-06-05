const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { build } = require('./beta6-package-harness.generated.js');

test('beta6 package harness is ready once L6 full generation gates pass', () => {
  const root = path.resolve(__dirname, '..', '..', '..');
  const manifest = build(root);
  assert.equal(manifest.version, '0.1.0-beta.6');
  assert.equal(manifest.productArtifact, 'BRIK64 CLI 0.1.0-beta.6');
  assert.equal(manifest.generatedFrom, 'pcd/beta6_package_harness.pcd');
  assert.equal(manifest.releaseEligible, true);
  assert.equal(manifest.decision, 'PASS_BETA6_PACKAGE_HARNESS_READY');
  assert.deepEqual(manifest.blockers, []);
  assert.ok(manifest.inputs.length >= 6);
});
