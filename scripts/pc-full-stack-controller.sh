#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

export PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
unset BASH_ENV ENV CDPATH GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 SSH_AUTH_SOCK

TARGET_SHA="${1:-}"
CONTROLLER_RUN_ID="${2:-}"
OUTPUT_FILE="${3:-}"

fail() {
  printf 'ERROR_CODE=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$(id -u)" -eq 0 ]] || fail ROOT_AUTHORITY_REQUIRED 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
[[ "$CONTROLLER_RUN_ID" =~ ^[0-9]{1,20}$ ]] || fail INVALID_CONTROLLER_RUN_ID 4
readonly INPUT_ROOT='/var/lib/pc-release-authority/runner-input'
readonly OUTPUT_ROOT='/var/lib/pc-release-authority/runner-output'
readonly STATE_ROOT='/var/lib/pc-release-authority'
readonly LOCK_FILE='/run/lock/pc-tai-release-controller.lock'
readonly INPUT_DIR="$INPUT_ROOT/$CONTROLLER_RUN_ID"
readonly INPUT_FILE="$INPUT_DIR/full-stack-release.json"
readonly OUTPUT_DIR="$OUTPUT_ROOT/$CONTROLLER_RUN_ID"
readonly REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EXECUTOR="$REPOSITORY_ROOT/scripts/production-full-stack-exact-sha.sh"

[[ "$OUTPUT_FILE" == "$OUTPUT_DIR/runtime-role-repair.json" ]] || fail INVALID_OUTPUT_PATH 5
[[ -f "$EXECUTOR" && ! -L "$EXECUTOR" ]] || fail FULL_STACK_EXECUTOR_INVALID 6
[[ -d "$OUTPUT_DIR" && ! -L "$OUTPUT_DIR" ]] || fail OUTPUT_DIRECTORY_INVALID 7

exec 9>"$LOCK_FILE"
flock -n 9 || fail RELEASE_CONTROLLER_BUSY 8

work="$(mktemp -d)"
registry_config="$work/docker"
registry_token_file="$work/registry-token"
validated_env="$work/validated.env"
raw_log="$work/action.raw.log"
clean_log="$work/action.log"
logged_in=0

cleanup() {
  local rc="$?"
  trap - EXIT INT TERM
  rm -f "$registry_token_file"
  if (( logged_in == 1 )); then
    DOCKER_CONFIG="$registry_config" docker logout ghcr.io >/dev/null 2>&1 || true
  fi
  rm -rf --one-file-system "$registry_config" "$work"
  if [[ -e "$INPUT_DIR" || -L "$INPUT_DIR" ]]; then
    [[ -d "$INPUT_DIR" && ! -L "$INPUT_DIR" ]] && rm -rf --one-file-system "$INPUT_DIR" || true
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

[[ -d "$INPUT_DIR" && ! -L "$INPUT_DIR" ]] || fail INPUT_DIRECTORY_INVALID 10
[[ "$(stat -c '%U:%G:%a' "$INPUT_DIR")" == pcactions:pcactions:700 ]] || fail INPUT_DIRECTORY_PERMISSIONS_INVALID 11
mapfile -d '' -t input_entries < <(find -P "$INPUT_DIR" -mindepth 1 -maxdepth 1 -print0)
(( ${#input_entries[@]} == 1 )) || fail INPUT_ENTRY_COUNT_INVALID 12
[[ "${input_entries[0]}" == "$INPUT_FILE" ]] || fail INPUT_NAME_INVALID 13
[[ -f "$INPUT_FILE" && ! -L "$INPUT_FILE" ]] || fail INPUT_FILE_INVALID 14
[[ "$(stat -c '%U:%G:%a:%h' "$INPUT_FILE")" == pcactions:pcactions:600:1 ]] || fail INPUT_FILE_PERMISSIONS_INVALID 15
input_size="$(stat -c '%s' "$INPUT_FILE")"
(( input_size >= 2 && input_size <= 65536 )) || fail INPUT_FILE_SIZE_INVALID 16

python3 - "$INPUT_FILE" "$validated_env" "$registry_token_file" "$TARGET_SHA" "$CONTROLLER_RUN_ID" <<'PY_VALIDATE'
import json
import os
import posixpath
import re
import shlex
import sys

input_path, env_path, token_path, target_sha, controller_run_id = sys.argv[1:]
try:
    raw = open(input_path, 'rb').read()
    payload = json.loads(raw.decode('utf-8'))
except Exception as exc:
    raise SystemExit(f'INPUT_JSON_INVALID:{type(exc).__name__}')
if not isinstance(payload, dict):
    raise SystemExit('INPUT_JSON_NOT_OBJECT')
mode = payload.get('mode')
common = {
    'schemaVersion', 'mode', 'controllerTargetSha', 'controllerRunId',
    'releaseTargetSha', 'releaseStateId',
}
mode_keys = {
    'deploy': common | {'apiDigest', 'webDigest', 'migrationDigest', 'registryUser', 'registryToken', 'backupEvidencePath'},
    'verify-intake': common | {'requestNumber', 'correlationId'},
    'rollback': common,
}
if mode not in mode_keys or set(payload) != mode_keys[mode]:
    raise SystemExit('INPUT_SCHEMA_SHAPE_INVALID')
if payload.get('schemaVersion') != 'pc.full-stack.controller-input.v1':
    raise SystemExit('INPUT_SCHEMA_VERSION_INVALID')
if payload.get('controllerTargetSha') != target_sha or payload.get('controllerRunId') != controller_run_id:
    raise SystemExit('INPUT_CONTROLLER_AUTHORITY_MISMATCH')
release_sha = payload.get('releaseTargetSha')
release_id = payload.get('releaseStateId')
if not isinstance(release_sha, str) or not re.fullmatch(r'[0-9a-f]{40}', release_sha):
    raise SystemExit('INPUT_RELEASE_SHA_INVALID')
if not isinstance(release_id, str) or not re.fullmatch(r'[0-9]{1,20}', release_id):
    raise SystemExit('INPUT_RELEASE_STATE_ID_INVALID')
if mode == 'deploy' and release_sha != target_sha:
    raise SystemExit('DEPLOY_TARGET_NOT_CURRENT_CONTROLLER_TARGET')
values = {
    'MODE': mode,
    'CONTROLLER_TARGET_SHA': target_sha,
    'CONTROLLER_RUN_ID': controller_run_id,
    'RELEASE_TARGET_SHA': release_sha,
    'RELEASE_STATE_ID': release_id,
}
if mode == 'deploy':
    patterns = {
        'apiDigest': r'ghcr[.]io/pachaninm-lab/grainflow-api@sha256:[0-9a-f]{64}',
        'webDigest': r'ghcr[.]io/pachaninm-lab/grainflow-web@sha256:[0-9a-f]{64}',
        'migrationDigest': r'ghcr[.]io/pachaninm-lab/grainflow-migration@sha256:[0-9a-f]{64}',
    }
    for key, pattern in patterns.items():
        value = payload.get(key)
        if not isinstance(value, str) or not re.fullmatch(pattern, value):
            raise SystemExit(f'INPUT_{key.upper()}_INVALID')
    user = payload.get('registryUser')
    token = payload.get('registryToken')
    backup = payload.get('backupEvidencePath')
    if not isinstance(user, str) or not re.fullmatch(r'[A-Za-z0-9_.\[\]-]{1,64}', user):
        raise SystemExit('INPUT_REGISTRY_USER_INVALID')
    if not isinstance(token, str) or not 20 <= len(token) <= 512 or re.search(r'[\x00-\x20\x7f]', token):
        raise SystemExit('INPUT_REGISTRY_TOKEN_INVALID')
    if not isinstance(backup, str) or len(backup) > 4096 or any(ch in backup for ch in '\x00\r\n'):
        raise SystemExit('INPUT_BACKUP_PATH_INVALID')
    if backup:
        if not backup.startswith('/') or posixpath.normpath(backup) != backup:
            raise SystemExit('INPUT_BACKUP_PATH_INVALID')
    values.update({
        'API_DIGEST': payload['apiDigest'],
        'WEB_DIGEST': payload['webDigest'],
        'MIGRATION_DIGEST': payload['migrationDigest'],
        'REGISTRY_USER': user,
        'BACKUP_EVIDENCE_PATH': backup,
    })
    fd = os.open(token_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as handle:
        handle.write(token)
        handle.flush()
        os.fsync(handle.fileno())
elif mode == 'verify-intake':
    request = payload.get('requestNumber')
    correlation = payload.get('correlationId')
    if not isinstance(request, str) or not re.fullmatch(r'PC-[0-9]{8}-[0-9A-F]{12}', request):
        raise SystemExit('INPUT_REQUEST_NUMBER_INVALID')
    if not isinstance(correlation, str) or not re.fullmatch(r'[A-Za-z0-9._:-]{8,128}', correlation):
        raise SystemExit('INPUT_CORRELATION_ID_INVALID')
    values.update({'REQUEST_NUMBER': request, 'CORRELATION_ID': correlation})
with open(env_path, 'x', encoding='utf-8') as handle:
    for key, value in values.items():
        handle.write(f'{key}={shlex.quote(str(value))}\n')
    handle.flush()
    os.fsync(handle.fileno())
os.chmod(env_path, 0o600)
PY_VALIDATE
rm -f "$INPUT_FILE"
# shellcheck disable=SC1090
source "$validated_env"

redact_log() {
  local source="$1" destination="$2"
  sed -E \
    -e 's#postgres(ql)?://[^[:space:]@]+@#postgresql://[REDACTED]@#g' \
    -e 's#(gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)#[REDACTED]#g' \
    -e '/(_PATH|_DIR|COMPOSE|CONFIG_FILES|DATABASE_URL)=/ s#=.*#=[REDACTED]#' \
    "$source" > "$destination"
  chmod 0600 "$destination"
}

field() {
  local name="$1" file="$2"
  sed -n "s/^${name}=//p" "$file" | tail -1
}

error_code_from_log() {
  local file="$1" fallback="$2" code
  code="$(grep -E '^(ERROR_CODE=)?[A-Z][A-Z0-9_]+$' "$file" 2>/dev/null | tail -1 | sed 's/^ERROR_CODE=//' || true)"
  [[ "$code" =~ ^[A-Z][A-Z0-9_]+$ ]] || code="$fallback"
  printf '%s' "$code"
}

publish_log() {
  [[ -f "$clean_log" ]] || : > "$clean_log"
  install -m 0640 -o root -g pcactions "$clean_log" "$OUTPUT_DIR/full-stack.log"
}

write_evidence() {
  local mode="$1" passed="$2" error_code="$3" rollback_status="$4"
  local migration_complete="${5:-false}" deployment_complete="${6:-false}"
  local api_revision="${7:-}" web_revision="${8:-}" backup_mode="${9:-}"
  local audit_id="${10:-}" outbox_id="${11:-}"
  python3 - "$OUTPUT_FILE" "$mode" "$TARGET_SHA" "$RELEASE_TARGET_SHA" "$CONTROLLER_RUN_ID" "$RELEASE_STATE_ID" \
    "$passed" "$error_code" "$rollback_status" "$migration_complete" "$deployment_complete" \
    "$api_revision" "$web_revision" "$backup_mode" "$audit_id" "$outbox_id" <<'PY_EVIDENCE'
import json
import os
import sys
(
    path, mode, controller_sha, release_sha, controller_id, release_id,
    passed, error_code, rollback, migration, deployment,
    api_revision, web_revision, backup_mode, audit_id, outbox_id,
) = sys.argv[1:]
payload = {
    'schemaVersion': 'pc.full-stack.controller-evidence.v1',
    'mode': mode,
    'controllerTargetSha': controller_sha,
    'releaseTargetSha': release_sha,
    'controllerRunId': controller_id,
    'releaseStateId': release_id,
    'passed': passed == 'true',
    'errorCode': error_code or None,
    'rollbackStatus': rollback,
    'migrationComplete': migration == 'true',
    'deploymentComplete': deployment == 'true',
    'apiRevision': api_revision or None,
    'webRevision': web_revision or None,
    'backupMode': backup_mode or None,
    'auditId': audit_id or None,
    'outboxId': outbox_id or None,
    'productionInboundSshUsed': False,
    'runnerDirectDockerAuthority': False,
}
raw = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(',', ':'))
if len(raw.encode('utf-8')) > 65536 or '\n' in raw or '\r' in raw:
    raise SystemExit('EVIDENCE_BOUNDARY_INVALID')
with open(path, 'w', encoding='utf-8') as handle:
    handle.write(raw)
    handle.write('\n')
    handle.flush()
    os.fsync(handle.fileno())
os.chmod(path, 0o640)
PY_EVIDENCE
  chown root:pcactions "$OUTPUT_FILE"
}

case "$MODE" in
  deploy)
    install -d -m 0700 "$registry_config"
    [[ -s "$registry_token_file" && "$(stat -c '%U:%G:%a' "$registry_token_file")" == root:root:600 ]] \
      || fail REGISTRY_TOKEN_FILE_INVALID 30
    DOCKER_CONFIG="$registry_config" docker login ghcr.io --username "$REGISTRY_USER" --password-stdin \
      < "$registry_token_file" >/dev/null
    logged_in=1
    rm -f "$registry_token_file"
    for item in "$API_DIGEST" "$WEB_DIGEST" "$MIGRATION_DIGEST"; do
      DOCKER_CONFIG="$registry_config" docker pull "$item" >/dev/null
      revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$item")"
      [[ "$revision" == "$RELEASE_TARGET_SHA" ]] || fail IMAGE_REVISION_MISMATCH 31
      docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$item" | grep -Fxq "$item" \
        || fail IMAGE_DIGEST_MISMATCH 32
    done
    backup_b64="$(printf '%s' "$BACKUP_EVIDENCE_PATH" | base64 -w0)"
    set +e
    DOCKER_CONFIG="$registry_config" \
      PC_API_IMAGE="$API_DIGEST" \
      PC_WEB_IMAGE="$WEB_DIGEST" \
      PC_MIGRATION_IMAGE="$MIGRATION_DIGEST" \
      PC_PROD_BACKUP_EVIDENCE_FILE_B64="$backup_b64" \
      bash "$EXECUTOR" deploy "$RELEASE_TARGET_SHA" "$RELEASE_STATE_ID" > "$raw_log" 2>&1
    action_rc=$?
    set -e
    redact_log "$raw_log" "$clean_log"
    migration="$(field MIGRATION_COMPLETE "$clean_log")"
    deployment="$(field DEPLOYMENT_COMPLETE "$clean_log")"
    api_revision="$(field DEPLOYED_API_REVISION "$clean_log")"
    web_revision="$(field DEPLOYED_WEB_REVISION "$clean_log")"
    backup_mode="$(field BACKUP_MODE "$clean_log")"
    passed=false
    if (( action_rc == 0 )) && [[ "$migration" == 1 && "$deployment" == 1 \
      && "$api_revision" == "$RELEASE_TARGET_SHA" && "$web_revision" == "$RELEASE_TARGET_SHA" ]]; then
      passed=true
    elif (( action_rc == 0 )); then
      action_rc=97
      printf 'ERROR_CODE=DEPLOYMENT_EVIDENCE_INVALID\n' >> "$clean_log"
    fi
    rollback_status='NOT_REQUIRED'
    error_code=''
    if [[ "$passed" != true ]]; then
      error_code="$(error_code_from_log "$clean_log" FULL_STACK_DEPLOY_FAILED)"
      state_file="$STATE_ROOT/full-stack-${RELEASE_STATE_ID}.state"
      if [[ -f "$state_file" && ! -L "$state_file" ]]; then
        rollback_raw="$work/rollback.raw.log"
        rollback_clean="$work/rollback.log"
        set +e
        DOCKER_CONFIG="$registry_config" bash "$EXECUTOR" rollback "$RELEASE_TARGET_SHA" "$RELEASE_STATE_ID" \
          > "$rollback_raw" 2>&1
        rollback_rc=$?
        set -e
        redact_log "$rollback_raw" "$rollback_clean"
        cat "$rollback_clean" >> "$clean_log"
        if (( rollback_rc == 0 )) && grep -Fxq 'ROLLBACK_COMPLETE=1' "$rollback_clean"; then
          rollback_status='CONFIRMED'
        else
          rollback_status='FAILED'
          action_rc=98
        fi
      fi
    fi
    publish_log
    write_evidence deploy "$passed" "$error_code" "$rollback_status" \
      "$([[ "$migration" == 1 ]] && echo true || echo false)" \
      "$([[ "$deployment" == 1 ]] && echo true || echo false)" \
      "$api_revision" "$web_revision" "$backup_mode"
    [[ "$passed" == true ]] || exit "$action_rc"
    ;;
  verify-intake)
    set +e
    bash "$EXECUTOR" verify-intake "$RELEASE_TARGET_SHA" "$RELEASE_STATE_ID" "$REQUEST_NUMBER" "$CORRELATION_ID" \
      > "$raw_log" 2>&1
    action_rc=$?
    set -e
    redact_log "$raw_log" "$clean_log"
    durable="$(field DURABLE_INTAKE_DB "$clean_log")"
    audit_id="$(field DURABLE_INTAKE_AUDIT_ID "$clean_log")"
    outbox_id="$(field DURABLE_INTAKE_OUTBOX_ID "$clean_log")"
    passed=false
    if (( action_rc == 0 )) && [[ "$durable" == PASS && -n "$audit_id" && -n "$outbox_id" ]]; then passed=true; fi
    error_code=''
    [[ "$passed" == true ]] || error_code="$(error_code_from_log "$clean_log" DURABLE_INTAKE_VERIFICATION_FAILED)"
    publish_log
    write_evidence verify-intake "$passed" "$error_code" NOT_REQUIRED false false '' '' '' "$audit_id" "$outbox_id"
    [[ "$passed" == true ]] || exit "${action_rc:-99}"
    ;;
  rollback)
    set +e
    bash "$EXECUTOR" rollback "$RELEASE_TARGET_SHA" "$RELEASE_STATE_ID" > "$raw_log" 2>&1
    action_rc=$?
    set -e
    redact_log "$raw_log" "$clean_log"
    restored_api="$(field RESTORED_API_REVISION "$clean_log")"
    restored_web="$(field RESTORED_WEB_REVISION "$clean_log")"
    passed=false
    if (( action_rc == 0 )) && grep -Fxq 'ROLLBACK_COMPLETE=1' "$clean_log"; then passed=true; fi
    error_code=''
    [[ "$passed" == true ]] || error_code="$(error_code_from_log "$clean_log" FULL_STACK_ROLLBACK_FAILED)"
    publish_log
    write_evidence rollback "$passed" "$error_code" "$([[ "$passed" == true ]] && echo CONFIRMED || echo FAILED)" \
      false false "$restored_api" "$restored_web"
    [[ "$passed" == true ]] || exit "${action_rc:-100}"
    ;;
  *) fail INPUT_MODE_INVALID 40 ;;
esac

printf 'PC_FULL_STACK_CONTROLLER=PASS\n'
printf 'MODE=%s\n' "$MODE"
printf 'CONTROLLER_RUN_ID=%s\n' "$CONTROLLER_RUN_ID"
printf 'RELEASE_STATE_ID=%s\n' "$RELEASE_STATE_ID"
