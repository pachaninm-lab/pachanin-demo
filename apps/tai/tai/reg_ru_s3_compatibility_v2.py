from __future__ import annotations

import argparse
import getpass
import hashlib
import importlib
import json
import os
import re
import stat
import sys
import tempfile
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlsplit

AUTHORITY_SCHEMA = "tai.reg-ru-s3-panel-compatibility-authority.v2"
REPORT_SCHEMA = "tai.reg-ru-s3-panel-compatibility-report.v2"
EXACT_BASE = "8dff44ace01a1448f8f96b0fbf19f2532ee319e2"
PROFILE = "REG_RU_S3_2026"
VERIFIED_STATUS = "VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY_V2"
FAILED_STATUS = "FAILED_CLOSED"
TARGET: dict[str, object] = {
    "endpoint": "https://s3.regru.cloud",
    "region": "us-east-1",
    "bucket": "tai-model-bundles-prod-01",
    "prefix": "tai/model-bundles/v1",
    "operator_confirmed_capacity_bytes": 200000000000,
}
KEY_SETS: dict[str, object] = {
    "admin": "owner",
    "finalizer": "tai-bundle-finalizer-prod-01",
    "control": "tai-bundle-control-prod-01",
    "control_has_policy_rules": True,
    "control_explicit_deny_rules": [
        "TAI-06-control-bucket-deny",
        "TAI-07-control-object-deny",
    ],
    "credential_input": "TTY_HIDDEN_ONCE_PER_RUN",
}
CONFIRMATION = (
    "I AUTHORIZE REG.RU S3 PANEL COMPATIBILITY PROBE "
    "tai-model-bundles-prod-01/tai/model-bundles/v1 MAX_LOCKED_BYTES=9437184"
)
STREAM_OBJECT_BYTES = 9 * 1024 * 1024
MULTIPART_PART_BYTES = 5 * 1024 * 1024
MAXIMUM_REPORT_BYTES = 1024 * 1024
STREAM_KEY = f"{TARGET['prefix']}/compatibility-probes/reg-ru-panel-v2/stream.bin"
MULTIPART_KEY_PREFIX = f"{TARGET['prefix']}/compatibility-probes/reg-ru-panel-v2/multipart"
_DENIAL_CODES = frozenset(
    {
        "AccessDenied",
        "AccessDeniedException",
        "Forbidden",
        "Unauthorized",
        "UnauthorizedOperation",
        "401",
        "403",
    }
)
_NOT_FOUND_CODES = frozenset(
    {
        "404",
        "NoSuchKey",
        "NoSuchLifecycleConfiguration",
        "NoSuchLifecycleConfigurationException",
        "NoSuchUpload",
    }
)
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
_ACCESS_KEY_RE = re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")
_SECRET_KEY_RE = re.compile(r"(?i)\b(secret.?access.?key|aws_secret_access_key)\b")
EXPECTED_RULES: tuple[dict[str, object], ...] = (
    {
        "name": "TAI-01-bucket-metadata",
        "effect": "Allow",
        "key_set": "tai-bundle-finalizer-prod-01",
        "actions": ["s3:GetBucketLocation", "s3:GetBucketVersioning"],
        "resources": ["arn:aws:s3:::tai-model-bundles-prod-01"],
        "condition": {},
    },
    {
        "name": "TAI-02-prefix-listing",
        "effect": "Allow",
        "key_set": "tai-bundle-finalizer-prod-01",
        "actions": ["s3:ListBucket", "s3:ListBucketVersions"],
        "resources": ["arn:aws:s3:::tai-model-bundles-prod-01"],
        "condition": {
            "StringLike": {
                "s3:prefix": ["tai/model-bundles/v1", "tai/model-bundles/v1/*"]
            }
        },
    },
    {
        "name": "TAI-03-multipart-listing",
        "effect": "Allow",
        "key_set": "tai-bundle-finalizer-prod-01",
        "actions": ["s3:ListBucketMultipartUploads"],
        "resources": ["arn:aws:s3:::tai-model-bundles-prod-01"],
        "condition": {},
    },
    {
        "name": "TAI-04-object-data-plane",
        "effect": "Allow",
        "key_set": "tai-bundle-finalizer-prod-01",
        "actions": [
            "s3:AbortMultipartUpload",
            "s3:GetObject",
            "s3:GetObjectVersion",
            "s3:ListMultipartUploadParts",
            "s3:PutObject",
        ],
        "resources": [
            "arn:aws:s3:::tai-model-bundles-prod-01/tai/model-bundles/v1/*"
        ],
        "condition": {},
    },
    {
        "name": "TAI-05-delete-deny",
        "effect": "Deny",
        "key_set": "tai-bundle-finalizer-prod-01",
        "actions": ["s3:DeleteObject", "s3:DeleteObjectVersion"],
        "resources": [
            "arn:aws:s3:::tai-model-bundles-prod-01/tai/model-bundles/v1/*"
        ],
        "condition": {},
    },
    {
        "name": "TAI-06-control-bucket-deny",
        "effect": "Deny",
        "key_set": "tai-bundle-control-prod-01",
        "actions": [
            "s3:ListBucket",
            "s3:ListBucketMultipartUploads",
            "s3:ListBucketVersions",
        ],
        "resources": ["arn:aws:s3:::tai-model-bundles-prod-01"],
        "condition": {},
    },
    {
        "name": "TAI-07-control-object-deny",
        "effect": "Deny",
        "key_set": "tai-bundle-control-prod-01",
        "actions": [
            "s3:AbortMultipartUpload",
            "s3:DeleteObject",
            "s3:DeleteObjectVersion",
            "s3:GetObject",
            "s3:GetObjectVersion",
            "s3:ListMultipartUploadParts",
            "s3:PutObject",
        ],
        "resources": [
            "arn:aws:s3:::tai-model-bundles-prod-01/tai/model-bundles/v1/*"
        ],
        "condition": {},
    },
)

ADMIN_ONLY_ACTIONS = [
    "s3:GetBucketObjectLockConfiguration",
    "s3:GetBucketPolicy",
    "s3:GetObjectRetention",
]
FINALIZER_FORBIDDEN_ACTIONS = [
    "s3:BypassGovernanceRetention",
    "s3:DeleteObject",
    "s3:DeleteObjectVersion",
    "s3:GetBucketPolicy",
    "s3:GetObjectRetention",
    "s3:PutBucketObjectLockConfiguration",
    "s3:PutBucketPolicy",
    "s3:PutBucketVersioning",
    "s3:PutLifecycleConfiguration",
    "s3:PutObjectRetention",
]
REQUIRED_PROOFS = [
    "EXACT_TARGET",
    "EXACT_SEVEN_PANEL_RULES_READBACK",
    "FINALIZER_ALLOWED_CONTROL_DENIED",
    "VERSIONING_ENABLED",
    "OBJECT_LOCK_ENABLED",
    "COMPLIANCE_90D",
    "FINALIZER_DELETE_DENIED",
    "FINALIZER_CONTROL_PLANE_MUTATION_DENIED",
    "FINALIZER_OBJECT_RETENTION_READ_DENIED",
    "ANONYMOUS_LIST_REJECTED",
    "ANONYMOUS_KNOWN_OBJECT_GET_REJECTED",
    "MULTIPART_CREATE_LIST_PARTS_ABORT",
    "STREAM_UPLOAD_OR_RESUME_VERSION_RETENTION_RESTORE_SHA256",
    "WORM_EXACT_VERSION_DELETE_REJECTED",
]


class ProbeFailure(RuntimeError):
    """A sanitized fail-closed reason suitable for the retained report."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class Credentials:
    access_key_id: str
    secret_access_key: str


@dataclass(frozen=True)
class CredentialSet:
    admin: Credentials
    finalizer: Credentials
    control: Credentials


@dataclass(frozen=True)
class DenialClassification:
    error_code: str
    http_status: int
    request_id_present: bool

    def as_dict(self) -> dict[str, object]:
        return {
            "error_code": self.error_code,
            "http_status": self.http_status,
            "request_id_present": self.request_id_present,
        }


@dataclass(frozen=True)
class Sdk:
    boto3: Any
    botocore: Any
    config_type: type[Any]
    client_error_type: type[BaseException]
    unsigned: object


@dataclass
class CleanupState:
    admin_client: Any | None = None
    finalizer_client: Any | None = None
    open_finalizer_upload: tuple[str, str] | None = None
    open_control_upload: tuple[str, str] | None = None
    unexpected_delete_marker_version: str | None = None


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def load_json(path: Path) -> dict[str, object]:
    def reject_duplicates(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            if key in result:
                raise ProbeFailure(f"DUPLICATE_JSON_KEY:{key}")
            result[key] = value
        return result

    try:
        payload = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicates
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProbeFailure("AUTHORITY_JSON_UNREADABLE") from exc
    if not isinstance(payload, dict):
        raise ProbeFailure("AUTHORITY_JSON_ROOT_NOT_OBJECT")
    return payload


def authority_sha256(authority: Mapping[str, object]) -> str:
    return hashlib.sha256(canonical_json(authority).encode()).hexdigest()


def validate_authority(authority: Mapping[str, object]) -> None:
    errors: list[str] = []
    _expect(authority.get("schema_version"), AUTHORITY_SCHEMA, "AUTHORITY_SCHEMA", errors)
    _expect(authority.get("program_issue"), 2726, "PROGRAM_ISSUE", errors)
    _expect(authority.get("parent_issue"), 2835, "PARENT_ISSUE", errors)
    _expect(authority.get("issue"), 2954, "ISSUE", errors)
    _expect(authority.get("exact_base"), EXACT_BASE, "EXACT_BASE", errors)
    _expect(authority.get("provider_profile"), PROFILE, "PROVIDER_PROFILE", errors)
    _expect(
        authority.get("profile_state"),
        "CANDIDATE_NOT_ACTIVE",
        "PROFILE_STATE",
        errors,
    )
    _expect(
        authority.get("execution_mode"),
        "LOCAL_INTERACTIVE_ONLY",
        "EXECUTION_MODE",
        errors,
    )
    for field in (
        "workflow_allowed",
        "github_secret_registration_allowed",
        "finalization_allowed",
    ):
        if authority.get(field) is not False:
            errors.append(f"{field.upper()}_MUST_BE_FALSE")
    _expect(
        authority.get("panel_state"),
        "CONFIGURED_UNVERIFIED",
        "PANEL_STATE",
        errors,
    )
    if _mapping(authority.get("target")) != TARGET:
        errors.append("TARGET_DRIFT")
    if _mapping(authority.get("key_sets")) != KEY_SETS:
        errors.append("KEY_SET_CONTRACT_DRIFT")

    controls = _mapping(authority.get("required_bucket_controls"))
    if controls != {
        "versioning_status": "Enabled",
        "object_lock_status": "Enabled",
        "default_retention": {"mode": "COMPLIANCE", "days": 90},
        "anonymous_denied_http_statuses": [401, 403],
        "control_bucket_metadata_may_be_visible": True,
    }:
        errors.append("BUCKET_CONTROL_REQUIREMENTS_DRIFT")

    rules = authority.get("panel_rules")
    if not isinstance(rules, list) or rules != list(EXPECTED_RULES):
        errors.append("PANEL_RULE_SET_DRIFT")
    if authority.get("admin_only_observation_actions") != ADMIN_ONLY_ACTIONS:
        errors.append("ADMIN_ONLY_ACTIONS_DRIFT")
    if authority.get("finalizer_forbidden_actions") != FINALIZER_FORBIDDEN_ACTIONS:
        errors.append("FINALIZER_FORBIDDEN_ACTIONS_DRIFT")

    probe = _mapping(authority.get("probe"))
    expected_probe = {
        "interactive_confirmation": CONFIRMATION,
        "stream_object_bytes": STREAM_OBJECT_BYTES,
        "multipart_part_bytes": MULTIPART_PART_BYTES,
        "maximum_retained_locked_bytes": STREAM_OBJECT_BYTES,
        "maximum_sanitized_report_bytes": MAXIMUM_REPORT_BYTES,
        "bucket_policy_semantic_mutation_allowed": False,
        "delete_locked_versions": False,
        "resume_single_existing_probe_object": True,
        "tls_ca_bundle": "/etc/ssl/certs/ca-certificates.crt",
        "request_checksum_calculation": "when_required",
        "response_checksum_validation": "when_required",
    }
    if probe != expected_probe:
        errors.append("PROBE_CONTRACT_DRIFT")
    if authority.get("required_proofs") != REQUIRED_PROOFS:
        errors.append("REQUIRED_PROOFS_DRIFT")

    result = _mapping(authority.get("result"))
    if result != {
        "verified_status": VERIFIED_STATUS,
        "failed_status": FAILED_STATUS,
        "bundle_upload_status": "NOT_RUN",
        "bundle_restore_status": "NOT_RUN",
        "benchmark_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }:
        errors.append("RESULT_CONTRACT_DRIFT")
    _raise_errors(errors)


def validate_panel_policy(
    authority: Mapping[str, object], policy: Mapping[str, object]
) -> str:
    validate_authority(authority)
    statements_value = policy.get("Statement")
    if isinstance(statements_value, dict):
        statements: list[object] = [statements_value]
    elif isinstance(statements_value, list):
        statements = statements_value
    else:
        raise ProbeFailure("POLICY_STATEMENT_INVALID")

    errors: list[str] = []
    target_statements: list[dict[str, object]] = []
    for index, raw_statement in enumerate(statements):
        statement = _mapping(raw_statement)
        if not statement:
            errors.append(f"POLICY_STATEMENT_NOT_OBJECT:{index}")
            continue
        if any(key in statement for key in ("NotAction", "NotResource", "NotPrincipal")):
            errors.append(f"POLICY_NOT_CONSTRUCT_FORBIDDEN:{index}")
            continue
        effect = statement.get("Effect")
        if effect not in {"Allow", "Deny"}:
            errors.append(f"POLICY_EFFECT_INVALID:{index}")
            continue
        actions = sorted(
            _normalise_action(item) for item in _string_or_list(statement.get("Action"))
        )
        resources = sorted(_string_or_list(statement.get("Resource")))
        if not actions or not resources:
            errors.append(f"POLICY_ACTION_OR_RESOURCE_EMPTY:{index}")
            continue
        if not _touches_target(resources):
            continue
        if _principal_is_global(statement.get("Principal")):
            errors.append(f"GLOBAL_PRINCIPAL_ON_TARGET:{index}")
        target_statements.append(
            {
                "effect": effect,
                "actions": actions,
                "resources": resources,
                "condition": _normalise_condition(statement.get("Condition")),
            }
        )

    if len(target_statements) != len(EXPECTED_RULES):
        errors.append("TARGET_RULE_COUNT_NOT_SEVEN")
    matched_indexes: set[int] = set()
    for expected in EXPECTED_RULES:
        signature = {
            "effect": expected["effect"],
            "actions": sorted(_string_list(expected["actions"])),
            "resources": sorted(_string_list(expected["resources"])),
            "condition": _normalise_condition(expected["condition"]),
        }
        matches = [
            index
            for index, statement in enumerate(target_statements)
            if statement == signature
        ]
        if len(matches) != 1:
            errors.append(f"PANEL_RULE_NOT_EXACT:{expected['name']}")
        else:
            matched_indexes.add(matches[0])
    if len(matched_indexes) != len(target_statements):
        errors.append("UNEXPECTED_TARGET_RULE")
    _raise_errors(errors)
    return hashlib.sha256(canonical_json(policy).encode()).hexdigest()


def classify_client_error(
    error: BaseException,
    *,
    client_error_type: type[BaseException] | None = None,
) -> DenialClassification | None:
    resolved_type = client_error_type
    if resolved_type is None:
        try:
            exceptions = importlib.import_module("botocore.exceptions")
        except ImportError:
            return None
        candidate = getattr(exceptions, "ClientError", None)
        if not isinstance(candidate, type) or not issubclass(candidate, BaseException):
            return None
        resolved_type = candidate
    if not isinstance(error, resolved_type):
        return None
    response = getattr(error, "response", None)
    if not isinstance(response, dict):
        return None
    metadata = _mapping(response.get("ResponseMetadata"))
    error_data = _mapping(response.get("Error"))
    status = _integer(metadata.get("HTTPStatusCode"))
    code = _text(error_data.get("Code"))
    if status not in {401, 403} or code not in _DENIAL_CODES:
        return None
    request_id = metadata.get("RequestId") or metadata.get("HostId")
    return DenialClassification(
        error_code=code,
        http_status=status,
        request_id_present=isinstance(request_id, str) and bool(request_id),
    )


def expect_authorization_denied(
    label: str,
    operation: Callable[[], object],
    *,
    client_error_type: type[BaseException],
) -> dict[str, object]:
    try:
        operation()
    except BaseException as exc:
        denial = classify_client_error(exc, client_error_type=client_error_type)
        if denial is None:
            raise ProbeFailure(
                _unexpected_error_reason(label, exc, client_error_type)
            ) from exc
        return denial.as_dict()
    raise ProbeFailure(f"DENIAL_EXPECTED_BUT_ALLOWED:{label}")


def read_credentials_once(
    *, prompt: Callable[[str], str] = getpass.getpass
) -> CredentialSet:
    values = [
        prompt("REG.RU owner/admin Access Key ID (hidden): "),
        prompt("REG.RU owner/admin Secret Access Key (hidden): "),
        prompt("REG.RU finalizer Access Key ID (hidden): "),
        prompt("REG.RU finalizer Secret Access Key (hidden): "),
        prompt("REG.RU control Access Key ID (hidden): "),
        prompt("REG.RU control Secret Access Key (hidden): "),
    ]
    if any(not value for value in values):
        raise ProbeFailure("EMPTY_CREDENTIAL")
    admin = Credentials(values[0], values[1])
    finalizer = Credentials(values[2], values[3])
    control = Credentials(values[4], values[5])
    if len({admin.access_key_id, finalizer.access_key_id, control.access_key_id}) != 3:
        raise ProbeFailure("ACCESS_KEY_ID_COLLISION")
    return CredentialSet(admin=admin, finalizer=finalizer, control=control)


def load_sdk() -> Sdk:
    try:
        boto3_module = importlib.import_module("boto3")
        botocore_module = importlib.import_module("botocore")
        config_module = importlib.import_module("botocore.config")
        exceptions_module = importlib.import_module("botocore.exceptions")
    except ImportError as exc:
        raise ProbeFailure("BOTO3_BOTOCORE_NOT_INSTALLED") from exc
    config_type = getattr(config_module, "Config", None)
    client_error_type = getattr(exceptions_module, "ClientError", None)
    unsigned = getattr(botocore_module, "UNSIGNED", None)
    if not isinstance(config_type, type):
        raise ProbeFailure("BOTOCORE_CONFIG_UNAVAILABLE")
    if not isinstance(client_error_type, type) or not issubclass(
        client_error_type, BaseException
    ):
        raise ProbeFailure("BOTOCORE_CLIENT_ERROR_UNAVAILABLE")
    if unsigned is None:
        raise ProbeFailure("BOTOCORE_UNSIGNED_UNAVAILABLE")
    return Sdk(
        boto3=boto3_module,
        botocore=botocore_module,
        config_type=config_type,
        client_error_type=client_error_type,
        unsigned=unsigned,
    )


def reserve_private_output(path: Path) -> int:
    if not path.is_absolute():
        raise ProbeFailure("OUTPUT_PATH_NOT_ABSOLUTE")
    try:
        resolved_parent = path.parent.resolve(strict=True)
        parent_stat = path.parent.lstat()
    except OSError as exc:
        raise ProbeFailure("OUTPUT_PARENT_INVALID") from exc
    if resolved_parent != path.parent or not stat.S_ISDIR(parent_stat.st_mode):
        raise ProbeFailure("OUTPUT_PARENT_NOT_CANONICAL_DIRECTORY")
    if parent_stat.st_uid != os.geteuid():
        raise ProbeFailure("OUTPUT_PARENT_NOT_OWNED")
    if stat.S_IMODE(parent_stat.st_mode) & 0o077:
        raise ProbeFailure("OUTPUT_PARENT_NOT_PRIVATE")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    try:
        return os.open(path, flags, 0o600)
    except OSError as exc:
        raise ProbeFailure("OUTPUT_CREATE_FAILED") from exc


def write_reserved_report(path: Path, report: Mapping[str, object]) -> None:
    encoded = (
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode()
    if len(encoded) > MAXIMUM_REPORT_BYTES:
        raise ProbeFailure("SANITIZED_REPORT_TOO_LARGE")
    try:
        reserved_stat = path.lstat()
    except OSError as exc:
        raise ProbeFailure("OUTPUT_RESERVATION_MISSING") from exc
    if (
        not stat.S_ISREG(reserved_stat.st_mode)
        or reserved_stat.st_uid != os.geteuid()
        or stat.S_IMODE(reserved_stat.st_mode) != 0o600
        or reserved_stat.st_nlink != 1
    ):
        raise ProbeFailure("OUTPUT_RESERVATION_INVALID")
    flags = os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise ProbeFailure("OUTPUT_RESERVATION_OPEN_FAILED") from exc
    try:
        opened_stat = os.fstat(descriptor)
        if (
            opened_stat.st_dev != reserved_stat.st_dev
            or opened_stat.st_ino != reserved_stat.st_ino
        ):
            raise ProbeFailure("OUTPUT_RESERVATION_CHANGED")
        os.ftruncate(descriptor, 0)
        os.write(descriptor, encoded)
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def run_probe(
    authority: Mapping[str, object],
    credentials: CredentialSet,
    sdk: Sdk,
    *,
    confirmation_reader: Callable[[str], str] = input,
) -> dict[str, object]:
    validate_authority(authority)
    target = _mapping(authority.get("target"))
    probe = _mapping(authority.get("probe"))
    endpoint = _text(target.get("endpoint"))
    region = _text(target.get("region"))
    bucket = _text(target.get("bucket"))
    prefix = _text(target.get("prefix"))
    ca_bundle = _text(probe.get("tls_ca_bundle"))
    _validate_runtime_target(endpoint, region, bucket, prefix, ca_bundle)

    signed_config = sdk.config_type(
        signature_version="s3v4",
        connect_timeout=20,
        read_timeout=120,
        retries={"mode": "standard", "total_max_attempts": 3},
        s3={"addressing_style": "path"},
        request_checksum_calculation=probe["request_checksum_calculation"],
        response_checksum_validation=probe["response_checksum_validation"],
    )
    unsigned_config = sdk.config_type(
        signature_version=sdk.unsigned,
        connect_timeout=20,
        read_timeout=120,
        retries={"mode": "standard", "total_max_attempts": 2},
        s3={"addressing_style": "path"},
        request_checksum_calculation=probe["request_checksum_calculation"],
        response_checksum_validation=probe["response_checksum_validation"],
    )
    admin = _make_client(
        sdk,
        credentials.admin,
        endpoint=endpoint,
        region=region,
        ca_bundle=ca_bundle,
        config=signed_config,
    )
    finalizer = _make_client(
        sdk,
        credentials.finalizer,
        endpoint=endpoint,
        region=region,
        ca_bundle=ca_bundle,
        config=signed_config,
    )
    control = _make_client(
        sdk,
        credentials.control,
        endpoint=endpoint,
        region=region,
        ca_bundle=ca_bundle,
        config=signed_config,
    )
    anonymous = sdk.boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        verify=ca_bundle,
        config=unsigned_config,
    )
    cleanup = CleanupState(admin_client=admin, finalizer_client=finalizer)
    denial_evidence: dict[str, object] = {}
    cleanup_errors: list[str] = []

    try:
        admin_location = _call(
            "ADMIN_GET_BUCKET_LOCATION",
            lambda: admin.get_bucket_location(Bucket=bucket),
            sdk.client_error_type,
        )
        versioning = _call(
            "ADMIN_GET_BUCKET_VERSIONING",
            lambda: admin.get_bucket_versioning(Bucket=bucket),
            sdk.client_error_type,
        )
        object_lock = _call(
            "ADMIN_GET_OBJECT_LOCK_CONFIGURATION",
            lambda: admin.get_object_lock_configuration(Bucket=bucket),
            sdk.client_error_type,
        )
        policy_response = _call(
            "ADMIN_GET_BUCKET_POLICY",
            lambda: admin.get_bucket_policy(Bucket=bucket),
            sdk.client_error_type,
        )
        policy = _extract_policy(policy_response)
        policy_digest = validate_panel_policy(authority, policy)
        configuration = _validate_bucket_configuration(
            admin_location, versioning, object_lock, region
        )

        _call(
            "FINALIZER_GET_BUCKET_LOCATION",
            lambda: finalizer.get_bucket_location(Bucket=bucket),
            sdk.client_error_type,
        )
        _call(
            "FINALIZER_GET_BUCKET_VERSIONING",
            lambda: finalizer.get_bucket_versioning(Bucket=bucket),
            sdk.client_error_type,
        )
        _call(
            "FINALIZER_LIST_OBJECTS",
            lambda: finalizer.list_objects_v2(
                Bucket=bucket, Prefix=prefix, MaxKeys=1
            ),
            sdk.client_error_type,
        )
        _call(
            "FINALIZER_LIST_VERSIONS",
            lambda: finalizer.list_object_versions(
                Bucket=bucket, Prefix=prefix, MaxKeys=1
            ),
            sdk.client_error_type,
        )
        _call(
            "FINALIZER_LIST_MULTIPART_UPLOADS",
            lambda: finalizer.list_multipart_uploads(
                Bucket=bucket, Prefix=prefix, MaxUploads=1
            ),
            sdk.client_error_type,
        )

        control_metadata = {
            "get_bucket_location": _observe_allowed_or_denied(
                "CONTROL_GET_BUCKET_LOCATION",
                lambda: control.get_bucket_location(Bucket=bucket),
                sdk.client_error_type,
            ),
            "get_bucket_versioning": _observe_allowed_or_denied(
                "CONTROL_GET_BUCKET_VERSIONING",
                lambda: control.get_bucket_versioning(Bucket=bucket),
                sdk.client_error_type,
            ),
        }
        denial_evidence["control_list_objects"] = expect_authorization_denied(
            "CONTROL_LIST_OBJECTS",
            lambda: control.list_objects_v2(
                Bucket=bucket, Prefix=prefix, MaxKeys=1
            ),
            client_error_type=sdk.client_error_type,
        )
        denial_evidence["control_list_versions"] = expect_authorization_denied(
            "CONTROL_LIST_VERSIONS",
            lambda: control.list_object_versions(
                Bucket=bucket, Prefix=prefix, MaxKeys=1
            ),
            client_error_type=sdk.client_error_type,
        )
        denial_evidence["control_list_multipart_uploads"] = (
            expect_authorization_denied(
                "CONTROL_LIST_MULTIPART_UPLOADS",
                lambda: control.list_multipart_uploads(
                    Bucket=bucket, Prefix=prefix, MaxUploads=1
                ),
                client_error_type=sdk.client_error_type,
            )
        )
        denial_evidence["finalizer_get_bucket_policy"] = (
            expect_authorization_denied(
                "FINALIZER_GET_BUCKET_POLICY",
                lambda: finalizer.get_bucket_policy(Bucket=bucket),
                client_error_type=sdk.client_error_type,
            )
        )

        lifecycle = _read_optional_lifecycle(admin, bucket, sdk.client_error_type)
        existing_versions = _list_exact_stream_versions(
            finalizer, bucket, STREAM_KEY, sdk.client_error_type
        )
        if len(existing_versions) > 1:
            raise ProbeFailure("MULTIPLE_EXISTING_STREAM_VERSIONS")

        entered = confirmation_reader(
            "Exact mutation confirmation required. Type the committed phrase exactly:\n"
            f"{CONFIRMATION}\n> "
        )
        if entered != CONFIRMATION:
            raise ProbeFailure("CONFIRMATION_MISMATCH")

        policy_json = canonical_json(policy)
        denial_evidence["finalizer_put_bucket_policy"] = (
            expect_authorization_denied(
                "FINALIZER_PUT_BUCKET_POLICY",
                lambda: finalizer.put_bucket_policy(
                    Bucket=bucket, Policy=policy_json
                ),
                client_error_type=sdk.client_error_type,
            )
        )
        denial_evidence["finalizer_put_bucket_versioning"] = (
            expect_authorization_denied(
                "FINALIZER_PUT_BUCKET_VERSIONING",
                lambda: finalizer.put_bucket_versioning(
                    Bucket=bucket,
                    VersioningConfiguration={"Status": "Enabled"},
                ),
                client_error_type=sdk.client_error_type,
            )
        )
        exact_lock_configuration = {
            "ObjectLockEnabled": "Enabled",
            "Rule": {"DefaultRetention": {"Mode": "COMPLIANCE", "Days": 90}},
        }
        denial_evidence["finalizer_put_object_lock_configuration"] = (
            expect_authorization_denied(
                "FINALIZER_PUT_OBJECT_LOCK_CONFIGURATION",
                lambda: finalizer.put_object_lock_configuration(
                    Bucket=bucket,
                    ObjectLockConfiguration=exact_lock_configuration,
                ),
                client_error_type=sdk.client_error_type,
            )
        )
        if lifecycle is None:
            lifecycle_proof: dict[str, object] = {"status": "NOT_CONFIGURED"}
        else:
            denial_evidence["finalizer_put_lifecycle"] = (
                expect_authorization_denied(
                    "FINALIZER_PUT_LIFECYCLE",
                    lambda: finalizer.put_bucket_lifecycle_configuration(
                        Bucket=bucket, LifecycleConfiguration=lifecycle
                    ),
                    client_error_type=sdk.client_error_type,
                )
            )
            lifecycle_proof = {"status": "CONFIGURED_AND_FINALIZER_DENIED"}

        control_create_key = f"{MULTIPART_KEY_PREFIX}-control-denial.bin"
        try:
            control_create = control.create_multipart_upload(
                Bucket=bucket, Key=control_create_key
            )
        except BaseException as exc:
            denial = classify_client_error(
                exc, client_error_type=sdk.client_error_type
            )
            if denial is None:
                raise ProbeFailure(
                    _unexpected_error_reason(
                        "CONTROL_CREATE_MULTIPART", exc, sdk.client_error_type
                    )
                ) from exc
            denial_evidence["control_create_multipart"] = denial.as_dict()
        else:
            upload_id = _text(_mapping(control_create).get("UploadId"))
            if upload_id:
                cleanup.open_control_upload = (control_create_key, upload_id)
                _call(
                    "ADMIN_ABORT_UNEXPECTED_CONTROL_MULTIPART",
                    lambda: admin.abort_multipart_upload(
                        Bucket=bucket,
                        Key=control_create_key,
                        UploadId=upload_id,
                    ),
                    sdk.client_error_type,
                )
                cleanup.open_control_upload = None
            raise ProbeFailure(
                "DENIAL_EXPECTED_BUT_ALLOWED:CONTROL_CREATE_MULTIPART"
            )

        multipart_key = (
            f"{MULTIPART_KEY_PREFIX}-"
            f"{datetime.now(UTC).strftime('%Y%m%dT%H%M%S%fZ')}.bin"
        )
        create_response = _call(
            "FINALIZER_CREATE_MULTIPART",
            lambda: finalizer.create_multipart_upload(
                Bucket=bucket, Key=multipart_key
            ),
            sdk.client_error_type,
        )
        upload_id = _text(_mapping(create_response).get("UploadId"))
        if not upload_id:
            raise ProbeFailure("MULTIPART_UPLOAD_ID_MISSING")
        cleanup.open_finalizer_upload = (multipart_key, upload_id)
        listed = _call(
            "FINALIZER_LIST_CREATED_MULTIPART",
            lambda: finalizer.list_multipart_uploads(
                Bucket=bucket, Prefix=multipart_key, MaxUploads=10
            ),
            sdk.client_error_type,
        )
        uploads = _list_of_mappings(_mapping(listed).get("Uploads"))
        if not any(
            item.get("Key") == multipart_key and item.get("UploadId") == upload_id
            for item in uploads
        ):
            raise ProbeFailure("MULTIPART_NOT_LISTED")
        denial_evidence["control_list_parts"] = expect_authorization_denied(
            "CONTROL_LIST_PARTS",
            lambda: control.list_parts(
                Bucket=bucket, Key=multipart_key, UploadId=upload_id
            ),
            client_error_type=sdk.client_error_type,
        )
        denial_evidence["control_abort_multipart"] = expect_authorization_denied(
            "CONTROL_ABORT_MULTIPART",
            lambda: control.abort_multipart_upload(
                Bucket=bucket, Key=multipart_key, UploadId=upload_id
            ),
            client_error_type=sdk.client_error_type,
        )
        part_body = b"M" * MULTIPART_PART_BYTES
        _call(
            "FINALIZER_UPLOAD_PART",
            lambda: finalizer.upload_part(
                Bucket=bucket,
                Key=multipart_key,
                UploadId=upload_id,
                PartNumber=1,
                Body=part_body,
                ContentLength=MULTIPART_PART_BYTES,
            ),
            sdk.client_error_type,
        )
        parts_response = _call(
            "FINALIZER_LIST_PARTS",
            lambda: finalizer.list_parts(
                Bucket=bucket, Key=multipart_key, UploadId=upload_id
            ),
            sdk.client_error_type,
        )
        parts = _list_of_mappings(_mapping(parts_response).get("Parts"))
        if len(parts) != 1 or parts[0].get("PartNumber") != 1:
            raise ProbeFailure("MULTIPART_PART_LIST_INVALID")
        if _integer(parts[0].get("Size")) != MULTIPART_PART_BYTES:
            raise ProbeFailure("MULTIPART_PART_SIZE_INVALID")
        _call(
            "FINALIZER_ABORT_MULTIPART",
            lambda: finalizer.abort_multipart_upload(
                Bucket=bucket, Key=multipart_key, UploadId=upload_id
            ),
            sdk.client_error_type,
        )
        cleanup.open_finalizer_upload = None
        after_abort = _call(
            "FINALIZER_LIST_MULTIPART_AFTER_ABORT",
            lambda: finalizer.list_multipart_uploads(
                Bucket=bucket, Prefix=multipart_key, MaxUploads=10
            ),
            sdk.client_error_type,
        )
        remaining_uploads = _list_of_mappings(_mapping(after_abort).get("Uploads"))
        if any(item.get("Key") == multipart_key for item in remaining_uploads):
            raise ProbeFailure("MULTIPART_RETAINED_AFTER_ABORT")

        stream = _upload_or_resume_stream(
            finalizer=finalizer,
            bucket=bucket,
            existing_versions=existing_versions,
            client_error_type=sdk.client_error_type,
        )
        version_id = _text(stream.get("version_id"))
        source_digest = _text(stream.get("source_sha256"))
        retention_response = _call(
            "ADMIN_GET_STREAM_RETENTION",
            lambda: admin.get_object_retention(
                Bucket=bucket, Key=STREAM_KEY, VersionId=version_id
            ),
            sdk.client_error_type,
        )
        retention = _validate_object_retention(retention_response)
        denial_evidence["finalizer_get_object_retention"] = (
            expect_authorization_denied(
                "FINALIZER_GET_OBJECT_RETENTION",
                lambda: finalizer.get_object_retention(
                    Bucket=bucket, Key=STREAM_KEY, VersionId=version_id
                ),
                client_error_type=sdk.client_error_type,
            )
        )
        denial_evidence["finalizer_put_object_retention"] = (
            expect_authorization_denied(
                "FINALIZER_PUT_OBJECT_RETENTION",
                lambda: finalizer.put_object_retention(
                    Bucket=bucket,
                    Key=STREAM_KEY,
                    VersionId=version_id,
                    Retention={
                        "Mode": "COMPLIANCE",
                        "RetainUntilDate": retention["retain_until"],
                    },
                ),
                client_error_type=sdk.client_error_type,
            )
        )
        denial_evidence["finalizer_versionless_delete"] = _expect_delete_denied(
            label="FINALIZER_VERSIONLESS_DELETE",
            client=finalizer,
            admin=admin,
            bucket=bucket,
            key=STREAM_KEY,
            version_id=None,
            cleanup=cleanup,
            client_error_type=sdk.client_error_type,
        )
        denial_evidence["finalizer_exact_version_delete"] = _expect_delete_denied(
            label="FINALIZER_EXACT_VERSION_DELETE",
            client=finalizer,
            admin=admin,
            bucket=bucket,
            key=STREAM_KEY,
            version_id=version_id,
            cleanup=cleanup,
            client_error_type=sdk.client_error_type,
        )
        denial_evidence["admin_locked_version_delete"] = _expect_delete_denied(
            label="ADMIN_LOCKED_VERSION_DELETE",
            client=admin,
            admin=admin,
            bucket=bucket,
            key=STREAM_KEY,
            version_id=version_id,
            cleanup=cleanup,
            client_error_type=sdk.client_error_type,
        )

        restored_digest = _restore_exact_version_sha256(
            finalizer, bucket, STREAM_KEY, version_id, sdk.client_error_type
        )
        if restored_digest != source_digest:
            raise ProbeFailure("STREAM_RESTORE_SHA256_MISMATCH")
        current_head = _call(
            "FINALIZER_HEAD_CURRENT_STREAM",
            lambda: finalizer.head_object(Bucket=bucket, Key=STREAM_KEY),
            sdk.client_error_type,
        )
        if _text(_mapping(current_head).get("VersionId")) != version_id:
            raise ProbeFailure("STREAM_VERSION_NOT_CURRENT")
        denial_evidence["control_known_object_get"] = expect_authorization_denied(
            "CONTROL_KNOWN_OBJECT_GET",
            lambda: control.get_object(
                Bucket=bucket, Key=STREAM_KEY, VersionId=version_id
            ),
            client_error_type=sdk.client_error_type,
        )
        denial_evidence["control_put_object"] = expect_authorization_denied(
            "CONTROL_PUT_OBJECT",
            lambda: control.put_object(
                Bucket=bucket,
                Key=STREAM_KEY,
                Body=b"",
                ContentLength=0,
                IfNoneMatch="*",
            ),
            client_error_type=sdk.client_error_type,
        )
        denial_evidence["anonymous_list"] = expect_authorization_denied(
            "ANONYMOUS_LIST",
            lambda: anonymous.list_objects_v2(
                Bucket=bucket, Prefix=prefix, MaxKeys=1
            ),
            client_error_type=sdk.client_error_type,
        )
        denial_evidence["anonymous_known_object_get"] = (
            expect_authorization_denied(
                "ANONYMOUS_KNOWN_OBJECT_GET",
                lambda: anonymous.get_object(
                    Bucket=bucket, Key=STREAM_KEY, VersionId=version_id
                ),
                client_error_type=sdk.client_error_type,
            )
        )

        report = {
            "schema_version": REPORT_SCHEMA,
            "status": VERIFIED_STATUS,
            "reasons": [],
            "generated_at": datetime.now(UTC).isoformat(),
            "exact_base": EXACT_BASE,
            "provider_profile": PROFILE,
            "profile_state": "CANDIDATE_NOT_ACTIVE",
            "panel_state": "VERIFIED_NOT_ACTIVE",
            "target": {
                "endpoint_host": urlsplit(endpoint).hostname,
                "region": region,
                "bucket": bucket,
                "prefix": prefix,
                "operator_confirmed_capacity_bytes": target[
                    "operator_confirmed_capacity_bytes"
                ],
            },
            "key_sets": {
                "admin": KEY_SETS["admin"],
                "finalizer": KEY_SETS["finalizer"],
                "control": KEY_SETS["control"],
            },
            "authority_sha256": authority_sha256(authority),
            "policy": {
                "sha256": policy_digest,
                "exact_rule_count": len(EXPECTED_RULES),
                "matched_rule_names": [rule["name"] for rule in EXPECTED_RULES],
                "raw_policy_retained": False,
            },
            "configuration": configuration,
            "control_bucket_metadata_observation": control_metadata,
            "denials": denial_evidence,
            "lifecycle": lifecycle_proof,
            "multipart": {
                "create_succeeded": True,
                "listed": True,
                "part_uploaded": True,
                "parts_listed": True,
                "abort_succeeded": True,
                "absent_after_abort": True,
                "part_bytes": MULTIPART_PART_BYTES,
                "retained_bytes": 0,
            },
            "stream": {
                "mode": stream["mode"],
                "key": STREAM_KEY,
                "size_bytes": STREAM_OBJECT_BYTES,
                "version_id_present": True,
                "version_id_sha256": hashlib.sha256(version_id.encode()).hexdigest(),
                "retention_mode": retention["mode"],
                "retention_deadline_90d": True,
                "retain_until": cast(
                    datetime, retention["retain_until"]
                ).isoformat(),
                "source_sha256": source_digest,
                "restored_sha256": restored_digest,
                "sha256_match": True,
                "known_object_still_current": True,
            },
            "bounds": {
                "retained_locked_objects": 1,
                "retained_locked_bytes": STREAM_OBJECT_BYTES,
                "aborted_multipart_retained_bytes": 0,
                "credentials_in_output": False,
                "raw_policy_retained": False,
                "maximum_sanitized_report_bytes": MAXIMUM_REPORT_BYTES,
            },
            "sdk": {
                "boto3_version": _text(getattr(sdk.boto3, "__version__", "")),
                "botocore_version": _text(
                    getattr(sdk.botocore, "__version__", "")
                ),
                "aws_cli_used": False,
                "denial_classifier": (
                    "botocore.ClientError+ResponseMetadata.HTTPStatusCode"
                ),
            },
            "github_secret_registration_allowed": False,
            "finalization_allowed": False,
            "bundle_upload_status": "NOT_RUN",
            "bundle_restore_status": "NOT_RUN",
            "benchmark_status": "NOT_RUN",
            "model_admission_status": "NOT_DONE",
            "production_operational_status": "NOT_ATTESTED",
        }
        _validate_sanitized_report(report)
        report["report_sha256"] = hashlib.sha256(
            canonical_json(report).encode()
        ).hexdigest()
        return report
    finally:
        cleanup_errors.extend(_cleanup(cleanup, bucket, sdk.client_error_type))
        if cleanup_errors:
            raise ProbeFailure(
                "BOUNDED_CLEANUP_FAILED:" + ",".join(cleanup_errors)
            )


def failed_report(
    authority: Mapping[str, object] | None,
    reason: str,
    sdk: Sdk | None,
) -> dict[str, object]:
    authority_value: Mapping[str, object] = authority or {}
    report: dict[str, object] = {
        "schema_version": REPORT_SCHEMA,
        "status": FAILED_STATUS,
        "reasons": [reason],
        "generated_at": datetime.now(UTC).isoformat(),
        "exact_base": EXACT_BASE,
        "provider_profile": PROFILE,
        "profile_state": "CANDIDATE_NOT_ACTIVE",
        "authority_sha256": (
            authority_sha256(authority_value) if authority_value else None
        ),
        "credentials_in_output": False,
        "raw_policy_retained": False,
        "aws_cli_used": False,
        "sdk": {
            "boto3_version": (
                _text(getattr(sdk.boto3, "__version__", "")) if sdk else None
            ),
            "botocore_version": (
                _text(getattr(sdk.botocore, "__version__", "")) if sdk else None
            ),
        },
        "github_secret_registration_allowed": False,
        "finalization_allowed": False,
        "bundle_upload_status": "NOT_RUN",
        "bundle_restore_status": "NOT_RUN",
        "benchmark_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }
    _validate_sanitized_report(report)
    report["report_sha256"] = hashlib.sha256(
        canonical_json(report).encode()
    ).hexdigest()
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run the local interactive REG.RU S3 compatibility verifier v2"
    )
    parser.add_argument("--authority", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)

    authority: dict[str, object] | None = None
    sdk: Sdk | None = None
    output_reserved = False
    try:
        if not sys.stdin.isatty() or not sys.stdout.isatty():
            raise ProbeFailure("INTERACTIVE_TTY_REQUIRED")
        authority = load_json(args.authority)
        validate_authority(authority)
        sdk = load_sdk()
        _validate_runtime_target(
            _text(_mapping(authority.get("target")).get("endpoint")),
            _text(_mapping(authority.get("target")).get("region")),
            _text(_mapping(authority.get("target")).get("bucket")),
            _text(_mapping(authority.get("target")).get("prefix")),
            _text(_mapping(authority.get("probe")).get("tls_ca_bundle")),
        )
        descriptor = reserve_private_output(args.output)
        os.close(descriptor)
        output_reserved = True
        credentials = read_credentials_once()
        report = run_probe(authority, credentials, sdk)
        write_reserved_report(args.output, report)
        print(canonical_json(report))
        return 0
    except KeyboardInterrupt:
        reason = "INTERRUPTED"
    except ProbeFailure as exc:
        reason = exc.reason
    except BaseException as exc:
        reason = f"UNEXPECTED_LOCAL_ERROR:{type(exc).__name__}"

    report = failed_report(authority, reason, sdk)
    if output_reserved:
        try:
            write_reserved_report(args.output, report)
        except ProbeFailure as report_error:
            print(f"FAILED_CLOSED:{report_error.reason}", file=sys.stderr)
    print(f"FAILED_CLOSED:{reason}", file=sys.stderr)
    return 2


def _make_client(
    sdk: Sdk,
    credentials: Credentials,
    *,
    endpoint: str,
    region: str,
    ca_bundle: str,
    config: object,
) -> Any:
    return sdk.boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=credentials.access_key_id,
        aws_secret_access_key=credentials.secret_access_key,
        verify=ca_bundle,
        config=config,
    )


def _call(
    label: str,
    operation: Callable[[], Any],
    client_error_type: type[BaseException],
) -> Any:
    try:
        return operation()
    except BaseException as exc:
        raise ProbeFailure(
            _unexpected_error_reason(label, exc, client_error_type)
        ) from exc


def _unexpected_error_reason(
    label: str,
    error: BaseException,
    client_error_type: type[BaseException],
) -> str:
    if isinstance(error, client_error_type):
        response = getattr(error, "response", None)
        if isinstance(response, dict):
            metadata = _mapping(response.get("ResponseMetadata"))
            error_data = _mapping(response.get("Error"))
            status = _integer(metadata.get("HTTPStatusCode"))
            code = _safe_token(_text(error_data.get("Code")))
            return f"UNEXPECTED_CLIENT_ERROR:{label}:{status}:{code or 'UNKNOWN'}"
    return f"UNEXPECTED_SDK_ERROR:{label}:{type(error).__name__}"


def _observe_allowed_or_denied(
    label: str,
    operation: Callable[[], object],
    client_error_type: type[BaseException],
) -> dict[str, object]:
    try:
        operation()
    except BaseException as exc:
        denial = classify_client_error(exc, client_error_type=client_error_type)
        if denial is None:
            raise ProbeFailure(
                _unexpected_error_reason(label, exc, client_error_type)
            ) from exc
        return {"status": "DENIED", **denial.as_dict()}
    return {"status": "VISIBLE"}


def _read_optional_lifecycle(
    admin: Any, bucket: str, client_error_type: type[BaseException]
) -> dict[str, object] | None:
    try:
        response = admin.get_bucket_lifecycle_configuration(Bucket=bucket)
    except BaseException as exc:
        if _is_not_found_client_error(exc, client_error_type):
            return None
        raise ProbeFailure(
            _unexpected_error_reason("ADMIN_GET_LIFECYCLE", exc, client_error_type)
        ) from exc
    mapping = _mapping(response)
    rules = mapping.get("Rules")
    if not isinstance(rules, list):
        raise ProbeFailure("LIFECYCLE_RULES_INVALID")
    return {"Rules": rules}


def _extract_policy(response: object) -> dict[str, object]:
    raw_policy = _mapping(response).get("Policy")
    if isinstance(raw_policy, str):
        try:
            payload = json.loads(raw_policy)
        except json.JSONDecodeError as exc:
            raise ProbeFailure("BUCKET_POLICY_JSON_INVALID") from exc
    else:
        payload = raw_policy
    if not isinstance(payload, dict):
        raise ProbeFailure("BUCKET_POLICY_NOT_OBJECT")
    return cast(dict[str, object], payload)


def _validate_bucket_configuration(
    location_response: object,
    versioning_response: object,
    object_lock_response: object,
    region: str,
) -> dict[str, object]:
    location = _mapping(location_response).get("LocationConstraint")
    if location not in {None, "", region}:
        raise ProbeFailure("BUCKET_LOCATION_MISMATCH")
    if _mapping(versioning_response).get("Status") != "Enabled":
        raise ProbeFailure("VERSIONING_NOT_ENABLED")
    lock = _mapping(
        _mapping(object_lock_response).get("ObjectLockConfiguration")
    )
    if lock.get("ObjectLockEnabled") != "Enabled":
        raise ProbeFailure("OBJECT_LOCK_NOT_ENABLED")
    retention = _mapping(_mapping(lock.get("Rule")).get("DefaultRetention"))
    if retention != {"Mode": "COMPLIANCE", "Days": 90}:
        raise ProbeFailure("DEFAULT_RETENTION_NOT_COMPLIANCE_90D")
    return {
        "location_constraint": location,
        "versioning_status": "Enabled",
        "object_lock_status": "Enabled",
        "retention_mode": "COMPLIANCE",
        "retention_days": 90,
    }


def _list_exact_stream_versions(
    finalizer: Any,
    bucket: str,
    key: str,
    client_error_type: type[BaseException],
) -> list[dict[str, object]]:
    response = _call(
        "FINALIZER_LIST_EXACT_STREAM_VERSIONS",
        lambda: finalizer.list_object_versions(
            Bucket=bucket, Prefix=key, MaxKeys=100
        ),
        client_error_type,
    )
    mapping = _mapping(response)
    delete_markers = [
        item
        for item in _list_of_mappings(mapping.get("DeleteMarkers"))
        if item.get("Key") == key
    ]
    if delete_markers:
        raise ProbeFailure("STREAM_DELETE_MARKER_PRESENT")
    return [
        item
        for item in _list_of_mappings(mapping.get("Versions"))
        if item.get("Key") == key
    ]


def _upload_or_resume_stream(
    *,
    finalizer: Any,
    bucket: str,
    existing_versions: list[dict[str, object]],
    client_error_type: type[BaseException],
) -> dict[str, object]:
    source_digest = _deterministic_stream_sha256()
    if existing_versions:
        version_id = _text(existing_versions[0].get("VersionId"))
        if not version_id:
            raise ProbeFailure("EXISTING_STREAM_VERSION_ID_MISSING")
        head = _call(
            "FINALIZER_HEAD_EXISTING_STREAM_VERSION",
            lambda: finalizer.head_object(
                Bucket=bucket, Key=STREAM_KEY, VersionId=version_id
            ),
            client_error_type,
        )
        if _integer(_mapping(head).get("ContentLength")) != STREAM_OBJECT_BYTES:
            raise ProbeFailure("EXISTING_STREAM_SIZE_INVALID")
        existing_digest = _restore_exact_version_sha256(
            finalizer, bucket, STREAM_KEY, version_id, client_error_type
        )
        if existing_digest != source_digest:
            raise ProbeFailure("EXISTING_STREAM_SHA256_INVALID")
        return {
            "mode": "RESUMED_EXISTING_SINGLE_OBJECT",
            "version_id": version_id,
            "source_sha256": source_digest,
        }

    with tempfile.TemporaryFile() as source:
        remaining = STREAM_OBJECT_BYTES
        source_hasher = hashlib.sha256()
        chunk = b"T" * (1024 * 1024)
        while remaining:
            current = chunk[: min(remaining, len(chunk))]
            source.write(current)
            source_hasher.update(current)
            remaining -= len(current)
        if source_hasher.hexdigest() != source_digest:
            raise ProbeFailure("LOCAL_STREAM_DIGEST_MISMATCH")
        source.seek(0)
        put_response = _call(
            "FINALIZER_PUT_STREAM",
            lambda: finalizer.put_object(
                Bucket=bucket,
                Key=STREAM_KEY,
                Body=source,
                ContentLength=STREAM_OBJECT_BYTES,
            ),
            client_error_type,
        )
    version_id = _text(_mapping(put_response).get("VersionId"))
    if not version_id:
        head = _call(
            "FINALIZER_HEAD_NEW_STREAM",
            lambda: finalizer.head_object(Bucket=bucket, Key=STREAM_KEY),
            client_error_type,
        )
        version_id = _text(_mapping(head).get("VersionId"))
    if not version_id:
        raise ProbeFailure("NEW_STREAM_VERSION_ID_MISSING")
    versions_after = _list_exact_stream_versions(
        finalizer, bucket, STREAM_KEY, client_error_type
    )
    if (
        len(versions_after) != 1
        or _text(versions_after[0].get("VersionId")) != version_id
    ):
        raise ProbeFailure("STREAM_SINGLE_VERSION_BOUND_VIOLATED")
    return {
        "mode": "UPLOADED_NEW_SINGLE_OBJECT",
        "version_id": version_id,
        "source_sha256": source_digest,
    }


def _restore_exact_version_sha256(
    client: Any,
    bucket: str,
    key: str,
    version_id: str,
    client_error_type: type[BaseException],
) -> str:
    response = _call(
        "GET_EXACT_STREAM_VERSION",
        lambda: client.get_object(Bucket=bucket, Key=key, VersionId=version_id),
        client_error_type,
    )
    body = _mapping(response).get("Body")
    if body is None or not hasattr(body, "read"):
        raise ProbeFailure("STREAM_BODY_MISSING")
    digest = hashlib.sha256()
    total = 0
    try:
        while True:
            chunk = body.read(1024 * 1024)
            if not chunk:
                break
            if not isinstance(chunk, bytes):
                raise ProbeFailure("STREAM_BODY_CHUNK_INVALID")
            total += len(chunk)
            digest.update(chunk)
    finally:
        close = getattr(body, "close", None)
        if callable(close):
            close()
    if total != STREAM_OBJECT_BYTES:
        raise ProbeFailure("RESTORED_STREAM_SIZE_INVALID")
    return digest.hexdigest()


def _validate_object_retention(response: object) -> dict[str, object]:
    retention = _mapping(_mapping(response).get("Retention"))
    if retention.get("Mode") != "COMPLIANCE":
        raise ProbeFailure("STREAM_RETENTION_MODE_INVALID")
    retain_until_value = retention.get("RetainUntilDate")
    if isinstance(retain_until_value, datetime):
        retain_until = retain_until_value
    elif isinstance(retain_until_value, str):
        try:
            retain_until = datetime.fromisoformat(
                retain_until_value.replace("Z", "+00:00")
            )
        except ValueError as exc:
            raise ProbeFailure("STREAM_RETENTION_DATE_INVALID") from exc
    else:
        raise ProbeFailure("STREAM_RETENTION_DATE_MISSING")
    if retain_until.tzinfo is None:
        raise ProbeFailure("STREAM_RETENTION_DATE_NAIVE")
    remaining = retain_until.astimezone(UTC) - datetime.now(UTC)
    if not timedelta(days=89) <= remaining <= timedelta(days=91):
        raise ProbeFailure("STREAM_RETENTION_DEADLINE_NOT_90D")
    return {
        "mode": "COMPLIANCE",
        "retain_until": retain_until.astimezone(UTC),
    }


def _expect_delete_denied(
    *,
    label: str,
    client: Any,
    admin: Any,
    bucket: str,
    key: str,
    version_id: str | None,
    cleanup: CleanupState,
    client_error_type: type[BaseException],
) -> dict[str, object]:
    kwargs: dict[str, object] = {"Bucket": bucket, "Key": key}
    if version_id is not None:
        kwargs["VersionId"] = version_id
    try:
        response = client.delete_object(**kwargs)
    except BaseException as exc:
        denial = classify_client_error(exc, client_error_type=client_error_type)
        if denial is None:
            raise ProbeFailure(
                _unexpected_error_reason(label, exc, client_error_type)
            ) from exc
        return denial.as_dict()
    response_mapping = _mapping(response)
    marker_version = _text(response_mapping.get("VersionId"))
    if response_mapping.get("DeleteMarker") is True and marker_version:
        cleanup.unexpected_delete_marker_version = marker_version
        _call(
            "ADMIN_REMOVE_UNEXPECTED_DELETE_MARKER",
            lambda: admin.delete_object(
                Bucket=bucket, Key=key, VersionId=marker_version
            ),
            client_error_type,
        )
        cleanup.unexpected_delete_marker_version = None
    raise ProbeFailure(f"DENIAL_EXPECTED_BUT_ALLOWED:{label}")


def _cleanup(
    state: CleanupState,
    bucket: str,
    client_error_type: type[BaseException],
) -> list[str]:
    errors: list[str] = []
    if state.open_finalizer_upload and state.finalizer_client is not None:
        key, upload_id = state.open_finalizer_upload
        try:
            state.finalizer_client.abort_multipart_upload(
                Bucket=bucket, Key=key, UploadId=upload_id
            )
        except BaseException as exc:
            errors.append(
                _unexpected_error_reason(
                    "CLEANUP_FINALIZER_MULTIPART", exc, client_error_type
                )
            )
    if state.open_control_upload and state.admin_client is not None:
        key, upload_id = state.open_control_upload
        try:
            state.admin_client.abort_multipart_upload(
                Bucket=bucket, Key=key, UploadId=upload_id
            )
        except BaseException as exc:
            errors.append(
                _unexpected_error_reason(
                    "CLEANUP_CONTROL_MULTIPART", exc, client_error_type
                )
            )
    if state.unexpected_delete_marker_version and state.admin_client is not None:
        try:
            state.admin_client.delete_object(
                Bucket=bucket,
                Key=STREAM_KEY,
                VersionId=state.unexpected_delete_marker_version,
            )
        except BaseException as exc:
            errors.append(
                _unexpected_error_reason(
                    "CLEANUP_DELETE_MARKER", exc, client_error_type
                )
            )
    return errors


def _validate_runtime_target(
    endpoint: str,
    region: str,
    bucket: str,
    prefix: str,
    ca_bundle: str,
) -> None:
    parsed = urlsplit(endpoint)
    if parsed.scheme != "https" or parsed.hostname != "s3.regru.cloud":
        raise ProbeFailure("ENDPOINT_NOT_EXACT_HTTPS")
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise ProbeFailure("ENDPOINT_PATH_QUERY_FRAGMENT_FORBIDDEN")
    if region != "us-east-1":
        raise ProbeFailure("REGION_NOT_EXACT")
    if bucket != "tai-model-bundles-prod-01":
        raise ProbeFailure("BUCKET_NOT_EXACT")
    if prefix != "tai/model-bundles/v1":
        raise ProbeFailure("PREFIX_NOT_EXACT")
    ca_path = Path(ca_bundle)
    if not ca_path.is_absolute() or not ca_path.is_file():
        raise ProbeFailure("CA_BUNDLE_INVALID")


def _validate_sanitized_report(report: Mapping[str, object]) -> None:
    text = canonical_json(report)
    if _ACCESS_KEY_RE.search(text) or _SECRET_KEY_RE.search(text):
        raise ProbeFailure("CREDENTIAL_MATERIAL_IN_REPORT")
    if len((text + "\n").encode()) > MAXIMUM_REPORT_BYTES:
        raise ProbeFailure("SANITIZED_REPORT_TOO_LARGE")


def _deterministic_stream_sha256() -> str:
    digest = hashlib.sha256()
    remaining = STREAM_OBJECT_BYTES
    chunk = b"T" * (1024 * 1024)
    while remaining:
        current = chunk[: min(remaining, len(chunk))]
        digest.update(current)
        remaining -= len(current)
    return digest.hexdigest()


def _is_not_found_client_error(
    error: BaseException, client_error_type: type[BaseException]
) -> bool:
    if not isinstance(error, client_error_type):
        return False
    response = getattr(error, "response", None)
    if not isinstance(response, dict):
        return False
    metadata = _mapping(response.get("ResponseMetadata"))
    error_data = _mapping(response.get("Error"))
    status = _integer(metadata.get("HTTPStatusCode"))
    code = _text(error_data.get("Code"))
    return status == 404 and code in _NOT_FOUND_CODES


def _touches_target(resources: Iterable[str]) -> bool:
    bucket_arn = "arn:aws:s3:::tai-model-bundles-prod-01"
    object_arn = bucket_arn + "/tai/model-bundles/v1/"
    for resource in resources:
        if (
            resource == "*"
            or resource == bucket_arn
            or resource.startswith(object_arn)
        ):
            return True
        if resource.startswith(bucket_arn + "/*"):
            return True
    return False


def _normalise_action(value: str) -> str:
    return value if value.startswith("s3:") else f"s3:{value}"


def _normalise_condition(value: object) -> object:
    if value in (None, {}):
        return {}
    if isinstance(value, dict):
        return {
            str(key): _normalise_condition(item)
            for key, item in sorted(
                value.items(), key=lambda pair: str(pair[0])
            )
        }
    if isinstance(value, list):
        normalised = [_normalise_condition(item) for item in value]
        return sorted(normalised, key=canonical_json)
    return value


def _principal_is_global(value: object) -> bool:
    if value == "*":
        return True
    principal = _mapping(value)
    for key in ("AWS", "CanonicalUser", "Service", "Federated"):
        item = principal.get(key)
        if item == "*" or (isinstance(item, list) and "*" in item):
            return True
    return False


def _mapping(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list_of_mappings(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _text(value: object) -> str:
    return value if isinstance(value, str) else ""


def _integer(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    return value if isinstance(value, int) else None


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _string_or_list(value: object) -> list[str]:
    if isinstance(value, str):
        return [value]
    return _string_list(value)


def _expect(
    actual: object,
    expected: object,
    reason: str,
    errors: list[str],
) -> None:
    if actual != expected:
        errors.append(reason)


def _raise_errors(errors: list[str]) -> None:
    if errors:
        raise ProbeFailure(",".join(sorted(set(errors))))


def _safe_token(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", value)[:80]


if __name__ == "__main__":
    raise SystemExit(main())
