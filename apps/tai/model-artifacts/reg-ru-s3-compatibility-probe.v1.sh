#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

usage() {
  echo "usage: $0 --authority FILE --output REPORT.json" >&2
}

AUTHORITY=""
OUTPUT=""
while (($#)); do
  case "$1" in
    --authority) AUTHORITY="${2:-}"; shift 2 ;;
    --output) OUTPUT="${2:-}"; shift 2 ;;
    *) usage; exit 64 ;;
  esac
done
[[ -n "$AUTHORITY" && -n "$OUTPUT" ]] || { usage; exit 64; }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
TAI_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
export PYTHONPATH="$TAI_ROOT${PYTHONPATH:+:$PYTHONPATH}"

TMP_ROOT="$(mktemp -d)"
chmod 700 "$TMP_ROOT"
OPEN_UPLOAD_ID=""
OPEN_UPLOAD_KEY=""
CONTROL_OPEN_UPLOAD_ID=""
CONTROL_OPEN_UPLOAD_KEY=""
UNEXPECTED_DELETE_MARKER_VERSION=""
STREAM_KEY=""
ADMIN_ACCESS_KEY_ID=""
ADMIN_SECRET_ACCESS_KEY=""
FINALIZER_ACCESS_KEY_ID=""
FINALIZER_SECRET_ACCESS_KEY=""
CONTROL_ACCESS_KEY_ID=""
CONTROL_SECRET_ACCESS_KEY=""

ENDPOINT="https://s3.regru.cloud"
REGION="us-east-1"
BUCKET="tai-model-bundles-prod-01"
PREFIX="tai/model-bundles/v1"
CA_BUNDLE="/etc/ssl/certs/ca-certificates.crt"
export AWS_CA_BUNDLE="$CA_BUNDLE"
export REQUESTS_CA_BUNDLE="$CA_BUNDLE"
export AWS_REQUEST_CHECKSUM_CALCULATION="when_required"
export AWS_RESPONSE_CHECKSUM_VALIDATION="when_required"
export AWS_EC2_METADATA_DISABLED="true"
export AWS_PAGER=""
AWS_ARGS=(--no-cli-pager --endpoint-url "$ENDPOINT" --region "$REGION"
  --cli-connect-timeout 20 --cli-read-timeout 120)

admin_aws() {
  AWS_ACCESS_KEY_ID="$ADMIN_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$ADMIN_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION="$REGION" aws "${AWS_ARGS[@]}" "$@"
}
finalizer_aws() {
  AWS_ACCESS_KEY_ID="$FINALIZER_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$FINALIZER_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION="$REGION" aws "${AWS_ARGS[@]}" "$@"
}
control_aws() {
  AWS_ACCESS_KEY_ID="$CONTROL_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$CONTROL_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION="$REGION" aws "${AWS_ARGS[@]}" "$@"
}

is_authorization_denial() {
  local stderr_path="$1"
  if grep -Eqi \
    'SSL|certificate|timed out|timeout|connect|endpoint|name resolution|temporary failure|internalerror|serviceunavailable|status(code)?:? 5[0-9][0-9]' \
    "$stderr_path"; then
    return 1
  fi
  grep -Eq \
    'An error occurred \((AccessDenied|AccessDeniedException|Forbidden|UnauthorizedOperation|403)\)' \
    "$stderr_path"
}

expect_authorization_denied() {
  local reason="$1"
  shift
  local safe_reason="${reason//[^A-Za-z0-9_.-]/_}"
  local stdout_path="$TMP_ROOT/denial-$safe_reason.stdout"
  local stderr_path="$TMP_ROOT/denial-$safe_reason.stderr"
  if "$@" >"$stdout_path" 2>"$stderr_path"; then
    echo "FAILED_CLOSED:$reason" >&2
    exit 2
  fi
  if ! is_authorization_denial "$stderr_path"; then
    echo "FAILED_CLOSED:${reason}_NOT_AUTHORIZATION_DENIAL" >&2
    exit 2
  fi
}

verify_compliance_retention_90d() {
  python3 - "$1" <<'PY'
import json
import sys
from datetime import datetime, timedelta, timezone

retention = json.load(open(sys.argv[1], encoding="utf-8"))["Retention"]
assert retention["Mode"] == "COMPLIANCE"
retain_until = datetime.fromisoformat(str(retention["RetainUntilDate"]).replace("Z", "+00:00"))
assert retain_until.tzinfo is not None
remaining = retain_until.astimezone(timezone.utc) - datetime.now(timezone.utc)
assert timedelta(days=89) <= remaining <= timedelta(days=91)
PY
}

cleanup() {
  local status=$?
  trap - EXIT HUP INT TERM
  set +e
  local cleanup_failed=0
  if [[ -n "$OPEN_UPLOAD_ID" ]]; then
    finalizer_aws s3api abort-multipart-upload --bucket "$BUCKET" \
      --key "$OPEN_UPLOAD_KEY" --upload-id "$OPEN_UPLOAD_ID" >/dev/null 2>&1 \
      || cleanup_failed=1
  fi
  if [[ -n "$CONTROL_OPEN_UPLOAD_ID" ]]; then
    admin_aws s3api abort-multipart-upload --bucket "$BUCKET" \
      --key "$CONTROL_OPEN_UPLOAD_KEY" --upload-id "$CONTROL_OPEN_UPLOAD_ID" >/dev/null 2>&1 \
      || cleanup_failed=1
  fi
  if [[ -n "$UNEXPECTED_DELETE_MARKER_VERSION" && -n "$STREAM_KEY" ]]; then
    admin_aws s3api delete-object --bucket "$BUCKET" --key "$STREAM_KEY" \
      --version-id "$UNEXPECTED_DELETE_MARKER_VERSION" >/dev/null 2>&1 \
      || cleanup_failed=1
  fi
  unset ADMIN_ACCESS_KEY_ID ADMIN_SECRET_ACCESS_KEY
  unset FINALIZER_ACCESS_KEY_ID FINALIZER_SECRET_ACCESS_KEY
  unset CONTROL_ACCESS_KEY_ID CONTROL_SECRET_ACCESS_KEY
  unset AWS_CA_BUNDLE REQUESTS_CA_BUNDLE AWS_REQUEST_CHECKSUM_CALCULATION
  unset AWS_RESPONSE_CHECKSUM_VALIDATION AWS_EC2_METADATA_DISABLED AWS_PAGER
  rm -rf -- "$TMP_ROOT"
  if ((cleanup_failed)); then
    echo "FAILED_CLOSED:BOUNDED_CLEANUP_FAILED" >&2
    exit 70
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

command -v python3 >/dev/null
python3 -m tai.reg_ru_s3_compatibility_cli validate \
  --authority "$AUTHORITY" --output "$TMP_ROOT/authority-gate.json" >/dev/null
python3 -m tai.reg_ru_s3_compatibility_cli reserve-output \
  --output "$OUTPUT" >/dev/null

for tool in aws curl sha256sum grep awk; do command -v "$tool" >/dev/null; done
[[ -t 0 && -t 1 ]] || { echo "FAILED_CLOSED:INTERACTIVE_TTY_REQUIRED" >&2; exit 2; }
read -rsp "REG.RU owner/admin Access Key ID (hidden): " ADMIN_ACCESS_KEY_ID; echo
read -rsp "REG.RU owner/admin Secret Access Key (hidden): " ADMIN_SECRET_ACCESS_KEY; echo
read -rsp "REG.RU finalizer Access Key ID (hidden): " FINALIZER_ACCESS_KEY_ID; echo
read -rsp "REG.RU finalizer Secret Access Key (hidden): " FINALIZER_SECRET_ACCESS_KEY; echo
read -rsp "REG.RU control Access Key ID (hidden): " CONTROL_ACCESS_KEY_ID; echo
read -rsp "REG.RU control Secret Access Key (hidden): " CONTROL_SECRET_ACCESS_KEY; echo
for value in "$ADMIN_ACCESS_KEY_ID" "$ADMIN_SECRET_ACCESS_KEY" \
  "$FINALIZER_ACCESS_KEY_ID" "$FINALIZER_SECRET_ACCESS_KEY" \
  "$CONTROL_ACCESS_KEY_ID" "$CONTROL_SECRET_ACCESS_KEY"; do
  [[ -n "$value" ]] || { echo "FAILED_CLOSED:EMPTY_CREDENTIAL" >&2; exit 2; }
done
[[ "$ADMIN_ACCESS_KEY_ID" != "$FINALIZER_ACCESS_KEY_ID" ]] \
  || { echo "FAILED_CLOSED:ADMIN_FINALIZER_KEY_COLLISION" >&2; exit 2; }
[[ "$ADMIN_ACCESS_KEY_ID" != "$CONTROL_ACCESS_KEY_ID" ]] \
  || { echo "FAILED_CLOSED:ADMIN_CONTROL_KEY_COLLISION" >&2; exit 2; }
[[ "$FINALIZER_ACCESS_KEY_ID" != "$CONTROL_ACCESS_KEY_ID" ]] \
  || { echo "FAILED_CLOSED:FINALIZER_CONTROL_KEY_COLLISION" >&2; exit 2; }

admin_aws s3api get-bucket-location --bucket "$BUCKET" >"$TMP_ROOT/admin-location.json"
admin_aws s3api get-bucket-versioning --bucket "$BUCKET" >"$TMP_ROOT/versioning.json"
admin_aws s3api get-object-lock-configuration --bucket "$BUCKET" >"$TMP_ROOT/object-lock.json"
admin_aws s3api get-bucket-policy --bucket "$BUCKET" >"$TMP_ROOT/policy-wrapper.json"
python3 - "$TMP_ROOT/versioning.json" "$TMP_ROOT/object-lock.json" <<'PY'
import json, sys
versioning = json.load(open(sys.argv[1], encoding="utf-8"))
lock = json.load(open(sys.argv[2], encoding="utf-8"))["ObjectLockConfiguration"]
assert versioning == {"Status": "Enabled"}
assert lock["ObjectLockEnabled"] == "Enabled"
assert lock["Rule"]["DefaultRetention"] == {"Mode": "COMPLIANCE", "Days": 90}
PY
python3 -m tai.reg_ru_s3_compatibility_cli unwrap-policy \
  --aws-output "$TMP_ROOT/policy-wrapper.json" --output "$TMP_ROOT/policy.json" >/dev/null
python3 -m tai.reg_ru_s3_compatibility_cli validate-policy \
  --authority "$AUTHORITY" --policy "$TMP_ROOT/policy.json" \
  --output "$TMP_ROOT/policy-summary.json" >/dev/null

finalizer_aws s3api get-bucket-location --bucket "$BUCKET" >"$TMP_ROOT/finalizer-location.json"
finalizer_aws s3api get-bucket-versioning --bucket "$BUCKET" >"$TMP_ROOT/finalizer-versioning.json"
finalizer_aws s3api list-objects-v2 --bucket "$BUCKET" --prefix "$PREFIX" --max-keys 1 \
  >"$TMP_ROOT/finalizer-list.json"
finalizer_aws s3api list-object-versions --bucket "$BUCKET" --prefix "$PREFIX" --max-items 1 \
  >"$TMP_ROOT/finalizer-versions.json"
finalizer_aws s3api list-multipart-uploads --bucket "$BUCKET" --prefix "$PREFIX" \
  >"$TMP_ROOT/finalizer-multipart-list.json"

expect_authorization_denied CONTROL_GET_BUCKET_LOCATION_ALLOWED control_aws \
  s3api get-bucket-location --bucket "$BUCKET"
expect_authorization_denied CONTROL_LIST_BUCKET_ALLOWED control_aws \
  s3api list-objects-v2 --bucket "$BUCKET" --prefix "$PREFIX" --max-keys 1
if control_aws s3api create-multipart-upload --bucket "$BUCKET" \
  --key "$PREFIX/compatibility-probes/control-should-deny.bin" \
  >"$TMP_ROOT/control-create.json" 2>"$TMP_ROOT/control-create.stderr"; then
  CONTROL_OPEN_UPLOAD_KEY="$PREFIX/compatibility-probes/control-should-deny.bin"
  CONTROL_OPEN_UPLOAD_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["UploadId"])' "$TMP_ROOT/control-create.json")"
  echo "FAILED_CLOSED:CONTROL_OBJECT_WRITE_ALLOWED" >&2
  exit 2
elif ! is_authorization_denial "$TMP_ROOT/control-create.stderr"; then
  echo "FAILED_CLOSED:CONTROL_OBJECT_WRITE_NOT_AUTHORIZATION_DENIAL" >&2
  exit 2
fi

expect_authorization_denied FINALIZER_GET_BUCKET_POLICY_ALLOWED finalizer_aws \
  s3api get-bucket-policy --bucket "$BUCKET"
expect_authorization_denied FINALIZER_PUT_BUCKET_POLICY_ALLOWED finalizer_aws \
  s3api put-bucket-policy --bucket "$BUCKET" --policy "file://$TMP_ROOT/policy.json"
expect_authorization_denied FINALIZER_PUT_BUCKET_VERSIONING_ALLOWED finalizer_aws \
  s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
expect_authorization_denied FINALIZER_PUT_OBJECT_LOCK_ALLOWED finalizer_aws \
  s3api put-object-lock-configuration --bucket "$BUCKET" \
  --object-lock-configuration \
  '{"ObjectLockEnabled":"Enabled","Rule":{"DefaultRetention":{"Mode":"COMPLIANCE","Days":90}}}'
if admin_aws s3api get-bucket-lifecycle-configuration --bucket "$BUCKET" \
  >"$TMP_ROOT/lifecycle.json" 2>"$TMP_ROOT/lifecycle.stderr"; then
  expect_authorization_denied FINALIZER_PUT_LIFECYCLE_ALLOWED finalizer_aws \
    s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
    --lifecycle-configuration "file://$TMP_ROOT/lifecycle.json"
elif ! grep -Eq 'NoSuchLifecycleConfiguration|NoSuchLifecycleConfigurationException' \
  "$TMP_ROOT/lifecycle.stderr"; then
  echo "FAILED_CLOSED:ADMIN_LIFECYCLE_READ_FAILED" >&2
  exit 2
fi

echo "Exact mutation confirmation required:"
echo "I AUTHORIZE REG.RU S3 PANEL COMPATIBILITY PROBE tai-model-bundles-prod-01/tai/model-bundles/v1 MAX_LOCKED_BYTES=9437184"
read -r CONFIRMATION
[[ "$CONFIRMATION" == \
  "I AUTHORIZE REG.RU S3 PANEL COMPATIBILITY PROBE tai-model-bundles-prod-01/tai/model-bundles/v1 MAX_LOCKED_BYTES=9437184" ]] \
  || { echo "FAILED_CLOSED:CONFIRMATION_MISMATCH" >&2; exit 2; }

PROBE_ID="$(python3 -c 'import secrets; print(secrets.token_hex(12))')"
STREAM_KEY="$PREFIX/compatibility-probes/$PROBE_ID/stream.bin"
MULTIPART_KEY="$PREFIX/compatibility-probes/$PROBE_ID/multipart-abort.bin"

finalizer_aws s3api create-multipart-upload --bucket "$BUCKET" --key "$MULTIPART_KEY" \
  >"$TMP_ROOT/create-multipart.json"
OPEN_UPLOAD_KEY="$MULTIPART_KEY"
OPEN_UPLOAD_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["UploadId"])' "$TMP_ROOT/create-multipart.json")"
finalizer_aws s3api list-multipart-uploads --bucket "$BUCKET" --prefix "$MULTIPART_KEY" \
  >"$TMP_ROOT/list-multipart.json"
python3 - "$TMP_ROOT/list-multipart.json" "$MULTIPART_KEY" "$OPEN_UPLOAD_ID" <<'PY'
import json, sys
payload=json.load(open(sys.argv[1], encoding="utf-8"))
assert any(item.get("Key")==sys.argv[2] and item.get("UploadId")==sys.argv[3]
           for item in payload.get("Uploads", []))
PY
python3 -c 'import sys; sys.stdout.buffer.write(b"M" * (5 * 1024 * 1024))' \
  >"$TMP_ROOT/part.bin"
finalizer_aws s3api upload-part --bucket "$BUCKET" --key "$MULTIPART_KEY" \
  --upload-id "$OPEN_UPLOAD_ID" --part-number 1 --body "$TMP_ROOT/part.bin" \
  >"$TMP_ROOT/upload-part.json"
finalizer_aws s3api list-parts --bucket "$BUCKET" --key "$MULTIPART_KEY" \
  --upload-id "$OPEN_UPLOAD_ID" >"$TMP_ROOT/list-parts.json"
python3 - "$TMP_ROOT/list-parts.json" <<'PY'
import json, sys
payload=json.load(open(sys.argv[1], encoding="utf-8"))
assert len(payload.get("Parts", [])) == 1
assert payload["Parts"][0]["PartNumber"] == 1
assert payload["Parts"][0]["Size"] == 5 * 1024 * 1024
PY
finalizer_aws s3api abort-multipart-upload --bucket "$BUCKET" --key "$MULTIPART_KEY" \
  --upload-id "$OPEN_UPLOAD_ID"
OPEN_UPLOAD_ID=""
finalizer_aws s3api list-multipart-uploads --bucket "$BUCKET" --prefix "$MULTIPART_KEY" \
  >"$TMP_ROOT/list-multipart-after.json"
python3 - "$TMP_ROOT/list-multipart-after.json" "$MULTIPART_KEY" <<'PY'
import json, sys
payload=json.load(open(sys.argv[1], encoding="utf-8"))
assert not any(item.get("Key")==sys.argv[2] for item in payload.get("Uploads", []))
PY

python3 -c 'import sys; sys.stdout.buffer.write(b"T" * (9 * 1024 * 1024))' \
  >"$TMP_ROOT/stream-source.bin"
SOURCE_SHA="$(sha256sum "$TMP_ROOT/stream-source.bin" | awk '{print $1}')"
printf '[default]\ns3 =\n  multipart_threshold = 5MB\n  multipart_chunksize = 5MB\n' \
  >"$TMP_ROOT/aws-config"
export AWS_CONFIG_FILE="$TMP_ROOT/aws-config"
finalizer_aws s3 cp "$TMP_ROOT/stream-source.bin" "s3://$BUCKET/$STREAM_KEY" \
  --only-show-errors --no-progress
unset AWS_CONFIG_FILE
finalizer_aws s3api head-object --bucket "$BUCKET" --key "$STREAM_KEY" \
  >"$TMP_ROOT/stream-head.json"
STREAM_VERSION="$(python3 -c 'import json,sys; payload=json.load(open(sys.argv[1])); assert payload["ContentLength"]==9437184; print(payload["VersionId"])' "$TMP_ROOT/stream-head.json")"
[[ -n "$STREAM_VERSION" && "$STREAM_VERSION" != "null" ]]
admin_aws s3api get-object-retention --bucket "$BUCKET" --key "$STREAM_KEY" \
  --version-id "$STREAM_VERSION" >"$TMP_ROOT/stream-retention.json"
verify_compliance_retention_90d "$TMP_ROOT/stream-retention.json"
expect_authorization_denied FINALIZER_GET_OBJECT_RETENTION_ALLOWED finalizer_aws \
  s3api get-object-retention --bucket "$BUCKET" --key "$STREAM_KEY" \
  --version-id "$STREAM_VERSION"
RETENTION_JSON="$(python3 -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1]))["Retention"],separators=(",",":")))' "$TMP_ROOT/stream-retention.json")"
expect_authorization_denied FINALIZER_PUT_OBJECT_RETENTION_ALLOWED finalizer_aws \
  s3api put-object-retention --bucket "$BUCKET" --key "$STREAM_KEY" \
  --version-id "$STREAM_VERSION" --retention "$RETENTION_JSON"

if finalizer_aws s3api delete-object --bucket "$BUCKET" --key "$STREAM_KEY" \
  >"$TMP_ROOT/finalizer-delete.json" 2>"$TMP_ROOT/finalizer-delete.stderr"; then
  UNEXPECTED_DELETE_MARKER_VERSION="$(python3 -c 'import json,sys; payload=json.load(open(sys.argv[1])); print(payload.get("VersionId", ""))' "$TMP_ROOT/finalizer-delete.json")"
  echo "FAILED_CLOSED:FINALIZER_VERSIONLESS_DELETE_ALLOWED" >&2
  exit 2
elif ! is_authorization_denial "$TMP_ROOT/finalizer-delete.stderr"; then
  echo "FAILED_CLOSED:FINALIZER_VERSIONLESS_DELETE_NOT_AUTHORIZATION_DENIAL" >&2
  exit 2
fi
expect_authorization_denied FINALIZER_EXACT_VERSION_DELETE_ALLOWED finalizer_aws \
  s3api delete-object --bucket "$BUCKET" --key "$STREAM_KEY" --version-id "$STREAM_VERSION"
expect_authorization_denied ADMIN_LOCKED_VERSION_DELETE_ALLOWED admin_aws \
  s3api delete-object --bucket "$BUCKET" --key "$STREAM_KEY" --version-id "$STREAM_VERSION"

finalizer_aws s3api get-object --bucket "$BUCKET" --key "$STREAM_KEY" \
  --version-id "$STREAM_VERSION" "$TMP_ROOT/stream-restored.bin" >/dev/null
RESTORED_SHA="$(sha256sum "$TMP_ROOT/stream-restored.bin" | awk '{print $1}')"
[[ "$SOURCE_SHA" == "$RESTORED_SHA" ]]
finalizer_aws s3api head-object --bucket "$BUCKET" --key "$STREAM_KEY" >/dev/null
expect_authorization_denied CONTROL_KNOWN_OBJECT_GET_ALLOWED control_aws \
  s3api get-object --bucket "$BUCKET" --key "$STREAM_KEY" --version-id "$STREAM_VERSION" \
  "$TMP_ROOT/control-get.bin"

ANON_LIST="$(curl -q --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --proto '=https' --cacert "$CA_BUNDLE" --max-redirs 0 \
  --connect-timeout 20 --max-time 60 "$ENDPOINT/$BUCKET?list-type=2&max-keys=1")"
ANON_GET="$(curl -q --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --proto '=https' --cacert "$CA_BUNDLE" --max-redirs 0 \
  --connect-timeout 20 --max-time 60 "$ENDPOINT/$BUCKET/$STREAM_KEY")"
INSECURE_ENDPOINT="${ENDPOINT/https:/http:}"
ANON_INSECURE_GET="$(curl -q --silent --show-error --output /dev/null \
  --write-out '%{http_code}' --proto '=http' --max-redirs 0 \
  --connect-timeout 20 --max-time 60 "$INSECURE_ENDPOINT/$BUCKET/$STREAM_KEY")"
[[ "$ANON_LIST" == 401 || "$ANON_LIST" == 403 ]]
[[ "$ANON_GET" == 401 || "$ANON_GET" == 403 ]]
[[ "$ANON_INSECURE_GET" == 401 || "$ANON_INSECURE_GET" == 403 ]]

POLICY_SHA="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["policy_sha256"])' "$TMP_ROOT/policy-summary.json")"
python3 - "$TMP_ROOT/observed.json" "$POLICY_SHA" "$ANON_LIST" "$ANON_GET" \
  "$ANON_INSECURE_GET" "$SOURCE_SHA" "$RESTORED_SHA" <<'PY'
import json, sys
from pathlib import Path
output=Path(sys.argv[1])
payload={
 "schema_version":"tai.reg-ru-s3-panel-compatibility-observed.v1",
 "target":{"endpoint":"https://s3.regru.cloud","region":"us-east-1",
           "bucket":"tai-model-bundles-prod-01","prefix":"tai/model-bundles/v1",
           "operator_confirmed_capacity_bytes":200000000000},
 "commands":{"admin_bucket_controls_read":True,"admin_policy_read":True,
             "policy_exact":True,"finalizer_bucket_metadata_allowed":True,
             "finalizer_prefix_listing_allowed":True,
             "finalizer_multipart_listing_allowed":True,
             "control_bucket_metadata_denied":True,
             "control_prefix_listing_denied":True,
             "control_object_put_denied":True},
 "configuration":{"versioning_status":"Enabled","object_lock_status":"Enabled",
                  "retention_mode":"COMPLIANCE","retention_days":90},
 "policy":{"sha256":sys.argv[2]},
 "principal":{"finalizer_allowed":True,"control_denied":True,
              "control_has_no_policy_rules":True},
 "privilege_denials":{"finalizer_delete_denied":True,
   "finalizer_delete_version_denied":True,"finalizer_get_bucket_policy_denied":True,
   "finalizer_put_bucket_policy_denied":True,
   "finalizer_put_bucket_versioning_denied":True,
   "finalizer_put_object_lock_denied":True,
   "finalizer_put_object_retention_denied":True,
   "finalizer_get_object_retention_denied":True,
   "finalizer_put_lifecycle_denied_or_not_applicable":True,
   "admin_locked_version_delete_denied":True},
 "privacy":{"anonymous_list_http_status":int(sys.argv[3]),
            "anonymous_known_object_http_status":int(sys.argv[4]),
            "anonymous_insecure_known_object_http_status":int(sys.argv[5])},
 "multipart":{"create_succeeded":True,"listed":True,"part_uploaded":True,
              "parts_listed":True,"abort_succeeded":True,"absent_after_abort":True},
 "stream":{"upload_succeeded":True,"version_id_present":True,
           "retention_present":True,"exact_version_restore_succeeded":True,
           "sha256_match":True,"known_object_still_current":True,
           "size_bytes":9437184,"retention_mode":"COMPLIANCE",
           "retention_deadline_90d":True,"source_sha256":sys.argv[6],
           "restored_sha256":sys.argv[7]},
 "bounds":{"retained_locked_bytes":9437184,"aborted_multipart_retained_bytes":0,
           "credentials_in_output":False,"raw_policy_retained":False}}
output.write_text(json.dumps(payload, indent=2, sort_keys=True)+"\n", encoding="utf-8")
PY

python3 -m tai.reg_ru_s3_compatibility_cli evaluate \
  --authority "$AUTHORITY" --observed "$TMP_ROOT/observed.json" \
  --output "$OUTPUT" --reserved-output
