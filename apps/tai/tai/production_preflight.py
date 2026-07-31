from __future__ import annotations

import json
import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol, cast

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
    pass


@dataclass(frozen=True, slots=True)
class PreflightConfig:
    database_url: str = field(repr=False)
    endpoint: str = field(repr=False)
    token: str = field(repr=False)
    allowed_hosts: frozenset[str]
    database_timeout: int = 5
    model_timeout: float = 30.0
    response_budget: int = 262_144

    @classmethod
    def from_environment(cls, source: Mapping[str, str]) -> PreflightConfig:
        database_url = _required(source, "TAI_DATABASE_URL")
        endpoint = _required(source, "TAI_PREFLIGHT_MODEL_ENDPOINT")
        token = _required(source, "TAI_MODEL_BEARER_TOKEN")
        allowed_hosts = _hosts(source.get("TAI_ALLOWED_MODEL_HOSTS_JSON"))
        database_timeout = _integer(source, "TAI_DATABASE_CONNECT_TIMEOUT_SECONDS", 5)
        model_timeout = _number(source, "TAI_PREFLIGHT_MODEL_TIMEOUT_SECONDS", 30.0)
        response_budget = _integer(
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
            LocalEndpointPolicy(allowed_hosts=allowed_hosts).validate(endpoint)
            BearerHTTPClientJSONTransport(token)
        except ValueError as error:
            raise PreflightConfigurationError("preflight configuration is invalid") from error
        if not 1 <= model_timeout <= 120:
            raise PreflightConfigurationError("model timeout must be between 1 and 120")
        if not 1_024 <= response_budget <= 1_048_576:
            raise PreflightConfigurationError("response budget is outside the safe range")
        return cls(
            database_url=database_url,
            endpoint=endpoint,
            token=token,
            allowed_hosts=allowed_hosts,
            database_timeout=database_timeout,
            model_timeout=model_timeout,
            response_budget=response_budget,
        )


@dataclass(frozen=True, slots=True)
class DatabaseEvidence:
    relation_count: int
    missing_count: int
    denied_count: int
    active_generation: bool
    chunk_count: int
    active_models: tuple[tuple[str, bool], ...] = field(repr=False)


class EvidenceRepository(Protocol):
    def collect(self) -> DatabaseEvidence: ...


class PostgreSQLEvidenceRepository:
    """Read production authority only inside an explicit read-only transaction."""

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
                            CASE WHEN to_regclass('public.' || item.name) IS NULL
                                THEN FALSE
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
                    relations = cast(Any, cursor).fetchall()
                    names = {str(row["name"]) for row in relations}
                    missing = sum(not bool(row["exists"]) for row in relations)
                    missing += len(set(_REQUIRED_RELATIONS) - names)
                    denied = sum(
                        bool(row["exists"]) and not bool(row["select_allowed"])
                        for row in relations
                    )
                    if missing or denied:
                        connection.commit()
                        return DatabaseEvidence(
                            relation_count=len(relations),
                            missing_count=missing,
                            denied_count=denied,
                            active_generation=False,
                            chunk_count=0,
                            active_models=(),
                        )
                    cursor.execute(
                        """
                        SELECT COUNT(chunk.chunk_id)::bigint AS chunk_count
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
                    generation = cursor.fetchone()
                    cursor.execute(
                        """
                        SELECT
                            profile.model_id,
                            admission.accepted IS TRUE
                              AND admission.artifact_sha256 = profile.artifact_sha256
                                AS admitted
                        FROM tai_local_model_profiles AS profile
                        LEFT JOIN tai_current_model_admission_v1 AS admission
                          ON admission.model_id = profile.model_id
                         AND admission.revision = profile.revision
                        WHERE profile.status = 'ACTIVE'
                        ORDER BY profile.routing_priority, profile.model_id, profile.revision
                        """,
                        (),
                    )
                    model_rows = cast(Any, cursor).fetchall()
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        return DatabaseEvidence(
            relation_count=len(relations),
            missing_count=0,
            denied_count=0,
            active_generation=generation is not None,
            chunk_count=0 if generation is None else int(generation["chunk_count"]),
            active_models=tuple(
                (str(row["model_id"]), bool(row["admitted"])) for row in model_rows
            ),
        )


@dataclass(frozen=True, slots=True)
class PreflightReport:
    accepted: bool
    components: Mapping[str, str]
    reasons: tuple[str, ...]
    evidence: Mapping[str, int | bool | str]

    def json(self) -> dict[str, object]:
        return {
            "accepted": self.accepted,
            "components": dict(sorted(self.components.items())),
            "evidence": dict(sorted(self.evidence.items())),
            "reasons": list(self.reasons),
            "schema_version": "tai.production.preflight.v1",
        }


class ProductionPreflight:
    def __init__(
        self,
        *,
        repository: EvidenceRepository,
        transport: JSONTransport,
        endpoint: str,
        timeout: float,
        response_budget: int,
    ) -> None:
        self._repository = repository
        self._transport = transport
        self._endpoint = endpoint
        self._timeout = timeout
        self._response_budget = response_budget

    def run(self) -> PreflightReport:
        components: dict[str, str] = {}
        reasons: list[str] = []
        try:
            evidence = self._repository.collect()
        except Exception:
            return _report(
                {"postgresql": "unavailable", "model_probe": "skipped"},
                ["POSTGRESQL_UNAVAILABLE"],
            )
        schema_ready = evidence.missing_count == 0
        select_ready = schema_ready and evidence.denied_count == 0
        components["postgresql_schema"] = "ready" if schema_ready else "incomplete"
        components["postgresql_select"] = "ready" if select_ready else "denied"
        if not schema_ready:
            reasons.append("POSTGRESQL_SCHEMA_INCOMPLETE")
        if evidence.denied_count:
            reasons.append("POSTGRESQL_SELECT_DENIED")

        admitted = tuple(item for item in evidence.active_models if item[1])
        probe = "skipped"
        if select_ready:
            knowledge_ready = evidence.active_generation and evidence.chunk_count > 0
            components["knowledge"] = "ready" if knowledge_ready else "unavailable"
            if not knowledge_ready:
                reasons.append("KNOWLEDGE_GENERATION_UNAVAILABLE")
            all_admitted = bool(evidence.active_models) and (
                len(admitted) == len(evidence.active_models)
            )
            components["model_admission"] = "ready" if all_admitted else "not_admitted"
            if not evidence.active_models:
                reasons.append("ACTIVE_MODEL_PROFILE_UNAVAILABLE")
            elif not all_admitted:
                reasons.append("MODEL_ARTIFACT_NOT_ADMITTED")
            if all_admitted:
                probe = self._probe(admitted[0][0])
                if probe != "passed":
                    reasons.append("AUTHENTICATED_MODEL_PROBE_FAILED")
        else:
            components["knowledge"] = "blocked_by_postgresql"
            components["model_admission"] = "blocked_by_postgresql"
        components["model_probe"] = probe
        return PreflightReport(
            accepted=not reasons,
            components=components,
            reasons=tuple(sorted(set(reasons))),
            evidence={
                "active_chunk_count": evidence.chunk_count,
                "active_generation": evidence.active_generation,
                "active_model_count": len(evidence.active_models),
                "admitted_model_count": len(admitted),
                "denied_select_count": evidence.denied_count,
                "missing_relation_count": evidence.missing_count,
                "model_probe": probe,
                "relation_count": evidence.relation_count,
            },
        )

    def _probe(self, model_id: str) -> str:
        try:
            response = self._transport.post_json(
                self._endpoint,
                {
                    "chat_template_kwargs": {"enable_thinking": False},
                    "max_tokens": 16,
                    "messages": [
                        {"content": "Return exactly TAI_PREFLIGHT_OK.", "role": "user"}
                    ],
                    "model": model_id,
                    "seed": 0,
                    "stream": False,
                    "temperature": 0,
                },
                timeout_seconds=self._timeout,
                maximum_response_bytes=self._response_budget,
            )
            content = response["choices"][0]["message"]["content"]
            return "passed" if content.strip() == "TAI_PREFLIGHT_OK" else "failed"
        except Exception:
            return "failed"


def run_from_environment(source: Mapping[str, str]) -> tuple[int, dict[str, object]]:
    try:
        config = PreflightConfig.from_environment(source)
        factory = PsycopgConnectionFactory(
            config.database_url,
            connect_timeout_seconds=config.database_timeout,
            application_name="tai-preflight",
        )
        report = ProductionPreflight(
            repository=PostgreSQLEvidenceRepository(factory),
            transport=BearerHTTPClientJSONTransport(config.token),
            endpoint=config.endpoint,
            timeout=config.model_timeout,
            response_budget=config.response_budget,
        ).run()
        return (0 if report.accepted else 1, report.json())
    except PreflightConfigurationError:
        return (
            2,
            _report(
                {"preflight": "configuration_invalid"},
                ["PREFLIGHT_CONFIGURATION_INVALID"],
            ).json(),
        )
    except Exception:
        return (
            2,
            _report(
                {"preflight": "execution_failed"},
                ["PREFLIGHT_EXECUTION_FAILED"],
            ).json(),
        )


def main() -> int:
    code, payload = run_from_environment(os.environ)
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    return code


def _report(components: Mapping[str, str], reasons: list[str]) -> PreflightReport:
    return PreflightReport(
        accepted=False,
        components=components,
        reasons=tuple(sorted(set(reasons))),
        evidence={
            "active_chunk_count": 0,
            "active_generation": False,
            "active_model_count": 0,
            "admitted_model_count": 0,
            "denied_select_count": 0,
            "missing_relation_count": 0,
            "model_probe": "skipped",
            "relation_count": 0,
        },
    )


def _required(source: Mapping[str, str], name: str) -> str:
    value = source.get(name)
    if value is None or not value or value != value.strip():
        raise PreflightConfigurationError(f"{name} is required and normalized")
    return value


def _hosts(raw: str | None) -> frozenset[str]:
    try:
        decoded = ["localhost"] if raw is None or not raw.strip() else json.loads(raw)
    except json.JSONDecodeError as error:
        raise PreflightConfigurationError("allowed model hosts JSON is invalid") from error
    if (
        not isinstance(decoded, list)
        or not decoded
        or any(not isinstance(item, str) for item in decoded)
    ):
        raise PreflightConfigurationError("allowed model hosts must be a non-empty string array")
    result = frozenset(item.strip() for item in decoded)
    if any(not item for item in result):
        raise PreflightConfigurationError("allowed model hosts must not contain blanks")
    return result


def _integer(source: Mapping[str, str], name: str, default: int) -> int:
    try:
        return default if not source.get(name, "").strip() else int(source[name])
    except ValueError as error:
        raise PreflightConfigurationError(f"{name} must be an integer") from error


def _number(source: Mapping[str, str], name: str, default: float) -> float:
    try:
        value = default if not source.get(name, "").strip() else float(source[name])
    except ValueError as error:
        raise PreflightConfigurationError(f"{name} must be numeric") from error
    if value != value or value in {float("inf"), float("-inf")}:
        raise PreflightConfigurationError(f"{name} must be finite")
    return value


if __name__ == "__main__":
    raise SystemExit(main())
