#!/usr/bin/env bash
set -euo pipefail
umask 077
expected_sha='b09c04ea647dc496e80346f792e8baaafd045806d469dd113873e61f934a2baa'
wrapper='/opt/brik64/engines/l6plus-n5/bin/brik64-l6plus-n5'
endpoint_remote='/opt/brik64/engines/l6plus-n5/current/artifacts/generated/l6plus_beta17_materializer_generator_endpoint.js'
endpoint_tmp=/tmp/brik64-beta17-materializer-generator-b09c04ea647dc496e80346f792e8baaafd045806d469dd113873e61f934a2baa.js
actual_sha="$(sha256sum "$endpoint_tmp" | awk '{print $1}')"
if [ "$actual_sha" != "$expected_sha" ]; then
  echo "beta17_materializer_generator_endpoint_sha_mismatch" >&2
  exit 2
fi
if ! grep -q 'BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT' "$endpoint_tmp"; then
  echo "beta17_materializer_generator_result_marker_missing" >&2
  exit 2
fi
install -d -m 0755 "$(dirname "$endpoint_remote")"
install -m 0755 "$endpoint_tmp" "$endpoint_remote"
backup="${wrapper}.bak.$(date -u +%Y%m%dT%H%M%SZ)"
cp "$wrapper" "$backup"
python3 - "$wrapper" "$endpoint_remote" <<'PY'
import pathlib, sys
wrapper = pathlib.Path(sys.argv[1])
endpoint = sys.argv[2]
text = wrapper.read_text()
marker = "BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_ENDPOINT"
if marker not in text:
    lines = text.splitlines()
    insert_at = None
    for i, line in enumerate(lines):
        if line.strip().startswith("case "):
            insert_at = i + 1
            break
    if insert_at is None:
        raise SystemExit("beta17_materializer_generator_wrapper_case_block_missing")
    block = [
        "  # BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_ENDPOINT",
        "  beta17-fixpoint-materializer-generation-status)",
        "    printf \"BRIK64_L6_CLI_MATERIALIZER_ENDPOINT\\tinstalled\\tbeta17_fixpoint_materializer_generator,beta17_fixpoint_stage_dispatcher\\n\"",
        "    printf \"BRIK64_BETA17_FIXPOINT_MATERIALIZER_GENERATION_RESULT\\tavailable\\n\"",
        "    exit 0",
        "    ;;",
        "  beta17-fixpoint-materializer-generate|fixpoint-materializer-generate|generate-materializer)",
        "    shift",
        f"    exec /usr/bin/node {endpoint} \"$@\"",
        "    ;;",
    ]
    lines[insert_at:insert_at] = block
    wrapper.write_text("\n".join(lines) + "\n")
PY
if ! grep -q 'beta17_fixpoint_materializer_generator' "$wrapper"; then
  echo "beta17_materializer_generator_wrapper_capability_missing" >&2
  exit 2
fi
chmod 0755 "$wrapper"
rm -f "$endpoint_tmp"
printf 'BRIK64_BETA17_MATERIALIZER_GENERATOR_INSTALL_RESULT\tinstalled\t%s\t%s\n' "$expected_sha" 'root@89.167.104.236'
