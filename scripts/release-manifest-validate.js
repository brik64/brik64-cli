#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const defaultManifest = path.join(root, 'release', 'manifest.json');
const outDir = path.join(root, 'evidence', 'release-manifest-validate');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function gitOutput(args) {
  return childProcess.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function versionSection(changelog, version) {
  const marker = `## ${version}`;
  const start = changelog.indexOf(marker);
  if (start === -1) return '';
  const rest = changelog.slice(start);
  const next = rest.indexOf('\n## ', marker.length);
  return next === -1 ? rest : rest.slice(0, next);
}

function add(condition, failures, code) {
  if (!condition) failures.push(code);
}

function containsForbiddenPublicLanguage(text) {
  const patterns = [
    /\bL[456]\+?N5\b/i,
    /\broute-?2\b/i,
    /\bfactory bridge\b/i,
    /\binternal artifact factory\b/i,
    /\bHetzner\b/i,
    /\b1Password\b/i,
    /\bmethodology\b/i,
    /\bapproval\b/i,
    /\bauthorization\b/i,
    /\bdecision\b/i,
    /\bclaim boundary\b/i,
    /\bpreflight\b/i
  ];
  return patterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.toString());
}

function validate() {
  const manifestPath = path.resolve(root, argValue('--manifest', defaultManifest));
  const failures = [];
  const warnings = [];
  const artifacts = {};

  add(fs.existsSync(manifestPath), failures, 'manifest_missing');
  if (!fs.existsSync(manifestPath)) {
    return { manifestPath, failures, warnings, artifacts };
  }

  const manifestText = readText(manifestPath);
  const manifest = JSON.parse(manifestText);
  artifacts.manifest = {
    path: path.relative(root, manifestPath),
    sha256: sha256(manifestText),
    bytes: Buffer.byteLength(manifestText)
  };

  const packageJsonPath = path.join(root, 'package.json');
  const packageJson = readJson(packageJsonPath);
  const readme = readText(path.join(root, 'README.md'));
  const changelog = readText(path.join(root, 'CHANGELOG.md'));
  const changelogSection = versionSection(changelog, manifest.version);

  add(manifest.schemaVersion === 'brik64.release_manifest.v1', failures, 'schema_version_invalid');
  add(/^0\.\d+\.\d+-(beta|rc)\.\d+$|^\d+\.\d+\.\d+$/.test(manifest.version), failures, 'version_format_invalid');
  add(manifest.releaseId === `brik64-${manifest.version}`, failures, 'release_id_version_drift');
  add(['draft', 'dry_run_passed', 'publishing', 'public', 'failed', 'superseded'].includes(manifest.state), failures, 'state_invalid');
  add(packageJson.version === manifest.version, failures, `package_version_drift:${packageJson.version}`);
  add(readme.includes(`Current public beta: \`${manifest.version}\``), failures, 'readme_current_version_drift');
  add(changelog.includes(`## ${manifest.version}`), failures, 'changelog_version_missing');
  add(changelogSection.length > 0, failures, 'changelog_section_missing');
  add(!/candidate_non_release|^## .+ - Candidate/im.test(changelogSection), failures, 'changelog_candidate_boundary_stale');

  const forbiddenChangelog = containsForbiddenPublicLanguage(changelogSection);
  if (forbiddenChangelog.length > 0) failures.push(`changelog_internal_language:${forbiddenChangelog.join('|')}`);

  add(Array.isArray(manifest.releaseNotes) && manifest.releaseNotes.length > 0, failures, 'release_notes_missing');
  for (const [index, note] of (manifest.releaseNotes || []).entries()) {
    add(['added', 'changed', 'fixed', 'removed', 'security'].includes(note.type), failures, `release_note_type_invalid:${index}`);
    add(typeof note.surface === 'string' && note.surface.length > 0, failures, `release_note_surface_missing:${index}`);
    add(typeof note.text === 'string' && note.text.length > 20, failures, `release_note_text_missing:${index}`);
    const forbiddenNote = containsForbiddenPublicLanguage(note.text || '');
    if (forbiddenNote.length > 0) failures.push(`release_note_internal_language:${index}:${forbiddenNote.join('|')}`);
  }

  const requiredSurfaces = ['githubRelease', 'curlInstaller', 'channelManifest', 'web', 'docs', 'skills'];
  for (const surface of requiredSurfaces) {
    add(manifest.publicSurfaces?.[surface]?.required === true, failures, `required_surface_missing:${surface}`);
  }

  const sdkByMarketplace = new Map((manifest.sdks || []).map((sdk) => [sdk.marketplace, sdk]));
  add(sdkByMarketplace.get('npm')?.version === manifest.version, failures, 'npm_sdk_version_drift');
  add(sdkByMarketplace.get('pypi')?.version === manifest.version.replace('-beta.', 'b'), failures, 'pypi_sdk_version_drift');
  add(sdkByMarketplace.get('crates.io')?.version === manifest.version, failures, 'rust_sdk_version_drift');

  const evidence = [];
  for (const item of manifest.verification?.requiredEvidence || []) {
    const evidencePath = path.join(root, item.path);
    if (!fs.existsSync(evidencePath)) {
      failures.push(`evidence_missing:${item.id}`);
      continue;
    }
    const parsed = readJson(evidencePath);
    const decision = parsed.decision;
    const text = readText(evidencePath);
    evidence.push({
      id: item.id,
      path: item.path,
      expectedDecision: item.decision,
      actualDecision: decision,
      sha256: sha256(text)
    });
    if (decision !== item.decision) failures.push(`evidence_decision_drift:${item.id}:${decision || 'missing'}`);
  }

  const status = gitOutput(['status', '--porcelain']);
  const dirtyFiles = status
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter((file) => ![
      'evidence/release-manifest-validate/report.json',
      'evidence/release-train-dry-run/report.json'
    ].includes(file));
  const allowDirty = process.argv.includes('--allow-dirty');
  if (dirtyFiles.length > 0 && !allowDirty) failures.push(`worktree_dirty:${dirtyFiles.length}`);
  if (dirtyFiles.length > 0 && allowDirty) warnings.push(`worktree_dirty_allowed:${dirtyFiles.length}`);

  artifacts.packageJson = { path: 'package.json', version: packageJson.version };
  artifacts.evidence = evidence;

  return {
    schemaVersion: 'brik64.release_manifest_validation_report.v1',
    manifestPath: path.relative(root, manifestPath),
    version: manifest.version,
    state: manifest.state,
    manifestDigest: artifacts.manifest.sha256,
    decision: failures.length === 0 ? 'PASS_RELEASE_MANIFEST_VALIDATE' : 'FAIL_RELEASE_MANIFEST_VALIDATE',
    releaseEligible: failures.length === 0 && manifest.state === 'public',
    artifacts,
    failures,
    warnings
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const report = validate();
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`version=${report.version || 'unknown'}\n`);
  if (report.failures?.length) process.stdout.write(`failures=${report.failures.join(',')}\n`);
  if (report.warnings?.length) process.stdout.write(`warnings=${report.warnings.join(',')}\n`);
  if (report.failures?.length) process.exit(1);
}

main();
