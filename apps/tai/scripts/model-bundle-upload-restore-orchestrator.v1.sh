#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

REPORT_ROOT="${REPORT_ROOT:-bundle-finalization}"
AUTHORITY="${AUTHORITY:-apps/tai/model-artifacts/model-bundle-upload-restore-authority.v1.json}"
BUNDLE_AUTHORITY="${BUNDLE_AUTHORITY:-apps/tai/model-artifacts/model-bundle-authority.v2.json}"
CONVERSION_AUTHORITY="${CONVERSION_AUTHORITY:-apps/tai/model-artifacts/model-conversion-authority.v1.json}"

mkdir -p "$REPORT_ROOT/release" "$REPORT_ROOT/preflight/raw" \
  "$REPORT_ROOT/conversion" "$REPORT_ROOT/source-artifacts" \
  "$REPORT_ROOT/control" "$REPORT_ROOT/remote"
chmod -R 700 "$REPORT_ROOT"

LOCAL_SECRET_FILE="$REPORT_ROOT/remote/s3-secrets.env"
SSH_KEY_FILE="$HOME/.ssh/id_tai_model"

cleanup_local_secrets() {
  set +e
  if [[ -f "$LOCAL_SECRET_FILE" ]]; then
    dd if=/dev/zero of="$LOCAL_SECRET_FILE" bs=4096 count=1 conv=notrunc status=none 2>/dev/null
    rm -f "$LOCAL_SECRET_FILE"
  fi
  if [[ -f "$SSH_KEY_FILE" ]]; then
    dd if=/dev/zero of="$SSH_KEY_FILE" bs=4096 count=1 conv=notrunc status=none 2>/dev/null
    rm -f "$SSH_KEY_FILE"
  fi
}

write_failure() {
  local code=$?
  trap - ERR
  CODE="$code" REPORT_ROOT="$REPORT_ROOT" python - <<'PY'
import json
import os
from pathlib import Path
path = Path(os.environ['REPORT_ROOT']) / 'orchestrator-status.json'
payload = {
    'schema_version': 'tai.model-bundle-finalization-orchestrator-status.v1',
    'status': 'FAILED_CLOSED',
    'exit_code': int(os.environ['CODE']),
    'exact_main_sha': os.environ.get('GITHUB_SHA'),
    'workflow_run_id': int(os.environ.get('GITHUB_RUN_ID', '0')),
    'workflow_run_attempt': int(os.environ.get('GITHUB_RUN_ATTEMPT', '0')),
    'benchmark_status': 'NOT_RUN',
    'model_admission_status': 'NOT_DONE',
    'production_operational_status': 'NOT_ATTESTED',
}
path.write_text(json.dumps(payload, indent=2, sort_keys=True) + '\n')
PY
  cleanup_local_secrets
  exit "$code"
}
trap write_failure ERR
trap cleanup_local_secrets EXIT

for name in \
  GH_TOKEN REPOSITORY GITHUB_SHA GITHUB_RUN_ID GITHUB_RUN_ATTEMPT \
  MODEL_HOST MODEL_SSH_USER MODEL_SSH_PORT MODEL_SSH_KEY \
  S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY_ID \
  S3_SECRET_ACCESS_KEY S3_PREFIX S3_CAPACITY_BYTES S3_PRINCIPAL_ID; do
  test -n "${!name:-}"
done
for command_name in gh jq curl aws python unzip tar ssh scp ssh-keyscan sha256sum; do
  command -v "$command_name" >/dev/null
done
[[ "$GITHUB_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$MODEL_SSH_PORT" =~ ^[0-9]{1,5}$ ]]
[[ "$MODEL_HOST" =~ ^[A-Za-z0-9._:-]+$ ]]
[[ "$MODEL_SSH_USER" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
test "$MODEL_SSH_USER" = 'tai-model'

python -m tai.model_bundle_finalize_cli validate-authority \
  "$AUTHORITY" --output "$REPORT_ROOT/authority-validation.json"

python - <<'PY'
import json
import os
import re
from pathlib import PurePosixPath
from urllib.parse import urlsplit
authority = json.load(open(os.environ['AUTHORITY']))
endpoint = urlsplit(os.environ['S3_ENDPOINT'])
assert endpoint.scheme == 'https' and endpoint.hostname
assert endpoint.username is None and endpoint.password is None
assert endpoint.path in {'', '/'} and not endpoint.query and not endpoint.fragment
assert re.fullmatch(r'[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]', os.environ['S3_BUCKET'])
prefix = os.environ['S3_PREFIX']
path = PurePosixPath(prefix)
assert prefix and not prefix.startswith('/') and not prefix.endswith('/')
assert path.as_posix() == prefix and '..' not in path.parts
assert os.environ['S3_CAPACITY_BYTES'].isdigit()
assert int(os.environ['S3_CAPACITY_BYTES']) >= 120_000_000_000
assert re.fullmatch(r'[A-Za-z0-9_-]{8,128}', os.environ['S3_PRINCIPAL_ID'])
assert authority['result']['production_operational_status'] == 'NOT_ATTESTED'
PY

selected=
for attempt in $(seq 1 180); do
  gh api -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    "repos/$REPOSITORY/actions/runs?head_sha=$GITHUB_SHA&per_page=100" \
    > "$REPORT_ROOT/release/runs.json"
  set +e
  REPORT_ROOT="$REPORT_ROOT" python - <<'PY'
import json
import os
from pathlib import Path
exact = os.environ['GITHUB_SHA']
runs = json.loads(Path(os.environ['REPORT_ROOT'] + '/release/runs.json').read_text()).get('workflow_runs', [])
candidates = [
    run for run in runs
    if run.get('name') == 'TAI Release Acceptance'
    and run.get('path') == '.github/workflows/tai-release-acceptance.yml'
    and run.get('head_sha') == exact
    and run.get('head_branch') == 'main'
    and run.get('event') in {'push', 'workflow_dispatch'}
]
if not candidates:
    raise SystemExit(3)
run = max(candidates, key=lambda item: (item.get('run_number', 0), item.get('id', 0)))
if run.get('status') != 'completed':
    raise SystemExit(3)
if run.get('conclusion') != 'success':
    raise SystemExit(2)
Path(os.environ['REPORT_ROOT'] + '/release/selected-run.json').write_text(
    json.dumps(run, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
)
PY
  status=$?
  set -e
  if [[ "$status" -eq 0 ]]; then selected=yes; break; fi
  if [[ "$status" -eq 2 ]]; then
    echo 'Exact-main TAI Release Acceptance failed.' >&2
    exit 1
  fi
  if [[ "$attempt" -eq 180 ]]; then
    echo 'Exact-main TAI Release Acceptance is pending or absent.' >&2
    exit 1
  fi
  sleep 20
done
test "$selected" = yes

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$S3_REGION"
export AWS_EC2_METADATA_DISABLED=true AWS_RETRY_MODE=standard AWS_MAX_ATTEMPTS=5 AWS_PAGER=''
root="$REPORT_ROOT/preflight/raw"
endpoint=(--endpoint-url "$S3_ENDPOINT" --region "$S3_REGION")
common=(--cli-connect-timeout 20 --cli-read-timeout 120)
run_status() {
  local name="$1"
  shift
  set +e
  "$@" > "$root/${name}.json" 2> "$root/${name}.stderr"
  local status=$?
  set -e
  printf '%s\n' "$status" > "$root/${name}.exit"
}
run_status head_bucket aws "${endpoint[@]}" "${common[@]}" s3api head-bucket --bucket "$S3_BUCKET"
run_status get_bucket_versioning aws "${endpoint[@]}" "${common[@]}" s3api get-bucket-versioning --bucket "$S3_BUCKET"
run_status get_object_lock_configuration aws "${endpoint[@]}" "${common[@]}" s3api get-object-lock-configuration --bucket "$S3_BUCKET"
run_status get_bucket_policy aws "${endpoint[@]}" "${common[@]}" s3api get-bucket-policy --bucket "$S3_BUCKET"
run_status list_objects_v2 aws "${endpoint[@]}" "${common[@]}" s3api list-objects-v2 --bucket "$S3_BUCKET" --prefix "$S3_PREFIX/" --max-keys 1
run_status list_object_versions aws "${endpoint[@]}" "${common[@]}" s3api list-object-versions --bucket "$S3_BUCKET" --prefix "$S3_PREFIX/" --max-keys 1
anonymous_url="${S3_ENDPOINT%/}/$S3_BUCKET?list-type=2&max-keys=1"
set +e
anonymous_status="$(curl --silent --show-error --output "$root/anonymous-list.body" --write-out '%{http_code}' --connect-timeout 20 --max-time 60 "$anonymous_url")"
anonymous_exit=$?
set -e
printf '%s\n' "$anonymous_status" > "$root/anonymous_list_http_status.txt"
printf '%s\n' "$anonymous_exit" > "$root/anonymous_list_probe.exit"
aws --version > "$root/aws-version.txt" 2>&1

REPORT_ROOT="$REPORT_ROOT" python - <<'PY'
import json
import os
from pathlib import Path
root = Path(os.environ['REPORT_ROOT']) / 'preflight/raw'
names = [
    'head_bucket', 'get_bucket_versioning', 'get_object_lock_configuration',
    'get_bucket_policy', 'list_objects_v2', 'list_object_versions',
    'anonymous_list_probe',
]
def ok(name: str) -> bool:
    path = root / f'{name}.exit'
    return path.exists() and path.read_text().strip() == '0'
def object_json(name: str) -> dict[str, object]:
    path = root / f'{name}.json'
    if not path.exists() or not path.read_text().strip():
        return {}
    try:
        value = json.loads(path.read_text())
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}
wrapper = object_json('get_bucket_policy')
raw = wrapper.get('Policy')
if isinstance(raw, str):
    try:
        policy = json.loads(raw)
    except json.JSONDecodeError:
        policy = {}
elif isinstance(raw, dict):
    policy = raw
else:
    policy = {}
payload = {
    'schema_version': 'tai.model-bundle-s3-preflight-observed.v1',
    'provider_profile': 'SELECTEL_S3_2026',
    'endpoint': os.environ['S3_ENDPOINT'],
    'region': os.environ['S3_REGION'],
    'bucket': os.environ['S3_BUCKET'],
    'prefix': os.environ['S3_PREFIX'],
    'operator_confirmed_capacity_bytes': os.environ['S3_CAPACITY_BYTES'],
    'commands': {name: ok(name) for name in names},
    'versioning': object_json('get_bucket_versioning'),
    'object_lock': object_json('get_object_lock_configuration'),
    'anonymous_list_http_status': (root / 'anonymous_list_http_status.txt').read_text().strip(),
    'policy': policy,
    'aws_cli_identity': (root / 'aws-version.txt').read_text(errors='replace')[:500],
    'mutation_mode': 'READ_ONLY',
}
out = Path(os.environ['REPORT_ROOT']) / 'preflight/observed.json'
out.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + '\n')
PY
python -m tai.model_bundle_s3_preflight_cli \
  apps/tai/model-artifacts/model-bundle-s3-preflight-requirements.v1.json \
  "$REPORT_ROOT/preflight/observed.json" \
  --exact-main "$GITHUB_SHA" \
  --workflow-run-id "$GITHUB_RUN_ID" \
  --workflow-run-attempt "$GITHUB_RUN_ATTEMPT" \
  --output "$REPORT_ROOT/preflight/report.json"
test "$(jq -r '.status' "$REPORT_ROOT/preflight/report.json")" = 'READY_FOR_BUNDLE_UPLOAD'
test "$(jq -r '.reasons | length' "$REPORT_ROOT/preflight/report.json")" = '0'
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

artifact_id="$(jq -r '.conversion_run.evidence_artifact.id' "$AUTHORITY")"
expected_digest="$(jq -r '.conversion_run.evidence_artifact.digest' "$AUTHORITY")"
gh api -H 'Accept: application/vnd.github+json' \
  "repos/$REPOSITORY/actions/artifacts/$artifact_id" \
  > "$REPORT_ROOT/conversion/artifact.json"
test "$(jq -r '.expired' "$REPORT_ROOT/conversion/artifact.json")" = 'false'
test "$(jq -r '.digest' "$REPORT_ROOT/conversion/artifact.json")" = "$expected_digest"
gh api "repos/$REPOSITORY/actions/artifacts/$artifact_id/zip" \
  > "$REPORT_ROOT/conversion/artifact.zip"
test "sha256:$(sha256sum "$REPORT_ROOT/conversion/artifact.zip" | awk '{print $1}')" = "$expected_digest"
mkdir -p "$REPORT_ROOT/conversion/content"
unzip -q "$REPORT_ROOT/conversion/artifact.zip" -d "$REPORT_ROOT/conversion/content"
report="$(find "$REPORT_ROOT/conversion/content" -type f -name conversion-report.json -print -quit)"
test -n "$report"
REPORT="$report" python - <<'PY'
import hashlib
import json
import os
from pathlib import Path
authority = json.loads(Path(os.environ['AUTHORITY']).read_text())
path = Path(os.environ['REPORT'])
report = json.loads(path.read_text())
expected = authority['conversion_run']
assert hashlib.sha256(path.read_bytes()).hexdigest() == expected['report_sha256']
assert report['status'] == expected['status']
assert report['exact_main_sha'] == expected['exact_main_sha']
assert report['workflow_run_id'] == expected['workflow_run_id']
assert report['workflow_run_attempt'] == expected['workflow_run_attempt']
assert len(report['steps']) == 5
assert all(item['status'] == 'COMPLETE' for item in report['steps'])
assert report['benchmark_status'] == 'NOT_RUN'
assert report['model_admission_status'] == 'NOT_DONE'
assert report['production_operational_status'] == 'NOT_ATTESTED'
PY

jq -r '.models[] | [.key, (.metadata_artifact_id | tostring), .metadata_artifact_digest] | @tsv' \
  "$CONVERSION_AUTHORITY" > "$REPORT_ROOT/source-artifacts/artifacts.tsv"
while IFS=$'\t' read -r key source_artifact_id source_expected_digest; do
  source_root="$REPORT_ROOT/source-artifacts/$key"
  mkdir -p "$source_root/content"
  gh api -H 'Accept: application/vnd.github+json' \
    "repos/$REPOSITORY/actions/artifacts/$source_artifact_id" > "$source_root/artifact.json"
  test "$(jq -r '.expired' "$source_root/artifact.json")" = 'false'
  test "$(jq -r '.digest' "$source_root/artifact.json")" = "sha256:$source_expected_digest"
  gh api "repos/$REPOSITORY/actions/artifacts/$source_artifact_id/zip" > "$source_root/artifact.zip"
  test "$(sha256sum "$source_root/artifact.zip" | awk '{print $1}')" = "$source_expected_digest"
  unzip -q "$source_root/artifact.zip" -d "$source_root/content"
  for name in remote-inventory.json source-manifest.json acquisition-report.json; do
    path="$(find "$source_root/content" -type f -name "$name" -print -quit)"
    test -n "$path"
    cp "$path" "$source_root/$name"
  done
done < "$REPORT_ROOT/source-artifacts/artifacts.tsv"

control="$REPORT_ROOT/control"
mkdir -p \
  "$control/apps/tai" \
  "$control/apps/tai/scripts" \
  "$control/apps/tai/model-artifacts/legal-reviews" \
  "$control/source-metadata/qwen3-8b" \
  "$control/source-metadata/mistral-7b-instruct-v0.3" \
  "$control/s3-preflight" \
  "$control/license"
cp -R apps/tai/tai "$control/apps/tai/"
cp apps/tai/scripts/model-bundle-s3-multipart.py "$control/apps/tai/scripts/"
cp apps/tai/scripts/model-bundle-upload-restore-driver.v1.sh "$control/apps/tai/scripts/"
cp "$AUTHORITY" "$control/apps/tai/model-artifacts/"
cp "$BUNDLE_AUTHORITY" "$control/apps/tai/model-artifacts/"
cp "$CONVERSION_AUTHORITY" "$control/apps/tai/model-artifacts/"
cp apps/tai/model-artifacts/llama-cpp-build-acceptance.v1.json "$control/apps/tai/model-artifacts/"
cp apps/tai/model-artifacts/legal-reviews/qwen3-8b.review-record.v1.json "$control/apps/tai/model-artifacts/legal-reviews/"
cp apps/tai/model-artifacts/legal-reviews/mistral-7b-instruct-v0.3.review-record.v1.json "$control/apps/tai/model-artifacts/legal-reviews/"
for key in qwen3-8b mistral-7b-instruct-v0.3; do
  cp "$REPORT_ROOT/source-artifacts/$key/remote-inventory.json" "$control/source-metadata/$key/"
  cp "$REPORT_ROOT/source-artifacts/$key/source-manifest.json" "$control/source-metadata/$key/"
done
cp "$REPORT_ROOT/preflight/report.json" "$control/s3-preflight/"
curl --fail --silent --show-error --location \
  --proto '=https' --tlsv1.2 --retry 6 --retry-all-errors --max-time 90 \
  https://www.apache.org/licenses/LICENSE-2.0.txt \
  --output "$control/license/LICENSE-2.0.txt"
test "$(sha256sum "$control/license/LICENSE-2.0.txt" | awk '{print $1}')" = \
  'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'
(
  cd "$control"
  find . -type f ! -name control-manifest.sha256 -print0 \
    | LC_ALL=C sort -z \
    | xargs -0 sha256sum > control-manifest.sha256
)
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner \
  -C "$control" -czf "$REPORT_ROOT/control-package.tar.gz" .
test "$(stat -c %s "$REPORT_ROOT/control-package.tar.gz")" -lt 100000000

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
printf '%s\n' "$MODEL_SSH_KEY" > "$SSH_KEY_FILE"
chmod 600 "$SSH_KEY_FILE"
ssh-keyscan -p "$MODEL_SSH_PORT" -H "$MODEL_HOST" > "$HOME/.ssh/known_hosts"
chmod 600 "$HOME/.ssh/known_hosts"

SECRET_PATH="$LOCAL_SECRET_FILE" \
TAI_BUNDLE_S3_ENDPOINT="$S3_ENDPOINT" \
TAI_BUNDLE_S3_REGION="$S3_REGION" \
TAI_BUNDLE_S3_BUCKET="$S3_BUCKET" \
TAI_BUNDLE_S3_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
TAI_BUNDLE_S3_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
TAI_BUNDLE_S3_PREFIX="$S3_PREFIX" python - <<'PY'
import os
import shlex
from pathlib import Path
names = [
    'TAI_BUNDLE_S3_ENDPOINT', 'TAI_BUNDLE_S3_REGION',
    'TAI_BUNDLE_S3_BUCKET', 'TAI_BUNDLE_S3_ACCESS_KEY_ID',
    'TAI_BUNDLE_S3_SECRET_ACCESS_KEY', 'TAI_BUNDLE_S3_PREFIX',
]
path = Path(os.environ['SECRET_PATH'])
path.write_text(
    ''.join(f'export {name}={shlex.quote(os.environ[name])}\n' for name in names),
    encoding='utf-8',
)
path.chmod(0o600)
PY

REMOTE_BASE="/srv/tai-models/finalization-controls/$GITHUB_SHA/$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
ssh_opts=(-i "$SSH_KEY_FILE" -p "$MODEL_SSH_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes)
scp_opts=(-i "$SSH_KEY_FILE" -P "$MODEL_SSH_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes)
ssh "${ssh_opts[@]}" "$MODEL_SSH_USER@$MODEL_HOST" "install -d -m 700 '$REMOTE_BASE'"
scp "${scp_opts[@]}" "$REPORT_ROOT/control-package.tar.gz" \
  "$MODEL_SSH_USER@$MODEL_HOST:$REMOTE_BASE/control-package.tar.gz"
scp "${scp_opts[@]}" "$LOCAL_SECRET_FILE" \
  "$MODEL_SSH_USER@$MODEL_HOST:$REMOTE_BASE/s3-secrets.env"
ssh "${ssh_opts[@]}" "$MODEL_SSH_USER@$MODEL_HOST" bash -s -- \
  "$REMOTE_BASE" "$GITHUB_SHA" "$GITHUB_RUN_ID" "$GITHUB_RUN_ATTEMPT" <<'REMOTE'
set -Eeuo pipefail
remote_base="$1"
exact_main="$2"
run_id="$3"
attempt="$4"
package="$remote_base/control-package.tar.gz"
control="$remote_base/control"
secrets="$remote_base/s3-secrets.env"
test "$(id -un)" = 'tai-model'
test -f "$package"
test -f "$secrets"
chmod 600 "$package" "$secrets"
if tar -tzf "$package" | grep -E '(^/|(^|/)\.\.(/|$))'; then
  echo 'unsafe path in finalization control package' >&2
  exit 1
fi
mkdir -p "$control"
chmod 700 "$control"
tar -xzf "$package" -C "$control"
rm -f "$package"
bash "$control/apps/tai/scripts/model-bundle-upload-restore-driver.v1.sh" \
  "$control" "$secrets" "$exact_main" "$run_id" "$attempt"
REMOTE

conversion_root="$(jq -r '.conversion_run.remote_root' "$AUTHORITY")"
remote_final="$conversion_root/finalization/$GITHUB_SHA/$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
scp "${scp_opts[@]}" \
  "$MODEL_SSH_USER@$MODEL_HOST:$remote_final/bounded-evidence.tar.gz" \
  "$REPORT_ROOT/remote/bounded-evidence.tar.gz"
scp "${scp_opts[@]}" \
  "$MODEL_SSH_USER@$MODEL_HOST:$remote_final/status.json" \
  "$REPORT_ROOT/remote/status.json"
mkdir -p "$REPORT_ROOT/remote/evidence"
tar -xzf "$REPORT_ROOT/remote/bounded-evidence.tar.gz" -C "$REPORT_ROOT/remote/evidence"
final_report="$REPORT_ROOT/remote/evidence/finalization-report.json"
test -f "$final_report"
test "$(jq -r '.status' "$final_report")" = 'VERIFIED_BUNDLES_RESTORED'
test "$(jq -r '.models | length' "$final_report")" = '2'
test "$(jq -r '[.models[].storage_verification_status] | all(. == "VERIFIED")' "$final_report")" = 'true'
test "$(jq -r '.accepted_s3_object_deletion' "$final_report")" = 'false'
test "$(jq -r '.production_operational_status' "$final_report")" = 'NOT_ATTESTED'
if find "$REPORT_ROOT/remote/evidence" -type f -size +10000000c -print -quit | grep -q .; then
  echo 'retrieved evidence contains a file larger than 10 MB' >&2
  exit 1
fi
if grep -R -F -- "$S3_SECRET_ACCESS_KEY" "$REPORT_ROOT/remote/evidence"; then
  echo 'S3 secret leaked into bounded evidence' >&2
  exit 1
fi
ssh "${ssh_opts[@]}" "$MODEL_SSH_USER@$MODEL_HOST" "rm -rf '$REMOTE_BASE'"

REPORT_ROOT="$REPORT_ROOT" python - <<'PY'
import json
import os
from pathlib import Path
path = Path(os.environ['REPORT_ROOT']) / 'orchestrator-status.json'
payload = {
    'schema_version': 'tai.model-bundle-finalization-orchestrator-status.v1',
    'status': 'VERIFIED_BUNDLES_RESTORED',
    'exact_main_sha': os.environ['GITHUB_SHA'],
    'workflow_run_id': int(os.environ['GITHUB_RUN_ID']),
    'workflow_run_attempt': int(os.environ['GITHUB_RUN_ATTEMPT']),
    'benchmark_status': 'NOT_RUN',
    'model_admission_status': 'NOT_DONE',
    'production_operational_status': 'NOT_ATTESTED',
}
path.write_text(json.dumps(payload, indent=2, sort_keys=True) + '\n')
PY

trap - ERR
cleanup_local_secrets
trap - EXIT
echo 'VERIFIED_BUNDLES_RESTORED'
