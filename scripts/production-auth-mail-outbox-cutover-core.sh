#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"
TARGET_SHA="${2:-}"
UPSTREAM_RUN_ID="${3:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
PROD_COMPOSE_B64="${PC_PROD_COMPOSE_B64:-}"
PROD_PROJECT_B64="${PC_PROD_PROJECT_B64:-}"
STATE_ROOT="/var/lib/pc-release-authority"
AUTHORITY_DIR="/var/lib/pc-secret-authority"
AUTH_MAIL_RUNTIME_DIR="$AUTHORITY_DIR/runtime"
AUTH_MAIL_TRANSPORT_AUTHORITY="$AUTHORITY_DIR/auth-mail-transport.env"
AUTH_MAIL_PROVISION_SCRIPT="${PC_AUTH_MAIL_PROVISION_SCRIPT:-/tmp/pc-auth-mail-provision-${UPSTREAM_RUN_ID}.sh}"
AUTH_MAIL_WORKER_SERVICE="auth-mail-worker"
PUBLIC_SITE_ORIGIN="https://xn----8sbjf4befbjgs9b.xn--p1ai"

fail() { printf 'ERROR_CODE=%s\n' "$1" >&2; exit "${2:-1}"; }
decode() { [[ -z "$1" ]] || printf '%s' "$1" | base64 -d; }
trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
is_revision() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }

[[ "$ACTION" =~ ^(audit|cutover|rollback)$ ]] || fail INVALID_ACTION 2
is_revision "$TARGET_SHA" || fail INVALID_TARGET_SHA 3
[[ "$UPSTREAM_RUN_ID" =~ ^[0-9]{1,24}$ ]] || fail INVALID_UPSTREAM_RUN_ID 4
[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED 5
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 6
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 7

auth_opaque_token_env_file=""
staff_database_env_file=""
password_reset_delivery_env_file=""
transactional_mail_env_file=""
gekta_api_runtime_env_file=""
gekta_web_runtime_env_file=""
prod_dir="$(decode "$PROD_DIR_B64")"
prod_compose="$(decode "$PROD_COMPOSE_B64")"
prod_project="$(decode "$PROD_PROJECT_B64")"

resolve_compose_authority() {
  if [[ -n "$prod_dir" && -n "$prod_compose" && -n "$prod_project" ]]; then return 0; fi
  mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  (( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 10
  local web_id="${web_ids[0]}"
  prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
  prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
  prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
  [[ -n "$prod_dir" && -n "$prod_compose" && -n "$prod_project" ]] || fail COMPOSE_LABEL_AUTHORITY_MISSING 11
}

resolve_compose_authority
[[ "$prod_dir" == /* && "$prod_dir" != / && -d "$prod_dir" && ! -L "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 12
prod_dir="$(realpath -e -- "$prod_dir")"
full_override="$prod_dir/compose.production-full-stack-image.override.yml"

IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="$(trim "$raw")"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" && ! -L "$file" ]] || fail PROTECTED_COMPOSE_FILE_MISSING 13
  [[ "$(realpath -e -- "$file")" == "$full_override" ]] || compose_files+=("$(realpath -e -- "$file")")
done
(( ${#compose_files[@]} >= 1 )) || fail COMPOSE_AUTHORITY_EMPTY 14

dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done

compose_json="$(mktemp)"
"${dc[@]}" config --format json > "$compose_json"
migration_service="$(python3 - "$compose_json" <<'PY'
import json, re, sys
cfg = json.load(open(sys.argv[1], encoding='utf-8'))
services = cfg.get('services') or {}
for required in ('api', 'web'):
    if required not in services:
        raise SystemExit(f'MISSING:{required}')
candidates=[]
for name, service in services.items():
    image=str(service.get('image') or '')
    command=service.get('command')
    command=' '.join(command) if isinstance(command, list) else str(command or '')
    if re.search(r'(^|[-_])(migrate|migration)([-_]|$)', name, re.I) or 'grainflow-migration' in image or ('prisma' in command and 'migrate' in command):
        candidates.append(name)
if len(candidates) != 1:
    raise SystemExit(f'MIGRATION_COUNT:{len(candidates)}')
print(candidates[0])
PY
)" || { rm -f "$compose_json"; fail COMPOSE_SERVICE_DISCOVERY_FAILED 15; }
rm -f "$compose_json"

regular_0600() {
  [[ -f "$1" && ! -L "$1" && "$(stat -c '%a:%u:%g' "$1")" == '600:0:0' ]]
}

resolve_runtime_authorities() {
  auth_opaque_token_env_file="${PC_AUTH_OPAQUE_TOKEN_ENV_FILE:-$prod_dir/.pc-auth-opaque-token.env}"
  staff_database_env_file="${PC_STAFF_DATABASE_ENV_FILE:-$prod_dir/.pc-staff-database.env}"
  password_reset_delivery_env_file="${PC_PASSWORD_RESET_DELIVERY_ENV_FILE:-$prod_dir/.pc-password-reset-delivery.env}"
  transactional_mail_env_file="${PC_TRANSACTIONAL_MAIL_ENV_FILE:-$prod_dir/.pc-transactional-mail.env}"
  gekta_api_runtime_env_file="${PC_GEKTA_API_RUNTIME_ENV_FILE:-$prod_dir/.pc-gekta-api-runtime.env}"
  gekta_web_runtime_env_file="${PC_GEKTA_WEB_RUNTIME_ENV_FILE:-$prod_dir/.pc-gekta-web-runtime.env}"
  for path in \
    "$auth_opaque_token_env_file" \
    "$staff_database_env_file" \
    "$password_reset_delivery_env_file" \
    "$transactional_mail_env_file" \
    "$gekta_api_runtime_env_file" \
    "$gekta_web_runtime_env_file"; do
    [[ "$path" == "$prod_dir"/* ]] || fail RUNTIME_AUTHORITY_OUTSIDE_PRODUCTION_DIRECTORY 16
    regular_0600 "$path" || fail RUNTIME_AUTHORITY_INVALID 17
  done
  python3 - "$password_reset_delivery_env_file" <<'PY' || fail PASSWORD_RESET_DELIVERY_AUTHORITY_INVALID 18
import re, sys
values={}
for raw in open(sys.argv[1], encoding='utf-8'):
    name, sep, value=raw.rstrip('\n').partition('=')
    if not sep or name in values:
        raise SystemExit(1)
    values[name]=value
if set(values) != {'PASSWORD_RESET_DELIVERY_KEY','REGISTRATION_DELIVERY_KEY'}:
    raise SystemExit(1)
if not all(re.fullmatch(r'[A-Fa-f0-9]{96}', v or '') for v in values.values()):
    raise SystemExit(1)
if values['PASSWORD_RESET_DELIVERY_KEY'] == values['REGISTRATION_DELIVERY_KEY']:
    raise SystemExit(1)
PY
}
resolve_runtime_authorities

state_file="$STATE_ROOT/full-stack-${UPSTREAM_RUN_ID}.state"
regular_0600 "$state_file" || fail RELEASE_BASELINE_STATE_MISSING 19
state_value() {
  python3 - "$state_file" "$1" <<'PY'
import ast, re, sys
path, key = sys.argv[1:3]
if not re.fullmatch(r'[A-Z0-9_]+', key):
    raise SystemExit(1)
for raw in open(path, encoding='utf-8'):
    name, sep, value = raw.rstrip('\n').partition('=')
    if name != key or not sep:
        continue
    try:
        parsed = ast.literal_eval(value)
    except Exception:
        raise SystemExit(1)
    if not isinstance(parsed, str) or not parsed or '\n' in parsed or '\r' in parsed or '\0' in parsed:
        raise SystemExit(1)
    print(parsed)
    raise SystemExit(0)
raise SystemExit(1)
PY
}

baseline_api_image="$(state_value BASELINE_API_IMAGE)" || fail BASELINE_API_IMAGE_MISSING 20
baseline_web_image="$(state_value BASELINE_WEB_IMAGE)" || fail BASELINE_WEB_IMAGE_MISSING 21
baseline_api_revision="$(state_value BASELINE_API_REVISION)" || fail BASELINE_API_REVISION_MISSING 22
baseline_web_revision="$(state_value BASELINE_WEB_REVISION)" || fail BASELINE_WEB_REVISION_MISSING 23
migration_image="$(state_value MIGRATION_IMAGE)" || fail TARGET_MIGRATION_IMAGE_MISSING 24
is_revision "$baseline_api_revision" || fail BASELINE_API_REVISION_INVALID 25
is_revision "$baseline_web_revision" || fail BASELINE_WEB_REVISION_INVALID 26

compose_id() { "${dc[@]}" -f "$full_override" ps -q "$1" 2>/dev/null | head -1; }
api_id="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=api' | head -1)"
web_id="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=web' | head -1)"
[[ -n "$api_id" && -n "$web_id" ]] || fail TARGET_RUNTIME_MISSING 27
target_api_image="$(docker inspect --format '{{.Config.Image}}' "$api_id")"
target_web_image="$(docker inspect --format '{{.Config.Image}}' "$web_id")"
target_api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
target_web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$target_api_revision" == "$TARGET_SHA" && "$target_web_revision" == "$TARGET_SHA" ]] || fail TARGET_RELEASE_NOT_EXACT 28

mapfile -t pre_worker_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$prod_project" \
  --filter "label=com.docker.compose.service=$AUTH_MAIL_WORKER_SERVICE")
(( ${#pre_worker_ids[@]} <= 1 )) || fail PREEXISTING_WORKER_AMBIGUOUS 29
pre_worker_present=0
pre_worker_image=''
pre_worker_revision=''
if (( ${#pre_worker_ids[@]} == 1 )); then
  pre_worker_present=1
  pre_worker_image="$(docker inspect --format '{{.Config.Image}}' "${pre_worker_ids[0]}")"
  pre_worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${pre_worker_ids[0]}")"
  is_revision "$pre_worker_revision" || fail PREEXISTING_WORKER_REVISION_INVALID 30
fi

wait_api() {
  local id attempt
  for attempt in $(seq 1 30); do
    id="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=api' | head -1)"
    if [[ -n "$id" ]] && docker exec "$id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then return 0; fi
    sleep 4
  done
  return 1
}

wait_web() {
  local id state attempt
  for attempt in $(seq 1 30); do
    id="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=web' | head -1)"
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
    [[ "$state" == healthy ]] && return 0
    sleep 4
  done
  return 1
}

wait_worker() {
  local id state attempt
  for attempt in $(seq 1 30); do
    id="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter "label=com.docker.compose.service=$AUTH_MAIL_WORKER_SERVICE" | head -1)"
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
    if [[ "$state" == healthy ]] && docker exec "$id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then return 0; fi
    sleep 4
  done
  return 1
}

auth_mail_projection_ready() {
  [[ -d "$AUTH_MAIL_RUNTIME_DIR" && ! -L "$AUTH_MAIL_RUNTIME_DIR" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$AUTH_MAIL_RUNTIME_DIR")" == '700:0:0' ]] || return 1
  [[ -d "$AUTH_MAIL_RUNTIME_DIR/keyring" && ! -L "$AUTH_MAIL_RUNTIME_DIR/keyring" ]] || return 1
  [[ -f "$AUTH_MAIL_RUNTIME_DIR/current-key-version" && -f "$AUTH_MAIL_RUNTIME_DIR/database-url" && -f "$AUTH_MAIL_RUNTIME_DIR/transport.env" ]] || return 1
  [[ -n "$(find "$AUTH_MAIL_RUNTIME_DIR/keyring" -maxdepth 1 -type f -name 'v*.key' -print -quit)" ]] || return 1
  for projected in "$AUTH_MAIL_RUNTIME_DIR/current-key-version" "$AUTH_MAIL_RUNTIME_DIR/database-url" "$AUTH_MAIL_RUNTIME_DIR/transport.env" "$AUTH_MAIL_RUNTIME_DIR"/keyring/v*.key; do
    [[ -f "$projected" && ! -L "$projected" && "$(stat -c '%a:%u:%g' "$projected")" == '444:0:0' ]] || return 1
  done
}

ensure_canonical_auth_mail_transport() {
  install -d -m 0700 -o 0 -g 0 "$AUTHORITY_DIR"
  if [[ ! -e "$AUTH_MAIL_TRANSPORT_AUTHORITY" ]]; then
    tmp_transport="$(mktemp "$AUTHORITY_DIR/.auth-mail-transport-migrate.XXXXXX")"
    python3 - "$transactional_mail_env_file" <<'PY' > "$tmp_transport" || { rm -f "$tmp_transport"; fail LEGACY_SMTP_NOT_CANONICAL 31; }
import sys
values={}
for raw in open(sys.argv[1], encoding='utf-8'):
    name, sep, value=raw.rstrip('\n').partition('=')
    if not sep or name in values:
        raise SystemExit(1)
    values[name]=value
required={'PC_SMTP_HOST','PC_SMTP_USER','PC_SMTP_PASS'}
allowed=required | {'PC_SMTP_PORT','PC_MAIL_FROM'}
if not required.issubset(values) or not set(values).issubset(allowed):
    raise SystemExit(1)
host=values['PC_SMTP_HOST'].strip().lower()
port=values.get('PC_SMTP_PORT','465').strip()
user=values['PC_SMTP_USER'].strip()
sender=values.get('PC_MAIL_FROM',user).strip()
password=values['PC_SMTP_PASS']
if host != 'mail.hosting.reg.ru' or port != '465':
    raise SystemExit(1)
if user != 'access@xn----8sbjf4befbjgs9b.xn--p1ai' or sender != user:
    raise SystemExit(1)
if not 8 <= len(password) <= 512 or any(c in password for c in '\r\n\0'):
    raise SystemExit(1)
print(f'PC_SMTP_HOST={host}')
print('PC_SMTP_PORT=465')
print(f'PC_SMTP_USER={user}')
print(f'PC_SMTP_PASS={password}')
print(f'PC_MAIL_FROM={sender}')
PY
    chmod 0600 "$tmp_transport"
    chown 0:0 "$tmp_transport"
    mv -f "$tmp_transport" "$AUTH_MAIL_TRANSPORT_AUTHORITY"
  fi
  regular_0600 "$AUTH_MAIL_TRANSPORT_AUTHORITY" || fail AUTH_MAIL_TRANSPORT_AUTHORITY_INVALID 32
  python3 - "$AUTH_MAIL_TRANSPORT_AUTHORITY" <<'PY' >/dev/null || fail AUTH_MAIL_TRANSPORT_AUTHORITY_CONTENT_INVALID 33
import sys
values={}
for raw in open(sys.argv[1], encoding='utf-8'):
    name, sep, value=raw.rstrip('\n').partition('=')
    if sep:
        values[name]=value
if set(values) != {'PC_SMTP_HOST','PC_SMTP_PORT','PC_SMTP_USER','PC_SMTP_PASS','PC_MAIL_FROM'}:
    raise SystemExit(1)
if values['PC_SMTP_HOST'] != 'mail.hosting.reg.ru' or values['PC_SMTP_PORT'] != '465':
    raise SystemExit(1)
if values['PC_SMTP_USER'] != 'access@xn----8sbjf4befbjgs9b.xn--p1ai' or values['PC_MAIL_FROM'] != values['PC_SMTP_USER']:
    raise SystemExit(1)
if not 8 <= len(values['PC_SMTP_PASS']) <= 512 or any(c in values['PC_SMTP_PASS'] for c in '\r\n\0'):
    raise SystemExit(1)
PY
}

write_legacy_override() {
  local api_image="$1" web_image="$2" migration="$3"
  umask 077
  cat > "$full_override.tmp" <<YAML
services:
  api:
    image: ${api_image}
    pull_policy: never
    env_file:
      - ${auth_opaque_token_env_file}
      - ${staff_database_env_file}
      - ${password_reset_delivery_env_file}
      - ${gekta_api_runtime_env_file}
  web:
    image: ${web_image}
    pull_policy: never
    env_file:
      - ${password_reset_delivery_env_file}
      - ${transactional_mail_env_file}
      - ${gekta_web_runtime_env_file}
  ${migration_service}:
    image: ${migration}
    pull_policy: never
YAML
  mv -f "$full_override.tmp" "$full_override"
  chmod 0600 "$full_override"
}

write_auth_mail_override() {
  local api_image="$1" web_image="$2" worker_image="$3" migration="$4"
  auth_mail_projection_ready || fail AUTH_MAIL_RUNTIME_PROJECTION_MISSING 34
  umask 077
  cat > "$full_override.tmp" <<YAML
services:
  api:
    image: ${api_image}
    pull_policy: never
    env_file:
      - ${auth_opaque_token_env_file}
      - ${staff_database_env_file}
      - ${password_reset_delivery_env_file}
      - ${gekta_api_runtime_env_file}
    environment:
      AUTH_MAIL_OUTBOX_KEYRING_DIR: /run/pc-auth-mail/keyring
      AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE: /run/pc-auth-mail/current-key-version
      PC_PUBLIC_SITE_URL: ${PUBLIC_SITE_ORIGIN}
    volumes:
      - ${AUTH_MAIL_RUNTIME_DIR}/keyring:/run/pc-auth-mail/keyring:ro
      - ${AUTH_MAIL_RUNTIME_DIR}/current-key-version:/run/pc-auth-mail/current-key-version:ro
  web:
    image: ${web_image}
    pull_policy: never
    env_file:
      - ${password_reset_delivery_env_file}
      - ${gekta_web_runtime_env_file}
  ${AUTH_MAIL_WORKER_SERVICE}:
    image: ${worker_image}
    pull_policy: never
    command:
      - dist/apps/api/src/auth-mail-worker.js
    restart: unless-stopped
    environment:
      NODE_ENV: production
      RUNTIME_COMPONENT: auth-mail-worker
      AUTH_MAIL_WORKER_ENABLED: "true"
      AUTH_MAIL_WORKER_HEALTH_PORT: "3003"
      AUTH_MAIL_OUTBOX_KEYRING_DIR: /run/pc-auth-mail/keyring
      AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE: /run/pc-auth-mail/current-key-version
      AUTH_MAIL_DATABASE_URL_FILE: /run/pc-auth-mail/database-url
      AUTH_MAIL_TRANSPORT_FILE: /run/pc-auth-mail/transport.env
    volumes:
      - ${AUTH_MAIL_RUNTIME_DIR}/keyring:/run/pc-auth-mail/keyring:ro
      - ${AUTH_MAIL_RUNTIME_DIR}/current-key-version:/run/pc-auth-mail/current-key-version:ro
      - ${AUTH_MAIL_RUNTIME_DIR}/database-url:/run/pc-auth-mail/database-url:ro
      - ${AUTH_MAIL_RUNTIME_DIR}/transport.env:/run/pc-auth-mail/transport.env:ro
    healthcheck:
      test: ["CMD", "/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 10s
  ${migration_service}:
    image: ${migration}
    pull_policy: never
YAML
  mv -f "$full_override.tmp" "$full_override"
  chmod 0600 "$full_override"
}

dc_target=("${dc[@]}" -f "$full_override")

verify_auth_mail_compose_contract() {
  local cfg
  cfg="$(mktemp)"
  "${dc_target[@]}" config --format json > "$cfg"
  python3 - "$cfg" "$target_api_image" "$target_web_image" <<'PY' || { rm -f "$cfg"; return 1; }
import json, sys
cfg=json.load(open(sys.argv[1], encoding='utf-8'))
api_image, web_image=sys.argv[2:4]
services=cfg.get('services') or {}
for name in ('api','web','auth-mail-worker'):
    if name not in services:
        raise SystemExit(f'missing:{name}')
def env(service):
    raw=service.get('environment') or {}
    if isinstance(raw, list):
        return {str(item).partition('=')[0]:str(item).partition('=')[2] for item in raw}
    return {str(k):'' if v is None else str(v) for k,v in raw.items()}
if str(services['api'].get('image') or '') != api_image or str(services['web'].get('image') or '') != web_image:
    raise SystemExit('target image mismatch')
web=env(services['web'])
for key in ('PC_SMTP_HOST','PC_SMTP_PORT','PC_SMTP_USER','PC_SMTP_PASS','PC_MAIL_FROM','RESEND_API_KEY','RESEND_FROM_EMAIL','AUTH_MAIL_OUTBOX_KEYRING_DIR','AUTH_MAIL_DATABASE_URL_FILE','AUTH_MAIL_TRANSPORT_FILE'):
    if key in web:
        raise SystemExit(f'web mail authority:{key}')
if 'PASSWORD_RESET_DELIVERY_KEY' not in web:
    raise SystemExit('web reset boundary missing')
api=env(services['api'])
if api.get('AUTH_MAIL_OUTBOX_KEYRING_DIR') != '/run/pc-auth-mail/keyring':
    raise SystemExit('api keyring missing')
if api.get('AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE') != '/run/pc-auth-mail/current-key-version':
    raise SystemExit('api key version missing')
if api.get('PC_PUBLIC_SITE_URL') != 'https://xn----8sbjf4befbjgs9b.xn--p1ai':
    raise SystemExit('api public site mismatch')
if 'PASSWORD_RESET_DELIVERY_KEY' not in api:
    raise SystemExit('api reset boundary missing')
for key in ('PC_SMTP_HOST','PC_SMTP_PORT','PC_SMTP_USER','PC_SMTP_PASS','PC_MAIL_FROM','RESEND_API_KEY','RESEND_FROM_EMAIL','AUTH_MAIL_DATABASE_URL_FILE','AUTH_MAIL_TRANSPORT_FILE'):
    if key in api:
        raise SystemExit(f'api forbidden mail authority:{key}')
worker=services['auth-mail-worker']
if str(worker.get('image') or '') != api_image:
    raise SystemExit('worker image mismatch')
command=worker.get('command') or []
command_text=' '.join(command) if isinstance(command, list) else str(command)
if 'dist/apps/api/src/auth-mail-worker.js' not in command_text:
    raise SystemExit('worker command missing')
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
    if worker_env.get(key) != value:
        raise SystemExit(f'worker env:{key}')
if not worker.get('healthcheck'):
    raise SystemExit('worker healthcheck missing')
PY
  rc=$?
  rm -f "$cfg"
  return "$rc"
}

verify_runtime_revisions() {
  local expected_api="$1" expected_web="$2" expected_worker="${3:-}"
  local current_api current_web current_worker=''
  current_api="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=api' | head -1)"
  current_web="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=web' | head -1)"
  [[ -n "$current_api" && -n "$current_web" ]] || return 1
  [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$current_api")" == "$expected_api" ]] || return 1
  [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$current_web")" == "$expected_web" ]] || return 1
  if [[ -n "$expected_worker" ]]; then
    current_worker="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter "label=com.docker.compose.service=$AUTH_MAIL_WORKER_SERVICE" | head -1)"
    [[ -n "$current_worker" ]] || return 1
    [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$current_worker")" == "$expected_worker" ]] || return 1
  fi
}

verify_runtime_secret_boundary() {
  local api web worker
  api="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=api' | head -1)"
  web="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=web' | head -1)"
  worker="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter "label=com.docker.compose.service=$AUTH_MAIL_WORKER_SERVICE" | head -1)"
  [[ -n "$api" && -n "$web" && -n "$worker" ]] || return 1
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$web" \
    | grep -Eq '^(PC_SMTP_|PC_MAIL_FROM=|RESEND_API_KEY=|RESEND_FROM_EMAIL=|AUTH_MAIL_)' && return 1
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api" \
    | grep -Eq '^(PC_SMTP_|PC_MAIL_FROM=|RESEND_API_KEY=|RESEND_FROM_EMAIL=|AUTH_MAIL_DATABASE_URL_FILE=|AUTH_MAIL_TRANSPORT_FILE=)' && return 1
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$worker" \
    | grep -Eq '^(PC_SMTP_PASS=|AUTH_MAIL_DATABASE_URL=)' && return 1
  return 0
}

restore_baseline() {
  set +e
  if (( pre_worker_present == 1 )); then
    auth_mail_projection_ready || return 1
    write_auth_mail_override "$baseline_api_image" "$baseline_web_image" "$pre_worker_image" "$migration_image" || return 1
    "${dc_target[@]}" config --quiet || return 1
    "${dc_target[@]}" up -d --no-deps --pull never api "$AUTH_MAIL_WORKER_SERVICE" web || return 1
    wait_api && wait_worker && wait_web || return 1
    verify_runtime_revisions "$baseline_api_revision" "$baseline_web_revision" "$pre_worker_revision" || return 1
  else
    write_legacy_override "$baseline_api_image" "$baseline_web_image" "$migration_image" || return 1
    mapfile -t worker_ids < <(docker ps -aq --filter "label=com.docker.compose.project=$prod_project" --filter "label=com.docker.compose.service=$AUTH_MAIL_WORKER_SERVICE")
    for worker_id in "${worker_ids[@]:-}"; do [[ -n "$worker_id" ]] && docker rm -f "$worker_id" >/dev/null 2>&1; done
    "${dc_target[@]}" config --quiet || return 1
    "${dc_target[@]}" up -d --no-deps --pull never api web || return 1
    wait_api && wait_web || return 1
    verify_runtime_revisions "$baseline_api_revision" "$baseline_web_revision" || return 1
  fi
  return 0
}

if [[ "$ACTION" == audit ]]; then
  printf 'AUTH_MAIL_CUTOVER_AUDIT=PASS\n'
  printf 'TARGET_SHA=%s\n' "$TARGET_SHA"
  printf 'TARGET_API_REVISION=%s\n' "$target_api_revision"
  printf 'TARGET_WEB_REVISION=%s\n' "$target_web_revision"
  printf 'PREEXISTING_AUTH_MAIL_WORKER=%s\n' "$pre_worker_present"
  exit 0
fi

if [[ "$ACTION" == rollback ]]; then
  restore_baseline || fail BASELINE_ROLLBACK_FAILED 35
  printf 'ROLLBACK_COMPLETE=1\n'
  printf 'RESTORED_API_REVISION=%s\n' "$baseline_api_revision"
  printf 'RESTORED_WEB_REVISION=%s\n' "$baseline_web_revision"
  printf 'RESTORED_AUTH_MAIL_WORKER_REVISION=%s\n' "${pre_worker_revision:-none}"
  exit 0
fi

on_error() {
  rc=$?
  trap - ERR
  rollback_status=0
  restore_baseline || rollback_status=$?
  printf 'AUTH_MAIL_CUTOVER=FAIL\n' >&2
  printf 'ROLLBACK_ATTEMPTED=1\n' >&2
  printf 'ROLLBACK_COMPLETE=%s\n' "$([[ "$rollback_status" == 0 ]] && echo 1 || echo 0)" >&2
  exit "$rc"
}
trap on_error ERR

# The exact API image is already present after the upstream release. Prove the
# dedicated entrypoint exists before any cutover mutation.
docker run --rm --entrypoint /nodejs/bin/node "$target_api_image" \
  -e "require('node:fs').accessSync('/app/dist/apps/api/src/auth-mail-worker.js')" >/dev/null
printf 'AUTH_MAIL_WORKER_ARTIFACT=PASS\n'

ensure_canonical_auth_mail_transport
[[ -f "$AUTH_MAIL_PROVISION_SCRIPT" && ! -L "$AUTH_MAIL_PROVISION_SCRIPT" ]] || fail AUTH_MAIL_PROVISION_ASSET_MISSING 36
chmod 0700 "$AUTH_MAIL_PROVISION_SCRIPT"
"$AUTH_MAIL_PROVISION_SCRIPT" bootstrap \
  | grep -E '^AUTH_MAIL_(PROVISION|SECRET_AUTHORITY|SMTP_AUTHORITY|CURRENT_KEY_VERSION|GITHUB_SECRET_REQUIRED)='
auth_mail_projection_ready || fail AUTH_MAIL_RUNTIME_PROJECTION_MISSING 37
printf 'AUTH_MAIL_RUNTIME_PROVISION=PASS\n'

write_auth_mail_override "$target_api_image" "$target_web_image" "$target_api_image" "$migration_image"
"${dc_target[@]}" config --quiet
verify_auth_mail_compose_contract || fail AUTH_MAIL_COMPOSE_CONTRACT_FAILED 38
printf 'AUTH_MAIL_COMPOSE_CONTRACT=PASS\n'

"${dc_target[@]}" up -d --no-deps --pull never api
wait_api || fail API_READINESS_FAILED 39
"${dc_target[@]}" up -d --no-deps --pull never "$AUTH_MAIL_WORKER_SERVICE"
wait_worker || fail AUTH_MAIL_WORKER_READINESS_FAILED 40
"${dc_target[@]}" up -d --no-deps --pull never web
wait_web || fail WEB_HEALTH_FAILED 41
verify_runtime_revisions "$TARGET_SHA" "$TARGET_SHA" "$TARGET_SHA" || fail CUTOVER_REVISION_MISMATCH 42
verify_runtime_secret_boundary || fail RUNTIME_SECRET_BOUNDARY_FAILED 43

worker_id="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter "label=com.docker.compose.service=$AUTH_MAIL_WORKER_SERVICE" | head -1)"
worker_metrics="$(docker exec "$worker_id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3003/metrics',{signal:AbortSignal.timeout(4000)}).then(async r=>{if(!r.ok)process.exit(1);const x=await r.json();if(x.component!=='auth-mail-worker')process.exit(1);process.stdout.write(JSON.stringify({component:x.component,claimed:x.claimed,sent:x.sent,retried:x.retried,deadLettered:x.deadLettered}))}).catch(()=>process.exit(1))")"
[[ "$worker_metrics" == *'"component":"auth-mail-worker"'* ]] || fail AUTH_MAIL_WORKER_METRICS_INVALID 44

trap - ERR
printf 'AUTH_MAIL_CUTOVER=PASS\n'
printf 'TARGET_SHA=%s\n' "$TARGET_SHA"
printf 'DEPLOYED_API_REVISION=%s\n' "$TARGET_SHA"
printf 'DEPLOYED_WEB_REVISION=%s\n' "$TARGET_SHA"
printf 'DEPLOYED_AUTH_MAIL_WORKER_REVISION=%s\n' "$TARGET_SHA"
printf 'AUTH_MAIL_WORKER_READY=PASS\n'
printf 'AUTH_MAIL_RUNTIME=PASS\n'
printf 'WEB_SMTP_AUTHORITY=ABSENT\n'
printf 'API_SMTP_AUTHORITY=ABSENT\n'
printf 'WORKER_METRICS=%s\n' "$worker_metrics"
