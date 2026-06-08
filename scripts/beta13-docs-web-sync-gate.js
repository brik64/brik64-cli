#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta13-docs-web-sync');
const docsRoot = '/Users/carlosjperez/Documents/GitHub/brik64-docs-site';
const webRoot = '/Users/carlosjperez/Documents/GitHub/brik64.com';
const version = '0.1.0-beta.13';

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function checkFile(id, file, required, failures, artifacts) {
  if (!fs.existsSync(file)) {
    failures.push(`missing_surface:${id}`);
    return;
  }
  const text = fs.readFileSync(file, 'utf8');
  artifacts.push({ id, path: file, sha256: sha256File(file), bytes: Buffer.byteLength(text, 'utf8') });
  for (const needle of required) {
    if (!text.includes(needle)) failures.push(`surface_required_text_missing:${id}:${needle}`);
  }
  if (/\bL[456]\+?N5\b|\bN5\b|\bfixpoint\b|\bself[- ]host|Hetzner|1Password|methodology/i.test(text)) {
    failures.push(`public_claim_language:${id}`);
  }
}

function scan(rootDir, pattern) {
  const result = childProcess.spawnSync('rg', ['-n', pattern, '-g', '!node_modules/**', '-g', '!.git/**', '-g', '!.next/**', '-g', '!out/**'], {
    cwd: rootDir,
    encoding: 'utf8'
  });
  return (result.stdout || '').split('\n').filter(Boolean);
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];
  const artifacts = [];
  checkFile('docs_install', path.join(docsRoot, 'cli/install.mdx'), [version], failures, artifacts);
  checkFile('docs_sdks', path.join(docsRoot, 'sdks.mdx'), ['@brik64/core@0.1.0-beta.13', 'brik64==0.1.0b13', 'brik64-core@0.1.0-beta.13'], failures, artifacts);
  checkFile('web_release_data', path.join(webRoot, 'src/lib/language-data.ts'), ['@brik64/core@0.1.0-beta.13', 'brik64==0.1.0b13', 'brik64-core'], failures, artifacts);
  checkFile('web_cli_download_api', path.join(webRoot, 'functions/api/download/cli.ts'), [version], failures, artifacts);
  checkFile('web_telemetry_intake', path.join(webRoot, 'functions/api/telemetry/cli.ts'), ['handleCliIntake("telemetry"'], failures, artifacts);
  checkFile('web_feedback_intake', path.join(webRoot, 'functions/api/feedback.ts'), ['handleCliIntake("feedback"'], failures, artifacts);
  checkFile('web_error_report_intake', path.join(webRoot, 'functions/api/error-reports.ts'), ['handleCliIntake("error_report"'], failures, artifacts);
  checkFile('web_cli_intake_shared', path.join(webRoot, 'functions/api/_cli-intake.ts'), ['sensitive_payload_rejected', 'payload_too_large'], failures, artifacts);
  checkFile('web_cli_intake_migration', path.join(webRoot, 'migrations/0003_cli_intake_events.sql'), ['CREATE TABLE IF NOT EXISTS cli_intake_events'], failures, artifacts);
  for (const stale of scan(docsRoot, '0\\.1\\.0-beta\\.(?:[4-9]|10|11|12)\\b|0\\.1\\.0b(?:[4-9]|10|11|12)\\b')) {
    failures.push(`docs_stale_beta_residue:${stale}`);
  }
  for (const stale of scan(webRoot, '0\\.1\\.0-beta\\.(?:[4-9]|10|11|12)\\b|0\\.1\\.0b(?:[4-9]|10|11|12)\\b')) {
    failures.push(`web_stale_beta_residue:${stale}`);
  }
  const report = {
    schemaVersion: 'brik64.cli_beta13_docs_web_sync_gate.v1',
    version,
    decision: failures.length === 0 ? 'PASS_DOCS_WEB_BETA13_SYNC' : 'FAIL_DOCS_WEB_BETA13_SYNC',
    releaseEligible: failures.length === 0,
    deployAllowed: failures.length === 0,
    artifacts,
    failures,
    boundary: 'Docs and web source must be Beta13 aligned before publication. This gate does not deploy.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`deployAllowed=${report.deployAllowed}\n`);
  if (failures.length) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length) process.exit(1);
}

main();
