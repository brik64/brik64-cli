#!/usr/bin/env bash
set -euo pipefail
umask 077
expected_sha='6165d2d159a873460134a2bbf3f683042268d123df7d45e910966a5e54520f45'
wrapper='/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5'
factory_remote='/opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_pcd_artifact_factory.js'
factory_tmp=/tmp/brik64-l6plus-pcd-artifact-factory-6165d2d159a873460134a2bbf3f683042268d123df7d45e910966a5e54520f45.js
actual_sha="$(sha256sum "$factory_tmp" | awk '{print $1}')"
if [ "$actual_sha" != "$expected_sha" ]; then
  echo "l6plus_pcd_artifact_factory_sha_mismatch" >&2
  exit 2
fi
if ! grep -q 'BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT' "$factory_tmp"; then
  echo "l6plus_pcd_artifact_factory_result_marker_missing" >&2
  exit 2
fi
install -d -m 0755 "$(dirname "$factory_remote")"
install -m 0755 "$factory_tmp" "$factory_remote"
backup="${wrapper}.bak.$(date -u +%Y%m%dT%H%M%SZ)"
cp "$wrapper" "$backup"
python3 - "$wrapper" "$factory_remote" <<'PY'
import pathlib, sys
wrapper = pathlib.Path(sys.argv[1])
factory = sys.argv[2]
text = wrapper.read_text()
marker = "BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_ENDPOINT"
if marker not in text:
    lines = text.splitlines()
    insert_at = None
    for i, line in enumerate(lines):
        if line.strip().startswith("case "):
            insert_at = i + 1
            break
    if insert_at is None:
        raise SystemExit("l6plus_pcd_artifact_factory_wrapper_case_block_missing")
    block = [
        "  # BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_ENDPOINT",
        "  artifact-factory-status|pcd-artifact-factory-status|factory-status)",
        "    printf \"BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY\\tinstalled\\tl6plus_pcd_artifact_factory,cli,sdk,harness,engine,docs,evidence-pack\\n\"",
        "    printf \"BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_RESULT\\tavailable\\n\"",
        "    exit 0",
        "    ;;",
        "  artifact-factory-materialize|pcd-artifact-factory-materialize|factory-materialize)",
        "    shift",
        f"    exec /usr/bin/node {factory} \"$@\"",
        "    ;;",
    ]
    lines[insert_at:insert_at] = block
    wrapper.write_text("\n".join(lines) + "\n")
PY
if ! grep -q 'l6plus_pcd_artifact_factory' "$wrapper"; then
  echo "l6plus_pcd_artifact_factory_wrapper_capability_missing" >&2
  exit 2
fi
chmod 0755 "$wrapper"
rm -f "$factory_tmp"
printf 'BRIK64_L6PLUS_PCD_ARTIFACT_FACTORY_INSTALL_RESULT\tinstalled\t%s\t%s\n' "$expected_sha" 'root@89.167.104.236'
