#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta6-docs-web-sync');
const docsRoot = '/Users/carlosjperez/Documents/GitHub/brik64-docs-site';
const webRoot = '/Users/carlosjperez/Documents/GitHub/brik64.com';
const version = '0.1.0-beta.6';
const pyVersion = '0.1.0b6';

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

function scanStale(rootDir, allowedHistorical = []) {
  const result = childProcess.spawnSync(
    'rg',
    [
      '-n',
      '0\\.1\\.0-beta\\.5|0\\.1\\.0b5|beta5|Beta5|brik64-cli-0\\.1\\.0-beta\\.6-local-candidate|8448215f',
      rootDir,
      '-g',
      '!node_modules',
      '-g',
      '!dist',
      '-g',
      '!build',
      '-g',
      '!out',
      '-g',
      '!.next',
      '-g',
      '!.git',
      '-g',
      '!.playwright-mcp'
    ],
    { encoding: 'utf8' }
  );
  const lines = (result.stdout || '').split('\n').filter(Boolean);
  return lines.filter((line) => !allowedHistorical.some((needle) => line.includes(needle)));
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

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];
  const artifacts = [];

  checkFile('docs_sync', path.join(docsRoot, 'BETA6_SYNC.md'), [
    version,
    '@brik64/core@0.1.0-beta.6',
    `brik64==${pyVersion}`,
    'brik64-core@0.1.0-beta.6'
  ], failures, artifacts);
  checkFile('docs_install', path.join(docsRoot, 'cli/install.mdx'), [
    version,
    'brik64-cli-0.1.0-beta.6.tgz',
    '7b529fafb4c43d4030295c83e80ade08fa635e7a5430f8dffb9da9141c656070'
  ], failures, artifacts);
  checkFile('web_sync', path.join(webRoot, 'docs/BRIK64_CLI_BETA6_SURFACE_SYNC.md'), [
    version,
    'GitHub Release'
  ], failures, artifacts);
  checkFile('web_channel_manifest', path.join(webRoot, 'public/cli/beta.json'), [
    `"currentVersion": "${version}"`,
    `/cli/releases/${version}.json`
  ], failures, artifacts);
  checkFile('web_release_manifest', path.join(webRoot, `public/cli/releases/${version}.json`), [
    `"version": "${version}"`,
    'brik64-cli-0.1.0-beta.6.tgz',
    '7b529fafb4c43d4030295c83e80ade08fa635e7a5430f8dffb9da9141c656070'
  ], failures, artifacts);

  for (const stale of scanStale(docsRoot)) failures.push(`docs_stale_beta_residue:${stale}`);
  for (const stale of scanStale(webRoot, ['public/cli/releases/0.1.0-beta.5.json'])) {
    failures.push(`web_stale_beta_residue:${stale}`);
  }

  const report = {
    schemaVersion: 'brik64.cli_beta6_docs_web_sync_gate.v1',
    version,
    decision: failures.length === 0 ? 'PASS_DOCS_WEB_BETA6_SYNC' : 'FAIL_DOCS_WEB_BETA6_SYNC',
    releaseEligible: failures.length === 0,
    deployAllowed: failures.length === 0,
    artifacts,
    failures,
    boundary: 'Docs and web source are beta6 aligned. Historical beta5 release manifest is allowed only as a versioned archive.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`deployAllowed=${report.deployAllowed}\n`);
  if (failures.length > 0) {
    process.stdout.write(`failures=${failures.join(',')}\n`);
    process.exit(1);
  }
}

main();
