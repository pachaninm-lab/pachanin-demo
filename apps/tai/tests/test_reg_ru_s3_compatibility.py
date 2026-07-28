from __future__ import annotations

import hashlib
import importlib
import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

from tai.reg_ru_s3_compatibility import (
    ATTESTATION_SCHEMA,
    BUCKET_ACTIONS,
    EXACT_BASE,
    FORBIDDEN_ACTIONS,
    KEY_SET_NAME,
    OBJECT_ACTIONS,
    PROVIDER_EVIDENCE_SCHEMA,
    TARGET,
    ContractError,
    build_bucket_policy,
    ensure_private_output,
    evaluate_compatibility,
    load_json,
    validate_attestation,
    validate_authority,
    validate_final_policy,
)
from tai.reg_ru_s3_compatibility_cli import main as compatibility_cli_main

TAI_ROOT = Path(__file__).parents[1]
ROOT = Path(__file__).parents[3]
AUTHORITY_PATH = TAI_ROOT / "model-artifacts/reg-ru-s3-compatibility-authority.v1.json"
SCRIPT_PATH = TAI_ROOT / "model-artifacts/reg-ru-s3-compatibility-probe.v1.sh"
SCOPE_PATH = TAI_ROOT / "governance/scopes/ap-13b3i-reg-ru-s3-compatibility-2954.json"


def _json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def _private_json(path: Path, value: dict[str, object]) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    path.chmod(0o600)


def _attestation(tmp_path: Path) -> tuple[dict[str, object], Path]:
    selector = {"AWS": "arn:regru:iam::account:principal/finalizer-0123456789"}
    control = {"AWS": "arn:regru:iam::account:principal/control-9876543210"}
    evidence = {
        "schema_version": PROVIDER_EVIDENCE_SCHEMA,
        "provider": "REG.RU",
        "issuer": "REG.RU_SUPPORT_OR_API",
        "issuer_reference": "REG-RU-SUPPORT-123456",
        "target": dict(TARGET),
        "key_set_name": KEY_SET_NAME,
        "principal_selector": selector,
        "nonmatching_control_selector": control,
        "permission_scope": "EXACT_BUCKET_AND_PREFIX",
        "allow_bucket_actions": list(BUCKET_ACTIONS),
        "allow_object_actions": list(OBJECT_ACTIONS),
        "forbidden_actions": list(FORBIDDEN_ACTIONS),
    }
    evidence_path = (tmp_path / "provider-evidence.json").resolve()
    _private_json(evidence_path, evidence)
    attestation: dict[str, object] = {
        "schema_version": ATTESTATION_SCHEMA,
        "status": "PROVIDER_ISSUED",
        "provider": "REG.RU",
        "issuer": "REG.RU_SUPPORT_OR_API",
        "issued_at": "2026-07-28T12:00:00Z",
        "issuer_reference": "REG-RU-SUPPORT-123456",
        "target": dict(TARGET),
        "key_set_name": KEY_SET_NAME,
        "selector_semantics": "REG_RU_PROVIDER_ISSUED_POLICY_PRINCIPAL",
        "principal_selector": selector,
        "nonmatching_control_selector": control,
        "attested_permissions": {
            "scope": "EXACT_BUCKET_AND_PREFIX",
            "allow_bucket_actions": list(BUCKET_ACTIONS),
            "allow_object_actions": list(OBJECT_ACTIONS),
            "forbidden_actions": list(FORBIDDEN_ACTIONS),
        },
        "provider_evidence": {
            "path": str(evidence_path),
            "sha256": hashlib.sha256(evidence_path.read_bytes()).hexdigest(),
        },
    }
    attestation_path = (tmp_path / "attestation.json").resolve()
    _private_json(attestation_path, attestation)
    return attestation, attestation_path


def _observed(policy: dict[str, object], selector_hash: str) -> dict[str, object]:
    digest = hashlib.sha256(
        json.dumps(policy, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
    ).hexdigest()
    stream_hash = hashlib.sha256(b"T" * (9 * 1024 * 1024)).hexdigest()
    return {
        "schema_version": "tai.reg-ru-s3-compatibility-observed.v1",
        "target": dict(TARGET),
        "commands": {
            key: True
            for key in (
                "head_bucket",
                "get_bucket_versioning",
                "get_object_lock_configuration",
                "get_bucket_policy",
                "put_canary_policy",
                "restore_after_canary",
                "put_final_policy",
                "get_final_policy",
            )
        },
        "configuration": {
            "versioning_status": "Enabled",
            "object_lock_status": "Enabled",
            "retention_mode": "COMPLIANCE",
            "retention_days": 90,
        },
        "principal": {
            "finalizer_canary_denied": True,
            "admin_canary_allowed": True,
            "policy_restored_after_canary": True,
            "principal_selector_sha256": selector_hash,
        },
        "policy": {"document": policy, "sha256": digest, "installed": True},
        "privilege_denials": {
            "same_policy_put_denied": True,
            "same_versioning_put_denied": True,
            "same_object_lock_put_denied": True,
            "same_object_retention_put_denied": True,
            "same_lifecycle_put_denied": "NOT_APPLICABLE_NO_EXISTING_CONFIGURATION",
            "lifecycle_mutation_provider_attested": True,
        },
        "worm": {
            "put_succeeded": True,
            "version_id_present": True,
            "versionless_delete_succeeded": True,
            "exact_version_delete_denied": True,
            "delete_marker_removed": True,
            "locked_version_still_readable": True,
            "retention_mode": "COMPLIANCE",
            "retention_deadline_90d": True,
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
            "versionless_delete_denied": True,
            "known_object_still_current": True,
            "size_bytes": 9437184,
            "retention_mode": "COMPLIANCE",
            "retention_deadline_90d": True,
            "source_sha256": stream_hash,
            "restored_sha256": stream_hash,
        },
        "bounds": {
            "retained_locked_bytes": 9441280,
            "aborted_multipart_retained_bytes": 0,
            "credentials_in_output": False,
            "raw_evidence_retained": False,
        },
    }


def test_candidate_authority_is_dormant_and_exact() -> None:
    authority = _json(AUTHORITY_PATH)
    validate_authority(authority)
    assert authority["exact_base"] == EXACT_BASE
    assert authority["profile_state"] == "CANDIDATE_NOT_ACTIVE"
    assert authority["principal"]["status"] == "UNRESOLVED"
    assert authority["github_secret_registration_allowed"] is False
    assert authority["finalization_allowed"] is False
    assert "s3:PutLifecycleConfiguration" in authority["principal"]["forbidden_actions"]
    active_registry = TAI_ROOT / "tai/model_bundle_s3_preflight.py"
    if active_registry.exists():
        assert "REG_RU_S3_2026" not in active_registry.read_text(encoding="utf-8")


def test_scope_is_the_exact_active_eight_file_contract() -> None:
    scope = _json(SCOPE_PATH)
    assert scope["status"] == "active"
    assert scope["exact_base"] == EXACT_BASE
    expected = {
        "apps/tai/governance/scopes/ap-13b3i-reg-ru-s3-compatibility-2954.json",
        "apps/tai/model-artifacts/reg-ru-s3-compatibility-authority.v1.json",
        "apps/tai/model-artifacts/reg-ru-s3-compatibility-probe.v1.sh",
        "apps/tai/model-artifacts/reg-ru-s3-compatibility-runbook.v1.md",
        "apps/tai/tai/reg_ru_s3_compatibility.py",
        "apps/tai/tai/reg_ru_s3_compatibility_cli.py",
        "apps/tai/tests/test_reg_ru_s3_compatibility.py",
        "docs/platform-v7/ai/immutable-bundle-storage-requirements.md",
    }
    assert set(scope["allowed_paths"]) == expected
    assert len(scope["allowed_paths"]) == len(expected)


def test_reg_ru_candidate_is_absent_from_active_profile_and_requirements() -> None:
    registry = TAI_ROOT / "tai/model_bundle_s3_preflight.py"
    requirements = TAI_ROOT / "model-artifacts/model-bundle-s3-preflight-requirements.v1.json"
    if registry.exists():
        module = importlib.import_module("tai.model_bundle_s3_preflight")
        supported = module.supported_provider_profiles()
        assert "REG_RU_S3_2026" not in supported
    if requirements.exists():
        assert _json(requirements)["provider_profile"] == "SELECTEL_S3_2026"


def test_attestation_binds_provider_evidence_and_rejects_guessed_selector(
    tmp_path: Path,
) -> None:
    authority = _json(AUTHORITY_PATH)
    attestation, path = _attestation(tmp_path)
    hashes = validate_attestation(authority, attestation, attestation_path=path)
    assert len(hashes["principal_selector_sha256"]) == 64
    for guessed in ("owner", KEY_SET_NAME, "*"):
        broken = json.loads(json.dumps(attestation))
        broken["principal_selector"] = {"AWS": guessed}
        with pytest.raises(ContractError):
            validate_attestation(authority, broken, attestation_path=path)


def test_target_drift_and_duplicate_json_fail_closed(tmp_path: Path) -> None:
    authority = _json(AUTHORITY_PATH)
    authority["target"]["bucket"] = "drifted-bucket"
    with pytest.raises(ContractError, match="TARGET_DRIFT"):
        validate_authority(authority)
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text('{"schema_version":"x","schema_version":"y"}', encoding="utf-8")
    with pytest.raises(ContractError, match="DUPLICATE_JSON_KEY"):
        load_json(duplicate)
    with pytest.raises(ContractError, match="JSON_UNREADABLE"):
        load_json(tmp_path / "missing.json")
    non_object = tmp_path / "non-object.json"
    non_object.write_text("[]", encoding="utf-8")
    with pytest.raises(ContractError, match="JSON_ROOT_NOT_OBJECT"):
        load_json(non_object)


@pytest.mark.parametrize(
    ("path", "value"),
    [
        (("workflow_allowed",), True),
        (("required_bucket_controls", "default_retention", "days"), 91),
        (("required_bucket_controls", "anonymous_denied_http_statuses"), [200]),
        (("required_bucket_controls", "unsupported_s3_apis"), ["waiver"]),
        (("principal", "provider_issued_attestation_required"), False),
        (("principal", "allowed_selector_keys"), ["AWS"]),
        (("principal", "allow_bucket_actions"), []),
        (("principal", "allow_object_actions"), []),
        (("principal", "forbidden_actions"), []),
        (("policy", "global_delete_deny_actions"), []),
        (("policy", "secure_transport_required"), False),
        (("policy", "preserve_unrelated_statements"), False),
        (("probe", "restore_previous_policy_on_failure"), False),
        (("probe", "delete_locked_versions"), True),
    ],
)
def test_authority_control_drift_fails_closed(
    path: tuple[str, ...],
    value: object,
) -> None:
    authority = _json(AUTHORITY_PATH)
    cursor: dict[str, Any] = authority
    for part in path[:-1]:
        cursor = cursor[part]
    cursor[path[-1]] = value
    with pytest.raises(ContractError):
        validate_authority(authority)


@pytest.mark.parametrize(
    "case",
    [
        "issued_at",
        "issuer_reference",
        "target",
        "matching_control",
        "bucket_actions",
        "object_actions",
        "forbidden_actions",
        "relative_evidence",
        "evidence_digest",
        "credential_material",
    ],
)
def test_attestation_semantic_drift_fails_closed(tmp_path: Path, case: str) -> None:
    authority = _json(AUTHORITY_PATH)
    attestation, attestation_path = _attestation(tmp_path)
    if case == "issued_at":
        attestation["issued_at"] = "not-a-date"
    elif case == "issuer_reference":
        attestation["issuer_reference"] = "short"
    elif case == "target":
        attestation["target"]["bucket"] = "drifted-bucket"
    elif case == "matching_control":
        attestation["nonmatching_control_selector"] = attestation["principal_selector"]
    elif case == "bucket_actions":
        attestation["attested_permissions"]["allow_bucket_actions"] = []
    elif case == "object_actions":
        attestation["attested_permissions"]["allow_object_actions"] = []
    elif case == "forbidden_actions":
        attestation["attested_permissions"]["forbidden_actions"] = []
    elif case == "relative_evidence":
        attestation["provider_evidence"]["path"] = "provider-evidence.json"
    elif case == "evidence_digest":
        attestation["provider_evidence"]["sha256"] = "0" * 64
    else:
        credential_key = "secret_access_key"
        attestation[credential_key] = case
    _private_json(attestation_path, attestation)
    with pytest.raises(ContractError):
        validate_attestation(authority, attestation, attestation_path=attestation_path)


def test_policy_preserves_unrelated_statements_and_rejects_broad_grant(
    tmp_path: Path,
) -> None:
    authority = _json(AUTHORITY_PATH)
    attestation, _ = _attestation(tmp_path)
    unrelated = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "KeepMe",
                "Effect": "Deny",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": "arn:aws:s3:::another-bucket/*",
            }
        ],
    }
    policy = build_bucket_policy(authority, attestation, unrelated, mode="final")
    assert policy["Statement"][0]["Sid"] == "KeepMe"
    validate_final_policy(authority, attestation, policy)
    policy["Statement"].append(
        {
            "Sid": "Bad",
            "Effect": "Allow",
            "Principal": attestation["principal_selector"],
            "Action": "s3:*",
            "Resource": f"arn:aws:s3:::{TARGET['bucket']}/*",
        }
    )
    with pytest.raises(ContractError, match="FINALIZER_BROAD_OBJECT_ALLOW"):
        validate_final_policy(authority, attestation, policy)


@pytest.mark.parametrize(
    "statement",
    [
        {
            "Sid": "PublicModels",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": (
                "arn:aws:s3:::tai-model-bundles-prod-01/"
                "tai/model-bundles/v1/models/*"
            ),
        },
        {
            "Sid": "FinalizerAcl",
            "Effect": "Allow",
            "Principal": {"AWS": "arn:regru:iam::account:principal/finalizer-0123456789"},
            "Action": "s3:PutObjectAcl",
            "Resource": (
                "arn:aws:s3:::tai-model-bundles-prod-01/"
                "tai/model-bundles/v1/models/*"
            ),
        },
        {
            "Sid": "PrincipalList",
            "Effect": "Allow",
            "Principal": {
                "AWS": [
                    "arn:regru:iam::account:principal/finalizer-0123456789",
                    "arn:regru:iam::account:principal/other-0123456789",
                ]
            },
            "Action": "s3:PutObject",
            "Resource": "arn:aws:s3:::tai-model-bundles-prod-01/*",
        },
        {
            "Sid": "NotResourceBypass",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "NotResource": "arn:aws:s3:::unrelated-bucket/*",
        },
    ],
)
def test_policy_rejects_subprefix_wildcard_and_not_resource_allows(
    tmp_path: Path,
    statement: dict[str, object],
) -> None:
    authority = _json(AUTHORITY_PATH)
    attestation, _ = _attestation(tmp_path)
    policy = build_bucket_policy(authority, attestation, None, mode="final")
    policy["Statement"].append(statement)
    with pytest.raises(ContractError):
        validate_final_policy(authority, attestation, policy)


@pytest.mark.parametrize(
    ("path", "value", "reason"),
    [
        (("privacy", "anonymous_list_http_status"), 200, "ANONYMOUS_LIST_NOT_DENIED"),
        (
            ("privacy", "anonymous_known_object_http_status"),
            200,
            "ANONYMOUS_KNOWN_OBJECT_GET_NOT_DENIED",
        ),
        (
            ("privacy", "anonymous_insecure_known_object_http_status"),
            301,
            "ANONYMOUS_INSECURE_GET_NOT_DENIED",
        ),
        (
            ("worm", "retention_deadline_90d"),
            False,
            "WORM_RETENTION_DEADLINE_UNPROVEN",
        ),
        (
            ("stream", "retention_deadline_90d"),
            False,
            "STREAM_RETENTION_DEADLINE_UNPROVEN",
        ),
        (
            ("worm", "exact_version_delete_denied"),
            False,
            "WORM_PROOF_FAILED:exact_version_delete_denied",
        ),
        (
            ("stream", "versionless_delete_denied"),
            False,
            "STREAM_PROOF_FAILED:versionless_delete_denied",
        ),
        (
            ("multipart", "absent_after_abort"),
            False,
            "MULTIPART_PROOF_FAILED:absent_after_abort",
        ),
        (
            ("privilege_denials", "same_policy_put_denied"),
            False,
            "FINALIZER_PRIVILEGE_DENIAL_UNPROVEN:same_policy_put_denied",
        ),
    ],
)
def test_evaluator_fails_closed_on_semantic_proof_loss(
    tmp_path: Path,
    path: tuple[str, str],
    value: object,
    reason: str,
) -> None:
    authority = _json(AUTHORITY_PATH)
    attestation, attestation_path = _attestation(tmp_path)
    hashes = validate_attestation(authority, attestation, attestation_path=attestation_path)
    policy = build_bucket_policy(authority, attestation, None, mode="final")
    observed = _observed(policy, hashes["principal_selector_sha256"])
    observed[path[0]][path[1]] = value
    report = evaluate_compatibility(
        authority, attestation, observed, attestation_hashes=hashes
    )
    assert report["status"] == "FAILED_CLOSED"
    assert reason in report["reasons"]
    assert report["finalization_allowed"] is False


def test_happy_report_is_sanitized_and_does_not_activate(tmp_path: Path) -> None:
    authority = _json(AUTHORITY_PATH)
    attestation, attestation_path = _attestation(tmp_path)
    hashes = validate_attestation(authority, attestation, attestation_path=attestation_path)
    policy = build_bucket_policy(authority, attestation, None, mode="final")
    report = evaluate_compatibility(
        authority,
        attestation,
        _observed(policy, hashes["principal_selector_sha256"]),
        attestation_hashes=hashes,
    )
    rendered = json.dumps(report, sort_keys=True)
    assert report["status"] == "VERIFIED_REG_RU_S3_COMPATIBILITY"
    assert report["github_secret_registration_allowed"] is False
    assert report["finalization_allowed"] is False
    assert report["production_operational_status"] == "NOT_ATTESTED"
    assert attestation["principal_selector"]["AWS"] not in rendered
    assert len(rendered.encode()) < 1048576


def test_cli_round_trip_covers_every_dormant_subcommand(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    attestation, attestation_path = _attestation(tmp_path)
    gate_path = tmp_path / "gate.json"
    assert (
        compatibility_cli_main(
            [
                "validate",
                "--authority",
                str(AUTHORITY_PATH),
                "--attestation",
                str(attestation_path),
                "--output",
                str(gate_path),
            ]
        )
        == 0
    )
    hashes = _json(gate_path)
    assert hashes["status"] == "LOCAL_ATTESTATION_VALID"
    assert gate_path.stat().st_mode & 0o777 == 0o600

    absent_policy = tmp_path / "absent-policy.txt"
    absent_policy.write_text("NO_BUCKET_POLICY\n", encoding="utf-8")
    final_policy_path = tmp_path / "final-policy.json"
    assert (
        compatibility_cli_main(
            [
                "build-policy",
                "--authority",
                str(AUTHORITY_PATH),
                "--attestation",
                str(attestation_path),
                "--existing-policy",
                str(absent_policy),
                "--mode",
                "final",
                "--output",
                str(final_policy_path),
            ]
        )
        == 0
    )
    final_policy = _json(final_policy_path)
    assert (
        compatibility_cli_main(
            [
                "validate-policy",
                "--authority",
                str(AUTHORITY_PATH),
                "--attestation",
                str(attestation_path),
                "--policy",
                str(final_policy_path),
            ]
        )
        == 0
    )

    canary_policy_path = tmp_path / "canary-policy.json"
    assert (
        compatibility_cli_main(
            [
                "build-policy",
                "--authority",
                str(AUTHORITY_PATH),
                "--attestation",
                str(attestation_path),
                "--existing-policy",
                str(final_policy_path),
                "--mode",
                "canary",
                "--canary-object-key",
                f"{TARGET['prefix']}/compatibility-probes/test/stream.bin",
                "--use-nonmatching-selector",
                "--output",
                str(canary_policy_path),
            ]
        )
        == 0
    )

    for policy_value, suffix in (
        (final_policy, "object"),
        (json.dumps(final_policy), "string"),
    ):
        wrapper_path = tmp_path / f"wrapper-{suffix}.json"
        _private_json(wrapper_path, {"Policy": policy_value})
        unwrapped_path = tmp_path / f"unwrapped-{suffix}.json"
        assert (
            compatibility_cli_main(
                [
                    "unwrap-policy",
                    "--aws-output",
                    str(wrapper_path),
                    "--output",
                    str(unwrapped_path),
                ]
            )
            == 0
        )
        assert _json(unwrapped_path) == final_policy

    observed_path = tmp_path / "observed.json"
    _private_json(
        observed_path,
        _observed(final_policy, hashes["principal_selector_sha256"]),
    )
    report_path = tmp_path / "report.json"
    assert (
        compatibility_cli_main(
            [
                "reserve-output",
                "--output",
                str(report_path),
            ]
        )
        == 0
    )
    assert report_path.read_bytes() == b""
    assert (
        compatibility_cli_main(
            [
                "evaluate",
                "--authority",
                str(AUTHORITY_PATH),
                "--attestation",
                str(attestation_path),
                "--observed",
                str(observed_path),
                "--output",
                str(report_path),
                "--reserved-output",
            ]
        )
        == 0
    )
    assert _json(report_path)["status"] == "VERIFIED_REG_RU_S3_COMPATIBILITY"

    invalid_wrapper = tmp_path / "invalid-wrapper.json"
    _private_json(invalid_wrapper, {"Policy": 7})
    assert (
        compatibility_cli_main(
            [
                "unwrap-policy",
                "--aws-output",
                str(invalid_wrapper),
                "--output",
                str(tmp_path / "must-not-exist.json"),
            ]
        )
        == 2
    )
    captured = capsys.readouterr()
    assert "POLICY_VALID" in captured.out
    assert "VERIFIED_REG_RU_S3_COMPATIBILITY" in captured.out
    assert "FAILED_CLOSED:AWS_BUCKET_POLICY_WRAPPER_INVALID" in captured.err


def test_cli_output_rejects_public_parent_existing_path_and_symlink(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    base_args = [
        "reserve-output",
        "--output",
    ]

    public_parent = tmp_path / "public-output"
    public_parent.mkdir(mode=0o700)
    public_parent.chmod(0o755)
    public_output = public_parent / "report.json"
    assert compatibility_cli_main([*base_args, str(public_output)]) == 2
    assert public_parent.stat().st_mode & 0o777 == 0o755
    assert not public_output.exists()

    private_parent = tmp_path / "private-output"
    private_parent.mkdir(mode=0o700)
    existing_output = private_parent / "existing.json"
    existing_output.write_text("sentinel", encoding="utf-8")
    existing_output.chmod(0o600)
    assert compatibility_cli_main([*base_args, str(existing_output)]) == 2
    assert existing_output.read_text(encoding="utf-8") == "sentinel"

    victim = private_parent / "victim.json"
    victim.write_text("victim", encoding="utf-8")
    victim.chmod(0o600)
    symlink_output = private_parent / "symlink.json"
    symlink_output.symlink_to(victim)
    assert compatibility_cli_main([*base_args, str(symlink_output)]) == 2
    assert victim.read_text(encoding="utf-8") == "victim"
    assert "FAILED_CLOSED:OUTPUT_" in capsys.readouterr().err


def test_private_output_reservation_preconditions_fail_closed(tmp_path: Path) -> None:
    with pytest.raises(ContractError, match="OUTPUT_PATH_NOT_ABSOLUTE"):
        ensure_private_output(Path("relative-report.json"))
    with pytest.raises(ContractError, match="OUTPUT_PARENT_INVALID"):
        ensure_private_output(tmp_path / "missing-parent" / "report.json")

    private_parent = tmp_path / "reservation-errors"
    private_parent.mkdir(mode=0o700)
    with pytest.raises(ContractError, match="OUTPUT_RESERVATION_MISSING"):
        ensure_private_output(private_parent / "missing.json", reserved=True)
    nonempty = private_parent / "nonempty.json"
    nonempty.write_text("occupied", encoding="utf-8")
    nonempty.chmod(0o600)
    with pytest.raises(ContractError, match="OUTPUT_RESERVATION_INVALID"):
        ensure_private_output(nonempty, reserved=True)


def test_probe_is_local_interactive_and_fail_closed_before_credentials() -> None:
    script = SCRIPT_PATH.read_text(encoding="utf-8")
    assert "reg_ru_s3_compatibility_cli validate" in script
    assert script.index("reg_ru_s3_compatibility_cli validate") < script.index(
        'read -rsp "REG.RU setup/admin Access Key ID'
    )
    assert script.index("reg_ru_s3_compatibility_cli reserve-output") < script.index(
        'read -rsp "REG.RU setup/admin Access Key ID'
    )
    dirty_index = script.index("POLICY_DIRTY=1")
    assert dirty_index < script.index("admin_aws s3api put-bucket-policy", dirty_index)
    assert "--no-verify-ssl" not in script
    for required in (
        'AWS_CA_BUNDLE="$CA_BUNDLE"',
        'REQUESTS_CA_BUNDLE="$CA_BUNDLE"',
        'AWS_REQUEST_CHECKSUM_CALCULATION="when_required"',
        'AWS_RESPONSE_CHECKSUM_VALIDATION="when_required"',
        "anonymous_known_object_http_status",
        "anonymous_insecure_known_object_http_status",
        "timedelta(days=89)",
        "MULTIPART_CLEANUP_ABORT_FAILED",
        "cleanup-multipart-list.json",
        "curl -q",
        "--proto '=https'",
        "_NOT_AUTHORIZATION_DENIAL",
        "_TRANSPORT_OR_SERVICE_FAILURE",
        "create-multipart-upload",
        "list-parts",
        "abort-multipart-upload",
        "put-bucket-lifecycle-configuration",
        "MAX_LOCKED_BYTES=9441280",
    ):
        assert required in script
    workflows = list((ROOT / ".github/workflows").glob("*.yml"))
    assert all(SCRIPT_PATH.name not in path.read_text(encoding="utf-8") for path in workflows)


def test_real_probe_rejects_malformed_attestation_before_prompt_or_tools(
    tmp_path: Path,
) -> None:
    malformed = (tmp_path / "malformed-attestation.json").resolve()
    malformed.write_text('{"schema_version":', encoding="utf-8")
    malformed.chmod(0o600)
    marker = tmp_path / "tool-called"
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_aws = fake_bin / "aws"
    fake_aws.write_text(
        f"#!/usr/bin/env bash\nprintf called > {marker!s}\nexit 97\n",
        encoding="utf-8",
    )
    fake_aws.chmod(0o700)
    result = subprocess.run(  # noqa: S603 - fixed absolute bash executes the repository probe.
        [
            "/usr/bin/bash",
            str(SCRIPT_PATH),
            "--authority",
            str(AUTHORITY_PATH),
            "--attestation",
            str(malformed),
            "--output",
            str(tmp_path / "report.json"),
        ],
        check=False,
        capture_output=True,
        text=True,
        env={
            "PATH": f"{fake_bin}:/usr/bin:/bin",
            "LC_ALL": "C",
            "PYTHONDONTWRITEBYTECODE": "1",
        },
    )
    assert result.returncode != 0
    assert "Access Key ID" not in result.stdout + result.stderr
    assert "INTERACTIVE_TTY_REQUIRED" not in result.stdout + result.stderr
    assert not marker.exists()
    assert not (tmp_path / "report.json").exists()
