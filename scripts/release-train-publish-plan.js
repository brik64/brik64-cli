#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'release', 'manifest.json');
const outDir = path.join(root, 'evidence', 'release-train-publish-plan');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

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

function gitStatus(args) {
  const result = childProcess.spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.status;
}

function command(name, description, commandLine, mutatesPublicSurface) {
  return { name, description, command: commandLine, mutatesPublicSurface };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifestText = readText(manifestPath);
  const manifest = JSON.parse(manifestText);
  const dryRun = readJson(path.join(root, 'evidence', 'release-train-dry-run', 'report.json'));
  const liveVerify = readJson(path.join(root, 'evidence', 'release-train-live-verify', 'report.json'));
  const manifestDigest = sha256(manifestText);
  const failures = [];
  const warnings = [];
  const confirm = process.env.BRIK64_RELEASE_CONFIRM || '';
  const releaseTag = manifest.publicSurfaces.githubRelease.tag;
  const expectedConfirm = `PUBLISH ${manifest.version} ${manifestDigest}`;

  if (manifest.state !== 'public') failures.push(`manifest_state_not_public:${manifest.state}`);
  if (dryRun.decision !== 'PASS_RELEASE_TRAIN_DRY_RUN') failures.push(`dry_run_not_green:${dryRun.decision}`);
  if (dryRun.manifestDigest !== manifestDigest) failures.push('dry_run_manifest_digest_drift');
  if (liveVerify.decision !== 'PASS_RELEASE_TRAIN_LIVE_VERIFY') failures.push(`live_verify_not_green:${liveVerify.decision}`);
  if (liveVerify.manifestDigest !== manifestDigest) failures.push('live_verify_manifest_digest_drift');

  const currentHead = gitOutput(['rev-parse', '--short', 'HEAD']);
  if (manifest.source.commit !== currentHead && gitStatus(['merge-base', '--is-ancestor', manifest.source.commit, 'HEAD']) !== 0) {
    warnings.push(`manifest_source_commit_not_ancestor:${manifest.source.commit}:${currentHead}`);
  }

  const publishRequested = process.argv.includes('--publish');
  if (publishRequested && confirm !== expectedConfirm) failures.push('publish_confirmation_missing_or_invalid');

  const requiredSecrets = [
    'BRIK64_GITHUB_RELEASE_TOKEN',
    'BRIK64_GCP_RELEASE_CREDENTIALS',
    'BRIK64_NPM_TOKEN',
    'BRIK64_PYPI_TOKEN',
    'BRIK64_CRATES_TOKEN',
    'BRIK64_DOCS_DISPATCH_TOKEN',
    'BRIK64_WEB_DEPLOY_TOKEN',
    'BRIK64_SKILLS_REPO_TOKEN'
  ];
  const secretAvailability = Object.fromEntries(requiredSecrets.map((name) => [name, Boolean(process.env[name])]));
  if (publishRequested) {
    for (const [name, present] of Object.entries(secretAvailability)) {
      if (!present) failures.push(`required_secret_missing:${name}`);
    }
  }

  const commands = [
    command(
      'github_release',
      'Create or update the GitHub Release from the manifest version and committed assets.',
      `gh release view ${releaseTag} --repo brik64/brik64-cli || gh release create ${releaseTag} --repo brik64/brik64-cli --title "BRIK64 CLI ${manifest.version}" --notes-file CHANGELOG.md`,
      true
    ),
    command(
      'sdk_npm',
      'Publish the TypeScript SDK package with the manifest beta version.',
      `npm publish --tag beta /Users/carlosjperez/Documents/GitHub/brik64-lib-js/evidence-beta5-pack/brik64-core-${manifest.version}.tgz`,
      true
    ),
    command(
      'sdk_pypi',
      'Publish the Python SDK package with twine.',
      `python3 -m twine upload /Users/carlosjperez/Documents/GitHub/brik64-lib-python/dist/brik64-${manifest.sdks.find((sdk) => sdk.marketplace === 'pypi').version}*`,
      true
    ),
    command(
      'sdk_crates',
      'Publish the Rust SDK crate.',
      'cargo publish --manifest-path /Users/carlosjperez/Documents/GitHub/brik64-lib-rust/Cargo.toml --token "$BRIK64_CRATES_TOKEN"',
      true
    ),
    command(
      'gcp_curl',
      'Upload CLI installer metadata and package artifacts to the curl/GCP public surface.',
      'scripts/release/upload-gcp-curl-surface.sh release/manifest.json',
      true
    ),
    command(
      'docs_dispatch',
      'Dispatch docs update using the manifest payload.',
      `gh api repos/brik64-admin/brik64-docs-site/dispatches --method POST --raw-field event_type=brik64-release-manifest --input evidence/release-train-sync/sync-payload.json`,
      true
    ),
    command(
      'web_dispatch',
      'Dispatch web/CMS update using the manifest payload.',
      `gh api repos/brik64-admin/brik64.com/dispatches --method POST --raw-field event_type=brik64-release-manifest --input evidence/release-train-sync/sync-payload.json`,
      true
    ),
    command(
      'skills_dispatch',
      'Dispatch public skills metadata refresh.',
      `gh api repos/brik64/brik64-tools-skills/dispatches --method POST --raw-field event_type=brik64-release-manifest --input evidence/release-train-sync/sync-payload.json`,
      true
    ),
    command(
      'post_publish_live_verify',
      'Re-run public live verification after publication.',
      'node scripts/release-train-live-verify.js',
      false
    )
  ];

  const rollback = [
    'Do not delete historical release artifacts.',
    `If any channel fails after publication begins, create a superseding manifest with state "failed" for ${manifest.version}.`,
    'Restore curl/GCP channel manifest to the previous known-good manifest object.',
    'Create a GitHub Release note amendment that points to the superseding manifest.',
    'Run release-train-live-verify and keep the failed report as evidence.'
  ];

  const report = {
    schemaVersion: 'brik64.release_train_publish_plan.v1',
    releaseId: manifest.releaseId,
    version: manifest.version,
    manifestDigest,
    decision: failures.length === 0
      ? publishRequested
        ? 'PASS_PUBLISH_PREFLIGHT_READY_TO_MUTATE'
        : 'PASS_PUBLISH_PLAN_DRY_RUN'
      : 'FAIL_PUBLISH_PREFLIGHT',
    publishRequested,
    publicationAllowed: publishRequested && failures.length === 0,
    expectedConfirm,
    secretAvailability,
    commands,
    rollback,
    failures,
    warnings,
    boundary: 'This script generates and verifies the publication plan. It never mutates public surfaces directly.'
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`publicationAllowed=${report.publicationAllowed}\n`);
  if (failures.length > 0) process.stdout.write(`failures=${failures.join(',')}\n`);
  if (warnings.length > 0) process.stdout.write(`warnings=${warnings.join(',')}\n`);
  if (failures.length > 0) process.exit(1);
}

main();
