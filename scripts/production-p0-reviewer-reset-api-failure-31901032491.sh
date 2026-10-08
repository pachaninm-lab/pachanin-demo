#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_API_FAILURE_COMMAND:?PC_REVIEWER_RESET_API_FAILURE_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-api-failure-classify 31901032491 current-main'
RESET_RUN_ID='31901032491'
RESET_REVISION='056ed4461dafb5e7dab2efc9ea5a0d5877523169'
ATTEMPT_SINCE='2026-08-15T18:24:20Z'
ATTEMPT_UNTIL='2026-08-15T18:25:05Z'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-api-failure-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-api-failure-known-hosts"
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
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
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset API failure classifier

- source reset run: \`$RESET_RUN_ID\`
- diagnostic main: \`$SOURCE_SHA\`
- reset revision: \`$RESET_REVISION\`
- result: \`FAIL_CLOSED\`
- raw API logs: \`NOT_PUBLISHED\`
- reviewer identity / token / password / TOTP exposure: \`NONE\`
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

[[ "$PC_REVIEWER_RESET_API_FAILURE_COMMAND" == "$COMMAND" ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ && "$CURRENT_MAIN" =~ ^[0-9a-f]{40}$ ]]
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
git merge-base --is-ancestor "$RESET_REVISION" "$CURRENT_MAIN"
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
rm -f -- "$scan"; scan=''
chmod 0600 "$known_hosts"

guard_main

output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$RESET_REVISION' '$ATTEMPT_SINCE' '$ATTEMPT_UNTIL'" <<'REMOTE'
set -Eeuo pipefail
reset_revision="$1"
attempt_since="$2"
attempt_until="$3"
[[ "$reset_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$attempt_since" == '2026-08-15T18:24:20Z' ]]
[[ "$attempt_until" == '2026-08-15T18:25:05Z' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
command -v python3 >/dev/null 2>&1

remote_tmp="$(mktemp -d /root/pc-reviewer-reset-api-failure.XXXXXX)"
chmod 0700 "$remote_tmp"
trap 'rm -rf -- "$remote_tmp"' EXIT
combined="$remote_tmp/api.log"
: > "$combined"
chmod 0600 "$combined"

mapfile -t all_api_ids < <(docker ps -aq --filter 'label=com.docker.compose.service=api' | sort -u)
(( ${#all_api_ids[@]} >= 1 ))
exact_count=0
active_exact_count=0
for cid in "${all_api_ids[@]}"; do
  revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$cid" 2>/dev/null || true)"
  [[ "$revision" == "$reset_revision" ]] || continue
  exact_count=$((exact_count + 1))
  running="$(docker inspect --format '{{.State.Running}}' "$cid" 2>/dev/null || true)"
  [[ "$running" != 'true' ]] || active_exact_count=$((active_exact_count + 1))
  docker logs --timestamps --since "$attempt_since" --until "$attempt_until" "$cid" >> "$combined" 2>&1 || true
done
(( exact_count >= 1 ))

classification="$(python3 - "$combined" <<'PY'
from pathlib import Path
import re, sys
text = Path(sys.argv[1]).read_text(encoding='utf-8', errors='replace')
marker = 'Password reset challenge/outbox transaction failed'
positions = [m.start() for m in re.finditer(re.escape(marker), text)]
if not positions:
    print('NOT_OBSERVED|0')
    raise SystemExit(0)
segments = []
for pos in positions:
    segments.append(text[max(0, pos - 1500): min(len(text), pos + 7000)])
s = '\n'.join(segments).lower()

def has(*parts):
    return all(part.lower() in s for part in parts)

if has('auth.mail_outbox') and ('does not exist' in s or 'p2021' in s):
    cls = 'AUTH_MAIL_OUTBOX_RELATION_MISSING'
elif has('auth.mail_outbox', 'permission denied'):
    cls = 'AUTH_MAIL_OUTBOX_PERMISSION_DENIED'
elif has('auth.mail_outbox', 'row-level security') or has('auth.mail_outbox', 'row level security'):
    cls = 'AUTH_MAIL_OUTBOX_RLS_DENIED'
elif ('password_reset_challenges' in s or 'password reset challenge' in s) and 'permission denied' in s:
    cls = 'PASSWORD_RESET_REPOSITORY_PERMISSION_DENIED'
elif 'p2021' in s or ('relation ' in s and 'does not exist' in s):
    cls = 'DATABASE_RELATION_MISSING'
elif 'p2022' in s or ('column ' in s and 'does not exist' in s):
    cls = 'DATABASE_COLUMN_MISSING'
elif 'p2002' in s or 'unique constraint' in s or 'duplicate key value' in s:
    cls = 'DATABASE_UNIQUE_CONSTRAINT'
elif 'p2003' in s or 'foreign key constraint' in s:
    cls = 'DATABASE_FOREIGN_KEY_CONSTRAINT'
elif 'p2024' in s or ('connection pool' in s and 'timeout' in s):
    cls = 'DATABASE_POOL_TIMEOUT'
elif 'p1000' in s or 'authentication failed against database server' in s:
    cls = 'DATABASE_AUTHENTICATION_FAILED'
elif 'p1001' in s or 'can\'t reach database server' in s or 'could not connect to server' in s:
    cls = 'DATABASE_UNREACHABLE'
elif 'p1002' in s or ('database server' in s and 'timed out' in s):
    cls = 'DATABASE_TIMEOUT'
elif 'p1010' in s or ('user was denied access' in s and 'database' in s):
    cls = 'DATABASE_ACCESS_DENIED'
elif 'row-level security' in s or 'row level security' in s:
    cls = 'DATABASE_RLS_DENIED'
elif 'permission denied for' in s:
    cls = 'DATABASE_PERMISSION_DENIED'
elif 'current transaction is aborted' in s:
    cls = 'DATABASE_TRANSACTION_ABORTED'
elif any(term in s for term in ('auth_mail_key', 'auth mail key', 'current-key-version', 'keyring', 'encryption key')):
    cls = 'AUTH_MAIL_CRYPTO_CONFIGURATION'
elif any(term in s for term in ('econnrefused', 'etimedout', 'connection terminated unexpectedly', 'connection reset')):
    cls = 'DATABASE_TRANSPORT_FAILURE'
else:
    cls = 'UNKNOWN_TRANSACTION_FAILURE'
print(f'{cls}|{len(positions)}')
PY
)"
[[ "$classification" =~ ^[A-Z0-9_]+\|[0-9]+$ ]]
IFS='|' read -r failure_class marker_count <<< "$classification"

printf 'API_RESET_FAILURE|%s|%s|%s|%s\n' "$failure_class" "$marker_count" "$exact_count" "$active_exact_count"
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE
)"

marker="$(grep '^API_RESET_FAILURE|' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$marker" =~ ^API_RESET_FAILURE\|[A-Z0-9_]+\|[0-9]+\|[0-9]+\|[0-9]+$ ]]
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
IFS='|' read -r _ failure_class marker_count exact_container_count active_exact_container_count <<< "$marker"

guard_main

result='PASS_READ_ONLY_CLASSIFIED'
if [[ "$failure_class" == 'NOT_OBSERVED' ]]; then
  result='PASS_READ_ONLY_NOT_OBSERVED'
fi

gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset API failure classifier

- source reset run: \`$RESET_RUN_ID\`
- diagnostic main: \`$SOURCE_SHA\`
- reset revision: \`$RESET_REVISION\`
- attempt window: \`$ATTEMPT_SINCE .. $ATTEMPT_UNTIL\`
- result: \`$result\`
- transaction failure class: \`$failure_class\`
- matching failure marker count: \`$marker_count\`
- exact-revision API containers scanned / currently running: \`$exact_container_count/$active_exact_container_count\`
- raw API logs: \`NOT_PUBLISHED\`
- reviewer identity / account / correlation id exposure: \`NONE\`
- reset token / password / TOTP / credential exposure: \`NONE\`
- reset replay / mail send: \`NONE\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
result_published=1
