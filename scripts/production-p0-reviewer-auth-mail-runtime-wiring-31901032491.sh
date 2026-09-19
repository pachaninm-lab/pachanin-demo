#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_AUTH_MAIL_WIRING_COMMAND:?PC_REVIEWER_AUTH_MAIL_WIRING_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-auth-mail-runtime-wiring 31901032491 current-main'
RESET_RUN_ID='31901032491'
RESET_REVISION='056ed4461dafb5e7dab2efc9ea5a0d5877523169'
ATTEMPT_SINCE='2026-08-15T18:24:20Z'
AUTHORITY_DIR='/var/lib/pc-secret-authority/runtime'

key_path="$RUNNER_TEMP/pc-p0-auth-mail-wiring-key"
known_hosts="$RUNNER_TEMP/pc-p0-auth-mail-wiring-known-hosts"
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
scan=''; match=''; result_published=0

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
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer auth-mail runtime wiring diagnostic

- source reset run: \`$RESET_RUN_ID\`
- diagnostic main: \`$SOURCE_SHA\`
- reset revision: \`$RESET_REVISION\`
- result: \`FAIL_CLOSED\`
- secret values / raw inspect output: \`NOT_PUBLISHED\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}
trap publish_failure ERR

trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
guard_main() {
  local remote_main
  remote_main="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$remote_main" == "$CURRENT_MAIN" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
}

[[ "$PC_REVIEWER_AUTH_MAIL_WIRING_COMMAND" == "$COMMAND" ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
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
  local source="$1" pub
  tr -d '\r' < "$source" > "$key_path"; chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  pub="$(mktemp)"; ssh-keygen -y -P '' -f "$key_path" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }; rm -f "$pub"
}
try_key() {
  local raw="$1" a b c
  [[ -n "$raw" ]] || return 1
  a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"
  printf '%s\n' "$raw" > "$a"; validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }
  rm -f "$a" "$b" "$c"; return 1
}
try_key "${PC_PROD_SSH_KEY:-}" || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_key "${VPS_SSH_KEY:-}"

guard_main
domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"
scan="$(mktemp)"; match="$(mktemp)"; pinned_ready=0
for attempt in 1 2 3; do
  : > "$scan"; : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true
  if [[ -s "$scan" ]]; then
    while IFS= read -r line; do
      fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    if [[ "$(grep -c . "$match" || true)" == '1' ]]; then pinned_ready=1; break; fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$pinned_ready" == '1' ]]
mv "$match" "$known_hosts"; match=''; rm -f -- "$scan"; scan=''; chmod 0600 "$known_hosts"

guard_main
output="$(ssh -i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$RESET_REVISION' '$ATTEMPT_SINCE' '$AUTHORITY_DIR'" <<'REMOTE'
set -Eeuo pipefail
reset_revision="$1"; attempt_since="$2"; authority_dir="$3"
[[ "$reset_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$attempt_since" == '2026-08-15T18:24:20Z' ]]
[[ "$authority_dir" == '/var/lib/pc-secret-authority/runtime' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1; command -v python3 >/dev/null 2>&1

mapfile -t running_api < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#running_api[@]} == 1 ))
api_id="${running_api[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
[[ "$api_revision" == "$reset_revision" ]]

api_started="$(docker inspect --format '{{.State.StartedAt}}' "$api_id")"
coverage="$(python3 - "$api_started" "$attempt_since" <<'PY'
from datetime import datetime
import sys
start = datetime.fromisoformat(sys.argv[1].replace('Z','+00:00'))
attempt = datetime.fromisoformat(sys.argv[2].replace('Z','+00:00'))
print('1' if start <= attempt else '0')
PY
)"
[[ "$coverage" == '0' || "$coverage" == '1' ]]

env_class="$(docker inspect --format '{{json .Config.Env}}' "$api_id" | python3 -c "import json,sys; e={x.split('=',1)[0]:x.split('=',1)[1] if '=' in x else '' for x in json.load(sys.stdin)}; print('|'.join(['1' if e.get('AUTH_MAIL_OUTBOX_KEYRING_DIR')=='/run/pc-auth-mail/keyring' else '0','1' if e.get('AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE')=='/run/pc-auth-mail/current-key-version' else '0','1' if bool(e.get('PASSWORD_RESET_DELIVERY_KEY','')) else '0']))")"
[[ "$env_class" =~ ^[01]\|[01]\|[01]$ ]]
IFS='|' read -r api_keyring_env api_version_env api_reset_boundary <<< "$env_class"

mount_class="$(docker inspect --format '{{json .Mounts}}' "$api_id" | python3 -c "import json,sys; m=json.load(sys.stdin); d={str(x.get('Destination','')):x for x in m}; ok=lambda p: int(p in d and d[p].get('RW') is False); print(f'{ok(\"/run/pc-auth-mail/keyring\")}|{ok(\"/run/pc-auth-mail/current-key-version\")}')")"
[[ "$mount_class" =~ ^[01]\|[01]$ ]]
IFS='|' read -r api_keyring_mount api_version_mount <<< "$mount_class"

authority_dir_ok=0; authority_keyring_ok=0; authority_version_ok=0
[[ -d "$authority_dir" && ! -L "$authority_dir" && "$(stat -c '%a:%u:%g' "$authority_dir")" == '700:0:0' ]] && authority_dir_ok=1
[[ -d "$authority_dir/keyring" && ! -L "$authority_dir/keyring" && -n "$(find "$authority_dir/keyring" -maxdepth 1 -type f -name 'v*.key' -print -quit 2>/dev/null)" ]] && authority_keyring_ok=1
[[ -f "$authority_dir/current-key-version" && ! -L "$authority_dir/current-key-version" ]] && authority_version_ok=1

mapfile -t workers < <(docker ps -q --filter 'label=com.docker.compose.service=auth-mail-worker')
worker_count="${#workers[@]}"; worker_exact=0
if (( worker_count == 1 )); then
  worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${workers[0]}")"
  [[ "$worker_revision" != "$reset_revision" ]] || worker_exact=1
fi

failure_class='AUTH_MAIL_WIRING_PRESENT'
if [[ "$authority_dir_ok$authority_keyring_ok$authority_version_ok" != '111' ]]; then
  failure_class='AUTH_MAIL_RUNTIME_AUTHORITY_INCOMPLETE'
elif [[ "$api_keyring_env$api_version_env" != '11' ]]; then
  failure_class='AUTH_MAIL_API_ENV_WIRING_MISSING'
elif [[ "$api_keyring_mount$api_version_mount" != '11' ]]; then
  failure_class='AUTH_MAIL_API_SECRET_MOUNTS_MISSING'
elif [[ "$worker_count" != '1' || "$worker_exact" != '1' ]]; then
  failure_class='AUTH_MAIL_WORKER_NOT_EXACT_RUNNING'
fi

printf 'AUTH_MAIL_WIRING|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s\n' \
  "$failure_class" "$coverage" "$api_keyring_env" "$api_version_env" "$api_reset_boundary" \
  "$api_keyring_mount" "$api_version_mount" "$authority_dir_ok" "$authority_keyring_ok" "$authority_version_ok" "$worker_count:$worker_exact"
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE
)"

marker="$(grep '^AUTH_MAIL_WIRING|' <<< "$output" | tail -n1)"; mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$marker" =~ ^AUTH_MAIL_WIRING\|[A-Z0-9_]+\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[0-9]+:[01]$ ]]
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
IFS='|' read -r _ failure_class coverage api_keyring_env api_version_env api_reset_boundary api_keyring_mount api_version_mount authority_dir_ok authority_keyring_ok authority_version_ok worker_state <<< "$marker"

guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer auth-mail runtime wiring diagnostic

- source reset run: \`$RESET_RUN_ID\`
- diagnostic main: \`$SOURCE_SHA\`
- inspected API revision: \`$RESET_REVISION\`
- active API container covers reset attempt: \`$coverage\`
- result: \`PASS_READ_ONLY_CLASSIFIED\`
- wiring class: \`$failure_class\`
- API keyring env / key-version env / reset boundary present: \`$api_keyring_env/$api_version_env/$api_reset_boundary\`
- API keyring mount / key-version mount read-only: \`$api_keyring_mount/$api_version_mount\`
- host auth-mail authority dir / keyring / version marker ready: \`$authority_dir_ok/$authority_keyring_ok/$authority_version_ok\`
- auth-mail worker running/exact: \`$worker_state\`
- secret values / raw docker inspect output: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
result_published=1
