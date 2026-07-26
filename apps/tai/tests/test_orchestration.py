from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

import pytest

from tai.agent_runtime import (
    AgentAuditEvent,
    AgentRuntimePolicy,
    AgentToolPlan,
    AgentToolRuntime,
    AuthorizedToolInvocation,
    HMACToolConfirmationAuthority,
    InMemoryConfirmationUseRepository,
    PlannedToolCall,
    ToolExecutorRegistry,
)
from tai.context_assembly import ContextAssembler
from tai.contracts import IdentityContext, ToolMode
from tai.knowledge_chunking import KnowledgeChunk
from tai.model_runtime import (
    ModelAttemptStatus,
    ModelGenerationResult,
    ModelInvocationAttempt,
)
from tai.orchestration import (
    CancellationToken,
    InMemoryOrchestrationIdempotencyRepository,
    InMemoryPreparedActionRepository,
    OrchestrationError,
    OrchestrationErrorCode,
    OrchestrationRequest,
    OrchestrationStatus,
    OrchestrationTrace,
    ProcessAdmissionController,
    RuntimeEvaluationObservation,
    TAIOrchestrationRuntime,
)
from tai.rag_pipeline import GroundedAnswerResponse, GroundedRAGPipeline
from tai.retrieval_index import (
    InMemoryRetrievalIndexRepository,
    LexicalRetriever,
    RetrievalDocument,
)
from tai.retrieval_service import RetrievalService

NOW = datetime(2026, 7, 18, 16, 0, tzinfo=UTC)
USER_ID = UUID("10000000-0000-0000-0000-000000000001")
TENANT_ID = UUID("20000000-0000-0000-0000-000000000002")
SESSION_ID = UUID("30000000-0000-0000-0000-000000000003")
CONFIRMATION_SECRET = b"orchestration-confirmation-secret-32-bytes"
REQUEST_TOKEN_A = "a" * 16
REQUEST_TOKEN_B = "b" * 16
REQUEST_TOKEN_RACE = "r" * 16
REQUEST_TOKEN_TIMEOUT = "t" * 16
REQUEST_TOKEN_MIDFLIGHT = "m" * 16


def _identity(*, roles: frozenset[str] = frozenset({"buyer"})) -> IdentityContext:
    return IdentityContext(
        user_id=USER_ID,
        tenant_id=TENANT_ID,
        roles=roles,
        session_id=SESSION_ID,
        mfa_verified=True,
        authenticated=True,
    )


def _request(
    *,
    request_id: str = "orchestration-request-1",
    idempotency_key: str = REQUEST_TOKEN_A,
    question: str = "Как проверяют качество пшеницы?",
    identity: IdentityContext | None = None,
    requested_at: datetime = NOW,
    deadline_at: datetime = NOW + timedelta(seconds=30),
) -> OrchestrationRequest:
    return OrchestrationRequest(
        request_id=request_id,
        idempotency_key=idempotency_key,
        question=question,
        identity=identity or _identity(),
        requested_at=requested_at,
        deadline_at=deadline_at,
    )


class _Model:
    def __init__(self, answer: str = "Качество подтверждают лабораторией [S1].") -> None:
        self.answer = answer
        self.calls = 0

    def generate(
        self,
        prompt: str,
        *,
        request_id: str,
        now: datetime,
        maximum_output_chars: int,
    ) -> ModelGenerationResult:
        assert "official-quality" in prompt
        assert request_id
        assert now == NOW
        assert maximum_output_chars > 0
        self.calls += 1
        return ModelGenerationResult(
            text=self.answer,
            model_id="local-primary",
            revision="r1",
            route_id="d" * 64,
            attempts=(
                ModelInvocationAttempt(
                    model_id="local-primary",
                    revision="r1",
                    status=ModelAttemptStatus.SUCCEEDED,
                    reason=None,
                ),
            ),
        )


class _Planner:
    def __init__(self, calls: tuple[PlannedToolCall, ...] = ()) -> None:
        self.calls = calls
        self.invocations = 0
        self.trace_override: UUID | None = None

    def plan(
        self,
        *,
        request: OrchestrationRequest,
        grounded: GroundedAnswerResponse,
        trace_id: UUID,
        now: datetime,
    ) -> AgentToolPlan:
        assert grounded.answer
        self.invocations += 1
        return AgentToolPlan(
            trace_id=self.trace_override or trace_id,
            plan_id=uuid5(NAMESPACE_URL, f"plan:{request.request_id}"),
            calls=self.calls,
            generated_at=now,
        )


class _Handler:
    def __init__(self, result: dict[str, Any] | None = None) -> None:
        self.result = result or {"status": "ok"}
        self.calls: list[AuthorizedToolInvocation] = []

    def execute(self, invocation: AuthorizedToolInvocation) -> dict[str, Any]:
        self.calls.append(invocation)
        return self.result


class _AgentAudit:
    def record(self, event: AgentAuditEvent) -> None:
        del event


class _Audit:
    def __init__(self) -> None:
        self.traces: list[OrchestrationTrace] = []

    def record(self, trace: OrchestrationTrace) -> None:
        self.traces.append(trace)


class _Evaluation:
    def __init__(self) -> None:
        self.observations: list[RuntimeEvaluationObservation] = []

    def observe(self, observation: RuntimeEvaluationObservation) -> None:
        self.observations.append(observation)


def _rag(model: _Model, *, tenant_id: str | None = None) -> GroundedRAGPipeline:
    repository = InMemoryRetrievalIndexRepository()
    generation = repository.begin_generation()
    repository.add(
        generation,
        (
            RetrievalDocument(
                chunk=KnowledgeChunk(
                    chunk_id="quality-chunk",
                    source_id="official-quality",
                    document_checksum_sha256="a" * 64,
                    ordinal=0,
                    text="пшеница качество лаборатория методика",
                    token_estimate=4,
                ),
                tenant_id=tenant_id,
                trust_score=1.0,
                valid_until=None,
            ),
        ),
    )
    repository.activate(generation)
    return GroundedRAGPipeline(
        retrieval_service=RetrievalService(LexicalRetriever(repository)),
        context_assembler=ContextAssembler(),
        model_gateway=model,
    )


def _runtime(
    *,
    model: _Model | None = None,
    planner: _Planner | None = None,
    handlers: dict[str, _Handler] | None = None,
    audit: _Audit | None = None,
    evaluation: _Evaluation | None = None,
    admission: ProcessAdmissionController | None = None,
    tenant_id: str | None = None,
    clock: Callable[[], datetime] = lambda: NOW,
) -> tuple[TAIOrchestrationRuntime, _Model, _Planner, dict[str, _Handler]]:
    selected_model = model or _Model()
    selected_planner = planner or _Planner()
    selected_handlers = handlers or {}
    authority = HMACToolConfirmationAuthority(CONFIRMATION_SECRET)
    tool_runtime = AgentToolRuntime(
        handlers=ToolExecutorRegistry(selected_handlers),
        confirmation_authority=authority,
        confirmation_uses=InMemoryConfirmationUseRepository(),
        audit_sink=_AgentAudit(),
        policy=AgentRuntimePolicy(),
    )
    runtime = TAIOrchestrationRuntime(
        rag_pipeline=_rag(selected_model, tenant_id=tenant_id),
        tool_planner=selected_planner,
        tool_runtime=tool_runtime,
        confirmation_authority=authority,
        idempotency=InMemoryOrchestrationIdempotencyRepository(),
        prepared_actions=InMemoryPreparedActionRepository(),
        admission=admission,
        audit_sink=audit,
        evaluation_sink=evaluation,
        clock=clock,
    )
    return runtime, selected_model, selected_planner, selected_handlers


def test_runtime_joins_rag_citations_model_audit_and_evaluation() -> None:
    audit = _Audit()
    evaluation = _Evaluation()
    runtime, model, planner, _ = _runtime(audit=audit, evaluation=evaluation)

    response = runtime.answer(_request(), now=NOW)

    assert response.status is OrchestrationStatus.ANSWERED
    assert response.answer == "Качество подтверждают лабораторией [S1]."
    assert response.citations[0].source_id == "official-quality"
    assert response.citations[0].generation == 1
    assert response.model_id == "local-primary"
    assert response.model_revision == "r1"
    assert response.model_route_id == "d" * 64
    assert response.tool_execution is None
    assert response.prepared_actions == ()
    assert model.calls == 1
    assert planner.invocations == 1
    assert audit.traces[0].trace_sha256 == evaluation.observations[0].trace_sha256
    assert evaluation.observations[0].model_invoked is True


def test_read_tool_executes_with_server_identity_and_is_audited() -> None:
    call = PlannedToolCall(
        call_id="read-deal",
        tool_name="getDealSummary",
        arguments={"dealId": "deal-1"},
        requested_mode=ToolMode.READ_ONLY,
    )
    planner = _Planner((call,))
    handler = _Handler({"deal": {"status": "ACTIVE"}})
    runtime, _, _, _ = _runtime(
        planner=planner,
        handlers={"getDealSummary": handler},
    )

    response = runtime.answer(_request(), now=NOW)

    assert response.status is OrchestrationStatus.ANSWERED
    assert response.tool_execution is not None
    assert response.tool_execution.status.value == "COMPLETED"
    assert handler.calls[0].user_id == USER_ID
    assert handler.calls[0].tenant_id == TENANT_ID
    assert handler.calls[0].session_id == SESSION_ID


@pytest.mark.parametrize(
    ("tool_name", "mode", "expected"),
    [
        # A removed tool is unknown whatever mode is claimed for it.
        ("acknowledgeRisk", ToolMode.CONFIRMED_WRITE, "tool is not registered"),
        ("createSupportCase", ToolMode.CONFIRMED_WRITE, "tool is not registered"),
        ("prepareCommandDraft", ToolMode.DRAFT, "tool is not registered"),
        # A tool that does exist cannot be borrowed as a write by asking for one: the mode
        # is refused on its own, before the registry entry is even compared.
        ("getDealSummary", ToolMode.DRAFT, "only READ_ONLY may be requested"),
        ("getDealSummary", ToolMode.CONFIRMED_WRITE, "only READ_ONLY may be requested"),
    ],
)
def test_no_write_plan_is_ever_prepared_or_executed(
    tool_name: str,
    mode: ToolMode,
    expected: str,
) -> None:
    """Owner decision: a write is not prepared, so there is nothing left to confirm.

    This replaces a test that walked the whole confirmed-write lifecycle — prepare,
    confirm once, replay the confirmation idempotently, then fail a rebinding under a
    different role. None of it is reachable: the plan is rejected, no `PreparedAction` is
    produced, and the handler is never entered.

    Both refusal paths are covered on purpose. Removing the tools closes one door, and a
    caller who names a tool that still exists but asks for a write mode meets the other.
    """
    call = PlannedToolCall(
        call_id="write-attempt",
        tool_name=tool_name,
        arguments={"dealId": "deal-1"},
        requested_mode=mode,
    )
    handler = _Handler({"acknowledged": True})
    runtime, _, _, _ = _runtime(
        planner=_Planner((call,)),
        handlers={tool_name: handler},
    )

    with pytest.raises(OrchestrationError, match=expected) as raised:
        runtime.answer(_request(), now=NOW)

    assert raised.value.code is OrchestrationErrorCode.TOOL_PLAN_REJECTED
    assert handler.calls == []


def test_an_answered_read_plan_prepares_no_action_to_confirm() -> None:
    """No answer produces a prepared action, so there is no confirmation race to run.

    The test this replaces drove two threads at one confirmation and asserted that exactly
    one executor won. That race guarded confirmed writes, and it is unreachable now: a
    read plan completes inline and prepares nothing, while a write plan is rejected before
    preparation. What is left to assert is the absence itself — a successful, fully
    executed answer still hands the caller nothing to confirm.
    """
    call = PlannedToolCall(
        call_id="summary-1",
        tool_name="getDealSummary",
        arguments={"dealId": "deal-1"},
        requested_mode=ToolMode.READ_ONLY,
    )
    handler = _Handler({"deal": {"id": "deal-1"}})
    runtime, _, _, _ = _runtime(
        planner=_Planner((call,)),
        handlers={"getDealSummary": handler},
    )

    response = runtime.answer(
        _request(
            request_id="orchestration-request-race",
            idempotency_key=REQUEST_TOKEN_RACE,
        ),
        now=NOW,
    )

    assert response.status is OrchestrationStatus.ANSWERED
    assert response.prepared_actions == ()
    assert len(handler.calls) == 1


def test_policy_denial_happens_before_confirmation_or_tool_execution() -> None:
    call = PlannedToolCall(
        call_id="ack-risk",
        tool_name="acknowledgeRisk",
        arguments={"riskId": "risk-1"},
        requested_mode=ToolMode.CONFIRMED_WRITE,
    )
    handler = _Handler()
    runtime, _, _, _ = _runtime(
        planner=_Planner((call,)),
        handlers={"acknowledgeRisk": handler},
    )

    with pytest.raises(OrchestrationError, match="platform policy") as raised:
        runtime.answer(
            _request(identity=_identity(roles=frozenset({"auditor"}))),
            now=NOW,
        )

    assert raised.value.code is OrchestrationErrorCode.TOOL_PLAN_REJECTED
    assert handler.calls == []


def test_privileged_or_trace_rebound_plans_fail_closed() -> None:
    privileged = PlannedToolCall(
        call_id="privileged",
        tool_name="getDealSummary",
        arguments={"dealId": "deal-1"},
        requested_mode=ToolMode.PRIVILEGED_WRITE,
    )
    runtime, _, _, _ = _runtime(planner=_Planner((privileged,)))
    with pytest.raises(OrchestrationError, match="privileged"):
        runtime.answer(_request(), now=NOW)

    rebound = _Planner()
    rebound.trace_override = UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")
    runtime, _, _, _ = _runtime(planner=rebound)
    with pytest.raises(OrchestrationError, match="trace binding"):
        runtime.answer(_request(), now=NOW)


def test_idempotency_replays_exact_response_and_rejects_conflicting_payload() -> None:
    runtime, model, planner, _ = _runtime()

    first = runtime.answer(_request(), now=NOW)
    replay = runtime.answer(_request(), now=NOW + timedelta(seconds=1))

    assert replay.trace_id == first.trace_id
    assert replay.replayed is True
    assert model.calls == 1
    assert planner.invocations == 1
    with pytest.raises(OrchestrationError, match="different request") as raised:
        runtime.answer(
            _request(question="Как проверяют другой показатель качества?"),
            now=NOW,
        )
    assert raised.value.code is OrchestrationErrorCode.IDEMPOTENCY_CONFLICT
    with pytest.raises(OrchestrationError, match="different request"):
        runtime.answer(
            _request(identity=_identity(roles=frozenset({"seller"}))),
            now=NOW,
        )


def test_abstention_skips_planning_and_tenant_filter_is_server_derived() -> None:
    planner = _Planner()
    runtime, model, _, _ = _runtime(
        planner=planner,
        tenant_id="other-tenant",
    )

    response = runtime.answer(_request(), now=NOW)

    assert response.status is OrchestrationStatus.ABSTAINED
    assert response.answer is None
    assert response.citations == ()
    assert model.calls == 0
    assert planner.invocations == 0


def test_cancellation_deadline_and_rate_limit_release_idempotency_claims() -> None:
    token = CancellationToken()
    token.cancel()
    runtime, _, _, _ = _runtime()
    with pytest.raises(OrchestrationError) as cancelled:
        runtime.answer(_request(), now=NOW, cancellation=token)
    assert cancelled.value.code is OrchestrationErrorCode.REQUEST_CANCELLED

    with pytest.raises(OrchestrationError) as timed_out:
        runtime.answer(
            _request(
                request_id="orchestration-request-timeout",
                idempotency_key=REQUEST_TOKEN_TIMEOUT,
                requested_at=NOW - timedelta(seconds=31),
                deadline_at=NOW - timedelta(seconds=1),
            ),
            now=NOW,
        )
    assert timed_out.value.code is OrchestrationErrorCode.REQUEST_TIMED_OUT

    clock_values = iter((NOW, NOW + timedelta(seconds=31)))
    runtime, _, _, _ = _runtime(clock=lambda: next(clock_values))
    with pytest.raises(OrchestrationError) as expired_during_rag:
        runtime.answer(
            _request(
                request_id="orchestration-request-midflight-timeout",
                idempotency_key=REQUEST_TOKEN_MIDFLIGHT,
            ),
            now=NOW,
        )
    assert expired_during_rag.value.code is OrchestrationErrorCode.REQUEST_TIMED_OUT

    limited = ProcessAdmissionController(maximum_active=1, requests_per_minute=1)
    runtime, _, _, _ = _runtime(admission=limited)
    runtime.answer(_request(), now=NOW)
    with pytest.raises(OrchestrationError) as rate_limited:
        runtime.answer(
            _request(
                request_id="orchestration-request-2",
                idempotency_key=REQUEST_TOKEN_B,
            ),
            now=NOW + timedelta(seconds=1),
        )
    assert rate_limited.value.code is OrchestrationErrorCode.RATE_LIMITED
