#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(root, 'release', 'manifest.json');
const outDir = path.join(root, 'evidence', 'release-web-surface-sync');
const defaultWebRoot = process.env.GITHUB_ACTIONS === 'true'
  ? path.join(process.env.RUNNER_TEMP || '/tmp', 'brik64.com')
  : '/Users/carlosjperez/Documents/GitHub/brik64.com';
const webRoot = path.resolve(process.env.BRIK64_WEB_REPO_ROOT || defaultWebRoot);
const publish = process.argv.includes('--publish');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function run(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    env: options.env || process.env,
    maxBuffer: 8 * 1024 * 1024
  });
  return {
    command: [command, ...args].join(' '),
    rc: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function requireFile(file, failures, id) {
  if (!fs.existsSync(file)) failures.push(`missing_web_file:${id}:${file}`);
}

function replaceRequired(file, pattern, replacement, failures, id) {
  const before = fs.readFileSync(file, 'utf8');
  if (!pattern.test(before)) {
    failures.push(`web_replace_no_match:${id}`);
    return;
  }
  const after = before.replace(pattern, replacement);
  fs.writeFileSync(file, after);
}

function currentBetaNumber(version) {
  const match = version.match(/^0\.1\.0-beta\.(\d+)$/);
  if (!match) throw new Error(`unsupported_cli_beta_version:${version}`);
  return Number(match[1]);
}

function changelogEntry(manifest) {
  const notes = manifest.releaseNotes
    .filter((note) => ['added', 'changed', 'fixed', 'security', 'removed'].includes(note.type))
    .map((note) => `      ${JSON.stringify(note.text)},`)
    .join('\n');
  return `  {
    date: "June 2026",
    version: ${JSON.stringify(manifest.version)},
    title: ${JSON.stringify(`BRIK64 CLI ${manifest.version}`)},
    notes: [
${notes}
    ],
  },`;
}

function syncFiles(manifest) {
  const failures = [];
  const betaNumber = currentBetaNumber(manifest.version);
  const previousBetaPattern = new RegExp(`0\\.1\\.0-beta\\.(?:${Array.from({ length: betaNumber }, (_, i) => i).join('|')})`, 'g');
  const previousPyPattern = new RegExp(`0\\.1\\.0b(?:${Array.from({ length: betaNumber }, (_, i) => i).join('|')})`, 'g');
  const previousBetaWordPattern = new RegExp(`\\b[Bb]eta(?:${Array.from({ length: betaNumber }, (_, i) => i).join('|')})\\b`, 'g');
  const jsSdk = manifest.sdks.find((sdk) => sdk.marketplace === 'npm');
  const pySdk = manifest.sdks.find((sdk) => sdk.marketplace === 'pypi');
  const rustSdk = manifest.sdks.find((sdk) => sdk.marketplace === 'crates.io');
  const packageSha = manifest.cli.package.sha256;
  const releaseManifestFile = path.join(webRoot, 'public', 'cli', 'releases', `${manifest.version}.json`);
  const files = {
    install: path.join(webRoot, 'public', 'cli', 'install.sh'),
    beta: path.join(webRoot, 'public', 'cli', 'beta.json'),
    changelog: path.join(webRoot, 'src', 'app', 'changelog', 'page.tsx'),
    download: path.join(webRoot, 'src', 'app', 'download', 'page.tsx'),
    sdks: path.join(webRoot, 'src', 'app', 'sdks', 'page.tsx')
  };

  for (const [id, file] of Object.entries(files)) requireFile(file, failures, id);
  if (failures.length > 0) return { failures, files };

  replaceRequired(
    files.install,
    /VERSION="\$\{1:-\$\{BRIK64_VERSION:-[^}]+\}\}"/,
    `VERSION="\${1:-\${BRIK64_VERSION:-${manifest.version}}}"`,
    failures,
    'install_version'
  );
  replaceRequired(
    files.install,
    /SHA256_0_1_0_BETA_\d+="[a-f0-9]{64}"/,
    `SHA256_0_1_0_BETA_${betaNumber}="${packageSha}"`,
    failures,
    'install_sha'
  );
  replaceRequired(
    files.install,
    /if \[ "\$VERSION" != "0\.1\.0-beta\.\d+" \]; then/,
    `if [ "$VERSION" != "${manifest.version}" ]; then`,
    failures,
    'install_allowed_version'
  );
  replaceRequired(
    files.install,
    /this installer currently serves 0\.1\.0-beta\.\d+ only; set BRIK64_VERSION=0\.1\.0-beta\.\d+/,
    `this installer currently serves ${manifest.version} only; set BRIK64_VERSION=${manifest.version}`,
    failures,
    'install_fail_message'
  );
  replaceRequired(
    files.install,
    /EXPECTED_SHA="\$SHA256_0_1_0_BETA_\d+"/,
    `EXPECTED_SHA="$SHA256_0_1_0_BETA_${betaNumber}"`,
    failures,
    'install_expected_sha'
  );

  writeJson(files.beta, {
    schemaVersion: 'brik64.cli_channel.v1',
    channel: manifest.channel,
    currentVersion: manifest.version,
    releaseManifest: `/cli/releases/${manifest.version}.json`,
    claimBoundary: `BRIK64 CLI beta channel for local CLI workflow. Beta${betaNumber} installs the portable Node.js CLI package from the signed GitHub Release asset and verifies SHA-256 before activation.`
  });

  writeJson(releaseManifestFile, {
    schemaVersion: 'brik64.cli_release.v1',
    version: manifest.version,
    channel: manifest.channel,
    releaseId: manifest.releaseId,
    installCommand: manifest.cli.installCommand,
    verifyCommand: manifest.cli.verifyCommand,
    package: {
      name: `brik64-cli-${manifest.version}.tgz`,
      url: `https://github.com/brik64/brik64-cli/releases/download/v${manifest.version}/brik64-cli-${manifest.version}.tgz`,
      sha256: packageSha
    },
    sdks: {
      npm: jsSdk ? `${jsSdk.package}@${jsSdk.version}` : null,
      pypi: pySdk ? `${pySdk.package}==${pySdk.version}` : null,
      crates: rustSdk ? `${rustSdk.package}@${rustSdk.version}` : null
    },
    publicReferences: {
      github: manifest.publicSurfaces.githubRelease.url,
      packageManifest: `https://github.com/brik64/brik64-cli/releases/download/v${manifest.version}/package.manifest.json`,
      checksums: `https://github.com/brik64/brik64-cli/releases/download/v${manifest.version}/SHA256SUMS`
    },
    claimBoundary: 'Public beta CLI release metadata. This manifest describes installable package routing and does not assert formal correctness, self-hosting, fixpoint, or toolchain independence.'
  });

  let changelog = fs.readFileSync(files.changelog, 'utf8');
  if (!changelog.includes(`version: "${manifest.version}"`)) {
    changelog = changelog.replace(/const releases = \[\n/, `const releases = [\n${changelogEntry(manifest)}\n`);
    fs.writeFileSync(files.changelog, changelog);
  }

  for (const file of [files.download, files.sdks]) {
    let text = fs.readFileSync(file, 'utf8');
    text = text
      .replace(previousBetaPattern, manifest.version)
      .replace(previousPyPattern, pySdk?.version || manifest.version)
      .replace(previousBetaWordPattern, (value) => value[0] === 'B' ? `Beta${betaNumber}` : `beta${betaNumber}`);
    if (jsSdk) text = text.replace(/@brik64\/core@0\.1\.0-beta\.\d+/g, `${jsSdk.package}@${jsSdk.version}`);
    if (pySdk) text = text.replace(/brik64==0\.1\.0b\d+/g, `${pySdk.package}==${pySdk.version}`);
    if (rustSdk) text = text.replace(/brik64-core(?:@| --version )0\.1\.0-beta\.\d+/g, (match) => match.includes('--version') ? `${rustSdk.package} --version ${rustSdk.version}` : `${rustSdk.package}@${rustSdk.version}`);
    fs.writeFileSync(file, text);
  }

  return { failures, files: { ...files, releaseManifest: releaseManifestFile } };
}

function ensureRepo(failures) {
  if (fs.existsSync(path.join(webRoot, '.git'))) return;
  if (!publish) {
    failures.push(`web_repo_missing:${webRoot}`);
    return;
  }
  fs.mkdirSync(path.dirname(webRoot), { recursive: true });
  const clone = run('gh', ['repo', 'clone', 'brik64-admin/brik64.com', webRoot], { cwd: path.dirname(webRoot) });
  if (clone.rc !== 0) failures.push(`web_repo_clone_failed:${clone.rc}`);
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = readJson(manifestPath);
  const failures = [];
  ensureRepo(failures);
  if (failures.length === 0) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      const fetch = run('git', ['fetch', 'origin', 'main'], { cwd: webRoot });
      const checkout = fetch.rc === 0
        ? run('git', ['checkout', '-B', 'main', 'origin/main'], { cwd: webRoot })
        : { rc: 0 };
      if (fetch.rc !== 0) failures.push(`web_fetch_main_failed:${fetch.rc}`);
      if (checkout.rc !== 0) failures.push(`web_checkout_main_failed:${checkout.rc}`);
    } else {
      const checkout = run('git', ['checkout', 'main'], { cwd: webRoot });
      const remote = run('git', ['remote', 'get-url', 'origin'], { cwd: webRoot });
      const pull = remote.rc === 0
        ? run('git', ['pull', '--ff-only', 'origin', 'main'], { cwd: webRoot })
        : { rc: 0 };
      if (checkout.rc !== 0) failures.push(`web_checkout_main_failed:${checkout.rc}`);
      if (pull.rc !== 0) failures.push(`web_pull_main_failed:${pull.rc}`);
    }
  }

  const sync = failures.length === 0 ? syncFiles(manifest) : { failures: [], files: {} };
  failures.push(...sync.failures);
  const statusBeforeCommit = failures.length === 0 ? run('git', ['status', '--short'], { cwd: webRoot }).stdout.trim() : '';
  let commit = null;
  let pushed = false;

  if (publish && failures.length === 0 && statusBeforeCommit) {
    run('git', ['add', 'public/cli/install.sh', 'public/cli/beta.json', `public/cli/releases/${manifest.version}.json`, 'src/app/changelog/page.tsx', 'src/app/download/page.tsx', 'src/app/sdks/page.tsx'], { cwd: webRoot });
    const commitResult = run('git', ['commit', '-m', `Align public web surface to ${manifest.version}`], { cwd: webRoot });
    if (commitResult.rc !== 0) failures.push(`web_commit_failed:${commitResult.rc}`);
    else {
      commit = run('git', ['rev-parse', 'HEAD'], { cwd: webRoot }).stdout.trim();
      const push = run('git', ['push', 'origin', 'HEAD:main'], { cwd: webRoot });
      if (push.rc !== 0) failures.push(`web_push_main_failed:${push.rc}`);
      else pushed = true;
    }
  }

  const observations = [];
  if (failures.length === 0) {
    for (const [id, file] of Object.entries(sync.files)) {
      observations.push({
        id,
        path: path.relative(webRoot, file),
        sha256: sha256File(file),
        bytes: fs.statSync(file).size
      });
    }
  }

  const report = {
    schemaVersion: 'brik64.release_web_surface_sync_report.v1',
    releaseId: manifest.releaseId,
    version: manifest.version,
    publishRequested: publish,
    decision: failures.length === 0
      ? publish
        ? 'PASS_RELEASE_WEB_SURFACE_SYNC'
        : 'PASS_RELEASE_WEB_SURFACE_SYNC_DRY_RUN'
      : 'FAIL_RELEASE_WEB_SURFACE_SYNC',
    webRoot,
    changedBeforeCommit: Boolean(statusBeforeCommit),
    commit,
    pushed,
    observations,
    failures,
    boundary: 'Materializes brik64.com public CLI/web release files from release/manifest.json. It does not assert formal compiler correctness.'
  };
  writeJson(path.join(outDir, 'report.json'), report);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`changedBeforeCommit=${report.changedBeforeCommit}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
