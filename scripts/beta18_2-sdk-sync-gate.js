#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta18_2-sdk-sync');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release', 'manifest.json'), 'utf8'));
const failures = [];
const expected = {
  npm: version,
  pypi: '0.1.0b18.post2',
  'crates.io': version,
};
for (const [marketplace, expectedVersion] of Object.entries(expected)) {
  const sdk = (manifest.sdks || []).find((item) => item.marketplace === marketplace);
  if (!sdk) failures.push(`sdk_missing:${marketplace}`);
  else if (sdk.version !== expectedVersion) failures.push(`sdk_version_drift:${marketplace}:${sdk.version}:${expectedVersion}`);
  else if (sdk.required !== true) failures.push(`sdk_not_required:${marketplace}`);
}
const report = {
  schemaVersion: 'brik64.cli_beta18_2_sdk_sync_gate.v1',
  version,
  decision: failures.length === 0 ? 'PASS_BETA18_2_SDK_SYNC_GATE' : 'FAIL_BETA18_2_SDK_SYNC_GATE',
  marketplacePublicationAllowed: failures.length === 0,
  failures,
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`decision=${report.decision}`);
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
