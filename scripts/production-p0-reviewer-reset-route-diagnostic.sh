#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
LIVE_BASE="https://$LIVE_DOMAIN"
DEFAULT_HOST='195.19.12.120'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-route-diagnostic current-runtime'

TARGET_SHA='unknown'
RUNTIME_SHA='unknown'
failure_reason='BOOTSTRAP_FAILED'
result_published=0
key_path="$RUNNER_TEMP/p0-reviewer-reset-route-diagnostic-key"
known_hosts="$RUNNER_TEMP/p0-reviewer-reset-route-diagnostic-known-hosts"
raw="$RUNNER_TEMP/p0-reviewer-reset-route-diagnostic.raw"
scan=''
match=''

cleanup() {
  rm -f -- "$key_path" "$known_hosts" "$raw"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}

publish_failure() {
  local rc="$?" deployed='unknown'
  trap - ERR
  [[ "$failure_reason" =~ ^[A-Z0-9_]{1,96}$ ]] || failure_reason='UNCLASSIFIED_FAILURE'
  [[ "$RUNTIME_SHA" =~ ^[0-9a-f]{40}$ ]] && deployed="$RUNTIME_SHA"
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset route diagnostic

- exact main: \`$TARGET_SHA\`
- live runtime revision: \`$deployed\`
- result: \`FAIL_CLOSED\`
- reset request sent: \`NO\`
- reviewer identity exposure: \`NONE\`
- production mutation: \`NONE\`
- blocker: \`$failure_reason\`" >/dev/null || true
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

failure_reason='MAIN_GUARD_FAILED'
TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
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
  local source="$1" pub
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  pub="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }
  rm -f "$pub"
}

try_key() {
  local value="$1" plain escaped decoded
  [[ -n "$value" ]] || return 1
  plain="$(mktemp)"; escaped="$(mktemp)"; decoded="$(mktemp)"
  printf '%s\n' "$value" > "$plain"
  validate_key "$plain" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "${value//\\n/$'\n'}" > "$escaped"
  validate_key "$escaped" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "$value" | base64 --decode > "$decoded" 2>/dev/null \
    && validate_key "$decoded" \
    && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  rm -f "$plain" "$escaped" "$decoded"
  return 1
}

failure_reason='SSH_PRIVATE_KEY_INVALID'
try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

failure_reason='DNS_IP_GUARD_FAILED'
guard_main
domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"

failure_reason='SSH_HOST_KEY_GUARD_FAILED'
scan="$(mktemp)"; match="$(mktemp)"
pinned_ready=0
for attempt in 1 2 3; do
  : > "$scan"; : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true
  if [[ -s "$scan" ]]; then
    while IFS= read -r line; do
      fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    if [[ "$(grep -c . "$match" || true)" == '1' ]]; then pinned_ready=1; break; fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$pinned_ready" == '1' ]]
mv "$match" "$known_hosts"; match=''
rm -f "$scan"; scan=''
chmod 0600 "$known_hosts"

failure_reason='REMOTE_ROUTE_DIAGNOSTIC_FAILED'
guard_main
trap - ERR
set +e
ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$LIVE_BASE' '$LIVE_DOMAIN'" >"$raw" 2>&1 <<'REMOTE'
set -Eeuo pipefail
live_base="$1"
live_domain="$2"
emit(){ printf '%s=%s\n' "$1" "$2"; }
fail(){ emit ROUTE_DIAGNOSTIC FAIL; emit ERROR_CODE "$1"; emit PRODUCTION_MUTATION NONE; exit "${2:-1}"; }

[[ "$live_base" == 'https://xn----8sbjf4befbjgs9b.xn--p1ai' ]] || fail LIVE_BASE_CONTRACT_INVALID 20
[[ "$live_domain" == 'xn----8sbjf4befbjgs9b.xn--p1ai' ]] || fail LIVE_DOMAIN_CONTRACT_INVALID 21
[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED 22
command -v docker >/dev/null 2>&1 || fail DOCKER_MISSING 23
command -v curl >/dev/null 2>&1 || fail CURL_MISSING 24

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || fail WEB_CARDINALITY_NOT_ONE 30
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id" 2>/dev/null || true)"
[[ -n "$project" ]] || fail COMPOSE_PROJECT_MISSING 31
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
mapfile -t worker_ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker')
(( ${#api_ids[@]} == 1 )) || fail API_CARDINALITY_NOT_ONE 32
(( ${#worker_ids[@]} == 1 )) || fail AUTH_MAIL_WORKER_CARDINALITY_NOT_ONE 33
api_id="${api_ids[0]}"; worker_id="${worker_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id" 2>/dev/null || true)"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id" 2>/dev/null || true)"
worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker_id" 2>/dev/null || true)"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ && "$web_revision" =~ ^[0-9a-f]{40}$ && "$worker_revision" =~ ^[0-9a-f]{40}$ ]] || fail RUNTIME_REVISION_INVALID 34
[[ "$api_revision" == "$web_revision" && "$api_revision" == "$worker_revision" ]] || fail RUNTIME_REVISION_PARITY_FAILED 35

runtime_sha="$api_revision"
tmp="$(mktemp -d /root/p0-reviewer-reset-route-diag.XXXXXX)"
trap 'rm -rf -- "$tmp"' EXIT
extract_code(){ grep -Eo '"code"[[:space:]]*:[[:space:]]*"[A-Z0-9_]{1,96}"' "$1" | tail -n 1 | sed -E 's/.*"([A-Z0-9_]{1,96})"/\1/' || true; }

ext_jar="$tmp/ext.cookies"; ext_page="$tmp/ext.page"; ext_body="$tmp/ext.body"
: > "$ext_jar"; : > "$ext_body"; chmod 0600 "$ext_jar" "$ext_body"
ext_get="$(curl --silent --show-error --connect-timeout 10 --max-time 20 --output "$ext_page" --write-out '%{http_code}' --cookie "$ext_jar" --cookie-jar "$ext_jar" -H 'Cache-Control: no-cache, no-store, max-age=0' "$live_base/platform-v7/forgot-password?lang=ru")"
[[ "$ext_get" == '200' ]] || fail PUBLIC_GET_NOT_200 40
ext_csrf="$(awk -F '\t' '$6 == "pc_csrf_token" { value=$7 } END { print value }' "$ext_jar")"
[[ "$ext_csrf" =~ ^[A-Za-z0-9_-]{24,128}$ ]] || fail PUBLIC_CSRF_COOKIE_INVALID 41
ext_status="$(curl --silent --show-error --connect-timeout 10 --max-time 20 --output "$ext_body" --write-out '%{http_code}' --cookie "$ext_jar" --cookie-jar "$ext_jar" -H 'Accept: application/json' -H 'Content-Type: application/json' -H "Origin: $live_base" -H "x-csrf-token: $ext_csrf" --data-binary '{"email":"invalid","locale":"ru"}' "$live_base/api/auth/forgot-password")"
ext_code="$(extract_code "$ext_body")"
unset ext_csrf
[[ "$ext_status" =~ ^[0-9]{3}$ ]] || fail PUBLIC_POST_STATUS_INVALID 42
[[ -z "$ext_code" || "$ext_code" =~ ^[A-Z0-9_]{1,96}$ ]] || fail PUBLIC_POST_CODE_INVALID 43

web_ip="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{println .IPAddress}}{{end}}' "$web_id" 2>/dev/null | awk 'NF { print; exit }')"
[[ "$web_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail WEB_CONTAINER_IP_INVALID 50
web_port="$(docker exec "$web_id" /nodejs/bin/node -e 'process.stdout.write(String(process.env.PORT || 3000))' 2>/dev/null || true)"
[[ "$web_port" =~ ^[0-9]+$ ]] && (( web_port >= 1 && web_port <= 65535 )) || fail WEB_CONTAINER_PORT_INVALID 51
web_base="http://$web_ip:$web_port"
web_jar="$tmp/web.cookies"; web_page="$tmp/web.page"; web_body="$tmp/web.body"
: > "$web_jar"; : > "$web_body"; chmod 0600 "$web_jar" "$web_body"
web_get="$(curl --silent --show-error --connect-timeout 5 --max-time 15 --output "$web_page" --write-out '%{http_code}' --cookie "$web_jar" --cookie-jar "$web_jar" -H "Host: $live_domain" -H 'X-Forwarded-Proto: https' -H 'Cache-Control: no-cache, no-store, max-age=0' "$web_base/platform-v7/forgot-password?lang=ru")"
[[ "$web_get" == '200' ]] || fail WEB_DIRECT_GET_NOT_200 52
web_csrf="$(awk -F '\t' '$6 == "pc_csrf_token" { value=$7 } END { print value }' "$web_jar")"
[[ "$web_csrf" =~ ^[A-Za-z0-9_-]{24,128}$ ]] || fail WEB_DIRECT_CSRF_COOKIE_INVALID 53
web_status="$(curl --silent --show-error --connect-timeout 5 --max-time 15 --output "$web_body" --write-out '%{http_code}' --cookie "$web_jar" --cookie-jar "$web_jar" -H "Host: $live_domain" -H 'X-Forwarded-Proto: https' -H 'Accept: application/json' -H 'Content-Type: application/json' -H "Origin: $live_base" -H "x-csrf-token: $web_csrf" --data-binary '{"email":"invalid","locale":"ru"}' "$web_base/api/auth/forgot-password")"
web_code="$(extract_code "$web_body")"
unset web_csrf
[[ "$web_status" =~ ^[0-9]{3}$ ]] || fail WEB_DIRECT_POST_STATUS_INVALID 54
[[ -z "$web_code" || "$web_code" =~ ^[A-Z0-9_]{1,96}$ ]] || fail WEB_DIRECT_POST_CODE_INVALID 55

external_pass=0; web_pass=0
[[ "$ext_status" == '400' && "$ext_code" == 'INVALID_EMAIL' ]] && external_pass=1
[[ "$web_status" == '400' && "$web_code" == 'INVALID_EMAIL' ]] && web_pass=1
if [[ "$external_pass" == '1' && "$web_pass" == '1' ]]; then
  classification='PUBLIC_AND_WEB_BFF_PASS'
elif [[ "$external_pass" == '0' && "$web_pass" == '1' ]]; then
  classification='PUBLIC_ROUTE_DIVERGES_FROM_WEB_BFF'
elif [[ "$external_pass" == '1' && "$web_pass" == '0' ]]; then
  classification='WEB_DIRECT_ROUTE_DIVERGES'
else
  classification='PUBLIC_AND_WEB_BFF_FAIL'
fi

emit ROUTE_DIAGNOSTIC PASS
emit ERROR_CODE NONE
emit RUNTIME_SHA "$runtime_sha"
emit PUBLIC_GET_STATUS "$ext_get"
emit PUBLIC_POST_STATUS "$ext_status"
emit PUBLIC_POST_CODE "${ext_code:-NONE}"
emit WEB_DIRECT_GET_STATUS "$web_get"
emit WEB_DIRECT_POST_STATUS "$web_status"
emit WEB_DIRECT_POST_CODE "${web_code:-NONE}"
emit CLASSIFICATION "$classification"
emit RESET_REQUEST_SENT NO
emit REVIEWER_IDENTITY_EXPOSURE NONE
emit PRODUCTION_MUTATION NONE
REMOTE
ssh_rc=$?
set -e
trap publish_failure ERR

runtime_sha="$(grep -E '^RUNTIME_SHA=[0-9a-f]{40}$' "$raw" | tail -n 1 | cut -d= -f2- || true)"
[[ "$runtime_sha" =~ ^[0-9a-f]{40}$ ]] && RUNTIME_SHA="$runtime_sha"
remote_result="$(grep -E '^ROUTE_DIAGNOSTIC=(PASS|FAIL)$' "$raw" | tail -n 1 | cut -d= -f2- || true)"
remote_code="$(grep -E '^ERROR_CODE=[A-Z0-9_]{1,96}$' "$raw" | tail -n 1 | cut -d= -f2- || true)"
if (( ssh_rc != 0 )) || [[ "$remote_result" != 'PASS' ]]; then
  failure_reason="${remote_code:-REMOTE_ROUTE_DIAGNOSTIC_FAILED}"
  false
fi

failure_reason='RUNTIME_REVISION_GIT_BOUNDARY_FAILED'
guard_main
git fetch --no-tags origin main >/dev/null
git cat-file -e "${RUNTIME_SHA}^{commit}"
git merge-base --is-ancestor "$RUNTIME_SHA" "$TARGET_SHA"

public_get="$(grep -E '^PUBLIC_GET_STATUS=[0-9]{3}$' "$raw" | tail -n 1 | cut -d= -f2-)"
public_status="$(grep -E '^PUBLIC_POST_STATUS=[0-9]{3}$' "$raw" | tail -n 1 | cut -d= -f2-)"
public_code="$(grep -E '^PUBLIC_POST_CODE=[A-Z0-9_]{1,96}$' "$raw" | tail -n 1 | cut -d= -f2-)"
web_get="$(grep -E '^WEB_DIRECT_GET_STATUS=[0-9]{3}$' "$raw" | tail -n 1 | cut -d= -f2-)"
web_status="$(grep -E '^WEB_DIRECT_POST_STATUS=[0-9]{3}$' "$raw" | tail -n 1 | cut -d= -f2-)"
web_code="$(grep -E '^WEB_DIRECT_POST_CODE=[A-Z0-9_]{1,96}$' "$raw" | tail -n 1 | cut -d= -f2-)"
classification="$(grep -E '^CLASSIFICATION=[A-Z0-9_]{1,96}$' "$raw" | tail -n 1 | cut -d= -f2-)"
[[ -n "$public_get" && -n "$public_status" && -n "$public_code" && -n "$web_get" && -n "$web_status" && -n "$web_code" && -n "$classification" ]]

guard_main
result_published=1
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset route diagnostic

- exact main: \`$TARGET_SHA\`
- live runtime revision: \`$RUNTIME_SHA\`
- result: \`PASS_READ_ONLY\`
- classification: \`$classification\`
- public GET/POST/code: \`$public_get/$public_status/$public_code\`
- direct Web GET/POST/code: \`$web_get/$web_status/$web_code\`
- reset request sent: \`NO\`
- reviewer identity exposure: \`NONE\`
- production mutation: \`NONE\`" >/dev/null
