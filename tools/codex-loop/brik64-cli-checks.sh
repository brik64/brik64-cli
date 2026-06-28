#!/usr/bin/env bash
set -euo pipefail

echo "# BRIK64 CLI safe check runner"
echo "repo=$(pwd)"

if [ ! -f package.json ]; then
  echo "FAILED: package.json not found; run from brik64-cli root"
  exit 2
fi

run_script_if_present() {
  local script="$1"
  local label="$2"
  if node -e "const s=require('./package.json').scripts||{}; process.exit(s['$script']?0:1)" 2>/dev/null; then
    echo "RUN $label: npm run $script"
    npm run "$script"
  else
    echo "SKIP $label: missing package script '$script'"
  fi
}

run_script_if_present "test" "LEVEL 1 smoke tests"
run_script_if_present "release:manifest:validate" "LEVEL 1 release manifest validation"
run_script_if_present "release:flow:audit" "LEVEL 2 release flow audit"

if node -e "const s=require('./package.json').scripts||{}; process.exit(s['gate:cli:l6-generation-required']?0:1)" 2>/dev/null; then
  echo "RUN EVIDENCE gate: npm run gate:cli:l6-generation-required"
  npm run gate:cli:l6-generation-required
else
  echo "SKIP EVIDENCE gate: missing gate:cli:l6-generation-required"
fi

echo "RUN EVIDENCE gate: clean worktree after checks"
dirty_disallowed="$(git status --porcelain --untracked-files=no | awk '
  {
    path=$0
    sub(/^[ MADRCU?!][ MADRCU?!] /, "", path)
    if (
      path != "evidence/cli-l6-generation-required/report.json" &&
      path != "evidence/release-flow-audit/report.json" &&
      path != "evidence/release-manifest-validate/report.json"
    ) print $0
  }
')"
if [ -n "$dirty_disallowed" ]; then
  printf "%s\n" "$dirty_disallowed"
  echo "FAILED: tracked worktree changed during codex-loop checks"
  exit 1
fi

echo "ALL GREEN: BRIK64 CLI safe checks passed"
