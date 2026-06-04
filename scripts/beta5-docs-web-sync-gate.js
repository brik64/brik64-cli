#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta5-docs-web-sync');
const surfaces = [
  {
    id: 'docs_site',
    file: '/Users/carlosjperez/Documents/GitHub/brik64-docs-site/BETA5_SYNC.md',
    required: ['0.1.0-beta.5', 'candidate_non_release', '@brik64/core@0.1.0-beta.5', 'brik64==0.1.0b5', 'brik64-core@0.1.0-beta.5']
  },
  {
    id: 'web_curl_surface',
    file: '/Users/carlosjperez/Documents/GitHub/brik64.com/docs/BRIK64_CLI_BETA5_SURFACE_SYNC.md',
    required: ['0.1.0-beta.5', 'candidate_non_release', 'portable L4+N5 PCD/BIR runtime bundle', 'GitHub Release']
  }
];

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];
  const artifacts = [];
  for (const surface of surfaces) {
    if (!fs.existsSync(surface.file)) {
      failures.push(`missing_surface:${surface.id}`);
      continue;
    }
    const text = fs.readFileSync(surface.file, 'utf8');
    artifacts.push({
      id: surface.id,
      path: surface.file,
      sha256: sha256File(surface.file),
      bytes: Buffer.byteLength(text, 'utf8')
    });
    for (const needle of surface.required) {
      if (!text.includes(needle)) failures.push(`surface_required_text_missing:${surface.id}:${needle}`);
    }
    if (!text.includes('Do not present beta5 as the current public release')) {
      failures.push(`surface_candidate_boundary_missing:${surface.id}`);
    }
  }
  const report = {
    schemaVersion: 'brik64.cli_beta5_docs_web_sync_gate.v1',
    version: '0.1.0-beta.5',
    decision: failures.length === 0 ? 'PASS_DOCS_WEB_BETA5_SYNC' : 'FAIL_DOCS_WEB_BETA5_SYNC',
    releaseEligible: false,
    deployAllowed: false,
    artifacts,
    failures,
    boundary: 'Docs and web source are beta5-candidate synchronized; production deploy and curl publication remain blocked until release authorization.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write('deployAllowed=false\n');
  if (failures.length > 0) {
    process.stdout.write(`failures=${failures.join(',')}\n`);
    process.exit(1);
  }
}

main();
