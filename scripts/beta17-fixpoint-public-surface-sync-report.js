#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const version = process.env.BRIK64_BETA17_VERSION || '0.1.0-beta.17';
const liveVerifyPath = argValue('--live-report', path.join(root, 'evidence', 'release-train-live-verify', 'report.json'));
const outPath = argValue('--out', path.join(root, 'evidence', 'beta17-fixpoint', 'public_surface_sync_report.json'));

const surfaceMap = new Map([
  ['cli_installer', ['curl_installer']],
  ['cli_manifest', ['channel_manifest']],
  ['docs', ['docs_install']],
  ['web_changelog', ['web_changelog', 'web_home']],
  ['skills', ['public_skill']],
]);

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function rel(file) {
  return path.relative(root, file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function closedClaimBoundary() {
  return {
    publicReleaseAllowed: false,
    definitiveFixpointAllowed: false,
    formalN5ClaimAllowed: false,
    universalCorrectnessClaimAllowed: false,
    publicClaimsAllowed: false,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  };
}

function syncedClaimBoundary() {
  return {
    publicReleaseAllowed: true,
    definitiveFixpointAllowed: false,
    formalN5ClaimAllowed: false,
    universalCorrectnessClaimAllowed: false,
    publicClaimsAllowed: true,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  };
}

function blockedReport(blockers, liveReport = null, surfaceChecks = []) {
  return {
    schemaVersion: 'brik64.beta17_fixpoint.public_surface_sync_report.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: 'BLOCKED_BETA17_PUBLIC_SURFACE_SYNC',
    synced: false,
    reason: blockers[0] || 'public surfaces are not yet synchronized to Beta17',
    blockers,
    liveVerifyReportRef: liveReportRef(),
    liveVerifyDecision: liveReport?.decision || null,
    liveVerifyVersion: liveReport?.version || null,
    surfaceChecks: surfaceChecks.length > 0 ? surfaceChecks : defaultBlockedSurfaces('not_evaluated'),
    claimBoundary: closedClaimBoundary(),
  };
}

function passReport(liveReport, surfaceChecks) {
  return {
    schemaVersion: 'brik64.beta17_fixpoint.public_surface_sync_report.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: 'PASS_BETA17_PUBLIC_SURFACE_SYNC',
    synced: true,
    blockers: [],
    liveVerifyReportRef: liveReportRef(),
    liveVerifyDecision: liveReport.decision,
    liveVerifyVersion: liveReport.version,
    surfaceChecks,
    claimBoundary: syncedClaimBoundary(),
  };
}

function defaultBlockedSurfaces(reason) {
  return [...surfaceMap.keys()].map((id) => ({
    id,
    version,
    pass: false,
    reason,
  }));
}

function liveReportRef() {
  if (!fs.existsSync(liveVerifyPath)) return null;
  return {
    path: rel(liveVerifyPath),
    sha256: sha256File(liveVerifyPath),
    bytes: fs.statSync(liveVerifyPath).size,
  };
}

function observationById(liveReport) {
  const byId = new Map();
  for (const item of liveReport?.observations || []) {
    if (item && typeof item.id === 'string') byId.set(item.id, item);
  }
  return byId;
}

function surfaceChecksFromLiveReport(liveReport, blockers) {
  const byId = observationById(liveReport);
  const checks = [];
  for (const [surfaceId, observationIds] of surfaceMap.entries()) {
    const observations = observationIds.map((id) => byId.get(id)).filter(Boolean);
    const missing = observationIds.filter((id) => !byId.has(id));
    const failed = observations.filter((item) => item.statusCode && (item.statusCode < 200 || item.statusCode >= 400));
    const pass = missing.length === 0 && failed.length === 0;
    const check = {
      id: surfaceId,
      version,
      pass,
      observationIds,
      observed: observations.map((item) => ({
        id: item.id,
        url: item.url || null,
        statusCode: item.statusCode || null,
        sha256: item.sha256 || null,
        bytes: item.bytes || null,
      })),
    };
    if (missing.length > 0) {
      check.missingObservations = missing;
      blockers.push(`surface_missing_observation:${surfaceId}:${missing.join(',')}`);
    }
    if (failed.length > 0) {
      check.failedObservations = failed.map((item) => item.id);
      blockers.push(`surface_observation_failed:${surfaceId}:${failed.map((item) => item.id).join(',')}`);
    }
    checks.push(check);
  }
  return checks;
}

function main() {
  const blockers = [];
  if (!fs.existsSync(liveVerifyPath)) {
    const report = blockedReport([`missing_live_verify_report:${rel(liveVerifyPath)}`]);
    writeJson(outPath, report);
    console.log(`decision=${report.decision}`);
    console.log(`report=${rel(outPath)}`);
    process.exit(1);
  }
  const liveReport = JSON.parse(fs.readFileSync(liveVerifyPath, 'utf8'));
  if (liveReport.version !== version) {
    blockers.push(`live_verify_version_mismatch:${liveReport.version || 'missing'}`);
  }
  if (liveReport.decision !== 'PASS_RELEASE_TRAIN_LIVE_VERIFY') {
    blockers.push(`live_verify_not_pass:${liveReport.decision || 'missing'}`);
  }
  if (liveReport.publicationAllowed !== true) {
    blockers.push('live_verify_publication_not_allowed');
  }
  for (const failure of liveReport.failures || []) {
    blockers.push(`live_verify_failure:${failure}`);
  }
  const surfaceChecks = surfaceChecksFromLiveReport(liveReport, blockers);
  const report = blockers.length === 0
    ? passReport(liveReport, surfaceChecks)
    : blockedReport(blockers, liveReport, surfaceChecks);
  writeJson(outPath, report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${rel(outPath)}`);
  if (blockers.length > 0) process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const report = blockedReport([`public_surface_sync_exception:${error.message}`]);
    writeJson(outPath, report);
    console.error(`beta17_public_surface_sync_fail_closed:${error.message}`);
    process.exit(1);
  }
}
