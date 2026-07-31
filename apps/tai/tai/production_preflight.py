from __future__ import annotations

import json
import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol

from tai.local_model_invoker import JSONTransport, LocalEndpointPolicy
from tai.postgres_connection import PsycopgConnectionFactory
from tai.postgres_loader_state import ConnectionFactory
from tai.secure_model_transport import BearerHTTPClientJSONTransport

_REQUIRED_RELATIONS = (
    "tai_retrieval_generations",
    "tai_retrieval_chunks",
    "tai_rag_traces",
    "tai_local_model_profiles",
    "tai_local_model_health",
    "tai_agent_tool_events",
    "tai_tool_confirmation_uses",
    "tai_orchestration_idempotency",
    "tai_prepared_actions",
    "tai_orchestration_traces",
    "tai_runtime_evaluation_observations",
    "tai_current_model_admission_v1",
)


class PreflightConfigurationError(ValueError):
    """Raised when protected REG.RU preflight configuration is invalid."""


@dataclass(frozen=True, slots=True)
class PreflightConfig:
    database_url: str = field(repr=False)
    model_endpoint: str = field(repr=False)
    bearer_token: str = field(repr=False)
    allowed_model_hosts: frozenset[str]
    database_timeout_seconds: int = 5
    model_timeout_seconds: float = 30.0
    maximum_response_bytes: int = 262_144

    @classmethod
    def from_environment(cls, source: Mapping[str, str]) -> PreflightConfig:
        database_url = _required(source, "TAI_DATABASE_URL")
        endpoint = _required(source, "TAI_PREFLIGHT_MODEL_ENDPOINT")
        token = _required(source, "TAI_MODEL_BEARER_TOKEN")
        allowed_hosts = _string_set(
            source.get("TAI_ALLOWED_MODEL_HOSTS_JSON"),
            {"localhost"},
        )
        database_timeout = _integer(
            source,
            "TAI_DATABASE_CONNECT_TIMEOUT_SECONDS",
            5,
        )
        model_timeout = _number(source, "TAI_PREFLIGHT_MODEL_TIMEOUT_SECONDS", 30.0)
        maximum_response_bytes = _integer(
            source,
            "TAI_PREFLIGHT_MAXIMUM_RESPONSE_BYTES",
            262_144,
        )
        try:
            PsycopgConnectionFactory(
                database_url,
                connect_timeout_seconds=database_timeout,
                application_name="tai-preflight",
            )
            LocalEndpointPolicy(allowed_hosts=frozenset(allowed_hosts)).validate(endpoint)
            BearerHTTPClientJSONTransport(token)
        except ValueError as error:
            raise PreflightConfigurationError("preflight configuration is invalid") from error
        if not 1 <= model_timeout <= 120:
            raise PreflightConfigurationError(
                "TAI_PREFLIGHT_MODEL_TIMEOUT_SECONDS must be between 1 and 120"
            )
        if not 1_024 <= maximum_response_bytes <= 1_048_576:
            raise PreflightConfigurationError(
                "TAI_PREFLIGHT_MAXIMUM_RESPONSE_BYTES is outside the safe range"
            )
        return cls(
            database_url=database_url,
            model_endpoint=endpoint,
            bearer_token=token,
            allowed_model_hosts=frozenset(allowed_hosts),
            database_timeout_seconds=database_timeout,
            model_timeout_seconds=model_timeout,
            maximum_response_bytes=maximum_response_bytes,
        )


@dataclass(frozen=True, slots=True)
class RelationEvidence:
    name: str
    exists: bool
    select_allowed: bool


@dataclass(frozen=True, slots=True)
class ModelEvidence:
    model_id: str = field(repr=False)
    revision: str = field(repr=False)
    artifact_matches: bool
    accepted: bool


@dataclass(frozen=True, slots=True)
class DatabaseEvidence:
    relations: tuple[RelationEvidence, ...]
    active_generation: bool
    active_chunk_count: int
    active_models: tuple[ModelEvidence, ...]


class PreflightEvidenceRepository(Protocol):
    def collect(self) -> DatabaseEvidence: ...


class PostgreSQLPreflightEvidenceRepository:
    """Collect bounded production evidence inside an enforced read-only transaction."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def collect(self) -> DatabaseEvidence:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET TRANSACTION READ ONLY", ())
                    cursor.execute(
                        """
                        SELECT
                            item.name,
                            to_regclass('public.' || item.name) IS NOT NULL AS exists,
                            CASE
                                WHEN to_regclass('public.' || item.name) IS NULL THEN FALSE
                                ELSE has_table_privilege(
                                    current_user,
                                    'public.' || item.name,
                                    'SELECT'
                                )
                            END AS select_allowed
                        FROM unnest(%s::text[]) AS item(name)
                        ORDER BY item.name
                        """,
                        (list(_REQUIRED_RELATIONS),),
                    )
                    relation_rows = cursor.fetchall()
                    cursor.execute(
                        """
                        SELECT
                            generation.generation,
                            COUNT(chunk.chunk_id)::bigint AS chunk_count
                        FROM tai_retrieval_generations AS generation
                        LEFT JOIN tai_retrieval_chunks AS chunk
                          ON chunk.generation = generation.generation
                        WHERE generation.status = 'ACTIVE'
                        GROUP BY generation.generation
                        ORDER BY generation.generation DESC
                        LIMIT 1
                        """,
                        (),
                    )
                    generation_row = cursor.fetchone()
                    cursor.execute(
                        """
                        SELECT
                            profile.model_id,
                            profile.revision,
                            admission.accepted IS TRUE AS accepted,
                            admission.artifact_sha256 = profile.artifact_sha256
                                AS artifact_matches
                        FROM tai_local_model_profiles AS profile
                        LEFT JOIN tai_current_model_admission_v1 AS admission
                          ON admission.model_id = profile.model_id
                         AND admission.revision = profile.revision
                        WHERE profile.status = 'ACTIVE'
                        ORDER BY profile.routing_priority, profile.model_id, profile.revision
                        """,
                        (),
                    )
                    model_rows = cursor.fetchall()
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        relations = tuple(
            RelationEvidence(
                name=str(row["name"]),
                exists=bool(row["exists"]),
                select_allowed=bool(row["select_allowed"]),
            )
            for row in relation_rows
        )
        models = tuple(
            ModelEvidence(
                model_id=str(row["model_id"]),
                revision=str(row["revision"]),
                accepted=bool(row["accepted"]),
                artifact_matches=bool(row["artifact_matches"]),
            )
            for row in model_rows
        )
        chunk_count = 0 if generation_row is None else int(generation_row["chunk_count"])
        return DatabaseEvidence(
            relations=relations,
            active_generation=generation_row is not None,
            active_chunk_count=chunk_count,
            active_models=models,
        )


@dataclass(frozen=True, slots=True)
class PreflightReport:
    accepted: bool
    components: Mapping[str, str]
    reasons: tuple[str, ...]
    relation_count: int
    missing_relation_count: int
    denied_select_count: int
    active_generation: bool
    active_chunk_count: int
    active_model_count: int
    admitted_model_count: int
    model_probe: str

    def to_json_object(self) -> dict[str, object]:
        return {
            "accepted": self.accepted,
            "active_chunk_count": self.active_chunk_count,
            "active_generation": self.active_generation,
            "active_model_count": self.active_model_count,
            "admitted_model_count": self.admitted_model_count,
            "components": dict(sorted(self.components.items())),
            "denied_select_count": self.denied_select_count,
            "missing_relation_count": self.missing_relation_count,
            "model_probe": self.model_probe,
            "reasons": list(self.reasons),
            "relation_count": self.relation_count,
            "schema_version": "tai.production.preflight.v1",
        }


class ProductionPreflight:
    def __init__(
        self,
        *,
        repository: PreflightEvidenceRepository,
        transport: JSONTransport,
        endpoint: str,
        timeout_seconds: float,
        maximum_response_bytes: int,
    ) -> None:
        self._repository = repository
        self._transport = transport
        self._endpoint = endpoint
        self._timeout_seconds = timeout_seconds
        self._maximum_response_bytes = maximum_response_bytes

    def run(self) -> PreflightReport:
        components: dict[str, str] = {}
        reasons: list[str] = []
        try:
            evidence = self._repository.collect()
        except Exception:
            return PreflightReport(
                accepted=False,
                components={"postgresql": "unavailable", "model_probe": "skipped"},
                reasons=("POSTGRESQL_UNAVAILABLE",),
                relation_count=0,
                missing_relation_count=len(_REQUIRED_RELATIONS),
                denied_select_count=len(_REQUIRED_RELATIONS),
                active_generation=False,
                active_chunk_count=0,
                active_model_count=0,
                admitted_model_count=0,
                model_probe="skipped",
            )

        missing = tuple(item for item in evidence.relations if not item.exists)
        denied = tuple(
            item for item in evidence.relations if item.exists and not item.select_allowed
        )
        relation_names = {item.name for item in evidence.relations}
        inventory_complete = relation_names == set(_REQUIRED_RELATIONS)
        if missing or not inventory_complete:
            components["postgresql_schema"] = "incomplete"
            reasons.append("POSTGRESQL_SCHEMA_INCOMPLETE")
        else:
            components["postgresql_schema"] = "ready"
        if denied:
            components["postgresql_select"] = "denied"
            reasons.append("POSTGRESQL_SELECT_DENIED")
        else:
            components["postgresql_select"] = "ready"

        knowledge_ready = evidence.active_generation and evidence.active_chunk_count > 0
        components["knowledge"] = "ready" if knowledge_ready else "unavailable"
        if not knowledge_ready:
            reasons.append("KNOWLEDGE_GENERATION_UNAVAILABLE")

        admitted_models = tuple(
            item
            for item in evidence.active_models
            if item.accepted and item.artifact_matches
        )
        all_models_admitted = bool(evidence.active_models) and (
            len(admitted_models) == len(evidence.active_models)
        )
        components["model_admission"] = (
            "ready" if all_models_admitted else "not_admitted"
        )
        if not evidence.active_models:
            reasons.append("ACTIVE_MODEL_PROFILE_UNAVAILABLE")
        elif not all_models_admitted:
            reasons.append("MODEL_ARTIFACT_NOT_ADMITTED")

        probe_status = "skipped"
        if all_models_admitted and not missing and not denied and inventory_complete:
            probe_status = self._probe(admitted_models[0].model_id)
            if probe_status != "passed":
                reasons.append("AUTHENTICATED_MODEL_PROBE_FAILED")
        components["model_probe"] = probe_status
        unique_reasons = tuple(sorted(set(reasons)))
        return PreflightReport(
            accepted=not unique_reasons,
            components=components,
            reasons=unique_reasons,
            relation_count=len(evidence.relations),
            missing_relation_count=(
                len(missing) + len(set(_REQUIRED_RELATIONS) - relation_names)
            ),
            denied_select_count=len(denied),
            active_generation=evidence.active_generation,
            active_chunk_count=evidence.active_chunk_count,
            active_model_count=len(evidence.active_models),
            admitted_model_count=len(admitted_models),
            model_probe=probe_status,
        )

    def _probe(self, model_id: str) -> str:
        try:
            response = self._transport.post_json(
                self._endpoint,
                {
                    "chat_template_kwargs": {"enable_thinking": False},
                    "max_tokens": 16,
                    "messages": [
                        {
                            "content": "Return exactly TAI_PREFLIGHT_OK.",
                            "role": "user",
                        }
                    ],
                    "model": model_id,
                    "seed": 0,
                    "stream": False,
                    "temperature": 0,
                },
                timeout_seconds=self._timeout_seconds,
                maximum_response_bytes=self._maximum_response_bytes,
            )
            choices = response.get("choices")
            if not isinstance(choices, list) or len(choices) != 1:
                return "failed"
            choice = choices[0]
            if not isinstance(choice, dict):
                return "failed"
            message = choice.get("message")
            if not isinstance(message, dict):
                return "failed"
            content = message.get("content")
            if not isinstance(content, str) or content.strip() != "TAI_PREFLIGHT_OK":
                return "failed"
            return "passed"
        except Exception:
            return "failed"


def run_from_environment(source: Mapping[str, str]) -> tuple[int, dict[str, object]]:
    try:
        config = PreflightConfig.from_environment(source)
        database = PsycopgConnectionFactory(
            config.database_url,
            connect_timeout_seconds=config.database_timeout_seconds,
            application_name="tai-preflight",
        )
        report = ProductionPreflight(
            repository=PostgreSQLPreflightEvidenceRepository(database),
            transport=BearerHTTPClientJSONTransport(config.bearer_token),
            endpoint=config.model_endpoint,
            timeout_seconds=config.model_timeout_seconds,
            maximum_response_bytes=config.maximum_response_bytes,
        ).run()
        return (0 if report.accepted else 1, report.to_json_object())
    except PreflightConfigurationError:
        return (
            2,
            _failure_report("PREFLIGHT_CONFIGURATION_INVALID", "configuration_invalid"),
        )
    except Exception:
        return (2, _failure_report("PREFLIGHT_EXECUTION_FAILED", "execution_failed"))


def main() -> int:
    exit_code, payload = run_from_environment(os.environ)
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    return exit_code


def _failure_report(reason: str, status: str) -> dict[str, object]:
    return {
        "accepted": False,
        "active_chunk_count": 0,
        "active_generation": False,
        "active_model_count": 0,
        "admitted_model_count": 0,
        "components": {"preflight": status},
        "denied_select_count": 0,
        "missing_relation_count": 0,
        "model_probe": "skipped",
        "reasons": [reason],
        "relation_count": 0,
        "schema_version": "tai.production.preflight.v1",
    }


def _required(source: Mapping[str, str], name: str) -> str:
    value = source.get(name)
    if value is None or not value:
        raise PreflightConfigurationError(f"{name} is required")
    if value != value.strip():
        raise PreflightConfigurationError(f"{name} must not contain edge whitespace")
    return value


def _string_set(raw: str | None, default: set[str]) -> set[str]:
    if raw is None or not raw.strip():
        return set(default)
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError as error:
        raise PreflightConfigurationError("allowed model hosts JSON is invalid") from error
    if not isinstance(decoded, list) or any(not isinstance(item, str) for item in decoded):
        raise PreflightConfigurationError("allowed model hosts must be a string array")
    result = {item.strip() for item in decoded}
    if not result or any(not item for item in result):
        raise PreflightConfigurationError("allowed model hosts must not contain blanks")
    return result


def _integer(source: Mapping[str, str], name: str, default: int) -> int:
    raw = source.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError as error:
        raise PreflightConfigurationError(f"{name} must be an integer") from error


def _number(source: Mapping[str, str], name: str, default: float) -> float:
    raw = source.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = float(raw)
    except ValueError as error:
        raise PreflightConfigurationError(f"{name} must be numeric") from error
    if value != value or value in {float("inf"), float("-inf")}:
        raise PreflightConfigurationError(f"{name} must be finite")
    return value


if __name__ == "__main__":
    raise SystemExit(main())
