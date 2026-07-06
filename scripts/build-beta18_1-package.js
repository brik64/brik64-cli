#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const outDir = path.join(root, 'evidence', 'beta18_1-package');
const manifestPath = path.join(outDir, 'package.manifest.json');
const sumsPath = path.join(outDir, 'SHA256SUMS');
const releaseManifestPath = path.join(root, 'release', 'manifest.json');

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

function pypiVersion(value) {
  const match = String(value).match(/^(\d+\.\d+\.\d+)-beta\.(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) return value;
  const [, base, beta, post, patch] = match;
  if (!post) return `${base}b${beta}`;
  if (!patch) return `${base}b${beta}.post${post}`;
  return `${base}b${beta}.post${post}${String(patch).padStart(2, '0')}`;
}

const failures = [];
if (version !== '0.1.0-beta.18.1') failures.push(`version_mismatch:${version}`);
const brik = fs.readFileSync(path.join(root, 'src', 'brik.js'), 'utf8');
if (!brik.includes(`const version = '${version}'`)) failures.push('src_version_missing');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.brik', 'manifest.json'), 'utf8'));
if (manifest.cliVersion !== version) failures.push(`brik_manifest_version_mismatch:${manifest.cliVersion || 'missing'}`);
if (!fs.existsSync(path.join(root, 'pcd', 'beta18_1', 'release', 'blueprint_output_contract.pcd'))) {
  failures.push('beta18_1_pcd_contract_missing');
}
if (failures.length) {
  writeJson(manifestPath, {
    schemaVersion: 'brik64.cli_beta18_1_package_manifest.v1',
    version,
    decision: 'FAIL_BRIK64_CLI_BETA18_1_PACKAGE_BUILT',
    releaseEligible: false,
    publicationAllowed: false,
    failures,
  });
  console.error(failures.join('\n'));
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const pack = run('npm', ['pack', '--pack-destination', outDir]);
const tarballName = pack.stdout.trim().split(/\r?\n/).filter(Boolean).pop();
if (!tarballName) throw new Error('npm_pack_missing_tarball_name');
const packagePath = path.join(outDir, tarballName);
const packageSha = sha256File(packagePath);
const packageRel = path.posix.join('evidence', 'beta18_1-package', tarballName);
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
    schemaVersion: 'brik64.cli_beta18_1_package_manifest.v1',
    version,
    decision: 'FAIL_BRIK64_CLI_BETA18_1_PACKAGE_BUILT',
    releaseEligible: false,
    publicationAllowed: false,
    failures: missingPackageEntries.map((entry) => `package_missing:${entry}`),
  });
  console.error(missingPackageEntries.map((entry) => `package_missing:${entry}`).join('\n'));
  process.exit(1);
}

writeJson(manifestPath, {
  schemaVersion: 'brik64.cli_beta18_1_package_manifest.v1',
  version,
  decision: 'PASS_BRIK64_CLI_BETA18_1_PACKAGE_BUILT',
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
    'pcd/beta18_1/release/blueprint_output_contract.pcd',
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
  state: 'draft',
  source: {
    commit: run('git', ['rev-parse', 'HEAD']).stdout.trim(),
    commitBinding: 'candidate_base_commit',
  },
  cli: {
    package: {
      path: packageRel,
      sha256: packageSha,
      bytes: fs.statSync(packagePath).size,
    },
  },
  releaseNotes: [
    {
      type: 'added',
      surface: 'blueprint',
      text: 'Adds explicit blueprint output modes for certified PCD candidates, SDK logic inventories, and inspection drafts.',
    },
    {
      type: 'changed',
      surface: 'skills',
      text: 'Aligns agent workflows around logic planning before selecting PCD-first or BRIK64 SDK-first implementation routes.',
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

console.log(`decision=PASS_BRIK64_CLI_BETA18_1_PACKAGE_BUILT`);
console.log(`package=${packageRel}`);
console.log(`sha256=${packageSha}`);
