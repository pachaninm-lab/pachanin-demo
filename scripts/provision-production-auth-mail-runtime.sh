#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-bootstrap}"
[[ "$ACTION" =~ ^(bootstrap|rotate-smtp)$ ]] || { echo 'AUTH_MAIL_PROVISION=FAIL_INVALID_ACTION'; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo 'AUTH_MAIL_PROVISION=FAIL_ROOT_REQUIRED'; exit 3; }
command -v docker >/dev/null 2>&1 || { echo 'AUTH_MAIL_PROVISION=FAIL_DOCKER_REQUIRED'; exit 4; }
command -v python3 >/dev/null 2>&1 || { echo 'AUTH_MAIL_PROVISION=FAIL_PYTHON_REQUIRED'; exit 5; }

AUTHORITY_DIR="/var/lib/pc-secret-authority"
OUTBOX_KEY_FILE="$AUTHORITY_DIR/auth-mail-outbox-key"
DATABASE_URL_FILE="$AUTHORITY_DIR/auth-mail-database-url"
TRANSPORT_FILE="$AUTHORITY_DIR/auth-mail-transport.env"
SMTP_HOST='mail.hosting.reg.ru'
SMTP_PORT='465'
SMTP_USER='access@xn----8sbjf4befbjgs9b.xn--p1ai'
SMTP_FROM="$SMTP_USER"

umask 077
install -d -m 0700 -o 0 -g 0 "$AUTHORITY_DIR"

cleanup_files=()
cleanup() {
  for path in "${cleanup_files[@]:-}"; do rm -f -- "$path"; done
}
trap cleanup EXIT

validate_secret_file() {
  local path="$1"
  [[ -f "$path" && ! -L "$path" && "$(stat -c '%a:%u:%g' "$path")" == '600:0:0' ]]
}

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || { echo 'AUTH_MAIL_PROVISION=FAIL_WEB_AUTHORITY_CARDINALITY'; exit 10; }
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
[[ -n "$project" && "$working_dir" == /* && "$working_dir" != / && -d "$working_dir" && ! -L "$working_dir" ]] \
  || { echo 'AUTH_MAIL_PROVISION=FAIL_COMPOSE_AUTHORITY_INVALID'; exit 11; }
working_dir="$(realpath -e -- "$working_dir")"

mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || { echo 'AUTH_MAIL_PROVISION=FAIL_API_AUTHORITY_CARDINALITY'; exit 12; }
api_id="${api_ids[0]}"

auth_database_url="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api_id" \
  | sed -n 's/^AUTH_DATABASE_URL=//p' | head -1)"
[[ -n "$auth_database_url" ]] || { echo 'AUTH_MAIL_PROVISION=FAIL_AUTH_DATABASE_URL_MISSING'; exit 13; }

read -r db_host db_port db_name < <(python3 - "$auth_database_url" <<'PY'
import sys
from urllib.parse import urlsplit
url = urlsplit(sys.argv[1])
if url.scheme not in ('postgresql', 'postgres') or not url.hostname or not url.path.strip('/'):
    raise SystemExit(1)
print(url.hostname, url.port or 5432, url.path.strip('/'))
PY
) || { echo 'AUTH_MAIL_PROVISION=FAIL_AUTH_DATABASE_URL_INVALID'; exit 14; }

# The mail worker gets a distinct PostgreSQL login. Its random password is born
# on the production host, is never printed, and is written only to the root
# secret authority after ALTER ROLE succeeds.
if [[ "$ACTION" == bootstrap ]]; then
  if [[ ! -e "$OUTBOX_KEY_FILE" ]]; then
    tmp="$(mktemp "$AUTHORITY_DIR/.auth-mail-key.XXXXXX")"; cleanup_files+=("$tmp")
    python3 - <<'PY' > "$tmp"
import secrets
print(secrets.token_hex(32))
PY
    chmod 0600 "$tmp"
    chown 0:0 "$tmp"
    mv -f "$tmp" "$OUTBOX_KEY_FILE"
  fi
  validate_secret_file "$OUTBOX_KEY_FILE" || { echo 'AUTH_MAIL_PROVISION=FAIL_OUTBOX_KEY_AUTHORITY'; exit 15; }
  grep -Eq '^[A-Fa-f0-9]{64}$' "$OUTBOX_KEY_FILE" || { echo 'AUTH_MAIL_PROVISION=FAIL_OUTBOX_KEY_CONTENT'; exit 16; }

  db_password="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"

  mapfile -t pg_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" | while read -r id; do
    image="$(docker inspect --format '{{.Config.Image}}' "$id" 2>/dev/null || true)"
    service="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$id" 2>/dev/null || true)"
    if [[ "$image" == postgres:* || "$image" == */postgres:* || "$service" == postgres || "$service" == db || "$service" == database ]]; then
      printf '%s\n' "$id"
    fi
  done)
  (( ${#pg_ids[@]} == 1 )) || { unset db_password; echo 'AUTH_MAIL_PROVISION=FAIL_POSTGRES_AUTHORITY_CARDINALITY'; exit 17; }
  pg_id="${pg_ids[0]}"

  postgres_user="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$pg_id" | sed -n 's/^POSTGRES_USER=//p' | head -1)"
  postgres_db="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$pg_id" | sed -n 's/^POSTGRES_DB=//p' | head -1)"
  [[ -n "$postgres_user" ]] || postgres_user='postgres'
  [[ -n "$postgres_db" ]] || postgres_db="$postgres_user"

  sql_tmp="$(mktemp "$AUTHORITY_DIR/.auth-mail-role.XXXXXX")"; cleanup_files+=("$sql_tmp")
  DB_PASSWORD="$db_password" python3 - <<'PY' > "$sql_tmp"
import os
password = os.environ['DB_PASSWORD'].replace("'", "''")
print("ALTER ROLE pc_auth_mail_runtime WITH LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '%s';" % password)
PY
  chmod 0600 "$sql_tmp"
  if ! docker exec -i "$pg_id" psql -X -v ON_ERROR_STOP=1 -U "$postgres_user" -d "$postgres_db" >/dev/null < "$sql_tmp"; then
    unset db_password
    echo 'AUTH_MAIL_PROVISION=FAIL_DATABASE_ROLE_PASSWORD'
    exit 18
  fi

  database_tmp="$(mktemp "$AUTHORITY_DIR/.auth-mail-db.XXXXXX")"; cleanup_files+=("$database_tmp")
  DB_PASSWORD="$db_password" python3 - "$auth_database_url" <<'PY' > "$database_tmp"
import os, sys
from urllib.parse import quote, urlsplit, urlunsplit
url = urlsplit(sys.argv[1])
user = quote('pc_auth_mail_runtime', safe='')
password = quote(os.environ['DB_PASSWORD'], safe='')
host = url.hostname or ''
port = f':{url.port}' if url.port else ''
netloc = f'{user}:{password}@{host}{port}'
print(urlunsplit((url.scheme, netloc, url.path, url.query, url.fragment)))
PY
  chmod 0600 "$database_tmp"; chown 0:0 "$database_tmp"
  mv -f "$database_tmp" "$DATABASE_URL_FILE"
  unset db_password
  validate_secret_file "$DATABASE_URL_FILE" || { echo 'AUTH_MAIL_PROVISION=FAIL_DATABASE_SECRET_AUTHORITY'; exit 19; }
fi

validate_secret_file "$OUTBOX_KEY_FILE" || { echo 'AUTH_MAIL_PROVISION=FAIL_OUTBOX_KEY_MISSING'; exit 20; }
validate_secret_file "$DATABASE_URL_FILE" || { echo 'AUTH_MAIL_PROVISION=FAIL_DATABASE_SECRET_MISSING'; exit 21; }

# SMTP credential rotation is deliberately human-presence gated. The password
# is read without echo, never accepted as an argument/environment value, and is
# tested against the official REG.RU endpoint before the old authority is
# atomically replaced.
if [[ "$ACTION" == rotate-smtp || ! -e "$TRANSPORT_FILE" ]]; then
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
fi

validate_secret_file "$TRANSPORT_FILE" || { echo 'AUTH_MAIL_PROVISION=FAIL_TRANSPORT_SECRET_AUTHORITY'; exit 25; }
python3 - "$TRANSPORT_FILE" <<'PY' >/dev/null || { echo 'AUTH_MAIL_PROVISION=FAIL_TRANSPORT_SECRET_CONTENT'; exit 26; }
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
if values['PC_SMTP_USER'] != 'access@xn----8sbjf4befbjgs9b.xn--p1ai' or values['PC_MAIL_FROM'] != values['PC_SMTP_USER']:
    raise SystemExit(1)
PY

echo 'AUTH_MAIL_PROVISION=PASS'
echo 'AUTH_MAIL_SECRET_AUTHORITY=SERVER_SIDE_ROOT_ONLY'
echo 'AUTH_MAIL_SMTP_AUTHORITY=mail.hosting.reg.ru:465'
echo 'AUTH_MAIL_GITHUB_SECRET_REQUIRED=0'
