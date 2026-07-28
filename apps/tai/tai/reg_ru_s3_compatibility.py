from __future__ import annotations

import hashlib
import json
import os
import re
import stat
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlsplit

AUTHORITY_SCHEMA = "tai.reg-ru-s3-compatibility-authority.v1"
ATTESTATION_SCHEMA = "tai.reg-ru-s3-principal-attestation.v1"
PROVIDER_EVIDENCE_SCHEMA = "tai.reg-ru-provider-principal-evidence.v1"
OBSERVED_SCHEMA = "tai.reg-ru-s3-compatibility-observed.v1"
REPORT_SCHEMA = "tai.reg-ru-s3-compatibility-report.v1"

EXACT_BASE = "8655c70900bc087875ce64e7b7f65775ee838b93"
PROFILE = "REG_RU_S3_2026"
TARGET: dict[str, object] = {
    "endpoint": "https://s3.regru.cloud",
    "region": "us-east-1",
    "bucket": "tai-model-bundles-prod-01",
    "prefix": "tai/model-bundles/v1",
    "operator_confirmed_capacity_bytes": 200000000000,
}
KEY_SET_NAME = "tai-bundle-finalizer-prod-01"
CONFIRMATION = (
    "I AUTHORIZE REG.RU S3 COMPATIBILITY PROBE "
    "tai-model-bundles-prod-01/tai/model-bundles/v1 MAX_LOCKED_BYTES=9441280"
)
WORM_CANARY_BYTES = 4096
STREAM_OBJECT_BYTES = 9 * 1024 * 1024
MULTIPART_PART_BYTES = 5 * 1024 * 1024
MAXIMUM_RETAINED_LOCKED_BYTES = WORM_CANARY_BYTES + STREAM_OBJECT_BYTES
MAXIMUM_REPORT_BYTES = 1024 * 1024

BUCKET_ACTIONS = (
    "s3:GetBucketLocation",
    "s3:GetBucketObjectLockConfiguration",
    "s3:GetBucketPolicy",
    "s3:GetBucketVersioning",
    "s3:ListBucket",
    "s3:ListBucketMultipartUploads",
    "s3:ListBucketVersions",
)
OBJECT_ACTIONS = (
    "s3:AbortMultipartUpload",
    "s3:GetObject",
    "s3:GetObjectRetention",
    "s3:GetObjectVersion",
    "s3:ListMultipartUploadParts",
    "s3:PutObject",
)
FORBIDDEN_ACTIONS = (
    "s3:BypassGovernanceRetention",
    "s3:DeleteObject",
    "s3:DeleteObjectVersion",
    "s3:PutLifecycleConfiguration",
    "s3:PutBucketObjectLockConfiguration",
    "s3:PutBucketPolicy",
    "s3:PutBucketVersioning",
    "s3:PutObjectRetention",
)
DELETE_ACTIONS = ("s3:DeleteObject", "s3:DeleteObjectVersion")
PROBE_SIDS = frozenset(
    {
        "TaiRegRuCanaryDenyFinalizerGetObject",
        "TaiRegRuAllowFinalizerBucket",
        "TaiRegRuAllowFinalizerObject",
        "TaiRegRuDenyBundleDeletion",
        "TaiRegRuDenyInsecureTransport",
    }
)
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
_ACCESS_KEY_RE = re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")
_SECRET_KEY_RE = re.compile(r"(?i)\b(secret.?access.?key|aws_secret_access_key)\b")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$")


class ContractError(ValueError):
    """Raised when committed or local compatibility authority fails closed."""


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
            path.read_text(encoding="utf-8"),
            object_pairs_hook=reject_duplicates,
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ContractError(f"JSON_UNREADABLE:{path}") from exc
    if not isinstance(payload, dict):
        raise ContractError(f"JSON_ROOT_NOT_OBJECT:{path}")
    return payload


def validate_authority(authority: dict[str, object]) -> None:
    errors: list[str] = []
    _expect(authority.get("schema_version"), AUTHORITY_SCHEMA, "AUTHORITY_SCHEMA", errors)
    _expect(authority.get("exact_base"), EXACT_BASE, "EXACT_BASE", errors)
    _expect(authority.get("provider_profile"), PROFILE, "PROVIDER_PROFILE", errors)
    _expect(authority.get("profile_state"), "CANDIDATE_NOT_ACTIVE", "PROFILE_STATE", errors)
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
    if _mapping(authority.get("target")) != TARGET:
        errors.append("TARGET_DRIFT")

    controls = _mapping(authority.get("required_bucket_controls"))
    _expect(controls.get("versioning_status"), "Enabled", "VERSIONING_REQUIREMENT", errors)
    _expect(controls.get("object_lock_status"), "Enabled", "OBJECT_LOCK_REQUIREMENT", errors)
    if _mapping(controls.get("default_retention")) != {
        "mode": "COMPLIANCE",
        "days": 90,
    }:
        errors.append("RETENTION_REQUIREMENT_DRIFT")
    if _integer_list(controls.get("anonymous_denied_http_statuses")) != [401, 403]:
        errors.append("ANONYMOUS_STATUS_REQUIREMENT_DRIFT")
    if controls.get("unsupported_s3_apis") != []:
        errors.append("CANDIDATE_WAIVERS_NOT_EMPTY")

    principal = _mapping(authority.get("principal"))
    _expect(principal.get("status"), "UNRESOLVED", "PRINCIPAL_STATUS", errors)
    _expect(principal.get("key_set_name"), KEY_SET_NAME, "KEY_SET_NAME", errors)
    if principal.get("provider_issued_attestation_required") is not True:
        errors.append("PROVIDER_ATTESTATION_NOT_REQUIRED")
    if _string_list(principal.get("allowed_selector_keys")) != ["AWS", "CanonicalUser"]:
        errors.append("SELECTOR_KEY_CONTRACT_DRIFT")
    if tuple(_string_list(principal.get("allow_bucket_actions"))) != BUCKET_ACTIONS:
        errors.append("BUCKET_ACTION_SET_DRIFT")
    if tuple(_string_list(principal.get("allow_object_actions"))) != OBJECT_ACTIONS:
        errors.append("OBJECT_ACTION_SET_DRIFT")
    if tuple(_string_list(principal.get("forbidden_actions"))) != FORBIDDEN_ACTIONS:
        errors.append("FORBIDDEN_ACTION_SET_DRIFT")

    policy = _mapping(authority.get("policy"))
    bucket = str(TARGET["bucket"])
    prefix = str(TARGET["prefix"])
    _expect(
        policy.get("bucket_resource"),
        f"arn:aws:s3:::{bucket}",
        "BUCKET_RESOURCE",
        errors,
    )
    _expect(
        policy.get("governed_resource"),
        f"arn:aws:s3:::{bucket}/{prefix}/*",
        "GOVERNED_RESOURCE",
        errors,
    )
    if tuple(_string_list(policy.get("global_delete_deny_actions"))) != DELETE_ACTIONS:
        errors.append("DELETE_DENY_ACTION_SET_DRIFT")
    if policy.get("secure_transport_required") is not True:
        errors.append("SECURE_TRANSPORT_NOT_REQUIRED")
    if policy.get("preserve_unrelated_statements") is not True:
        errors.append("UNRELATED_POLICY_STATEMENTS_NOT_PRESERVED")

    probe = _mapping(authority.get("probe"))
    _expect(probe.get("interactive_confirmation"), CONFIRMATION, "CONFIRMATION", errors)
    _expect(probe.get("worm_canary_bytes"), WORM_CANARY_BYTES, "WORM_SIZE", errors)
    _expect(probe.get("stream_object_bytes"), STREAM_OBJECT_BYTES, "STREAM_SIZE", errors)
    _expect(
        probe.get("multipart_part_bytes"),
        MULTIPART_PART_BYTES,
        "MULTIPART_PART_SIZE",
        errors,
    )
    _expect(
        probe.get("maximum_retained_locked_bytes"),
        MAXIMUM_RETAINED_LOCKED_BYTES,
        "LOCKED_BYTE_BOUND",
        errors,
    )
    _expect(
        probe.get("maximum_sanitized_report_bytes"),
        MAXIMUM_REPORT_BYTES,
        "REPORT_BYTE_BOUND",
        errors,
    )
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
    if probe.get("restore_previous_policy_on_failure") is not True:
        errors.append("POLICY_ROLLBACK_NOT_REQUIRED")
    if probe.get("delete_locked_versions") is not False:
        errors.append("LOCKED_VERSION_DELETE_ALLOWED")

    result = _mapping(authority.get("result"))
    _expect(
        result.get("verified_status"),
        "VERIFIED_REG_RU_S3_COMPATIBILITY",
        "VERIFIED_STATUS",
        errors,
    )
    _expect(result.get("failed_status"), "FAILED_CLOSED", "FAILED_STATUS", errors)
    _expect(result.get("bundle_upload_status"), "NOT_RUN", "BUNDLE_UPLOAD_STATUS", errors)
    _expect(result.get("bundle_restore_status"), "NOT_RUN", "BUNDLE_RESTORE_STATUS", errors)
    _expect(result.get("benchmark_status"), "NOT_RUN", "BENCHMARK_STATUS", errors)
    _expect(result.get("model_admission_status"), "NOT_DONE", "ADMISSION_STATUS", errors)
    _expect(
        result.get("production_operational_status"),
        "NOT_ATTESTED",
        "PRODUCTION_STATUS",
        errors,
    )
    _raise_errors(errors)


def validate_attestation(
    authority: dict[str, object],
    attestation: dict[str, object],
    *,
    attestation_path: Path,
) -> dict[str, str]:
    """Validate local provider evidence and return only non-secret hashes."""

    validate_authority(authority)
    errors: list[str] = []
    _validate_private_local_file(attestation_path, "ATTESTATION", errors)
    _expect(attestation.get("schema_version"), ATTESTATION_SCHEMA, "ATTESTATION_SCHEMA", errors)
    _expect(attestation.get("status"), "PROVIDER_ISSUED", "ATTESTATION_STATUS", errors)
    _expect(attestation.get("provider"), "REG.RU", "ATTESTATION_PROVIDER", errors)
    _expect(
        attestation.get("issuer"),
        "REG.RU_SUPPORT_OR_API",
        "ATTESTATION_ISSUER",
        errors,
    )
    issued_at = _text(attestation.get("issued_at"))
    if not _DATE_RE.fullmatch(issued_at):
        errors.append("ATTESTATION_ISSUED_AT_INVALID")
    if len(_text(attestation.get("issuer_reference"))) < 8:
        errors.append("ATTESTATION_ISSUER_REFERENCE_INVALID")
    if _mapping(attestation.get("target")) != TARGET:
        errors.append("ATTESTATION_TARGET_DRIFT")
    _expect(attestation.get("key_set_name"), KEY_SET_NAME, "ATTESTATION_KEY_SET", errors)
    _expect(
        attestation.get("selector_semantics"),
        "REG_RU_PROVIDER_ISSUED_POLICY_PRINCIPAL",
        "SELECTOR_SEMANTICS",
        errors,
    )
    selector = _mapping(attestation.get("principal_selector"))
    _validate_selector(selector, errors)
    control_selector = _mapping(attestation.get("nonmatching_control_selector"))
    _validate_selector(control_selector, errors)
    if control_selector == selector:
        errors.append("NONMATCHING_CONTROL_SELECTOR_MATCHES_FINALIZER")

    permissions = _mapping(attestation.get("attested_permissions"))
    _expect(
        permissions.get("scope"),
        "EXACT_BUCKET_AND_PREFIX",
        "ATTESTED_PERMISSION_SCOPE",
        errors,
    )
    if tuple(_string_list(permissions.get("allow_bucket_actions"))) != BUCKET_ACTIONS:
        errors.append("ATTESTED_BUCKET_ACTIONS_INVALID")
    if tuple(_string_list(permissions.get("allow_object_actions"))) != OBJECT_ACTIONS:
        errors.append("ATTESTED_OBJECT_ACTIONS_INVALID")
    if tuple(_string_list(permissions.get("forbidden_actions"))) != FORBIDDEN_ACTIONS:
        errors.append("ATTESTED_FORBIDDEN_ACTIONS_INVALID")

    evidence_ref = _mapping(attestation.get("provider_evidence"))
    evidence_path_text = _text(evidence_ref.get("path"))
    evidence_digest = _text(evidence_ref.get("sha256"))
    evidence_path = Path(evidence_path_text)
    if not evidence_path.is_absolute():
        errors.append("PROVIDER_EVIDENCE_PATH_NOT_ABSOLUTE")
    _validate_private_local_file(evidence_path, "PROVIDER_EVIDENCE", errors)
    evidence: dict[str, object] = {}
    if not errors or evidence_path.is_file():
        try:
            evidence_bytes = evidence_path.read_bytes()
        except OSError:
            evidence_bytes = b""
        if len(evidence_bytes) > MAXIMUM_REPORT_BYTES:
            errors.append("PROVIDER_EVIDENCE_TOO_LARGE")
        computed_digest = hashlib.sha256(evidence_bytes).hexdigest()
        if not _SHA256_RE.fullmatch(evidence_digest) or computed_digest != evidence_digest:
            errors.append("PROVIDER_EVIDENCE_SHA256_MISMATCH")
        try:
            evidence = load_json(evidence_path)
        except ContractError as exc:
            errors.append(str(exc))
    _validate_provider_evidence(evidence, attestation, errors)

    if _contains_credential_material(attestation) or _contains_credential_material(evidence):
        errors.append("CREDENTIAL_MATERIAL_IN_ATTESTATION")
    _raise_errors(errors)
    return {
        "attestation_sha256": hashlib.sha256(attestation_path.read_bytes()).hexdigest(),
        "provider_evidence_sha256": evidence_digest,
        "principal_selector_sha256": hashlib.sha256(
            _canonical_json(selector).encode()
        ).hexdigest(),
        "nonmatching_control_selector_sha256": hashlib.sha256(
            _canonical_json(control_selector).encode()
        ).hexdigest(),
    }


def build_bucket_policy(
    authority: dict[str, object],
    attestation: dict[str, object],
    existing_policy: dict[str, object] | None,
    *,
    mode: Literal["canary", "final"],
    canary_object_key: str | None = None,
    use_nonmatching_selector: bool = False,
) -> dict[str, object]:
    """Preserve unrelated statements and add only the exact probe statements."""

    validate_authority(authority)
    selector = _mapping(attestation.get("principal_selector"))
    control_selector = _mapping(attestation.get("nonmatching_control_selector"))
    errors: list[str] = []
    _validate_selector(selector, errors)
    _raise_errors(errors)

    statements: list[object] = []
    if existing_policy is not None:
        if existing_policy.get("Version") != "2012-10-17":
            raise ContractError("EXISTING_POLICY_VERSION_INVALID")
        raw_statements = existing_policy.get("Statement")
        if isinstance(raw_statements, dict):
            statements = [raw_statements]
        elif isinstance(raw_statements, list):
            statements = list(raw_statements)
        else:
            raise ContractError("EXISTING_POLICY_STATEMENTS_INVALID")
    preserved = [
        item
        for item in statements
        if _text(_mapping(item).get("Sid")) not in PROBE_SIDS
    ]
    bucket = str(TARGET["bucket"])
    prefix = str(TARGET["prefix"])
    bucket_arn = f"arn:aws:s3:::{bucket}"
    object_arn = f"{bucket_arn}/{prefix}/*"
    if mode == "canary":
        if (
            canary_object_key is None
            or not canary_object_key.startswith(f"{prefix}/")
            or ".." in canary_object_key
        ):
            raise ContractError("CANARY_OBJECT_KEY_INVALID")
        canary_selector = control_selector if use_nonmatching_selector else selector
        additions: list[dict[str, object]] = [
            {
                "Sid": "TaiRegRuCanaryDenyFinalizerGetObject",
                "Effect": "Deny",
                "Principal": canary_selector,
                "Action": "s3:GetObject",
                "Resource": f"{bucket_arn}/{canary_object_key}",
            }
        ]
    else:
        additions = [
            {
                "Sid": "TaiRegRuAllowFinalizerBucket",
                "Effect": "Allow",
                "Principal": selector,
                "Action": list(BUCKET_ACTIONS),
                "Resource": bucket_arn,
            },
            {
                "Sid": "TaiRegRuAllowFinalizerObject",
                "Effect": "Allow",
                "Principal": selector,
                "Action": list(OBJECT_ACTIONS),
                "Resource": object_arn,
            },
            {
                "Sid": "TaiRegRuDenyBundleDeletion",
                "Effect": "Deny",
                "Principal": "*",
                "Action": list(DELETE_ACTIONS),
                "Resource": object_arn,
            },
            {
                "Sid": "TaiRegRuDenyInsecureTransport",
                "Effect": "Deny",
                "Principal": "*",
                "Action": "s3:*",
                "Resource": [bucket_arn, f"{bucket_arn}/*"],
                "Condition": {"Bool": {"aws:SecureTransport": "false"}},
            },
        ]
    policy: dict[str, object] = {
        "Version": "2012-10-17",
        "Statement": [*preserved, *additions],
    }
    if mode == "final":
        validate_final_policy(authority, attestation, policy)
    return policy


def validate_final_policy(
    authority: dict[str, object],
    attestation: dict[str, object],
    policy: dict[str, object],
) -> None:
    validate_authority(authority)
    selector = _mapping(attestation.get("principal_selector"))
    bucket = str(TARGET["bucket"])
    prefix = str(TARGET["prefix"])
    bucket_arn = f"arn:aws:s3:::{bucket}"
    object_arn = f"{bucket_arn}/{prefix}/*"
    expected_by_sid: dict[str, dict[str, object]] = {
        "TaiRegRuAllowFinalizerBucket": {
            "Sid": "TaiRegRuAllowFinalizerBucket",
            "Effect": "Allow",
            "Principal": selector,
            "Action": list(BUCKET_ACTIONS),
            "Resource": bucket_arn,
        },
        "TaiRegRuAllowFinalizerObject": {
            "Sid": "TaiRegRuAllowFinalizerObject",
            "Effect": "Allow",
            "Principal": selector,
            "Action": list(OBJECT_ACTIONS),
            "Resource": object_arn,
        },
        "TaiRegRuDenyBundleDeletion": {
            "Sid": "TaiRegRuDenyBundleDeletion",
            "Effect": "Deny",
            "Principal": "*",
            "Action": list(DELETE_ACTIONS),
            "Resource": object_arn,
        },
        "TaiRegRuDenyInsecureTransport": {
            "Sid": "TaiRegRuDenyInsecureTransport",
            "Effect": "Deny",
            "Principal": "*",
            "Action": "s3:*",
            "Resource": [bucket_arn, f"{bucket_arn}/*"],
            "Condition": {"Bool": {"aws:SecureTransport": "false"}},
        },
    }
    errors: list[str] = []
    if policy.get("Version") != "2012-10-17":
        errors.append("POLICY_VERSION_INVALID")
    statements = _statement_list(policy.get("Statement"))
    by_sid = {_text(item.get("Sid")): item for item in statements}
    for sid, expected_statement in expected_by_sid.items():
        if by_sid.get(sid) != expected_statement:
            errors.append(f"POLICY_STATEMENT_INVALID:{sid}")
    for statement in statements:
        if statement.get("Effect") != "Allow":
            continue
        sid = _text(statement.get("Sid"))
        if sid in expected_by_sid and statement == expected_by_sid[sid]:
            continue
        if any(key in statement for key in ("NotAction", "NotPrincipal", "NotResource")):
            errors.append("UNANALYZABLE_ALLOW_STATEMENT")
            continue
        principal = statement.get("Principal")
        actions = set(_string_or_list(statement.get("Action")))
        resources = set(_string_or_list(statement.get("Resource")))
        target_samples = (
            bucket_arn,
            f"{bucket_arn}/{prefix}/compatibility-probes/probe/stream.bin",
            f"{bucket_arn}/{prefix}/models/model.gguf",
        )
        touches_target = any(
            resource == "*"
            or resource.startswith(bucket_arn)
            or any(fnmatchcase(sample, resource) for sample in target_samples)
            for resource in resources
        )
        if not touches_target:
            continue
        if _principal_is_global(principal):
            errors.append("PUBLIC_ALLOW_ON_TARGET")
        else:
            errors.append("UNEXPECTED_ALLOW_ON_TARGET")
        if principal == selector:
            if any(
                resource == "*"
                or resource == bucket_arn
                or fnmatchcase(bucket_arn, resource)
                for resource in resources
            ):
                unexpected_bucket = actions - set(BUCKET_ACTIONS)
                if "s3:*" in actions or unexpected_bucket:
                    errors.append("FINALIZER_BROAD_BUCKET_ALLOW")
            if touches_target:
                unexpected_object = actions - set(OBJECT_ACTIONS)
                if "s3:*" in actions or unexpected_object:
                    errors.append("FINALIZER_BROAD_OBJECT_ALLOW")
    _raise_errors(errors)


def evaluate_compatibility(
    authority: dict[str, object],
    attestation: dict[str, object],
    observed: dict[str, object],
    *,
    attestation_hashes: dict[str, str],
) -> dict[str, object]:
    """Evaluate sanitized observations; never copy principal or raw command output."""

    validate_authority(authority)
    errors: list[str] = []
    _expect(observed.get("schema_version"), OBSERVED_SCHEMA, "OBSERVED_SCHEMA", errors)
    if _mapping(observed.get("target")) != TARGET:
        errors.append("OBSERVED_TARGET_DRIFT")
    if _contains_credential_material(observed):
        errors.append("CREDENTIAL_MATERIAL_IN_OBSERVED")

    commands = _mapping(observed.get("commands"))
    for name in (
        "head_bucket",
        "get_bucket_versioning",
        "get_object_lock_configuration",
        "get_bucket_policy",
        "put_canary_policy",
        "restore_after_canary",
        "put_final_policy",
        "get_final_policy",
    ):
        if commands.get(name) is not True:
            errors.append(f"COMMAND_FAILED:{name}")

    configuration = _mapping(observed.get("configuration"))
    _expect(configuration.get("versioning_status"), "Enabled", "VERSIONING_NOT_ENABLED", errors)
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
    _expect(configuration.get("retention_days"), 90, "RETENTION_DAYS_INVALID", errors)

    principal = _mapping(observed.get("principal"))
    if principal.get("finalizer_canary_denied") is not True:
        errors.append("PRINCIPAL_SELECTOR_DID_NOT_MATCH_FINALIZER")
    if principal.get("admin_canary_allowed") is not True:
        errors.append("PRINCIPAL_SELECTOR_MATCHED_ADMIN_OR_ADMIN_FAILED")
    if principal.get("policy_restored_after_canary") is not True:
        errors.append("CANARY_POLICY_NOT_RESTORED")
    if (
        _text(principal.get("principal_selector_sha256"))
        != attestation_hashes["principal_selector_sha256"]
    ):
        errors.append("PRINCIPAL_SELECTOR_DIGEST_MISMATCH")

    policy = _mapping(observed.get("policy"))
    document = _mapping(policy.get("document"))
    try:
        validate_final_policy(authority, attestation, document)
    except ContractError as exc:
        errors.extend(str(exc).split(","))
    expected_policy_digest = hashlib.sha256(_canonical_json(document).encode()).hexdigest()
    if _text(policy.get("sha256")) != expected_policy_digest:
        errors.append("POLICY_SHA256_MISMATCH")
    if policy.get("installed") is not True:
        errors.append("FINAL_POLICY_NOT_INSTALLED")

    privilege_denials = _mapping(observed.get("privilege_denials"))
    for field in (
        "same_policy_put_denied",
        "same_versioning_put_denied",
        "same_object_lock_put_denied",
        "same_object_retention_put_denied",
        "lifecycle_mutation_provider_attested",
    ):
        if privilege_denials.get(field) is not True:
            errors.append(f"FINALIZER_PRIVILEGE_DENIAL_UNPROVEN:{field}")
    lifecycle_behavior = privilege_denials.get("same_lifecycle_put_denied")
    if lifecycle_behavior not in {True, "NOT_APPLICABLE_NO_EXISTING_CONFIGURATION"}:
        errors.append("FINALIZER_LIFECYCLE_BEHAVIOR_INVALID")

    worm = _mapping(observed.get("worm"))
    for field in (
        "put_succeeded",
        "version_id_present",
        "versionless_delete_succeeded",
        "exact_version_delete_denied",
        "delete_marker_removed",
        "locked_version_still_readable",
    ):
        if worm.get(field) is not True:
            errors.append(f"WORM_PROOF_FAILED:{field}")
    _expect(worm.get("retention_mode"), "COMPLIANCE", "WORM_RETENTION_MODE", errors)
    if worm.get("retention_deadline_90d") is not True:
        errors.append("WORM_RETENTION_DEADLINE_UNPROVEN")

    privacy = _mapping(observed.get("privacy"))
    denied_statuses = {401, 403}
    if _integer(privacy.get("anonymous_list_http_status")) not in denied_statuses:
        errors.append("ANONYMOUS_LIST_NOT_DENIED")
    if _integer(privacy.get("anonymous_known_object_http_status")) not in denied_statuses:
        errors.append("ANONYMOUS_KNOWN_OBJECT_GET_NOT_DENIED")
    if (
        _integer(privacy.get("anonymous_insecure_known_object_http_status"))
        not in denied_statuses
    ):
        errors.append("ANONYMOUS_INSECURE_GET_NOT_DENIED")

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
        "versionless_delete_denied",
        "known_object_still_current",
    ):
        if stream.get(field) is not True:
            errors.append(f"STREAM_PROOF_FAILED:{field}")
    _expect(stream.get("size_bytes"), STREAM_OBJECT_BYTES, "STREAM_SIZE_INVALID", errors)
    _expect(stream.get("retention_mode"), "COMPLIANCE", "STREAM_RETENTION_MODE", errors)
    if stream.get("retention_deadline_90d") is not True:
        errors.append("STREAM_RETENTION_DEADLINE_UNPROVEN")
    source_digest = _text(stream.get("source_sha256"))
    restored_digest = _text(stream.get("restored_sha256"))
    if (
        not _SHA256_RE.fullmatch(source_digest)
        or source_digest != restored_digest
        or stream.get("sha256_match") is not True
    ):
        errors.append("STREAM_RESTORE_SHA256_INVALID")

    bounds = _mapping(observed.get("bounds"))
    _expect(
        bounds.get("retained_locked_bytes"),
        MAXIMUM_RETAINED_LOCKED_BYTES,
        "RETAINED_LOCKED_BYTES_INVALID",
        errors,
    )
    if bounds.get("aborted_multipart_retained_bytes") != 0:
        errors.append("ABORTED_MULTIPART_BYTES_RETAINED")
    if bounds.get("credentials_in_output") is not False:
        errors.append("CREDENTIAL_OUTPUT_SCAN_FAILED")
    if bounds.get("raw_evidence_retained") is not False:
        errors.append("RAW_EVIDENCE_RETAINED")

    unique_errors = sorted(set(errors))
    report: dict[str, object] = {
        "schema_version": REPORT_SCHEMA,
        "status": (
            "VERIFIED_REG_RU_S3_COMPATIBILITY" if not unique_errors else "FAILED_CLOSED"
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
        "attestation_sha256": attestation_hashes["attestation_sha256"],
        "provider_evidence_sha256": attestation_hashes["provider_evidence_sha256"],
        "principal_selector_sha256": attestation_hashes["principal_selector_sha256"],
        "policy_sha256": expected_policy_digest,
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
            "worm_retention_deadline_90d": worm.get("retention_deadline_90d"),
            "stream_retention_deadline_90d": stream.get("retention_deadline_90d"),
            "worm_exact_version_delete_denied": worm.get(
                "exact_version_delete_denied"
            ),
            "governed_versionless_delete_denied": stream.get(
                "versionless_delete_denied"
            ),
            "multipart_compatibility": multipart.get("absent_after_abort"),
            "exact_version_restore_sha256_match": stream.get("sha256_match"),
            "finalizer_policy_mutation_denied": privilege_denials.get(
                "same_policy_put_denied"
            ),
            "finalizer_versioning_mutation_denied": privilege_denials.get(
                "same_versioning_put_denied"
            ),
            "finalizer_object_lock_mutation_denied": privilege_denials.get(
                "same_object_lock_put_denied"
            ),
            "finalizer_object_retention_mutation_denied": privilege_denials.get(
                "same_object_retention_put_denied"
            ),
            "finalizer_lifecycle_mutation_denial": lifecycle_behavior,
            "finalizer_lifecycle_mutation_provider_attested": privilege_denials.get(
                "lifecycle_mutation_provider_attested"
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
    report["report_sha256"] = hashlib.sha256(_canonical_json(report).encode()).hexdigest()
    if len((_canonical_json(report) + "\n").encode()) > MAXIMUM_REPORT_BYTES:
        raise ContractError("SANITIZED_REPORT_TOO_LARGE")
    return report


def canonical_json(value: object) -> str:
    return _canonical_json(value)


def _validate_provider_evidence(
    evidence: dict[str, object],
    attestation: dict[str, object],
    errors: list[str],
) -> None:
    _expect(
        evidence.get("schema_version"),
        PROVIDER_EVIDENCE_SCHEMA,
        "PROVIDER_EVIDENCE_SCHEMA",
        errors,
    )
    _expect(evidence.get("provider"), "REG.RU", "PROVIDER_EVIDENCE_PROVIDER", errors)
    _expect(
        evidence.get("issuer"),
        "REG.RU_SUPPORT_OR_API",
        "PROVIDER_EVIDENCE_ISSUER",
        errors,
    )
    if evidence.get("issuer_reference") != attestation.get("issuer_reference"):
        errors.append("PROVIDER_EVIDENCE_REFERENCE_MISMATCH")
    if _mapping(evidence.get("target")) != TARGET:
        errors.append("PROVIDER_EVIDENCE_TARGET_DRIFT")
    if evidence.get("key_set_name") != KEY_SET_NAME:
        errors.append("PROVIDER_EVIDENCE_KEY_SET_INVALID")
    if _mapping(evidence.get("principal_selector")) != _mapping(
        attestation.get("principal_selector")
    ):
        errors.append("PROVIDER_EVIDENCE_SELECTOR_MISMATCH")
    if _mapping(evidence.get("nonmatching_control_selector")) != _mapping(
        attestation.get("nonmatching_control_selector")
    ):
        errors.append("PROVIDER_EVIDENCE_CONTROL_SELECTOR_MISMATCH")
    if evidence.get("permission_scope") != "EXACT_BUCKET_AND_PREFIX":
        errors.append("PROVIDER_EVIDENCE_SCOPE_INVALID")
    permissions = _mapping(attestation.get("attested_permissions"))
    if _string_list(evidence.get("allow_bucket_actions")) != _string_list(
        permissions.get("allow_bucket_actions")
    ):
        errors.append("PROVIDER_EVIDENCE_BUCKET_ACTIONS_MISMATCH")
    if _string_list(evidence.get("allow_object_actions")) != _string_list(
        permissions.get("allow_object_actions")
    ):
        errors.append("PROVIDER_EVIDENCE_OBJECT_ACTIONS_MISMATCH")
    if _string_list(evidence.get("forbidden_actions")) != _string_list(
        permissions.get("forbidden_actions")
    ):
        errors.append("PROVIDER_EVIDENCE_FORBIDDEN_ACTIONS_MISMATCH")


def _validate_selector(selector: dict[str, Any], errors: list[str]) -> None:
    if len(selector) != 1:
        errors.append("PRINCIPAL_SELECTOR_SHAPE_INVALID")
        return
    key, value = next(iter(selector.items()))
    if key not in {"AWS", "CanonicalUser"} or not isinstance(value, str):
        errors.append("PRINCIPAL_SELECTOR_TYPE_INVALID")
        return
    normalized = value.strip()
    if normalized != value or len(value) < 12 or len(value) > 512:
        errors.append("PRINCIPAL_SELECTOR_VALUE_INVALID")
    lowered = value.casefold()
    if (
        value == "*"
        or lowered == "owner"
        or lowered == KEY_SET_NAME.casefold()
        or "tai-bundle-finalizer-prod-01" in lowered
        or _ACCESS_KEY_RE.fullmatch(value) is not None
    ):
        errors.append("PRINCIPAL_SELECTOR_INFERRED_OR_GLOBAL")


def _validate_private_local_file(path: Path, prefix: str, errors: list[str]) -> None:
    if not path.is_absolute():
        errors.append(f"{prefix}_PATH_NOT_ABSOLUTE")
        return
    try:
        file_stat = path.lstat()
    except OSError:
        errors.append(f"{prefix}_MISSING")
        return
    if stat.S_ISLNK(file_stat.st_mode) or not stat.S_ISREG(file_stat.st_mode):
        errors.append(f"{prefix}_NOT_PRIVATE_REGULAR_FILE")
    if stat.S_IMODE(file_stat.st_mode) & 0o077:
        errors.append(f"{prefix}_PERMISSIONS_TOO_BROAD")
    if file_stat.st_size > MAXIMUM_REPORT_BYTES:
        errors.append(f"{prefix}_TOO_LARGE")


def _contains_credential_material(value: object) -> bool:
    if isinstance(value, dict):
        for key, item in value.items():
            normalized = key.casefold().replace("-", "_")
            if normalized in {
                "access_key",
                "access_key_id",
                "aws_access_key_id",
                "secret",
                "secret_access_key",
                "aws_secret_access_key",
                "session_token",
                "password",
            }:
                return True
            if _contains_credential_material(item):
                return True
        return False
    if isinstance(value, list):
        return any(_contains_credential_material(item) for item in value)
    if isinstance(value, str):
        return bool(_ACCESS_KEY_RE.search(value) or _SECRET_KEY_RE.search(value))
    return False


def _statement_list(value: object) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        return [_mapping(value)]
    if not isinstance(value, list):
        return []
    return [_mapping(item) for item in value if isinstance(item, dict)]


def _principal_is_global(value: object) -> bool:
    if value == "*":
        return True
    principal = _mapping(value)
    aws = principal.get("AWS")
    if aws == "*":
        return True
    return isinstance(aws, list) and "*" in aws


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


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
    return [item for item in value if isinstance(item, int) and not isinstance(item, bool)]


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


def ensure_private_output(path: Path, *, reserved: bool = False) -> int:
    """Create or reopen a reserved private output without links or parent mutation."""

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
        try:
            os.ftruncate(file_descriptor, 0)
        except OSError as exc:
            os.close(file_descriptor)
            raise ContractError("OUTPUT_RESERVATION_TRUNCATE_FAILED") from exc
        return file_descriptor
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | no_follow
    try:
        return os.open(path, flags, 0o600)
    except OSError as exc:
        raise ContractError("OUTPUT_CREATE_FAILED") from exc
