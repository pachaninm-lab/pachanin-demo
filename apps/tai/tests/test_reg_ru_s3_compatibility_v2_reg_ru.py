from __future__ import annotations

from typing import Any

import pytest

from tai import reg_ru_s3_compatibility_v2 as verifier
from tai import reg_ru_s3_compatibility_v2_reg_ru as adapter


def enabled_lock() -> dict[str, object]:
    return {
        "ObjectLockConfiguration": {
            "ObjectLockEnabled": "Enabled",
            "Rule": {
                "DefaultRetention": {"Mode": "COMPLIANCE", "Days": 90}
            },
        }
    }


@pytest.mark.parametrize(
    ("location", "status", "value"),
    [
        (None, "EMPTY_OR_ABSENT", None),
        ("", "EMPTY_OR_ABSENT", None),
        ("ru-1", "PROVIDER_VALUE_PRESENT", "ru-1"),
        ("us-east-1", "PROVIDER_VALUE_PRESENT", "us-east-1"),
        ("REG.RU:S3", "PROVIDER_VALUE_PRESENT", "REG.RU:S3"),
    ],
)
def test_provider_location_is_observed_not_pinned(
    location: object, status: str, value: str | None
) -> None:
    result = adapter.validate_reg_ru_bucket_configuration(
        {"LocationConstraint": location},
        {"Status": "Enabled"},
        enabled_lock(),
        "us-east-1",
    )
    assert result["location_observation_status"] == status
    assert result["location_constraint"] == value
    assert result["location_semantics"] == (
        "OBSERVED_NOT_PINNED_TO_SIGNING_REGION"
    )
    assert result["signing_region"] == "us-east-1"
    assert result["versioning_status"] == "Enabled"
    assert result["object_lock_status"] == "Enabled"
    assert result["retention_mode"] == "COMPLIANCE"
    assert result["retention_days"] == 90


@pytest.mark.parametrize(
    "location",
    [object(), "bad value", "x" * 129, "\n", "-leading-dash"],
)
def test_malformed_provider_location_fails_closed(location: object) -> None:
    with pytest.raises(
        verifier.ProbeFailure, match="BUCKET_LOCATION_RESPONSE_INVALID"
    ):
        adapter.validate_reg_ru_bucket_configuration(
            {"LocationConstraint": location},
            {"Status": "Enabled"},
            enabled_lock(),
            "us-east-1",
        )


@pytest.mark.parametrize(
    ("versioning", "lock", "reason"),
    [
        ({}, enabled_lock(), "VERSIONING_NOT_ENABLED"),
        ({"Status": "Enabled"}, {}, "OBJECT_LOCK_NOT_ENABLED"),
        (
            {"Status": "Enabled"},
            {"ObjectLockConfiguration": {"ObjectLockEnabled": "Enabled"}},
            "DEFAULT_RETENTION_NOT_COMPLIANCE_90D",
        ),
    ],
)
def test_existing_bucket_controls_remain_fail_closed(
    versioning: object, lock: object, reason: str
) -> None:
    with pytest.raises(verifier.ProbeFailure, match=reason):
        adapter.validate_reg_ru_bucket_configuration(
            {"LocationConstraint": "ru-1"},
            versioning,
            lock,
            "us-east-1",
        )


def test_adapter_installs_only_location_validator(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sentinel = object()
    monkeypatch.setattr(verifier, "_validate_bucket_configuration", sentinel)
    adapter.install_reg_ru_location_semantics()
    assert verifier._validate_bucket_configuration is (
        adapter.validate_reg_ru_bucket_configuration
    )


def test_adapter_main_delegates_after_install(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, Any]] = []

    def fake_install() -> None:
        calls.append(("install", None))

    def fake_main(argv: list[str] | None = None) -> int:
        calls.append(("main", argv))
        return 17

    monkeypatch.setattr(adapter, "install_reg_ru_location_semantics", fake_install)
    monkeypatch.setattr(verifier, "main", fake_main)
    assert adapter.main(["--authority", "a", "--output", "b"]) == 17
    assert calls == [
        ("install", None),
        ("main", ["--authority", "a", "--output", "b"]),
    ]
