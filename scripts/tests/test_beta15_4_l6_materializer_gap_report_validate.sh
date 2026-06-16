#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

REAL_REPORT="../brik64-prod/reports/beta15_4-cli-l6-materializer-gap/gap_report.json"
if [ ! -f "$REAL_REPORT" ]; then
  echo "missing real gap report: $REAL_REPORT" >&2
  exit 2
fi

set +e
node scripts/beta15_4-l6-materializer-gap-report-validate.js "$REAL_REPORT" \
  >/tmp/brik64_beta15_4_gap_real.out 2>/tmp/brik64_beta15_4_gap_real.err
real_rc=$?
set -e
if [ "$real_rc" -eq 0 ]; then
  echo "expected current real Beta15.4 gap report to fail closed until L6 materializes the artifact" >&2
  exit 1
fi
grep -q 'beta15_4_l6_materializer_gap_not_pass:BETA15_4_CLI_L6_MATERIALIZER_GAP_BLOCKED' \
  /tmp/brik64_beta15_4_gap_real.err

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

node - "$TMP_DIR/pass.json" "$TMP_DIR/missing-request.json" <<'NODE'
const fs = require('fs');

const hash = 'a'.repeat(64);
const report = {
  version: '0.1.0-beta.15.4',
  decision: 'BETA15_4_CLI_L6_MATERIALIZER_GAP_PASS',
  claim_boundary: {
    public_claims_allowed: false,
    release_publication_allowed: true,
    fixpoint_claim_allowed: false,
    rust_independence_claim_allowed: false
  },
  inputs: {
    cli_beta15_4_l6_attempt: {
      checks: {
        version_exact: true,
        decision_pass: true,
        generated_artifact_manifest_present: true,
        seal_report_present: true
      },
      remote_capability: {
        expectedMaterializationContext: {
          pcdInputSetSha256: hash,
          materializerRequestSha256: 'b'.repeat(64),
          remoteWrapperSha256: 'c'.repeat(64),
          wrapperExecTargetSha256: 'd'.repeat(64),
          requiredInputPcdPaths: [
            'pcd/beta15_4/release/l6_cli_materialization_contract.pcd',
            'pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd'
          ]
        }
      }
    },
    cli_beta15_4_materializer_request: {
      ref: { sha256: 'sha256:' + 'e'.repeat(64) },
      checks: {
        version_exact: true,
        decision_pass: true,
        pcd_input_set_hash_present: true,
        pcd_input_set_hash_matches_attempt: true,
        required_input_pcd_paths_complete: true
      },
      input_pcd_paths: [
        'pcd/beta15_4/release/l6_cli_materialization_contract.pcd',
        'pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd'
      ]
    },
    cli_beta15_4_package: {
      checks: {
        version_exact: true,
        package_decision_pass: true,
        release_eligible: true,
        package_sha_present: true
      }
    }
  }
};

fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
const missingRequest = structuredClone(report);
missingRequest.inputs.cli_beta15_4_materializer_request.checks.pcd_input_set_hash_matches_attempt = false;
fs.writeFileSync(process.argv[3], JSON.stringify(missingRequest, null, 2));
NODE

node scripts/beta15_4-l6-materializer-gap-report-validate.js "$TMP_DIR/pass.json" \
  >/tmp/brik64_beta15_4_gap_pass.out
grep -q 'decision=PASS_BETA15_4_L6_MATERIALIZER_GAP_GATE' /tmp/brik64_beta15_4_gap_pass.out

set +e
node scripts/beta15_4-l6-materializer-gap-report-validate.js "$TMP_DIR/missing-request.json" \
  >/tmp/brik64_beta15_4_gap_missing.out 2>/tmp/brik64_beta15_4_gap_missing.err
missing_rc=$?
set -e
if [ "$missing_rc" -eq 0 ]; then
  echo "expected synthetic PASS report with broken request binding to fail" >&2
  exit 1
fi
grep -q 'beta15_4_l6_materializer_request_input_hash_mismatch' \
  /tmp/brik64_beta15_4_gap_missing.err

echo "PASS beta15.4 L6 materializer gap report validator"
