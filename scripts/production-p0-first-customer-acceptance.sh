#!/usr/bin/env bash
set -Eeuo pipefail

CORE_BLOB='b02ce590dc308ce46c41df33416dd7b11700ae98'

fail() { printf 'P0_FIRST_CUSTOMER_ALIAS_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }
command -v git >/dev/null 2>&1 || fail GIT_REQUIRED 2
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 3

tmp="$(mktemp)"
cleanup(){ rm -f -- "$tmp"; }
trap cleanup EXIT

git cat-file blob "$CORE_BLOB" > "$tmp" 2>/dev/null || fail CORE_BLOB_MISSING 4
[[ "$(git hash-object "$tmp")" == "$CORE_BLOB" ]] || fail CORE_BLOB_MISMATCH 5

python3 - "$tmp" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')

def one(old,new,label):
    global s
    count=s.count(old)
    if count != 1:
        raise SystemExit(f'PATCH_CARDINALITY_{label}={count}')
    s=s.replace(old,new,1)

one(
    "const knownRoles = new Set(['pc_auth_runtime', 'one_deal_auth', 'app_auth']);",
    "const knownRoles = new Set(['pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service']);",
    'AUTH_ROLE_ALLOWLIST',
)
one(
    r"AUTH_PRINCIPAL\|(pc_auth_runtime|one_deal_auth|app_auth)$",
    r"AUTH_PRINCIPAL\|(pc_auth_runtime|one_deal_auth|app_auth|app_service)$",
    'AUTH_ROLE_OUTPUT_GUARD',
)
one(
    "target = os.environ['P0_TARGET_EMAIL'].strip().lower()",
    """def canonical_mailbox(value):
    try:
        value = str(value or '').strip().lower()
        if value.count('@') != 1:
            return None
        local, domain = value.rsplit('@', 1)
        local.encode('ascii')
        domain = domain.encode('idna').decode('ascii').lower()
        result = f'{local}@{domain}'
        if len(result) > 254 or not re.fullmatch(r'[A-Za-z0-9._+-]{1,64}@[A-Za-z0-9.-]{1,189}', result):
            return None
        return result
    except Exception:
        return None

def canonical_imap_login(value):
    try:
        value = str(value or '').strip()
        if value.count('@') != 1:
            return None
        local, domain = value.rsplit('@', 1)
        local.encode('ascii')
        domain = domain.encode('idna').decode('ascii').lower()
        result = f'{local}@{domain}'
        if len(result) > 254 or not re.fullmatch(r'[^\\s@]{1,64}@[^\\s@]{1,189}', result):
            return None
        return result
    except Exception:
        return None

target = canonical_mailbox(os.environ['P0_TARGET_EMAIL'])
if target is None:
    raise SystemExit('VERIFICATION_TARGET_INVALID')
username = canonical_imap_login(username)
if username is None:
    raise SystemExit('IMAP_LOGIN_IDENTITY_INVALID')""",
    'IMAP_IDNA_TARGET',
)
one(
    "                recipients.extend(address.lower() for _, address in getaddresses(message.get_all(header, [])))",
    """                for _, address in getaddresses(message.get_all(header, [])):
                    canonical = canonical_mailbox(address)
                    if canonical:
                        recipients.append(canonical)""",
    'IMAP_IDNA_RECIPIENTS',
)
one(
    """  if (( rc != 0 )); then
    blocker=\"$(sed -n 's/^ERROR_CODE=//p' <<< \"$output\" | tail -1)\"
    [[ \"$blocker\" =~ ^[A-Z0-9_]{4,100}$ ]] || blocker=P0_REMOTE_READ_ONLY_EVIDENCE_FAILED
    fail \"$blocker\" 80
  fi""",
    """  if (( rc != 0 )); then
    blocker=\"$(sed -n 's/^ERROR_CODE=//p' <<< \"$output\" | tail -1)\"
    [[ \"$blocker\" =~ ^[A-Z0-9_]{4,100}$ ]] || blocker=P0_REMOTE_READ_ONLY_EVIDENCE_FAILED
    if [[ -n \"$TMP_ROOT\" && -d \"$TMP_ROOT\" ]]; then
      printf '%s\\n' \"$blocker\" > \"$TMP_ROOT/remote-blocker\"
      chmod 0600 \"$TMP_ROOT/remote-blocker\"
    fi
    fail \"$blocker\" 80
  fi""",
    'REMOTE_BLOCKER_PERSIST',
)
one(
    """  if [[ \"$FINISHED\" != 1 ]]; then
    safe_failure_record || true""",
    """  if [[ \"$FINISHED\" != 1 ]]; then
    if [[ -n \"$TMP_ROOT\" && -f \"$TMP_ROOT/remote-blocker\" ]]; then
      local remote_blocker
      remote_blocker=\"$(cat \"$TMP_ROOT/remote-blocker\" 2>/dev/null || true)\"
      if [[ \"$remote_blocker\" =~ ^[A-Z0-9_]{4,100}$ ]]; then
        BLOCKER_CODE=\"$remote_blocker\"
      fi
    fi
    safe_failure_record || true""",
    'REMOTE_BLOCKER_RECOVER',
)
one(
    "REVIEWER_USER_ID=''\n",
    "REVIEWER_USER_ID=''\nREGISTRATION_HTTP_STATUS=''\nREGISTRATION_PUBLIC_CODE=''\n",
    'REGISTRATION_FAILURE_STATE',
)
one(
    """  P0_BLOCKER=\"$BLOCKER_CODE\" \\
    python3 - \"$EVIDENCE_DIR/result.json\" <<'PY'
import json, os, sys
""",
    """  P0_BLOCKER=\"$BLOCKER_CODE\" \\
  P0_REGISTRATION_HTTP_STATUS=\"${REGISTRATION_HTTP_STATUS:-}\" \\
  P0_REGISTRATION_PUBLIC_CODE=\"${REGISTRATION_PUBLIC_CODE:-}\" \\
    python3 - \"$EVIDENCE_DIR/result.json\" <<'PY'
import json, os, re, sys
""",
    'REGISTRATION_FAILURE_ENV',
)
one(
    """    'blocker': os.environ.get('P0_BLOCKER', 'UNEXPECTED_P0_ACCEPTANCE_FAILURE'),
}
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
""",
    """    'blocker': os.environ.get('P0_BLOCKER', 'UNEXPECTED_P0_ACCEPTANCE_FAILURE'),
}
if str(payload['stage']).startswith('registration-'):
    status = os.environ.get('P0_REGISTRATION_HTTP_STATUS', '')
    code = os.environ.get('P0_REGISTRATION_PUBLIC_CODE', '')
    payload['registrationHttpStatus'] = int(status) if re.fullmatch(r'[1-5][0-9]{2}', status) else 'UNKNOWN'
    payload['registrationPublicCode'] = code if re.fullmatch(r'[A-Z0-9_]{4,100}', code) else 'UNKNOWN'
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
""",
    'REGISTRATION_FAILURE_RECORD',
)
one(
    """  [[ \"$status\" == 202 ]] || fail \"P0_REGISTRATION_${label^^}_FAILED\" 31
""",
    """  if [[ \"$status\" != 202 ]]; then
    if [[ \"$status\" =~ ^[1-5][0-9]{2}$ ]]; then
      REGISTRATION_HTTP_STATUS=\"$status\"
    else
      REGISTRATION_HTTP_STATUS=UNKNOWN
    fi
    REGISTRATION_PUBLIC_CODE=\"$(python3 - \"$response\" <<'PY'
import json, re, sys
try:
    payload = json.load(open(sys.argv[1], encoding='utf-8'))
except Exception:
    print('UNKNOWN')
    raise SystemExit(0)
code = payload.get('code')
print(code if isinstance(code, str) and re.fullmatch(r'[A-Z0-9_]{4,100}', code) else 'UNKNOWN')
PY
)\"
    [[ \"$REGISTRATION_PUBLIC_CODE\" =~ ^[A-Z0-9_]{4,100}$ ]] || REGISTRATION_PUBLIC_CODE=UNKNOWN
    printf 'P0_REGISTRATION_HTTP_STATUS=%s\\n' \"$REGISTRATION_HTTP_STATUS\"
    printf 'P0_REGISTRATION_PUBLIC_CODE=%s\\n' \"$REGISTRATION_PUBLIC_CODE\"
    fail \"P0_REGISTRATION_${label^^}_FAILED\" 31
  fi
""",
    'REGISTRATION_FAILURE_CLASSIFIER',
)

required=[
    "principal.rolsuper !== false",
    "principal.rolbypassrls !== false",
    "principal.schema_usage !== true",
    "principal.membership_select !== true",
    "table?.relrowsecurity !== true",
    "table?.relforcerowsecurity !== true",
    "SET TRANSACTION READ ONLY",
    "P0_AUTH_RUNTIME_PRINCIPAL_INVALID",
    "def canonical_mailbox(value):",
    "def canonical_imap_login(value):",
    "domain.encode('idna').decode('ascii').lower()",
    "username = canonical_imap_login(username)",
    "IMAP_LOGIN_IDENTITY_INVALID",
    "client.login(username, password)",
    "recipients.append(canonical)",
    "REMOTE_BLOCKER_PERSIST",
    "REGISTRATION_FAILURE_STATE",
    "P0_REGISTRATION_HTTP_STATUS",
    "P0_REGISTRATION_PUBLIC_CODE",
    "registrationHttpStatus",
    "registrationPublicCode",
]
missing=[x for x in required if x not in s and x not in {"REMOTE_BLOCKER_PERSIST", "REGISTRATION_FAILURE_STATE"}]
if missing:
    raise SystemExit('SECURITY_INVARIANT_MISSING='+'|'.join(missing))
if s.count("'app_service'") != 1:
    raise SystemExit('LEGACY_ALIAS_CARDINALITY_INVALID')
if s.count('username = canonical_imap_login(username)') != 1:
    raise SystemExit('IMAP_LOGIN_CANONICALIZATION_CARDINALITY_INVALID')
if s.count('$TMP_ROOT/remote-blocker') != 4:
    raise SystemExit('REMOTE_BLOCKER_BOUNDARY_CARDINALITY_INVALID')
if "BLOCKER_CODE=\"$remote_blocker\"" not in s:
    raise SystemExit('REMOTE_BLOCKER_RECOVERY_MISSING')
if s.count("payload['registrationHttpStatus']") != 1 or s.count("payload['registrationPublicCode']") != 1:
    raise SystemExit('REGISTRATION_FAILURE_EVIDENCE_CARDINALITY_INVALID')
if s.count("REGISTRATION_PUBLIC_CODE=\"$(python3 - \"$response\"") != 1:
    raise SystemExit('REGISTRATION_FAILURE_CLASSIFIER_CARDINALITY_INVALID')
if 'cat "$response"' in s or 'P0_REGISTRATION_RESPONSE_BODY' in s:
    raise SystemExit('REGISTRATION_FAILURE_RAW_RESPONSE_FORBIDDEN')
p.write_text(s,encoding='utf-8')
PY

chmod 0700 "$tmp"
bash -n "$tmp"

if [[ "${PC_P0_FIRST_CUSTOMER_ALIAS_VALIDATE_ONLY:-0}" == 1 ]]; then
  printf 'P0_FIRST_CUSTOMER_AUTH_ALIAS_PATCH=PASS\n'
  printf 'P0_FIRST_CUSTOMER_IMAP_IDNA_PATCH=PASS\n'
  printf 'P0_FIRST_CUSTOMER_IMAP_LOGIN_IDNA_PATCH=PASS\n'
  printf 'P0_FIRST_CUSTOMER_REMOTE_BLOCKER_PROPAGATION=PASS\n'
  printf 'P0_FIRST_CUSTOMER_REGISTRATION_FAILURE_EVIDENCE_PATCH=PASS\n'
  exit 0
fi

exec bash "$tmp" "$@"
