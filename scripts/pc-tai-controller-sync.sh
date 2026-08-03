#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
SOURCE_FILE="${3:-}"
OUTPUT_FILE="${4:-}"

readonly REPOSITORY_URL='https://github.com/pachaninm-lab/pachanin-demo.git'
readonly REPOSITORY_ROOT='/var/lib/pc-release-authority/repository'
readonly CONTROLLER_RELATIVE='scripts/pc-tai-release-controller.sh'
readonly CONTROLLER_TARGET='/usr/local/sbin/pc-tai-release-controller'
readonly MARKER='/etc/pc-release-authority/actions-runner.json'
readonly SUDOERS='/etc/sudoers.d/pc-tai-release-controller'
readonly RUNNER_USER='pcactions'

fail() {
  printf 'TAI_CONTROLLER_SYNC_ERROR=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$(id -u)" -eq 0 ]] || fail ROOT_AUTHORITY_REQUIRED 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || fail INVALID_RUN_ID 4
[[ "$SOURCE_FILE" == "/tmp/pc-tai-controller-${RUN_ID}.sh" ]] || fail INVALID_SOURCE_PATH 5
[[ "$OUTPUT_FILE" == "/var/lib/pc-release-authority/runner-output/${RUN_ID}/controller-sync.json" ]] || fail INVALID_OUTPUT_PATH 6

for command in git sha256sum install stat python3 visudo sudo id bash find readlink; do
  command -v "$command" >/dev/null 2>&1 || fail "COMMAND_MISSING_${command^^}" 7
done
id "$RUNNER_USER" >/dev/null 2>&1 || fail RUNNER_USER_MISSING 8
[[ -f "$SOURCE_FILE" && ! -L "$SOURCE_FILE" ]] || fail SOURCE_FILE_INVALID 9
[[ "$(stat -c '%U:%G' "$SOURCE_FILE")" == root:root ]] || fail SOURCE_FILE_OWNER_INVALID 10
[[ -d "$REPOSITORY_ROOT/.git" && ! -L "$REPOSITORY_ROOT" ]] || fail PROTECTED_REPOSITORY_INVALID 11
[[ "$(stat -c '%U:%G:%a' "$REPOSITORY_ROOT")" == root:root:700 ]] || fail PROTECTED_REPOSITORY_PERMISSIONS_INVALID 12
[[ "$(git -C "$REPOSITORY_ROOT" remote get-url origin)" == "$REPOSITORY_URL" ]] || fail PROTECTED_REPOSITORY_REMOTE_INVALID 13

git -C "$REPOSITORY_ROOT" fetch --force --prune --no-tags origin '+refs/heads/main:refs/remotes/origin/main' >/dev/null
[[ "$(git -C "$REPOSITORY_ROOT" rev-parse refs/remotes/origin/main)" == "$TARGET_SHA" ]] || fail TARGET_IS_NOT_CURRENT_MAIN 14
git -C "$REPOSITORY_ROOT" checkout --force --detach "$TARGET_SHA" >/dev/null
git -C "$REPOSITORY_ROOT" clean -ffdx >/dev/null
[[ "$(git -C "$REPOSITORY_ROOT" rev-parse HEAD)" == "$TARGET_SHA" ]] || fail PROTECTED_CHECKOUT_MISMATCH 15
[[ -z "$(git -C "$REPOSITORY_ROOT" status --porcelain=v1)" ]] || fail PROTECTED_CHECKOUT_DIRTY 16

expected_source="$REPOSITORY_ROOT/$CONTROLLER_RELATIVE"
[[ -f "$expected_source" && ! -L "$expected_source" ]] || fail EXPECTED_CONTROLLER_INVALID 17
expected_sha="$(sha256sum "$expected_source" | awk '{print $1}')"
uploaded_sha="$(sha256sum "$SOURCE_FILE" | awk '{print $1}')"
[[ "$expected_sha" =~ ^[0-9a-f]{64}$ && "$uploaded_sha" == "$expected_sha" ]] || fail UPLOADED_CONTROLLER_NOT_EXACT_TARGET 18
bash -n "$SOURCE_FILE"

[[ -f "$CONTROLLER_TARGET" && ! -L "$CONTROLLER_TARGET" ]] || fail INSTALLED_CONTROLLER_INVALID 19
[[ "$(stat -c '%U:%G:%a' "$CONTROLLER_TARGET")" == root:${RUNNER_USER}:750 ]] || fail INSTALLED_CONTROLLER_PERMISSIONS_INVALID 20
[[ -f "$MARKER" && ! -L "$MARKER" ]] || fail RUNNER_MARKER_INVALID 21
[[ "$(stat -c '%U:%G:%a' "$MARKER")" == root:root:644 ]] || fail RUNNER_MARKER_PERMISSIONS_INVALID 22
[[ -f "$SUDOERS" && ! -L "$SUDOERS" ]] || fail SUDOERS_INVALID 23
[[ "$(stat -c '%U:%G:%a' "$SUDOERS")" == root:root:440 ]] || fail SUDOERS_PERMISSIONS_INVALID 24
visudo -cf "$SUDOERS" >/dev/null
sudo -u "$RUNNER_USER" -H sudo -n -l | grep -Fq "$CONTROLLER_TARGET" || fail CONTROLLER_SUDO_AUTHORITY_INVALID 25
if sudo -u "$RUNNER_USER" -H docker version >/dev/null 2>&1; then fail RUNNER_DIRECT_DOCKER_AUTHORITY_PRESENT 26; fi
! id -nG "$RUNNER_USER" | tr ' ' '\n' | grep -Fxq docker || fail RUNNER_DOCKER_GROUP_PRESENT 27

previous_sha="$(sha256sum "$CONTROLLER_TARGET" | awk '{print $1}')"
marker_previous_sha="$(python3 - "$MARKER" <<'PY_READ'
import json,sys
path=sys.argv[1]
with open(path,encoding='utf-8') as handle:
    payload=json.load(handle)
required={
    'schemaVersion':'pc.actions-runner-authority.v3',
    'repository':'https://github.com/pachaninm-lab/pachanin-demo',
    'executionUser':'pcactions',
    'transport':'OUTBOUND_ONLY_HTTPS',
    'productionInboundSshRequired':False,
    'dockerSocketAccess':False,
    'sudoController':'/usr/local/sbin/pc-tai-release-controller',
}
if not isinstance(payload,dict): raise SystemExit(2)
for key,value in required.items():
    if payload.get(key) != value: raise SystemExit(3)
labels=payload.get('labels')
if not isinstance(labels,list) or set(labels) != {'self-hosted','linux','x64','pc-prod','tai-readonly'}:
    raise SystemExit(4)
value=payload.get('sudoControllerSha256')
if not isinstance(value,str) or len(value) != 64 or any(ch not in '0123456789abcdef' for ch in value):
    raise SystemExit(5)
print(value)
PY_READ
)" || fail RUNNER_MARKER_CONTENT_INVALID 28

install -d -m 0750 -o root -g "$RUNNER_USER" "$(dirname "$OUTPUT_FILE")"
backup_dir="$(mktemp -d /var/lib/pc-release-authority/.controller-sync.XXXXXX)"
controller_backup="$backup_dir/controller"
marker_backup="$backup_dir/marker.json"
cp --preserve=mode,ownership,timestamps "$CONTROLLER_TARGET" "$controller_backup"
cp --preserve=mode,ownership,timestamps "$MARKER" "$marker_backup"
mutated=0
succeeded=0
cleanup() {
  local rc="$?"
  trap - EXIT
  if (( succeeded == 0 && mutated == 1 )); then
    install -m 0750 -o root -g "$RUNNER_USER" "$controller_backup" "$CONTROLLER_TARGET" || true
    install -m 0644 -o root -g root "$marker_backup" "$MARKER" || true
  fi
  rm -rf "$backup_dir"
  rm -f "$SOURCE_FILE"
  exit "$rc"
}
trap cleanup EXIT

status='ALREADY_EXACT'
if [[ "$previous_sha" != "$expected_sha" ]]; then
  staged="$(mktemp /usr/local/sbin/.pc-tai-release-controller.XXXXXX)"
  install -m 0750 -o root -g "$RUNNER_USER" "$SOURCE_FILE" "$staged"
  [[ "$(sha256sum "$staged" | awk '{print $1}')" == "$expected_sha" ]] || fail STAGED_CONTROLLER_DIGEST_MISMATCH 29
  mv -f "$staged" "$CONTROLLER_TARGET"
  mutated=1
  status='UPDATED'
fi

python3 - "$MARKER" "$expected_sha" <<'PY_WRITE'
import json,os,sys,tempfile
path,digest=sys.argv[1:]
with open(path,encoding='utf-8') as handle:
    payload=json.load(handle)
if payload.get('sudoController') != '/usr/local/sbin/pc-tai-release-controller':
    raise SystemExit(2)
payload['sudoControllerSha256']=digest
fd,tmp=tempfile.mkstemp(dir=os.path.dirname(path),prefix='.actions-runner.',text=True)
try:
    with os.fdopen(fd,'w',encoding='utf-8') as handle:
        json.dump(payload,handle,ensure_ascii=True,separators=(',',':'))
        handle.write('\n'); handle.flush(); os.fsync(handle.fileno())
    os.chmod(tmp,0o644)
    os.chown(tmp,0,0)
    os.replace(tmp,path)
finally:
    if os.path.exists(tmp): os.unlink(tmp)
PY_WRITE
mutated=1

[[ "$(stat -c '%U:%G:%a' "$CONTROLLER_TARGET")" == root:${RUNNER_USER}:750 ]]
[[ "$(sha256sum "$CONTROLLER_TARGET" | awk '{print $1}')" == "$expected_sha" ]]
bash -n "$CONTROLLER_TARGET"
marker_current_sha="$(python3 - "$MARKER" <<'PY_VERIFY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as handle: payload=json.load(handle)
print(payload.get('sudoControllerSha256',''))
PY_VERIFY
)"
[[ "$marker_current_sha" == "$expected_sha" ]]
visudo -cf "$SUDOERS" >/dev/null
sudo -u "$RUNNER_USER" -H sudo -n -l | grep -Fq "$CONTROLLER_TARGET"
if sudo -u "$RUNNER_USER" -H docker version >/dev/null 2>&1; then fail RUNNER_DIRECT_DOCKER_AUTHORITY_PRESENT_AFTER_SYNC 30; fi

python3 - "$OUTPUT_FILE" "$TARGET_SHA" "$RUN_ID" "$status" "$previous_sha" "$expected_sha" "$marker_previous_sha" <<'PY_EVIDENCE'
import json,os,sys
path,target,run_id,status,previous,current,marker_previous=sys.argv[1:]
payload={
    'schemaVersion':'tai.controller-sync.v1',
    'targetSha':target,
    'runId':run_id,
    'hosting':'REG_RU_VPS_ONLY',
    'newRecurringCostRub':0,
    'status':status,
    'controllerPath':'/usr/local/sbin/pc-tai-release-controller',
    'previousSha256':previous,
    'currentSha256':current,
    'markerPreviousSha256':marker_previous,
    'markerCurrentSha256':current,
    'owner':'root',
    'group':'pcactions',
    'mode':'0750',
    'runnerDirectDockerAuthority':False,
    'runnerDockerGroupMembership':False,
    'rollbackPrepared':True,
    'passed':True,
}
with open(path,'w',encoding='utf-8') as handle:
    json.dump(payload,handle,sort_keys=True,separators=(',',':')); handle.write('\n')
os.chmod(path,0o640); os.chown(path,0,0)
PY_EVIDENCE
chown root:"$RUNNER_USER" "$OUTPUT_FILE"
succeeded=1

echo "TAI_CONTROLLER_SYNC_STATUS=$status"
echo "TAI_CONTROLLER_SYNC_SHA256=$expected_sha"
echo 'TAI_CONTROLLER_SYNC_COMPLETE=1'
