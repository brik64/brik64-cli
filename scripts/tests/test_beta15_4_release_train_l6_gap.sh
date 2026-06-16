#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

REPORT="../brik64-prod/reports/beta15_4-cli-l6-materializer-gap/gap_report.json"
if [ ! -f "$REPORT" ]; then
  echo "missing gap report: $REPORT" >&2
  exit 2
fi

GITHUB_ACTIONS=true GITHUB_EVENT_NAME=pull_request \
  npm run release:train:dry-run -- --allow-dirty >/tmp/brik64_beta15_4_pr_gap.log

jq -e '
  .decision=="PASS_RELEASE_TRAIN_DRY_RUN"
  and .publicationAllowed==false
  and ([.commands[] | select(.name=="beta15_4_l6_materializer_gap_deferred_for_pr") | .rc] | first)==0
  and ([.requiredEvidence[] | select(.id=="beta15_4_l6_materializer_gap") | .pass] | first)==true
' evidence/release-train-dry-run/report.json >/dev/null

set +e
npm run release:train:dry-run -- --allow-dirty >/tmp/brik64_beta15_4_release_gap.log 2>&1
rc=$?
set -e
if [ "$rc" -eq 0 ]; then
  echo "expected release dry-run to fail while Beta15.4 L6 gap report is blocked" >&2
  exit 1
fi

jq -e '
  .decision=="FAIL_RELEASE_TRAIN_DRY_RUN"
  and (.failures | index("command_failed:beta15_4_l6_materializer_gap:2"))
  and (.failures | index("candidate_beta15_4_l6_materializer_gap_invalid:BETA15_4_CLI_L6_MATERIALIZER_GAP_BLOCKED"))
  and ([.requiredEvidence[] | select(.id=="beta15_4_l6_materializer_gap") | .pass] | first)==false
' evidence/release-train-dry-run/report.json >/dev/null

echo "PASS beta15.4 release train L6 materializer gap regression"
