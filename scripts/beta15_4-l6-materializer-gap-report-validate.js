#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const VERSION = '0.1.0-beta.15.4';
const PASS_DECISION = 'BETA15_4_CLI_L6_MATERIALIZER_GAP_PASS';
const HEX64 = /^[a-f0-9]{64}$/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function cleanHash(value) {
  if (typeof value !== 'string') return '';
  return value.startsWith('sha256:') ? value.slice('sha256:'.length) : value;
}

function check(condition, blockers, code) {
  if (!condition) blockers.push(code);
}

function validateGapReport(report) {
  const blockers = [];
  check(report && typeof report === 'object', blockers, 'beta15_4_l6_materializer_gap_report_invalid');
  if (blockers.length > 0) return { ok: false, blockers };

  check(report.version === VERSION, blockers, `beta15_4_l6_materializer_gap_version_invalid:${report.version || 'missing'}`);
  check(report.decision === PASS_DECISION, blockers, `beta15_4_l6_materializer_gap_not_pass:${report.decision || 'missing'}`);

  const claimBoundary = report.claim_boundary || {};
  check(claimBoundary.public_claims_allowed === false, blockers, 'beta15_4_l6_materializer_gap_public_claim_boundary_invalid');
  check(claimBoundary.release_publication_allowed === true, blockers, 'beta15_4_l6_materializer_gap_release_publication_not_allowed');
  check(claimBoundary.fixpoint_claim_allowed === false, blockers, 'beta15_4_l6_materializer_gap_fixpoint_boundary_invalid');
  check(claimBoundary.rust_independence_claim_allowed === false, blockers, 'beta15_4_l6_materializer_gap_rust_independence_boundary_invalid');

  const inputs = report.inputs || {};
  const attempt = inputs.cli_beta15_4_l6_attempt || {};
  const attemptChecks = attempt.checks || {};
  check(attemptChecks.version_exact === true, blockers, 'beta15_4_l6_attempt_version_check_missing');
  check(attemptChecks.decision_pass === true, blockers, 'beta15_4_l6_attempt_decision_check_missing');
  check(attemptChecks.generated_artifact_manifest_present === true, blockers, 'beta15_4_l6_attempt_artifact_manifest_check_missing');
  check(attemptChecks.seal_report_present === true, blockers, 'beta15_4_l6_attempt_seal_report_check_missing');

  const request = inputs.cli_beta15_4_materializer_request || {};
  const requestChecks = request.checks || {};
  check(requestChecks.version_exact === true, blockers, 'beta15_4_l6_materializer_request_version_check_missing');
  check(requestChecks.decision_pass === true, blockers, 'beta15_4_l6_materializer_request_decision_check_missing');
  check(requestChecks.pcd_input_set_hash_present === true, blockers, 'beta15_4_l6_materializer_request_input_hash_missing');
  check(requestChecks.pcd_input_set_hash_matches_attempt === true, blockers, 'beta15_4_l6_materializer_request_input_hash_mismatch');
  check(requestChecks.required_input_pcd_paths_complete === true, blockers, 'beta15_4_l6_materializer_request_required_inputs_incomplete');

  const expected = attempt.remote_capability?.expectedMaterializationContext || {};
  check(HEX64.test(expected.pcdInputSetSha256 || ''), blockers, 'beta15_4_l6_expected_pcd_input_set_hash_invalid');
  check(HEX64.test(expected.materializerRequestSha256 || ''), blockers, 'beta15_4_l6_expected_materializer_request_hash_invalid');
  check(HEX64.test(expected.remoteWrapperSha256 || ''), blockers, 'beta15_4_l6_expected_remote_wrapper_hash_invalid');
  check(HEX64.test(expected.wrapperExecTargetSha256 || ''), blockers, 'beta15_4_l6_expected_wrapper_exec_hash_invalid');

  const requestRefHash = cleanHash(request.ref?.sha256);
  check(HEX64.test(requestRefHash), blockers, 'beta15_4_l6_materializer_request_manifest_ref_hash_invalid');

  const requestInputPaths = Array.isArray(request.input_pcd_paths) ? request.input_pcd_paths : [];
  const requiredInputPaths = Array.isArray(expected.requiredInputPcdPaths) ? expected.requiredInputPcdPaths : [];
  for (const requiredPath of requiredInputPaths) {
    check(requestInputPaths.includes(requiredPath), blockers, `beta15_4_l6_materializer_request_missing_required_input:${requiredPath}`);
  }

  const packageInput = inputs.cli_beta15_4_package || {};
  const packageChecks = packageInput.checks || {};
  check(packageChecks.version_exact === true, blockers, 'beta15_4_package_version_check_missing');
  check(packageChecks.package_decision_pass === true, blockers, 'beta15_4_package_decision_check_missing');
  check(packageChecks.release_eligible === true, blockers, 'beta15_4_package_release_eligible_missing');
  check(packageChecks.package_sha_present === true, blockers, 'beta15_4_package_sha_check_missing');

  return { ok: blockers.length === 0, blockers };
}

function main() {
  const reportPath = process.argv[2] || process.env.BRIK64_BETA15_4_L6_GAP_REPORT;
  if (!reportPath) {
    console.error('beta15_4_l6_materializer_gap_report_path_missing');
    process.exit(2);
  }
  const resolved = path.resolve(reportPath);
  if (!fs.existsSync(resolved)) {
    console.error('beta15_4_l6_materializer_gap_report_missing:' + resolved);
    process.exit(2);
  }
  const result = validateGapReport(readJson(resolved));
  if (!result.ok) {
    for (const blocker of result.blockers) console.error(blocker);
    process.exit(2);
  }
  console.log('decision=PASS_BETA15_4_L6_MATERIALIZER_GAP_GATE');
}

if (require.main === module) {
  main();
}

module.exports = {
  validateGapReport
};
