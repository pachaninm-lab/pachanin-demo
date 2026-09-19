#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER:?PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
CONTINUATION_ISSUE_NUMBER='4637'
RELEASE_ISSUE_NUMBER="$PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER"
[[ "$RELEASE_ISSUE_NUMBER" == "$CONTINUATION_ISSUE_NUMBER" ]]

SOURCE_RUN='33322244053-1'
SOURCE_REVISION='5c4d50824baf78cdf26e062b621184d2500e5217'
SOURCE_SHORT='5c4d50824baf'
LOG_SINCE='2026-08-30T16:49:08Z'
LOG_UNTIL='2026-08-30T16:49:24Z'
DECISION_CORRELATION="p0-all-role-employee-join:${SOURCE_SHORT}:${SOURCE_RUN}"

key_path="$RUNNER_TEMP/pc-p0-employee-notification-key"
known_hosts="$RUNNER_TEMP/pc-p0-employee-notification-known-hosts"
TARGET_SHA='unknown'
result_published=0
notification_class='NOT_RUN'
notification_attempt='U'
notification_delivered='U'
upstream_class='UNKNOWN'

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 employee join notification-path diagnostic

- diagnostic main: \`$TARGET_SHA\`
- source run: \`$SOURCE_RUN\`
- source API revision: \`$SOURCE_REVISION\`
- result: \`FAIL\`
- blocker: \`EMPLOYEE_NOTIFICATION_PATH_INSPECT_FAILED_CLOSED\`
- notification class/attempted/delivered: \`$notification_class/$notification_attempt/$notification_delivered\`
- upstream class: \`$upstream_class\`
- production mutation: \`NONE\`
- employee decision replay: \`NONE\`
- raw logs, identifiers, credentials, URLs or error messages published: \`0\`
- exit code: \`$rc\`" >/dev/null || true
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

guard_main() {
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
}

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
  plain="$(mktemp)"; escaped="$(mktemp)"; decoded="$(mktemp)"
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

TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
git merge-base --is-ancestor "$SOURCE_REVISION" "$TARGET_SHA"

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

guard_main
mapfile -t domain_ips < <(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u)
(( ${#domain_ips[@]} >= 1 ))
printf '%s\n' "${domain_ips[@]}" | grep -Fxq "$DEFAULT_HOST"

scan="$(mktemp)"; match="$(mktemp)"
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
  "$user@$host" 'set -euo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null

guard_main
output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
  "$user@$host" "bash -s -- '$SOURCE_REVISION' '$LOG_SINCE' '$LOG_UNTIL' '$DECISION_CORRELATION'" <<'REMOTE'
set -Eeuo pipefail
revision="$1"; since="$2"; until="$3"; decision_correlation="$4"
[[ "$revision" == '5c4d50824baf78cdf26e062b621184d2500e5217' ]]
[[ "$since" == '2026-08-30T16:49:08Z' ]]
[[ "$until" == '2026-08-30T16:49:24Z' ]]
[[ "$decision_correlation" == 'p0-all-role-employee-join:5c4d50824baf:33322244053-1' ]]
[[ "$(id -u)" -eq 0 ]]

log_file="$(mktemp)"
trap 'rm -f "$log_file"' EXIT
mapfile -t web_ids < <(docker ps -aq --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} >= 1 && ${#web_ids[@]} <= 32 ))
matched=0
for id in "${web_ids[@]}"; do
  current_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)"
  if [[ "$current_revision" == "$revision" ]]; then
    matched=$((matched + 1))
    docker logs --since "$since" --until "$until" "$id" >> "$log_file" 2>&1 || true
  fi
done
(( matched >= 1 && matched <= 8 ))

python3 - "$decision_correlation" "$log_file" <<'PY'
import json
import sys

correlation, path = sys.argv[1:]
result_values = set()
notification_failure = False
upstream_values = set()

markers = (
    'organization_join_decision_notification_result',
    'organization_join_decision_notification_failure',
    'organization_join_decision_upstream_failure',
)

def payload_after(line, marker):
    start = line.find(marker)
    if start < 0:
        return None
    tail = line[start + len(marker):].strip()
    brace = tail.find('{')
    if brace < 0:
        return None
    try:
        value, _ = json.JSONDecoder().raw_decode(tail[brace:])
    except Exception:
        return None
    return value if isinstance(value, dict) else None

with open(path, encoding='utf-8', errors='replace') as handle:
    for line in handle:
        if correlation not in line:
            continue
        for marker in markers:
            if marker not in line:
                continue
            payload = payload_after(line, marker)
            if not payload or payload.get('correlationId') != correlation:
                continue
            if marker.endswith('notification_result'):
                delivered = payload.get('delivered')
                if isinstance(delivered, bool):
                    result_values.add(delivered)
            elif marker.endswith('notification_failure'):
                if payload.get('failureClass') == 'NOTIFICATION_TRANSPORT':
                    notification_failure = True
            else:
                failure_class = payload.get('failureClass')
                if failure_class in ('UPSTREAM_TIMEOUT', 'UPSTREAM_TRANSPORT'):
                    upstream_values.add(failure_class)

signals = int(bool(result_values)) + int(notification_failure) + int(bool(upstream_values))
if len(result_values) > 1 or len(upstream_values) > 1 or signals > 1:
    classification, attempted, delivered, upstream = 'AMBIGUOUS_EXACT_SIGNAL', 'U', 'U', 'AMBIGUOUS'
elif result_values == {True}:
    classification, attempted, delivered, upstream = 'NOTIFICATION_RESULT_DELIVERED', '1', '1', 'NONE'
elif result_values == {False}:
    classification, attempted, delivered, upstream = 'NOTIFICATION_RESULT_NOT_DELIVERED', '1', '0', 'NONE'
elif notification_failure:
    classification, attempted, delivered, upstream = 'NOTIFICATION_TRANSPORT_FAILURE', '1', '0', 'NONE'
elif upstream_values == {'UPSTREAM_TIMEOUT'}:
    classification, attempted, delivered, upstream = 'UPSTREAM_TIMEOUT_BEFORE_NOTIFICATION', '0', '0', 'UPSTREAM_TIMEOUT'
elif upstream_values == {'UPSTREAM_TRANSPORT'}:
    classification, attempted, delivered, upstream = 'UPSTREAM_TRANSPORT_BEFORE_NOTIFICATION', '0', '0', 'UPSTREAM_TRANSPORT'
else:
    classification, attempted, delivered, upstream = 'NO_EXACT_NOTIFICATION_SIGNAL', 'U', 'U', 'NONE'

print(f'EMPLOYEE_JOIN_NOTIFICATION|{classification}|{attempted}|{delivered}|{upstream}')
PY
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE
)"

marker="$(grep '^EMPLOYEE_JOIN_NOTIFICATION|' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
IFS='|' read -r tag notification_class notification_attempt notification_delivered upstream_class <<< "$marker"
[[ "$tag" == 'EMPLOYEE_JOIN_NOTIFICATION' ]]
[[ "$notification_class" =~ ^[A-Z0-9_]{3,96}$ ]]
[[ "$notification_attempt" =~ ^[01U]$ ]]
[[ "$notification_delivered" =~ ^[01U]$ ]]
[[ "$upstream_class" =~ ^[A-Z0-9_]{3,32}$ ]]
unset output

guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 employee join notification-path diagnostic

- diagnostic main: \`$TARGET_SHA\`
- source run: \`$SOURCE_RUN\`
- source API revision: \`$SOURCE_REVISION\`
- result: \`PASS\`
- exact-correlation notification class: \`$notification_class\`
- notification attempted: \`$notification_attempt\`
- notification delivered: \`$notification_delivered\`
- upstream failure class: \`$upstream_class\`
- source log window: \`$LOG_SINCE..$LOG_UNTIL\`
- employee decision replay: \`NONE\`
- production mutation: \`NONE\`
- raw logs, identifiers, credentials, URLs or error messages published: \`0\`" >/dev/null
result_published=1
