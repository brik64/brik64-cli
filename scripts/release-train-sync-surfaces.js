#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'release', 'manifest.json');
const outDir = path.join(root, 'evidence', 'release-train-sync');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function releaseNotesMarkdown(manifest) {
  const grouped = new Map();
  for (const note of manifest.releaseNotes) {
    if (!grouped.has(note.type)) grouped.set(note.type, []);
    grouped.get(note.type).push(note);
  }
  const titles = {
    added: 'Added',
    changed: 'Changed',
    fixed: 'Fixed',
    removed: 'Removed',
    security: 'Security'
  };
  const lines = [`## ${manifest.version}`, ''];
  for (const [type, notes] of grouped.entries()) {
    lines.push(`### ${titles[type] || type}`, '');
    for (const note of notes) lines.push(`- ${note.text}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifestText = fs.readFileSync(manifestPath, 'utf8');
  const manifest = readJson(manifestPath);
  const failures = [];

  const markdown = releaseNotesMarkdown(manifest);
  const forbidden = /\bHetzner\b|\b1Password\b|\bL[456]\+?N5\b|\bN5\b|\binternal artifact factory\b|\bapproval\b|\bauthorization\b|\bmethodology\b/i;
  if (forbidden.test(markdown)) failures.push('public_release_notes_internal_language');
  if (!markdown.includes(manifest.version)) failures.push('release_notes_version_missing');

  const payload = {
    schemaVersion: 'brik64.release_train_sync_payload.v1',
    releaseId: manifest.releaseId,
    version: manifest.version,
    channel: manifest.channel,
    state: manifest.state,
    manifestDigest: sha256(manifestText),
    installCommand: manifest.cli.installCommand,
    githubReleaseUrl: manifest.publicSurfaces.githubRelease.url,
    sdkInstall: Object.fromEntries(manifest.sdks.map((sdk) => [sdk.language, {
      marketplace: sdk.marketplace,
      package: sdk.package,
      version: sdk.version
    }])),
    changelogMarkdown: markdown,
    releaseNotes: manifest.releaseNotes
  };

  fs.writeFileSync(path.join(outDir, 'changelog.md'), markdown);
  fs.writeFileSync(path.join(outDir, 'sync-payload.json'), `${JSON.stringify(payload, null, 2)}\n`);

  const report = {
    schemaVersion: 'brik64.release_train_sync_report.v1',
    releaseId: manifest.releaseId,
    version: manifest.version,
    decision: failures.length === 0 ? 'PASS_RELEASE_TRAIN_SYNC_SURFACES' : 'FAIL_RELEASE_TRAIN_SYNC_SURFACES',
    publicationAllowed: false,
    artifacts: {
      changelogMarkdown: {
        path: 'evidence/release-train-sync/changelog.md',
        sha256: sha256(markdown)
      },
      syncPayload: {
        path: 'evidence/release-train-sync/sync-payload.json',
        sha256: sha256(JSON.stringify(payload, null, 2) + '\n')
      }
    },
    failures,
    boundary: 'Generates docs/web/skills sync payload from release manifest. Does not dispatch or publish.'
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write('publicationAllowed=false\n');
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
