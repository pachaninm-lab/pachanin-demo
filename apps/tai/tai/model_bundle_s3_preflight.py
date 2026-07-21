from __future__ import annotations

import hashlib
import ipaddress
import json
import re
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlsplit

_REQUIREMENTS_SCHEMA = "tai.model-bundle-s3-preflight-requirements.v1"
_OBSERVED_SCHEMA = "tai.model-bundle-s3-preflight-observed.v1"
_REPORT_SCHEMA = "tai.model-bundle-s3-preflight-report.v1"
_BUCKET_RE = re.compile(r"^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$")


def evaluate_s3_preflight(
    requirements: dict[str, object],
    observed: dict[str, object],
    *,
    exact_main_sha: str,
    workflow_run_id: int,
    workflow_run_attempt: int,
) -> dict[str, object]:
    reasons: list[str] = []
    _expect_schema(requirements, _REQUIREMENTS_SCHEMA, "REQUIREMENTS", reasons)
    _expect_schema(observed, _OBSERVED_SCHEMA, "OBSERVED", reasons)

    endpoint = _text(observed.get("endpoint"))
    region = _text(observed.get("region"))
    bucket = _text(observed.get("bucket"))
    prefix = _text(observed.get("prefix"))
    capacity_bytes = _integer(observed.get("operator_confirmed_capacity_bytes"))

    endpoint_host = _validate_endpoint(endpoint, reasons)
    _validate_bucket(bucket, reasons)
    _validate_prefix(prefix, reasons)
    if not region:
        reasons.append("REGION_EMPTY")

    commands = _mapping(observed.get("commands"))
    for command_name in (
        "head_bucket",
        "get_bucket_versioning",
        "get_public_access_block",
        "get_bucket_encryption",
        "get_bucket_policy",
        "list_objects_v2",
        "list_object_versions",
    ):
        if commands.get(command_name) is not True:
            reasons.append(f"S3_COMMAND_FAILED:{command_name}")

    controls = _mapping(requirements.get("required_bucket_controls"))
    versioning = _mapping(observed.get("versioning"))
    required_versioning = _text(controls.get("versioning_status"))
    if _text(versioning.get("Status")) != required_versioning:
        reasons.append("BUCKET_VERSIONING_NOT_ENABLED")

    required_public_access = _mapping(controls.get("public_access_block"))
    observed_public_access = _mapping(observed.get("public_access_block"))
    for key, required in required_public_access.items():
        if required is True and observed_public_access.get(key) is not True:
            reasons.append(f"PUBLIC_ACCESS_BLOCK_NOT_ENFORCED:{key}")

    accepted_encryption = {
        value
        for value in _string_list(controls.get("accepted_default_encryption_algorithms"))
    }
    encryption_algorithms = _extract_encryption_algorithms(observed.get("encryption"))
    if not encryption_algorithms:
        reasons.append("DEFAULT_ENCRYPTION_ABSENT")
    elif not encryption_algorithms.issubset(accepted_encryption):
        reasons.append("DEFAULT_ENCRYPTION_UNACCEPTED")

    policy = _mapping(observed.get("policy"))
    required_delete_actions = set(
        _string_list(controls.get("required_delete_deny_actions"))
    )
    expected_resource = (
        f"arn:aws:s3:::{bucket}/{prefix}/*" if bucket and prefix else ""
    )
    denied_actions = _globally_denied_actions(policy, expected_resource)
    for action in sorted(required_delete_actions - denied_actions):
        reasons.append(f"DELETE_DENY_MISSING:{action}")

    measured_payload = _mapping(requirements.get("measured_payload"))
    minimum_capacity = _integer(measured_payload.get("minimum_external_capacity_bytes"))
    if capacity_bytes is None:
        reasons.append("EXTERNAL_CAPACITY_NOT_CONFIRMED")
    elif minimum_capacity is None or capacity_bytes < minimum_capacity:
        reasons.append("EXTERNAL_CAPACITY_BELOW_MINIMUM")

    if requirements.get("mutation_mode") != "READ_ONLY":
        reasons.append("REQUIREMENTS_MUTATION_MODE_INVALID")
    if observed.get("mutation_mode") != "READ_ONLY":
        reasons.append("OBSERVED_MUTATION_MODE_INVALID")
    if requirements.get("production_fallback_allowed") is not False:
        reasons.append("PRODUCTION_FALLBACK_BOUNDARY_INVALID")
    if requirements.get("production_operational_status") != "NOT_ATTESTED":
        reasons.append("MATURITY_BOUNDARY_INVALID")

    authority_sha256 = hashlib.sha256(_canonical_json(requirements).encode()).hexdigest()
    policy_sha256 = hashlib.sha256(_canonical_json(policy).encode()).hexdigest()
    unique_reasons = sorted(set(reasons))
    report: dict[str, object] = {
        "schema_version": _REPORT_SCHEMA,
        "status": "READY_FOR_BUNDLE_UPLOAD" if not unique_reasons else "NOT_READY",
        "reasons": unique_reasons,
        "exact_main_sha": exact_main_sha,
        "workflow_run_id": workflow_run_id,
        "workflow_run_attempt": workflow_run_attempt,
        "issue": requirements.get("issue"),
        "command": requirements.get("command"),
        "target_role": requirements.get("target_role"),
        "mutation_mode": "READ_ONLY",
        "authority_sha256": authority_sha256,
        "observed": {
            "endpoint_host": endpoint_host,
            "region": region,
            "bucket": bucket,
            "prefix": prefix,
            "versioning_status": _text(versioning.get("Status")),
            "public_access_block": observed_public_access,
            "default_encryption_algorithms": sorted(encryption_algorithms),
            "policy_sha256": policy_sha256,
            "globally_denied_actions": sorted(denied_actions),
            "operator_confirmed_capacity_bytes": capacity_bytes,
        },
        "bundle_upload_status": "NOT_RUN",
        "bundle_restore_status": "NOT_RUN",
        "benchmark_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }
    report["report_sha256"] = hashlib.sha256(_canonical_json(report).encode()).hexdigest()
    return report


def _validate_endpoint(value: str, reasons: list[str]) -> str:
    try:
        parsed = urlsplit(value)
    except ValueError:
        reasons.append("ENDPOINT_INVALID")
        return ""
    if parsed.scheme != "https" or not parsed.hostname:
        reasons.append("ENDPOINT_NOT_HTTPS")
        return parsed.hostname or ""
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        reasons.append("ENDPOINT_CONTAINS_FORBIDDEN_COMPONENT")
    if parsed.path not in {"", "/"}:
        reasons.append("ENDPOINT_PATH_NOT_ROOT")
    host = parsed.hostname
    if host in {"localhost", "localhost.localdomain"}:
        reasons.append("ENDPOINT_HOST_LOCAL")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return host
    if not address.is_global:
        reasons.append("ENDPOINT_IP_NOT_GLOBAL")
    return host


def _validate_bucket(value: str, reasons: list[str]) -> None:
    if not _BUCKET_RE.fullmatch(value):
        reasons.append("BUCKET_NAME_INVALID")
        return
    if ".." in value or ".-" in value or "-." in value:
        reasons.append("BUCKET_NAME_INVALID")
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return
    reasons.append("BUCKET_NAME_LOOKS_LIKE_IP")


def _validate_prefix(value: str, reasons: list[str]) -> None:
    if not value or value.startswith("/") or value.endswith("/") or "\\" in value:
        reasons.append("PREFIX_INVALID")
        return
    path = PurePosixPath(value)
    if any(part in {"", ".", ".."} for part in path.parts):
        reasons.append("PREFIX_INVALID")
    if path.as_posix() != value:
        reasons.append("PREFIX_NOT_CANONICAL")


def _extract_encryption_algorithms(value: object) -> set[str]:
    payload = _mapping(value)
    configuration = _mapping(payload.get("ServerSideEncryptionConfiguration"))
    rules = configuration.get("Rules")
    if not isinstance(rules, list):
        return set()
    result: set[str] = set()
    for rule in rules:
        rule_mapping = _mapping(rule)
        default = _mapping(rule_mapping.get("ApplyServerSideEncryptionByDefault"))
        algorithm = _text(default.get("SSEAlgorithm"))
        if algorithm:
            result.add(algorithm)
    return result


def _globally_denied_actions(policy: dict[str, object], resource: str) -> set[str]:
    statements = policy.get("Statement")
    if isinstance(statements, dict):
        statement_list: list[object] = [statements]
    elif isinstance(statements, list):
        statement_list = statements
    else:
        return set()
    denied: set[str] = set()
    for statement in statement_list:
        item = _mapping(statement)
        if item.get("Effect") != "Deny" or not _principal_is_global(item.get("Principal")):
            continue
        resources = set(_string_or_list(item.get("Resource")))
        if resource not in resources:
            continue
        denied.update(_string_or_list(item.get("Action")))
    return denied


def _principal_is_global(value: object) -> bool:
    if value == "*":
        return True
    if not isinstance(value, dict):
        return False
    aws = value.get("AWS")
    if aws == "*":
        return True
    return isinstance(aws, list) and "*" in aws


def _expect_schema(
    payload: dict[str, object], expected: str, prefix: str, reasons: list[str]
) -> None:
    if payload.get("schema_version") != expected:
        reasons.append(f"{prefix}_SCHEMA_INVALID")


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _mapping(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: object) -> str:
    return value if isinstance(value, str) else ""


def _integer(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _string_or_list(value: object) -> list[str]:
    if isinstance(value, str):
        return [value]
    return _string_list(value)
