from __future__ import annotations

import copy
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from tai import reg_ru_s3_compatibility_v2 as verifier
from tai import reg_ru_s3_compatibility_v3 as v3

ROOT = Path(__file__).resolve().parents[1]
AUTHORITY_PATH = ROOT / "model-artifacts" / "reg-ru-s3-compatibility-authority.v3.json"
WRAPPER_PATH = ROOT / "model-artifacts" / "reg-ru-s3-compatibility-probe.v3.sh"
RUNBOOK_PATH = ROOT / "model-artifacts" / "reg-ru-s3-compatibility-runbook.v3.md"


def exact_policy() -> dict[str, object]:
    statements: list[dict[str, object]] = []
    for index, rule in enumerate(v3.EXPECTED_RULES):
        statements.append(
            {
                "Sid": f"provider-{index}",
                "Effect": rule["effect"],
                "Principal": {"AWS": f"arn:reg:test:{index}"},
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


def test_v3_authority_and_exact_nine_rule_policy() -> None:
    v3.install_v3_semantics()
    try:
        authority = verifier.load_json(AUTHORITY_PATH)
        verifier.validate_authority(authority)
        assert len(v3.EXPECTED_RULES) == 9
        assert [rule["name"] for rule in v3.EXPECTED_RULES[-2:]] == [
            "TAI-08-finalizer-bucket-control-deny",
            "TAI-09-finalizer-retention-deny",
        ]
        assert len(v3.validate_panel_policy_v3(authority, exact_policy())) == 64

        policy = exact_policy()
        statements = policy["Statement"]
        assert isinstance(statements, list)
        statements.pop()
        with pytest.raises(verifier.ProbeFailure, match="TARGET_RULE_COUNT_NOT_NINE"):
            v3.validate_panel_policy_v3(authority, policy)
    finally:
        v3.restore_v2_semantics()


def test_v3_explicit_denies_cover_observed_and_future_finalizer_risks() -> None:
    bucket_actions = set(v3.FINALIZER_BUCKET_CONTROL_DENY_ACTIONS)
    retention_actions = set(v3.FINALIZER_RETENTION_DENY_ACTIONS)
    assert {
        "s3:GetBucketPolicy",
        "s3:PutBucketPolicy",
        "s3:PutBucketVersioning",
        "s3:PutBucketObjectLockConfiguration",
        "s3:PutLifecycleConfiguration",
    } <= bucket_actions
    assert {
        "s3:BypassGovernanceRetention",
        "s3:GetObjectRetention",
        "s3:PutObjectRetention",
    } == retention_actions
    assert v3.KEY_SETS["finalizer_explicit_deny_rules"] == [
        "TAI-05-delete-deny",
        "TAI-08-finalizer-bucket-control-deny",
        "TAI-09-finalizer-retention-deny",
    ]
    assert "EXACT_NINE_PANEL_RULES_READBACK" in v3.REQUIRED_PROOFS
    assert "EXACT_SEVEN_PANEL_RULES_READBACK" not in v3.REQUIRED_PROOFS


def test_v3_install_restore_and_location_semantics() -> None:
    original_schema = verifier.AUTHORITY_SCHEMA
    original_rules = verifier.EXPECTED_RULES
    original_validator = verifier._validate_bucket_configuration
    v3.install_v3_semantics()
    try:
        assert verifier.AUTHORITY_SCHEMA == v3.AUTHORITY_SCHEMA
        assert verifier.REPORT_SCHEMA == v3.REPORT_SCHEMA
        assert verifier.VERIFIED_STATUS == v3.VERIFIED_STATUS
        assert verifier.EXPECTED_RULES is v3.EXPECTED_RULES
        assert "reg-ru-panel-v3" in verifier.STREAM_KEY
        assert "reg-ru-panel-v3" in verifier.MULTIPART_KEY_PREFIX
        result = verifier._validate_bucket_configuration(
            {"LocationConstraint": "ru-1"},
            {"Status": "Enabled"},
            {
                "ObjectLockConfiguration": {
                    "ObjectLockEnabled": "Enabled",
                    "Rule": {
                        "DefaultRetention": {"Mode": "COMPLIANCE", "Days": 90}
                    },
                }
            },
            "us-east-1",
        )
        assert result["location_semantics"] == (
            "OBSERVED_NOT_PINNED_TO_SIGNING_REGION"
        )
    finally:
        v3.restore_v2_semantics()
    assert verifier.AUTHORITY_SCHEMA == original_schema
    assert verifier.EXPECTED_RULES is original_rules
    assert verifier._validate_bucket_configuration is original_validator


def test_v3_policy_defensive_paths() -> None:
    v3.install_v3_semantics()
    try:
        authority = verifier.load_json(AUTHORITY_PATH)
        with pytest.raises(verifier.ProbeFailure, match="POLICY_STATEMENT_INVALID"):
            v3.validate_panel_policy_v3(authority, {})

        cases: list[tuple[object, str]] = [
            (None, "POLICY_STATEMENT_NOT_OBJECT"),
            (
                {"Effect": "Allow", "NotAction": "s3:GetObject", "Resource": "*"},
                "POLICY_NOT_CONSTRUCT_FORBIDDEN",
            ),
            (
                {"Effect": "Maybe", "Action": "s3:GetObject", "Resource": "*"},
                "POLICY_EFFECT_INVALID",
            ),
            (
                {"Effect": "Allow", "Action": [], "Resource": "*"},
                "POLICY_ACTION_OR_RESOURCE_EMPTY",
            ),
        ]
        for statement, reason in cases:
            with pytest.raises(verifier.ProbeFailure, match=reason):
                v3.validate_panel_policy_v3(authority, {"Statement": [statement]})

        global_policy = exact_policy()
        global_statements = global_policy["Statement"]
        assert isinstance(global_statements, list)
        first = global_statements[0]
        assert isinstance(first, dict)
        first["Principal"] = "*"
        with pytest.raises(verifier.ProbeFailure, match="GLOBAL_PRINCIPAL_ON_TARGET"):
            v3.validate_panel_policy_v3(authority, global_policy)
    finally:
        v3.restore_v2_semantics()


def test_v3_main_installs_before_delegate(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, Any]] = []

    def fake_main(argv: list[str] | None = None) -> int:
        calls.append((verifier.AUTHORITY_SCHEMA, argv))
        return 19

    monkeypatch.setattr(verifier, "main", fake_main)
    try:
        assert v3.main(["--authority", "a", "--output", "b"]) == 19
        assert calls == [
            (
                v3.AUTHORITY_SCHEMA,
                ["--authority", "a", "--output", "b"],
            )
        ]
    finally:
        v3.restore_v2_semantics()


def test_v3_failed_report_uses_v3_contract() -> None:
    v3.install_v3_semantics()
    try:
        report = verifier.failed_report(
            verifier.load_json(AUTHORITY_PATH),
            "TEST_FAILURE",
            SimpleNamespace(
                boto3=SimpleNamespace(__version__="test"),
                botocore=SimpleNamespace(__version__="test"),
            ),
        )
        assert report["schema_version"] == v3.REPORT_SCHEMA
        assert report["status"] == "FAILED_CLOSED"
        assert report["profile_state"] == "CANDIDATE_NOT_ACTIVE"
        assert report["finalization_allowed"] is False
    finally:
        v3.restore_v2_semantics()


def test_v3_artifacts_are_local_interactive_and_do_not_weaken_denials() -> None:
    wrapper = WRAPPER_PATH.read_text(encoding="utf-8")
    runbook = RUNBOOK_PATH.read_text(encoding="utf-8")
    authority = AUTHORITY_PATH.read_text(encoding="utf-8")

    assert "tai.reg_ru_s3_compatibility_v3" in wrapper
    assert "aws " not in wrapper.lower()
    assert "--no-verify-ssl" not in wrapper
    assert "reg-ru-s3-compatibility-authority.v3.json" in runbook
    assert "TAI-08-finalizer-bucket-control-deny" in runbook
    assert "TAI-09-finalizer-retention-deny" in runbook
    assert "Do not run v2 again" in runbook
    assert "VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY_V3" in authority
    assert '"workflow_allowed": false' in authority
    assert '"finalization_allowed": false' in authority
