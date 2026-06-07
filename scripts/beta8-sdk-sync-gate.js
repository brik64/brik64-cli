#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta8-sdk-sync');
const version = '0.1.0-beta.8';
const pyVersion = '0.1.0b8';

const repos = [
  {
    id: 'js_ts',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-js',
    files: ['package.json', 'README.md'],
    versionFile: 'package.json',
    expected: '"version": "0.1.0-beta.8"'
  },
  {
    id: 'python',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-python',
    files: ['pyproject.toml', 'README.md'],
    versionFile: 'pyproject.toml',
    expected: 'version = "0.1.0b8"'
  },
  {
    id: 'rust',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-rust',
    files: ['Cargo.toml', 'README.md'],
    versionFile: 'Cargo.toml',
    expected: 'version = "0.1.0-beta.8"'
  }
];

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function scanRepo(repo) {
  const failures = [];
  const artifacts = [];
  for (const rel of repo.files) {
    const file = path.join(repo.path, rel);
    if (!fs.existsSync(file)) {
      failures.push(`missing_sdk_file:${repo.id}:${rel}`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    artifacts.push({ path: file, sha256: sha256File(file), bytes: Buffer.byteLength(text, 'utf8') });
    if (/0\.1\.0-beta\.[4567](?:\.1)?|0\.1\.0b[4567](?:\.post1)?|beta[4567]|beta\.[4567]/.test(text)) {
      failures.push(`stale_beta_reference:${repo.id}:${rel}`);
    }
    if (/\bL[456]\+?N5\b|\bfixpoint\b|\bself-host/i.test(text)) {
      failures.push(`private_or_claim_language:${repo.id}:${rel}`);
    }
  }
  const versionText = fs.existsSync(path.join(repo.path, repo.versionFile))
    ? fs.readFileSync(path.join(repo.path, repo.versionFile), 'utf8')
    : '';
  if (!versionText.includes(repo.expected)) failures.push(`sdk_beta8_version_missing:${repo.id}`);
  return { id: repo.id, repo: repo.path, status: failures.length === 0 ? 'updated' : 'blocked', artifacts, failures };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const sdks = repos.map(scanRepo);
  const failures = sdks.flatMap((sdk) => sdk.failures);
  const report = {
    schemaVersion: 'brik64.cli_beta8_sdk_sync_gate.v1',
    version,
    pythonVersion: pyVersion,
    decision: failures.length === 0 ? 'PASS_SDK_BETA8_SYNC' : 'FAIL_SDK_BETA8_SYNC',
    releaseEligible: failures.length === 0,
    marketplacePublicationAllowed: failures.length === 0,
    sdks,
    failures,
    boundary: 'SDK repositories must be beta8 aligned before marketplace publication. This gate does not mutate npm, PyPI or crates.io.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`marketplacePublicationAllowed=${report.marketplacePublicationAllowed}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
