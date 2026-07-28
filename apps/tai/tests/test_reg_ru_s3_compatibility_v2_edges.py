from __future__ import annotations

import copy
import importlib.util
import json
import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any

import pytest

from tai import reg_ru_s3_compatibility_v2 as probe

ROOT = Path(__file__).resolve().parents[1]
AUTHORITY_PATH = ROOT / "model-artifacts" / "reg-ru-s3-compatibility-authority.v2.json"
BASE_TEST_PATH = Path(__file__).with_name("test_reg_ru_s3_compatibility_v2.py")


class FakeClientError(Exception):
    def __init__(
        self,
        code: str,
        status: int,
        *,
        response: object | None = None,
    ) -> None:
        super().__init__(code)
        self.response = (
            response
            if response is not None
            else {
                "Error": {"Code": code, "Message": "redacted"},
                "ResponseMetadata": {
                    "HTTPStatusCode": status,
                    "RequestId": "request-id",
                },
            }
        )


class DummyConfig:
    def __init__(self, **kwargs: object) -> None:
        self.kwargs = kwargs


class TTY:
    def __init__(self) -> None:
        self.content = ""

    def isatty(self) -> bool:
        return True

    def write(self, value: str) -> int:
        self.content += value
        return len(value)

    def flush(self) -> None:
        return None


def authority() -> dict[str, object]:
    return probe.load_json(AUTHORITY_PATH)


def exact_policy() -> dict[str, object]:
    statements: list[dict[str, object]] = []
    for index, rule in enumerate(probe.EXPECTED_RULES):
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


def load_base_test_module() -> ModuleType:
    spec = importlib.util.spec_from_file_location("_tai_v2_base_tests", BASE_TEST_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def fake_sdk(base: ModuleType, state: Any) -> probe.Sdk:
    return probe.Sdk(
        boto3=base.FakeBoto3(state),
        botocore=base.FakeBotocore(),
        config_type=base.FakeConfig,
        client_error_type=base.FakeClientError,
        unsigned=object(),
    )


def fake_credentials() -> probe.CredentialSet:
    return probe.CredentialSet(
        admin=probe.Credentials("admin-id", "admin-secret"),
        finalizer=probe.Credentials("finalizer-id", "finalizer-secret"),
        control=probe.Credentials("control-id", "control-secret"),
    )


def test_load_json_rejects_duplicate_unreadable_and_non_object(tmp_path: Path) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text('{"a":1,"a":2}', encoding="utf-8")
    with pytest.raises(probe.ProbeFailure, match="DUPLICATE_JSON_KEY:a"):
        probe.load_json(duplicate)

    invalid = tmp_path / "invalid.json"
    invalid.write_text("{", encoding="utf-8")
    with pytest.raises(probe.ProbeFailure, match="AUTHORITY_JSON_UNREADABLE"):
        probe.load_json(invalid)

    root = tmp_path / "root.json"
    root.write_text("[]", encoding="utf-8")
    with pytest.raises(probe.ProbeFailure, match="AUTHORITY_JSON_ROOT_NOT_OBJECT"):
        probe.load_json(root)

    with pytest.raises(probe.ProbeFailure, match="AUTHORITY_JSON_UNREADABLE"):
        probe.load_json(tmp_path / "missing.json")


@pytest.mark.parametrize(
    ("mutator", "reason"),
    [
        (lambda payload: payload.__setitem__("workflow_allowed", True), "WORKFLOW_ALLOWED"),
        (lambda payload: payload.__setitem__("target", {}), "TARGET_DRIFT"),
        (lambda payload: payload.__setitem__("key_sets", {}), "KEY_SET_CONTRACT_DRIFT"),
        (
            lambda payload: payload.__setitem__("required_bucket_controls", {}),
            "BUCKET_CONTROL_REQUIREMENTS_DRIFT",
        ),
        (
            lambda payload: payload.__setitem__("admin_only_observation_actions", []),
            "ADMIN_ONLY_ACTIONS_DRIFT",
        ),
        (
            lambda payload: payload.__setitem__("finalizer_forbidden_actions", []),
            "FINALIZER_FORBIDDEN_ACTIONS_DRIFT",
        ),
        (lambda payload: payload.__setitem__("probe", {}), "PROBE_CONTRACT_DRIFT"),
        (
            lambda payload: payload.__setitem__("required_proofs", []),
            "REQUIRED_PROOFS_DRIFT",
        ),
        (lambda payload: payload.__setitem__("result", {}), "RESULT_CONTRACT_DRIFT"),
    ],
)
def test_authority_drift_paths(mutator: Any, reason: str) -> None:
    payload = authority()
    mutator(payload)
    with pytest.raises(probe.ProbeFailure, match=reason):
        probe.validate_authority(payload)


def test_policy_validation_defensive_paths() -> None:
    with pytest.raises(probe.ProbeFailure, match="POLICY_STATEMENT_INVALID"):
        probe.validate_panel_policy(authority(), {})

    statement_policy = exact_policy()["Statement"]
    assert isinstance(statement_policy, list)
    with pytest.raises(probe.ProbeFailure, match="TARGET_RULE_COUNT_NOT_SEVEN"):
        probe.validate_panel_policy(authority(), {"Statement": statement_policy[0]})

    cases: list[object] = [
        None,
        {"NotAction": "s3:GetObject", "Effect": "Allow"},
        {"Effect": "Maybe", "Action": "s3:GetObject", "Resource": "*"},
        {"Effect": "Allow", "Action": [], "Resource": "*"},
    ]
    for case in cases:
        with pytest.raises(probe.ProbeFailure):
            probe.validate_panel_policy(authority(), {"Statement": [case]})

    unrelated = exact_policy()
    statements = unrelated["Statement"]
    assert isinstance(statements, list)
    first = statements[0]
    assert isinstance(first, dict)
    first["Resource"] = "arn:aws:s3:::unrelated"
    with pytest.raises(probe.ProbeFailure, match="PANEL_RULE_NOT_EXACT"):
        probe.validate_panel_policy(authority(), unrelated)

    normalised = exact_policy()
    normalised_statements = normalised["Statement"]
    assert isinstance(normalised_statements, list)
    first = normalised_statements[0]
    assert isinstance(first, dict)
    actions = first["Action"]
    assert isinstance(actions, list)
    first["Action"] = [action.removeprefix("s3:") for action in actions]
    assert len(probe.validate_panel_policy(authority(), normalised)) == 64


class BareClientError(Exception):
    pass


def test_client_error_classifier_import_and_malformed_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_exceptions = SimpleNamespace(ClientError=FakeClientError)
    monkeypatch.setattr(
        probe.importlib,
        "import_module",
        lambda name: fake_exceptions if name == "botocore.exceptions" else ModuleType(name),
    )
    assert probe.classify_client_error(FakeClientError("AccessDenied", 403)) is not None
    assert probe.classify_client_error(BareClientError()) is None
    assert (
        probe.classify_client_error(
            FakeClientError("AccessDenied", 403, response="invalid"),
            client_error_type=FakeClientError,
        )
        is None
    )

    monkeypatch.setattr(
        probe.importlib,
        "import_module",
        lambda _name: (_ for _ in ()).throw(ImportError()),
    )
    assert probe.classify_client_error(FakeClientError("AccessDenied", 403)) is None

    monkeypatch.setattr(
        probe.importlib,
        "import_module",
        lambda _name: SimpleNamespace(ClientError="invalid"),
    )
    assert probe.classify_client_error(FakeClientError("AccessDenied", 403)) is None


def test_load_sdk_success_and_failure_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    boto3_module = SimpleNamespace(__version__="1.43.18")
    botocore_module = SimpleNamespace(__version__="1.43.18", UNSIGNED=object())
    config_module = SimpleNamespace(Config=DummyConfig)
    exceptions_module = SimpleNamespace(ClientError=FakeClientError)
    modules = {
        "boto3": boto3_module,
        "botocore": botocore_module,
        "botocore.config": config_module,
        "botocore.exceptions": exceptions_module,
    }
    monkeypatch.setattr(probe.importlib, "import_module", modules.__getitem__)
    sdk = probe.load_sdk()
    assert sdk.config_type is DummyConfig
    assert sdk.client_error_type is FakeClientError

    monkeypatch.setattr(
        probe.importlib,
        "import_module",
        lambda _name: (_ for _ in ()).throw(ImportError()),
    )
    with pytest.raises(probe.ProbeFailure, match="BOTO3_BOTOCORE_NOT_INSTALLED"):
        probe.load_sdk()

    for config_value, client_value, unsigned_value, reason in [
        (None, FakeClientError, object(), "BOTOCORE_CONFIG_UNAVAILABLE"),
        (DummyConfig, "invalid", object(), "BOTOCORE_CLIENT_ERROR_UNAVAILABLE"),
        (DummyConfig, FakeClientError, None, "BOTOCORE_UNSIGNED_UNAVAILABLE"),
    ]:
        values = {
            "boto3": boto3_module,
            "botocore": SimpleNamespace(
                __version__="1.43.18", UNSIGNED=unsigned_value
            ),
            "botocore.config": SimpleNamespace(Config=config_value),
            "botocore.exceptions": SimpleNamespace(ClientError=client_value),
        }
        monkeypatch.setattr(probe.importlib, "import_module", values.__getitem__)
        with pytest.raises(probe.ProbeFailure, match=reason):
            probe.load_sdk()


def test_output_reservation_and_report_failure_paths(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    with pytest.raises(probe.ProbeFailure, match="OUTPUT_PATH_NOT_ABSOLUTE"):
        probe.reserve_private_output(Path("relative.json"))
    with pytest.raises(probe.ProbeFailure, match="OUTPUT_PARENT_INVALID"):
        probe.reserve_private_output(tmp_path / "missing" / "report.json")

    os.chmod(tmp_path, 0o700)
    existing = tmp_path / "existing.json"
    existing.write_text("", encoding="utf-8")
    with pytest.raises(probe.ProbeFailure, match="OUTPUT_CREATE_FAILED"):
        probe.reserve_private_output(existing)

    with pytest.raises(probe.ProbeFailure, match="OUTPUT_RESERVATION_MISSING"):
        probe.write_reserved_report(tmp_path / "missing.json", {})

    invalid = tmp_path / "invalid-mode.json"
    invalid.write_text("", encoding="utf-8")
    os.chmod(invalid, 0o644)  # noqa: S103 - intentional rejection fixture
    with pytest.raises(probe.ProbeFailure, match="OUTPUT_RESERVATION_INVALID"):
        probe.write_reserved_report(invalid, {})

    reserved = tmp_path / "small.json"
    descriptor = probe.reserve_private_output(reserved)
    os.close(descriptor)
    monkeypatch.setattr(probe, "MAXIMUM_REPORT_BYTES", 1)
    with pytest.raises(probe.ProbeFailure, match="SANITIZED_REPORT_TOO_LARGE"):
        probe.write_reserved_report(reserved, {"x": "value"})


def test_main_success_and_failure_paths(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    os.chmod(tmp_path, 0o700)
    tty_in = TTY()
    tty_out = TTY()
    monkeypatch.setattr(probe.sys, "stdin", tty_in)
    monkeypatch.setattr(probe.sys, "stdout", tty_out)
    output = tmp_path / "success.json"
    monkeypatch.setattr(probe, "load_sdk", lambda: SimpleNamespace())
    monkeypatch.setattr(probe, "read_credentials_once", fake_credentials)
    monkeypatch.setattr(
        probe,
        "run_probe",
        lambda *_args, **_kwargs: probe.failed_report(authority(), "TEST", None),
    )
    assert (
        probe.main(
            ["--authority", str(AUTHORITY_PATH), "--output", str(output)]
        )
        == 0
    )
    assert json.loads(output.read_text())["status"] == "FAILED_CLOSED"

    interrupt_output = tmp_path / "interrupt.json"
    monkeypatch.setattr(
        probe,
        "load_json",
        lambda _path: (_ for _ in ()).throw(KeyboardInterrupt()),
    )
    assert (
        probe.main(
            [
                "--authority",
                str(AUTHORITY_PATH),
                "--output",
                str(interrupt_output),
            ]
        )
        == 2
    )

    unexpected_output = tmp_path / "unexpected.json"
    monkeypatch.setattr(
        probe,
        "load_json",
        lambda _path: (_ for _ in ()).throw(TypeError("boom")),
    )
    assert (
        probe.main(
            [
                "--authority",
                str(AUTHORITY_PATH),
                "--output",
                str(unexpected_output),
            ]
        )
        == 2
    )


def test_main_rejects_non_tty(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(probe.sys.stdin, "isatty", lambda: False)
    assert (
        probe.main(
            [
                "--authority",
                str(AUTHORITY_PATH),
                "--output",
                str(tmp_path / "unused.json"),
            ]
        )
        == 2
    )


def test_call_observation_lifecycle_and_policy_helpers() -> None:
    assert probe._call("OK", lambda: 7, FakeClientError) == 7
    with pytest.raises(probe.ProbeFailure, match="UNEXPECTED_CLIENT_ERROR"):
        probe._call(
            "FAIL",
            lambda: (_ for _ in ()).throw(FakeClientError("InternalError", 500)),
            FakeClientError,
        )

    assert probe._observe_allowed_or_denied("VISIBLE", lambda: None, FakeClientError) == {
        "status": "VISIBLE"
    }
    denied = probe._observe_allowed_or_denied(
        "DENIED",
        lambda: (_ for _ in ()).throw(FakeClientError("AccessDenied", 403)),
        FakeClientError,
    )
    assert denied["status"] == "DENIED"
    with pytest.raises(probe.ProbeFailure, match="UNEXPECTED_CLIENT_ERROR"):
        probe._observe_allowed_or_denied(
            "ERROR",
            lambda: (_ for _ in ()).throw(FakeClientError("InternalError", 500)),
            FakeClientError,
        )

    class LifecycleClient:
        def __init__(self, response: object) -> None:
            self.response = response

        def get_bucket_lifecycle_configuration(self, **_kwargs: object) -> object:
            if isinstance(self.response, BaseException):
                raise self.response
            return self.response

    assert probe._read_optional_lifecycle(
        LifecycleClient(FakeClientError("NoSuchLifecycleConfiguration", 404)),
        "bucket",
        FakeClientError,
    ) is None
    assert probe._read_optional_lifecycle(
        LifecycleClient({"Rules": [{"ID": "x"}]}), "bucket", FakeClientError
    ) == {"Rules": [{"ID": "x"}]}
    with pytest.raises(probe.ProbeFailure, match="LIFECYCLE_RULES_INVALID"):
        probe._read_optional_lifecycle(
            LifecycleClient({"Rules": "invalid"}), "bucket", FakeClientError
        )
    with pytest.raises(probe.ProbeFailure, match="UNEXPECTED_CLIENT_ERROR"):
        probe._read_optional_lifecycle(
            LifecycleClient(FakeClientError("InternalError", 500)),
            "bucket",
            FakeClientError,
        )

    assert probe._extract_policy({"Policy": {"Statement": []}}) == {
        "Statement": []
    }
    with pytest.raises(probe.ProbeFailure, match="BUCKET_POLICY_JSON_INVALID"):
        probe._extract_policy({"Policy": "{"})
    with pytest.raises(probe.ProbeFailure, match="BUCKET_POLICY_NOT_OBJECT"):
        probe._extract_policy({"Policy": []})


@pytest.mark.parametrize(
    ("location", "versioning", "lock", "reason"),
    [
        (
            {"LocationConstraint": "wrong"},
            {"Status": "Enabled"},
            {
                "ObjectLockConfiguration": {
                    "ObjectLockEnabled": "Enabled",
                    "Rule": {
                        "DefaultRetention": {"Mode": "COMPLIANCE", "Days": 90}
                    },
                }
            },
            "BUCKET_LOCATION_MISMATCH",
        ),
        ({}, {}, {}, "VERSIONING_NOT_ENABLED"),
        (
            {},
            {"Status": "Enabled"},
            {"ObjectLockConfiguration": {}},
            "OBJECT_LOCK_NOT_ENABLED",
        ),
        (
            {},
            {"Status": "Enabled"},
            {"ObjectLockConfiguration": {"ObjectLockEnabled": "Enabled"}},
            "DEFAULT_RETENTION_NOT_COMPLIANCE_90D",
        ),
    ],
)
def test_bucket_configuration_errors(
    location: object, versioning: object, lock: object, reason: str
) -> None:
    with pytest.raises(probe.ProbeFailure, match=reason):
        probe._validate_bucket_configuration(location, versioning, lock, "us-east-1")


def test_stream_version_listing_and_resume_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    class VersionClient:
        def __init__(self, response: object, head: object | None = None) -> None:
            self.response = response
            self.head = head or {"ContentLength": probe.STREAM_OBJECT_BYTES}

        def list_object_versions(self, **_kwargs: object) -> object:
            return self.response

        def head_object(self, **_kwargs: object) -> object:
            return self.head

    with pytest.raises(probe.ProbeFailure, match="STREAM_DELETE_MARKER_PRESENT"):
        probe._list_exact_stream_versions(
            VersionClient(
                {
                    "Versions": [],
                    "DeleteMarkers": [{"Key": probe.STREAM_KEY}],
                }
            ),
            "bucket",
            probe.STREAM_KEY,
            FakeClientError,
        )

    client = VersionClient({"Versions": [], "DeleteMarkers": []})
    assert (
        probe._list_exact_stream_versions(
            client, "bucket", probe.STREAM_KEY, FakeClientError
        )
        == []
    )

    with pytest.raises(probe.ProbeFailure, match="EXISTING_STREAM_VERSION_ID_MISSING"):
        probe._upload_or_resume_stream(
            finalizer=client,
            bucket="bucket",
            existing_versions=[{}],
            client_error_type=FakeClientError,
        )

    with pytest.raises(probe.ProbeFailure, match="EXISTING_STREAM_SIZE_INVALID"):
        probe._upload_or_resume_stream(
            finalizer=VersionClient({}, {"ContentLength": 1}),
            bucket="bucket",
            existing_versions=[{"VersionId": "v1"}],
            client_error_type=FakeClientError,
        )

    monkeypatch.setattr(probe, "_restore_exact_version_sha256", lambda *_args: "bad")
    with pytest.raises(probe.ProbeFailure, match="EXISTING_STREAM_SHA256_INVALID"):
        probe._upload_or_resume_stream(
            finalizer=VersionClient({}),
            bucket="bucket",
            existing_versions=[{"VersionId": "v1"}],
            client_error_type=FakeClientError,
        )

    expected = probe._deterministic_stream_sha256()
    monkeypatch.setattr(
        probe, "_restore_exact_version_sha256", lambda *_args: expected
    )
    resumed = probe._upload_or_resume_stream(
        finalizer=VersionClient({}),
        bucket="bucket",
        existing_versions=[{"VersionId": "v1"}],
        client_error_type=FakeClientError,
    )
    assert resumed["mode"] == "RESUMED_EXISTING_SINGLE_OBJECT"


class Body:
    def __init__(self, values: list[object]) -> None:
        self.values = iter(values)
        self.closed = False

    def read(self, _size: int) -> object:
        return next(self.values)

    def close(self) -> None:
        self.closed = True


class ObjectClient:
    def __init__(self, response: object) -> None:
        self.response = response

    def get_object(self, **_kwargs: object) -> object:
        return self.response


def test_restore_body_failure_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(probe.ProbeFailure, match="STREAM_BODY_MISSING"):
        probe._restore_exact_version_sha256(
            ObjectClient({}), "bucket", "key", "version", FakeClientError
        )

    body = Body(["not-bytes"])
    with pytest.raises(probe.ProbeFailure, match="STREAM_BODY_CHUNK_INVALID"):
        probe._restore_exact_version_sha256(
            ObjectClient({"Body": body}),
            "bucket",
            "key",
            "version",
            FakeClientError,
        )
    assert body.closed is True

    monkeypatch.setattr(probe, "STREAM_OBJECT_BYTES", 3)
    short = Body([b"x", b""])
    with pytest.raises(probe.ProbeFailure, match="RESTORED_STREAM_SIZE_INVALID"):
        probe._restore_exact_version_sha256(
            ObjectClient({"Body": short}),
            "bucket",
            "key",
            "version",
            FakeClientError,
        )

    valid = Body([b"abc", b""])
    digest = probe._restore_exact_version_sha256(
        ObjectClient({"Body": valid}),
        "bucket",
        "key",
        "version",
        FakeClientError,
    )
    assert len(digest) == 64


@pytest.mark.parametrize(
    ("retention", "reason"),
    [
        ({"Mode": "GOVERNANCE"}, "STREAM_RETENTION_MODE_INVALID"),
        (
            {"Mode": "COMPLIANCE", "RetainUntilDate": "invalid"},
            "STREAM_RETENTION_DATE_INVALID",
        ),
        ({"Mode": "COMPLIANCE"}, "STREAM_RETENTION_DATE_MISSING"),
        (
            {"Mode": "COMPLIANCE", "RetainUntilDate": datetime.now()},
            "STREAM_RETENTION_DATE_NAIVE",
        ),
        (
            {
                "Mode": "COMPLIANCE",
                "RetainUntilDate": datetime.now(UTC) + timedelta(days=10),
            },
            "STREAM_RETENTION_DEADLINE_NOT_90D",
        ),
    ],
)
def test_retention_failure_paths(retention: object, reason: str) -> None:
    with pytest.raises(probe.ProbeFailure, match=reason):
        probe._validate_object_retention({"Retention": retention})


def test_retention_string_success() -> None:
    date = datetime.now(UTC) + timedelta(days=90)
    result = probe._validate_object_retention(
        {"Retention": {"Mode": "COMPLIANCE", "RetainUntilDate": date.isoformat()}}
    )
    assert result["mode"] == "COMPLIANCE"


def test_delete_denial_allowed_marker_and_cleanup_paths() -> None:
    cleanup = probe.CleanupState()

    class DeniedDelete:
        def delete_object(self, **_kwargs: object) -> None:
            raise FakeClientError("AccessDenied", 403)

    result = probe._expect_delete_denied(
        label="DELETE",
        client=DeniedDelete(),
        admin=DeniedDelete(),
        bucket="bucket",
        key="key",
        version_id=None,
        cleanup=cleanup,
        client_error_type=FakeClientError,
    )
    assert result["http_status"] == 403

    class UnexpectedDelete:
        def delete_object(self, **_kwargs: object) -> dict[str, object]:
            return {}

    with pytest.raises(probe.ProbeFailure, match="DENIAL_EXPECTED_BUT_ALLOWED"):
        probe._expect_delete_denied(
            label="DELETE",
            client=UnexpectedDelete(),
            admin=UnexpectedDelete(),
            bucket="bucket",
            key="key",
            version_id="v1",
            cleanup=cleanup,
            client_error_type=FakeClientError,
        )

    class MarkerDelete:
        def __init__(self) -> None:
            self.calls = 0

        def delete_object(self, **_kwargs: object) -> dict[str, object]:
            self.calls += 1
            return {"DeleteMarker": True, "VersionId": "marker"}

    marker = MarkerDelete()
    with pytest.raises(probe.ProbeFailure, match="DENIAL_EXPECTED_BUT_ALLOWED"):
        probe._expect_delete_denied(
            label="DELETE",
            client=marker,
            admin=marker,
            bucket="bucket",
            key="key",
            version_id=None,
            cleanup=cleanup,
            client_error_type=FakeClientError,
        )
    assert marker.calls == 2
    assert cleanup.unexpected_delete_marker_version is None


def test_cleanup_success_and_error_paths() -> None:
    class Client:
        def __init__(self, fail: bool = False) -> None:
            self.fail = fail
            self.aborts = 0
            self.deletes = 0

        def abort_multipart_upload(self, **_kwargs: object) -> None:
            self.aborts += 1
            if self.fail:
                raise OSError("abort")

        def delete_object(self, **_kwargs: object) -> None:
            self.deletes += 1
            if self.fail:
                raise OSError("delete")

    good = Client()
    state = probe.CleanupState(
        admin_client=good,
        finalizer_client=good,
        open_finalizer_upload=("key-a", "upload-a"),
        open_control_upload=("key-b", "upload-b"),
        unexpected_delete_marker_version="marker",
    )
    assert probe._cleanup(state, "bucket", FakeClientError) == []
    assert good.aborts == 2
    assert good.deletes == 1

    bad = Client(fail=True)
    bad_state = probe.CleanupState(
        admin_client=bad,
        finalizer_client=bad,
        open_finalizer_upload=("key-a", "upload-a"),
        open_control_upload=("key-b", "upload-b"),
        unexpected_delete_marker_version="marker",
    )
    errors = probe._cleanup(bad_state, "bucket", FakeClientError)
    assert len(errors) == 3


@pytest.mark.parametrize(
    ("endpoint", "region", "bucket", "prefix", "ca", "reason"),
    [
        (
            "http://s3.regru.cloud",
            "us-east-1",
            "tai-model-bundles-prod-01",
            "tai/model-bundles/v1",
            "/etc/ssl/certs/ca-certificates.crt",
            "ENDPOINT_NOT_EXACT_HTTPS",
        ),
        (
            "https://s3.regru.cloud/path",
            "us-east-1",
            "tai-model-bundles-prod-01",
            "tai/model-bundles/v1",
            "/etc/ssl/certs/ca-certificates.crt",
            "ENDPOINT_PATH_QUERY_FRAGMENT_FORBIDDEN",
        ),
        (
            "https://s3.regru.cloud",
            "wrong",
            "tai-model-bundles-prod-01",
            "tai/model-bundles/v1",
            "/etc/ssl/certs/ca-certificates.crt",
            "REGION_NOT_EXACT",
        ),
        (
            "https://s3.regru.cloud",
            "us-east-1",
            "wrong",
            "tai/model-bundles/v1",
            "/etc/ssl/certs/ca-certificates.crt",
            "BUCKET_NOT_EXACT",
        ),
        (
            "https://s3.regru.cloud",
            "us-east-1",
            "tai-model-bundles-prod-01",
            "wrong",
            "/etc/ssl/certs/ca-certificates.crt",
            "PREFIX_NOT_EXACT",
        ),
        (
            "https://s3.regru.cloud",
            "us-east-1",
            "tai-model-bundles-prod-01",
            "tai/model-bundles/v1",
            "/missing-ca",
            "CA_BUNDLE_INVALID",
        ),
    ],
)
def test_runtime_target_rejections(
    endpoint: str,
    region: str,
    bucket: str,
    prefix: str,
    ca: str,
    reason: str,
) -> None:
    with pytest.raises(probe.ProbeFailure, match=reason):
        probe._validate_runtime_target(endpoint, region, bucket, prefix, ca)


def test_report_sanitization_and_helper_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(probe.ProbeFailure, match="CREDENTIAL_MATERIAL_IN_REPORT"):
        probe._validate_sanitized_report({"x": "aws_secret_access_key"})
    monkeypatch.setattr(probe, "MAXIMUM_REPORT_BYTES", 1)
    with pytest.raises(probe.ProbeFailure, match="SANITIZED_REPORT_TOO_LARGE"):
        probe._validate_sanitized_report({"x": "value"})

    assert probe._is_not_found_client_error(OSError(), FakeClientError) is False
    assert (
        probe._is_not_found_client_error(
            FakeClientError("x", 0, response="invalid"), FakeClientError
        )
        is False
    )
    assert (
        probe._is_not_found_client_error(
            FakeClientError("NoSuchKey", 404), FakeClientError
        )
        is True
    )
    assert probe._touches_target(["arn:aws:s3:::unrelated"]) is False
    assert probe._touches_target(["*"]) is True
    assert probe._touches_target(["arn:aws:s3:::tai-model-bundles-prod-01/*"]) is True
    assert probe._normalise_action("GetObject") == "s3:GetObject"
    assert probe._normalise_condition(None) == {}
    assert probe._normalise_condition({"b": [2, 1]}) == {"b": [1, 2]}
    assert probe._principal_is_global("*") is True
    assert probe._principal_is_global({"AWS": ["x", "*"]}) is True
    assert probe._principal_is_global(None) is False
    assert probe._mapping([]) == {}
    assert probe._list_of_mappings("x") == []
    assert probe._list_of_mappings([{}, "x"]) == [{}]
    assert probe._text(1) == ""
    assert probe._integer(True) is None
    assert probe._integer(1) == 1
    assert probe._string_list("x") == []
    assert probe._string_list(["x", 1]) == ["x"]
    assert probe._string_or_list("x") == ["x"]
    errors: list[str] = []
    probe._expect("a", "b", "REASON", errors)
    assert errors == ["REASON"]
    with pytest.raises(probe.ProbeFailure, match="A,B"):
        probe._raise_errors(["B", "A", "A"])
    assert probe._safe_token("a/b c") == "a_b_c"


def test_run_probe_resume_lifecycle_and_pre_mutation_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    base = load_base_test_module()
    state = base.FakeS3State()
    state.stream_payload = b"T" * probe.STREAM_OBJECT_BYTES

    def configured_lifecycle(self: Any, **_kwargs: object) -> dict[str, object]:
        if self.role != "admin":
            self.state.denied()
        return {"Rules": [{"ID": "keep"}]}

    monkeypatch.setattr(
        base.FakeS3Client,
        "get_bucket_lifecycle_configuration",
        configured_lifecycle,
    )
    report = probe.run_probe(
        authority(),
        fake_credentials(),
        fake_sdk(base, state),
        confirmation_reader=lambda _message: probe.CONFIRMATION,
    )
    assert report["stream"]["mode"] == "RESUMED_EXISTING_SINGLE_OBJECT"
    assert report["lifecycle"]["status"] == "CONFIGURED_AND_FINALIZER_DENIED"

    mismatch_state = base.FakeS3State()
    with pytest.raises(probe.ProbeFailure, match="CONFIRMATION_MISMATCH"):
        probe.run_probe(
            authority(),
            fake_credentials(),
            fake_sdk(base, mismatch_state),
            confirmation_reader=lambda _message: "wrong",
        )

    original_list_versions = base.FakeS3Client.list_object_versions

    def two_versions(self: Any, **kwargs: object) -> dict[str, object]:
        if self.role == "finalizer":
            return {
                "Versions": [
                    {"Key": probe.STREAM_KEY, "VersionId": "v1"},
                    {"Key": probe.STREAM_KEY, "VersionId": "v2"},
                ],
                "DeleteMarkers": [],
            }
        return original_list_versions(self, **kwargs)

    monkeypatch.setattr(base.FakeS3Client, "list_object_versions", two_versions)
    with pytest.raises(probe.ProbeFailure, match="MULTIPLE_EXISTING_STREAM_VERSIONS"):
        probe.run_probe(
            authority(),
            fake_credentials(),
            fake_sdk(base, base.FakeS3State()),
            confirmation_reader=lambda _message: probe.CONFIRMATION,
        )


def test_run_probe_control_write_and_multipart_failure_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    base = load_base_test_module()
    original_create = base.FakeS3Client.create_multipart_upload

    def control_allowed(self: Any, **kwargs: object) -> dict[str, object]:
        if self.role == "control":
            upload_id = "control-upload"
            self.state.multipart[upload_id] = {"key": kwargs["Key"], "parts": {}}
            return {"UploadId": upload_id}
        return original_create(self, **kwargs)

    monkeypatch.setattr(base.FakeS3Client, "create_multipart_upload", control_allowed)
    with pytest.raises(
        probe.ProbeFailure,
        match="DENIAL_EXPECTED_BUT_ALLOWED:CONTROL_CREATE_MULTIPART",
    ):
        probe.run_probe(
            authority(),
            fake_credentials(),
            fake_sdk(base, base.FakeS3State()),
            confirmation_reader=lambda _message: probe.CONFIRMATION,
        )

    def missing_id(self: Any, **kwargs: object) -> dict[str, object]:
        if self.role == "finalizer":
            return {}
        return original_create(self, **kwargs)

    monkeypatch.setattr(base.FakeS3Client, "create_multipart_upload", missing_id)
    with pytest.raises(probe.ProbeFailure, match="MULTIPART_UPLOAD_ID_MISSING"):
        probe.run_probe(
            authority(),
            fake_credentials(),
            fake_sdk(base, base.FakeS3State()),
            confirmation_reader=lambda _message: probe.CONFIRMATION,
        )
