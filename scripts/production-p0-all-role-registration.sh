#!/usr/bin/env bash
set -Eeuo pipefail

BASE_WRAPPER_BLOB='0bc86a73a7def1d08c08031e9bf033d28bb0c88d'

fail() { printf 'P0_ALL_ROLE_EMPLOYEE_RECOVERY_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }
command -v git >/dev/null 2>&1 || fail GIT_REQUIRED 2
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 3

tmp="$(mktemp)"
cleanup(){ rm -f -- "$tmp"; }
trap cleanup EXIT

git cat-file blob "$BASE_WRAPPER_BLOB" > "$tmp" 2>/dev/null || fail BASE_WRAPPER_BLOB_MISSING 4
[[ "$(git hash-object "$tmp")" == "$BASE_WRAPPER_BLOB" ]] || fail BASE_WRAPPER_BLOB_MISMATCH 5

python3 - "$tmp" <<'PY_OUTER'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text(encoding='utf-8')

marker = "\np.write_text(s,encoding='utf-8')\"\"\",\n    'LABEL_BOUND_COOKIE_JAR_PATCH_INJECTION',\n)"
injected = r"""
one(
    r'''  [[ "$status" == 200 ]] || {
    if python3 - "$response" "$EMPLOYEE_PLATFORM_OVERRIDE_BLOCKER" <<'PY'
import json, sys
try:
    p = json.load(open(sys.argv[1], encoding='utf-8'))
except Exception:
    p = {}
raise SystemExit(0 if p.get('code') == sys.argv[2] else 1)
PY
    then
      fail P0_EMPLOYEE_PLATFORM_REVIEWER_OVERRIDE_FORBIDDEN 62
    else
      fail P0_EMPLOYEE_ORGANIZATION_ADMIN_APPROVAL_FAILED 63
    fi
  }
  python3 - "$response" <<'PY' || fail P0_EMPLOYEE_ORGANIZATION_ADMIN_APPROVAL_INVALID 64
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('status') != 'ACTIVATED' or p.get('nextAction') != 'LOGIN' or p.get('replayed') is not False or p.get('notificationDelivered') is not True:
    raise SystemExit(1)
PY
''',
    r'''  if [[ "$status" != 200 ]]; then
    if python3 - "$response" "$EMPLOYEE_PLATFORM_OVERRIDE_BLOCKER" <<'PY'
import json, sys
try:
    p = json.load(open(sys.argv[1], encoding='utf-8'))
except Exception:
    p = {}
raise SystemExit(0 if p.get('code') == sys.argv[2] else 1)
PY
    then
      fail P0_EMPLOYEE_PLATFORM_REVIEWER_OVERRIDE_FORBIDDEN 62
    fi
    status="$(http_request "$replay" "$jar" \
      -X POST "$LIVE_BASE/api/auth/organization-join-requests/${APP_ID[employee]}/decision" \
      -H 'Content-Type: application/json' \
      -H "Origin: $LIVE_BASE" \
      -H "x-csrf-token: $csrf" \
      -H "Idempotency-Key: p0-all-role-employee-join:$TARGET_SHA:$RUN_ID" \
      -H "x-correlation-id: p0-all-role-employee-join-recovery:${TARGET_SHA:0:12}:$RUN_ID" \
      --data-binary "@$request")"
    [[ "$status" == 200 ]] || fail P0_EMPLOYEE_ORGANIZATION_ADMIN_APPROVAL_FAILED 63
    python3 - "$replay" <<'PY' || fail P0_EMPLOYEE_ORGANIZATION_ADMIN_APPROVAL_INVALID 64
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('status') != 'ACTIVATED' or p.get('replayed') is not True or p.get('notificationDelivered') is not False:
    raise SystemExit(1)
PY
    printf 'P0_EMPLOYEE_JOIN_DECISION_RECOVERY=PASS\n'
  else
    python3 - "$response" <<'PY' || fail P0_EMPLOYEE_ORGANIZATION_ADMIN_APPROVAL_INVALID 64
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('status') != 'ACTIVATED' or p.get('nextAction') != 'LOGIN' or p.get('replayed') is not False or p.get('notificationDelivered') is not True:
    raise SystemExit(1)
PY
  fi
''',
    'EMPLOYEE_COMMITTED_DECISION_RECOVERY',
)
if s.count('P0_EMPLOYEE_JOIN_DECISION_RECOVERY=PASS') != 1:
    raise SystemExit('EMPLOYEE_COMMITTED_DECISION_RECOVERY_INVALID')
if s.count('p0-all-role-employee-join-recovery:') != 1:
    raise SystemExit('EMPLOYEE_RECOVERY_CORRELATION_INVALID')
"""

count = s.count(marker)
if count != 1:
    raise SystemExit(f'PATCH_CARDINALITY_EMPLOYEE_RECOVERY_INJECTION={count}')
s = s.replace(marker, injected + marker, 1)
if s.count('EMPLOYEE_COMMITTED_DECISION_RECOVERY') != 2:
    raise SystemExit('EMPLOYEE_RECOVERY_PATCH_MISSING')
if s.count('P0_EMPLOYEE_JOIN_DECISION_RECOVERY=PASS') != 1:
    raise SystemExit('EMPLOYEE_RECOVERY_MARKER_MISSING')
if s.count('p0-all-role-employee-join-recovery:') != 1:
    raise SystemExit('EMPLOYEE_RECOVERY_CORRELATION_MISSING')
p.write_text(s, encoding='utf-8')
PY_OUTER

chmod 0700 "$tmp"
bash -n "$tmp"

if [[ "${PC_P0_ALL_ROLE_IDNA_VALIDATE_ONLY:-0}" == 1 ]]; then
  set +e
  output="$(bash "$tmp" "$@" 2>&1)"
  rc=$?
  set -e
  printf '%s\n' "$output"
  (( rc == 0 )) || exit "$rc"
  printf 'P0_ALL_ROLE_EMPLOYEE_COMMITTED_DECISION_RECOVERY=PASS\n'
  exit 0
fi

bash "$tmp" "$@"
