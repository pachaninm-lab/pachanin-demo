#!/usr/bin/env bash
set -Eeuo pipefail

CORE_BLOB='ba18b1feb1c044c0495a418732e2378145865c23'

fail() { printf 'P0_ALL_ROLE_IDNA_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }
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
    """username = os.environ['PC_P0_IMAP_USER']
password = os.environ['PC_P0_IMAP_PASSWORD']
folder = os.environ.get('PC_P0_IMAP_FOLDER', 'INBOX').strip() or 'INBOX'
target = os.environ['P0_TARGET_EMAIL'].strip().lower()""",
    """def canonical_mailbox(value):
    try:
        value = str(value or '').strip().lower()
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

username = canonical_mailbox(os.environ['PC_P0_IMAP_USER'])
if username is None:
    raise SystemExit('IMAP_LOGIN_IDENTITY_INVALID')
password = os.environ['PC_P0_IMAP_PASSWORD']
folder = os.environ.get('PC_P0_IMAP_FOLDER', 'INBOX').strip() or 'INBOX'
target = canonical_mailbox(os.environ['P0_TARGET_EMAIL'])
if target is None:
    raise SystemExit('VERIFICATION_TARGET_INVALID')""",
    'IMAP_IDNA_IDENTITIES',
)
one(
    "                recipients.extend(address.lower() for _, address in getaddresses(message.get_all(header, [])))",
    """                for _, address in getaddresses(message.get_all(header, [])):
                    canonical = canonical_mailbox(address)
                    if canonical:
                        recipients.append(canonical)""",
    'IMAP_IDNA_RECIPIENTS',
)

required=[
    "PLATFORM_LABELS=(seller buyer logistics driver elevator lab surveyor bank)",
    "ALL_LABELS=(seller buyer logistics driver elevator lab surveyor bank employee)",
    "EXPECTED_ROLE[seller]='FARMER'",
    "EXPECTED_ROLE[buyer]='BUYER'",
    "EXPECTED_ROLE[logistics]='LOGISTICIAN'",
    "EXPECTED_ROLE[driver]='DRIVER'",
    "EXPECTED_ROLE[elevator]='ELEVATOR'",
    "EXPECTED_ROLE[lab]='LAB'",
    "EXPECTED_ROLE[surveyor]='SURVEYOR'",
    "EXPECTED_ROLE[bank]='ACCOUNTING'",
    "EXPECTED_ROLE[employee]='GUEST'",
    "CABINET_ROUTE[seller]='/platform-v7/seller'",
    "CABINET_ROUTE[buyer]='/platform-v7/buyer'",
    "CABINET_ROUTE[logistics]='/platform-v7/logistics'",
    "CABINET_ROUTE[driver]='/platform-v7/driver/field'",
    "CABINET_ROUTE[elevator]='/platform-v7/elevator'",
    "CABINET_ROUTE[lab]='/platform-v7/lab'",
    "CABINET_ROUTE[surveyor]='/platform-v7/surveyor'",
    "CABINET_ROUTE[bank]='/platform-v7/bank'",
    "CABINET_ROUTE[employee]='/platform-v7/profile'",
    "P0_REVIEWER_CREDENTIAL_INPUT_FORBIDDEN",
    "wait_for_reviewer_rate_window",
    "wait_for_platform_approvals",
    "P0_HUMAN_REVIEW_REQUIRED=8",
    "p0_human_reviewer_ceremony",
    "notificationSuppressed",
    "register_and_verify employee",
    "approve_employee_join",
    "$LIVE_BASE/api/auth/organization-join-requests/",
    "ORGANIZATION_ADMIN_DECISION_REQUIRED",
    "$LIVE_BASE/api/auth/login",
    "$LIVE_BASE/api/auth/mfa-login",
    "$LIVE_BASE/api/auth/me",
    "fetch('/api/proxy/auth/organization-team'",
    "$LIVE_BASE/api/auth/logout",
    "require(process.env.PC_P0_PLAYWRIGHT_MODULE)",
    "kind === 'desktop'",
    "kind === 'mobile'",
    "page.goto",
    "context.addCookies",
    "assert_topology",
    "P0_ALL_ROLE_REGISTRATION_COUNT=9/9",
    "P0_ALL_ROLE_TOPOLOGY=8_ORGS_8_TENANTS_9_MEMBERSHIPS",
    "P0_ALL_ROLE_DESKTOP_CHROMIUM=PASS",
    "P0_ALL_ROLE_MOBILE_CHROMIUM=PASS",
    "P0_ALL_ROLE_LOGOUT_RELOGIN=PASS",
    "P0_ALL_ROLE_REGISTRATION=PASS",
    "def canonical_mailbox(value):",
    "domain.encode('idna').decode('ascii').lower()",
    "username = canonical_mailbox(os.environ['PC_P0_IMAP_USER'])",
    "IMAP_LOGIN_IDENTITY_INVALID",
    "target = canonical_mailbox(os.environ['P0_TARGET_EMAIL'])",
    "recipients.append(canonical)",
    "client.login(username, password)",
]
missing=[x for x in required if x not in s]
if missing:
    raise SystemExit('SECURITY_INVARIANT_MISSING='+'|'.join(missing))
if "username = os.environ['PC_P0_IMAP_USER']" in s:
    raise SystemExit('RAW_IMAP_LOGIN_IDENTITY_REMAINS')
if s.count("username = canonical_mailbox(os.environ['PC_P0_IMAP_USER'])") != 1:
    raise SystemExit('IMAP_LOGIN_CANONICALIZATION_CARDINALITY_INVALID')
if s.count("target = canonical_mailbox(os.environ['P0_TARGET_EMAIL'])") != 1:
    raise SystemExit('IMAP_TARGET_CANONICALIZATION_CARDINALITY_INVALID')
if s.count('recipients.append(canonical)') != 1:
    raise SystemExit('IMAP_RECIPIENT_CANONICALIZATION_CARDINALITY_INVALID')
if s.count('client.login(username, password)') != 1:
    raise SystemExit('IMAP_LOGIN_EXECUTION_CARDINALITY_INVALID')

p.write_text(s,encoding='utf-8')
PY

chmod 0700 "$tmp"
bash -n "$tmp"

if [[ "${PC_P0_ALL_ROLE_IDNA_VALIDATE_ONLY:-0}" == 1 ]]; then
  printf 'P0_ALL_ROLE_CORE_BLOB=PASS\n'
  printf 'P0_ALL_ROLE_IMAP_LOGIN_IDNA_PATCH=PASS\n'
  printf 'P0_ALL_ROLE_IMAP_RECIPIENT_IDNA_PATCH=PASS\n'
  exit 0
fi

exec bash "$tmp" "$@"
