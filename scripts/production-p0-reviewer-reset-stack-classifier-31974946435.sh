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
SOURCE_SCRIPT='scripts/production-p0-reviewer-reset-stack-classifier-31901032491.sh'
SOURCE_BLOB_SHA='499bf064866f83a658ccbdfecaa885541d44c780'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-stack-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-stack-known-hosts"
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
LOCAL_STAGE='BOOTSTRAP'
REMOTE_STAGE='NOT_STARTED'
REMOTE_RC='NA'
scan=''; match=''; result_published=0

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}
trap cleanup EXIT

publish_failure() {
  local rc="${1:-1}"
  trap - ERR
  if [[ "$result_published" == 0 ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset fail-safe stage classifier

- source reset run: \`$RESET_RUN_ID\`
- diagnostic main: \`$SOURCE_SHA\`
- reset revision: \`$RESET_REVISION\`
- result: \`FAIL_CLOSED_STAGE_CLASSIFIED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- raw logs / PII / credentials / reset material: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}
on_err() { local rc="$?"; publish_failure "$rc"; }
trap on_err ERR

trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
guard_main() {
  local remote
  remote="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$remote" == "$CURRENT_MAIN" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
}

LOCAL_STAGE='AUTHORITY'
[[ "$PC_REVIEWER_RESET_STACK_COMMAND" == "$COMMAND" ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
git merge-base --is-ancestor "$RESET_REVISION" "$CURRENT_MAIN"
[[ -z "$(git status --porcelain=v1)" ]]
[[ -f "$SOURCE_SCRIPT" ]]
[[ "$(git hash-object "$SOURCE_SCRIPT")" == "$SOURCE_BLOB_SHA" ]]

LOCAL_STAGE='SSH_INPUT'
host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && ((port>=1 && port<=65535))
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
try_key "${PC_PROD_SSH_KEY:-}" || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_key "${VPS_SSH_KEY:-}"

LOCAL_STAGE='HOST_PIN'
guard_main
domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"
scan="$(mktemp)"; match="$(mktemp)"; pinned=0
for attempt in 1 2 3; do
  : > "$scan"; : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true
  if [[ -s "$scan" ]]; then
    while IFS= read -r line; do
      fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    [[ "$(grep -c . "$match" || true)" == 1 ]] && { pinned=1; break; }
  fi
  ((attempt==3)) || sleep "$attempt"
done
[[ "$pinned" == 1 ]]
mv "$match" "$known_hosts"; match=''
rm -f "$scan"; scan=''
chmod 0600 "$known_hosts"
ssh_opts=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15)

LOCAL_STAGE='REMOTE_PREFLIGHT'
guard_main
ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null

guard_main
LOCAL_STAGE='REMOTE_CLASSIFIER'
set +e
output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$RESET_REVISION' '$ATTEMPT_SINCE' '$ATTEMPT_UNTIL'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
revision="$1"; since="$2"; until="$3"
REMOTE_STAGE='BOOTSTRAP'
remote_exit() {
  local rc="$?"
  trap - EXIT
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  printf 'PRODUCTION_MUTATION=NONE\n'
  exit "$rc"
}
trap remote_exit EXIT

[[ "$revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$since" == '2026-08-16T21:57:20Z' && "$until" == '2026-08-16T21:59:06Z' ]]
[[ "$(id -u)" -eq 0 ]]

REMOTE_STAGE='API_INVENTORY'
mapfile -t api_ids < <(docker ps -aq --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} >= 1 ))

REMOTE_STAGE='REVISION_MATCH'
matching=()
for id in "${api_ids[@]}"; do
  r="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)"
  [[ "$r" != "$revision" ]] || matching+=("$id")
done
(( ${#matching[@]} >= 1 && ${#matching[@]} <= 4 ))

REMOTE_STAGE='LOG_READ'
all=''
for id in "${matching[@]}"; do
  chunk="$(docker logs --since "$since" --until "$until" "$id" 2>&1 || true)"
  all+="${all:+$'\n'}$chunk"
done

REMOTE_STAGE='MARKER_COUNT'
marker_count="$(grep -Fc 'Password reset challenge/outbox transaction failed' <<< "$all" || true)"
[[ "$marker_count" =~ ^[0-9]+$ && "$marker_count" -ge 1 && "$marker_count" -le 4 ]]

REMOTE_STAGE='BLOCK_EXTRACT'
marker_line="$(grep -Fn 'Password reset challenge/outbox transaction failed' <<< "$all" | head -n1 | cut -d: -f1)"
[[ "$marker_line" =~ ^[0-9]+$ && "$marker_line" -ge 1 ]]
end_line=$((marker_line + 27))
block="$(sed -n "${marker_line},${end_line}p" <<< "$all")"
[[ -n "$block" ]]

REMOTE_STAGE='CLASSIFY'
error_type='UNKNOWN'
grep -Fq 'PrismaClientKnownRequestError' <<< "$block" && error_type='PRISMA_KNOWN'
grep -Fq 'PrismaClientUnknownRequestError' <<< "$block" && error_type='PRISMA_UNKNOWN'
grep -Fq 'PrismaClientValidationError' <<< "$block" && error_type='PRISMA_VALIDATION'
grep -Fq 'PrismaClientInitializationError' <<< "$block" && error_type='PRISMA_INITIALIZATION'

source_stage='UNKNOWN'
if grep -Eqi 'auth-mail-outbox\.service|AuthMailOutboxService|enqueue_mail_outbox' <<< "$block"; then source_stage='AUTH_MAIL_ENQUEUE'
elif grep -Eqi 'auth-mail-crypto|encryptAuthMailEnvelope|authMailReplayDigest' <<< "$block"; then source_stage='AUTH_MAIL_CRYPTO'
elif grep -Eqi 'auth-mail-templates|passwordResetMail|publicSiteOrigin' <<< "$block"; then source_stage='AUTH_MAIL_TEMPLATE'
elif grep -Eqi 'password-reset\.repository|PasswordResetRepository' <<< "$block"; then source_stage='PASSWORD_RESET_REPOSITORY'
elif grep -Eqi 'persistent-auth\.repository|PersistentAuthRepository' <<< "$block"; then source_stage='PERSISTENT_AUTH_REPOSITORY'
elif grep -Eqi 'password-reset\.service|PasswordResetService' <<< "$block"; then source_stage='PASSWORD_RESET_SERVICE'
fi

code_class='NONE'
for pair in \
  'P2034:PRISMA_P2034' 'P2002:PRISMA_P2002' 'P2010:PRISMA_P2010' 'P2028:PRISMA_P2028' 'P1010:PRISMA_P1010' 'P1001:PRISMA_P1001' \
  '42501:SQLSTATE_42501' '23505:SQLSTATE_23505' '40001:SQLSTATE_40001' '25006:SQLSTATE_25006' '42P01:SQLSTATE_42P01' '42883:SQLSTATE_42883' '22023:SQLSTATE_22023'; do
  needle="${pair%%:*}"; label="${pair#*:}"
  if grep -Fq "$needle" <<< "$block"; then code_class="$label"; break; fi
done

reason_class='OTHER'
if grep -Eqi 'permission denied|insufficient privilege' <<< "$block"; then reason_class='PERMISSION_DENIED'
elif grep -Eqi 'row-level security|violates row level security|RLS' <<< "$block"; then reason_class='ROW_LEVEL_SECURITY'
elif grep -Eqi 'read-only transaction|read only transaction|cannot execute .* in a read-only' <<< "$block"; then reason_class='READ_ONLY_TRANSACTION'
elif grep -Eqi 'function .*enqueue_mail_outbox.* does not exist|undefined function' <<< "$block"; then reason_class='ENQUEUE_FUNCTION_MISSING'
elif grep -Eqi 'relation .*mail_outbox.* does not exist|undefined table' <<< "$block"; then reason_class='MAIL_OUTBOX_RELATION_MISSING'
elif grep -Eqi 'duplicate key|unique constraint|unique violation' <<< "$block"; then reason_class='UNIQUE_VIOLATION'
elif grep -Eqi 'could not serialize|serialization failure|write conflict|deadlock' <<< "$block"; then reason_class='SERIALIZATION_OR_DEADLOCK'
elif grep -Eqi 'timeout|timed out' <<< "$block"; then reason_class='TIMEOUT'
elif grep -Eqi 'ECONN|connection refused|connection terminated|server closed the connection' <<< "$block"; then reason_class='DB_CONNECTION'
elif grep -Eqi 'ENOENT|no such file or directory' <<< "$block"; then reason_class='RUNTIME_FILE_MISSING'
elif grep -Eqi 'Auth-mail key|AUTH_MAIL_OUTBOX|key version|keyring' <<< "$block"; then reason_class='AUTH_MAIL_KEY_RUNTIME'
elif grep -Eqi 'idempotency key reused|idempotency row disappeared|invalid result' <<< "$block"; then reason_class='AUTH_MAIL_IDEMPOTENCY'
elif grep -Eqi 'expiry must be in the future|availability is invalid|maxAttempts|correlation id is invalid|recipient is invalid|subject is invalid|text is invalid' <<< "$block"; then reason_class='AUTH_MAIL_VALIDATION'
fi

printf 'STACK_CLASS|%s|%s|%s|%s|%s|%s\n' "$error_type" "$source_stage" "$code_class" "$reason_class" "$marker_count" "${#matching[@]}"
REMOTE_STAGE='COMPLETE'
REMOTE
)"
ssh_rc=$?
set -e

remote_marker="$(grep '^REMOTE_STAGE|' <<< "$output" | tail -n1 || true)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1 || true)"
if [[ "$remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]; then
  IFS='|' read -r _ REMOTE_STAGE REMOTE_RC <<< "$remote_marker"
else
  REMOTE_STAGE='NO_SAFE_REMOTE_MARKER'
  REMOTE_RC="$ssh_rc"
fi
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]] || { REMOTE_STAGE='MUTATION_ATTESTATION_MISSING'; REMOTE_RC="$ssh_rc"; publish_failure 91; }
if (( ssh_rc != 0 )); then
  publish_failure "$ssh_rc"
fi

LOCAL_STAGE='STACK_PARSE'
marker="$(grep '^STACK_CLASS|' <<< "$output" | tail -n1 || true)"
[[ "$marker" =~ ^STACK_CLASS\|[A-Z0-9_]+\|[A-Z0-9_]+\|[A-Z0-9_]+\|[A-Z0-9_]+\|[0-9]+\|[0-9]+$ ]]
IFS='|' read -r _ error_type source_stage code_class reason_class marker_count container_count <<< "$marker"
[[ "$REMOTE_STAGE" == 'COMPLETE' && "$REMOTE_RC" == '0' ]]

LOCAL_STAGE='PUBLISH_RESULT'
guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset fail-safe stage classifier

- source reset run: \`$RESET_RUN_ID\`
- diagnostic main: \`$SOURCE_SHA\`
- reset revision: \`$RESET_REVISION\`
- result: \`PASS_READ_ONLY_CLASSIFIED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage / rc: \`$REMOTE_STAGE/$REMOTE_RC\`
- error type: \`$error_type\`
- source stage: \`$source_stage\`
- safe code class: \`$code_class\`
- safe reason class: \`$reason_class\`
- failure marker count / exact-revision API containers: \`$marker_count/$container_count\`
- raw logs / PII / credentials / reset material: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
result_published=1
