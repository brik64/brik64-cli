#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

set +e
npm run attempt:beta15.4:l6-generation >/tmp/brik64_beta15_4_l6_attempt.log 2>&1
rc=$?
set -e

if [[ "$rc" -eq 0 ]]; then
  echo "expected Beta15.4 L6 generation attempt to fail closed until materializer exists" >&2
  exit 1
fi

jq -e '
  .version=="0.1.0-beta.15.4"
  and .decision=="BLOCKED_BETA15_4_L6_GENERATION_GATE"
  and .publicationAllowed==false
  and (.blockers | index("generated_artifact_missing"))
  and (.blockers | index("remote_l6plus_materialization_contract_unavailable"))
  and (.blockers | index("unsupported_or_missing_input_for_l6_cli_materialization_contract"))
  and (.blockers | index("remote_l6plus_wrapper_has_no_cli_materializer_interface") | not)
  and (.remoteCapability.wrapperMode=="cli_materializer_dispatcher" or .remoteCapability.wrapperMode=="shell_exec_only")
  and .remoteCapability.materializerContractAccepted==false
  and (.remoteCapability.wrapper.sha256 | type=="string")
  and (.remoteCapability.wrapperExecTarget.sha256 | type=="string")
  and (.attempts[0].command[1]=="l6-cli-materialize")
  and (.attempts[0].observed | contains("BRIK64_L6_CLI_MATERIALIZER_ENDPOINT") or contains("unsupported_or_missing_input"))
' evidence/beta15_4-l6-generation/gate-report.json >/dev/null

jq -e '
  .version=="0.1.0-beta.15.4"
  and .generatedByL6PlusN5==false
  and .pcdToArtifactHashBound==false
  and ([.inputPcds[].path] | index("pcd/beta15_4/release/l6_cli_materialization_contract.pcd"))
' evidence/beta15_4-l6-generation/generated_artifact_manifest.json >/dev/null

grep -q 'pcd/beta15_4/release/l6_cli_materialization_contract.pcd' \
  evidence/beta15_4-l6-generation/input_pcd_hashes.tsv

echo "PASS beta15.4 L6 generation attempt fails closed with materialization contract"
