#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_INCIDENT_COMMAND:?PC_REVIEWER_RESET_INCIDENT_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-incident-diagnose 31635866371'
INCIDENT_RUN_ID='31635866371'
INCIDENT_SINCE='2026-08-12T20:05:30Z'
INCIDENT_UNTIL='2026-08-12T20:06:00Z'
EXPECTED_DEPLOYED_SHA='58d7e1f80aa4482293e24eb7b0e111f7bf988d29'

[[ "$PC_REVIEWER_RESET_INCIDENT_COMMAND" == "$COMMAND" ]]

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-incident-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-incident-known-hosts"
TARGET_SHA='unknown'
stage='INITIAL'
result_published=0
scan=''
scan_raw=''
match=''

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$scan_raw" ]] || rm -f -- "$scan_raw"
  [[ -z "$match" ]] || rm -f -- "$match"
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

guard_main() {
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset incident diagnostic

- incident run: \`$INCIDENT_RUN_ID\`
- exact diagnostic main: \`$TARGET_SHA\`
- inspected deployed revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`FAIL_CLOSED\`
- failure stage: \`$stage\`
- reviewer identity exposure: \`NONE\`
- production mutation: \`NONE\`
- raw environment/log output: \`NOT_PUBLISHED\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}

trap cleanup EXIT
trap publish_failure ERR

TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"
[[ -z "$(git status --porcelain=v1)" ]]
stage='MAIN_CONFIRMED'

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"

[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]

validate_key() {
  local source="$1" public_key
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  public_key="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$public_key" 2>/dev/null \
    || { rm -f "$public_key"; return 1; }
  rm -f "$public_key"
}

try_key() {
  local raw="$1" plain escaped decoded
  [[ -n "$raw" ]] || return 1
  plain="$(mktemp)"
  escaped="$(mktemp)"
  decoded="$(mktemp)"
  printf '%s\n' "$raw" > "$plain"
  validate_key "$plain" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$escaped"
  validate_key "$escaped" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "$raw" | base64 --decode > "$decoded" 2>/dev/null \
    && validate_key "$decoded" \
    && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  rm -f "$plain" "$escaped" "$decoded"
  return 1
}

try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

guard_main

domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"

scan="$(mktemp)"
scan_raw="$(mktemp)"
match="$(mktemp)"
scan_ready=0
for attempt in 1 2 3; do
  : > "$scan_raw"
  : > "$scan"
  /usr/bin/ssh-keyscan -T 10 -p "$port" "$host" > "$scan_raw" 2>/dev/null || true
  if [[ -s "$scan_raw" ]]; then
    sort -u "$scan_raw" > "$scan"
    if [[ -s "$scan" ]]; then
      scan_ready=1
      break
    fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$scan_ready" == '1' ]]

while IFS= read -r line; do
  fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
[[ "$(grep -c . "$match" || true)" == '1' ]]
mv "$match" "$known_hosts"
match=''
rm -f -- "$scan" "$scan_raw"
scan=''
scan_raw=''
chmod 0600 "$known_hosts"

guard_main
ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' \
  >/dev/null
stage='SSH_CONFIRMED'

stage='REMOTE_INSPECTION'
output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$EXPECTED_DEPLOYED_SHA' '$INCIDENT_SINCE' '$INCIDENT_UNTIL'" <<'REMOTE'
set -Eeuo pipefail
expected_revision="$1"
incident_since="$2"
incident_until="$3"
[[ "$expected_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$incident_since" == '2026-08-12T20:05:30Z' ]]
[[ "$incident_until" == '2026-08-12T20:06:00Z' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
command -v python3 >/dev/null 2>&1

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$project" ]]
mapfile -t api_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"

api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" == "$expected_revision" ]]
[[ "$web_revision" == "$expected_revision" ]]

api_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$api_id")"
web_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$web_id")"
[[ "$api_state" =~ ^(healthy|running)$ ]]
[[ "$web_state" =~ ^(healthy|running)$ ]]

read -r -d '' env_classifier <<'PY_ENV' || true
import hmac
import json
import sys

documents = json.load(sys.stdin)
if not isinstance(documents, list) or len(documents) != 2:
    raise SystemExit(21)

def environment(document):
    values = {}
    for item in document.get('Config', {}).get('Env', []) or []:
        key, separator, value = str(item).partition('=')
        if separator:
            values[key] = value
    return values

web = environment(documents[0])
api = environment(documents[1])
web_key = web.get('PASSWORD_RESET_DELIVERY_KEY', '').strip()
api_key = api.get('PASSWORD_RESET_DELIVERY_KEY', '').strip()
api_url_ready = bool(web.get('API_URL', '').strip())
web_key_ready = len(web_key) >= 32
api_key_ready = len(api_key) >= 32
key_match = web_key_ready and api_key_ready and hmac.compare_digest(web_key, api_key)
resend_ready = bool(web.get('RESEND_API_KEY', '').strip()) and bool(
    web.get('RESEND_FROM_EMAIL', '').strip() or web.get('PC_MAIL_FROM', '').strip()
)
smtp_ready = all(bool(web.get(name, '').strip()) for name in ('PC_SMTP_HOST', 'PC_SMTP_USER', 'PC_SMTP_PASS'))
mail_ready = resend_ready or smtp_ready
print('RESET_INCIDENT_CONFIG|' + '|'.join('1' if value else '0' for value in (
    api_url_ready, web_key_ready, api_key_ready, key_match, resend_ready, smtp_ready, mail_ready,
)))
PY_ENV

config_marker="$(docker inspect "$web_id" "$api_id" | python3 -c "$env_classifier")"
[[ "$config_marker" =~ ^RESET_INCIDENT_CONFIG\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]$ ]]

read -r -d '' incident_classifier <<'PY_INCIDENT' || true
import json
import re
import sys

uuid_re = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
events = []
correlations = set()

def safe_transport(reason):
    mapping = {
        'AbortError': 'ABORT',
        'TimeoutError': 'TIMEOUT',
        'TypeError': 'TYPE_ERROR',
        'FetchError': 'FETCH_ERROR',
    }
    return mapping.get(reason, 'UNKNOWN')

def delivery_detail(provider, reason, delivered):
    provider = provider if provider in {'smtp', 'resend', 'none'} else 'none'
    if delivered:
        if provider == 'smtp':
            return 'SMTP_SENT'
        if provider == 'resend':
            return 'RESEND_SENT'
        return 'PROVIDER_SENT'
    text = str(reason or '')
    if provider == 'smtp':
        match = re.search(r'smtp_(\d{3})', text)
        if match:
            return f'SMTP_{match.group(1)}'
        if 'smtp_timeout' in text:
            return 'SMTP_TIMEOUT'
        return 'SMTP_UNKNOWN'
    if provider == 'resend':
        match = re.search(r'resend_(\d{3})', text)
        if match:
            return f'RESEND_{match.group(1)}'
        if 'AbortError' in text or 'aborted' in text.lower():
            return 'RESEND_ABORT'
        return 'RESEND_UNKNOWN'
    return 'NO_PROVIDER'

for line in sys.stdin:
    marker = None
    if 'password_reset_request_configuration_error' in line:
        marker = 'CONFIGURATION_ERROR'
    elif 'password_reset_request_api_failure' in line:
        marker = 'API_FAILURE'
    elif 'password_reset_request_transport_failure' in line:
        marker = 'TRANSPORT_FAILURE'
    elif 'password_reset_delivery_result' in line:
        marker = 'DELIVERY_RESULT'
    elif 'password_reset_request_accepted_without_delivery' in line:
        marker = 'ACCEPTED_WITHOUT_DELIVERY'
    if marker is None:
        continue
    start = line.find('{')
    try:
        payload = json.loads(line[start:]) if start >= 0 else {}
    except json.JSONDecodeError:
        payload = {}
    correlation_id = str(payload.get('correlationId', ''))
    if not uuid_re.fullmatch(correlation_id):
        continue
    correlations.add(correlation_id.lower())
    if marker == 'CONFIGURATION_ERROR':
        events.append(('CONFIGURATION_ERROR', 'CONFIG'))
    elif marker == 'API_FAILURE':
        status = payload.get('status')
        detail = f'HTTP_{status}' if isinstance(status, int) and 400 <= status <= 599 else 'HTTP_UNKNOWN'
        events.append(('API_FAILURE', detail))
    elif marker == 'TRANSPORT_FAILURE':
        events.append(('TRANSPORT_FAILURE', safe_transport(str(payload.get('reason', 'UNKNOWN')))))
    elif marker == 'DELIVERY_RESULT':
        delivered = payload.get('delivered') is True
        detail = delivery_detail(str(payload.get('provider', 'none')), payload.get('reason'), delivered)
        events.append(('DELIVERY_OK' if delivered else 'DELIVERY_FAILED', detail))
    else:
        events.append(('ACCEPTED_WITHOUT_DELIVERY', 'NONE'))

if not events:
    result = ('NOT_FOUND', 'NONE')
elif len(correlations) != 1:
    result = ('AMBIGUOUS', 'MULTIPLE_CORRELATIONS')
else:
    classes = {kind for kind, _ in events}
    terminal_classes = classes & {'CONFIGURATION_ERROR', 'API_FAILURE', 'TRANSPORT_FAILURE', 'DELIVERY_FAILED', 'ACCEPTED_WITHOUT_DELIVERY', 'DELIVERY_OK'}
    if len(terminal_classes) != 1:
        result = ('AMBIGUOUS', 'MIXED_EVENTS')
    else:
        kind = next(iter(terminal_classes))
        details = {detail for event_kind, detail in events if event_kind == kind}
        result = (kind, next(iter(details)) if len(details) == 1 else 'MULTIPLE_DETAILS')

print(f'RESET_INCIDENT_LOG|{result[0]}|{result[1]}|{len(correlations)}|{len(events)}')
PY_INCIDENT

incident_marker="$(docker logs --since "$incident_since" --until "$incident_until" "$web_id" 2>&1 \
  | python3 -c "$incident_classifier")"
[[ "$incident_marker" =~ ^RESET_INCIDENT_LOG\|(CONFIGURATION_ERROR|API_FAILURE|TRANSPORT_FAILURE|DELIVERY_FAILED|ACCEPTED_WITHOUT_DELIVERY|DELIVERY_OK|NOT_FOUND|AMBIGUOUS)\|[A-Z0-9_]{1,64}\|[0-9]+\|[0-9]+$ ]]

printf 'RESET_INCIDENT_REVISION|%s\n' "$api_revision"
printf '%s\n' "$config_marker"
printf '%s\n' "$incident_marker"
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE
)"

stage='RESULT_VALIDATION'
revision_marker="$(grep '^RESET_INCIDENT_REVISION|' <<< "$output" | tail -n1)"
config_marker="$(grep '^RESET_INCIDENT_CONFIG|' <<< "$output" | tail -n1)"
incident_marker="$(grep '^RESET_INCIDENT_LOG|' <<< "$output" | tail -n1)"
mutation_marker="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"

IFS='|' read -r revision_tag deployed_revision <<< "$revision_marker"
IFS='|' read -r config_tag api_url_ready web_key_ready api_key_ready key_match resend_ready smtp_ready mail_ready <<< "$config_marker"
IFS='|' read -r incident_tag incident_class incident_detail correlation_count event_count <<< "$incident_marker"

[[ "$revision_tag" == 'RESET_INCIDENT_REVISION' ]]
[[ "$deployed_revision" == "$EXPECTED_DEPLOYED_SHA" ]]
[[ "$config_tag" == 'RESET_INCIDENT_CONFIG' ]]
for value in "$api_url_ready" "$web_key_ready" "$api_key_ready" "$key_match" "$resend_ready" "$smtp_ready" "$mail_ready"; do
  [[ "$value" =~ ^[01]$ ]]
done
[[ "$incident_tag" == 'RESET_INCIDENT_LOG' ]]
[[ "$incident_class" =~ ^(CONFIGURATION_ERROR|API_FAILURE|TRANSPORT_FAILURE|DELIVERY_FAILED|ACCEPTED_WITHOUT_DELIVERY|DELIVERY_OK|NOT_FOUND|AMBIGUOUS)$ ]]
[[ "$incident_detail" =~ ^[A-Z0-9_]{1,64}$ ]]
[[ "$correlation_count" =~ ^[0-9]+$ ]]
[[ "$event_count" =~ ^[0-9]+$ ]]
[[ "$mutation_marker" == 'PRODUCTION_MUTATION=NONE' ]]

blocker='NONE'
if [[ "$api_url_ready" != '1' ]]; then
  blocker='WEB_API_URL_MISSING'
elif [[ "$web_key_ready" != '1' ]]; then
  blocker='WEB_DELIVERY_KEY_MISSING'
elif [[ "$api_key_ready" != '1' ]]; then
  blocker='API_DELIVERY_KEY_MISSING'
elif [[ "$key_match" != '1' ]]; then
  blocker='DELIVERY_KEY_MISMATCH'
elif [[ "$mail_ready" != '1' ]]; then
  blocker='WEB_MAIL_CHANNEL_MISSING'
else
  case "$incident_class" in
    CONFIGURATION_ERROR) blocker='INCIDENT_CONFIGURATION_ERROR' ;;
    API_FAILURE) blocker="INCIDENT_UPSTREAM_${incident_detail}" ;;
    TRANSPORT_FAILURE) blocker="INCIDENT_TRANSPORT_${incident_detail}" ;;
    DELIVERY_FAILED) blocker="INCIDENT_MAIL_${incident_detail}" ;;
    ACCEPTED_WITHOUT_DELIVERY) blocker='INCIDENT_ACCEPTED_WITHOUT_DELIVERY' ;;
    DELIVERY_OK) blocker='RESET_WORKFLOW_EVIDENCE_MISMATCH' ;;
    NOT_FOUND) blocker='INCIDENT_EVENT_NOT_FOUND' ;;
    AMBIGUOUS) blocker='INCIDENT_AMBIGUOUS' ;;
  esac
fi
[[ "$blocker" =~ ^[A-Z0-9_]{1,96}$ ]]

guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset incident diagnostic

- incident run: \`$INCIDENT_RUN_ID\`
- incident window UTC: \`$INCIDENT_SINCE .. $INCIDENT_UNTIL\`
- exact diagnostic main: \`$TARGET_SHA\`
- inspected deployed revision: \`$deployed_revision\`
- result: \`PASS_READ_ONLY_CLASSIFIED\`
- API URL configured: \`$api_url_ready\`
- web delivery key ready: \`$web_key_ready\`
- API delivery key ready: \`$api_key_ready\`
- delivery keys match: \`$key_match\`
- Resend ready: \`$resend_ready\`
- SMTP ready: \`$smtp_ready\`
- transactional mail ready: \`$mail_ready\`
- incident class: \`$incident_class\`
- incident safe detail: \`$incident_detail\`
- unique correlation count: \`$correlation_count\`
- relevant event count: \`$event_count\`
- blocker: \`$blocker\`
- reviewer identity exposure: \`NONE\`
- auth/reset request replay: \`NONE\`
- production mutation: \`NONE\`
- raw environment/log output: \`NOT_PUBLISHED\`" >/dev/null

result_published=1
stage='DONE'
printf 'P0_REVIEWER_RESET_INCIDENT_DIAGNOSTIC=PASS\n'
