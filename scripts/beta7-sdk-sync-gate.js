#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta7-sdk-sync');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const repos = [
  {
    id: 'js_ts',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-js',
    files: ['package.json', 'README.md', 'BETA7_SYNC.md'],
    versionFile: 'package.json',
    expected: '"version": "0.1.0-beta.7"'
  },
  {
    id: 'python',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-python',
    files: ['pyproject.toml', 'README.md', 'BETA7_SYNC.md'],
    versionFile: 'pyproject.toml',
    expected: 'version = "0.1.0b7"'
  },
  {
    id: 'rust',
    path: '/Users/carlosjperez/Documents/GitHub/brik64-lib-rust',
    files: ['Cargo.toml', 'README.md', 'BETA7_SYNC.md'],
    versionFile: 'Cargo.toml',
    expected: 'version = "0.1.0-beta.7"'
  }
];

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
    artifacts.push({
      path: file,
      sha256: sha256File(file),
      bytes: Buffer.byteLength(text, 'utf8')
    });
    if (/0\.1\.0-beta\.[456](?:\.1)?|0\.1\.0b[456](?:\.post1)?|beta[456]|beta\.[456]/.test(text)) {
      failures.push(`stale_beta_reference:${repo.id}:${rel}`);
    }
    if (/\bL[456]\+?N5\b|\bfixpoint\b|\bself-host/i.test(text)) {
      failures.push(`private_or_claim_language:${repo.id}:${rel}`);
    }
  }
  const versionText = fs.existsSync(path.join(repo.path, repo.versionFile))
    ? fs.readFileSync(path.join(repo.path, repo.versionFile), 'utf8')
    : '';
  if (!versionText.includes(repo.expected)) failures.push(`sdk_beta7_version_missing:${repo.id}`);
  return {
    id: repo.id,
    repo: repo.path,
    status: failures.length === 0 ? 'updated' : 'blocked',
    artifacts,
    failures
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const sdks = repos.map(scanRepo);
  const failures = sdks.flatMap((sdk) => sdk.failures);
  const report = {
    schemaVersion: 'brik64.cli_beta7_sdk_sync_gate.v1',
    version: '0.1.0-beta.7',
    decision: failures.length === 0 ? 'PASS_SDK_BETA7_SYNC' : 'FAIL_SDK_BETA7_SYNC',
    releaseEligible: failures.length === 0,
    marketplacePublicationAllowed: failures.length === 0,
    sdks,
    failures,
    boundary: 'SDK repositories are version-aligned for the beta7 public release train. Marketplace mutation remains a separate publication step.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`marketplacePublicationAllowed=${failures.length === 0}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
