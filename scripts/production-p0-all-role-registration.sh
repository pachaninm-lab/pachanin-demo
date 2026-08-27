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
one(
    "PC_P0_REVIEWER_WINDOW_NOT_BEFORE_EPOCH",
    "PC_P0_APPROVAL_WINDOW_NOT_BEFORE_EPOCH",
    'APPROVAL_WINDOW_NAMESPACE',
)
one(
    '  gh issue comment 3072 --repo "$GITHUB_REPOSITORY" --body-file "$TMP_ROOT/human-review-comment.md" >/dev/null',
    '  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body-file "$TMP_ROOT/human-review-comment.md" >/dev/null',
    'HUMAN_REVIEW_ISSUE_ROUTING',
)

one(
    r"""function cookiesFromJar(path) {
  const rows = [];
  for (const original of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    let line = original;
    let httpOnly = false;
    if (line.startsWith('#HttpOnly_')) {
      httpOnly = true;
      line = line.slice('#HttpOnly_'.length);
    } else if (!line || line.startsWith('#')) {
      continue;
    }
    const fields = line.split('\t');
    if (fields.length !== 7) continue;
    const [domain, , pathValue, secureValue, expiresValue, name, value] = fields;
    const cookie = {
      name,
      value,
      domain,
      path: pathValue || '/',
      secure: secureValue.toUpperCase() === 'TRUE',
      httpOnly,
      sameSite: 'Lax',
    };
    const expires = Number(expiresValue);
    if (Number.isFinite(expires) && expires > 0) cookie.expires = expires;
    rows.push(cookie);
  }
  if (!rows.length) fail('P0_CHROMIUM_COOKIE_IMPORT_EMPTY');
  return rows;
}""",
    r"""function cookiesFromJar(path, origin) {
  const target = new URL(origin);
  const rows = [];
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const original of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    let line = original;
    let httpOnly = false;
    if (line.startsWith('#HttpOnly_')) {
      httpOnly = true;
      line = line.slice('#HttpOnly_'.length);
    } else if (!line || line.startsWith('#')) {
      continue;
    }
    const fields = line.split('\t');
    if (fields.length !== 7) continue;
    const [domain, includeSubdomainsValue, pathValue, secureValue, expiresValue, name, value] = fields;
    const secure = secureValue.toUpperCase() === 'TRUE';
    if (domain !== target.hostname
      || includeSubdomainsValue.toUpperCase() !== 'FALSE'
      || target.protocol !== 'https:'
      || !secure) {
      fail('P0_CHROMIUM_COOKIE_SCOPE_INVALID');
    }
    if ((pathValue || '/') !== '/') continue;
    const cookie = {
      name,
      value,
      domain: target.hostname,
      path: '/',
      secure,
      httpOnly,
      sameSite: 'Lax',
    };
    const expires = Number(expiresValue);
    if (Number.isFinite(expires) && expires > 0) {
      if (expires <= nowSeconds) fail('P0_CHROMIUM_COOKIE_EXPIRED');
      cookie.expires = expires;
    }
    rows.push(cookie);
  }
  if (!rows.length) fail('P0_CHROMIUM_COOKIE_IMPORT_EMPTY');
  const jarNames = new Set(rows.filter((cookie) => cookie.value).map((cookie) => cookie.name));
  if (!jarNames.has('pc_access_token')) fail('P0_CHROMIUM_JAR_ACCESS_COOKIE_MISSING');
  if (!jarNames.has('pc_v7_cabinet')) fail('P0_CHROMIUM_JAR_CABINET_COOKIE_MISSING');
  return rows;
}""",
    'CHROMIUM_CANONICAL_COOKIE_SCOPE',
)

one(
    r"""chromium_probe() {
  local label="$1" kind="$2" expected_admin=true
  [[ "$label" == employee ]] && expected_admin=false
  CURRENT_STAGE="$label-$kind-chromium"
  assert_exact_main
  PC_P0_BROWSER_LABEL="$label" \
""",
    r"""chromium_probe() {
  local label="$1" kind="$2" expected_admin=true
  local browser_blocker browser_blocker_file="$TMP_ROOT/$label-$kind-chromium.blocker"
  [[ "$label" == employee ]] && expected_admin=false
  CURRENT_STAGE="$label-$kind-chromium"
  assert_exact_main
  if ! PC_P0_BROWSER_LABEL="$label" \
""",
    'CHROMIUM_BLOCKER_CAPTURE_START',
)

one(
    r"""  PC_P0_BROWSER_MEMBERSHIP="${MEMBERSHIP_ID[$label]}" \
  PC_P0_BROWSER_ADMIN="$expected_admin" \
    node <<'NODE'
""",
    r"""  PC_P0_BROWSER_MEMBERSHIP="${MEMBERSHIP_ID[$label]}" \
  PC_P0_BROWSER_ADMIN="$expected_admin" \
  PC_P0_BROWSER_BLOCKER_FILE="$browser_blocker_file" \
    node <<'NODE'
""",
    'CHROMIUM_BLOCKER_FILE_INPUT',
)

one(
    """    await context.addCookies(cookiesFromJar(process.env.PC_P0_BROWSER_JAR));
    const page = await context.newPage();
""",
    """    const origin = process.env.PC_P0_BROWSER_ORIGIN;
    const route = process.env.PC_P0_BROWSER_ROUTE;
    const browserHost = new URL(origin).hostname;
    await context.addCookies(cookiesFromJar(process.env.PC_P0_BROWSER_JAR, origin));
    const imported = await context.cookies();
    for (const required of ['pc_access_token', 'pc_v7_cabinet']) {
      const cookie = imported.find((candidate) => candidate.name === required);
      if (!cookie || !cookie.value) {
        fail(required === 'pc_access_token'
          ? 'P0_CHROMIUM_ACCESS_COOKIE_IMPORT_MISSING'
          : 'P0_CHROMIUM_CABINET_COOKIE_IMPORT_MISSING');
      }
      if (cookie.domain !== browserHost
        || cookie.path !== '/'
        || cookie.secure !== true
        || cookie.httpOnly !== true) {
        fail('P0_CHROMIUM_IMPORTED_COOKIE_SCOPE_INVALID');
      }
    }
    const importedMe = await context.request.get(origin + '/api/auth/me', {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    if (importedMe.status() !== 200) fail('P0_CHROMIUM_IMPORTED_SESSION_INVALID');
    const importedProfile = await importedMe.json().catch(() => ({}));
    if (importedProfile.authenticated !== true
      || importedProfile.id !== process.env.PC_P0_BROWSER_USER
      || importedProfile.orgId !== process.env.PC_P0_BROWSER_ORG
      || importedProfile.tenantId !== process.env.PC_P0_BROWSER_TENANT
      || importedProfile.membershipId !== process.env.PC_P0_BROWSER_MEMBERSHIP
      || importedProfile.role !== process.env.PC_P0_BROWSER_ROLE) {
      fail('P0_CHROMIUM_IMPORTED_SESSION_CONTEXT_INVALID');
    }
    const cabinetResponse = await context.request.get(origin + route, {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    if (cabinetResponse.status() >= 300 && cabinetResponse.status() < 400) {
      const location = cabinetResponse.headers().location || '';
      const destination = new URL(location, origin);
      if (destination.origin !== origin) {
        process.stderr.write('P0_CHROMIUM_SERVER_REDIRECT_CLASS=CROSS_ORIGIN\\n');
        fail('P0_CHROMIUM_SERVER_ORIGIN_REDIRECT');
      }
      if (destination.pathname === '/platform-v7/login') {
        process.stderr.write('P0_CHROMIUM_SERVER_REDIRECT_CLASS=LOGIN\\n');
        fail('P0_CHROMIUM_SERVER_SESSION_REJECTED');
      }
      process.stderr.write('P0_CHROMIUM_SERVER_REDIRECT_CLASS=SAME_ORIGIN_OTHER\\n');
      fail('P0_CHROMIUM_SERVER_ROLE_REDIRECT');
    }
    if (cabinetResponse.status() >= 400) fail('P0_CHROMIUM_CABINET_HTTP_INVALID');
    const page = await context.newPage();
""",
    'CHROMIUM_COOKIE_HANDOFF_PROOF',
)

one(
    """      process.env.PC_P0_BROWSER_ORIGIN + process.env.PC_P0_BROWSER_ROUTE,
""",
    """      origin + route,
""",
    'CHROMIUM_CANONICAL_NAVIGATION',
)

one(
    """    if (current.origin !== process.env.PC_P0_BROWSER_ORIGIN
      || current.pathname !== process.env.PC_P0_BROWSER_ROUTE) {
      fail('P0_CHROMIUM_CABINET_REDIRECTED');
    }
""",
    """    if (current.origin !== origin || current.pathname !== route) {
      process.stderr.write('P0_CHROMIUM_CLIENT_REDIRECT_CLASS='
        + (current.origin === origin ? 'SAME_ORIGIN_OTHER' : 'CROSS_ORIGIN') + '\\n');
      fail(current.origin === origin
        ? 'P0_CHROMIUM_CLIENT_REDIRECTED'
        : 'P0_CHROMIUM_CLIENT_ORIGIN_REDIRECT');
    }
""",
    'CHROMIUM_SAFE_REDIRECT_CLASSIFICATION',
)

one(
    """  const code = /^[A-Z0-9_]{4,100}$/.test(String(error && error.message))
    ? error.message : 'P0_CHROMIUM_PROBE_FAILED';
  process.stderr.write(code + '\\n');
  process.exitCode = 1;
});
NODE
  assert_exact_main
}
""",
    """  const code = /^[A-Z0-9_]{4,100}$/.test(String(error && error.message))
    ? error.message : 'P0_CHROMIUM_PROBE_FAILED';
  try {
    fs.writeFileSync(process.env.PC_P0_BROWSER_BLOCKER_FILE, code + '\\n', { mode: 0o600 });
  } catch {}
  process.stderr.write(code + '\\n');
  process.exitCode = 1;
});
NODE
  then
    browser_blocker="$(sed -n '/^P0_[A-Z0-9_]*$/p' "$browser_blocker_file" 2>/dev/null | tail -1)"
    rm -f -- "$browser_blocker_file"
    [[ "$browser_blocker" =~ ^P0_[A-Z0-9_]{4,96}$ ]] || browser_blocker=P0_CHROMIUM_PROBE_FAILED
    fail "$browser_blocker" 69
  fi
  rm -f -- "$browser_blocker_file"
  assert_exact_main
}
""",
    'CHROMIUM_BLOCKER_CAPTURE_FINISH',
)

one(
    """  local csrf status token not_before result mail_rc""",
    """  local csrf status token not_before result mail_rc rate_attempt retry_after""",
    'REGISTRATION_RATE_LIMIT_LOCALS',
)
one(
    r"""  status="$(http_request "$response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/register" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "Idempotency-Key: p0-all-role-register:$TARGET_SHA:$RUN_ID:$label" \
    -H "x-correlation-id: p0-all-role-register:${TARGET_SHA:0:12}:$RUN_ID:$label" \
    --data-binary "@$request")"
  [[ "$status" == 202 ]] || fail "P0_${label^^}_REGISTRATION_FAILED" 30""",
    r"""  rate_attempt=0
  while :; do
    status="$(http_request "$response" "$jar" \
      -X POST "$LIVE_BASE/api/auth/register" \
      -H 'Content-Type: application/json' \
      -H "Origin: $LIVE_BASE" \
      -H "x-csrf-token: $csrf" \
      -H "Idempotency-Key: p0-all-role-register:$TARGET_SHA:$RUN_ID:$label" \
      -H "x-correlation-id: p0-all-role-register:${TARGET_SHA:0:12}:$RUN_ID:$label" \
      --data-binary "@$request")"
    [[ "$status" == 429 ]] || break
    retry_after="$(python3 -c 'import json, sys
payload = json.load(open(sys.argv[1], encoding="utf-8"))
value = payload.get("retryAfterSeconds")
if payload.get("code") != "RATE_LIMITED" or isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 86400:
    raise SystemExit(1)
print(value + 2)' "$response")" \
      || fail P0_REGISTRATION_RATE_LIMIT_CONTRACT_INVALID 91
    rate_attempt=$(( rate_attempt + 1 ))
    (( rate_attempt <= 4 )) || fail P0_REGISTRATION_RATE_LIMIT_RETRY_EXHAUSTED 92
    CURRENT_STAGE="registration-rate-window-$label"
    guarded_wait_seconds "$retry_after"
    CURRENT_STAGE="registration-$label"
    csrf="$(csrf_token "$jar")"
  done
  [[ "$status" == 202 ]] || fail "P0_${label^^}_REGISTRATION_FAILED" 30""",
    'REGISTRATION_RATE_LIMIT_RETRY',
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
    "PC_P0_APPROVAL_WINDOW_NOT_BEFORE_EPOCH",
    'gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY"',
    "payload.get(\"code\") != \"RATE_LIMITED\"",
    "payload.get(\"retryAfterSeconds\")",
    "P0_REGISTRATION_RATE_LIMIT_RETRY_EXHAUSTED",
    "guarded_wait_seconds \"$retry_after\"",
    "if env | grep -Eq '^PC_(P0|PROD_P0)_REVIEWER_'; then",
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
    "domain: target.hostname",
    "includeSubdomainsValue.toUpperCase() !== 'FALSE'",
    "P0_CHROMIUM_COOKIE_SCOPE_INVALID",
    "P0_CHROMIUM_JAR_ACCESS_COOKIE_MISSING",
    "P0_CHROMIUM_JAR_CABINET_COOKIE_MISSING",
    "P0_CHROMIUM_ACCESS_COOKIE_IMPORT_MISSING",
    "P0_CHROMIUM_CABINET_COOKIE_IMPORT_MISSING",
    "P0_CHROMIUM_IMPORTED_COOKIE_SCOPE_INVALID",
    "P0_CHROMIUM_IMPORTED_SESSION_CONTEXT_INVALID",
    "P0_CHROMIUM_SERVER_SESSION_REJECTED",
    "P0_CHROMIUM_CLIENT_REDIRECTED",
    "PC_P0_BROWSER_BLOCKER_FILE",
    'fail "$browser_blocker" 69',
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
if s.count('PC_P0_APPROVAL_WINDOW_NOT_BEFORE_EPOCH') != 1:
    raise SystemExit('APPROVAL_WINDOW_NAMESPACE_CARDINALITY_INVALID')
if s.count('P0_REGISTRATION_RATE_LIMIT_RETRY_EXHAUSTED') != 1:
    raise SystemExit('REGISTRATION_RATE_LIMIT_RETRY_CARDINALITY_INVALID')
if s.count('payload.get("retryAfterSeconds")') != 1:
    raise SystemExit('REGISTRATION_RATE_LIMIT_CONTRACT_CARDINALITY_INVALID')
if 'PC_P0_REVIEWER_WINDOW_NOT_BEFORE_EPOCH' in s:
    raise SystemExit('REVIEWER_WINDOW_NAMESPACE_REMAINS')
if s.count('gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY"') != 1:
    raise SystemExit('HUMAN_REVIEW_ISSUE_ROUTING_CARDINALITY_INVALID')
if 'gh issue comment 3072 --repo' in s:
    raise SystemExit('HARDCODED_HUMAN_REVIEW_ISSUE_REMAINS')
if s.count('domain: target.hostname') != 1 or s.count('cookiesFromJar(process.env.PC_P0_BROWSER_JAR, origin)') != 1:
    raise SystemExit('CHROMIUM_CANONICAL_COOKIE_SCOPE_CARDINALITY_INVALID')
if 'url: target.origin' in s:
    raise SystemExit('CHROMIUM_URL_COOKIE_IMPORT_REMAINS')
if s.count("includeSubdomainsValue.toUpperCase() !== 'FALSE'") != 1 or s.count('domain !== target.hostname') != 1:
    raise SystemExit('CHROMIUM_HOST_ONLY_COOKIE_SCOPE_CARDINALITY_INVALID')
if 'REDIRECT_PATH=' in s or 'UNSAFE_PATH' in s:
    raise SystemExit('CHROMIUM_RAW_REDIRECT_PATH_LOGGING_REMAINS')
if s.count('P0_CHROMIUM_SERVER_REDIRECT_CLASS=') != 3 or s.count('P0_CHROMIUM_CLIENT_REDIRECT_CLASS=') != 1:
    raise SystemExit('CHROMIUM_REDIRECT_CLASS_CARDINALITY_INVALID')
if s.count("for (const required of ['pc_access_token', 'pc_v7_cabinet'])") != 1:
    raise SystemExit('CHROMIUM_REQUIRED_COOKIE_PROOF_CARDINALITY_INVALID')
if s.count('P0_CHROMIUM_JAR_ACCESS_COOKIE_MISSING') != 1 or s.count('P0_CHROMIUM_JAR_CABINET_COOKIE_MISSING') != 1:
    raise SystemExit('CHROMIUM_JAR_COOKIE_PROOF_CARDINALITY_INVALID')
if s.count('P0_CHROMIUM_ACCESS_COOKIE_IMPORT_MISSING') != 1 or s.count('P0_CHROMIUM_CABINET_COOKIE_IMPORT_MISSING') != 1:
    raise SystemExit('CHROMIUM_IMPORTED_COOKIE_PROOF_CARDINALITY_INVALID')
if s.count('P0_CHROMIUM_IMPORTED_COOKIE_SCOPE_INVALID') != 1:
    raise SystemExit('CHROMIUM_IMPORTED_COOKIE_SCOPE_CARDINALITY_INVALID')
if s.count('context.cookies()') != 1:
    raise SystemExit('CHROMIUM_FULL_COOKIE_STORE_PROOF_CARDINALITY_INVALID')
if s.count("maxRedirects: 0") != 2:
    raise SystemExit('CHROMIUM_SERVER_REDIRECT_PROOF_CARDINALITY_INVALID')
if s.count('PC_P0_BROWSER_BLOCKER_FILE') != 2 or s.count('fail "$browser_blocker" 69') != 1:
    raise SystemExit('CHROMIUM_BLOCKER_CAPTURE_CARDINALITY_INVALID')
reviewer_guard = """  if env | grep -Eq '^PC_(P0|PROD_P0)_REVIEWER_'; then
    fail P0_REVIEWER_CREDENTIAL_INPUT_FORBIDDEN 27
  fi"""
if s.count(reviewer_guard) != 1:
    raise SystemExit('REVIEWER_CREDENTIAL_BAN_CARDINALITY_INVALID')

p.write_text(s,encoding='utf-8')
PY

chmod 0700 "$tmp"
bash -n "$tmp"

if [[ "${PC_P0_ALL_ROLE_IDNA_VALIDATE_ONLY:-0}" == 1 ]]; then
  printf 'P0_ALL_ROLE_CORE_BLOB=PASS\n'
  printf 'P0_ALL_ROLE_IMAP_LOGIN_IDNA_PATCH=PASS\n'
  printf 'P0_ALL_ROLE_IMAP_RECIPIENT_IDNA_PATCH=PASS\n'
  printf 'P0_ALL_ROLE_APPROVAL_WINDOW_NAMESPACE=PASS\n'
  printf 'P0_ALL_ROLE_HUMAN_REVIEW_ISSUE_ROUTING=PASS\n'
  printf 'P0_ALL_ROLE_REGISTRATION_RATE_LIMIT_RETRY=PASS\n'
  printf 'P0_ALL_ROLE_CHROMIUM_COOKIE_HANDOFF=PASS\n'
  printf 'P0_ALL_ROLE_REVIEWER_CREDENTIAL_BAN=PASS\n'
  exit 0
fi

exec bash "$tmp" "$@"
