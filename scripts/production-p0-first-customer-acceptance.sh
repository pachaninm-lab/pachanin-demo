#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_SHA="${1:?exact current main SHA is required}"
RUN_ID="${PC_P0_RUN_ID:-manual}"
LIVE_BASE="${PC_P0_LIVE_BASE:-https://xn----8sbjf4befbjgs9b.xn--p1ai}"
EVIDENCE_DIR="${PC_P0_EVIDENCE_DIR:-artifacts/production-p0-first-customer}"
CURRENT_STAGE=bootstrap
BLOCKER_CODE=UNEXPECTED_P0_ACCEPTANCE_FAILURE
FINISHED=0
TMP_ROOT=''
REVIEWER_JAR=''
REVIEWER_USER_ID=''
REVIEWER_ASSIGNMENT_ID=''
REVIEWER_STAFF_SESSION_ID=''

declare -A EMAIL PASSWORD INN PHONE APP_ID APPROVAL_VERSION APPROVAL_CORRELATION
declare -A USER_ID ORG_ID TENANT_ID MEMBERSHIP_ID MEMBER_VERSION USER_ROLE MFA_SECRET
declare -A REGISTRATION_CORRELATION
declare -A AUDIT_ID OUTBOX_ID
DECISION_REPLAY_NOTIFICATION_SUPPRESSED=0

safe_failure_record() {
  mkdir -p "$EVIDENCE_DIR"
  P0_TARGET_SHA="$TARGET_SHA" \
  P0_RUN_ID="$RUN_ID" \
  P0_STAGE="$CURRENT_STAGE" \
  P0_BLOCKER="$BLOCKER_CODE" \
    python3 - "$EVIDENCE_DIR/result.json" <<'PY'
import json, os, sys
payload = {
    'schemaVersion': 'production.p0.first-customer.acceptance.v1',
    'passed': False,
    'targetSha': os.environ.get('P0_TARGET_SHA', 'unknown'),
    'runId': os.environ.get('P0_RUN_ID', 'unknown'),
    'stage': os.environ.get('P0_STAGE', 'unknown'),
    'blocker': os.environ.get('P0_BLOCKER', 'UNEXPECTED_P0_ACCEPTANCE_FAILURE'),
}
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2)
    handle.write('\n')
PY
  find "$EVIDENCE_DIR" -type f ! -name sha256.txt -print0 \
    | sort -z | xargs -0 -r sha256sum > "$EVIDENCE_DIR/sha256.txt"
}

cleanup() {
  local rc=$? csrf='' context_status=''
  set +e
  if [[ "$FINISHED" != 1 && -z "$REVIEWER_STAFF_SESSION_ID" && -n "$TMP_ROOT" \
    && -s "$TMP_ROOT/reviewer-access-activate-response.json" ]]; then
    REVIEWER_STAFF_SESSION_ID="$(python3 - "$TMP_ROOT/reviewer-access-activate-response.json" <<'PY'
import json, re, sys
try:
    value = json.load(open(sys.argv[1], encoding='utf-8')).get('accessSessionId', '')
except Exception:
    value = ''
if isinstance(value, str) and re.fullmatch(r'sas_[A-Za-z0-9-]+', value): print(value)
PY
)"
  fi
  if [[ "$FINISHED" != 1 && -z "$REVIEWER_STAFF_SESSION_ID" && -n "$TMP_ROOT" \
    && -s "$TMP_ROOT/reviewer.cookies" ]]; then
    context_status="$(curl --silent --show-error --connect-timeout 5 --max-time 12 \
      --output "$TMP_ROOT/reviewer-cleanup-context.json" --write-out '%{http_code}' \
      --cookie "$TMP_ROOT/reviewer.cookies" --cookie-jar "$TMP_ROOT/reviewer.cookies" \
      -H 'Accept: application/json' \
      "$LIVE_BASE/api/staff/session-context" 2>/dev/null)"
    if [[ "$context_status" == 200 ]]; then
      REVIEWER_STAFF_SESSION_ID="$(python3 - "$TMP_ROOT/reviewer-cleanup-context.json" <<'PY'
import json, re, sys
try:
    payload = json.load(open(sys.argv[1], encoding='utf-8'))
    value = payload.get('session', {}).get('accessSessionId', '') if payload.get('active') is True else ''
except Exception:
    value = ''
if isinstance(value, str) and re.fullmatch(r'sas_[A-Za-z0-9-]+', value): print(value)
PY
)"
    fi
  fi
  if [[ "$FINISHED" != 1 && -n "$REVIEWER_STAFF_SESSION_ID" && -n "$TMP_ROOT" \
    && -s "$TMP_ROOT/reviewer.cookies" ]]; then
    csrf="$(awk -F '\t' '$6 == "pc_csrf_token" { value=$7 } END { print value }' \
      "$TMP_ROOT/reviewer.cookies")"
    if [[ "$csrf" =~ ^[A-Za-z0-9_-]{24,128}$ ]]; then
      curl --silent --show-error --connect-timeout 5 --max-time 12 \
        --output /dev/null \
        --cookie "$TMP_ROOT/reviewer.cookies" \
        --cookie-jar "$TMP_ROOT/reviewer.cookies" \
        -X POST "$LIVE_BASE/api/staff/access/sessions/$REVIEWER_STAFF_SESSION_ID/end" \
        -H 'Accept: application/json' \
        -H 'Content-Type: application/json' \
        -H "Origin: $LIVE_BASE" \
        -H "x-csrf-token: $csrf" \
        -H "x-correlation-id: p0-reviewer-cleanup:${TARGET_SHA:0:12}:$RUN_ID" \
        --data '{"reason":"Production P0 acceptance cleanup"}' \
        >/dev/null 2>&1 || true
    fi
  fi
  if [[ "$FINISHED" != 1 ]]; then
    safe_failure_record || true
    printf 'P0_FIRST_CUSTOMER_ACCEPTANCE=FAIL\n'
    printf 'P0_ACCEPTANCE_STAGE=%s\n' "$CURRENT_STAGE"
    printf 'P0_BLOCKER=%s\n' "$BLOCKER_CODE"
  fi
  [[ -z "$TMP_ROOT" ]] || rm -rf "$TMP_ROOT"
  unset PC_P0_REVIEWER_PASSWORD PC_P0_REVIEWER_TOTP_SECRET PC_P0_IMAP_PASSWORD
  exit "$rc"
}
trap cleanup EXIT

fail() {
  BLOCKER_CODE="$1"
  exit "${2:-1}"
}

require_commands() {
  local command
  for command in gh curl python3 ssh awk sha256sum; do
    command -v "$command" >/dev/null 2>&1 || fail "MISSING_P0_COMMAND_${command^^}" 10
  done
}

assert_exact_main() {
  local actual
  actual="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null)" \
    || fail P0_EXACT_MAIN_LOOKUP_FAILED 11
  [[ "$actual" == "$TARGET_SHA" ]] || fail P0_MAIN_ADVANCED_DURING_ACCEPTANCE 12
}

http_request() {
  local output="$1" jar="$2"
  shift 2
  assert_exact_main
  curl \
    --silent \
    --show-error \
    --connect-timeout 10 \
    --max-time 30 \
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
  [[ "$token" =~ ^[A-Za-z0-9_-]{24,128}$ ]] || fail P0_CSRF_COOKIE_MISSING 13
  printf '%s' "$token"
}

prime_csrf() {
  local jar="$1" page="$TMP_ROOT/csrf-$RANDOM.html" status
  : > "$jar"
  chmod 0600 "$jar"
  status="$(http_request "$page" "$jar" "$LIVE_BASE/platform-v7/register?lang=ru&acceptance=$RUN_ID")"
  [[ "$status" == 200 ]] || fail P0_PUBLIC_CSRF_PRIME_FAILED 14
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
now = int(time.time())
remaining = 30 - (now % 30)
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
  local run="$1" slot="$2" identity="${1}-${2}"
  P0_EMAIL_IDENTITY="$identity" P0_EMAIL_RUN="$run" P0_EMAIL_SLOT="$slot" python3 <<'PY'
import os, re
template = os.environ['PC_P0_EMAIL_TEMPLATE'].strip()
identity = os.environ['P0_EMAIL_IDENTITY']
run = os.environ['P0_EMAIL_RUN']
slot = os.environ['P0_EMAIL_SLOT']
identity_format = template.count('{identity}') == 1 and '{run}' not in template and '{slot}' not in template
run_slot_format = template.count('{identity}') == 0 and template.count('{run}') == 1 and template.count('{slot}') == 1
if identity_format:
    email = template.replace('{identity}', identity).lower()
elif run_slot_format:
    email = template.replace('{run}', run).replace('{slot}', slot).lower()
else:
    raise SystemExit('EMAIL_TEMPLATE_PLACEHOLDER_INVALID')
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
import sys
import time
from email.headerregistry import Address
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

def assert_exact_main():
    try:
        result = subprocess.run(
            ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/commits/main", '--jq', '.sha'],
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except Exception:
        raise SystemExit(43)
    if result.returncode != 0:
        raise SystemExit(43)
    if result.stdout.strip() != os.environ['P0_TARGET_SHA']:
        raise SystemExit(42)

def message_text(message):
    parts = []
    if message.is_multipart():
        iterator = message.walk()
    else:
        iterator = (message,)
    for part in iterator:
        if part.get_content_type() not in ('text/plain', 'text/html'):
            continue
        try:
            parts.append(part.get_content())
        except Exception:
            payload = part.get_payload(decode=True) or b''
            parts.append(payload.decode(part.get_content_charset() or 'utf-8', errors='replace'))
    return '\n'.join(parts)

context = ssl.create_default_context()
while time.time() < deadline:
    assert_exact_main()
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
        identifiers = (data[0] or b'').split()[-250:]
        for identifier in reversed(identifiers):
            status, rows = client.fetch(identifier, '(BODY.PEEK[])')
            if status != 'OK':
                continue
            raw = next((item[1] for item in rows if isinstance(item, tuple) and len(item) > 1), None)
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
            body = message_text(message).replace('&amp;', '&')
            for candidate in url_pattern.findall(body):
                query = parse_qs(urlparse(candidate).query)
                token = unquote((query.get('verify') or [''])[0])
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
  [[ "$LIVE_BASE" == 'https://xn----8sbjf4befbjgs9b.xn--p1ai' ]] || fail P0_CANONICAL_LIVE_BASE_MISMATCH 22
  [[ -n "${GITHUB_REPOSITORY:-}" && -n "${GH_TOKEN:-}" ]] || fail P0_GITHUB_AUTHORITY_MISSING 23

  if [[ -z "${PC_P0_EMAIL_TEMPLATE:-}" \
    || -z "${PC_P0_IMAP_HOST:-}" \
    || -z "${PC_P0_IMAP_USER:-}" \
    || -z "${PC_P0_IMAP_PASSWORD:-}" ]]; then
    fail MISSING_P0_MAILBOX_PREREQUISITE 24
  fi
  if [[ "${PC_P0_EMAIL_TEMPLATE}" != *'{identity}'* \
    && ( "${PC_P0_EMAIL_TEMPLATE}" != *'{run}'* || "${PC_P0_EMAIL_TEMPLATE}" != *'{slot}'* ) ]]; then
    fail MISSING_P0_MAILBOX_PREREQUISITE 24
  fi
  [[ "${PC_P0_IMAP_PORT:-993}" =~ ^[0-9]+$ ]] || fail MISSING_P0_MAILBOX_PREREQUISITE 24

  if [[ -z "${PC_P0_REVIEWER_EMAIL:-}" \
    || -z "${PC_P0_REVIEWER_PASSWORD:-}" \
    || -z "${PC_P0_REVIEWER_TOTP_SECRET:-}" ]]; then
    fail MISSING_P0_REVIEWER_PREREQUISITE 25
  fi

  if [[ "${PC_P0_SSH_HOST:-}" != 195.19.12.120 \
    || ! "${PC_P0_SSH_USER:-}" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ \
    || ! "${PC_P0_SSH_PORT:-}" =~ ^[0-9]+$ \
    || ! -f "${PC_P0_SSH_KEY_PATH:-/nonexistent}" \
    || ! -f "${PC_P0_SSH_KNOWN_HOSTS:-/nonexistent}" ]]; then
    fail MISSING_P0_SSH_PREREQUISITE 26
  fi
  assert_exact_main
}

make_registration_body() {
  local output="$1" label="$2" workspace="$3" inn="$4" phone="$5"
  P0_EMAIL="${EMAIL[$label]}" \
  P0_PASSWORD="${PASSWORD[$label]}" \
  P0_WORKSPACE="$workspace" \
  P0_INN="$inn" \
  P0_PHONE="$phone" \
  P0_LABEL="$label" \
    python3 - "$output" <<'PY'
import json, os, sys
label = os.environ['P0_LABEL']
payload = {
    'email': os.environ['P0_EMAIL'],
    'phone': os.environ['P0_PHONE'],
    'fullName': f'Production P0 Customer {label.upper()}',
    'position': 'Acceptance operator',
    'orgLegalName': f'Production P0 exact-run organization {label.upper()}',
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

register_identity() {
  local label="$1" workspace="$2"
  local jar="$TMP_ROOT/$label.cookies" request="$TMP_ROOT/$label-register.json"
  local response="$TMP_ROOT/$label-register-response.json" verify_request="$TMP_ROOT/$label-verify.json"
  local verify_response="$TMP_ROOT/$label-verify-response.json"
  local verify_replay_response="$TMP_ROOT/$label-verify-replay-response.json"
  local status csrf idempotency correlation not_before token result inn phone mail_rc

  CURRENT_STAGE="registration-$label"
  EMAIL[$label]="$(render_email "${RUN_ID}-${TARGET_SHA:0:7}" "$label")" \
    || fail MISSING_P0_MAILBOX_PREREQUISITE 30
  PASSWORD[$label]="$(python3 - <<'PY'
import secrets
print('Aa1!' + secrets.token_urlsafe(30))
PY
)"
  inn="$(P0_SEED="$TARGET_SHA:$RUN_ID:$label" python3 - <<'PY'
import hashlib, os
digits = str(int(hashlib.sha256(os.environ['P0_SEED'].encode()).hexdigest(), 16))
print('77' + digits[:10])
PY
)"
  phone="+7495$(P0_SEED="$RUN_ID:$label" python3 - <<'PY'
import hashlib, os
value = int(hashlib.sha256(os.environ['P0_SEED'].encode()).hexdigest(), 16) % 10_000_000
print(f'{value:07d}')
PY
)"
  INN[$label]="$inn"
  PHONE[$label]="$phone"

  prime_csrf "$jar"
  csrf="$(csrf_token "$jar")"
  make_registration_body "$request" "$label" "$workspace" "$inn" "$phone"
  idempotency="p0-registration:$TARGET_SHA:$RUN_ID:$label"
  correlation="p0-registration:${TARGET_SHA:0:12}:$RUN_ID:$label"
  not_before="$(date +%s)"
  status="$(http_request "$response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/register" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "Idempotency-Key: $idempotency" \
    -H "x-correlation-id: $correlation" \
    --data-binary "@$request")"
  [[ "$status" == 202 ]] || fail "P0_REGISTRATION_${label^^}_FAILED" 31
  result="$(python3 - "$response" <<'PY'
import json, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('accepted') is not True: raise SystemExit(1)
if payload.get('status') != 'EMAIL_VERIFICATION_REQUIRED': raise SystemExit(1)
if payload.get('nextAction') != 'VERIFY_EMAIL': raise SystemExit(1)
for forbidden in ('applicationId', 'statusToken', 'emailDelivery', 'token', 'password', 'setupSecret'):
    if forbidden in payload: raise SystemExit(1)
correlation = payload.get('correlationId')
if not isinstance(correlation, str) or not correlation: raise SystemExit(1)
print(correlation)
PY
)" || fail "P0_REGISTRATION_${label^^}_CONTRACT_INVALID" 32
  REGISTRATION_CORRELATION[$label]="$result"
  rm -f "$request" "$response"

  CURRENT_STAGE="mailbox-verification-$label"
  set +e
  token="$(fetch_verification_token "${EMAIL[$label]}" "$not_before")"
  mail_rc=$?
  set -e
  case "$mail_rc" in
    0) ;;
    42) fail P0_MAIN_ADVANCED_DURING_ACCEPTANCE 12 ;;
    43) fail P0_EXACT_MAIN_LOOKUP_FAILED 11 ;;
    *) fail "P0_VERIFICATION_EMAIL_${label^^}_UNAVAILABLE" 33 ;;
  esac
  P0_VERIFY_TOKEN="$token" python3 - "$verify_request" <<'PY'
import json, os, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({'token': os.environ['P0_VERIFY_TOKEN'], 'locale': 'ru'}, handle, separators=(',', ':'))
PY
  chmod 0600 "$verify_request"
  csrf="$(csrf_token "$jar")"
  correlation="p0-email-verify:${TARGET_SHA:0:12}:$RUN_ID:$label"
  status="$(http_request "$verify_response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/registration/verify" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: $correlation" \
    --data-binary "@$verify_request")"
  [[ "$status" == 200 ]] || fail "P0_EMAIL_VERIFICATION_${label^^}_FAILED" 34
  result="$(python3 - "$verify_response" <<'PY'
import json, re, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('ok') is not True: raise SystemExit(1)
if payload.get('status') != 'ORGANIZATION_VERIFICATION_PENDING': raise SystemExit(1)
if payload.get('nextAction') != 'WAIT_FOR_REVIEW': raise SystemExit(1)
application = payload.get('applicationId')
if not isinstance(application, str) or not re.fullmatch(r'reg_[A-Za-z0-9-]+', application): raise SystemExit(1)
print(application)
PY
)" || fail "P0_EMAIL_VERIFICATION_${label^^}_CONTRACT_INVALID" 35
  APP_ID[$label]="$result"
  rm -f "$verify_response"

  CURRENT_STAGE="mailbox-verification-replay-$label"
  csrf="$(csrf_token "$jar")"
  status="$(http_request "$verify_replay_response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/registration/verify" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-email-verify-replay:${TARGET_SHA:0:12}:$RUN_ID:$label" \
    --data-binary "@$verify_request")"
  unset token P0_VERIFY_TOKEN
  rm -f "$verify_request"
  [[ "$status" == 400 ]] || fail "P0_EMAIL_VERIFICATION_${label^^}_REPLAY_NOT_REJECTED" 36
  python3 - "$verify_replay_response" <<'PY' \
    || fail "P0_EMAIL_VERIFICATION_${label^^}_REPLAY_CONTRACT_INVALID" 37
import json, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('ok') is not False or payload.get('code') != 'REGISTRATION_EMAIL_TOKEN_INVALID':
    raise SystemExit(1)
PY
  rm -f "$verify_replay_response"
}

reviewer_login() {
  local jar="$TMP_ROOT/reviewer.cookies" login_request="$TMP_ROOT/reviewer-login.json"
  local login_response="$TMP_ROOT/reviewer-login-response.json" mfa_request="$TMP_ROOT/reviewer-mfa.json"
  local mfa_response="$TMP_ROOT/reviewer-mfa-response.json" me_response="$TMP_ROOT/reviewer-me.json"
  local assignments_response="$TMP_ROOT/reviewer-assignments.json"
  local membership_request="$TMP_ROOT/reviewer-membership.json"
  local membership_response="$TMP_ROOT/reviewer-membership-response.json"
  local status csrf code reviewer_id login_next membership_id

  CURRENT_STAGE=reviewer-login
  prime_csrf "$jar"
  P0_LOGIN_EMAIL="$PC_P0_REVIEWER_EMAIL" \
  P0_LOGIN_PASSWORD="$PC_P0_REVIEWER_PASSWORD" \
    python3 - "$login_request" <<'PY'
import json, os, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({'email': os.environ['P0_LOGIN_EMAIL'], 'password': os.environ['P0_LOGIN_PASSWORD']}, handle, separators=(',', ':'))
PY
  chmod 0600 "$login_request"
  csrf="$(csrf_token "$jar")"
  status="$(http_request "$login_response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-reviewer-login:${TARGET_SHA:0:12}:$RUN_ID" \
    --data-binary "@$login_request")"
  rm -f "$login_request"
  [[ "$status" == 200 ]] || fail P0_REVIEWER_LOGIN_FAILED 40

  login_next="$(python3 - "$login_response" <<'PY'
import json, re, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('ok') is not True: raise SystemExit(1)
if payload.get('mfaRequired') is True and payload.get('membershipSelectionRequired') is not True:
    print('DIRECT')
    raise SystemExit(0)
if payload.get('membershipSelectionRequired') is not True: raise SystemExit(1)
memberships = payload.get('memberships')
if not isinstance(memberships, list) or not 2 <= len(memberships) <= 50: raise SystemExit(1)
valid = [row for row in memberships if isinstance(row, dict) and isinstance(row.get('membershipId'), str)]
valid = [row for row in valid if re.fullmatch(r'[A-Za-z0-9_-]{8,160}', row['membershipId'])]
if len(valid) != len(memberships): raise SystemExit(1)
valid.sort(key=lambda row: row.get('isOrgAdmin') is not True)
print('MEMBERSHIP:' + valid[0]['membershipId'])
PY
)" || fail P0_REVIEWER_LOGIN_CONTRACT_INVALID 41
  if [[ "$login_next" == MEMBERSHIP:* ]]; then
    CURRENT_STAGE=reviewer-membership-selection
    membership_id="${login_next#MEMBERSHIP:}"
    P0_MEMBERSHIP_ID="$membership_id" python3 - "$membership_request" <<'PY'
import json, os, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({'membershipId': os.environ['P0_MEMBERSHIP_ID']}, handle, separators=(',', ':'))
PY
    chmod 0600 "$membership_request"
    csrf="$(csrf_token "$jar")"
    status="$(http_request "$membership_response" "$jar" \
      -X POST "$LIVE_BASE/api/auth/membership-select" \
      -H 'Content-Type: application/json' \
      -H "Origin: $LIVE_BASE" \
      -H "x-csrf-token: $csrf" \
      -H "x-correlation-id: p0-reviewer-membership:${TARGET_SHA:0:12}:$RUN_ID" \
      --data-binary "@$membership_request")"
    rm -f "$membership_request"
    [[ "$status" == 200 ]] || fail P0_REVIEWER_MEMBERSHIP_SELECTION_FAILED 41
    mv "$membership_response" "$login_response"
  elif [[ "$login_next" != DIRECT ]]; then
    fail P0_REVIEWER_LOGIN_CONTRACT_INVALID 41
  fi
  python3 - "$login_response" <<'PY' || fail P0_REVIEWER_MFA_PREREQUISITE_INVALID 41
import json, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('ok') is not True or payload.get('mfaRequired') is not True: raise SystemExit(1)
if payload.get('enrollmentRequired') is not False: raise SystemExit(1)
if payload.get('setupSecret') not in (None, ''): raise SystemExit(1)
if payload.get('otpAuthUri') not in (None, ''): raise SystemExit(1)
PY
  rm -f "$login_response"

  code="$(totp "$PC_P0_REVIEWER_TOTP_SECRET")" || fail P0_REVIEWER_TOTP_SECRET_INVALID 42
  P0_MFA_CODE="$code" python3 - "$mfa_request" <<'PY'
import json, os, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({'code': os.environ['P0_MFA_CODE']}, handle, separators=(',', ':'))
PY
  unset code P0_MFA_CODE
  chmod 0600 "$mfa_request"
  csrf="$(csrf_token "$jar")"
  status="$(http_request "$mfa_response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/mfa-login" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-reviewer-mfa:${TARGET_SHA:0:12}:$RUN_ID" \
    --data-binary "@$mfa_request")"
  rm -f "$mfa_request"
  [[ "$status" == 200 ]] || fail P0_REVIEWER_MFA_FAILED 43
  python3 - "$mfa_response" <<'PY' || fail P0_REVIEWER_MFA_RESPONSE_INVALID 44
import json, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('ok') is not True: raise SystemExit(1)
if not isinstance(payload.get('redirectTo'), str) or not payload['redirectTo'].startswith('/platform-v7/'): raise SystemExit(1)
if payload.get('backupCodes') not in (None, []): raise SystemExit(1)
PY
  rm -f "$mfa_response"

  CURRENT_STAGE=reviewer-authority
  status="$(http_request "$me_response" "$jar" \
    "$LIVE_BASE/api/auth/me" \
    -H "x-correlation-id: p0-reviewer-me:${TARGET_SHA:0:12}:$RUN_ID")"
  [[ "$status" == 200 ]] || fail P0_REVIEWER_SESSION_MISSING 45
  reviewer_id="$(python3 - "$me_response" <<'PY'
import datetime, json, re, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('authenticated') is not True: raise SystemExit(1)
user_id = payload.get('id')
if not isinstance(user_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,160}', user_id): raise SystemExit(1)
verified = payload.get('mfaVerifiedAt')
if not isinstance(verified, str): raise SystemExit(1)
stamp = datetime.datetime.fromisoformat(verified.replace('Z', '+00:00'))
age = (datetime.datetime.now(datetime.timezone.utc) - stamp).total_seconds()
if age < -30 or age > 900: raise SystemExit(1)
print(user_id)
PY
)" || fail P0_REVIEWER_SESSION_NOT_RECENT_MFA 46
  REVIEWER_USER_ID="$reviewer_id"
  rm -f "$me_response"

  status="$(http_request "$assignments_response" "$jar" \
    "$LIVE_BASE/api/staff/assignments/me" \
    -H "x-correlation-id: p0-reviewer-assignments:${TARGET_SHA:0:12}:$RUN_ID")"
  [[ "$status" == 200 ]] || fail P0_REVIEWER_ASSIGNMENT_UNAVAILABLE 47
  REVIEWER_ASSIGNMENT_ID="$(python3 - "$assignments_response" <<'PY'
import json, re, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if not isinstance(payload, list): raise SystemExit(1)
active = [row for row in payload if isinstance(row, dict)
          and row.get('status') in {'ELIGIBLE', 'ACTIVE'}
          and row.get('role') == 'PLATFORM_OWNER'
          and isinstance(row.get('id'), str)
          and re.fullmatch(r'[A-Za-z0-9_-]{8,160}', row['id'])]
if len(active) < 1: raise SystemExit(1)
print(active[0]['id'])
PY
)" || fail P0_REVIEWER_PLATFORM_OWNER_ASSIGNMENT_MISSING 48
  rm -f "$assignments_response"
  REVIEWER_JAR="$jar"
}

activate_reviewer_control_plane() {
  local request="$TMP_ROOT/reviewer-access-request.json"
  local response="$TMP_ROOT/reviewer-access-request-response.json"
  local activate_response="$TMP_ROOT/reviewer-access-activate-response.json"
  local context_response="$TMP_ROOT/reviewer-access-context.json"
  local status csrf grant_id session_id

  CURRENT_STAGE=reviewer-control-plane-request
  P0_ASSIGNMENT_ID="$REVIEWER_ASSIGNMENT_ID" P0_TICKET_ID="P0-$RUN_ID" \
    python3 - "$request" <<'PY'
import json, os, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({
        'assignmentId': os.environ['P0_ASSIGNMENT_ID'],
        'accessMode': 'CONTROL_PLANE',
        'permissions': ['staff-request:read', 'staff-request:approve'],
        'reason': 'Production P0 first-customer registration acceptance',
        'ticketId': os.environ['P0_TICKET_ID'],
        'durationSeconds': 1800,
    }, handle, separators=(',', ':'))
PY
  chmod 0600 "$request"
  csrf="$(csrf_token "$REVIEWER_JAR")"
  status="$(http_request "$response" "$REVIEWER_JAR" \
    -X POST "$LIVE_BASE/api/staff/access/requests" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-reviewer-access-request:${TARGET_SHA:0:12}:$RUN_ID" \
    --data-binary "@$request")"
  rm -f "$request"
  [[ "$status" == 201 ]] || fail P0_REVIEWER_CONTROL_PLANE_REQUEST_FAILED 49
  grant_id="$(python3 - "$response" <<'PY'
import json, re, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('status') != 'GRANTED': raise SystemExit(1)
request_id = payload.get('requestId')
grant_id = payload.get('grantId')
if not isinstance(request_id, str) or not re.fullmatch(r'sar_[A-Za-z0-9-]+', request_id): raise SystemExit(1)
if not isinstance(grant_id, str) or not re.fullmatch(r'sag_[A-Za-z0-9-]+', grant_id): raise SystemExit(1)
print(grant_id)
PY
)" || fail P0_REVIEWER_CONTROL_PLANE_GRANT_MISSING 49
  rm -f "$response"

  CURRENT_STAGE=reviewer-control-plane-activation
  csrf="$(csrf_token "$REVIEWER_JAR")"
  status="$(http_request "$activate_response" "$REVIEWER_JAR" \
    -X POST "$LIVE_BASE/api/staff/access/grants/$grant_id/activate" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-reviewer-access-activate:${TARGET_SHA:0:12}:$RUN_ID" \
    --data '{}')"
  [[ "$status" == 201 ]] || fail P0_REVIEWER_CONTROL_PLANE_ACTIVATION_FAILED 49
  session_id="$(python3 - "$activate_response" <<'PY'
import datetime, json, re, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
session_id = payload.get('accessSessionId')
if not isinstance(session_id, str) or not re.fullmatch(r'sas_[A-Za-z0-9-]+', session_id): raise SystemExit(1)
if payload.get('staffRole') != 'PLATFORM_OWNER' or payload.get('accessMode') != 'CONTROL_PLANE': raise SystemExit(1)
if set(payload.get('permissions') or []) != {'staff-request:read', 'staff-request:approve'}: raise SystemExit(1)
expires = payload.get('expiresAt')
if not isinstance(expires, str): raise SystemExit(1)
expiry = datetime.datetime.fromisoformat(expires.replace('Z', '+00:00'))
remaining = (expiry - datetime.datetime.now(datetime.timezone.utc)).total_seconds()
if remaining < 120 or remaining > 1860: raise SystemExit(1)
print(session_id)
PY
)" || fail P0_REVIEWER_CONTROL_PLANE_ACTIVATION_INVALID 49
  rm -f "$activate_response"
  REVIEWER_STAFF_SESSION_ID="$session_id"

  CURRENT_STAGE=reviewer-control-plane-verification
  status="$(http_request "$context_response" "$REVIEWER_JAR" \
    "$LIVE_BASE/api/staff/session-context" \
    -H "x-correlation-id: p0-reviewer-access-context:${TARGET_SHA:0:12}:$RUN_ID")"
  [[ "$status" == 200 ]] || fail P0_REVIEWER_CONTROL_PLANE_CONTEXT_FAILED 49
  P0_STAFF_SESSION_ID="$REVIEWER_STAFF_SESSION_ID" \
    python3 - "$context_response" <<'PY' || fail P0_REVIEWER_CONTROL_PLANE_CONTEXT_INVALID 49
import json, os, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
session = payload.get('session')
if payload.get('active') is not True or not isinstance(session, dict): raise SystemExit(1)
if session.get('accessSessionId') != os.environ['P0_STAFF_SESSION_ID']: raise SystemExit(1)
if session.get('staffRole') != 'PLATFORM_OWNER' or session.get('accessMode') != 'CONTROL_PLANE': raise SystemExit(1)
if set(session.get('permissions') or []) != {'staff-request:read', 'staff-request:approve'}: raise SystemExit(1)
PY
  rm -f "$context_response"
}

end_reviewer_control_plane() {
  local request="$TMP_ROOT/reviewer-access-end.json"
  local response="$TMP_ROOT/reviewer-access-end-response.json"
  local status csrf
  [[ -n "$REVIEWER_STAFF_SESSION_ID" ]] || fail P0_REVIEWER_CONTROL_PLANE_SESSION_MISSING 49
  CURRENT_STAGE=reviewer-control-plane-end
  printf '%s' '{"reason":"Production P0 first-customer acceptance completed"}' > "$request"
  chmod 0600 "$request"
  csrf="$(csrf_token "$REVIEWER_JAR")"
  status="$(http_request "$response" "$REVIEWER_JAR" \
    -X POST "$LIVE_BASE/api/staff/access/sessions/$REVIEWER_STAFF_SESSION_ID/end" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-reviewer-access-end:${TARGET_SHA:0:12}:$RUN_ID" \
    --data-binary "@$request")"
  rm -f "$request"
  [[ "$status" == 201 ]] || fail P0_REVIEWER_CONTROL_PLANE_END_FAILED 49
  P0_STAFF_SESSION_ID="$REVIEWER_STAFF_SESSION_ID" \
    python3 - "$response" <<'PY' || fail P0_REVIEWER_CONTROL_PLANE_END_INVALID 49
import json, os, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('success') is not True or payload.get('sessionId') != os.environ['P0_STAFF_SESSION_ID']:
    raise SystemExit(1)
PY
  rm -f "$response"
  REVIEWER_STAFF_SESSION_ID=''
}

approve_registrations() {
  local queue_response="$TMP_ROOT/reviewer-queue.json" decision_request decision_response decision_replay_response
  local status csrf label correlation idempotency result replay_correlation

  CURRENT_STAGE=reviewer-queue
  status="$(http_request "$queue_response" "$REVIEWER_JAR" \
    "$LIVE_BASE/api/staff/registration/applications" \
    -H "x-correlation-id: p0-reviewer-queue:${TARGET_SHA:0:12}:$RUN_ID")"
  [[ "$status" == 200 ]] || fail P0_REVIEWER_QUEUE_FAILED 50
  P0_APP_A="${APP_ID[a]}" P0_APP_B="${APP_ID[b]}" \
    python3 - "$queue_response" <<'PY' || fail P0_REGISTRATIONS_NOT_IN_REVIEW_QUEUE 51
import json, os, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
items = payload.get('applications')
if not isinstance(items, list): raise SystemExit(1)
by_id = {item.get('applicationId'): item for item in items if isinstance(item, dict)}
for app_id in (os.environ['P0_APP_A'], os.environ['P0_APP_B']):
    item = by_id.get(app_id)
    if not item or item.get('status') != 'ORGANIZATION_VERIFICATION_PENDING': raise SystemExit(1)
    if item.get('kind') != 'NEW_ORGANIZATION': raise SystemExit(1)
    if item.get('checks', {}).get('emailVerified') is not True: raise SystemExit(1)
    if item.get('riskFlags') not in ([], None): raise SystemExit(1)
PY
  rm -f "$queue_response"

  for label in a b; do
    CURRENT_STAGE="reviewer-approval-$label"
    decision_request="$TMP_ROOT/$label-decision.json"
    decision_response="$TMP_ROOT/$label-decision-response.json"
    python3 - "$decision_request" <<'PY'
import json, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({
        'decision': 'APPROVE',
        'reason': 'Production P0 first-customer exact-run acceptance',
        'locale': 'ru',
    }, handle, separators=(',', ':'))
PY
    chmod 0600 "$decision_request"
    csrf="$(csrf_token "$REVIEWER_JAR")"
    correlation="p0-registration-approve:${TARGET_SHA:0:12}:$RUN_ID:$label"
    idempotency="p0-registration-approve:$TARGET_SHA:$RUN_ID:$label"
    status="$(http_request "$decision_response" "$REVIEWER_JAR" \
      -X POST "$LIVE_BASE/api/staff/registration/applications/${APP_ID[$label]}/decision" \
      -H 'Content-Type: application/json' \
      -H "Origin: $LIVE_BASE" \
      -H "x-csrf-token: $csrf" \
      -H "Idempotency-Key: $idempotency" \
      -H "x-correlation-id: $correlation" \
      --data-binary "@$decision_request")"
    [[ "$status" == 201 ]] || fail "P0_REVIEWER_APPROVAL_${label^^}_FAILED" 52
    result="$(P0_EXPECTED_APP="${APP_ID[$label]}" P0_EXPECTED_CORRELATION="$correlation" \
      python3 - "$decision_response" <<'PY'
import json, os, re, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('applicationId') != os.environ['P0_EXPECTED_APP']: raise SystemExit(1)
if payload.get('status') != 'ACTIVATED' or payload.get('nextAction') != 'LOGIN': raise SystemExit(1)
if payload.get('notificationDelivered') is not True: raise SystemExit(1)
if payload.get('replayed') is not False: raise SystemExit(1)
if payload.get('correlationId') != os.environ['P0_EXPECTED_CORRELATION']: raise SystemExit(1)
version = str(payload.get('version', ''))
if not re.fullmatch(r'[1-9][0-9]*', version): raise SystemExit(1)
print(version + '\t' + payload['correlationId'])
PY
)" || fail "P0_REVIEWER_APPROVAL_${label^^}_CONTRACT_INVALID" 53
    local approval_version approval_correlation
    IFS=$'\t' read -r approval_version approval_correlation <<< "$result"
    APPROVAL_VERSION[$label]="$approval_version"
    APPROVAL_CORRELATION[$label]="$approval_correlation"
    if [[ "$label" == a ]]; then
      CURRENT_STAGE="reviewer-approval-replay-$label"
      decision_replay_response="$TMP_ROOT/$label-decision-replay-response.json"
      replay_correlation="p0-registration-approve-replay:${TARGET_SHA:0:12}:$RUN_ID:$label"
      status="$(http_request "$decision_replay_response" "$REVIEWER_JAR" \
        -X POST "$LIVE_BASE/api/staff/registration/applications/${APP_ID[$label]}/decision" \
        -H 'Content-Type: application/json' \
        -H "Origin: $LIVE_BASE" \
        -H "x-csrf-token: $csrf" \
        -H "Idempotency-Key: $idempotency" \
        -H "x-correlation-id: $replay_correlation" \
        --data-binary "@$decision_request")"
      [[ "$status" == 201 ]] || fail P0_DECISION_REPLAY_REQUEST_FAILED 54
      P0_EXPECTED_APP="${APP_ID[$label]}" \
      P0_EXPECTED_CORRELATION="$replay_correlation" \
      P0_EXPECTED_VERSION="$approval_version" \
        python3 - "$decision_replay_response" <<'PY' \
        || fail P0_DECISION_REPLAY_NOTIFICATION_NOT_SUPPRESSED 55
import json, os, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('applicationId') != os.environ['P0_EXPECTED_APP']: raise SystemExit(1)
if payload.get('status') != 'ACTIVATED' or payload.get('nextAction') != 'LOGIN': raise SystemExit(1)
if payload.get('replayed') is not True: raise SystemExit(1)
if 'notificationDelivered' in payload: raise SystemExit(1)
if payload.get('correlationId') != os.environ['P0_EXPECTED_CORRELATION']: raise SystemExit(1)
if str(payload.get('version', '')) != os.environ['P0_EXPECTED_VERSION']: raise SystemExit(1)
PY
      DECISION_REPLAY_NOTIFICATION_SUPPRESSED=1
      rm -f "$decision_replay_response"
    fi
    rm -f "$decision_request" "$decision_response"
  done
  (( DECISION_REPLAY_NOTIFICATION_SUPPRESSED == 1 )) \
    || fail P0_DECISION_REPLAY_NOTIFICATION_NOT_PROVED 56
}

customer_login() {
  local label="$1" mode="$2"
  local jar="$TMP_ROOT/$label.cookies" login_request="$TMP_ROOT/$label-login-$mode.json"
  local login_response="$TMP_ROOT/$label-login-$mode-response.json" mfa_request="$TMP_ROOT/$label-mfa-$mode.json"
  local mfa_response="$TMP_ROOT/$label-mfa-$mode-response.json" me_response="$TMP_ROOT/$label-me-$mode.json"
  local status csrf code secret result expected_role

  CURRENT_STAGE="customer-$label-login-$mode"
  csrf="$(csrf_token "$jar")"
  P0_LOGIN_EMAIL="${EMAIL[$label]}" P0_LOGIN_PASSWORD="${PASSWORD[$label]}" \
    python3 - "$login_request" <<'PY'
import json, os, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({'email': os.environ['P0_LOGIN_EMAIL'], 'password': os.environ['P0_LOGIN_PASSWORD']}, handle, separators=(',', ':'))
PY
  chmod 0600 "$login_request"
  status="$(http_request "$login_response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-customer-login:${TARGET_SHA:0:12}:$RUN_ID:$label:$mode" \
    --data-binary "@$login_request")"
  rm -f "$login_request"
  [[ "$status" == 200 ]] || fail "P0_CUSTOMER_${label^^}_${mode^^}_LOGIN_FAILED" 60
  if [[ "$mode" == initial ]]; then
    secret="$(python3 - "$login_response" <<'PY'
import json, re, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('ok') is not True or payload.get('mfaRequired') is not True: raise SystemExit(1)
if payload.get('enrollmentRequired') is not True: raise SystemExit(1)
secret = payload.get('setupSecret')
if not isinstance(secret, str) or not re.fullmatch(r'[A-Z2-7]{16,128}', secret): raise SystemExit(1)
if not isinstance(payload.get('otpAuthUri'), str) or not payload['otpAuthUri'].startswith('otpauth://totp/'): raise SystemExit(1)
print(secret)
PY
)" || fail "P0_CUSTOMER_${label^^}_MFA_ENROLLMENT_MISSING" 61
    MFA_SECRET[$label]="$secret"
  else
    python3 - "$login_response" <<'PY' || fail "P0_CUSTOMER_${label^^}_FRESH_MFA_CHALLENGE_INVALID" 62
import json, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('ok') is not True or payload.get('mfaRequired') is not True: raise SystemExit(1)
if payload.get('enrollmentRequired') is not False: raise SystemExit(1)
if payload.get('setupSecret') not in (None, ''): raise SystemExit(1)
PY
  fi
  rm -f "$login_response"

  code="$(totp "${MFA_SECRET[$label]}")" || fail "P0_CUSTOMER_${label^^}_TOTP_INVALID" 63
  P0_MFA_CODE="$code" python3 - "$mfa_request" <<'PY'
import json, os, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({'code': os.environ['P0_MFA_CODE']}, handle, separators=(',', ':'))
PY
  unset code P0_MFA_CODE secret
  chmod 0600 "$mfa_request"
  csrf="$(csrf_token "$jar")"
  status="$(http_request "$mfa_response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/mfa-login" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-customer-mfa:${TARGET_SHA:0:12}:$RUN_ID:$label:$mode" \
    --data-binary "@$mfa_request")"
  rm -f "$mfa_request"
  [[ "$status" == 200 ]] || fail "P0_CUSTOMER_${label^^}_${mode^^}_MFA_FAILED" 64
  P0_LOGIN_MODE="$mode" python3 - "$mfa_response" <<'PY' || fail "P0_CUSTOMER_${label^^}_${mode^^}_MFA_RESPONSE_INVALID" 65
import json, os, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('ok') is not True: raise SystemExit(1)
if not isinstance(payload.get('redirectTo'), str) or not payload['redirectTo'].startswith('/platform-v7/'): raise SystemExit(1)
backup = payload.get('backupCodes')
if os.environ['P0_LOGIN_MODE'] == 'initial':
    if not isinstance(backup, list) or len(backup) < 1: raise SystemExit(1)
else:
    if backup not in (None, []): raise SystemExit(1)
PY
  rm -f "$mfa_response"

  CURRENT_STAGE="customer-$label-session-$mode"
  status="$(http_request "$me_response" "$jar" \
    "$LIVE_BASE/api/auth/me" \
    -H "x-correlation-id: p0-customer-me:${TARGET_SHA:0:12}:$RUN_ID:$label:$mode")"
  [[ "$status" == 200 ]] || fail "P0_CUSTOMER_${label^^}_${mode^^}_SESSION_FAILED" 66
  expected_role=FARMER
  [[ "$label" == a ]] || expected_role=BUYER
  result="$(P0_EXPECTED_EMAIL="${EMAIL[$label]}" P0_EXPECTED_ROLE="$expected_role" \
    python3 - "$me_response" <<'PY'
import datetime, json, os, re, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('authenticated') is not True: raise SystemExit(1)
if str(payload.get('email', '')).lower() != os.environ['P0_EXPECTED_EMAIL'].lower(): raise SystemExit(1)
if payload.get('role') != os.environ['P0_EXPECTED_ROLE']: raise SystemExit(1)
if payload.get('isOrgAdmin') is not True: raise SystemExit(1)
fields = [payload.get(name) for name in ('id', 'orgId', 'tenantId', 'membershipId')]
if any(not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,180}', value) for value in fields): raise SystemExit(1)
verified = payload.get('mfaVerifiedAt')
if not isinstance(verified, str): raise SystemExit(1)
stamp = datetime.datetime.fromisoformat(verified.replace('Z', '+00:00'))
age = (datetime.datetime.now(datetime.timezone.utc) - stamp).total_seconds()
if age < -30 or age > 900: raise SystemExit(1)
print('\t'.join(fields + [payload['role']]))
PY
)" || fail "P0_CUSTOMER_${label^^}_${mode^^}_SESSION_CONTRACT_INVALID" 67
  if [[ "$mode" == initial ]]; then
    IFS=$'\t' read -r USER_ID[$label] ORG_ID[$label] TENANT_ID[$label] MEMBERSHIP_ID[$label] USER_ROLE[$label] <<< "$result"
  else
    local relogin_user relogin_org relogin_tenant relogin_membership relogin_role
    IFS=$'\t' read -r relogin_user relogin_org relogin_tenant relogin_membership relogin_role <<< "$result"
    [[ "$relogin_user" == "${USER_ID[$label]}" \
      && "$relogin_org" == "${ORG_ID[$label]}" \
      && "$relogin_tenant" == "${TENANT_ID[$label]}" \
      && "$relogin_membership" == "${MEMBERSHIP_ID[$label]}" \
      && "$relogin_role" == "${USER_ROLE[$label]}" ]] \
      || fail "P0_CUSTOMER_${label^^}_RELOGIN_CONTEXT_CHANGED" 68
  fi
  rm -f "$me_response"
}

read_customer_resource() {
  local label="$1" jar="$TMP_ROOT/$label.cookies" response="$TMP_ROOT/$label-team.json"
  local status result
  CURRENT_STAGE="customer-$label-permitted-action"
  status="$(http_request "$response" "$jar" \
    "$LIVE_BASE/api/proxy/auth/organization-team" \
    -H "x-correlation-id: p0-team-read:${TARGET_SHA:0:12}:$RUN_ID:$label")"
  [[ "$status" == 200 ]] || fail "P0_CUSTOMER_${label^^}_PERMITTED_ACTION_FAILED" 70
  result="$(P0_EXPECTED_ORG="${ORG_ID[$label]}" \
    P0_EXPECTED_TENANT="${TENANT_ID[$label]}" \
    P0_EXPECTED_MEMBERSHIP="${MEMBERSHIP_ID[$label]}" \
    P0_EXPECTED_USER="${USER_ID[$label]}" \
    python3 - "$response" <<'PY'
import json, os, re, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('organizationId') != os.environ['P0_EXPECTED_ORG']: raise SystemExit(1)
if payload.get('tenantId') != os.environ['P0_EXPECTED_TENANT']: raise SystemExit(1)
if payload.get('currentMembershipId') != os.environ['P0_EXPECTED_MEMBERSHIP']: raise SystemExit(1)
if payload.get('hasFreshMfa') is not True or payload.get('isOrganizationAdmin') is not True: raise SystemExit(1)
members = payload.get('members')
if not isinstance(members, list): raise SystemExit(1)
current = [row for row in members if isinstance(row, dict) and row.get('membershipId') == os.environ['P0_EXPECTED_MEMBERSHIP']]
if len(current) != 1 or current[0].get('userId') != os.environ['P0_EXPECTED_USER']: raise SystemExit(1)
version = str(current[0].get('version', ''))
if not re.fullmatch(r'[0-9]+', version): raise SystemExit(1)
print(version)
PY
)" || fail "P0_CUSTOMER_${label^^}_PERMITTED_ACTION_CONTRACT_INVALID" 71
  MEMBER_VERSION[$label]="$result"
  rm -f "$response"
}

prove_bff_tenant_denial() {
  local jar="$TMP_ROOT/b.cookies" request="$TMP_ROOT/cross-tenant-request.json"
  local response="$TMP_ROOT/cross-tenant-response.json" me_response="$TMP_ROOT/b-after-denial.json"
  local status csrf
  CURRENT_STAGE=cross-tenant-bff-denial
  P0_VERSION="${MEMBER_VERSION[a]}" python3 - "$request" <<'PY'
import json, os, sys
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump({
        'role': 'BUYER',
        'version': os.environ['P0_VERSION'],
        'reason': 'Production P0 cross-tenant server-denial proof',
    }, handle, separators=(',', ':'))
PY
  chmod 0600 "$request"
  csrf="$(csrf_token "$jar")"
  status="$(http_request "$response" "$jar" \
    -X POST "$LIVE_BASE/api/proxy/auth/organization-memberships/${MEMBERSHIP_ID[a]}/role" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "Idempotency-Key: p0-cross-tenant-denial:$TARGET_SHA:$RUN_ID" \
    -H "x-correlation-id: p0-cross-tenant-denial:${TARGET_SHA:0:12}:$RUN_ID" \
    --data-binary "@$request")"
  rm -f "$request"
  case "$status" in
    403|404|409) ;;
    400) fail P0_CROSS_TENANT_REQUEST_WAS_MALFORMED 72 ;;
    401) fail P0_CROSS_TENANT_REQUEST_WAS_UNAUTHENTICATED 73 ;;
    2*) fail P0_CROSS_TENANT_BFF_ALLOWED 74 ;;
    *) fail P0_CROSS_TENANT_BFF_DENIAL_INVALID 75 ;;
  esac
  BFF_DENIAL_STATUS="$status"
  rm -f "$response"

  status="$(http_request "$me_response" "$jar" \
    "$LIVE_BASE/api/auth/me" \
    -H "x-correlation-id: p0-cross-tenant-session-check:${TARGET_SHA:0:12}:$RUN_ID")"
  [[ "$status" == 200 ]] || fail P0_TENANT_B_SESSION_LOST_AFTER_DENIAL 76
  P0_EXPECTED_USER="${USER_ID[b]}" P0_EXPECTED_TENANT="${TENANT_ID[b]}" \
    python3 - "$me_response" <<'PY' || fail P0_TENANT_B_CONTEXT_CHANGED_AFTER_DENIAL 77
import json, os, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('authenticated') is not True: raise SystemExit(1)
if payload.get('id') != os.environ['P0_EXPECTED_USER']: raise SystemExit(1)
if payload.get('tenantId') != os.environ['P0_EXPECTED_TENANT']: raise SystemExit(1)
PY
  rm -f "$me_response"
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
target_sha="${2:-}"
shift 2 || true

remote_fail() {
  printf 'ERROR_CODE=%s\n' "$1"
  exit "${2:-1}"
}

[[ "$mode" == preflight || "$mode" == evidence ]] || remote_fail P0_REMOTE_MODE_INVALID 2
[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]] || remote_fail P0_REMOTE_TARGET_INVALID 3
[[ "$(id -u)" == 0 ]] || remote_fail P0_PROTECTED_SSH_PRINCIPAL_INVALID 4
command -v docker >/dev/null 2>&1 || remote_fail P0_REMOTE_DOCKER_MISSING 5

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || remote_fail P0_WEB_RUNTIME_AUTHORITY_AMBIGUOUS 6
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$project" ]] || remote_fail P0_COMPOSE_PROJECT_AUTHORITY_MISSING 7
mapfile -t api_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || remote_fail P0_API_RUNTIME_AUTHORITY_AMBIGUOUS 8
api_id="${api_ids[0]}"

api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" ]] \
  || remote_fail P0_PRODUCTION_REVISION_MISMATCH 9
web_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$web_id")"
[[ "$web_health" == healthy ]] || remote_fail P0_PRODUCTION_WEB_NOT_HEALTHY 10
docker exec "$api_id" /nodejs/bin/node -e \
  "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" \
  >/dev/null 2>&1 || remote_fail P0_PRODUCTION_API_NOT_READY 11

command -v python3 >/dev/null 2>&1 || remote_fail P0_REMOTE_PYTHON_MISSING 12
command -v base64 >/dev/null 2>&1 || remote_fail P0_REMOTE_BASE64_MISSING 13

working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
[[ -d "$working_dir" && -n "$config_files" ]] || remote_fail P0_COMPOSE_LABEL_AUTHORITY_MISSING 14

IFS=',' read -r -a raw_files <<< "$config_files"
compose_files=()
for raw_file in "${raw_files[@]}"; do
  compose_file="${raw_file#"${raw_file%%[![:space:]]*}"}"
  compose_file="${compose_file%"${compose_file##*[![:space:]]}"}"
  [[ -n "$compose_file" ]] || continue
  [[ "$compose_file" == /* ]] || compose_file="$working_dir/$compose_file"
  [[ -f "$compose_file" ]] || remote_fail P0_PROTECTED_COMPOSE_FILE_MISSING 15
  compose_files+=("$compose_file")
done
(( ${#compose_files[@]} >= 1 )) || remote_fail P0_COMPOSE_AUTHORITY_EMPTY 16

dc=(docker compose --project-directory "$working_dir" --project-name "$project")
for compose_file in "${compose_files[@]}"; do dc+=(-f "$compose_file"); done
compose_json="$("${dc[@]}" config --format json)" || remote_fail P0_COMPOSE_CONFIG_FAILED 17
service_inventory="$(python3 -c '
import base64, json, re, sys
cfg = json.load(sys.stdin)
services = cfg.get("services") or {}
candidates = []
for name, service in services.items():
    image = str(service.get("image") or "")
    command = service.get("command")
    command = " ".join(command) if isinstance(command, list) else str(command or "")
    if re.search(r"(^|[-_])(migrate|migration)([-_]|$)", name, re.I) or "grainflow-migration" in image or ("prisma" in command and "migrate" in command):
        candidates.append((name, service, image))
if len(candidates) != 1:
    raise SystemExit(1)
name, service, image = candidates[0]
environment = service.get("environment") or {}
database_url = environment.get("DATABASE_URL") if isinstance(environment, dict) else None
if not image or not isinstance(database_url, str) or not database_url.strip() or "\n" in database_url:
    raise SystemExit(1)
print(name)
print(image)
print(base64.b64encode(database_url.encode()).decode())
' <<< "$compose_json")" || remote_fail P0_MIGRATION_SERVICE_AUTHORITY_MISSING 18
unset compose_json
migration_service="$(sed -n '1p' <<< "$service_inventory")"
migration_image="$(sed -n '2p' <<< "$service_inventory")"
migration_database_url="$(sed -n '3p' <<< "$service_inventory" | base64 --decode)" \
  || remote_fail P0_MIGRATION_DATABASE_AUTHORITY_MISSING 19
unset service_inventory
[[ -n "$migration_service" && -n "$migration_image" && -n "$migration_database_url" ]] \
  || remote_fail P0_MIGRATION_DATABASE_AUTHORITY_MISSING 19
migration_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$migration_image" 2>/dev/null || true)"
[[ "$migration_revision" == "$target_sha" ]] || remote_fail P0_MIGRATION_IMAGE_REVISION_MISMATCH 20

run_auth_evidence() {
  docker exec -i "$api_id" /nodejs/bin/node - "$@" <<'NODE'
const { PrismaClient } = require('@prisma/client');

const [mode, ...args] = process.argv.slice(2);
const knownRoles = new Set(['pc_auth_runtime', 'one_deal_auth', 'app_auth']);
const identifier = /^[A-Za-z0-9_-]{8,180}$/;
const rolePattern = /^(FARMER|BUYER)$/;
const fail = (code) => { throw new Error(code); };
let prisma;

async function principalProof(tx) {
  const principals = await tx.$queryRawUnsafe(`
    SELECT role.rolname AS role_name, role.rolsuper, role.rolbypassrls,
           has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
           has_table_privilege(current_user, 'public.user_orgs', 'SELECT') AS membership_select
    FROM pg_catalog.pg_roles role
    WHERE role.rolname = current_user
  `);
  const tables = await tx.$queryRawUnsafe(`
    SELECT class.relrowsecurity, class.relforcerowsecurity
    FROM pg_catalog.pg_class class
    WHERE class.oid = 'public.user_orgs'::regclass
  `);
  const principal = principals[0];
  const table = tables[0];
  if (!principal || !knownRoles.has(principal.role_name)
    || principal.rolsuper !== false || principal.rolbypassrls !== false
    || principal.schema_usage !== true || principal.membership_select !== true
    || table?.relrowsecurity !== true || table?.relforcerowsecurity !== true) {
    fail('P0_AUTH_RUNTIME_PRINCIPAL_INVALID');
  }
  return principal.role_name;
}

async function activeSession(tx, user, membership, organization, tenant) {
  const rows = await tx.$queryRawUnsafe(`
    SELECT id
    FROM auth.sessions
    WHERE user_id = $1
      AND membership_id = $2
      AND organization_id = $3
      AND tenant_id = $4
      AND status = 'ACTIVE'
      AND revoked_at IS NULL
      AND expires_at > now()
      AND mfa_verified_at IS NOT NULL
    ORDER BY mfa_verified_at DESC, id DESC
    LIMIT 1
  `, user, membership, organization, tenant);
  const session = rows[0]?.id;
  if (typeof session !== 'string' || !identifier.test(session)) fail('P0_ACTIVE_MFA_SESSION_NOT_FOUND');
  return session;
}

async function visibleMembership(tx, context, resource) {
  await tx.$queryRawUnsafe(`
    SELECT set_config('app.current_user_id', $1, true),
           set_config('app.current_org_id', $2, true),
           set_config('app.current_tenant_id', $3, true),
           set_config('app.current_role', $4, true),
           set_config('app.current_session_id', $5, true)
  `, context.user, context.organization, context.tenant, context.role, context.session);
  const settings = await tx.$queryRawUnsafe(`
    SELECT current_setting('app.current_user_id', true) AS user_id,
           current_setting('app.current_org_id', true) AS organization_id,
           current_setting('app.current_tenant_id', true) AS tenant_id,
           current_setting('app.current_role', true) AS role,
           current_setting('app.current_session_id', true) AS session_id
  `);
  const actual = settings[0];
  if (!actual || actual.user_id !== context.user || actual.organization_id !== context.organization
    || actual.tenant_id !== context.tenant || actual.role !== context.role
    || actual.session_id !== context.session) fail('P0_AUTH_RLS_CONTEXT_INVALID');
  const rows = await tx.$queryRawUnsafe(
    'SELECT count(*)::int AS visible FROM public."user_orgs" WHERE "id" = $1',
    resource,
  );
  return rows[0]?.visible;
}

(async () => {
  if (!process.env.AUTH_DATABASE_URL) fail('P0_AUTH_DATABASE_URL_MISSING');
  if (!['preflight', 'evidence'].includes(mode)) fail('P0_AUTH_EVIDENCE_MODE_INVALID');
  prisma = new PrismaClient({ datasources: { db: { url: process.env.AUTH_DATABASE_URL } } });
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const roleName = await principalProof(tx);
    if (mode === 'preflight') return { roleName };
    if (args.length !== 10) fail('P0_AUTH_EVIDENCE_ARGUMENTS_INVALID');
    const [aUser, aOrg, aTenant, aMembership, aRole, bUser, bOrg, bTenant, bMembership, bRole] = args;
    for (const value of [aUser, aOrg, aTenant, aMembership, bUser, bOrg, bTenant, bMembership]) {
      if (!identifier.test(value ?? '')) fail('P0_AUTH_EVIDENCE_IDENTITY_INVALID');
    }
    if (!rolePattern.test(aRole ?? '') || !rolePattern.test(bRole ?? '') || aRole !== 'FARMER' || bRole !== 'BUYER') {
      fail('P0_AUTH_EVIDENCE_ROLE_INVALID');
    }
    const aSession = await activeSession(tx, aUser, aMembership, aOrg, aTenant);
    const bSession = await activeSession(tx, bUser, bMembership, bOrg, bTenant);
    const aVisible = await visibleMembership(tx, {
      user: aUser, organization: aOrg, tenant: aTenant, role: aRole, session: aSession,
    }, aMembership);
    const bVisible = await visibleMembership(tx, {
      user: bUser, organization: bOrg, tenant: bTenant, role: bRole, session: bSession,
    }, aMembership);
    return { roleName, aVisible, bVisible };
  });
  if (mode === 'preflight') {
    process.stdout.write(`AUTH_PRINCIPAL|${result.roleName}\n`);
  } else {
    process.stdout.write(`AUTH_RLS|${result.aVisible}|${result.bVisible}\n`);
  }
})().catch((error) => {
  const code = /^[A-Z0-9_]{4,100}$/.test(String(error?.message ?? ''))
    ? error.message : 'P0_AUTH_RUNTIME_READ_ONLY_EVIDENCE_FAILED';
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (prisma) await prisma.$disconnect().catch(() => undefined);
});
NODE
}

read -r -d '' admin_node <<'NODE' || true
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');

const fields = fs.readFileSync(0).toString('utf8').split('\0');
if (fields.at(-1) === '') fields.pop();
const [databaseUrl, mode, ...args] = fields;
const identifier = /^[A-Za-z0-9_-]{8,180}$/;
const correlation = /^[A-Za-z0-9._:-]{8,128}$/;
const fail = (code) => { throw new Error(code); };
let prisma;

async function receiptProof(tx, values, workspace) {
  const [app, version, receiptCorrelation, user, organization, membership, role, reviewer] = values;
  const rows = await tx.$queryRawUnsafe(`
    WITH application AS MATERIALIZED (
      SELECT id, kind, status, version, user_id, organization_id, membership_id,
             requested_workspace, requested_role, decision_actor_user_id
      FROM auth.registration_applications
      WHERE id = $1
        AND kind = 'NEW_ORGANIZATION'
        AND status = 'ACTIVATED'
        AND version = $2::int
        AND user_id = $4
        AND organization_id = $5
        AND membership_id = $6
        AND requested_workspace = $9
        AND requested_role = $7
        AND decision_actor_user_id = $8
    ), approval_event AS MATERIALIZED (
      SELECT event.id
      FROM auth.registration_application_events event
      JOIN application ON application.id = event.application_id
      WHERE event.actor_kind = 'PLATFORM_REVIEWER'
        AND event.actor_user_id = application.decision_actor_user_id
        AND event.previous_status = 'ORGANIZATION_VERIFICATION_PENDING'
        AND event.new_status = 'APPROVED'
        AND event.application_version = application.version - 1
        AND event.correlation_id = $3
    ), activation_event AS MATERIALIZED (
      SELECT event.id
      FROM auth.registration_application_events event
      JOIN application ON application.id = event.application_id
      WHERE event.actor_kind = 'SYSTEM'
        AND event.previous_status = 'APPROVED'
        AND event.new_status = 'ACTIVATED'
        AND event.application_version = application.version
        AND event.correlation_id = $3
    ), approval_audit AS MATERIALIZED (
      SELECT audit.id, audit.hash
      FROM auth.audit_events audit
      JOIN application ON application.decision_actor_user_id = audit.user_id
      WHERE audit.action = 'auth.registration.decision'
        AND audit.outcome = 'SUCCESS'
        AND audit.reason = 'APPROVE'
        AND audit.metadata ->> 'applicationId' = application.id
        AND audit.metadata ->> 'correlationId' = $3
        AND audit.hash IS NOT NULL
    ), receipt AS MATERIALIZED (
      SELECT entry."id", entry."auditId", entry."payload"
      FROM public."outbox_entries" entry
      JOIN application ON true
      JOIN approval_audit ON approval_audit.id = entry."auditId"
      WHERE entry."type" = 'auth.registration.lifecycle.receipt'
        AND entry."idempotencyKey" = 'registration-lifecycle:' || application.id || ':' || application.version::text
        AND entry."correlationId" = $3
        AND entry."triggeredByUserId" = application.decision_actor_user_id
        AND entry."payload" ->> 'schemaVersion' = 'auth.registration.lifecycle.receipt.v1'
        AND entry."payload" ->> 'applicationId' = application.id
        AND entry."payload" ->> 'applicationKind' = application.kind
        AND entry."payload" ->> 'applicationVersion' = application.version::text
        AND entry."payload" ->> 'status' = 'ACTIVATED'
        AND entry."payload" ->> 'userId' = application.user_id
        AND entry."payload" ->> 'organizationId' = application.organization_id
        AND entry."payload" ->> 'membershipId' = application.membership_id
        AND entry."payload" ->> 'requestedWorkspace' = application.requested_workspace
        AND entry."payload" ->> 'requestedRole' = application.requested_role
        AND entry."payload" ->> 'decisionActorUserId' = application.decision_actor_user_id
        AND entry."payload" ->> 'auditId' = approval_audit.id
        AND entry."payload" ->> 'auditHash' = approval_audit.hash
        AND entry."payload" ->> 'correlationId' = $3
    )
    SELECT CASE WHEN
      (SELECT count(*) FROM application) = 1
      AND (SELECT count(*) FROM approval_event) = 1
      AND (SELECT count(*) FROM activation_event) = 1
      AND (SELECT count(*) FROM approval_audit) = 1
      AND (SELECT count(*) FROM receipt) = 1
      AND (SELECT id FROM approval_event) = (SELECT "payload" ->> 'approvalEventId' FROM receipt)
      AND (SELECT id FROM activation_event) = (SELECT "payload" ->> 'activationEventId' FROM receipt)
      THEN 'PASS' ELSE 'FAIL' END AS verdict,
      COALESCE((SELECT id FROM approval_audit), 'none') AS audit_id,
      COALESCE((SELECT "id" FROM receipt), 'none') AS outbox_id
  `, app, version, receiptCorrelation, user, organization, membership, role, reviewer, workspace);
  const row = rows[0];
  return `${row?.verdict}|${row?.audit_id}|${row?.outbox_id}`;
}

(async () => {
  if (!databaseUrl || !['preflight', 'evidence'].includes(mode)) fail('P0_ADMIN_EVIDENCE_INPUT_INVALID');
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe('SET LOCAL ROLE pc_registration_receipt_authority');
    const principals = await tx.$queryRawUnsafe(`
      SELECT role.rolname AS role_name, role.rolcanlogin, role.rolinherit,
        role.rolsuper, role.rolbypassrls, role.rolcreatedb, role.rolcreaterole,
        (SELECT count(*)::integer
         FROM pg_catalog.pg_auth_members membership
         WHERE membership.roleid = role.oid) AS member_count
      FROM pg_catalog.pg_roles role WHERE role.rolname = current_user
    `);
    const tables = await tx.$queryRawUnsafe(`
      SELECT class.relrowsecurity, class.relforcerowsecurity
      FROM pg_catalog.pg_class class WHERE class.oid = 'public.outbox_entries'::regclass
    `);
    const outboxScope = await tx.$queryRawUnsafe(`
      SELECT row_security_active('public.outbox_entries') AS rls_active,
        EXISTS (
          SELECT 1 FROM public."outbox_entries" entry
          WHERE entry."type" IS DISTINCT FROM 'auth.registration.lifecycle.receipt'
             OR COALESCE(entry."idempotencyKey", '') NOT LIKE 'registration-lifecycle:%'
        ) AS out_of_scope_visible
    `);
    const policies = await tx.$queryRawUnsafe(`
      SELECT policy.policyname, policy.cmd, policy.roles::text AS roles_text,
        policy.qual, policy.with_check
      FROM pg_catalog.pg_policies policy
      WHERE policy.schemaname = 'public'
        AND policy.tablename = 'outbox_entries'
        AND policy.policyname IN (
          'outbox_entries_registration_receipt_select',
          'outbox_entries_registration_receipt_insert'
        )
      ORDER BY policy.policyname
    `);
    const privileges = await tx.$queryRawUnsafe(`
      SELECT
        has_table_privilege(current_user, 'public.outbox_entries', 'SELECT') AS outbox_select,
        has_table_privilege(current_user, 'public.outbox_entries', 'INSERT') AS outbox_insert,
        has_table_privilege(current_user, 'auth.registration_applications', 'SELECT')
          AS applications_select,
        has_table_privilege(current_user, 'auth.registration_application_events', 'SELECT')
          AS events_select,
        has_table_privilege(current_user, 'auth.audit_events', 'SELECT') AS audit_select,
        (
          has_table_privilege(current_user, 'public.outbox_entries', 'UPDATE')
          OR has_any_column_privilege(current_user, 'public.outbox_entries', 'UPDATE')
          OR has_table_privilege(current_user, 'public.outbox_entries', 'DELETE')
          OR has_table_privilege(current_user, 'public.outbox_entries', 'TRUNCATE')
          OR has_table_privilege(current_user, 'auth.registration_applications', 'INSERT')
          OR has_any_column_privilege(current_user, 'auth.registration_applications', 'INSERT')
          OR has_table_privilege(current_user, 'auth.registration_applications', 'UPDATE')
          OR has_any_column_privilege(current_user, 'auth.registration_applications', 'UPDATE')
          OR has_table_privilege(current_user, 'auth.registration_applications', 'DELETE')
          OR has_table_privilege(current_user, 'auth.registration_applications', 'TRUNCATE')
          OR has_table_privilege(current_user, 'auth.registration_application_events', 'INSERT')
          OR has_any_column_privilege(current_user, 'auth.registration_application_events', 'INSERT')
          OR has_table_privilege(current_user, 'auth.registration_application_events', 'UPDATE')
          OR has_any_column_privilege(current_user, 'auth.registration_application_events', 'UPDATE')
          OR has_table_privilege(current_user, 'auth.registration_application_events', 'DELETE')
          OR has_table_privilege(current_user, 'auth.registration_application_events', 'TRUNCATE')
          OR has_table_privilege(current_user, 'auth.audit_events', 'INSERT')
          OR has_any_column_privilege(current_user, 'auth.audit_events', 'INSERT')
          OR has_table_privilege(current_user, 'auth.audit_events', 'UPDATE')
          OR has_any_column_privilege(current_user, 'auth.audit_events', 'UPDATE')
          OR has_table_privilege(current_user, 'auth.audit_events', 'DELETE')
          OR has_table_privilege(current_user, 'auth.audit_events', 'TRUNCATE')
        ) AS forbidden_write_privilege
    `);
    const auditTriggers = await tx.$queryRawUnsafe(`
      SELECT count(*)::integer AS trigger_count
      FROM pg_catalog.pg_trigger trigger
      JOIN pg_catalog.pg_class relation ON relation.oid = trigger.tgrelid
      JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
      WHERE schema.nspname = 'auth'
        AND relation.relname = 'audit_events'
        AND trigger.tgname IN (
          'auth_audit_events_append_only',
          'auth_audit_events_no_truncate'
        )
        AND trigger.tgenabled <> 'D'
    `);
    const producer = await tx.$queryRawUnsafe(`
      SELECT pg_get_functiondef(function.oid) AS definition,
        function.prosecdef, function.proconfig, owner.rolname AS owner_name,
        EXISTS (
          SELECT 1
          FROM aclexplode(COALESCE(function.proacl, acldefault('f', function.proowner))) acl
          WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
        ) AS public_execute
      FROM pg_catalog.pg_proc function
      JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
      WHERE schema.nspname = 'auth'
        AND function.oid = to_regprocedure('auth.emit_registration_lifecycle_receipt(text,text)')
    `);
    const principal = principals[0];
    const table = tables[0];
    const scope = outboxScope[0];
    const privilege = privileges[0];
    const producerFunction = producer[0];
    const definition = producerFunction?.definition;
    const policyByName = new Map(policies.map((policy) => [policy.policyname, policy]));
    const selectPolicy = policyByName.get('outbox_entries_registration_receipt_select');
    const insertPolicy = policyByName.get('outbox_entries_registration_receipt_insert');
    const contains = (value, marker) => typeof value === 'string' && value.includes(marker);
    if (principal?.role_name !== 'pc_registration_receipt_authority'
      || principal.rolcanlogin !== false || principal.rolinherit !== false
      || principal.rolsuper !== false || principal.rolbypassrls !== false
      || principal.rolcreatedb !== false || principal.rolcreaterole !== false
      || Number(principal.member_count) !== 0
      || table?.relrowsecurity !== true || table?.relforcerowsecurity !== true
      || scope?.rls_active !== true || scope?.out_of_scope_visible !== false
      || policies.length !== 2
      || selectPolicy?.cmd !== 'SELECT'
      || !contains(selectPolicy?.roles_text, 'pc_registration_receipt_authority')
      || !contains(selectPolicy?.qual, 'pc_registration_receipt_authority')
      || !contains(selectPolicy?.qual, 'auth.registration.lifecycle.receipt')
      || insertPolicy?.cmd !== 'INSERT'
      || !contains(insertPolicy?.roles_text, 'pc_registration_receipt_authority')
      || !contains(insertPolicy?.with_check, 'pc_registration_receipt_authority')
      || !contains(insertPolicy?.with_check, 'auth.registration.lifecycle.receipt')
      || !contains(insertPolicy?.with_check, 'registration-lifecycle:')
      || privilege?.outbox_select !== true || privilege?.outbox_insert !== true
      || privilege?.applications_select !== true || privilege?.events_select !== true
      || privilege?.audit_select !== true || privilege?.forbidden_write_privilege !== false
      || Number(auditTriggers[0]?.trigger_count) !== 2
      || producerFunction?.prosecdef !== true
      || producerFunction?.owner_name !== 'pc_registration_receipt_authority'
      || producerFunction?.public_execute !== false
      || !Array.isArray(producerFunction?.proconfig)
      || !producerFunction.proconfig.includes('row_security=on')
      || !producerFunction.proconfig.includes('search_path=pg_catalog, pg_temp')
      || typeof definition !== 'string'
      || !definition.includes("SET row_security TO 'on'")
      || !definition.includes('auth.registration.lifecycle.receipt')
      || !definition.includes('registration-lifecycle:')
      || !definition.includes('auth.audit_events')) {
      fail('MISSING_P0_CAUSAL_OUTBOX_PRODUCER');
    }
    if (mode === 'preflight') return { roleName: principal.role_name };
    if (args.length !== 17) fail('P0_ADMIN_EVIDENCE_ARGUMENTS_INVALID');
    const [aUser, aOrg, aTenant, aMembership, aRole, aApp, aVersion, aCorrelation,
      bUser, bOrg, bTenant, bMembership, bRole, bApp, bVersion, bCorrelation, reviewer] = args;
    for (const value of [aUser, aOrg, aTenant, aMembership, aApp, bUser, bOrg, bTenant, bMembership, bApp, reviewer]) {
      if (!identifier.test(value ?? '')) fail('P0_ADMIN_EVIDENCE_IDENTITY_INVALID');
    }
    if (!/^[1-9][0-9]*$/.test(aVersion ?? '') || !/^[1-9][0-9]*$/.test(bVersion ?? '')
      || aRole !== 'FARMER' || bRole !== 'BUYER'
      || !correlation.test(aCorrelation ?? '') || !correlation.test(bCorrelation ?? '')) {
      fail('P0_ADMIN_EVIDENCE_ARGUMENT_INVALID');
    }
    const aReceipt = await receiptProof(tx,
      [aApp, aVersion, aCorrelation, aUser, aOrg, aMembership, aRole, reviewer], 'seller');
    const bReceipt = await receiptProof(tx,
      [bApp, bVersion, bCorrelation, bUser, bOrg, bMembership, bRole, reviewer], 'buyer');
    return { aReceipt, bReceipt };
  });
  if (mode === 'preflight') {
    process.stdout.write(`ADMIN_PRINCIPAL|${result.roleName}\n`);
  } else {
    process.stdout.write(`ADMIN_RECEIPTS|${result.aReceipt}|${result.bReceipt}\n`);
  }
})().catch((error) => {
  const code = /^[A-Z0-9_]{4,100}$/.test(String(error?.message ?? ''))
    ? error.message : 'P0_ADMIN_READ_ONLY_EVIDENCE_FAILED';
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (prisma) await prisma.$disconnect().catch(() => undefined);
});
NODE

run_admin_evidence() {
  local admin_mode="$1"
  shift
  {
    printf '%s\0' "$migration_database_url" "$admin_mode"
    printf '%s\0' "$@"
  } | docker exec -i "$api_id" /nodejs/bin/node -e "$admin_node"
}

auth_output="$(run_auth_evidence preflight)" || remote_fail P0_POSTGRES_RLS_RUNTIME_ROLE_MISSING 21
[[ "$auth_output" =~ ^AUTH_PRINCIPAL\|(pc_auth_runtime|one_deal_auth|app_auth)$ ]] \
  || remote_fail P0_POSTGRES_RLS_RUNTIME_ROLE_MISSING 21
admin_output="$(run_admin_evidence preflight)" || remote_fail MISSING_P0_CAUSAL_OUTBOX_PRODUCER 22
[[ "$admin_output" == 'ADMIN_PRINCIPAL|pc_registration_receipt_authority' ]] \
  || remote_fail MISSING_P0_CAUSAL_OUTBOX_PRODUCER 22

if [[ "$mode" == preflight ]]; then
  printf 'P0_REMOTE_EXACT_REVISIONS=PASS\n'
  printf 'P0_MIGRATION_IMAGE_REVISION=PASS\n'
  printf 'P0_CAUSAL_OUTBOX_PRODUCER=PASS\n'
  printf 'P0_POSTGRES_RLS_RUNTIME=PASS\n'
  exit 0
fi

(( $# == 17 )) || remote_fail P0_REMOTE_EVIDENCE_ARGUMENTS_INVALID 23
a_user="$1"; a_org="$2"; a_tenant="$3"; a_membership="$4"; a_role="$5"; a_app="$6"; a_version="$7"; a_correlation="$8"
b_user="$9"; b_org="${10}"; b_tenant="${11}"; b_membership="${12}"; b_role="${13}"; b_app="${14}"; b_version="${15}"; b_correlation="${16}"
reviewer_user="${17}"

for value in "$a_user" "$a_org" "$a_tenant" "$a_membership" "$a_app" \
  "$b_user" "$b_org" "$b_tenant" "$b_membership" "$b_app" "$reviewer_user"; do
  [[ "$value" =~ ^[A-Za-z0-9_-]{8,180}$ ]] || remote_fail P0_REMOTE_IDENTITY_ARGUMENT_INVALID 24
done
[[ "$a_version" =~ ^[1-9][0-9]*$ && "$b_version" =~ ^[1-9][0-9]*$ ]] \
  || remote_fail P0_REMOTE_VERSION_ARGUMENT_INVALID 25
[[ "$a_role" == FARMER && "$b_role" == BUYER ]] \
  || remote_fail P0_REMOTE_ROLE_ARGUMENT_INVALID 25
for value in "$a_correlation" "$b_correlation"; do
  [[ "$value" =~ ^[A-Za-z0-9._:-]{8,128}$ ]] || remote_fail P0_REMOTE_CORRELATION_ARGUMENT_INVALID 26
done

auth_output="$(run_auth_evidence evidence \
  "$a_user" "$a_org" "$a_tenant" "$a_membership" "$a_role" \
  "$b_user" "$b_org" "$b_tenant" "$b_membership" "$b_role")" \
  || remote_fail P0_AUTH_RUNTIME_READ_ONLY_EVIDENCE_FAILED 27
IFS='|' read -r auth_marker a_visible b_visible <<< "$auth_output"
[[ "$auth_marker" == AUTH_RLS && "$a_visible" == 1 ]] \
  || remote_fail P0_TENANT_A_RLS_RESOURCE_NOT_VISIBLE 28
[[ "$b_visible" == 0 ]] || remote_fail P0_TENANT_B_RLS_RESOURCE_VISIBLE 29

admin_output="$(run_admin_evidence evidence "$@")" \
  || remote_fail P0_ADMIN_READ_ONLY_EVIDENCE_FAILED 30
IFS='|' read -r admin_marker a_verdict a_audit a_outbox b_verdict b_audit b_outbox <<< "$admin_output"
[[ "$admin_marker" == ADMIN_RECEIPTS \
  && "$a_verdict" == PASS \
  && "$a_audit" =~ ^auth_evt_[A-Za-z0-9-]+$ \
  && "$a_outbox" =~ ^registration_receipt_[A-Za-z0-9-]+$ ]] \
  || remote_fail P0_CAUSAL_RECEIPT_A_INVALID 31
[[ "$b_verdict" == PASS \
  && "$b_audit" =~ ^auth_evt_[A-Za-z0-9-]+$ \
  && "$b_outbox" =~ ^registration_receipt_[A-Za-z0-9-]+$ ]] \
  || remote_fail P0_CAUSAL_RECEIPT_B_INVALID 32
a_receipt="PASS|$a_audit|$a_outbox"
b_receipt="PASS|$b_audit|$b_outbox"

printf 'P0_REMOTE_EXACT_REVISIONS=PASS\n'
printf 'P0_MIGRATION_IMAGE_REVISION=PASS\n'
printf 'P0_CAUSAL_OUTBOX_PRODUCER=PASS\n'
printf 'P0_TENANT_A_RLS=%s\n' "$a_visible"
printf 'P0_TENANT_B_RLS=%s\n' "$b_visible"
printf 'P0_RECEIPT_A=%s\n' "$a_receipt"
printf 'P0_RECEIPT_B=%s\n' "$b_receipt"
REMOTE
)"
  rc=$?
  set -e
  if (( rc != 0 )); then
    blocker="$(sed -n 's/^ERROR_CODE=//p' <<< "$output" | tail -1)"
    [[ "$blocker" =~ ^[A-Z0-9_]{4,100}$ ]] || blocker=P0_REMOTE_READ_ONLY_EVIDENCE_FAILED
    fail "$blocker" 80
  fi
  printf '%s' "$output"
}

production_preflight() {
  local output
  CURRENT_STAGE=production-read-only-preflight
  output="$(remote_authority preflight)"
  grep -Fxq P0_REMOTE_EXACT_REVISIONS=PASS <<< "$output" || fail P0_PRODUCTION_REVISION_PREFLIGHT_FAILED 81
  grep -Fxq P0_MIGRATION_IMAGE_REVISION=PASS <<< "$output" || fail P0_MIGRATION_IMAGE_REVISION_MISMATCH 82
  grep -Fxq P0_CAUSAL_OUTBOX_PRODUCER=PASS <<< "$output" || fail MISSING_P0_CAUSAL_OUTBOX_PRODUCER 82
  grep -Fxq P0_POSTGRES_RLS_RUNTIME=PASS <<< "$output" || fail P0_POSTGRES_RLS_RUNTIME_ROLE_MISSING 83

  local ready="$TMP_ROOT/public-ready.json" status
  status="$(http_request "$ready" "$TMP_ROOT/preflight.cookies" \
    "$LIVE_BASE/api/health/ready?release=$TARGET_SHA&acceptance=$RUN_ID")"
  [[ "$status" == 200 ]] || fail P0_PUBLIC_READY_FAILED 84
  P0_TARGET_SHA="$TARGET_SHA" python3 - "$ready" <<'PY' || fail P0_PUBLIC_READY_REVISION_MISMATCH 85
import datetime, json, os, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
checked_at = payload.get('checkedAt')
if not isinstance(checked_at, str): raise SystemExit(1)
stamp = datetime.datetime.fromisoformat(checked_at.replace('Z', '+00:00'))
age = (datetime.datetime.now(datetime.timezone.utc) - stamp).total_seconds()
if (payload.get('status') != 'ok'
    or payload.get('service') != 'web'
    or payload.get('releaseAuthority') != 'exact-sha'
    or payload.get('revision') != os.environ['P0_TARGET_SHA']
    or age < -30 or age > 120):
    raise SystemExit(1)
PY
  rm -f "$ready" "$TMP_ROOT/preflight.cookies"
}

prove_postgresql_evidence() {
  local output a_receipt b_receipt
  CURRENT_STAGE=postgresql-rls-audit-outbox
  output="$(remote_authority evidence \
    "${USER_ID[a]}" "${ORG_ID[a]}" "${TENANT_ID[a]}" "${MEMBERSHIP_ID[a]}" "${USER_ROLE[a]}" \
    "${APP_ID[a]}" "${APPROVAL_VERSION[a]}" "${APPROVAL_CORRELATION[a]}" \
    "${USER_ID[b]}" "${ORG_ID[b]}" "${TENANT_ID[b]}" "${MEMBERSHIP_ID[b]}" "${USER_ROLE[b]}" \
    "${APP_ID[b]}" "${APPROVAL_VERSION[b]}" "${APPROVAL_CORRELATION[b]}" \
    "$REVIEWER_USER_ID")"
  grep -Fxq P0_REMOTE_EXACT_REVISIONS=PASS <<< "$output" || fail P0_PRODUCTION_REVISION_CHANGED 86
  grep -Fxq P0_MIGRATION_IMAGE_REVISION=PASS <<< "$output" || fail P0_MIGRATION_IMAGE_REVISION_MISMATCH 87
  grep -Fxq P0_CAUSAL_OUTBOX_PRODUCER=PASS <<< "$output" || fail MISSING_P0_CAUSAL_OUTBOX_PRODUCER 87
  grep -Fxq P0_TENANT_A_RLS=1 <<< "$output" || fail P0_TENANT_A_RLS_RESOURCE_NOT_VISIBLE 88
  grep -Fxq P0_TENANT_B_RLS=0 <<< "$output" || fail P0_TENANT_B_RLS_RESOURCE_VISIBLE 89
  a_receipt="$(sed -n 's/^P0_RECEIPT_A=//p' <<< "$output")"
  b_receipt="$(sed -n 's/^P0_RECEIPT_B=//p' <<< "$output")"
  local receipt_status audit_id outbox_id
  IFS='|' read -r receipt_status audit_id outbox_id <<< "$a_receipt"
  AUDIT_ID[a]="$audit_id"
  OUTBOX_ID[a]="$outbox_id"
  IFS='|' read -r receipt_status audit_id outbox_id <<< "$b_receipt"
  AUDIT_ID[b]="$audit_id"
  OUTBOX_ID[b]="$outbox_id"
  [[ "${AUDIT_ID[a]}" =~ ^auth_evt_[A-Za-z0-9-]+$ \
    && "${AUDIT_ID[b]}" =~ ^auth_evt_[A-Za-z0-9-]+$ \
    && "${OUTBOX_ID[a]}" =~ ^registration_receipt_[A-Za-z0-9-]+$ \
    && "${OUTBOX_ID[b]}" =~ ^registration_receipt_[A-Za-z0-9-]+$ ]] \
    || fail P0_CAUSAL_RECEIPT_OUTPUT_INVALID 90
}

logout_session() {
  local label="$1" jar="$2" final_check="${3:-yes}"
  local response="$TMP_ROOT/$label-logout.json" me_response="$TMP_ROOT/$label-after-logout.json"
  local csrf status
  CURRENT_STAGE="$label-logout"
  csrf="$(csrf_token "$jar")"
  status="$(http_request "$response" "$jar" \
    -X POST "$LIVE_BASE/api/auth/logout" \
    -H 'Content-Type: application/json' \
    -H "Origin: $LIVE_BASE" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: p0-logout:${TARGET_SHA:0:12}:$RUN_ID:$label" \
    --data '{}')"
  [[ "$status" == 200 ]] || fail "P0_${label^^}_LOGOUT_FAILED" 91
  python3 - "$response" <<'PY' || fail "P0_${label^^}_LOGOUT_CONTRACT_INVALID" 92
import json, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('ok') is not True: raise SystemExit(1)
PY
  rm -f "$response"
  if [[ "$final_check" == yes ]]; then
    status="$(http_request "$me_response" "$jar" \
      "$LIVE_BASE/api/auth/me" \
      -H "x-correlation-id: p0-after-logout:${TARGET_SHA:0:12}:$RUN_ID:$label")"
    [[ "$status" == 401 ]] || fail "P0_${label^^}_SESSION_SURVIVED_LOGOUT" 93
    python3 - "$me_response" <<'PY' || fail "P0_${label^^}_LOGOUT_AUTH_STATE_INVALID" 94
import json, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
if payload.get('authenticated') is not False or payload.get('code') != 'UNAUTHENTICATED': raise SystemExit(1)
PY
    rm -f "$me_response"
  fi
}

assert_distinct_authority() {
  CURRENT_STAGE=distinct-tenant-authority
  [[ "${EMAIL[a]}" != "${EMAIL[b]}" \
    && "${APP_ID[a]}" != "${APP_ID[b]}" \
    && "${USER_ID[a]}" != "${USER_ID[b]}" \
    && "${ORG_ID[a]}" != "${ORG_ID[b]}" \
    && "${TENANT_ID[a]}" != "${TENANT_ID[b]}" \
    && "${MEMBERSHIP_ID[a]}" != "${MEMBERSHIP_ID[b]}" \
    && "$REVIEWER_USER_ID" != "${USER_ID[a]}" \
    && "$REVIEWER_USER_ID" != "${USER_ID[b]}" ]] \
    || fail P0_IDENTITIES_OR_TENANTS_NOT_DISTINCT 95
}

write_success_record() {
  P0_TARGET_SHA="$TARGET_SHA" \
  P0_RUN_ID="$RUN_ID" \
  P0_EMAIL_A="${EMAIL[a]}" P0_EMAIL_B="${EMAIL[b]}" \
  P0_APP_A="${APP_ID[a]}" P0_APP_B="${APP_ID[b]}" \
  P0_VERSION_A="${APPROVAL_VERSION[a]}" P0_VERSION_B="${APPROVAL_VERSION[b]}" \
  P0_CORRELATION_A="${APPROVAL_CORRELATION[a]}" P0_CORRELATION_B="${APPROVAL_CORRELATION[b]}" \
  P0_USER_A="${USER_ID[a]}" P0_USER_B="${USER_ID[b]}" \
  P0_ORG_A="${ORG_ID[a]}" P0_ORG_B="${ORG_ID[b]}" \
  P0_TENANT_A="${TENANT_ID[a]}" P0_TENANT_B="${TENANT_ID[b]}" \
  P0_MEMBERSHIP_A="${MEMBERSHIP_ID[a]}" P0_MEMBERSHIP_B="${MEMBERSHIP_ID[b]}" \
  P0_ROLE_A="${USER_ROLE[a]}" P0_ROLE_B="${USER_ROLE[b]}" \
  P0_AUDIT_A="${AUDIT_ID[a]}" P0_AUDIT_B="${AUDIT_ID[b]}" \
  P0_OUTBOX_A="${OUTBOX_ID[a]}" P0_OUTBOX_B="${OUTBOX_ID[b]}" \
  P0_DECISION_REPLAY="$DECISION_REPLAY_NOTIFICATION_SUPPRESSED" \
  P0_BFF_DENIAL_STATUS="$BFF_DENIAL_STATUS" \
    python3 - "$EVIDENCE_DIR/result.json" <<'PY'
import hashlib, json, os, sys

def email_hash(name):
    return hashlib.sha256(os.environ[name].lower().encode()).hexdigest()[:20]

def identity(label):
    suffix = label.upper()
    return {
        'label': label,
        'emailHash': email_hash(f'P0_EMAIL_{suffix}'),
        'applicationId': os.environ[f'P0_APP_{suffix}'],
        'applicationVersion': os.environ[f'P0_VERSION_{suffix}'],
        'approvalCorrelationId': os.environ[f'P0_CORRELATION_{suffix}'],
        'userId': os.environ[f'P0_USER_{suffix}'],
        'organizationId': os.environ[f'P0_ORG_{suffix}'],
        'tenantId': os.environ[f'P0_TENANT_{suffix}'],
        'membershipId': os.environ[f'P0_MEMBERSHIP_{suffix}'],
        'role': os.environ[f'P0_ROLE_{suffix}'],
        'auditId': os.environ[f'P0_AUDIT_{suffix}'],
        'outboxId': os.environ[f'P0_OUTBOX_{suffix}'],
        'outboxType': 'auth.registration.lifecycle.receipt',
        'outboxIdempotencyKey': (
            f"registration-lifecycle:{os.environ[f'P0_APP_{suffix}']}:"
            f"{os.environ[f'P0_VERSION_{suffix}']}"
        ),
        'mailDeliveryAcknowledged': True,
        'emailVerified': True,
        'staffApprovedWithFreshMfa': True,
        'initialMfaEnrollment': True,
        'freshMfaRelogin': True,
        'permittedAction': 'GET /api/proxy/auth/organization-team',
        'logoutRevokedSession': True,
    }

payload = {
    'schemaVersion': 'production.p0.first-customer.acceptance.v1',
    'passed': True,
    'targetSha': os.environ['P0_TARGET_SHA'],
    'runId': os.environ['P0_RUN_ID'],
    'decisionReplayNotificationSuppressed': os.environ['P0_DECISION_REPLAY'] == '1',
    'production': {
        'hosting': 'REG_RU_VPS_ONLY',
        'apiRevisionExact': True,
        'webRevisionExact': True,
        'migrationImageRevisionExact': True,
        'publicReady': True,
        'postgresqlEvidenceMode': 'AUTH_RUNTIME_AND_RECEIPT_AUTHORITY_READ_ONLY',
        'authRuntimeRestricted': True,
        'outboxRlsForced': True,
        'receiptAuthorityNoMembers': True,
        'receiptAuthorityReadBounded': True,
        'receiptAuthorityWriteBounded': True,
        'receiptPoliciesBounded': True,
        'causalProducerSecurityDefiner': True,
        'approvalAuditAppendOnly': True,
    },
    'identities': [identity('a'), identity('b')],
    'tenantIsolation': {
        'distinctTenants': True,
        'knownTenantAResource': os.environ['P0_MEMBERSHIP_A'],
        'tenantABffRead': True,
        'tenantBBffDeniedHttpStatus': int(os.environ['P0_BFF_DENIAL_STATUS']),
        'tenantAPostgresqlRlsCount': 1,
        'tenantBPostgresqlRlsCount': 0,
    },
    'causalReceiptProducer': 'auth.emit_registration_lifecycle_receipt(text,text)',
    'secretsOrRawTokensInEvidence': False,
}
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2)
    handle.write('\n')
PY
  find "$EVIDENCE_DIR" -type f ! -name sha256.txt -print0 \
    | sort -z | xargs -0 -r sha256sum > "$EVIDENCE_DIR/sha256.txt"
}

main() {
  umask 077
  mkdir -p "$EVIDENCE_DIR"
  TMP_ROOT="$(mktemp -d)"
  chmod 0700 "$TMP_ROOT"

  validate_prerequisites
  production_preflight

  register_identity a seller
  register_identity b buyer
  [[ "${EMAIL[a]}" != "${EMAIL[b]}" \
    && "${INN[a]}" != "${INN[b]}" \
    && "${PHONE[a]}" != "${PHONE[b]}" \
    && "${APP_ID[a]}" != "${APP_ID[b]}" ]] \
    || fail P0_REGISTRATION_APPLICATIONS_NOT_DISTINCT 100

  reviewer_login
  activate_reviewer_control_plane
  approve_registrations

  customer_login a initial
  customer_login b initial
  read_customer_resource a
  read_customer_resource b
  assert_distinct_authority
  prove_bff_tenant_denial
  prove_postgresql_evidence

  logout_session customer-a "$TMP_ROOT/a.cookies"
  logout_session customer-b "$TMP_ROOT/b.cookies"

  prime_csrf "$TMP_ROOT/a.cookies"
  prime_csrf "$TMP_ROOT/b.cookies"
  customer_login a relogin
  customer_login b relogin
  read_customer_resource a
  read_customer_resource b
  logout_session customer-a-final "$TMP_ROOT/a.cookies"
  logout_session customer-b-final "$TMP_ROOT/b.cookies"
  end_reviewer_control_plane
  logout_session reviewer "$REVIEWER_JAR"

  CURRENT_STAGE=evidence-finalization
  assert_exact_main
  write_success_record
  unset PASSWORD MFA_SECRET PC_P0_REVIEWER_PASSWORD PC_P0_REVIEWER_TOTP_SECRET PC_P0_IMAP_PASSWORD
  FINISHED=1
  CURRENT_STAGE=complete
  printf 'P0_EXACT_CURRENT_MAIN=%s\n' "$TARGET_SHA"
  printf 'P0_PRODUCTION_REVISIONS=PASS\n'
  printf 'P0_MIGRATION_IMAGE_REVISION=PASS\n'
  printf 'P0_MAIL_DELIVERY_AND_VERIFICATION=PASS\n'
  printf 'P0_DECISION_REPLAY_NOTIFICATION=PASS\n'
  printf 'P0_STAFF_APPROVAL_RECENT_MFA=PASS\n'
  printf 'P0_TWO_CUSTOMER_MFA_RELOGIN=PASS\n'
  printf 'P0_PERMITTED_ACTION=PASS\n'
  printf 'P0_BFF_TENANT_DENIAL=PASS\n'
  printf 'P0_POSTGRES_RLS_A1_B0=PASS\n'
  printf 'P0_CAUSAL_AUDIT_OUTBOX=PASS\n'
  printf 'P0_ACCEPTANCE_STAGE=complete\n'
  printf 'P0_FIRST_CUSTOMER_ACCEPTANCE=PASS\n'
}

main "$@"
