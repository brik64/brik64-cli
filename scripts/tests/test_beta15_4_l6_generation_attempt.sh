#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

BRIK64_L6_WRAPPER="${BRIK64_L6_WRAPPER:-/opt/brik64/builds/brik64-prod-e5d6fdba1-min/target/debug/brikc_cli_l6plus}" \
BRIK64_L6_DIRECT_BINARY="${BRIK64_L6_DIRECT_BINARY:-/opt/brik64/builds/brik64-prod-e5d6fdba1-min/target/debug/brikc_cli_l6plus}" \
  npm run attempt:beta15.4:l6-generation >/tmp/brik64_beta15_4_l6_attempt.log 2>&1

jq -e '
  .version=="0.1.0-beta.15.4"
  and .decision=="PASS_BETA15_4_L6_GENERATION_GATE"
  and .publicationAllowed==true
  and (.blockers | length == 0)
  and .remoteCapability.materializerContractAccepted==true
  and (.remoteCapability.wrapper.sha256 | type=="string")
  and (.attempts[0].command[1]=="l6-cli-materialize")
  and .directRoute2Materialization.present==true
  and .directRoute2Materialization.accepted==true
  and (.directRoute2Materialization.blockers | length == 0)
' evidence/beta15_4-l6-generation/gate-report.json >/dev/null

jq -e '
  .version=="0.1.0-beta.15.4"
  and .generatedByL6PlusN5==true
  and .pcdToArtifactHashBound==true
  and ([.inputPcds[].path] | index("pcd/beta15_4/release/l6_cli_materialization_contract.pcd"))
  and ([.inputPcds[].path] | index("pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd"))
' evidence/beta15_4-l6-generation/generated_artifact_manifest.json >/dev/null

jq -e '
  .failures==0
  and ([.units[].sourcePath] | index("pcd/beta15_4/release/l6_cli_materialization_contract.pcd"))
  and ([.units[].sourcePath] | index("pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd"))
  and ([.units[].sourcePath] | index("pcd/beta15_4/cli/rust_app_polymer_domain_codegen.pcd"))
  and ([.units[].sourcePath] | index("pcd/beta15_4/harness/rust_app_polymer_regression_gate.pcd"))
  and ([.units[].sourcePath] | index("pcd/cli_core.pcd"))
  and ([.units[].sourcePath] | index("pcd/cli_polymer.pcd"))
' evidence/beta15_4-l6-generation/direct-materialization-summary.json >/dev/null

grep -q 'pcd/beta15_4/release/l6_cli_materialization_contract.pcd' \
  evidence/beta15_4-l6-generation/input_pcd_hashes.tsv
grep -q 'pcd/beta15_4/release/l6_cli_materialization_result_contract.pcd' \
  evidence/beta15_4-l6-generation/input_pcd_hashes.tsv

echo "PASS beta15.4 L6 generation attempt materializes required PCD contracts"
