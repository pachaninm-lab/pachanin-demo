#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "$(id -u)" -eq 0 ]] || { echo 'GEKTA_WIRING_ERROR=root_required' >&2; exit 2; }
command -v docker >/dev/null
command -v python3 >/dev/null
command -v sha256sum >/dev/null

EXPECTED_MODEL_BASE='http://192.168.0.206:18080/v1/'
EXPECTED_MODEL='tai-qwen3-8b-q4km'
EXPECTED_OVERRIDE='compose.tai-restricted-qwen.override.yml'

echo 'GEKTA_WIRING_MODE=READ_ONLY'
echo 'GEKTA_WIRING_RUNTIME_MUTATION=NONE'

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#api_ids[@]} == 1 )) || { echo "GEKTA_WIRING_ERROR=api_authority_ambiguous:${#api_ids[@]}" >&2; exit 10; }
(( ${#web_ids[@]} == 1 )) || { echo "GEKTA_WIRING_ERROR=web_authority_ambiguous:${#web_ids[@]}" >&2; exit 11; }
api_id="${api_ids[0]}"
web_id="${web_ids[0]}"

api_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$api_id")"
web_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$api_project" && "$api_project" == "$web_project" ]] || { echo 'GEKTA_WIRING_ERROR=compose_project_mismatch' >&2; exit 12; }

prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
[[ -d "$prod_dir" && -n "$config_files" ]] || { echo 'GEKTA_WIRING_ERROR=compose_authority_missing' >&2; exit 13; }

override="$prod_dir/$EXPECTED_OVERRIDE"
qwen_in_label=0
IFS=',' read -r -a files <<< "$config_files"
for raw in "${files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  if [[ "$file" == "$override" ]]; then qwen_in_label=1; fi
done

override_exists=0
[[ -f "$override" ]] && override_exists=1

api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ ]] || api_revision='unknown'
[[ "$web_revision" =~ ^[0-9a-f]{40}$ ]] || web_revision='unknown'

inspect_env() {
  local container="$1" role="$2" tmp
  tmp="$(mktemp)"
  docker inspect --format '{{json .Config.Env}}' "$container" > "$tmp"
  python3 - "$role" "$EXPECTED_MODEL_BASE" "$EXPECTED_MODEL" "$tmp" <<'PY'
import json
import sys

role, expected_base, expected_model, path = sys.argv[1:]
with open(path, encoding='utf-8') as handle:
    rows = json.load(handle)
env = dict(row.split('=', 1) for row in rows if isinstance(row, str) and '=' in row)

def bit(value: bool) -> int:
    return 1 if value else 0

if role == 'api':
    print(f'GEKTA_WIRING_API_PROVIDER_OK={bit(env.get("AI_ASSISTANT_PROVIDER") == "openai-compatible")}')
    print(f'GEKTA_WIRING_API_BASE_URL_OK={bit(env.get("AI_ASSISTANT_BASE_URL") == expected_base)}')
    print(f'GEKTA_WIRING_API_MODEL_OK={bit(env.get("AI_ASSISTANT_MODEL") == expected_model)}')
    print(f'GEKTA_WIRING_API_PUBLIC_ENABLED={bit(env.get("TAI_RESTRICTED_QWEN_PUBLIC_ENABLED") == "true")}')
    print(f'GEKTA_WIRING_API_KEY_PRESENT={bit(len(env.get("AI_ASSISTANT_API_KEY", "")) >= 32)}')
    print(f'GEKTA_WIRING_API_HMAC_PRESENT={bit(len(env.get("TAI_PUBLIC_GATEWAY_HMAC_SECRET", "")) >= 32)}')
elif role == 'web':
    print(f'GEKTA_WIRING_WEB_PUBLIC_ENABLED={bit(env.get("TAI_RESTRICTED_QWEN_PUBLIC_ENABLED") == "true")}')
    print(f'GEKTA_WIRING_WEB_MODEL_OK={bit(env.get("TAI_RESTRICTED_QWEN_MODEL_IDENTITY") == expected_model)}')
    print(f'GEKTA_WIRING_WEB_HMAC_PRESENT={bit(len(env.get("TAI_PUBLIC_GATEWAY_HMAC_SECRET", "")) >= 32)}')
    print(f'GEKTA_WIRING_WEB_MODEL_KEY_ABSENT={bit(not env.get("AI_ASSISTANT_API_KEY"))}')
else:
    raise SystemExit(3)
PY
  rm -f "$tmp"
}

api_env_report="$(inspect_env "$api_id" api)"
web_env_report="$(inspect_env "$web_id" web)"

api_env_tmp="$(mktemp)"
web_env_tmp="$(mktemp)"
trap 'rm -f "$api_env_tmp" "$web_env_tmp"' EXIT
docker inspect --format '{{json .Config.Env}}' "$api_id" > "$api_env_tmp"
docker inspect --format '{{json .Config.Env}}' "$web_id" > "$web_env_tmp"
hmac_match="$(python3 - "$api_env_tmp" "$web_env_tmp" <<'PY'
import json
import sys

def read(path):
    with open(path, encoding='utf-8') as handle:
        rows = json.load(handle)
    return dict(row.split('=', 1) for row in rows if isinstance(row, str) and '=' in row)

api = read(sys.argv[1])
web = read(sys.argv[2])
a = api.get('TAI_PUBLIC_GATEWAY_HMAC_SECRET', '')
w = web.get('TAI_PUBLIC_GATEWAY_HMAC_SECRET', '')
print(1 if len(a) >= 32 and a == w else 0)
PY
)"
rm -f "$api_env_tmp" "$web_env_tmp"
trap - EXIT

model_health=0
if docker exec -i "$api_id" /nodejs/bin/node - <<'NODE' >/dev/null 2>&1
const base = process.env.AI_ASSISTANT_BASE_URL || '';
const key = process.env.AI_ASSISTANT_API_KEY || '';
if (base !== 'http://192.168.0.206:18080/v1/' || key.length < 32) process.exit(2);
const health = new URL('/health', base);
fetch(health, {
  headers: { Authorization: `Bearer ${key}` },
  signal: AbortSignal.timeout(8000),
}).then((response) => process.exit(response.ok ? 0 : 3)).catch(() => process.exit(4));
NODE
then
  model_health=1
fi

api_ready=0
if docker exec "$api_id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(2))" >/dev/null 2>&1; then
  api_ready=1
fi

web_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$web_id")"
web_healthy=0
[[ "$web_state" == healthy || "$web_state" == running ]] && web_healthy=1

printf 'GEKTA_WIRING_API_REVISION=%s\n' "$api_revision"
printf 'GEKTA_WIRING_WEB_REVISION=%s\n' "$web_revision"
printf 'GEKTA_WIRING_COMPOSE_PROJECT_MATCH=1\n'
printf 'GEKTA_WIRING_QWEN_OVERRIDE_IN_CONFIG_FILES=%s\n' "$qwen_in_label"
printf 'GEKTA_WIRING_QWEN_OVERRIDE_FILE_EXISTS=%s\n' "$override_exists"
printf '%s\n' "$api_env_report"
printf '%s\n' "$web_env_report"
printf 'GEKTA_WIRING_HMAC_MATCH=%s\n' "$hmac_match"
printf 'GEKTA_WIRING_API_MODEL_HEALTH_REACHABLE=%s\n' "$model_health"
printf 'GEKTA_WIRING_API_READY=%s\n' "$api_ready"
printf 'GEKTA_WIRING_WEB_HEALTHY=%s\n' "$web_healthy"
printf 'GEKTA_WIRING_CONFIG_FILES_SHA256=%s\n' "$(printf '%s' "$config_files" | sha256sum | awk '{print $1}')"
printf 'GEKTA_WIRING_PROD_DIR_SHA256=%s\n' "$(printf '%s' "$prod_dir" | sha256sum | awk '{print $1}')"

echo 'GEKTA_WIRING_DIAGNOSTIC=COMPLETE'
