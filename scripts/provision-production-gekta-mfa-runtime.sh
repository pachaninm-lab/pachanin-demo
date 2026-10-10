#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"

fail() {
  printf 'GEKTA_MFA_RUNTIME_ERROR=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$ACTION" == repair ]] || fail INVALID_ACTION 2

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#api_ids[@]} == 1 && ${#web_ids[@]} == 1 )) || fail COMPOSE_RUNTIME_AUTHORITY_AMBIGUOUS 3
api_id="${api_ids[0]}"
web_id="${web_ids[0]}"

prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$prod_dir" && "$prod_dir" == /* && "$prod_dir" != / && -d "$prod_dir" && ! -L "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 4
prod_dir="$(realpath -e -- "$prod_dir")" || fail PRODUCTION_DIRECTORY_INVALID 4
[[ -n "$prod_compose" && -n "$prod_project" ]] || fail COMPOSE_AUTHORITY_MISSING 5
[[ "$prod_project" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] || fail COMPOSE_PROJECT_INVALID 6

mfa_file="$prod_dir/.pc-auth-mfa-runtime.env"
override_file="$prod_dir/compose.pc-auth-mfa-runtime.override.yml"
[[ "$mfa_file" == "$prod_dir"/* && "$override_file" == "$prod_dir"/* ]] || fail RUNTIME_PATH_OUTSIDE_PRODUCTION_DIRECTORY 7
[[ ! -L "$mfa_file" && ! -L "$override_file" ]] || fail RUNTIME_SYMLINK_FORBIDDEN 8

validate_mfa_file() {
  local candidate="$1"
  [[ -f "$candidate" && ! -L "$candidate" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$candidate")" == '600:0:0' ]] || return 1
  python3 - "$candidate" <<'PY'
import re
import sys
raw = open(sys.argv[1], encoding='ascii').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    raise SystemExit(1)
lines = raw.rstrip('\n').split('\n')
if len(lines) != 1:
    raise SystemExit(1)
name, sep, value = lines[0].partition('=')
if sep != '=' or name != 'MFA_ENCRYPTION_KEY' or not re.fullmatch(r'[A-Fa-f0-9]{64}', value):
    raise SystemExit(1)
PY
}

validate_override() {
  local candidate="$1"
  [[ -f "$candidate" && ! -L "$candidate" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$candidate")" == '600:0:0' ]] || return 1
  python3 - "$candidate" "$mfa_file" <<'PY'
import json
import sys
expected = "services:\n  api:\n    env_file:\n      - " + json.dumps(sys.argv[2]) + "\n"
if open(sys.argv[1], encoding='utf-8').read() != expected:
    raise SystemExit(1)
PY
}

runtime_status=EXISTING
if [[ -e "$mfa_file" ]]; then
  validate_mfa_file "$mfa_file" || fail EXISTING_MFA_RUNTIME_INVALID 9
else
  runtime_key="$(openssl rand -hex 32)"
  [[ "$runtime_key" =~ ^[A-Fa-f0-9]{64}$ ]] || fail MFA_SECRET_GENERATION_FAILED 10
  umask 077
  runtime_temp="$(mktemp "$prod_dir/.pc-auth-mfa-runtime.env.XXXXXX")"
  override_temp=""
  trap 'rm -f -- "${runtime_temp:-}" "${override_temp:-}"' EXIT
  printf 'MFA_ENCRYPTION_KEY=%s\n' "$runtime_key" > "$runtime_temp"
  chown 0:0 "$runtime_temp"
  chmod 0600 "$runtime_temp"
  validate_mfa_file "$runtime_temp" || fail GENERATED_MFA_RUNTIME_INVALID 11
  mv -- "$runtime_temp" "$mfa_file" || fail MFA_RUNTIME_INSTALL_FAILED 12
  runtime_temp=""
  runtime_status=CREATED
fi

if [[ -e "$override_file" ]]; then
  validate_override "$override_file" || fail EXISTING_MFA_OVERRIDE_CONFLICT 13
else
  umask 077
  override_temp="$(mktemp "$prod_dir/compose.pc-auth-mfa-runtime.override.yml.XXXXXX")"
  python3 - "$override_temp" "$mfa_file" <<'PY'
import json
import sys
open(sys.argv[1], 'w', encoding='utf-8').write(
    "services:\n  api:\n    env_file:\n      - " + json.dumps(sys.argv[2]) + "\n"
)
PY
  chown 0:0 "$override_temp"
  chmod 0600 "$override_temp"
  override_candidate="$override_file"
  override_file="$override_temp"
  validate_override "$override_file" || fail GENERATED_MFA_OVERRIDE_INVALID 14
  mv -- "$override_temp" "$override_candidate" || fail MFA_OVERRIDE_INSTALL_FAILED 15
  override_file="$override_candidate"
  override_temp=""
fi
trap - EXIT

api_image_name="$(docker inspect --format '{{.Config.Image}}' "$api_id")"
web_image_name="$(docker inspect --format '{{.Config.Image}}' "$web_id")"
api_image_id="$(docker inspect --format '{{.Image}}' "$api_id")"
web_image_id="$(docker inspect --format '{{.Image}}' "$web_id")"
[[ -n "$api_image_name" && -n "$web_image_name" && "$api_image_id" =~ ^sha256:[a-f0-9]{64}$ && "$web_image_id" =~ ^sha256:[a-f0-9]{64}$ ]] || fail ACTIVE_IMAGE_AUTHORITY_INVALID 16
[[ "$(docker image inspect --format '{{.Id}}' "$api_image_name" 2>/dev/null || true)" == "$api_image_id" ]] || fail API_IMAGE_TAG_DRIFT 17
[[ "$(docker image inspect --format '{{.Id}}' "$web_image_name" 2>/dev/null || true)" == "$web_image_id" ]] || fail WEB_IMAGE_TAG_DRIFT 18

env_value() {
  local id="$1" key="$2"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$id" \
    | awk -F= -v key="$key" '$1==key {sub(/^[^=]*=/, ""); print; found=1} END {if (!found) exit 3}'
}

active_api_mfa="$(env_value "$api_id" MFA_ENCRYPTION_KEY 2>/dev/null || true)"
active_web_mfa="$(env_value "$web_id" MFA_ENCRYPTION_KEY 2>/dev/null || true)"
if [[ "$active_api_mfa" =~ ^[A-Fa-f0-9]{64}$ && -z "$active_web_mfa" && ",${prod_compose}," == *",${override_file},"* ]]; then
  printf 'GEKTA_MFA_RUNTIME_REPAIR=%s\n' "$runtime_status"
  printf 'GEKTA_MFA_API_KEY=READY\n'
  printf 'GEKTA_MFA_WEB_ISOLATED=1\n'
  printf 'GEKTA_MFA_API_IMAGE_UNCHANGED=1\n'
  printf 'GEKTA_MFA_WEB_IMAGE_UNCHANGED=1\n'
  printf 'GEKTA_MFA_COMPOSE_AUTHORITY=READY\n'
  printf 'GEKTA_MFA_EXISTING_RUNTIME_COMPAT=PASS\n'
  printf 'PRODUCTION_MUTATION=NONE_ALREADY_READY\n'
  exit 0
fi

IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ "$file" == "$override_file" ]] && continue
  [[ -f "$file" && ! -L "$file" ]] || fail PROTECTED_COMPOSE_FILE_MISSING 19
  compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || fail COMPOSE_AUTHORITY_EMPTY 20

dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
repair_dc=("${dc[@]}" -f "$override_file")

rollback_needed=0
rollback_on_exit() {
  local rc=$?
  trap - EXIT INT TERM
  if (( rollback_needed == 1 )); then
    "${dc[@]}" up -d --no-deps --pull never --force-recreate api web >/dev/null 2>&1 || true
  fi
  exit "$rc"
}
trap rollback_on_exit EXIT INT TERM
rollback_needed=1
"${repair_dc[@]}" config --quiet
"${repair_dc[@]}" up -d --no-deps --pull never --force-recreate api web

wait_service() {
  local service="$1" attempt id state health
  for attempt in $(seq 1 60); do
    mapfile -t ids < <(docker ps -q --filter "label=com.docker.compose.service=$service")
    if (( ${#ids[@]} == 1 )); then
      id="${ids[0]}"
      state="$(docker inspect --format '{{.State.Status}}' "$id")"
      health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")"
      if [[ "$state" == running && ( "$health" == healthy || "$health" == none ) ]]; then
        printf '%s' "$id"
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}
new_api_id="$(wait_service api)" || fail API_RUNTIME_NOT_READY 21
new_web_id="$(wait_service web)" || fail WEB_RUNTIME_NOT_READY 22
[[ "$(docker inspect --format '{{.Image}}' "$new_api_id")" == "$api_image_id" ]] || fail API_IMAGE_CHANGED 23
[[ "$(docker inspect --format '{{.Image}}' "$new_web_id")" == "$web_image_id" ]] || fail WEB_IMAGE_CHANGED 24

new_api_mfa="$(env_value "$new_api_id" MFA_ENCRYPTION_KEY 2>/dev/null || true)"
new_web_mfa="$(env_value "$new_web_id" MFA_ENCRYPTION_KEY 2>/dev/null || true)"
[[ "$new_api_mfa" =~ ^[A-Fa-f0-9]{64}$ ]] || fail API_MFA_RUNTIME_NOT_INJECTED 25
[[ -z "$new_web_mfa" ]] || fail MFA_RUNTIME_LEAKED_TO_WEB 26
api_phone_key="$(env_value "$new_api_id" GEKTA_PHONE_ENCRYPTION_KEY 2>/dev/null || true)"
api_phone_pepper="$(env_value "$new_api_id" GEKTA_PHONE_LOOKUP_PEPPER 2>/dev/null || true)"
api_delivery="$(env_value "$new_api_id" REGISTRATION_DELIVERY_KEY 2>/dev/null || true)"
web_mfa_ticket="$(env_value "$new_web_id" MFA_LOGIN_TICKET_SECRET 2>/dev/null || true)"
web_anonymous="$(env_value "$new_web_id" GEKTA_ANONYMOUS_SESSION_SECRET 2>/dev/null || true)"
web_delivery="$(env_value "$new_web_id" REGISTRATION_DELIVERY_KEY 2>/dev/null || true)"
[[ "$api_phone_key" =~ ^[A-Fa-f0-9]{64}$ && "$api_phone_pepper" =~ ^[A-Fa-f0-9]{96}$ ]] || fail EXISTING_GEKTA_API_RUNTIME_REGRESSED 27
[[ "$web_mfa_ticket" =~ ^[A-Fa-f0-9]{96}$ && "$web_anonymous" =~ ^[A-Fa-f0-9]{96}$ ]] || fail EXISTING_GEKTA_WEB_RUNTIME_REGRESSED 28
[[ -n "$api_delivery" && "$api_delivery" == "$web_delivery" ]] || fail REGISTRATION_DELIVERY_RUNTIME_REGRESSED 29
new_config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$new_web_id")"
[[ ",${new_config_files}," == *",${override_file},"* ]] || fail MFA_OVERRIDE_NOT_PERSISTED_IN_COMPOSE_AUTHORITY 30

rollback_needed=0
trap - EXIT INT TERM
printf 'GEKTA_MFA_RUNTIME_REPAIR=%s\n' "$runtime_status"
printf 'GEKTA_MFA_API_KEY=READY\n'
printf 'GEKTA_MFA_WEB_ISOLATED=1\n'
printf 'GEKTA_MFA_API_IMAGE_UNCHANGED=1\n'
printf 'GEKTA_MFA_WEB_IMAGE_UNCHANGED=1\n'
printf 'GEKTA_MFA_COMPOSE_AUTHORITY=READY\n'
printf 'GEKTA_MFA_EXISTING_RUNTIME_COMPAT=PASS\n'
printf 'PRODUCTION_MUTATION=API_WEB_RECREATE_SAME_IMAGES\n'
