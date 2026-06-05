const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { build } = require('./beta6-package-harness.generated.js');

test('beta6 package harness fails closed until L6 full generation is ready', () => {
  const root = path.resolve(__dirname, '..', '..', '..');
  const manifest = build(root);
  assert.equal(manifest.version, '0.1.0-beta.6');
  assert.equal(manifest.productArtifact, 'BRIK64 CLI 0.1.0-beta.6');
  assert.equal(manifest.generatedFrom, 'pcd/beta6_package_harness.pcd');
  assert.equal(manifest.releaseEligible, false);
  assert.equal(manifest.decision, 'BLOCKED_BETA6_PACKAGE_HARNESS_L6_NOT_READY');
  assert.ok(manifest.inputs.length >= 6);
});
