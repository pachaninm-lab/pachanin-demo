#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

export PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
unset BASH_ENV ENV CDPATH GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 SSH_AUTH_SOCK

readonly REPOSITORY_URL='https://github.com/pachaninm-lab/pachanin-demo.git'
readonly REPOSITORY_ROOT='/var/lib/pc-release-authority/repository'
readonly STATE_ROOT='/var/lib/pc-release-authority'
readonly INPUT_ROOT='/var/lib/pc-release-authority/runner-input'
readonly OUTPUT_ROOT='/var/lib/pc-release-authority/runner-output'
readonly MODEL_HOST='192.168.0.206'
readonly MODEL_PORT='18080'
readonly MODEL_IDENTITY='tai-qwen3-8b-q4km'
readonly MODEL_BASE_URL='http://192.168.0.206:18080/v1/'
readonly MODEL_KEY='/etc/pc-release-authority/model_id'
readonly MODEL_KNOWN_HOSTS='/etc/pc-release-authority/model_known_hosts'
readonly CONTROLLER_LOCK='/run/lock/pc-tai-release-controller.lock'

fail() {
  printf 'ERROR_CODE=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$(id -u)" -eq 0 ]] || fail ROOT_AUTHORITY_REQUIRED 2
[[ "${SUDO_USER:-}" == 'pcactions' ]] || fail CALLER_NOT_AUTHORIZED 3
[[ "${SUDO_COMMAND:-}" == /usr/local/sbin/pc-tai-release-controller* ]] || fail SUDO_COMMAND_NOT_AUTHORIZED 4

exec 9>"$CONTROLLER_LOCK"
flock -n 9 || fail RELEASE_CONTROLLER_BUSY 5

ACTION="${1:-}"
TARGET_SHA="${2:-}"
RUN_ID="${3:-}"
shift $(( $# >= 3 ? 3 : $# ))

[[ "$ACTION" =~ ^(preflight|activate|finalize-activation|deploy)$ ]] || fail INVALID_ACTION 10
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 11
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || fail INVALID_RUN_ID 12

job_state="$STATE_ROOT/controller-jobs/$RUN_ID"
job_input="$INPUT_ROOT/$RUN_ID"
job_output="$OUTPUT_ROOT/$RUN_ID"

prepare_dirs() {
  install -d -m 0700 -o root -g root "$STATE_ROOT/controller-jobs"
  install -d -m 0700 -o root -g root "$job_state"
  install -d -m 0750 -o root -g pcactions "$OUTPUT_ROOT"
  rm -rf "$job_output"
  install -d -m 0750 -o root -g pcactions "$job_output"
}

publish_file() {
  local source="$1" name="$2"
  [[ -f "$source" && ! -L "$source" ]] || fail EVIDENCE_SOURCE_INVALID 13
  install -m 0640 -o root -g pcactions "$source" "$job_output/$name"
}

sync_target() {
  local require_current="${1:-true}"
  install -d -m 0700 -o root -g root "$STATE_ROOT"
  if [[ ! -d "$REPOSITORY_ROOT/.git" ]]; then
    rm -rf "$REPOSITORY_ROOT"
    git clone --filter=blob:none --no-checkout "$REPOSITORY_URL" "$REPOSITORY_ROOT" >/dev/null
  fi
  [[ "$(stat -c '%U:%G:%a' "$REPOSITORY_ROOT")" == root:root:700 ]] || fail PROTECTED_REPOSITORY_PERMISSIONS_INVALID 20
  git -C "$REPOSITORY_ROOT" remote set-url origin "$REPOSITORY_URL"
  [[ "$(git -C "$REPOSITORY_ROOT" remote get-url origin)" == "$REPOSITORY_URL" ]]
  git -C "$REPOSITORY_ROOT" fetch --force --prune --no-tags origin '+refs/heads/main:refs/remotes/origin/main' >/dev/null
  if [[ "$require_current" == true ]]; then
    [[ "$(git -C "$REPOSITORY_ROOT" rev-parse refs/remotes/origin/main)" == "$TARGET_SHA" ]] || fail TARGET_IS_NOT_CURRENT_MAIN 21
  else
    [[ -s "$job_state/target-sha" && "$(cat "$job_state/target-sha")" == "$TARGET_SHA" ]] || fail RELEASE_STATE_TARGET_MISMATCH 25
    git -C "$REPOSITORY_ROOT" fetch --force --no-tags origin "$TARGET_SHA" >/dev/null
  fi
  git -C "$REPOSITORY_ROOT" checkout --force --detach "$TARGET_SHA" >/dev/null
  git -C "$REPOSITORY_ROOT" clean -ffdx >/dev/null
  [[ "$(git -C "$REPOSITORY_ROOT" rev-parse HEAD)" == "$TARGET_SHA" ]] || fail PROTECTED_CHECKOUT_MISMATCH 22
  [[ -z "$(git -C "$REPOSITORY_ROOT" status --porcelain=v1)" ]] || fail PROTECTED_CHECKOUT_DIRTY 23
  for path in \
    scripts/tai-reg-ru-preflight.sh \
    scripts/tai-reg-ru-deploy.sh \
    scripts/production-full-stack-exact-sha.sh \
    scripts/tai-restricted-qwen-reg-ru-activate.sh; do
    [[ -f "$REPOSITORY_ROOT/$path" && ! -L "$REPOSITORY_ROOT/$path" ]] || fail PROTECTED_SCRIPT_INVALID 24
  done
}

validate_ref() {
  local reference="$1" component="$2" short="${TARGET_SHA:0:7}"
  [[ "$reference" == "ghcr.io/pachaninm-lab/grainflow-${component}:sha-${short}" ]] || fail IMAGE_REFERENCE_INVALID 30
}

verify_image() {
  local reference="$1" component="$2" required_user="${3:-}"
  validate_ref "$reference" "$component"
  docker pull "$reference" >/dev/null
  [[ "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$reference")" == "$TARGET_SHA" ]] || fail IMAGE_REVISION_MISMATCH 31
  if [[ -n "$required_user" ]]; then
    [[ "$(docker image inspect --format '{{.Config.User}}' "$reference")" == "$required_user" ]] || fail IMAGE_USER_MISMATCH 32
  fi
}

verify_digest() {
  local reference="$1" expected="$2" actual
  [[ "$expected" =~ ^ghcr[.]io/pachaninm-lab/grainflow-tai@sha256:[0-9a-f]{64}$ ]] || fail IMAGE_DIGEST_INVALID 33
  actual="$(docker image inspect --format '{{ index .RepoDigests 0 }}' "$reference")"
  [[ "$actual" == "$expected" ]] || fail IMAGE_DIGEST_MISMATCH 34
}

validate_report() {
  local path="$1" schema="$2" mutation="$3"
  python3 - "$path" "$schema" "$TARGET_SHA" "$mutation" <<'PY'
import json, sys
path, schema, sha, mutation = sys.argv[1:]
report = json.load(open(path, encoding='utf-8'))
if report.get('schemaVersion') != schema:
    raise SystemExit('schema mismatch')
if report.get('targetSha') != sha:
    raise SystemExit('target mismatch')
if mutation == 'false' and report.get('productionMutationAllowed') is not False:
    raise SystemExit('mutation boundary mismatch')
PY
}

write_failed_preflight() {
  local code="$1" path="$2"
  python3 - "$path" "$TARGET_SHA" "$code" <<'PY'
import json, os, sys
path, sha, code = sys.argv[1:]
payload = {
  'schemaVersion':'tai.reg-ru.preflight.v1',
  'targetSha':sha,
  'mode':'READ_ONLY_PREFLIGHT',
  'productionMutationAllowed':False,
  'checks':[{'code':code,'status':'BLOCKED'}],
  'blockers':[code],
  'passed':False,
}
with open(path,'w',encoding='utf-8') as h:
    json.dump(payload,h,ensure_ascii=True,separators=(',',':')); h.write('\n')
os.chmod(path,0o600)
PY
}

import_model_transport() {
  local input_key="$job_input/model-key" model_user_file="$job_input/model-user" model_port_file="$job_input/model-port"
  local model_user model_ssh_port candidate pub
  if [[ -s "$input_key" ]]; then
    [[ ! -L "$input_key" ]] || fail MODEL_KEY_INPUT_INVALID 40
    candidate="$(mktemp)"; pub="$(mktemp)"
    tr -d '\r' < "$input_key" > "$candidate"
    chmod 0600 "$candidate"
    ssh-keygen -y -P '' -f "$candidate" > "$pub" 2>/dev/null || { rm -f "$candidate" "$pub"; fail MODEL_KEY_INPUT_INVALID 40; }
    install -m 0600 -o root -g root "$candidate" "$MODEL_KEY"
    rm -f "$candidate" "$pub"
  fi
  rm -f "$input_key"
  [[ -s "$MODEL_KEY" && ! -L "$MODEL_KEY" ]] || fail MODEL_KEY_NOT_PROVISIONED 41
  ssh-keygen -y -P '' -f "$MODEL_KEY" >/dev/null 2>&1 || fail MODEL_KEY_INVALID 42
  model_user='root'
  [[ ! -s "$model_user_file" ]] || model_user="$(tr -d '\r\n' < "$model_user_file")"
  model_ssh_port='22'
  [[ ! -s "$model_port_file" ]] || model_ssh_port="$(tr -d '\r\n' < "$model_port_file")"
  rm -f "$model_user_file" "$model_port_file"
  [[ "$model_user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]] || fail MODEL_USER_INVALID 43
  [[ "$model_ssh_port" =~ ^[0-9]+$ ]] && ((model_ssh_port >= 1 && model_ssh_port <= 65535)) || fail MODEL_SSH_PORT_INVALID 44
  [[ -s "$MODEL_KNOWN_HOSTS" && ! -L "$MODEL_KNOWN_HOSTS" ]] || fail MODEL_KNOWN_HOSTS_MISSING 45
  printf '%s\n%s\n' "$model_user" "$model_ssh_port"
}

recover_model_api_key() {
  local model_user="$1" model_ssh_port="$2" remote key
  remote='set -Eeuo pipefail
systemctl is-active --quiet tai-qwen3-8b.service
pid="$(systemctl show tai-qwen3-8b.service --property=MainPID --value)"
[[ "$pid" =~ ^[1-9][0-9]*$ ]]
test -r "/proc/$pid/environ"
mapfile -t keys < <(tr "\0" "\n" < "/proc/$pid/environ" | sed -n "s/^TAI_LLM_API_KEY=//p")
(( ${#keys[@]} == 1 ))
key="${keys[0]}"
test "${#key}" -ge 32
[[ "$key" != *[[:space:]]* ]]
ss -H -ltn | grep -Eq "192[.]168[.]0[.]206:18080[[:space:]]"
! ss -H -ltn | grep -Eq "(^|[[:space:]])(0[.]0[.]0[.]0|[[]::[]]):18080[[:space:]]"
curl -fsS --connect-timeout 3 --max-time 15 -H "Authorization: Bearer $key" http://192.168.0.206:18080/health >/dev/null
printf %s "$key"'
  key="$(ssh -i "$MODEL_KEY" -p "$model_ssh_port" -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile="$MODEL_KNOWN_HOSTS" -o StrictHostKeyChecking=yes "$model_user@$MODEL_HOST" "$remote")"
  [[ ${#key} -ge 32 && "$key" != *[[:space:]]* ]] || fail MODEL_API_KEY_INVALID 46
  printf '%s' "$key"
}

rollback_activation() {
  set +e
  local qwen_state="$STATE_ROOT/tai-qwen-$RUN_ID"
  [[ ! -x "$qwen_state/rollback-qwen-env.sh" ]] || "$qwen_state/rollback-qwen-env.sh"
  [[ ! -f "$STATE_ROOT/full-stack-$RUN_ID.state" ]] || bash "$REPOSITORY_ROOT/scripts/production-full-stack-exact-sha.sh" rollback "$TARGET_SHA" "$RUN_ID"
  touch "$job_state/ROLLED_BACK"
}

run_preflight() {
  [[ $# -eq 2 ]] || fail INVALID_ARGUMENT_COUNT 50
  local image="$1" digest="$2" report="$job_state/preflight.json"
  verify_image "$image" tai '65532:65532'
  verify_digest "$image" "$digest"
  set +e
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$report"
  rc=$?
  set -e
  if (( rc != 0 )); then write_failed_preflight PREFLIGHT_EXECUTION_FAILED "$report"; fi
  validate_report "$report" tai.reg-ru.preflight.v1 false
  publish_file "$report" preflight.json
}

run_activate() {
  [[ $# -eq 3 ]] || fail INVALID_ARGUMENT_COUNT 60
  local api_image="$1" web_image="$2" migration_image="$3" model_user model_ssh_port api_key hmac_secret
  local api_env="/tmp/tai-qwen-api-$RUN_ID.env" web_env="/tmp/tai-qwen-web-$RUN_ID.env" evidence
  verify_image "$api_image" api
  verify_image "$web_image" web
  verify_image "$migration_image" migration
  readarray -t transport < <(import_model_transport)
  model_user="${transport[0]}"; model_ssh_port="${transport[1]}"
  api_key="$(recover_model_api_key "$model_user" "$model_ssh_port")"
  hmac_secret="$(openssl rand -hex 32)"
  cat > "$api_env" <<ENV
AI_ASSISTANT_PROVIDER=openai-compatible
AI_ASSISTANT_BASE_URL=$MODEL_BASE_URL
AI_ASSISTANT_MODEL=$MODEL_IDENTITY
AI_ASSISTANT_API_KEY=$api_key
AI_ASSISTANT_ALLOWED_HOSTS=$MODEL_HOST
TAI_RESTRICTED_QWEN_PUBLIC_ENABLED=true
TAI_PUBLIC_GATEWAY_HMAC_SECRET=$hmac_secret
ENV
  cat > "$web_env" <<ENV
TAI_RESTRICTED_QWEN_PUBLIC_ENABLED=true
TAI_RESTRICTED_QWEN_MODEL_IDENTITY=$MODEL_IDENTITY
TAI_PUBLIC_GATEWAY_HMAC_SECRET=$hmac_secret
TAI_INTERNAL_API_BASE_URL=http://api:3001/api/
TAI_INTERNAL_API_ALLOWED_HOSTS=api
TAI_PUBLIC_MODEL_TIMEOUT_MS=130000
NEXT_PUBLIC_SITE_URL=https://процент-агро.рф
ENV
  chmod 0600 "$api_env" "$web_env"
  trap 'rollback_activation; rm -f "$api_env" "$web_env"' ERR INT TERM
  PC_API_IMAGE="$api_image" PC_WEB_IMAGE="$web_image" PC_MIGRATION_IMAGE="$migration_image" \
    bash "$REPOSITORY_ROOT/scripts/production-full-stack-exact-sha.sh" deploy "$TARGET_SHA" "$RUN_ID" > "$job_state/full-stack.log" 2>&1
  grep -Fxq 'DEPLOYMENT_COMPLETE=1' "$job_state/full-stack.log" || fail FULL_STACK_DEPLOYMENT_INCOMPLETE 61
  bash "$REPOSITORY_ROOT/scripts/tai-restricted-qwen-reg-ru-activate.sh" "$TARGET_SHA" "$RUN_ID" "$api_env" "$web_env" > "$job_state/activation.log" 2>&1
  grep -Fxq 'RESTRICTED_QWEN_PRODUCTION_ENV=ACTIVE' "$job_state/activation.log" || fail QWEN_ACTIVATION_INCOMPLETE 62
  evidence="$STATE_ROOT/tai-qwen-$RUN_ID/evidence.json"
  [[ -s "$evidence" ]] || fail ACTIVATION_EVIDENCE_MISSING 63
  publish_file "$evidence" activation.json
  printf '%s\n' "$TARGET_SHA" > "$job_state/target-sha"
  printf '%s\n' "$TARGET_SHA" > "$job_state/PENDING_UI_ACCEPTANCE"
  rm -f "$api_env" "$web_env"
  trap - ERR INT TERM
}

finalize_activation() {
  [[ $# -eq 1 ]] || fail INVALID_ARGUMENT_COUNT 70
  local decision="$1" evidence="$STATE_ROOT/tai-qwen-$RUN_ID/evidence.json"
  [[ "$decision" =~ ^(accept|rollback)$ ]] || fail INVALID_FINALIZE_DECISION 71
  if [[ "$decision" == rollback ]]; then
    rollback_activation
    printf '{"schemaVersion":"tai.restricted-qwen.finalization.v1","targetSha":"%s","decision":"ROLLBACK","passed":false}\n' "$TARGET_SHA" > "$job_state/finalization.json"
  else
    [[ -s "$job_state/PENDING_UI_ACCEPTANCE" && -s "$evidence" ]] || fail PENDING_ACTIVATION_NOT_FOUND 72
    python3 - "$evidence" "$TARGET_SHA" <<'PY'
import json,sys
r=json.load(open(sys.argv[1],encoding='utf-8'))
assert r.get('targetSha')==sys.argv[2] and r.get('passed') is True
assert r.get('productionInboundSshUsed') is False and r.get('publicModelPortPublished') is False
PY
    touch "$STATE_ROOT/tai-qwen-$RUN_ID/FINAL_ACCEPTED"
    printf '{"schemaVersion":"tai.restricted-qwen.finalization.v1","targetSha":"%s","decision":"ACCEPT","passed":true}\n' "$TARGET_SHA" > "$job_state/finalization.json"
  fi
  publish_file "$job_state/finalization.json" finalization.json
}

recover_local_model_token() {
  local api_id key base model
  mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
  (( ${#api_ids[@]} == 1 )) || fail API_RUNTIME_AMBIGUOUS 80
  api_id="${api_ids[0]}"
  key="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api_id" | sed -n 's/^AI_ASSISTANT_API_KEY=//p')"
  base="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api_id" | sed -n 's/^AI_ASSISTANT_BASE_URL=//p')"
  model="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api_id" | sed -n 's/^AI_ASSISTANT_MODEL=//p')"
  [[ ${#key} -ge 32 && "$key" != *[[:space:]]* ]] || fail ACTIVE_MODEL_TOKEN_INVALID 81
  [[ "$base" == "$MODEL_BASE_URL" && "$model" == "$MODEL_IDENTITY" ]] || fail ACTIVE_MODEL_IDENTITY_INVALID 82
  curl -fsS --connect-timeout 3 --max-time 15 -H "Authorization: Bearer $key" "http://$MODEL_HOST:$MODEL_PORT/health" >/dev/null
  printf '%s' "$key"
}

run_deploy() {
  [[ $# -eq 2 ]] || fail INVALID_ARGUMENT_COUNT 90
  local image="$1" digest="$2" pre="$job_state/predeploy.json" post="$job_state/postdeploy.json" token_file="/tmp/tai-model-token-$RUN_ID" evidence
  verify_image "$image" tai '65532:65532'
  verify_digest "$image" "$digest"
  trap 'state="$STATE_ROOT/tai-agro-os-$RUN_ID"; [[ ! -x "$state/rollback.sh" ]] || "$state/rollback.sh"; rm -f "$token_file"' ERR INT TERM
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$pre"
  python3 - "$pre" <<'PY'
import json,sys
r=json.load(open(sys.argv[1],encoding='utf-8'))
allowed={'TAI_SERVICE_NOT_MATERIALIZED','TAI_DEDICATED_ENV_NOT_MATERIALIZED','TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED'}
blockers=set(r.get('blockers') or [])
if not blockers.issubset(allowed): raise SystemExit(f'unexpected blockers: {sorted(blockers)}')
PY
  recover_local_model_token > "$token_file"; chmod 0600 "$token_file"
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-deploy.sh" "$TARGET_SHA" "$image" "$digest" "$RUN_ID" "$token_file" > "$job_state/deploy.log" 2>&1
  grep -Fxq 'TAI_REG_RU_DEPLOYMENT_COMPLETE=1' "$job_state/deploy.log" || fail TAI_DEPLOYMENT_INCOMPLETE 91
  rm -f "$token_file"
  evidence="$STATE_ROOT/tai-agro-os-$RUN_ID/evidence.json"
  [[ -s "$evidence" ]] || fail TAI_DEPLOYMENT_EVIDENCE_MISSING 92
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$post"
  python3 - "$post" <<'PY'
import json,sys
r=json.load(open(sys.argv[1],encoding='utf-8'))
if r.get('passed') is not True or r.get('blockers'): raise SystemExit(f'postflight blocked: {r.get("blockers")}')
PY
  publish_file "$pre" predeploy.json
  publish_file "$evidence" deployment.json
  publish_file "$post" postdeploy.json
  trap - ERR INT TERM
}

prepare_dirs
if [[ "$ACTION" == finalize-activation ]]; then sync_target false; else sync_target true; fi
case "$ACTION" in
  preflight) run_preflight "$@" ;;
  activate) run_activate "$@" ;;
  finalize-activation) finalize_activation "$@" ;;
  deploy) run_deploy "$@" ;;
esac
rm -rf "$job_input"
printf 'PC_TAI_RELEASE_CONTROLLER=PASS\n'
printf 'ACTION=%s\n' "$ACTION"
printf 'TARGET_SHA=%s\n' "$TARGET_SHA"
printf 'OUTPUT_DIR=%s\n' "$job_output"
