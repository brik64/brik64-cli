#!/usr/bin/env bash
set -euo pipefail

echo "# BRIK64 CLI claim audit"
echo "repo=$(pwd)"
mode="${1:-changed}"

patterns=(
  "formal certification"
  "formally certified"
  "N5 formal"
  "formal N5"
  "self-host"
  "self hosting"
  "fixpoint complete"
  "Rust independence"
  "toolchain independence"
  "pure BRIK64 chain"
  "zero bugs"
  "100% correct"
  "fully correct"
  "production proven"
)

is_auditable_file() {
  case "$1" in
    ./tools/codex-loop/*|tools/codex-loop/*) return 1 ;;
    ./.codex-loop-runs/*|.codex-loop-runs/*) return 1 ;;
    ./evidence/*|evidence/*) return 1 ;;
    ./scripts/*|scripts/*) return 1 ;;
    *.md|*.mdx|*.txt|*.tsx|*.ts|*.jsx|*.js|*.json|*.yml|*.yaml) return 0 ;;
    *) return 1 ;;
  esac
}

targets=()
if [ "$mode" = "--all" ]; then
  while IFS= read -r file; do targets+=("$file"); done < <(find . \
    -path './.git' -prune -o \
    -path './node_modules' -prune -o \
    -path './dist' -prune -o \
    -path './target' -prune -o \
    -path './.codex-loop-runs' -prune -o \
    -path './evidence' -prune -o \
    -path './evidence/*/stage' -prune -o \
    -path './scripts' -prune -o \
    -path './tools/codex-loop' -prune -o \
    -type f \( -name '*.md' -o -name '*.mdx' -o -name '*.txt' -o -name '*.tsx' -o -name '*.ts' -o -name '*.jsx' -o -name '*.js' -o -name '*.json' -o -name '*.yml' -o -name '*.yaml' \) \
    -print)
elif git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    [ -f "$file" ] || continue
    is_auditable_file "$file" || continue
    targets+=("$file")
  done < <({ git diff --name-only --diff-filter=ACMR HEAD; git ls-files --others --exclude-standard; } | sort -u)
fi

if [ "${#targets[@]}" -eq 0 ]; then
  echo "CLAIM SAFE: no auditable changed files"
  exit 0
fi

failed=0
rm -f /tmp/brik64-cli-claim-hit.txt /tmp/brik64-cli-generated-authority-hit.txt
filter_negated_hits() {
  grep -Eiv 'does not|do not|must not|not claim|not establish|without claiming|no public claim|claim.*false|allowed.*false|candidate only|local candidate audit gate only' || true
}
for pattern in "${patterns[@]}"; do
  if grep -RIn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=target --exclude-dir=evidence --exclude-dir=.codex-loop-runs --exclude-dir=tools/codex-loop "$pattern" "${targets[@]}" 2>/dev/null | filter_negated_hits >/tmp/brik64-cli-claim-hit.txt; then
    [ -s /tmp/brik64-cli-claim-hit.txt ] || continue
    echo "CLAIM REVIEW REQUIRED: '$pattern'"
    cat /tmp/brik64-cli-claim-hit.txt
    failed=1
  fi
done

grep -RIn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=target --exclude-dir=evidence --exclude-dir=scripts --exclude-dir=.codex-loop-runs --exclude-dir=tools/codex-loop "generated" "${targets[@]}" 2>/dev/null \
  | grep -Ei "source of truth|authority|canonical" \
  | filter_negated_hits >/tmp/brik64-cli-generated-authority-hit.txt || true
[ -s /tmp/brik64-cli-generated-authority-hit.txt ] || rm -f /tmp/brik64-cli-generated-authority-hit.txt

if [ -f /tmp/brik64-cli-generated-authority-hit.txt ]; then
  echo "CLAIM REVIEW REQUIRED: generated artifact may be treated as authority"
  cat /tmp/brik64-cli-generated-authority-hit.txt
  failed=1
fi

rm -f /tmp/brik64-cli-claim-hit.txt /tmp/brik64-cli-generated-authority-hit.txt

if [ "$failed" -ne 0 ]; then
  echo "CLAIM UNSAFE: review required before closeout"
  exit 1
fi

echo "CLAIM SAFE: no obvious unsupported claim patterns found"
