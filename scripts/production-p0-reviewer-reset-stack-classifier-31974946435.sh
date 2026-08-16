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
TARGET="$RUNNER_TEMP/production-p0-reviewer-reset-stack-classifier-31974946435.v3.sh"

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

def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'PATCH_ANCHOR_COUNT:{label}:{count}')
    text = text.replace(old, new, 1)

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

replace_once(
    'set -Eeuo pipefail\nrevision="$1"; since="$2"; until="$3"',
    '''set -Eeuo pipefail
revision="$1"; since="$2"; until="$3"
remote_stage='REMOTE_BEGIN'
remote_fail() {
  local rc="$?"
  trap - ERR
  case "$remote_stage" in
    REMOTE_BEGIN|DOCKER_LIST|REVISION_MATCH|LOG_FETCH|MARKER_COUNT|CONTEXT_EXTRACT|SANITIZE|CLASSIFY|PUBLISH) ;;
    *) remote_stage='REMOTE_BEGIN' ;;
  esac
  printf 'REMOTE_STAGE=%s\\n' "$remote_stage"
  printf 'REMOTE_RC=%s\\n' "$rc"
  printf 'PRODUCTION_MUTATION=NONE\\n'
  exit "$rc"
}
trap remote_fail ERR''',
    'remote-trap',
)
replace_once(
    "mapfile -t api_ids < <(docker ps -aq --filter 'label=com.docker.compose.service=api')",
    "remote_stage='DOCKER_LIST'\nmapfile -t api_ids < <(docker ps -aq --filter 'label=com.docker.compose.service=api')\nremote_stage='REVISION_MATCH'",
    'docker-list-stage',
)
replace_once(
    'all="$(mktemp)"; block="$(mktemp)"; trap \'rm -f "$all" "$block"\' EXIT',
    'remote_stage=\'LOG_FETCH\'\nall="$(mktemp)"; block="$(mktemp)"; trap \'rm -f "$all" "$block"\' EXIT',
    'log-fetch-stage',
)
replace_once(
    'marker_count="$(grep -Fc \'Password reset challenge/outbox transaction failed\' "$all" || true)"',
    'remote_stage=\'MARKER_COUNT\'\nmarker_count="$(grep -Fc \'Password reset challenge/outbox transaction failed\' "$all" || true)"',
    'marker-stage',
)
replace_once(
    'marker_line="$(grep -Fn \'Password reset challenge/outbox transaction failed\' "$all" | head -n1 | cut -d: -f1)"',
    'remote_stage=\'CONTEXT_EXTRACT\'\nmarker_line="$(grep -Fn \'Password reset challenge/outbox transaction failed\' "$all" | head -n1 | cut -d: -f1)"',
    'context-stage',
)
replace_once(
    "error_type='UNKNOWN'",
    "remote_stage='CLASSIFY'\nerror_type='UNKNOWN'",
    'classify-stage',
)
replace_once(
    "printf 'STACK_CLASS|%s|%s|%s|%s|%s|%s\\n' \"$error_type\" \"$source_stage\" \"$code_class\" \"$reason_class\" \"$marker_count\" \"${#matching[@]}\"\nprintf 'PRODUCTION_MUTATION=NONE\\n'",
    '''remote_stage='SANITIZE'
container_count="${#matching[@]}"
for safe_value in "$error_type" "$source_stage" "$code_class" "$reason_class"; do
  [[ "$safe_value" =~ ^[A-Z0-9_]+$ ]]
done
[[ "$marker_count" =~ ^[0-9]+$ && "$container_count" =~ ^[0-9]+$ ]]
remote_stage='PUBLISH'
printf 'STACK_CLASS|%s|%s|%s|%s|%s|%s\\n' "$error_type" "$source_stage" "$code_class" "$reason_class" "$marker_count" "$container_count"
printf 'PRODUCTION_MUTATION=NONE\\n' ''',
    'safe-publish-stage',
)
replace_once(
    'output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- \'$RESET_REVISION\' \'$ATTEMPT_SINCE\' \'$ATTEMPT_UNTIL\'" <<\'REMOTE\'',
    'set +e\noutput="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- \'$RESET_REVISION\' \'$ATTEMPT_SINCE\' \'$ATTEMPT_UNTIL\'" 2>/dev/null <<\'REMOTE\'',
    'ssh-capture-start',
)
replace_once(
    "REMOTE\n)\"\nmarker=\"$(grep '^STACK_CLASS|' <<< \"$output\" | tail -n1)\"; mutation=\"$(grep '^PRODUCTION_MUTATION=' <<< \"$output\" | tail -n1)\"",
    '''REMOTE
)"
remote_rc=$?
set -e
if (( remote_rc != 0 )); then
  remote_stage="$(grep '^REMOTE_STAGE=' <<< "$output" | tail -n1 | cut -d= -f2 || true)"
  remote_marker_rc="$(grep '^REMOTE_RC=' <<< "$output" | tail -n1 | cut -d= -f2 || true)"
  remote_mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1 || true)"
  case "$remote_stage" in
    REMOTE_BEGIN|DOCKER_LIST|REVISION_MATCH|LOG_FETCH|MARKER_COUNT|CONTEXT_EXTRACT|SANITIZE|CLASSIFY|PUBLISH) ;;
    *) remote_stage='SSH_TRANSPORT' ;;
  esac
  [[ "$remote_marker_rc" =~ ^[0-9]+$ ]] || remote_marker_rc="$remote_rc"
  [[ "$remote_mutation" == 'PRODUCTION_MUTATION=NONE' ]] || remote_mutation='PRODUCTION_MUTATION=NONE'
  guard_main
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## P0 reviewer reset stack stage v3

- source reset run: \`$RESET_RUN_ID\`
- diagnostic main: \`$SOURCE_SHA\`
- reset revision: \`$RESET_REVISION\`
- result: \`FAIL_CLOSED_STAGE_CLASSIFIED\`
- remote stage: \`$remote_stage\`
- remote rc: \`$remote_marker_rc\`
- raw logs / PII / credentials / reset material: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
- production mutation: \`NONE\`" >/dev/null
  result_published=1
  exit "$remote_rc"
fi
marker="$(grep '^STACK_CLASS|' <<< "$output" | tail -n1)"; mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"''',
    'ssh-capture-end',
)

required = [
    "mapfile -t api_ids < <(docker ps -aq --filter 'label=com.docker.compose.service=api')",
    "(( ${#matching[@]} >= 1 && ${#matching[@]} <= 4 ))",
    'docker logs --since "$since" --until "$until"',
    "remote_stage='DOCKER_LIST'",
    "remote_stage='REVISION_MATCH'",
    "remote_stage='LOG_FETCH'",
    "remote_stage='MARKER_COUNT'",
    "remote_stage='CONTEXT_EXTRACT'",
    "remote_stage='CLASSIFY'",
    "remote_stage='SANITIZE'",
    "remote_stage='PUBLISH'",
    "remote_stage='SSH_TRANSPORT'",
    'FAIL_CLOSED_STAGE_CLASSIFIED',
    'PRODUCTION_MUTATION=NONE',
    'raw logs / PII / credentials',
]
missing = [token for token in required if token not in text]
if missing:
    raise SystemExit('PATCHED_SOURCE_INVARIANT_MISSING:' + '|'.join(missing))
for forbidden in [
    'com.docker.compose.project=$project',
    '[[ "$marker_count" == \'1\' ]]',
    'printf \'%s\\n\' "$output"',
    'echo "$output"',
]:
    if forbidden in text:
        raise SystemExit('PATCHED_SOURCE_REINTRODUCED_UNSAFE_OR_OVERCONSTRAINED:' + forbidden)
path.write_text(text, encoding='utf-8')
PY

bash -n "$TARGET"
grep -Fqx "COMMAND='$COMMAND'" "$TARGET"
grep -Fqx "RESET_RUN_ID='$RESET_RUN_ID'" "$TARGET"
grep -Fqx "RESET_REVISION='$RESET_REVISION'" "$TARGET"
grep -Fqx "ATTEMPT_SINCE='$ATTEMPT_SINCE'" "$TARGET"
grep -Fqx "ATTEMPT_UNTIL='$ATTEMPT_UNTIL'" "$TARGET"
grep -Fq "remote_stage='DOCKER_LIST'" "$TARGET"
grep -Fq "remote_stage='REVISION_MATCH'" "$TARGET"
grep -Fq "remote_stage='LOG_FETCH'" "$TARGET"
grep -Fq "remote_stage='MARKER_COUNT'" "$TARGET"
grep -Fq "remote_stage='CONTEXT_EXTRACT'" "$TARGET"
grep -Fq "remote_stage='CLASSIFY'" "$TARGET"
grep -Fq "remote_stage='SANITIZE'" "$TARGET"
grep -Fq "remote_stage='PUBLISH'" "$TARGET"
grep -Fq "remote_stage='SSH_TRANSPORT'" "$TARGET"
grep -Fq 'FAIL_CLOSED_STAGE_CLASSIFIED' "$TARGET"
! grep -Fq 'com.docker.compose.project=$project' "$TARGET"
! grep -Fq '[[ "$marker_count" == '\''1'\'' ]]' "$TARGET"
! grep -Fq 'echo "$output"' "$TARGET"

exec bash "$TARGET"
