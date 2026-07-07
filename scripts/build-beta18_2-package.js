#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const outDir = path.join(root, 'evidence', 'beta18_2-package');
const manifestPath = path.join(outDir, 'package.manifest.json');
const sumsPath = path.join(outDir, 'SHA256SUMS');
const releaseManifestPath = path.join(root, 'release', 'manifest.json');

function readExistingReleaseSource() {
  try {
    const manifest = JSON.parse(fs.readFileSync(releaseManifestPath, 'utf8'));
    if (
      manifest?.source
      && typeof manifest.source.commit === 'string'
      && /^[a-f0-9]{40}$/i.test(manifest.source.commit)
      && typeof manifest.source.commitBinding === 'string'
    ) {
      return manifest.source;
    }
  } catch {
    // Fall back to HEAD below when no usable release manifest exists.
  }
  return null;
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function readJsonIfExists(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function existingPackageMatchesRelease() {
  if (process.env.BRIK64_FORCE_REPACK === '1') return false;
  const release = readJsonIfExists(releaseManifestPath);
  const packageManifest = readJsonIfExists(manifestPath);
  const packageRel = packageManifest?.package?.path;
  const packagePath = packageRel ? path.join(root, packageRel) : null;
  const expectedSha = release?.cli?.package?.sha256;
  if (!release || !packageManifest || !packagePath || !fs.existsSync(packagePath) || !expectedSha) return false;
  if (release.version !== version || packageManifest.version !== version) return false;
  if (packageManifest.package?.sha256 !== expectedSha) return false;
  return sha256File(packagePath) === expectedSha;
}

function pypiVersion(value) {
  const match = String(value).match(/^(\d+\.\d+\.\d+)-beta\.(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) return value;
  const [, base, beta, post, patch] = match;
  if (!post) return `${base}b${beta}`;
  if (!patch) return `${base}b${beta}.post${post}`;
  return `${base}b${beta}.post${post}${String(patch).padStart(2, '0')}`;
}

const failures = [];
if (version !== '0.1.0-beta.18.2') failures.push(`version_mismatch:${version}`);
const brik = fs.readFileSync(path.join(root, 'src', 'brik.js'), 'utf8');
if (!brik.includes(`const version = '${version}'`)) failures.push('src_version_missing');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.brik', 'manifest.json'), 'utf8'));
if (manifest.cliVersion !== version) failures.push(`brik_manifest_version_mismatch:${manifest.cliVersion || 'missing'}`);
if (!fs.existsSync(path.join(root, 'pcd', 'beta18_2', 'release', 'developer_assurance_loop_contract.pcd'))) {
  failures.push('beta18_2_pcd_contract_missing');
}
if (failures.length) {
  writeJson(manifestPath, {
    schemaVersion: 'brik64.cli_beta18_2_package_manifest.v1',
    version,
    decision: 'FAIL_BRIK64_CLI_BETA18_2_PACKAGE_BUILT',
    releaseEligible: false,
    publicationAllowed: false,
    failures,
  });
  console.error(failures.join('\n'));
  process.exit(1);
}

if (existingPackageMatchesRelease()) {
  const packageManifest = readJsonIfExists(manifestPath);
  console.log(`decision=PASS_BRIK64_CLI_BETA18_2_PACKAGE_BUILT`);
  console.log(`package=${packageManifest.package.path}`);
  console.log(`sha256=${packageManifest.package.sha256}`);
  process.exit(0);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const pack = run('npm', ['pack', '--pack-destination', outDir]);
const tarballName = pack.stdout.trim().split(/\r?\n/).filter(Boolean).pop();
if (!tarballName) throw new Error('npm_pack_missing_tarball_name');
const packagePath = path.join(outDir, tarballName);
const packageSha = sha256File(packagePath);
const packageRel = path.posix.join('evidence', 'beta18_2-package', tarballName);
const tarList = run('tar', ['-tzf', packagePath]).stdout;
const requiredPackageEntries = [
  'package/engines/l4plus-n5/runtime-bundle.manifest.json',
  'package/engines/l4plus-n5/serial.txt',
  'package/engines/l4plus-n5/checksums.tsv',
  'package/engines/l4plus-n5/pcd/engine.pcd',
  'package/engines/l4plus-n5/pcd/runtime_adapter.pcd',
  'package/engines/l4plus-n5/pcd/harness.pcd',
];
const missingPackageEntries = requiredPackageEntries.filter((entry) => !tarList.includes(`${entry}\n`));
if (missingPackageEntries.length) {
  writeJson(manifestPath, {
    schemaVersion: 'brik64.cli_beta18_2_package_manifest.v1',
    version,
    decision: 'FAIL_BRIK64_CLI_BETA18_2_PACKAGE_BUILT',
    releaseEligible: false,
    publicationAllowed: false,
    failures: missingPackageEntries.map((entry) => `package_missing:${entry}`),
  });
  console.error(missingPackageEntries.map((entry) => `package_missing:${entry}`).join('\n'));
  process.exit(1);
}

writeJson(manifestPath, {
  schemaVersion: 'brik64.cli_beta18_2_package_manifest.v1',
  version,
  decision: 'PASS_BRIK64_CLI_BETA18_2_PACKAGE_BUILT',
  releaseEligible: true,
  publicationAllowed: true,
  lane: 'cli_0_1_beta',
  generationClaim: 'pcd_contract_backed_candidate',
  package: {
    path: packageRel,
    sha256: packageSha,
    bytes: fs.statSync(packagePath).size,
  },
  inputs: [
    'src/brik.js',
    'package.json',
    '.brik/manifest.json',
    'engines/l4plus-n5/runtime-bundle.manifest.json',
    'engines/l4plus-n5/serial.txt',
    'engines/l4plus-n5/checksums.tsv',
    'pcd/beta18_2/release/developer_assurance_loop_contract.pcd',
  ],
  claimBoundary: {
    publicClaimsAllowed: true,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  },
});
fs.writeFileSync(sumsPath, `${packageSha}  ${tarballName}\n${sha256File(manifestPath)}  package.manifest.json\n`);

writeJson(releaseManifestPath, {
  schemaVersion: 'brik64.release_manifest.v1',
  releaseId: `brik64-${version}`,
  version,
  channel: 'beta',
  state: 'public',
  source: readExistingReleaseSource() || {
    commit: run('git', ['rev-parse', 'HEAD']).stdout.trim(),
    commitBinding: 'public_release_base_commit',
  },
  cli: {
    installCommand: 'curl -fsSL https://brik64.com/cli/install.sh | bash',
    verifyCommand: 'brik64 --version && brik64 help',
    package: {
      path: packageRel,
      sha256: packageSha,
      bytes: fs.statSync(packagePath).size,
    },
  },
  publicSurfaces: {
    githubRelease: { required: true, status: 'pending_release_train_publish', tag: `v${version}`, url: `https://github.com/brik64/brik64-cli/releases/tag/v${version}` },
    curlInstaller: { required: true, status: 'pending_release_train_publish', url: 'https://brik64.com/cli/install.sh' },
    channelManifest: { required: true, status: 'pending_release_train_publish', url: 'https://brik64.com/cli/beta.json' },
    web: { required: true, status: 'pending_release_train_publish', url: 'https://brik64.com/download' },
    docs: { required: true, status: 'pending_release_train_publish', url: 'https://docs.brik64.com' },
    skills: { required: true, status: 'pending_release_train_publish', repo: 'brik64/brik64-tools-skills', url: 'https://github.com/brik64/brik64-tools-skills' },
    releaseManifest: { required: true, status: 'pending_release_train_publish', url: `https://brik64.com/cli/releases/${version}.json` },
  },
  releaseNotes: [
    {
      type: 'added',
      surface: 'blueprint',
      text: 'Adds developer assurance loop output modes for certified PCD candidates, SDK logic inventories, and inspection drafts.',
    },
    {
      type: 'changed',
      surface: 'skills',
      text: 'Aligns agent workflows around developer assurance commands before scoped PCD-first or SDK-first closeout.',
    },
  ],
  sdks: [
    { marketplace: 'npm', name: '@brik64/core', version, required: true, publication: 'pending_release_train_publish' },
    { marketplace: 'pypi', name: 'brik64', version: pypiVersion(version), required: true, publication: 'pending_release_train_publish' },
    { marketplace: 'crates.io', name: 'brik64-core', version, required: true, publication: 'pending_release_train_publish' },
  ],
  claimBoundary: {
    publicClaimsAllowed: true,
    formalN5ClaimAllowed: false,
    fixpointClaimAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  },
});

console.log(`decision=PASS_BRIK64_CLI_BETA18_2_PACKAGE_BUILT`);
console.log(`package=${packageRel}`);
console.log(`sha256=${packageSha}`);
