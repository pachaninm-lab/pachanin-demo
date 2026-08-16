#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_STACK_COMMAND:?PC_REVIEWER_RESET_STACK_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-stack-classify 31974946435 current-main'
RESET_RUN_ID='31974946435'
RESET_REVISION='440e40753e2cac13c93f8e007d9fe17c2b66caba'
ATTEMPT_SINCE='2026-08-16T21:57:20Z'
ATTEMPT_UNTIL='2026-08-16T21:59:06Z'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-stack-31974946435-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-stack-31974946435-known-hosts"
TARGET_SHA='unknown'
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
trap cleanup EXIT

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset 31974946435 sanitized stack classifier

- source reset run: \`$RESET_RUN_ID\`
- exact diagnostic main: \`$TARGET_SHA\`
- reset revision: \`$RESET_REVISION\`
- result: \`FAIL_CLOSED\`
- raw logs / PII / credentials / reset material: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
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
  local remote
  remote="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$remote" == "$TARGET_SHA" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
  [[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
  git merge-base --is-ancestor "$RESET_REVISION" "$TARGET_SHA"
  [[ -z "$(git status --porcelain=v1)" ]]
}

[[ "$PC_REVIEWER_RESET_STACK_COMMAND" == "$COMMAND" ]]
TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
guard_main

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

scan="$(mktemp)"; scan_raw="$(mktemp)"; match="$(mktemp)"
pinned_ready=0
for attempt in 1 2 3; do
  : > "$scan_raw"; : > "$scan"; : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" > "$scan_raw" 2>/dev/null || true
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

ssh_opts=(
  -i "$key_path" -p "$port"
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15
)
guard_main
ssh "${ssh_opts[@]}" "$user@$host" \
  'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null

guard_main
output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$RESET_REVISION' '$ATTEMPT_SINCE' '$ATTEMPT_UNTIL'" <<'REMOTE'
set -Eeuo pipefail
revision="$1"
since="$2"
until="$3"
[[ "$revision" == '440e40753e2cac13c93f8e007d9fe17c2b66caba' ]]
[[ "$since" == '2026-08-16T21:57:20Z' ]]
[[ "$until" == '2026-08-16T21:59:06Z' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1

mapfile -t active_web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#active_web_ids[@]} == 1 ))
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "${active_web_ids[0]}")"
[[ -n "$project" ]]
mapfile -t api_ids < <(docker ps -aq \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=api')
matching=()
for id in "${api_ids[@]}"; do
  candidate="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)"
  [[ "$candidate" != "$revision" ]] || matching+=("$id")
done
(( ${#matching[@]} >= 1 && ${#matching[@]} <= 4 ))

all="$(mktemp)"
block="$(mktemp)"
trap 'rm -f "$all" "$block"' EXIT
: > "$all"
for id in "${matching[@]}"; do
  docker logs --since "$since" --until "$until" "$id" 2>&1 >> "$all" || true
done
marker_count="$(grep -Fc 'Password reset challenge/outbox transaction failed' "$all" || true)"
[[ "$marker_count" == '1' ]]
marker_line="$(grep -Fn 'Password reset challenge/outbox transaction failed' "$all" | cut -d: -f1)"
[[ "$marker_line" =~ ^[0-9]+$ && "$marker_line" -ge 1 ]]
end_line=$((marker_line + 40))
sed -n "${marker_line},${end_line}p" "$all" > "$block"
[[ -s "$block" ]]

error_type='UNKNOWN'
grep -Fq 'PrismaClientKnownRequestError' "$block" && error_type='PRISMA_KNOWN'
grep -Fq 'PrismaClientUnknownRequestError' "$block" && error_type='PRISMA_UNKNOWN'
grep -Fq 'PrismaClientValidationError' "$block" && error_type='PRISMA_VALIDATION'
grep -Fq 'PrismaClientInitializationError' "$block" && error_type='PRISMA_INITIALIZATION'

resource_class='UNKNOWN'
if grep -Eqi 'auth\.audit_events|audit_events' "$block"; then
  resource_class='AUTH_AUDIT_EVENTS'
elif grep -Eqi 'password_reset_challenges' "$block"; then
  resource_class='PASSWORD_RESET_CHALLENGES'
elif grep -Eqi 'enqueue_mail_outbox' "$block"; then
  resource_class='AUTH_ENQUEUE_MAIL_OUTBOX'
elif grep -Eqi 'auth\.mail_outbox|mail_outbox' "$block"; then
  resource_class='AUTH_MAIL_OUTBOX'
fi

source_stage='UNKNOWN'
if grep -Eqi 'auth-mail-outbox\.service|AuthMailOutboxService|enqueue_mail_outbox' "$block"; then
  source_stage='AUTH_MAIL_ENQUEUE'
elif grep -Eqi 'latestAuditChainPosition|insertAudit|auth\.audit_events|audit_events|persistent-auth\.repository|PersistentAuthRepository' "$block"; then
  source_stage='AUTH_AUDIT'
elif grep -Eqi 'password-reset\.repository|PasswordResetRepository|password_reset_challenges' "$block"; then
  source_stage='PASSWORD_RESET_REPOSITORY'
elif grep -Eqi 'password-reset\.service|PasswordResetService' "$block"; then
  source_stage='PASSWORD_RESET_SERVICE'
fi

code_class='NONE'
for pair in \
  'P2034:PRISMA_P2034' 'P2002:PRISMA_P2002' 'P2010:PRISMA_P2010' 'P2028:PRISMA_P2028' \
  'P1010:PRISMA_P1010' 'P1001:PRISMA_P1001' 'P2003:PRISMA_P2003' 'P2011:PRISMA_P2011' \
  '42501:SQLSTATE_42501' '23505:SQLSTATE_23505' '40001:SQLSTATE_40001' '25006:SQLSTATE_25006' \
  '42P01:SQLSTATE_42P01' '42883:SQLSTATE_42883' '22023:SQLSTATE_22023' '23503:SQLSTATE_23503' '23502:SQLSTATE_23502'; do
  needle="${pair%%:*}"
  label="${pair#*:}"
  if grep -Fq "$needle" "$block"; then
    code_class="$label"
    break
  fi
done

reason_class='OTHER'
if grep -Eqi 'permission denied|insufficient privilege' "$block"; then
  reason_class='PERMISSION_DENIED'
elif grep -Eqi 'row-level security|violates row level security|RLS' "$block"; then
  reason_class='ROW_LEVEL_SECURITY'
elif grep -Eqi 'read-only transaction|read only transaction|cannot execute .* in a read-only' "$block"; then
  reason_class='READ_ONLY_TRANSACTION'
elif grep -Eqi 'function .*enqueue_mail_outbox.* does not exist|undefined function' "$block"; then
  reason_class='ENQUEUE_FUNCTION_MISSING'
elif grep -Eqi 'relation .*mail_outbox.* does not exist|undefined table' "$block"; then
  reason_class='MAIL_OUTBOX_RELATION_MISSING'
elif grep -Eqi 'relation .*audit_events.* does not exist' "$block"; then
  reason_class='AUDIT_RELATION_MISSING'
elif grep -Eqi 'relation .*password_reset_challenges.* does not exist' "$block"; then
  reason_class='CHALLENGE_RELATION_MISSING'
elif grep -Eqi 'duplicate key|unique constraint|unique violation' "$block"; then
  reason_class='UNIQUE_VIOLATION'
elif grep -Eqi 'could not serialize|serialization failure|write conflict|deadlock' "$block"; then
  reason_class='SERIALIZATION_OR_DEADLOCK'
elif grep -Eqi 'timeout|timed out' "$block"; then
  reason_class='TIMEOUT'
elif grep -Eqi 'ECONN|connection refused|connection terminated|server closed the connection' "$block"; then
  reason_class='DB_CONNECTION'
elif grep -Eqi 'Auth-mail key|AUTH_MAIL_OUTBOX|key version|keyring' "$block"; then
  reason_class='AUTH_MAIL_KEY_RUNTIME'
elif grep -Eqi 'idempotency key reused|idempotency row disappeared|invalid result' "$block"; then
  reason_class='AUTH_MAIL_IDEMPOTENCY'
elif grep -Eqi 'expiry must be in the future|availability is invalid|maxAttempts|correlation id is invalid|recipient is invalid|subject is invalid|text is invalid' "$block"; then
  reason_class='VALIDATION'
fi

printf 'STACK_CLASS|%s|%s|%s|%s|%s|%s|%s\n' \
  "$error_type" "$source_stage" "$resource_class" "$code_class" "$reason_class" "$marker_count" "${#matching[@]}"
printf 'RESET_REPLAY=NONE\n'
printf 'MAIL_SENT_BY_CLASSIFIER=NO\n'
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE
)"

marker="$(grep '^STACK_CLASS|' <<< "$output" | tail -n1)"
replay="$(grep '^RESET_REPLAY=' <<< "$output" | tail -n1)"
mail="$(grep '^MAIL_SENT_BY_CLASSIFIER=' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$marker" =~ ^STACK_CLASS\|[A-Z0-9_]+\|[A-Z0-9_]+\|[A-Z0-9_]+\|[A-Z0-9_]+\|[A-Z0-9_]+\|1\|[1-4]$ ]]
[[ "$replay" == 'RESET_REPLAY=NONE' ]]
[[ "$mail" == 'MAIL_SENT_BY_CLASSIFIER=NO' ]]
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
IFS='|' read -r _ error_type source_stage resource_class code_class reason_class marker_count container_count <<< "$marker"
guard_main

gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset 31974946435 sanitized stack classifier

- source reset run: \`$RESET_RUN_ID\`
- exact diagnostic main: \`$TARGET_SHA\`
- reset revision: \`$RESET_REVISION\`
- bounded log window: \`$ATTEMPT_SINCE .. $ATTEMPT_UNTIL\`
- result: \`PASS_READ_ONLY_CLASSIFIED\`
- error type: \`$error_type\`
- source stage: \`$source_stage\`
- resource class: \`$resource_class\`
- safe code class: \`$code_class\`
- safe reason class: \`$reason_class\`
- failure marker count / exact-revision API containers: \`$marker_count/$container_count\`
- raw logs / PII / credentials / reset material: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
result_published=1
