from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from tai.model_bundle_s3_preflight import evaluate_s3_preflight
from tai.model_bundle_s3_preflight_cli import main

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
REQUIREMENTS_PATH = (
    TAI_ROOT
    / "model-artifacts"
    / "model-bundle-s3-preflight-requirements.v1.json"
)
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-bundle-s3-preflight.yml"
COMMAND = "/tai probe bundle-storage exact-main"
EXACT_MAIN = "a" * 40


def _json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def _valid_observed() -> dict[str, object]:
    bucket = "tai-model-bundles"
    prefix = "tai/model-bundles/v1"
    return {
        "schema_version": "tai.model-bundle-s3-preflight-observed.v1",
        "provider_profile": "SELECTEL_S3_2026",
        "endpoint": "https://s3.example.ru",
        "region": "ru-6",
        "bucket": bucket,
        "prefix": prefix,
        "operator_confirmed_capacity_bytes": "150000000000",
        "commands": {
            "head_bucket": True,
            "get_bucket_versioning": True,
            "get_object_lock_configuration": True,
            "get_bucket_policy": True,
            "list_objects_v2": True,
            "list_object_versions": True,
            "anonymous_list_probe": True,
        },
        "versioning": {"Status": "Enabled"},
        "object_lock": {
            "ObjectLockConfiguration": {
                "ObjectLockEnabled": "Enabled",
                "Rule": {
                    "DefaultRetention": {
                        "Mode": "COMPLIANCE",
                        "Days": 90,
                    }
                },
            }
        },
        "anonymous_list_http_status": "403",
        "policy": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Deny",
                    "Principal": "*",
                    "Action": ["s3:DeleteObject", "s3:DeleteObjectVersion"],
                    "Resource": f"arn:aws:s3:::{bucket}/{prefix}/*",
                }
            ],
        },
        "aws_cli_identity": "aws-cli/2.x",
        "mutation_mode": "READ_ONLY",
    }


def _evaluate(observed: dict[str, object]) -> dict[str, object]:
    return evaluate_s3_preflight(
        _json(REQUIREMENTS_PATH),
        observed,
        exact_main_sha=EXACT_MAIN,
        workflow_run_id=123,
        workflow_run_attempt=1,
    )


def test_valid_selectel_s3_authority_is_ready_and_bounded() -> None:
    report = _evaluate(_valid_observed())
    assert report["status"] == "READY_FOR_BUNDLE_UPLOAD"
    assert report["reasons"] == []
    assert report["provider_profile"] == "SELECTEL_S3_2026"
    assert report["bundle_upload_status"] == "NOT_RUN"
    assert report["bundle_restore_status"] == "NOT_RUN"
    assert report["production_operational_status"] == "NOT_ATTESTED"
    observed = report["observed"]
    assert isinstance(observed, dict)
    assert observed["endpoint_host"] == "s3.example.ru"
    assert observed["object_lock_status"] == "Enabled"
    assert observed["default_retention_mode"] == "COMPLIANCE"
    assert observed["default_retention_days"] == 90
    assert observed["anonymous_list_http_status"] == 403
    assert observed["globally_denied_actions"] == [
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
    ]
    assert "secret" not in json.dumps(report).lower()


@pytest.mark.parametrize(
    ("mutation", "expected_reason"),
    [
        ({"provider_profile": "GENERIC"}, "OBSERVED_PROVIDER_PROFILE_INVALID"),
        ({"versioning": {"Status": "Suspended"}}, "BUCKET_VERSIONING_NOT_ENABLED"),
        ({"object_lock": {}}, "OBJECT_LOCK_NOT_ENABLED"),
        (
            {
                "object_lock": {
                    "ObjectLockConfiguration": {
                        "ObjectLockEnabled": "Enabled",
                        "Rule": {
                            "DefaultRetention": {
                                "Mode": "GOVERNANCE",
                                "Days": 90,
                            }
                        },
                    }
                }
            },
            "DEFAULT_RETENTION_MODE_INVALID",
        ),
        (
            {
                "object_lock": {
                    "ObjectLockConfiguration": {
                        "ObjectLockEnabled": "Enabled",
                        "Rule": {
                            "DefaultRetention": {
                                "Mode": "COMPLIANCE",
                                "Days": 89,
                            }
                        },
                    }
                }
            },
            "DEFAULT_RETENTION_OUT_OF_RANGE",
        ),
        ({"anonymous_list_http_status": "200"}, "ANONYMOUS_BUCKET_LIST_NOT_DENIED"),
        (
            {"operator_confirmed_capacity_bytes": "119999999999"},
            "EXTERNAL_CAPACITY_BELOW_MINIMUM",
        ),
        (
            {"operator_confirmed_capacity_bytes": "unknown"},
            "EXTERNAL_CAPACITY_NOT_CONFIRMED",
        ),
        ({"mutation_mode": "WRITE"}, "OBSERVED_MUTATION_MODE_INVALID"),
        ({"region": ""}, "REGION_EMPTY"),
    ],
)
def test_selectel_control_failures_are_rejected(
    mutation: dict[str, object], expected_reason: str
) -> None:
    observed = _valid_observed()
    observed.update(mutation)
    report = _evaluate(observed)
    assert report["status"] == "NOT_READY"
    assert expected_reason in report["reasons"]


@pytest.mark.parametrize(
    ("endpoint", "expected_reason"),
    [
        ("http://s3.example.ru", "ENDPOINT_NOT_HTTPS"),
        ("https://localhost", "ENDPOINT_HOST_LOCAL"),
        ("https://127.0.0.1", "ENDPOINT_IP_NOT_GLOBAL"),
        ("https://user:pass@s3.example.ru", "ENDPOINT_CONTAINS_FORBIDDEN_COMPONENT"),
        ("https://s3.example.ru/path", "ENDPOINT_PATH_NOT_ROOT"),
    ],
)
def test_endpoint_safety_is_fail_closed(endpoint: str, expected_reason: str) -> None:
    observed = _valid_observed()
    observed["endpoint"] = endpoint
    report = _evaluate(observed)
    assert report["status"] == "NOT_READY"
    assert expected_reason in report["reasons"]


@pytest.mark.parametrize("prefix", ["", "/root", "root/", "root\\child", "root//child"])
def test_prefix_must_be_canonical(prefix: str) -> None:
    observed = _valid_observed()
    observed["prefix"] = prefix
    report = _evaluate(observed)
    assert report["status"] == "NOT_READY"
    assert any(reason.startswith("PREFIX_") for reason in report["reasons"])


def test_delete_deny_requires_global_principal_exact_prefix_and_both_actions() -> None:
    cases = []
    no_global_principal = _valid_observed()
    no_global_principal["policy"] = {
        "Statement": [
            {
                "Effect": "Deny",
                "Principal": {"AWS": "service-user-id"},
                "Action": ["s3:DeleteObject", "s3:DeleteObjectVersion"],
                "Resource": "arn:aws:s3:::tai-model-bundles/tai/model-bundles/v1/*",
            }
        ]
    }
    cases.append(no_global_principal)

    wrong_prefix = _valid_observed()
    wrong_prefix["policy"] = {
        "Statement": {
            "Effect": "Deny",
            "Principal": {"AWS": ["*"]},
            "Action": ["s3:DeleteObject", "s3:DeleteObjectVersion"],
            "Resource": "arn:aws:s3:::tai-model-bundles/other/*",
        }
    }
    cases.append(wrong_prefix)

    one_action = _valid_observed()
    one_action["policy"] = {
        "Statement": {
            "Effect": "Deny",
            "Principal": "*",
            "Action": "s3:DeleteObject",
            "Resource": "arn:aws:s3:::tai-model-bundles/tai/model-bundles/v1/*",
        }
    }
    cases.append(one_action)

    for observed in cases:
        report = _evaluate(observed)
        assert report["status"] == "NOT_READY"
        assert any(reason.startswith("DELETE_DENY_MISSING:") for reason in report["reasons"])


def test_command_failure_and_schema_mismatch_are_reported() -> None:
    observed = _valid_observed()
    commands = copy.deepcopy(observed["commands"])
    assert isinstance(commands, dict)
    commands["head_bucket"] = False
    observed["commands"] = commands
    observed["schema_version"] = "wrong"
    report = _evaluate(observed)
    assert "S3_COMMAND_FAILED:head_bucket" in report["reasons"]
    assert "OBSERVED_SCHEMA_INVALID" in report["reasons"]


def test_cli_returns_zero_only_for_ready(tmp_path: Path) -> None:
    observed_path = tmp_path / "observed.json"
    output_path = tmp_path / "report.json"
    observed_path.write_text(json.dumps(_valid_observed()), encoding="utf-8")
    assert (
        main(
            [
                str(REQUIREMENTS_PATH),
                str(observed_path),
                "--exact-main",
                EXACT_MAIN,
                "--workflow-run-id",
                "123",
                "--workflow-run-attempt",
                "1",
                "--output",
                str(output_path),
            ]
        )
        == 0
    )
    observed = _valid_observed()
    observed["versioning"] = {}
    observed_path.write_text(json.dumps(observed), encoding="utf-8")
    assert (
        main(
            [
                str(REQUIREMENTS_PATH),
                str(observed_path),
                "--exact-main",
                EXACT_MAIN,
                "--workflow-run-id",
                "123",
                "--workflow-run-attempt",
                "1",
                "--output",
                str(output_path),
            ]
        )
        == 2
    )


def test_workflow_uses_only_selectel_supported_s3_controls() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    assert "github.event.issue.number == 2954" in workflow
    assert f"github.event.comment.body == '{COMMAND}'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "github.event.comment.user.login == github.repository_owner" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "actions: read\n  contents: read\n  issues: write" in workflow
    for secret in _json(REQUIREMENTS_PATH)["required_secret_names"]:
        assert secret in workflow
    for forbidden in (
        "PC_PROD_",
        "VPS_SSH_",
        "195.19.12.120",
        "get-public-access-block",
        "get-bucket-encryption",
        "put-public-access-block",
        "put-bucket-encryption",
        "s3api put-object",
        "s3api delete-object",
        "s3api create-multipart-upload",
        "s3 cp",
    ):
        assert forbidden not in workflow
    for required in (
        "head-bucket",
        "get-bucket-versioning",
        "get-object-lock-configuration",
        "get-bucket-policy",
        "list-objects-v2",
        "list-object-versions",
        "anonymous_list_http_status",
        "SELECTEL_S3_2026",
        "bundle upload: `NOT_RUN`",
        "NOT_ATTESTED",
    ):
        assert required in workflow


def test_requirements_record_selectel_compatibility_boundary() -> None:
    requirements = _json(REQUIREMENTS_PATH)
    assert requirements["provider_profile"] == "SELECTEL_S3_2026"
    controls = requirements["required_bucket_controls"]
    assert controls["unsupported_s3_apis"] == [
        "Bucket Encryption",
        "Public Access Block",
    ]
    assert controls["object_lock_status"] == "Enabled"
    assert controls["default_retention_mode"] == "COMPLIANCE"
    assert controls["minimum_retention_days"] == 90
    assert requirements["production_operational_status"] == "NOT_ATTESTED"
