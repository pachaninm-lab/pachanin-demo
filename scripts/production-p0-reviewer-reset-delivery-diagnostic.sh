#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_DELIVERY_DIAGNOSTIC_COMMAND:?PC_REVIEWER_RESET_DELIVERY_DIAGNOSTIC_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-delivery-diagnose 31667978433'
SOURCE_RUN_ID='31667978433'
EXPECTED_DEPLOYED_SHA='d2dd7972105cc59002263455b5ae0eb8d8f2d386'
LOG_SINCE='2026-08-13T04:45:10Z'
LOG_UNTIL='2026-08-13T04:45:24Z'

[[ "$PC_REVIEWER_RESET_DELIVERY_DIAGNOSTIC_COMMAND" == "$COMMAND" ]]

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-delivery-diagnostic-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-delivery-diagnostic-known-hosts"
scan=''
scan_raw=''
match=''
MAIN_SHA='unknown'
stage='INITIAL'
failure_substage='NONE'
delivery_cardinality='UNKNOWN'
retained_container_cardinality='UNKNOWN'
result_published=0

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
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$MAIN_SHA" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse HEAD)" == "$MAIN_SHA" ]]
  [[ "$(git rev-parse origin/main)" == "$MAIN_SHA" ]]
  git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$MAIN_SHA"
  [[ -z "$(git status --porcelain=v1)" ]]
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset delivery diagnostic

- source reset run: \`$SOURCE_RUN_ID\`
- exact diagnostic main: \`$MAIN_SHA\`
- inspected deployed revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`FAIL_CLOSED\`
- failure stage: \`$stage\`
- failure substage: \`$failure_substage\`
- retained d2dd web-container cardinality: \`$retained_container_cardinality\`
- delivery log cardinality: \`$delivery_cardinality\`
- mail sent by diagnostic: \`NO\`
- reviewer identity / account hash / correlation id exposure: \`NONE\`
- reset token / credential exposure: \`NONE\`
- raw runtime log output: \`NOT_PUBLISHED\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}

trap cleanup EXIT
trap publish_failure ERR

MAIN_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$MAIN_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$MAIN_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$MAIN_SHA" ]]
git cat-file -e "$EXPECTED_DEPLOYED_SHA^{commit}"
git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$MAIN_SHA"
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
stage='SSH_KEY_CONFIRMED'
guard_main

domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"
stage='DNS_CONFIRMED'

scan="$(mktemp)"; scan_raw="$(mktemp)"; match="$(mktemp)"
pinned_ready=0
for attempt in 1 2 3; do
  : > "$scan_raw"; : > "$scan"; : > "$match"
  /usr/bin/ssh-keyscan -T 10 -p "$port" "$host" > "$scan_raw" 2>/dev/null || true
  if [[ -s "$scan_raw" ]]; then
    sort -u "$scan_raw" > "$scan"
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
mv "$match" "$known_hosts"; match=''
rm -f -- "$scan" "$scan_raw"; scan=''; scan_raw=''
chmod 0600 "$known_hosts"
stage='HOST_KEY_CONFIRMED'

guard_main
ssh_opts=(
  -i "$key_path" -p "$port"
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15
)
ssh "${ssh_opts[@]}" "$user@$host" \
  'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null
stage='SSH_CONFIRMED'

guard_main
stage='REMOTE_DELIVERY_CLASSIFICATION'
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$EXPECTED_DEPLOYED_SHA' '$LOG_SINCE' '$LOG_UNTIL'" <<'REMOTE'
set -Eeuo pipefail
expected_revision="$1"
log_since="$2"
log_until="$3"
remote_substage='REMOTE_PRECONDITION'
remote_cardinality='UNKNOWN'
remote_retained_cardinality='UNKNOWN'

publish_remote_failure() {
  local rc="$?"
  trap - ERR
  printf 'DIAGNOSTIC_FAILURE_SUBSTAGE=%s\n' "$remote_substage"
  printf 'RETAINED_CONTAINER_CARDINALITY=%s\n' "$remote_retained_cardinality"
  printf 'DELIVERY_LOG_CARDINALITY=%s\n' "$remote_cardinality"
  exit "$rc"
}
trap publish_remote_failure ERR

[[ "$expected_revision" == 'd2dd7972105cc59002263455b5ae0eb8d8f2d386' ]]
[[ "$log_since" == '2026-08-13T04:45:10Z' ]]
[[ "$log_until" == '2026-08-13T04:45:24Z' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1

remote_substage='CONTAINER_DISCOVERY'
mapfile -t running_web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#running_web_ids[@]} == 1 ))
running_web_id="${running_web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$running_web_id")"
[[ -n "$project" ]]
unset running_web_ids running_web_id

remote_substage='RETAINED_CONTAINER_DISCOVERY'
mapfile -t all_web_ids < <(docker ps -aq \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=web')
retained_web_ids=()
for candidate_id in "${all_web_ids[@]}"; do
  candidate_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$candidate_id" 2>/dev/null || true)"
  [[ "$candidate_revision" != "$expected_revision" ]] || retained_web_ids+=("$candidate_id")
done
unset all_web_ids candidate_id candidate_revision
case "${#retained_web_ids[@]}" in
  0)
    remote_retained_cardinality='ZERO'
    remote_substage='RETAINED_CONTAINER_ZERO'
    false
    ;;
  1)
    remote_retained_cardinality='ONE'
    ;;
  *)
    remote_retained_cardinality='MULTIPLE'
    remote_substage='RETAINED_CONTAINER_MULTIPLE'
    false
    ;;
esac
web_id="${retained_web_ids[0]}"
unset retained_web_ids

remote_substage='EVENT_CARDINALITY'
mapfile -t delivery_lines < <(
  docker logs --since "$log_since" --until "$log_until" "$web_id" 2>&1 \
    | grep -F 'password_reset_delivery_result' || true
)
case "${#delivery_lines[@]}" in
  0) remote_cardinality='ZERO'; false ;;
  1) remote_cardinality='ONE' ;;
  *) remote_cardinality='MULTIPLE'; false ;;
esac
line="${delivery_lines[0]}"
delivered="$(sed -n 's/.*"delivered"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' <<< "$line")"
provider="$(sed -n 's/.*"provider"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<< "$line")"
reason="$(sed -n 's/.*"reason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<< "$line")"
unset line delivery_lines

remote_substage='EVENT_DELIVERED_VALUE'
[[ "$delivered" == 'false' ]]
remote_substage='EVENT_PROVIDER_VALUE'
[[ "$provider" =~ ^(resend|smtp|none)$ ]]
remote_substage='EVENT_REASON_VALUE'
[[ -n "$reason" && ${#reason} -le 420 ]]
[[ "$reason" != *$'\n'* && "$reason" != *$'\r'* ]]

remote_substage='REASON_CLASSIFICATION'
resend_class='OTHER'
if [[ "$reason" == *'resend_not_configured'* ]]; then
  resend_class='NOT_CONFIGURED'
elif [[ "$reason" == *'resend_from_not_configured'* ]]; then
  resend_class='FROM_NOT_CONFIGURED'
elif [[ "$reason" =~ resend_([0-9]{3}) ]]; then
  code="${BASH_REMATCH[1]}"
  case "$code" in
    401|403) resend_class="HTTP_${code}_AUTH" ;;
    429) resend_class='HTTP_429_RATE_LIMIT' ;;
    5??) resend_class="HTTP_${code}_UPSTREAM" ;;
    *) resend_class="HTTP_${code}" ;;
  esac
elif [[ "$reason" == *'resend_failed:AbortError'* || "$reason" == *'resend_failed:TimeoutError'* ]]; then
  resend_class='TIMEOUT'
elif [[ "$reason" == *'resend_failed:'* ]]; then
  resend_class='TRANSPORT_EXCEPTION'
fi

smtp_class='OTHER'
if [[ "$reason" == *'smtp_not_configured'* ]]; then
  smtp_class='NOT_CONFIGURED'
elif [[ "$reason" == *'smtp_timeout'* ]]; then
  smtp_class='TIMEOUT'
elif [[ "$reason" =~ smtp_([0-9]{3}) ]]; then
  code="${BASH_REMATCH[1]}"
  case "$code" in
    535) smtp_class='SMTP_535_AUTH_REJECTED' ;;
    530) smtp_class='SMTP_530_AUTH_REQUIRED' ;;
    550|551|552|553|554) smtp_class="SMTP_${code}_RECIPIENT_OR_POLICY" ;;
    421|450|451|452) smtp_class="SMTP_${code}_TEMPORARY" ;;
    *) smtp_class="SMTP_${code}" ;;
  esac
elif [[ "$reason" == *'ENOTFOUND'* || "$reason" == *'EAI_AGAIN'* ]]; then
  smtp_class='DNS_FAILURE'
elif [[ "$reason" == *'ECONNREFUSED'* ]]; then
  smtp_class='CONNECTION_REFUSED'
elif [[ "$reason" == *'ETIMEDOUT'* ]]; then
  smtp_class='CONNECT_TIMEOUT'
elif [[ "$reason" == *'certificate'* || "$reason" == *'CERT_'* || "$reason" == *'self signed'* || "$reason" == *'unable to verify'* ]]; then
  smtp_class='TLS_CERTIFICATE'
elif [[ "$reason" == *'wrong version number'* ]]; then
  smtp_class='TLS_PROTOCOL'
elif [[ "$reason" == *'smtp_failed:'* ]]; then
  smtp_class='TRANSPORT_EXCEPTION'
fi

root_class='UNCLASSIFIED'
if [[ "$smtp_class" != 'NOT_CONFIGURED' && "$smtp_class" != 'OTHER' ]]; then
  root_class="SMTP_${smtp_class}"
elif [[ "$resend_class" != 'NOT_CONFIGURED' && "$resend_class" != 'OTHER' ]]; then
  root_class="RESEND_${resend_class}"
elif [[ "$smtp_class" == 'NOT_CONFIGURED' && "$resend_class" == 'NOT_CONFIGURED' ]]; then
  root_class='MAIL_CHANNEL_NOT_CONFIGURED'
elif [[ "$provider" == 'smtp' ]]; then
  root_class='SMTP_OTHER'
elif [[ "$provider" == 'resend' ]]; then
  root_class='RESEND_OTHER'
fi

remote_substage='RETAINED_REVISION_AFTER'
web_revision_after="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id" 2>/dev/null)"
[[ "$web_revision_after" == "$expected_revision" ]]
unset web_revision_after

trap - ERR
printf 'RETAINED_CONTAINER_CARDINALITY=ONE\n'
printf 'DELIVERY_LOG_COUNT=1\n'
printf 'DELIVERED=FALSE\n'
printf 'DELIVERY_PROVIDER=%s\n' "${provider^^}"
printf 'RESEND_REASON_CLASS=%s\n' "$resend_class"
printf 'SMTP_REASON_CLASS=%s\n' "$smtp_class"
printf 'ROOT_CAUSE_CLASS=%s\n' "$root_class"
printf 'SOURCE_REVISION_RECOVERY=PASS\n'
printf 'MAIL_SENT_BY_DIAGNOSTIC=NO\n'
printf 'PRODUCTION_MUTATION=NONE\n'
unset reason provider delivered
REMOTE
)"; then
  remote_rc=0
else
  remote_rc=$?
fi

if (( remote_rc != 0 )); then
  failure_marker="$(grep '^DIAGNOSTIC_FAILURE_SUBSTAGE=' <<< "$output" | tail -n1 || true)"
  retained_marker="$(grep '^RETAINED_CONTAINER_CARDINALITY=' <<< "$output" | tail -n1 || true)"
  cardinality_marker="$(grep '^DELIVERY_LOG_CARDINALITY=' <<< "$output" | tail -n1 || true)"
  candidate_substage="${failure_marker#DIAGNOSTIC_FAILURE_SUBSTAGE=}"
  candidate_retained="${retained_marker#RETAINED_CONTAINER_CARDINALITY=}"
  candidate_cardinality="${cardinality_marker#DELIVERY_LOG_CARDINALITY=}"
  case "$candidate_substage" in
    REMOTE_PRECONDITION|CONTAINER_DISCOVERY|RETAINED_CONTAINER_DISCOVERY|RETAINED_CONTAINER_ZERO|RETAINED_CONTAINER_MULTIPLE|EVENT_CARDINALITY|EVENT_DELIVERED_VALUE|EVENT_PROVIDER_VALUE|EVENT_REASON_VALUE|REASON_CLASSIFICATION|RETAINED_REVISION_AFTER)
      failure_substage="$candidate_substage"
      ;;
    *) failure_substage='REMOTE_EXECUTION' ;;
  esac
  case "$candidate_retained" in
    ZERO|ONE|MULTIPLE) retained_container_cardinality="$candidate_retained" ;;
    *) retained_container_cardinality='UNKNOWN' ;;
  esac
  case "$candidate_cardinality" in
    ZERO|ONE|MULTIPLE) delivery_cardinality="$candidate_cardinality" ;;
    *) delivery_cardinality='UNKNOWN' ;;
  esac
  unset output failure_marker retained_marker cardinality_marker candidate_substage candidate_retained candidate_cardinality
  false
fi

retained_marker="$(grep '^RETAINED_CONTAINER_CARDINALITY=' <<< "$output" | tail -n1)"
log_count="$(grep '^DELIVERY_LOG_COUNT=' <<< "$output" | tail -n1)"
delivered_marker="$(grep '^DELIVERED=' <<< "$output" | tail -n1)"
provider_marker="$(grep '^DELIVERY_PROVIDER=' <<< "$output" | tail -n1)"
resend_marker="$(grep '^RESEND_REASON_CLASS=' <<< "$output" | tail -n1)"
smtp_marker="$(grep '^SMTP_REASON_CLASS=' <<< "$output" | tail -n1)"
root_marker="$(grep '^ROOT_CAUSE_CLASS=' <<< "$output" | tail -n1)"
recovery_marker="$(grep '^SOURCE_REVISION_RECOVERY=' <<< "$output" | tail -n1)"
mail_marker="$(grep '^MAIL_SENT_BY_DIAGNOSTIC=' <<< "$output" | tail -n1)"
mutation_marker="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"

[[ "$retained_marker" == 'RETAINED_CONTAINER_CARDINALITY=ONE' ]]
[[ "$log_count" == 'DELIVERY_LOG_COUNT=1' ]]
[[ "$delivered_marker" == 'DELIVERED=FALSE' ]]
[[ "$provider_marker" =~ ^DELIVERY_PROVIDER=(RESEND|SMTP|NONE)$ ]]
[[ "$resend_marker" =~ ^RESEND_REASON_CLASS=[A-Z0-9_]+$ ]]
[[ "$smtp_marker" =~ ^SMTP_REASON_CLASS=[A-Z0-9_]+$ ]]
[[ "$root_marker" =~ ^ROOT_CAUSE_CLASS=[A-Z0-9_]+$ ]]
[[ "$recovery_marker" == 'SOURCE_REVISION_RECOVERY=PASS' ]]
[[ "$mail_marker" == 'MAIL_SENT_BY_DIAGNOSTIC=NO' ]]
[[ "$mutation_marker" == 'PRODUCTION_MUTATION=NONE' ]]

guard_main
stage='PUBLISH_RESULT'
provider="${provider_marker#DELIVERY_PROVIDER=}"
resend_class="${resend_marker#RESEND_REASON_CLASS=}"
smtp_class="${smtp_marker#SMTP_REASON_CLASS=}"
root_class="${root_marker#ROOT_CAUSE_CLASS=}"
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset delivery diagnostic

- source reset run: \`$SOURCE_RUN_ID\`
- exact diagnostic main: \`$MAIN_SHA\`
- inspected source revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`PASS_READ_ONLY_CLASSIFIED\`
- retained d2dd web-container cardinality: \`1\`
- delivery log cardinality: \`1\`
- delivered: \`FALSE\`
- final provider: \`$provider\`
- Resend failure class: \`$resend_class\`
- SMTP failure class: \`$smtp_class\`
- root-cause class: \`$root_class\`
- source revision recovery: \`PASS\`
- mail sent by diagnostic: \`NO\`
- reviewer identity / account hash / correlation id exposure: \`NONE\`
- reset token / credential exposure: \`NONE\`
- raw runtime log output: \`NOT_PUBLISHED\`
- production mutation: \`NONE\`" >/dev/null
result_published=1
