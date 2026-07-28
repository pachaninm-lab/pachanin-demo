from __future__ import annotations

import hashlib
import json
import os
import re
import stat
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlsplit

AUTHORITY_SCHEMA = "tai.reg-ru-s3-panel-compatibility-authority.v1"
OBSERVED_SCHEMA = "tai.reg-ru-s3-panel-compatibility-observed.v1"
REPORT_SCHEMA = "tai.reg-ru-s3-panel-compatibility-report.v1"
EXACT_BASE = "ca3060459976ee64963f4cd3dfc27b34c62527ab"
PROFILE = "REG_RU_S3_2026"
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
    "control_has_policy_rules": False,
    "credential_input": "TTY_HIDDEN_ONLY",
}
CONFIRMATION = (
    "I AUTHORIZE REG.RU S3 PANEL COMPATIBILITY PROBE "
    "tai-model-bundles-prod-01/tai/model-bundles/v1 MAX_LOCKED_BYTES=9437184"
)
STREAM_OBJECT_BYTES = 9 * 1024 * 1024
MULTIPART_PART_BYTES = 5 * 1024 * 1024
MAXIMUM_REPORT_BYTES = 1024 * 1024
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
)


class ContractError(ValueError):
    """Raised when committed or local compatibility evidence fails closed."""


def load_json(path: Path) -> dict[str, object]:
    """Load an object JSON document and reject duplicate keys."""

    def reject_duplicates(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            if key in result:
                raise ContractError(f"DUPLICATE_JSON_KEY:{key}")
            result[key] = value
        return result

    try:
        payload = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicates
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ContractError(f"JSON_UNREADABLE:{path}") from exc
    if not isinstance(payload, dict):
        raise ContractError(f"JSON_ROOT_NOT_OBJECT:{path}")
    return payload


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def authority_sha256(authority: dict[str, object]) -> str:
    return hashlib.sha256(canonical_json(authority).encode()).hexdigest()


def validate_authority(authority: dict[str, object]) -> None:
    errors: list[str] = []
    _expect(authority.get("schema_version"), AUTHORITY_SCHEMA, "AUTHORITY_SCHEMA", errors)
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
    _expect(
        controls.get("versioning_status"),
        "Enabled",
        "VERSIONING_REQUIREMENT",
        errors,
    )
    _expect(
        controls.get("object_lock_status"),
        "Enabled",
        "OBJECT_LOCK_REQUIREMENT",
        errors,
    )
    if _mapping(controls.get("default_retention")) != {
        "mode": "COMPLIANCE",
        "days": 90,
    }:
        errors.append("RETENTION_REQUIREMENT_DRIFT")
    if _integer_list(controls.get("anonymous_denied_http_statuses")) != [401, 403]:
        errors.append("ANONYMOUS_STATUS_REQUIREMENT_DRIFT")

    rules = authority.get("panel_rules")
    if not isinstance(rules, list) or rules != list(EXPECTED_RULES):
        errors.append("PANEL_RULE_SET_DRIFT")

    probe = _mapping(authority.get("probe"))
    _expect(
        probe.get("interactive_confirmation"), CONFIRMATION, "CONFIRMATION", errors
    )
    _expect(
        probe.get("stream_object_bytes"), STREAM_OBJECT_BYTES, "STREAM_SIZE", errors
    )
    _expect(
        probe.get("multipart_part_bytes"),
        MULTIPART_PART_BYTES,
        "MULTIPART_PART_SIZE",
        errors,
    )
    _expect(
        probe.get("maximum_retained_locked_bytes"),
        STREAM_OBJECT_BYTES,
        "LOCKED_BYTE_BOUND",
        errors,
    )
    _expect(
        probe.get("maximum_sanitized_report_bytes"),
        MAXIMUM_REPORT_BYTES,
        "REPORT_BYTE_BOUND",
        errors,
    )
    if probe.get("bucket_policy_mutation_allowed") is not False:
        errors.append("BUCKET_POLICY_MUTATION_MUST_BE_FALSE")
    if probe.get("delete_locked_versions") is not False:
        errors.append("LOCKED_VERSION_DELETE_ALLOWED")
    _expect(
        probe.get("tls_ca_bundle"),
        "/etc/ssl/certs/ca-certificates.crt",
        "CA_BUNDLE",
        errors,
    )
    _expect(
        probe.get("request_checksum_calculation"),
        "when_required",
        "REQUEST_CHECKSUM_MODE",
        errors,
    )
    _expect(
        probe.get("response_checksum_validation"),
        "when_required",
        "RESPONSE_CHECKSUM_MODE",
        errors,
    )

    result = _mapping(authority.get("result"))
    _expect(
        result.get("verified_status"),
        "VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY",
        "VERIFIED_STATUS",
        errors,
    )
    _expect(result.get("failed_status"), "FAILED_CLOSED", "FAILED_STATUS", errors)
    _expect(
        result.get("bundle_upload_status"),
        "NOT_RUN",
        "BUNDLE_UPLOAD_STATUS",
        errors,
    )
    _expect(
        result.get("bundle_restore_status"),
        "NOT_RUN",
        "BUNDLE_RESTORE_STATUS",
        errors,
    )
    _expect(
        result.get("benchmark_status"), "NOT_RUN", "BENCHMARK_STATUS", errors
    )
    _expect(
        result.get("model_admission_status"),
        "NOT_DONE",
        "ADMISSION_STATUS",
        errors,
    )
    _expect(
        result.get("production_operational_status"),
        "NOT_ATTESTED",
        "PRODUCTION_STATUS",
        errors,
    )
    _raise_errors(errors)


def validate_panel_policy(
    authority: dict[str, object], policy: dict[str, object]
) -> str:
    """Verify exact REG.RU panel rule semantics without inferring principal identities."""

    validate_authority(authority)
    errors: list[str] = []
    statements_value = policy.get("Statement")
    if isinstance(statements_value, dict):
        statements: list[object] = [statements_value]
    elif isinstance(statements_value, list):
        statements = statements_value
    else:
        raise ContractError("POLICY_STATEMENT_INVALID")

    target_statements: list[dict[str, Any]] = []
    for index, raw_statement in enumerate(statements):
        statement = _mapping(raw_statement)
        if not statement:
            errors.append(f"POLICY_STATEMENT_NOT_OBJECT:{index}")
            continue
        if any(
            key in statement for key in ("NotAction", "NotResource", "NotPrincipal")
        ):
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
        principal = statement.get("Principal")
        if effect == "Allow" and _principal_is_global(principal):
            errors.append("PUBLIC_ALLOW_ON_TARGET")
        target_statements.append(
            {
                "effect": effect,
                "actions": actions,
                "resources": resources,
                "condition": _normalise_condition(statement.get("Condition")),
                "principal_global": _principal_is_global(principal),
            }
        )

    matched_indexes: set[int] = set()
    for expected in EXPECTED_RULES:
        signature = {
            "effect": expected["effect"],
            "actions": sorted(_string_list(expected["actions"])),
            "resources": sorted(_string_list(expected["resources"])),
            "condition": _normalise_condition(expected["condition"]),
            "principal_global": False,
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

    for index, statement in enumerate(target_statements):
        if index in matched_indexes:
            continue
        if statement.get("effect") == "Allow":
            errors.append("UNEXPECTED_ALLOW_ON_TARGET")

    _raise_errors(errors)
    return hashlib.sha256(canonical_json(policy).encode()).hexdigest()


def evaluate_compatibility(
    authority: dict[str, object], observed: dict[str, object]
) -> dict[str, object]:
    validate_authority(authority)
    errors: list[str] = []
    _expect(observed.get("schema_version"), OBSERVED_SCHEMA, "OBSERVED_SCHEMA", errors)
    if _mapping(observed.get("target")) != TARGET:
        errors.append("OBSERVED_TARGET_DRIFT")
    if _contains_credential_material(observed):
        errors.append("CREDENTIAL_MATERIAL_IN_OBSERVED")

    commands = _mapping(observed.get("commands"))
    required_commands = (
        "admin_bucket_controls_read",
        "admin_policy_read",
        "policy_exact",
        "finalizer_bucket_metadata_allowed",
        "finalizer_prefix_listing_allowed",
        "finalizer_multipart_listing_allowed",
        "control_bucket_metadata_denied",
        "control_prefix_listing_denied",
        "control_object_put_denied",
    )
    for name in required_commands:
        if commands.get(name) is not True:
            errors.append(f"COMMAND_FAILED:{name}")

    configuration = _mapping(observed.get("configuration"))
    _expect(
        configuration.get("versioning_status"),
        "Enabled",
        "VERSIONING_NOT_ENABLED",
        errors,
    )
    _expect(
        configuration.get("object_lock_status"),
        "Enabled",
        "OBJECT_LOCK_NOT_ENABLED",
        errors,
    )
    _expect(
        configuration.get("retention_mode"),
        "COMPLIANCE",
        "RETENTION_MODE_INVALID",
        errors,
    )
    _expect(
        configuration.get("retention_days"), 90, "RETENTION_DAYS_INVALID", errors
    )

    principal = _mapping(observed.get("principal"))
    for field in (
        "finalizer_allowed",
        "control_denied",
        "control_has_no_policy_rules",
    ):
        if principal.get(field) is not True:
            errors.append(f"PRINCIPAL_PROOF_FAILED:{field}")

    denials = _mapping(observed.get("privilege_denials"))
    for field in (
        "finalizer_delete_denied",
        "finalizer_delete_version_denied",
        "finalizer_get_bucket_policy_denied",
        "finalizer_put_bucket_policy_denied",
        "finalizer_put_bucket_versioning_denied",
        "finalizer_put_object_lock_denied",
        "finalizer_put_object_retention_denied",
        "finalizer_get_object_retention_denied",
        "finalizer_put_lifecycle_denied_or_not_applicable",
        "admin_locked_version_delete_denied",
    ):
        if denials.get(field) is not True:
            errors.append(f"PRIVILEGE_DENIAL_UNPROVEN:{field}")

    privacy = _mapping(observed.get("privacy"))
    denied_statuses = {401, 403}
    for field in (
        "anonymous_list_http_status",
        "anonymous_known_object_http_status",
        "anonymous_insecure_known_object_http_status",
    ):
        if _integer(privacy.get(field)) not in denied_statuses:
            errors.append(f"ANONYMOUS_ACCESS_NOT_DENIED:{field}")

    multipart = _mapping(observed.get("multipart"))
    for field in (
        "create_succeeded",
        "listed",
        "part_uploaded",
        "parts_listed",
        "abort_succeeded",
        "absent_after_abort",
    ):
        if multipart.get(field) is not True:
            errors.append(f"MULTIPART_PROOF_FAILED:{field}")

    stream = _mapping(observed.get("stream"))
    for field in (
        "upload_succeeded",
        "version_id_present",
        "retention_present",
        "exact_version_restore_succeeded",
        "sha256_match",
        "known_object_still_current",
    ):
        if stream.get(field) is not True:
            errors.append(f"STREAM_PROOF_FAILED:{field}")
    _expect(
        stream.get("size_bytes"), STREAM_OBJECT_BYTES, "STREAM_SIZE_INVALID", errors
    )
    _expect(
        stream.get("retention_mode"),
        "COMPLIANCE",
        "STREAM_RETENTION_MODE",
        errors,
    )
    if stream.get("retention_deadline_90d") is not True:
        errors.append("STREAM_RETENTION_DEADLINE_UNPROVEN")
    source_digest = _text(stream.get("source_sha256"))
    restored_digest = _text(stream.get("restored_sha256"))
    if not _SHA256_RE.fullmatch(source_digest) or source_digest != restored_digest:
        errors.append("STREAM_RESTORE_SHA256_INVALID")

    bounds = _mapping(observed.get("bounds"))
    _expect(
        bounds.get("retained_locked_bytes"),
        STREAM_OBJECT_BYTES,
        "RETAINED_LOCKED_BYTES_INVALID",
        errors,
    )
    if bounds.get("aborted_multipart_retained_bytes") != 0:
        errors.append("ABORTED_MULTIPART_BYTES_RETAINED")
    if bounds.get("credentials_in_output") is not False:
        errors.append("CREDENTIAL_OUTPUT_SCAN_FAILED")
    if bounds.get("raw_policy_retained") is not False:
        errors.append("RAW_POLICY_RETAINED")

    policy = _mapping(observed.get("policy"))
    policy_sha256 = _text(policy.get("sha256"))
    if not _SHA256_RE.fullmatch(policy_sha256):
        errors.append("POLICY_SHA256_INVALID")

    unique_errors = sorted(set(errors))
    report: dict[str, object] = {
        "schema_version": REPORT_SCHEMA,
        "status": (
            "VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY"
            if not unique_errors
            else "FAILED_CLOSED"
        ),
        "reasons": unique_errors,
        "exact_base": EXACT_BASE,
        "provider_profile": PROFILE,
        "profile_state": "CANDIDATE_NOT_ACTIVE",
        "target": {
            "endpoint_host": urlsplit(str(TARGET["endpoint"])).hostname,
            "region": TARGET["region"],
            "bucket": TARGET["bucket"],
            "prefix": TARGET["prefix"],
            "operator_confirmed_capacity_bytes": TARGET[
                "operator_confirmed_capacity_bytes"
            ],
        },
        "key_sets": {
            "admin": KEY_SETS["admin"],
            "finalizer": KEY_SETS["finalizer"],
            "control": KEY_SETS["control"],
        },
        "authority_sha256": authority_sha256(authority),
        "policy_sha256": policy_sha256,
        "controls": {
            "versioning_status": configuration.get("versioning_status"),
            "object_lock_status": configuration.get("object_lock_status"),
            "retention_mode": configuration.get("retention_mode"),
            "retention_days": configuration.get("retention_days"),
            "anonymous_list_http_status": privacy.get("anonymous_list_http_status"),
            "anonymous_known_object_http_status": privacy.get(
                "anonymous_known_object_http_status"
            ),
            "anonymous_insecure_known_object_http_status": privacy.get(
                "anonymous_insecure_known_object_http_status"
            ),
            "finalizer_allowed": principal.get("finalizer_allowed"),
            "control_denied": principal.get("control_denied"),
            "multipart_compatibility": multipart.get("absent_after_abort"),
            "exact_version_restore_sha256_match": stream.get("sha256_match"),
            "locked_version_delete_denied": denials.get(
                "admin_locked_version_delete_denied"
            ),
        },
        "retained_locked_bytes": bounds.get("retained_locked_bytes"),
        "github_secret_registration_allowed": False,
        "finalization_allowed": False,
        "bundle_upload_status": "NOT_RUN",
        "bundle_restore_status": "NOT_RUN",
        "benchmark_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }
    report["report_sha256"] = hashlib.sha256(
        canonical_json(report).encode()
    ).hexdigest()
    if len((canonical_json(report) + "\n").encode()) > MAXIMUM_REPORT_BYTES:
        raise ContractError("SANITIZED_REPORT_TOO_LARGE")
    return report


def ensure_private_output(path: Path, *, reserved: bool = False) -> int:
    """Create or reopen a private output without following links."""

    if not path.is_absolute():
        raise ContractError("OUTPUT_PATH_NOT_ABSOLUTE")
    try:
        resolved_parent = path.parent.resolve(strict=True)
        parent_stat = path.parent.lstat()
    except OSError as exc:
        raise ContractError("OUTPUT_PARENT_INVALID") from exc
    if resolved_parent != path.parent or not stat.S_ISDIR(parent_stat.st_mode):
        raise ContractError("OUTPUT_PARENT_NOT_CANONICAL_DIRECTORY")
    if parent_stat.st_uid != os.geteuid():
        raise ContractError("OUTPUT_PARENT_NOT_OWNED")
    if stat.S_IMODE(parent_stat.st_mode) & 0o077:
        raise ContractError("OUTPUT_PARENT_NOT_PRIVATE")
    no_follow = getattr(os, "O_NOFOLLOW", 0)
    if reserved:
        try:
            reserved_stat = path.lstat()
        except OSError as exc:
            raise ContractError("OUTPUT_RESERVATION_MISSING") from exc
        if (
            not stat.S_ISREG(reserved_stat.st_mode)
            or reserved_stat.st_uid != os.geteuid()
            or stat.S_IMODE(reserved_stat.st_mode) != 0o600
            or reserved_stat.st_size != 0
            or reserved_stat.st_nlink != 1
        ):
            raise ContractError("OUTPUT_RESERVATION_INVALID")
        try:
            file_descriptor = os.open(path, os.O_WRONLY | no_follow)
        except OSError as exc:
            raise ContractError("OUTPUT_RESERVATION_OPEN_FAILED") from exc
        opened_stat = os.fstat(file_descriptor)
        if (
            opened_stat.st_dev != reserved_stat.st_dev
            or opened_stat.st_ino != reserved_stat.st_ino
        ):
            os.close(file_descriptor)
            raise ContractError("OUTPUT_RESERVATION_CHANGED")
        os.ftruncate(file_descriptor, 0)
        return file_descriptor
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | no_follow
    try:
        return os.open(path, flags, 0o600)
    except OSError as exc:
        raise ContractError("OUTPUT_CREATE_FAILED") from exc


def _touches_target(resources: Iterable[str]) -> bool:
    bucket_arn = "arn:aws:s3:::tai-model-bundles-prod-01"
    object_arn = bucket_arn + "/tai/model-bundles/v1/"
    for resource in resources:
        if resource == "*" or resource == bucket_arn or resource.startswith(object_arn):
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
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
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


def _contains_credential_material(value: object) -> bool:
    text = canonical_json(value)
    return bool(_ACCESS_KEY_RE.search(text) or _SECRET_KEY_RE.search(text))


def _mapping(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: object) -> str:
    return value if isinstance(value, str) else ""


def _integer(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    return value if isinstance(value, int) else None


def _integer_list(value: object) -> list[int]:
    if not isinstance(value, list):
        return []
    return [
        item for item in value if isinstance(item, int) and not isinstance(item, bool)
    ]


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _string_or_list(value: object) -> list[str]:
    if isinstance(value, str):
        return [value]
    return _string_list(value)


def _expect(actual: object, expected: object, reason: str, errors: list[str]) -> None:
    if actual != expected:
        errors.append(reason)


def _raise_errors(errors: list[str]) -> None:
    if errors:
        raise ContractError(",".join(sorted(set(errors))))
