#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${GITHUB_SHA:?}"
: "${GITHUB_RUN_ID:?}"
: "${GITHUB_RUN_ATTEMPT:?}"
: "${GITHUB_REPOSITORY:?}"
: "${GH_TOKEN:?}"

AUTHORITY="apps/tai/model-artifacts/model-bundle-finalization-authority.v1.json"
BUNDLE_AUTHORITY="apps/tai/model-artifacts/model-bundle-authority.v2.json"
CONVERSION_AUTHORITY="apps/tai/model-artifacts/model-conversion-authority.v1.json"
PREFLIGHT_REQUIREMENTS="apps/tai/model-artifacts/model-bundle-s3-preflight-requirements.v1.json"
EVIDENCE_ROOT="bundle-finalization-evidence"
CONTROL_ROOT="bundle-control"
ACCEPTED_ROOT="accepted-artifacts"
REMOTE_CONVERSION_ROOT="/srv/tai-models/conversion-runs/8bd494dc4954baaf699cffa243951392ff451ebb/29810648430-1"
REMOTE_RUN_ROOT="/srv/tai-models/bundle-finalization-runs/$GITHUB_SHA/$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
SUMMARY_PATH="bundle-finalization-summary.md"
FINAL_STATE="FAILED_CLOSED"
CURRENT_MODEL="NONE"
LOCAL_CREDENTIALS=""

write_summary() {
  FINAL_STATE="$FINAL_STATE" CURRENT_MODEL="$CURRENT_MODEL" python3 - <<'PY' > "$SUMMARY_PATH"
import json
import os
from pathlib import Path
root = Path('bundle-finalization-evidence')
reports = []
for path in sorted(root.glob('remote/evidence/models/*/verification-report.json')):
    try:
        reports.append(json.loads(path.read_text()))
    except (OSError, json.JSONDecodeError):
        pass
missing = []
missing_path = root / 'missing-protected-inputs.json'
if missing_path.exists():
    try:
        missing = json.loads(missing_path.read_text()).get('missing', [])
    except (OSError, json.JSONDecodeError):
        missing = ['EVIDENCE_UNREADABLE']
lines = [
    '## TAI immutable bundle finalization',
    '',
    f"- exact-main: `{os.environ['GITHUB_SHA']}`;",
    f"- workflow run: `{os.environ['GITHUB_RUN_ID']}` / attempt `{os.environ['GITHUB_RUN_ATTEMPT']}`;",
    f"- state: `{os.environ.get('FINAL_STATE', 'FAILED_CLOSED')}`;",
    f"- current model: `{os.environ.get('CURRENT_MODEL', 'NONE')}`;",
]
if missing:
    lines.append(f"- missing protected inputs: `{missing}`;")
preflight_path = root / 'preflight/report.json'
if preflight_path.exists():
    preflight = json.loads(preflight_path.read_text())
    lines.extend([
        f"- S3 preflight: `{preflight.get('status')}`;",
        f"- preflight reasons: `{preflight.get('reasons')}`;",
        f"- preflight report SHA-256: `{preflight.get('report_sha256')}`;",
    ])
for report in reports:
    lines.extend([
        f"- `{report.get('model_id')}`: `{report.get('status')}`;",
        f"  - archive: `sha256:{report.get('archive_sha256')}` / `{report.get('archive_size_bytes')}` bytes;",
        f"  - verification report SHA-256: `{report.get('report_sha256')}`;",
    ])
lines.extend([
    '- local archive copy retained: `false`;',
    '- benchmark: `NOT_RUN`;',
    '- model admission: `NOT_DONE`;',
    '- production operational status: `NOT_ATTESTED`;',
    '- model bytes, GGUF files, payload archives and credentials are excluded from GitHub evidence.',
])
print('\n'.join(lines))
PY
}
cleanup() {
  if [[ -n "$LOCAL_CREDENTIALS" ]]; then rm -f "$LOCAL_CREDENTIALS"; fi
  rm -f "$HOME/.ssh/id_tai_model" 2>/dev/null || true
  write_summary
}
trap cleanup EXIT

mkdir -p "$EVIDENCE_ROOT/preflight/raw" "$EVIDENCE_ROOT/release" "$CONTROL_ROOT" "$ACCEPTED_ROOT"
chmod 700 "$EVIDENCE_ROOT" "$CONTROL_ROOT" "$ACCEPTED_ROOT"

test "$GITHUB_REF" = "refs/heads/main"
test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
git fetch --no-tags --depth=1 origin main
test "$(git rev-parse refs/remotes/origin/main)" = "$GITHUB_SHA"
test -z "$(git status --porcelain=v1 --untracked-files=all)"

python3 - <<'PY'
import json
from pathlib import Path
authority = json.loads(Path('apps/tai/model-artifacts/model-bundle-finalization-authority.v1.json').read_text())
assert authority['schema_version'] == 'tai.model-bundle-finalization-authority.v1'
assert (authority['program_issue'], authority['parent_issue'], authority['issue']) == (2726, 2954, 2961)
assert authority['command'] == '/tai finalize model-bundles exact-main'
assert authority['conversion_run'] == {
    'exact_main_sha': '8bd494dc4954baaf699cffa243951392ff451ebb',
    'workflow_run_id': 29810648430,
    'workflow_run_attempt': 1,
    'root': '/srv/tai-models/conversion-runs/8bd494dc4954baaf699cffa243951392ff451ebb/29810648430-1',
    'required_state': 'COMPLETE',
    'required_result': 'CONVERSION_AND_QUANTIZATION_COMPLETE_PENDING_BUNDLE_RESTORE',
    'rerun_allowed': False,
}
assert authority['target']['host_role'] == 'DEDICATED_MODEL_HOST'
assert authority['target']['required_user'] == 'tai-model'
assert authority['target']['production_fallback_allowed'] is False
assert authority['storage']['provider_profile'] == 'SELECTEL_S3_2026'
assert authority['storage']['versioning_status'] == 'Enabled'
assert authority['storage']['object_lock_status'] == 'Enabled'
assert authority['storage']['retention_mode'] == 'COMPLIANCE'
assert authority['storage']['retention_days'] == 90
assert authority['storage']['delete_allowed'] is False
assert authority['archive']['stream_passes'] == 2
assert authority['archive']['local_archive_copy_allowed'] is False
assert authority['restore']['exact_version_required'] is True
assert authority['restore']['one_model_at_a_time'] is True
assert authority['result']['benchmark_status'] == 'NOT_RUN'
assert authority['result']['model_admission_status'] == 'NOT_DONE'
assert authority['result']['production_operational_status'] == 'NOT_ATTESTED'
PY

required_inputs=(
  MODEL_HOST MODEL_SSH_USER MODEL_SSH_PORT MODEL_SSH_KEY
  S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY
  S3_PREFIX S3_CAPACITY_BYTES S3_PRINCIPAL_ID
)
missing=()
for name in "${required_inputs[@]}"; do
  if [[ -z "${!name:-}" ]]; then missing+=("$name"); fi
done
if ((${#missing[@]})); then
  MISSING="$(IFS=,; printf '%s' "${missing[*]}")" python3 - <<'PY'
import json
import os
from pathlib import Path
Path('bundle-finalization-evidence/missing-protected-inputs.json').write_text(
    json.dumps({'status': 'FAILED_CLOSED', 'missing': os.environ['MISSING'].split(',')}, indent=2) + '\n'
)
PY
  echo "Protected Selectel/model-host inputs are unavailable; no S3 mutation attempted." >&2
  exit 1
fi

command -v aws >/dev/null
command -v gh >/dev/null
command -v jq >/dev/null
[[ "$MODEL_HOST" =~ ^[A-Za-z0-9._:-]+$ ]]
test "$MODEL_SSH_USER" = "tai-model"
[[ "$MODEL_SSH_PORT" =~ ^[0-9]{1,5}$ ]]
[[ "$S3_CAPACITY_BYTES" =~ ^[0-9]+$ ]]
test "$S3_CAPACITY_BYTES" -ge 120000000000
[[ "$S3_PREFIX" != /* ]]
[[ "$S3_PREFIX" != */ ]]
[[ "$S3_PREFIX" != *".."* ]]
[[ "$S3_PREFIX" != *\\* ]]

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$S3_REGION"
export AWS_EC2_METADATA_DISABLED=true
export AWS_PAGER=""
endpoint=(--endpoint-url "$S3_ENDPOINT" --region "$S3_REGION")
common=(--cli-connect-timeout 20 --cli-read-timeout 120)

run_read_only() {
  local name="$1"
  shift
  "$@" > "$EVIDENCE_ROOT/preflight/raw/${name}.json" 2> "$EVIDENCE_ROOT/preflight/raw/${name}.stderr"
  printf '0\n' > "$EVIDENCE_ROOT/preflight/raw/${name}.exit"
}
run_read_only head_bucket aws "${endpoint[@]}" "${common[@]}" s3api head-bucket --bucket "$S3_BUCKET"
run_read_only get_bucket_versioning aws "${endpoint[@]}" "${common[@]}" s3api get-bucket-versioning --bucket "$S3_BUCKET"
run_read_only get_object_lock_configuration aws "${endpoint[@]}" "${common[@]}" s3api get-object-lock-configuration --bucket "$S3_BUCKET"
run_read_only get_bucket_policy aws "${endpoint[@]}" "${common[@]}" s3api get-bucket-policy --bucket "$S3_BUCKET"
run_read_only list_objects_v2 aws "${endpoint[@]}" "${common[@]}" s3api list-objects-v2 --bucket "$S3_BUCKET" --prefix "$S3_PREFIX/" --max-keys 1
run_read_only list_object_versions aws "${endpoint[@]}" "${common[@]}" s3api list-object-versions --bucket "$S3_BUCKET" --prefix "$S3_PREFIX/" --max-keys 1
anonymous_url="${S3_ENDPOINT%/}/$S3_BUCKET?list-type=2&max-keys=1"
anonymous_status="$(curl --silent --show-error --output "$EVIDENCE_ROOT/preflight/raw/anonymous-list.body" --write-out '%{http_code}' --connect-timeout 20 --max-time 60 "$anonymous_url")"
printf '%s\n' "$anonymous_status" > "$EVIDENCE_ROOT/preflight/raw/anonymous_list_http_status.txt"
printf '0\n' > "$EVIDENCE_ROOT/preflight/raw/anonymous_list_probe.exit"
aws --version > "$EVIDENCE_ROOT/preflight/raw/aws-version.txt" 2>&1

S3_ENDPOINT="$S3_ENDPOINT" S3_REGION="$S3_REGION" S3_BUCKET="$S3_BUCKET" S3_PREFIX="$S3_PREFIX" S3_CAPACITY_BYTES="$S3_CAPACITY_BYTES" python3 - <<'PY'
import json
import os
from pathlib import Path
root = Path('bundle-finalization-evidence/preflight/raw')
def object_json(name: str) -> dict[str, object]:
    path = root / f'{name}.json'
    if not path.exists() or not path.read_text().strip(): return {}
    value = json.loads(path.read_text())
    return value if isinstance(value, dict) else {}
policy_wrapper = object_json('get_bucket_policy')
raw_policy = policy_wrapper.get('Policy')
policy = json.loads(raw_policy) if isinstance(raw_policy, str) else raw_policy
if not isinstance(policy, dict): policy = {}
commands = {
    name: (root / f'{name}.exit').read_text().strip() == '0'
    for name in (
        'head_bucket', 'get_bucket_versioning', 'get_object_lock_configuration',
        'get_bucket_policy', 'list_objects_v2', 'list_object_versions',
        'anonymous_list_probe',
    )
}
payload = {
    'schema_version': 'tai.model-bundle-s3-preflight-observed.v1',
    'provider_profile': 'SELECTEL_S3_2026',
    'endpoint': os.environ['S3_ENDPOINT'],
    'region': os.environ['S3_REGION'],
    'bucket': os.environ['S3_BUCKET'],
    'prefix': os.environ['S3_PREFIX'],
    'operator_confirmed_capacity_bytes': os.environ['S3_CAPACITY_BYTES'],
    'commands': commands,
    'versioning': object_json('get_bucket_versioning'),
    'object_lock': object_json('get_object_lock_configuration'),
    'anonymous_list_http_status': (root / 'anonymous_list_http_status.txt').read_text().strip(),
    'policy': policy,
    'aws_cli_identity': (root / 'aws-version.txt').read_text(errors='replace')[:500],
    'mutation_mode': 'READ_ONLY',
}
Path('bundle-finalization-evidence/preflight/observed.json').write_text(
    json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
)
PY
python3 -m tai.model_bundle_s3_preflight_cli "$PREFLIGHT_REQUIREMENTS" \
  "$EVIDENCE_ROOT/preflight/observed.json" --exact-main "$GITHUB_SHA" \
  --workflow-run-id "$GITHUB_RUN_ID" --workflow-run-attempt "$GITHUB_RUN_ATTEMPT" \
  --output "$EVIDENCE_ROOT/preflight/report.json"
test "$(jq -r '.status' "$EVIDENCE_ROOT/preflight/report.json")" = "READY_FOR_BUNDLE_UPLOAD"

for attempt in $(seq 1 180); do
  gh api -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' \
    "repos/$GITHUB_REPOSITORY/actions/runs?head_sha=$GITHUB_SHA&per_page=100" \
    > "$EVIDENCE_ROOT/release/runs.json"
  set +e
  GITHUB_SHA="$GITHUB_SHA" python3 - <<'PY'
import json
import os
from pathlib import Path
runs = json.loads(Path('bundle-finalization-evidence/release/runs.json').read_text()).get('workflow_runs', [])
candidates = [
    run for run in runs
    if run.get('name') == 'TAI Release Acceptance'
    and run.get('path') == '.github/workflows/tai-release-acceptance.yml'
    and run.get('head_sha') == os.environ['GITHUB_SHA']
    and run.get('head_branch') == 'main'
    and run.get('event') in {'push', 'workflow_dispatch'}
]
if not candidates: raise SystemExit(3)
run = max(candidates, key=lambda item: (item.get('run_number', 0), item.get('id', 0)))
if run.get('status') != 'completed': raise SystemExit(3)
if run.get('conclusion') != 'success': raise SystemExit(2)
Path('bundle-finalization-evidence/release/selected-run.json').write_text(
    json.dumps(run, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
)
PY
  status=$?
  set -e
  if [[ "$status" -eq 0 ]]; then break; fi
  if [[ "$status" -eq 2 ]]; then echo "Exact-main Release Acceptance failed." >&2; exit 1; fi
  if [[ "$attempt" -eq 180 ]]; then echo "Exact-main Release Acceptance absent." >&2; exit 1; fi
  sleep 20
done
release_run_id="$(jq -r '.id' "$EVIDENCE_ROOT/release/selected-run.json")"
gh api "repos/$GITHUB_REPOSITORY/actions/runs/$release_run_id/artifacts?per_page=100" > "$EVIDENCE_ROOT/release/artifacts.json"
GITHUB_SHA="$GITHUB_SHA" RELEASE_RUN_ID="$release_run_id" python3 - <<'PY'
import json
import os
from pathlib import Path
artifacts = json.loads(Path('bundle-finalization-evidence/release/artifacts.json').read_text()).get('artifacts', [])
expected = f"tai-release-attestation-{os.environ['GITHUB_SHA']}"
matches = [item for item in artifacts if item.get('name') == expected and item.get('expired') is False]
if len(matches) != 1: raise SystemExit('RELEASE_ARTIFACT_CARDINALITY_INVALID')
Path('bundle-finalization-evidence/release/selected-artifact.json').write_text(
    json.dumps(matches[0], ensure_ascii=False, indent=2, sort_keys=True) + '\n'
)
PY
release_artifact_id="$(jq -r '.id' "$EVIDENCE_ROOT/release/selected-artifact.json")"
gh api "repos/$GITHUB_REPOSITORY/actions/artifacts/$release_artifact_id/zip" > "$EVIDENCE_ROOT/release/artifact.zip"
mkdir -p "$EVIDENCE_ROOT/release/artifact"
unzip -q "$EVIDENCE_ROOT/release/artifact.zip" -d "$EVIDENCE_ROOT/release/artifact"
GITHUB_SHA="$GITHUB_SHA" python3 - <<'PY'
import json
import os
from pathlib import Path
payload = json.loads(Path('bundle-finalization-evidence/release/artifact/tai-release-attestation.json').read_text())
assert payload['exact_main_sha'] == os.environ['GITHUB_SHA']
assert payload['accepted'] is True
assert payload['reasons'] == []
assert payload['production_operational_status'] == 'NOT_ATTESTED'
PY
rm -f "$EVIDENCE_ROOT/release/artifact.zip"

python3 - <<'PY' > "$ACCEPTED_ROOT/source-artifacts.tsv"
import json
from pathlib import Path
authority = json.loads(Path('apps/tai/model-artifacts/model-bundle-finalization-authority.v1.json').read_text())
for model in authority['models']:
    print('\t'.join((model['key'], str(model['source_artifact_id']), model['source_artifact_digest'])))
PY
while IFS=$'\t' read -r key artifact_id expected_digest; do
  mkdir -p "$ACCEPTED_ROOT/$key/content"
  gh api "repos/$GITHUB_REPOSITORY/actions/artifacts/$artifact_id" > "$ACCEPTED_ROOT/$key/artifact.json"
  KEY="$key" ARTIFACT_ID="$artifact_id" EXPECTED_DIGEST="$expected_digest" python3 - <<'PY'
import json
import os
import re
from pathlib import Path
artifact = json.loads(Path(f"accepted-artifacts/{os.environ['KEY']}/artifact.json").read_text())
assert artifact['id'] == int(os.environ['ARTIFACT_ID'])
assert artifact['expired'] is False
digest = artifact.get('digest', '')
assert re.fullmatch(r'sha256:[0-9a-f]{64}', digest)
assert digest.split(':', 1)[1] == os.environ['EXPECTED_DIGEST']
PY
  gh api "repos/$GITHUB_REPOSITORY/actions/artifacts/$artifact_id/zip" > "$ACCEPTED_ROOT/$key/artifact.zip"
  test "$(sha256sum "$ACCEPTED_ROOT/$key/artifact.zip" | awk '{print $1}')" = "$expected_digest"
  unzip -q "$ACCEPTED_ROOT/$key/artifact.zip" -d "$ACCEPTED_ROOT/$key/content"
  rm -f "$ACCEPTED_ROOT/$key/artifact.zip"
done < "$ACCEPTED_ROOT/source-artifacts.tsv"

mkdir -p "$CONTROL_ROOT/source-metadata/qwen3-8b/legal" "$CONTROL_ROOT/source-metadata/mistral-7b-instruct-v0.3/legal"
mkdir -p "$CONTROL_ROOT/legal-reviews/qwen3-8b" "$CONTROL_ROOT/legal-reviews/mistral-7b-instruct-v0.3"
cp -R apps/tai/tai "$CONTROL_ROOT/tai"
cp "$BUNDLE_AUTHORITY" "$CONTROL_ROOT/model-bundle-authority.v2.json"
cp "$CONVERSION_AUTHORITY" "$CONTROL_ROOT/model-conversion-authority.v1.json"
cp apps/tai/model-artifacts/llama-cpp-build-acceptance.v1.json "$CONTROL_ROOT/llama-cpp-build-acceptance.v1.json"
cp apps/tai/model-artifacts/model-bundle-finalization-remote.v1.sh "$CONTROL_ROOT/model-bundle-finalization-remote.v1.sh"
cp apps/tai/model-artifacts/model_bundle_finalization_remote.py "$CONTROL_ROOT/model_bundle_finalization_remote.py"
for key in qwen3-8b mistral-7b-instruct-v0.3; do
  cp "$ACCEPTED_ROOT/$key/content/remote-inventory.json" "$CONTROL_ROOT/source-metadata/$key/"
  cp "$ACCEPTED_ROOT/$key/content/source-manifest.json" "$CONTROL_ROOT/source-metadata/$key/"
  cp "$ACCEPTED_ROOT/$key/content/legal/LICENSE-2.0.txt" "$CONTROL_ROOT/source-metadata/$key/legal/"
done
cp apps/tai/model-artifacts/legal-reviews/qwen3-8b.review-record.v1.json "$CONTROL_ROOT/legal-reviews/qwen3-8b/review-record.json"
cp apps/tai/model-artifacts/legal-reviews/mistral-7b-instruct-v0.3.review-record.v1.json "$CONTROL_ROOT/legal-reviews/mistral-7b-instruct-v0.3/review-record.json"
chmod 700 "$CONTROL_ROOT/model-bundle-finalization-remote.v1.sh"
(cd "$CONTROL_ROOT" && find . -type f ! -name control-manifest.sha256 -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > control-manifest.sha256)
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -C "$CONTROL_ROOT" -czf control-package.tar.gz .
sha256sum control-package.tar.gz > control-package.tar.gz.sha256

LOCAL_CREDENTIALS="$RUNNER_TEMP/tai-bundle-s3-credentials.env"
S3_ENDPOINT="$S3_ENDPOINT" S3_REGION="$S3_REGION" S3_BUCKET="$S3_BUCKET" S3_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" S3_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" S3_PREFIX="$S3_PREFIX" python3 - <<'PY' > "$LOCAL_CREDENTIALS"
import os
import shlex
for name in ('S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PREFIX'):
    print(f"{name}={shlex.quote(os.environ[name])}")
PY
chmod 600 "$LOCAL_CREDENTIALS"

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
ssh-keyscan -p "$MODEL_SSH_PORT" -H "$MODEL_HOST" > "$HOME/.ssh/known_hosts"
printf '%s\n' "$MODEL_SSH_KEY" > "$HOME/.ssh/id_tai_model"
chmod 600 "$HOME/.ssh/known_hosts" "$HOME/.ssh/id_tai_model"
ssh_command() {
  ssh -i "$HOME/.ssh/id_tai_model" -p "$MODEL_SSH_PORT" -o BatchMode=yes -o StrictHostKeyChecking=yes "$MODEL_SSH_USER@$MODEL_HOST" "$@"
}
scp_file() {
  scp -i "$HOME/.ssh/id_tai_model" -P "$MODEL_SSH_PORT" -o BatchMode=yes -o StrictHostKeyChecking=yes "$1" "$MODEL_SSH_USER@$MODEL_HOST:$2"
}

ssh_command "install -d -m 700 '$REMOTE_RUN_ROOT/incoming' '$REMOTE_RUN_ROOT/control' '$REMOTE_RUN_ROOT/evidence'"
scp_file control-package.tar.gz "$REMOTE_RUN_ROOT/incoming/control-package.tar.gz"
scp_file control-package.tar.gz.sha256 "$REMOTE_RUN_ROOT/incoming/control-package.tar.gz.sha256"
scp_file "$LOCAL_CREDENTIALS" "$REMOTE_RUN_ROOT/incoming/s3-credentials.env"
rm -f "$LOCAL_CREDENTIALS"
LOCAL_CREDENTIALS=""

remote_bootstrap="$(cat <<REMOTE
set -euo pipefail
cd '$REMOTE_RUN_ROOT/incoming'
sha256sum -c control-package.tar.gz.sha256
rm -rf '$REMOTE_RUN_ROOT/control.new'
mkdir -m 700 '$REMOTE_RUN_ROOT/control.new'
tar -xzf control-package.tar.gz -C '$REMOTE_RUN_ROOT/control.new'
(cd '$REMOTE_RUN_ROOT/control.new' && sha256sum -c control-manifest.sha256)
rm -rf '$REMOTE_RUN_ROOT/control.previous'
if [ -d '$REMOTE_RUN_ROOT/control' ]; then mv '$REMOTE_RUN_ROOT/control' '$REMOTE_RUN_ROOT/control.previous'; fi
mv '$REMOTE_RUN_ROOT/control.new' '$REMOTE_RUN_ROOT/control'
chmod 600 '$REMOTE_RUN_ROOT/incoming/s3-credentials.env'
bash '$REMOTE_RUN_ROOT/control/model-bundle-finalization-remote.v1.sh' \
  '$REMOTE_RUN_ROOT' '$REMOTE_CONVERSION_ROOT' '$REMOTE_RUN_ROOT/incoming/s3-credentials.env'
REMOTE
)"
set +e
ssh_command "bash -s" <<< "$remote_bootstrap"
remote_status=$?
set -e

mkdir -p "$EVIDENCE_ROOT/remote"
set +e
ssh_command "test -d '$REMOTE_RUN_ROOT/evidence' && tar -C '$REMOTE_RUN_ROOT' -czf - evidence" > remote-evidence.tar.gz
fetch_status=$?
set -e
if [[ "$fetch_status" -eq 0 && -s remote-evidence.tar.gz ]]; then
  if tar -tzf remote-evidence.tar.gz | grep -E '(^/|(^|/)\.\.(/|$))'; then
    echo "Unsafe remote evidence path." >&2
    exit 1
  fi
  tar -xzf remote-evidence.tar.gz -C "$EVIDENCE_ROOT/remote"
fi
rm -f remote-evidence.tar.gz

test "$remote_status" -eq 0
test -s "$EVIDENCE_ROOT/remote/evidence/finalization-report.json"
python3 - <<'PY'
import json
from pathlib import Path
root = Path('bundle-finalization-evidence/remote/evidence')
report = json.loads((root / 'finalization-report.json').read_text())
assert report['status'] == 'BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED'
assert report['local_archive_copy_retained'] is False
assert report['benchmark_status'] == 'NOT_RUN'
assert report['model_admission_status'] == 'NOT_DONE'
assert report['production_operational_status'] == 'NOT_ATTESTED'
assert len(report['models']) == 2
assert {item['key'] for item in report['models']} == {'qwen3-8b', 'mistral-7b-instruct-v0.3'}
for item in report['models']:
    assert len(item['archive_sha256']) == 64
    assert item['archive_size_bytes'] > 1_000_000
    assert item['version_id'] and item['version_id'] != 'null'
    verification = json.loads((root / 'models' / item['key'] / 'verification-report.json').read_text())
    assert verification['status'] == 'VERIFIED'
    assert verification['report_sha256'] == item['verification_report_sha256']
if any(path.stat().st_size > 10_000_000 for path in root.rglob('*') if path.is_file()):
    raise SystemExit('BOUNDED_EVIDENCE_SIZE_EXCEEDED')
if any(path.suffix == '.gguf' for path in root.rglob('*') if path.is_file()):
    raise SystemExit('GGUF_ENTERED_GITHUB_EVIDENCE')
PY

FINAL_STATE="BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED"
CURRENT_MODEL="COMPLETE"
write_summary
trap - EXIT
cleanup
