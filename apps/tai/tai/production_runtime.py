from __future__ import annotations

import base64
import binascii
import json
import os
import re
import threading
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from tai.agent_runtime import (
    AgentToolRuntime,
    HMACToolConfirmationAuthority,
    ToolExecutorRegistry,
    ToolHandler,
)
from tai.context_assembly import ContextAssembler
from tai.identity_assertion import HMACPlatformIdentityAuthority
from tai.local_model_invoker import (
    LocalEndpointPolicy,
    OpenAICompatibleLocalInvoker,
    StaticModelEndpointResolver,
)
from tai.main import ReadinessStatus
from tai.model_runtime import (
    DeterministicModelRouter,
    ModelCapability,
    ModelProfileStatus,
    ModelRouteRequest,
    RoutedLocalModelGateway,
)
from tai.orchestration import (
    NoToolPlanner,
    ProcessAdmissionController,
    TAIOrchestrationRuntime,
    ToolPlanner,
)
from tai.postgres_agent_runtime import (
    PostgreSQLAgentAuditSink,
    PostgreSQLConfirmationUseRepository,
)
from tai.postgres_connection import PsycopgConnectionFactory
from tai.postgres_loader_state import ConnectionFactory
from tai.postgres_model_runtime import PostgreSQLModelRuntimeRepository
from tai.postgres_orchestration import PostgreSQLOrchestrationIdempotencyRepository
from tai.postgres_orchestration_observability import (
    PostgreSQLOrchestrationAuditSink,
    PostgreSQLRuntimeEvaluationSink,
)
from tai.postgres_prepared_action_heartbeat import (
    HeartbeatingPostgreSQLPreparedActionRepository,
)
from tai.postgres_rag_audit import PostgreSQLGroundedAnswerAuditSink
from tai.postgres_retrieval_index import PostgreSQLRetrievalIndexRepository
from tai.rag_pipeline import GroundedRAGPipeline
from tai.retrieval_index import LexicalRetriever
from tai.retrieval_service import RetrievalService

# Keep model IDs and revisions portable because they are used in env keys and evidence.
_MODEL_IDENTITY = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
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
)


class ProductionConfigurationError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class ModelEndpointBinding:
    model_id: str
    revision: str
    endpoint: str

    def __post_init__(self) -> None:
        if _MODEL_IDENTITY.fullmatch(self.model_id) is None:
            raise ProductionConfigurationError("model endpoint model_id is invalid")
        if _MODEL_IDENTITY.fullmatch(self.revision) is None:
            raise ProductionConfigurationError("model endpoint revision is invalid")
        if not self.endpoint.strip():
            raise ProductionConfigurationError("model endpoint must not be blank")


@dataclass(frozen=True, slots=True)
class ProductionRuntimeConfig:
    database_url: str
    identity_secret: bytes
    confirmation_secret: bytes
    model_endpoints: tuple[ModelEndpointBinding, ...]
    allowed_model_hosts: frozenset[str] = frozenset({"localhost"})
    database_connect_timeout_seconds: int = 5
    model_timeout_seconds: float = 60.0
    maximum_active_requests: int = 32
    requests_per_minute_per_scope: int = 120
    execution_lease_seconds: int = 300
    heartbeat_interval_seconds: float = 60.0
    heartbeat_stop_timeout_seconds: float = 5.0
    readiness_cache_seconds: float = 5.0

    def __post_init__(self) -> None:
        if len(self.identity_secret) < 32 or len(self.confirmation_secret) < 32:
            raise ProductionConfigurationError("TAI HMAC secrets must contain at least 32 bytes")
        if self.identity_secret == self.confirmation_secret:
            raise ProductionConfigurationError("identity and confirmation secrets must differ")
        if not self.model_endpoints:
            raise ProductionConfigurationError("at least one local model endpoint is required")
        identities = {(item.model_id, item.revision) for item in self.model_endpoints}
        if len(identities) != len(self.model_endpoints):
            raise ProductionConfigurationError("model endpoint identities must be unique")
        if not 1 <= self.database_connect_timeout_seconds <= 30:
            raise ProductionConfigurationError("database timeout must be between 1 and 30")
        if not 1 <= self.model_timeout_seconds <= 600:
            raise ProductionConfigurationError("model timeout must be between 1 and 600")
        if self.maximum_active_requests < 1:
            raise ProductionConfigurationError("maximum active requests must be positive")
        if self.requests_per_minute_per_scope < 1:
            raise ProductionConfigurationError("request rate must be positive")
        if not 1 <= self.execution_lease_seconds <= 3600:
            raise ProductionConfigurationError("execution lease must be between 1 and 3600")
        if not 0.05 <= self.heartbeat_interval_seconds < self.execution_lease_seconds:
            raise ProductionConfigurationError(
                "heartbeat interval must be at least 50ms and shorter than execution lease"
            )
        if not 0.05 <= self.heartbeat_stop_timeout_seconds <= 30:
            raise ProductionConfigurationError(
                "heartbeat stop timeout must be between 50ms and 30s"
            )
        if not 0.1 <= self.readiness_cache_seconds <= 60:
            raise ProductionConfigurationError("readiness cache must be between 0.1 and 60s")
        if any(not host.strip() for host in self.allowed_model_hosts):
            raise ProductionConfigurationError("allowed model hosts must not be blank")

    @classmethod
    def from_environment(
        cls,
        environment: Mapping[str, str] | None = None,
    ) -> ProductionRuntimeConfig:
        source = os.environ if environment is None else environment
        database_url = _required(source, "TAI_DATABASE_URL")
        identity_secret = _secret(source, "TAI_IDENTITY_HMAC_SECRET_B64")
        confirmation_secret = _secret(source, "TAI_CONFIRMATION_HMAC_SECRET_B64")
        endpoints = _model_endpoints(_required(source, "TAI_MODEL_ENDPOINTS_JSON"))
        allowed_hosts = _string_set(source.get("TAI_ALLOWED_MODEL_HOSTS_JSON"), {"localhost"})
        config = cls(
            database_url=database_url,
            identity_secret=identity_secret,
            confirmation_secret=confirmation_secret,
            model_endpoints=endpoints,
            allowed_model_hosts=frozenset(allowed_hosts),
            database_connect_timeout_seconds=_integer(
                source, "TAI_DATABASE_CONNECT_TIMEOUT_SECONDS", 5
            ),
            model_timeout_seconds=_number(source, "TAI_MODEL_TIMEOUT_SECONDS", 60.0),
            maximum_active_requests=_integer(source, "TAI_MAXIMUM_ACTIVE_REQUESTS", 32),
            requests_per_minute_per_scope=_integer(
                source, "TAI_REQUESTS_PER_MINUTE_PER_SCOPE", 120
            ),
            execution_lease_seconds=_integer(source, "TAI_EXECUTION_LEASE_SECONDS", 300),
            heartbeat_interval_seconds=_number(
                source, "TAI_HEARTBEAT_INTERVAL_SECONDS", 60.0
            ),
            heartbeat_stop_timeout_seconds=_number(
                source, "TAI_HEARTBEAT_STOP_TIMEOUT_SECONDS", 5.0
            ),
            readiness_cache_seconds=_number(source, "TAI_READINESS_CACHE_SECONDS", 5.0),
        )
        # Validate DSN and every endpoint before any authority is exposed.
        PsycopgConnectionFactory(
            config.database_url,
            connect_timeout_seconds=config.database_connect_timeout_seconds,
        )
        endpoint_policy = LocalEndpointPolicy(allowed_hosts=config.allowed_model_hosts)
        for binding in config.model_endpoints:
            endpoint_policy.validate(binding.endpoint)
        return config

    def endpoint_mapping(self) -> dict[tuple[str, str], str]:
        return {
            (binding.model_id, binding.revision): binding.endpoint
            for binding in self.model_endpoints
        }


@dataclass(frozen=True, slots=True)
class ProductionRuntimeBundle:
    runtime: TAIOrchestrationRuntime
    identity_authority: HMACPlatformIdentityAuthority
    readiness_probe: ProductionReadinessProbe


class ProductionReadinessProbe:
    """Cached live dependency gate for PostgreSQL, knowledge and local model authority."""

    def __init__(
        self,
        *,
        connection_factory: ConnectionFactory,
        model_repository: PostgreSQLModelRuntimeRepository,
        router: DeterministicModelRouter,
        endpoint_resolver: StaticModelEndpointResolver,
        endpoint_policy: LocalEndpointPolicy,
        tools_enabled: bool,
        cache_ttl: timedelta,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._connection_factory = connection_factory
        self._model_repository = model_repository
        self._router = router
        self._endpoint_resolver = endpoint_resolver
        self._endpoint_policy = endpoint_policy
        self._tools_enabled = tools_enabled
        self._cache_ttl = cache_ttl
        self._clock = clock or (lambda: datetime.now(UTC))
        self._lock = threading.Lock()
        self._cached_at: datetime | None = None
        self._cached: ReadinessStatus | None = None

    def check(self) -> ReadinessStatus:
        now = self._clock()
        with self._lock:
            if (
                self._cached is not None
                and self._cached_at is not None
                and now - self._cached_at <= self._cache_ttl
            ):
                return self._cached
        result = self._check_uncached(now)
        with self._lock:
            self._cached = result
            self._cached_at = now
        return result

    def _check_uncached(self, now: datetime) -> ReadinessStatus:
        components: dict[str, str] = {
            "billing": "disabled-by-architecture",
            "tools": "configured" if self._tools_enabled else "disabled-safe",
        }
        reasons: list[str] = []
        try:
            missing_relations = self._missing_relations()
        except Exception:
            components["postgresql"] = "unavailable"
            reasons.append("POSTGRESQL_UNAVAILABLE")
            return ReadinessStatus(False, components, tuple(reasons))
        if missing_relations:
            components["postgresql"] = "schema_incomplete"
            reasons.append("POSTGRESQL_SCHEMA_INCOMPLETE")
        else:
            components["postgresql"] = "ready"

        try:
            active_generation = self._active_generation_exists()
        except Exception:
            active_generation = False
        components["knowledge"] = "ready" if active_generation else "no_active_generation"
        if not active_generation:
            reasons.append("KNOWLEDGE_GENERATION_UNAVAILABLE")

        try:
            profiles = self._model_repository.list_profiles()
            active_profiles = tuple(
                profile for profile in profiles if profile.status is ModelProfileStatus.ACTIVE
            )
            if not active_profiles:
                raise RuntimeError("no active model profile")
            for profile in active_profiles:
                endpoint = self._endpoint_resolver.resolve(profile)
                self._endpoint_policy.validate(endpoint)
            decision = self._router.route(
                ModelRouteRequest(
                    request_id="tai-readiness",
                    required_capabilities=frozenset(
                        {ModelCapability.TEXT_GENERATION, ModelCapability.RUSSIAN}
                    ),
                    prompt_tokens=1,
                    requested_output_tokens=16,
                    now=now,
                )
            )
            self._endpoint_policy.validate(
                self._endpoint_resolver.resolve(decision.primary.profile)
            )
            components["local_model"] = "ready"
        except Exception:
            components["local_model"] = "unavailable"
            reasons.append("LOCAL_MODEL_UNAVAILABLE")

        return ReadinessStatus(not reasons, components, tuple(reasons))

    def _missing_relations(self) -> tuple[str, ...]:
        expressions = ", ".join(
            f"to_regclass('public.{name}') AS {name}" for name in _REQUIRED_RELATIONS
        )
        row = self._fetch_one(f"SELECT {expressions}", ())
        if row is None:
            return _REQUIRED_RELATIONS
        return tuple(name for name in _REQUIRED_RELATIONS if row.get(name) is None)

    def _active_generation_exists(self) -> bool:
        row = self._fetch_one(
            """
                SELECT EXISTS (
                    SELECT 1
                    FROM tai_retrieval_generations
                    WHERE status = 'ACTIVE'
                ) AS active_generation
            """,
            (),
        )
        return row is not None and bool(row.get("active_generation"))

    def _fetch_one(
        self,
        query: str,
        parameters: tuple[Any, ...],
    ) -> Mapping[str, Any] | None:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                    row = cursor.fetchone()
                connection.commit()
                return row
            except Exception:
                connection.rollback()
                raise


def build_production_runtime(
    config: ProductionRuntimeConfig,
    *,
    connection_factory: ConnectionFactory | None = None,
    tool_handlers: Mapping[str, ToolHandler] | None = None,
    tool_planner: ToolPlanner | None = None,
    clock: Callable[[], datetime] | None = None,
) -> ProductionRuntimeBundle:
    database = connection_factory or PsycopgConnectionFactory(
        config.database_url,
        connect_timeout_seconds=config.database_connect_timeout_seconds,
    )
    endpoint_policy = LocalEndpointPolicy(allowed_hosts=config.allowed_model_hosts)
    endpoint_resolver = StaticModelEndpointResolver(config.endpoint_mapping())
    model_repository = PostgreSQLModelRuntimeRepository(database)
    router = DeterministicModelRouter(model_repository, model_repository)
    model_gateway = RoutedLocalModelGateway(
        router=router,
        invoker=OpenAICompatibleLocalInvoker(
            endpoint_resolver=endpoint_resolver,
            endpoint_policy=endpoint_policy,
        ),
        timeout_seconds=config.model_timeout_seconds,
    )
    retrieval_repository = PostgreSQLRetrievalIndexRepository(database)
    rag_pipeline = GroundedRAGPipeline(
        retrieval_service=RetrievalService(LexicalRetriever(retrieval_repository)),
        context_assembler=ContextAssembler(),
        model_gateway=model_gateway,
        audit_sink=PostgreSQLGroundedAnswerAuditSink(database),
    )
    confirmation_authority = HMACToolConfirmationAuthority(config.confirmation_secret)
    handlers = dict(tool_handlers or {})
    tool_runtime = AgentToolRuntime(
        handlers=ToolExecutorRegistry(handlers),
        confirmation_authority=confirmation_authority,
        confirmation_uses=PostgreSQLConfirmationUseRepository(database),
        audit_sink=PostgreSQLAgentAuditSink(database),
    )
    runtime = TAIOrchestrationRuntime(
        rag_pipeline=rag_pipeline,
        tool_planner=tool_planner or NoToolPlanner(),
        tool_runtime=tool_runtime,
        confirmation_authority=confirmation_authority,
        idempotency=PostgreSQLOrchestrationIdempotencyRepository(database),
        prepared_actions=HeartbeatingPostgreSQLPreparedActionRepository(
            database,
            execution_lease=timedelta(seconds=config.execution_lease_seconds),
            heartbeat_interval=timedelta(seconds=config.heartbeat_interval_seconds),
            heartbeat_stop_timeout=timedelta(
                seconds=config.heartbeat_stop_timeout_seconds
            ),
        ),
        admission=ProcessAdmissionController(
            maximum_active=config.maximum_active_requests,
            requests_per_minute=config.requests_per_minute_per_scope,
        ),
        audit_sink=PostgreSQLOrchestrationAuditSink(database),
        evaluation_sink=PostgreSQLRuntimeEvaluationSink(database),
        clock=clock,
    )
    readiness_probe = ProductionReadinessProbe(
        connection_factory=database,
        model_repository=model_repository,
        router=router,
        endpoint_resolver=endpoint_resolver,
        endpoint_policy=endpoint_policy,
        tools_enabled=bool(handlers),
        cache_ttl=timedelta(seconds=config.readiness_cache_seconds),
        clock=clock,
    )
    return ProductionRuntimeBundle(
        runtime=runtime,
        identity_authority=HMACPlatformIdentityAuthority(config.identity_secret),
        readiness_probe=readiness_probe,
    )


def _required(source: Mapping[str, str], name: str) -> str:
    value = source.get(name, "").strip()
    if not value:
        raise ProductionConfigurationError(f"{name} is required")
    return value


def _secret(source: Mapping[str, str], name: str) -> bytes:
    encoded = _required(source, name)
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ProductionConfigurationError(f"{name} must be valid base64") from error
    if len(decoded) < 32:
        raise ProductionConfigurationError(f"{name} must decode to at least 32 bytes")
    return decoded


def _model_endpoints(raw: str) -> tuple[ModelEndpointBinding, ...]:
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ProductionConfigurationError("TAI_MODEL_ENDPOINTS_JSON is invalid") from error
    if not isinstance(decoded, dict) or not decoded:
        raise ProductionConfigurationError("TAI_MODEL_ENDPOINTS_JSON must be an object")
    bindings: list[ModelEndpointBinding] = []
    for identity, endpoint in decoded.items():
        if not isinstance(identity, str) or not isinstance(endpoint, str):
            raise ProductionConfigurationError("model endpoint bindings must be strings")
        parts = identity.rsplit("@", 1)
        if len(parts) != 2:
            raise ProductionConfigurationError("model endpoint key must use model_id@revision")
        bindings.append(ModelEndpointBinding(parts[0], parts[1], endpoint))
    return tuple(sorted(bindings, key=lambda item: (item.model_id, item.revision)))


def _string_set(raw: str | None, default: set[str]) -> set[str]:
    if raw is None or not raw.strip():
        return set(default)
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ProductionConfigurationError("allowed model hosts JSON is invalid") from error
    if not isinstance(decoded, list) or any(not isinstance(item, str) for item in decoded):
        raise ProductionConfigurationError("allowed model hosts must be a string array")
    return {item.strip() for item in decoded}


def _integer(source: Mapping[str, str], name: str, default: int) -> int:
    raw = source.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError as error:
        raise ProductionConfigurationError(f"{name} must be an integer") from error


def _number(source: Mapping[str, str], name: str, default: float) -> float:
    raw = source.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = float(raw)
    except ValueError as error:
        raise ProductionConfigurationError(f"{name} must be numeric") from error
    if value != value or value in {float("inf"), float("-inf")}:
        raise ProductionConfigurationError(f"{name} must be finite")
    return value
