from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime, timedelta

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
from tai.model_runtime import (
    DeterministicModelRouter,
    ProcessLocalModelCapacityGate,
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
from tai.production_runtime import (
    ProductionReadinessProbe,
    ProductionRuntimeBundle,
    ProductionRuntimeConfig,
)
from tai.rag_pipeline import GroundedRAGPipeline
from tai.retrieval_index import LexicalRetriever
from tai.retrieval_service import RetrievalService
from tai.secure_model_transport import BearerHTTPClientJSONTransport


class ProductionModelAccessError(ValueError):
    """Raised when protected local-model access is absent or malformed."""


@dataclass(frozen=True, slots=True)
class ProductionModelAccess:
    bearer_token: str = field(repr=False)

    def __post_init__(self) -> None:
        try:
            self.transport()
        except ValueError as error:
            raise ProductionModelAccessError("TAI model access is invalid") from error

    @classmethod
    def from_environment(cls, source: Mapping[str, str]) -> ProductionModelAccess:
        token = source.get("TAI_MODEL_BEARER_TOKEN")
        if token is None or not token:
            raise ProductionModelAccessError("TAI_MODEL_BEARER_TOKEN is required")
        return cls(bearer_token=token)

    def transport(self) -> BearerHTTPClientJSONTransport:
        return BearerHTTPClientJSONTransport(self.bearer_token)


def build_authenticated_production_runtime(
    config: ProductionRuntimeConfig,
    *,
    model_access: ProductionModelAccess,
    connection_factory: ConnectionFactory,
    tool_handlers: Mapping[str, ToolHandler] | None = None,
    tool_planner: ToolPlanner | None = None,
    clock: Callable[[], datetime] | None = None,
) -> ProductionRuntimeBundle:
    database = connection_factory
    endpoint_policy = LocalEndpointPolicy(allowed_hosts=config.allowed_model_hosts)
    endpoint_resolver = StaticModelEndpointResolver(config.endpoint_mapping())
    model_repository = PostgreSQLModelRuntimeRepository(database)
    router = DeterministicModelRouter(model_repository, model_repository)
    model_gateway = RoutedLocalModelGateway(
        router=router,
        invoker=OpenAICompatibleLocalInvoker(
            endpoint_resolver=endpoint_resolver,
            endpoint_policy=endpoint_policy,
            transport=model_access.transport(),
        ),
        capacity_gate=ProcessLocalModelCapacityGate(config.model_maximum_inflight),
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
