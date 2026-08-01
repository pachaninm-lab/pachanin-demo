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
  [[ "$(sha256sum "$INSTALLED_CONTROLLER" | awk '{print $1}')" == "$(sha256sum "$REPOSITORY_ROOT/scripts/pc-tai-release-controller.sh" | awk '{print $1}')" ]] \
    || fail INSTALLED_CONTROLLER_NOT_EXACT_TARGET 26
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
  error_code="$(grep -hE '^ERROR_CODE=[A-Z0-9_]+' \
    "$job_state/full-stack.log" "$job_state/activation.log" "$job_state/deploy.log" "$job_state/rollback.log" \
    2>/dev/null | tail -1 | cut -d= -f2- || true)"
  [[ -n "$error_code" ]] || error_code="${action^^}_CONTROLLER_FAILED"
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
  [[ -s "$MODEL_KEY" && ! -L "$MODEL_KEY" ]] || fail MODEL_KEY_NOT_PROVISIONED 41
  [[ -s "$MODEL_KNOWN_HOSTS" && ! -L "$MODEL_KNOWN_HOSTS" ]] || fail MODEL_KNOWN_HOSTS_MISSING 45
  ssh -i "$MODEL_KEY" -p "$model_ssh_port" -o BatchMode=yes -o IdentitiesOnly=yes \
    -o UserKnownHostsFile="$MODEL_KNOWN_HOSTS" -o StrictHostKeyChecking=yes \
    "$model_user@$MODEL_HOST" 'python3 -' > "$output" <<'PY_REMOTE'
import hashlib
import json
import pathlib
import stat
import subprocess

subprocess.run(["systemctl", "is-active", "--quiet", "tai-qwen3-8b.service"], check=True)
pid_text = subprocess.check_output(
    ["systemctl", "show", "tai-qwen3-8b.service", "--property=MainPID", "--value"],
    text=True,
).strip()
if not pid_text.isdigit() or int(pid_text) < 1:
    raise SystemExit("invalid model process")
pid = int(pid_text)
args = [item.decode(errors="strict") for item in pathlib.Path(f"/proc/{pid}/cmdline").read_bytes().split(b"\0") if item]
candidates = []
context_tokens = 8192
for index, argument in enumerate(args):
    if argument in {"-m", "--model"} and index + 1 < len(args):
        candidates.append(args[index + 1])
    elif argument.startswith("--model="):
        candidates.append(argument.split("=", 1)[1])
    elif argument.lower().endswith(".gguf"):
        candidates.append(argument)
    if argument in {"-c", "--ctx-size"} and index + 1 < len(args) and args[index + 1].isdigit():
        context_tokens = int(args[index + 1])
    elif argument.startswith("--ctx-size=") and argument.split("=", 1)[1].isdigit():
        context_tokens = int(argument.split("=", 1)[1])
paths = sorted({str(pathlib.Path(item).resolve(strict=True)) for item in candidates})
if len(paths) != 1:
    raise SystemExit("model artifact authority is ambiguous")
path = pathlib.Path(paths[0])
metadata = path.stat()
if not stat.S_ISREG(metadata.st_mode) or metadata.st_size < 1:
    raise SystemExit("model artifact is invalid")
if not 512 <= context_tokens <= 262144:
    raise SystemExit("model context authority is invalid")
digest = hashlib.sha256()
with path.open("rb") as stream:
    while block := stream.read(8 * 1024 * 1024):
        digest.update(block)
print(json.dumps({
    "schemaVersion": "tai.restricted-model-artifact.v1",
    "modelIdentity": "tai-qwen3-8b-q4km",
    "modelHost": "192.168.0.206",
    "artifactPath": str(path),
    "artifactSha256": digest.hexdigest(),
    "artifactSizeBytes": metadata.st_size,
    "maximumContextTokens": context_tokens,
}, sort_keys=True, separators=(",", ":")))
PY_REMOTE
  chmod 0600 "$output"
  python3 - "$output" <<'PY_VALIDATE'
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
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$pre"
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
  recover_model_artifact_evidence "$model_user" "$model_ssh_port" "$DEPLOY_MODEL_EVIDENCE"
  recover_local_model_token > "$DEPLOY_TOKEN_FILE"; chmod 0600 "$DEPLOY_TOKEN_FILE"
  DEPLOY_MUTATION_STARTED=1
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-deploy.sh" "$TARGET_SHA" "$image" "$digest" "$RUN_ID" "$DEPLOY_TOKEN_FILE" "$DEPLOY_MODEL_EVIDENCE" > "$job_state/deploy.log" 2>&1
  grep -Fxq 'TAI_REG_RU_DEPLOYMENT_COMPLETE=1' "$job_state/deploy.log" || fail TAI_DEPLOYMENT_INCOMPLETE 91
  rm -f "$DEPLOY_TOKEN_FILE" "$DEPLOY_MODEL_EVIDENCE"
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
  DEPLOY_COMPLETE=1
  trap - EXIT INT TERM
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
