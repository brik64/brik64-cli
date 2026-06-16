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

function replaceOptional(file, pattern, replacement) {
  const before = fs.readFileSync(file, 'utf8');
  if (!pattern.test(before)) return false;
  fs.writeFileSync(file, before.replace(pattern, replacement));
  return true;
}

function currentBetaNumber(version) {
  const match = version.match(/^0\.1\.0-beta\.(\d+)(?:\.\d+)?$/);
  if (!match) throw new Error(`unsupported_cli_beta_version:${version}`);
  return Number(match[1]);
}

function betaDisplayLabel(version) {
  const match = version.match(/^0\.1\.0-beta\.(\d+(?:\.\d+)?)$/);
  if (!match) throw new Error(`unsupported_cli_beta_version:${version}`);
  return `Beta${match[1]}`;
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
  const betaLabel = betaDisplayLabel(manifest.version);
  const previousBetas = Array.from({ length: betaNumber + 1 }, (_, i) => i).sort((a, b) => b - a).join('|');
  const previousBetaPattern = new RegExp(`0\\.1\\.0-beta\\.(?:${previousBetas})(?:\\.\\d+)?(?!\\d)`, 'g');
  const previousPyPattern = new RegExp(`0\\.1\\.0b(?:${previousBetas})(?:\\.post\\d+)?(?!\\d)`, 'g');
  const previousBetaWordPattern = new RegExp(`\\b[Bb]eta(?:${Array.from({ length: betaNumber }, (_, i) => i).join('|')})\\b`, 'g');
  const currentBetaPatchWordPattern = new RegExp(`\\b[Bb]eta${betaNumber}\\.\\d+\\b`, 'g');
  const jsSdk = manifest.sdks.find((sdk) => sdk.marketplace === 'npm');
  const pySdk = manifest.sdks.find((sdk) => sdk.marketplace === 'pypi');
  const rustSdk = manifest.sdks.find((sdk) => sdk.marketplace === 'crates.io');
  const githubReleaseUrl = manifest.publicSurfaces.githubRelease.url
    || `https://github.com/brik64/brik64-cli/releases/tag/${manifest.publicSurfaces.githubRelease.tag || `v${manifest.version}`}`;
  const packageSha = manifest.cli.package.sha256;
  const releaseManifestFile = path.join(webRoot, 'public', 'cli', 'releases', `${manifest.version}.json`);
  const files = {
    install: path.join(webRoot, 'public', 'cli', 'install.sh'),
    beta: path.join(webRoot, 'public', 'cli', 'beta.json'),
    changelog: path.join(webRoot, 'src', 'app', 'changelog', 'page.tsx'),
    download: path.join(webRoot, 'src', 'app', 'download', 'page.tsx'),
    sdks: path.join(webRoot, 'src', 'app', 'sdks', 'page.tsx'),
    sdkDownloadApi: path.join(webRoot, 'functions', 'api', 'download', 'sdk', '[target].ts')
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
  replaceOptional(
    files.install,
    /SHA256_0_1_0_BETA_\d+="[a-f0-9]{64}"/,
    `SHA256_0_1_0_BETA_${betaNumber}="${packageSha}"`
  );
  replaceRequired(
    files.install,
    /if \[ "\$VERSION" != "0\.1\.0-beta\.\d+(?:\.\d+)?" \]; then/,
    `if [ "$VERSION" != "${manifest.version}" ]; then`,
    failures,
    'install_allowed_version'
  );
  replaceRequired(
    files.install,
    /this installer currently serves 0\.1\.0-beta\.\d+(?:\.\d+)? only; set BRIK64_VERSION=0\.1\.0-beta\.\d+(?:\.\d+)?/,
    `this installer currently serves ${manifest.version} only; set BRIK64_VERSION=${manifest.version}`,
    failures,
    'install_fail_message'
  );
  replaceOptional(
    files.install,
    /EXPECTED_SHA="\$SHA256_0_1_0_BETA_\d+"/,
    `EXPECTED_SHA="$SHA256_0_1_0_BETA_${betaNumber}"`
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
      npm: jsSdk ? `${jsSdk.name}@${jsSdk.version}` : null,
      pypi: pySdk ? `${pySdk.name}==${pySdk.version}` : null,
      crates: rustSdk ? `${rustSdk.name}@${rustSdk.version}` : null
    },
    publicReferences: {
      github: githubReleaseUrl,
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

  for (const file of [files.download, files.sdks, files.sdkDownloadApi]) {
    let text = fs.readFileSync(file, 'utf8');
    text = text
      .replace(previousBetaPattern, manifest.version)
      .replace(previousPyPattern, pySdk?.version || manifest.version)
      .replace(currentBetaPatchWordPattern, (value) => value[0] === 'B' ? betaLabel : betaLabel.toLowerCase())
      .replace(previousBetaWordPattern, (value) => value[0] === 'B' ? `Beta${betaNumber}` : `beta${betaNumber}`);
    if (jsSdk) text = text.replace(/@brik64\/core@0\.1\.0-beta\.\d+(?:\.\d+)?|undefined@0\.1\.0-beta\.\d+(?:\.\d+)?/g, `${jsSdk.name}@${jsSdk.version}`);
    if (pySdk) text = text.replace(/brik64==0\.1\.0b\d+(?:\.post\d+)?|undefined==0\.1\.0b\d+(?:\.post\d+)?/g, `${pySdk.name}==${pySdk.version}`);
    if (rustSdk) text = text.replace(/brik64-core(?:@| --version )0\.1\.0-beta\.\d+(?:\.\d+)?|undefined(?:@| --version )0\.1\.0-beta\.\d+(?:\.\d+)?/g, (match) => match.includes('--version') ? `${rustSdk.name} --version ${rustSdk.version}` : `${rustSdk.name}@${rustSdk.version}`);
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
  const token = process.env.BRIK64_WEB_DEPLOY_TOKEN || process.env.GH_TOKEN || '';
  const repoUrl = token
    ? `https://x-access-token:${token}@github.com/brik64-admin/brik64.com.git`
    : 'https://github.com/brik64-admin/brik64.com.git';
  const clone = run('git', ['clone', '--branch', 'main', '--depth', '1', repoUrl, webRoot], { cwd: path.dirname(webRoot) });
  if (clone.rc !== 0) failures.push(`web_repo_clone_failed:${clone.rc}`);
}

function gitOutput(result) {
  return {
    command: result.command || '',
    rc: result.rc,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  };
}

function configureGitIdentity(failures, observations) {
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  const email = process.env.BRIK64_RELEASE_GIT_EMAIL || 'release-bot@brik64.com';
  const name = process.env.BRIK64_RELEASE_GIT_NAME || 'BRIK64 Release Bot';
  const emailResult = run('git', ['config', 'user.email', email], { cwd: webRoot });
  const nameResult = run('git', ['config', 'user.name', name], { cwd: webRoot });
  observations.push({ id: 'git_config_user_email', ...gitOutput(emailResult) });
  observations.push({ id: 'git_config_user_name', ...gitOutput(nameResult) });
  if (emailResult.rc !== 0) failures.push(`web_git_config_email_failed:${emailResult.rc}`);
  if (nameResult.rc !== 0) failures.push(`web_git_config_name_failed:${nameResult.rc}`);
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = readJson(manifestPath);
  const failures = [];
  const observations = [];
  ensureRepo(failures);
  if (failures.length === 0) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      const checkout = run('git', ['checkout', 'main'], { cwd: webRoot });
      observations.push({ id: 'web_checkout_main', ...gitOutput(checkout) });
      if (checkout.rc !== 0) failures.push(`web_checkout_main_failed:${checkout.rc}`);
    } else {
      const checkout = run('git', ['checkout', 'main'], { cwd: webRoot });
      const remote = run('git', ['remote', 'get-url', 'origin'], { cwd: webRoot });
      const pull = remote.rc === 0
        ? run('git', ['pull', '--ff-only', 'origin', 'main'], { cwd: webRoot })
        : { rc: 0 };
      observations.push({ id: 'web_checkout_main', ...gitOutput(checkout) });
      observations.push({ id: 'web_pull_main', ...gitOutput(pull) });
      if (checkout.rc !== 0) failures.push(`web_checkout_main_failed:${checkout.rc}`);
      if (pull.rc !== 0) failures.push(`web_pull_main_failed:${pull.rc}`);
    }
  }
  if (failures.length === 0) configureGitIdentity(failures, observations);

  const sync = failures.length === 0 ? syncFiles(manifest) : { failures: [], files: {} };
  failures.push(...sync.failures);
  const statusBeforeCommit = failures.length === 0 ? run('git', ['status', '--short'], { cwd: webRoot }).stdout.trim() : '';
  let commit = null;
  let pushed = false;

  if (publish && failures.length === 0 && statusBeforeCommit) {
    const addResult = run('git', ['add', 'public/cli/install.sh', 'public/cli/beta.json', `public/cli/releases/${manifest.version}.json`, 'src/app/changelog/page.tsx', 'src/app/download/page.tsx', 'src/app/sdks/page.tsx', 'functions/api/download/sdk/[target].ts'], { cwd: webRoot });
    observations.push({ id: 'web_git_add', ...gitOutput(addResult) });
    if (addResult.rc !== 0) failures.push(`web_add_failed:${addResult.rc}`);
  }

  if (publish && failures.length === 0 && statusBeforeCommit) {
    const commitResult = run('git', ['commit', '-m', `Align public web surface to ${manifest.version}`], { cwd: webRoot });
    observations.push({ id: 'web_git_commit', ...gitOutput(commitResult) });
    if (commitResult.rc !== 0) failures.push(`web_commit_failed:${commitResult.rc}`);
    else {
      commit = run('git', ['rev-parse', 'HEAD'], { cwd: webRoot }).stdout.trim();
      const push = run('git', ['push', 'origin', 'HEAD:main'], { cwd: webRoot });
      observations.push({ id: 'web_git_push', ...gitOutput(push) });
      if (push.rc !== 0) failures.push(`web_push_main_failed:${push.rc}`);
      else pushed = true;
    }
  }

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
