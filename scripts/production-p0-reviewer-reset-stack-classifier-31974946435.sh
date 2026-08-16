#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_STACK_COMMAND:?PC_REVIEWER_RESET_STACK_COMMAND is required}"

COMMAND='/production p0-reviewer-reset-stack-classify 31974946435 current-main'
RESET_RUN_ID='31974946435'
RESET_REVISION='440e40753e2cac13c93f8e007d9fe17c2b66caba'
ATTEMPT_SINCE='2026-08-16T21:57:20Z'
ATTEMPT_UNTIL='2026-08-16T21:59:06Z'
SOURCE_SCRIPT='scripts/production-p0-reviewer-reset-stack-classifier-31901032491.sh'
SOURCE_BLOB_SHA='499bf064866f83a658ccbdfecaa885541d44c780'
SOURCE_COMMAND='/production p0-reviewer-reset-stack-classify 31901032491 current-main'
SOURCE_RUN_ID='31901032491'
SOURCE_REVISION='056ed4461dafb5e7dab2efc9ea5a0d5877523169'
SOURCE_SINCE='2026-08-15T18:24:20Z'
SOURCE_UNTIL='2026-08-15T18:25:05Z'
TARGET="$RUNNER_TEMP/production-p0-reviewer-reset-stack-classifier-31974946435.v2.sh"

cleanup() {
  rm -f -- "$TARGET"
}
trap cleanup EXIT

[[ "$PC_REVIEWER_RESET_STACK_COMMAND" == "$COMMAND" ]]
[[ -f "$SOURCE_SCRIPT" ]]
[[ "$(git hash-object "$SOURCE_SCRIPT")" == "$SOURCE_BLOB_SHA" ]]
bash -n "$SOURCE_SCRIPT"
cp -- "$SOURCE_SCRIPT" "$TARGET"
chmod 0700 "$TARGET"

python3 - "$TARGET" \
  "$SOURCE_COMMAND" "$COMMAND" \
  "$SOURCE_RUN_ID" "$RESET_RUN_ID" \
  "$SOURCE_REVISION" "$RESET_REVISION" \
  "$SOURCE_SINCE" "$ATTEMPT_SINCE" \
  "$SOURCE_UNTIL" "$ATTEMPT_UNTIL" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
old_command, new_command, old_run, new_run, old_rev, new_rev, old_since, new_since, old_until, new_until = sys.argv[2:]
text = path.read_text(encoding='utf-8')
replacements = [
    (old_command, new_command, 'command'),
    (old_run, new_run, 'run'),
    (old_rev, new_rev, 'revision'),
    (old_since, new_since, 'since'),
    (old_until, new_until, 'until'),
]
for old, new, label in replacements:
    count = text.count(old)
    if count < 1:
        raise SystemExit(f'PATCH_ANCHOR_MISSING:{label}')
    text = text.replace(old, new)
for old, _new, label in replacements:
    if old in text:
        raise SystemExit(f'STALE_VALUE_REMAINS:{label}')
required = [
    "mapfile -t api_ids < <(docker ps -aq --filter 'label=com.docker.compose.service=api')",
    "(( ${#matching[@]} >= 1 && ${#matching[@]} <= 4 ))",
    "marker_count=\"$(grep -Fc 'Password reset challenge/outbox transaction failed' \"$all\" || true)\"",
    '[[ "$marker_count" =~ ^[0-9]+$ && "$marker_count" -ge 1 && "$marker_count" -le 4 ]]',
    'docker logs --since "$since" --until "$until"',
    "source_stage='AUTH_MAIL_ENQUEUE'",
    "source_stage='PASSWORD_RESET_REPOSITORY'",
    "reason_class='PERMISSION_DENIED'",
    "reason_class='ROW_LEVEL_SECURITY'",
    "reason_class='ENQUEUE_FUNCTION_MISSING'",
    "reason_class='AUTH_MAIL_IDEMPOTENCY'",
    'PRODUCTION_MUTATION=NONE',
    'raw logs / PII / credentials',
]
missing = [token for token in required if token not in text]
if missing:
    raise SystemExit('PATCHED_SOURCE_INVARIANT_MISSING:' + '|'.join(missing))
for forbidden in [
    'com.docker.compose.project=$project',
    '[[ "$marker_count" == \'1\' ]]',
]:
    if forbidden in text:
        raise SystemExit('PATCHED_SOURCE_REINTRODUCED_OVERCONSTRAINT:' + forbidden)
path.write_text(text, encoding='utf-8')
PY

bash -n "$TARGET"
grep -Fqx "COMMAND='$COMMAND'" "$TARGET"
grep -Fqx "RESET_RUN_ID='$RESET_RUN_ID'" "$TARGET"
grep -Fqx "RESET_REVISION='$RESET_REVISION'" "$TARGET"
grep -Fqx "ATTEMPT_SINCE='$ATTEMPT_SINCE'" "$TARGET"
grep -Fqx "ATTEMPT_UNTIL='$ATTEMPT_UNTIL'" "$TARGET"
grep -Fq "mapfile -t api_ids < <(docker ps -aq --filter 'label=com.docker.compose.service=api')" "$TARGET"
grep -Fq '[[ "$marker_count" =~ ^[0-9]+$ && "$marker_count" -ge 1 && "$marker_count" -le 4 ]]' "$TARGET"
! grep -Fq 'com.docker.compose.project=$project' "$TARGET"
! grep -Fq '[[ "$marker_count" == '\''1'\'' ]]' "$TARGET"

exec bash "$TARGET"
