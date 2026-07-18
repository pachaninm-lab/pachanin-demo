from __future__ import annotations

from collections.abc import Sequence
from contextlib import AbstractContextManager
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from tai.model_runtime import (
    LocalModelProfile,
    ModelCapability,
    ModelProfileStatus,
    ModelRuntimeClass,
    ModelRuntimeHealth,
    ModelRuntimeStatus,
)
from tai.postgres_model_runtime import PostgreSQLModelRuntimeRepository

NOW = datetime(2026, 7, 18, 13, 0, tzinfo=UTC)


class FakeCursor(AbstractContextManager["FakeCursor"]):
    def __init__(
        self,
        rows: list[dict[str, Any] | None],
        *,
        fail: bool = False,
    ) -> None:
        self.rows = list(rows)
        self.fail = fail
        self.query = ""
        self.parameters: tuple[Any, ...] = ()

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        if self.fail:
            raise RuntimeError("database failure")
        self.query = query
        self.parameters = tuple(parameters)

    def fetchone(self) -> dict[str, Any] | None:
        if not self.rows:
            return None
        return self.rows.pop(0)


class FakeConnection(AbstractContextManager["FakeConnection"]):
    def __init__(
        self,
        rows: list[dict[str, Any] | None],
        *,
        fail: bool = False,
    ) -> None:
        self.cursor_instance = FakeCursor(rows, fail=fail)
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> FakeConnection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class FakeFactory:
    def __init__(
        self,
        rows: list[dict[str, Any] | None],
        *,
        fail: bool = False,
    ) -> None:
        self.connection = FakeConnection(rows, fail=fail)

    def __call__(self) -> FakeConnection:
        return self.connection


def _profile() -> LocalModelProfile:
    return LocalModelProfile(
        model_id="tai-russian-8b",
        revision="q4-r1",
        artifact_locator="file:///models/tai-russian-8b.gguf",
        artifact_sha256="a" * 64,
        license_ref="Apache-2.0",
        capabilities=frozenset(
            {ModelCapability.TEXT_GENERATION, ModelCapability.RUSSIAN}
        ),
        maximum_context_tokens=8_192,
        maximum_output_tokens=2_048,
        runtime_class=ModelRuntimeClass.CPU,
        quantization="Q4_K_M",
        routing_priority=10,
    )


def _health() -> ModelRuntimeHealth:
    return ModelRuntimeHealth(
        model_id="tai-russian-8b",
        revision="q4-r1",
        status=ModelRuntimeStatus.READY,
        available_slots=4,
        queue_depth=1,
        p95_latency_ms=850,
        observed_at=NOW,
        circuit_open_until=None,
    )


def test_register_profile_is_digest_and_policy_idempotent() -> None:
    factory = FakeFactory([{"model_id": "tai-russian-8b"}])

    PostgreSQLModelRuntimeRepository(factory).register_profile(_profile())

    cursor = factory.connection.cursor_instance
    assert "ON CONFLICT (model_id, revision) DO UPDATE" in cursor.query
    assert "artifact_sha256 = EXCLUDED.artifact_sha256" in cursor.query
    assert cursor.parameters[0:5] == (
        "tai-russian-8b",
        "q4-r1",
        "file:///models/tai-russian-8b.gguf",
        "a" * 64,
        "Apache-2.0",
    )
    assert cursor.parameters[5] == ["RUSSIAN", "TEXT_GENERATION"]
    assert cursor.parameters[10] == 10
    assert factory.connection.committed is True


def test_register_profile_rejects_identity_rebinding() -> None:
    repository = PostgreSQLModelRuntimeRepository(FakeFactory([None]))

    with pytest.raises(RuntimeError, match="different artifact"):
        repository.register_profile(_profile())


def test_status_update_uses_optimistic_concurrency() -> None:
    factory = FakeFactory([{"version": 8}])
    repository = PostgreSQLModelRuntimeRepository(factory)

    accepted = repository.update_profile_status(
        model_id="tai-russian-8b",
        revision="q4-r1",
        expected_version=7,
        status=ModelProfileStatus.DRAINING,
    )

    assert accepted is True
    assert "version = version + 1" in factory.connection.cursor_instance.query
    assert factory.connection.cursor_instance.parameters == (
        "DRAINING",
        "tai-russian-8b",
        "q4-r1",
        7,
    )
    assert (
        PostgreSQLModelRuntimeRepository(FakeFactory([None])).update_profile_status(
            model_id="tai-russian-8b",
            revision="q4-r1",
            expected_version=7,
            status=ModelProfileStatus.DISABLED,
        )
        is False
    )


def test_status_update_validates_identity_and_version() -> None:
    repository = PostgreSQLModelRuntimeRepository(FakeFactory([]))

    with pytest.raises(ValueError, match="model_id"):
        repository.update_profile_status(
            model_id=" ",
            revision="q4-r1",
            expected_version=1,
            status=ModelProfileStatus.DISABLED,
        )
    with pytest.raises(ValueError, match="expected_version"):
        repository.update_profile_status(
            model_id="model",
            revision="revision",
            expected_version=0,
            status=ModelProfileStatus.DISABLED,
        )


def test_health_upsert_rejects_stale_observation() -> None:
    factory = FakeFactory([{"model_id": "tai-russian-8b"}])
    repository = PostgreSQLModelRuntimeRepository(factory)

    assert repository.record_health(_health()) is True
    cursor = factory.connection.cursor_instance
    assert "observed_at <= EXCLUDED.observed_at" in cursor.query
    assert cursor.parameters[2:7] == ("READY", 4, 1, 850, NOW)
    assert (
        PostgreSQLModelRuntimeRepository(FakeFactory([None])).record_health(_health())
        is False
    )


def test_list_profiles_and_health_map_database_rows() -> None:
    profile_row = {
        "model_id": "tai-russian-8b",
        "revision": "q4-r1",
        "artifact_locator": "file:///models/tai-russian-8b.gguf",
        "artifact_sha256": "a" * 64,
        "license_ref": "Apache-2.0",
        "capabilities": ["TEXT_GENERATION", "RUSSIAN"],
        "maximum_context_tokens": 8_192,
        "maximum_output_tokens": 2_048,
        "runtime_class": "CPU",
        "quantization": "Q4_K_M",
        "routing_priority": 10,
        "status": "ACTIVE",
    }
    health_row = {
        "model_id": "tai-russian-8b",
        "revision": "q4-r1",
        "status": "DEGRADED",
        "available_slots": 2,
        "queue_depth": 3,
        "p95_latency_ms": 1_400,
        "observed_at": NOW,
        "circuit_open_until": NOW + timedelta(seconds=30),
    }

    profiles = PostgreSQLModelRuntimeRepository(
        FakeFactory([profile_row, None])
    ).list_profiles()
    health = PostgreSQLModelRuntimeRepository(
        FakeFactory([health_row, None])
    ).list_health()

    assert profiles == (_profile(),)
    assert health[0].status is ModelRuntimeStatus.DEGRADED
    assert health[0].circuit_open_until == NOW + timedelta(seconds=30)


def test_invalid_database_capability_shape_fails_closed() -> None:
    row = {
        "model_id": "model",
        "revision": "r1",
        "artifact_locator": "file:///models/model.gguf",
        "artifact_sha256": "a" * 64,
        "license_ref": "Apache-2.0",
        "capabilities": "TEXT_GENERATION",
        "maximum_context_tokens": 2_048,
        "maximum_output_tokens": 512,
        "runtime_class": "CPU",
        "quantization": "Q4",
        "routing_priority": 10,
        "status": "ACTIVE",
    }

    with pytest.raises(TypeError, match="array"):
        PostgreSQLModelRuntimeRepository(FakeFactory([row, None])).list_profiles()


def test_database_failure_rolls_back() -> None:
    factory = FakeFactory([], fail=True)

    with pytest.raises(RuntimeError, match="database failure"):
        PostgreSQLModelRuntimeRepository(factory).record_health(_health())

    assert factory.connection.committed is False
    assert factory.connection.rolled_back is True
