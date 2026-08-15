#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_COMPOSE_CLASSIFIER_COMMAND:?PC_AUTH_MAIL_COMPOSE_CLASSIFIER_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-compose-classify 31905081981 current-main'
SUBJECT_SHA='01e38e835f2fec57603eb31e063e62567396a1c2'

key_path="$RUNNER_TEMP/pc-p0-auth-mail-compose-key"
known_hosts="$RUNNER_TEMP/pc-p0-auth-mail-compose-known-hosts"
CURRENT_MAIN='unknown'
scan=''; match=''; result_published=0

cleanup(){ rm -f -- "$key_path" "$known_hosts"; [[ -z "$scan" ]] || rm -f -- "$scan"; [[ -z "$match" ]] || rm -f -- "$match"; }
trap cleanup EXIT
publish_failure(){
  local rc="$?"; trap - ERR
  if [[ "$result_published" == 0 ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail Compose contract classifier

- source cutover run: \`31905081981\`
- production subject: \`$SUBJECT_SHA\`
- diagnostic main: \`$CURRENT_MAIN\`
- result: \`FAIL_CLOSED\`
- raw Compose / environment / credentials: \`NOT_PUBLISHED\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}
trap publish_failure ERR

trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
guard_main(){
  local remote
  remote="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$remote" == "$CURRENT_MAIN" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
}

[[ "$PC_AUTH_MAIL_COMPOSE_CLASSIFIER_COMMAND" == "$COMMAND" ]]
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$CURRENT_MAIN" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$CURRENT_MAIN" && "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
git merge-base --is-ancestor "$SUBJECT_SHA" "$CURRENT_MAIN"
mapfile -t changed < <(git diff --name-only "$SUBJECT_SHA..$CURRENT_MAIN" | sort)
allowed=(
  '.github/workflows/production-p0-auth-mail-compose-contract-classifier-31905081981.yml'
  'docs/platform-v7/autopilot/scopes/production-p0-auth-mail-compose-contract-31905081981-3785.json'
  'scripts/check-production-p0-auth-mail-compose-contract-classifier-31905081981.mjs'
  'scripts/production-p0-auth-mail-compose-contract-classifier-31905081981.sh'
)
[[ "${changed[*]}" == "${allowed[*]}" ]]
[[ -z "$(git status --porcelain=v1)" ]]

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"; user="$(trim "${PC_PROD_SSH_USER:-}")"; port="$(trim "${PC_PROD_SSH_PORT:-22}")"; expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && ((port>=1 && port<=65535))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u | grep -Fxq "$DEFAULT_HOST"

validate_key(){ local source="$1" pub; tr -d '\r' < "$source" > "$key_path"; chmod 0600 "$key_path"; grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1; pub="$(mktemp)"; ssh-keygen -y -P '' -f "$key_path" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }; rm -f "$pub"; }
try_key(){
  local raw="$1" a b c
  [[ -n "$raw" ]] || return 1
  a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"
  printf '%s\n' "$raw" > "$a"; validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }
  rm -f "$a" "$b" "$c"; return 1
}
try_key "${PC_PROD_SSH_KEY:-}" || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_key "${VPS_SSH_KEY:-}"

scan="$(mktemp)"; match="$(mktemp)"; scan_ready=0
for attempt in 1 2 3; do
  : > "$scan"; : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true
  if [[ -s "$scan" ]]; then
    while IFS= read -r line; do
      fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    if [[ "$(grep -c . "$match" || true)" == 1 ]]; then scan_ready=1; break; fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$scan_ready" == 1 ]]
mv "$match" "$known_hosts"; match=''; rm -f "$scan"; scan=''; chmod 0600 "$known_hosts"
guard_main

remote="$(ssh -i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 "$user@$host" "bash -s -- '$SUBJECT_SHA'" <<'REMOTE'
set -Eeuo pipefail
subject_sha="$1"
[[ "$subject_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
command -v python3 >/dev/null 2>&1

tmp="$(mktemp -d /root/pc-auth-mail-compose-classifier.XXXXXX)"
chmod 0700 "$tmp"
cleanup_remote(){ rm -rf -- "$tmp"; }
trap cleanup_remote EXIT
stop_class(){
  local code="$1" file_count="${2:-0}"
  [[ "$code" =~ ^[A-Z0-9_]{1,120}$ ]] || code='CLASSIFIER_OUTPUT_INVALID'
  [[ "$file_count" =~ ^[0-9]{1,3}$ ]] || file_count='0'
  printf 'CONTRACT_CLASS=%s\n' "$code"
  printf 'COMPOSE_FILE_COUNT=%s\n' "$file_count"
  printf 'PRODUCTION_SUBJECT_EXACT=1\n'
  printf 'RAW_CONFIG_PUBLISHED=0\n'
  printf 'PRODUCTION_MUTATION=NONE\n'
  exit 0
}

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#web_ids[@]} == 1 && ${#api_ids[@]} == 1 )) || stop_class 'RUNTIME_CARDINALITY_INVALID' 0
web_id="${web_ids[0]}"; api_id="${api_ids[0]}"
web_rev="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
api_rev="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
[[ "$web_rev" == "$subject_sha" && "$api_rev" == "$subject_sha" ]] || stop_class 'PRODUCTION_SUBJECT_MISMATCH' 0
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
[[ -n "$project" && "$prod_dir" == /* && -d "$prod_dir" && ! -L "$prod_dir" && -n "$config_files" ]] || stop_class 'COMPOSE_AUTHORITY_INVALID' 0
prod_dir="$(realpath -e -- "$prod_dir")"
IFS=',' read -r -a raw_files <<< "$config_files"
compose=(docker compose --project-directory "$prod_dir" --project-name "$project")
count=0
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"; file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" && ! -L "$file" ]] || stop_class 'COMPOSE_FILE_INVALID' "$count"
  resolved="$(realpath -e -- "$file")"
  [[ "$resolved" == "$prod_dir"/* ]] || stop_class 'COMPOSE_FILE_OUTSIDE_PROD' "$count"
  compose+=(-f "$resolved"); ((count+=1))
done
(( count >= 1 )) || stop_class 'COMPOSE_AUTHORITY_EMPTY' 0

cfg="$tmp/config.json"
if ! "${compose[@]}" config --format json > "$cfg" 2>/dev/null; then stop_class 'COMPOSE_RENDER_FAILED' "$count"; fi
api_image="$(docker inspect --format '{{.Config.Image}}' "$api_id")"
web_image="$(docker inspect --format '{{.Config.Image}}' "$web_id")"

class="$(python3 - "$cfg" "$api_image" "$web_image" <<'PY'
import json,re,sys
cfg=json.load(open(sys.argv[1],encoding='utf-8'))
api_image,web_image=sys.argv[2:4]
services=cfg.get('services') or {}
def done(code): print(code); raise SystemExit(0)
def env(service):
    raw=service.get('environment') or {}
    if isinstance(raw,list):
        return {str(x).partition('=')[0]:str(x).partition('=')[2] for x in raw}
    return {str(k):'' if v is None else str(v) for k,v in raw.items()}
for name in ('api','web','auth-mail-worker'):
    if name not in services: done('MISSING_SERVICE_'+name.upper().replace('-','_'))
if str(services['api'].get('image') or '') != api_image: done('API_IMAGE_MISMATCH')
if str(services['web'].get('image') or '') != web_image: done('WEB_IMAGE_MISMATCH')
web=env(services['web'])
if web.get('PC_SMTP_HOST') != 'mail.hosting.reg.ru': done('WEB_SMTP_HOST_MISMATCH')
if web.get('PC_SMTP_PORT') != '465': done('WEB_SMTP_PORT_MISMATCH')
user=web.get('PC_SMTP_USER') or ''
if not re.fullmatch(r'[^\s@<>]{1,64}@[^\s@<>]{1,189}',user): done('WEB_SMTP_USER_INVALID')
if user.rsplit('@',1)[1].lower() != 'xn----8sbjf4befbjgs9b.xn--p1ai': done('WEB_SMTP_USER_DOMAIN_MISMATCH')
if web.get('PC_MAIL_FROM') != 'access@xn----8sbjf4befbjgs9b.xn--p1ai': done('WEB_SMTP_SENDER_MISMATCH')
password=web.get('PC_SMTP_PASS') or ''
if not 8 <= len(password) <= 512: done('WEB_SMTP_PASSWORD_SHAPE_INVALID')
if any(k.startswith('AUTH_MAIL_') for k in web): done('WEB_WORKER_AUTHORITY_LEAK')
if 'PASSWORD_RESET_DELIVERY_KEY' not in web: done('WEB_RESET_BOUNDARY_MISSING')
api=env(services['api'])
if api.get('AUTH_MAIL_OUTBOX_KEYRING_DIR') != '/run/pc-auth-mail/keyring': done('API_KEYRING_MISSING')
if api.get('AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE') != '/run/pc-auth-mail/current-key-version': done('API_KEY_VERSION_MISSING')
if api.get('PC_PUBLIC_SITE_URL') != 'https://xn----8sbjf4befbjgs9b.xn--p1ai': done('API_PUBLIC_SITE_MISMATCH')
if 'PASSWORD_RESET_DELIVERY_KEY' not in api: done('API_RESET_BOUNDARY_MISSING')
for key in ('PC_SMTP_HOST','PC_SMTP_PORT','PC_SMTP_USER','PC_SMTP_PASS','PC_MAIL_FROM','RESEND_API_KEY','RESEND_FROM_EMAIL','AUTH_MAIL_DATABASE_URL_FILE','AUTH_MAIL_TRANSPORT_FILE'):
    if key in api: done('API_FORBIDDEN_'+key)
worker=services['auth-mail-worker']
if str(worker.get('image') or '') != api_image: done('WORKER_IMAGE_MISMATCH')
command=worker.get('command') or []
command_text=' '.join(command) if isinstance(command,list) else str(command)
if 'dist/apps/api/src/auth-mail-worker.js' not in command_text: done('WORKER_COMMAND_MISSING')
worker_env=env(worker)
expected={
 'RUNTIME_COMPONENT':'auth-mail-worker',
 'AUTH_MAIL_WORKER_ENABLED':'true',
 'AUTH_MAIL_OUTBOX_KEYRING_DIR':'/run/pc-auth-mail/keyring',
 'AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE':'/run/pc-auth-mail/current-key-version',
 'AUTH_MAIL_DATABASE_URL_FILE':'/run/pc-auth-mail/database-url',
 'AUTH_MAIL_TRANSPORT_FILE':'/run/pc-auth-mail/transport.env',
}
for key,value in expected.items():
    if worker_env.get(key) != value: done('WORKER_ENV_'+key+'_MISMATCH')
if not worker.get('healthcheck'): done('WORKER_HEALTHCHECK_MISSING')
print('PASS')
PY
)"
[[ "$class" =~ ^[A-Z0-9_]{1,120}$ ]]
stop_class "$class" "$count"
REMOTE
)"

guard_main
contract_class="$(sed -nE 's/^CONTRACT_CLASS=([A-Z0-9_]{1,120})$/\1/p' <<< "$remote")"
compose_count="$(sed -nE 's/^COMPOSE_FILE_COUNT=([0-9]{1,3})$/\1/p' <<< "$remote")"
[[ "$contract_class" =~ ^[A-Z0-9_]{1,120}$ ]]
[[ "$compose_count" =~ ^[0-9]{1,3}$ ]]
grep -Fxq 'PRODUCTION_SUBJECT_EXACT=1' <<< "$remote"
grep -Fxq 'RAW_CONFIG_PUBLISHED=0' <<< "$remote"
grep -Fxq 'PRODUCTION_MUTATION=NONE' <<< "$remote"
[[ "$(grep -c '^CONTRACT_CLASS=' <<< "$remote")" == 1 ]]
[[ "$(grep -c '^COMPOSE_FILE_COUNT=' <<< "$remote")" == 1 ]]

result_published=1
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail Compose contract classifier

- source cutover run: \`31905081981\`
- production subject: \`$SUBJECT_SHA\`
- diagnostic main: \`$CURRENT_MAIN\`
- result: \`PASS_READ_ONLY\`
- contract class: \`$contract_class\`
- Compose authority file count: \`$compose_count\`
- raw Compose / environment / credentials: \`NOT_PUBLISHED\`
- reset / mail / database / container / deployment mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
printf 'P0_AUTH_MAIL_COMPOSE_CLASSIFIER=PASS\nCONTRACT_CLASS=%s\nPRODUCTION_MUTATION=NONE\n' "$contract_class"
