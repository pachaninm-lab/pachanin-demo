from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from contextlib import nullcontext
from typing import Any

import pytest

import tai.production_preflight as module
from tai.production_preflight import (
    DatabaseEvidence,
    ModelEvidence,
    PostgreSQLPreflightEvidenceRepository,
    PreflightConfig,
    PreflightConfigurationError,
    ProductionPreflight,
    RelationEvidence,
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


def _relations() -> tuple[RelationEvidence, ...]:
    return tuple(
        RelationEvidence(name=name, exists=True, select_allowed=True)
        for name in module._REQUIRED_RELATIONS
    )


def _accepted_evidence() -> DatabaseEvidence:
    return DatabaseEvidence(
        relations=_relations(),
        active_generation=True,
        active_chunk_count=12,
        active_models=(
            ModelEvidence(
                model_id="tai-qwen3-8b-q4km",
                revision="q4km-r1",
                accepted=True,
                artifact_matches=True,
            ),
        ),
    )


class _Repository:
    def __init__(self, evidence: DatabaseEvidence | Exception) -> None:
        self.evidence = evidence
        self.calls = 0

    def collect(self) -> DatabaseEvidence:
        self.calls += 1
        if isinstance(self.evidence, Exception):
            raise self.evidence
        return self.evidence


class _Transport:
    def __init__(self, response: Mapping[str, Any] | Exception) -> None:
        self.response = response
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
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


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
            timeout_seconds=10.0,
            maximum_response_bytes=4_096,
        ),
        transport,
    )


def test_preflight_accepts_complete_read_only_authority_without_secret_output() -> None:
    preflight, transport = _preflight(_accepted_evidence())

    report = preflight.run()
    payload = report.to_json_object()
    serialized = json.dumps(payload, sort_keys=True)

    assert report.accepted is True
    assert report.reasons == ()
    assert report.model_probe == "passed"
    assert payload["schema_version"] == "tai.production.preflight.v1"
    assert "tai-qwen3-8b-q4km" not in serialized
    assert "192.168.0.206" not in serialized
    assert "TAI_PREFLIGHT_OK" not in serialized
    assert transport.calls[0][1]["model"] == "tai-qwen3-8b-q4km"
    assert transport.calls[0][2:] == (10.0, 4_096)


def test_preflight_reports_schema_grant_knowledge_and_admission_blockers() -> None:
    relations = list(_relations())
    relations[0] = RelationEvidence(
        name=relations[0].name,
        exists=False,
        select_allowed=False,
    )
    relations[1] = RelationEvidence(
        name=relations[1].name,
        exists=True,
        select_allowed=False,
    )
    evidence = DatabaseEvidence(
        relations=tuple(relations[:-1]),
        active_generation=False,
        active_chunk_count=0,
        active_models=(
            ModelEvidence(
                model_id="model",
                revision="r1",
                accepted=False,
                artifact_matches=False,
            ),
        ),
    )
    preflight, transport = _preflight(evidence)

    report = preflight.run()

    assert report.accepted is False
    assert report.model_probe == "skipped"
    assert transport.calls == []
    assert set(report.reasons) == {
        "KNOWLEDGE_GENERATION_UNAVAILABLE",
        "MODEL_ARTIFACT_NOT_ADMITTED",
        "POSTGRESQL_SCHEMA_INCOMPLETE",
        "POSTGRESQL_SELECT_DENIED",
    }
    assert report.missing_relation_count == 2
    assert report.denied_select_count == 1


def test_preflight_requires_active_profile_and_materialized_chunks() -> None:
    evidence = DatabaseEvidence(
        relations=_relations(),
        active_generation=True,
        active_chunk_count=0,
        active_models=(),
    )
    preflight, _ = _preflight(evidence)

    report = preflight.run()

    assert report.reasons == (
        "ACTIVE_MODEL_PROFILE_UNAVAILABLE",
        "KNOWLEDGE_GENERATION_UNAVAILABLE",
    )
    assert report.components["model_admission"] == "not_admitted"


@pytest.mark.parametrize(
    "response",
    [
        {"choices": []},
        {"choices": ["invalid"]},
        {"choices": [{"message": "invalid"}]},
        {"choices": [{"message": {"content": "wrong"}}]},
        RuntimeError("model unavailable"),
    ],
)
def test_preflight_fails_closed_on_invalid_authenticated_model_probe(
    response: Mapping[str, Any] | Exception,
) -> None:
    preflight, _ = _preflight(_accepted_evidence(), response)

    report = preflight.run()

    assert report.accepted is False
    assert report.model_probe == "failed"
    assert report.reasons == ("AUTHENTICATED_MODEL_PROBE_FAILED",)


def test_preflight_sanitizes_postgresql_failure() -> None:
    preflight, transport = _preflight(RuntimeError("secret database detail"))

    report = preflight.run()
    payload = json.dumps(report.to_json_object(), sort_keys=True)

    assert report.reasons == ("POSTGRESQL_UNAVAILABLE",)
    assert report.missing_relation_count == len(module._REQUIRED_RELATIONS)
    assert "secret database detail" not in payload
    assert transport.calls == []


def test_preflight_config_hides_protected_values_and_validates_bounds() -> None:
    environment = _environment()
    config = PreflightConfig.from_environment(environment)
    representation = repr(config)

    assert environment["TAI_DATABASE_URL"] not in representation
    assert environment["TAI_PREFLIGHT_MODEL_ENDPOINT"] not in representation
    assert environment["TAI_MODEL_BEARER_TOKEN"] not in representation
    assert config.allowed_model_hosts == frozenset({"192.168.0.206"})

    invalid_timeout = _environment()
    invalid_timeout["TAI_PREFLIGHT_MODEL_TIMEOUT_SECONDS"] = "121"
    with pytest.raises(PreflightConfigurationError, match="between 1 and 120"):
        PreflightConfig.from_environment(invalid_timeout)

    invalid_budget = _environment()
    invalid_budget["TAI_PREFLIGHT_MAXIMUM_RESPONSE_BYTES"] = "100"
    with pytest.raises(PreflightConfigurationError, match="safe range"):
        PreflightConfig.from_environment(invalid_budget)


@pytest.mark.parametrize(
    "mutator",
    [
        lambda value: value.pop("TAI_DATABASE_URL"),
        lambda value: value.update(TAI_PREFLIGHT_MODEL_ENDPOINT="ftp://model/infer"),
        lambda value: value.update(TAI_MODEL_BEARER_TOKEN="short"),
        lambda value: value.update(TAI_ALLOWED_MODEL_HOSTS_JSON="not-json"),
        lambda value: value.update(TAI_ALLOWED_MODEL_HOSTS_JSON='[""]'),
        lambda value: value.update(TAI_DATABASE_CONNECT_TIMEOUT_SECONDS="bad"),
        lambda value: value.update(TAI_PREFLIGHT_MODEL_TIMEOUT_SECONDS="nan"),
    ],
)
def test_preflight_config_rejects_invalid_environment(mutator: Any) -> None:
    environment = _environment()
    mutator(environment)
    with pytest.raises(PreflightConfigurationError):
        PreflightConfig.from_environment(environment)


def test_run_from_environment_returns_only_sanitized_configuration_failure() -> None:
    exit_code, payload = run_from_environment({})
    serialized = json.dumps(payload, sort_keys=True)

    assert exit_code == 2
    assert payload["reasons"] == ["PREFLIGHT_CONFIGURATION_INVALID"]
    assert "TAI_DATABASE_URL" not in serialized


class _Cursor:
    def __init__(self, fail_on_query: int | None = None) -> None:
        self.queries: list[str] = []
        self.fail_on_query = fail_on_query
        self._last_query = ""

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        del parameters
        self._last_query = " ".join(query.split())
        self.queries.append(self._last_query)
        if self.fail_on_query == len(self.queries):
            raise RuntimeError("query failure")

    def fetchone(self) -> Mapping[str, Any] | None:
        if "FROM tai_retrieval_generations" in self._last_query:
            return {"generation": 7, "chunk_count": 4}
        return None

    def fetchall(self) -> list[Mapping[str, Any]]:
        if "FROM unnest" in self._last_query:
            return [
                {"name": name, "exists": True, "select_allowed": True}
                for name in module._REQUIRED_RELATIONS
            ]
        if "FROM tai_local_model_profiles" in self._last_query:
            return [
                {
                    "model_id": "model",
                    "revision": "r1",
                    "accepted": True,
                    "artifact_matches": True,
                }
            ]
        raise AssertionError("unexpected fetchall query")


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


class _ConnectionFactory:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    def __call__(self) -> Any:
        return nullcontext(self.connection)


def test_postgresql_repository_enforces_read_only_transaction_and_selects_only() -> None:
    cursor = _Cursor()
    connection = _Connection(cursor)
    repository = PostgreSQLPreflightEvidenceRepository(
        _ConnectionFactory(connection)  # type: ignore[arg-type]
    )

    evidence = repository.collect()

    assert cursor.queries[0] == "SET TRANSACTION READ ONLY"
    assert all(
        not any(token in query.upper() for token in ("INSERT ", "UPDATE ", "DELETE "))
        for query in cursor.queries
    )
    assert evidence.active_generation is True
    assert evidence.active_chunk_count == 4
    assert len(evidence.relations) == len(module._REQUIRED_RELATIONS)
    assert evidence.active_models[0].accepted is True
    assert connection.commits == 1
    assert connection.rollbacks == 0


def test_postgresql_repository_rolls_back_on_failure() -> None:
    cursor = _Cursor(fail_on_query=2)
    connection = _Connection(cursor)
    repository = PostgreSQLPreflightEvidenceRepository(
        _ConnectionFactory(connection)  # type: ignore[arg-type]
    )

    with pytest.raises(RuntimeError, match="query failure"):
        repository.collect()

    assert connection.commits == 0
    assert connection.rollbacks == 1


def test_main_prints_one_sanitized_json_document(monkeypatch: pytest.MonkeyPatch, capsys: Any) -> None:
    monkeypatch.setattr(
        module,
        "run_from_environment",
        lambda source: (1, module._failure_report("BLOCKED", "blocked")),
    )

    assert module.main() == 1
    captured = capsys.readouterr().out.strip()
    assert json.loads(captured)["reasons"] == ["BLOCKED"]
    assert captured.count("\n") == 0
