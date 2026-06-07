#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.9';
const pyVersion = '0.1.0b9';
const docsRoot = process.env.BRIK64_DOCS_ROOT || '/Users/carlosjperez/Documents/GitHub/brik64-docs-site';
const webRoot = process.env.BRIK64_WEB_ROOT || '/Users/carlosjperez/Documents/GitHub/brik64.com';
const skillsRoot = process.env.BRIK64_SKILLS_ROOT || '/Users/carlosjperez/Documents/GitHub/brik64-tools-skills';
const outDir = path.join(root, 'evidence', 'beta9-public-surfaces');

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function sha256File(file) {
  return sha256Text(fs.readFileSync(file));
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function existsFile(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

function relOrAbs(file) {
  return path.isAbsolute(file) ? file : path.join(root, file);
}

function artifact(file) {
  if (!existsFile(file)) return { path: file, exists: false };
  const text = read(file);
  return {
    path: file,
    exists: true,
    sha256: sha256Text(text),
    bytes: Buffer.byteLength(text, 'utf8')
  };
}

function rg(cwd, args) {
  if (!fs.existsSync(cwd)) return [`missing_root:${cwd}`];
  const result = spawnSync('rg', args, { cwd, encoding: 'utf8' });
  return (result.stdout || '').split('\n').filter(Boolean);
}

function checkText(id, file, required, forbidden, failures, artifacts) {
  artifacts.push({ id, ...artifact(file) });
  if (!existsFile(file)) {
    failures.push(`missing_surface:${id}`);
    return '';
  }
  const text = read(file);
  for (const needle of required) {
    if (!text.includes(needle)) failures.push(`required_text_missing:${id}:${needle}`);
  }
  for (const pattern of forbidden) {
    if (pattern.test(text)) failures.push(`forbidden_text_present:${id}:${pattern.source}`);
  }
  return text;
}

function writeReport(name, report) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  if (report.failures?.length) process.stdout.write(`failures=${report.failures.join(',')}\n`);
  process.exit(report.decision.startsWith('PASS_') ? 0 : 2);
}

function docsWebChangelog() {
  const failures = [];
  const artifacts = [];
  const forbidden = [
    /\bL[456]\+?N5\b/i,
    /\bfixpoint\b/i,
    /\bself-host(?:ing)?\b/i,
    /Hetzner/i,
    /1Password/i
  ];
  const docsFiles = [
    ['docs_install', path.join(docsRoot, 'cli/install.mdx'), [version, 'v0.1.0-beta.9', 'brik64-cli-0.1.0-beta.9.tgz']],
    ['docs_changelog', path.join(docsRoot, 'releases/changelog.mdx'), [version, 'TypeScript', 'Rust', 'Python']],
    ['docs_sdks', path.join(docsRoot, 'sdks.mdx'), ['@brik64/core@0.1.0-beta.9', 'brik64==0.1.0b9', 'brik64-core@0.1.0-beta.9']],
    ['docs_js_sdk', path.join(docsRoot, 'sdks/javascript.mdx'), ['@brik64/core@0.1.0-beta.9']],
    ['docs_python_sdk', path.join(docsRoot, 'sdks/python.mdx'), ['brik64==0.1.0b9']],
    ['docs_rust_sdk', path.join(docsRoot, 'sdks/rust.mdx'), ['brik64-core@0.1.0-beta.9']],
    ['docs_llms', path.join(docsRoot, 'llms-full.txt'), [version]]
  ];
  const webFiles = [
    ['web_cli_api', path.join(webRoot, 'functions/api/download/cli.ts'), [version]],
    ['web_sdk_api', path.join(webRoot, 'functions/api/download/sdk/[target].ts'), ['0.1.0-beta.9', '0.1.0b9']],
    ['web_language_data', path.join(webRoot, 'src/lib/language-data.ts'), ['@brik64/core@0.1.0-beta.9', 'brik64==0.1.0b9', '0.1.0-beta.9']]
  ];

  for (const [id, file, required] of [...docsFiles, ...webFiles]) {
    checkText(id, file, required, forbidden, failures, artifacts);
  }
  const homeCommandRefs = rg(webRoot, ['-n', 'curl -fsSL https://brik64\\.com/cli/install\\.sh \\| bash', 'src', 'components', 'functions', '-g', '!node_modules/**', '-g', '!.next/**']);
  if (homeCommandRefs.length === 0) failures.push('web_install_command_source_missing');
  artifacts.push({ id: 'web_install_command_refs', refs: homeCommandRefs.slice(0, 20), count: homeCommandRefs.length });

  for (const stale of rg(docsRoot, ['-n', '0\\.1\\.0-beta\\.[45678]|0\\.1\\.0b[45678]|beta[45678]', '-g', '!node_modules/**', '-g', '!.git/**', '-g', '!BETA*_SYNC.md', '-g', '!docs/operations/**'])) {
    failures.push(`docs_stale_version:${stale}`);
  }
  for (const stale of rg(webRoot, ['-n', '0\\.1\\.0-beta\\.[45678]|0\\.1\\.0b[45678]|beta[45678]', '-g', '!node_modules/**', '-g', '!.git/**', '-g', '!.next/**', '-g', '!out/**', '-g', '!src/lib/cms/generated-public-content.json', '-g', '!docs/**'])) {
    failures.push(`web_stale_version:${stale}`);
  }

  writeReport('docs-web-changelog', {
    schemaVersion: 'brik64.beta9_docs_web_changelog_surface.v1',
    generatedAt: new Date().toISOString(),
    decision: failures.length === 0 ? 'PASS_BETA9_DOCS_WEB_CHANGELOG' : 'BLOCKED_BETA9_DOCS_WEB_CHANGELOG',
    version,
    publicSurfacePassed: failures.length === 0,
    releaseEligible: failures.length === 0,
    docsRoot,
    webRoot,
    artifacts,
    failures,
    requiredNextAction: failures.length === 0
      ? 'Deploy docs and web in the atomic beta9 release train.'
      : 'Update docs/web/changelog source to beta9, remove stale beta residues, then deploy and live-verify.'
  });
}

function sdkMarketplaces() {
  const failures = [];
  const observations = [];
  const localPackage = JSON.parse(read(path.join(root, 'evidence/beta9-package/package.manifest.json')));
  const expected = [
    { id: 'npm', package: '@brik64/core', version },
    { id: 'pypi', package: 'brik64', version: pyVersion },
    { id: 'crates', package: 'brik64-core', version }
  ];
  for (const item of expected) {
    observations.push({ ...item, status: 'not_live_verified_in_this_gate' });
    failures.push(`marketplace_publication_evidence_missing:${item.id}:${item.package}@${item.version}`);
  }
  writeReport('sdk-marketplaces', {
    schemaVersion: 'brik64.beta9_sdk_marketplaces_surface.v1',
    generatedAt: new Date().toISOString(),
    decision: 'BLOCKED_BETA9_SDK_MARKETPLACES',
    version,
    publicSurfacePassed: false,
    releaseEligible: false,
    localCliPackage: localPackage.package,
    expected,
    observations,
    failures,
    requiredNextAction: 'Publish and verify npm, PyPI and crates.io SDK packages for beta9, or record explicit no-change-required evidence accepted by the release gate.'
  });
}

function skillsSync() {
  const failures = [];
  const artifacts = [];
  const files = [
    'README.md',
    'skills/brik64/SKILL.md',
    'skills/brik64-javascript/SKILL.md',
    'skills/brik64-python/SKILL.md',
    'skills/brik64-rust/SKILL.md',
    'skills/pcd-system/SKILL.md'
  ];
  for (const rel of files) {
    const file = path.join(skillsRoot, rel);
    const text = checkText(rel, file, [], [/\bL[456]\+?N5\b/i, /\bfixpoint\b/i, /Hetzner/i, /1Password/i], failures, artifacts);
    if (text && /0\.1\.0-beta\.[45678]|0\.1\.0b[45678]|beta[45678]/.test(text)) failures.push(`skill_stale_version:${rel}`);
  }
  const brik64 = path.join(skillsRoot, 'skills/brik64/SKILL.md');
  if (existsFile(brik64)) {
    const text = read(brik64);
    if (!text.includes(`version: ${version}`)) failures.push('brik64_skill_version_missing');
    if (!text.includes(`Public CLI version: \`${version}\``) && !text.includes('Public CLI version: dynamic')) failures.push('brik64_skill_public_version_boundary_missing');
  }
  writeReport('skills-sync', {
    schemaVersion: 'brik64.beta9_skills_sync_surface.v1',
    generatedAt: new Date().toISOString(),
    decision: failures.length === 0 ? 'PASS_BETA9_SKILLS_SYNC' : 'BLOCKED_BETA9_SKILLS_SYNC',
    version,
    publicSurfacePassed: failures.length === 0,
    releaseEligible: failures.length === 0,
    skillsRoot,
    artifacts,
    failures,
    requiredNextAction: failures.length === 0
      ? 'Publish public skills repository in the atomic beta9 release train.'
      : 'Update public skills to beta9 and remove stale/private language before publication.'
  });
}

function liveVerify() {
  const releaseManifest = path.join(root, 'release', 'manifest.json');
  const failures = [];
  const artifacts = [];
  if (!existsFile(releaseManifest)) {
    failures.push('release_manifest_missing');
  } else {
    artifacts.push({ id: 'release_manifest', ...artifact(releaseManifest) });
    const manifest = JSON.parse(read(releaseManifest));
    if (manifest.version !== version) failures.push(`release_manifest_version_drift:${manifest.version || 'missing'}`);
    if (manifest.state !== 'public') failures.push(`release_manifest_state_not_public:${manifest.state || 'missing'}`);
  }
  failures.push('live_public_verification_not_run_for_beta9');
  writeReport('live-verify', {
    schemaVersion: 'brik64.beta9_live_verify_surface.v1',
    generatedAt: new Date().toISOString(),
    decision: 'BLOCKED_BETA9_LIVE_VERIFY',
    version,
    publicSurfacePassed: false,
    releaseEligible: false,
    artifacts,
    failures,
    requiredNextAction: 'After atomic publication, update release/manifest.json to beta9 and run scripts/release-train-live-verify.js against live public URLs.'
  });
}

const mode = process.argv[2];
if (mode === 'docs-web-changelog') docsWebChangelog();
else if (mode === 'sdk-marketplaces') sdkMarketplaces();
else if (mode === 'skills-sync') skillsSync();
else if (mode === 'live-verify') liveVerify();
else {
  process.stderr.write('usage: beta9-public-surface-gate.js <docs-web-changelog|sdk-marketplaces|skills-sync|live-verify>\n');
  process.exit(2);
}
