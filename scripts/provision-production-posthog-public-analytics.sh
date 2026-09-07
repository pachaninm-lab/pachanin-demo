#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"

fail() {
  printf 'POSTHOG_RUNTIME_ERROR=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$ACTION" == provision ]] || fail INVALID_ACTION 2
[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED 3
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 4
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 5

project_reference_b64="${PC_POSTHOG_PROJECT_REFERENCE_B64:-}"
[[ -n "$project_reference_b64" ]] || fail PROJECT_REFERENCE_REQUIRED 6
project_reference="$(printf '%s' "$project_reference_b64" | base64 --decode 2>/dev/null)" || fail PROJECT_REFERENCE_BASE64_INVALID 7
[[ "$project_reference" =~ ^phc_[A-Za-z0-9_-]{20,96}$ ]] || fail PROJECT_REFERENCE_INVALID 8
[[ "$project_reference" != *$'\n'* && "$project_reference" != *$'\r'* ]] || fail PROJECT_REFERENCE_INVALID 8
unset project_reference_b64 PC_POSTHOG_PROJECT_REFERENCE_B64

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 9
web_id="${web_ids[0]}"

prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$prod_dir" && "$prod_dir" == /* && "$prod_dir" != / && -d "$prod_dir" && ! -L "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 10
prod_dir="$(realpath -e -- "$prod_dir")" || fail PRODUCTION_DIRECTORY_INVALID 10
[[ -n "$prod_compose" && -n "$prod_project" ]] || fail COMPOSE_AUTHORITY_MISSING 11
[[ "$prod_project" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] || fail COMPOSE_PROJECT_INVALID 12

runtime_file="$prod_dir/.pc-posthog-public-analytics.env"
override_file="$prod_dir/compose.pc-posthog-public-analytics.override.yml"
[[ "$runtime_file" == "$prod_dir"/* && "$override_file" == "$prod_dir"/* ]] || fail RUNTIME_PATH_OUTSIDE_PRODUCTION_DIRECTORY 13
[[ ! -L "$runtime_file" && ! -L "$override_file" ]] || fail RUNTIME_SYMLINK_FORBIDDEN 14

validate_runtime_file() {
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
if len(lines) != 2:
    raise SystemExit(1)
values = {}
for line in lines:
    name, sep, value = line.partition('=')
    if sep != '=' or name in values:
        raise SystemExit(1)
    values[name] = value
if set(values) != {'POSTHOG_PROJECT_REFERENCE', 'POSTHOG_INGEST_REGION'}:
    raise SystemExit(1)
if not re.fullmatch(r'phc_[A-Za-z0-9_-]{20,96}', values['POSTHOG_PROJECT_REFERENCE']):
    raise SystemExit(1)
if values['POSTHOG_INGEST_REGION'] != 'us':
    raise SystemExit(1)
PY
}

validate_override_file() {
  local candidate="$1"
  [[ -f "$candidate" && ! -L "$candidate" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$candidate")" == '600:0:0' ]] || return 1
  python3 - "$candidate" "$runtime_file" <<'PY'
import json
import sys

expected = "services:\n  web:\n    env_file:\n      - " + json.dumps(sys.argv[2]) + "\n"
if open(sys.argv[1], encoding='utf-8').read() != expected:
    raise SystemExit(1)
PY
}

runtime_status=EXISTING
override_status=EXISTING
created_runtime=0
created_override=0

if [[ -e "$runtime_file" ]]; then
  validate_runtime_file "$runtime_file" || fail EXISTING_RUNTIME_INVALID 15
  existing_reference="$(python3 - "$runtime_file" <<'PY'
import sys
for line in open(sys.argv[1], encoding='ascii'):
    if line.startswith('POSTHOG_PROJECT_REFERENCE='):
        print(line.split('=', 1)[1].strip())
        break
PY
)"
  [[ "$existing_reference" == "$project_reference" ]] || fail EXISTING_RUNTIME_REFERENCE_CONFLICT 16
  unset existing_reference
else
  umask 077
  runtime_temp="$(mktemp "$prod_dir/.pc-posthog-public-analytics.env.XXXXXX")"
  trap 'rm -f -- "${runtime_temp:-}" "${override_temp:-}"' EXIT
  printf 'POSTHOG_PROJECT_REFERENCE=%s\n' "$project_reference" > "$runtime_temp"
  printf 'POSTHOG_INGEST_REGION=us\n' >> "$runtime_temp"
  chown 0:0 "$runtime_temp"
  chmod 0600 "$runtime_temp"
  validate_runtime_file "$runtime_temp" || fail GENERATED_RUNTIME_INVALID 17
  mv -- "$runtime_temp" "$runtime_file" || fail RUNTIME_INSTALL_FAILED 18
  runtime_temp=""
  runtime_status=CREATED
  created_runtime=1
fi

if [[ -e "$override_file" ]]; then
  validate_override_file "$override_file" || fail EXISTING_OVERRIDE_CONFLICT 19
else
  umask 077
  override_temp="$(mktemp "$prod_dir/compose.pc-posthog-public-analytics.override.yml.XXXXXX")"
  python3 - "$override_temp" "$runtime_file" <<'PY'
import json
import sys

open(sys.argv[1], 'w', encoding='utf-8').write(
    "services:\n  web:\n    env_file:\n      - " + json.dumps(sys.argv[2]) + "\n"
)
PY
  chown 0:0 "$override_temp"
  chmod 0600 "$override_temp"
  validate_override_file "$override_temp" || fail GENERATED_OVERRIDE_INVALID 20
  mv -- "$override_temp" "$override_file" || fail OVERRIDE_INSTALL_FAILED 21
  override_temp=""
  override_status=CREATED
  created_override=1
fi
trap - EXIT

IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
override_was_authoritative=0
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  if [[ "$file" == "$override_file" ]]; then
    override_was_authoritative=1
    continue
  fi
  [[ -f "$file" && ! -L "$file" ]] || fail PROTECTED_COMPOSE_FILE_MISSING 22
  compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || fail COMPOSE_AUTHORITY_EMPTY 23

dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
target_dc=("${dc[@]}" -f "$override_file")
"${target_dc[@]}" config --quiet
"${target_dc[@]}" config --services | grep -qx web || fail WEB_SERVICE_MISSING 24

image_name="$(docker inspect --format '{{.Config.Image}}' "$web_id")"
image_id="$(docker inspect --format '{{.Image}}' "$web_id")"
[[ -n "$image_name" && "$image_id" =~ ^sha256:[a-f0-9]{64}$ ]] || fail ACTIVE_IMAGE_AUTHORITY_INVALID 25
[[ "$(docker image inspect --format '{{.Id}}' "$image_name" 2>/dev/null || true)" == "$image_id" ]] || fail ACTIVE_IMAGE_TAG_DRIFT 26
original_has_health="$(docker inspect --format '{{if .State.Health}}1{{else}}0{{end}}' "$web_id")"

env_value() {
  local id="$1" key="$2"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$id" \
    | awk -F= -v key="$key" '$1==key {sub(/^[^=]*=/, ""); print; found=1} END {if (!found) exit 3}'
}

active_reference="$(env_value "$web_id" POSTHOG_PROJECT_REFERENCE 2>/dev/null || true)"
active_region="$(env_value "$web_id" POSTHOG_INGEST_REGION 2>/dev/null || true)"
if [[ -n "$active_reference" || -n "$active_region" ]]; then
  (( override_was_authoritative == 1 )) || fail ACTIVE_POSTHOG_AUTHORITY_UNTRACKED 27
  [[ "$active_reference" == "$project_reference" ]] || fail ACTIVE_POSTHOG_REFERENCE_CONFLICT 28
  [[ "$active_region" == us ]] || fail ACTIVE_POSTHOG_REGION_CONFLICT 29
fi

mapfile -t protected_other_ids < <(docker ps -q --no-trunc | grep -vx "$web_id" | sort)
for id in "${protected_other_ids[@]}"; do
  if docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$id" \
    | grep -Eq '^(POSTHOG_PROJECT_REFERENCE|POSTHOG_INGEST_REGION)='; then
    fail POSTHOG_RUNTIME_LEAKED_TO_NON_WEB_SERVICE 30
  fi
done

if (( override_was_authoritative == 1 )) \
  && [[ "$active_reference" == "$project_reference" && "$active_region" == us ]]; then
  printf 'POSTHOG_RUNTIME_ENV=%s\n' "$runtime_status"
  printf 'POSTHOG_OVERRIDE=%s\n' "$override_status"
  printf 'POSTHOG_REGION=us\n'
  printf 'POSTHOG_WEB_READY=1\n'
  printf 'POSTHOG_WEB_IMAGE_UNCHANGED=1\n'
  printf 'POSTHOG_NON_WEB_UNCHANGED=1\n'
  printf 'PRODUCTION_MUTATION=NONE_ALREADY_READY\n'
  exit 0
fi

rollback_needed=0
rollback_on_exit() {
  local rc=$?
  trap - EXIT INT TERM
  if (( rollback_needed == 1 )); then
    "${dc[@]}" up -d --no-deps --pull never --force-recreate web >/dev/null 2>&1 || true
    (( created_override == 0 )) || rm -f -- "$override_file"
    (( created_runtime == 0 )) || rm -f -- "$runtime_file"
  fi
  exit "$rc"
}
trap rollback_on_exit EXIT INT TERM
rollback_needed=1

"${target_dc[@]}" up -d --no-deps --pull never --force-recreate web

new_web_id=""
new_state=missing
for attempt in $(seq 1 75); do
  mapfile -t new_web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  if (( ${#new_web_ids[@]} == 1 )); then
    new_web_id="${new_web_ids[0]}"
    new_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$new_web_id")"
    if [[ "$original_has_health" == 1 && "$new_state" == healthy ]]; then break; fi
    if [[ "$original_has_health" == 0 && "$new_state" == running ]]; then break; fi
    [[ "$new_state" == unhealthy || "$new_state" == exited || "$new_state" == dead ]] && break
  fi
  sleep 2
done

[[ -n "$new_web_id" ]] || fail WEB_RUNTIME_NOT_FOUND 31
if [[ "$original_has_health" == 1 ]]; then
  [[ "$new_state" == healthy ]] || fail WEB_RUNTIME_NOT_HEALTHY 32
else
  [[ "$new_state" == running ]] || fail WEB_RUNTIME_NOT_RUNNING 33
fi

[[ "$(docker inspect --format '{{.Image}}' "$new_web_id")" == "$image_id" ]] || fail WEB_IMAGE_CHANGED 34
[[ "$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$new_web_id")" == web ]] || fail WEB_SERVICE_LABEL_INVALID 35
[[ "$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$new_web_id")" == "$prod_project" ]] || fail WEB_PROJECT_LABEL_INVALID 36
new_reference="$(env_value "$new_web_id" POSTHOG_PROJECT_REFERENCE 2>/dev/null || true)"
new_region="$(env_value "$new_web_id" POSTHOG_INGEST_REGION 2>/dev/null || true)"
[[ "$new_reference" == "$project_reference" ]] || fail POSTHOG_REFERENCE_NOT_INJECTED 37
[[ "$new_region" == us ]] || fail POSTHOG_REGION_NOT_INJECTED 38
new_config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$new_web_id")"
[[ ",${new_config_files}," == *",${override_file},"* ]] || fail POSTHOG_OVERRIDE_NOT_PERSISTED 39

mapfile -t after_other_ids < <(docker ps -q --no-trunc | grep -vx "$new_web_id" | sort)
[[ "${protected_other_ids[*]}" == "${after_other_ids[*]}" ]] || fail NON_WEB_CONTAINER_CHANGED 40
for id in "${after_other_ids[@]}"; do
  if docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$id" \
    | grep -Eq '^(POSTHOG_PROJECT_REFERENCE|POSTHOG_INGEST_REGION)='; then
    fail POSTHOG_RUNTIME_LEAKED_TO_NON_WEB_SERVICE 41
  fi
done

rollback_needed=0
trap - EXIT INT TERM
unset project_reference active_reference new_reference

printf 'POSTHOG_RUNTIME_ENV=%s\n' "$runtime_status"
printf 'POSTHOG_OVERRIDE=%s\n' "$override_status"
printf 'POSTHOG_REGION=us\n'
printf 'POSTHOG_WEB_READY=1\n'
printf 'POSTHOG_WEB_IMAGE_UNCHANGED=1\n'
printf 'POSTHOG_NON_WEB_UNCHANGED=1\n'
printf 'PRODUCTION_MUTATION=WEB_RECREATE_SAME_IMAGE\n'
