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
OUTBOX_WORKER_IMAGE="${PC_OUTBOX_WORKER_IMAGE:-}"
OUTBOX_POLICY_FILE="${PC_OUTBOX_POLICY_FILE:-}"
KAFKA_IMAGE='confluentinc/cp-kafka@sha256:24cdd3a7fa89d2bed150560ebea81ff1943badfa61e51d66bb541a6b0d7fb047'
KAFKA_SERVICE='ir20-kafka'
OUTBOX_SERVICE='outbox-worker'
IMAGE_BINDING_VERIFIER="${PC_RELEASE_IMAGE_BINDING_VERIFIER:-${BASH_SOURCE[0]%/*}/release/verify-production-image-binding.py}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
PROD_COMPOSE_B64="${PC_PROD_COMPOSE_B64:-}"
PROD_PROJECT_B64="${PC_PROD_PROJECT_B64:-}"
BACKUP_EVIDENCE_B64="${PC_PROD_BACKUP_EVIDENCE_FILE_B64:-${PC_BACKUP_EVIDENCE_FILE_B64:-}}"
STATE_ROOT="/var/lib/pc-release-authority"
STATE_FILE="$STATE_ROOT/full-stack-${RUN_ID}.state"
outbox_runtime_env_file=""
OUTBOX_RUNTIME_ENV_PREEXISTED=0
BASELINE_WORKER_PRESENT=0
BASELINE_BROKER_PRESENT=0

RELEASE_ROLLBACK_ARMED=0
RELEASE_ROLLBACK_ACTIVE=0
fail() {
  local code="$1" rc="${2:-1}"
  printf 'ERROR_CODE=%s\n' "$code" >&2
  if [[ "${RELEASE_ROLLBACK_ARMED:-0}" == 1 && "${RELEASE_ROLLBACK_ACTIVE:-0}" == 0 ]]; then
    rollback_and_exit "$rc"
  fi
  exit "$rc"
}
decode() { [[ -z "$1" ]] || printf '%s' "$1" | base64 -d; }
trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }

[[ "$ACTION" =~ ^(audit|deploy|rollback|verify-intake|observe-ir20)$ ]] || fail INVALID_ACTION 2
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
gekta_api_runtime_env_file=""
gekta_web_runtime_env_file=""

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
  python3 - "$auth_opaque_token_env_file" <<'PY' || fail AUTH_OPAQUE_TOKEN_ENV_FILE_CONTENT_INVALID 22
import hashlib
import hmac
import re
import sys

raw = open(sys.argv[1], 'rb').read()
if not raw.endswith(b'\n') or b'\r' in raw or b'\0' in raw:
    raise SystemExit(1)
try:
    lines = raw[:-1].decode('ascii').split('\n')
except UnicodeDecodeError:
    raise SystemExit(1)
if len(lines) != 2:
    raise SystemExit(1)
opaque_match = re.fullmatch(r'AUTH_OPAQUE_TOKEN_DIGEST_KEY=([A-Fa-f0-9]{64,})', lines[0])
pepper_match = re.fullmatch(r'AUTH_TOKEN_PEPPER=([a-f0-9]{64})', lines[1])
if not opaque_match or not pepper_match:
    raise SystemExit(1)
expected = hmac.new(
    opaque_match.group(1).encode('ascii'),
    b'pc-auth-generic-hash-pepper:v1',
    hashlib.sha256,
).hexdigest()
if not hmac.compare_digest(pepper_match.group(1), expected):
    raise SystemExit(1)
PY
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

resolve_gekta_runtime_env_files() {
  gekta_api_runtime_env_file="${PC_GEKTA_API_RUNTIME_ENV_FILE:-$prod_dir/.pc-gekta-api-runtime.env}"
  gekta_web_runtime_env_file="${PC_GEKTA_WEB_RUNTIME_ENV_FILE:-$prod_dir/.pc-gekta-web-runtime.env}"
  [[ "$gekta_api_runtime_env_file" == "$prod_dir"/* ]] || fail GEKTA_API_RUNTIME_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 68
  [[ "$gekta_web_runtime_env_file" == "$prod_dir"/* ]] || fail GEKTA_WEB_RUNTIME_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 69
  [[ -f "$gekta_api_runtime_env_file" && ! -L "$gekta_api_runtime_env_file" ]] || fail GEKTA_API_RUNTIME_ENV_FILE_MISSING 70
  [[ -f "$gekta_web_runtime_env_file" && ! -L "$gekta_web_runtime_env_file" ]] || fail GEKTA_WEB_RUNTIME_ENV_FILE_MISSING 71
  [[ "$(stat -c '%a:%u:%g' "$gekta_api_runtime_env_file")" == '600:0:0' ]] || fail GEKTA_API_RUNTIME_ENV_FILE_PERMISSIONS_INVALID 72
  [[ "$(stat -c '%a:%u:%g' "$gekta_web_runtime_env_file")" == '600:0:0' ]] || fail GEKTA_WEB_RUNTIME_ENV_FILE_PERMISSIONS_INVALID 73
  python3 - "$gekta_api_runtime_env_file" <<'PY' || fail GEKTA_API_RUNTIME_ENV_FILE_CONTENT_INVALID 74
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
    if not separator or name in values:
        raise SystemExit(1)
    values[name] = value
if set(values) != {'GEKTA_PHONE_ENCRYPTION_KEY', 'GEKTA_PHONE_LOOKUP_PEPPER'}:
    raise SystemExit(1)
if not re.fullmatch(r'[A-Fa-f0-9]{64}', values['GEKTA_PHONE_ENCRYPTION_KEY']):
    raise SystemExit(1)
if not re.fullmatch(r'[A-Fa-f0-9]{96}', values['GEKTA_PHONE_LOOKUP_PEPPER']):
    raise SystemExit(1)
PY
  python3 - "$gekta_web_runtime_env_file" <<'PY' || fail GEKTA_WEB_RUNTIME_ENV_FILE_CONTENT_INVALID 75
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
if set(values) != {'MFA_LOGIN_TICKET_SECRET', 'GEKTA_ANONYMOUS_SESSION_SECRET'}:
    raise SystemExit(1)
if values['MFA_LOGIN_TICKET_SECRET'] == values['GEKTA_ANONYMOUS_SESSION_SECRET']:
    raise SystemExit(1)
PY
  python3 - "$gekta_api_runtime_env_file" "$gekta_web_runtime_env_file" <<'PY' || fail GEKTA_RUNTIME_PURPOSE_SEPARATION_INVALID 76
import sys

def values(path):
    return dict(line.split('=', 1) for line in open(path, encoding='utf-8').read().rstrip('\n').split('\n'))

api = values(sys.argv[1])
web = values(sys.argv[2])
purpose_secrets = {
    api['GEKTA_PHONE_LOOKUP_PEPPER'],
    web['MFA_LOGIN_TICKET_SECRET'],
    web['GEKTA_ANONYMOUS_SESSION_SECRET'],
}
if len(purpose_secrets) != 3:
    raise SystemExit(1)
PY
}

if [[ "$ACTION" == deploy ]]; then
  resolve_password_reset_runtime_env_files
  resolve_gekta_runtime_env_files
fi

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

# These helpers return failures to their caller. Only the outer release flow
# may invoke fail/rollback; a command-substitution subshell must not roll back.
runtime_isolation_error() {
  printf 'ERROR_CODE=%s\n' "$1" >&2
  return 1
}

validate_container_ids() {
  local ids="$1" allow_empty="${2:-0}" id
  local -A seen=()
  if [[ -z "$ids" ]]; then
    [[ "$allow_empty" == 1 ]] && return 0
    runtime_isolation_error TARGET_CONTAINER_MISSING; return 1
  fi
  while IFS= read -r id; do
    [[ "$id" =~ ^[0-9a-f]{64}$ ]] || { runtime_isolation_error CONTAINER_ID_INVALID; return 1; }
    [[ ! -v "seen[$id]" ]] || { runtime_isolation_error CONTAINER_ID_DUPLICATED; return 1; }
    seen[$id]=1
  done <<< "$ids"
}

resolve_release_runtime_project() {
  local api_project web_project
  api_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$api_id" 2>/dev/null)" || { runtime_isolation_error TARGET_PROJECT_UNREADABLE; return 1; }
  web_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id" 2>/dev/null)" || { runtime_isolation_error TARGET_PROJECT_UNREADABLE; return 1; }
  [[ "$api_project" =~ ^[a-z0-9][a-z0-9_-]*$ && "$api_project" == "$web_project" ]] || { runtime_isolation_error TARGET_PROJECT_MISMATCH; return 1; }
  [[ -z "$prod_project" || "$prod_project" == "$api_project" ]] || { runtime_isolation_error TARGET_PROJECT_MISMATCH; return 1; }
  runtime_project="$api_project"
}

verify_release_container() {
  local id="$1" service="$2" identity
  identity="$(docker inspect --format '{{.Id}} {{ index .Config.Labels "com.docker.compose.project" }} {{ index .Config.Labels "com.docker.compose.service" }}' "$id" 2>/dev/null)" || { runtime_isolation_error TARGET_IDENTITY_UNREADABLE; return 1; }
  [[ "$identity" == "$id $runtime_project $service" ]] || { runtime_isolation_error TARGET_IDENTITY_MISMATCH; return 1; }
}

release_service_id() {
  local service="$1" id
  id="$("${dc[@]}" ps -q "$service" 2>/dev/null)" || { runtime_isolation_error TARGET_DISCOVERY_FAILED; return 1; }
  validate_container_ids "$id" || return 1
  [[ "$id" != *$'\n'* ]] || { runtime_isolation_error TARGET_RUNTIME_AMBIGUOUS; return 1; }
  verify_release_container "$id" "$service" || return 1
  printf '%s\n' "$id"
}

release_watchtower_ids() {
  local ids id
  ids="$(docker ps -aq --no-trunc --filter "label=com.docker.compose.project=$runtime_project" --filter 'label=com.docker.compose.service=watchtower' 2>/dev/null)" || { runtime_isolation_error WATCHTOWER_DISCOVERY_FAILED; return 1; }
  validate_container_ids "$ids" 1 || return 1
  [[ -n "$ids" ]] || return 0
  while IFS= read -r id; do
    verify_release_container "$id" watchtower || return 1
  done <<< "$ids"
  printf '%s\n' "$ids" | LC_ALL=C sort
}

optional_release_service_id() {
  local service="$1" ids id
  ids="$(docker ps -aq --no-trunc --filter "label=com.docker.compose.project=$runtime_project" --filter "label=com.docker.compose.service=$service" 2>/dev/null)" || { runtime_isolation_error TARGET_DISCOVERY_FAILED; return 1; }
  validate_container_ids "$ids" 1 || return 1
  [[ "$ids" != *$'\n'* ]] || { runtime_isolation_error TARGET_RUNTIME_AMBIGUOUS; return 1; }
  [[ -n "$ids" ]] || return 0
  id="$ids"
  verify_release_container "$id" "$service" || return 1
  printf '%s\n' "$id"
}

snapshot_unrelated() {
  local output="$1" require_retired="${2:-0}" all_ids target_api target_web target_worker target_broker watchtower_ids id
  local -A targets=() running=()
  [[ "$require_retired" =~ ^[01]$ ]] || { runtime_isolation_error SNAPSHOT_MODE_INVALID; return 1; }
  all_ids="$(docker ps -q --no-trunc 2>/dev/null)" || { runtime_isolation_error RUNTIME_SNAPSHOT_FAILED; return 1; }
  validate_container_ids "$all_ids" || return 1
  target_api="$(release_service_id api)" || return 1
  target_web="$(release_service_id web)" || return 1
  target_worker="$(optional_release_service_id "$OUTBOX_SERVICE")" || return 1
  target_broker="$(optional_release_service_id "$KAFKA_SERVICE")" || return 1
  [[ "$target_api" != "$target_web" ]] || { runtime_isolation_error TARGET_IDENTITY_MISMATCH; return 1; }
  while IFS= read -r id; do running[$id]=1; done <<< "$all_ids"
  [[ -v "running[$target_api]" && -v "running[$target_web]" ]] || { runtime_isolation_error TARGET_SNAPSHOT_CHANGED; return 1; }
  targets[$target_api]=1; targets[$target_web]=1
  [[ -z "$target_worker" ]] || targets[$target_worker]=1
  [[ -z "$target_broker" ]] || targets[$target_broker]=1
  watchtower_ids="$(release_watchtower_ids)" || return 1
  if [[ -n "$watchtower_ids" ]]; then
    while IFS= read -r id; do
      if [[ "$require_retired" == 1 && -v "running[$id]" ]]; then runtime_isolation_error WATCHTOWER_RUNNING_AFTER_RETIREMENT; return 1; fi
      targets[$id]=1
    done <<< "$watchtower_ids"
  fi
  if [[ "$require_retired" == 1 ]]; then verify_watchtower_retirement "$watchtower_ids" || return 1; fi
  {
    while IFS= read -r id; do [[ -v "targets[$id]" ]] || printf '%s\n' "$id"; done <<< "$all_ids"
  } | LC_ALL=C sort > "$output"
}

verify_watchtower_retirement() {
  local ids="$1" id state
  [[ -n "$ids" ]] || return 0
  while IFS= read -r id; do
    state="$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}} {{.State.Running}}' "$id" 2>/dev/null)" || { runtime_isolation_error WATCHTOWER_STATE_UNREADABLE; return 1; }
    [[ "$state" == 'no false' ]] || { runtime_isolation_error WATCHTOWER_NOT_RETIRED; return 1; }
  done <<< "$ids"
}

retire_release_watchtower() {
  local ids after_ids id
  ids="$(release_watchtower_ids)" || return 1
  if [[ -n "$ids" ]]; then
    while IFS= read -r id; do
      docker update --restart=no "$id" >/dev/null 2>&1 || { runtime_isolation_error WATCHTOWER_UPDATE_FAILED; return 1; }
      docker stop "$id" >/dev/null 2>&1 || { runtime_isolation_error WATCHTOWER_STOP_FAILED; return 1; }
    done <<< "$ids"
  fi
  after_ids="$(release_watchtower_ids)" || return 1
  [[ "$after_ids" == "$ids" ]] || { runtime_isolation_error WATCHTOWER_SET_CHANGED; return 1; }
  verify_watchtower_retirement "$ids"
}

runtime_project=""
resolve_release_runtime_project || fail RUNTIME_PROJECT_VALIDATION_FAILED 78

write_override() {
  local api_image="$1" web_image="$2" migration_image="$3" destination="$4"
  local include_password_reset_runtime="${5:-0}" worker_image="${6:-}" include_ir20="${7:-0}"
  [[ "$include_password_reset_runtime" =~ ^[01]$ ]] || fail PASSWORD_RESET_RUNTIME_OVERRIDE_MODE_INVALID 67
  [[ "$include_ir20" =~ ^[01]$ ]] || fail IR20_RUNTIME_OVERRIDE_MODE_INVALID 84
  umask 077
  cat > "$destination.tmp" <<YAML
services:
  api:
    image: ${api_image}
    pull_policy: never
    environment:
      OUTBOX_WORKER_ENABLED: "false"
    env_file:
      - ${auth_opaque_token_env_file}
      - ${staff_database_env_file}
$(if [[ "$include_password_reset_runtime" == 1 ]]; then
  printf '      - %s\n' "${password_reset_delivery_env_file}"
  printf '      - %s\n' "${gekta_api_runtime_env_file}"
fi)
  web:
    image: ${web_image}
    pull_policy: never
$(if [[ "$include_password_reset_runtime" == 1 ]]; then
  printf '    env_file:\n'
  printf '      - %s\n' "${password_reset_delivery_env_file}"
  printf '      - %s\n' "${transactional_mail_env_file}"
  printf '      - %s\n' "${gekta_web_runtime_env_file}"
fi)
  ${migration_service}:
    image: ${migration_image}
    pull_policy: never
YAML
  if [[ "$include_ir20" == 1 ]]; then
    [[ -n "$worker_image" && -n "$outbox_runtime_env_file" ]] || fail IR20_RUNTIME_INPUT_MISSING 85
    cat >> "$destination.tmp" <<YAML
  $KAFKA_SERVICE:
    image: $KAFKA_IMAGE
    pull_policy: never
    restart: unless-stopped
    environment:
      KAFKA_NODE_ID: "1"
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://$KAFKA_SERVICE:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: "1"
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: "1"
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: "1"
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"
      KAFKA_LOG_DIRS: /var/lib/kafka/data
      CLUSTER_ID: MkU3OEVBNTcwNTJENDM2Qk
      KAFKA_HEAP_OPTS: -Xms256m -Xmx512m
    volumes:
      - pc_ir20_kafka_data:/var/lib/kafka/data
    healthcheck:
      test: ["CMD-SHELL", "kafka-topics --bootstrap-server 127.0.0.1:9092 --list >/dev/null 2>&1"]
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 20s
    security_opt:
      - no-new-privileges:true
  $OUTBOX_SERVICE:
    image: $worker_image
    pull_policy: never
    restart: unless-stopped
    env_file:
      - $outbox_runtime_env_file
    depends_on:
      $KAFKA_SERVICE:
        condition: service_healthy
    read_only: true
    tmpfs:
      - /tmp:size=64m,mode=1777
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    stop_grace_period: 90s
    healthcheck:
      test: ["CMD", "/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3002/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 18
      start_period: 10s
volumes:
  pc_ir20_kafka_data:
    name: pc_ir20_kafka_data
YAML
  fi
  mv "$destination.tmp" "$destination"
  chmod 0600 "$destination"
}

dc_target=("${dc[@]}" -f "$full_override")

verify_image() {
  local component="$1" image="$2"
  [[ -f "$IMAGE_BINDING_VERIFIER" ]] || fail IMAGE_BINDING_VERIFIER_MISSING 81
  python3 "$IMAGE_BINDING_VERIFIER" pull-verify "$component" "$TARGET_SHA" "$image" >/dev/null 2>&1 || fail IMAGE_BINDING_FAILED 20
}

verify_runtime_image() {
  local component="$1" image="$2" container_id="$3"
  [[ -f "$IMAGE_BINDING_VERIFIER" ]] || return 1
  python3 "$IMAGE_BINDING_VERIFIER" runtime "$component" "$TARGET_SHA" "$image" "$container_id" 2>/dev/null
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

verify_api_auth_hash_keys() {
  local id="$1"
  [[ -n "$id" ]] || return 1
  docker exec -i "$id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { createHmac, timingSafeEqual } = require('node:crypto');
const opaque = String(process.env.AUTH_OPAQUE_TOKEN_DIGEST_KEY ?? '').trim();
const pepper = String(process.env.AUTH_TOKEN_PEPPER ?? '').trim();
if (!/^[A-Fa-f0-9]{64,}$/.test(opaque) || !/^[a-f0-9]{64}$/.test(pepper)) process.exit(1);
const expected = createHmac('sha256', opaque).update('pc-auth-generic-hash-pepper:v1', 'utf8').digest();
const actual = Buffer.from(pepper, 'hex');
if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) process.exit(1);
process.stdout.write('API_AUTH_HASH_KEYS=VALID\n');
NODE
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
wait_broker() {
  local id state attempt
  for attempt in $(seq 1 60); do
    id="$("${dc_target[@]}" ps -q "$KAFKA_SERVICE" | head -1)"
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
    [[ "$state" == healthy ]] && return 0
    sleep 2
  done
  return 1
}

wait_worker() {
  local id state attempt
  for attempt in $(seq 1 60); do
    id="$("${dc_target[@]}" ps -q "$OUTBOX_SERVICE" | head -1)"
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
    if [[ "$state" == healthy ]] && docker exec "$id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3002/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

verify_broker_image() {
  docker pull "$KAFKA_IMAGE" >/dev/null 2>&1 || fail KAFKA_IMAGE_PULL_FAILED 86
  python3 - "$KAFKA_IMAGE" <<'PY' || fail KAFKA_IMAGE_BINDING_FAILED 87
import json,re,subprocess,sys
ref=sys.argv[1]
if not re.fullmatch(r'confluentinc/cp-kafka@sha256:[0-9a-f]{64}',ref): raise SystemExit(1)
p=subprocess.run(['docker','image','inspect',ref],capture_output=True,text=True,timeout=30)
if p.returncode: raise SystemExit(1)
rows=json.loads(p.stdout)
if len(rows)!=1 or ref not in (rows[0].get('RepoDigests') or []): raise SystemExit(1)
PY
}

resolve_outbox_runtime_env_file() {
  outbox_runtime_env_file="${PC_OUTBOX_RUNTIME_ENV_FILE:-$prod_dir/.pc-ir20-outbox-worker.env}"
  [[ "$outbox_runtime_env_file" == "$prod_dir"/* ]] || fail OUTBOX_RUNTIME_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 88
  [[ ! -L "$outbox_runtime_env_file" ]] || fail OUTBOX_RUNTIME_ENV_FILE_SYMLINK 89
  [[ ! -f "$outbox_runtime_env_file" ]] || OUTBOX_RUNTIME_ENV_PREEXISTED=1
}

validate_outbox_runtime_env_file() {
  [[ -f "$outbox_runtime_env_file" && ! -L "$outbox_runtime_env_file" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$outbox_runtime_env_file")" == '600:0:0' ]] || return 1
  python3 - "$outbox_runtime_env_file" "$KAFKA_SERVICE" <<'PY'
import re,sys
from urllib.parse import urlsplit
raw=open(sys.argv[1],encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw: raise SystemExit(1)
pairs={}
for line in raw.rstrip('\n').split('\n'):
    k,sep,v=line.partition('=')
    if not sep or k in pairs or not re.fullmatch(r'[A-Z][A-Z0-9_]*',k): raise SystemExit(1)
    pairs[k]=v
required={'DATABASE_URL','KAFKA_BROKERS','KAFKA_REQUIRED','OUTBOX_WORKER_ENABLED','RUNTIME_COMPONENT','NODE_ENV','OUTBOX_WORKER_HEALTH_PORT','OUTBOX_WORKER_INTERVAL_MS','OUTBOX_WORKER_BATCH_SIZE','OUTBOX_WORKER_HEARTBEAT_MS'}
if set(pairs)!=required: raise SystemExit(1)
u=urlsplit(pairs['DATABASE_URL'])
if u.scheme not in ('postgresql','postgres') or u.username!='app_outbox' or not u.password or not u.hostname or not u.path.strip('/'): raise SystemExit(1)
if pairs['KAFKA_BROKERS']!=sys.argv[2]+':9092' or pairs['KAFKA_REQUIRED']!='true' or pairs['OUTBOX_WORKER_ENABLED']!='true' or pairs['RUNTIME_COMPONENT']!='outbox-worker' or pairs['NODE_ENV']!='production': raise SystemExit(1)
if pairs['OUTBOX_WORKER_HEALTH_PORT']!='3002' or pairs['OUTBOX_WORKER_INTERVAL_MS']!='1000' or pairs['OUTBOX_WORKER_BATCH_SIZE']!='25' or pairs['OUTBOX_WORKER_HEARTBEAT_MS']!='20000': raise SystemExit(1)
PY
}

migration_database_url() {
  local json rc
  json="$(mktemp)"; "${dc[@]}" config --format json > "$json"
  set +e
  python3 - "$json" "$migration_service" <<'PY'
import json,sys
svc=(json.load(open(sys.argv[1],encoding='utf-8')).get('services') or {}).get(sys.argv[2]) or {}
env=svc.get('environment') or {}
if isinstance(env,list): env=dict(x.split('=',1) for x in env if isinstance(x,str) and '=' in x)
v=str(env.get('DATABASE_URL') or '').strip()
if not v or '\n' in v or '\r' in v or '\0' in v: raise SystemExit(1)
print(v)
PY
  rc=$?; set -e; rm -f "$json"; return "$rc"
}

apply_outbox_policy() {
  [[ -n "$OUTBOX_POLICY_FILE" && "$OUTBOX_POLICY_FILE" == /tmp/pc-ir20-outbox-policy-* && -f "$OUTBOX_POLICY_FILE" && ! -L "$OUTBOX_POLICY_FILE" ]] || fail OUTBOX_POLICY_FILE_INVALID 121
  [[ "$(stat -c '%u:%g' "$OUTBOX_POLICY_FILE")" == '0:0' ]] || fail OUTBOX_POLICY_FILE_OWNER_INVALID 122
  "${dc_target[@]}" run --rm --no-deps --pull never -T "$migration_service" node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma < "$OUTBOX_POLICY_FILE" >/dev/null 2>&1 || fail OUTBOX_POLICY_APPLY_FAILED 123
  printf 'IR20_OUTBOX_POLICY_APPLIED=1\n'
}
provision_outbox_runtime() {
  resolve_outbox_runtime_env_file
  if [[ "$OUTBOX_RUNTIME_ENV_PREEXISTED" == 1 ]]; then
    validate_outbox_runtime_env_file || fail EXISTING_OUTBOX_RUNTIME_ENV_FILE_INVALID 90
  else
    local migration_url password worker_url sql temp
    migration_url="$(migration_database_url)" || fail MIGRATION_DATABASE_URL_UNAVAILABLE_FOR_OUTBOX 91
    password="$(python3 -c 'import secrets; print(secrets.token_hex(48))')"; [[ "$password" =~ ^[A-Fa-f0-9]{96}$ ]] || fail OUTBOX_PASSWORD_GENERATION_FAILED 92
    worker_url="$(printf '%s\0%s' "$migration_url" "$password" | python3 -c '
import sys
from urllib.parse import quote,urlsplit,urlunsplit
source,password=sys.stdin.buffer.read().split(b"\0",1); u=urlsplit(source.decode().strip()); password=password.decode().strip()
if u.scheme not in ("postgresql","postgres") or not u.hostname or not u.path.strip("/") or not u.username or not u.password: raise SystemExit(1)
host=u.hostname
if ":" in host and not host.startswith("["): host="["+host+"]"
if u.port: host=host+":"+str(u.port)
print(urlunsplit((u.scheme,"app_outbox:"+quote(password,safe="")+"@"+host,u.path,u.query,"")))
')" || fail OUTBOX_DATABASE_URL_BUILD_FAILED 93
    sql="$(printf '%s\0' "$password" | python3 -c '
import sys
p=sys.stdin.buffer.read().split(b"\0",1)[0].decode()
if len(p)!=96 or any(c not in "0123456789abcdefABCDEF" for c in p): raise SystemExit(1)
print("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '\''app_outbox'\'') THEN RAISE EXCEPTION '\''app_outbox missing'\''; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '\''app_outbox'\'' AND (rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION '\''app_outbox unsafe'\''; END IF; ALTER ROLE app_outbox LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '\''"+p+"'\''; END $$;")
')" || fail OUTBOX_RUNTIME_SQL_BUILD_FAILED 94
    printf '%s\n' "$sql" | "${dc_target[@]}" run --rm --no-deps --pull never -T "$migration_service" node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma >/dev/null 2>&1 || fail OUTBOX_RUNTIME_PASSWORD_PROVISION_FAILED 95
    temp="$(mktemp "$prod_dir/.pc-ir20-outbox-worker.env.XXXXXX")"
    {
      printf 'DATABASE_URL=%s\n' "$worker_url"; printf 'KAFKA_BROKERS=%s:9092\n' "$KAFKA_SERVICE"
      printf 'KAFKA_REQUIRED=true\nOUTBOX_WORKER_ENABLED=true\nRUNTIME_COMPONENT=outbox-worker\nNODE_ENV=production\n'
      printf 'OUTBOX_WORKER_HEALTH_PORT=3002\nOUTBOX_WORKER_INTERVAL_MS=1000\nOUTBOX_WORKER_BATCH_SIZE=25\nOUTBOX_WORKER_HEARTBEAT_MS=20000\n'
    } > "$temp"
    chown 0:0 "$temp"; chmod 0600 "$temp"; mv "$temp" "$outbox_runtime_env_file"
    unset migration_url password worker_url sql temp
    validate_outbox_runtime_env_file || fail OUTBOX_RUNTIME_ENV_FILE_VERIFICATION_FAILED 96
  fi
}

worker_node() { "${dc_target[@]}" run --rm --no-deps --pull never -T --entrypoint /nodejs/bin/node "$OUTBOX_SERVICE" - "$@"; }

worker_principal_smoke() {
  worker_node <<'NODE' >/dev/null 2>&1
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{const rows=await p.$queryRawUnsafe(`
SELECT current_user='app_outbox' AS u,current_setting('row_security')='on' AS rls,r.rolsuper AS su,r.rolbypassrls AS br,r.rolcreatedb AS cdb,r.rolcreaterole AS cr,r.rolreplication AS rep,r.rolinherit AS inh,
has_table_privilege(current_user,'public.outbox_entries','SELECT') AS sel,
has_table_privilege(current_user,'public.outbox_entries','INSERT') OR has_any_column_privilege(current_user,'public.outbox_entries','INSERT') AS ins,
has_table_privilege(current_user,'public.outbox_entries','DELETE') AS del,
has_table_privilege(current_user,'public.deals','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(current_user,'public.deals','SELECT,INSERT,UPDATE,REFERENCES') AS deal,
has_schema_privilege(current_user,'auth','USAGE') AS auth,
(SELECT bool_and(has_column_privilege(current_user,'public.outbox_entries',n,'UPDATE')) FROM unnest(ARRAY['status','retryCount','nextRetryAt','lastError','lastErrorCode','lastErrorCategory','lastAttemptAt','manualReviewAt','sentAt','confirmedAt','failedAt','deadLetterAt','leaseOwner','leaseToken','leaseExpiresAt','heartbeatAt']) n) AS upd FROM pg_roles r WHERE r.rolname=current_user`);
const x=rows[0]; if(!x||!x.u||!x.rls||x.su||x.br||x.cdb||x.cr||x.rep||x.inh||!x.sel||!x.upd||x.ins||x.del||x.deal||x.auth) throw Error('BOUNDARY');
const cat=await p.$queryRawUnsafe(`SELECT c.relrowsecurity AS rls,c.relforcerowsecurity AS force,to_regprocedure('public.outbox_expired_attempt_reclaim_guard()') IS NOT NULL AS fence FROM pg_class c WHERE c.oid=to_regclass('public.outbox_entries')`);
if(cat.length!==1||!cat[0].rls||!cat[0].force||!cat[0].fence) throw Error('CATALOG');
})().catch(()=>process.exitCode=1).finally(()=>p.$disconnect());
NODE
}

ensure_kafka_topics() {
  local id; id="$("${dc_target[@]}" ps -q "$KAFKA_SERVICE" | head -1)"; [[ -n "$id" ]] || return 1
  for topic in grainflow.domain.events grainflow.bank.events; do docker exec "$id" kafka-topics --bootstrap-server 127.0.0.1:9092 --create --if-not-exists --topic "$topic" --partitions 3 --replication-factor 1 >/dev/null 2>&1 || return 1; done
  for topic in grainflow.domain.events grainflow.bank.events; do docker exec "$id" kafka-topics --bootstrap-server 127.0.0.1:9092 --describe --topic "$topic" >/dev/null 2>&1 || return 1; done
}

verify_first_broker_restart_persistence() {
  [[ "$BASELINE_BROKER_PRESENT" == 0 ]] || return 0
  local id before after; id="$("${dc_target[@]}" ps -q "$KAFKA_SERVICE" | head -1)"; [[ -n "$id" ]] || return 1
  before="$(docker exec "$id" kafka-topics --bootstrap-server 127.0.0.1:9092 --list 2>/dev/null | grep -E '^(grainflow\.domain\.events|grainflow\.bank\.events)$' | sort)"
  [[ "$before" == $'grainflow.bank.events\ngrainflow.domain.events' ]] || return 1
  docker restart "$id" >/dev/null; wait_broker || return 1
  id="$("${dc_target[@]}" ps -q "$KAFKA_SERVICE" | head -1)"
  after="$(docker exec "$id" kafka-topics --bootstrap-server 127.0.0.1:9092 --list 2>/dev/null | grep -E '^(grainflow\.domain\.events|grainflow\.bank\.events)$' | sort)"
  [[ "$after" == "$before" ]]
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
  local restored_api_id restored_web_id restored_worker_id worker_id broker_id
  [[ -f "$STATE_FILE" ]] || return 1
  # shellcheck disable=SC1090
  source "$STATE_FILE"
  is_revision "$BASELINE_API_REVISION" || return 1
  is_revision "$BASELINE_WEB_REVISION" || return 1
  resolve_outbox_runtime_env_file
  if [[ "${BASELINE_WORKER_PRESENT:-0}" == 1 ]]; then
    is_revision "${BASELINE_WORKER_REVISION:-}" || return 1
    write_override "$BASELINE_API_IMAGE" "$BASELINE_WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override" 0 "$BASELINE_WORKER_IMAGE" 1
    "${dc_target[@]}" config --quiet
    "${dc_target[@]}" up -d --no-deps --pull never "$KAFKA_SERVICE" "$OUTBOX_SERVICE" api web
    wait_broker && wait_worker && wait_api && wait_web || return 1
    restored_worker_id="$("${dc_target[@]}" ps -q "$OUTBOX_SERVICE" | head -1)"
    [[ "$(verify_runtime_image outbox-worker "$BASELINE_WORKER_IMAGE" "$restored_worker_id" 2>/dev/null)" == "$BASELINE_WORKER_REVISION" ]] || return 3
  else
    worker_id="$(optional_release_service_id "$OUTBOX_SERVICE")" || return 1
    broker_id="$(optional_release_service_id "$KAFKA_SERVICE")" || return 1
    [[ -z "$worker_id" ]] || docker rm -f "$worker_id" >/dev/null 2>&1 || return 1
    [[ -z "$broker_id" ]] || docker rm -f "$broker_id" >/dev/null 2>&1 || return 1
    write_override "$BASELINE_API_IMAGE" "$BASELINE_WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override"
    "${dc_target[@]}" config --quiet
    "${dc_target[@]}" up -d --no-deps --pull never api web
    wait_api && wait_web || return 1
    if [[ "${OUTBOX_RUNTIME_ENV_PREEXISTED:-0}" == 0 && -f "$outbox_runtime_env_file" ]]; then
      printf '%s\n' "ALTER ROLE app_outbox NOLOGIN PASSWORD NULL;" | "${dc_target[@]}" run --rm --no-deps --pull never -T "$migration_service" node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma >/dev/null 2>&1 || return 1
      rm -f "$outbox_runtime_env_file"
    fi
  fi
  restored_api_id="$("${dc_target[@]}" ps -q api | head -1)"; restored_web_id="$("${dc_target[@]}" ps -q web | head -1)"
  [[ -n "$restored_api_id" && -n "$restored_web_id" ]] || return 1
  restored_api_revision="$(container_revision "$restored_api_id")" || return 2; restored_web_revision="$(container_revision "$restored_web_id")" || return 2
  is_revision "$restored_api_revision" || return 2; is_revision "$restored_web_revision" || return 2
  [[ "$restored_api_revision" == "$BASELINE_API_REVISION" && "$restored_web_revision" == "$BASELINE_WEB_REVISION" ]] || return 3
}

rollback_and_exit() {
  local rc="${1:-1}" rollback_status=0
  if [[ "${RELEASE_ROLLBACK_ACTIVE:-0}" == 1 ]]; then
    exit "$rc"
  fi
  RELEASE_ROLLBACK_ACTIVE=1
  trap - ERR
  rollback_images || rollback_status=$?
  printf 'DEPLOYMENT_COMPLETE=0\n' >&2
  printf 'ROLLBACK_ATTEMPTED=1\n' >&2
  if [[ "$rollback_status" == 0 ]]; then
    printf 'ROLLBACK_COMPLETE=1\n' >&2
    printf 'ROLLBACK_FAILED=0\n' >&2
    printf 'RESTORED_API_REVISION=%s\n' "${restored_api_revision:-unknown}" >&2
    printf 'RESTORED_WEB_REVISION=%s\n' "${restored_web_revision:-unknown}" >&2
  else
    printf 'ROLLBACK_COMPLETE=0\n' >&2
    printf 'ROLLBACK_FAILED=1\n' >&2
  fi
  exit "$rc"
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
  verify_live_outbox_delivery
}

verify_live_outbox_delivery() {
  [[ "$INTAKE_CORRELATION_ID" =~ ^[A-Za-z0-9._:-]{8,128}$ ]] || fail LIVE_OUTBOX_CORRELATION_INVALID 98
  worker_node "$INTAKE_CORRELATION_ID" <<'NODE' || fail LIVE_OUTBOX_DELIVERY_FAILED 99
const {PrismaClient}=require('@prisma/client'); const correlation=process.argv[2]; const p=new PrismaClient(); const bad=new Set(['DEAD','DEAD_LETTER','MANUAL_REVIEW']);
(async()=>{const deadline=Date.now()+120000; while(Date.now()<deadline){const rows=await p.$queryRawUnsafe('SELECT status FROM public.outbox_entries WHERE "correlationId"=$1 ORDER BY "createdAt" DESC LIMIT 1',correlation); if(rows.length===1){const s=String(rows[0].status); if(s==='SENT'||s==='CONFIRMED'){process.stdout.write('IR20_LIVE_OUTBOX_DELIVERY=PASS\\n');return;} if(bad.has(s)) throw Error('BAD');} await new Promise(r=>setTimeout(r,1000));} throw Error('TIMEOUT');})().catch(()=>process.exitCode=1).finally(()=>p.$disconnect());
NODE
}

if [[ "$ACTION" == verify-intake ]]; then
  verify_durable_intake
  exit 0
fi

if [[ "$ACTION" == observe-ir20 ]]; then
  resolve_outbox_runtime_env_file; validate_outbox_runtime_env_file || fail OUTBOX_RUNTIME_ENV_FILE_INVALID 100
  local_worker="$(optional_release_service_id "$OUTBOX_SERVICE")" || fail IR20_WORKER_DISCOVERY_FAILED 101
  local_broker="$(optional_release_service_id "$KAFKA_SERVICE")" || fail IR20_BROKER_DISCOVERY_FAILED 102
  [[ -n "$local_worker" && -n "$local_broker" ]] || fail IR20_RUNTIME_MISSING 103
  worker_revision="$(verify_runtime_image outbox-worker "$OUTBOX_WORKER_IMAGE" "$local_worker")" || fail IR20_WORKER_IMAGE_BINDING_FAILED 104
  [[ "$worker_revision" == "$TARGET_SHA" ]] || fail IR20_WORKER_REVISION_MISMATCH 105
  initial_worker_restarts="$(docker inspect --format '{{.RestartCount}}' "$local_worker")"; initial_broker_restarts="$(docker inspect --format '{{.RestartCount}}' "$local_broker")"
  [[ "$initial_worker_restarts" =~ ^[0-9]+$ && "$initial_broker_restarts" =~ ^[0-9]+$ ]] || fail IR20_RESTART_COUNTER_INVALID 106
  observation_started_at="$(date +%s)"
  observation_deadline=$((observation_started_at + 1800))
  while true; do
    current_worker="$(optional_release_service_id "$OUTBOX_SERVICE")" || fail IR20_WORKER_DISCOVERY_FAILED 101
    current_broker="$(optional_release_service_id "$KAFKA_SERVICE")" || fail IR20_BROKER_DISCOVERY_FAILED 102
    [[ "$current_worker" == "$local_worker" && "$current_broker" == "$local_broker" ]] || fail IR20_RUNTIME_IDENTITY_CHANGED 107
    [[ "$(docker inspect --format '{{.RestartCount}}' "$current_worker")" == "$initial_worker_restarts" ]] || fail IR20_WORKER_RESTARTED 108
    [[ "$(docker inspect --format '{{.RestartCount}}' "$current_broker")" == "$initial_broker_restarts" ]] || fail IR20_BROKER_RESTARTED 109
    docker exec "$current_worker" /nodejs/bin/node -e "fetch('http://127.0.0.1:3002/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1 || fail IR20_WORKER_NOT_READY 110
    docker exec "$current_broker" kafka-topics --bootstrap-server 127.0.0.1:9092 --list >/dev/null 2>&1 || fail IR20_BROKER_NOT_READY 111
    observation_now="$(date +%s)"
    (( observation_now >= observation_deadline )) && break
    observation_sleep=$((observation_deadline - observation_now))
    (( observation_sleep > 10 )) && observation_sleep=10
    sleep "$observation_sleep"
  done
  observation_elapsed=$(( $(date +%s) - observation_started_at ))
  (( observation_elapsed >= 1800 )) || fail IR20_OBSERVATION_TOO_SHORT 124
  printf 'IR20_RUNTIME_OBSERVATION=PASS\nIR20_OBSERVATION_SECONDS=%s\n' "$observation_elapsed"; exit 0
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
  printf 'ROLLBACK_CONTAINER_REVISIONS_VERIFIED=1\n'
  exit 0
fi

printf 'COMPOSE_AUTHORITY_RESOLVED=1\n'
printf 'MIGRATION_SERVICE_RESOLVED=1\n'
printf 'BASELINE_API_REVISION=%s\n' "$baseline_api_revision"
printf 'BASELINE_WEB_REVISION=%s\n' "$baseline_web_revision"

if [[ "$ACTION" == audit ]]; then
  printf 'AUDIT_COMPLETE=1\n'
  exit 0
fi

[[ -n "$API_IMAGE" && -n "$WEB_IMAGE" && -n "$MIGRATION_IMAGE" && -n "$OUTBOX_WORKER_IMAGE" ]] || fail EXACT_IMAGES_REQUIRED 21
verify_image api "$API_IMAGE"; verify_image web "$WEB_IMAGE"; verify_image migration "$MIGRATION_IMAGE"; verify_image outbox-worker "$OUTBOX_WORKER_IMAGE"; verify_broker_image

# Shared release-authority root: traverse-only for the runner group. `chmod 0700`
# here preserved the group and stripped its `--x`, which is exactly the state the
# host was found in — and it lands after the controller has set 0710, because this
# release and the preflight both fire on the same image build. The runner then
# cannot reach runner-input and activation dies before the controller is invoked.
install -d -m 0710 -o root -g pcactions "$STATE_ROOT"
umask 077
baseline_worker_id="$(optional_release_service_id "$OUTBOX_SERVICE")" || fail OUTBOX_BASELINE_DISCOVERY_FAILED 112
baseline_broker_id="$(optional_release_service_id "$KAFKA_SERVICE")" || fail KAFKA_BASELINE_DISCOVERY_FAILED 113
if [[ -n "$baseline_worker_id" ]]; then BASELINE_WORKER_PRESENT=1; baseline_worker_image="$(docker inspect --format '{{.Config.Image}}' "$baseline_worker_id")"; baseline_worker_revision="$(container_revision "$baseline_worker_id")"; is_revision "$baseline_worker_revision" || fail OUTBOX_BASELINE_REVISION_INVALID 114; else baseline_worker_image=''; baseline_worker_revision=''; fi
[[ -z "$baseline_broker_id" ]] || BASELINE_BROKER_PRESENT=1
[[ "$BASELINE_WORKER_PRESENT" == "$BASELINE_BROKER_PRESENT" ]] || fail IR20_BASELINE_TOPOLOGY_PARTIAL 121
resolve_outbox_runtime_env_file
cat > "$STATE_FILE" <<STATE
BASELINE_API_IMAGE='$baseline_api_image'
BASELINE_WEB_IMAGE='$baseline_web_image'
BASELINE_API_REVISION='$baseline_api_revision'
BASELINE_WEB_REVISION='$baseline_web_revision'
BASELINE_WORKER_PRESENT='$BASELINE_WORKER_PRESENT'
BASELINE_WORKER_IMAGE='$baseline_worker_image'
BASELINE_WORKER_REVISION='$baseline_worker_revision'
BASELINE_BROKER_PRESENT='$BASELINE_BROKER_PRESENT'
OUTBOX_RUNTIME_ENV_PREEXISTED='$OUTBOX_RUNTIME_ENV_PREEXISTED'
MIGRATION_IMAGE='$MIGRATION_IMAGE'
STATE
chmod 0600 "$STATE_FILE"

before_ids="$(mktemp)"
after_ids="$(mktemp)"
snapshot_unrelated "$before_ids" || fail RUNTIME_ISOLATION_FAILED 79
mutated=0
on_error() {
  local rc=$?
  trap - ERR
  if [[ "${RELEASE_ROLLBACK_ARMED:-0}" == 1 ]]; then
    rollback_and_exit "$rc"
  fi
  printf 'DEPLOYMENT_COMPLETE=0\n' >&2
  printf 'ROLLBACK_ATTEMPTED=0\n' >&2
  printf 'ROLLBACK_COMPLETE=0\n' >&2
  printf 'ROLLBACK_FAILED=0\n' >&2
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

RELEASE_ROLLBACK_ARMED=1
mutated=1
if [[ "$BASELINE_WORKER_PRESENT" == 1 ]]; then docker stop "$baseline_worker_id" >/dev/null; fi
write_override "$API_IMAGE" "$WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override" 1
"${dc_target[@]}" config --quiet
"${dc_target[@]}" run --rm --no-deps --pull never "$migration_service"
printf 'MIGRATION_COMPLETE=1\n'
apply_outbox_policy
provision_outbox_runtime
write_override "$API_IMAGE" "$WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override" 1 "$OUTBOX_WORKER_IMAGE" 1
"${dc_target[@]}" config --quiet
"${dc_target[@]}" up -d --no-deps --pull never "$KAFKA_SERVICE"; wait_broker || fail KAFKA_READINESS_FAILED 115
ensure_kafka_topics || fail KAFKA_TOPIC_AUTHORITY_FAILED 116
verify_first_broker_restart_persistence || fail KAFKA_PERSISTENCE_PROOF_FAILED 117
"${dc_target[@]}" up -d --no-deps --pull never "$OUTBOX_SERVICE"; wait_worker || fail OUTBOX_WORKER_READINESS_FAILED 118
worker_principal_smoke || fail OUTBOX_PRINCIPAL_BOUNDARY_FAILED 97
"${dc_target[@]}" up -d --no-deps --pull never api
if ! wait_api; then emit_api_startup_diagnostics; fail API_READINESS_FAILED 30; fi
new_api_id="$("${dc_target[@]}" ps -q api | head -1)"; verify_api_auth_hash_keys "$new_api_id" || fail API_AUTH_HASH_KEYS_INVALID 77
"${dc_target[@]}" up -d --no-deps --pull never web; wait_web || fail WEB_HEALTH_FAILED 31

retire_release_watchtower || fail WATCHTOWER_RETIREMENT_FAILED 80

snapshot_unrelated "$after_ids" 1 || fail RUNTIME_ISOLATION_FAILED 79
cmp -s "$before_ids" "$after_ids" || fail NON_TARGET_CONTAINER_CHANGED 32
rm -f "$before_ids" "$after_ids"

new_api_id="$("${dc_target[@]}" ps -q api | head -1)"; new_web_id="$("${dc_target[@]}" ps -q web | head -1)"
new_worker_id="$("${dc_target[@]}" ps -q "$OUTBOX_SERVICE" | head -1)"; new_broker_id="$("${dc_target[@]}" ps -q "$KAFKA_SERVICE" | head -1)"
[[ -n "$new_worker_id" && -n "$new_broker_id" ]] || fail IR20_RUNTIME_MISSING 103
new_api_revision="$(verify_runtime_image api "$API_IMAGE" "$new_api_id")" || fail RUNNING_API_IMAGE_BINDING_FAILED 82
new_web_revision="$(verify_runtime_image web "$WEB_IMAGE" "$new_web_id")" || fail RUNNING_WEB_IMAGE_BINDING_FAILED 83
new_worker_revision="$(verify_runtime_image outbox-worker "$OUTBOX_WORKER_IMAGE" "$new_worker_id")" || fail RUNNING_OUTBOX_WORKER_IMAGE_BINDING_FAILED 119
if [[ "$new_api_revision" != "$TARGET_SHA" || "$new_web_revision" != "$TARGET_SHA" || "$new_worker_revision" != "$TARGET_SHA" ]]; then
  printf 'RUNNING_API_REVISION=%s\n' "${new_api_revision:-unknown}" >&2; printf 'RUNNING_WEB_REVISION=%s\n' "${new_web_revision:-unknown}" >&2; printf 'RUNNING_OUTBOX_WORKER_REVISION=%s\n' "${new_worker_revision:-unknown}" >&2; fail RUNNING_REVISION_MISMATCH 33
fi
[[ "$(docker inspect --format '{{.Config.Image}}' "$new_broker_id")" == "$KAFKA_IMAGE" ]] || fail RUNNING_KAFKA_IMAGE_BINDING_FAILED 120
RELEASE_ROLLBACK_ARMED=0; mutated=0; trap - ERR
printf 'DEPLOYED_API_REVISION=%s\n' "$new_api_revision"; printf 'DEPLOYED_WEB_REVISION=%s\n' "$new_web_revision"; printf 'DEPLOYED_OUTBOX_WORKER_REVISION=%s\n' "$new_worker_revision"
printf 'IR20_KAFKA_READY=1\n'
printf 'IR20_OUTBOX_WORKER_READY=1\n'
printf 'WATCHTOWER_RETIRED=1\n'
printf 'DEPLOYMENT_COMPLETE=1\n'
