#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_SHA="${1:?exact current main SHA is required}"
RUN_ID="${PC_P0_RUN_ID:-manual}"
RUN_STARTED_EPOCH="${PC_P0_RUN_STARTED_EPOCH:-$(date +%s)}"
LIVE_BASE="${PC_P0_LIVE_BASE:-https://xn----8sbjf4befbjgs9b.xn--p1ai}"
EVIDENCE_DIR="${PC_P0_EVIDENCE_DIR:-artifacts/production-p0-all-role-registration}"
CURRENT_STAGE=bootstrap
BLOCKER_CODE=UNEXPECTED_P0_ALL_ROLE_FAILURE
FINISHED=0
TMP_ROOT=''

PLATFORM_LABELS=(seller buyer logistics driver elevator lab surveyor bank)
ALL_LABELS=(seller buyer logistics driver elevator lab surveyor bank employee)
declare -A WORKSPACE EXPECTED_ROLE CABINET_ROUTE
declare -A EMAIL PASSWORD INN PHONE ORG_LEGAL APP_ID
declare -A USER_ID ORG_ID TENANT_ID MEMBERSHIP_ID USER_ROLE MFA_SECRET

WORKSPACE[seller]='seller'
WORKSPACE[buyer]='buyer'
WORKSPACE[logistics]='logistics'
WORKSPACE[driver]='driver'
WORKSPACE[elevator]='elevator'
WORKSPACE[lab]='lab'
WORKSPACE[surveyor]='surveyor'
WORKSPACE[bank]='bank'
WORKSPACE[employee]='employee'

EXPECTED_ROLE[seller]='FARMER'
EXPECTED_ROLE[buyer]='BUYER'
EXPECTED_ROLE[logistics]='LOGISTICIAN'
EXPECTED_ROLE[driver]='DRIVER'
EXPECTED_ROLE[elevator]='ELEVATOR'
EXPECTED_ROLE[lab]='LAB'
EXPECTED_ROLE[surveyor]='SURVEYOR'
EXPECTED_ROLE[bank]='ACCOUNTING'
EXPECTED_ROLE[employee]='GUEST'

CABINET_ROUTE[seller]='/platform-v7/seller'
CABINET_ROUTE[buyer]='/platform-v7/buyer'
CABINET_ROUTE[logistics]='/platform-v7/logistics'
CABINET_ROUTE[driver]='/platform-v7/driver/field'
CABINET_ROUTE[elevator]='/platform-v7/elevator'
CABINET_ROUTE[lab]='/platform-v7/lab'
CABINET_ROUTE[surveyor]='/platform-v7/surveyor'
CABINET_ROUTE[bank]='/platform-v7/bank'
CABINET_ROUTE[employee]='/platform-v7/profile'

EMPLOYEE_PLATFORM_OVERRIDE_BLOCKER='ORGANIZATION_ADMIN_DECISION_REQUIRED'

safe_failure_record() {
  mkdir -p "$EVIDENCE_DIR"
  P0_TARGET_SHA="$TARGET_SHA" \
  P0_RUN_ID="$RUN_ID" \
  P0_STAGE="$CURRENT_STAGE" \
  P0_BLOCKER="$BLOCKER_CODE" \
    python3 - "$EVIDENCE_DIR/result.json" <<'PY'
import json, os, sys
payload = {
    'schemaVersion': 'production.p0.all-role-registration.v1',
    'passed': False,
    'targetSha': os.environ.get('P0_TARGET_SHA', 'unknown'),
    'runId': os.environ.get('P0_RUN_ID', 'unknown'),
    'stage': os.environ.get('P0_STAGE', 'unknown'),
    'blocker': os.environ.get('P0_BLOCKER', 'UNEXPECTED_P0_ALL_ROLE_FAILURE'),
    'completed': 0,
    'required': 9,
}
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump(payload, handle, ensure_ascii=True, indent=2)
    handle.write('\n')
PY
}

cleanup() {
  local rc=$?
  set +e
  if [[ "$FINISHED" != 1 ]]; then
    safe_failure_record || true
    printf 'P0_ALL_ROLE_REGISTRATION=FAIL\n'
    printf 'P0_ACCEPTANCE_STAGE=%s\n' "$CURRENT_STAGE"
    printf 'P0_BLOCKER=%s\n' "$BLOCKER_CODE"
  fi
  [[ -z "$TMP_ROOT" ]] || rm -rf "$TMP_ROOT"
  unset PASSWORD MFA_SECRET PC_P0_IMAP_PASSWORD
  exit "$rc"
}
trap cleanup EXIT

fail() {
  BLOCKER_CODE="$1"
  exit "${2:-1}"
}

require_commands() {
  local command
  for command in gh curl python3 node ssh awk sha256sum sort; do
    command -v "$command" >/dev/null 2>&1 || fail "MISSING_P0_COMMAND_${command^^}" 10
  done
}

assert_exact_main() {
  local actual
  actual="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null)" \
    || fail P0_EXACT_MAIN_LOOKUP_FAILED 11
  [[ "$actual" == "$TARGET_SHA" ]] || fail P0_MAIN_ADVANCED_DURING_MATRIX 12
}

guarded_wait_seconds() {
  local seconds="$1" deadline now remaining step
  [[ "$seconds" =~ ^[0-9]+$ ]] || fail P0_RATE_WINDOW_INVALID 13
  deadline=$(( $(date +%s) + seconds ))
  while :; do
    assert_exact_main
    now="$(date +%s)"
    (( now >= deadline )) && break
    remaining=$(( deadline - now ))
    step=30
    (( remaining < step )) && step="$remaining"
    sleep "$step"
  done
}

wait_for_reviewer_rate_window() {
  local not_before="${PC_P0_REVIEWER_WINDOW_NOT_BEFORE_EPOCH:-}" now
  CURRENT_STAGE=reviewer-rate-window
  [[ "$not_before" =~ ^[0-9]{10}$ ]] || fail P0_DEEP_ACCEPTANCE_RATE_WINDOW_MISSING 14
  now="$(date +%s)"
  if (( now < not_before )); then
    guarded_wait_seconds "$(( not_before - now ))"
  fi
}

http_request() {
  local output="$1" jar="$2"
  shift 2
  assert_exact_main
  curl \
    --silent \
    --show-error \
    --connect-timeout 10 \
    --max-time 40 \
    --output "$output" \
    --write-out '%{http_code}' \
    --cookie "$jar" \
    --cookie-jar "$jar" \
    -H 'Accept: application/json' \
    -H 'Cache-Control: no-cache, no-store, max-age=0' \
    -H 'Pragma: no-cache' \
    "$@"
}

csrf_token() {
  local jar="$1" token
  token="$(awk -F '\t' '$6 == "pc_csrf_token" { value=$7 } END { print value }' "$jar")"
  [[ "$token" =~ ^[A-Za-z0-9_-]{24,128}$ ]] || fail P0_CSRF_COOKIE_MISSING 15
  printf '%s' "$token"
}

prime_csrf() {
  local label="$1" jar="$TMP_ROOT/$label.cookies" page="$TMP_ROOT/$label-csrf.html" status
  : > "$jar"
  chmod 0600 "$jar"
  status="$(http_request "$page" "$jar" "$LIVE_BASE/platform-v7/register?lang=ru")"
  [[ "$status" == 200 ]] || fail "P0_${label^^}_CSRF_PRIME_FAILED" 16
  csrf_token "$jar" >/dev/null
  rm -f "$page"
}

totp() {
  local secret="$1"
  P0_TOTP_SECRET="$secret" python3 <<'PY'
import base64, hashlib, hmac, os, struct, time
secret = ''.join(os.environ['P0_TOTP_SECRET'].split()).upper()
padding = '=' * ((8 - len(secret) % 8) % 8)
try:
    key = base64.b32decode(secret + padding, casefold=True)
except Exception:
    raise SystemExit('INVALID_TOTP_SECRET')
remaining = 30 - (int(time.time()) % 30)
if remaining < 15:
    time.sleep(remaining + 1)
counter = int(time.time()) // 30
digest = hmac.new(key, struct.pack('>Q', counter), hashlib.sha1).digest()
offset = digest[-1] & 0x0f
value = (struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff) % 1_000_000
print(f'{value:06d}')
PY
}

render_email() {
  local identity="$1"
  P0_EMAIL_IDENTITY="$identity" P0_EMAIL_RUN="$RUN_ID" python3 <<'PY'
import os, re
template = os.environ['PC_P0_EMAIL_TEMPLATE'].strip()
identity = os.environ['P0_EMAIL_IDENTITY']
run = os.environ['P0_EMAIL_RUN']
if template.count('{identity}') == 1 and '{run}' not in template and '{slot}' not in template:
    email = template.replace('{identity}', identity)
elif template.count('{identity}') == 0 and template.count('{run}') == 1 and template.count('{slot}') == 1:
    email = template.replace('{run}', run).replace('{slot}', identity)
else:
    raise SystemExit('EMAIL_TEMPLATE_PLACEHOLDER_INVALID')
email = email.lower()
if len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
    raise SystemExit('EMAIL_TEMPLATE_RESULT_INVALID')
print(email)
PY
}

fetch_verification_token() {
  local target_email="$1" not_before="$2"
  assert_exact_main
  P0_TARGET_EMAIL="$target_email" \
  P0_NOT_BEFORE="$not_before" \
  P0_TARGET_SHA="$TARGET_SHA" \
  P0_GITHUB_REPOSITORY="$GITHUB_REPOSITORY" \
    python3 <<'PY'
import email
import imaplib
import os
import re
import ssl
import subprocess
import time
from email.policy import default
from email.utils import getaddresses, parsedate_to_datetime
from urllib.parse import parse_qs, unquote, urlparse

host = os.environ['PC_P0_IMAP_HOST'].strip()
port = int((os.environ.get('PC_P0_IMAP_PORT') or '993').strip())
username = os.environ['PC_P0_IMAP_USER']
password = os.environ['PC_P0_IMAP_PASSWORD']
folder = os.environ.get('PC_P0_IMAP_FOLDER', 'INBOX').strip() or 'INBOX'
target = os.environ['P0_TARGET_EMAIL'].strip().lower()
not_before = int(os.environ['P0_NOT_BEFORE']) - 300
deadline = time.time() + 180
url_pattern = re.compile(r'https://[^\s<>"\']+/platform-v7/register\?[^\s<>"\']+', re.I)

def assert_main():
    result = subprocess.run(
        ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/commits/main", '--jq', '.sha'],
        check=False, capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        raise SystemExit(43)
    if result.stdout.strip() != os.environ['P0_TARGET_SHA']:
        raise SystemExit(42)

def text_parts(message):
    parts = []
    iterator = message.walk() if message.is_multipart() else (message,)
    for part in iterator:
        if part.get_content_type() not in ('text/plain', 'text/html'):
            continue
        try:
            parts.append(part.get_content())
        except Exception:
            raw = part.get_payload(decode=True) or b''
            parts.append(raw.decode(part.get_content_charset() or 'utf-8', errors='replace'))
    return '\n'.join(parts)

context = ssl.create_default_context()
while time.time() < deadline:
    assert_main()
    client = None
    try:
        client = imaplib.IMAP4_SSL(host, port, ssl_context=context)
        client.login(username, password)
        status, _ = client.select(folder, readonly=True)
        if status != 'OK':
            raise RuntimeError('mailbox select failed')
        status, data = client.search(None, 'ALL')
        if status != 'OK':
            raise RuntimeError('mailbox search failed')
        for identifier in reversed((data[0] or b'').split()[-300:]):
            status, rows = client.fetch(identifier, '(BODY.PEEK[])')
            if status != 'OK':
                continue
            raw = next((row[1] for row in rows if isinstance(row, tuple) and len(row) > 1), None)
            if not raw:
                continue
            message = email.message_from_bytes(raw, policy=default)
            recipients = []
            for header in ('to', 'cc', 'delivered-to', 'x-original-to', 'envelope-to'):
                recipients.extend(address.lower() for _, address in getaddresses(message.get_all(header, [])))
            if target not in recipients:
                continue
            try:
                sent_at = int(parsedate_to_datetime(message.get('date')).timestamp())
            except Exception:
                sent_at = int(time.time())
            if sent_at < not_before:
                continue
            body = text_parts(message).replace('&amp;', '&')
            for candidate in url_pattern.findall(body):
                token = unquote((parse_qs(urlparse(candidate).query).get('verify') or [''])[0])
                if 48 <= len(token) <= 512 and re.fullmatch(r'[A-Za-z0-9._~-]+', token):
                    print(token)
                    client.logout()
                    raise SystemExit(0)
        client.logout()
    except SystemExit:
        raise
    except Exception:
        if client is not None:
            try:
                client.logout()
            except Exception:
                pass
    time.sleep(5)
raise SystemExit('VERIFICATION_MESSAGE_NOT_FOUND')
PY
}

validate_prerequisites() {
  CURRENT_STAGE=protected-prerequisites
  require_commands
  [[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail P0_TARGET_SHA_INVALID 20
  [[ "$RUN_ID" =~ ^[A-Za-z0-9._:-]{1,48}$ ]] || fail P0_RUN_ID_INVALID 21
  [[ "$RUN_STARTED_EPOCH" =~ ^[0-9]{10}$ ]] || fail P0_RUN_STARTED_EPOCH_INVALID 22
  [[ "$LIVE_BASE" == 'https://xn----8sbjf4befbjgs9b.xn--p1ai' ]] || fail P0_CANONICAL_LIVE_BASE_MISMATCH 23
  [[ -n "${GITHUB_REPOSITORY:-}" && -n "${GH_TOKEN:-}" ]] || fail P0_GITHUB_AUTHORITY_MISSING 24
  [[ -n "${PC_P0_EMAIL_TEMPLATE:-}" && -n "${PC_P0_IMAP_HOST:-}" \
    && -n "${PC_P0_IMAP_USER:-}" && -n "${PC_P0_IMAP_PASSWORD:-}" ]] \
    || fail MISSING_P0_MAILBOX_PREREQUISITE 25
  [[ "${PC_P0_IMAP_PORT:-993}" =~ ^[0-9]+$ ]] || fail MISSING_P0_MAILBOX_PREREQUISITE 25
  [[ -n "${PC_P0_PLAYWRIGHT_MODULE:-}" && -f "$PC_P0_PLAYWRIGHT_MODULE" ]] \
    || fail MISSING_P0_CHROMIUM_PREREQUISITE 26
  if env | grep -Eq '^PC_(P0|PROD_P0)_REVIEWER_'; then
    fail P0_REVIEWER_CREDENTIAL_INPUT_FORBIDDEN 27
  fi
  [[ "${PC_P0_SSH_HOST:-}" == 195.19.12.120 \
    && "${PC_P0_SSH_USER:-}" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ \
    && "${PC_P0_SSH_PORT:-}" =~ ^[0-9]+$ \
    && -f "${PC_P0_SSH_KEY_PATH:-/nonexistent}" \
    && -f "${PC_P0_SSH_KNOWN_HOSTS:-/nonexistent}" ]] \
    || fail MISSING_P0_SSH_PREREQUISITE 28
  assert_exact_main
}

make_registration_body() {
  local output="$1" label="$2"
  P0_EMAIL="${EMAIL[$label]}" \
  P0_PASSWORD="${PASSWORD[$label]}" \
  P0_WORKSPACE="${WORKSPACE[$label]}" \
  P0_INN="${INN[$label]}" \
  P0_PHONE="${PHONE[$label]}" \
  P0_LEGAL="${ORG_LEGAL[$label]}" \
  P0_LABEL="$label" \
    python3 - "$output" <<'PY'
import json, os, sys
payload = {
    'email': os.environ['P0_EMAIL'],
    'phone': os.environ['P0_PHONE'],
    'fullName': 'Production P0 Matrix ' + os.environ['P0_LABEL'].title(),
    'position': 'Production acceptance identity',
    'orgLegalName': os.environ['P0_LEGAL'],
    'orgInn': os.environ['P0_INN'],
    'orgType': 'SELF_EMPLOYED',
    'region': 'Production acceptance region',
    'workspace': os.environ['P0_WORKSPACE'],
    'password': os.environ['P0_PASSWORD'],
    'termsVersion': '2026-07-31',
    'privacyVersion': '2026-07-31',
    'acceptTerms': True,
    'acceptPrivacy': True,
    'locale': 'ru',
}
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump(payload, handle, ensure_ascii=False, separators=(',', ':'))
PY
  chmod 0600 "$output"
}

prepare_identity() {
  local label="$1"
  EMAIL[$label]="$(render_email "matrix-${RUN_ID}-${TARGET_SHA:0:7}-$label")" \
    || fail MISSING_P0_MAILBOX_PREREQUISITE 29
  PASSWORD[$label]="$(python3 - <<'PY'
import secrets
print('Aa1!' + secrets.token_urlsafe(30))
PY
)"
  PHONE[$label]="+7495$(P0_SEED="$RUN_ID:$label" python3 - <<'PY'
import hashlib, os
value = int(hashlib.sha256(os.environ['P0_SEED'].encode()).hexdigest(), 16) % 10_000_000
print(f'{value:07d}')
PY
)"
  if [[ "$label" == employee ]]; then
    INN[$label]="${INN[seller]}"
    ORG_LEGAL[$label]="${ORG_LEGAL[seller]}"
  else
    INN[$label]="$(P0_SEED="$TARGET_SHA:$RUN_ID:$label" python3 - <<'PY'
import hashlib, os
digits = str(int(hashlib.sha256(os.environ['P0_SEED'].encode()).hexdigest(), 16)).zfill(40)
print('77' + digits[:10])
PY
)"
    ORG_LEGAL[$label]="Production P0 exact-run organization ${label^^} $RUN_ID"
  fi
}

register_and_verify() {
  local label="$1" jar="$TMP_ROOT/$label.cookies"
  local request="$TMP_ROOT/$label-register.json" response="$TMP_ROOT/$label-register-response.json"
  local verify_request="$TMP_ROOT/$label-verify.json" verify_response="$TMP_ROOT/$label-verify-response.json"
  local csrf status token not_before result mail_rc
  CURRENT_STAGE="registration-$label"
  prepare_identity "$label"
  prime_csrf "$label"
  make_registration_body "$request" "$label"
  csrf="$(csrf_token "$jar")"
  not_before="$(date +%s)"
  status="$(http_request "$response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/register" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "Idempotency-Key: p0-all-role-register:$TARGET_SHA:$RUN_ID:$label" \
    -H "x-correlation-id: p0-all-role-register:${TARGET_SHA:0:12}:$RUN_ID:$label" \
    --data-binary "@$request")"
  [[ "$status" == 202 ]] || fail "P0_${label^^}_REGISTRATION_FAILED" 30
  python3 - "$response" <<'PY' || fail "P0_REGISTRATION_RESPONSE_INVALID" 31
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('accepted') is not True or p.get('status') != 'EMAIL_VERIFICATION_REQUIRED' or p.get('nextAction') != 'VERIFY_EMAIL':
    raise SystemExit(1)
for key in ('applicationId', 'statusToken', 'emailDelivery', 'token', 'password', 'setupSecret'):
    if key in p:
        raise SystemExit(1)
PY
  rm -f "$request" "$response"
  CURRENT_STAGE="mailbox-verification-$label"
  set +e
  token="$(fetch_verification_token "${EMAIL[$label]}" "$not_before")"
  mail_rc=$?
  set -e
  case "$mail_rc" in
    0) ;;
    42) fail P0_MAIN_ADVANCED_DURING_MATRIX 12 ;;
    43) fail P0_EXACT_MAIN_LOOKUP_FAILED 11 ;;
    *) fail "P0_${label^^}_VERIFICATION_EMAIL_UNAVAILABLE" 32 ;;
  esac
  P0_VERIFY_TOKEN="$token" python3 - "$verify_request" <<'PY'
import json, os, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({'token': os.environ['P0_VERIFY_TOKEN'], 'locale': 'ru'}, handle, separators=(',', ':'))
PY
  unset token P0_VERIFY_TOKEN
  chmod 0600 "$verify_request"
  csrf="$(csrf_token "$jar")"
  status="$(http_request "$verify_response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/registration/verify" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-all-role-verify:${TARGET_SHA:0:12}:$RUN_ID:$label" \
    --data-binary "@$verify_request")"
  rm -f "$verify_request"
  [[ "$status" == 200 ]] || fail "P0_${label^^}_EMAIL_VERIFICATION_FAILED" 33
  result="$(python3 - "$verify_response" <<'PY'
import json, re, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('ok') is not True or p.get('status') != 'ORGANIZATION_VERIFICATION_PENDING' or p.get('nextAction') != 'WAIT_FOR_REVIEW':
    raise SystemExit(1)
application = p.get('applicationId')
if not isinstance(application, str) or not re.fullmatch(r'reg_[A-Za-z0-9-]+', application):
    raise SystemExit(1)
print(application)
PY
)" || fail "P0_${label^^}_EMAIL_VERIFICATION_CONTRACT_INVALID" 34
  APP_ID[$label]="$result"
  rm -f "$verify_response"
}

remote_authority() {
  local mode="$1" output rc blocker
  shift
  assert_exact_main
  set +e
  output="$(ssh \
    -i "$PC_P0_SSH_KEY_PATH" \
    -p "$PC_P0_SSH_PORT" \
    -o BatchMode=yes \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="$PC_P0_SSH_KNOWN_HOSTS" \
    -o ConnectTimeout=15 \
    "$PC_P0_SSH_USER@$PC_P0_SSH_HOST" \
    bash -s -- "$mode" "$TARGET_SHA" "$@" <<'REMOTE'
set -Eeuo pipefail
mode="${1:-}"
target="${2:-}"
shift 2 || true
remote_fail(){ printf 'ERROR_CODE=%s\n' "$1"; exit "${2:-1}"; }
[[ "$mode" == preflight || "$mode" == approval_wait ]] || remote_fail P0_REMOTE_MODE_INVALID 2
[[ "$target" =~ ^[0-9a-f]{40}$ ]] || remote_fail P0_REMOTE_TARGET_INVALID 3
[[ "$(id -u)" == 0 ]] || remote_fail P0_PROTECTED_SSH_PRINCIPAL_INVALID 4
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || remote_fail P0_WEB_RUNTIME_AUTHORITY_AMBIGUOUS 5
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || remote_fail P0_API_RUNTIME_AUTHORITY_AMBIGUOUS 6
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" == "$target" && "$web_revision" == "$target" ]] || remote_fail P0_PRODUCTION_REVISION_MISMATCH 7
web_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$web_id")"
[[ "$web_health" == healthy ]] || remote_fail P0_PRODUCTION_WEB_NOT_HEALTHY 8
docker exec "$api_id" /nodejs/bin/node -e \
  "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" \
  >/dev/null 2>&1 || remote_fail P0_PRODUCTION_API_NOT_READY 9
if [[ "$mode" == preflight ]]; then
  printf 'P0_REMOTE_EXACT_REVISIONS=PASS\n'
  exit 0
fi
(( $# == 9 )) || remote_fail P0_HUMAN_APPROVAL_ARGUMENTS_INVALID 10
started="$1"
shift
[[ "$started" =~ ^[0-9]{10}$ ]] || remote_fail P0_HUMAN_APPROVAL_ARGUMENT_INVALID 11
for application in "$@"; do
  [[ "$application" =~ ^reg_[A-Za-z0-9-]+$ ]] || remote_fail P0_HUMAN_APPROVAL_ARGUMENT_INVALID 11
done
log_file="$(mktemp)"
trap 'rm -f "$log_file"' EXIT
docker logs --since "$started" "$web_id" > "$log_file" 2>&1
state="$(python3 - "$log_file" "$@" <<'PY'
import json, re, sys
path, *application_args = sys.argv[1:]
applications = set(application_args)
if len(applications) != 8:
    raise SystemExit(2)
proof = {application: {'approve': False, 'replay': False} for application in applications}
blocked = False
pattern = re.compile(r'p0_human_reviewer_ceremony\s+(\{.*\})')
for line in open(path, encoding='utf-8', errors='replace'):
    match = pattern.search(line)
    if not match:
        continue
    try:
        payload = json.loads(match.group(1))
    except Exception:
        continue
    application = payload.get('applicationId')
    if application not in applications or payload.get('marker') != 'P0_HUMAN_REVIEWER_CEREMONY':
        continue
    correlation = str(payload.get('correlationId') or '')
    if correlation.startswith('p0-human-approve:'):
        valid = payload.get('replayed') is False and payload.get('notificationDelivered') is True
        proof[application]['approve'] = proof[application]['approve'] or valid
        blocked = blocked or not valid
    elif correlation.startswith('p0-human-replay:'):
        valid = payload.get('replayed') is True and payload.get('notificationSuppressed') is True
        proof[application]['replay'] = proof[application]['replay'] or valid
        blocked = blocked or not valid
if blocked:
    print('BLOCKED')
elif all(row['approve'] and row['replay'] for row in proof.values()):
    print('READY')
else:
    print('PENDING')
PY
)" || remote_fail P0_HUMAN_REVIEWER_LOG_PROOF_FAILED 12
printf 'P0_REMOTE_EXACT_REVISIONS=PASS\n'
printf 'P0_HUMAN_APPROVAL_STATE=%s\n' "$state"
REMOTE
)"
  rc=$?
  set -e
  if (( rc != 0 )); then
    blocker="$(sed -n 's/^ERROR_CODE=//p' <<< "$output" | tail -1)"
    [[ "$blocker" =~ ^[A-Z0-9_]{4,100}$ ]] || blocker=P0_REMOTE_AUTHORITY_FAILED
    fail "$blocker" 40
  fi
  printf '%s\n' "$output"
}

wait_for_platform_approvals() {
  local timeout="${PC_P0_HUMAN_APPROVAL_TIMEOUT_SECONDS:-1800}" deadline output state
  [[ "$timeout" =~ ^[0-9]+$ ]] && (( timeout >= 300 && timeout <= 3600 )) \
    || fail P0_HUMAN_REVIEW_TIMEOUT_INVALID 41
  CURRENT_STAGE=human-reviewer-ceremony
  printf 'P0_HUMAN_REVIEW_REQUIRED=8\n'
  printf 'P0_HUMAN_REVIEW_AUTHORITY=EXISTING_PLATFORM_OWNER_FRESH_MFA_CONTROL_PLANE\n'
  {
    printf '## Production P0 nine-role human reviewer ceremony\n\n'
    printf -- '- exact main: `%s`\n' "$TARGET_SHA"
    printf -- '- verified NEW_ORGANIZATION applications waiting: `8`\n'
    printf -- '- reviewer credentials in Actions: `0`\n'
    printf -- '- legal-name marker: `Production P0 exact-run organization`\n'
    printf -- '- required: fresh MFA, visible CONTROL_PLANE, approve all eight marked rows\n'
    printf -- '- application identifiers and applicant data published: `0`\n'
  } > "$TMP_ROOT/human-review-comment.md"
  gh issue comment 3072 --repo "$GITHUB_REPOSITORY" --body-file "$TMP_ROOT/human-review-comment.md" >/dev/null
  rm -f "$TMP_ROOT/human-review-comment.md"
  deadline=$(( $(date +%s) + timeout ))
  while (( $(date +%s) < deadline )); do
    output="$(remote_authority approval_wait "$RUN_STARTED_EPOCH" \
      "${APP_ID[seller]}" "${APP_ID[buyer]}" "${APP_ID[logistics]}" "${APP_ID[driver]}" \
      "${APP_ID[elevator]}" "${APP_ID[lab]}" "${APP_ID[surveyor]}" "${APP_ID[bank]}")"
    state="$(sed -n 's/^P0_HUMAN_APPROVAL_STATE=//p' <<< "$output" | tail -1)"
    case "$state" in
      READY)
        printf 'P0_PLATFORM_REVIEWER_APPROVALS=8/8\n'
        return
        ;;
      PENDING) guarded_wait_seconds 10 ;;
      BLOCKED) fail P0_HUMAN_REVIEWER_DECISION_BLOCKED 42 ;;
      *) fail P0_HUMAN_APPROVAL_EVIDENCE_INVALID 43 ;;
    esac
  done
  fail P0_HUMAN_REVIEWER_CEREMONY_TIMEOUT 44
}

login_identity() {
  local label="$1" mode="$2" jar="$TMP_ROOT/$label.cookies"
  local login_request="$TMP_ROOT/$label-login-$mode.json" login_response="$TMP_ROOT/$label-login-$mode-response.json"
  local mfa_request="$TMP_ROOT/$label-mfa-$mode.json" mfa_response="$TMP_ROOT/$label-mfa-$mode-response.json"
  local me_response="$TMP_ROOT/$label-me-$mode.json" csrf status secret code result expected_admin
  CURRENT_STAGE="$label-login-$mode"
  if [[ "$mode" == relogin ]]; then
    prime_csrf "$label"
  fi
  P0_EMAIL="${EMAIL[$label]}" P0_PASSWORD="${PASSWORD[$label]}" \
    python3 - "$login_request" <<'PY'
import json, os, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({'email': os.environ['P0_EMAIL'], 'password': os.environ['P0_PASSWORD']}, handle, separators=(',', ':'))
PY
  chmod 0600 "$login_request"
  csrf="$(csrf_token "$jar")"
  status="$(http_request "$login_response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-all-role-login:${TARGET_SHA:0:12}:$RUN_ID:$label:$mode" \
    --data-binary "@$login_request")"
  rm -f "$login_request"
  [[ "$status" == 200 ]] || fail "P0_${label^^}_${mode^^}_LOGIN_FAILED" 50
  if [[ "$mode" == initial ]]; then
    secret="$(python3 - "$login_response" <<'PY'
import json, re, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('ok') is not True or p.get('mfaRequired') is not True or p.get('enrollmentRequired') is not True:
    raise SystemExit(1)
secret = p.get('setupSecret')
if not isinstance(secret, str) or not re.fullmatch(r'[A-Z2-7]{16,128}', secret):
    raise SystemExit(1)
if not isinstance(p.get('otpAuthUri'), str) or not p['otpAuthUri'].startswith('otpauth://totp/'):
    raise SystemExit(1)
print(secret)
PY
)" || fail "P0_${label^^}_MFA_ENROLLMENT_MISSING" 51
    MFA_SECRET[$label]="$secret"
  else
    python3 - "$login_response" <<'PY' || fail "P0_${label^^}_RELOGIN_MFA_CHALLENGE_INVALID" 52
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('ok') is not True or p.get('mfaRequired') is not True or p.get('enrollmentRequired') is not False:
    raise SystemExit(1)
if p.get('setupSecret') not in (None, ''):
    raise SystemExit(1)
PY
  fi
  rm -f "$login_response"
  code="$(totp "${MFA_SECRET[$label]}")" || fail "P0_${label^^}_TOTP_INVALID" 53
  P0_CODE="$code" python3 - "$mfa_request" <<'PY'
import json, os, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({'code': os.environ['P0_CODE']}, handle, separators=(',', ':'))
PY
  unset code P0_CODE secret
  chmod 0600 "$mfa_request"
  csrf="$(csrf_token "$jar")"
  status="$(http_request "$mfa_response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/mfa-login" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-all-role-mfa:${TARGET_SHA:0:12}:$RUN_ID:$label:$mode" \
    --data-binary "@$mfa_request")"
  rm -f "$mfa_request"
  [[ "$status" == 200 ]] || fail "P0_${label^^}_${mode^^}_MFA_FAILED" 54
  P0_MODE="$mode" python3 - "$mfa_response" <<'PY' || fail "P0_${label^^}_MFA_RESPONSE_INVALID" 55
import json, os, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('ok') is not True or not isinstance(p.get('redirectTo'), str) or not p['redirectTo'].startswith('/platform-v7/'):
    raise SystemExit(1)
backup = p.get('backupCodes')
if os.environ['P0_MODE'] == 'initial':
    if not isinstance(backup, list) or len(backup) < 1:
        raise SystemExit(1)
elif backup not in (None, []):
    raise SystemExit(1)
PY
  rm -f "$mfa_response"
  status="$(http_request "$me_response" "$jar" \
    "$LIVE_BASE/api/auth/me" \
    -H "x-correlation-id: p0-all-role-me:${TARGET_SHA:0:12}:$RUN_ID:$label:$mode")"
  [[ "$status" == 200 ]] || fail "P0_${label^^}_SESSION_FAILED" 56
  expected_admin=true
  [[ "$label" == employee ]] && expected_admin=false
  result="$(P0_EMAIL="${EMAIL[$label]}" \
    P0_ROLE="${EXPECTED_ROLE[$label]}" \
    P0_ADMIN="$expected_admin" \
    python3 - "$me_response" <<'PY'
import datetime, json, os, re, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('authenticated') is not True or str(p.get('email', '')).lower() != os.environ['P0_EMAIL'].lower():
    raise SystemExit(1)
if p.get('role') != os.environ['P0_ROLE'] or p.get('isOrgAdmin') is not (os.environ['P0_ADMIN'] == 'true'):
    raise SystemExit(1)
fields = [p.get(name) for name in ('id', 'orgId', 'tenantId', 'membershipId')]
if any(not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,180}', value) for value in fields):
    raise SystemExit(1)
verified = p.get('mfaVerifiedAt')
if not isinstance(verified, str):
    raise SystemExit(1)
stamp = datetime.datetime.fromisoformat(verified.replace('Z', '+00:00'))
age = (datetime.datetime.now(datetime.timezone.utc) - stamp).total_seconds()
if age < -30 or age > 900:
    raise SystemExit(1)
print('\t'.join(fields + [p['role']]))
PY
)" || fail "P0_${label^^}_SESSION_CONTRACT_INVALID" 57
  if [[ "$mode" == initial ]]; then
    IFS=$'\t' read -r USER_ID[$label] ORG_ID[$label] TENANT_ID[$label] MEMBERSHIP_ID[$label] USER_ROLE[$label] <<< "$result"
  else
    local user org tenant membership role
    IFS=$'\t' read -r user org tenant membership role <<< "$result"
    [[ "$user" == "${USER_ID[$label]}" && "$org" == "${ORG_ID[$label]}" \
      && "$tenant" == "${TENANT_ID[$label]}" && "$membership" == "${MEMBERSHIP_ID[$label]}" \
      && "$role" == "${USER_ROLE[$label]}" ]] \
      || fail "P0_${label^^}_RELOGIN_CONTEXT_CHANGED" 58
  fi
  rm -f "$me_response"
}

approve_employee_join() {
  local jar="$TMP_ROOT/seller.cookies" list="$TMP_ROOT/employee-joins.json"
  local request="$TMP_ROOT/employee-join-decision.json" response="$TMP_ROOT/employee-join-response.json"
  local replay="$TMP_ROOT/employee-join-replay.json" csrf status
  CURRENT_STAGE=employee-organization-admin-decision
  status="$(http_request "$list" "$jar" \
    "$LIVE_BASE/api/proxy/auth/organization-join-requests" \
    -H "x-correlation-id: p0-all-role-join-list:${TARGET_SHA:0:12}:$RUN_ID")"
  [[ "$status" == 200 ]] || fail P0_EMPLOYEE_JOIN_QUEUE_UNAVAILABLE 60
  P0_APP="${APP_ID[employee]}" P0_ORG="${ORG_ID[seller]}" \
    python3 - "$list" <<'PY' || fail P0_EMPLOYEE_JOIN_QUEUE_INVALID 61
import json, os, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('organizationId') != os.environ['P0_ORG']:
    raise SystemExit(1)
matches = [row for row in p.get('applications', []) if row.get('applicationId') == os.environ['P0_APP']]
if len(matches) != 1:
    raise SystemExit(1)
row = matches[0]
if row.get('status') != 'ORGANIZATION_VERIFICATION_PENDING' or row.get('requestedWorkspace') != 'employee' or row.get('requestedRole') != 'GUEST':
    raise SystemExit(1)
PY
  rm -f "$list"
  python3 - "$request" <<'PY'
import json, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({'decision': 'APPROVE', 'reason': 'Production P0 employee joins verified seller organization', 'locale': 'ru'}, handle, separators=(',', ':'))
PY
  chmod 0600 "$request"
  csrf="$(csrf_token "$jar")"
  status="$(http_request "$response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/organization-join-requests/${APP_ID[employee]}/decision" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "Idempotency-Key: p0-all-role-employee-join:$TARGET_SHA:$RUN_ID" \
    -H "x-correlation-id: p0-all-role-employee-join:${TARGET_SHA:0:12}:$RUN_ID" \
    --data-binary "@$request")"
  [[ "$status" == 200 ]] || {
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
  status="$(http_request "$replay" "$jar" \
    -X POST "$LIVE_BASE/api/auth/organization-join-requests/${APP_ID[employee]}/decision" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "Idempotency-Key: p0-all-role-employee-join:$TARGET_SHA:$RUN_ID" \
    -H "x-correlation-id: p0-all-role-employee-join-replay:${TARGET_SHA:0:12}:$RUN_ID" \
    --data-binary "@$request")"
  rm -f "$request" "$response"
  [[ "$status" == 200 ]] || fail P0_EMPLOYEE_JOIN_REPLAY_FAILED 65
  python3 - "$replay" <<'PY' || fail P0_EMPLOYEE_JOIN_REPLAY_INVALID 66
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('status') != 'ACTIVATED' or p.get('replayed') is not True or p.get('notificationDelivered') is not False:
    raise SystemExit(1)
PY
  rm -f "$replay"
  printf 'P0_EMPLOYEE_AUTHORITY=VERIFIED_SELLER_ORGANIZATION_ADMIN_FRESH_MFA\n'
}

chromium_probe() {
  local label="$1" kind="$2" expected_admin=true
  [[ "$label" == employee ]] && expected_admin=false
  CURRENT_STAGE="$label-$kind-chromium"
  assert_exact_main
  PC_P0_BROWSER_LABEL="$label" \
  PC_P0_BROWSER_KIND="$kind" \
  PC_P0_BROWSER_JAR="$TMP_ROOT/$label.cookies" \
  PC_P0_BROWSER_ORIGIN="$LIVE_BASE" \
  PC_P0_BROWSER_ROUTE="${CABINET_ROUTE[$label]}" \
  PC_P0_BROWSER_ROLE="${EXPECTED_ROLE[$label]}" \
  PC_P0_BROWSER_USER="${USER_ID[$label]}" \
  PC_P0_BROWSER_ORG="${ORG_ID[$label]}" \
  PC_P0_BROWSER_TENANT="${TENANT_ID[$label]}" \
  PC_P0_BROWSER_MEMBERSHIP="${MEMBERSHIP_ID[$label]}" \
  PC_P0_BROWSER_ADMIN="$expected_admin" \
    node <<'NODE'
const fs = require('node:fs');
const { chromium } = require(process.env.PC_P0_PLAYWRIGHT_MODULE);
const fail = (code) => { throw new Error(code); };

function cookiesFromJar(path) {
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
}

(async () => {
  const kind = process.env.PC_P0_BROWSER_KIND;
  const label = process.env.PC_P0_BROWSER_LABEL;
  if (!['desktop', 'mobile'].includes(kind)) fail('P0_CHROMIUM_KIND_INVALID');
  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = kind === 'desktop';
    const mobile = kind === 'mobile';
    const context = await browser.newContext({
      viewport: desktop ? { width: 1440, height: 900 } : { width: 393, height: 852 },
      screen: desktop ? { width: 1440, height: 900 } : { width: 393, height: 852 },
      isMobile: mobile,
      hasTouch: mobile,
      deviceScaleFactor: desktop ? 1 : 2.75,
      userAgent: desktop
        ? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36'
        : 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36',
    });
    await context.addCookies(cookiesFromJar(process.env.PC_P0_BROWSER_JAR));
    const page = await context.newPage();
    const response = await page.goto(
      process.env.PC_P0_BROWSER_ORIGIN + process.env.PC_P0_BROWSER_ROUTE,
      { waitUntil: 'domcontentloaded', timeout: 45_000 },
    );
    if (!response || response.status() >= 400) fail('P0_CHROMIUM_CABINET_HTTP_INVALID');
    await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => undefined);
    const current = new URL(page.url());
    if (current.origin !== process.env.PC_P0_BROWSER_ORIGIN
      || current.pathname !== process.env.PC_P0_BROWSER_ROUTE) {
      fail('P0_CHROMIUM_CABINET_REDIRECTED');
    }
    const text = (await page.locator('body').innerText()).trim();
    if (text.length < 40) fail('P0_CHROMIUM_CABINET_EMPTY');
    const proof = await page.evaluate(async () => {
      const meResponse = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
      const teamResponse = await fetch('/api/proxy/auth/organization-team', { credentials: 'same-origin', cache: 'no-store' });
      return {
        meStatus: meResponse.status,
        me: await meResponse.json().catch(() => ({})),
        teamStatus: teamResponse.status,
        team: await teamResponse.json().catch(() => ({})),
      };
    });
    if (proof.meStatus !== 200 || proof.me.authenticated !== true
      || proof.me.id !== process.env.PC_P0_BROWSER_USER
      || proof.me.orgId !== process.env.PC_P0_BROWSER_ORG
      || proof.me.tenantId !== process.env.PC_P0_BROWSER_TENANT
      || proof.me.membershipId !== process.env.PC_P0_BROWSER_MEMBERSHIP
      || proof.me.role !== process.env.PC_P0_BROWSER_ROLE) {
      fail('P0_CHROMIUM_SESSION_READ_INVALID');
    }
    if (proof.teamStatus !== 200
      || proof.team.organizationId !== process.env.PC_P0_BROWSER_ORG
      || proof.team.tenantId !== process.env.PC_P0_BROWSER_TENANT
      || proof.team.currentMembershipId !== process.env.PC_P0_BROWSER_MEMBERSHIP
      || proof.team.hasFreshMfa !== true
      || proof.team.isOrganizationAdmin !== (process.env.PC_P0_BROWSER_ADMIN === 'true')) {
      fail('P0_CHROMIUM_PERMITTED_READ_INVALID');
    }
    await context.close();
    process.stdout.write('P0_CHROMIUM_PROBE=' + label + ':' + kind + ':PASS\n');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  const code = /^[A-Z0-9_]{4,100}$/.test(String(error && error.message))
    ? error.message : 'P0_CHROMIUM_PROBE_FAILED';
  process.stderr.write(code + '\n');
  process.exitCode = 1;
});
NODE
  assert_exact_main
}

logout_identity() {
  local label="$1" jar="$TMP_ROOT/$label.cookies"
  local response="$TMP_ROOT/$label-logout.json" me="$TMP_ROOT/$label-after-logout.json"
  local csrf status
  CURRENT_STAGE="$label-logout"
  csrf="$(csrf_token "$jar")"
  status="$(http_request "$response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/logout" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-all-role-logout:${TARGET_SHA:0:12}:$RUN_ID:$label" \
    --data '{}')"
  [[ "$status" == 200 ]] || fail "P0_${label^^}_LOGOUT_FAILED" 70
  python3 - "$response" <<'PY' || fail P0_LOGOUT_CONTRACT_INVALID 71
import json, sys
if json.load(open(sys.argv[1], encoding='utf-8')).get('ok') is not True:
    raise SystemExit(1)
PY
  rm -f "$response"
  status="$(http_request "$me" "$jar" \
    "$LIVE_BASE/api/auth/me" \
    -H "x-correlation-id: p0-all-role-after-logout:${TARGET_SHA:0:12}:$RUN_ID:$label")"
  [[ "$status" == 401 ]] || fail "P0_${label^^}_SESSION_SURVIVED_LOGOUT" 72
  python3 - "$me" <<'PY' || fail P0_LOGOUT_AUTH_STATE_INVALID 73
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('authenticated') is not False or p.get('code') != 'UNAUTHENTICATED':
    raise SystemExit(1)
PY
  rm -f "$me"
}

assert_topology() {
  local label
  CURRENT_STAGE=topology
  for label in "${ALL_LABELS[@]}"; do
    [[ "${USER_ROLE[$label]}" == "${EXPECTED_ROLE[$label]}" ]] || fail P0_ROLE_MATRIX_MISMATCH 80
  done
  [[ "$(for label in "${PLATFORM_LABELS[@]}"; do printf '%s\n' "${ORG_ID[$label]}"; done | sort -u | wc -l)" == 8 ]] \
    || fail P0_ORGANIZATION_TOPOLOGY_INVALID 81
  [[ "$(for label in "${PLATFORM_LABELS[@]}"; do printf '%s\n' "${TENANT_ID[$label]}"; done | sort -u | wc -l)" == 8 ]] \
    || fail P0_TENANT_TOPOLOGY_INVALID 82
  [[ "$(for label in "${ALL_LABELS[@]}"; do printf '%s\n' "${USER_ID[$label]}"; done | sort -u | wc -l)" == 9 ]] \
    || fail P0_USER_TOPOLOGY_INVALID 83
  [[ "$(for label in "${ALL_LABELS[@]}"; do printf '%s\n' "${MEMBERSHIP_ID[$label]}"; done | sort -u | wc -l)" == 9 ]] \
    || fail P0_MEMBERSHIP_TOPOLOGY_INVALID 84
  [[ "${ORG_ID[employee]}" == "${ORG_ID[seller]}" \
    && "${TENANT_ID[employee]}" == "${TENANT_ID[seller]}" \
    && "${USER_ID[employee]}" != "${USER_ID[seller]}" \
    && "${MEMBERSHIP_ID[employee]}" != "${MEMBERSHIP_ID[seller]}" ]] \
    || fail P0_EMPLOYEE_SELLER_TENANT_RELATION_INVALID 85
}

write_success_record() {
  local private="$TMP_ROOT/result-input.tsv" label
  : > "$private"
  chmod 0600 "$private"
  for label in "${ALL_LABELS[@]}"; do
    printf '%s\t%s\t%s\t%s\t%s\n' \
      "$label" "${EMAIL[$label]}" "${EXPECTED_ROLE[$label]}" "${CABINET_ROUTE[$label]}" \
      "$([[ "$label" == employee ]] && printf ORGANIZATION_ADMIN || printf PLATFORM_REVIEWER)" \
      >> "$private"
  done
  P0_TARGET_SHA="$TARGET_SHA" P0_RUN_ID="$RUN_ID" \
    python3 - "$private" "$EVIDENCE_DIR/result.json" <<'PY'
import hashlib, json, os, sys
source, output = sys.argv[1:]
roles = []
for line in open(source, encoding='utf-8'):
    label, email, role, route, authority = line.rstrip('\n').split('\t')
    roles.append({
        'workspace': label,
        'emailHash': hashlib.sha256(email.lower().encode()).hexdigest()[:20],
        'serverRole': role,
        'cabinetRoute': route,
        'approvalAuthority': authority,
        'realMailVerified': True,
        'initialTotpEnrollment': True,
        'desktopChromiumCabinet': True,
        'protectedOrganizationTeamRead': True,
        'logoutRevokedSession': True,
        'freshTotpRelogin': True,
        'mobileChromiumCabinet': True,
        'organizationRelation': 'shares-seller' if label == 'employee' else 'independent',
    })
payload = {
    'schemaVersion': 'production.p0.all-role-registration.v1',
    'passed': True,
    'targetSha': os.environ['P0_TARGET_SHA'],
    'runId': os.environ['P0_RUN_ID'],
    'completed': 9,
    'required': 9,
    'topology': {'organizations': 8, 'tenants': 8, 'users': 9, 'memberships': 9},
    'platformReviewerApprovals': 8,
    'organizationAdminApprovals': 1,
    'desktopChromium': True,
    'mobileChromium': True,
    'logoutRelogin': True,
    'roles': roles,
    'secretsOrPiiInEvidence': False,
}
with open(output, 'w', encoding='utf-8') as handle:
    json.dump(payload, handle, ensure_ascii=True, indent=2)
    handle.write('\n')
PY
  rm -f "$private"
}

main() {
  local label index
  umask 077
  mkdir -p "$EVIDENCE_DIR"
  TMP_ROOT="$(mktemp -d)"
  chmod 0700 "$TMP_ROOT"
  validate_prerequisites
  wait_for_reviewer_rate_window
  CURRENT_STAGE=production-preflight
  remote_authority preflight | grep -Fxq P0_REMOTE_EXACT_REVISIONS=PASS \
    || fail P0_PRODUCTION_PREFLIGHT_FAILED 90

  index=0
  for label in "${PLATFORM_LABELS[@]}"; do
    register_and_verify "$label"
    index=$(( index + 1 ))
    if (( index == 5 )); then
      CURRENT_STAGE=registration-rate-window
      guarded_wait_seconds 305
    fi
  done
  wait_for_platform_approvals

  login_identity seller initial
  chromium_probe seller desktop
  register_and_verify employee
  approve_employee_join
  logout_identity seller

  CURRENT_STAGE=login-rate-window
  guarded_wait_seconds 65
  login_identity employee initial
  chromium_probe employee desktop
  for label in buyer logistics driver elevator lab surveyor bank; do
    login_identity "$label" initial
    chromium_probe "$label" desktop
  done
  assert_topology

  for label in employee buyer logistics driver elevator lab surveyor bank; do
    logout_identity "$label"
  done
  CURRENT_STAGE=relogin-rate-window
  guarded_wait_seconds 65
  for label in "${PLATFORM_LABELS[@]}"; do
    login_identity "$label" relogin
    chromium_probe "$label" mobile
  done
  CURRENT_STAGE=employee-relogin-rate-window
  guarded_wait_seconds 65
  login_identity employee relogin
  chromium_probe employee mobile

  for label in "${ALL_LABELS[@]}"; do
    logout_identity "$label"
  done
  CURRENT_STAGE=evidence-finalization
  assert_exact_main
  write_success_record
  unset PASSWORD MFA_SECRET PC_P0_IMAP_PASSWORD
  FINISHED=1
  CURRENT_STAGE=complete
  printf 'P0_ALL_ROLE_REGISTRATION_COUNT=9/9\n'
  printf 'P0_ALL_ROLE_TOPOLOGY=8_ORGS_8_TENANTS_9_MEMBERSHIPS\n'
  printf 'P0_ALL_ROLE_DESKTOP_CHROMIUM=PASS\n'
  printf 'P0_ALL_ROLE_MOBILE_CHROMIUM=PASS\n'
  printf 'P0_ALL_ROLE_LOGOUT_RELOGIN=PASS\n'
  printf 'P0_ALL_ROLE_REGISTRATION=PASS\n'
}

main "$@"
