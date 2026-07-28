from __future__ import annotations

import copy
import json
import os
from pathlib import Path

import pytest

from tai.reg_ru_s3_compatibility import (
    EXPECTED_RULES,
    OBSERVED_SCHEMA,
    TARGET,
    ContractError,
    authority_sha256,
    ensure_private_output,
    evaluate_compatibility,
    load_json,
    validate_authority,
    validate_panel_policy,
)

ROOT = Path(__file__).resolve().parents[1]
AUTHORITY_PATH = ROOT / "model-artifacts" / "reg-ru-s3-compatibility-authority.v1.json"


def authority() -> dict[str, object]:
    return load_json(AUTHORITY_PATH)


def exact_policy() -> dict[str, object]:
    statements: list[dict[str, object]] = []
    for rule in EXPECTED_RULES:
        statements.append(
            {
                "Sid": rule["name"],
                "Effect": rule["effect"],
                "Principal": {"AWS": "arn:reg:test:finalizer"},
                "Action": copy.deepcopy(rule["actions"]),
                "Resource": copy.deepcopy(rule["resources"]),
                **(
                    {"Condition": copy.deepcopy(rule["condition"])}
                    if rule["condition"]
                    else {}
                ),
            }
        )
    return {"Version": "2012-10-17", "Statement": statements}


def observed(policy_sha256: str) -> dict[str, object]:
    digest = "a" * 64
    return {
        "schema_version": OBSERVED_SCHEMA,
        "target": copy.deepcopy(TARGET),
        "commands": {
            "admin_bucket_controls_read": True,
            "admin_policy_read": True,
            "policy_exact": True,
            "finalizer_bucket_metadata_allowed": True,
            "finalizer_prefix_listing_allowed": True,
            "finalizer_multipart_listing_allowed": True,
            "control_bucket_metadata_denied": True,
            "control_prefix_listing_denied": True,
            "control_object_put_denied": True,
        },
        "configuration": {
            "versioning_status": "Enabled",
            "object_lock_status": "Enabled",
            "retention_mode": "COMPLIANCE",
            "retention_days": 90,
        },
        "policy": {"sha256": policy_sha256},
        "principal": {
            "finalizer_allowed": True,
            "control_denied": True,
            "control_has_no_policy_rules": True,
        },
        "privilege_denials": {
            "finalizer_delete_denied": True,
            "finalizer_delete_version_denied": True,
            "finalizer_get_bucket_policy_denied": True,
            "finalizer_put_bucket_policy_denied": True,
            "finalizer_put_bucket_versioning_denied": True,
            "finalizer_put_object_lock_denied": True,
            "finalizer_put_object_retention_denied": True,
            "finalizer_get_object_retention_denied": True,
            "finalizer_put_lifecycle_denied_or_not_applicable": True,
            "admin_locked_version_delete_denied": True,
        },
        "privacy": {
            "anonymous_list_http_status": 403,
            "anonymous_known_object_http_status": 403,
            "anonymous_insecure_known_object_http_status": 403,
        },
        "multipart": {
            "create_succeeded": True,
            "listed": True,
            "part_uploaded": True,
            "parts_listed": True,
            "abort_succeeded": True,
            "absent_after_abort": True,
        },
        "stream": {
            "upload_succeeded": True,
            "version_id_present": True,
            "retention_present": True,
            "exact_version_restore_succeeded": True,
            "sha256_match": True,
            "known_object_still_current": True,
            "size_bytes": 9437184,
            "retention_mode": "COMPLIANCE",
            "retention_deadline_90d": True,
            "source_sha256": digest,
            "restored_sha256": digest,
        },
        "bounds": {
            "retained_locked_bytes": 9437184,
            "aborted_multipart_retained_bytes": 0,
            "credentials_in_output": False,
            "raw_policy_retained": False,
        },
    }


def test_committed_authority_is_exact() -> None:
    payload = authority()
    validate_authority(payload)
    assert len(authority_sha256(payload)) == 64


def test_authority_rejects_finalizer_get_bucket_policy_drift() -> None:
    payload = authority()
    rules = copy.deepcopy(payload["panel_rules"])
    assert isinstance(rules, list)
    first = rules[0]
    assert isinstance(first, dict)
    actions = first["actions"]
    assert isinstance(actions, list)
    actions.append("s3:GetBucketPolicy")
    payload["panel_rules"] = rules
    with pytest.raises(ContractError, match="PANEL_RULE_SET_DRIFT"):
        validate_authority(payload)


def test_exact_panel_policy_validates() -> None:
    digest = validate_panel_policy(authority(), exact_policy())
    assert len(digest) == 64


def test_policy_rejects_excess_metadata_action() -> None:
    policy = exact_policy()
    statements = policy["Statement"]
    assert isinstance(statements, list)
    metadata = statements[0]
    assert isinstance(metadata, dict)
    actions = metadata["Action"]
    assert isinstance(actions, list)
    actions.append("s3:GetBucketPolicy")
    with pytest.raises(ContractError, match="PANEL_RULE_NOT_EXACT:TAI-01-bucket-metadata"):
        validate_panel_policy(authority(), policy)


def test_policy_rejects_public_allow() -> None:
    policy = exact_policy()
    statements = policy["Statement"]
    assert isinstance(statements, list)
    metadata = statements[0]
    assert isinstance(metadata, dict)
    metadata["Principal"] = "*"
    with pytest.raises(ContractError, match="PUBLIC_ALLOW_ON_TARGET"):
        validate_panel_policy(authority(), policy)


def test_policy_allows_unrelated_protective_deny() -> None:
    policy = exact_policy()
    statements = policy["Statement"]
    assert isinstance(statements, list)
    statements.append(
        {
            "Effect": "Deny",
            "Principal": "*",
            "Action": "s3:*",
            "Resource": "arn:aws:s3:::tai-model-bundles-prod-01/*",
            "Condition": {"Bool": {"aws:SecureTransport": "false"}},
        }
    )
    validate_panel_policy(authority(), policy)


def test_successful_observation_produces_candidate_only_report() -> None:
    policy_digest = validate_panel_policy(authority(), exact_policy())
    report = evaluate_compatibility(authority(), observed(policy_digest))
    assert report["status"] == "VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY"
    assert report["finalization_allowed"] is False
    assert report["production_operational_status"] == "NOT_ATTESTED"
    assert report["retained_locked_bytes"] == 9437184


def test_observation_fails_closed_on_control_access() -> None:
    policy_digest = validate_panel_policy(authority(), exact_policy())
    payload = observed(policy_digest)
    principal = payload["principal"]
    assert isinstance(principal, dict)
    principal["control_denied"] = False
    report = evaluate_compatibility(authority(), payload)
    assert report["status"] == "FAILED_CLOSED"
    assert "PRINCIPAL_PROOF_FAILED:control_denied" in report["reasons"]


def test_observation_rejects_credential_material() -> None:
    policy_digest = validate_panel_policy(authority(), exact_policy())
    payload = observed(policy_digest)
    payload["leak"] = "aws_secret_access_key"
    report = evaluate_compatibility(authority(), payload)
    assert report["status"] == "FAILED_CLOSED"
    assert "CREDENTIAL_MATERIAL_IN_OBSERVED" in report["reasons"]


def test_private_output_reservation(tmp_path: Path) -> None:
    os.chmod(tmp_path, 0o700)
    output = tmp_path / "report.json"
    descriptor = ensure_private_output(output)
    os.close(descriptor)
    assert output.stat().st_mode & 0o777 == 0o600
    descriptor = ensure_private_output(output, reserved=True)
    os.write(descriptor, b"{}\n")
    os.close(descriptor)
    assert json.loads(output.read_text()) == {}


def test_private_output_rejects_non_private_parent(tmp_path: Path) -> None:
    os.chmod(tmp_path, 0o755)  # noqa: S103 - intentional rejection fixture
    with pytest.raises(ContractError, match="OUTPUT_PARENT_NOT_PRIVATE"):
        ensure_private_output(tmp_path / "report.json")
