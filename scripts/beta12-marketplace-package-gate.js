#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta12-marketplace-packages');
const version = '0.1.0-beta.12';
const pyVersion = '0.1.0b12';

const artifacts = [
  {
    id: 'js_npm_package',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-js/package.json',
    requiredText: '"version": "0.1.0-beta.12"'
  },
  {
    id: 'python_wheel',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-python/dist/brik64-0.1.0b12-py3-none-any.whl'
  },
  {
    id: 'python_sdist',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-python/dist/brik64-0.1.0b12.tar.gz'
  },
  {
    id: 'rust_crate',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-rust/target/package/brik64-core-0.1.0-beta.12.crate'
  }
];

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];
  const found = [];
  for (const artifact of artifacts) {
    if (!fs.existsSync(artifact.path)) {
      failures.push(`marketplace_artifact_missing:${artifact.id}`);
      continue;
    }
    const bytes = fs.statSync(artifact.path).size;
    const record = { id: artifact.id, path: artifact.path, sha256: sha256File(artifact.path), bytes };
    found.push(record);
    if (artifact.requiredText && !fs.readFileSync(artifact.path, 'utf8').includes(artifact.requiredText)) {
      failures.push(`marketplace_artifact_text_missing:${artifact.id}`);
    }
  }
  const report = {
    schemaVersion: 'brik64.cli_beta12_marketplace_package_gate.v1',
    version,
    pythonVersion: pyVersion,
    decision: failures.length === 0 ? 'PASS_MARKETPLACE_PACKAGE_GATE' : 'FAIL_MARKETPLACE_PACKAGE_GATE',
    releaseEligible: failures.length === 0,
    marketplacePublicationAllowed: failures.length === 0,
    artifacts: found,
    failures,
    boundary: 'Local package artifacts are present for SDK publication. This gate does not publish to package marketplaces.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`marketplacePublicationAllowed=${report.marketplacePublicationAllowed}\n`);
  if (failures.length) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length) process.exit(1);
}

main();
