#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function boolAt(object, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, object) === true;
}

function validateBeta17ExternalAuditReport(externalAudit) {
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
  const validation = validateBeta17ExternalAuditReport(externalAudit);
  console.log(JSON.stringify(validation, null, 2));
  if (validation.blockers.length > 0) process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  validateBeta17ExternalAuditReport,
};
