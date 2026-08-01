from __future__ import annotations

from contextlib import AbstractContextManager
from dataclasses import dataclass
from typing import Any

import pytest

from tai.main import ReadinessStatus
from tai.restricted_model_authority import (
    RestrictedModelAuthorityError,
    RestrictedModelOperationalAuthority,
    RestrictedModelOperationalReadinessProbe,
)

MODEL_ID = "tai-qwen3-8b-q4km"
REVISION = "artifact-" + "a" * 64
ARTIFACT_SHA256 = "a" * 64
ACTIVATION_SHA = "b" * 40


@dataclass
class _Cursor(AbstractContextManager["_Cursor"]):
    row: dict[str, int] | None
    executed: tuple[str, tuple[Any, ...]] | None = None

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: tuple[Any, ...]) -> None:
        self.executed = (query, parameters)

    def fetchone(self) -> dict[str, int] | None:
        return self.row


@dataclass
class _Connection(AbstractContextManager["_Connection"]):
    row: dict[str, int] | None
    committed: bool = False
    rolled_back: bool = False

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> _Cursor:
        return _Cursor(self.row)

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class _Delegate:
    def __init__(self, ready: bool = True) -> None:
        self.ready = ready

    def check(self) -> ReadinessStatus:
        reasons = () if self.ready else ("DEPENDENCY_BLOCKED",)
        return ReadinessStatus(
            self.ready,
            {"postgresql": "ready" if self.ready else "unavailable"},
            reasons,
        )


def _authority() -> RestrictedModelOperationalAuthority:
    return RestrictedModelOperationalAuthority(
        model_id=MODEL_ID,
        revision=REVISION,
        artifact_sha256=ARTIFACT_SHA256,
        activation_sha=ACTIVATION_SHA,
    )


def test_environment_authority_is_absent_without_explicit_enablement() -> None:
    assert RestrictedModelOperationalAuthority.from_environment({}) is None


def test_environment_authority_requires_exact_values() -> None:
    with pytest.raises(RestrictedModelAuthorityError):
        RestrictedModelOperationalAuthority.from_environment(
            {"TAI_RESTRICTED_MODEL_OPERATIONAL": "yes"}
        )

    authority = RestrictedModelOperationalAuthority.from_environment(
        {
            "TAI_RESTRICTED_MODEL_OPERATIONAL": "true",
            "TAI_RESTRICTED_MODEL_ID": MODEL_ID,
            "TAI_RESTRICTED_MODEL_REVISION": REVISION,
            "TAI_RESTRICTED_MODEL_ARTIFACT_SHA256": ARTIFACT_SHA256,
            "TAI_RESTRICTED_ACTIVATION_SHA": ACTIVATION_SHA,
        }
    )
    assert authority == _authority()


def test_restricted_authority_passes_without_fabricating_permanent_admission() -> None:
    connection = _Connection(
        {"active_count": 1, "matching_count": 1, "admitted_count": 0}
    )
    probe = RestrictedModelOperationalReadinessProbe(
        delegate=_Delegate(),
        connection_factory=lambda: connection,
        authority=_authority(),
    )

    result = probe.check()

    assert result.ready is True
    assert result.reasons == ()
    assert result.components["restricted_model"] == "authorized"
    assert result.components["model_admission"] == "not_attested"
    assert result.components["model_activation"] == ACTIVATION_SHA
    assert connection.committed is True


def test_restricted_authority_reports_permanent_admission_when_real_record_exists() -> None:
    probe = RestrictedModelOperationalReadinessProbe(
        delegate=_Delegate(),
        connection_factory=lambda: _Connection(
            {"active_count": 1, "matching_count": 1, "admitted_count": 1}
        ),
        authority=_authority(),
    )

    result = probe.check()

    assert result.ready is True
    assert result.components["model_admission"] == "accepted"


@pytest.mark.parametrize(
    "row",
    [
        {"active_count": 0, "matching_count": 0, "admitted_count": 0},
        {"active_count": 1, "matching_count": 0, "admitted_count": 0},
        {"active_count": 2, "matching_count": 1, "admitted_count": 0},
    ],
)
def test_restricted_authority_fails_closed_on_profile_mismatch(row: dict[str, int]) -> None:
    probe = RestrictedModelOperationalReadinessProbe(
        delegate=_Delegate(),
        connection_factory=lambda: _Connection(row),
        authority=_authority(),
    )

    result = probe.check()

    assert result.ready is False
    assert "RESTRICTED_MODEL_AUTHORITY_INVALID" in result.reasons
    assert result.components["restricted_model"] == "invalid"


def test_restricted_authority_preserves_delegate_failure() -> None:
    probe = RestrictedModelOperationalReadinessProbe(
        delegate=_Delegate(ready=False),
        connection_factory=lambda: _Connection(
            {"active_count": 1, "matching_count": 1, "admitted_count": 0}
        ),
        authority=_authority(),
    )

    result = probe.check()

    assert result.ready is False
    assert result.reasons == ("DEPENDENCY_BLOCKED",)
    assert result.components["restricted_model"] == "authorized"
