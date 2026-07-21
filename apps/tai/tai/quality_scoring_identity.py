from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from tai.quality_scoring_contract import (
    QualityScoringError,
    as_array,
    as_bool,
    as_identity,
    as_int,
    as_object,
    as_sha256,
    as_timestamp,
    require_keys,
)

ASSERTION_KEYS = {
    "schema_version",
    "assertion_id",
    "issuer",
    "audience",
    "subject",
    "role",
    "mfa_verified",
    "mfa_method",
    "mfa_verified_at",
    "issued_at",
    "expires_at",
    "key_id",
    "nonce",
    "signature",
}


def _canonical_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def _trusted_secret(path: Path, expected_sha256: str) -> bytes:
    expected = as_sha256(expected_sha256, "trusted reviewer identity secret digest")
    if path.is_symlink() or not path.is_file():
        raise QualityScoringError(
            "reviewer identity secret must be an external regular file"
        )
    try:
        secret = path.read_bytes()
    except OSError as exc:
        raise QualityScoringError("reviewer identity secret is unreadable") from exc
    if not 32 <= len(secret) <= 4096:
        raise QualityScoringError("reviewer identity secret size is invalid")
    if hashlib.sha256(secret).hexdigest() != expected:
        raise QualityScoringError("reviewer identity secret trust anchor mismatch")
    return secret


def _assertion(
    item: object,
    number: int,
    policy: dict[str, Any],
    secret: bytes,
    evaluated_at: datetime,
) -> dict[str, Any]:
    assertion = as_object(item, f"identity_assertions[{number}]")
    require_keys(assertion, ASSERTION_KEYS, f"identity_assertions[{number}]")
    if assertion["schema_version"] != policy["schema_version"]:
        raise QualityScoringError("reviewer identity assertion schema mismatch")
    for field in (
        "assertion_id",
        "issuer",
        "audience",
        "subject",
        "role",
        "mfa_method",
        "key_id",
        "nonce",
    ):
        as_identity(assertion[field], f"identity_assertion.{field}")
    if assertion["issuer"] != policy["issuer"]:
        raise QualityScoringError("reviewer identity issuer mismatch")
    if assertion["audience"] != policy["audience"]:
        raise QualityScoringError("reviewer identity audience mismatch")
    if assertion["key_id"] != policy["key_id"]:
        raise QualityScoringError("reviewer identity key id mismatch")
    if assertion["role"] not in policy["allowed_roles"]:
        raise QualityScoringError("reviewer identity role is not allowed")
    if not as_bool(assertion["mfa_verified"], "identity_assertion.mfa_verified"):
        raise QualityScoringError("reviewer identity assertion is not MFA verified")
    if assertion["mfa_method"] not in policy["allowed_mfa_methods"]:
        raise QualityScoringError("reviewer identity MFA method is not allowed")

    issued_at = as_timestamp(assertion["issued_at"], "identity_assertion.issued_at")
    expires_at = as_timestamp(assertion["expires_at"], "identity_assertion.expires_at")
    mfa_at = as_timestamp(
        assertion["mfa_verified_at"],
        "identity_assertion.mfa_verified_at",
    )
    if issued_at > evaluated_at or mfa_at > evaluated_at:
        raise QualityScoringError("reviewer identity assertion is from the future")
    if not issued_at <= mfa_at <= expires_at:
        raise QualityScoringError("reviewer identity assertion timestamps are invalid")
    lifetime = int((expires_at - issued_at).total_seconds())
    if lifetime <= 0 or lifetime > as_int(
        policy["maximum_lifetime_seconds"],
        "identity policy maximum lifetime",
        minimum=1,
    ):
        raise QualityScoringError("reviewer identity assertion lifetime is invalid")

    signature = as_sha256(assertion["signature"], "identity_assertion.signature")
    payload = {key: value for key, value in assertion.items() if key != "signature"}
    expected_signature = hmac.new(
        secret,
        _canonical_bytes(payload),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        raise QualityScoringError("reviewer identity signature is invalid")
    return dict(assertion)


def verify_identity_assertions(
    assertions_value: object,
    policy_value: object,
    secret_path: Path,
    trusted_secret_sha256: str,
    *,
    evaluated_at: datetime,
) -> dict[str, dict[str, Any]]:
    policy = as_object(policy_value, "scorer identity policy")
    require_keys(
        policy,
        {
            "schema_version",
            "signature_algorithm",
            "issuer",
            "audience",
            "key_id",
            "allowed_roles",
            "allowed_mfa_methods",
            "maximum_lifetime_seconds",
            "maximum_mfa_age_seconds",
            "trusted_secret_digest_source",
        },
        "scorer identity policy",
    )
    if policy["signature_algorithm"] != "HMAC-SHA256":
        raise QualityScoringError("unsupported reviewer identity signature algorithm")
    if policy["trusted_secret_digest_source"] != "OPERATOR_TRUSTED_CONFIG":
        raise QualityScoringError("reviewer identity trust source is not operator-owned")
    allowed_roles = as_array(policy["allowed_roles"], "identity policy allowed roles")
    allowed_methods = as_array(
        policy["allowed_mfa_methods"],
        "identity policy allowed MFA methods",
    )
    if not allowed_roles or not allowed_methods:
        raise QualityScoringError("reviewer identity policy is empty")
    for role in allowed_roles:
        as_identity(role, "identity policy role")
    for method in allowed_methods:
        as_identity(method, "identity policy MFA method")

    secret = _trusted_secret(secret_path, trusted_secret_sha256)
    assertions: dict[str, dict[str, Any]] = {}
    subjects: set[tuple[str, str]] = set()
    for number, item in enumerate(
        as_array(assertions_value, "identity_assertions")
    ):
        assertion = _assertion(item, number, policy, secret, evaluated_at)
        assertion_id = str(assertion["assertion_id"])
        subject_role = (str(assertion["subject"]), str(assertion["role"]))
        if assertion_id in assertions:
            raise QualityScoringError("duplicate reviewer identity assertion id")
        if subject_role in subjects:
            raise QualityScoringError("duplicate reviewer identity subject and role")
        assertions[assertion_id] = assertion
        subjects.add(subject_role)
    if not assertions:
        raise QualityScoringError("reviewer identity assertions are absent")
    return assertions


def bind_annotation_identity(
    annotation: dict[str, Any],
    assertions: dict[str, dict[str, Any]],
    policy_value: object,
) -> str:
    policy = as_object(policy_value, "scorer identity policy")
    assertion_id = as_identity(
        annotation["identity_assertion_id"],
        "annotation.identity_assertion_id",
    )
    assertion = assertions.get(assertion_id)
    if assertion is None:
        raise QualityScoringError("annotation identity assertion is unknown")
    if assertion["subject"] != annotation["scorer_id"]:
        raise QualityScoringError("annotation scorer id is not server authenticated")
    if assertion["role"] != annotation["scorer_role"]:
        raise QualityScoringError("annotation scorer role is not server authenticated")

    scored_at = as_timestamp(annotation["scored_at"], "annotation.scored_at")
    issued_at = as_timestamp(assertion["issued_at"], "identity_assertion.issued_at")
    expires_at = as_timestamp(assertion["expires_at"], "identity_assertion.expires_at")
    mfa_at = as_timestamp(
        assertion["mfa_verified_at"],
        "identity_assertion.mfa_verified_at",
    )
    if not issued_at <= mfa_at <= scored_at <= expires_at:
        raise QualityScoringError("annotation is outside authenticated identity validity")
    maximum_mfa_age = as_int(
        policy["maximum_mfa_age_seconds"],
        "identity policy maximum MFA age",
        minimum=1,
    )
    if int((scored_at - mfa_at).total_seconds()) > maximum_mfa_age:
        raise QualityScoringError("annotation MFA verification is stale")
    return assertion_id
