#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta13-sdk-sync');
const version = '0.1.0-beta.13';
const pyVersion = '0.1.0b13';

const repos = [
  {
    id: 'js_ts',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-js',
    files: ['package.json', 'README.md', 'test/package-exports.test.mjs'],
    expected: ['"version": "0.1.0-beta.13"', '@brik64/core@0.1.0-beta.13']
  },
  {
    id: 'python',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-python',
    files: ['pyproject.toml', 'README.md'],
    expected: ['version = "0.1.0b13"', 'brik64==0.1.0b13']
  },
  {
    id: 'rust',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-rust',
    files: ['Cargo.toml', 'Cargo.lock', 'README.md'],
    expected: ['version = "0.1.0-beta.13"', 'brik64-core = "0.1.0-beta.13"']
  }
];

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function scanRepo(repo) {
  const failures = [];
  const artifacts = [];
  let joined = '';
  for (const rel of repo.files) {
    const file = path.join(repo.path, rel);
    if (!fs.existsSync(file)) {
      failures.push(`missing_sdk_file:${repo.id}:${rel}`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    joined += `\n${text}`;
    artifacts.push({ path: file, sha256: sha256File(file), bytes: Buffer.byteLength(text, 'utf8') });
    if (/\bL[456]\+?N5\b|\bN5\b|\bfixpoint\b|\bself[- ]host\b|Hetzner|1Password/i.test(text)) {
      failures.push(`private_or_claim_language:${repo.id}:${rel}`);
    }
  }
  for (const expected of repo.expected) {
    if (!joined.includes(expected)) failures.push(`sdk_expected_text_missing:${repo.id}:${expected}`);
  }
  if (/0\.1\.0-beta\.(?:[4-9]|10|11|12)\b|0\.1\.0b(?:[4-9]|10|11|12)\b/.test(joined)) {
    failures.push(`stale_beta_reference:${repo.id}`);
  }
  return { id: repo.id, repo: repo.path, status: failures.length === 0 ? 'updated' : 'blocked', artifacts, failures };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const sdks = repos.map(scanRepo);
  const failures = sdks.flatMap((sdk) => sdk.failures);
  const report = {
    schemaVersion: 'brik64.cli_beta13_sdk_sync_gate.v1',
    version,
    pythonVersion: pyVersion,
    decision: failures.length === 0 ? 'PASS_SDK_BETA13_SYNC' : 'FAIL_SDK_BETA13_SYNC',
    releaseEligible: failures.length === 0,
    marketplacePublicationAllowed: failures.length === 0,
    sdks,
    failures,
    boundary: 'SDK repositories must be Beta13 aligned before package publication. This gate does not mutate npm, PyPI, or crates.io.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`marketplacePublicationAllowed=${report.marketplacePublicationAllowed}\n`);
  if (failures.length) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length) process.exit(1);
}

main();
