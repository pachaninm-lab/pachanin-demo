#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

usage() {
  echo "usage: $0 --authority FILE --attestation FILE --output REPORT.json" >&2
}

AUTHORITY=""
ATTESTATION=""
OUTPUT=""
while (($#)); do
  case "$1" in
    --authority) AUTHORITY="${2:-}"; shift 2 ;;
    --attestation) ATTESTATION="${2:-}"; shift 2 ;;
    --output) OUTPUT="${2:-}"; shift 2 ;;
    *) usage; exit 64 ;;
  esac
done
[[ -n "$AUTHORITY" && -n "$ATTESTATION" && -n "$OUTPUT" ]] || { usage; exit 64; }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
TAI_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
export PYTHONPATH="$TAI_ROOT${PYTHONPATH:+:$PYTHONPATH}"

command -v python3 >/dev/null
TMP_ROOT="$(mktemp -d)"
chmod 700 "$TMP_ROOT"
POLICY_DIRTY=0
POLICY_WAS_ABSENT=0
PROBE_SUCCEEDED=0
OPEN_UPLOAD_ID=""
OPEN_UPLOAD_KEY=""
ADMIN_ACCESS_KEY_ID=""
ADMIN_SECRET_ACCESS_KEY=""
FINALIZER_ACCESS_KEY_ID=""
FINALIZER_SECRET_ACCESS_KEY=""

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
  if grep -Eqi \
    'SSL|certificate|timed out|timeout|connect|endpoint|name resolution|temporary failure|internalerror|serviceunavailable|status(code)?:? 5[0-9][0-9]' \
    "$stderr_path"; then
    echo "FAILED_CLOSED:${reason}_TRANSPORT_OR_SERVICE_FAILURE" >&2
    exit 2
  fi
  if ! grep -Eq \
    'An error occurred \((AccessDenied|AccessDeniedException|Forbidden|UnauthorizedOperation|403)\)' \
    "$stderr_path"; then
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
restore_policy() {
  if ((POLICY_WAS_ABSENT)); then
    admin_aws s3api delete-bucket-policy --bucket "$BUCKET" >/dev/null 2>&1 || return 1
    if admin_aws s3api get-bucket-policy --bucket "$BUCKET" \
      >"$TMP_ROOT/rollback-policy-wrapper.json" 2>"$TMP_ROOT/rollback-policy.stderr"; then
      return 1
    fi
    grep -Eq 'NoSuchBucketPolicy|NoSuchBucketPolicyException' \
      "$TMP_ROOT/rollback-policy.stderr"
  else
    admin_aws s3api put-bucket-policy --bucket "$BUCKET" \
      --policy "file://$TMP_ROOT/original-policy.json" >/dev/null 2>&1 || return 1
    admin_aws s3api get-bucket-policy --bucket "$BUCKET" \
      >"$TMP_ROOT/rollback-policy-wrapper.json" 2>/dev/null || return 1
    python3 -m tai.reg_ru_s3_compatibility_cli unwrap-policy \
      --aws-output "$TMP_ROOT/rollback-policy-wrapper.json" \
      --output "$TMP_ROOT/rollback-policy-readback.json" >/dev/null || return 1
    python3 - "$TMP_ROOT/original-policy.json" \
      "$TMP_ROOT/rollback-policy-readback.json" <<'PY'
import hashlib,json,sys
def digest(path):
    value=json.load(open(path,encoding="utf-8"))
    raw=json.dumps(value,ensure_ascii=False,separators=(",",":"),sort_keys=True).encode()
    return hashlib.sha256(raw).hexdigest()
assert digest(sys.argv[1]) == digest(sys.argv[2])
PY
  fi
}
cleanup() {
  local status=$?
  trap - EXIT HUP INT TERM
  set +e
  local abort_cleanup=0
  if [[ -n "$OPEN_UPLOAD_ID" ]]; then
    if ! finalizer_aws s3api abort-multipart-upload --bucket "$BUCKET" \
      --key "$OPEN_UPLOAD_KEY" --upload-id "$OPEN_UPLOAD_ID" >/dev/null 2>&1; then
      abort_cleanup=1
    elif ! finalizer_aws s3api list-multipart-uploads --bucket "$BUCKET" \
      --prefix "$OPEN_UPLOAD_KEY" >"$TMP_ROOT/cleanup-multipart-list.json" 2>/dev/null; then
      abort_cleanup=1
    elif ! python3 - "$TMP_ROOT/cleanup-multipart-list.json" \
      "$OPEN_UPLOAD_KEY" "$OPEN_UPLOAD_ID" <<'PY'
import json
import sys

payload = json.load(open(sys.argv[1], encoding="utf-8"))
assert not any(
    item.get("Key") == sys.argv[2] and item.get("UploadId") == sys.argv[3]
    for item in payload.get("Uploads", [])
)
PY
    then
      abort_cleanup=1
    fi
  fi
  local rollback=0
  if ((POLICY_DIRTY)) && ! restore_policy; then rollback=1; fi
  unset ADMIN_ACCESS_KEY_ID ADMIN_SECRET_ACCESS_KEY
  unset FINALIZER_ACCESS_KEY_ID FINALIZER_SECRET_ACCESS_KEY
  unset AWS_CA_BUNDLE REQUESTS_CA_BUNDLE AWS_REQUEST_CHECKSUM_CALCULATION
  unset AWS_RESPONSE_CHECKSUM_VALIDATION AWS_EC2_METADATA_DISABLED AWS_PAGER
  rm -rf -- "$TMP_ROOT"
  if ((rollback || abort_cleanup)); then
    ((rollback)) && echo "FAILED_CLOSED:ROLLBACK_FAILED" >&2
    ((abort_cleanup)) && echo "FAILED_CLOSED:MULTIPART_CLEANUP_ABORT_FAILED" >&2
    exit 70
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# This gate runs before tool discovery, credential input, network access or mutation.
python3 -m tai.reg_ru_s3_compatibility_cli validate \
  --authority "$AUTHORITY" --attestation "$ATTESTATION" \
  --output "$TMP_ROOT/attestation-gate.json" >/dev/null
python3 -m tai.reg_ru_s3_compatibility_cli reserve-output \
  --output "$OUTPUT" >/dev/null

for tool in aws curl sha256sum grep; do command -v "$tool" >/dev/null; done
[[ -t 0 && -t 1 ]] || { echo "FAILED_CLOSED:INTERACTIVE_TTY_REQUIRED" >&2; exit 2; }
read -rsp "REG.RU setup/admin Access Key ID (hidden): " ADMIN_ACCESS_KEY_ID; echo
read -rsp "REG.RU setup/admin Secret Access Key (hidden): " ADMIN_SECRET_ACCESS_KEY; echo
read -rsp "REG.RU dedicated finalizer Access Key ID (hidden): " FINALIZER_ACCESS_KEY_ID; echo
read -rsp "REG.RU dedicated finalizer Secret Access Key (hidden): " FINALIZER_SECRET_ACCESS_KEY; echo
for value in "$ADMIN_ACCESS_KEY_ID" "$ADMIN_SECRET_ACCESS_KEY" \
  "$FINALIZER_ACCESS_KEY_ID" "$FINALIZER_SECRET_ACCESS_KEY"; do
  [[ -n "$value" ]] || { echo "FAILED_CLOSED:EMPTY_CREDENTIAL" >&2; exit 2; }
done

admin_aws s3api head-bucket --bucket "$BUCKET" >"$TMP_ROOT/head.json" 2>/dev/null
admin_aws s3api get-bucket-versioning --bucket "$BUCKET" \
  >"$TMP_ROOT/versioning.json" 2>/dev/null
admin_aws s3api get-object-lock-configuration --bucket "$BUCKET" \
  >"$TMP_ROOT/object-lock.json" 2>/dev/null
python3 - "$TMP_ROOT/versioning.json" "$TMP_ROOT/object-lock.json" <<'PY'
import json, sys
versioning = json.load(open(sys.argv[1], encoding="utf-8"))
lock = json.load(open(sys.argv[2], encoding="utf-8"))["ObjectLockConfiguration"]
assert versioning == {"Status": "Enabled"}
assert lock["ObjectLockEnabled"] == "Enabled"
assert lock["Rule"]["DefaultRetention"] == {"Mode": "COMPLIANCE", "Days": 90}
PY

if admin_aws s3api get-bucket-policy --bucket "$BUCKET" \
  >"$TMP_ROOT/policy-wrapper.json" 2>"$TMP_ROOT/policy.stderr"; then
  python3 -m tai.reg_ru_s3_compatibility_cli unwrap-policy \
    --aws-output "$TMP_ROOT/policy-wrapper.json" \
    --output "$TMP_ROOT/original-policy.json"
else
  grep -Eq 'NoSuchBucketPolicy|NoSuchBucketPolicyException' "$TMP_ROOT/policy.stderr" \
    || { echo "FAILED_CLOSED:BUCKET_POLICY_READ_FAILED" >&2; exit 2; }
  printf '%s\n' "NO_BUCKET_POLICY" >"$TMP_ROOT/original-policy.json"
  POLICY_WAS_ABSENT=1
fi

echo "Exact mutation confirmation required:"
echo "I AUTHORIZE REG.RU S3 COMPATIBILITY PROBE tai-model-bundles-prod-01/tai/model-bundles/v1 MAX_LOCKED_BYTES=9441280"
read -r CONFIRMATION
[[ "$CONFIRMATION" == \
  "I AUTHORIZE REG.RU S3 COMPATIBILITY PROBE tai-model-bundles-prod-01/tai/model-bundles/v1 MAX_LOCKED_BYTES=9441280" ]] \
  || { echo "FAILED_CLOSED:CONFIRMATION_MISMATCH" >&2; exit 2; }

PROBE_ID="$(python3 -c 'import secrets; print(secrets.token_hex(12))')"
STREAM_KEY="$PREFIX/compatibility-probes/$PROBE_ID/stream.bin"
WORM_KEY="tai-reg-ru-compatibility-probes/$PROBE_ID/worm.bin"
MULTIPART_KEY="$PREFIX/compatibility-probes/$PROBE_ID/multipart-abort.bin"

python3 -m tai.reg_ru_s3_compatibility_cli build-policy \
  --authority "$AUTHORITY" --attestation "$ATTESTATION" \
  --existing-policy "$TMP_ROOT/original-policy.json" --mode final \
  --output "$TMP_ROOT/final-policy.json"
POLICY_DIRTY=1
admin_aws s3api put-bucket-policy --bucket "$BUCKET" \
  --policy "file://$TMP_ROOT/final-policy.json" >/dev/null

# Finalizer must not be able to repeat even no-op configuration mutations.
expect_authorization_denied FINALIZER_PUT_BUCKET_POLICY_ALLOWED finalizer_aws \
  s3api put-bucket-policy --bucket "$BUCKET" \
  --policy "file://$TMP_ROOT/final-policy.json"
expect_authorization_denied FINALIZER_PUT_BUCKET_VERSIONING_ALLOWED finalizer_aws \
  s3api put-bucket-versioning --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled
expect_authorization_denied FINALIZER_PUT_OBJECT_LOCK_ALLOWED finalizer_aws \
  s3api put-object-lock-configuration --bucket "$BUCKET" \
  --object-lock-configuration \
  '{"ObjectLockEnabled":"Enabled","Rule":{"DefaultRetention":{"Mode":"COMPLIANCE","Days":90}}}'

# Prove the multipart APIs used by finalization and leave no multipart payload.
finalizer_aws s3api create-multipart-upload --bucket "$BUCKET" --key "$MULTIPART_KEY" \
  >"$TMP_ROOT/create-multipart.json"
OPEN_UPLOAD_KEY="$MULTIPART_KEY"
OPEN_UPLOAD_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["UploadId"])' \
  "$TMP_ROOT/create-multipart.json")"
finalizer_aws s3api list-multipart-uploads --bucket "$BUCKET" --prefix "$MULTIPART_KEY" \
  >"$TMP_ROOT/list-multipart.json"
python3 - "$TMP_ROOT/list-multipart.json" "$MULTIPART_KEY" "$OPEN_UPLOAD_ID" <<'PY'
import json, sys
p=json.load(open(sys.argv[1])); assert any(
    u.get("Key")==sys.argv[2] and u.get("UploadId")==sys.argv[3] for u in p.get("Uploads", [])
)
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
p=json.load(open(sys.argv[1])); assert len(p.get("Parts", [])) == 1
assert p["Parts"][0]["PartNumber"] == 1 and p["Parts"][0]["Size"] == 5 * 1024 * 1024
PY
finalizer_aws s3api abort-multipart-upload --bucket "$BUCKET" --key "$MULTIPART_KEY" \
  --upload-id "$OPEN_UPLOAD_ID"
finalizer_aws s3api list-multipart-uploads --bucket "$BUCKET" --prefix "$MULTIPART_KEY" \
  >"$TMP_ROOT/list-multipart-after.json"
python3 - "$TMP_ROOT/list-multipart-after.json" "$MULTIPART_KEY" <<'PY'
import json, sys
p=json.load(open(sys.argv[1])); assert not any(
    u.get("Key")==sys.argv[2] for u in p.get("Uploads", [])
)
PY
OPEN_UPLOAD_ID=""

printf '[default]\ns3 =\n  multipart_threshold = 5MB\n  multipart_chunksize = 5MB\n' \
  >"$TMP_ROOT/aws-config"
export AWS_CONFIG_FILE="$TMP_ROOT/aws-config"
python3 -c 'import sys; sys.stdout.buffer.write(b"T" * (9 * 1024 * 1024))' | \
  finalizer_aws s3 cp - "s3://$BUCKET/$STREAM_KEY" --expected-size 9437184 \
    --only-show-errors --no-progress
unset AWS_CONFIG_FILE
finalizer_aws s3api head-object --bucket "$BUCKET" --key "$STREAM_KEY" \
  >"$TMP_ROOT/stream-head.json"
STREAM_VERSION="$(python3 -c 'import json,sys; p=json.load(open(sys.argv[1])); assert p["ContentLength"]==9437184; print(p["VersionId"])' "$TMP_ROOT/stream-head.json")"
finalizer_aws s3api get-object-retention --bucket "$BUCKET" --key "$STREAM_KEY" \
  --version-id "$STREAM_VERSION" >"$TMP_ROOT/stream-retention.json"
verify_compliance_retention_90d "$TMP_ROOT/stream-retention.json"
finalizer_aws s3api get-object --bucket "$BUCKET" --key "$STREAM_KEY" \
  --version-id "$STREAM_VERSION" "$TMP_ROOT/stream-restored.bin" >/dev/null
EXPECTED_SHA="$(python3 -c 'import hashlib; print(hashlib.sha256(b"T"*(9*1024*1024)).hexdigest())')"
[[ "$(sha256sum "$TMP_ROOT/stream-restored.bin" | awk '{print $1}')" == "$EXPECTED_SHA" ]]

# Anonymous privacy is tested against this known, existing object.
ANON_LIST="$(curl -q --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --proto '=https' --cacert "$CA_BUNDLE" --max-redirs 0 \
  --connect-timeout 20 --max-time 60 "$ENDPOINT/$BUCKET?list-type=2&max-keys=1")"
ANON_GET="$(curl -q --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --proto '=https' --cacert "$CA_BUNDLE" --max-redirs 0 \
  --connect-timeout 20 --max-time 60 "$ENDPOINT/$BUCKET/$STREAM_KEY")"
INSECURE_ENDPOINT="${ENDPOINT/https:/http:}"
ANON_INSECURE_GET="$(curl -q --silent --show-error --output /dev/null \
  --write-out '%{http_code}' --proto '=http' --max-redirs 0 \
  --connect-timeout 20 --max-time 60 \
  "$INSECURE_ENDPOINT/$BUCKET/$STREAM_KEY")"
[[ "$ANON_LIST" == 401 || "$ANON_LIST" == 403 ]]
[[ "$ANON_GET" == 401 || "$ANON_GET" == 403 ]]
[[ "$ANON_INSECURE_GET" == 401 || "$ANON_INSECURE_GET" == 403 ]]

# The global policy must reject a versionless delete even for setup/admin.
expect_authorization_denied GOVERNED_VERSIONLESS_DELETE_ALLOWED admin_aws \
  s3api delete-object --bucket "$BUCKET" --key "$STREAM_KEY"
finalizer_aws s3api head-object --bucket "$BUCKET" --key "$STREAM_KEY" >/dev/null

# Same-value object-retention mutation must still be denied to the finalizer.
RETENTION_JSON="$(python3 -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1]))["Retention"],separators=(",",":")))' "$TMP_ROOT/stream-retention.json")"
expect_authorization_denied FINALIZER_PUT_OBJECT_RETENTION_ALLOWED finalizer_aws \
  s3api put-object-retention --bucket "$BUCKET" --key "$STREAM_KEY" \
  --version-id "$STREAM_VERSION" --retention "$RETENTION_JSON"

# If lifecycle exists, a byte-identical no-op put must be denied; absence is attestation-only.
LIFECYCLE_BEHAVIOR="NOT_APPLICABLE_NO_EXISTING_CONFIGURATION"
if admin_aws s3api get-bucket-lifecycle-configuration --bucket "$BUCKET" \
  >"$TMP_ROOT/lifecycle.json" 2>/dev/null; then
  expect_authorization_denied FINALIZER_PUT_LIFECYCLE_ALLOWED finalizer_aws \
    s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
    --lifecycle-configuration "file://$TMP_ROOT/lifecycle.json"
  LIFECYCLE_BEHAVIOR="true"
fi

# Independent WORM baseline: delete marker operations work, locked data-version deletion does not.
python3 -c 'import sys; sys.stdout.buffer.write(b"W" * 4096)' >"$TMP_ROOT/worm.bin"
admin_aws s3api put-object --bucket "$BUCKET" --key "$WORM_KEY" \
  --body "$TMP_ROOT/worm.bin" >"$TMP_ROOT/worm-put.json"
WORM_VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["VersionId"])' "$TMP_ROOT/worm-put.json")"
admin_aws s3api delete-object --bucket "$BUCKET" --key "$WORM_KEY" \
  >"$TMP_ROOT/worm-marker.json"
MARKER_VERSION="$(python3 -c 'import json,sys; p=json.load(open(sys.argv[1])); assert p["DeleteMarker"] is True; print(p["VersionId"])' "$TMP_ROOT/worm-marker.json")"
admin_aws s3api delete-object --bucket "$BUCKET" --key "$WORM_KEY" \
  --version-id "$MARKER_VERSION" >/dev/null
expect_authorization_denied LOCKED_VERSION_DELETE_ALLOWED admin_aws \
  s3api delete-object --bucket "$BUCKET" --key "$WORM_KEY" \
  --version-id "$WORM_VERSION"
admin_aws s3api get-object --bucket "$BUCKET" --key "$WORM_KEY" \
  --version-id "$WORM_VERSION" "$TMP_ROOT/worm-restored.bin" >/dev/null
admin_aws s3api get-object-retention --bucket "$BUCKET" --key "$WORM_KEY" \
  --version-id "$WORM_VERSION" >"$TMP_ROOT/worm-retention.json"
verify_compliance_retention_90d "$TMP_ROOT/worm-retention.json"
[[ "$(sha256sum "$TMP_ROOT/worm.bin" | awk '{print $1}')" == \
  "$(sha256sum "$TMP_ROOT/worm-restored.bin" | awk '{print $1}')" ]]

# Principal selector proof on the exact known stream object.
for selector_mode in matching nonmatching; do
  extra=()
  [[ "$selector_mode" == nonmatching ]] && extra+=(--use-nonmatching-selector)
  python3 -m tai.reg_ru_s3_compatibility_cli build-policy \
    --authority "$AUTHORITY" --attestation "$ATTESTATION" \
    --existing-policy "$TMP_ROOT/final-policy.json" --mode canary \
    --canary-object-key "$STREAM_KEY" "${extra[@]}" \
    --output "$TMP_ROOT/canary-$selector_mode.json"
  admin_aws s3api put-bucket-policy --bucket "$BUCKET" \
    --policy "file://$TMP_ROOT/canary-$selector_mode.json" >/dev/null
  if [[ "$selector_mode" == matching ]]; then
    expect_authorization_denied PRINCIPAL_SELECTOR_DID_NOT_MATCH_FINALIZER finalizer_aws \
      s3api get-object --bucket "$BUCKET" --key "$STREAM_KEY" \
      --version-id "$STREAM_VERSION" "$TMP_ROOT/canary-finalizer.bin"
    admin_aws s3api get-object --bucket "$BUCKET" --key "$STREAM_KEY" \
      --version-id "$STREAM_VERSION" "$TMP_ROOT/canary-admin.bin" >/dev/null
  else
    finalizer_aws s3api get-object --bucket "$BUCKET" --key "$STREAM_KEY" \
      --version-id "$STREAM_VERSION" "$TMP_ROOT/canary-control.bin" >/dev/null
  fi
done
admin_aws s3api put-bucket-policy --bucket "$BUCKET" \
  --policy "file://$TMP_ROOT/final-policy.json" >/dev/null

admin_aws s3api get-bucket-policy --bucket "$BUCKET" >"$TMP_ROOT/final-wrapper.json"
python3 -m tai.reg_ru_s3_compatibility_cli unwrap-policy \
  --aws-output "$TMP_ROOT/final-wrapper.json" --output "$TMP_ROOT/final-readback.json"
python3 -m tai.reg_ru_s3_compatibility_cli validate-policy \
  --authority "$AUTHORITY" --attestation "$ATTESTATION" \
  --policy "$TMP_ROOT/final-readback.json" >/dev/null
python3 - "$TMP_ROOT/final-policy.json" "$TMP_ROOT/final-readback.json" <<'PY'
import hashlib,json,sys
def digest(path):
    value=json.load(open(path,encoding="utf-8"))
    raw=json.dumps(value,ensure_ascii=False,separators=(",",":"),sort_keys=True).encode()
    return hashlib.sha256(raw).hexdigest()
assert digest(sys.argv[1]) == digest(sys.argv[2])
PY

for secret in "$ADMIN_ACCESS_KEY_ID" "$ADMIN_SECRET_ACCESS_KEY" \
  "$FINALIZER_ACCESS_KEY_ID" "$FINALIZER_SECRET_ACCESS_KEY"; do
  ! grep -R -F -q -- "$secret" "$TMP_ROOT"
done

python3 - "$TMP_ROOT" "$AUTHORITY" "$ATTESTATION" "$ANON_LIST" "$ANON_GET" \
  "$ANON_INSECURE_GET" "$EXPECTED_SHA" "$LIFECYCLE_BEHAVIOR" <<'PY'
import hashlib, json, sys
from pathlib import Path
root=Path(sys.argv[1])
policy=json.load(open(root/"final-readback.json", encoding="utf-8"))
gate=json.load(open(root/"attestation-gate.json", encoding="utf-8"))
target=json.load(open(sys.argv[2], encoding="utf-8"))["target"]
payload={
 "schema_version":"tai.reg-ru-s3-compatibility-observed.v1","target":target,
 "commands":{k:True for k in ("head_bucket","get_bucket_versioning",
 "get_object_lock_configuration","get_bucket_policy","put_canary_policy",
 "restore_after_canary","put_final_policy","get_final_policy")},
 "configuration":{"versioning_status":"Enabled","object_lock_status":"Enabled",
 "retention_mode":"COMPLIANCE","retention_days":90},
 "principal":{"finalizer_canary_denied":True,"admin_canary_allowed":True,
 "policy_restored_after_canary":True,
 "principal_selector_sha256":gate["principal_selector_sha256"]},
 "policy":{"document":policy,"sha256":hashlib.sha256(json.dumps(
 policy,ensure_ascii=False,separators=(",",":"),sort_keys=True).encode()).hexdigest(),
 "installed":True},
 "privilege_denials":{"same_policy_put_denied":True,"same_versioning_put_denied":True,
 "same_object_lock_put_denied":True,"same_object_retention_put_denied":True,
 "same_lifecycle_put_denied": True if sys.argv[8]=="true" else sys.argv[8],
 "lifecycle_mutation_provider_attested":True},
 "worm":{"put_succeeded":True,"version_id_present":True,
 "versionless_delete_succeeded":True,"exact_version_delete_denied":True,
 "delete_marker_removed":True,"locked_version_still_readable":True,
 "retention_mode":"COMPLIANCE","retention_deadline_90d":True},
 "privacy":{"anonymous_list_http_status":int(sys.argv[4]),
 "anonymous_known_object_http_status":int(sys.argv[5]),
 "anonymous_insecure_known_object_http_status":int(sys.argv[6])},
 "multipart":{"create_succeeded":True,"listed":True,"part_uploaded":True,
 "parts_listed":True,"abort_succeeded":True,"absent_after_abort":True},
 "stream":{"upload_succeeded":True,"version_id_present":True,"retention_present":True,
 "exact_version_restore_succeeded":True,"sha256_match":True,
 "versionless_delete_denied":True,"known_object_still_current":True,
 "size_bytes":9437184,"retention_mode":"COMPLIANCE",
 "retention_deadline_90d":True,
 "source_sha256":sys.argv[7],"restored_sha256":sys.argv[7]},
 "bounds":{"retained_locked_bytes":9441280,"aborted_multipart_retained_bytes":0,
 "credentials_in_output":False,"raw_evidence_retained":False}}
(root/"observed.json").write_text(json.dumps(payload,indent=2,sort_keys=True)+"\n")
PY
python3 -m tai.reg_ru_s3_compatibility_cli evaluate \
  --authority "$AUTHORITY" --attestation "$ATTESTATION" \
  --observed "$TMP_ROOT/observed.json" --output "$OUTPUT" \
  --reserved-output >/dev/null
[[ "$(stat -c %s "$OUTPUT")" -le 1048576 ]]

POLICY_DIRTY=0
PROBE_SUCCEEDED=1
echo "VERIFIED_REG_RU_S3_COMPATIBILITY"
