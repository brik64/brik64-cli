#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'release', 'manifest.json');
const sourceReportPath = path.join(root, 'evidence', 'beta8-github-verified-signature', 'report.json');
const outDir = path.join(root, 'evidence', 'release-github-verified-signature');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function gitOutput(args) {
  return childProcess.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = readJson(manifestPath);
  const commit = process.env.BRIK64_RELEASE_COMMIT || gitOutput(['rev-parse', 'HEAD']);
  const result = childProcess.spawnSync('node', ['scripts/beta8-github-verified-signature-gate.js', '--commit', commit], {
    cwd: root,
    encoding: 'utf8',
    env: process.env
  });

  const source = fs.existsSync(sourceReportPath) ? readJson(sourceReportPath) : null;
  const failures = [];
  if (result.status !== 0) failures.push(`source_signature_gate_failed:${result.status}`);
  if (!source) failures.push('source_signature_report_missing');
  if (source && source.verification?.verified !== true) failures.push('commit_not_github_verified');

  const report = {
    schemaVersion: 'brik64.release_github_verified_signature_gate.v1',
    generatedAt: new Date().toISOString(),
    releaseId: manifest.releaseId,
    version: manifest.version,
    decision: failures.length === 0
      ? 'PASS_RELEASE_GITHUB_VERIFIED_SIGNATURE'
      : 'BLOCKED_RELEASE_GITHUB_VERIFIED_SIGNATURE',
    repo: source?.repo || process.env.BRIK64_GITHUB_REPO || 'brik64/brik64-cli',
    commit,
    verification: source?.verification || null,
    sourceReport: source ? 'evidence/beta8-github-verified-signature/report.json' : null,
    boundary: {
      gateKind: 'release_integrity_identity_gate',
      compilerFunctionalityEvidence: false,
      publicReleaseAllowed: failures.length === 0,
      adminOverrideAllowed: false
    },
    failures,
    warnings: source?.warnings || []
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`publicReleaseAllowed=${report.boundary.publicReleaseAllowed}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  process.exit(failures.length === 0 ? 0 : 2);
}

main();
