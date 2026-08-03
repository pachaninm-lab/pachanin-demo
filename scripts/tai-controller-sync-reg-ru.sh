#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

export PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
unset BASH_ENV ENV CDPATH GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 SSH_AUTH_SOCK

readonly TARGET_SHA="${1:-}"
readonly RUN_ID="${2:-}"
readonly EXPECTED_SHA256="${3:-}"
readonly SOURCE_CONTROLLER="${4:-}"
readonly INSTALLED_CONTROLLER='/usr/local/sbin/pc-tai-release-controller'
readonly AUTHORITY_MANIFEST='/etc/pc-release-authority/actions-runner.json'
readonly SUDOERS_FILE='/etc/sudoers.d/pc-tai-release-controller'
readonly OUTPUT_ROOT='/var/lib/pc-release-authority/runner-output'
readonly REPOSITORY='https://github.com/pachaninm-lab/pachanin-demo'

fail() {
  printf 'ERROR_CODE=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$(id -u)" -eq 0 ]] || fail ROOT_AUTHORITY_REQUIRED 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || fail INVALID_RUN_ID 4
[[ "$EXPECTED_SHA256" =~ ^[0-9a-f]{64}$ ]] || fail INVALID_EXPECTED_CONTROLLER_SHA 5
[[ "$SOURCE_CONTROLLER" == "/tmp/pc-tai-controller-${RUN_ID}.sh" ]] || fail SOURCE_PATH_NOT_BOUNDED 6
[[ -f "$SOURCE_CONTROLLER" && ! -L "$SOURCE_CONTROLLER" ]] || fail SOURCE_CONTROLLER_INVALID 7
[[ "$(sha256sum "$SOURCE_CONTROLLER" | awk '{print $1}')" == "$EXPECTED_SHA256" ]] || fail SOURCE_CONTROLLER_DIGEST_MISMATCH 8
bash -n "$SOURCE_CONTROLLER" || fail SOURCE_CONTROLLER_SYNTAX_INVALID 9

for command in install stat sha256sum python3 visudo sudo id getent find systemctl mv cp rm awk grep; do
  command -v "$command" >/dev/null 2>&1 || fail "REQUIRED_COMMAND_MISSING_${command^^}" 10
done

id pcactions >/dev/null 2>&1 || fail RUNNER_USER_MISSING 11
! id -nG pcactions | tr ' ' '\n' | grep -Fxq docker || fail RUNNER_RETAINS_DOCKER_GROUP 12
[[ -f "$INSTALLED_CONTROLLER" && ! -L "$INSTALLED_CONTROLLER" ]] || fail INSTALLED_CONTROLLER_INVALID 13
[[ "$(stat -c '%U:%G:%a' "$INSTALLED_CONTROLLER")" == root:pcactions:750 ]] || fail INSTALLED_CONTROLLER_PERMISSIONS_INVALID 14
[[ -f "$AUTHORITY_MANIFEST" && ! -L "$AUTHORITY_MANIFEST" ]] || fail AUTHORITY_MANIFEST_INVALID 15
[[ "$(stat -c '%U:%G' "$AUTHORITY_MANIFEST")" == root:root ]] || fail AUTHORITY_MANIFEST_OWNERSHIP_INVALID 16
[[ -f "$SUDOERS_FILE" && ! -L "$SUDOERS_FILE" ]] || fail SUDOERS_FILE_INVALID 17
[[ "$(stat -c '%U:%G:%a' "$SUDOERS_FILE")" == root:root:440 ]] || fail SUDOERS_FILE_PERMISSIONS_INVALID 18
visudo -cf "$SUDOERS_FILE" >/dev/null || fail SUDOERS_FILE_SYNTAX_INVALID 19

runner_name="$(python3 - "$AUTHORITY_MANIFEST" "$REPOSITORY" <<'PY'
import json
import sys
from pathlib import Path

path, repository = sys.argv[1:]
raw = Path(path).read_bytes()
if not raw or len(raw) > 1024 * 1024:
    raise SystemExit(2)
payload = json.loads(raw.decode('utf-8'))
if payload.get('schemaVersion') != 'pc.actions-runner-authority.v3':
    raise SystemExit(3)
if payload.get('repository') != repository:
    raise SystemExit(4)
if payload.get('executionUser') != 'pcactions':
    raise SystemExit(5)
if payload.get('dockerSocketAccess') is not False:
    raise SystemExit(6)
if payload.get('sudoController') != '/usr/local/sbin/pc-tai-release-controller':
    raise SystemExit(7)
name = payload.get('runnerName')
if not isinstance(name, str) or not name.startswith('pc-prod-'):
    raise SystemExit(8)
print(name)
PY
)" || fail AUTHORITY_MANIFEST_BOUNDARY_INVALID 20

service_file="$(find /etc/systemd/system -maxdepth 1 -type f -name "actions.runner.pachaninm-lab-pachanin-demo.${runner_name}.service" -print -quit)"
[[ -n "$service_file" ]] || fail RUNNER_SERVICE_FILE_MISSING 21
service_name="$(basename "$service_file")"
systemctl is-active --quiet "$service_name" || fail RUNNER_SERVICE_NOT_ACTIVE 22
[[ "$(systemctl show "$service_name" --property=User --value)" == pcactions ]] || fail RUNNER_SERVICE_USER_INVALID 23

controller_backup="$(mktemp /usr/local/sbin/.pc-tai-controller.rollback.XXXXXX)"
manifest_backup="$(mktemp /etc/pc-release-authority/.actions-runner.rollback.XXXXXX)"
new_controller="$(mktemp /usr/local/sbin/.pc-tai-controller.new.XXXXXX)"
committed=0

rollback() {
  local rc="$?"
  trap - EXIT
  if (( committed == 0 )); then
    install -m 0750 -o root -g pcactions "$controller_backup" "$INSTALLED_CONTROLLER" >/dev/null 2>&1 || true
    install -m 0644 -o root -g root "$manifest_backup" "$AUTHORITY_MANIFEST" >/dev/null 2>&1 || true
  fi
  rm -f "$controller_backup" "$manifest_backup" "$new_controller" "$SOURCE_CONTROLLER" "/tmp/pc-tai-controller-sync-${RUN_ID}.sh"
  exit "$rc"
}
trap rollback EXIT

cp --preserve=mode,ownership,timestamps "$INSTALLED_CONTROLLER" "$controller_backup"
cp --preserve=mode,ownership,timestamps "$AUTHORITY_MANIFEST" "$manifest_backup"
install -m 0750 -o root -g pcactions "$SOURCE_CONTROLLER" "$new_controller"
[[ "$(sha256sum "$new_controller" | awk '{print $1}')" == "$EXPECTED_SHA256" ]] || fail STAGED_CONTROLLER_DIGEST_MISMATCH 24
mv -f "$new_controller" "$INSTALLED_CONTROLLER"
[[ "$(stat -c '%U:%G:%a' "$INSTALLED_CONTROLLER")" == root:pcactions:750 ]] || fail SYNCHRONIZED_CONTROLLER_PERMISSIONS_INVALID 25
[[ "$(sha256sum "$INSTALLED_CONTROLLER" | awk '{print $1}')" == "$EXPECTED_SHA256" ]] || fail SYNCHRONIZED_CONTROLLER_DIGEST_MISMATCH 26

python3 - "$AUTHORITY_MANIFEST" "$EXPECTED_SHA256" <<'PY'
import json
import os
import sys
import tempfile
from pathlib import Path

path, controller_sha = sys.argv[1:]
manifest = Path(path)
payload = json.loads(manifest.read_text(encoding='utf-8'))
if payload.get('schemaVersion') != 'pc.actions-runner-authority.v3':
    raise SystemExit(2)
if payload.get('sudoController') != '/usr/local/sbin/pc-tai-release-controller':
    raise SystemExit(3)
payload['sudoControllerSha256'] = controller_sha
fd, temporary = tempfile.mkstemp(dir=str(manifest.parent), prefix='.actions-runner.', text=True)
try:
    with os.fdopen(fd, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=True, separators=(',', ':'))
        handle.write('\n')
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(temporary, 0o644)
    os.chown(temporary, 0, 0)
    os.replace(temporary, path)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
PY

recorded_sha="$(python3 - "$AUTHORITY_MANIFEST" <<'PY'
import json
import sys
print(json.load(open(sys.argv[1], encoding='utf-8')).get('sudoControllerSha256', ''))
PY
)"
[[ "$recorded_sha" == "$EXPECTED_SHA256" ]] || fail AUTHORITY_MANIFEST_CONTROLLER_SHA_MISMATCH 27
sudo -u pcactions -H sudo -n -l | grep -Fq "$INSTALLED_CONTROLLER" || fail RUNNER_CONTROLLER_SUDO_AUTHORITY_MISSING 28
if sudo -u pcactions -H docker version >/dev/null 2>&1; then fail RUNNER_DIRECT_DOCKER_AUTHORITY_PRESENT 29; fi

output_dir="$OUTPUT_ROOT/$RUN_ID"
rm -rf "$output_dir"
install -d -m 0750 -o root -g pcactions "$output_dir"
python3 - "$output_dir/controller-sync.json" "$TARGET_SHA" "$EXPECTED_SHA256" "$runner_name" "$service_name" <<'PY'
import json
import os
import sys
from pathlib import Path

path, target_sha, controller_sha, runner_name, service_name = sys.argv[1:]
payload = {
    'schemaVersion': 'tai.controller-sync.v1',
    'targetSha': target_sha,
    'controllerSha256': controller_sha,
    'runnerName': runner_name,
    'runnerService': service_name,
    'installedController': '/usr/local/sbin/pc-tai-release-controller',
    'directDockerAuthority': False,
    'mutationScope': 'EXACT_CONTROLLER_AND_AUTHORITY_MANIFEST_ONLY',
    'status': 'PASS',
}
Path(path).write_text(json.dumps(payload, ensure_ascii=True, separators=(',', ':')) + '\n', encoding='utf-8')
os.chown(path, 0, os.stat(path).st_gid)
os.chmod(path, 0o640)
PY

committed=1
printf 'TAI_CONTROLLER_SYNC=PASS\n'
printf 'TARGET_SHA=%s\n' "$TARGET_SHA"
printf 'CONTROLLER_SHA256=%s\n' "$EXPECTED_SHA256"
cat "$output_dir/controller-sync.json"
