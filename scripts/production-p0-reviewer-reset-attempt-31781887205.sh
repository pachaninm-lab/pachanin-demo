#!/usr/bin/env bash
set -Eeuo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_ATTEMPT_COMMAND:?PC_REVIEWER_RESET_ATTEMPT_COMMAND is required}"

COMMAND='/production p0-reviewer-reset-attempt-classify 31781887205 current-main'
SOURCE='scripts/production-p0-reviewer-reset-attempt-classifier.sh'
SOURCE_BLOB='7dcfb19d247aab2f0dc8c8075416673499c9dc84'
TMP="$RUNNER_TEMP/pc-p0-reviewer-reset-attempt-31781887205.sh"
OLD_SOURCE_REVISION='7c768ad7c54523837b06999a8f69bdffe2a840db'
VALIDATE_ONLY="${PC_REVIEWER_RESET_ATTEMPT_VALIDATE_ONLY:-0}"

[[ "$PC_REVIEWER_RESET_ATTEMPT_COMMAND" == "$COMMAND" ]]
[[ "$VALIDATE_ONLY" == '0' || "$VALIDATE_ONLY" == '1' ]]
[[ -f "$SOURCE" ]]
[[ "$(git hash-object "$SOURCE")" == "$SOURCE_BLOB" ]]
rm -f -- "$TMP"
trap 'rm -f -- "$TMP"' EXIT
cp -- "$SOURCE" "$TMP"
chmod 0700 "$TMP"

python3 - "$TMP" "$OLD_SOURCE_REVISION" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
old_source_revision = sys.argv[2]
text = path.read_text(encoding='utf-8')
replacements = [
    (
        "ATTEMPT_COMMAND='/production p0-reviewer-reset-attempt-classify 31706325376 current-main'",
        "ATTEMPT_COMMAND='/production p0-reviewer-reset-attempt-classify 31781887205 current-main'",
    ),
    ("SOURCE_RUN_ID='31706325376'", "SOURCE_RUN_ID='31781887205'"),
    ("ATTEMPT_SINCE='2026-08-13T13:43:10Z'", "ATTEMPT_SINCE='2026-08-14T07:56:46Z'"),
    ("ATTEMPT_UNTIL='2026-08-13T13:43:26Z'", "ATTEMPT_UNTIL='2026-08-14T07:57:05Z'"),
    (
        "SOURCE_REVISION='7c768ad7c54523837b06999a8f69bdffe2a840db'",
        "SOURCE_REVISION='dc5bec67faeaec26ce905c0643dc15d35f99bf50'",
    ),
]
for index, (old, new) in enumerate(replacements, start=1):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'FIXED_BINDING_MISMATCH:R{index}:{count}')
    text = text.replace(old, new, 1)

# RESET_ATTEMPT independently fail-closes on the historical revision/window.
# Rebind only those three exact remote preconditions.
remote_replacements = [
    (
        "[[ \"$source_revision\" == '7c768ad7c54523837b06999a8f69bdffe2a840db' ]]",
        "[[ \"$source_revision\" == 'dc5bec67faeaec26ce905c0643dc15d35f99bf50' ]]",
    ),
    (
        "[[ \"$attempt_since\" == '2026-08-13T13:43:10Z' ]]",
        "[[ \"$attempt_since\" == '2026-08-14T07:56:46Z' ]]",
    ),
    (
        "[[ \"$attempt_until\" == '2026-08-13T13:43:26Z' ]]",
        "[[ \"$attempt_until\" == '2026-08-14T07:57:05Z' ]]",
    ),
]
for index, (old, new) in enumerate(remote_replacements, start=1):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'REMOTE_BINDING_MISMATCH:R{index}:{count}')
    text = text.replace(old, new, 1)

# Preserve an already emitted bounded remote failure substage when parity has
# not yet completed. No raw stderr or arbitrary remote text is promoted.
old = "    failure_detail='PARITY_OR_PRE_NODE_FAILURE'"
new = r'''    if [[ "$remote_failure" =~ ^ATTEMPT_REMOTE_FAILURE\|([A-Z0-9_-]{1,64})\|(ZERO|ONE|MULTIPLE|UNKNOWN)\|(ZERO|ONE|MULTIPLE|UNKNOWN|UNAVAILABLE)\|(ZERO|ONE|MULTIPLE|UNKNOWN|UNAVAILABLE)$ ]]; then
      failure_detail="${BASH_REMATCH[1]}_${BASH_REMATCH[2]}_${BASH_REMATCH[3]}_${BASH_REMATCH[4]}"
    else
      failure_detail='PARITY_OR_PRE_NODE_FAILURE'
    fi'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'SAFE_SUBSTAGE_BINDING_MISMATCH:{count}')
text = text.replace(old, new, 1)

# Validate the transformed temporary classifier in one place.
exact_lines = [
    "ATTEMPT_COMMAND='/production p0-reviewer-reset-attempt-classify 31781887205 current-main'",
    "SOURCE_RUN_ID='31781887205'",
    "ATTEMPT_SINCE='2026-08-14T07:56:46Z'",
    "ATTEMPT_UNTIL='2026-08-14T07:57:05Z'",
    "SOURCE_REVISION='dc5bec67faeaec26ce905c0643dc15d35f99bf50'",
    "[[ \"$source_revision\" == 'dc5bec67faeaec26ce905c0643dc15d35f99bf50' ]]",
    "[[ \"$attempt_since\" == '2026-08-14T07:56:46Z' ]]",
    "[[ \"$attempt_until\" == '2026-08-14T07:57:05Z' ]]",
]
lines = text.splitlines()
for index, token in enumerate(exact_lines, start=1):
    count = lines.count(token)
    if count != 1:
        raise SystemExit(f'POST_TRANSFORM_LINE_MISMATCH:L{index}:{count}')

substage_lines = [
    r'    if [[ "$remote_failure" =~ ^ATTEMPT_REMOTE_FAILURE\|([A-Z0-9_-]{1,64})\|(ZERO|ONE|MULTIPLE|UNKNOWN)\|(ZERO|ONE|MULTIPLE|UNKNOWN|UNAVAILABLE)\|(ZERO|ONE|MULTIPLE|UNKNOWN|UNAVAILABLE)$ ]]; then',
    '      failure_detail="${BASH_REMATCH[1]}_${BASH_REMATCH[2]}_${BASH_REMATCH[3]}_${BASH_REMATCH[4]}"',
]
for index, token in enumerate(substage_lines, start=1):
    count = lines.count(token)
    if count != 1:
        raise SystemExit(f'POST_TRANSFORM_SUBSTAGE_MISMATCH:S{index}:{count}')

fragments = [
    f"if SOURCE_REVISION != '{old_source_revision}':",
]
for index, token in enumerate(fragments, start=1):
    count = text.count(token)
    if count != 1:
        raise SystemExit(f'POST_TRANSFORM_FRAGMENT_MISMATCH:F{index}:{count}')

for index, forbidden in enumerate(
    [
        '31706325376',
        '2026-08-13T13:43:10Z',
        '2026-08-13T13:43:26Z',
        f"SOURCE_REVISION='{old_source_revision}'",
        f"[[ \"$source_revision\" == '{old_source_revision}' ]]",
    ],
    start=1,
):
    if forbidden in text:
        raise SystemExit(f'POST_TRANSFORM_FORBIDDEN:F{index}')

if text.count(old_source_revision) != 1:
    raise SystemExit(f'POST_TRANSFORM_OLD_REVISION_COUNT:{text.count(old_source_revision)}')

path.write_text(text, encoding='utf-8')
PY

bash -n "$TMP"

if [[ "$VALIDATE_ONLY" == '1' ]]; then
  printf '%s\n' 'PASS: transformed one-off classifier preflight'
  exit 0
fi

# The canonical classifier remains the authority. This wrapper changes only
# the fixed RESET_ATTEMPT historical bindings and bounded failure promotion in
# RUNNER_TEMP, then executes that temporary copy unchanged.
bash "$TMP"
