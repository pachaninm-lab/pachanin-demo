#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"
TARGET_SHA="${2:-}"
RUN_ID="${3:-manual}"
INTAKE_REQUEST_NUMBER="${4:-}"
INTAKE_CORRELATION_ID="${5:-}"
API_IMAGE="${PC_API_IMAGE:-}"
WEB_IMAGE="${PC_WEB_IMAGE:-}"
MIGRATION_IMAGE="${PC_MIGRATION_IMAGE:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
PROD_COMPOSE_B64="${PC_PROD_COMPOSE_B64:-}"
PROD_PROJECT_B64="${PC_PROD_PROJECT_B64:-}"
BACKUP_EVIDENCE_B64="${PC_PROD_BACKUP_EVIDENCE_FILE_B64:-${PC_BACKUP_EVIDENCE_FILE_B64:-}}"
STATE_ROOT="/var/lib/pc-release-authority"
STATE_FILE="$STATE_ROOT/full-stack-${RUN_ID}.state"

fail() { printf 'ERROR_CODE=%s\n' "$1" >&2; exit "${2:-1}"; }
decode() { [[ -z "$1" ]] || printf '%s' "$1" | base64 -d; }
trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }

[[ "$ACTION" =~ ^(audit|deploy|rollback|verify-intake)$ ]] || fail INVALID_ACTION 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
[[ "$RUN_ID" =~ ^[A-Za-z0-9._:-]{1,128}$ ]] || fail INVALID_RUN_ID 4

prod_dir="$(decode "$PROD_DIR_B64")"
prod_compose="$(decode "$PROD_COMPOSE_B64")"
prod_project="$(decode "$PROD_PROJECT_B64")"
backup_evidence="$(decode "$BACKUP_EVIDENCE_B64")"
auth_opaque_token_env_file=""
staff_database_env_file=""
password_reset_delivery_env_file=""
transactional_mail_env_file=""
auth_mail_authority_dir="/var/lib/pc-secret-authority"
auth_mail_runtime_dir="$auth_mail_authority_dir/runtime"
auth_mail_transport_authority="$auth_mail_authority_dir/auth-mail-transport.env"
auth_mail_provision_script="${PC_AUTH_MAIL_PROVISION_SCRIPT:-/tmp/pc-auth-mail-provision-${RUN_ID}.sh}"
auth_mail_worker_service="auth-mail-worker"

resolve_compose_authority() {
  if [[ -n "$prod_dir" && -n "$prod_compose" ]]; then return; fi
  mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  (( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 10
  local web_id="${web_ids[0]}"
  prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
  prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
  prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
  [[ -n "$prod_dir" && -n "$prod_compose" && -n "$prod_project" ]] || fail COMPOSE_LABEL_AUTHORITY_MISSING 11
}

resolve_compose_authority
[[ -d "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 12

resolve_auth_opaque_token_env_file() {
  auth_opaque_token_env_file="${PC_AUTH_OPAQUE_TOKEN_ENV_FILE:-$prod_dir/.pc-auth-opaque-token.env}"
  [[ "$auth_opaque_token_env_file" == "$prod_dir"/* ]] || fail AUTH_OPAQUE_TOKEN_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 17
  [[ -f "$auth_opaque_token_env_file" && ! -L "$auth_opaque_token_env_file" ]] || fail AUTH_OPAQUE_TOKEN_ENV_FILE_MISSING 18
  [[ "$(stat -c '%a:%u:%g' "$auth_opaque_token_env_file")" == '600:0:0' ]] || fail AUTH_OPAQUE_TOKEN_ENV_FILE_PERMISSIONS_INVALID 19
  [[ "$(wc -l < "$auth_opaque_token_env_file" | tr -d '[:space:]')" == 1 ]] || fail AUTH_OPAQUE_TOKEN_ENV_FILE_CONTENT_INVALID 21
  grep -Eq '^AUTH_OPAQUE_TOKEN_DIGEST_KEY=[A-Fa-f0-9]{64,}$' "$auth_opaque_token_env_file" || fail AUTH_OPAQUE_TOKEN_ENV_FILE_CONTENT_INVALID 22
}

resolve_auth_opaque_token_env_file

resolve_staff_database_env_file() {
  staff_database_env_file="${PC_STAFF_DATABASE_ENV_FILE:-$prod_dir/.pc-staff-database.env}"
  [[ "$staff_database_env_file" == "$prod_dir"/* ]] || fail STAFF_DATABASE_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 52
  [[ -f "$staff_database_env_file" && ! -L "$staff_database_env_file" ]] || fail STAFF_DATABASE_ENV_FILE_MISSING 53
  [[ "$(stat -c '%a:%u:%g' "$staff_database_env_file")" == '600:0:0' ]] || fail STAFF_DATABASE_ENV_FILE_PERMISSIONS_INVALID 54
  [[ "$(wc -l < "$staff_database_env_file" | tr -d '[:space:]')" == 1 ]] || fail STAFF_DATABASE_ENV_FILE_CONTENT_INVALID 55
  python3 - "$staff_database_env_file" <<'PY' || fail STAFF_DATABASE_ENV_FILE_CONTENT_INVALID 56
import sys
from urllib.parse import urlsplit

line = open(sys.argv[1], encoding='utf-8').read().rstrip('\n')
if not line.startswith('STAFF_DATABASE_URL='):
    raise SystemExit(1)
url = urlsplit(line.split('=', 1)[1])
if url.scheme not in ('postgresql', 'postgres') or url.username != 'pc_staff_runtime' or not url.password or not url.hostname or not url.path.strip('/'):
    raise SystemExit(1)
PY
}

resolve_staff_database_env_file

resolve_password_reset_runtime_env_files() {
  password_reset_delivery_env_file="${PC_PASSWORD_RESET_DELIVERY_ENV_FILE:-$prod_dir/.pc-password-reset-delivery.env}"
  transactional_mail_env_file="${PC_TRANSACTIONAL_MAIL_ENV_FILE:-$prod_dir/.pc-transactional-mail.env}"
  [[ "$password_reset_delivery_env_file" == "$prod_dir"/* ]] || fail PASSWORD_RESET_DELIVERY_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 59
  [[ "$transactional_mail_env_file" == "$prod_dir"/* ]] || fail TRANSACTIONAL_MAIL_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 60
  [[ -f "$password_reset_delivery_env_file" && ! -L "$password_reset_delivery_env_file" ]] || fail PASSWORD_RESET_DELIVERY_ENV_FILE_MISSING 61
  [[ -f "$transactional_mail_env_file" && ! -L "$transactional_mail_env_file" ]] || fail TRANSACTIONAL_MAIL_ENV_FILE_MISSING 62
  [[ "$(stat -c '%a:%u:%g' "$password_reset_delivery_env_file")" == '600:0:0' ]] || fail PASSWORD_RESET_DELIVERY_ENV_FILE_PERMISSIONS_INVALID 63
  [[ "$(stat -c '%a:%u:%g' "$transactional_mail_env_file")" == '600:0:0' ]] || fail TRANSACTIONAL_MAIL_ENV_FILE_PERMISSIONS_INVALID 64
  python3 - "$password_reset_delivery_env_file" <<'PY' || fail PASSWORD_RESET_DELIVERY_ENV_FILE_CONTENT_INVALID 65
import re
import sys

raw = open(sys.argv[1], encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    raise SystemExit(1)
lines = raw.rstrip('\n').split('\n')
if len(lines) != 2:
    raise SystemExit(1)
values = {}
for line in lines:
    name, separator, value = line.partition('=')
    if not separator or name in values or not re.fullmatch(r'[A-Fa-f0-9]{96}', value):
        raise SystemExit(1)
    values[name] = value
if set(values) != {'PASSWORD_RESET_DELIVERY_KEY', 'REGISTRATION_DELIVERY_KEY'}:
    raise SystemExit(1)
if values['PASSWORD_RESET_DELIVERY_KEY'] == values['REGISTRATION_DELIVERY_KEY']:
    raise SystemExit(1)
PY
  python3 - "$transactional_mail_env_file" <<'PY' || fail TRANSACTIONAL_MAIL_ENV_FILE_CONTENT_INVALID 66
import re
import sys

raw = open(sys.argv[1], encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    raise SystemExit(1)
lines = raw.rstrip('\n').split('\n')
if not 2 <= len(lines) <= 5:
    raise SystemExit(1)
values = {}
for line in lines:
    name, separator, value = line.partition('=')
    if not separator or name in values or not value or value != value.strip():
        raise SystemExit(1)
    if not re.fullmatch(r'[A-Z][A-Z0-9_]*', name):
        raise SystemExit(1)
    if any(ord(char) < 33 or ord(char) > 126 for char in value) or any(char in value for char in "#'\"\\"):
        raise SystemExit(1)
    values[name] = value
email = re.compile(r'^[^@\s]{1,64}@[^@\s]{1,189}$')
if set(values) == {'RESEND_API_KEY', 'RESEND_FROM_EMAIL'}:
    if len(values['RESEND_API_KEY']) < 20 or len(values['RESEND_API_KEY']) > 512 or not email.fullmatch(values['RESEND_FROM_EMAIL']):
        raise SystemExit(1)
    raise SystemExit(0)
required = {'PC_SMTP_HOST', 'PC_SMTP_USER', 'PC_SMTP_PASS'}
allowed = required | {'PC_SMTP_PORT', 'PC_MAIL_FROM'}
if not required.issubset(values) or not set(values).issubset(allowed):
    raise SystemExit(1)
if not re.fullmatch(r'[A-Za-z0-9.-]{1,253}', values['PC_SMTP_HOST']):
    raise SystemExit(1)
if len(values['PC_SMTP_USER']) > 254 or len(values['PC_SMTP_PASS']) > 512:
    raise SystemExit(1)
port = values.get('PC_SMTP_PORT', '465')
sender = values.get('PC_MAIL_FROM', values['PC_SMTP_USER'])
if not port.isdigit() or not 1 <= int(port) <= 65535 or not email.fullmatch(sender):
    raise SystemExit(1)
PY
}

ensure_canonical_auth_mail_transport() {
  install -d -m 0700 -o 0 -g 0 "$auth_mail_authority_dir"
  if [[ ! -e "$auth_mail_transport_authority" ]]; then
    [[ -n "$transactional_mail_env_file" && -f "$transactional_mail_env_file" && ! -L "$transactional_mail_env_file" ]] \
      || fail AUTH_MAIL_TRANSPORT_AUTHORITY_MISSING 68
    tmp_transport="$(mktemp "$auth_mail_authority_dir/.auth-mail-transport-migrate.XXXXXX")"
    python3 - "$transactional_mail_env_file" <<'PY' > "$tmp_transport" || { rm -f "$tmp_transport"; fail AUTH_MAIL_LEGACY_SMTP_NOT_CANONICAL 69; }
import sys
values = {}
for raw in open(sys.argv[1], encoding='utf-8'):
    name, sep, value = raw.rstrip('\n').partition('=')
    if sep:
        values[name] = value
required = {'PC_SMTP_HOST', 'PC_SMTP_USER', 'PC_SMTP_PASS'}
allowed = required | {'PC_SMTP_PORT', 'PC_MAIL_FROM'}
if not required.issubset(values) or not set(values).issubset(allowed):
    raise SystemExit(1)
host = values['PC_SMTP_HOST'].strip().lower()
port = values.get('PC_SMTP_PORT', '465').strip()
user = values['PC_SMTP_USER'].strip()
sender = values.get('PC_MAIL_FROM', user).strip()
password = values['PC_SMTP_PASS']
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
    chmod 0600 "$tmp_transport"; chown 0:0 "$tmp_transport"
    mv -f "$tmp_transport" "$auth_mail_transport_authority"
  fi
  [[ -f "$auth_mail_transport_authority" && ! -L "$auth_mail_transport_authority" ]] \
    || fail AUTH_MAIL_TRANSPORT_AUTHORITY_INVALID 70
  [[ "$(stat -c '%a:%u:%g' "$auth_mail_transport_authority")" == '600:0:0' ]] \
    || fail AUTH_MAIL_TRANSPORT_AUTHORITY_PERMISSIONS 71
  python3 - "$auth_mail_transport_authority" <<'PY' || fail AUTH_MAIL_TRANSPORT_AUTHORITY_CONTENT 72
import sys
values = {}
for raw in open(sys.argv[1], encoding='utf-8'):
    name, sep, value = raw.rstrip('\n').partition('=')
    if sep:
        values[name] = value
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

auth_mail_projection_ready() {
  [[ -d "$auth_mail_runtime_dir" && ! -L "$auth_mail_runtime_dir" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$auth_mail_runtime_dir")" == '700:0:0' ]] || return 1
  [[ -d "$auth_mail_runtime_dir/keyring" && ! -L "$auth_mail_runtime_dir/keyring" ]] || return 1
  [[ -f "$auth_mail_runtime_dir/current-key-version" && -f "$auth_mail_runtime_dir/database-url" && -f "$auth_mail_runtime_dir/transport.env" ]] || return 1
  [[ -n "$(find "$auth_mail_runtime_dir/keyring" -maxdepth 1 -type f -name 'v*.key' -print -quit)" ]] || return 1
}


IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
full_override="$prod_dir/compose.production-full-stack-image.override.yml"
for raw in "${raw_files[@]}"; do
  file="$(trim "$raw")"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" ]] || fail PROTECTED_COMPOSE_FILE_MISSING 13
  [[ "$file" == "$full_override" ]] || compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || fail COMPOSE_AUTHORITY_EMPTY 14

dc=(docker compose --project-directory "$prod_dir")
[[ -z "$prod_project" ]] || dc+=(--project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done

compose_json="$(mktemp)"
"${dc[@]}" config --format json > "$compose_json"
service_inventory="$(python3 - "$compose_json" <<'PY'
import json, re, sys
cfg = json.load(open(sys.argv[1], encoding='utf-8'))
services = cfg.get('services') or {}
for required in ('api', 'web'):
    if required not in services:
        raise SystemExit(f'MISSING:{required}')
candidates = []
postgres = []
for name, service in services.items():
    image = str(service.get('image') or '')
    command = service.get('command')
    command = ' '.join(command) if isinstance(command, list) else str(command or '')
    if re.search(r'(^|[-_])(migrate|migration)([-_]|$)', name, re.I) or 'grainflow-migration' in image or ('prisma' in command and 'migrate' in command):
        candidates.append(name)
    if image.startswith('postgres:') or '/postgres:' in image:
        postgres.append(name)
if len(candidates) != 1:
    raise SystemExit(f'MIGRATION_COUNT:{len(candidates)}')
print(candidates[0])
print(postgres[0] if len(postgres) == 1 else '')
PY
)" || fail COMPOSE_SERVICE_DISCOVERY_FAILED 15
migration_service="$(printf '%s\n' "$service_inventory" | sed -n '1p')"
postgres_service="$(printf '%s\n' "$service_inventory" | sed -n '2p')"
rm -f "$compose_json"

compose_id() { "${dc[@]}" ps -q "$1" | head -1; }
api_id="$(compose_id api)"
web_id="$(compose_id web)"
[[ -n "$api_id" && -n "$web_id" ]] || fail TARGET_RUNTIME_MISSING 16
baseline_api_image="$(docker inspect --format '{{.Config.Image}}' "$api_id")"
baseline_web_image="$(docker inspect --format '{{.Config.Image}}' "$web_id")"
baseline_api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
baseline_web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
mapfile -t baseline_worker_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$prod_project" \
  --filter "label=com.docker.compose.service=$auth_mail_worker_service")
(( ${#baseline_worker_ids[@]} <= 1 )) || fail AUTH_MAIL_WORKER_AUTHORITY_AMBIGUOUS 73
baseline_worker_present=0
baseline_worker_image=''
baseline_worker_revision=''
if (( ${#baseline_worker_ids[@]} == 1 )); then
  baseline_worker_present=1
  baseline_worker_id="${baseline_worker_ids[0]}"
  baseline_worker_image="$(docker inspect --format '{{.Config.Image}}' "$baseline_worker_id")"
  baseline_worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$baseline_worker_id")"
  is_revision "$baseline_worker_revision" || fail AUTH_MAIL_WORKER_BASELINE_REVISION_INVALID 74
fi

snapshot_unrelated() {
  local output="$1"
  docker ps --format '{{.ID}} {{.Labels}}' | awk '
    $0 !~ /com.docker.compose.service=api(,|$)/ &&
    $0 !~ /com.docker.compose.service=web(,|$)/ &&
    $0 !~ /com.docker.compose.service=auth-mail-worker(,|$)/ &&
    $0 !~ /com.docker.compose.service=watchtower(,|$)/ {print $1}' | sort > "$output"
}

write_override() {
  local mode="$1" api_image="$2" web_image="$3" migration_image="$4" worker_image="$5" destination="$6"
  [[ "$mode" =~ ^(migration|legacy|auth-mail)$ ]] || fail AUTH_MAIL_OVERRIDE_MODE_INVALID 75
  umask 077
  case "$mode" in
    migration)
      cat > "$destination.tmp" <<YAML
services:
  ${migration_service}:
    image: ${migration_image}
    pull_policy: never
YAML
      ;;
    legacy)
      [[ -n "$password_reset_delivery_env_file" && -n "$transactional_mail_env_file" ]] || fail LEGACY_MAIL_ROLLBACK_AUTHORITY_MISSING 76
      cat > "$destination.tmp" <<YAML
services:
  api:
    image: ${api_image}
    pull_policy: never
    env_file:
      - ${auth_opaque_token_env_file}
      - ${staff_database_env_file}
      - ${password_reset_delivery_env_file}
  web:
    image: ${web_image}
    pull_policy: never
    env_file:
      - ${password_reset_delivery_env_file}
      - ${transactional_mail_env_file}
  ${migration_service}:
    image: ${migration_image}
    pull_policy: never
YAML
      ;;
    auth-mail)
      auth_mail_projection_ready || fail AUTH_MAIL_RUNTIME_PROJECTION_MISSING 77
      [[ -n "$worker_image" ]] || fail AUTH_MAIL_WORKER_IMAGE_MISSING 78
      cat > "$destination.tmp" <<YAML
services:
  api:
    image: ${api_image}
    pull_policy: never
    env_file:
      - ${auth_opaque_token_env_file}
      - ${staff_database_env_file}
    environment:
      AUTH_MAIL_OUTBOX_KEYRING_DIR: /run/pc-auth-mail/keyring
      AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE: /run/pc-auth-mail/current-key-version
      PC_PUBLIC_SITE_URL: https://xn----8sbjf4befbjgs9b.xn--p1ai
    volumes:
      - ${auth_mail_runtime_dir}/keyring:/run/pc-auth-mail/keyring:ro
      - ${auth_mail_runtime_dir}/current-key-version:/run/pc-auth-mail/current-key-version:ro
  web:
    image: ${web_image}
    pull_policy: never
  ${auth_mail_worker_service}:
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
      - ${auth_mail_runtime_dir}/keyring:/run/pc-auth-mail/keyring:ro
      - ${auth_mail_runtime_dir}/current-key-version:/run/pc-auth-mail/current-key-version:ro
      - ${auth_mail_runtime_dir}/database-url:/run/pc-auth-mail/database-url:ro
      - ${auth_mail_runtime_dir}/transport.env:/run/pc-auth-mail/transport.env:ro
    healthcheck:
      test: ["CMD", "/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 10s
  ${migration_service}:
    image: ${migration_image}
    pull_policy: never
YAML
      ;;
  esac
  mv "$destination.tmp" "$destination"
  chmod 0600 "$destination"
}

verify_auth_mail_compose_contract() {
  local cfg
  cfg="$(mktemp)"
  "${dc_target[@]}" config --format json > "$cfg"
  python3 - "$cfg" "$API_IMAGE" <<'PY' || { rm -f "$cfg"; fail AUTH_MAIL_COMPOSE_CONTRACT_FAILED 79; }
import json, sys
cfg = json.load(open(sys.argv[1], encoding='utf-8'))
expected_image = sys.argv[2]
services = cfg.get('services') or {}
for name in ('api', 'web', 'auth-mail-worker'):
    if name not in services:
        raise SystemExit(f'missing service {name}')

def env(service):
    raw = service.get('environment') or {}
    if isinstance(raw, list):
        return {str(item).partition('=')[0]: str(item).partition('=')[2] for item in raw}
    return {str(k): '' if v is None else str(v) for k, v in raw.items()}

web_env = env(services['web'])
forbidden_web = {
    'PC_SMTP_HOST','PC_SMTP_PORT','PC_SMTP_USER','PC_SMTP_PASS','PC_MAIL_FROM',
    'RESEND_API_KEY','RESEND_FROM_EMAIL','PASSWORD_RESET_DELIVERY_KEY','REGISTRATION_DELIVERY_KEY',
    'AUTH_MAIL_OUTBOX_KEYRING_DIR','AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE',
    'AUTH_MAIL_DATABASE_URL_FILE','AUTH_MAIL_TRANSPORT_FILE',
}
if forbidden_web.intersection(web_env):
    raise SystemExit('web receives mail authority')

api_env = env(services['api'])
if api_env.get('AUTH_MAIL_OUTBOX_KEYRING_DIR') != '/run/pc-auth-mail/keyring':
    raise SystemExit('api keyring directory missing')
if api_env.get('AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE') != '/run/pc-auth-mail/current-key-version':
    raise SystemExit('api key version file missing')
for key in ('PC_SMTP_PASS','RESEND_API_KEY','PASSWORD_RESET_DELIVERY_KEY','REGISTRATION_DELIVERY_KEY','AUTH_MAIL_DATABASE_URL_FILE','AUTH_MAIL_TRANSPORT_FILE'):
    if key in api_env:
        raise SystemExit(f'api forbidden mail authority: {key}')

worker = services['auth-mail-worker']
if str(worker.get('image') or '') != expected_image:
    raise SystemExit('worker image is not exact API image')
command = worker.get('command') or []
command_text = ' '.join(command) if isinstance(command, list) else str(command)
if 'dist/apps/api/src/auth-mail-worker.js' not in command_text:
    raise SystemExit('worker command missing')
worker_env = env(worker)
expected = {
    'RUNTIME_COMPONENT': 'auth-mail-worker',
    'AUTH_MAIL_WORKER_ENABLED': 'true',
    'AUTH_MAIL_OUTBOX_KEYRING_DIR': '/run/pc-auth-mail/keyring',
    'AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE': '/run/pc-auth-mail/current-key-version',
    'AUTH_MAIL_DATABASE_URL_FILE': '/run/pc-auth-mail/database-url',
    'AUTH_MAIL_TRANSPORT_FILE': '/run/pc-auth-mail/transport.env',
}
for key, value in expected.items():
    if worker_env.get(key) != value:
        raise SystemExit(f'worker environment mismatch: {key}')
if not worker.get('healthcheck'):
    raise SystemExit('worker healthcheck missing')
PY
  rm -f "$cfg"
}

dc_target=("${dc[@]}" -f "$full_override")

verify_image() {
  local image="$1"
  docker pull "$image" >/dev/null
  [[ "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")" == "$TARGET_SHA" ]] || fail IMAGE_REVISION_MISMATCH 20
}

wait_api() {
  local id attempt
  for attempt in $(seq 1 30); do
    id="$("${dc_target[@]}" ps -q api | head -1)"
    if [[ -n "$id" ]] && docker exec "$id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then return 0; fi
    sleep 4
  done
  return 1
}


wait_worker() {
  local id state attempt
  for attempt in $(seq 1 30); do
    id="$("${dc_target[@]}" ps -q "$auth_mail_worker_service" | head -1)"
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
    if [[ "$state" == healthy ]] && docker exec "$id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then return 0; fi
    sleep 4
  done
  return 1
}

redact_api_startup_log() {
  sed -E \
    -e 's#([A-Za-z][A-Za-z0-9+.-]*://)[^[:space:]@/]+@#\1[REDACTED]@#g' \
    -e 's#(password|token|secret|authorization|api[_-]?key)([[:space:]]*[:=][[:space:]]*)[^[:space:],;}]+#\1\2[REDACTED]#gI'
}

emit_api_startup_diagnostics() {
  local id state restart_count exit_code oom_killed
  id="$("${dc_target[@]}" ps -q api | head -1)"
  printf 'API_STARTUP_DIAGNOSTICS_BEGIN\n' >&2
  if [[ -z "$id" ]]; then
    printf 'API_STARTUP_CONTAINER=missing\n' >&2
    printf 'API_STARTUP_DIAGNOSTICS_END\n' >&2
    return 0
  fi

  state="$(docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || true)"
  restart_count="$(docker inspect --format '{{.RestartCount}}' "$id" 2>/dev/null || true)"
  exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$id" 2>/dev/null || true)"
  oom_killed="$(docker inspect --format '{{.State.OOMKilled}}' "$id" 2>/dev/null || true)"
  printf 'API_STARTUP_CONTAINER_STATE=%s\n' "${state:-unknown}" >&2
  printf 'API_STARTUP_RESTART_COUNT=%s\n' "${restart_count:-unknown}" >&2
  printf 'API_STARTUP_EXIT_CODE=%s\n' "${exit_code:-unknown}" >&2
  printf 'API_STARTUP_OOM_KILLED=%s\n' "${oom_killed:-unknown}" >&2
  printf 'API_STARTUP_LOG_TAIL_BEGIN\n' >&2
  docker logs --tail 80 "$id" 2>&1 | redact_api_startup_log >&2 || true
  printf 'API_STARTUP_LOG_TAIL_END\n' >&2
  printf 'API_STARTUP_DIAGNOSTICS_END\n' >&2
}

wait_web() {
  local id state attempt
  for attempt in $(seq 1 30); do
    id="$("${dc_target[@]}" ps -q web | head -1)"
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
    [[ "$state" == healthy ]] && return 0
    sleep 4
  done
  return 1
}

is_revision() {
  local revision="$1"
  [[ "${#revision}" == 40 && "$revision" != *[!0123456789abcdef]* ]]
}

# One container's build revision, or a non-zero status if it cannot be read.
container_revision() {
  docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$1"
}

rollback_images() {
  local restored_api_id restored_web_id restored_worker_id='' rollback_worker_ids=()
  [[ -f "$STATE_FILE" ]] || return 1
  # shellcheck disable=SC1090
  source "$STATE_FILE"
  is_revision "$BASELINE_API_REVISION" || return 1
  is_revision "$BASELINE_WEB_REVISION" || return 1

  if [[ "$BASELINE_WORKER_PRESENT" == 1 ]]; then
    is_revision "$BASELINE_WORKER_REVISION" || return 1
    auth_mail_projection_ready || return 1
    write_override auth-mail "$BASELINE_API_IMAGE" "$BASELINE_WEB_IMAGE" "$MIGRATION_IMAGE" "$BASELINE_WORKER_IMAGE" "$full_override"
    "${dc_target[@]}" config --quiet
    "${dc_target[@]}" up -d --no-deps --pull never api "$auth_mail_worker_service" web
    wait_api && wait_worker && wait_web || return 1
  else
    resolve_password_reset_runtime_env_files || return 1
    write_override legacy "$BASELINE_API_IMAGE" "$BASELINE_WEB_IMAGE" "$MIGRATION_IMAGE" '' "$full_override"
    "${dc_target[@]}" config --quiet
    mapfile -t rollback_worker_ids < <(docker ps -aq \
      --filter "label=com.docker.compose.project=$prod_project" \
      --filter "label=com.docker.compose.service=$auth_mail_worker_service")
    for worker_id in "${rollback_worker_ids[@]:-}"; do
      [[ -n "$worker_id" ]] && docker rm -f "$worker_id" >/dev/null || true
    done
    "${dc_target[@]}" up -d --no-deps --pull never api web
    wait_api && wait_web || return 1
  fi

  restored_api_id="$("${dc_target[@]}" ps -q api | head -1)"
  restored_web_id="$("${dc_target[@]}" ps -q web | head -1)"
  [[ -n "$restored_api_id" && -n "$restored_web_id" ]] || return 1
  restored_api_revision="$(container_revision "$restored_api_id")" || return 2
  restored_web_revision="$(container_revision "$restored_web_id")" || return 2
  is_revision "$restored_api_revision" || return 2
  is_revision "$restored_web_revision" || return 2
  [[ "$restored_api_revision" == "$BASELINE_API_REVISION" ]] || return 3
  [[ "$restored_web_revision" == "$BASELINE_WEB_REVISION" ]] || return 3

  restored_worker_revision=''
  if [[ "$BASELINE_WORKER_PRESENT" == 1 ]]; then
    restored_worker_id="$("${dc_target[@]}" ps -q "$auth_mail_worker_service" | head -1)"
    [[ -n "$restored_worker_id" ]] || return 1
    restored_worker_revision="$(container_revision "$restored_worker_id")" || return 2
    is_revision "$restored_worker_revision" || return 2
    [[ "$restored_worker_revision" == "$BASELINE_WORKER_REVISION" ]] || return 3
  fi
}

verify_durable_intake_local_postgres() {
  local pg_id sql result audit_id outbox_id
  pg_id="$(compose_id "$postgres_service")"
  [[ -n "$pg_id" ]] || fail POSTGRES_RUNTIME_MISSING 43
  sql="SELECT CASE WHEN count(*) = 1 AND bool_and(a.action = 'public:organization-intake:create' AND a.outcome = 'SUCCESS' AND a.\"correlationId\" = r.\"correlationId\") AND bool_and(o.type = 'PUBLIC_ORGANIZATION_CONNECTION_REQUESTED' AND o.\"correlationId\" = r.\"correlationId\" AND o.\"auditId\" = r.\"auditEventId\" AND NOT (o.payload ?| ARRAY['organizationName','inn','contactName','position','phone','email','payloadHash'])) THEN 'PASS' ELSE 'FAIL' END || '|' || min(r.\"auditEventId\") || '|' || min(r.\"outboxEntryId\") FROM public.public_organization_connection_requests r JOIN public.audit_events a ON a.id = r.\"auditEventId\" JOIN public.outbox_entries o ON o.id = r.\"outboxEntryId\" WHERE r.\"requestNumber\" = '$INTAKE_REQUEST_NUMBER' AND r.\"correlationId\" = '$INTAKE_CORRELATION_ID';"
  result="$(docker exec "$pg_id" sh -ceu 'test -n "${POSTGRES_USER:-}"; test -n "${POSTGRES_DB:-}"; psql -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --tuples-only --no-align --command "$1"' sh "$sql" | tr -d '[:space:]')"
  [[ "$result" =~ ^PASS\|audit-[A-Za-z0-9-]+\|outbox-[A-Za-z0-9-]+$ ]] || fail DURABLE_INTAKE_EVIDENCE_FAILED 44
  IFS='|' read -r _ audit_id outbox_id <<< "$result"
  printf 'DURABLE_INTAKE_EVIDENCE_MODE=COMPOSE_POSTGRES_DIRECT_JOIN\n'
  printf 'DURABLE_INTAKE_AUDIT_ID=%s\n' "$audit_id"
  printf 'DURABLE_INTAKE_OUTBOX_ID=%s\n' "$outbox_id"
}

verify_durable_intake_external_postgres() {
  local exact_api_id exact_api_revision result release_prefix release_run_id
  exact_api_id="$(compose_id api)"
  [[ -n "$exact_api_id" ]] || fail API_RUNTIME_MISSING_FOR_DB_EVIDENCE 45
  exact_api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$exact_api_id")"
  [[ "$exact_api_revision" == "$TARGET_SHA" ]] || fail API_DB_EVIDENCE_REVISION_MISMATCH 46

  release_prefix="release-intake:${TARGET_SHA}:"
  [[ "$INTAKE_CORRELATION_ID" == "$release_prefix"* ]] || fail EXTERNAL_POSTGRES_RELEASE_RUN_ID_UNAVAILABLE 47
  release_run_id="${INTAKE_CORRELATION_ID#"$release_prefix"}"
  [[ "$release_run_id" =~ ^[A-Za-z0-9._:-]{1,64}$ ]] || fail EXTERNAL_POSTGRES_RELEASE_RUN_ID_INVALID 48

  result="$(docker exec -i "$exact_api_id" /nodejs/bin/node - "$TARGET_SHA" "$release_run_id" "$INTAKE_REQUEST_NUMBER" "$INTAKE_CORRELATION_ID" <<'NODE'
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const [targetSha, runId, requestNumber, correlationId] = process.argv.slice(2);
const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

if (!/^[0-9a-f]{40}$/.test(targetSha ?? '')
  || !/^[A-Za-z0-9._:-]{1,128}$/.test(runId ?? '')
  || !/^PC-[0-9]{8}-[0-9A-F]{12}$/.test(requestNumber ?? '')
  || !/^[A-Za-z0-9._:-]{8,128}$/.test(correlationId ?? '')) {
  fail('EXTERNAL_POSTGRES_EVIDENCE_INPUT_INVALID');
  process.exit(1);
}

const sha7 = targetSha.slice(0, 7);
const idempotencyKey = `release-intake:${targetSha}:${runId}`;
const request = {
  organizationName: `ООО Системная проверка Прозрачная Цена ${sha7} ${runId}`,
  inn: '7707083893',
  contactName: 'Системный оператор',
  position: 'Release acceptance',
  phone: '+74950000000',
  email: `release-${sha7}-${runId}@procent-agro.test`.toLowerCase(),
  organizationRole: 'PUBLIC_INDUSTRY_PARTNER',
  scenario: 'EXTERNAL_INTEGRATION',
  locale: 'ru',
  consentVersion: 'public-organization-connect-v1',
};
const payloadHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT request_number, request_status, replay, correlation_id FROM public.lookup_public_organization_connection_request($1, $2)',
    idempotencyKey,
    payloadHash,
  );
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('EXTERNAL_POSTGRES_REQUEST_LOOKUP_FAILED');
  const row = rows[0];
  if (row.request_number !== requestNumber
    || row.request_status !== 'NEW'
    || row.replay !== true
    || row.correlation_id !== correlationId) {
    throw new Error('EXTERNAL_POSTGRES_REQUEST_EVIDENCE_MISMATCH');
  }

  const constraints = await prisma.$queryRawUnsafe(`
    SELECT
      count(*)::int AS constraint_count,
      bool_and(contype = 'f' AND convalidated AND confdeltype = 'r') AS constraints_valid,
      bool_and(
        (conname = 'public_org_connection_requests_audit_fkey' AND confrelid = 'public.audit_events'::regclass)
        OR
        (conname = 'public_org_connection_requests_outbox_fkey' AND confrelid = 'public.outbox_entries'::regclass)
      ) AS targets_valid
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.public_organization_connection_requests'::regclass
      AND conname IN (
        'public_org_connection_requests_audit_fkey',
        'public_org_connection_requests_outbox_fkey'
      )
  `);
  const constraint = constraints[0];
  if (constraint?.constraint_count !== 2
    || constraint?.constraints_valid !== true
    || constraint?.targets_valid !== true) {
    throw new Error('EXTERNAL_POSTGRES_FK_EVIDENCE_INVALID');
  }

  const attributes = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int AS not_null_count
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.public_organization_connection_requests'::regclass
      AND attname IN ('auditEventId', 'outboxEntryId')
      AND attnotnull
      AND NOT attisdropped
  `);
  if (attributes[0]?.not_null_count !== 2) throw new Error('EXTERNAL_POSTGRES_FK_COLUMNS_NULLABLE');

  process.stdout.write('PASS|REFERENTIAL_INTEGRITY|REFERENTIAL_INTEGRITY\n');
})()
  .catch((error) => {
    process.stderr.write(`${String(error?.message ?? error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
NODE
)" || fail EXTERNAL_POSTGRES_DURABLE_INTAKE_EVIDENCE_FAILED 49

  [[ "$result" == 'PASS|REFERENTIAL_INTEGRITY|REFERENTIAL_INTEGRITY' ]] || fail EXTERNAL_POSTGRES_DURABLE_INTAKE_EVIDENCE_INVALID 51
  printf 'DURABLE_INTAKE_EVIDENCE_MODE=EXTERNAL_POSTGRES_API_SECURITY_DEFINER\n'
  printf 'DURABLE_INTAKE_AUDIT_ID=REFERENTIAL_INTEGRITY_CONFIRMED\n'
  printf 'DURABLE_INTAKE_OUTBOX_ID=REFERENTIAL_INTEGRITY_CONFIRMED\n'
}

verify_durable_intake() {
  [[ "$INTAKE_REQUEST_NUMBER" =~ ^PC-[0-9]{8}-[0-9A-F]{12}$ ]] || fail INTAKE_REQUEST_NUMBER_INVALID 40
  [[ "$INTAKE_CORRELATION_ID" =~ ^[A-Za-z0-9._:-]{8,128}$ ]] || fail INTAKE_CORRELATION_ID_INVALID 41

  if [[ -n "$postgres_service" ]]; then
    verify_durable_intake_local_postgres
  else
    verify_durable_intake_external_postgres
  fi

  printf 'DURABLE_INTAKE_DB=PASS\n'
}

if [[ "$ACTION" == verify-intake ]]; then
  verify_durable_intake
  exit 0
fi

if [[ "$ACTION" == rollback ]]; then
  # Distinguished on purpose. A rollback that restored the wrong revision and a
  # rollback whose verification could not run are different incidents with
  # different responses, and reporting both as AUTOMATIC_ROLLBACK_FAILED cost an
  # investigation round. None of these is a success and none may be treated as
  # one — the run still fails, it just says which check failed.
  rollback_rc=0
  rollback_images || rollback_rc=$?
  case "$rollback_rc" in
    0) : ;;
    2) fail ROLLBACK_REVISION_UNREADABLE 57 ;;
    3) fail ROLLBACK_REVISION_MISMATCH 58 ;;
    *) fail AUTOMATIC_ROLLBACK_FAILED 50 ;;
  esac
  printf 'ROLLBACK_COMPLETE=1\n'
  printf 'RESTORED_API_REVISION=%s\n' "$restored_api_revision"
  printf 'RESTORED_WEB_REVISION=%s\n' "$restored_web_revision"
  printf 'RESTORED_AUTH_MAIL_WORKER_REVISION=%s\n' "${restored_worker_revision:-none}"
  printf 'ROLLBACK_CONTAINER_REVISIONS_VERIFIED=1\n'
  exit 0
fi

printf 'COMPOSE_AUTHORITY_RESOLVED=1\n'
printf 'MIGRATION_SERVICE_RESOLVED=1\n'
printf 'BASELINE_API_REVISION=%s\n' "$baseline_api_revision"
printf 'BASELINE_WEB_REVISION=%s\n' "$baseline_web_revision"
printf 'BASELINE_AUTH_MAIL_WORKER_PRESENT=%s\n' "$baseline_worker_present"
printf 'BASELINE_AUTH_MAIL_WORKER_REVISION=%s\n' "${baseline_worker_revision:-none}"

if [[ "$ACTION" == audit ]]; then
  printf 'AUDIT_COMPLETE=1\n'
  exit 0
fi

[[ -n "$API_IMAGE" && -n "$WEB_IMAGE" && -n "$MIGRATION_IMAGE" ]] || fail EXACT_IMAGES_REQUIRED 21
verify_image "$API_IMAGE"
verify_image "$WEB_IMAGE"
verify_image "$MIGRATION_IMAGE"
docker run --rm --entrypoint /nodejs/bin/node "$API_IMAGE" -e "require('node:fs').accessSync('/app/dist/apps/api/src/auth-mail-worker.js')" >/dev/null
printf 'AUTH_MAIL_WORKER_ARTIFACT=PASS\n'

# Shared release-authority root: traverse-only for the runner group. `chmod 0700`
# here preserved the group and stripped its `--x`, which is exactly the state the
# host was found in — and it lands after the controller has set 0710, because this
# release and the preflight both fire on the same image build. The runner then
# cannot reach runner-input and activation dies before the controller is invoked.
install -d -m 0710 -o root -g pcactions "$STATE_ROOT"
umask 077
cat > "$STATE_FILE" <<STATE
BASELINE_API_IMAGE='$baseline_api_image'
BASELINE_WEB_IMAGE='$baseline_web_image'
BASELINE_API_REVISION='$baseline_api_revision'
BASELINE_WEB_REVISION='$baseline_web_revision'
BASELINE_WORKER_PRESENT='$baseline_worker_present'
BASELINE_WORKER_IMAGE='$baseline_worker_image'
BASELINE_WORKER_REVISION='$baseline_worker_revision'
MIGRATION_IMAGE='$MIGRATION_IMAGE'
STATE
chmod 0600 "$STATE_FILE"

before_ids="$(mktemp)"
after_ids="$(mktemp)"
snapshot_unrelated "$before_ids"
mutated=0
on_error() {
  rc=$?
  if (( mutated == 1 )); then rollback_images >/dev/null 2>&1 || true; fi
  printf 'DEPLOYMENT_COMPLETE=0\n' >&2
  printf 'ROLLBACK_ATTEMPTED=%s\n' "$mutated" >&2
  exit "$rc"
}
trap on_error ERR

if [[ -n "$postgres_service" ]]; then
  pg_id="$(compose_id "$postgres_service")"
  [[ -n "$pg_id" ]] || fail POSTGRES_RUNTIME_MISSING 22
  backup_dir="$STATE_ROOT/backups"
  mkdir -p "$backup_dir"
  chmod 0700 "$backup_dir"
  backup_name="predeploy-${TARGET_SHA}-${RUN_ID}.backup"
  docker exec "$pg_id" sh -ceu 'umask 077; : "${POSTGRES_USER:?}"; : "${POSTGRES_DB:?}"; pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" --file="$1" "$POSTGRES_DB"' sh "/tmp/$backup_name"
  docker cp "$pg_id:/tmp/$backup_name" "$backup_dir/$backup_name" >/dev/null
  docker exec "$pg_id" rm -f "/tmp/$backup_name"
  chmod 0600 "$backup_dir/$backup_name"
  [[ -s "$backup_dir/$backup_name" ]] || fail BACKUP_EMPTY 23
  sha256sum "$backup_dir/$backup_name" > "$backup_dir/$backup_name.sha256"
  chmod 0600 "$backup_dir/$backup_name.sha256"
  printf 'BACKUP_MODE=LOGICAL_COMPOSE_POSTGRES\n'
elif [[ -n "$backup_evidence" && -f "$backup_evidence" ]]; then
  [[ "$(stat -c '%a' "$backup_evidence")" =~ ^(400|440|600|640)$ ]] || fail BACKUP_EVIDENCE_PERMISSIONS 24
  grep -Fq 'STATUS=PASS' "$backup_evidence" || fail BACKUP_EVIDENCE_INVALID 25
  printf 'BACKUP_MODE=PROTECTED_EXTERNAL_EVIDENCE\n'
else
  fail BACKUP_AUTHORITY_UNAVAILABLE 26
fi

if [[ "$baseline_worker_present" == 0 ]]; then
  resolve_password_reset_runtime_env_files
fi
ensure_canonical_auth_mail_transport
[[ -f "$auth_mail_provision_script" && ! -L "$auth_mail_provision_script" ]] || fail AUTH_MAIL_PROVISION_ASSET_MISSING 80
chmod 0700 "$auth_mail_provision_script"

write_override migration "$API_IMAGE" "$WEB_IMAGE" "$MIGRATION_IMAGE" '' "$full_override"
"${dc_target[@]}" config --quiet
mutated=1
"${dc_target[@]}" run --rm --no-deps --pull never "$migration_service"
printf 'MIGRATION_COMPLETE=1\n'

"$auth_mail_provision_script" bootstrap | grep -E '^AUTH_MAIL_(PROVISION|SECRET_AUTHORITY|SMTP_AUTHORITY|CURRENT_KEY_VERSION|GITHUB_SECRET_REQUIRED)='
auth_mail_projection_ready || fail AUTH_MAIL_RUNTIME_PROJECTION_MISSING 81
printf 'AUTH_MAIL_RUNTIME_PROVISION=PASS\n'

write_override auth-mail "$API_IMAGE" "$WEB_IMAGE" "$MIGRATION_IMAGE" "$API_IMAGE" "$full_override"
"${dc_target[@]}" config --quiet
verify_auth_mail_compose_contract
printf 'AUTH_MAIL_COMPOSE_CONTRACT=PASS\n'

"${dc_target[@]}" up -d --no-deps --pull never api
if ! wait_api; then
  emit_api_startup_diagnostics
  fail API_READINESS_FAILED 30
fi
"${dc_target[@]}" up -d --no-deps --pull never "$auth_mail_worker_service"
wait_worker || fail AUTH_MAIL_WORKER_READINESS_FAILED 82
"${dc_target[@]}" up -d --no-deps --pull never web
wait_web || fail WEB_HEALTH_FAILED 31

mapfile -t watchtower_ids < <(docker ps -aq --filter 'label=com.docker.compose.service=watchtower')
for id in "${watchtower_ids[@]}"; do
  docker update --restart=no "$id" >/dev/null || true
  docker stop "$id" >/dev/null || true
done

snapshot_unrelated "$after_ids"
cmp -s "$before_ids" "$after_ids" || fail NON_TARGET_CONTAINER_CHANGED 32
rm -f "$before_ids" "$after_ids"

new_api_id="$("${dc_target[@]}" ps -q api | head -1)"
new_web_id="$("${dc_target[@]}" ps -q web | head -1)"
new_worker_id="$("${dc_target[@]}" ps -q "$auth_mail_worker_service" | head -1)"
[[ -n "$new_api_id" && -n "$new_web_id" && -n "$new_worker_id" ]] || fail TARGET_RUNTIME_MISSING 16
new_api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$new_api_id")"
new_web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$new_web_id")"
new_worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$new_worker_id")"
[[ "$new_api_revision" == "$TARGET_SHA" && "$new_web_revision" == "$TARGET_SHA" && "$new_worker_revision" == "$TARGET_SHA" ]] || fail RUNNING_REVISION_MISMATCH 33
trap - ERR
printf 'DEPLOYED_API_REVISION=%s\n' "$new_api_revision"
printf 'DEPLOYED_WEB_REVISION=%s\n' "$new_web_revision"
printf 'DEPLOYED_AUTH_MAIL_WORKER_REVISION=%s\n' "$new_worker_revision"
printf 'AUTH_MAIL_RUNTIME=PASS\n'
printf 'WATCHTOWER_RETIRED=1\n'
printf 'DEPLOYMENT_COMPLETE=1\n'
