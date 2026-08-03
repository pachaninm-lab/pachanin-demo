#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

export PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
unset BASH_ENV ENV CDPATH GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 SSH_AUTH_SOCK

readonly REPOSITORY_URL='https://github.com/pachaninm-lab/pachanin-demo.git'
readonly REPOSITORY_ROOT='/var/lib/pc-release-authority/repository'
readonly AUTHORITY_FILE='/etc/pc-release-authority/actions-runner.json'
readonly INSTALLED_CONTROLLER='/usr/local/sbin/pc-tai-release-controller'
readonly SUDOERS_FILE='/etc/sudoers.d/pc-tai-release-controller'
readonly CONTROLLER_LOCK='/run/lock/pc-tai-release-controller.lock'
readonly REFRESH_ROOT='/var/lib/pc-release-authority/controller-refresh'
readonly WRAPPER_RELATIVE='scripts/pc-tai-release-controller.sh'

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
STAGED_WRAPPER="${3:-}"
EVIDENCE_PATH="${4:-}"
STATE_DIR=''
OLD_DIGEST=''
NEW_DIGEST=''
STATUS='FAILED'
LAST_ERROR='CONTROLLER_REFRESH_FAILED'
MUTATION_STARTED=0
REFRESH_COMPLETE=0
ROLLBACK_STATUS='NOT_REQUIRED'
BACKUP_CONTROLLER=''
BACKUP_AUTHORITY=''

write_evidence() {
  local passed="$1" status="$2" error_code="$3" rollback="$4"
  [[ -n "$STATE_DIR" && -d "$STATE_DIR" && ! -L "$STATE_DIR" ]] || return 0
  python3 - "$EVIDENCE_PATH" "$TARGET_SHA" "$RUN_ID" "$passed" "$status" "$error_code" "$rollback" "$OLD_DIGEST" "$NEW_DIGEST" <<'PY'
import json
import os
import sys
import tempfile

(path, target_sha, run_id, passed_raw, status, error_code,
 rollback_status, old_digest, new_digest) = sys.argv[1:]
payload = {
    'schemaVersion': 'tai.reg-ru.controller-refresh.v1',
    'targetSha': target_sha,
    'runId': run_id,
    'mode': 'OWNER_EXACT_MAIN_CONTROLLER_REFRESH',
    'installedPath': '/usr/local/sbin/pc-tai-release-controller',
    'authorityPath': '/etc/pc-release-authority/actions-runner.json',
    'oldControllerSha256': old_digest or None,
    'newControllerSha256': new_digest or None,
    'status': status,
    'errorCode': error_code or None,
    'rollbackStatus': rollback_status,
    'runnerRegistrationChanged': False,
    'runnerServiceRestarted': False,
    'composeMutationPerformed': False,
    'databaseMutationPerformed': False,
    'modelMutationPerformed': False,
    'applicationDeploymentPerformed': False,
    'sudoAuthorityWidened': False,
    'passed': passed_raw == 'true',
}
os.makedirs(os.path.dirname(path), mode=0o700, exist_ok=True)
fd, temp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix='.controller-refresh.', text=True)
try:
    with os.fdopen(fd, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=True, separators=(',', ':'))
        handle.write('\n')
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(temp_path, 0o600)
    os.replace(temp_path, path)
finally:
    if os.path.exists(temp_path):
        os.unlink(temp_path)
PY
  chown root:root "$EVIDENCE_PATH"
  chmod 0600 "$EVIDENCE_PATH"
}

fail() {
  LAST_ERROR="$1"
  printf 'ERROR_CODE=%s\n' "$LAST_ERROR" >&2
  exit "${2:-1}"
}

rollback_refresh() {
  (( MUTATION_STARTED == 1 && REFRESH_COMPLETE == 0 )) || return 0
  local failed=0
  if [[ -f "$BACKUP_CONTROLLER" && ! -L "$BACKUP_CONTROLLER" ]]; then
    install -m 0750 -o root -g pcactions "$BACKUP_CONTROLLER" "$INSTALLED_CONTROLLER" || failed=1
  else
    failed=1
  fi
  if [[ -f "$BACKUP_AUTHORITY" && ! -L "$BACKUP_AUTHORITY" ]]; then
    install -m 0644 -o root -g root "$BACKUP_AUTHORITY" "$AUTHORITY_FILE" || failed=1
  else
    failed=1
  fi
  if (( failed == 0 )); then
    ROLLBACK_STATUS='APPLIED'
  else
    ROLLBACK_STATUS='FAILED'
  fi
}

on_exit() {
  local rc="$?"
  trap - EXIT
  if (( rc != 0 )); then
    rollback_refresh || true
    write_evidence false FAILED "$LAST_ERROR" "$ROLLBACK_STATUS" || true
  fi
  exit "$rc"
}
trap on_exit EXIT

[[ "$(id -u)" -eq 0 ]] || fail ROOT_AUTHORITY_REQUIRED 2
[[ -z "${SUDO_USER:-}" ]] || fail DIRECT_ROOT_SSH_REQUIRED 3
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 10
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || fail INVALID_RUN_ID 11
STATE_DIR="$REFRESH_ROOT/$RUN_ID"
[[ "$STAGED_WRAPPER" == "$STATE_DIR/pc-tai-release-controller.sh" ]] || fail STAGED_WRAPPER_PATH_INVALID 12
[[ "$EVIDENCE_PATH" == "$STATE_DIR/controller-refresh.json" ]] || fail EVIDENCE_PATH_INVALID 13

for command in git sha256sum python3 install stat flock visudo sudo grep find chown chmod mv; do
  command -v "$command" >/dev/null 2>&1 || fail "REQUIRED_COMMAND_${command^^}_MISSING" 14
done
id pcactions >/dev/null 2>&1 || fail PCACTIONS_PRINCIPAL_MISSING 15
[[ -d "$STATE_DIR" && ! -L "$STATE_DIR" ]] || fail REFRESH_STATE_DIRECTORY_INVALID 16
[[ "$(stat -c '%U:%G:%a' "$STATE_DIR")" == root:root:700 ]] || fail REFRESH_STATE_DIRECTORY_PERMISSIONS_INVALID 17
[[ -f "$STAGED_WRAPPER" && ! -L "$STAGED_WRAPPER" ]] || fail STAGED_WRAPPER_INVALID 18
[[ "$(stat -c '%U:%G:%h' "$STAGED_WRAPPER")" == root:root:1 ]] || fail STAGED_WRAPPER_OWNERSHIP_INVALID 19
find -P "$STAGED_WRAPPER" -perm /022 -print -quit | grep -q . && fail STAGED_WRAPPER_WRITABLE_BY_NONROOT 20

exec 9>"$CONTROLLER_LOCK"
flock -n 9 || fail RELEASE_CONTROLLER_BUSY 21

[[ -d "$REPOSITORY_ROOT/.git" && ! -L "$REPOSITORY_ROOT" ]] || fail PROTECTED_REPOSITORY_UNAVAILABLE 22
[[ "$(stat -c '%U:%G:%a' "$REPOSITORY_ROOT")" == root:root:700 ]] || fail PROTECTED_REPOSITORY_PERMISSIONS_INVALID 23
git -C "$REPOSITORY_ROOT" remote set-url origin "$REPOSITORY_URL"
[[ "$(git -C "$REPOSITORY_ROOT" remote get-url origin)" == "$REPOSITORY_URL" ]] || fail PROTECTED_REPOSITORY_REMOTE_INVALID 24
git -C "$REPOSITORY_ROOT" fetch --force --prune --no-tags origin '+refs/heads/main:refs/remotes/origin/main' >/dev/null
[[ "$(git -C "$REPOSITORY_ROOT" rev-parse refs/remotes/origin/main)" == "$TARGET_SHA" ]] || fail TARGET_IS_NOT_CURRENT_MAIN 25
git -C "$REPOSITORY_ROOT" checkout --force --detach "$TARGET_SHA" >/dev/null
git -C "$REPOSITORY_ROOT" clean -ffdx >/dev/null
[[ "$(git -C "$REPOSITORY_ROOT" rev-parse HEAD)" == "$TARGET_SHA" ]] || fail PROTECTED_CHECKOUT_MISMATCH 26
[[ -z "$(git -C "$REPOSITORY_ROOT" status --porcelain=v1)" ]] || fail PROTECTED_CHECKOUT_DIRTY 27
repo_wrapper="$REPOSITORY_ROOT/$WRAPPER_RELATIVE"
[[ -f "$repo_wrapper" && ! -L "$repo_wrapper" ]] || fail PROTECTED_WRAPPER_INVALID 28
NEW_DIGEST="$(sha256sum "$repo_wrapper" | awk '{print $1}')"
[[ "$NEW_DIGEST" =~ ^[0-9a-f]{64}$ ]] || fail NEW_CONTROLLER_DIGEST_INVALID 29
[[ "$(sha256sum "$STAGED_WRAPPER" | awk '{print $1}')" == "$NEW_DIGEST" ]] || fail STAGED_WRAPPER_NOT_EXACT_TARGET 30
bash -n "$STAGED_WRAPPER" || fail STAGED_WRAPPER_SYNTAX_INVALID 31

[[ -f "$INSTALLED_CONTROLLER" && ! -L "$INSTALLED_CONTROLLER" ]] || fail INSTALLED_CONTROLLER_INVALID 32
[[ "$(stat -c '%U:%G:%a:%h' "$INSTALLED_CONTROLLER")" == root:pcactions:750:1 ]] || fail INSTALLED_CONTROLLER_PERMISSIONS_INVALID 33
OLD_DIGEST="$(sha256sum "$INSTALLED_CONTROLLER" | awk '{print $1}')"
[[ "$OLD_DIGEST" =~ ^[0-9a-f]{64}$ ]] || fail OLD_CONTROLLER_DIGEST_INVALID 34
[[ -f "$AUTHORITY_FILE" && ! -L "$AUTHORITY_FILE" ]] || fail RUNNER_AUTHORITY_INVALID 35
[[ "$(stat -c '%U:%G:%a:%h' "$AUTHORITY_FILE")" == root:root:644:1 ]] || fail RUNNER_AUTHORITY_PERMISSIONS_INVALID 36
[[ "$(stat -c '%s' "$AUTHORITY_FILE")" -le 1048576 ]] || fail RUNNER_AUTHORITY_TOO_LARGE 37

attested_digest="$(python3 - "$AUTHORITY_FILE" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
payload = json.loads(path.read_text(encoding='utf-8'))
required = {
    'schemaVersion': 'pc.actions-runner-authority.v3',
    'repository': 'https://github.com/pachaninm-lab/pachanin-demo',
    'executionUser': 'pcactions',
    'transport': 'OUTBOUND_ONLY_HTTPS',
    'productionInboundSshRequired': False,
    'dockerSocketAccess': False,
    'sudoController': '/usr/local/sbin/pc-tai-release-controller',
}
for key, expected in required.items():
    if payload.get(key) != expected:
        raise SystemExit(f'authority mismatch: {key}')
labels = payload.get('labels')
if labels != ['self-hosted', 'linux', 'x64', 'pc-prod', 'tai-readonly']:
    raise SystemExit('labels mismatch')
digest = payload.get('sudoControllerSha256')
if not isinstance(digest, str) or len(digest) != 64:
    raise SystemExit('controller digest missing')
print(digest)
PY
)" || fail RUNNER_AUTHORITY_CONTENT_INVALID 38
[[ "$attested_digest" == "$OLD_DIGEST" ]] || fail INSTALLED_CONTROLLER_ATTESTATION_MISMATCH 39

[[ -f "$SUDOERS_FILE" && ! -L "$SUDOERS_FILE" ]] || fail CONTROLLER_SUDOERS_INVALID 40
[[ "$(stat -c '%U:%G:%a:%h' "$SUDOERS_FILE")" == root:root:440:1 ]] || fail CONTROLLER_SUDOERS_PERMISSIONS_INVALID 41
visudo -cf "$SUDOERS_FILE" >/dev/null || fail CONTROLLER_SUDOERS_SYNTAX_INVALID 42
grep -Fxq 'pcactions ALL=(root) NOPASSWD: /usr/local/sbin/pc-tai-release-controller' "$SUDOERS_FILE" || fail CONTROLLER_SUDOERS_SCOPE_INVALID 43
! id -nG pcactions | tr ' ' '\n' | grep -Fxq docker || fail PCACTIONS_DIRECT_DOCKER_AUTHORITY_PRESENT 44

if [[ "$OLD_DIGEST" == "$NEW_DIGEST" ]]; then
  STATUS='ALREADY_CURRENT'
  REFRESH_COMPLETE=1
  write_evidence true "$STATUS" '' NOT_REQUIRED
  printf 'CONTROLLER_REFRESH=ALREADY_CURRENT\n'
  printf 'TARGET_SHA=%s\n' "$TARGET_SHA"
  printf 'CONTROLLER_SHA256=%s\n' "$NEW_DIGEST"
  exit 0
fi

BACKUP_CONTROLLER="$STATE_DIR/controller.before"
BACKUP_AUTHORITY="$STATE_DIR/authority.before.json"
install -m 0600 -o root -g root "$INSTALLED_CONTROLLER" "$BACKUP_CONTROLLER"
install -m 0600 -o root -g root "$AUTHORITY_FILE" "$BACKUP_AUTHORITY"
new_controller="$STATE_DIR/controller.new"
new_authority="$STATE_DIR/authority.new.json"
install -m 0750 -o root -g pcactions "$STAGED_WRAPPER" "$new_controller"
[[ "$(sha256sum "$new_controller" | awk '{print $1}')" == "$NEW_DIGEST" ]] || fail STAGED_INSTALL_DIGEST_MISMATCH 45
python3 - "$AUTHORITY_FILE" "$new_authority" "$NEW_DIGEST" <<'PY'
import json
import os
import sys

source, target, digest = sys.argv[1:]
with open(source, encoding='utf-8') as handle:
    payload = json.load(handle)
payload['sudoControllerSha256'] = digest
with open(target, 'w', encoding='utf-8') as handle:
    json.dump(payload, handle, ensure_ascii=True, separators=(',', ':'))
    handle.write('\n')
    handle.flush()
    os.fsync(handle.fileno())
os.chmod(target, 0o600)
PY
chown root:root "$new_authority"

MUTATION_STARTED=1
install -m 0750 -o root -g pcactions "$new_controller" "${INSTALLED_CONTROLLER}.new-${RUN_ID}"
mv -Tf "${INSTALLED_CONTROLLER}.new-${RUN_ID}" "$INSTALLED_CONTROLLER"
install -m 0644 -o root -g root "$new_authority" "${AUTHORITY_FILE}.new-${RUN_ID}"
mv -Tf "${AUTHORITY_FILE}.new-${RUN_ID}" "$AUTHORITY_FILE"

[[ "$(stat -c '%U:%G:%a:%h' "$INSTALLED_CONTROLLER")" == root:pcactions:750:1 ]] || fail POST_REFRESH_CONTROLLER_PERMISSIONS_INVALID 46
[[ "$(sha256sum "$INSTALLED_CONTROLLER" | awk '{print $1}')" == "$NEW_DIGEST" ]] || fail POST_REFRESH_CONTROLLER_DIGEST_MISMATCH 47
[[ "$(stat -c '%U:%G:%a:%h' "$AUTHORITY_FILE")" == root:root:644:1 ]] || fail POST_REFRESH_AUTHORITY_PERMISSIONS_INVALID 48
post_digest="$(python3 - "$AUTHORITY_FILE" -c '' 2>/dev/null || true)"
post_digest="$(python3 - "$AUTHORITY_FILE" <<'PY'
import json
import sys
print(json.load(open(sys.argv[1], encoding='utf-8')).get('sudoControllerSha256', ''))
PY
)"
[[ "$post_digest" == "$NEW_DIGEST" ]] || fail POST_REFRESH_AUTHORITY_DIGEST_MISMATCH 49
visudo -cf "$SUDOERS_FILE" >/dev/null || fail POST_REFRESH_SUDOERS_INVALID 50
sudo -u pcactions -H sudo -n -l | grep -Fq '/usr/local/sbin/pc-tai-release-controller' || fail POST_REFRESH_SUDO_AUTHORITY_MISSING 51
if sudo -u pcactions -H docker version >/dev/null 2>&1; then fail POST_REFRESH_DIRECT_DOCKER_AUTHORITY_PRESENT 52; fi

REFRESH_COMPLETE=1
STATUS='REFRESHED'
ROLLBACK_STATUS='NOT_REQUIRED'
write_evidence true "$STATUS" '' "$ROLLBACK_STATUS"
printf 'CONTROLLER_REFRESH=REFRESHED\n'
printf 'TARGET_SHA=%s\n' "$TARGET_SHA"
printf 'OLD_CONTROLLER_SHA256=%s\n' "$OLD_DIGEST"
printf 'NEW_CONTROLLER_SHA256=%s\n' "$NEW_DIGEST"
