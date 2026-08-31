#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-bootstrap}"
[[ "$ACTION" =~ ^(bootstrap|rotate-smtp|rotate-db|rotate-key)$ ]] \
  || { echo 'AUTH_MAIL_PROVISION=FAIL_INVALID_ACTION'; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo 'AUTH_MAIL_PROVISION=FAIL_ROOT_REQUIRED'; exit 3; }
command -v docker >/dev/null 2>&1 || { echo 'AUTH_MAIL_PROVISION=FAIL_DOCKER_REQUIRED'; exit 4; }
command -v python3 >/dev/null 2>&1 || { echo 'AUTH_MAIL_PROVISION=FAIL_PYTHON_REQUIRED'; exit 5; }

AUTHORITY_DIR="/var/lib/pc-secret-authority"
KEYRING_DIR="$AUTHORITY_DIR/auth-mail-keyring"
CURRENT_VERSION_FILE="$AUTHORITY_DIR/auth-mail-current-key-version"
DATABASE_URL_FILE="$AUTHORITY_DIR/auth-mail-database-url"
TRANSPORT_FILE="$AUTHORITY_DIR/auth-mail-transport.env"
RUNTIME_PROJECTION_DIR="$AUTHORITY_DIR/runtime"
SMTP_HOST='mail.hosting.reg.ru'
SMTP_PORT='465'
SMTP_USER='access@xn----8sbjf4befbjgs9b.xn--p1ai'
SMTP_FROM="$SMTP_USER"

umask 077
install -d -m 0700 -o 0 -g 0 "$AUTHORITY_DIR" "$KEYRING_DIR"

cleanup_files=()
cleanup() {
  for secret_path in "${cleanup_files[@]:-}"; do rm -f -- "$secret_path"; done
}
trap cleanup EXIT

validate_secret_file() {
  local secret_path="$1"
  [[ -f "$secret_path" && ! -L "$secret_path" && "$(stat -c '%a:%u:%g' "$secret_path")" == '600:0:0' ]]
}

write_atomic_secret() {
  local destination="$1" content="$2" tmp
  tmp="$(mktemp "$AUTHORITY_DIR/.auth-mail-secret.XXXXXX")"
  cleanup_files+=("$tmp")
  printf '%s\n' "$content" > "$tmp"
  chmod 0600 "$tmp"; chown 0:0 "$tmp"
  mv -f "$tmp" "$destination"
}

read_key_version() {
  validate_secret_file "$CURRENT_VERSION_FILE" || return 1
  local value
  value="$(tr -d '[:space:]' < "$CURRENT_VERSION_FILE")"
  [[ "$value" =~ ^[1-9][0-9]{0,2}$ && "$value" -le 999 ]] || return 1
  printf '%s' "$value"
}

validate_key_file() {
  local version="$1" key_file
  key_file="$KEYRING_DIR/v${version}.key"
  validate_secret_file "$key_file" && grep -Eq '^[A-Fa-f0-9]{64}$' "$key_file"
}

refresh_runtime_projection() {
  local staging="$AUTHORITY_DIR/.runtime-projection.new" key_file key_name
  rm -rf -- "$staging"
  install -d -m 0700 -o 0 -g 0 "$staging"
  install -d -m 0555 -o 0 -g 0 "$staging/keyring"

  for key_file in "$KEYRING_DIR"/v*.key; do
    [[ -f "$key_file" && ! -L "$key_file" ]] || continue
    key_name="$(basename "$key_file")"
    install -m 0444 -o 0 -g 0 "$key_file" "$staging/keyring/$key_name"
  done
  [[ -n "$(find "$staging/keyring" -maxdepth 1 -type f -name 'v*.key' -print -quit)" ]] \
    || { echo 'AUTH_MAIL_PROVISION=FAIL_RUNTIME_KEYRING_EMPTY'; exit 33; }

  install -m 0444 -o 0 -g 0 "$CURRENT_VERSION_FILE" "$staging/current-key-version"
  install -m 0444 -o 0 -g 0 "$DATABASE_URL_FILE" "$staging/database-url"
  install -m 0444 -o 0 -g 0 "$TRANSPORT_FILE" "$staging/transport.env"

  # The projected files are world-readable only inside this root-only
  # parent. Docker bind-mounts the individual targets read-only into
  # nonroot containers; host users cannot traverse AUTHORITY_DIR/runtime.
  [[ "$(stat -c '%a:%u:%g' "$staging")" == '700:0:0' ]] \
    || { echo 'AUTH_MAIL_PROVISION=FAIL_RUNTIME_PROJECTION_PARENT'; exit 34; }
  [[ "$(stat -c '%a:%u:%g' "$staging/keyring")" == '555:0:0' ]] \
    || { echo 'AUTH_MAIL_PROVISION=FAIL_RUNTIME_KEYRING_PROJECTION'; exit 35; }
  for projected in "$staging/current-key-version" "$staging/database-url" "$staging/transport.env" "$staging/keyring"/v*.key; do
    [[ "$(stat -c '%a:%u:%g' "$projected")" == '444:0:0' ]] \
      || { echo 'AUTH_MAIL_PROVISION=FAIL_RUNTIME_PROJECTION_FILE'; exit 36; }
  done

  rm -rf -- "$RUNTIME_PROJECTION_DIR.previous"
  if [[ -e "$RUNTIME_PROJECTION_DIR" ]]; then
    [[ -d "$RUNTIME_PROJECTION_DIR" && ! -L "$RUNTIME_PROJECTION_DIR" ]] \
      || { echo 'AUTH_MAIL_PROVISION=FAIL_RUNTIME_PROJECTION_SHAPE'; exit 37; }
    mv "$RUNTIME_PROJECTION_DIR" "$RUNTIME_PROJECTION_DIR.previous"
  fi
  mv "$staging" "$RUNTIME_PROJECTION_DIR"
  rm -rf -- "$RUNTIME_PROJECTION_DIR.previous"
}

create_key_version() {
  local version="$1" key_file tmp
  key_file="$KEYRING_DIR/v${version}.key"
  [[ ! -e "$key_file" ]] || { echo 'AUTH_MAIL_PROVISION=FAIL_KEY_VERSION_ALREADY_EXISTS'; exit 30; }
  tmp="$(mktemp "$KEYRING_DIR/.v${version}.XXXXXX")"; cleanup_files+=("$tmp")
  python3 - <<'PY' > "$tmp"
import secrets
print(secrets.token_hex(32))
PY
  chmod 0600 "$tmp"; chown 0:0 "$tmp"
  mv -f "$tmp" "$key_file"
  validate_key_file "$version" || { echo 'AUTH_MAIL_PROVISION=FAIL_KEY_VERSION_CONTENT'; exit 31; }
}

# Resolve the active Compose authority and the exact migration datasource.
# auth.mail_outbox is created by the main Prisma migration chain (DATABASE_URL),
# so the worker principal must be born and connected on that same datasource.
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || { echo 'AUTH_MAIL_PROVISION=FAIL_WEB_AUTHORITY_CARDINALITY'; exit 10; }
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
[[ -n "$project" && "$working_dir" == /* && "$working_dir" != / && -d "$working_dir" && ! -L "$working_dir" && -n "$config_files" ]] \
  || { echo 'AUTH_MAIL_PROVISION=FAIL_COMPOSE_AUTHORITY_INVALID'; exit 11; }
working_dir="$(realpath -e -- "$working_dir")"

IFS=',' read -r -a raw_compose_files <<< "$config_files"
compose_files=()
for raw_file in "${raw_compose_files[@]}"; do
  file="${raw_file#"${raw_file%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$working_dir/$file"
  [[ -f "$file" && ! -L "$file" ]] || { echo 'AUTH_MAIL_PROVISION=FAIL_COMPOSE_FILE_INVALID'; exit 12; }
  compose_files+=("$(realpath -e -- "$file")")
done
(( ${#compose_files[@]} >= 1 )) || { echo 'AUTH_MAIL_PROVISION=FAIL_COMPOSE_AUTHORITY_EMPTY'; exit 13; }

dc=(docker compose --project-directory "$working_dir" --project-name "$project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done

compose_json="$(mktemp "$AUTHORITY_DIR/.auth-mail-compose.XXXXXX")"; cleanup_files+=("$compose_json")
"${dc[@]}" config --format json > "$compose_json"
migration_inventory="$(python3 - "$compose_json" <<'PY'
import json, re, sys
from urllib.parse import urlsplit
services=(json.load(open(sys.argv[1], encoding='utf-8')).get('services') or {})
candidates=[]
for name, service in services.items():
    image=str(service.get('image') or '')
    command=service.get('command')
    command=' '.join(command) if isinstance(command, list) else str(command or '')
    if re.search(r'(^|[-_])(migrate|migration)([-_]|$)', name, re.I) or 'grainflow-migration' in image or ('prisma' in command and 'migrate' in command):
        candidates.append(name)
if len(candidates) != 1:
    raise SystemExit(1)
name=candidates[0]
env=services[name].get('environment') or {}
if isinstance(env, list):
    env=dict(item.split('=',1) for item in env if isinstance(item,str) and '=' in item)
value=str(env.get('DATABASE_URL') or '').strip()
url=urlsplit(value)
if url.scheme not in ('postgresql','postgres') or not url.username or not url.password or not url.hostname or not url.path.strip('/'):
    raise SystemExit(1)
print(name)
print(value)
PY
)" || { echo 'AUTH_MAIL_PROVISION=FAIL_MIGRATION_DATABASE_AUTHORITY'; exit 14; }
migration_service="$(printf '%s\n' "$migration_inventory" | sed -n '1p')"
migration_database_url="$(printf '%s\n' "$migration_inventory" | sed -n '2p')"
[[ -n "$migration_service" && -n "$migration_database_url" ]] \
  || { echo 'AUTH_MAIL_PROVISION=FAIL_MIGRATION_DATABASE_AUTHORITY'; exit 14; }

# Key bootstrap is idempotent. Rotation is explicit and keeps all previous key
# versions so already-enqueued ciphertext remains decryptable until retention
# has redacted every row using the old version.
if [[ ! -e "$CURRENT_VERSION_FILE" ]]; then
  [[ "$ACTION" == bootstrap ]] || { echo 'AUTH_MAIL_PROVISION=FAIL_KEYRING_NOT_BOOTSTRAPPED'; exit 15; }
  create_key_version 1
  write_atomic_secret "$CURRENT_VERSION_FILE" '1'
fi
current_version="$(read_key_version)" || { echo 'AUTH_MAIL_PROVISION=FAIL_CURRENT_KEY_VERSION'; exit 16; }
validate_key_file "$current_version" || { echo 'AUTH_MAIL_PROVISION=FAIL_CURRENT_KEY_FILE'; exit 17; }

if [[ "$ACTION" == rotate-key ]]; then
  next_version=$((current_version + 1))
  (( next_version <= 999 )) || { echo 'AUTH_MAIL_PROVISION=FAIL_KEY_VERSION_EXHAUSTED'; exit 32; }
  create_key_version "$next_version"
  write_atomic_secret "$CURRENT_VERSION_FILE" "$next_version"
  current_version="$next_version"
fi

# Reconcile the dedicated worker credential against the exact migration
# datasource. Bootstrap deliberately rotates this server-side credential:
# it corrects stale/wrong datasource authority without accepting any secret
# from CI, and the runtime projection is refreshed before the worker starts.
database_authority_state='EXISTING'
if [[ "$ACTION" == bootstrap || "$ACTION" == rotate-db ]]; then
  db_password="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
  sql_tmp="$(mktemp "$AUTHORITY_DIR/.auth-mail-role.XXXXXX")"; cleanup_files+=("$sql_tmp")
  DB_PASSWORD="$db_password" python3 - <<'PY' > "$sql_tmp"
import os
password=os.environ['DB_PASSWORD'].replace("'", "''")
print("DO $$ BEGIN "
      "IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_auth_mail_runtime') THEN RAISE EXCEPTION 'pc_auth_mail_runtime missing'; END IF; "
      "IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_auth_mail_runtime' AND (rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)) THEN RAISE EXCEPTION 'pc_auth_mail_runtime unsafe'; END IF; "
      "ALTER ROLE pc_auth_mail_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '%s'; "
      "END $$;" % password)
PY
  chmod 0600 "$sql_tmp"
  if ! "${dc[@]}" run --rm --no-deps --pull never -T "$migration_service" \
      node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma \
      < "$sql_tmp" >/dev/null 2>&1; then
    unset db_password
    echo 'AUTH_MAIL_PROVISION=FAIL_DATABASE_ROLE_PASSWORD'
    exit 20
  fi

  database_tmp="$(mktemp "$AUTHORITY_DIR/.auth-mail-db.XXXXXX")"; cleanup_files+=("$database_tmp")
  DB_PASSWORD="$db_password" python3 - "$migration_database_url" <<'PY' > "$database_tmp"
import os, sys
from urllib.parse import quote, urlsplit, urlunsplit
url=urlsplit(sys.argv[1])
user=quote('pc_auth_mail_runtime', safe='')
password=quote(os.environ['DB_PASSWORD'], safe='')
host=url.hostname or ''
if ':' in host and not host.startswith('['):
    host=f'[{host}]'
if url.port:
    host=f'{host}:{url.port}'
netloc=f'{user}:{password}@{host}'
print(urlunsplit((url.scheme, netloc, url.path, url.query, '')))
PY
  unset db_password
  chmod 0600 "$database_tmp"; chown 0:0 "$database_tmp"
  mv -f "$database_tmp" "$DATABASE_URL_FILE"
  database_authority_state='MIGRATION_DATASOURCE_RECONCILED'
elif [[ ! -e "$DATABASE_URL_FILE" ]]; then
  echo 'AUTH_MAIL_PROVISION=FAIL_DATABASE_AUTHORITY_MISSING'
  exit 18
fi

validate_secret_file "$DATABASE_URL_FILE" || { echo 'AUTH_MAIL_PROVISION=FAIL_DATABASE_SECRET_AUTHORITY'; exit 21; }
python3 - "$DATABASE_URL_FILE" "$migration_database_url" <<'PY' >/dev/null \
  || { echo 'AUTH_MAIL_PROVISION=FAIL_DATABASE_DATASOURCE_MISMATCH'; exit 38; }
import sys
from urllib.parse import urlsplit
worker=urlsplit(open(sys.argv[1], encoding='utf-8').read().strip())
migration=urlsplit(sys.argv[2])
def authority(url):
    return (
        (url.hostname or '').lower(),
        url.port or 5432,
        url.path,
        url.query,
    )
if worker.scheme not in ('postgresql','postgres') or worker.username != 'pc_auth_mail_runtime' or not worker.password:
    raise SystemExit(1)
if authority(worker) != authority(migration):
    raise SystemExit(1)
PY

# SMTP rotation is human-presence gated. The credential is never accepted in an
# argument/environment from CI and is tested against official REG.RU authority
# before replacing the old root-only file.
if [[ "$ACTION" == rotate-smtp || ("$ACTION" == bootstrap && ! -e "$TRANSPORT_FILE") ]]; then
  [[ -t 0 ]] || { echo 'AUTH_MAIL_PROVISION=FAIL_SMTP_ROTATION_REQUIRES_TTY'; exit 22; }
  printf 'REG.RU password for %s: ' "$SMTP_USER" >/dev/tty
  IFS= read -r -s smtp_password </dev/tty
  printf '\n' >/dev/tty
  [[ ${#smtp_password} -ge 8 && ${#smtp_password} -le 512 && "$smtp_password" != *$'\n'* && "$smtp_password" != *$'\r'* ]] \
    || { unset smtp_password; echo 'AUTH_MAIL_PROVISION=FAIL_SMTP_PASSWORD_SHAPE'; exit 23; }

  SMTP_PASSWORD="$smtp_password" SMTP_HOST="$SMTP_HOST" SMTP_PORT="$SMTP_PORT" SMTP_USER="$SMTP_USER" python3 - <<'PY' \
    || { unset smtp_password; echo 'AUTH_MAIL_PROVISION=FAIL_SMTP_AUTH'; exit 24; }
import os, smtplib, ssl
ctx = ssl.create_default_context()
ctx.minimum_version = ssl.TLSVersion.TLSv1_2
with smtplib.SMTP_SSL(os.environ['SMTP_HOST'], int(os.environ['SMTP_PORT']), timeout=15, context=ctx) as client:
    client.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
PY

  transport_tmp="$(mktemp "$AUTHORITY_DIR/.auth-mail-transport.XXXXXX")"; cleanup_files+=("$transport_tmp")
  SMTP_PASSWORD="$smtp_password" python3 - "$SMTP_HOST" "$SMTP_PORT" "$SMTP_USER" "$SMTP_FROM" <<'PY' > "$transport_tmp"
import os, sys
host, port, user, sender = sys.argv[1:5]
password = os.environ['SMTP_PASSWORD']
for value in (host, port, user, sender, password):
    if not value or '\n' in value or '\r' in value or '\0' in value:
        raise SystemExit(1)
print(f'PC_SMTP_HOST={host}')
print(f'PC_SMTP_PORT={port}')
print(f'PC_SMTP_USER={user}')
print(f'PC_SMTP_PASS={password}')
print(f'PC_MAIL_FROM={sender}')
PY
  unset smtp_password
  chmod 0600 "$transport_tmp"; chown 0:0 "$transport_tmp"
  mv -f "$transport_tmp" "$TRANSPORT_FILE"
elif [[ ! -e "$TRANSPORT_FILE" ]]; then
  echo 'AUTH_MAIL_PROVISION=FAIL_TRANSPORT_SECRET_MISSING'
  exit 25
fi

validate_secret_file "$TRANSPORT_FILE" || { echo 'AUTH_MAIL_PROVISION=FAIL_TRANSPORT_SECRET_AUTHORITY'; exit 26; }
python3 - "$TRANSPORT_FILE" <<'PY' >/dev/null || { echo 'AUTH_MAIL_PROVISION=FAIL_TRANSPORT_SECRET_CONTENT'; exit 27; }
import sys
values = {}
for raw in open(sys.argv[1], encoding='utf-8'):
    name, sep, value = raw.rstrip('\n').partition('=')
    if sep:
        values[name] = value
required = {'PC_SMTP_HOST','PC_SMTP_PORT','PC_SMTP_USER','PC_SMTP_PASS','PC_MAIL_FROM'}
if set(values) != required:
    raise SystemExit(1)
if values['PC_SMTP_HOST'] != 'mail.hosting.reg.ru' or values['PC_SMTP_PORT'] != '465':
    raise SystemExit(1)
user = values['PC_SMTP_USER']
local, sep, user_domain = user.rpartition('@')
platform_domain = 'xn----8sbjf4befbjgs9b.xn--p1ai'
if not sep or not local or any(c in user for c in '\r\n\0<>'):
    raise SystemExit(1)
if user_domain != platform_domain and not user_domain.endswith('.' + platform_domain):
    raise SystemExit(1)
if values['PC_MAIL_FROM'] != f'access@{platform_domain}':
    raise SystemExit(1)
PY

for key_file in "$KEYRING_DIR"/v*.key; do
  [[ -e "$key_file" ]] || continue
  validate_secret_file "$key_file" || { echo 'AUTH_MAIL_PROVISION=FAIL_KEYRING_PERMISSIONS'; exit 28; }
  grep -Eq '^[A-Fa-f0-9]{64}$' "$key_file" || { echo 'AUTH_MAIL_PROVISION=FAIL_KEYRING_CONTENT'; exit 29; }
done

refresh_runtime_projection

echo 'AUTH_MAIL_PROVISION=PASS'
echo 'AUTH_MAIL_SECRET_AUTHORITY=SERVER_SIDE_ROOT_ONLY'
echo 'AUTH_MAIL_SMTP_AUTHORITY=mail.hosting.reg.ru:465'
echo "AUTH_MAIL_CURRENT_KEY_VERSION=$current_version"
echo 'AUTH_MAIL_GITHUB_SECRET_REQUIRED=0'
if [[ "$database_authority_state" == 'MIGRATION_DATASOURCE_RECONCILED' ]]; then
  echo 'AUTH_MAIL_DATABASE_AUTHORITY=MIGRATION_DATASOURCE_RECONCILED'
else
  echo 'AUTH_MAIL_DATABASE_AUTHORITY=MIGRATION_DATASOURCE_EXISTING'
fi
if [[ "$ACTION" =~ ^rotate-(smtp|db|key)$ ]]; then
  echo 'AUTH_MAIL_RUNTIME_RESTART_REQUIRED=1'
fi
