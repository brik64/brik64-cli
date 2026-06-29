#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateBeta17ExternalAuditReport } = require('./beta17-external-audit-report-validate');

const root = process.env.BRIK64_CLI_ROOT
  ? path.resolve(process.env.BRIK64_CLI_ROOT)
  : path.resolve(__dirname, '..');
const version = process.env.BRIK64_BETA17_VERSION || '0.1.0-beta.17';
const fixpointDir = path.join(root, 'evidence', 'beta17-fixpoint');
const publicSyncPath = argValue('--public-sync', path.join(fixpointDir, 'public_surface_sync_report.json'));
const externalAuditPath = argValue('--external-audit', path.join(fixpointDir, 'external_audit_report.json'));
const outPath = argValue('--out', path.join(root, 'evidence', 'beta17-fixpoint-external-audit-status', 'report.json'));

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function rel(file) {
  return path.relative(root, file);
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fileRef(file) {
  if (!fs.existsSync(file)) return null;
  return {
    path: rel(file),
    sha256: sha256File(file),
    bytes: fs.statSync(file).size,
  };
}

function claimBoundary(publicReleaseAllowed) {
  return {
    publicReleaseAllowed,
    definitiveFixpointAllowed: false,
    formalN5ClaimAllowed: false,
    universalCorrectnessClaimAllowed: false,
    publicClaimsAllowed: publicReleaseAllowed,
    selfHostingClaimAllowed: false,
    rustIndependenceClaimAllowed: false,
  };
}

function checkPublicSync(blockers, checks) {
  if (!fs.existsSync(publicSyncPath)) {
    checks.publicSurfaceSyncPass = false;
    blockers.push(`missing_public_surface_sync_report:${rel(publicSyncPath)}`);
    return null;
  }
  const publicSync = readJson(publicSyncPath);
  checks.publicSurfaceSyncPass = publicSync.decision === 'PASS_BETA17_PUBLIC_SURFACE_SYNC'
    && publicSync.synced === true
    && publicSync.version === version;
  if (publicSync.version !== version) {
    blockers.push(`public_surface_sync_version_mismatch:${publicSync.version || 'missing'}`);
  }
  if (publicSync.decision !== 'PASS_BETA17_PUBLIC_SURFACE_SYNC') {
    blockers.push(`public_surface_sync_not_pass:${publicSync.decision || 'missing'}`);
  }
  if (publicSync.synced !== true) {
    blockers.push('public_surface_sync_not_synced');
  }
  return publicSync;
}

function checkExternalAudit(blockers, checks) {
  if (!fs.existsSync(externalAuditPath)) {
    checks.externalAuditValidationPass = false;
    blockers.push(`missing_external_audit_report:${rel(externalAuditPath)}`);
    return null;
  }
  const externalAudit = readJson(externalAuditPath);
  const validation = validateBeta17ExternalAuditReport(externalAudit, { rootDir: root });
  checks.externalAuditValidationPass = validation.decision === 'PASS_BETA17_EXTERNAL_AUDIT_VALIDATION';
  checks.externalAuditPass = validation.checks.externalAuditPass === true;
  checks.externalAuditCleanPublicInstall = validation.checks.externalAuditCleanPublicInstall === true;
  checks.externalAuditFunctionalTests = validation.checks.externalAuditFunctionalTests === true;
  checks.externalAuditGeneratedCodeTests = validation.checks.externalAuditGeneratedCodeTests === true;
  checks.externalAuditAdversarialTests = validation.checks.externalAuditAdversarialTests === true;
  checks.externalAuditPublicSurfaceScan = validation.checks.externalAuditPublicSurfaceScan === true;
  checks.externalAuditClaimSafeScan = validation.checks.externalAuditClaimSafeScan === true;
  for (const blocker of validation.blockers) blockers.push(blocker);
  return { externalAudit, validation };
}

function main() {
  const blockers = [];
  const checks = {};
  checkPublicSync(blockers, checks);
  const audit = checkExternalAudit(blockers, checks);
  if (!checks.publicSurfaceSyncPass) {
    blockers.push('external_audit_blocked_until_public_surface_sync_passes');
  }
  const pass = blockers.length === 0;
  const report = {
    schemaVersion: 'brik64.beta17_fixpoint.external_audit_status_gate.v1',
    version,
    generatedAt: new Date().toISOString(),
    decision: pass
      ? 'PASS_BETA17_EXTERNAL_AUDIT_STATUS_GATE'
      : 'BLOCKED_BETA17_EXTERNAL_AUDIT_STATUS_GATE',
    checks,
    blockers: [...new Set(blockers)],
    publicSurfaceSyncReportRef: fileRef(publicSyncPath),
    externalAuditReportRef: fileRef(externalAuditPath),
    externalAuditValidation: audit?.validation || null,
    nextAction: pass
      ? 'run gate:beta17:fixpoint-readiness'
      : 'sync Beta17 public surfaces, run external audit from public install, then regenerate this status report',
    claimBoundary: claimBoundary(pass),
  };
  writeJson(outPath, report);
  console.log(`decision=${report.decision}`);
  console.log(`report=${rel(outPath)}`);
  if (!pass) process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    writeJson(outPath, {
      schemaVersion: 'brik64.beta17_fixpoint.external_audit_status_gate.v1',
      version,
      generatedAt: new Date().toISOString(),
      decision: 'BLOCKED_BETA17_EXTERNAL_AUDIT_STATUS_GATE',
      checks: {},
      blockers: [`external_audit_status_exception:${error.message}`],
      claimBoundary: claimBoundary(false),
    });
    console.error(`beta17_external_audit_status_fail_closed:${error.message}`);
    process.exit(1);
  }
}
