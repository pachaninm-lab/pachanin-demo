from __future__ import annotations

import os
from pathlib import Path
from types import SimpleNamespace

import pytest

from tai import reg_ru_s3_compatibility_v2 as probe

ROOT = Path(__file__).resolve().parents[1]
AUTHORITY_PATH = ROOT / "model-artifacts" / "reg-ru-s3-compatibility-authority.v2.json"


class FakeClientError(Exception):
    def __init__(self, code: str, status: int) -> None:
        super().__init__(code)
        self.response = {
            "Error": {"Code": code},
            "ResponseMetadata": {"HTTPStatusCode": status},
        }


class TTY:
    def isatty(self) -> bool:
        return True

    def write(self, value: str) -> int:
        return len(value)

    def flush(self) -> None:
        return None


def credentials() -> probe.CredentialSet:
    return probe.CredentialSet(
        admin=probe.Credentials("admin", "secret-a"),
        finalizer=probe.Credentials("finalizer", "secret-b"),
        control=probe.Credentials("control", "secret-c"),
    )


def test_empty_credential_and_private_parent_guards(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    values = iter(["admin", "", "finalizer", "b", "control", "c"])
    with pytest.raises(probe.ProbeFailure, match="EMPTY_CREDENTIAL"):
        probe.read_credentials_once(prompt=lambda _message: next(values))

    real_parent = tmp_path / "private"
    real_parent.mkdir(mode=0o700)
    alias = tmp_path / "alias"
    alias.symlink_to(real_parent, target_is_directory=True)
    with pytest.raises(
        probe.ProbeFailure, match="OUTPUT_PARENT_NOT_CANONICAL_DIRECTORY"
    ):
        probe.reserve_private_output(alias / "report.json")

    os.chmod(real_parent, 0o700)
    actual_uid = os.geteuid()
    monkeypatch.setattr(probe.os, "geteuid", lambda: actual_uid + 1)
    with pytest.raises(probe.ProbeFailure, match="OUTPUT_PARENT_NOT_OWNED"):
        probe.reserve_private_output(real_parent / "report.json")


def test_report_open_and_reservation_change_fail_closed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    os.chmod(tmp_path, 0o700)
    report = tmp_path / "report.json"
    descriptor = probe.reserve_private_output(report)
    os.close(descriptor)

    monkeypatch.setattr(
        probe.os,
        "open",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(OSError("open")),
    )
    with pytest.raises(probe.ProbeFailure, match="OUTPUT_RESERVATION_OPEN_FAILED"):
        probe.write_reserved_report(report, {})

    monkeypatch.undo()
    changed = tmp_path / "changed.json"
    descriptor = probe.reserve_private_output(changed)
    os.close(descriptor)
    original_fstat = probe.os.fstat

    def changed_fstat(fd: int) -> object:
        current = original_fstat(fd)
        return SimpleNamespace(st_dev=current.st_dev + 1, st_ino=current.st_ino)

    monkeypatch.setattr(probe.os, "fstat", changed_fstat)
    with pytest.raises(probe.ProbeFailure, match="OUTPUT_RESERVATION_CHANGED"):
        probe.write_reserved_report(changed, {})


def test_main_retains_original_failure_when_report_write_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    os.chmod(tmp_path, 0o700)
    monkeypatch.setattr(probe.sys, "stdin", TTY())
    monkeypatch.setattr(probe.sys, "stdout", TTY())
    sdk = SimpleNamespace(
        boto3=SimpleNamespace(__version__="test"),
        botocore=SimpleNamespace(__version__="test"),
    )
    monkeypatch.setattr(probe, "load_sdk", lambda: sdk)
    monkeypatch.setattr(probe, "read_credentials_once", credentials)
    monkeypatch.setattr(
        probe,
        "run_probe",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            probe.ProbeFailure("ORIGINAL_FAILURE")
        ),
    )

    def fail_write(_path: Path, _report: object) -> None:
        raise probe.ProbeFailure("REPORT_WRITE_FAILED")

    monkeypatch.setattr(probe, "write_reserved_report", fail_write)
    output = tmp_path / "failed.json"
    assert (
        probe.main(
            ["--authority", str(AUTHORITY_PATH), "--output", str(output)]
        )
        == 2
    )


def test_new_stream_fallback_and_single_version_bound(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(probe, "STREAM_OBJECT_BYTES", 3)

    class MissingVersionClient:
        def put_object(self, **_kwargs: object) -> dict[str, object]:
            return {}

        def head_object(self, **_kwargs: object) -> dict[str, object]:
            return {}

    with pytest.raises(probe.ProbeFailure, match="NEW_STREAM_VERSION_ID_MISSING"):
        probe._upload_or_resume_stream(
            finalizer=MissingVersionClient(),
            bucket="bucket",
            existing_versions=[],
            client_error_type=FakeClientError,
        )

    class WrongVersionClient:
        def put_object(self, **_kwargs: object) -> dict[str, object]:
            return {}

        def head_object(self, **_kwargs: object) -> dict[str, object]:
            return {"VersionId": "v1"}

        def list_object_versions(self, **_kwargs: object) -> dict[str, object]:
            return {
                "Versions": [
                    {"Key": probe.STREAM_KEY, "VersionId": "different"}
                ],
                "DeleteMarkers": [],
            }

    with pytest.raises(
        probe.ProbeFailure, match="STREAM_SINGLE_VERSION_BOUND_VIOLATED"
    ):
        probe._upload_or_resume_stream(
            finalizer=WrongVersionClient(),
            bucket="bucket",
            existing_versions=[],
            client_error_type=FakeClientError,
        )


def test_delete_non_authorization_error_is_not_accepted() -> None:
    class Client:
        def delete_object(self, **_kwargs: object) -> None:
            raise FakeClientError("InternalError", 500)

    with pytest.raises(probe.ProbeFailure, match="UNEXPECTED_CLIENT_ERROR"):
        probe._expect_delete_denied(
            label="DELETE",
            client=Client(),
            admin=Client(),
            bucket="bucket",
            key="key",
            version_id="v1",
            cleanup=probe.CleanupState(),
            client_error_type=FakeClientError,
        )
