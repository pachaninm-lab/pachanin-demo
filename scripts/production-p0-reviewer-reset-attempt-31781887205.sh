#!/usr/bin/env bash
set -Eeuo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_ATTEMPT_COMMAND:?PC_REVIEWER_RESET_ATTEMPT_COMMAND is required}"

COMMAND='/production p0-reviewer-reset-attempt-classify 31781887205 current-main'
SOURCE='scripts/production-p0-reviewer-reset-attempt-classifier.sh'
SOURCE_BLOB='7dcfb19d247aab2f0dc8c8075416673499c9dc84'
TMP="$RUNNER_TEMP/pc-p0-reviewer-reset-attempt-31781887205.sh"

[[ "$PC_REVIEWER_RESET_ATTEMPT_COMMAND" == "$COMMAND" ]]
[[ -f "$SOURCE" ]]
[[ "$(git hash-object "$SOURCE")" == "$SOURCE_BLOB" ]]
rm -f -- "$TMP"
trap 'rm -f -- "$TMP"' EXIT
cp -- "$SOURCE" "$TMP"
chmod 0700 "$TMP"

python3 - "$TMP" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
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
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'FIXED_BINDING_MISMATCH:{old[:24]}:{count}')
    text = text.replace(old, new, 1)

# The canonical remote script independently fail-closes on the same historical
# revision/window. Rebind those three exact preconditions too; otherwise the
# wrapper's stale-literal guard correctly aborts before SSH.
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
for old, new in remote_replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'REMOTE_BINDING_MISMATCH:{old[:24]}:{count}')
    text = text.replace(old, new, 1)

# The canonical remote ERR trap already emits a bounded, whitelist-safe
# ATTEMPT_REMOTE_FAILURE marker. Preserve that marker when parity has not yet
# completed instead of collapsing it into PARITY_OR_PRE_NODE_FAILURE.
old = "    failure_detail='PARITY_OR_PRE_NODE_FAILURE'"
new = """    if [[ \"$remote_failure\" =~ ^ATTEMPT_REMOTE_FAILURE\\|([A-Z0-9_-]{1,64})\\|(ZERO|ONE|MULTIPLE|UNKNOWN)\\|(ZERO|ONE|MULTIPLE|UNKNOWN|UNAVAILABLE)\\|(ZERO|ONE|MULTIPLE|UNKNOWN|UNAVAILABLE)$ ]]; then
      failure_detail=\"${BASH_REMATCH[1]}_${BASH_REMATCH[2]}_${BASH_REMATCH[3]}_${BASH_REMATCH[4]}\"
    else
      failure_detail='PARITY_OR_PRE_NODE_FAILURE'
    fi"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'SAFE_SUBSTAGE_BINDING_MISMATCH:{count}')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
PY

# The canonical classifier remains the authority. This one-off wrapper changes
# only fixed historical bindings in RUNNER_TEMP plus validation-only promotion
# of an already emitted, bounded remote failure substage.
grep -Fqx "ATTEMPT_COMMAND='/production p0-reviewer-reset-attempt-classify 31781887205 current-main'" "$TMP"
grep -Fqx "SOURCE_RUN_ID='31781887205'" "$TMP"
grep -Fqx "ATTEMPT_SINCE='2026-08-14T07:56:46Z'" "$TMP"
grep -Fqx "ATTEMPT_UNTIL='2026-08-14T07:57:05Z'" "$TMP"
grep -Fqx "SOURCE_REVISION='dc5bec67faeaec26ce905c0643dc15d35f99bf50'" "$TMP"
grep -Fqx "[[ \"\$source_revision\" == 'dc5bec67faeaec26ce905c0643dc15d35f99bf50' ]]" "$TMP"
grep -Fqx "[[ \"\$attempt_since\" == '2026-08-14T07:56:46Z' ]]" "$TMP"
grep -Fqx "[[ \"\$attempt_until\" == '2026-08-14T07:57:05Z' ]]" "$TMP"
grep -Fq 'if [[ "$remote_failure" =~ ^ATTEMPT_REMOTE_FAILURE\|' "$TMP"
[[ "$(grep -Fc 'if [[ "$remote_failure" =~ ^ATTEMPT_REMOTE_FAILURE\|' "$TMP")" == '1' ]]
! grep -Fq '31706325376' "$TMP"
! grep -Fq '2026-08-13T13:43:10Z' "$TMP"
! grep -Fq '2026-08-13T13:43:26Z' "$TMP"
! grep -Fq '7c768ad7c54523837b06999a8f69bdffe2a840db' "$TMP"

bash -n "$TMP"
bash "$TMP"
