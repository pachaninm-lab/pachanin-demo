#!/usr/bin/env bash
set -Eeuo pipefail

BASE_WRAPPER_BLOB='718fa79314369361c9e5947dfee1dc1aafd7cb32'

fail() { printf 'P0_ALL_ROLE_PATH_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }
command -v git >/dev/null 2>&1 || fail GIT_REQUIRED 2
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 3

tmp="$(mktemp)"
cleanup(){ rm -f -- "$tmp"; }
trap cleanup EXIT

git cat-file blob "$BASE_WRAPPER_BLOB" > "$tmp" 2>/dev/null || fail BASE_WRAPPER_BLOB_MISSING 4
[[ "$(git hash-object "$tmp")" == "$BASE_WRAPPER_BLOB" ]] || fail BASE_WRAPPER_BLOB_MISMATCH 5

python3 - "$tmp" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text(encoding='utf-8')

def one(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'PATCH_CARDINALITY_{label}={count}')
    s = s.replace(old, new, 1)

one(
    "    if ((pathValue || '/') !== '/') continue;\n",
    "",
    'CHROMIUM_NONROOT_PATH_FILTER_REMOVAL',
)
one(
    """      path: '/',
      secure,
      httpOnly,
      sameSite: 'Lax',
""",
    """      path: pathValue || '/',
      secure,
      httpOnly,
      sameSite: 'Lax',
""",
    'CHROMIUM_EXACT_PATH_PRESERVATION',
)
one(
    """      if (cookie.domain !== browserHost
        || cookie.path !== '/'
        || cookie.secure !== true
        || cookie.httpOnly !== true) {
""",
    """      if (cookie.domain !== browserHost
        || cookie.secure !== true
        || cookie.httpOnly !== true) {
""",
    'CHROMIUM_SERVER_PATH_AUTHORITY',
)
one(
    "p.write_text(s,encoding='utf-8')",
    r"""one(
    '''prime_csrf() {
  local label="$1" jar="$TMP_ROOT/$label.cookies" page="$TMP_ROOT/$label-csrf.html" status''',
    '''prime_csrf() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies" page="$TMP_ROOT/$label-csrf.html" status''',
    'PRIME_CSRF_LABEL_BOUND_BEFORE_JAR',
)
one(
    '''register_and_verify() {
  local label="$1" jar="$TMP_ROOT/$label.cookies"''',
    '''register_and_verify() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies"''',
    'REGISTER_LABEL_BOUND_BEFORE_JAR',
)
one(
    '''login_identity() {
  local label="$1" mode="$2" jar="$TMP_ROOT/$label.cookies"''',
    '''login_identity() {
  local label="$1" mode="$2"
  local jar="$TMP_ROOT/$label.cookies"''',
    'LOGIN_LABEL_BOUND_BEFORE_JAR',
)
one(
    '''logout_identity() {
  local label="$1" jar="$TMP_ROOT/$label.cookies"''',
    '''logout_identity() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies"''',
    'LOGOUT_LABEL_BOUND_BEFORE_JAR',
)

unsafe_jar_bindings = [
    '  local label="$1" jar="$TMP_ROOT/$label.cookies"',
    '  local label="$1" mode="$2" jar="$TMP_ROOT/$label.cookies"',
]
if any(fragment in s for fragment in unsafe_jar_bindings):
    raise SystemExit('BASH_DYNAMIC_SCOPE_COOKIE_JAR_BINDING_REMAINS')
required_jar_bindings = [
    '''prime_csrf() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies"''',
    '''register_and_verify() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies"''',
    '''login_identity() {
  local label="$1" mode="$2"
  local jar="$TMP_ROOT/$label.cookies"''',
    '''logout_identity() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies"''',
]
if any(fragment not in s for fragment in required_jar_bindings):
    raise SystemExit('LABEL_BOUND_COOKIE_JAR_INVARIANT_MISSING')

one(
    '--max-time 40',
    '--max-time 110',
    'HTTP_REQUEST_TIMEOUT_ENVELOPE',
)
if s.count('--max-time 110') != 1:
    raise SystemExit('HTTP_REQUEST_TIMEOUT_ENVELOPE_INVALID')

one(
    '''  local replay="$TMP_ROOT/employee-join-replay.json" csrf status''',
    '''  local replay="$TMP_ROOT/employee-join-replay.json" csrf status decision_reconciled=0''',
    'EMPLOYEE_DECISION_RECONCILIATION_LOCAL',
)
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
  }''',
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
    if [[ "$status" =~ ^5[0-9]{2}$ ]]; then
      CURRENT_STAGE=employee-organization-admin-decision-reconcile
      csrf="$(csrf_token "$jar")"
      status="$(http_request "$response" "$jar" \
        -X POST "$LIVE_BASE/api/auth/organization-join-requests/${APP_ID[employee]}/decision" \
        -H 'Content-Type: application/json' \
        -H "Origin: $LIVE_BASE" \
        -H "x-csrf-token: $csrf" \
        -H "Idempotency-Key: p0-all-role-employee-join:$TARGET_SHA:$RUN_ID" \
        -H "x-correlation-id: p0-all-role-employee-join-reconcile:${TARGET_SHA:0:12}:$RUN_ID" \
        --data-binary "@$request")"
      [[ "$status" == 200 ]] || fail P0_EMPLOYEE_ORGANIZATION_ADMIN_RECONCILE_FAILED 93
      python3 - "$response" <<'PY' || fail P0_EMPLOYEE_ORGANIZATION_ADMIN_RECONCILE_INVALID 94
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('status') != 'ACTIVATED' or p.get('nextAction') != 'LOGIN':
    raise SystemExit(1)
fresh = p.get('replayed') is False and p.get('notificationDelivered') is True
replayed = p.get('replayed') is True and p.get('notificationDelivered') is False
if not (fresh or replayed):
    raise SystemExit(1)
PY
      decision_reconciled=1
      printf 'P0_EMPLOYEE_JOIN_AMBIGUOUS_RECONCILIATION=PASS\n'
      CURRENT_STAGE=employee-organization-admin-decision
    else
      fail P0_EMPLOYEE_ORGANIZATION_ADMIN_APPROVAL_FAILED 63
    fi
  fi''',
    'EMPLOYEE_AMBIGUOUS_DECISION_RECONCILIATION',
)
one(
    r'''  python3 - "$response" <<'PY' || fail P0_EMPLOYEE_ORGANIZATION_ADMIN_APPROVAL_INVALID 64
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('status') != 'ACTIVATED' or p.get('nextAction') != 'LOGIN' or p.get('replayed') is not False or p.get('notificationDelivered') is not True:
    raise SystemExit(1)
PY''',
    r'''  if (( decision_reconciled == 0 )); then
    python3 - "$response" <<'PY' || fail P0_EMPLOYEE_ORGANIZATION_ADMIN_APPROVAL_INVALID 64
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('status') != 'ACTIVATED' or p.get('nextAction') != 'LOGIN' or p.get('replayed') is not False or p.get('notificationDelivered') is not True:
    raise SystemExit(1)
PY
  fi''',
    'EMPLOYEE_DIRECT_DECISION_ASSERTION_GUARD',
)
if 'P0_EMPLOYEE_JOIN_AMBIGUOUS_RECONCILIATION=PASS' not in s:
    raise SystemExit('EMPLOYEE_AMBIGUOUS_DECISION_RECONCILIATION_MISSING')
if 'p0-all-role-employee-join-reconcile:${TARGET_SHA:0:12}:$RUN_ID' not in s:
    raise SystemExit('EMPLOYEE_RECONCILIATION_CORRELATION_MISSING')

p.write_text(s,encoding='utf-8')""",
    'LABEL_BOUND_COOKIE_JAR_PATCH_INJECTION',
)

if "if ((pathValue || '/') !== '/') continue;" in s:
    raise SystemExit('CHROMIUM_NONROOT_PATH_FILTER_REMAINS')
if "path: pathValue || '/'," not in s:
    raise SystemExit('CHROMIUM_EXACT_PATH_NOT_PRESERVED')
if "cookie.path !== '/'" in s:
    raise SystemExit('CHROMIUM_ROOT_PATH_ASSERTION_REMAINS')
if "context.request.get(origin + '/api/auth/me'" not in s:
    raise SystemExit('CHROMIUM_ACCESS_SERVER_AUTHORITY_MISSING')
if "const cabinetResponse = await context.request.get(origin + route" not in s:
    raise SystemExit('CHROMIUM_CABINET_SERVER_AUTHORITY_MISSING')
if "domain: target.hostname" not in s or "includeSubdomainsValue.toUpperCase() !== 'FALSE'" not in s:
    raise SystemExit('CHROMIUM_HOST_ONLY_SCOPE_GUARD_MISSING')
if "P0_CHROMIUM_JAR_ACCESS_COOKIE_MISSING" not in s or "P0_CHROMIUM_JAR_CABINET_COOKIE_MISSING" not in s:
    raise SystemExit('CHROMIUM_REQUIRED_JAR_COOKIE_GUARD_MISSING')
if 'BASH_DYNAMIC_SCOPE_COOKIE_JAR_BINDING_REMAINS' not in s or 'LABEL_BOUND_COOKIE_JAR_INVARIANT_MISSING' not in s:
    raise SystemExit('LABEL_BOUND_COOKIE_JAR_PATCH_MISSING')
if 'HTTP_REQUEST_TIMEOUT_ENVELOPE' not in s or "'--max-time 110'" not in s:
    raise SystemExit('HTTP_REQUEST_TIMEOUT_PATCH_MISSING')
if 'EMPLOYEE_AMBIGUOUS_DECISION_RECONCILIATION' not in s or 'P0_EMPLOYEE_JOIN_AMBIGUOUS_RECONCILIATION=PASS' not in s:
    raise SystemExit('EMPLOYEE_DECISION_RECONCILIATION_PATCH_MISSING')

p.write_text(s, encoding='utf-8')
PY

chmod 0700 "$tmp"
bash -n "$tmp"

if [[ "${PC_P0_ALL_ROLE_IDNA_VALIDATE_ONLY:-0}" == 1 ]]; then
  set +e
  output="$(bash "$tmp" "$@" 2>&1)"
  rc=$?
  set -e
  printf '%s\n' "$output"
  (( rc == 0 )) || exit "$rc"
  printf 'P0_ALL_ROLE_CHROMIUM_EXACT_PATH_PRESERVATION=PASS\n'
  printf 'P0_ALL_ROLE_CHROMIUM_SERVER_PATH_AUTHORITY=PASS\n'
  printf 'P0_ALL_ROLE_LABEL_BOUND_COOKIE_JARS=PASS\n'
  printf 'P0_ALL_ROLE_HTTP_TIMEOUT_ENVELOPE=PASS\n'
  printf 'P0_ALL_ROLE_EMPLOYEE_JOIN_RECONCILIATION=PASS\n'
  exit 0
fi

bash "$tmp" "$@"
