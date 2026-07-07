#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta18_2-marketplace-packages');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release', 'manifest.json'), 'utf8'));
const failures = [];
const expected = new Map([
  ['npm', version],
  ['pypi', '0.1.0b18.post2'],
  ['crates.io', version],
]);
for (const [marketplace, expectedVersion] of expected.entries()) {
  const sdk = (manifest.sdks || []).find((item) => item.marketplace === marketplace);
  if (!sdk) failures.push(`marketplace_package_missing:${marketplace}`);
  else if (sdk.version !== expectedVersion) failures.push(`marketplace_package_version_drift:${marketplace}:${sdk.version}:${expectedVersion}`);
}
const report = {
  schemaVersion: 'brik64.cli_beta18_2_marketplace_package_gate.v1',
  version,
  decision: failures.length === 0 ? 'PASS_BETA18_2_MARKETPLACE_PACKAGE_GATE' : 'FAIL_BETA18_2_MARKETPLACE_PACKAGE_GATE',
  marketplacePublicationAllowed: failures.length === 0,
  note: 'Pre-publication package coordinate gate. Live marketplace publication is verified by release train live checks.',
  failures,
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`decision=${report.decision}`);
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
