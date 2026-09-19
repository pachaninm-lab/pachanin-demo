from __future__ import annotations

import hashlib
from collections.abc import Mapping

from tai import reg_ru_s3_compatibility_v2 as verifier
from tai.reg_ru_s3_compatibility_v2_reg_ru import (
    validate_reg_ru_bucket_configuration,
)

AUTHORITY_SCHEMA = "tai.reg-ru-s3-panel-compatibility-authority.v3"
REPORT_SCHEMA = "tai.reg-ru-s3-panel-compatibility-report.v3"
VERIFIED_STATUS = "VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY_V3"

FINALIZER_BUCKET_CONTROL_DENY_ACTIONS = [
    "s3:DeleteBucketPolicy",
    "s3:GetBucketPolicy",
    "s3:GetLifecycleConfiguration",
    "s3:PutBucketPolicy",
    "s3:PutBucketVersioning",
    "s3:PutLifecycleConfiguration",
]
PANEL_UNAVAILABLE_BEHAVIORAL_ACTIONS = [
    "s3:GetBucketObjectLockConfiguration",
    "s3:PutBucketObjectLockConfiguration",
    "s3:BypassGovernanceRetention",
    "s3:GetObjectRetention",
    "s3:PutObjectRetention",
]

EXPECTED_RULES: tuple[dict[str, object], ...] = verifier.EXPECTED_RULES + (
    {
        "name": "TAI-08-finalizer-bucket-control-deny",
        "effect": "Deny",
        "key_set": "tai-bundle-finalizer-prod-01",
        "actions": FINALIZER_BUCKET_CONTROL_DENY_ACTIONS,
        "resources": ["arn:aws:s3:::tai-model-bundles-prod-01"],
        "condition": {},
    },
)

KEY_SETS: dict[str, object] = {
    **verifier.KEY_SETS,
    "finalizer_explicit_deny_rules": [
        "TAI-05-delete-deny",
        "TAI-08-finalizer-bucket-control-deny",
    ],
}
ADMIN_ONLY_ACTIONS = [
    "s3:GetBucketObjectLockConfiguration",
    "s3:GetBucketPolicy",
    "s3:GetLifecycleConfiguration",
    "s3:GetObjectRetention",
]
FINALIZER_FORBIDDEN_ACTIONS = sorted(
    set(verifier.FINALIZER_FORBIDDEN_ACTIONS)
    | set(FINALIZER_BUCKET_CONTROL_DENY_ACTIONS)
    | set(PANEL_UNAVAILABLE_BEHAVIORAL_ACTIONS)
)
REQUIRED_PROOFS = [
    proof
    for proof in verifier.REQUIRED_PROOFS
    if proof != "EXACT_SEVEN_PANEL_RULES_READBACK"
]
REQUIRED_PROOFS.insert(1, "EXACT_EIGHT_PANEL_RULES_READBACK")
REQUIRED_PROOFS.insert(
    3,
    "FINALIZER_PANEL_CONTROL_DENY_AND_BEHAVIORAL_OBJECT_LOCK_RETENTION_DENY",
)

_ORIGINALS = {
    "AUTHORITY_SCHEMA": verifier.AUTHORITY_SCHEMA,
    "REPORT_SCHEMA": verifier.REPORT_SCHEMA,
    "VERIFIED_STATUS": verifier.VERIFIED_STATUS,
    "EXPECTED_RULES": verifier.EXPECTED_RULES,
    "KEY_SETS": verifier.KEY_SETS,
    "ADMIN_ONLY_ACTIONS": verifier.ADMIN_ONLY_ACTIONS,
    "FINALIZER_FORBIDDEN_ACTIONS": verifier.FINALIZER_FORBIDDEN_ACTIONS,
    "REQUIRED_PROOFS": verifier.REQUIRED_PROOFS,
    "STREAM_KEY": verifier.STREAM_KEY,
    "MULTIPART_KEY_PREFIX": verifier.MULTIPART_KEY_PREFIX,
    "validate_panel_policy": verifier.validate_panel_policy,
    "_validate_bucket_configuration": verifier._validate_bucket_configuration,
}


def validate_panel_policy_v3(
    authority: Mapping[str, object], policy: Mapping[str, object]
) -> str:
    verifier.validate_authority(authority)
    statements_value = policy.get("Statement")
    if isinstance(statements_value, dict):
        statements: list[object] = [statements_value]
    elif isinstance(statements_value, list):
        statements = statements_value
    else:
        raise verifier.ProbeFailure("POLICY_STATEMENT_INVALID")

    errors: list[str] = []
    target_statements: list[dict[str, object]] = []
    for index, raw_statement in enumerate(statements):
        statement = verifier._mapping(raw_statement)
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
            verifier._normalise_action(item)
            for item in verifier._string_or_list(statement.get("Action"))
        )
        resources = sorted(verifier._string_or_list(statement.get("Resource")))
        if not actions or not resources:
            errors.append(f"POLICY_ACTION_OR_RESOURCE_EMPTY:{index}")
            continue
        if not verifier._touches_target(resources):
            continue
        if verifier._principal_is_global(statement.get("Principal")):
            errors.append(f"GLOBAL_PRINCIPAL_ON_TARGET:{index}")
        target_statements.append(
            {
                "effect": effect,
                "actions": actions,
                "resources": resources,
                "condition": verifier._normalise_condition(
                    statement.get("Condition")
                ),
            }
        )

    if len(target_statements) != len(EXPECTED_RULES):
        errors.append("TARGET_RULE_COUNT_NOT_EIGHT")
    matched_indexes: set[int] = set()
    for expected in EXPECTED_RULES:
        signature = {
            "effect": expected["effect"],
            "actions": sorted(verifier._string_list(expected["actions"])),
            "resources": sorted(verifier._string_list(expected["resources"])),
            "condition": verifier._normalise_condition(expected["condition"]),
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
    verifier._raise_errors(errors)
    return hashlib.sha256(verifier.canonical_json(policy).encode()).hexdigest()


def install_v3_semantics() -> None:
    verifier.AUTHORITY_SCHEMA = AUTHORITY_SCHEMA
    verifier.REPORT_SCHEMA = REPORT_SCHEMA
    verifier.VERIFIED_STATUS = VERIFIED_STATUS
    verifier.EXPECTED_RULES = EXPECTED_RULES
    verifier.KEY_SETS = KEY_SETS
    verifier.ADMIN_ONLY_ACTIONS = ADMIN_ONLY_ACTIONS
    verifier.FINALIZER_FORBIDDEN_ACTIONS = FINALIZER_FORBIDDEN_ACTIONS
    verifier.REQUIRED_PROOFS = REQUIRED_PROOFS
    verifier.STREAM_KEY = (
        "tai/model-bundles/v1/compatibility-probes/reg-ru-panel-v3/stream.bin"
    )
    verifier.MULTIPART_KEY_PREFIX = (
        "tai/model-bundles/v1/compatibility-probes/reg-ru-panel-v3/multipart"
    )
    verifier.validate_panel_policy = validate_panel_policy_v3
    verifier._validate_bucket_configuration = validate_reg_ru_bucket_configuration


def restore_v2_semantics() -> None:
    for name, value in _ORIGINALS.items():
        setattr(verifier, name, value)


def main(argv: list[str] | None = None) -> int:
    install_v3_semantics()
    return verifier.main(argv)


if __name__ == "__main__":
    raise SystemExit(main())
