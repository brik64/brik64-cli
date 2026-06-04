#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta5-package');
const staging = path.join(outDir, 'stage', 'brik64-cli-0.1.0-beta.5');
const packageName = 'brik64-cli-0.1.0-beta.5-local-candidate.tgz';

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const baseInclude = [
  '.brik/manifest.json',
  'CHANGELOG.md',
  'README.md',
  'package.json',
  'src/brik.js',
  'docs/BETA5_RELEASE_SURFACE_SYNC.md',
  'pcd/cli_core.pcd',
  'pcd/cli_polymer.pcd',
  'pcd/cli_beta5_route2.pcd',
  'engines/l4plus-n5/runtime-bundle.manifest.json',
  'evidence/beta5-local-candidate/build-chain.manifest.json',
  'evidence/beta5-release-surface-gate/report.json',
  'evidence/beta5-publication-preflight/manifest.json',
  'evidence/beta5-adversarial-audit/report.json'
];

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copy(relativePath) {
  const source = path.join(root, relativePath);
  if (!fs.existsSync(source)) throw new Error(`missing_package_input:${relativePath}`);
  const dest = path.join(staging, relativePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
  return {
    path: relativePath,
    sha256: sha256File(source),
    bytes: fs.statSync(source).size
  };
}

function run(args, cwd = root) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  const runtimeBundle = JSON.parse(fs.readFileSync(path.join(root, 'engines/l4plus-n5/runtime-bundle.manifest.json'), 'utf8'));
  const l4Artifacts = runtimeBundle.artifacts.map((artifact) => artifact.path);
  const include = [...new Set([...baseInclude, ...l4Artifacts])].sort();
  const artifacts = include.map(copy);
  fs.chmodSync(path.join(staging, 'src/brik.js'), 0o755);

  const packagePath = path.join(outDir, packageName);
  run(['tar', '-czf', packagePath, '-C', path.join(outDir, 'stage'), 'brik64-cli-0.1.0-beta.5']);
  const tarSha = sha256File(packagePath);
  const manifest = {
    schemaVersion: 'brik64.cli_beta5_package_manifest.v1',
    version: '0.1.0-beta.5',
    decision: 'PASS_LOCAL_PACKAGE_CANDIDATE_BUILT',
    releaseEligible: false,
    package: {
      path: path.relative(root, packagePath),
      sha256: tarSha,
      bytes: fs.statSync(packagePath).size
    },
    artifacts,
    boundary: 'Local package candidate only. This is not a signed GitHub Release artifact.'
  };
  fs.writeFileSync(path.join(outDir, 'package.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'SHA256SUMS'), `${tarSha}  ${packageName}\n${sha256File(path.join(outDir, 'package.manifest.json'))}  package.manifest.json\n`);
  process.stdout.write(`decision=${manifest.decision}\n`);
  process.stdout.write(`package=${manifest.package.path}\n`);
  process.stdout.write(`sha256=${tarSha}\n`);
}

main();
