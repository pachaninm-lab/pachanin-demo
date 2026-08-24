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
readonly INSTALLED_CONTROLLER='/usr/local/sbin/pc-tai-release-controller'

ACTIVATION_MUTATION_STARTED=0
ACTIVATION_COMPLETE=0
ACTIVATION_API_ENV=''
ACTIVATION_WEB_ENV=''
DEPLOY_MUTATION_STARTED=0
DEPLOY_COMPLETE=0
DEPLOY_TOKEN_FILE=''
DEPLOY_MODEL_EVIDENCE=''
DEPLOY_STATE=''

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

validate_job_input() {
  [[ -d "$job_input" && ! -L "$job_input" ]] || fail RUNNER_INPUT_DIRECTORY_INVALID 14
  [[ "$(stat -c '%U:%G:%a' "$job_input")" == pcactions:pcactions:700 ]] || fail RUNNER_INPUT_DIRECTORY_PERMISSIONS_INVALID 15
  local entry name
  while IFS= read -r -d '' entry; do
    name="${entry##*/}"
    [[ "$name" =~ ^(model-key|model-user|model-port|backup-evidence-path)$ ]] || fail RUNNER_INPUT_NAME_INVALID 16
    [[ -f "$entry" && ! -L "$entry" ]] || fail RUNNER_INPUT_FILE_INVALID 17
    [[ "$(stat -c '%U:%G:%a:%h' "$entry")" == pcactions:pcactions:600:1 ]] || fail RUNNER_INPUT_FILE_PERMISSIONS_INVALID 18
    [[ "$(stat -c '%s' "$entry")" -le 16384 ]] || fail RUNNER_INPUT_FILE_TOO_LARGE 19
  done < <(find "$job_input" -mindepth 1 -maxdepth 1 -print0)
}

sync_target() {
  local require_current="${1:-true}"
  # Must match the wrapper and `restore_runner_boundary`: 0710 root:pcactions.
  # Asserting 0700 root:root here made the controller regress its own boundary
  # mid-run; only the exit trap put it back, so any crash left it broken.
  install -d -m 0710 -o root -g pcactions "$STATE_ROOT"
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
  [[ "$(sha256sum "$INSTALLED_CONTROLLER" | awk '{print $1}')" == "$(sha256sum "$REPOSITORY_ROOT/scripts/pc-tai-release-controller.sh" | awk '{print $1}')" ]] \
    || fail INSTALLED_CONTROLLER_NOT_EXACT_TARGET 26
  for path in \
    scripts/tai-reg-ru-preflight.sh \
    scripts/tai-reg-ru-deploy.sh \
    scripts/tai_model_artifact_evidence.py \
    scripts/production-full-stack-exact-sha.sh \
    scripts/tai-restricted-qwen-reg-ru-activate.sh \
    scripts/pc-p0-staff-api-origin-local-repair.sh; do
    [[ -f "$REPOSITORY_ROOT/$path" && ! -L "$REPOSITORY_ROOT/$path" ]] || fail PROTECTED_SCRIPT_INVALID 24
  done
}

validate_ref() {
  local reference="$1" component="$2" short="${TARGET_SHA:0:7}"
  [[ "$reference" == "ghcr.io/pachaninm-lab/grainflow-${component}:sha-${short}" ]] || fail IMAGE_REFERENCE_INVALID 30
}

validate_digest_ref() {
  local digest="$1" component="$2"
  [[ "$digest" =~ ^ghcr[.]io/pachaninm-lab/grainflow-${component}@sha256:[0-9a-f]{64}$ ]] || fail IMAGE_DIGEST_INVALID 33
}

verify_pinned_image() {
  local reference="$1" digest="$2" component="$3" required_user="${4:-}" revision user
  validate_ref "$reference" "$component"
  validate_digest_ref "$digest" "$component"
  docker pull "$digest" >/dev/null
  revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$digest")"
  [[ "$revision" == "$TARGET_SHA" ]] || fail IMAGE_REVISION_MISMATCH 31
  docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$digest" | grep -Fxq "$digest" || fail IMAGE_DIGEST_MISMATCH 34
  if [[ -n "$required_user" ]]; then
    user="$(docker image inspect --format '{{.Config.User}}' "$digest")"
    [[ "$user" == "$required_user" ]] || fail IMAGE_USER_MISMATCH 32
  fi
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

write_failure_evidence() {
  local action="$1" rc="$2" rollback_status="$3" path="$4" error_code
  error_code="$(
    {
      grep -hE '^ERROR_CODE=[A-Z][A-Z0-9]*_[A-Z0-9_]+$' \
        "$job_state/deploy-stage-error.log" "$job_state/full-stack.log" \
        "$job_state/model-artifact.log" \
        "$job_state/activation.log" "$job_state/deploy.log" \
        "$job_state/rollback.log" "$job_state/deploy-rollback.log" 2>/dev/null \
        | sed -E 's/^ERROR_CODE=//' || true
      grep -hE '^[A-Z][A-Z0-9]*_[A-Z0-9_]+$' \
        "$job_state/deploy.log" "$job_state/deploy-rollback.log" 2>/dev/null || true
    } | tail -1
  )"
  [[ "$error_code" =~ ^[A-Z][A-Z0-9]*_[A-Z0-9_]+$ ]] || error_code="${action^^}_CONTROLLER_FAILED"
  python3 - "$path" "$TARGET_SHA" "$RUN_ID" "$action" "$rc" "$error_code" "$rollback_status" <<'PY'
import json, os, sys
path, sha, run_id, action, rc, code, rollback = sys.argv[1:]
payload = {
  'schemaVersion':'tai.reg-ru.controller-failure.v1',
  'targetSha':sha,
  'runId':run_id,
  'action':action,
  'exitCode':int(rc),
  'errorCode':code,
  'rollbackStatus':rollback,
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

recover_model_artifact_evidence() {
  local model_user="$1" model_ssh_port="$2" output="$3"
  local error_log="$job_state/model-artifact.log" remote
  [[ -s "$MODEL_KEY" && ! -L "$MODEL_KEY" ]] || fail MODEL_KEY_NOT_PROVISIONED 41
  [[ -s "$MODEL_KNOWN_HOSTS" && ! -L "$MODEL_KNOWN_HOSTS" ]] || fail MODEL_KNOWN_HOSTS_MISSING 45
  [[ -f "$REPOSITORY_ROOT/scripts/tai_model_artifact_evidence.py" \
    && ! -L "$REPOSITORY_ROOT/scripts/tai_model_artifact_evidence.py" ]] \
    || fail MODEL_ARTIFACT_EVIDENCE_RESOLVER_INVALID 47

  # The restricted model-host login shell recognizes these exact authority markers
  # and performs its own non-interactive privilege transition. The controller only
  # streams the reviewed resolver to Python and gains no direct host authority.
  remote='set -Eeuo pipefail
service=tai-qwen3-8b.service
env_file=/etc/tai/qwen3-8b.env
private_listener=192.168.0.206:18080
exec python3 -'

  : > "$error_log"
  chmod 0600 "$error_log"
  if ! ssh -i "$MODEL_KEY" -p "$model_ssh_port" -o BatchMode=yes -o IdentitiesOnly=yes \
    -o UserKnownHostsFile="$MODEL_KNOWN_HOSTS" -o StrictHostKeyChecking=yes \
    "$model_user@$MODEL_HOST" "$remote" \
    < "$REPOSITORY_ROOT/scripts/tai_model_artifact_evidence.py" \
    > "$output" 2> "$error_log"; then
    printf 'ERROR_CODE=MODEL_ARTIFACT_EVIDENCE_UNAVAILABLE\n' >> "$error_log"
    fail MODEL_ARTIFACT_EVIDENCE_UNAVAILABLE 48
  fi
  chmod 0600 "$output"
  if ! python3 - "$output" 2>> "$error_log" <<'PY_VALIDATE'
import json, re, sys
value=json.load(open(sys.argv[1],encoding='utf-8'))
assert value.get('schemaVersion') == 'tai.restricted-model-artifact.v1'
assert value.get('modelIdentity') == 'tai-qwen3-8b-q4km'
assert value.get('modelHost') == '192.168.0.206'
assert isinstance(value.get('artifactPath'), str) and value['artifactPath'].startswith('/')
assert re.fullmatch(r'[0-9a-f]{64}', value.get('artifactSha256',''))
assert isinstance(value.get('artifactSizeBytes'), int) and value['artifactSizeBytes'] > 0
assert isinstance(value.get('maximumContextTokens'), int) and 512 <= value['maximumContextTokens'] <= 262144
PY_VALIDATE
  then
    printf 'ERROR_CODE=MODEL_ARTIFACT_EVIDENCE_INVALID\n' >> "$error_log"
    fail MODEL_ARTIFACT_EVIDENCE_INVALID 49
  fi
}

rollback_activation() {
  local qwen_state="$STATE_ROOT/tai-qwen-$RUN_ID" rc=0 attempted=0
  if [[ -x "$qwen_state/rollback-qwen-env.sh" ]]; then
    attempted=1
    "$qwen_state/rollback-qwen-env.sh" > "$job_state/rollback-qwen.log" 2>&1 || rc=1
  fi
  if [[ -f "$STATE_ROOT/full-stack-$RUN_ID.state" ]]; then
    attempted=1
    bash "$REPOSITORY_ROOT/scripts/production-full-stack-exact-sha.sh" rollback "$TARGET_SHA" "$RUN_ID" > "$job_state/rollback.log" 2>&1 || rc=1
  fi
  rm -f "$job_state/ROLLED_BACK" "$job_state/ROLLBACK_FAILED" "$job_state/ROLLBACK_NOT_REQUIRED"
  if (( rc != 0 )); then
    touch "$job_state/ROLLBACK_FAILED"
    return 1
  fi
  if (( attempted == 1 )); then touch "$job_state/ROLLED_BACK"; else touch "$job_state/ROLLBACK_NOT_REQUIRED"; fi
}

run_preflight() {
  [[ $# -eq 2 ]] || fail INVALID_ARGUMENT_COUNT 50
  local image="$1" digest="$2" report="$job_state/preflight.json"
  verify_pinned_image "$image" "$digest" tai '65532:65532'
  set +e
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$report"
  rc=$?
  set -e
  if (( rc != 0 )); then write_failed_preflight PREFLIGHT_EXECUTION_FAILED "$report"; fi
  validate_report "$report" tai.reg-ru.preflight.v1 false
  publish_file "$report" preflight.json
}

run_activate() {
  [[ $# -eq 6 ]] || fail INVALID_ARGUMENT_COUNT 60
  validate_job_input
  local api_image="$1" api_digest="$2" web_image="$3" web_digest="$4" migration_image="$5" migration_digest="$6"
  local api_key hmac_secret backup_evidence evidence
  ACTIVATION_MUTATION_STARTED=0
  ACTIVATION_COMPLETE=0
  ACTIVATION_API_ENV="/tmp/tai-qwen-api-$RUN_ID.env"
  ACTIVATION_WEB_ENV="/tmp/tai-qwen-web-$RUN_ID.env"
  verify_pinned_image "$api_image" "$api_digest" api
  verify_pinned_image "$web_image" "$web_digest" web
  verify_pinned_image "$migration_image" "$migration_digest" migration
  rm -f "$job_input/model-key" "$job_input/model-user" "$job_input/model-port"
  backup_evidence="$(recover_backup_evidence)"
  api_key="$(recover_local_model_token)"
  hmac_secret="$(openssl rand -hex 32)"
  cat > "$ACTIVATION_API_ENV" <<ENV
AI_ASSISTANT_PROVIDER=openai-compatible
AI_ASSISTANT_BASE_URL=$MODEL_BASE_URL
AI_ASSISTANT_MODEL=$MODEL_IDENTITY
AI_ASSISTANT_API_KEY=$api_key
AI_ASSISTANT_ALLOWED_HOSTS=$MODEL_HOST
TAI_RESTRICTED_QWEN_PUBLIC_ENABLED=true
TAI_PUBLIC_GATEWAY_HMAC_SECRET=$hmac_secret
ENV
  cat > "$ACTIVATION_WEB_ENV" <<ENV
TAI_RESTRICTED_QWEN_PUBLIC_ENABLED=true
TAI_RESTRICTED_QWEN_MODEL_IDENTITY=$MODEL_IDENTITY
TAI_PUBLIC_GATEWAY_HMAC_SECRET=$hmac_secret
TAI_INTERNAL_API_BASE_URL=http://api:3001/api/
TAI_INTERNAL_API_ALLOWED_HOSTS=api
TAI_PUBLIC_MODEL_TIMEOUT_MS=130000
NEXT_PUBLIC_SITE_URL=https://процент-агро.рф
ENV
  chmod 0600 "$ACTIVATION_API_ENV" "$ACTIVATION_WEB_ENV"
  activation_exit() {
    local rc="$?" rollback_status='NOT_REQUIRED' failure="$job_state/activation-failure.json"
    trap - EXIT INT TERM
    if (( rc != 0 && ACTIVATION_MUTATION_STARTED == 1 && ACTIVATION_COMPLETE == 0 )); then
      if rollback_activation; then
        if [[ -f "$job_state/ROLLED_BACK" ]]; then rollback_status='CONFIRMED'; else rollback_status='NOT_REQUIRED'; fi
      else
        rollback_status='FAILED'
        rc=74
      fi
    fi
    if (( rc != 0 )); then
      write_failure_evidence activate "$rc" "$rollback_status" "$failure"
      publish_file "$failure" activation.json
    fi
    rm -f "$ACTIVATION_API_ENV" "$ACTIVATION_WEB_ENV"
    exit "$rc"
  }
  trap activation_exit EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  ACTIVATION_MUTATION_STARTED=1
  PC_API_IMAGE="$api_digest" PC_WEB_IMAGE="$web_digest" PC_MIGRATION_IMAGE="$migration_digest" \
  PC_PROD_BACKUP_EVIDENCE_FILE_B64="$(printf '%s' "$backup_evidence" | base64 -w0)" \
    bash "$REPOSITORY_ROOT/scripts/production-full-stack-exact-sha.sh" deploy "$TARGET_SHA" "$RUN_ID" > "$job_state/full-stack.log" 2>&1
  grep -Fxq 'DEPLOYMENT_COMPLETE=1' "$job_state/full-stack.log" || fail FULL_STACK_DEPLOYMENT_INCOMPLETE 61
  bash "$REPOSITORY_ROOT/scripts/tai-restricted-qwen-reg-ru-activate.sh" "$TARGET_SHA" "$RUN_ID" "$ACTIVATION_API_ENV" "$ACTIVATION_WEB_ENV" > "$job_state/activation.log" 2>&1
  grep -Fxq 'RESTRICTED_QWEN_PRODUCTION_ENV=ACTIVE' "$job_state/activation.log" || fail QWEN_ACTIVATION_INCOMPLETE 62
  evidence="$STATE_ROOT/tai-qwen-$RUN_ID/evidence.json"
  [[ -s "$evidence" ]] || fail ACTIVATION_EVIDENCE_MISSING 63
  publish_file "$evidence" activation.json
  printf '%s\n' "$TARGET_SHA" > "$job_state/target-sha"
  printf '%s\n' "$TARGET_SHA" > "$job_state/PENDING_UI_ACCEPTANCE"
  ACTIVATION_COMPLETE=1
  rm -f "$ACTIVATION_API_ENV" "$ACTIVATION_WEB_ENV"
  trap - EXIT INT TERM
}

finalize_activation() {
  [[ $# -eq 1 ]] || fail INVALID_ARGUMENT_COUNT 70
  local decision="$1" evidence="$STATE_ROOT/tai-qwen-$RUN_ID/evidence.json"
  [[ "$decision" =~ ^(accept|rollback)$ ]] || fail INVALID_FINALIZE_DECISION 71
  if [[ "$decision" == accept && "$(git -C "$REPOSITORY_ROOT" rev-parse refs/remotes/origin/main)" != "$TARGET_SHA" ]]; then
    decision=rollback
  fi
  if [[ "$decision" == rollback ]]; then
    if ! rollback_activation; then
      printf '{"schemaVersion":"tai.restricted-qwen.finalization.v1","targetSha":"%s","decision":"ROLLBACK_FAILED","passed":false}\n' "$TARGET_SHA" > "$job_state/finalization.json"
      publish_file "$job_state/finalization.json" finalization.json
      fail ACTIVATION_ROLLBACK_FAILED 74
    fi
    printf '{"schemaVersion":"tai.restricted-qwen.finalization.v1","targetSha":"%s","decision":"ROLLBACK","passed":false}\n' "$TARGET_SHA" > "$job_state/finalization.json"
    publish_file "$job_state/finalization.json" finalization.json
    fail ACTIVATION_ROLLED_BACK 73
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

recover_backup_evidence() {
  local input_path="$job_input/backup-evidence-path" path canonical mode
  [[ -s "$input_path" && ! -L "$input_path" ]] || fail BACKUP_EVIDENCE_INPUT_MISSING 83
  path="$(tr -d '\r\n' < "$input_path")"
  rm -f "$input_path"
  [[ "$path" == /* ]] || fail BACKUP_EVIDENCE_PATH_INVALID 84
  canonical="$(readlink -f -- "$path")"
  [[ -n "$canonical" && "$canonical" == "$path" ]] || fail BACKUP_EVIDENCE_PATH_INVALID 84
  [[ -f "$path" && ! -L "$path" ]] || fail BACKUP_EVIDENCE_FILE_INVALID 85
  mode="$(stat -c '%a' "$path")"
  [[ "$mode" =~ ^(400|440|600|640)$ ]] || fail BACKUP_EVIDENCE_PERMISSIONS_INVALID 86
  grep -Fq 'STATUS=PASS' "$path" || fail BACKUP_EVIDENCE_STATUS_INVALID 87
  printf '%s' "$path"
}

run_docker_headroom_reclaim() {
  [[ $# -eq 1 && "$1" == '--reclaim-docker-headroom-v1' ]] || fail INVALID_DOCKER_RECLAIM_ARGUMENTS 97
  local report="$job_state/docker-reclaim.json" rc=0
  local required_kb=$((5 * 1024 * 1024))
  local target_kb=$((6 * 1024 * 1024))
  [[ -d /var/lib/docker && ! -L /var/lib/docker ]] || fail DOCKER_STORAGE_ROOT_INVALID 97

  set +e
  python3 - "$TARGET_SHA" "$RUN_ID" "$report" "$required_kb" "$target_kb" <<'PY_RECLAIM'
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

target_sha, run_id, report_path, required_raw, target_raw = sys.argv[1:]
required_kb = int(required_raw)
target_kb = int(target_raw)
canonical = re.compile(r'^ghcr[.]io/pachaninm-lab/grainflow-(api|web|migration|tai):[A-Za-z0-9_.-]+$')
image_id_re = re.compile(r'^sha256:[0-9a-f]{64}$')

def command(argv, check=True):
    result = subprocess.run(argv, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode != 0:
        raise RuntimeError(f'command_failed:{argv[0]}:{argv[1] if len(argv) > 1 else ""}')
    return result

def available_kb():
    result = command(['df', '-Pk', '--', '/var/lib/docker'])
    lines = [line.split() for line in result.stdout.splitlines() if line.strip()]
    if len(lines) != 2 or len(lines[1]) < 4 or not lines[1][3].isdigit():
        raise RuntimeError('docker_df_invalid')
    return int(lines[1][3])

def container_image_ids():
    ids = [line.strip() for line in command(['docker', 'ps', '-aq', '--no-trunc']).stdout.splitlines() if line.strip()]
    result = set()
    for container_id in ids:
        data = json.loads(command(['docker', 'inspect', container_id]).stdout)
        if len(data) != 1:
            raise RuntimeError('container_inspect_ambiguous')
        image_id = str(data[0].get('Image') or '')
        if not image_id_re.fullmatch(image_id):
            raise RuntimeError('container_image_id_invalid')
        result.add(image_id)
    return result

def inspect_image(image_id):
    result = command(['docker', 'image', 'inspect', image_id], check=False)
    if result.returncode != 0:
        return None
    data = json.loads(result.stdout)
    if len(data) != 1 or not isinstance(data[0], dict):
        raise RuntimeError('image_inspect_ambiguous')
    return data[0]

def classify_image(item):
    tags = item.get('RepoTags') or []
    if not isinstance(tags, list) or not tags:
        return None
    components = set()
    normalized_tags = []
    for raw in tags:
        if not isinstance(raw, str):
            return None
        match = canonical.fullmatch(raw)
        if not match:
            return None
        components.add(match.group(1))
        normalized_tags.append(raw)
    if len(components) != 1:
        return None
    return next(iter(components)), tuple(sorted(set(normalized_tags)))

before_kb = available_kb()
protected = container_image_ids()
records = []
image_ids = sorted({line.strip() for line in command(['docker', 'image', 'ls', '-q', '--no-trunc']).stdout.splitlines() if line.strip()})
for image_id in image_ids:
    if not image_id_re.fullmatch(image_id):
        continue
    item = inspect_image(image_id)
    if item is None:
        continue
    classification = classify_image(item)
    if classification is None:
        continue
    component, tags = classification
    labels = (item.get('Config') or {}).get('Labels') or {}
    revision = labels.get('org.opencontainers.image.revision') if isinstance(labels, dict) else None
    created = str(item.get('Created') or '')
    if not created:
        continue
    records.append({'id': image_id, 'component': component, 'tags': tags, 'created': created, 'revision': revision})
    if revision == target_sha:
        protected.add(image_id)

by_component = defaultdict(list)
for record in records:
    by_component[record['component']].append(record)
for component_records in by_component.values():
    for record in sorted(component_records, key=lambda row: row['created'], reverse=True)[:2]:
        protected.add(record['id'])

eligible = [record for record in records if record['id'] not in protected]
eligible.sort(key=lambda row: row['created'])
deleted = 0
skipped = 0

for record in eligible:
    if available_kb() >= target_kb:
        break
    current_refs = container_image_ids()
    if record['id'] in current_refs:
        protected.add(record['id'])
        skipped += 1
        continue
    item = inspect_image(record['id'])
    if item is None:
        skipped += 1
        continue
    classification = classify_image(item)
    if classification is None:
        skipped += 1
        continue
    component, tags = classification
    if component != record['component']:
        skipped += 1
        continue
    labels = (item.get('Config') or {}).get('Labels') or {}
    revision = labels.get('org.opencontainers.image.revision') if isinstance(labels, dict) else None
    if revision == target_sha:
        protected.add(record['id'])
        skipped += 1
        continue
    result = command(['docker', 'image', 'rm', *tags], check=False)
    if result.returncode != 0:
        skipped += 1
        continue
    if inspect_image(record['id']) is None:
        deleted += 1
    else:
        skipped += 1

after_kb = available_kb()
reclaimed_bytes = max(0, after_kb - before_kb) * 1024
payload = {
    'schemaVersion': 'pc.reg-ru.docker-reclaim.v1',
    'targetSha': target_sha,
    'runId': int(run_id),
    'mode': 'BOUNDED_UNUSED_CANONICAL_IMAGE_RECLAIM',
    'requiredAvailableKb': required_kb,
    'targetAvailableKb': target_kb,
    'beforeAvailableKb': before_kb,
    'afterAvailableKb': after_kb,
    'eligibleImageCount': len(eligible),
    'protectedImageCount': len(protected),
    'deletedImageCount': deleted,
    'skippedImageCount': skipped,
    'reclaimedBytes': reclaimed_bytes,
    'targetReached': after_kb >= target_kb,
    'passed': after_kb >= required_kb,
}
path = Path(report_path)
path.write_text(json.dumps(payload, ensure_ascii=True, separators=(',', ':')) + '\n', encoding='utf-8')
os.chmod(path, 0o600)
if not payload['passed']:
    raise SystemExit(91)
PY_RECLAIM
  rc=$?
  set -e

  [[ -s "$report" && ! -L "$report" ]] || fail DOCKER_RECLAIM_EVIDENCE_MISSING 97
  python3 - "$report" "$TARGET_SHA" "$required_kb" "$target_kb" <<'PY_VALIDATE_RECLAIM'
import json, sys
path, sha, required_raw, target_raw = sys.argv[1:]
value = json.load(open(path, encoding='utf-8'))
if value.get('schemaVersion') != 'pc.reg-ru.docker-reclaim.v1': raise SystemExit('schema mismatch')
if value.get('targetSha') != sha: raise SystemExit('target mismatch')
if value.get('mode') != 'BOUNDED_UNUSED_CANONICAL_IMAGE_RECLAIM': raise SystemExit('mode mismatch')
if value.get('requiredAvailableKb') != int(required_raw): raise SystemExit('required threshold mismatch')
if value.get('targetAvailableKb') != int(target_raw): raise SystemExit('target threshold mismatch')
for key in ('beforeAvailableKb','afterAvailableKb','eligibleImageCount','protectedImageCount','deletedImageCount','skippedImageCount','reclaimedBytes'):
    if not isinstance(value.get(key), int) or value[key] < 0: raise SystemExit(f'invalid integer field: {key}')
if value.get('targetReached') is not (value['afterAvailableKb'] >= value['targetAvailableKb']): raise SystemExit('targetReached mismatch')
if value.get('passed') is not (value['afterAvailableKb'] >= value['requiredAvailableKb']): raise SystemExit('passed mismatch')
PY_VALIDATE_RECLAIM
  publish_file "$report" docker-reclaim.json
  (( rc == 0 )) || fail DOCKER_RECLAIM_INSUFFICIENT_SAFE_HEADROOM 97
}

run_pc_crop_staff_api_origin_repair() {
  [[ $# -eq 1 && "$1" == '--pc-crop-staff-api-origin-repair-v1' ]] || fail INVALID_PC_CROP_STAFF_API_ORIGIN_REPAIR_ARGUMENTS 98
  local script="$REPOSITORY_ROOT/scripts/pc-p0-staff-api-origin-local-repair.sh"
  local raw="$job_state/staff-api-origin-repair.raw"
  local report="$job_state/staff-api-origin-repair.json"
  local rc=0 evidence_rc=0
  [[ -f "$script" && ! -L "$script" ]] || fail PC_CROP_STAFF_API_ORIGIN_REPAIR_SCRIPT_INVALID 98
  [[ "$(git -C "$REPOSITORY_ROOT" rev-parse HEAD)" == "$TARGET_SHA" ]] || fail PROTECTED_CHECKOUT_MISMATCH 98
  [[ -z "$(git -C "$REPOSITORY_ROOT" status --porcelain=v1)" ]] || fail PROTECTED_CHECKOUT_DIRTY 98

  set +e
  bash "$script" "$TARGET_SHA" "$RUN_ID" > "$raw" 2>/dev/null
  rc=$?
  set -e

  set +e
  python3 - "$raw" "$report" "$TARGET_SHA" "$RUN_ID" "$rc" <<'PY_PC_CROP_REPAIR_EVIDENCE'
import json
import os
import re
import sys
from pathlib import Path

raw_path, report_path, target_sha, run_id_raw, rc_raw = sys.argv[1:]
rc = int(rc_raw)
parse_error = False
allowed_keys = {
    'RESULT','FAIL_STAGE','ROLLBACK','DEPLOYED_SHA','ACTIVE_BEFORE','COMPOSE_BEFORE',
    'REPAIR_MODE','ACTIVE_AFTER','AUTH_STATUS','CAP_STATUS','IMAGE_UNCHANGED','API_UNCHANGED',
    'NONWEB_UNCHANGED','REVISION_UNCHANGED','PRODUCTION_MUTATION',
}
values = {}
try:
    raw = Path(raw_path).read_text(encoding='utf-8')
except Exception:
    raw = ''
    parse_error = True
if len(raw.encode('utf-8', errors='ignore')) > 32768 or '\x00' in raw or '\r' in raw:
    parse_error = True
    raw = ''
for line in raw.splitlines():
    if not line:
        continue
    key, sep, value = line.partition('=')
    if not sep or key not in allowed_keys or key in values:
        parse_error = True
        continue
    if len(value) > 128 or any(ord(ch) < 32 or ord(ch) > 126 for ch in value):
        parse_error = True
        continue
    values[key] = value

origin_classes = {
    'NOT_EVALUATED','UNSET','CANONICAL','ACCEPTED_HTTPS','INVALID_PARSE','INVALID_SCHEME',
    'INVALID_COMPONENTS','INVALID_HTTP_AUTHORITY','INVALID_HTTP_PATH',
}
repair_modes = {'NOT_EVALUATED','NONE_REQUIRED','OVERRIDE_CREATED','OVERRIDE_PRESENT_RECREATE'}
probe_states = {'NOT_EVALUATED','401','TIMEOUT','FETCH_ERROR'}
unchanged_states = {'PASS','NOT_ATTESTED'}
rollback_states = {'NOT_REQUIRED','CONFIRMED','FAILED'}
mutation_states = {
    'NONE','WEB_ONLY_API_ORIGIN_OVERRIDE_AND_RECREATE','NONE_OR_ROLLED_BACK',
    'UNKNOWN_REQUIRES_OPERATOR_REVIEW',
}
result_states = {'PASS_ALREADY_CANONICAL','PASS_REPAIRED','FAIL_CLOSED'}

def pick(key, allowed, default):
    global parse_error
    value = values.get(key, default)
    if value not in allowed:
        parse_error = True
        return default
    return value

result = pick('RESULT', result_states, 'FAIL_CLOSED')
deployed = values.get('DEPLOYED_SHA', 'UNKNOWN')
if deployed != 'UNKNOWN' and not re.fullmatch(r'[0-9a-f]{40}', deployed):
    deployed = 'UNKNOWN'
    parse_error = True
active_before = pick('ACTIVE_BEFORE', origin_classes, 'NOT_EVALUATED')
compose_before = pick('COMPOSE_BEFORE', origin_classes, 'NOT_EVALUATED')
repair_mode = pick('REPAIR_MODE', repair_modes, 'NOT_EVALUATED')
active_after = pick('ACTIVE_AFTER', origin_classes, 'NOT_EVALUATED')
auth_status = pick('AUTH_STATUS', probe_states, 'NOT_EVALUATED')
cap_status = pick('CAP_STATUS', probe_states, 'NOT_EVALUATED')
image_unchanged = pick('IMAGE_UNCHANGED', unchanged_states, 'NOT_ATTESTED')
api_unchanged = pick('API_UNCHANGED', unchanged_states, 'NOT_ATTESTED')
nonweb_unchanged = pick('NONWEB_UNCHANGED', unchanged_states, 'NOT_ATTESTED')
revision_unchanged = pick('REVISION_UNCHANGED', unchanged_states, 'NOT_ATTESTED')
rollback = pick('ROLLBACK', rollback_states, 'NOT_REQUIRED')
mutation = pick('PRODUCTION_MUTATION', mutation_states, 'UNKNOWN_REQUIRES_OPERATOR_REVIEW' if rc else 'NONE')
fail_stage = values.get('FAIL_STAGE', 'NONE' if rc == 0 else 'UNKNOWN')
if not re.fullmatch(r'(?:NONE|UNKNOWN|[A-Z][A-Z0-9_]{0,63})', fail_stage):
    fail_stage = 'UNKNOWN'
    parse_error = True

success_common = (
    deployed != 'UNKNOWN' and auth_status == '401' and cap_status == '401' and
    image_unchanged == api_unchanged == nonweb_unchanged == revision_unchanged == 'PASS' and
    rollback == 'NOT_REQUIRED' and fail_stage == 'NONE'
)
if result == 'PASS_ALREADY_CANONICAL':
    success_shape = (
        active_before in {'UNSET','CANONICAL'} and active_after == active_before and
        repair_mode == 'NONE_REQUIRED' and mutation == 'NONE'
    )
elif result == 'PASS_REPAIRED':
    success_shape = (
        active_before.startswith('INVALID_') and active_after == 'CANONICAL' and
        repair_mode in {'OVERRIDE_CREATED','OVERRIDE_PRESENT_RECREATE'} and
        mutation == 'WEB_ONLY_API_ORIGIN_OVERRIDE_AND_RECREATE'
    )
else:
    success_shape = False
passed = rc == 0 and not parse_error and success_common and success_shape
if rc == 0 and not passed:
    parse_error = True
    result = 'FAIL_CLOSED'
    fail_stage = 'EVIDENCE_CONTRACT_INVALID'
    mutation = 'UNKNOWN_REQUIRES_OPERATOR_REVIEW'

payload = {
    'schemaVersion':'pc-crop.staff-api-origin-local-repair.v1',
    'targetSha':target_sha,
    'deployedRevision':deployed,
    'result':result,
    'activeBefore':active_before,
    'composeBefore':compose_before,
    'repairMode':repair_mode,
    'activeAfter':active_after,
    'authStatus':auth_status,
    'capStatus':cap_status,
    'webImageUnchanged':image_unchanged == 'PASS',
    'apiContainerUnchanged':api_unchanged == 'PASS',
    'nonWebContainersUnchanged':nonweb_unchanged == 'PASS',
    'revisionUnchanged':revision_unchanged == 'PASS',
    'failStage':fail_stage,
    'rollback':rollback,
    'productionMutation':mutation,
    'newRecurringCostRub':0,
    'passed':passed,
}
path = Path(report_path)
path.write_text(json.dumps(payload, ensure_ascii=True, separators=(',', ':')) + '\n', encoding='utf-8')
os.chmod(path, 0o600)
raise SystemExit(2 if parse_error else 0)
PY_PC_CROP_REPAIR_EVIDENCE
  evidence_rc=$?
  set -e

  rm -f "$raw"
  [[ -s "$report" && ! -L "$report" ]] || fail PC_CROP_STAFF_API_ORIGIN_REPAIR_EVIDENCE_MISSING 98
  publish_file "$report" staff-api-origin-repair.json
  if (( rc != 0 || evidence_rc != 0 )); then
    fail PC_CROP_STAFF_API_ORIGIN_REPAIR_FAILED 98
  fi
}

set_deploy_failure_stage() {
  local code="$1" stage_file="$job_state/deploy-stage-error.log"
  [[ "$code" =~ ^[A-Z][A-Z0-9]*_[A-Z0-9_]+$ ]] || fail DEPLOY_STAGE_CODE_INVALID 96
  printf 'ERROR_CODE=%s\n' "$code" > "$stage_file"
  chmod 0600 "$stage_file"
}

clear_deploy_failure_stage() {
  rm -f "$job_state/deploy-stage-error.log"
}

run_deploy() {
  [[ $# -eq 2 ]] || fail INVALID_ARGUMENT_COUNT 90
  local image="$1" digest="$2" pre="$job_state/predeploy.json" post="$job_state/postdeploy.json" evidence
  local model_user model_ssh_port
  DEPLOY_TOKEN_FILE="/tmp/tai-model-token-$RUN_ID"
  DEPLOY_STATE="$STATE_ROOT/tai-agro-os-$RUN_ID"
  DEPLOY_MUTATION_STARTED=0
  DEPLOY_COMPLETE=0
  verify_pinned_image "$image" "$digest" tai '65532:65532'
  validate_job_input
  mapfile -t model_transport < <(import_model_transport)
  (( ${#model_transport[@]} == 2 )) || fail MODEL_TRANSPORT_INVALID 95
  model_user="${model_transport[0]}"
  model_ssh_port="${model_transport[1]}"
  DEPLOY_MODEL_EVIDENCE="$job_state/model-artifact.json"
  deploy_exit() {
    local rc="$?" rollback_status='NOT_REQUIRED' failure="$job_state/deployment-failure.json"
    trap - EXIT INT TERM
    if (( rc != 0 && DEPLOY_MUTATION_STARTED == 1 && DEPLOY_COMPLETE == 0 )); then
      if [[ ! -f "$DEPLOY_STATE/ROLLED_BACK" && -x "$DEPLOY_STATE/rollback.sh" ]]; then
        if "$DEPLOY_STATE/rollback.sh" > "$job_state/deploy-rollback.log" 2>&1; then rollback_status='CONFIRMED'; else rollback_status='FAILED'; rc=93; fi
      fi
      if [[ -f "$DEPLOY_STATE/MUTATION_STARTED" && ! -f "$DEPLOY_STATE/ROLLED_BACK" ]]; then
        rollback_status='FAILED'
        rc=94
        printf 'ERROR_CODE=INCOMPLETE_DEPLOYMENT_ROLLBACK_AUTHORITY\n' >> "$job_state/deploy.log"
      elif [[ -f "$DEPLOY_STATE/ROLLED_BACK" ]]; then
        rollback_status='CONFIRMED'
      fi
    fi
    if (( rc != 0 )); then
      write_failure_evidence deploy "$rc" "$rollback_status" "$failure"
      publish_file "$failure" deployment.json
    fi
    rm -f "$DEPLOY_TOKEN_FILE" "$DEPLOY_MODEL_EVIDENCE"
    exit "$rc"
  }
  trap deploy_exit EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  set_deploy_failure_stage DEPLOY_PREFLIGHT_EXECUTION_FAILED
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$pre"
  set_deploy_failure_stage DEPLOY_PREFLIGHT_REPORT_INVALID
  python3 - "$pre" <<'PY'
import json,sys
r=json.load(open(sys.argv[1],encoding='utf-8'))
allowed={
  'TAI_SERVICE_NOT_MATERIALIZED',
  'TAI_DEDICATED_ENV_NOT_MATERIALIZED',
  'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED',
  'TAI_RELATIONS_INCOMPLETE',
  'ACTIVE_KNOWLEDGE_MISSING',
  'ACTIVE_MODEL_PROFILE_MISSING',
  'ACTIVE_MODEL_IDENTITY_MISMATCH',
}
blockers=set(r.get('blockers') or [])
if not blockers.issubset(allowed): raise SystemExit(f'unexpected blockers: {sorted(blockers)}')
if not blockers and r.get('passed') is not True: raise SystemExit('predeployment report is inconsistent')
PY
  set_deploy_failure_stage MODEL_ARTIFACT_EVIDENCE_RECOVERY_FAILED
  recover_model_artifact_evidence "$model_user" "$model_ssh_port" "$DEPLOY_MODEL_EVIDENCE"
  set_deploy_failure_stage ACTIVE_MODEL_TOKEN_RECOVERY_FAILED
  recover_local_model_token > "$DEPLOY_TOKEN_FILE"
  chmod 0600 "$DEPLOY_TOKEN_FILE"
  set_deploy_failure_stage TAI_STANDALONE_DEPLOY_EXECUTION_FAILED
  DEPLOY_MUTATION_STARTED=1
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-deploy.sh" "$TARGET_SHA" "$image" "$digest" "$RUN_ID" "$DEPLOY_TOKEN_FILE" "$DEPLOY_MODEL_EVIDENCE" > "$job_state/deploy.log" 2>&1
  set_deploy_failure_stage TAI_DEPLOYMENT_COMPLETION_MARKER_MISSING
  grep -Fxq 'TAI_REG_RU_DEPLOYMENT_COMPLETE=1' "$job_state/deploy.log" || fail TAI_DEPLOYMENT_INCOMPLETE 91
  rm -f "$DEPLOY_TOKEN_FILE" "$DEPLOY_MODEL_EVIDENCE"
  set_deploy_failure_stage TAI_DEPLOYMENT_EVIDENCE_MISSING
  evidence="$STATE_ROOT/tai-agro-os-$RUN_ID/evidence.json"
  [[ -s "$evidence" ]] || fail TAI_DEPLOYMENT_EVIDENCE_MISSING 92
  set_deploy_failure_stage TAI_POSTFLIGHT_EXECUTION_FAILED
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$post"
  set_deploy_failure_stage TAI_POSTFLIGHT_REPORT_INVALID
  python3 - "$post" <<'PY'
import json,sys
r=json.load(open(sys.argv[1],encoding='utf-8'))
if r.get('passed') is not True or r.get('blockers'): raise SystemExit(f'postflight blocked: {r.get("blockers")}')
PY
  set_deploy_failure_stage TAI_DEPLOYMENT_EVIDENCE_PUBLICATION_FAILED
  publish_file "$pre" predeploy.json
  publish_file "$evidence" deployment.json
  publish_file "$post" postdeploy.json
  clear_deploy_failure_stage
  DEPLOY_COMPLETE=1
  trap - EXIT INT TERM
}

prepare_dirs
if [[ "$ACTION" == finalize-activation ]]; then sync_target false; else sync_target true; fi
case "$ACTION" in
  preflight) run_preflight "$@" ;;
  activate) run_activate "$@" ;;
  finalize-activation) finalize_activation "$@" ;;
  deploy)
    if [[ "${1:-}" == '--pc-crop-staff-api-origin-repair-v1' ]]; then
      run_pc_crop_staff_api_origin_repair "$@"
    elif [[ "${1:-}" == '--reclaim-docker-headroom-v1' ]]; then
      run_docker_headroom_reclaim "$@"
    else
      run_deploy "$@"
    fi
    ;;
esac
rm -rf "$job_input"
printf 'PC_TAI_RELEASE_CONTROLLER=PASS\n'
printf 'ACTION=%s\n' "$ACTION"
printf 'TARGET_SHA=%s\n' "$TARGET_SHA"
printf 'OUTPUT_DIR=%s\n' "$job_output"
