#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
PROD_COMPOSE_B64="${PC_PROD_COMPOSE_B64:-}"
PROD_PROJECT_B64="${PC_PROD_PROJECT_B64:-}"

fail() { printf 'ERROR_CODE=%s\n' "$1" >&2; exit "${2:-1}"; }
decode() { [[ -z "${1:-}" ]] && return 0; printf '%s' "$1" | base64 -d; }
trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }

[[ "$ACTION" == provision ]] || fail INVALID_ACTION 2
prod_dir="$(decode "$PROD_DIR_B64")"
prod_compose="$(decode "$PROD_COMPOSE_B64")"
prod_project="$(decode "$PROD_PROJECT_B64")"

if [[ -z "$prod_dir" || -z "$prod_compose" ]]; then
  mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  (( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 3
  web_id="${web_ids[0]}"
  prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
  prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
  prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
fi
[[ -n "$prod_dir" && "$prod_dir" == /* && "$prod_dir" != / && -d "$prod_dir" && ! -L "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 4
[[ -n "$prod_compose" ]] || fail PROTECTED_COMPOSE_FILE_MISSING 5

IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="$(trim "$raw")"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" && ! -L "$file" ]] || fail PROTECTED_COMPOSE_FILE_MISSING 5
  compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || fail COMPOSE_AUTHORITY_EMPTY 6
dc=(docker compose --project-directory "$prod_dir")
[[ -z "$prod_project" ]] || dc+=(--project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done

umask 077
compose_json="$(mktemp)"
trap 'rm -f "$compose_json" "${temporary_file:-}"' EXIT
"${dc[@]}" config --format json > "$compose_json"
service_inventory="$(python3 - "$compose_json" <<'PY'
import json, re, sys
services = (json.load(open(sys.argv[1], encoding='utf-8')).get('services') or {})
candidates = []
for name, service in services.items():
    image = str(service.get('image') or '')
    command = service.get('command')
    command = ' '.join(command) if isinstance(command, list) else str(command or '')
    if re.search(r'(^|[-_])(migrate|migration)([-_]|$)', name, re.I) or 'grainflow-migration' in image or ('prisma' in command and 'migrate' in command):
        candidates.append(name)
if len(candidates) != 1:
    raise SystemExit(1)
print(candidates[0])
PY
)" || fail MIGRATION_SERVICE_DISCOVERY_FAILED 7
migration_service="$service_inventory"

staff_file="$prod_dir/.pc-staff-database.env"
[[ "$staff_file" == "$prod_dir"/* && ! -L "$staff_file" ]] || fail STAFF_DATABASE_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 8
valid_file() {
  [[ -f "$staff_file" && ! -L "$staff_file" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$staff_file")" == '600:0:0' ]] || return 1
  [[ "$(wc -l < "$staff_file" | tr -d '[:space:]')" == 1 ]] || return 1
  python3 - "$staff_file" <<'PY'
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

if [[ -e "$staff_file" ]]; then
  valid_file || fail EXISTING_STAFF_DATABASE_ENV_FILE_INVALID 9
  printf 'STAFF_DATABASE_URL_PROVISION=EXISTING\n'
  printf 'STAFF_DATABASE_URL_VALID=1\n'
  exit 0
fi

migration_url="$(python3 - "$compose_json" "$migration_service" <<'PY'
import json, sys
services = (json.load(open(sys.argv[1], encoding='utf-8')).get('services') or {})
env = services[sys.argv[2]].get('environment') or {}
if isinstance(env, list):
    pairs = [x.split('=', 1) for x in env if isinstance(x, str) and '=' in x]
    env = dict(pairs)
value = str(env.get('DATABASE_URL') or '').strip()
if not value:
    raise SystemExit(1)
print(value)
PY
)" || fail MIGRATION_DATABASE_URL_UNAVAILABLE 10

password="$(openssl rand -hex 32)"
[[ "$password" =~ ^[A-Fa-f0-9]{64}$ ]] || fail STAFF_PASSWORD_GENERATION_FAILED 11
staff_url="$(printf '%s\0%s' "$migration_url" "$password" | python3 -c '
import sys
from urllib.parse import quote, urlsplit, urlunsplit
source, password = sys.stdin.buffer.read().split(b"\0", 1)
value = source.decode().strip()
password = password.decode().strip()
url = urlsplit(value)
if url.scheme not in ("postgresql", "postgres") or not url.hostname or not url.path.strip("/") or not url.username or not url.password:
    raise SystemExit(1)
host = url.hostname
if ":" in host and not host.startswith("["):
    host = f"[{host}]"
if url.port:
    host = f"{host}:{url.port}"
netloc = "pc_staff_runtime:" + quote(password, safe="") + "@" + host
print(urlunsplit((url.scheme, netloc, url.path, url.query, "")))
')" || fail STAFF_DATABASE_URL_BUILD_FAILED 12

sql="$(printf '%s\0' "$password" | python3 -c '
import sys
password = sys.stdin.buffer.read().split(b"\0", 1)[0].decode()
if len(password) != 64 or any(c not in "0123456789abcdefABCDEF" for c in password): raise SystemExit(1)
print("DO $$ BEGIN "
      "IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '\''pc_staff_runtime'\'') THEN RAISE EXCEPTION '\''pc_staff_runtime missing'\''; END IF; "
      "IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '\''pc_staff_runtime'\'' AND (rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)) THEN RAISE EXCEPTION '\''pc_staff_runtime unsafe'\''; END IF; "
      "ALTER ROLE pc_staff_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '\''" + password + "'\''; "
      "END $$;")
')" || fail STAFF_RUNTIME_SQL_BUILD_FAILED 13

printf '%s\n' "$sql" | "${dc[@]}" run --rm --no-deps --pull never -T "$migration_service" \
  node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma >/dev/null 2>&1 \
  || fail STAFF_RUNTIME_PASSWORD_PROVISION_FAILED 14

temporary_file="$(mktemp "$prod_dir/.pc-staff-database.env.XXXXXX")"
printf 'STAFF_DATABASE_URL=%s\n' "$staff_url" > "$temporary_file"
chown 0:0 "$temporary_file"
chmod 0600 "$temporary_file"
mv "$temporary_file" "$staff_file"
unset temporary_file password migration_url staff_url sql
valid_file || fail STAFF_DATABASE_ENV_FILE_VERIFICATION_FAILED 15
printf 'STAFF_DATABASE_URL_PROVISION=CREATED\n'
printf 'STAFF_DATABASE_URL_VALID=1\n'
