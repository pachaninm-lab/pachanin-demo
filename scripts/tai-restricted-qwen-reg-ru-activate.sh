#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
API_ENV_SOURCE="${3:-}"
WEB_ENV_SOURCE="${4:-}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo INVALID_TARGET_SHA >&2; exit 2; }
[[ "$RUN_ID" =~ ^[0-9]+$ ]] || { echo INVALID_RUN_ID >&2; exit 2; }
[[ "$API_ENV_SOURCE" == "/tmp/tai-qwen-api-${RUN_ID}.env" && -s "$API_ENV_SOURCE" ]] || { echo API_ENV_SOURCE_INVALID >&2; exit 2; }
[[ "$WEB_ENV_SOURCE" == "/tmp/tai-qwen-web-${RUN_ID}.env" && -s "$WEB_ENV_SOURCE" ]] || { echo WEB_ENV_SOURCE_INVALID >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo ROOT_AUTHORITY_REQUIRED >&2; exit 2; }
umask 077

MODEL_IP="192.168.0.206"
MODEL_PORT="18080"
STATE_ROOT="/var/lib/pc-release-authority/tai-qwen-${RUN_ID}"
API_ENV_TARGET="/etc/transparent-price/tai-qwen-api.env"
WEB_ENV_TARGET="/etc/transparent-price/tai-qwen-web.env"
OVERRIDE=""
DC_BASE=()
DC_QWEN=()
MUTATION_STARTED=0

restore_file() {
  local target="$1" base
  base="$(basename "$target")"
  if [[ -f "$STATE_ROOT/${base}.before" ]]; then
    install -m 0600 -o root -g root "$STATE_ROOT/${base}.before" "$target"
  elif [[ -f "$STATE_ROOT/${base}.absent" ]]; then
    rm -f "$target"
  else
    echo "ROLLBACK_SNAPSHOT_MISSING:$base" >&2
    return 1
  fi
}

backup_file() {
  local target="$1" base
  base="$(basename "$target")"
  rm -f "$STATE_ROOT/${base}.before" "$STATE_ROOT/${base}.absent"
  if [[ -f "$target" ]]; then
    cp -a "$target" "$STATE_ROOT/${base}.before"
  else
    : > "$STATE_ROOT/${base}.absent"
  fi
}

wait_runtime() {
  local dc_name="$1" api_id web_id state
  for attempt in $(seq 1 60); do
    api_id="$("${DC_QWEN[@]}" ps -q api | head -1)"
    web_id="$("${DC_QWEN[@]}" ps -q web | head -1)"
    if [[ -n "$api_id" && -n "$web_id" ]]; then
      if docker exec "$api_id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then
        state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$web_id" 2>/dev/null || true)"
        [[ "$state" == healthy ]] && return 0
      fi
    fi
    sleep 4
  done
  echo "RUNTIME_HEALTH_TIMEOUT:$dc_name" >&2
  return 1
}

rollback_now() {
  local rc="${1:-1}"
  set +e
  if (( MUTATION_STARTED == 1 )); then
    restore_file "$API_ENV_TARGET"
    restore_file "$WEB_ENV_TARGET"
    restore_file "$OVERRIDE"
    restored=("${DC_BASE[@]}")
    [[ ! -f "$OVERRIDE" ]] || restored+=(-f "$OVERRIDE")
    "${restored[@]}" config --quiet
    "${restored[@]}" up -d --no-deps --pull never api web
    rm -f "$STATE_ROOT/MUTATION_STARTED"
    touch "$STATE_ROOT/ROLLED_BACK"
  else
    rm -rf "$STATE_ROOT"
  fi
  rm -f "$API_ENV_SOURCE" "$WEB_ENV_SOURCE"
  echo QWEN_ENV_ROLLBACK_COMPLETE=1 >&2
  exit "$rc"
}
trap 'rollback_now $?' ERR INT TERM

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || { echo COMPOSE_WEB_AUTHORITY_AMBIGUOUS >&2; exit 10; }
web_id="${web_ids[0]}"
prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
prod_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -d "$prod_dir" && -n "$prod_files" && -n "$prod_project" ]]
OVERRIDE="$prod_dir/compose.tai-restricted-qwen.override.yml"

IFS=',' read -r -a raw_files <<< "$prod_files"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ "$file" == "$OVERRIDE" ]] || compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 ))
for file in "${compose_files[@]}"; do [[ -f "$file" ]]; done

DC_BASE=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do DC_BASE+=(-f "$file"); done
"${DC_BASE[@]}" config --quiet
api_id="$("${DC_BASE[@]}" ps -q api | head -1)"
web_id="$("${DC_BASE[@]}" ps -q web | head -1)"
[[ -n "$api_id" && -n "$web_id" ]]
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")" == "$TARGET_SHA" ]]
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")" == "$TARGET_SHA" ]]

install -d -m 0700 "$STATE_ROOT" /etc/transparent-price
backup_file "$API_ENV_TARGET"
backup_file "$WEB_ENV_TARGET"
backup_file "$OVERRIDE"

touch "$STATE_ROOT/MUTATION_STARTED"
MUTATION_STARTED=1
install -m 0600 -o root -g root "$API_ENV_SOURCE" "$API_ENV_TARGET"
install -m 0600 -o root -g root "$WEB_ENV_SOURCE" "$WEB_ENV_TARGET"
rm -f "$API_ENV_SOURCE" "$WEB_ENV_SOURCE"

cat > "$OVERRIDE.tmp" <<'YAML'
services:
  api:
    env_file:
      - /etc/transparent-price/tai-qwen-api.env
  web:
    env_file:
      - /etc/transparent-price/tai-qwen-web.env
YAML
mv "$OVERRIDE.tmp" "$OVERRIDE"
chmod 0600 "$OVERRIDE"

DC_QWEN=("${DC_BASE[@]}" -f "$OVERRIDE")
"${DC_QWEN[@]}" config --quiet
"${DC_QWEN[@]}" up -d --no-deps --pull never api web
wait_runtime qwen

api_id="$("${DC_QWEN[@]}" ps -q api | head -1)"
web_id="$("${DC_QWEN[@]}" ps -q web | head -1)"
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")" == "$TARGET_SHA" ]]
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")" == "$TARGET_SHA" ]]

api_env_json="$(mktemp)"
web_env_json="$(mktemp)"
docker inspect --format '{{json .Config.Env}}' "$api_id" > "$api_env_json"
docker inspect --format '{{json .Config.Env}}' "$web_id" > "$web_env_json"
python3 - "$api_env_json" "$web_env_json" <<'PY'
import json, sys
def env(path):
    rows = json.load(open(path, encoding='utf-8'))
    return dict(row.split('=', 1) for row in rows if '=' in row)
api = env(sys.argv[1]); web = env(sys.argv[2])
assert api.get('AI_ASSISTANT_PROVIDER') == 'openai-compatible'
assert api.get('AI_ASSISTANT_BASE_URL') == 'http://192.168.0.206:18080/v1/'
assert api.get('AI_ASSISTANT_MODEL') == 'tai-qwen3-8b-q4km'
assert api.get('TAI_RESTRICTED_QWEN_PUBLIC_ENABLED') == 'true'
assert len(api.get('AI_ASSISTANT_API_KEY', '')) >= 32
assert len(api.get('TAI_PUBLIC_GATEWAY_HMAC_SECRET', '')) >= 32
assert web.get('TAI_RESTRICTED_QWEN_PUBLIC_ENABLED') == 'true'
assert web.get('TAI_RESTRICTED_QWEN_MODEL_IDENTITY') == 'tai-qwen3-8b-q4km'
assert len(web.get('TAI_PUBLIC_GATEWAY_HMAC_SECRET', '')) >= 32
assert not web.get('AI_ASSISTANT_API_KEY')
assert api['TAI_PUBLIC_GATEWAY_HMAC_SECRET'] == web['TAI_PUBLIC_GATEWAY_HMAC_SECRET']
PY
rm -f "$api_env_json" "$web_env_json"

docker exec -i "$api_id" /nodejs/bin/node - <<'NODE'
const base = process.env.AI_ASSISTANT_BASE_URL || '';
const key = process.env.AI_ASSISTANT_API_KEY || '';
if (base !== 'http://192.168.0.206:18080/v1/' || key.length < 32) process.exit(2);
fetch(new URL('/health', base), {headers:{Authorization:`Bearer ${key}`}, signal:AbortSignal.timeout(8000)})
  .then(r => process.exit(r.ok ? 0 : 3)).catch(() => process.exit(4));
NODE

cat > "$STATE_ROOT/rollback-qwen-env.sh" <<ROLLBACK
#!/usr/bin/env bash
set -Eeuo pipefail
STATE_ROOT='$STATE_ROOT'
API_ENV_TARGET='$API_ENV_TARGET'
WEB_ENV_TARGET='$WEB_ENV_TARGET'
OVERRIDE='$OVERRIDE'
restore_file() {
  local target="\$1" base
  base="\$(basename "\$target")"
  if [[ -f "\$STATE_ROOT/\${base}.before" ]]; then
    install -m 0600 -o root -g root "\$STATE_ROOT/\${base}.before" "\$target"
  elif [[ -f "\$STATE_ROOT/\${base}.absent" ]]; then
    rm -f "\$target"
  else
    exit 71
  fi
}
restore_file "\$API_ENV_TARGET"
restore_file "\$WEB_ENV_TARGET"
restore_file "\$OVERRIDE"
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( \${#web_ids[@]} == 1 ))
web_id="\${web_ids[0]}"
prod_dir="\$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "\$web_id")"
prod_files="\$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "\$web_id")"
prod_project="\$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "\$web_id")"
IFS=',' read -r -a raw_files <<< "\$prod_files"
compose_files=()
for raw in "\${raw_files[@]}"; do
  file="\${raw#"\${raw%%[![:space:]]*}"}"; file="\${file%"\${file##*[![:space:]]}"}"
  [[ -n "\$file" ]] || continue
  [[ "\$file" == /* ]] || file="\$prod_dir/\$file"
  [[ "\$file" == "\$OVERRIDE" ]] || compose_files+=("\$file")
done
dc=(docker compose --project-directory "\$prod_dir" --project-name "\$prod_project")
for file in "\${compose_files[@]}"; do dc+=(-f "\$file"); done
[[ ! -f "\$OVERRIDE" ]] || dc+=(-f "\$OVERRIDE")
"\${dc[@]}" config --quiet
"\${dc[@]}" up -d --no-deps --pull never api web
rm -f "\$STATE_ROOT/MUTATION_STARTED"
touch "\$STATE_ROOT/ROLLED_BACK"
echo QWEN_ENV_ROLLBACK_COMPLETE=1
ROLLBACK
chmod 0700 "$STATE_ROOT/rollback-qwen-env.sh"

python3 - "$STATE_ROOT/evidence.json" "$TARGET_SHA" "$RUN_ID" <<'PY'
import json, os, sys, tempfile
path, target, run_id = sys.argv[1:]
payload = {
    'schemaVersion': 'tai.restricted-qwen.activation.v1',
    'targetSha': target,
    'runId': run_id,
    'modelIdentity': 'tai-qwen3-8b-q4km',
    'modelTransport': 'PRIVATE_REG_RU_NETWORK',
    'publicModelPortPublished': False,
    'productionInboundSshUsed': False,
    'apiWebExactMain': True,
    'pendingHostedAcceptance': True,
    'passed': True,
}
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix='.evidence.', text=True)
try:
    with os.fdopen(fd, 'w', encoding='utf-8') as h:
        json.dump(payload, h, ensure_ascii=True, separators=(',', ':')); h.write('\n'); h.flush(); os.fsync(h.fileno())
    os.chmod(tmp, 0o600); os.replace(tmp, path)
finally:
    if os.path.exists(tmp): os.unlink(tmp)
PY

rm -f "$STATE_ROOT/MUTATION_STARTED"
touch "$STATE_ROOT/PENDING_ACCEPTANCE"
MUTATION_STARTED=0
trap - ERR INT TERM

echo RESTRICTED_QWEN_PRODUCTION_ENV=ACTIVE
echo "DEPLOYED_EXACT_SHA=$TARGET_SHA"
echo "ACTIVATION_EVIDENCE=$STATE_ROOT/evidence.json"
