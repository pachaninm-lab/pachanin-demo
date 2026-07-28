from __future__ import annotations

import argparse
import getpass
import hashlib
import json
import os
import re
import signal
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

SCHEMA = "tai.reg-ru-s3-panel-compatibility-authority.v2"
REPORT_SCHEMA = "tai.reg-ru-s3-panel-compatibility-report.v2"
EXACT_BASE = "8dff44ace01a1448f8f96b0fbf19f2532ee319e2"
PROFILE = "REG_RU_S3_2026"
ENDPOINT = "https://s3.regru.cloud"
REGION = "us-east-1"
BUCKET = "tai-model-bundles-prod-01"
PREFIX = "tai/model-bundles/v1"
CA = "/etc/ssl/certs/ca-certificates.crt"
STREAM_BYTES = 9 * 1024 * 1024
PART_BYTES = 5 * 1024 * 1024
CONFIRM = (
    "I AUTHORIZE REG.RU S3 PANEL COMPATIBILITY PROBE "
    "tai-model-bundles-prod-01/tai/model-bundles/v1 MAX_LOCKED_BYTES=9437184"
)
FINALIZER = "tai-bundle-finalizer-prod-01"
CONTROL = "tai-bundle-control-prod-01"

RULES = (
    ("TAI-01-bucket-metadata", "Allow", FINALIZER,
     ["s3:GetBucketLocation", "s3:GetBucketVersioning"],
     [f"arn:aws:s3:::{BUCKET}"], {}),
    ("TAI-02-prefix-listing", "Allow", FINALIZER,
     ["s3:ListBucket", "s3:ListBucketVersions"],
     [f"arn:aws:s3:::{BUCKET}"],
     {"StringLike": {"s3:prefix": [PREFIX, f"{PREFIX}/*"]}}),
    ("TAI-03-multipart-listing", "Allow", FINALIZER,
     ["s3:ListBucketMultipartUploads"], [f"arn:aws:s3:::{BUCKET}"], {}),
    ("TAI-04-object-data-plane", "Allow", FINALIZER,
     ["s3:AbortMultipartUpload", "s3:GetObject", "s3:GetObjectVersion",
      "s3:ListMultipartUploadParts", "s3:PutObject"],
     [f"arn:aws:s3:::{BUCKET}/{PREFIX}/*"], {}),
    ("TAI-05-delete-deny", "Deny", FINALIZER,
     ["s3:DeleteObject", "s3:DeleteObjectVersion"],
     [f"arn:aws:s3:::{BUCKET}/{PREFIX}/*"], {}),
    ("TAI-06-control-bucket-deny", "Deny", CONTROL,
     ["s3:ListBucket", "s3:ListBucketMultipartUploads", "s3:ListBucketVersions"],
     [f"arn:aws:s3:::{BUCKET}"], {}),
    ("TAI-07-control-object-deny", "Deny", CONTROL,
     ["s3:AbortMultipartUpload", "s3:DeleteObject", "s3:DeleteObjectVersion",
      "s3:GetObject", "s3:GetObjectVersion", "s3:ListMultipartUploadParts",
      "s3:PutObject"], [f"arn:aws:s3:::{BUCKET}/{PREFIX}/*"], {}),
)
EXPECTED_RULES = [
    {"name": n, "effect": e, "key_set": k, "actions": a,
     "resources": r, "condition": c}
    for n, e, k, a, r, c in RULES
]
DENIED = re.compile(
    r"(?i)(AccessDenied|AccessDeniedException|Forbidden|UnauthorizedOperation|"
    r"<Code>\s*(?:AccessDenied|Forbidden)\s*</Code>|"
    r"HTTP/\d(?:\.\d)?[^\n]{0,80}\b(?:401|403)\b|"
    r"(?:status(?:_code)?|HTTPStatusCode)[^\d]{0,40}(?:401|403)\b)"
)
TRANSPORT = re.compile(
    r"(?i)(SSL validation failed|certificate verify failed|timed out|timeout|"
    r"Could not connect|endpoint URL|name resolution|temporary failure|"
    r"InternalError|ServiceUnavailable|HTTP/\d(?:\.\d)?[^\n]{0,80}\b5\d\d\b)"
)


class Fail(RuntimeError):
    pass


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"))


def norm_condition(value):
    if value in (None, {}):
        return {}
    if isinstance(value, dict):
        return {str(k): norm_condition(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        return sorted((norm_condition(v) for v in value), key=canonical)
    return value


def str_list(value):
    if isinstance(value, str):
        return [value]
    return value if isinstance(value, list) and all(isinstance(v, str) for v in value) else []


def global_principal(value):
    if value == "*":
        return True
    if not isinstance(value, dict):
        return False
    for key in ("AWS", "CanonicalUser", "Service", "Federated"):
        item = value.get(key)
        if item == "*" or (isinstance(item, list) and "*" in item):
            return True
    return False


def load_authority(path):
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception as exc:
        raise Fail("AUTHORITY_UNREADABLE") from exc
    checks = {
        "schema_version": SCHEMA,
        "exact_base": EXACT_BASE,
        "provider_profile": PROFILE,
        "profile_state": "CANDIDATE_NOT_ACTIVE",
        "execution_mode": "LOCAL_INTERACTIVE_ONLY",
        "workflow_allowed": False,
        "github_secret_registration_allowed": False,
        "finalization_allowed": False,
        "panel_state": "CONFIGURED_UNVERIFIED",
    }
    for key, expected in checks.items():
        if payload.get(key) != expected:
            raise Fail(f"AUTHORITY_DRIFT:{key}")
    if payload.get("target") != {
        "endpoint": ENDPOINT, "region": REGION, "bucket": BUCKET,
        "prefix": PREFIX, "operator_confirmed_capacity_bytes": 200000000000,
    }:
        raise Fail("AUTHORITY_TARGET_DRIFT")
    if payload.get("key_sets") != {
        "admin": "owner", "finalizer": FINALIZER, "control": CONTROL,
        "control_has_policy_rules": True,
        "control_explicit_deny_rules": [
            "TAI-06-control-bucket-deny", "TAI-07-control-object-deny"],
        "credential_input": "TTY_HIDDEN_ONCE_PER_RUN",
    }:
        raise Fail("AUTHORITY_KEY_SET_DRIFT")
    controls = payload.get("required_bucket_controls", {})
    if controls.get("control_bucket_metadata_may_be_visible") is not True:
        raise Fail("AUTHORITY_CONTROL_METADATA_DRIFT")
    if payload.get("panel_rules") != EXPECTED_RULES:
        raise Fail("AUTHORITY_RULE_SET_DRIFT")
    probe = payload.get("probe", {})
    if probe.get("interactive_confirmation") != CONFIRM:
        raise Fail("AUTHORITY_CONFIRMATION_DRIFT")
    if probe.get("stream_object_bytes") != STREAM_BYTES:
        raise Fail("AUTHORITY_STREAM_BOUND_DRIFT")
    if probe.get("multipart_part_bytes") != PART_BYTES:
        raise Fail("AUTHORITY_PART_BOUND_DRIFT")
    if probe.get("resume_single_existing_probe_object") is not True:
        raise Fail("AUTHORITY_RESUME_DRIFT")
    if payload.get("result", {}).get("verified_status") != \
            "VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY_V2":
        raise Fail("AUTHORITY_RESULT_DRIFT")
    return payload


def validate_policy(policy):
    raw = policy.get("Statement")
    statements = [raw] if isinstance(raw, dict) else raw
    if not isinstance(statements, list):
        raise Fail("POLICY_STATEMENT_INVALID")
    observed = []
    for statement in statements:
        if not isinstance(statement, dict):
            raise Fail("POLICY_STATEMENT_NOT_OBJECT")
        effect = statement.get("Effect")
        actions = sorted(
            a if a.startswith("s3:") else f"s3:{a}"
            for a in str_list(statement.get("Action"))
        )
        resources = sorted(str_list(statement.get("Resource")))
        if effect not in {"Allow", "Deny"} or not actions or not resources:
            raise Fail("POLICY_STATEMENT_INVALID")
        if not any(r == "*" or r.startswith(f"arn:aws:s3:::{BUCKET}")
                   for r in resources):
            continue
        is_global = global_principal(statement.get("Principal"))
        if effect == "Allow" and is_global:
            raise Fail("PUBLIC_ALLOW_ON_TARGET")
        observed.append({
            "effect": effect, "actions": actions, "resources": resources,
            "condition": norm_condition(statement.get("Condition")),
            "principal_global": is_global,
        })
    matched = set()
    for name, effect, _, actions, resources, condition in RULES:
        signature = {
            "effect": effect, "actions": sorted(actions),
            "resources": sorted(resources), "condition": norm_condition(condition),
            "principal_global": False,
        }
        indexes = [i for i, value in enumerate(observed) if value == signature]
        if len(indexes) != 1:
            raise Fail(f"PANEL_RULE_NOT_EXACT:{name}")
        matched.add(indexes[0])
    if any(i not in matched and s["effect"] == "Allow"
           for i, s in enumerate(observed)):
        raise Fail("UNEXPECTED_ALLOW_ON_TARGET")
    return hashlib.sha256(canonical(policy).encode()).hexdigest()


def reserve_output(path):
    path = Path(path)
    if not path.is_absolute():
        raise Fail("OUTPUT_NOT_ABSOLUTE")
    parent = path.parent
    st = parent.stat()
    if parent.resolve(strict=True) != parent or not stat.S_ISDIR(st.st_mode):
        raise Fail("OUTPUT_PARENT_NOT_CANONICAL")
    if st.st_uid != os.geteuid() or stat.S_IMODE(st.st_mode) & 0o077:
        raise Fail("OUTPUT_PARENT_NOT_PRIVATE")
    return os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                   getattr(os, "O_NOFOLLOW", 0), 0o600)


def safe_error(text):
    text = re.sub(r"(?i)credential=[^,\s]+", "credential=<redacted>", text)
    text = re.sub(r"(?i)authorization:[^\n]+", "authorization:<redacted>", text)
    return " ".join(text.strip().split())[:500]


class AWS:
    def __init__(self, credentials):
        self.credentials = credentials
        self.upload = None

    def run(self, principal, args, debug=False):
        access, secret = self.credentials[principal]
        env = os.environ.copy()
        env.update({
            "AWS_ACCESS_KEY_ID": access, "AWS_SECRET_ACCESS_KEY": secret,
            "AWS_DEFAULT_REGION": REGION, "AWS_REGION": REGION,
            "AWS_CA_BUNDLE": CA, "REQUESTS_CA_BUNDLE": CA,
            "AWS_REQUEST_CHECKSUM_CALCULATION": "when_required",
            "AWS_RESPONSE_CHECKSUM_VALIDATION": "when_required",
            "AWS_EC2_METADATA_DISABLED": "true", "AWS_PAGER": "",
            "AWS_CLI_AUTO_PROMPT": "off", "AWS_CLI_ERROR_FORMAT": "legacy",
        })
        cmd = [
            "aws", "--no-cli-pager", "--no-cli-auto-prompt",
            "--cli-error-format", "legacy", "--ca-bundle", CA,
            "--endpoint-url", ENDPOINT, "--region", REGION,
            "--cli-connect-timeout", "20", "--cli-read-timeout", "120",
        ]
        if debug:
            cmd.append("--debug")
        result = subprocess.run(cmd + list(args), env=env,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                timeout=180, check=False)
        return result

    def ok(self, principal, args, reason, json_output=True):
        result = self.run(principal, args)
        if result.returncode:
            raise Fail(f"{reason}:RC={result.returncode}:" +
                       safe_error(result.stderr.decode(errors="replace")))
        if not json_output:
            return {}
        try:
            value = json.loads(result.stdout.decode()) if result.stdout else {}
        except Exception as exc:
            raise Fail(f"{reason}:OUTPUT_NOT_JSON") from exc
        if not isinstance(value, dict):
            raise Fail(f"{reason}:OUTPUT_NOT_OBJECT")
        return value

    def denied(self, principal, args, reason):
        result = self.run(principal, args)
        if not result.returncode:
            raise Fail(f"{reason}:UNEXPECTEDLY_ALLOWED")
        text = result.stderr.decode(errors="replace")
        if TRANSPORT.search(text):
            raise Fail(f"{reason}:TRANSPORT_FAILURE")
        if DENIED.search(text):
            print(f"DENIAL_CONFIRMED:{reason}")
            return
        debug = self.run(principal, args, debug=True)
        raw = debug.stderr.decode(errors="replace")
        if not debug.returncode:
            raise Fail(f"{reason}:DEBUG_UNEXPECTEDLY_ALLOWED")
        if TRANSPORT.search(raw):
            raise Fail(f"{reason}:DEBUG_TRANSPORT_FAILURE")
        if not DENIED.search(raw):
            raise Fail(f"{reason}:NOT_AUTHORIZATION_DENIAL")
        print(f"DENIAL_CONFIRMED_VIA_RAW_HTTP:{reason}")

    def cleanup(self):
        if self.upload:
            principal, key, upload_id = self.upload
            self.run(principal, ["s3api", "abort-multipart-upload", "--bucket",
                                 BUCKET, "--key", key, "--upload-id", upload_id])
            self.upload = None


def controls_valid(versioning, lock_wrapper):
    lock = lock_wrapper.get("ObjectLockConfiguration", {})
    retention = lock.get("Rule", {}).get("DefaultRetention", {})
    return (versioning.get("Status") == "Enabled" and
            lock.get("ObjectLockEnabled") == "Enabled" and
            retention.get("Mode") == "COMPLIANCE" and retention.get("Days") == 90)


def retention_valid(wrapper):
    retention = wrapper.get("Retention", {})
    if retention.get("Mode") != "COMPLIANCE":
        return False
    deadline = datetime.fromisoformat(
        str(retention.get("RetainUntilDate", "")).replace("Z", "+00:00"))
    remaining = deadline.astimezone(timezone.utc) - datetime.now(timezone.utc)
    return timedelta(days=89) <= remaining <= timedelta(days=91)


def anon_status(url, https=True):
    cmd = ["curl", "-q", "--silent", "--show-error", "--output", "/dev/null",
           "--write-out", "%{http_code}", "--max-redirs", "0",
           "--connect-timeout", "20", "--max-time", "60"]
    cmd += ["--proto", "=https", "--cacert", CA] if https else ["--proto", "=http"]
    result = subprocess.run(cmd + [url], stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=90, check=False)
    if result.returncode:
        raise Fail("ANONYMOUS_CURL_FAILED")
    return int(result.stdout.decode())


def inspect_existing(aws):
    root = f"{PREFIX}/compatibility-probes/"
    objects = aws.ok("finalizer", ["s3api", "list-objects-v2", "--bucket", BUCKET,
                                   "--prefix", root, "--max-keys", "10"],
                     "PROBE_OBJECT_LIST_FAILED")
    keys = [str(v.get("Key")) for v in objects.get("Contents", []) if v.get("Key")]
    uploads = aws.ok("finalizer", ["s3api", "list-multipart-uploads", "--bucket",
                                   BUCKET, "--prefix", root],
                     "PROBE_UPLOAD_LIST_FAILED").get("Uploads", [])
    if len(uploads) > 1:
        raise Fail("MULTIPLE_PREEXISTING_UPLOADS")
    if uploads:
        item = uploads[0]
        key, upload_id = str(item.get("Key", "")), str(item.get("UploadId", ""))
        if not key.endswith("/multipart-abort.bin") or not upload_id:
            raise Fail("PREEXISTING_UPLOAD_INVALID")
        aws.ok("finalizer", ["s3api", "abort-multipart-upload", "--bucket", BUCKET,
                             "--key", key, "--upload-id", upload_id],
               "PREEXISTING_UPLOAD_ABORT_FAILED", False)
        print("RESUME_CLEANUP:STALE_MULTIPART_ABORTED")
    if not keys:
        return None, None
    if len(keys) != 1 or not keys[0].endswith("/stream.bin"):
        raise Fail("PREEXISTING_OBJECT_SET_INVALID")
    head = aws.ok("finalizer", ["s3api", "head-object", "--bucket", BUCKET,
                                "--key", keys[0]], "PREEXISTING_HEAD_FAILED")
    version = str(head.get("VersionId", ""))
    if head.get("ContentLength") != STREAM_BYTES or not version or version == "null":
        raise Fail("PREEXISTING_STREAM_INVALID")
    print("RESUME_MODE:SINGLE_EXISTING_STREAM_OBJECT")
    return keys[0], version


def prove_stream(aws, key, version, source_sha, restore_dir):
    retention = aws.ok("admin", ["s3api", "get-object-retention", "--bucket", BUCKET,
                                 "--key", key, "--version-id", version],
                       "RETENTION_READ_FAILED")
    if not retention_valid(retention):
        raise Fail("RETENTION_INVALID")
    aws.denied("finalizer", ["s3api", "get-object-retention", "--bucket", BUCKET,
                             "--key", key, "--version-id", version],
               "FINALIZER_GET_OBJECT_RETENTION_ALLOWED")
    retention_arg = json.dumps(retention["Retention"], separators=(",", ":"))
    aws.denied("finalizer", ["s3api", "put-object-retention", "--bucket", BUCKET,
                             "--key", key, "--version-id", version,
                             "--retention", retention_arg],
               "FINALIZER_PUT_OBJECT_RETENTION_ALLOWED")
    aws.denied("finalizer", ["s3api", "delete-object", "--bucket", BUCKET,
                             "--key", key], "FINALIZER_VERSIONLESS_DELETE_ALLOWED")
    aws.denied("finalizer", ["s3api", "delete-object", "--bucket", BUCKET,
                             "--key", key, "--version-id", version],
               "FINALIZER_EXACT_VERSION_DELETE_ALLOWED")
    aws.denied("admin", ["s3api", "delete-object", "--bucket", BUCKET,
                         "--key", key, "--version-id", version],
               "ADMIN_LOCKED_VERSION_DELETE_ALLOWED")
    restored = Path(restore_dir) / "restored.bin"
    aws.ok("finalizer", ["s3api", "get-object", "--bucket", BUCKET, "--key", key,
                         "--version-id", version, str(restored)], "RESTORE_FAILED")
    restored_sha = hashlib.sha256(restored.read_bytes()).hexdigest()
    if restored_sha != source_sha:
        raise Fail("RESTORE_SHA_MISMATCH")
    aws.denied("control", ["s3api", "get-object", "--bucket", BUCKET, "--key", key,
                           "--version-id", version,
                           str(Path(restore_dir) / "control.bin")],
               "CONTROL_KNOWN_OBJECT_GET_ALLOWED")
    return restored_sha


def write_report(fd, authority, policy_sha, key, fresh, source_sha, restored_sha,
                 anon_list, anon_get, anon_http):
    report = {
        "schema_version": REPORT_SCHEMA,
        "status": "VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY_V2",
        "reasons": [], "exact_base": EXACT_BASE, "provider_profile": PROFILE,
        "profile_state": "CANDIDATE_NOT_ACTIVE",
        "target": {"endpoint_host": urlsplit(ENDPOINT).hostname, "region": REGION,
                   "bucket": BUCKET, "prefix": PREFIX,
                   "operator_confirmed_capacity_bytes": 200000000000},
        "key_sets": {"admin": "owner", "finalizer": FINALIZER, "control": CONTROL},
        "authority_sha256": hashlib.sha256(canonical(authority).encode()).hexdigest(),
        "policy_sha256": policy_sha,
        "controls": {
            "versioning_status": "Enabled", "object_lock_status": "Enabled",
            "retention_mode": "COMPLIANCE", "retention_days": 90,
            "anonymous_list_http_status": anon_list,
            "anonymous_known_object_http_status": anon_get,
            "anonymous_insecure_known_object_http_status": anon_http,
            "finalizer_allowed": True, "control_denied": True,
            "control_explicit_deny_rules_configured": True,
            "control_bucket_metadata_visible": True,
            "fresh_mutation_performed": fresh,
            "resumed_existing_stream_object": not fresh,
            "multipart_compatibility": True,
            "exact_version_restore_sha256_match": source_sha == restored_sha,
            "locked_version_delete_denied": True,
        },
        "retained_object_key_sha256": hashlib.sha256(key.encode()).hexdigest(),
        "retained_locked_bytes": STREAM_BYTES,
        "github_secret_registration_allowed": False, "finalization_allowed": False,
        "bundle_upload_status": "NOT_RUN", "bundle_restore_status": "NOT_RUN",
        "benchmark_status": "NOT_RUN", "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }
    report["report_sha256"] = hashlib.sha256(canonical(report).encode()).hexdigest()
    os.ftruncate(fd, 0)
    with os.fdopen(fd, "w", encoding="utf-8", closefd=True) as out:
        json.dump(report, out, ensure_ascii=False, indent=2, sort_keys=True)
        out.write("\n")
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--authority", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise Fail("INTERACTIVE_TTY_REQUIRED")
    if not Path(CA).is_file():
        raise Fail("CA_BUNDLE_MISSING")
    authority = load_authority(args.authority)
    fd = reserve_output(args.output)
    aws = None
    try:
        print("Введи три пары ключей один раз. Повторного запроса не будет.")
        creds = {}
        for name, label in (("admin", "owner/admin"), ("finalizer", "finalizer"),
                            ("control", "control")):
            access = getpass.getpass(f"REG.RU {label} Access Key ID: ")
            secret = getpass.getpass(f"REG.RU {label} Secret Access Key: ")
            if not access or not secret:
                raise Fail("EMPTY_CREDENTIAL")
            creds[name] = (access, secret)
        if len({v[0] for v in creds.values()}) != 3:
            raise Fail("ACCESS_KEY_COLLISION")
        aws = AWS(creds)
        versioning = aws.ok("admin", ["s3api", "get-bucket-versioning", "--bucket", BUCKET],
                            "ADMIN_VERSIONING_READ_FAILED")
        lock = aws.ok("admin", ["s3api", "get-object-lock-configuration", "--bucket", BUCKET],
                      "ADMIN_OBJECT_LOCK_READ_FAILED")
        if not controls_valid(versioning, lock):
            raise Fail("BUCKET_CONTROLS_INVALID")
        policy_wrapper = aws.ok("admin", ["s3api", "get-bucket-policy", "--bucket", BUCKET],
                                "ADMIN_POLICY_READ_FAILED")
        raw_policy = policy_wrapper.get("Policy")
        policy = json.loads(raw_policy) if isinstance(raw_policy, str) else raw_policy
        if not isinstance(policy, dict):
            raise Fail("POLICY_WRAPPER_INVALID")
        policy_sha = validate_policy(policy)
        if aws.ok("finalizer", ["s3api", "get-bucket-versioning", "--bucket", BUCKET],
                  "FINALIZER_VERSIONING_READ_FAILED").get("Status") != "Enabled":
            raise Fail("FINALIZER_VERSIONING_INVALID")
        aws.ok("finalizer", ["s3api", "list-objects-v2", "--bucket", BUCKET,
                             "--prefix", PREFIX, "--max-keys", "1"], "FINALIZER_LIST_FAILED")
        aws.ok("finalizer", ["s3api", "list-object-versions", "--bucket", BUCKET,
                             "--prefix", PREFIX, "--max-items", "1"],
               "FINALIZER_VERSION_LIST_FAILED")
        aws.ok("finalizer", ["s3api", "list-multipart-uploads", "--bucket", BUCKET,
                             "--prefix", PREFIX], "FINALIZER_MULTIPART_LIST_FAILED")
        if aws.ok("control", ["s3api", "get-bucket-versioning", "--bucket", BUCKET],
                  "CONTROL_METADATA_READ_FAILED").get("Status") != "Enabled":
            raise Fail("CONTROL_METADATA_INVALID")
        aws.denied("control", ["s3api", "list-objects-v2", "--bucket", BUCKET,
                               "--prefix", PREFIX, "--max-keys", "1"],
                   "CONTROL_LIST_BUCKET_ALLOWED")
        aws.denied("control", ["s3api", "create-multipart-upload", "--bucket", BUCKET,
                               "--key", f"{PREFIX}/compatibility-probes/control-deny.bin"],
                   "CONTROL_OBJECT_WRITE_ALLOWED")
        aws.denied("finalizer", ["s3api", "get-bucket-policy", "--bucket", BUCKET],
                   "FINALIZER_GET_BUCKET_POLICY_ALLOWED")
        with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8") as f:
            json.dump(policy, f, separators=(",", ":")); policy_path = f.name
        try:
            aws.denied("finalizer", ["s3api", "put-bucket-policy", "--bucket", BUCKET,
                                     "--policy", f"file://{policy_path}"],
                       "FINALIZER_PUT_BUCKET_POLICY_ALLOWED")
        finally:
            Path(policy_path).unlink(missing_ok=True)
        aws.denied("finalizer", ["s3api", "put-bucket-versioning", "--bucket", BUCKET,
                                 "--versioning-configuration", "Status=Enabled"],
                   "FINALIZER_PUT_BUCKET_VERSIONING_ALLOWED")
        aws.denied("finalizer", ["s3api", "put-object-lock-configuration", "--bucket", BUCKET,
                                 "--object-lock-configuration",
                                 '{"ObjectLockEnabled":"Enabled","Rule":{"DefaultRetention":{"Mode":"COMPLIANCE","Days":90}}}'],
                   "FINALIZER_PUT_OBJECT_LOCK_ALLOWED")
        key, version = inspect_existing(aws)
        fresh = key is None
        source_sha = hashlib.sha256(b"T" * STREAM_BYTES).hexdigest()
        with tempfile.TemporaryDirectory() as tmpdir:
            if fresh:
                print("Exact mutation confirmation required:")
                print(CONFIRM)
                if input().strip() != CONFIRM:
                    raise Fail("CONFIRMATION_MISMATCH")
                probe_id = hashlib.sha256(os.urandom(32)).hexdigest()[:24]
                multipart_key = f"{PREFIX}/compatibility-probes/{probe_id}/multipart-abort.bin"
                key = f"{PREFIX}/compatibility-probes/{probe_id}/stream.bin"
                created = aws.ok("finalizer", ["s3api", "create-multipart-upload", "--bucket", BUCKET,
                                               "--key", multipart_key], "MULTIPART_CREATE_FAILED")
                upload_id = str(created.get("UploadId", ""))
                if not upload_id:
                    raise Fail("MULTIPART_UPLOAD_ID_MISSING")
                aws.upload = ("finalizer", multipart_key, upload_id)
                listed = aws.ok("finalizer", ["s3api", "list-multipart-uploads", "--bucket", BUCKET,
                                              "--prefix", multipart_key], "MULTIPART_LIST_FAILED")
                if not any(v.get("UploadId") == upload_id for v in listed.get("Uploads", [])):
                    raise Fail("MULTIPART_NOT_LISTED")
                part = Path(tmpdir) / "part.bin"; part.write_bytes(b"M" * PART_BYTES)
                aws.ok("finalizer", ["s3api", "upload-part", "--bucket", BUCKET, "--key",
                                     multipart_key, "--upload-id", upload_id, "--part-number", "1",
                                     "--body", str(part)], "MULTIPART_PART_UPLOAD_FAILED")
                parts = aws.ok("finalizer", ["s3api", "list-parts", "--bucket", BUCKET,
                                                "--key", multipart_key, "--upload-id", upload_id],
                               "MULTIPART_PART_LIST_FAILED")
                if len(parts.get("Parts", [])) != 1 or parts["Parts"][0].get("Size") != PART_BYTES:
                    raise Fail("MULTIPART_PART_INVALID")
                aws.ok("finalizer", ["s3api", "abort-multipart-upload", "--bucket", BUCKET,
                                     "--key", multipart_key, "--upload-id", upload_id],
                       "MULTIPART_ABORT_FAILED", False)
                aws.upload = None
                stream = Path(tmpdir) / "stream.bin"; stream.write_bytes(b"T" * STREAM_BYTES)
                aws.ok("finalizer", ["s3api", "put-object", "--bucket", BUCKET, "--key", key,
                                     "--body", str(stream)], "STREAM_UPLOAD_FAILED")
                head = aws.ok("finalizer", ["s3api", "head-object", "--bucket", BUCKET,
                                                "--key", key], "STREAM_HEAD_FAILED")
                version = str(head.get("VersionId", ""))
                if head.get("ContentLength") != STREAM_BYTES or not version or version == "null":
                    raise Fail("STREAM_HEAD_INVALID")
            restored_sha = prove_stream(aws, key, version, source_sha, tmpdir)
        anon_list = anon_status(f"{ENDPOINT}/{BUCKET}?list-type=2&max-keys=1")
        anon_get = anon_status(f"{ENDPOINT}/{BUCKET}/{key}")
        anon_http = anon_status(f"http://s3.regru.cloud/{BUCKET}/{key}", False)
        if any(code not in {401, 403} for code in (anon_list, anon_get, anon_http)):
            raise Fail("ANONYMOUS_ACCESS_NOT_DENIED")
        write_report(fd, authority, policy_sha, key, fresh, source_sha, restored_sha,
                     anon_list, anon_get, anon_http)
        fd = None
        return 0
    finally:
        if aws:
            aws.cleanup()
        if fd is not None:
            os.close(fd)


def entrypoint():
    try:
        return main()
    except (Fail, subprocess.TimeoutExpired, OSError, ValueError, KeyError) as exc:
        print(f"FAILED_CLOSED:{exc}", file=sys.stderr)
        return 2


for _sig in (signal.SIGHUP, signal.SIGINT, signal.SIGTERM):
    signal.signal(_sig, lambda signum, frame: (_ for _ in ()).throw(Fail(f"SIGNAL:{signum}")))

if __name__ == "__main__":
    raise SystemExit(entrypoint())
