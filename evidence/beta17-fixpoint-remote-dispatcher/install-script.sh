#!/usr/bin/env bash
set -euo pipefail
umask 077
expected_sha='47947e05a2ba137c7cd8e6a3b828efa9350762c8295800a5fa27f1299f0bbde6'
wrapper='/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5'
materializer_remote='/opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_beta17_fixpoint_stage_materializer.js'
materializer_tmp='/tmp/brik64-beta17-dispatcher-47947e05a2ba137c7cd8e6a3b828efa9350762c8295800a5fa27f1299f0bbde6.js'
actual_sha="$(sha256sum "$materializer_tmp" | awk '{print $1}')"
if [ "$actual_sha" != "$expected_sha" ]; then
  echo "beta17_dispatcher_materializer_sha_mismatch" >&2
  exit 2
fi
if ! grep -q 'BRIK64_BETA17_FIXPOINT_STAGE_RESULT' "$materializer_tmp"; then
  echo "beta17_dispatcher_materializer_result_marker_missing" >&2
  exit 2
fi
install -d -m 0755 "$(dirname "$materializer_remote")"
install -m 0755 "$materializer_tmp" "$materializer_remote"
backup="${wrapper}.bak.$(date -u +%Y%m%dT%H%M%SZ)"
cp "$wrapper" "$backup"
python3 - "$wrapper" "$materializer_remote" <<'PY'
import pathlib, sys
wrapper = pathlib.Path(sys.argv[1])
materializer = sys.argv[2]
text = wrapper.read_text()
marker = "BRIK64_BETA17_FIXPOINT_STAGE_ENDPOINT"
if marker not in text:
    lines = text.splitlines()
    insert_at = None
    for i, line in enumerate(lines):
        if line.strip().startswith("case "):
            insert_at = i + 1
            break
    if insert_at is None:
        raise SystemExit("beta17_dispatcher_wrapper_case_block_missing")
    block = [
        "    # BRIK64_BETA17_FIXPOINT_STAGE_ENDPOINT",
        "    beta17-fixpoint-stage-status)",
        "      printf \"BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\\tinstalled\\tbeta17_fixpoint_stage_dispatcher\\n\"",
        "      exit 0",
        "      ;;",
        "    beta17-fixpoint-stage-materialize|fixpoint-stage-materialize|materialize)",
        "      shift",
        "      exec /usr/bin/node /opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_beta17_fixpoint_stage_materializer.js \"$@\""
        "      ;;",
    ]
    lines[insert_at:insert_at] = block
    wrapper.write_text("\n".join(lines) + "\n")
PY
if ! grep -q 'beta17_fixpoint_stage_dispatcher' "$wrapper"; then
  echo "beta17_dispatcher_wrapper_patch_missing_capability" >&2
  exit 2
fi
chmod 0755 "$wrapper"
rm -f "$materializer_tmp"
printf 'BRIK64_BETA17_DISPATCHER_INSTALL_RESULT\tinstalled\t%s\t%s\n' "$expected_sha" 'root@89.167.104.236'
