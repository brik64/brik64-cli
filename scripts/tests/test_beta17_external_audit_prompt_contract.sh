#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROMPT="$ROOT/docs/ops/BETA17_EXTERNAL_AUDIT_PROMPT.md"

test -f "$PROMPT"

for required in \
  "evidence/beta17-fixpoint/external_audit_report.json" \
  "cleanPublicInstall" \
  "functionalTests" \
  "generatedCodeTests" \
  "adversarialTests" \
  "publicSurfaceScan" \
  "claimSafeScan" \
  "\"artifacts\"" \
  "\"auditLog\"" \
  "\"generatedCodeQuality\"" \
  "\"adversarialResults\"" \
  "PASS_BETA17_EXTERNAL_AUDIT" \
  "FAIL_BETA17_EXTERNAL_AUDIT" \
  "curl -fsSL https://brik64.com/cli/install.sh | bash" \
  "brik64 --version" \
  "brik64 engine status --json" \
  "brik64 emit --target ts --tests" \
  "brik64 emit --target python --tests" \
  "brik64 emit --target rust --tests" \
  "brik64 lift rust --preview" \
  "brik64 monomers test --all --json" \
  "https://brik64.com/cli/beta.json" \
  "https://docs.brik64.com"
do
  if ! grep -Fq "$required" "$PROMPT"; then
    echo "missing_beta17_external_audit_prompt_contract:$required" >&2
    exit 1
  fi
done

echo "PASS beta17 external audit prompt contract"
