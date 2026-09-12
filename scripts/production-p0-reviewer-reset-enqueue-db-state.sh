#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_DB_STATE_COMMAND:?PC_REVIEWER_RESET_DB_STATE_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-enqueue-db-state current-main'
MIGRATION_NAME='20260812010000_p0_industrial_auth_mail_outbox'
MIGRATION_PATH='apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql'
MIGRATION_DATASOURCE_FIX_SHA='1762b4a22a99d786a971e78cbe16ec1f74bb5a74'
FUNCTION_SIG='auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'
REMOTE_SCRIPT='scripts/production-p0-reviewer-reset-enqueue-db-state-remote.sh'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-db-state-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-db-state-known-hosts"
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
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset enqueue DB state

- diagnostic main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED_STAGE_CLASSIFIED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- database access: \`READ_ONLY_CATALOG_AND_MIGRATION_METADATA\`
- customer/user rows: \`NOT_READ\`
- raw DB errors / DSN / credentials / PII: \`NOT_PUBLISHED\`
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
[[ "$PC_REVIEWER_RESET_DB_STATE_COMMAND" == "$COMMAND" ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
git cat-file -e "${MIGRATION_DATASOURCE_FIX_SHA}^{commit}"
git merge-base --is-ancestor "$MIGRATION_DATASOURCE_FIX_SHA" "$CURRENT_MAIN"
[[ -f "$MIGRATION_PATH" && -f "$REMOTE_SCRIPT" ]]
grep -Fq 'CREATE OR REPLACE FUNCTION auth.enqueue_mail_outbox(' "$MIGRATION_PATH"
grep -Fq 'REVOKE ALL ON FUNCTION auth.enqueue_mail_outbox(' "$MIGRATION_PATH"
bash -n "$REMOTE_SCRIPT"
[[ -z "$(git status --porcelain=v1)" ]]

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
ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null; python3 --version >/dev/null' >/dev/null

guard_main
LOCAL_STAGE='REMOTE_DB_STATE'
set +e
output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$MIGRATION_NAME' '$FUNCTION_SIG'" < "$REMOTE_SCRIPT" 2>/dev/null)"
ssh_rc=$?
set -e

remote_stage="$(sed -n 's/^REMOTE_STAGE=//p' <<< "$output" | tail -n1 || true)"
remote_rc="$(sed -n 's/^REMOTE_RC=//p' <<< "$output" | tail -n1 || true)"
mutation="$(sed -n 's/^PRODUCTION_MUTATION=//p' <<< "$output" | tail -n1 || true)"
if [[ "$remote_stage" =~ ^[A-Z0-9_]+$ ]]; then REMOTE_STAGE="$remote_stage"; else REMOTE_STAGE='NO_SAFE_REMOTE_STAGE'; fi
if [[ "$remote_rc" =~ ^[0-9]+$ ]]; then REMOTE_RC="$remote_rc"; else REMOTE_RC="$ssh_rc"; fi
[[ "$mutation" == NONE ]] || { REMOTE_STAGE='MUTATION_ATTESTATION_MISSING'; publish_failure 91; }
if (( ssh_rc != 0 )); then publish_failure "$ssh_rc"; fi
[[ "$REMOTE_STAGE" == COMPLETE && "$REMOTE_RC" == 0 ]]

LOCAL_STAGE='RESULT_VALIDATE'
allowed_keys='ACTIVE_REVISION API_WEB_REVISION_PARITY MAIN_DB_TARGET_PARITY AUTH_DB_TARGET_PARITY API_QUERY_CLASS API_PRODUCER_PRINCIPAL AUTH_SCHEMA_EXISTS MAIL_OUTBOX_EXISTS ENQUEUE_FUNCTION_EXISTS API_AUTH_SCHEMA_USAGE API_ENQUEUE_EXECUTE MIGRATION_QUERY_CLASS AUTH_MAIL_OUTBOX_MIGRATION MIGRATION_AUTH_FUNCTION_EXISTS MIGRATION_AUTH_TABLE_EXISTS REMOTE_STAGE REMOTE_RC PRODUCTION_MUTATION'
for key in $allowed_keys; do
  value="$(sed -n "s/^${key}=//p" <<< "$output" | tail -n1 || true)"
  [[ -n "$value" && "$value" =~ ^[A-Za-z0-9_.:-]{1,160}$ ]]
  printf -v "$key" '%s' "$value"
done
[[ "$ACTIVE_REVISION" =~ ^[0-9a-f]{40}$ ]]
git cat-file -e "${ACTIVE_REVISION}^{commit}"
git merge-base --is-ancestor "$ACTIVE_REVISION" "$CURRENT_MAIN"
git cat-file -e "$ACTIVE_REVISION:$MIGRATION_PATH"
[[ "$PRODUCTION_MUTATION" == NONE ]]

guard_main
LOCAL_STAGE='PUBLISH_RESULT'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset enqueue DB state

- diagnostic main: \`$SOURCE_SHA\`
- active API/Web revision: \`$ACTIVE_REVISION\`
- result: \`PASS_READ_ONLY_DB_STATE\`
- API/Web revision parity: \`$API_WEB_REVISION_PARITY\`
- migration → API DB target parity: \`$MAIN_DB_TARGET_PARITY\`
- migration → AUTH DB target parity: \`$AUTH_DB_TARGET_PARITY\`
- API catalog query / authorized producer principal: \`$API_QUERY_CLASS / $API_PRODUCER_PRINCIPAL\`
- auth schema / mail_outbox table: \`$AUTH_SCHEMA_EXISTS / $MAIL_OUTBOX_EXISTS\`
- exact enqueue function / API EXECUTE: \`$ENQUEUE_FUNCTION_EXISTS / $API_ENQUEUE_EXECUTE\`
- API auth schema USAGE: \`$API_AUTH_SCHEMA_USAGE\`
- migration metadata query: \`$MIGRATION_QUERY_CLASS\`
- migration \`$MIGRATION_NAME\`: \`$AUTH_MAIL_OUTBOX_MIGRATION\`
- migration-authority function / table: \`$MIGRATION_AUTH_FUNCTION_EXISTS / $MIGRATION_AUTH_TABLE_EXISTS\`
- database access: \`READ_ONLY_CATALOG_AND_MIGRATION_METADATA\`
- customer/user rows: \`NOT_READ\`
- raw DB errors / DSN / credentials / PII: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
result_published=1
