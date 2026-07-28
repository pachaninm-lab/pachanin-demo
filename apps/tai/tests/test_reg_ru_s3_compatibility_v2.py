from __future__ import annotations

import copy
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from tai.reg_ru_s3_compatibility_v2 import (
    CONFIRMATION,
    EXPECTED_RULES,
    STREAM_OBJECT_BYTES,
    TARGET,
    VERIFIED_STATUS,
    CredentialSet,
    Credentials,
    ProbeFailure,
    Sdk,
    authority_sha256,
    classify_client_error,
    expect_authorization_denied,
    failed_report,
    load_json,
    read_credentials_once,
    reserve_private_output,
    run_probe,
    validate_authority,
    validate_panel_policy,
    write_reserved_report,
)

ROOT = Path(__file__).resolve().parents[1]
AUTHORITY_PATH = ROOT / "model-artifacts" / "reg-ru-s3-compatibility-authority.v2.json"
PROBE_PATH = ROOT / "model-artifacts" / "reg-ru-s3-compatibility-probe.v2.sh"
RUNBOOK_PATH = ROOT / "model-artifacts" / "reg-ru-s3-compatibility-runbook.v2.md"


class FakeClientError(Exception):
    def __init__(self, code: str, status: int, *, request_id: str = "req") -> None:
        super().__init__(code)
        self.response = {
            "Error": {"Code": code, "Message": "redacted"},
            "ResponseMetadata": {
                "HTTPStatusCode": status,
                "RequestId": request_id,
            },
        }


def authority() -> dict[str, object]:
    return load_json(AUTHORITY_PATH)


def exact_policy() -> dict[str, object]:
    statements: list[dict[str, object]] = []
    for index, rule in enumerate(EXPECTED_RULES):
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


def test_committed_authority_is_exact() -> None:
    payload = authority()
    validate_authority(payload)
    assert len(authority_sha256(payload)) == 64


def test_authority_rejects_control_deny_drift() -> None:
    payload = authority()
    rules = copy.deepcopy(payload["panel_rules"])
    assert isinstance(rules, list)
    control_rule = rules[-1]
    assert isinstance(control_rule, dict)
    actions = control_rule["actions"]
    assert isinstance(actions, list)
    actions.remove("s3:GetObject")
    payload["panel_rules"] = rules
    with pytest.raises(ProbeFailure, match="PANEL_RULE_SET_DRIFT"):
        validate_authority(payload)


def test_exact_seven_rule_policy_validates() -> None:
    digest = validate_panel_policy(authority(), exact_policy())
    assert len(digest) == 64


def test_policy_rejects_eighth_target_rule() -> None:
    policy = exact_policy()
    statements = policy["Statement"]
    assert isinstance(statements, list)
    statements.append(copy.deepcopy(statements[0]))
    with pytest.raises(ProbeFailure, match="TARGET_RULE_COUNT_NOT_SEVEN"):
        validate_panel_policy(authority(), policy)


def test_policy_rejects_global_principal() -> None:
    policy = exact_policy()
    statements = policy["Statement"]
    assert isinstance(statements, list)
    first = statements[0]
    assert isinstance(first, dict)
    first["Principal"] = "*"
    with pytest.raises(ProbeFailure, match="GLOBAL_PRINCIPAL_ON_TARGET"):
        validate_panel_policy(authority(), policy)


def test_access_denied_requires_client_error_and_http_status() -> None:
    denial = classify_client_error(
        FakeClientError("AccessDenied", 403), client_error_type=FakeClientError
    )
    assert denial is not None
    assert denial.http_status == 403
    assert denial.error_code == "AccessDenied"


@pytest.mark.parametrize(
    ("code", "status"),
    [("AccessDenied", 500), ("NoSuchKey", 404), ("InternalError", 403)],
)
def test_non_authorization_client_errors_are_not_denials(code: str, status: int) -> None:
    assert (
        classify_client_error(
            FakeClientError(code, status), client_error_type=FakeClientError
        )
        is None
    )


def test_expected_denial_rejects_success() -> None:
    with pytest.raises(ProbeFailure, match="DENIAL_EXPECTED_BUT_ALLOWED"):
        expect_authorization_denied(
            "PUT", lambda: {"ok": True}, client_error_type=FakeClientError
        )


def test_expected_denial_rejects_network_error() -> None:
    with pytest.raises(ProbeFailure, match="UNEXPECTED_SDK_ERROR:GET:OSError"):
        expect_authorization_denied(
            "GET",
            lambda: (_ for _ in ()).throw(OSError("network")),
            client_error_type=FakeClientError,
        )


def test_credentials_are_prompted_exactly_once_and_key_ids_are_distinct() -> None:
    prompts: list[str] = []
    values = iter(
        [
            "admin-id",
            "admin-secret",
            "finalizer-id",
            "finalizer-secret",
            "control-id",
            "control-secret",
        ]
    )

    def prompt(message: str) -> str:
        prompts.append(message)
        return next(values)

    result = read_credentials_once(prompt=prompt)
    assert result.admin.access_key_id == "admin-id"
    assert result.finalizer.access_key_id == "finalizer-id"
    assert result.control.access_key_id == "control-id"
    assert len(prompts) == 6


def test_credentials_reject_key_collision() -> None:
    values = iter(["same", "a", "same", "b", "control", "c"])
    with pytest.raises(ProbeFailure, match="ACCESS_KEY_ID_COLLISION"):
        read_credentials_once(prompt=lambda _message: next(values))


def test_private_output_reservation_and_write(tmp_path: Path) -> None:
    os.chmod(tmp_path, 0o700)
    output = tmp_path / "report.json"
    descriptor = reserve_private_output(output)
    os.close(descriptor)
    report = failed_report(authority(), "TEST_FAILURE", None)
    write_reserved_report(output, report)
    payload = json.loads(output.read_text())
    assert payload["status"] == "FAILED_CLOSED"
    assert payload["finalization_allowed"] is False
    assert output.stat().st_mode & 0o777 == 0o600


def test_private_output_rejects_non_private_parent(tmp_path: Path) -> None:
    os.chmod(tmp_path, 0o755)
    with pytest.raises(ProbeFailure, match="OUTPUT_PARENT_NOT_PRIVATE"):
        reserve_private_output(tmp_path / "report.json")


def test_failed_report_retains_candidate_boundary() -> None:
    report = failed_report(authority(), "TEST_FAILURE", None)
    assert report["profile_state"] == "CANDIDATE_NOT_ACTIVE"
    assert report["finalization_allowed"] is False
    assert report["production_operational_status"] == "NOT_ATTESTED"
    assert report["bundle_upload_status"] == "NOT_RUN"
    assert STREAM_OBJECT_BYTES == 9437184
    assert TARGET["bucket"] == "tai-model-bundles-prod-01"


class FakeBody:
    def __init__(self, payload: bytes) -> None:
        self._payload = payload
        self._offset = 0
        self.closed = False

    def read(self, size: int = -1) -> bytes:
        if size < 0:
            size = len(self._payload) - self._offset
        chunk = self._payload[self._offset : self._offset + size]
        self._offset += len(chunk)
        return chunk

    def close(self) -> None:
        self.closed = True


class FakeConfig:
    def __init__(self, **kwargs: object) -> None:
        self.kwargs = kwargs


class FakeS3State:
    def __init__(self) -> None:
        self.policy = exact_policy()
        self.stream_payload: bytes | None = None
        self.stream_version = "version-1"
        self.multipart: dict[str, dict[str, object]] = {}
        self.next_upload_id = 1
        self.retain_until = datetime.now(UTC) + timedelta(days=90)

    def denied(self, code: str = "AccessDenied", status: int = 403) -> None:
        raise FakeClientError(code, status)


class FakeS3Client:
    def __init__(self, role: str, state: FakeS3State) -> None:
        self.role = role
        self.state = state

    def get_bucket_location(self, **_kwargs: object) -> dict[str, object]:
        return {"LocationConstraint": "us-east-1"}

    def get_bucket_versioning(self, **_kwargs: object) -> dict[str, object]:
        return {"Status": "Enabled"}

    def get_object_lock_configuration(self, **_kwargs: object) -> dict[str, object]:
        if self.role != "admin":
            self.state.denied()
        return {
            "ObjectLockConfiguration": {
                "ObjectLockEnabled": "Enabled",
                "Rule": {
                    "DefaultRetention": {"Mode": "COMPLIANCE", "Days": 90}
                },
            }
        }

    def get_bucket_policy(self, **_kwargs: object) -> dict[str, object]:
        if self.role != "admin":
            self.state.denied()
        return {"Policy": json.dumps(self.state.policy)}

    def list_objects_v2(self, **_kwargs: object) -> dict[str, object]:
        if self.role in {"control", "anonymous"}:
            self.state.denied()
        return {"Contents": []}

    def list_object_versions(self, **_kwargs: object) -> dict[str, object]:
        if self.role == "control":
            self.state.denied()
        if self.state.stream_payload is None:
            return {"Versions": [], "DeleteMarkers": []}
        return {
            "Versions": [
                {
                    "Key": "tai/model-bundles/v1/compatibility-probes/reg-ru-panel-v2/stream.bin",
                    "VersionId": self.state.stream_version,
                    "IsLatest": True,
                }
            ],
            "DeleteMarkers": [],
        }

    def list_multipart_uploads(self, **kwargs: object) -> dict[str, object]:
        if self.role in {"control", "anonymous"}:
            self.state.denied()
        prefix = str(kwargs.get("Prefix", ""))
        uploads = [
            {"Key": key, "UploadId": upload_id}
            for upload_id, item in self.state.multipart.items()
            for key in [str(item["key"])]
            if key.startswith(prefix)
        ]
        return {"Uploads": uploads}

    def get_bucket_lifecycle_configuration(self, **_kwargs: object) -> dict[str, object]:
        if self.role != "admin":
            self.state.denied()
        raise FakeClientError("NoSuchLifecycleConfiguration", 404)

    def put_bucket_policy(self, **_kwargs: object) -> None:
        self.state.denied()

    def put_bucket_versioning(self, **_kwargs: object) -> None:
        self.state.denied()

    def put_object_lock_configuration(self, **_kwargs: object) -> None:
        self.state.denied()

    def put_bucket_lifecycle_configuration(self, **_kwargs: object) -> None:
        self.state.denied()

    def create_multipart_upload(self, **kwargs: object) -> dict[str, object]:
        if self.role != "finalizer":
            self.state.denied()
        upload_id = f"upload-{self.state.next_upload_id}"
        self.state.next_upload_id += 1
        self.state.multipart[upload_id] = {"key": kwargs["Key"], "parts": {}}
        return {"UploadId": upload_id}

    def list_parts(self, **kwargs: object) -> dict[str, object]:
        if self.role != "finalizer":
            self.state.denied()
        upload_id = str(kwargs["UploadId"])
        parts_value = self.state.multipart[upload_id]["parts"]
        assert isinstance(parts_value, dict)
        parts = [
            {"PartNumber": number, "Size": len(payload)}
            for number, payload in sorted(parts_value.items())
        ]
        return {"Parts": parts}

    def abort_multipart_upload(self, **kwargs: object) -> dict[str, object]:
        if self.role not in {"finalizer", "admin"}:
            self.state.denied()
        self.state.multipart.pop(str(kwargs["UploadId"]), None)
        return {}

    def upload_part(self, **kwargs: object) -> dict[str, object]:
        if self.role != "finalizer":
            self.state.denied()
        upload_id = str(kwargs["UploadId"])
        body = kwargs["Body"]
        assert isinstance(body, bytes)
        parts_value = self.state.multipart[upload_id]["parts"]
        assert isinstance(parts_value, dict)
        parts_value[int(kwargs["PartNumber"])] = body
        return {"ETag": "etag"}

    def put_object(self, **kwargs: object) -> dict[str, object]:
        if self.role != "finalizer":
            self.state.denied()
        body = kwargs["Body"]
        assert hasattr(body, "read")
        payload = body.read()
        assert isinstance(payload, bytes)
        self.state.stream_payload = payload
        return {"VersionId": self.state.stream_version, "ETag": "etag"}

    def head_object(self, **_kwargs: object) -> dict[str, object]:
        assert self.state.stream_payload is not None
        return {
            "ContentLength": len(self.state.stream_payload),
            "VersionId": self.state.stream_version,
        }

    def get_object_retention(self, **_kwargs: object) -> dict[str, object]:
        if self.role != "admin":
            self.state.denied()
        return {
            "Retention": {
                "Mode": "COMPLIANCE",
                "RetainUntilDate": self.state.retain_until,
            }
        }

    def put_object_retention(self, **_kwargs: object) -> None:
        self.state.denied()

    def delete_object(self, **_kwargs: object) -> None:
        self.state.denied()

    def get_object(self, **_kwargs: object) -> dict[str, object]:
        if self.role in {"control", "anonymous"}:
            self.state.denied()
        assert self.state.stream_payload is not None
        return {"Body": FakeBody(self.state.stream_payload)}


class FakeBoto3:
    __version__ = "1.43.18"

    def __init__(self, state: FakeS3State) -> None:
        self.state = state

    def client(self, _service: str, **kwargs: object) -> FakeS3Client:
        access_key_id = kwargs.get("aws_access_key_id")
        if access_key_id == "admin-id":
            role = "admin"
        elif access_key_id == "finalizer-id":
            role = "finalizer"
        elif access_key_id == "control-id":
            role = "control"
        else:
            role = "anonymous"
        return FakeS3Client(role, self.state)


class FakeBotocore:
    __version__ = "1.43.18"


def test_run_probe_end_to_end_with_fake_s3() -> None:
    if not Path("/etc/ssl/certs/ca-certificates.crt").is_file():
        pytest.skip("system CA bundle not present")
    state = FakeS3State()
    sdk = Sdk(
        boto3=FakeBoto3(state),
        botocore=FakeBotocore(),
        config_type=FakeConfig,
        client_error_type=FakeClientError,
        unsigned=object(),
    )
    credentials = CredentialSet(
        admin=Credentials("admin-id", "admin-secret"),
        finalizer=Credentials("finalizer-id", "finalizer-secret"),
        control=Credentials("control-id", "control-secret"),
    )
    report = run_probe(
        authority(),
        credentials,
        sdk,
        confirmation_reader=lambda _message: CONFIRMATION,
    )
    assert report["status"] == VERIFIED_STATUS
    assert report["finalization_allowed"] is False
    assert state.stream_payload == b"T" * STREAM_OBJECT_BYTES
    assert state.multipart == {}
    denials = report["denials"]
    assert isinstance(denials, dict)
    assert denials["control_known_object_get"]["http_status"] == 403


def test_wrapper_uses_boto3_only_and_sanitizes_inherited_environment() -> None:
    text = PROBE_PATH.read_text(encoding="utf-8")
    assert "aws s3" not in text
    assert "aws s3api" not in text
    assert "AWS_ACCESS_KEY_ID" in text
    assert "unset PYTHONHOME PYTHONPATH" in text
    assert 'EXPECTED_BOTO3="1.43.18"' in text
    assert "-m tai.reg_ru_s3_compatibility_v2" in text


def test_runbook_preserves_single_run_candidate_boundary() -> None:
    text = RUNBOOK_PATH.read_text(encoding="utf-8")
    assert "Single final command" in text
    assert "CANDIDATE_NOT_ACTIVE" in text
    assert "finalization_allowed=false" in text
    assert "/tai finalize model-bundles exact-main" in text
