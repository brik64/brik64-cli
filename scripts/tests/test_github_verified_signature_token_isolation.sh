#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/bin" "$TMP_DIR/fixtures"

cat > "$TMP_DIR/bin/gh" <<'SH'
#!/usr/bin/env bash
if [ -n "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN leaked into gh invocation" >&2
  exit 99
fi
echo "HTTP 401: Bad credentials" >&2
exit 1
SH
chmod +x "$TMP_DIR/bin/gh"

cat > "$TMP_DIR/fixtures/github-commit.json" <<'JSON'
{
  "commit": {
    "verification": {
      "verified": true,
      "reason": "valid",
      "payload": "tree abc\n",
      "verified_at": "2026-06-07T00:00:00Z"
    }
  }
}
JSON

(
  cd "$ROOT_DIR"
  PATH="$TMP_DIR/bin:$PATH" \
  GITHUB_TOKEN="expired_or_sso_blocked_token" \
  BRIK64_GITHUB_VERIFICATION_FALLBACK_JSON="$TMP_DIR/fixtures/github-commit.json" \
  node scripts/beta8-github-verified-signature-gate.js \
    --repo brik64/brik64-cli \
    --commit 0123456789abcdef0123456789abcdef01234567
)

node - <<'NODE' "$ROOT_DIR/evidence/beta8-github-verified-signature/report.json"
const fs = require('fs');
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (report.decision !== 'PASS_BETA8_GITHUB_VERIFIED_SIGNATURE') {
  throw new Error(`unexpected decision ${report.decision}`);
}
if (report.verification.source !== 'fallback_fixture') {
  throw new Error(`unexpected verification source ${report.verification.source}`);
}
if (!report.ghApiError || !report.ghApiError.includes('Bad credentials')) {
  throw new Error('missing gh bad-credentials witness');
}
if (report.apiError) {
  throw new Error(`unexpected apiError ${report.apiError}`);
}
NODE

printf 'PASS github verified signature token isolation\n'
