#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const https = require('https');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta15_6-marketplace-packages');
const version = '0.1.0-beta.15.6';
const pyVersion = '0.1.0b15.post6';

function run(command, args) {
  const result = childProcess.spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  return { rc: result.status || 0, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': 'brik64-release-gate' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`http_${res.statusCode}:${url}`));
          return;
        }
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];
  const npm = run('npm', ['view', `@brik64/core@${version}`, 'version']);
  if (npm.rc !== 0 || npm.stdout.trim() !== version) failures.push('npm_beta15_6_missing');

  try {
    const pypi = await fetchJson('https://pypi.org/pypi/brik64/json');
    if (!pypi.releases || !pypi.releases[pyVersion]) failures.push('pypi_beta15_6_missing');
  } catch (error) {
    failures.push(`pypi_lookup_failed:${error.message}`);
  }

  const crates = run('cargo', ['info', `brik64-core@${version}`]);
  if (crates.rc !== 0 || !crates.stdout.includes(`version: ${version}`)) failures.push('crates_beta15_6_missing');

  const report = {
    schemaVersion: 'brik64.cli_beta15_6_marketplace_package_gate.v1',
    version,
    pythonVersion: pyVersion,
    decision: failures.length === 0 ? 'PASS_BETA15_6_MARKETPLACE_PACKAGES' : 'FAIL_BETA15_6_MARKETPLACE_PACKAGES',
    marketplacePublicationAllowed: failures.length === 0,
    checks: {
      npm: { rc: npm.rc, stdout: npm.stdout.trim().slice(0, 200) },
      pypi: { version: pyVersion },
      crates: { rc: crates.rc, stdout: crates.stdout.split('\n').slice(0, 8).join('\n') }
    },
    failures
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  if (failures.length) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify({
    schemaVersion: 'brik64.cli_beta15_6_marketplace_package_gate.v1',
    version,
    decision: 'FAIL_BETA15_6_MARKETPLACE_PACKAGES',
    failures: [error.message]
  }, null, 2)}\n`);
  console.error(error.message);
  process.exit(1);
});
