#!/usr/bin/env bash
set -Eeuo pipefail

CORE_BLOB='320a91d228bc957eaf61220c256f2108f81a8c1f'
OLD_SHA='d2dd7972105cc59002263455b5ae0eb8d8f2d386'
TARGET_SHA='056ed4461dafb5e7dab2efc9ea5a0d5877523169'
OLD_COMMAND='/production p0-reviewer-reset-request deployed-d2dd797'
TARGET_COMMAND='/production p0-reviewer-reset-request deployed-056ed446'

fail() { printf 'P0_REVIEWER_RESET_CURRENT_DEPLOYED_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }
command -v git >/dev/null 2>&1 || fail GIT_REQUIRED 2
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 3

tmp="$(mktemp)"
cleanup(){ rm -f -- "$tmp"; }
trap cleanup EXIT

git cat-file blob "$CORE_BLOB" > "$tmp" 2>/dev/null || fail CORE_BLOB_MISSING 4
[[ "$(git hash-object "$tmp")" == "$CORE_BLOB" ]] || fail CORE_BLOB_MISMATCH 5

P0_OLD_SHA="$OLD_SHA" P0_TARGET_SHA="$TARGET_SHA" P0_OLD_COMMAND="$OLD_COMMAND" P0_TARGET_COMMAND="$TARGET_COMMAND" \
python3 - "$tmp" <<'PY'
from pathlib import Path
import os, sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
old_sha=os.environ['P0_OLD_SHA']
target_sha=os.environ['P0_TARGET_SHA']
old_command=os.environ['P0_OLD_COMMAND']
target_command=os.environ['P0_TARGET_COMMAND']
if s.count(old_sha) != 2:
    raise SystemExit(f'OLD_SHA_CARDINALITY={s.count(old_sha)}')
if s.count(old_command) != 1:
    raise SystemExit(f'OLD_COMMAND_CARDINALITY={s.count(old_command)}')
s=s.replace(old_sha,target_sha)
s=s.replace(old_command,target_command)

remote_start="stage='REMOTE_EXECUTION'\noutput="
if s.count(remote_start) != 1:
    raise SystemExit(f'REMOTE_START_CARDINALITY={s.count(remote_start)}')
s=s.replace(
    remote_start,
    "stage='REMOTE_EXECUTION'\ntrap - ERR\nset +e\noutput=",
    1,
)

remote_end="REMOTE\n)\"\n\nif failure_marker="
if s.count(remote_end) != 1:
    raise SystemExit(f'REMOTE_END_CARDINALITY={s.count(remote_end)}')
s=s.replace(
    remote_end,
    "REMOTE\n)\"\nremote_rc=$?\nset -e\ntrap publish_failure ERR\n\nif failure_marker=",
    1,
)

failure_block="""if failure_marker="$(grep '^REMOTE_FAILURE_STAGE=' <<< "$output" | tail -n1)" && [[ -n "$failure_marker" ]]; then
  stage="${failure_marker#REMOTE_FAILURE_STAGE=}"
  false
fi
marker="""
if s.count(failure_block) != 1:
    raise SystemExit(f'FAILURE_BLOCK_CARDINALITY={s.count(failure_block)}')
s=s.replace(
    failure_block,
    """if failure_marker="$(grep '^REMOTE_FAILURE_STAGE=' <<< "$output" | tail -n1)" && [[ -n "$failure_marker" ]]; then
  stage="${failure_marker#REMOTE_FAILURE_STAGE=}"
  false
fi
if (( remote_rc != 0 )); then
  stage='REMOTE_EXECUTION_UNCLASSIFIED'
  false
fi
marker=""",
    1,
)

required=[
    f"TARGET_SHA='{target_sha}'",
    f"COMMAND='{target_command}'",
    f"[[ \"$target_sha\" == '{target_sha}' ]]",
    "counts.join('|') !== '1|1|1|1|1|0|0|0'",
    "auth.staff_reviewer_password_reset_subject()",
    "auth.staff_reviewer_login_readiness()",
    "remote_stage='PASSWORD_RESET_POST'",
    "/api/auth/forgot-password",
    "PRODUCTION_MUTATION=NORMAL_PASSWORD_RESET_REQUEST_ONLY",
    "StrictHostKeyChecking=yes",
    "trap - ERR\nset +e\noutput=",
    "remote_rc=$?\nset -e\ntrap publish_failure ERR",
    "REMOTE_EXECUTION_UNCLASSIFIED",
]
missing=[x for x in required if x not in s]
if missing:
    raise SystemExit('SECURITY_INVARIANT_MISSING='+'|'.join(missing))
for forbidden in ('ALTER ROLE','CREATE ROLE','DROP ROLE'):
    if forbidden in s:
        raise SystemExit('FORBIDDEN_MUTATION_SURFACE='+forbidden.replace(' ','_'))
p.write_text(s,encoding='utf-8')
PY
chmod 0700 "$tmp"
/usr/bin/bash --noprofile --norc -n "$tmp"

if [[ "${PC_P0_REVIEWER_RESET_CURRENT_VALIDATE_ONLY:-0}" == 1 ]]; then
  printf 'P0_REVIEWER_RESET_CURRENT_DEPLOYED_WRAPPER=PASS\n'
  printf 'P0_REVIEWER_RESET_TARGET_SHA=%s\n' "$TARGET_SHA"
  exit 0
fi

exec /usr/bin/bash --noprofile --norc "$tmp" "$@"
