#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

export PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
unset BASH_ENV ENV CDPATH GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 SSH_AUTH_SOCK GIT_ASKPASS GIT_TERMINAL_PROMPT PC_GITHUB_TOKEN_FILE

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
SOURCE_FILE="${3:-}"
OUTPUT_FILE="${4:-}"

readonly REPOSITORY_URL='https://github.com/pachaninm-lab/pachanin-demo.git'
readonly STATE_ROOT='/var/lib/pc-release-authority'
readonly REPOSITORY_ROOT='/var/lib/pc-release-authority/repository'
readonly CONTROLLER_RELATIVE='scripts/pc-tai-release-controller.sh'
readonly CONTROLLER_TARGET='/usr/local/sbin/pc-tai-release-controller'
readonly CONTROLLER_LOCK='/run/lock/pc-tai-release-controller.lock'
readonly MARKER='/etc/pc-release-authority/actions-runner.json'
readonly SUDOERS='/etc/sudoers.d/pc-tai-release-controller'
readonly RUNNER_USER='pcactions'

fail() {
  printf 'TAI_CONTROLLER_SYNC_ERROR=%s\n' "$1" >&2
  exit "${2:-1}"
}

repo_auth_dir=''

clear_repo_auth() {
  unset GIT_ASKPASS GIT_TERMINAL_PROMPT PC_GITHUB_TOKEN_FILE
  if [[ -n "${repo_auth_dir:-}" ]]; then
    [[ "$repo_auth_dir" == "$STATE_ROOT/controller-jobs/git-auth-sync-$RUN_ID" ]] || return 90
    rm -f -- "$repo_auth_dir/token" "$repo_auth_dir/askpass.sh" || return 91
    rmdir -- "$repo_auth_dir" || return 92
    repo_auth_dir=''
  fi
}

prepare_repo_auth() {
  local token='' token_file askpass
  IFS= read -r token || [[ -n "$token" ]] || fail REPOSITORY_READ_TOKEN_MISSING 48
  [[ "$token" =~ ^[A-Za-z0-9_-]{20,512}$ ]] || fail REPOSITORY_READ_TOKEN_INVALID 49
  install -d -m 0700 -o root -g root "$STATE_ROOT/controller-jobs"
  repo_auth_dir="$STATE_ROOT/controller-jobs/git-auth-sync-$RUN_ID"
  [[ ! -e "$repo_auth_dir" && ! -L "$repo_auth_dir" ]] || fail REPOSITORY_AUTH_STATE_EXISTS 50
  install -d -m 0700 -o root -g root "$repo_auth_dir"
  token_file="$repo_auth_dir/token"
  askpass="$repo_auth_dir/askpass.sh"
  ( umask 077; printf '%s' "$token" > "$token_file" )
  unset token
  cat > "$askpass" <<'GIT_ASKPASS_SH'
#!/bin/sh
case "${1:-}" in
  *Username*) printf '%s\n' 'x-access-token' ;;
  *Password*) cat "${PC_GITHUB_TOKEN_FILE:?}" ;;
  *) exit 1 ;;
esac
GIT_ASKPASS_SH
  chmod 0700 "$askpass"
  export GIT_ASKPASS="$askpass"
  export GIT_TERMINAL_PROMPT=0
  export PC_GITHUB_TOKEN_FILE="$token_file"
}

auth_exit() { clear_repo_auth || true; }
trap auth_exit EXIT

fsync_paths() {
  python3 - "$@" <<'PY'
import os
import sys
from pathlib import Path

paths = [Path(raw) for raw in sys.argv[1:]]
for path in paths:
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)
for parent in {path.parent for path in paths}:
    fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)
PY
}

write_evidence() {
  local status="$1" previous_sha="$2" current_sha="$3" marker_previous_sha="$4" rollback_prepared="$5"
  python3 - "$OUTPUT_FILE" "$TARGET_SHA" "$RUN_ID" "$status" "$previous_sha" "$current_sha" "$marker_previous_sha" "$rollback_prepared" <<'PY'
import json
import os
import sys

path, target, run_id, status, previous, current, marker_previous, rollback_raw = sys.argv[1:]
payload = {
    'schemaVersion': 'tai.controller-sync.v1',
    'targetSha': target,
    'runId': run_id,
    'hosting': 'REG_RU_VPS_ONLY',
    'newRecurringCostRub': 0,
    'status': status,
    'controllerPath': '/usr/local/sbin/pc-tai-release-controller',
    'previousSha256': previous,
    'currentSha256': current,
    'markerPreviousSha256': marker_previous,
    'markerCurrentSha256': current,
    'markerMatchedInstalledBeforeSync': True,
    'sharedControllerLockHeld': True,
    'controllerUpdated': status == 'UPDATED',
    'owner': 'root',
    'group': 'pcactions',
    'mode': '0750',
    'runnerDirectDockerAuthority': False,
    'runnerDockerGroupMembership': False,
    'runnerRegistrationChanged': False,
    'runnerServiceRestarted': False,
    'composeMutationPerformed': False,
    'databaseMutationPerformed': False,
    'modelMutationPerformed': False,
    'applicationDeploymentPerformed': False,
    'sudoAuthorityWidened': False,
    'rollbackPrepared': rollback_raw == 'true',
    'passed': True,
}
with open(path, 'w', encoding='utf-8') as handle:
    json.dump(payload, handle, sort_keys=True, separators=(',', ':'))
    handle.write('\n')
    handle.flush()
    os.fsync(handle.fileno())
os.chmod(path, 0o640)
os.chown(path, 0, 0)
PY
  chown root:"$RUNNER_USER" "$OUTPUT_FILE"
  fsync_paths "$OUTPUT_FILE"
}

[[ "$(id -u)" -eq 0 ]] || fail ROOT_AUTHORITY_REQUIRED 2
[[ -z "${SUDO_USER:-}" ]] || fail DIRECT_ROOT_SSH_REQUIRED 3
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 4
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || fail INVALID_RUN_ID 5
[[ "$SOURCE_FILE" == "/tmp/pc-tai-controller-${RUN_ID}.sh" ]] || fail INVALID_SOURCE_PATH 6
[[ "$OUTPUT_FILE" == "/var/lib/pc-release-authority/runner-output/${RUN_ID}/controller-sync.json" ]] || fail INVALID_OUTPUT_PATH 7

for command in bash git sha256sum install stat python3 visudo sudo id find flock grep awk tr docker mktemp cp mv rm dirname chown chmod; do
  command -v "$command" >/dev/null 2>&1 || fail "COMMAND_MISSING_${command^^}" 8
done
id "$RUNNER_USER" >/dev/null 2>&1 || fail RUNNER_USER_MISSING 9
[[ -f "$SOURCE_FILE" && ! -L "$SOURCE_FILE" ]] || fail SOURCE_FILE_INVALID 10
[[ "$(stat -c '%U:%G:%h' "$SOURCE_FILE")" == root:root:1 ]] || fail SOURCE_FILE_OWNER_OR_LINK_INVALID 11
if find -P "$SOURCE_FILE" -perm /022 -print -quit | grep -q .; then fail SOURCE_FILE_WRITABLE_BY_NONROOT 12; fi
[[ -d "$REPOSITORY_ROOT/.git" && ! -L "$REPOSITORY_ROOT" ]] || fail PROTECTED_REPOSITORY_INVALID 13
[[ "$(stat -c '%U:%G:%a' "$REPOSITORY_ROOT")" == root:root:700 ]] || fail PROTECTED_REPOSITORY_PERMISSIONS_INVALID 14
[[ "$(git -C "$REPOSITORY_ROOT" remote get-url origin)" == "$REPOSITORY_URL" ]] || fail PROTECTED_REPOSITORY_REMOTE_INVALID 15
prepare_repo_auth

exec 9>"$CONTROLLER_LOCK"
flock -n 9 || fail RELEASE_CONTROLLER_BUSY 16

git -C "$REPOSITORY_ROOT" fetch --force --prune --no-tags origin '+refs/heads/main:refs/remotes/origin/main' >/dev/null
[[ "$(git -C "$REPOSITORY_ROOT" rev-parse refs/remotes/origin/main)" == "$TARGET_SHA" ]] || fail TARGET_IS_NOT_CURRENT_MAIN 17
git -C "$REPOSITORY_ROOT" checkout --force --detach "$TARGET_SHA" >/dev/null
git -C "$REPOSITORY_ROOT" clean -ffdx >/dev/null
[[ "$(git -C "$REPOSITORY_ROOT" rev-parse HEAD)" == "$TARGET_SHA" ]] || fail PROTECTED_CHECKOUT_MISMATCH 18
[[ -z "$(git -C "$REPOSITORY_ROOT" status --porcelain=v1)" ]] || fail PROTECTED_CHECKOUT_DIRTY 19
clear_repo_auth || fail REPOSITORY_AUTH_CLEANUP_FAILED 51

expected_source="$REPOSITORY_ROOT/$CONTROLLER_RELATIVE"
[[ -f "$expected_source" && ! -L "$expected_source" ]] || fail EXPECTED_CONTROLLER_INVALID 20
expected_sha="$(sha256sum "$expected_source" | awk '{print $1}')"
uploaded_sha="$(sha256sum "$SOURCE_FILE" | awk '{print $1}')"
[[ "$expected_sha" =~ ^[0-9a-f]{64}$ && "$uploaded_sha" == "$expected_sha" ]] || fail UPLOADED_CONTROLLER_NOT_EXACT_TARGET 21
bash -n "$SOURCE_FILE" || fail UPLOADED_CONTROLLER_SYNTAX_INVALID 22

[[ -f "$CONTROLLER_TARGET" && ! -L "$CONTROLLER_TARGET" ]] || fail INSTALLED_CONTROLLER_INVALID 23
[[ "$(stat -c '%U:%G:%a:%h' "$CONTROLLER_TARGET")" == root:${RUNNER_USER}:750:1 ]] || fail INSTALLED_CONTROLLER_PERMISSIONS_INVALID 24
[[ -f "$MARKER" && ! -L "$MARKER" ]] || fail RUNNER_MARKER_INVALID 25
[[ "$(stat -c '%U:%G:%a:%h' "$MARKER")" == root:root:644:1 ]] || fail RUNNER_MARKER_PERMISSIONS_INVALID 26
[[ -f "$SUDOERS" && ! -L "$SUDOERS" ]] || fail SUDOERS_INVALID 27
[[ "$(stat -c '%U:%G:%a:%h' "$SUDOERS")" == root:root:440:1 ]] || fail SUDOERS_PERMISSIONS_INVALID 28
visudo -cf "$SUDOERS" >/dev/null || fail SUDOERS_SYNTAX_INVALID 29
grep -Fxq 'pcactions ALL=(root) NOPASSWD: /usr/local/sbin/pc-tai-release-controller' "$SUDOERS" || fail SUDOERS_SCOPE_INVALID 30
sudo -u "$RUNNER_USER" -H sudo -n -l | grep -Fq "$CONTROLLER_TARGET" || fail CONTROLLER_SUDO_AUTHORITY_INVALID 31
if sudo -u "$RUNNER_USER" -H docker version >/dev/null 2>&1; then fail RUNNER_DIRECT_DOCKER_AUTHORITY_PRESENT 32; fi
! id -nG "$RUNNER_USER" | tr ' ' '\n' | grep -Fxq docker || fail RUNNER_DOCKER_GROUP_PRESENT 33

previous_sha="$(sha256sum "$CONTROLLER_TARGET" | awk '{print $1}')"
[[ "$previous_sha" =~ ^[0-9a-f]{64}$ ]] || fail INSTALLED_CONTROLLER_DIGEST_INVALID 34
marker_previous_sha="$(python3 - "$MARKER" <<'PY_READ'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as handle:
    payload = json.load(handle)
required = {
    'schemaVersion': 'pc.actions-runner-authority.v3',
    'repository': 'https://github.com/pachaninm-lab/pachanin-demo',
    'executionUser': 'pcactions',
    'transport': 'OUTBOUND_ONLY_HTTPS',
    'productionInboundSshRequired': False,
    'dockerSocketAccess': False,
    'sudoController': '/usr/local/sbin/pc-tai-release-controller',
}
if not isinstance(payload, dict):
    raise SystemExit(2)
for key, value in required.items():
    if payload.get(key) != value:
        raise SystemExit(3)
labels = payload.get('labels')
if labels != ['self-hosted', 'linux', 'x64', 'pc-prod', 'tai-readonly']:
    raise SystemExit(4)
value = payload.get('sudoControllerSha256')
if not isinstance(value, str) or len(value) != 64 or any(ch not in '0123456789abcdef' for ch in value):
    raise SystemExit(5)
print(value)
PY_READ
)" || fail RUNNER_MARKER_CONTENT_INVALID 35
[[ "$marker_previous_sha" == "$previous_sha" ]] || fail INSTALLED_CONTROLLER_ATTESTATION_MISMATCH 36

install -d -m 0750 -o root -g "$RUNNER_USER" "$(dirname "$OUTPUT_FILE")"

if [[ "$previous_sha" == "$expected_sha" ]]; then
  write_evidence ALREADY_EXACT "$previous_sha" "$expected_sha" "$marker_previous_sha" false
  rm -f "$SOURCE_FILE"
  echo 'TAI_CONTROLLER_SYNC_STATUS=ALREADY_EXACT'
  echo "TAI_CONTROLLER_SYNC_SHA256=$expected_sha"
  echo 'TAI_CONTROLLER_SYNC_COMPLETE=1'
  exit 0
fi

backup_dir="$(mktemp -d /var/lib/pc-release-authority/.controller-sync.XXXXXX)"
controller_backup="$backup_dir/controller"
marker_backup="$backup_dir/marker.json"
controller_staged="$backup_dir/controller.new"
marker_staged="$backup_dir/marker.new.json"
install -m 0600 -o root -g root "$CONTROLLER_TARGET" "$controller_backup"
install -m 0600 -o root -g root "$MARKER" "$marker_backup"
install -m 0750 -o root -g "$RUNNER_USER" "$SOURCE_FILE" "$controller_staged"
[[ "$(sha256sum "$controller_staged" | awk '{print $1}')" == "$expected_sha" ]] || fail STAGED_CONTROLLER_DIGEST_MISMATCH 37
python3 - "$MARKER" "$marker_staged" "$expected_sha" <<'PY_WRITE'
import json
import os
import sys

source, target, digest = sys.argv[1:]
with open(source, encoding='utf-8') as handle:
    payload = json.load(handle)
if payload.get('sudoController') != '/usr/local/sbin/pc-tai-release-controller':
    raise SystemExit(2)
payload['sudoControllerSha256'] = digest
with open(target, 'w', encoding='utf-8') as handle:
    json.dump(payload, handle, ensure_ascii=True, separators=(',', ':'))
    handle.write('\n')
    handle.flush()
    os.fsync(handle.fileno())
os.chmod(target, 0o600)
os.chown(target, 0, 0)
PY_WRITE

mutated=0
succeeded=0
cleanup() {
  local rc="$?"
  trap - EXIT
  clear_repo_auth || true
  if (( succeeded == 0 && mutated == 1 )); then
    install -m 0750 -o root -g "$RUNNER_USER" "$controller_backup" "$CONTROLLER_TARGET" || true
    install -m 0644 -o root -g root "$marker_backup" "$MARKER" || true
    fsync_paths "$CONTROLLER_TARGET" "$MARKER" || true
  fi
  rm -rf "$backup_dir"
  rm -f "$SOURCE_FILE"
  exit "$rc"
}
trap cleanup EXIT

mutated=1
install -m 0750 -o root -g "$RUNNER_USER" "$controller_staged" "${CONTROLLER_TARGET}.new-${RUN_ID}"
mv -Tf "${CONTROLLER_TARGET}.new-${RUN_ID}" "$CONTROLLER_TARGET"
install -m 0644 -o root -g root "$marker_staged" "${MARKER}.new-${RUN_ID}"
mv -Tf "${MARKER}.new-${RUN_ID}" "$MARKER"
fsync_paths "$CONTROLLER_TARGET" "$MARKER"

[[ "$(stat -c '%U:%G:%a:%h' "$CONTROLLER_TARGET")" == root:${RUNNER_USER}:750:1 ]] || fail POST_SYNC_CONTROLLER_PERMISSIONS_INVALID 38
[[ "$(sha256sum "$CONTROLLER_TARGET" | awk '{print $1}')" == "$expected_sha" ]] || fail POST_SYNC_CONTROLLER_DIGEST_MISMATCH 39
bash -n "$CONTROLLER_TARGET" || fail POST_SYNC_CONTROLLER_SYNTAX_INVALID 40
[[ "$(stat -c '%U:%G:%a:%h' "$MARKER")" == root:root:644:1 ]] || fail POST_SYNC_MARKER_PERMISSIONS_INVALID 41
marker_current_sha="$(python3 - "$MARKER" <<'PY_VERIFY'
import json
import sys
with open(sys.argv[1], encoding='utf-8') as handle:
    payload = json.load(handle)
print(payload.get('sudoControllerSha256', ''))
PY_VERIFY
)"
[[ "$marker_current_sha" == "$expected_sha" ]] || fail POST_SYNC_MARKER_DIGEST_MISMATCH 42
visudo -cf "$SUDOERS" >/dev/null || fail POST_SYNC_SUDOERS_INVALID 43
grep -Fxq 'pcactions ALL=(root) NOPASSWD: /usr/local/sbin/pc-tai-release-controller' "$SUDOERS" || fail POST_SYNC_SUDOERS_SCOPE_INVALID 44
sudo -u "$RUNNER_USER" -H sudo -n -l | grep -Fq "$CONTROLLER_TARGET" || fail POST_SYNC_SUDO_AUTHORITY_INVALID 45
if sudo -u "$RUNNER_USER" -H docker version >/dev/null 2>&1; then fail RUNNER_DIRECT_DOCKER_AUTHORITY_PRESENT_AFTER_SYNC 46; fi
! id -nG "$RUNNER_USER" | tr ' ' '\n' | grep -Fxq docker || fail RUNNER_DOCKER_GROUP_PRESENT_AFTER_SYNC 47

write_evidence UPDATED "$previous_sha" "$expected_sha" "$marker_previous_sha" true
succeeded=1

echo 'TAI_CONTROLLER_SYNC_STATUS=UPDATED'
echo "TAI_CONTROLLER_SYNC_SHA256=$expected_sha"
echo 'TAI_CONTROLLER_SYNC_COMPLETE=1'
