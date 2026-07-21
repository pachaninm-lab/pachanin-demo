MODEL_SSH_USER="${MODEL_SSH_USER:-tai-model}"
MODEL_SSH_PORT="${MODEL_SSH_PORT:-22}"
test "$MODEL_SSH_USER" = 'tai-model'
[[ "$MODEL_SSH_PORT" =~ ^[0-9]{1,5}$ ]]
[[ "$MODEL_HOST" =~ ^[A-Za-z0-9._:-]+$ ]]
if [[ -z "${MODEL_SSH_KEY:-}" && -z "${MODEL_SSH_PASSWORD:-}" ]]; then
  echo 'TAI_MODEL_SSH_CREDENTIALS_ABSENT' >&2
  exit 1
fi
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
ssh-keyscan -p "$MODEL_SSH_PORT" -H "$MODEL_HOST" > "$HOME/.ssh/known_hosts"
chmod 600 "$HOME/.ssh/known_hosts"
SSH_MODE=password
if [[ -n "${MODEL_SSH_KEY:-}" ]]; then
  printf '%s\n' "$MODEL_SSH_KEY" > "$HOME/.ssh/id_tai_model"
  chmod 600 "$HOME/.ssh/id_tai_model"
  SSH_MODE=key
else
  sudo apt-get update -qq
  sudo apt-get install -y -qq sshpass
fi

ssh_command() {
  if [[ "$SSH_MODE" == key ]]; then
    ssh -i "$HOME/.ssh/id_tai_model" -p "$MODEL_SSH_PORT" \
      -o BatchMode=yes -o StrictHostKeyChecking=yes \
      "$MODEL_SSH_USER@$MODEL_HOST" "$@"
  else
    SSHPASS="$MODEL_SSH_PASSWORD" sshpass -e ssh -p "$MODEL_SSH_PORT" \
      -o StrictHostKeyChecking=yes "$MODEL_SSH_USER@$MODEL_HOST" "$@"
  fi
}

scp_file() {
  if [[ "$SSH_MODE" == key ]]; then
    scp -i "$HOME/.ssh/id_tai_model" -P "$MODEL_SSH_PORT" \
      -o BatchMode=yes -o StrictHostKeyChecking=yes \
      "$1" "$MODEL_SSH_USER@$MODEL_HOST:$2"
  else
    SSHPASS="$MODEL_SSH_PASSWORD" sshpass -e scp -P "$MODEL_SSH_PORT" \
      -o StrictHostKeyChecking=yes "$1" "$MODEL_SSH_USER@$MODEL_HOST:$2"
  fi
}

ssh_command "install -d -m 700 '$REMOTE_ROOT/incoming' '$REMOTE_ROOT/control'"
scp_file control-package.tar.gz "$REMOTE_ROOT/incoming/control-package.tar.gz"
scp_file control-package.tar.gz.sha256 "$REMOTE_ROOT/incoming/control-package.tar.gz.sha256"
remote_start="$(cat <<REMOTE
set -euo pipefail
cd '$REMOTE_ROOT/incoming'
sha256sum -c control-package.tar.gz.sha256
rm -rf '$REMOTE_ROOT/control.new'
mkdir -p '$REMOTE_ROOT/control.new'
tar -xzf control-package.tar.gz -C '$REMOTE_ROOT/control.new'
(cd '$REMOTE_ROOT/control.new' && sha256sum -c control-manifest.sha256)
rm -rf '$REMOTE_ROOT/control.previous'
if [ -d '$REMOTE_ROOT/control' ]; then mv '$REMOTE_ROOT/control' '$REMOTE_ROOT/control.previous'; fi
mv '$REMOTE_ROOT/control.new' '$REMOTE_ROOT/control'
state="\$(python3 -c 'import json; from pathlib import Path; p=Path("$REMOTE_ROOT/status.json"); print(json.loads(p.read_text()).get("state", "")) if p.exists() else print("")')"
if [ "\$state" = COMPLETE ]; then exit 0; fi
if [ -f '$REMOTE_ROOT/driver.pid' ] && kill -0 "\$(cat '$REMOTE_ROOT/driver.pid')" 2>/dev/null; then exit 0; fi
nohup bash '$REMOTE_ROOT/control/model-conversion-driver.v1.sh' '$REMOTE_ROOT' > '$REMOTE_ROOT/bootstrap.log' 2>&1 < /dev/null &
echo \$! > '$REMOTE_ROOT/driver.pid'
REMOTE
)"
ssh_command "bash -s" <<< "$remote_start"

MONITOR_STATE=TIMEOUT
for attempt in $(seq 1 330); do
  command="python3 -c 'import json; from pathlib import Path; p=Path(\"$REMOTE_ROOT/status.json\"); print(json.loads(p.read_text()).get(\"state\", \"PENDING\")) if p.exists() else print(\"PENDING\")'"
  state="$(ssh_command "$command" 2>/dev/null || echo UNREACHABLE)"
  printf 'poll=%s state=%s\n' "$attempt" "$state"
  case "$state" in
    COMPLETE|FAILED_CLOSED)
      MONITOR_STATE="$state"
      break
      ;;
  esac
  sleep 60
done

remote_archive="set -euo pipefail; cd '$REMOTE_ROOT'; test -f status.json; tar -czf - status.json evidence logs bootstrap.log driver.log 2>/dev/null"
ssh_command "$remote_archive" > remote-evidence.tar.gz
test -s remote-evidence.tar.gz
if tar -tzf remote-evidence.tar.gz | grep -E '(^/|(^|/)\.\.(/|$))'; then
  echo 'Unsafe remote evidence path.' >&2
  exit 1
fi
tar -xzf remote-evidence.tar.gz -C remote-evidence
if find remote-evidence -type f -size +50000000c -print -quit | grep -q .; then
  echo 'Oversized metadata evidence.' >&2
  exit 1
fi

test "$MONITOR_STATE" = COMPLETE
python - <<'PY'
import hashlib
import json
import os
import re
from pathlib import Path

authority = json.loads(Path('control-package/model-conversion-authority.v1.json').read_text())
report = json.loads(Path('remote-evidence/evidence/conversion-report.json').read_text())
status = json.loads(Path('remote-evidence/status.json').read_text())
assert status['state'] == 'COMPLETE'
assert report['schema_version'] == 'tai.model-conversion-report.v1'
assert report['status'] == authority['result']['complete_status']
assert report['exact_main_sha'] == os.environ['GITHUB_SHA']
assert report['workflow_run_id'] == int(os.environ['GITHUB_RUN_ID'])
assert report['workflow_run_attempt'] == int(os.environ['GITHUB_RUN_ATTEMPT'])
assert report['host_role'] == 'DEDICATED_MODEL_HOST'
assert report['workspace_root'] == '/srv/tai-models'
assert report['legal_review_status'] == 'ALL_APPROVED_FOR_CONVERSION'
assert report['source_acceptance_status'] == 'VERIFIED_SOURCE_RESTORED_LEGAL_PENDING'
assert report['toolchain_status'] == 'VERIFIED_RESTORED'
assert report['benchmark_status'] == 'NOT_RUN'
assert report['model_admission_status'] == 'NOT_DONE'
assert report['production_operational_status'] == 'NOT_ATTESTED'
assert report['reasons'] == []
expected_outputs = {m['intermediate']['path'] for m in authority['models']} | {
    q['path'] for m in authority['models'] for q in m['quantizations']
}
assert {item['path'] for item in report['outputs']} == expected_outputs
for item in report['outputs']:
    assert re.fullmatch(r'[0-9a-f]{64}', item['sha256'])
    assert item['size_bytes'] > 1_000_000
expected_steps = {}
for model in authority['models']:
    expected_steps[f"{model['key']}-convert"] = model['conversion_argv']
    for quantization in model['quantizations']:
        suffix = quantization['quantization'].lower().replace('_', '-')
        expected_steps[f"{model['key']}-{suffix}"] = quantization['argv']
observed = {item['step_key']: item for item in report['steps']}
assert set(observed) == set(expected_steps)
for key, argv in expected_steps.items():
    assert observed[key]['status'] == 'COMPLETE'
    assert observed[key]['exit_code'] == 0
    assert observed[key]['argv'] == argv
models = {item['model_id']: item for item in report['source_verification']['models']}
for model in authority['models']:
    seen = models[model['model_id']]
    assert seen['revision'] == model['revision']
    assert seen['source_files_sha256'] == model['source_files_sha256']
    assert seen['source_manifest_sha256'] == model['source_manifest_sha256']
claimed = report.pop('report_sha256')
rendered = json.dumps(report, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
assert claimed == hashlib.sha256(rendered.encode()).hexdigest()
PY

MONITOR_STATE=COMPLETE
write_summary
trap - EXIT
