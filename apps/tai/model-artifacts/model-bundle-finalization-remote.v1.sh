#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RUN_ROOT="${1:?run root required}"
CONVERSION_ROOT="${2:?conversion root required}"
CREDENTIALS_FILE="${3:?credentials file required}"
CONTROL_ROOT="$RUN_ROOT/control"
WORK_ROOT="$RUN_ROOT/work"
EVIDENCE_ROOT="$RUN_ROOT/evidence"
BUNDLE_AUTHORITY="$CONTROL_ROOT/model-bundle-authority.v2.json"
CONVERSION_AUTHORITY="$CONTROL_ROOT/model-conversion-authority.v1.json"
REMOTE_SCRIPT="$CONTROL_ROOT/model_bundle_finalization_remote.py"

cleanup_credentials() {
  rm -f "$CREDENTIALS_FILE"
}
trap cleanup_credentials EXIT

case "$RUN_ROOT" in /srv/tai-models/bundle-finalization-runs/*) ;; *) exit 64;; esac
test "$CONVERSION_ROOT" = "/srv/tai-models/conversion-runs/8bd494dc4954baaf699cffa243951392ff451ebb/29810648430-1"
test "$(id -un)" = "tai-model"
test -f "$CREDENTIALS_FILE"
test ! -L "$CREDENTIALS_FILE"
# shellcheck disable=SC1090
source "$CREDENTIALS_FILE"
rm -f "$CREDENTIALS_FILE"

for name in S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_PREFIX; do
  test -n "${!name:-}"
done
for command_name in aws jq python3 tar mkfifo sha256sum stat findmnt; do
  command -v "$command_name" >/dev/null
done

test -d "$CONTROL_ROOT/tai"
test -f "$BUNDLE_AUTHORITY"
test -f "$CONVERSION_AUTHORITY"
test -f "$CONVERSION_ROOT/status.json"
test -f "$CONVERSION_ROOT/evidence/conversion-report.json"
test "$(findmnt -rn -o SOURCE -T "$RUN_ROOT")" = "$(findmnt -rn -o SOURCE -T "$CONVERSION_ROOT")"

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$S3_REGION"
export AWS_EC2_METADATA_DISABLED=true
export AWS_PAGER=""
export AWS_RETRY_MODE=standard
export AWS_MAX_ATTEMPTS=5
endpoint=(--endpoint-url "$S3_ENDPOINT" --region "$S3_REGION")
common=(--cli-connect-timeout 20 --cli-read-timeout 0)

mkdir -p "$WORK_ROOT/models" "$EVIDENCE_ROOT/models"
chmod 700 "$WORK_ROOT" "$WORK_ROOT/models" "$EVIDENCE_ROOT" "$EVIDENCE_ROOT/models"

tar_stream() {
  local original_root="$1" payload_paths="$2"
  tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner \
    --format=posix --pax-option=delete=atime,delete=ctime \
    -C "$original_root" -cf - --files-from "$payload_paths"
}

measure_stream() {
  local output="$1"
  python3 -c '
import hashlib, json, sys
output = sys.argv[1]
digest = hashlib.sha256()
size = 0
while True:
    chunk = sys.stdin.buffer.read(1024 * 1024)
    if not chunk:
        break
    digest.update(chunk)
    size += len(chunk)
with open(output, "w", encoding="utf-8") as handle:
    json.dump({"archive_sha256": digest.hexdigest(), "archive_size_bytes": size}, handle, indent=2, sort_keys=True)
    handle.write("\\n")
' "$output"
}

for model_key in qwen3-8b mistral-7b-instruct-v0.3; do
  model_root="$WORK_ROOT/models/$model_key"
  original_root="$model_root/original"
  restore_root="$model_root/clean-restore"
  model_evidence="$EVIDENCE_ROOT/models/$model_key"
  mkdir -p "$model_evidence"

  PYTHONPATH="$CONTROL_ROOT" python3 "$REMOTE_SCRIPT" prepare \
    "$BUNDLE_AUTHORITY" "$CONVERSION_AUTHORITY" "$CONVERSION_ROOT" \
    "$CONTROL_ROOT" "$WORK_ROOT" "$model_key"

  payload_paths="$model_root/payload-paths.txt"
  measure_path="$model_root/archive-measurement.json"
  tar_stream "$original_root" "$payload_paths" | measure_stream "$measure_path"
  archive_sha256="$(jq -r '.archive_sha256' "$measure_path")"
  archive_size="$(jq -r '.archive_size_bytes' "$measure_path")"
  [[ "$archive_sha256" =~ ^[0-9a-f]{64}$ ]]
  [[ "$archive_size" =~ ^[0-9]+$ ]]
  test "$archive_size" -gt 1000000

  object_key="$S3_PREFIX/objects/sha256/$archive_sha256/$model_key.tar"
  [[ "$object_key" != /* ]]
  [[ "$object_key" != *".."* ]]

  aws "${endpoint[@]}" "${common[@]}" s3api list-multipart-uploads \
    --bucket "$S3_BUCKET" --prefix "$object_key" > "$model_root/multipart-before.json"
  while IFS=$'\t' read -r stale_key upload_id; do
    test "$stale_key" = "$object_key"
    aws "${endpoint[@]}" "${common[@]}" s3api abort-multipart-upload \
      --bucket "$S3_BUCKET" --key "$stale_key" --upload-id "$upload_id"
  done < <(
    jq -r --arg key "$object_key" \
      '.Uploads[]? | select(.Key == $key) | [.Key, .UploadId] | @tsv' \
      "$model_root/multipart-before.json"
  )

  tar_stream "$original_root" "$payload_paths" | \
    aws "${endpoint[@]}" "${common[@]}" s3 cp - "s3://$S3_BUCKET/$object_key" \
      --expected-size "$archive_size" --content-type application/x-tar \
      --only-show-errors --no-progress

  aws "${endpoint[@]}" "${common[@]}" s3api head-object \
    --bucket "$S3_BUCKET" --key "$object_key" > "$model_root/head-object.json"
  version_id="$(jq -r '.VersionId // empty' "$model_root/head-object.json")"
  etag="$(jq -r '.ETag // empty' "$model_root/head-object.json")"
  content_length="$(jq -r '.ContentLength // 0' "$model_root/head-object.json")"
  last_modified="$(jq -r '.LastModified // empty' "$model_root/head-object.json")"
  test -n "$version_id"
  test "$version_id" != "null"
  test "$content_length" = "$archive_size"
  test -n "$etag"
  test -n "$last_modified"

  aws "${endpoint[@]}" "${common[@]}" s3api get-object-retention \
    --bucket "$S3_BUCKET" --key "$object_key" --version-id "$version_id" \
    > "$model_root/object-retention.json"
  retention_mode="$(jq -r '.Retention.Mode // empty' "$model_root/object-retention.json")"
  retention_until="$(jq -r '.Retention.RetainUntilDate // empty' "$model_root/object-retention.json")"
  test "$retention_mode" = "COMPLIANCE"
  test -n "$retention_until"

  fifo="$model_root/archive.fifo"
  rm -f "$fifo"
  mkfifo -m 600 "$fifo"
  PYTHONPATH="$CONTROL_ROOT" python3 "$REMOTE_SCRIPT" extract \
    "$original_root/storage/payload-index.json" "$restore_root" \
    "$model_root/archive-observation.json" < "$fifo" &
  extractor_pid=$!
  set +e
  aws "${endpoint[@]}" "${common[@]}" s3api get-object \
    --bucket "$S3_BUCKET" --key "$object_key" --version-id "$version_id" \
    "$fifo" > "$model_root/get-object.json"
  get_status=$?
  wait "$extractor_pid"
  extract_status=$?
  set -e
  rm -f "$fifo"
  test "$get_status" -eq 0
  test "$extract_status" -eq 0
  test "$(jq -r '.VersionId // empty' "$model_root/get-object.json")" = "$version_id"
  test "$(jq -r '.archive_sha256' "$model_root/archive-observation.json")" = "$archive_sha256"
  test "$(jq -r '.archive_size_bytes' "$model_root/archive-observation.json")" = "$archive_size"

  restored_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  endpoint_host="$(python3 -c 'import sys; from urllib.parse import urlsplit; print(urlsplit(sys.argv[1]).hostname or "")' "$S3_ENDPOINT")"
  test -n "$endpoint_host"
  ENDPOINT_HOST="$endpoint_host" OBJECT_KEY="$object_key" VERSION_ID="$version_id" \
    ETAG="$etag" ARCHIVE_SHA256="$archive_sha256" ARCHIVE_SIZE="$archive_size" \
    LAST_MODIFIED="$last_modified" RETENTION_UNTIL="$retention_until" RESTORED_AT="$restored_at" \
    S3_BUCKET="$S3_BUCKET" S3_REGION="$S3_REGION" python3 - <<'PY' > "$model_root/object-record.json"
import json
import os
from urllib.parse import quote
key = os.environ['OBJECT_KEY']
version_id = os.environ['VERSION_ID']
digest = os.environ['ARCHIVE_SHA256']
locator = (
    f"s3+version://{os.environ['ENDPOINT_HOST']}/{os.environ['S3_BUCKET']}/{key}"
    f"?versionId={quote(version_id, safe='')}#sha256={digest}"
)
payload = {
    'endpoint_host': os.environ['ENDPOINT_HOST'],
    'region': os.environ['S3_REGION'],
    'bucket': os.environ['S3_BUCKET'],
    'key': key,
    'version_id': version_id,
    'etag': os.environ['ETAG'],
    'archive_sha256': digest,
    'archive_size_bytes': int(os.environ['ARCHIVE_SIZE']),
    'uploaded_at': os.environ['LAST_MODIFIED'],
    'retention_expires_at': os.environ['RETENTION_UNTIL'],
    'restored_at': os.environ['RESTORED_AT'],
    'immutable_locator': locator,
}
print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
PY

  PYTHONPATH="$CONTROL_ROOT" python3 "$REMOTE_SCRIPT" seal \
    "$BUNDLE_AUTHORITY" "$model_root" "$model_root/object-record.json"
  test "$(jq -r '.status' "$model_root/verification-report.json")" = "VERIFIED"
  test "$(jq -r '.production_operational_status' "$model_root/verification-report.json")" = "NOT_ATTESTED"

  cp "$model_root/manifest.json" "$model_evidence/"
  cp "$model_root/prepare-report.json" "$model_evidence/"
  cp "$measure_path" "$model_evidence/"
  cp "$model_root/object-record.json" "$model_evidence/"
  cp "$model_root/archive-observation.json" "$model_evidence/"
  cp "$model_root/head-object.json" "$model_evidence/"
  cp "$model_root/object-retention.json" "$model_evidence/"
  cp "$model_root/get-object.json" "$model_evidence/"
  cp "$model_root/verification-report.json" "$model_evidence/"
  chmod 600 "$model_evidence"/*

  rm -rf "$model_root"
done

EVIDENCE_ROOT="$EVIDENCE_ROOT" python3 - <<'PY'
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
root = Path(os.environ['EVIDENCE_ROOT'])
models = []
for key in ('qwen3-8b', 'mistral-7b-instruct-v0.3'):
    report = json.loads((root / 'models' / key / 'verification-report.json').read_text())
    object_record = json.loads((root / 'models' / key / 'object-record.json').read_text())
    assert report['status'] == 'VERIFIED'
    assert report['archive_sha256'] == object_record['archive_sha256']
    models.append({
        'key': key,
        'model_id': report['model_id'],
        'revision': report['revision'],
        'archive_sha256': report['archive_sha256'],
        'archive_size_bytes': report['archive_size_bytes'],
        'immutable_locator': object_record['immutable_locator'],
        'version_id': object_record['version_id'],
        'verification_report_sha256': report['report_sha256'],
    })
payload = {
    'schema_version': 'tai.model-bundle-finalization-report.v1',
    'status': 'BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED',
    'completed_at': datetime.now(timezone.utc).isoformat(),
    'models': models,
    'local_archive_copy_retained': False,
    'benchmark_status': 'NOT_RUN',
    'model_admission_status': 'NOT_DONE',
    'production_operational_status': 'NOT_ATTESTED',
    'reasons': [],
}
rendered = json.dumps(payload, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
payload['report_sha256'] = hashlib.sha256(rendered.encode()).hexdigest()
(root / 'finalization-report.json').write_text(
    json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
)
PY

find "$EVIDENCE_ROOT" -type f -size +10000000c -print -quit | (! grep -q .)
echo BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED
