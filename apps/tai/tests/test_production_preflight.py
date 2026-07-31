from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from contextlib import nullcontext
from typing import Any

import pytest

import tai.production_preflight as module
from tai.production_preflight import (
    DatabaseEvidence,
    PostgreSQLEvidenceRepository,
    PreflightConfig,
    PreflightConfigurationError,
    ProductionPreflight,
    run_from_environment,
)


def _environment() -> dict[str, str]:
    return {
        "TAI_DATABASE_URL": "postgresql://tai:secret@postgres.internal:5432/tai",
        "TAI_PREFLIGHT_MODEL_ENDPOINT": (
            "http://192.168.0.206:18080/v1/chat/completions"
        ),
        "TAI_MODEL_BEARER_TOKEN": "t" * 48,
        "TAI_ALLOWED_MODEL_HOSTS_JSON": '["192.168.0.206"]',
    }


class _Repository:
    def __init__(self, value: DatabaseEvidence | Exception) -> None:
        self.value = value

    def collect(self) -> DatabaseEvidence:
        if isinstance(self.value, Exception):
            raise self.value
        return self.value


class _Transport:
    def __init__(self, value: Mapping[str, Any] | Exception) -> None:
        self.value = value
        self.calls: list[tuple[str, Mapping[str, Any], float, int]] = []

    def post_json(
        self,
        endpoint: str,
        payload: Mapping[str, Any],
        *,
        timeout_seconds: float,
        maximum_response_bytes: int,
    ) -> Mapping[str, Any]:
        self.calls.append(
            (endpoint, payload, timeout_seconds, maximum_response_bytes)
        )
        if isinstance(self.value, Exception):
            raise self.value
        return self.value


def _evidence(**overrides: Any) -> DatabaseEvidence:
    values: dict[str, Any] = {
        "relation_count": len(module._REQUIRED_RELATIONS),
        "missing_count": 0,
        "denied_count": 0,
        "active_generation": True,
        "chunk_count": 10,
        "active_models": (("tai-qwen3-8b-q4km", True),),
    }
    values.update(overrides)
    return DatabaseEvidence(**values)


def _preflight(
    evidence: DatabaseEvidence | Exception,
    response: Mapping[str, Any] | Exception | None = None,
) -> tuple[ProductionPreflight, _Transport]:
    transport = _Transport(
        response
        or {"choices": [{"message": {"content": "TAI_PREFLIGHT_OK"}}]}
    )
    return (
        ProductionPreflight(
            repository=_Repository(evidence),
            transport=transport,
            endpoint="http://192.168.0.206:18080/v1/chat/completions",
            timeout=10.0,
            response_budget=4_096,
        ),
        transport,
    )


def test_preflight_accepts_complete_authority_without_sensitive_output() -> None:
    preflight, transport = _preflight(_evidence())

    report = preflight.run()
    serialized = json.dumps(report.json(), sort_keys=True)

    assert report.accepted is True
    assert report.reasons == ()
    assert report.evidence["model_probe"] == "passed"
    assert "tai-qwen3-8b-q4km" not in serialized
    assert "192.168.0.206" not in serialized
    assert "TAI_PREFLIGHT_OK" not in serialized
    assert transport.calls[0][1]["model"] == "tai-qwen3-8b-q4km"


@pytest.mark.parametrize(
    ("evidence", "reasons"),
    [
        (
            _evidence(missing_count=2, active_models=()),
            {"POSTGRESQL_SCHEMA_INCOMPLETE"},
        ),
        (
            _evidence(denied_count=1, active_models=()),
            {"POSTGRESQL_SELECT_DENIED"},
        ),
        (
            _evidence(active_generation=False, chunk_count=0),
            {"KNOWLEDGE_GENERATION_UNAVAILABLE"},
        ),
        (
            _evidence(active_models=()),
            {"ACTIVE_MODEL_PROFILE_UNAVAILABLE"},
        ),
        (
            _evidence(active_models=(("model", False),)),
            {"MODEL_ARTIFACT_NOT_ADMITTED"},
        ),
    ],
)
def test_preflight_reports_governed_blockers(
    evidence: DatabaseEvidence,
    reasons: set[str],
) -> None:
    preflight, transport = _preflight(evidence)

    report = preflight.run()

    assert report.accepted is False
    assert set(report.reasons) == reasons
    if evidence.missing_count or evidence.denied_count or not evidence.active_models:
        assert transport.calls == []


@pytest.mark.parametrize(
    "response",
    [
        {"choices": []},
        {"choices": [{"message": {"content": "wrong"}}]},
        RuntimeError("model unavailable"),
    ],
)
def test_preflight_fails_closed_on_invalid_authenticated_probe(
    response: Mapping[str, Any] | Exception,
) -> None:
    preflight, _ = _preflight(_evidence(), response)

    report = preflight.run()

    assert report.reasons == ("AUTHENTICATED_MODEL_PROBE_FAILED",)
    assert report.evidence["model_probe"] == "failed"


def test_preflight_sanitizes_database_failure() -> None:
    preflight, transport = _preflight(RuntimeError("secret database detail"))

    report = preflight.run()
    serialized = json.dumps(report.json())

    assert report.reasons == ("POSTGRESQL_UNAVAILABLE",)
    assert "secret database detail" not in serialized
    assert transport.calls == []


def test_config_hides_protected_values_and_rejects_invalid_bounds() -> None:
    environment = _environment()
    config = PreflightConfig.from_environment(environment)
    representation = repr(config)

    assert environment["TAI_DATABASE_URL"] not in representation
    assert environment["TAI_PREFLIGHT_MODEL_ENDPOINT"] not in representation
    assert environment["TAI_MODEL_BEARER_TOKEN"] not in representation

    invalid = _environment()
    invalid["TAI_PREFLIGHT_MODEL_TIMEOUT_SECONDS"] = "121"
    with pytest.raises(PreflightConfigurationError, match="between 1 and 120"):
        PreflightConfig.from_environment(invalid)

    invalid = _environment()
    invalid["TAI_PREFLIGHT_MAXIMUM_RESPONSE_BYTES"] = "100"
    with pytest.raises(PreflightConfigurationError, match="safe range"):
        PreflightConfig.from_environment(invalid)


@pytest.mark.parametrize(
    "change",
    [
        {"TAI_DATABASE_URL": ""},
        {"TAI_PREFLIGHT_MODEL_ENDPOINT": "ftp://model/infer"},
        {"TAI_MODEL_BEARER_TOKEN": "short"},
        {"TAI_ALLOWED_MODEL_HOSTS_JSON": "not-json"},
        {"TAI_ALLOWED_MODEL_HOSTS_JSON": "[]"},
        {"TAI_DATABASE_CONNECT_TIMEOUT_SECONDS": "bad"},
        {"TAI_PREFLIGHT_MODEL_TIMEOUT_SECONDS": "nan"},
    ],
)
def test_config_rejects_invalid_environment(change: dict[str, str]) -> None:
    environment = _environment()
    environment.update(change)
    with pytest.raises(PreflightConfigurationError):
        PreflightConfig.from_environment(environment)


def test_run_from_environment_returns_sanitized_configuration_failure() -> None:
    code, payload = run_from_environment({})

    assert code == 2
    assert payload["reasons"] == ["PREFLIGHT_CONFIGURATION_INVALID"]
    assert "TAI_DATABASE_URL" not in json.dumps(payload)


class _Cursor:
    def __init__(self, fail_on: int | None = None) -> None:
        self.queries: list[str] = []
        self.last = ""
        self.fail_on = fail_on

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        del parameters
        self.last = " ".join(query.split())
        self.queries.append(self.last)
        if self.fail_on == len(self.queries):
            raise RuntimeError("query failed")

    def fetchone(self) -> Mapping[str, Any] | None:
        return {"chunk_count": 4}

    def fetchall(self) -> list[Mapping[str, Any]]:
        if "FROM unnest" in self.last:
            return [
                {"name": name, "exists": True, "select_allowed": True}
                for name in module._REQUIRED_RELATIONS
            ]
        return [{"model_id": "model", "admitted": True}]


class _Connection:
    def __init__(self, cursor: _Cursor) -> None:
        self.cursor_value = cursor
        self.commits = 0
        self.rollbacks = 0

    def cursor(self) -> Any:
        return nullcontext(self.cursor_value)

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


class _Factory:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    def __call__(self) -> Any:
        return nullcontext(self.connection)


def test_postgresql_repository_is_explicitly_read_only() -> None:
    cursor = _Cursor()
    connection = _Connection(cursor)
    repository = PostgreSQLEvidenceRepository(
        _Factory(connection)  # type: ignore[arg-type]
    )

    evidence = repository.collect()

    assert cursor.queries[0] == "SET TRANSACTION READ ONLY"
    assert all(
        not any(word in query.upper() for word in ("INSERT ", "UPDATE ", "DELETE "))
        for query in cursor.queries
    )
    assert evidence.active_generation is True
    assert evidence.chunk_count == 4
    assert evidence.active_models == (("model", True),)
    assert connection.commits == 1
    assert connection.rollbacks == 0


def test_postgresql_repository_rolls_back_on_failure() -> None:
    connection = _Connection(_Cursor(fail_on=2))
    repository = PostgreSQLEvidenceRepository(
        _Factory(connection)  # type: ignore[arg-type]
    )

    with pytest.raises(RuntimeError, match="query failed"):
        repository.collect()

    assert connection.commits == 0
    assert connection.rollbacks == 1
