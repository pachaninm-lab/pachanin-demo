#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_PASSWORD_RESET_DIAGNOSTIC_COMMAND:?PC_PASSWORD_RESET_DIAGNOSTIC_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND_PREFIX='/production p0-password-reset-diagnose current-main '

command_value="$PC_PASSWORD_RESET_DIAGNOSTIC_COMMAND"
uuid_pattern='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
[[ "$command_value" =~ ^${COMMAND_PREFIX}(${uuid_pattern})$ ]]
correlation_id="${BASH_REMATCH[1],,}"
[[ "$correlation_id" =~ ^${uuid_pattern,,}$ ]]

key_path="$RUNNER_TEMP/pc-p0-password-reset-diagnostic-key"
known_hosts="$RUNNER_TEMP/pc-p0-password-reset-diagnostic-known-hosts"
TARGET_SHA='unknown'
stage='INITIAL'
result_published=0

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}

guard_main() {
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    [[ "$stage" =~ ^(INITIAL|MAIN_CONFIRMED|SSH_CONFIRMED|REMOTE_INSPECTION|RESULT_VALIDATION)$ ]]
    guard_main || true
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 password-reset diagnostic

- command: \`$command_value\`
- exact diagnostic main: \`$TARGET_SHA\`
- result: \`FAIL\`
- failure stage: \`$stage\`
- exit code: \`$rc\`
- production mutation: \`NONE_CONFIRMED_ONLY_IF_RESULT_MARKER_ABSENT\`
- raw runtime output: \`NOT_PUBLISHED\`" >/dev/null || true
  fi
  exit "$rc"
}

trap cleanup EXIT
trap publish_failure ERR

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
[[ -z "$(git status --porcelain=v1)" ]]
node scripts/check-production-p0-password-reset-diagnostic.mjs
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
match="$(mktemp)"
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]]
while IFS= read -r line; do
  fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
[[ "$(grep -c . "$match" || true)" == '1' ]]
mv "$match" "$known_hosts"
rm -f "$scan"
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
  "$user@$host" "bash -s -- '$correlation_id'" <<'REMOTE'
set -Eeuo pipefail
correlation_id="$1"
[[ "$correlation_id" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]
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
[[ "$api_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$web_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$api_revision" == "$web_revision" ]]

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
web_key_ready = len(web_key) >= 32
api_key_ready = len(api_key) >= 32
key_match = web_key_ready and api_key_ready and hmac.compare_digest(web_key, api_key)
api_url_ready = bool(web.get('API_URL', '').strip())
resend_ready = bool(web.get('RESEND_API_KEY', '').strip()) and bool(
    web.get('RESEND_FROM_EMAIL', '').strip() or web.get('PC_MAIL_FROM', '').strip()
)
smtp_ready = all(bool(web.get(name, '').strip()) for name in ('PC_SMTP_HOST', 'PC_SMTP_USER', 'PC_SMTP_PASS'))
mail_ready = resend_ready or smtp_ready
print('PASSWORD_RESET_CONFIG|' + '|'.join('1' if value else '0' for value in (
    api_url_ready, web_key_ready, api_key_ready, key_match, mail_ready,
)))
PY_ENV

config_marker="$(docker inspect "$web_id" "$api_id" | python3 -c "$env_classifier")"
[[ "$config_marker" =~ ^PASSWORD_RESET_CONFIG\|[01]\|[01]\|[01]\|[01]\|[01]$ ]]

read -r -d '' log_classifier <<'PY_LOG' || true
import json
import re
import sys

correlation_id = sys.argv[1]
result = None
for line in sys.stdin:
    if correlation_id not in line:
        continue
    marker = None
    if 'password_reset_request_configuration_error' in line:
        marker = 'CONFIGURATION_ERROR'
    elif 'password_reset_request_api_failure' in line:
        marker = 'API_FAILURE'
    elif 'password_reset_request_transport_failure' in line:
        marker = 'TRANSPORT_FAILURE'
    if marker is None:
        continue
    start = line.find('{')
    try:
        payload = json.loads(line[start:]) if start >= 0 else {}
    except json.JSONDecodeError:
        payload = {}
    if marker == 'CONFIGURATION_ERROR':
        result = (
            marker,
            '1' if payload.get('apiConfigured') is True else '0',
            '1' if payload.get('deliveryBoundaryConfigured') is True else '0',
            '1' if payload.get('mailConfigured') is True else '0',
            'NONE',
        )
    elif marker == 'API_FAILURE':
        status = payload.get('status')
        detail = str(status) if isinstance(status, int) and 400 <= status <= 599 else 'UNKNOWN'
        result = (marker, 'NONE', 'NONE', 'NONE', detail)
    else:
        reason = str(payload.get('reason', 'UNKNOWN'))
        detail = reason if re.fullmatch(r'[A-Za-z][A-Za-z0-9_.-]{0,63}', reason) else 'UNKNOWN'
        result = (marker, 'NONE', 'NONE', 'NONE', detail)

if result is None:
    result = ('NOT_FOUND', 'NONE', 'NONE', 'NONE', 'NONE')
print('PASSWORD_RESET_LOG|' + '|'.join(result))
PY_LOG

log_marker="$(docker logs --since 24h "$web_id" 2>&1 | python3 -c "$log_classifier" "$correlation_id")"
[[ "$log_marker" =~ ^PASSWORD_RESET_LOG\|(CONFIGURATION_ERROR|API_FAILURE|TRANSPORT_FAILURE|NOT_FOUND)\|(0|1|NONE)\|(0|1|NONE)\|(0|1|NONE)\|[A-Za-z0-9_.-]{1,64}$ ]]

printf 'PASSWORD_RESET_REVISION|%s\n' "$api_revision"
printf '%s\n' "$config_marker"
printf '%s\n' "$log_marker"
printf '%s\n' 'PRODUCTION_MUTATION=NONE'
REMOTE
)"

stage='RESULT_VALIDATION'
revision_marker="$(grep '^PASSWORD_RESET_REVISION|' <<< "$output" | tail -n1)"
config_marker="$(grep '^PASSWORD_RESET_CONFIG|' <<< "$output" | tail -n1)"
log_marker="$(grep '^PASSWORD_RESET_LOG|' <<< "$output" | tail -n1)"
mutation_marker="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"

IFS='|' read -r revision_tag deployed_revision <<< "$revision_marker"
IFS='|' read -r config_tag api_url_ready web_key_ready api_key_ready key_match mail_ready <<< "$config_marker"
IFS='|' read -r log_tag log_class log_api_ready log_delivery_ready log_mail_ready log_detail <<< "$log_marker"

[[ "$revision_tag" == 'PASSWORD_RESET_REVISION' && "$deployed_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$config_tag" == 'PASSWORD_RESET_CONFIG' ]]
for value in "$api_url_ready" "$web_key_ready" "$api_key_ready" "$key_match" "$mail_ready"; do
  [[ "$value" =~ ^[01]$ ]]
done
[[ "$log_tag" == 'PASSWORD_RESET_LOG' ]]
[[ "$log_class" =~ ^(CONFIGURATION_ERROR|API_FAILURE|TRANSPORT_FAILURE|NOT_FOUND)$ ]]
for value in "$log_api_ready" "$log_delivery_ready" "$log_mail_ready"; do
  [[ "$value" =~ ^(0|1|NONE)$ ]]
done
[[ "$log_detail" =~ ^[A-Za-z0-9_.-]{1,64}$ ]]
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
elif [[ "$log_class" == 'API_FAILURE' ]]; then
  blocker="UPSTREAM_API_$log_detail"
elif [[ "$log_class" == 'TRANSPORT_FAILURE' ]]; then
  blocker="UPSTREAM_TRANSPORT_$log_detail"
elif [[ "$log_class" == 'CONFIGURATION_ERROR' ]]; then
  blocker='WEB_CONFIGURATION_ERROR'
elif [[ "$log_class" == 'NOT_FOUND' ]]; then
  blocker='CORRELATED_LOG_NOT_FOUND'
fi
[[ "$blocker" =~ ^[A-Z0-9_.-]{1,96}$ ]]

guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 password-reset diagnostic

- command: \`$command_value\`
- exact diagnostic main: \`$TARGET_SHA\`
- exact deployed API/Web revision: \`$deployed_revision\`
- result: \`PASS\`
- API URL configured: \`$api_url_ready\`
- web delivery key ready: \`$web_key_ready\`
- API delivery key ready: \`$api_key_ready\`
- delivery keys match: \`$key_match\`
- transactional mail ready: \`$mail_ready\`
- correlated failure class: \`$log_class\`
- correlated safe detail: \`$log_detail\`
- blocker: \`$blocker\`
- production mutation: \`NONE\`
- raw environment/log output: \`NOT_PUBLISHED\`" >/dev/null
result_published=1
