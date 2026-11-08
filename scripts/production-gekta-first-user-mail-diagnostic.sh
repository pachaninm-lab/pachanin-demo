#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?}"
: "${GH_TOKEN:?}"
: "${TARGET_SHA:?}"
: "${SOURCE_RUN_ID:?}"
: "${SOURCE_RUN_ATTEMPT:?}"
: "${SOURCE_DEPLOYED_SHA:?}"
: "${SOURCE_WINDOW_SINCE:?}"
: "${SOURCE_WINDOW_UNTIL:?}"
: "${EMAIL_TEMPLATE:?}"
: "${IMAP_HOST:?}"
: "${IMAP_USER:?}"
: "${IMAP_PASSWORD:?}"
: "${PC_PROD_HOST:?}"
: "${PC_PROD_SSH_USER:?}"
: "${PC_PROD_SSH_HOST_FINGERPRINT:?}"

RELEASE_ISSUE_NUMBER='3072'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
key_path="$RUNNER_TEMP/gekta-mail-diagnostic-key"
known_hosts="$RUNNER_TEMP/gekta-mail-diagnostic-known-hosts"
published=0

cleanup() { rm -f -- "$key_path" "$known_hosts"; }
trap cleanup EXIT

guard_main() {
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
}

publish() {
  [[ "$published" == 0 ]] || return 0
  published=1
  local current_keys="${1:-UNPROVEN}" historical_keys="${2:-UNPROVEN}" bff_path="${3:-UNPROVEN}" mailbox="${4:-UNPROVEN}" link="${5:-UNPROVEN}"
  for value in "$current_keys" "$historical_keys" "$bff_path" "$mailbox" "$link"; do
    [[ "$value" =~ ^[A-Z0-9_]{1,80}$ ]]
  done
  guard_main || return 1
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production Gekta first-user mail diagnostic

- source failed run: \`31800628106\`
- source deployed revision: \`$SOURCE_DEPLOYED_SHA\`
- diagnostic current main: \`$TARGET_SHA\`
- current registration delivery keys: \`$current_keys\`
- source-run registration delivery keys: \`$historical_keys\`
- source-run BFF registration path: \`$bff_path\`
- mailbox location: \`$mailbox\`
- verification link parse: \`$link\`
- production mutation: \`NONE\`
- mail send / resend: \`NONE\`
- database / runtime / deployment mutation: \`NONE\`
- email / phone / token / correlation id / account hash / credentials / raw logs / raw mailbox: \`NOT_PUBLISHED\`
- new recurring cost: \`0 RUB\`" >/dev/null
}

on_error() {
  local rc=$?
  trap - ERR
  publish UNPROVEN UNPROVEN UNPROVEN UNPROVEN UNPROVEN || true
  exit "$rc"
}
trap on_error ERR

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$SOURCE_DEPLOYED_SHA" == 'f4cca72a0716c0fe2c94fd5e838d18be774b9812' ]]
[[ "$SOURCE_RUN_ID" == '31800628106' && "$SOURCE_RUN_ATTEMPT" == '1' ]]
[[ "$SOURCE_WINDOW_SINCE" == '2026-08-14T12:30:00Z' ]]
[[ "$SOURCE_WINDOW_UNTIL" == '2026-08-14T12:38:00Z' ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
git merge-base --is-ancestor "$SOURCE_DEPLOYED_SHA" "$TARGET_SHA"
[[ -z "$(git status --porcelain=v1)" ]]
guard_main

identity_marker="$(
  GEKTA_TEMPLATE="$EMAIL_TEMPLATE" GEKTA_SOURCE_RUN="${SOURCE_RUN_ID}-${SOURCE_RUN_ATTEMPT}" python3 <<'PY'
import hashlib, os, re
template = os.environ['GEKTA_TEMPLATE'].strip()
run = os.environ['GEKTA_SOURCE_RUN']
identity = 'gekta-' + re.sub(r'[^a-z0-9-]', '-', run.lower())[:44]
if template.count('{identity}') == 1 and '{run}' not in template and '{slot}' not in template:
    email = template.replace('{identity}', identity)
elif '{identity}' not in template and template.count('{run}') == 1 and template.count('{slot}') == 1:
    email = template.replace('{run}', run).replace('{slot}', 'gekta')
else:
    raise SystemExit(20)
email = email.strip().lower()
if len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
    raise SystemExit(21)
print('IDENTITY|' + hashlib.sha256(email.encode()).hexdigest()[:16])
PY
)"
[[ "$identity_marker" =~ ^IDENTITY\|[a-f0-9]{16}$ ]]
account_hash="${identity_marker#IDENTITY|}"

mail_marker="$(
  GEKTA_TEMPLATE="$EMAIL_TEMPLATE" \
  GEKTA_SOURCE_RUN="${SOURCE_RUN_ID}-${SOURCE_RUN_ATTEMPT}" \
  GEKTA_IMAP_HOST="$IMAP_HOST" \
  GEKTA_IMAP_PORT="${IMAP_PORT:-993}" \
  GEKTA_IMAP_USER="$IMAP_USER" \
  GEKTA_IMAP_PASSWORD="$IMAP_PASSWORD" \
  GEKTA_IMAP_FOLDER="${IMAP_FOLDER:-}" \
  GEKTA_SOURCE_SINCE="$SOURCE_WINDOW_SINCE" \
  GEKTA_SOURCE_UNTIL="$SOURCE_WINDOW_UNTIL" \
  python3 <<'PY'
import email, imaplib, os, re, ssl
from datetime import datetime
from email.policy import default
from email.utils import getaddresses, parsedate_to_datetime
from html import unescape
from urllib.parse import parse_qs, urlparse

def canonical_address(value):
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

def render_target():
    template = os.environ['GEKTA_TEMPLATE'].strip()
    run = os.environ['GEKTA_SOURCE_RUN']
    identity = 'gekta-' + re.sub(r'[^a-z0-9-]', '-', run.lower())[:44]
    if template.count('{identity}') == 1 and '{run}' not in template and '{slot}' not in template:
        raw = template.replace('{identity}', identity)
    elif '{identity}' not in template and template.count('{run}') == 1 and template.count('{slot}') == 1:
        raw = template.replace('{run}', run).replace('{slot}', 'gekta')
    else:
        return None
    return canonical_address(raw)

def body_text(message):
    rows = []
    iterator = message.walk() if message.is_multipart() else (message,)
    for part in iterator:
        if part.get_content_type() not in ('text/plain', 'text/html'):
            continue
        try:
            rows.append(part.get_content())
        except Exception:
            raw = part.get_payload(decode=True) or b''
            rows.append(raw.decode(part.get_content_charset() or 'utf-8', errors='replace'))
    return unescape('\n'.join(rows))

def folder_name(row):
    text = row.decode('utf-8', errors='replace').strip()
    match = re.search(r' (?:"((?:[^"\\]|\\.)*)"|([^ ]+))$', text)
    if not match:
        return None
    value = match.group(1) if match.group(1) is not None else match.group(2)
    return value.replace(r'\"', '"').replace(r'\\', '\\')

target = render_target()
if not target:
    print('MAILBOX|TARGET_INVALID|NO_LINK')
    raise SystemExit(0)

since = datetime.fromisoformat(os.environ['GEKTA_SOURCE_SINCE'].replace('Z', '+00:00')).timestamp() - 300
until = datetime.fromisoformat(os.environ['GEKTA_SOURCE_UNTIL'].replace('Z', '+00:00')).timestamp() + 300
configured = (os.environ.get('GEKTA_IMAP_FOLDER') or '').strip() or 'INBOX'
pattern = re.compile(r'https://[^\s<>"\']+/api/gekta/auth/email/verify\?[^\s<>"\']+', re.I)

try:
    client = imaplib.IMAP4_SSL(os.environ['GEKTA_IMAP_HOST'].strip(), int((os.environ.get('GEKTA_IMAP_PORT') or '993').strip()), ssl_context=ssl.create_default_context())
except Exception:
    print('MAILBOX|IMAP_CONNECT_FAILED|NO_LINK')
    raise SystemExit(0)

try:
    try:
        client.login(os.environ['GEKTA_IMAP_USER'], os.environ['GEKTA_IMAP_PASSWORD'])
    except Exception:
        print('MAILBOX|IMAP_AUTH_FAILED|NO_LINK')
        raise SystemExit(0)

    folders = [configured]
    if configured.upper() != 'INBOX':
        folders.append('INBOX')
    try:
        status, rows = client.list()
        if status == 'OK':
            for row in rows or []:
                name = folder_name(row)
                if name and name not in folders and len(folders) < 32:
                    folders.append(name)
    except Exception:
        pass

    def scan(folder):
        try:
            status, _ = client.select(folder, readonly=True)
            if status != 'OK':
                return ('FOLDER_UNAVAILABLE', 'NO_LINK')
            status, data = client.search(None, 'ALL')
            if status != 'OK':
                return ('SCAN_FAILED', 'NO_LINK')
        except Exception:
            return ('FOLDER_UNAVAILABLE', 'NO_LINK')
        identifiers = (data[0] or b'').split()[-2000:]
        recipient_seen = False
        best_link = 'NO_LINK'
        for identifier in reversed(identifiers):
            try:
                status, rows = client.fetch(identifier, '(BODY.PEEK[])')
            except Exception:
                continue
            if status != 'OK':
                continue
            raw = next((item[1] for item in rows if isinstance(item, tuple) and len(item) > 1), None)
            if not raw:
                continue
            message = email.message_from_bytes(raw, policy=default)
            try:
                sent_at = parsedate_to_datetime(message.get('date')).timestamp()
            except Exception:
                continue
            if sent_at < since or sent_at > until:
                continue
            recipients = []
            for header in ('to', 'cc', 'delivered-to', 'x-original-to', 'envelope-to'):
                for _, address in getaddresses(message.get_all(header, [])):
                    canonical = canonical_address(address)
                    if canonical:
                        recipients.append(canonical)
            if target not in recipients:
                continue
            recipient_seen = True
            text = body_text(message)
            if '/api/gekta/auth/email/verify' in text:
                best_link = 'VERIFY_PATH_ONLY'
            for candidate in pattern.findall(text):
                parsed = urlparse(candidate)
                token = (parse_qs(parsed.query).get('token') or [''])[0]
                if parsed.scheme != 'https' or parsed.path != '/api/gekta/auth/email/verify':
                    continue
                if 48 <= len(token) <= 512 and re.fullmatch(r'[A-Za-z0-9._~-]+', token):
                    return ('FOUND', 'VALID')
                best_link = 'INVALID_TOKEN'
        return ('FOUND' if recipient_seen else 'NONE', best_link)

    configured_state = None
    for index, folder in enumerate(folders):
        state, link = scan(folder)
        if index == 0:
            configured_state = state
        if state != 'FOUND':
            continue
        if index == 0:
            location = 'CONFIGURED'
        elif folder.upper() == 'INBOX':
            location = 'INBOX_NOT_CONFIGURED'
        else:
            location = 'OTHER_FOLDER'
        print(f'MAILBOX|{location}|{link}')
        raise SystemExit(0)

    if configured_state == 'FOLDER_UNAVAILABLE':
        print('MAILBOX|CONFIGURED_FOLDER_UNAVAILABLE|NO_LINK')
    elif configured_state == 'SCAN_FAILED':
        print('MAILBOX|IMAP_SCAN_FAILED|NO_LINK')
    else:
        print('MAILBOX|NONE|NO_LINK')
finally:
    try:
        client.logout()
    except Exception:
        pass
PY
)"
[[ "$mail_marker" =~ ^MAILBOX\|(CONFIGURED|INBOX_NOT_CONFIGURED|OTHER_FOLDER|CONFIGURED_FOLDER_UNAVAILABLE|IMAP_CONNECT_FAILED|IMAP_AUTH_FAILED|IMAP_SCAN_FAILED|TARGET_INVALID|NONE)\|(VALID|INVALID_TOKEN|VERIFY_PATH_ONLY|NO_LINK)$ ]]
IFS='|' read -r _ mailbox_location link_parse <<< "$mail_marker"

guard_main
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
host="$(trim "$PC_PROD_HOST")"
user="$(trim "$PC_PROD_SSH_USER")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "$PC_PROD_SSH_HOST_FINGERPRINT")"
[[ -n "$host" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
mapfile -t dns_ipv4 < <(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u)
(( ${#dns_ipv4[@]} >= 1 ))
printf '%s\n' "${dns_ipv4[@]}" | grep -Fxq "$host"

mkdir -p "$HOME/.ssh"
chmod 0700 "$HOME/.ssh"
validate_key() {
  local source="$1" public_key
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  public_key="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$public_key" 2>/dev/null || { rm -f "$public_key"; return 1; }
  rm -f "$public_key"
}
try_slot() {
  local raw="$1" a b c
  [[ -n "$raw" ]] || return 1
  a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"
  printf '%s\n' "$raw" > "$a"
  validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$b"
  validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }
  rm -f "$a" "$b" "$c"
  return 1
}
try_slot "${PC_PROD_SSH_KEY:-}" || try_slot "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_slot "${VPS_SSH_KEY:-}"

scan="$(mktemp)"; match="$(mktemp)"
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]]
while IFS= read -r line; do
  got="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$got" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
rm -f "$scan"
[[ "$(grep -c . "$match" || true)" == 1 ]]
mv "$match" "$known_hosts"
chmod 0600 "$known_hosts"

guard_main
ssh_common=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15)

runtime_marker="$(
  ssh "${ssh_common[@]}" "$user@$host" "bash -s -- '$SOURCE_DEPLOYED_SHA' '$SOURCE_WINDOW_SINCE' '$SOURCE_WINDOW_UNTIL' '$account_hash'" <<'REMOTE'
set -Eeuo pipefail
source_sha="$1"
since="$2"
until="$3"
account_hash="$4"
[[ "$source_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$account_hash" =~ ^[a-f0-9]{16}$ ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null
command -v python3 >/dev/null

mapfile -t current_web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
if (( ${#current_web_ids[@]} != 1 )); then
  printf '%s\n' 'CURRENT_KEYS|RUNTIME_UNAVAILABLE'
  printf '%s\n' 'HISTORICAL_KEYS|HISTORICAL_RUNTIME_UNAVAILABLE'
  printf '%s\n' 'BFF_PATH|HISTORICAL_LOG_UNAVAILABLE'
  printf '%s\n' 'PRODUCTION_MUTATION=NONE'
  exit 0
fi
current_web="${current_web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$current_web")"
if [[ -z "$project" ]]; then
  printf '%s\n' 'CURRENT_KEYS|RUNTIME_UNAVAILABLE'
  printf '%s\n' 'HISTORICAL_KEYS|HISTORICAL_RUNTIME_UNAVAILABLE'
  printf '%s\n' 'BFF_PATH|HISTORICAL_LOG_UNAVAILABLE'
  printf '%s\n' 'PRODUCTION_MUTATION=NONE'
  exit 0
fi
mapfile -t current_api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
if (( ${#current_api_ids[@]} != 1 )); then
  printf '%s\n' 'CURRENT_KEYS|RUNTIME_UNAVAILABLE'
  printf '%s\n' 'HISTORICAL_KEYS|HISTORICAL_RUNTIME_UNAVAILABLE'
  printf '%s\n' 'BFF_PATH|HISTORICAL_LOG_UNAVAILABLE'
  printf '%s\n' 'PRODUCTION_MUTATION=NONE'
  exit 0
fi
current_api="${current_api_ids[0]}"

read -r -d '' key_classifier <<'PY_KEY' || true
import hmac, json, sys
docs = json.load(sys.stdin)
def env(doc):
    result = {}
    for row in doc.get('Config', {}).get('Env', []) or []:
        key, sep, value = str(row).partition('=')
        if sep:
            result[key] = value
    return result
web, api = env(docs[0]), env(docs[1])
w = web.get('REGISTRATION_DELIVERY_KEY', '').strip()
a = api.get('REGISTRATION_DELIVERY_KEY', '').strip()
if len(w) < 32:
    print('MISSING_WEB')
elif len(a) < 32:
    print('MISSING_API')
elif hmac.compare_digest(w, a):
    print('MATCH')
else:
    print('MISMATCH')
PY_KEY
current_keys="$(docker inspect "$current_web" "$current_api" | python3 -c "$key_classifier")"
[[ "$current_keys" =~ ^(MATCH|MISSING_WEB|MISSING_API|MISMATCH)$ ]]

overlaps_window() {
  local id="$1" started finished
  started="$(docker inspect --format '{{.State.StartedAt}}' "$id")"
  finished="$(docker inspect --format '{{.State.FinishedAt}}' "$id")"
  python3 - "$started" "$finished" "$since" "$until" <<'PY'
from datetime import datetime
import sys
def dt(value): return datetime.fromisoformat(value.replace('Z', '+00:00'))
started, finished, since, until = sys.argv[1:]
try:
    s, lo, hi = dt(started), dt(since), dt(until)
except Exception:
    raise SystemExit(1)
if finished.startswith('0001-01-01T00:00:00'):
    print('1' if s <= hi else '0')
else:
    try: f = dt(finished)
    except Exception: raise SystemExit(1)
    print('1' if s <= hi and f >= lo else '0')
PY
}

historical_ids() {
  local service="$1" id rev overlap
  mapfile -t ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=$service")
  for id in "${ids[@]}"; do
    rev="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)"
    [[ "$rev" == "$source_sha" ]] || continue
    overlap="$(overlaps_window "$id" 2>/dev/null || printf '0')"
    [[ "$overlap" == 1 ]] || continue
    printf '%s\n' "$id"
  done
}
mapfile -t historical_web_ids < <(historical_ids web)
mapfile -t historical_api_ids < <(historical_ids api)

historical_state='FOUND'
if (( ${#historical_web_ids[@]} == 0 || ${#historical_api_ids[@]} == 0 )); then
  historical_state='UNAVAILABLE'
elif (( ${#historical_web_ids[@]} != 1 || ${#historical_api_ids[@]} != 1 )); then
  historical_state='AMBIGUOUS'
fi
historical_keys='HISTORICAL_RUNTIME_UNAVAILABLE'
bff_path='HISTORICAL_LOG_UNAVAILABLE'
if [[ "$historical_state" == AMBIGUOUS ]]; then
  historical_keys='HISTORICAL_RUNTIME_AMBIGUOUS'
  bff_path='HISTORICAL_LOG_AMBIGUOUS'
elif [[ "$historical_state" == FOUND ]]; then
  historical_web="${historical_web_ids[0]}"
  historical_api="${historical_api_ids[0]}"
  historical_keys="$(docker inspect "$historical_web" "$historical_api" | python3 -c "$key_classifier")"
  [[ "$historical_keys" =~ ^(MATCH|MISSING_WEB|MISSING_API|MISMATCH)$ ]]

  read -r -d '' log_classifier <<'PY_LOG' || true
import json, sys
needle = sys.argv[1]
best = 'NOT_FOUND'
rank = {'NOT_FOUND':0,'TRANSPORT_FAILURE':1,'API_REJECTED':2,'PUBLIC_SUPPRESSED':3,'DELIVERY_FAILED':4,'DELIVERED_SMTP':5,'DELIVERED_OTHER':5}
for line in sys.stdin:
    if needle not in line: continue
    start = line.find('{')
    try: payload = json.loads(line[start:]) if start >= 0 else {}
    except Exception: payload = {}
    if str(payload.get('accountHash', '')) != needle: continue
    candidate = None
    if 'gekta_registration_email_delivery_result' in line:
        delivered = payload.get('delivered') is True
        provider = str(payload.get('provider', ''))
        candidate = 'DELIVERED_SMTP' if delivered and provider == 'smtp' else 'DELIVERED_OTHER' if delivered else 'DELIVERY_FAILED'
    elif 'gekta_registration_public_request_accepted' in line: candidate = 'PUBLIC_SUPPRESSED'
    elif 'gekta_registration_api_rejected' in line: candidate = 'API_REJECTED'
    elif 'gekta_registration_transport_failure' in line: candidate = 'TRANSPORT_FAILURE'
    if candidate and rank[candidate] >= rank[best]: best = candidate
print(best)
PY_LOG
  set +e
  log_text="$(docker logs --since "$since" --until "$until" "$historical_web" 2>/dev/null)"
  log_rc=$?
  set -e
  if (( log_rc == 0 )); then
    bff_path="$(printf '%s\n' "$log_text" | python3 -c "$log_classifier" "$account_hash")"
    [[ "$bff_path" =~ ^(DELIVERED_SMTP|DELIVERED_OTHER|DELIVERY_FAILED|PUBLIC_SUPPRESSED|API_REJECTED|TRANSPORT_FAILURE|NOT_FOUND)$ ]]
  fi
fi

printf 'CURRENT_KEYS|%s\n' "$current_keys"
printf 'HISTORICAL_KEYS|%s\n' "$historical_keys"
printf 'BFF_PATH|%s\n' "$bff_path"
printf '%s\n' 'PRODUCTION_MUTATION=NONE'
REMOTE
)"

[[ "$runtime_marker" == *$'PRODUCTION_MUTATION=NONE'* ]]
current_line="$(printf '%s\n' "$runtime_marker" | grep '^CURRENT_KEYS|' | tail -1)"
historical_line="$(printf '%s\n' "$runtime_marker" | grep '^HISTORICAL_KEYS|' | tail -1)"
bff_line="$(printf '%s\n' "$runtime_marker" | grep '^BFF_PATH|' | tail -1)"
[[ "$current_line" =~ ^CURRENT_KEYS\|(MATCH|MISSING_WEB|MISSING_API|MISMATCH|RUNTIME_UNAVAILABLE)$ ]]
[[ "$historical_line" =~ ^HISTORICAL_KEYS\|(MATCH|MISSING_WEB|MISSING_API|MISMATCH|HISTORICAL_RUNTIME_UNAVAILABLE|HISTORICAL_RUNTIME_AMBIGUOUS)$ ]]
[[ "$bff_line" =~ ^BFF_PATH\|(DELIVERED_SMTP|DELIVERED_OTHER|DELIVERY_FAILED|PUBLIC_SUPPRESSED|API_REJECTED|TRANSPORT_FAILURE|NOT_FOUND|HISTORICAL_LOG_UNAVAILABLE|HISTORICAL_LOG_AMBIGUOUS)$ ]]
current_keys="${current_line#CURRENT_KEYS|}"
historical_keys="${historical_line#HISTORICAL_KEYS|}"
bff_path="${bff_line#BFF_PATH|}"

guard_main
publish "$current_keys" "$historical_keys" "$bff_path" "$mailbox_location" "$link_parse"
printf 'GEKTA_FIRST_USER_MAIL_DIAGNOSTIC=PASS\n'
