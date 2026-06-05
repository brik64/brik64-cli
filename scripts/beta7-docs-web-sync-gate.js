#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta7-docs-web-sync');
const docsRoot = '/Users/carlosjperez/Documents/GitHub/brik64-docs-site';
const webRoot = '/Users/carlosjperez/Documents/GitHub/brik64.com';
const version = '0.1.0-beta.7';

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function checkFile(id, file, required, failures, artifacts) {
  if (!fs.existsSync(file)) {
    failures.push(`missing_surface:${id}`);
    return;
  }
  const text = read(file);
  artifacts.push({ id, path: file, sha256: sha256File(file), bytes: Buffer.byteLength(text, 'utf8') });
  for (const needle of required) {
    if (!text.includes(needle)) failures.push(`surface_required_text_missing:${id}:${needle}`);
  }
}

function scanStale(rootDir, args) {
  const result = childProcess.spawnSync('rg', args, {
    cwd: rootDir,
    encoding: 'utf8'
  });
  return (result.stdout || '').split('\n').filter(Boolean);
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];
  const artifacts = [];

  checkFile('docs_sync', path.join(docsRoot, 'BETA7_SYNC.md'), [
    version,
    '@brik64/core@0.1.0-beta.7',
    'brik64==0.1.0b7',
    'brik64-core@0.1.0-beta.7'
  ], failures, artifacts);
  checkFile('docs_install', path.join(docsRoot, 'cli/install.mdx'), [
    version,
    'brik64-cli-0.1.0-beta.7.tgz',
    'https://brik64.com/cli/releases/0.1.0-beta.7.json'
  ], failures, artifacts);
  checkFile('docs_sdks', path.join(docsRoot, 'sdks.mdx'), [
    '@brik64/core@0.1.0-beta.7',
    'brik64==0.1.0b7',
    'brik64-core@0.1.0-beta.7'
  ], failures, artifacts);
  checkFile('docs_llms', path.join(docsRoot, 'llms-full.txt'), [
    version,
    '@brik64/core@0.1.0-beta.7',
    'brik64==0.1.0b7',
    'brik64-core@0.1.0-beta.7'
  ], failures, artifacts);
  checkFile('web_sync', path.join(webRoot, 'BETA7_SYNC.md'), [
    version,
    '@brik64/core@0.1.0-beta.7',
    'brik64==0.1.0b7',
    'brik64-core@0.1.0-beta.7'
  ], failures, artifacts);
  checkFile('web_sdk_download_api', path.join(webRoot, 'functions/api/download/sdk/[target].ts'), [
    '0.1.0-beta.7',
    '0.1.0b7',
    'https://www.npmjs.com/package/@brik64/core/v/0.1.0-beta.7',
    'https://pypi.org/project/brik64/0.1.0b7/',
    'https://crates.io/crates/brik64-core/0.1.0-beta.7'
  ], failures, artifacts);
  checkFile('web_cli_download_api', path.join(webRoot, 'functions/api/download/cli.ts'), [
    '0.1.0-beta.7'
  ], failures, artifacts);
  checkFile('web_language_data', path.join(webRoot, 'src/lib/language-data.ts'), [
    'npm install @brik64/core@0.1.0-beta.7',
    'pip install brik64==0.1.0b7',
    'cargo add brik64-core --version 0.1.0-beta.7'
  ], failures, artifacts);

  const docsStale = scanStale(docsRoot, [
    '-n',
    '0\\.1\\.0-beta\\.[456]|0\\.1\\.0b[456]|beta[456]|beta\\.[456]',
    '-g', '!docs/research/**',
    '-g', '!docs/operations/**',
    '-g', '!BETA6_SYNC.md',
    '-g', '!node_modules/**',
    '-g', '!.git/**'
  ]);
  for (const stale of docsStale) failures.push(`docs_stale_beta_residue:${stale}`);

  const webStale = scanStale(webRoot, [
    '-n',
    '0\\.1\\.0-beta\\.[456]|0\\.1\\.0b[456]|beta[456]|beta\\.[456]',
    '-g', '!docs/research/**',
    '-g', '!src/lib/cms/generated-public-content.json',
    '-g', '!node_modules/**',
    '-g', '!.next/**',
    '-g', '!out/**',
    '-g', '!.git/**'
  ]);
  for (const stale of webStale) failures.push(`web_stale_beta_residue:${stale}`);

  const forbiddenPublic = /\bL[456]\+?N5\b|\bfixpoint\b|\bself-host/i;
  for (const artifact of artifacts) {
    const text = read(artifact.path);
    if (forbiddenPublic.test(text)) failures.push(`public_claim_language:${artifact.id}`);
  }

  const report = {
    schemaVersion: 'brik64.cli_beta7_docs_web_sync_gate.v1',
    version,
    decision: failures.length === 0 ? 'PASS_DOCS_WEB_BETA7_SYNC' : 'FAIL_DOCS_WEB_BETA7_SYNC',
    releaseEligible: failures.length === 0,
    deployAllowed: failures.length === 0,
    artifacts,
    failures,
    boundary: 'Docs and web source are beta7 aligned. Historical beta6 sync notes are allowed only as versioned archive inputs.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`deployAllowed=${report.deployAllowed}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
