#!/usr/bin/env bash
set -Eeuo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

SOURCE='scripts/production-p0-reviewer-repair-diagnose.sh'
PATCHED="$RUNNER_TEMP/production-p0-reviewer-repair-diagnose-deployed-sha.sh"

python - "$SOURCE" "$PATCHED" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1])
target = Path(sys.argv[2])
text = source.read_text(encoding='utf-8')

replacements = {
    "DIAGNOSTIC_BASE_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'":
        "DIAGNOSTIC_BASE_SHA='fc7bea2b225ce88e5cf10230d0188ffb2952381e'",
    "DEPLOYED_SHA='159b597c512aa88f24ffe9a9f37863fe5892c02f'":
        "DEPLOYED_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'",
    """expected_paths=(
  '.github/workflows/production-p0-reviewer-repair-diagnose.yml'
  'docs/platform-v7/autopilot/scopes/production-p0-reviewer-repair-diagnose-3802.json'
  'scripts/check-production-p0-reviewer-repair-diagnose.mjs'
  'scripts/production-p0-reviewer-repair-diagnose.sh'
)""":
        """expected_paths=(
  '.github/workflows/production-p0-reviewer-repair-diagnose.yml'
  'docs/platform-v7/autopilot/scopes/production-p0-reviewer-repair-diagnose-3802.json'
  'scripts/check-production-p0-reviewer-repair-diagnose.mjs'
  'scripts/production-p0-reviewer-repair-diagnose-deployed-sha.sh'
)""",
}

for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'exact diagnostic replacement cardinality invalid: {count}')
    text = text.replace(old, new, 1)

for forbidden in (
    "DEPLOYED_SHA='159b597c512aa88f24ffe9a9f37863fe5892c02f'",
    "DIAGNOSTIC_BASE_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'",
    "scripts/production-p0-reviewer-repair-diagnose.sh'\n)",
):
    if forbidden in text:
        raise SystemExit('stale diagnostic authority remained after bounded replacement')

target.write_text(text, encoding='utf-8')
PY

chmod 0700 "$PATCHED"
bash -n "$PATCHED"
exec bash "$PATCHED"
