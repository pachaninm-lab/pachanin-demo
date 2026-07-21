#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CONTROL_ROOT="${1:?control root is required}"
SECRET_FILE="${2:?secret file is required}"
EXACT_MAIN="${3:?exact-main SHA is required}"
WORKFLOW_RUN_ID="${4:?workflow run id is required}"
WORKFLOW_RUN_ATTEMPT="${5:?workflow run attempt is required}"

AUTHORITY="$CONTROL_ROOT/apps/tai/model-artifacts/model-bundle-upload-restore-authority.v1.json"
BUNDLE_AUTHORITY="$CONTROL_ROOT/apps/tai/model-artifacts/model-bundle-authority.v2.json"
CONVERSION_AUTHORITY="$CONTROL_ROOT/apps/tai/model-artifacts/model-conversion-authority.v1.json"
TOOLCHAIN_ACCEPTANCE="$CONTROL_ROOT/apps/tai/model-artifacts/llama-cpp-build-acceptance.v1.json"
LICENSE_TEXT="$CONTROL_ROOT/license/LICENSE-2.0.txt"
PREFLIGHT_REPORT="$CONTROL_ROOT/s3-preflight/report.json"
S3_TRANSPORT="$CONTROL_ROOT/apps/tai/scripts/model-bundle-s3-multipart.py"
PYTHON_ROOT="$CONTROL_ROOT/apps/tai"
CONTROL_MANIFEST="$CONTROL_ROOT/control-manifest.sha256"

export PYTHONPATH="$PYTHON_ROOT"

for path in \
  "$AUTHORITY" "$BUNDLE_AUTHORITY" "$CONVERSION_AUTHORITY" \
  "$TOOLCHAIN_ACCEPTANCE" "$LICENSE_TEXT" "$PREFLIGHT_REPORT" \
  "$S3_TRANSPORT" "$CONTROL_MANIFEST" "$SECRET_FILE"; do
  test -f "$path"
  test ! -L "$path"
done

test "$(id -un)" = 'tai-model'
test "$(uname -s)" = 'Linux'
test "$EXACT_MAIN" = "${EXACT_MAIN,,}"
[[ "$EXACT_MAIN" =~ ^[0-9a-f]{40}$ ]]
[[ "$WORKFLOW_RUN_ID" =~ ^[0-9]+$ ]]
[[ "$WORKFLOW_RUN_ATTEMPT" =~ ^[0-9]+$ ]]

for command_name in python3 curl tar sha256sum stat flock find df; do
  command -v "$command_name" >/dev/null
done
curl --help all | grep -q -- '--aws-sigv4'

(
  cd "$CONTROL_ROOT"
  sha256sum --check --strict control-manifest.sha256
)

chmod 600 "$SECRET_FILE"
# shellcheck disable=SC1090
source "$SECRET_FILE"

required_secret_names=(
  TAI_BUNDLE_S3_ENDPOINT
  TAI_BUNDLE_S3_REGION
  TAI_BUNDLE_S3_BUCKET
  TAI_BUNDLE_S3_ACCESS_KEY_ID
  TAI_BUNDLE_S3_SECRET_ACCESS_KEY
  TAI_BUNDLE_S3_PREFIX
)
for name in "${required_secret_names[@]}"; do
  test -n "${!name:-}"
done

RUN_ROOT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["conversion_run"]["remote_root"])' "$AUTHORITY")"
test "$RUN_ROOT" = '/srv/tai-models/conversion-runs/'*'/29810648430-1'
test -d "$RUN_ROOT"
test ! -L "$RUN_ROOT"

FINAL_ROOT="$RUN_ROOT/finalization/$EXACT_MAIN/$WORKFLOW_RUN_ID-$WORKFLOW_RUN_ATTEMPT"
EVIDENCE_ROOT="$FINAL_ROOT/evidence"
STATUS_PATH="$FINAL_ROOT/status.json"
LOCK_PATH="$RUN_ROOT/.bundle-finalization.lock"
CURL_CONFIG="$FINAL_ROOT/curl-s3.conf"
TOOLCHAIN_EXTRACT="$FINAL_ROOT/toolchain-extract"
WORK_ROOT="$FINAL_ROOT/work"

mkdir -p "$FINAL_ROOT" "$EVIDENCE_ROOT/models" "$WORK_ROOT"
chmod 700 "$FINAL_ROOT" "$EVIDENCE_ROOT" "$EVIDENCE_ROOT/models" "$WORK_ROOT"
exec 9>"$LOCK_PATH"
flock -n 9 || { echo 'another model-bundle finalizer holds the run lock' >&2; exit 73; }

write_status() {
  local state="$1" reason="${2:-}"
  STATE="$state" REASON="$reason" STATUS_PATH="$STATUS_PATH" \
    EXACT_MAIN="$EXACT_MAIN" WORKFLOW_RUN_ID="$WORKFLOW_RUN_ID" \
    WORKFLOW_RUN_ATTEMPT="$WORKFLOW_RUN_ATTEMPT" python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path
payload = {
    "schema_version": "tai.model-bundle-finalization-remote-status.v1",
    "state": os.environ["STATE"],
    "reason": os.environ.get("REASON", "")[:1000],
    "exact_main_sha": os.environ["EXACT_MAIN"],
    "workflow_run_id": int(os.environ["WORKFLOW_RUN_ID"]),
    "workflow_run_attempt": int(os.environ["WORKFLOW_RUN_ATTEMPT"]),
    "updated_at": datetime.now(timezone.utc).isoformat(),
    "benchmark_status": "NOT_RUN",
    "model_admission_status": "NOT_DONE",
    "production_operational_status": "NOT_ATTESTED",
}
Path(os.environ["STATUS_PATH"]).write_text(
    json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
)
PY
}

cleanup_secrets() {
  set +e
  if [[ -f "$CURL_CONFIG" ]]; then
    chmod 600 "$CURL_CONFIG"
    dd if=/dev/zero of="$CURL_CONFIG" bs=4096 count=1 conv=notrunc status=none 2>/dev/null
    rm -f "$CURL_CONFIG"
  fi
  if [[ -f "$SECRET_FILE" ]]; then
    chmod 600 "$SECRET_FILE"
    dd if=/dev/zero of="$SECRET_FILE" bs=4096 count=1 conv=notrunc status=none 2>/dev/null
    rm -f "$SECRET_FILE"
  fi
  unset TAI_BUNDLE_S3_ACCESS_KEY_ID TAI_BUNDLE_S3_SECRET_ACCESS_KEY || true
}

failure() {
  local code=$?
  trap - ERR
  write_status FAILED_CLOSED "driver_exit_${code}"
  cleanup_secrets
  rm -rf "$WORK_ROOT" "$TOOLCHAIN_EXTRACT"
  exit "$code"
}
trap failure ERR
trap cleanup_secrets EXIT
write_status RUNNING

python3 -m tai.model_bundle_finalize_cli validate-authority \
  "$AUTHORITY" --output "$EVIDENCE_ROOT/authority-validation.json"

python3 - "$AUTHORITY" "$RUN_ROOT" "$PREFLIGHT_REPORT" "$EXACT_MAIN" \
  "$EVIDENCE_ROOT/prerequisite-verification.json" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

authority_path, run_root_raw, preflight_path, exact_main, output_path = sys.argv[1:]
authority = json.loads(Path(authority_path).read_text())
run_root = Path(run_root_raw)
report_path = run_root / "evidence/conversion-report.json"
report = json.loads(report_path.read_text())
expected = authority["conversion_run"]
assert report["status"] == expected["status"]
assert report["exact_main_sha"] == expected["exact_main_sha"]
assert report["workflow_run_id"] == expected["workflow_run_id"]
assert report["workflow_run_attempt"] == expected["workflow_run_attempt"]
assert report["report_sha256"] == expected["report_sha256"]
assert report["benchmark_status"] == "NOT_RUN"
assert report["model_admission_status"] == "NOT_DONE"
assert report["production_operational_status"] == "NOT_ATTESTED"
assert report.get("reasons") == []
assert len(report["steps"]) == 5
assert all(step["status"] == "COMPLETE" for step in report["steps"])
expected_outputs = {
    item["path"]: (item["size_bytes"], item["sha256"])
    for model in authority["models"]
    for item in model["outputs"]
}
observed_outputs = {
    item["path"]: (item["size_bytes"], item["sha256"])
    for item in report["outputs"]
}
assert observed_outputs == expected_outputs
for relative, (size, digest) in expected_outputs.items():
    path = run_root / relative
    assert path.is_file() and not path.is_symlink()
    assert path.stat().st_size == size
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            value.update(chunk)
    assert value.hexdigest() == digest
preflight = json.loads(Path(preflight_path).read_text())
assert preflight["status"] == authority["storage_authority"]["required_preflight_status"]
assert preflight["exact_main_sha"] == exact_main
assert preflight["reasons"] == []
observed = preflight["observed"]
assert observed["versioning_status"] == "Enabled"
assert observed["object_lock_status"] == "Enabled"
assert observed["default_retention_mode"] == "COMPLIANCE"
assert observed["default_retention_days"] >= 90
assert preflight["production_operational_status"] == "NOT_ATTESTED"
payload = {
    "schema_version": "tai.model-bundle-finalization-prerequisites.v1",
    "status": "VERIFIED",
    "conversion_report_semantic_sha256": report["report_sha256"],
    "conversion_report_file_sha256": hashlib.sha256(report_path.read_bytes()).hexdigest(),
    "verified_outputs": sorted(expected_outputs),
    "preflight_report_sha256": preflight["report_sha256"],
    "reasons": [],
    "benchmark_status": "NOT_RUN",
    "model_admission_status": "NOT_DONE",
    "production_operational_status": "NOT_ATTESTED",
}
canonical = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
payload["report_sha256"] = hashlib.sha256(canonical.encode()).hexdigest()
Path(output_path).write_text(
    json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
)
PY

python3 - "$CURL_CONFIG" <<'PY'
import json
import os
import sys
from pathlib import Path
path = Path(sys.argv[1])
def quoted(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)
lines = [
    "silent",
    "show-error",
    "fail-with-body",
    "location",
    "retry = 6",
    "retry-all-errors",
    "retry-delay = 5",
    "connect-timeout = 30",
    "max-time = 21600",
    "aws-sigv4 = " + quoted("aws:amz:" + os.environ["TAI_BUNDLE_S3_REGION"] + ":s3"),
    "user = " + quoted(os.environ["TAI_BUNDLE_S3_ACCESS_KEY_ID"] + ":" + os.environ["TAI_BUNDLE_S3_SECRET_ACCESS_KEY"]),
]
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
path.chmod(0o600)
PY

if [[ ! -d "$TOOLCHAIN_EXTRACT/llama-evidence" ]]; then
  mkdir -p "$TOOLCHAIN_EXTRACT"
  package="$RUN_ROOT/control/toolchain/llama-cpp-b9637-evidence.tar.gz"
  test -f "$package"
  if tar -tzf "$package" | grep -E '(^/|(^|/)\.\.(/|$))'; then
    echo 'unsafe path in accepted toolchain package' >&2
    exit 1
  fi
  tar -xzf "$package" -C "$TOOLCHAIN_EXTRACT"
fi

tar_stream() {
  local original_root="$1"
  (
    cd "$original_root"
    LC_ALL=C tar \
      --create \
      --file=- \
      --format=posix \
      --sort=name \
      --mtime='UTC 1970-01-01' \
      --owner=0 \
      --group=0 \
      --numeric-owner \
      --mode='u+rw,go-rwx' \
      --pax-option='delete=atime,delete=ctime' \
      --no-recursion \
      --files-from=storage/archive-files.txt
  )
}

for model_key in qwen3-8b mistral-7b-instruct-v0.3; do
  model_work="$WORK_ROOT/$model_key"
  original_root="$model_work/original"
  restore_root="$model_work/restore"
  transport_root="$model_work/transport"
  model_evidence="$EVIDENCE_ROOT/models/$model_key"
  state_path="$model_work/state.json"
  digest_path="$model_work/archive-digest.json"
  upload_path="$model_work/upload.json"
  head_latest_path="$model_work/head-latest.json"
  head_version_path="$model_work/head-version.json"
  extract_path="$model_work/extract.json"
  manifest_path="$model_work/bundle.v2.json"
  locator_path="$model_work/locator.json"
  verifier_path="$model_work/storage-verification.json"
  mkdir -p "$model_work" "$transport_root" "$model_evidence"
  chmod 700 "$model_work" "$transport_root" "$model_evidence"

  review_record="$CONTROL_ROOT/apps/tai/model-artifacts/legal-reviews/$model_key.review-record.v1.json"
  source_root="$CONTROL_ROOT/source-metadata/$model_key"
  test -f "$review_record"
  test -f "$source_root/remote-inventory.json"
  test -f "$source_root/source-manifest.json"

  python3 -m tai.model_bundle_finalize_cli prepare-model \
    "$AUTHORITY" \
    "$BUNDLE_AUTHORITY" \
    "$CONVERSION_AUTHORITY" \
    "$TOOLCHAIN_ACCEPTANCE" \
    "$source_root" \
    "$review_record" \
    "$LICENSE_TEXT" \
    "$RUN_ROOT" \
    "$TOOLCHAIN_EXTRACT" \
    "$model_key" \
    "$original_root" \
    --output "$state_path"

  tar_stream "$original_root" \
    | python3 -m tai.model_bundle_finalize_cli hash-stream --output "$digest_path"
  archive_sha="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sha256"])' "$digest_path")"
  archive_size="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["size_bytes"])' "$digest_path")"
  [[ "$archive_sha" =~ ^[0-9a-f]{64}$ ]]
  test "$archive_size" -gt 0

  object_key="${TAI_BUNDLE_S3_PREFIX%/}/$model_key/sha256/$archive_sha/bundle.tar"
  tar_stream "$original_root" \
    | python3 "$S3_TRANSPORT" upload \
        --endpoint "$TAI_BUNDLE_S3_ENDPOINT" \
        --bucket "$TAI_BUNDLE_S3_BUCKET" \
        --key "$object_key" \
        --curl-config "$CURL_CONFIG" \
        --work-root "$transport_root" \
        --expected-sha256 "$archive_sha" \
        --expected-size-bytes "$archive_size" \
        --output "$upload_path"
  test "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["status"])' "$upload_path")" = COMPLETE
  test "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["size_bytes"])' "$upload_path")" = "$archive_size"
  test "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sha256"])' "$upload_path")" = "$archive_sha"

  python3 "$S3_TRANSPORT" head \
    --endpoint "$TAI_BUNDLE_S3_ENDPOINT" \
    --bucket "$TAI_BUNDLE_S3_BUCKET" \
    --key "$object_key" \
    --curl-config "$CURL_CONFIG" \
    --work-root "$transport_root" \
    --output "$head_latest_path"
  version_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version_id"])' "$head_latest_path")"
  test -n "$version_id"

  python3 "$S3_TRANSPORT" head \
    --endpoint "$TAI_BUNDLE_S3_ENDPOINT" \
    --bucket "$TAI_BUNDLE_S3_BUCKET" \
    --key "$object_key" \
    --version-id "$version_id" \
    --curl-config "$CURL_CONFIG" \
    --work-root "$transport_root" \
    --output "$head_version_path"

  etag="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["etag"])' "$head_version_path")"
  last_modified="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["last_modified"])' "$head_version_path")"
  retain_until="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["retain_until_date"])' "$head_version_path")"
  test "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version_id"])' "$head_version_path")" = "$version_id"
  test -n "$etag"
  test -n "$last_modified"
  test -n "$retain_until"
  test "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["object_lock_mode"])' "$head_version_path")" = COMPLIANCE
  test "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["size_bytes"])' "$head_version_path")" = "$archive_size"

  readarray -t retention_values < <(python3 - "$last_modified" "$retain_until" <<'PY'
import sys
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
last_modified = parsedate_to_datetime(sys.argv[1])
expires = datetime.fromisoformat(sys.argv[2].replace("Z", "+00:00"))
if last_modified.tzinfo is None or expires.tzinfo is None:
    raise SystemExit("storage timestamps must be timezone-aware")
last_modified = last_modified.astimezone(timezone.utc)
expires = expires.astimezone(timezone.utc)
if expires < datetime.now(timezone.utc) + timedelta(days=89):
    raise SystemExit("remaining retention horizon is below governed tolerance")
derived_uploaded = expires - timedelta(days=90)
if derived_uploaded > last_modified + timedelta(minutes=5):
    raise SystemExit("derived retention start follows object Last-Modified")
if last_modified > datetime.now(timezone.utc) + timedelta(minutes=5):
    raise SystemExit("object Last-Modified is in the future")
print(derived_uploaded.isoformat())
print(expires.isoformat())
PY
  )
  uploaded_at="${retention_values[0]}"
  retention_expires_at="${retention_values[1]}"

  rm -f "$original_root/storage/archive-files.txt"
  test ! -e "$original_root/storage/archive-files.txt"
  payload_index="$original_root/storage/payload-index.json"
  download_url="$(python3 -c 'import json,sys,urllib.parse; h=json.load(open(sys.argv[1])); print(h["object_url"] + "?versionId=" + urllib.parse.quote(sys.argv[2], safe=""))' "$head_version_path" "$version_id")"
  curl --config "$CURL_CONFIG" "$download_url" \
    | python3 -m tai.model_bundle_finalize_cli extract-stream \
        "$payload_index" "$restore_root" --output "$extract_path"
  test "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["status"])' "$extract_path")" = VERIFIED_AND_EXTRACTED
  test "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["archive_sha256"])' "$extract_path")" = "$archive_sha"
  test "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["archive_size_bytes"])' "$extract_path")" = "$archive_size"
  restored_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  python3 -m tai.model_bundle_finalize_cli complete-storage \
    "$state_path" "$original_root" \
    --archive-sha256 "$archive_sha" \
    --archive-size-bytes "$archive_size" \
    --endpoint "$TAI_BUNDLE_S3_ENDPOINT" \
    --region "$TAI_BUNDLE_S3_REGION" \
    --bucket "$TAI_BUNDLE_S3_BUCKET" \
    --object-key "$object_key" \
    --version-id "$version_id" \
    --etag "$etag" \
    --uploaded-at "$uploaded_at" \
    --retention-days 90 \
    --retention-expires-at "$retention_expires_at" \
    --restored-at "$restored_at" \
    --manifest "$manifest_path" \
    --output "$locator_path"

  python3 -m tai.model_bundle_storage_cli \
    "$BUNDLE_AUTHORITY" \
    "$manifest_path" \
    "$original_root" \
    "$restore_root" \
    --output "$verifier_path"
  test "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["status"])' "$verifier_path")" = VERIFIED
  test "$(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))["reasons"]))' "$verifier_path")" = 0

  cp "$manifest_path" "$model_evidence/bundle.v2.json"
  cp "$payload_index" "$model_evidence/payload-index.json"
  cp "$original_root/storage/upload-record.json" "$model_evidence/upload-record.json"
  cp "$original_root/storage/restore-record.json" "$model_evidence/restore-record.json"
  cp "$digest_path" "$model_evidence/archive-digest.json"
  cp "$upload_path" "$model_evidence/multipart-upload.json"
  cp "$head_latest_path" "$model_evidence/head-latest.json"
  cp "$head_version_path" "$model_evidence/head-version.json"
  cp "$extract_path" "$model_evidence/stream-extract.json"
  cp "$locator_path" "$model_evidence/locator.json"
  cp "$verifier_path" "$model_evidence/storage-verification.json"

  if find "$model_evidence" -type f -size +10000000c -print -quit | grep -q .; then
    echo 'bounded model evidence contains a file larger than 10 MB' >&2
    exit 1
  fi
  rm -rf "$model_work"
  test ! -e "$model_work"
done

rm -rf "$TOOLCHAIN_EXTRACT"
cleanup_secrets

EXACT_MAIN="$EXACT_MAIN" WORKFLOW_RUN_ID="$WORKFLOW_RUN_ID" \
WORKFLOW_RUN_ATTEMPT="$WORKFLOW_RUN_ATTEMPT" EVIDENCE_ROOT="$EVIDENCE_ROOT" \
python3 - <<'PY'
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
root = Path(os.environ["EVIDENCE_ROOT"])
models = []
for path in sorted((root / "models").glob("*/locator.json")):
    locator = json.loads(path.read_text())
    verifier = json.loads((path.parent / "storage-verification.json").read_text())
    assert verifier["status"] == "VERIFIED"
    assert verifier["reasons"] == []
    models.append({
        "model_key": path.parent.name,
        "model_id": locator["model_id"],
        "revision": locator["revision"],
        "archive_sha256": locator["archive_sha256"],
        "archive_size_bytes": locator["archive_size_bytes"],
        "object_key": locator["object_key"],
        "version_id": locator["version_id"],
        "etag": locator["etag"],
        "retention_expires_at": locator["retention_expires_at"],
        "immutable_locator": locator["immutable_locator"],
        "storage_verification_status": verifier["status"],
        "storage_verification_report_sha256": verifier["report_sha256"],
    })
assert len(models) == 2
payload = {
    "schema_version": "tai.model-bundle-finalization-report.v1",
    "status": "VERIFIED_BUNDLES_RESTORED",
    "exact_main_sha": os.environ["EXACT_MAIN"],
    "workflow_run_id": int(os.environ["WORKFLOW_RUN_ID"]),
    "workflow_run_attempt": int(os.environ["WORKFLOW_RUN_ATTEMPT"]),
    "completed_at": datetime.now(timezone.utc).isoformat(),
    "models": models,
    "accepted_s3_object_deletion": False,
    "benchmark_status": "NOT_RUN",
    "model_admission_status": "NOT_DONE",
    "production_operational_status": "NOT_ATTESTED",
    "reasons": [],
}
canonical = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
payload["report_sha256"] = hashlib.sha256(canonical.encode()).hexdigest()
(root / "finalization-report.json").write_text(
    json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
)
PY

(
  cd "$EVIDENCE_ROOT"
  find . -type f ! -name evidence-sha256.txt -print0 \
    | LC_ALL=C sort -z \
    | xargs -0 sha256sum > evidence-sha256.txt
)
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner \
  -C "$EVIDENCE_ROOT" -czf "$FINAL_ROOT/bounded-evidence.tar.gz" .
if [[ "$(stat -c %s "$FINAL_ROOT/bounded-evidence.tar.gz")" -gt 50000000 ]]; then
  echo 'bounded evidence archive exceeds 50 MB' >&2
  exit 1
fi

write_status COMPLETE
trap - ERR
cleanup_secrets
trap - EXIT
echo 'VERIFIED_BUNDLES_RESTORED'
