#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'beta5-release-checksums');
const signingKey = process.env.BRIK64_RELEASE_SIGNING_KEY || path.join(process.env.HOME, '.ssh', 'brik64-admin-signing');
const allowedSigners = process.env.BRIK64_ALLOWED_SIGNERS || path.join(process.env.HOME, '.ssh', 'brik64-allowed-signers');
const signerIdentity = process.env.BRIK64_RELEASE_SIGNER || 'admin@brik64.dev';
const namespace = 'brik64-cli-release';

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function artifact(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) throw new Error(`release_checksum_input_missing:${relativePath}`);
  return {
    path: relativePath,
    sha256: sha256File(file),
    bytes: fs.statSync(file).size
  };
}

function externalArtifact(repoRoot, relativePath) {
  const file = path.join(repoRoot, relativePath);
  if (!fs.existsSync(file)) throw new Error(`release_checksum_external_input_missing:${file}`);
  return {
    path: file,
    sha256: sha256File(file),
    bytes: fs.statSync(file).size
  };
}

function run(args, options = {}) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: outDir,
    encoding: 'utf8',
    input: options.input
  });
  if (result.status !== 0) {
    throw new Error(`${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(signingKey)) throw new Error('release_signing_key_missing');
  if (!fs.existsSync(allowedSigners)) throw new Error('release_allowed_signers_missing');

  const artifacts = [
    artifact('evidence/beta5-package/brik64-cli-0.1.0-beta.5-local-candidate.tgz'),
    artifact('evidence/beta5-package/package.manifest.json'),
    artifact('evidence/beta5-package-smoke/report.json'),
    artifact('evidence/beta5-cross-platform-smoke/report.json'),
    artifact('evidence/beta5-marketplace-packages/report.json'),
    artifact('evidence/beta5-publication-preflight/manifest.json'),
    artifact('evidence/beta5-local-candidate/build-chain.manifest.json'),
    externalArtifact('/Users/carlosjperez/Documents/GitHub/brik64-lib-js', 'evidence-beta5-pack/brik64-core-0.1.0-beta.5.tgz'),
    externalArtifact('/Users/carlosjperez/Documents/GitHub/brik64-lib-python', 'dist/brik64-0.1.0b5-py3-none-any.whl'),
    externalArtifact('/Users/carlosjperez/Documents/GitHub/brik64-lib-python', 'dist/brik64-0.1.0b5.tar.gz'),
    externalArtifact('/Users/carlosjperez/Documents/GitHub/brik64-lib-rust', 'target/package/brik64-core-0.1.0-beta.5.crate')
  ];

  const checksumsPath = path.join(outDir, 'SHA256SUMS');
  const checksums = artifacts
    .map((item) => `${item.sha256}  ${item.path}`)
    .join('\n') + '\n';
  fs.writeFileSync(checksumsPath, checksums);
  run(['ssh-keygen', '-Y', 'sign', '-f', signingKey, '-n', namespace, checksumsPath]);
  run(
    ['ssh-keygen', '-Y', 'verify', '-f', allowedSigners, '-I', signerIdentity, '-n', namespace, '-s', `${checksumsPath}.sig`],
    { input: fs.readFileSync(checksumsPath, 'utf8') }
  );

  const report = {
    schemaVersion: 'brik64.cli_beta5_release_checksums.v1',
    version: '0.1.0-beta.5',
    decision: 'PASS_SIGNED_CHECKSUMS',
    releaseEligible: false,
    signer: signerIdentity,
    namespace,
    checksums: {
      path: path.relative(root, checksumsPath),
      sha256: sha256File(checksumsPath),
      entries: artifacts
    },
    signature: {
      path: path.relative(root, `${checksumsPath}.sig`),
      sha256: sha256File(`${checksumsPath}.sig`),
      verifiedWith: allowedSigners
    },
    boundary: 'Signed local beta5 checksums only. This does not create a Git tag, GitHub Release, curl publication or marketplace publication.'
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`checksums=${report.checksums.path}\n`);
  process.stdout.write(`signature=${report.signature.path}\n`);
}

main();
