#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
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
  return childProcess.execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function currentGitHead() {
  if (process.env.BRIK64_RELEASE_MANIFEST_EXPECTED_HEAD) {
    return process.env.BRIK64_RELEASE_MANIFEST_EXPECTED_HEAD;
  }
  try {
    return gitOutput(['rev-parse', 'HEAD']);
  } catch {
    return null;
  }
}

function isAncestorCommit(candidate, descendant = 'HEAD') {
  if (!candidate) return false;
  const result = childProcess.spawnSync('git', ['merge-base', '--is-ancestor', candidate, descendant], {
    cwd: root,
    encoding: 'utf8',
  });
  return result.status === 0;
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

function pypiVersion(version) {
  const match = String(version).match(/^(\d+\.\d+\.\d+)-beta\.(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) return String(version);
  const [, base, beta, post, patch] = match;
  if (!post) return `${base}b${beta}`;
  if (!patch) return `${base}b${beta}.post${post}`;
  return `${base}b${beta}.post${post}${String(patch).padStart(2, '0')}`;
}

function isBeta15_7CliOnlyHotfix(version, sdk) {
  return /^0\.1\.0-beta\.15\.7(?:\.\d+)?$/.test(String(version))
    && sdk?.publication === 'unchanged_from_beta15_7_until_sdk_hotfix';
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
  add(/^0\.\d+\.\d+-(beta|rc)\.\d+(?:\.\d+)*$|^\d+\.\d+\.\d+$/.test(manifest.version), failures, 'version_format_invalid');
  add(manifest.releaseId === `brik64-${manifest.version}`, failures, 'release_id_version_drift');
  add(['draft', 'dry_run_passed', 'publishing', 'public', 'failed', 'superseded'].includes(manifest.state), failures, 'state_invalid');
  add(packageJson.version === manifest.version, failures, `package_version_drift:${packageJson.version}`);
  const sourceCommit = manifest.source?.commit;
  const sourceCommitBinding = manifest.source?.commitBinding || null;
  const head = currentGitHead();
  add(typeof sourceCommit === 'string' && /^[a-f0-9]{40}$/i.test(sourceCommit), failures, 'source_commit_invalid');
  if (manifest.state === 'public') {
    add(
      ['release_ref_exact', 'public_release_base_commit'].includes(sourceCommitBinding),
      failures,
      `source_commit_binding_invalid_for_public:${sourceCommitBinding || 'missing'}`
    );
    if (head && sourceCommit && sourceCommitBinding === 'release_ref_exact') {
      add(sourceCommit === head, failures, `source_commit_not_current_head:${sourceCommit}:${head}`);
    }
    if (head && sourceCommit && sourceCommitBinding === 'public_release_base_commit') {
      add(isAncestorCommit(sourceCommit, head), failures, `source_commit_not_ancestor:${sourceCommit}:${head}`);
    }
  } else {
    add(
      ['candidate_base_commit', 'release_ref_exact'].includes(sourceCommitBinding),
      failures,
      `source_commit_binding_invalid_for_candidate:${sourceCommitBinding || 'missing'}`
    );
    if (sourceCommitBinding === 'release_ref_exact' && head && sourceCommit) {
      add(sourceCommit === head, failures, `source_commit_not_current_head:${sourceCommit}:${head}`);
    }
  }
  if (manifest.state === 'public') {
    add(readme.includes(`Current public beta: \`${manifest.version}\``), failures, 'readme_current_version_drift');
  } else {
    add(readme.includes(`Current beta candidate: \`${manifest.version}\``), failures, 'readme_candidate_version_drift');
  }
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
  const npmSdk = sdkByMarketplace.get('npm');
  const pypiSdk = sdkByMarketplace.get('pypi');
  const rustSdk = sdkByMarketplace.get('crates.io');
  add(
    npmSdk?.version === manifest.version
      || (isBeta15_7CliOnlyHotfix(manifest.version, npmSdk) && npmSdk?.version === '0.1.0-beta.15.7'),
    failures,
    'npm_sdk_version_drift'
  );
  add(
    pypiSdk?.version === pypiVersion(manifest.version)
      || (isBeta15_7CliOnlyHotfix(manifest.version, pypiSdk) && pypiSdk?.version === '0.1.0b15.post7'),
    failures,
    'pypi_sdk_version_drift'
  );
  add(
    rustSdk?.version === manifest.version
      || (isBeta15_7CliOnlyHotfix(manifest.version, rustSdk) && rustSdk?.version === '0.1.0-beta.15.7'),
    failures,
    'rust_sdk_version_drift'
  );

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

  let status = '';
  try {
    status = gitOutput(['status', '--porcelain']);
  } catch (error) {
    warnings.push('git_status_unavailable');
  }
  const dirtyFiles = status
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter((file) => ![
      'evidence/cli-l6-generation-required/report.json',
      'evidence/release-flow-audit/report.json',
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
