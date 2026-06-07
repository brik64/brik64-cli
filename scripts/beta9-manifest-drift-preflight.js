#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const version = '0.1.0-beta.9';
const outDir = path.join(root, 'evidence', 'beta9-public-surfaces');
const reportPath = path.join(outDir, 'manifest-drift-preflight.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function git(args) {
  const result = childProcess.spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function decisionOf(file) {
  if (!fs.existsSync(file)) return null;
  return readJson(file).decision || null;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const activePath = path.join(root, 'release', 'manifest.json');
  const candidatePath = path.join(root, 'evidence', 'beta9-package', 'release-manifest.candidate.json');
  const packageManifestPath = path.join(root, 'evidence', 'beta9-package', 'package.manifest.json');
  const readinessPath = path.join(root, 'evidence', 'beta9-release-readiness', 'report.json');
  const sdkMarketplacesPath = path.join(outDir, 'sdk-marketplaces.json');
  const sdkPublishPath = path.join(outDir, 'sdk-marketplace-publish.json');
  const githubPath = path.join(outDir, 'github-release.json');
  const curlPath = path.join(outDir, 'curl-gcp-installer.json');
  const livePath = path.join(outDir, 'live-verify.json');

  const failures = [];
  const warnings = [];

  const active = readJson(activePath);
  const candidate = readJson(candidatePath);
  const packageManifest = readJson(packageManifestPath);
  const readiness = readJson(readinessPath);
  const sdkPublish = fs.existsSync(sdkPublishPath) ? readJson(sdkPublishPath) : null;

  if (candidate.version !== version) failures.push(`candidate_version_drift:${candidate.version || 'missing'}`);
  if (packageManifest.package?.path !== `evidence/beta9-package/brik64-cli-${version}.tgz`) {
    failures.push('beta9_package_path_drift');
  }
  if (readiness.decision !== 'BLOCKED_BRIK64_CLI_BETA9_RELEASE_READINESS') {
    failures.push(`unexpected_readiness_decision:${readiness.decision}`);
  }

  const publicSurfaceDecisions = {
    githubRelease: decisionOf(githubPath),
    curlGcpInstaller: decisionOf(curlPath),
    sdkMarketplaces: decisionOf(sdkMarketplacesPath),
    liveVerify: decisionOf(livePath)
  };

  const allPublicSurfacesPassed = publicSurfaceDecisions.githubRelease === 'PASS_BETA9_GITHUB_RELEASE'
    && publicSurfaceDecisions.curlGcpInstaller === 'PASS_BETA9_CURL_GCP_INSTALLER'
    && publicSurfaceDecisions.sdkMarketplaces === 'PASS_BETA9_SDK_MARKETPLACES'
    && publicSurfaceDecisions.liveVerify === 'PASS_BETA9_LIVE_VERIFY';

  const activeIsBeta9Public = active.version === version && active.state === 'public';
  const activeIsPriorPublic = active.version !== version && active.state === 'public';
  const publicationWorkflowInProgress = process.env.BRIK64_RELEASE_PUBLICATION_IN_PROGRESS === '1';

  if (activeIsBeta9Public && !allPublicSurfacesPassed && !publicationWorkflowInProgress) {
    failures.push('active_manifest_beta9_public_before_surface_pass');
  } else if (activeIsBeta9Public && !allPublicSurfacesPassed && publicationWorkflowInProgress) {
    warnings.push('active_manifest_beta9_public_pending_surface_pass_during_publication_workflow');
  }
  if (!activeIsBeta9Public && allPublicSurfacesPassed) {
    failures.push('all_surfaces_passed_but_active_manifest_not_promoted');
  }
  if (!activeIsBeta9Public && !activeIsPriorPublic) {
    failures.push(`active_manifest_unexpected_state:${active.version}:${active.state}`);
  }

  if (candidate.state !== 'draft') warnings.push(`candidate_state_not_draft:${candidate.state}`);
  if (candidate.source != null) warnings.push('candidate_source_already_bound');
  if (candidate.sdks != null) warnings.push('candidate_sdks_already_bound');
  if (sdkPublish?.publicationMutated === true && publicSurfaceDecisions.sdkMarketplaces !== 'PASS_BETA9_SDK_MARKETPLACES') {
    failures.push('sdk_publication_mutated_without_marketplace_pass');
  }

  const report = {
    schemaVersion: 'brik64.beta9_manifest_drift_preflight.v1',
    generatedAt: new Date().toISOString(),
    version,
    sourceHead: git(['rev-parse', 'HEAD']),
    activeManifest: {
      path: 'release/manifest.json',
      sha256: sha256File(activePath),
      releaseId: active.releaseId,
      version: active.version,
      state: active.state
    },
    beta9Candidate: {
      path: 'evidence/beta9-package/release-manifest.candidate.json',
      sha256: sha256File(candidatePath),
      releaseId: candidate.releaseId,
      version: candidate.version,
      state: candidate.state
    },
    publicSurfaceDecisions,
    sdkPublication: sdkPublish
      ? {
          path: 'evidence/beta9-public-surfaces/sdk-marketplace-publish.json',
          decision: sdkPublish.decision,
          publicationMutated: sdkPublish.publicationMutated === true,
          failures: sdkPublish.failures || []
        }
      : null,
    releaseTrainAllowed: readiness.releaseTrainAllowed === true && allPublicSurfacesPassed && activeIsBeta9Public,
    decision: failures.length === 0
      ? activeIsBeta9Public
        ? 'PASS_BETA9_MANIFEST_PUBLIC_ALIGNMENT'
        : 'PASS_BETA9_MANIFEST_STAGED_BLOCKED_ALIGNMENT'
      : 'BLOCKED_BETA9_MANIFEST_DRIFT_PREFLIGHT',
    failures,
    warnings,
    boundary: 'This preflight observes manifest alignment only. It does not promote beta9 or publish public surfaces.'
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`decision=${report.decision}\n`);
  process.stdout.write(`releaseTrainAllowed=${report.releaseTrainAllowed}\n`);
  if (failures.length) process.stdout.write(`failures=${failures.join(',')}\n`);
  process.exit(failures.length === 0 ? 0 : 2);
}

main();
