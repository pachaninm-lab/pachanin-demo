#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
LIVE_BASE="https://$LIVE_DOMAIN"
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-http-diagnose current-main'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-http-diag-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-http-diag-known-hosts"
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
EXPECTED_DEPLOYED_SHA='unknown'
scan=''
match=''
result_published=0

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}
trap cleanup EXIT

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset HTTP diagnostic

- source SHA: \`$SOURCE_SHA\`
- current main at start: \`$CURRENT_MAIN\`
- expected deployed revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`FAIL_CLOSED\`
- reviewer identity exposure: \`NONE\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}
trap publish_failure ERR

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

guard_main() {
  local remote_main
  remote_main="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$remote_main" == "$CURRENT_MAIN" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
}

SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ && "$CURRENT_MAIN" =~ ^[0-9a-f]{40}$ ]]
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
EXPECTED_DEPLOYED_SHA="$CURRENT_MAIN"
[[ -z "$(git status --porcelain=v1)" ]]

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

try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

guard_main

domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"
scan="$(mktemp)"; match="$(mktemp)"
pinned_ready=0
for attempt in 1 2 3; do
  : > "$scan"
  : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true
  if [[ -s "$scan" ]]; then
    while IFS= read -r line; do
      fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    if [[ "$(grep -c . "$match" || true)" == '1' ]]; then
      pinned_ready=1
      break
    fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$pinned_ready" == '1' ]]
mv "$match" "$known_hosts"
match=''
rm -f -- "$scan"
scan=''
chmod 0600 "$known_hosts"

guard_main

output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$EXPECTED_DEPLOYED_SHA' '$LIVE_BASE'" <<'REMOTE'
set -Eeuo pipefail
expected_sha="$1"
live_base="$2"
[[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$live_base" == 'https://xn----8sbjf4befbjgs9b.xn--p1ai' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
command -v curl >/dev/null 2>&1

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
[[ "$api_revision" == "$expected_sha" && "$web_revision" == "$expected_sha" ]]

remote_tmp="$(mktemp -d /root/pc-reviewer-reset-http.XXXXXX)"
chmod 0700 "$remote_tmp"
trap 'rm -rf -- "$remote_tmp"' EXIT
jar="$remote_tmp/cookies.txt"
headers="$remote_tmp/headers.txt"
page="$remote_tmp/page.html"
probe_request="$remote_tmp/probe-request.json"
probe_response="$remote_tmp/probe-response.json"
probe_no_origin_response="$remote_tmp/probe-no-origin-response.json"
: > "$jar"; : > "$headers"; : > "$page"; : > "$probe_request"; : > "$probe_response"; : > "$probe_no_origin_response"
chmod 0600 "$jar" "$headers" "$page" "$probe_request" "$probe_response" "$probe_no_origin_response"

get_status="$(curl --silent --show-error --connect-timeout 10 --max-time 20 \
  --dump-header "$headers" --output "$page" --write-out '%{http_code}' \
  --cookie "$jar" --cookie-jar "$jar" \
  -H 'Cache-Control: no-cache, no-store, max-age=0' \
  "$live_base/platform-v7/forgot-password?lang=ru")"
csrf="$(awk -F '\t' '$6 == "pc_csrf_token" { value=$7 } END { print value }' "$jar")"
csrf_present=0; csrf_format=0
[[ -n "$csrf" ]] && csrf_present=1
[[ "$csrf" =~ ^[A-Za-z0-9_-]{24,128}$ ]] && csrf_format=1

post_status='000'; invalid_code=0; correlation_match=0
post_no_origin_status='000'; no_origin_invalid_code=0; no_origin_correlation_match=0
if [[ "$get_status" == '200' && "$csrf_format" == '1' ]]; then
  printf '%s' '{"email":"invalid","locale":"ru"}' > "$probe_request"

  correlation_id="$(cat /proc/sys/kernel/random/uuid)"
  [[ "$correlation_id" =~ ^[0-9a-f-]{36}$ ]]
  post_status="$(curl --silent --show-error --connect-timeout 10 --max-time 20 \
    --output "$probe_response" --write-out '%{http_code}' \
    --cookie "$jar" --cookie-jar "$jar" \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -H "Origin: $live_base" \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: $correlation_id" \
    --data-binary "@$probe_request" \
    "$live_base/api/auth/forgot-password")"
  grep -Eq '"code"[[:space:]]*:[[:space:]]*"INVALID_EMAIL"' "$probe_response" && invalid_code=1
  grep -Fq "\"correlationId\":\"$correlation_id\"" "$probe_response" && correlation_match=1

  correlation_id_no_origin="$(cat /proc/sys/kernel/random/uuid)"
  [[ "$correlation_id_no_origin" =~ ^[0-9a-f-]{36}$ ]]
  post_no_origin_status="$(curl --silent --show-error --connect-timeout 10 --max-time 20 \
    --output "$probe_no_origin_response" --write-out '%{http_code}' \
    --cookie "$jar" --cookie-jar "$jar" \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -H "x-csrf-token: $csrf" \
    -H "x-correlation-id: $correlation_id_no_origin" \
    --data-binary "@$probe_request" \
    "$live_base/api/auth/forgot-password")"
  grep -Eq '"code"[[:space:]]*:[[:space:]]*"INVALID_EMAIL"' "$probe_no_origin_response" && no_origin_invalid_code=1
  grep -Fq "\"correlationId\":\"$correlation_id_no_origin\"" "$probe_no_origin_response" && no_origin_correlation_match=1
fi
unset csrf

printf 'RESET_HTTP|%s|%s|%s|%s|%s|%s|%s|%s|%s\n' \
  "$get_status" "$csrf_present" "$csrf_format" \
  "$post_status" "$invalid_code" "$correlation_match" \
  "$post_no_origin_status" "$no_origin_invalid_code" "$no_origin_correlation_match"
printf 'API_REVISION=%s\n' "$api_revision"
printf 'WEB_REVISION=%s\n' "$web_revision"
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE
)"

marker="$(grep '^RESET_HTTP|' <<< "$output" | tail -n1)"
api_revision="$(grep '^API_REVISION=' <<< "$output" | tail -n1 | cut -d= -f2)"
web_revision="$(grep '^WEB_REVISION=' <<< "$output" | tail -n1 | cut -d= -f2)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$marker" =~ ^RESET_HTTP\|[0-9]{3}\|[01]\|[01]\|[0-9]{3}\|[01]\|[01]\|[0-9]{3}\|[01]\|[01]$ ]]
[[ "$api_revision" == "$EXPECTED_DEPLOYED_SHA" && "$web_revision" == "$EXPECTED_DEPLOYED_SHA" ]]
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
IFS='|' read -r _ get_status csrf_present csrf_format post_status invalid_code correlation_match post_no_origin_status no_origin_invalid_code no_origin_correlation_match <<< "$marker"

guard_main

result='FAIL_CLOSED'
classification='UNCLASSIFIED'
if [[ "$get_status" == '200' && "$csrf_present" == '1' && "$csrf_format" == '1' \
      && "$post_status" == '400' && "$invalid_code" == '1' && "$correlation_match" == '1' ]]; then
  classification='ORIGIN_AND_CSRF_PASS'
elif [[ "$get_status" == '200' && "$csrf_present" == '1' && "$csrf_format" == '1' \
        && "$post_status" == '403' && "$invalid_code" == '0' && "$correlation_match" == '1' \
        && "$post_no_origin_status" == '400' && "$no_origin_invalid_code" == '1' && "$no_origin_correlation_match" == '1' ]]; then
  classification='ORIGIN_MISMATCH'
elif [[ "$get_status" == '200' && "$csrf_present" == '1' && "$csrf_format" == '1' \
        && "$post_status" == '403' && "$invalid_code" == '0' && "$correlation_match" == '1' \
        && "$post_no_origin_status" == '403' && "$no_origin_invalid_code" == '0' && "$no_origin_correlation_match" == '1' ]]; then
  classification='CSRF_TOKEN_REJECTED'
fi
if [[ "$classification" == 'ORIGIN_AND_CSRF_PASS' ]]; then
  result='PASS_READ_ONLY'
fi

gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset HTTP diagnostic

- source/current-main SHA: \`$SOURCE_SHA\`
- inspected deployed revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`$result\`
- classification: \`$classification\`
- forgot-password GET status: \`$get_status\`
- CSRF cookie present / format valid: \`$csrf_present/$csrf_format\`
- invalid-input POST with public Origin status / INVALID_EMAIL / correlation: \`$post_status/$invalid_code/$correlation_match\`
- invalid-input POST without Origin status / INVALID_EMAIL / correlation: \`$post_no_origin_status/$no_origin_invalid_code/$no_origin_correlation_match\`
- reviewer identity exposure: \`NONE\`
- reset request sent: \`NO\`
- production mutation: \`NONE\`" >/dev/null
result_published=1
[[ "$result" == 'PASS_READ_ONLY' ]]
