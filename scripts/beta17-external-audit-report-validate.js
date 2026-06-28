#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REQUIRED_ARTIFACT_REFS = [
  'auditLog',
  'generatedCodeQuality',
  'adversarialResults',
  'publicSurfaceScan',
  'claimSafeScan',
];

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function boolAt(object, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, object) === true;
}

function safeRelativePath(value) {
  const text = String(value || '');
  return (
    text.length > 0 &&
    !text.startsWith('/') &&
    !text.includes('\0') &&
    !/^https?:\/\//i.test(text) &&
    !text.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

function validateArtifactRef(report, artifactKey, options, checks, blockers) {
  const ref = report.artifacts?.[artifactKey];
  const checkKey = `externalAuditArtifact_${artifactKey}`;
  if (!ref || typeof ref !== 'object') {
    checks[checkKey] = false;
    blockers.push(`external_audit_missing_artifact_ref:${artifactKey}`);
    return;
  }
  if (!safeRelativePath(ref.path)) {
    checks[checkKey] = false;
    blockers.push(`external_audit_artifact_path_unsafe:${artifactKey}`);
    return;
  }
  if (typeof ref.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(ref.sha256)) {
    checks[checkKey] = false;
    blockers.push(`external_audit_artifact_sha256_invalid:${artifactKey}`);
    return;
  }
  if (options.rootDir) {
    const root = path.resolve(options.rootDir);
    const resolved = path.resolve(root, ref.path);
    if (!(resolved === root || resolved.startsWith(`${root}${path.sep}`))) {
      checks[checkKey] = false;
      blockers.push(`external_audit_artifact_path_outside_workspace:${artifactKey}`);
      return;
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      checks[checkKey] = false;
      blockers.push(`external_audit_artifact_file_missing:${artifactKey}:${ref.path}`);
      return;
    }
    const actual = sha256File(resolved);
    if (actual !== ref.sha256.toLowerCase()) {
      checks[checkKey] = false;
      blockers.push(`external_audit_artifact_sha256_mismatch:${artifactKey}`);
      return;
    }
  }
  checks[checkKey] = true;
}

function validateBeta17ExternalAuditReport(externalAudit, options = {}) {
  const blockers = [];
  const checks = {};
  const report = externalAudit && typeof externalAudit === 'object' ? externalAudit : {};

  checks.externalAuditPass = report.decision === 'PASS_BETA17_EXTERNAL_AUDIT'
    || report.status === 'PASS'
    || report.pass === true;
  checks.externalAuditCleanPublicInstall = boolAt(report, 'cleanPublicInstall.pass')
    || boolAt(report, 'cleanInstall.pass')
    || boolAt(report, 'cleanPublicInstall');
  checks.externalAuditFunctionalTests = boolAt(report, 'functionalTests.pass')
    || boolAt(report, 'cliFunctionalTests.pass')
    || boolAt(report, 'functionalTests');
  checks.externalAuditGeneratedCodeTests = boolAt(report, 'generatedCodeTests.pass')
    || boolAt(report, 'generatedCode.pass')
    || boolAt(report, 'generatedCodeTests');
  checks.externalAuditAdversarialTests = boolAt(report, 'adversarialTests.pass')
    || boolAt(report, 'adversarial.pass')
    || boolAt(report, 'adversarialTests');
  checks.externalAuditPublicSurfaceScan = boolAt(report, 'publicSurfaceScan.pass')
    || boolAt(report, 'publicSurfaces.pass')
    || boolAt(report, 'publicSurfaceScan');
  checks.externalAuditClaimSafeScan = boolAt(report, 'claimSafeScan.pass')
    || boolAt(report, 'claims.pass')
    || boolAt(report, 'claimSafeScan');

  if (!checks.externalAuditPass) blockers.push(`external_audit_not_pass:${report.decision || report.status || 'missing'}`);
  if (!checks.externalAuditCleanPublicInstall) blockers.push('external_audit_missing_clean_public_install');
  if (!checks.externalAuditFunctionalTests) blockers.push('external_audit_missing_functional_tests');
  if (!checks.externalAuditGeneratedCodeTests) blockers.push('external_audit_missing_generated_code_tests');
  if (!checks.externalAuditAdversarialTests) blockers.push('external_audit_missing_adversarial_tests');
  if (!checks.externalAuditPublicSurfaceScan) blockers.push('external_audit_missing_public_surface_scan');
  if (!checks.externalAuditClaimSafeScan) blockers.push('external_audit_missing_claim_safe_scan');
  for (const artifactKey of REQUIRED_ARTIFACT_REFS) {
    validateArtifactRef(report, artifactKey, options, checks, blockers);
  }

  return {
    schemaVersion: 'brik64.beta17_external_audit.validation.v1',
    decision: blockers.length === 0
      ? 'PASS_BETA17_EXTERNAL_AUDIT_VALIDATION'
      : 'BLOCKED_BETA17_EXTERNAL_AUDIT_VALIDATION',
    checks,
    blockers,
  };
}

function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    console.error('usage: node scripts/beta17-external-audit-report-validate.js <external_audit_report.json>');
    process.exit(2);
  }
  const resolved = path.resolve(process.cwd(), reportPath);
  const externalAudit = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const validation = validateBeta17ExternalAuditReport(externalAudit, {
    rootDir: path.dirname(resolved),
  });
  console.log(JSON.stringify(validation, null, 2));
  if (validation.blockers.length > 0) process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  REQUIRED_ARTIFACT_REFS,
  validateBeta17ExternalAuditReport,
};
