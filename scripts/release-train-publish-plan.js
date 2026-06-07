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

function betaLabel(version) {
  const match = String(version).match(/-beta\.(\d+)$/);
  if (!match) throw new Error(`unsupported_beta_version:${version}`);
  return `beta${match[1]}`;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifestText = readText(manifestPath);
  const manifest = JSON.parse(manifestText);
  const dryRun = readJson(path.join(root, 'evidence', 'release-train-dry-run', 'report.json'));
  const liveVerifyPath = path.join(root, 'evidence', 'release-train-live-verify', 'report.json');
  const liveVerify = fs.existsSync(liveVerifyPath) ? readJson(liveVerifyPath) : null;
  const manifestDigest = sha256(manifestText);
  const failures = [];
  const warnings = [];
  const confirm = process.env.BRIK64_RELEASE_CONFIRM || '';
  const releaseTag = manifest.publicSurfaces.githubRelease.tag;
  const expectedConfirm = `PUBLISH ${manifest.version} ${manifestDigest}`;
  const dryRunInProgress = process.env.BRIK64_RELEASE_TRAIN_DRY_RUN_IN_PROGRESS === '1';
  const label = betaLabel(manifest.version);
  const packageDir = `evidence/${label}-package`;
  const packageManifest = readJson(path.join(root, packageDir, 'package.manifest.json'));
  const packagePath = packageManifest.package.path;
  const jsSdkPackDir = `evidence-${label}-pack`;
  const pythonSdkVersion = manifest.sdks.find((sdk) => sdk.marketplace === 'pypi').version;
  const signatureReportPath = path.join(root, 'evidence', `${label}-github-verified-signature`, 'report.json');
  const signatureReport = fs.existsSync(signatureReportPath) ? readJson(signatureReportPath) : null;
  const currentHead = gitOutput(['rev-parse', '--short', 'HEAD']);
  const currentHeadFull = gitOutput(['rev-parse', 'HEAD']);

  if (manifest.state !== 'public') failures.push(`manifest_state_not_public:${manifest.state}`);
  if (label === 'beta8') {
    if (!signatureReport) {
      failures.push('beta8_github_verified_signature_report_missing');
    } else if (signatureReport.decision !== 'PASS_BETA8_GITHUB_VERIFIED_SIGNATURE') {
      failures.push(`beta8_github_verified_signature_not_pass:${signatureReport.decision}`);
    } else if (signatureReport.boundary?.publicReleaseAllowed !== true) {
      failures.push('beta8_github_verified_signature_public_release_not_allowed');
    } else if (signatureReport.commit !== currentHeadFull) {
      failures.push(`beta8_github_verified_signature_commit_drift:${signatureReport.commit}:${currentHeadFull}`);
    }
  }
  if (!dryRunInProgress && dryRun.decision !== 'PASS_RELEASE_TRAIN_DRY_RUN') failures.push(`dry_run_not_green:${dryRun.decision}`);
  if (!dryRunInProgress && dryRun.manifestDigest !== manifestDigest) failures.push('dry_run_manifest_digest_drift');
  if (dryRunInProgress) warnings.push('dry_run_report_currently_being_generated');
  if (liveVerify && liveVerify.decision === 'PASS_RELEASE_TRAIN_LIVE_VERIFY') {
    if (liveVerify.manifestDigest !== manifestDigest) warnings.push('pre_publish_live_verify_manifest_digest_drift');
  } else {
    warnings.push(liveVerify ? `pre_publish_live_verify_not_green:${liveVerify.decision}` : 'pre_publish_live_verify_missing');
  }

  if (manifest.source.commit !== currentHead && gitStatus(['merge-base', '--is-ancestor', manifest.source.commit, 'HEAD']) !== 0) {
    warnings.push(`manifest_source_commit_not_ancestor:${manifest.source.commit}:${currentHead}`);
  }

  const publishRequested = process.argv.includes('--publish');
  if (publishRequested && confirm !== expectedConfirm) failures.push('publish_confirmation_missing_or_invalid');

  const requiredSecrets = [
    'BRIK64_GITHUB_RELEASE_TOKEN',
    'BRIK64_NPM_TOKEN',
    'BRIK64_PYPI_TOKEN',
    'BRIK64_CRATES_TOKEN',
    'BRIK64_DOCS_DISPATCH_TOKEN',
    'BRIK64_WEB_DEPLOY_TOKEN',
    'BRIK64_SKILLS_REPO_TOKEN'
  ];
  const secretAvailability = Object.fromEntries(requiredSecrets.map((name) => [name, Boolean(process.env[name])]));
  secretAvailability.BRIK64_GCP_RELEASE_CREDENTIALS = Boolean(process.env.BRIK64_GCP_RELEASE_CREDENTIALS);
  secretAvailability.BRIK64_GCP_WORKLOAD_IDENTITY_PROVIDER = Boolean(process.env.BRIK64_GCP_WORKLOAD_IDENTITY_PROVIDER);
  secretAvailability.BRIK64_GCP_SERVICE_ACCOUNT = Boolean(process.env.BRIK64_GCP_SERVICE_ACCOUNT);
  const gcpAuthAvailable = secretAvailability.BRIK64_GCP_RELEASE_CREDENTIALS
    || (secretAvailability.BRIK64_GCP_WORKLOAD_IDENTITY_PROVIDER && secretAvailability.BRIK64_GCP_SERVICE_ACCOUNT);
  if (publishRequested) {
    for (const [name, present] of Object.entries(secretAvailability)) {
      if (name.startsWith('BRIK64_GCP_')) continue;
      if (!present) failures.push(`required_secret_missing:${name}`);
    }
    if (!gcpAuthAvailable) failures.push('required_gcp_auth_missing:BRIK64_GCP_RELEASE_CREDENTIALS_or_WORKLOAD_IDENTITY');
  }

  const sdkMarketplaceGuardCommands = label === 'beta9'
    ? [
        command(
          'sdk_marketplace_publish_guard',
          'Run beta9 SDK marketplace package and authentication preflight before any public mutation.',
          'npm run gate:beta9:sdk-marketplace-publish',
          true
        )
      ]
    : [];

  const commands = [
    ...sdkMarketplaceGuardCommands,
    command(
      'github_release',
      'Create or update the GitHub Release from the manifest version and upload committed assets.',
      `gh release view ${releaseTag} --repo brik64/brik64-cli || gh release create ${releaseTag} --repo brik64/brik64-cli --title "BRIK64 CLI ${manifest.version}" --notes-file CHANGELOG.md && gh release upload ${releaseTag} --repo brik64/brik64-cli --clobber ${packagePath} ${packageDir}/package.manifest.json ${packageDir}/SHA256SUMS`,
      true
    ),
    command(
      'sdk_npm',
      'Publish the TypeScript SDK package with the manifest beta version.',
      `npm view @brik64/core@${manifest.version} version >/dev/null 2>&1 || npm publish --tag beta /Users/carlosjperez/Documents/GitHub/brik64-lib-js/${jsSdkPackDir}/brik64-core-${manifest.version}.tgz`,
      true
    ),
    command(
      'sdk_pypi',
      'Publish the Python SDK package with twine.',
      `python3 - <<'PY' || python3 -m twine upload /Users/carlosjperez/Documents/GitHub/brik64-lib-python/dist/brik64-${pythonSdkVersion}*
import urllib.request
urllib.request.urlopen('https://pypi.org/pypi/brik64/${pythonSdkVersion}/json', timeout=20).close()
PY`,
      true
    ),
    command(
      'sdk_crates',
      'Publish the Rust SDK crate.',
      `cargo info brik64-core@${manifest.version} >/dev/null 2>&1 || CARGO_REGISTRY_TOKEN="$BRIK64_CRATES_TOKEN" cargo publish --manifest-path /Users/carlosjperez/Documents/GitHub/brik64-lib-rust/Cargo.toml`,
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
      `jq -c '{event_type:"brik64-release-manifest",client_payload:{release:.}}' evidence/release-train-sync/sync-payload.json | gh api repos/brik64-admin/brik64-docs-site/dispatches --method POST --input -`,
      true
    ),
    command(
      'web_dispatch',
      'Dispatch web/CMS update using the manifest payload.',
      `jq -c '{event_type:"brik64-release-manifest",client_payload:{release:.}}' evidence/release-train-sync/sync-payload.json | gh api repos/brik64-admin/brik64.com/dispatches --method POST --input -`,
      true
    ),
    command(
      'skills_dispatch',
      'Dispatch public skills metadata refresh.',
      `jq -c '{event_type:"brik64-release-manifest",client_payload:{release:.}}' evidence/release-train-sync/sync-payload.json | gh api repos/brik64/brik64-tools-skills/dispatches --method POST --input -`,
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
    dryRunInProgress,
    publishRequested,
    publicationAllowed: publishRequested && failures.length === 0,
    expectedConfirm,
    secretAvailability,
    signatureReport: signatureReport
      ? {
          path: path.relative(root, signatureReportPath),
          decision: signatureReport.decision,
          commit: signatureReport.commit,
          verified: signatureReport.verification?.verified === true,
          reason: signatureReport.verification?.reason || ''
        }
      : null,
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
