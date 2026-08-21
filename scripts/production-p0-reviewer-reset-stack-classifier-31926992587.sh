#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_SCRIPT='scripts/production-p0-reviewer-reset-stack-classifier-31901032491.sh'
SOURCE_BLOB_SHA='58c689c246d1380efca2af7b62dc9af7403c2faa'
OLD_COMMAND='/production p0-reviewer-reset-stack-classify 31901032491 current-main'
NEW_COMMAND='/production p0-reviewer-reset-stack-classify 31926992587 current-main'
OLD_RUN='31901032491'
NEW_RUN='31926992587'
OLD_REV='056ed4461dafb5e7dab2efc9ea5a0d5877523169'
NEW_REV='2c3256ffb996172d69528cb19871bcd13f0d0723'
OLD_SINCE='2026-08-15T18:24:20Z'
NEW_SINCE='2026-08-16T04:35:52Z'
OLD_UNTIL='2026-08-15T18:25:05Z'
NEW_UNTIL='2026-08-16T04:37:44Z'
RUNNER_TEMP="${RUNNER_TEMP:-/tmp}"
TARGET="$RUNNER_TEMP/production-p0-reviewer-reset-stack-classifier-31926992587.patched.sh"

cleanup(){ rm -f -- "$TARGET"; }
trap cleanup EXIT

[[ -f "$SOURCE_SCRIPT" ]]
[[ "$(git hash-object "$SOURCE_SCRIPT")" == "$SOURCE_BLOB_SHA" ]]
bash -n "$SOURCE_SCRIPT"
cp -- "$SOURCE_SCRIPT" "$TARGET"
chmod 0700 "$TARGET"
python3 - "$TARGET" "$OLD_COMMAND" "$NEW_COMMAND" "$OLD_RUN" "$NEW_RUN" "$OLD_REV" "$NEW_REV" "$OLD_SINCE" "$NEW_SINCE" "$OLD_UNTIL" "$NEW_UNTIL" <<'PY'
from pathlib import Path
import sys
path=Path(sys.argv[1])
old_command,new_command,old_run,new_run,old_rev,new_rev,old_since,new_since,old_until,new_until=sys.argv[2:]
text=path.read_text(encoding='utf-8')
for old,new,label in [
    (old_command,new_command,'command'),
    (old_run,new_run,'run'),
    (old_rev,new_rev,'revision'),
    (old_since,new_since,'since'),
    (old_until,new_until,'until'),
]:
    count=text.count(old)
    if count < 1:
        raise SystemExit(f'PATCH_ANCHOR_MISSING:{label}')
    text=text.replace(old,new)
for stale,label in [(old_run,'run'),(old_rev,'revision'),(old_since,'since'),(old_until,'until')]:
    if stale in text:
        raise SystemExit(f'STALE_VALUE_REMAINS:{label}')
path.write_text(text,encoding='utf-8')
PY
bash -n "$TARGET"
grep -Fqx "COMMAND='$NEW_COMMAND'" "$TARGET"
grep -Fqx "RESET_RUN_ID='$NEW_RUN'" "$TARGET"
grep -Fqx "RESET_REVISION='$NEW_REV'" "$TARGET"
grep -Fqx "ATTEMPT_SINCE='$NEW_SINCE'" "$TARGET"
grep -Fqx "ATTEMPT_UNTIL='$NEW_UNTIL'" "$TARGET"

exec bash "$TARGET"
