from __future__ import annotations

import hashlib
import json
import re
import threading
from collections import deque
from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager, contextmanager
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any, Protocol
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from tai.agent_runtime import (
    AgentExecutionResult,
    AgentExecutionStatus,
    AgentToolPlan,
    AgentToolRuntime,
    HMACToolConfirmationAuthority,
    PlannedToolCall,
    ToolConfirmation,
)
from tai.contracts import IdentityContext, ToolMode
from tai.policy import PolicyDenied
from tai.rag_pipeline import (
    GroundedAnswerRequest,
    GroundedAnswerResponse,
    GroundedAnswerStatus,
    GroundedRAGPipeline,
)

_PORTABLE = re.compile(r"^[A-Za-z0-9._:-]{1,160}$")
_IDEMPOTENCY = re.compile(r"^[A-Za-z0-9._:-]{16,160}$")


class OrchestrationStatus(StrEnum):
    ANSWERED = "ANSWERED"
    PARTIAL = "PARTIAL"
    ABSTAINED = "ABSTAINED"
    REJECTED = "REJECTED"
    TIMED_OUT = "TIMED_OUT"
    CANCELLED = "CANCELLED"


class OrchestrationErrorCode(StrEnum):
    IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT"
    REQUEST_IN_PROGRESS = "REQUEST_IN_PROGRESS"
    OVERLOADED = "OVERLOADED"
    RATE_LIMITED = "RATE_LIMITED"
    REQUEST_TIMED_OUT = "REQUEST_TIMED_OUT"
    REQUEST_CANCELLED = "REQUEST_CANCELLED"
    TOOL_PLAN_REJECTED = "TOOL_PLAN_REJECTED"


class OrchestrationError(RuntimeError):
    def __init__(
        self,
        code: OrchestrationErrorCode,
        message: str,
        *,
        retryable: bool,
        retry_after_seconds: int | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True, slots=True)
class OrchestrationPolicy:
    maximum_question_chars: int = 8_000
    maximum_request_duration: timedelta = timedelta(seconds=90)
    maximum_planned_calls: int = 8
    confirmation_ttl: timedelta = timedelta(minutes=5)

    def __post_init__(self) -> None:
        if not 128 <= self.maximum_question_chars <= 100_000:
            raise ValueError("maximum_question_chars must be between 128 and 100000")
        if self.maximum_request_duration <= timedelta(0):
            raise ValueError("maximum_request_duration must be positive")
        if not 0 <= self.maximum_planned_calls <= 100:
            raise ValueError("maximum_planned_calls must be between 0 and 100")
        if self.confirmation_ttl <= timedelta(0):
            raise ValueError("confirmation_ttl must be positive")


@dataclass(frozen=True, slots=True)
class OrchestrationRequest:
    request_id: str
    idempotency_key: str
    question: str
    identity: IdentityContext
    requested_at: datetime
    deadline_at: datetime
    locale: str = "ru"

    def __post_init__(self) -> None:
        if _PORTABLE.fullmatch(self.request_id.strip()) is None:
            raise ValueError("request_id must use a bounded portable identifier")
        if _IDEMPOTENCY.fullmatch(self.idempotency_key.strip()) is None:
            raise ValueError("idempotency_key must use 16-160 portable characters")
        if not self.question.strip():
            raise ValueError("question must not be blank")
        _aware(self.requested_at, "requested_at")
        _aware(self.deadline_at, "deadline_at")
        if self.deadline_at <= self.requested_at:
            raise ValueError("deadline_at must be after requested_at")
        if self.locale not in {"ru", "en", "zh"}:
            raise ValueError("locale must be one of ru, en or zh")
        if not self.identity.authenticated:
            raise ValueError("orchestration requires authenticated server identity")


@dataclass(frozen=True, slots=True)
class OrchestrationCitation:
    citation_id: str
    source_id: str
    chunk_id: str
    generation: int
    trust_score: float


@dataclass(frozen=True, slots=True)
class PreparedAction:
    trace_id: UUID
    plan_id: UUID
    call: PlannedToolCall
    confirmation: ToolConfirmation


@dataclass(frozen=True, slots=True)
class OrchestrationResponse:
    request_id: str
    trace_id: UUID
    status: OrchestrationStatus
    answer: str | None
    citations: tuple[OrchestrationCitation, ...]
    knowledge_generation: int | None
    model_id: str
    model_revision: str | None
    model_route_id: str | None
    tool_execution: AgentExecutionResult | None
    prepared_actions: tuple[PreparedAction, ...]
    reason: str | None
    completed_at: datetime
    replayed: bool = False


@dataclass(frozen=True, slots=True)
class OrchestrationTrace:
    request_id: str
    trace_id: UUID
    tenant_id: UUID | None
    user_id: UUID
    session_id: UUID
    request_sha256: str
    status: OrchestrationStatus
    rag_status: GroundedAnswerStatus
    model_id: str
    model_revision: str | None
    model_route_id: str | None
    generation: int | None
    source_ids: tuple[str, ...]
    citations: tuple[str, ...]
    tool_plan_sha256: str | None
    tool_status: AgentExecutionStatus | None
    prepared_action_count: int
    reason: str | None
    completed_at: datetime
    trace_sha256: str
    # Typed denial fields. Defaulted so every existing answer trace is unchanged; set only
    # on a refusal, where `reason` alone would be a free-text string nobody can query on.
    outcome: str | None = None
    denial_reason_code: str | None = None
    boundary: str | None = None
    route_category: str | None = None
    organization_id: UUID | None = None
    release_version: str | None = None


@dataclass(frozen=True, slots=True)
class RuntimeEvaluationObservation:
    request_id: str
    trace_id: UUID
    status: OrchestrationStatus
    tenant_id: UUID | None
    source_ids: tuple[str, ...]
    citations: tuple[str, ...]
    model_invoked: bool
    tool_modes: tuple[ToolMode, ...]
    tool_status: AgentExecutionStatus | None
    reason: str | None
    trace_sha256: str
    observed_at: datetime


class OrchestrationAuditSink(Protocol):
    def record(self, trace: OrchestrationTrace) -> None: ...


class RuntimeEvaluationSink(Protocol):
    def observe(self, observation: RuntimeEvaluationObservation) -> None: ...


class NullOrchestrationAuditSink:
    def record(self, trace: OrchestrationTrace) -> None:
        del trace


class NullRuntimeEvaluationSink:
    def observe(self, observation: RuntimeEvaluationObservation) -> None:
        del observation


class ToolPlanner(Protocol):
    def plan(
        self,
        *,
        request: OrchestrationRequest,
        grounded: GroundedAnswerResponse,
        trace_id: UUID,
        now: datetime,
    ) -> AgentToolPlan: ...


class NoToolPlanner:
    def plan(
        self,
        *,
        request: OrchestrationRequest,
        grounded: GroundedAnswerResponse,
        trace_id: UUID,
        now: datetime,
    ) -> AgentToolPlan:
        del grounded
        return AgentToolPlan(
            trace_id=trace_id,
            plan_id=uuid5(NAMESPACE_URL, f"tai-plan:{request.request_id}:{trace_id}"),
            calls=(),
            generated_at=now,
        )


class CancellationToken:
    def __init__(self) -> None:
        self._cancelled = threading.Event()

    def cancel(self) -> None:
        self._cancelled.set()

    @property
    def cancelled(self) -> bool:
        return self._cancelled.is_set()


class AdmissionController(Protocol):
    def admit(self, scope: str, now: datetime) -> AbstractContextManager[None]: ...


class ProcessAdmissionController:
    """Process-level overload guard; distributed limits remain an edge concern."""

    def __init__(self, *, maximum_active: int = 32, requests_per_minute: int = 120) -> None:
        if maximum_active < 1:
            raise ValueError("maximum_active must be positive")
        if requests_per_minute < 1:
            raise ValueError("requests_per_minute must be positive")
        self._maximum_active = maximum_active
        self._requests_per_minute = requests_per_minute
        self._active = 0
        self._requests: dict[str, deque[datetime]] = {}
        self._lock = threading.Lock()

    @contextmanager
    def admit(self, scope: str, now: datetime) -> Iterator[None]:
        _aware(now, "now")
        with self._lock:
            recent = self._requests.setdefault(scope, deque())
            boundary = now - timedelta(minutes=1)
            while recent and recent[0] <= boundary:
                recent.popleft()
            if len(recent) >= self._requests_per_minute:
                raise OrchestrationError(
                    OrchestrationErrorCode.RATE_LIMITED,
                    "request rate limit exceeded",
                    retryable=True,
                    retry_after_seconds=60,
                )
            if self._active >= self._maximum_active:
                raise OrchestrationError(
                    OrchestrationErrorCode.OVERLOADED,
                    "runtime concurrency limit reached",
                    retryable=True,
                    retry_after_seconds=1,
                )
            recent.append(now)
            self._active += 1
        try:
            yield
        finally:
            with self._lock:
                self._active -= 1


class IdempotencyClaimStatus(StrEnum):
    NEW = "NEW"
    REPLAY = "REPLAY"
    CONFLICT = "CONFLICT"
    IN_PROGRESS = "IN_PROGRESS"


@dataclass(frozen=True, slots=True)
class IdempotencyClaim:
    status: IdempotencyClaimStatus
    response: OrchestrationResponse | None = None


class OrchestrationIdempotencyRepository(Protocol):
    def claim(self, scope_sha256: str, request_sha256: str) -> IdempotencyClaim: ...

    def complete(
        self,
        scope_sha256: str,
        request_sha256: str,
        response: OrchestrationResponse,
    ) -> None: ...

    def abandon(self, scope_sha256: str, request_sha256: str) -> None: ...


@dataclass(slots=True)
class _IdempotencyEntry:
    request_sha256: str
    response: OrchestrationResponse | None


class InMemoryOrchestrationIdempotencyRepository:
    """Test/local repository. Production wiring must use durable PostgreSQL authority."""

    def __init__(self) -> None:
        self._entries: dict[str, _IdempotencyEntry] = {}
        self._lock = threading.Lock()

    def claim(self, scope_sha256: str, request_sha256: str) -> IdempotencyClaim:
        with self._lock:
            existing = self._entries.get(scope_sha256)
            if existing is None:
                self._entries[scope_sha256] = _IdempotencyEntry(request_sha256, None)
                return IdempotencyClaim(IdempotencyClaimStatus.NEW)
            if existing.request_sha256 != request_sha256:
                return IdempotencyClaim(IdempotencyClaimStatus.CONFLICT)
            if existing.response is None:
                return IdempotencyClaim(IdempotencyClaimStatus.IN_PROGRESS)
            return IdempotencyClaim(IdempotencyClaimStatus.REPLAY, existing.response)

    def complete(
        self,
        scope_sha256: str,
        request_sha256: str,
        response: OrchestrationResponse,
    ) -> None:
        with self._lock:
            existing = self._entries.get(scope_sha256)
            if existing is None or existing.request_sha256 != request_sha256:
                raise RuntimeError("idempotency claim does not match completion")
            if existing.response is not None and existing.response != response:
                raise RuntimeError("idempotency response is immutable")
            existing.response = response

    def abandon(self, scope_sha256: str, request_sha256: str) -> None:
        with self._lock:
            existing = self._entries.get(scope_sha256)
            if (
                existing is not None
                and existing.request_sha256 == request_sha256
                and existing.response is None
            ):
                del self._entries[scope_sha256]


@dataclass(frozen=True, slots=True)
class StoredPreparedAction:
    action: PreparedAction
    identity: IdentityContext
    result: AgentExecutionResult | None = None
    executing: bool = False


class PreparedActionClaimStatus(StrEnum):
    EXECUTE = "EXECUTE"
    REPLAY = "REPLAY"
    IN_PROGRESS = "IN_PROGRESS"


@dataclass(frozen=True, slots=True)
class PreparedActionClaim:
    status: PreparedActionClaimStatus
    prepared: StoredPreparedAction


class PreparedActionRepository(Protocol):
    def save(self, prepared: StoredPreparedAction) -> None: ...

    def get(self, confirmation_id: UUID) -> StoredPreparedAction | None: ...

    def claim(self, confirmation_id: UUID) -> PreparedActionClaim: ...

    def complete(
        self,
        confirmation_id: UUID,
        result: AgentExecutionResult,
    ) -> StoredPreparedAction: ...

    def abandon(self, confirmation_id: UUID) -> None: ...


class InMemoryPreparedActionRepository:
    """Test/local repository. Production wiring must use durable PostgreSQL authority."""

    def __init__(self) -> None:
        self._actions: dict[UUID, StoredPreparedAction] = {}
        self._lock = threading.Lock()

    def save(self, prepared: StoredPreparedAction) -> None:
        confirmation_id = prepared.action.confirmation.confirmation_id
        with self._lock:
            existing = self._actions.get(confirmation_id)
            if existing is not None and existing != prepared:
                raise RuntimeError("prepared action confirmation identity conflict")
            self._actions[confirmation_id] = prepared

    def get(self, confirmation_id: UUID) -> StoredPreparedAction | None:
        with self._lock:
            return self._actions.get(confirmation_id)

    def claim(self, confirmation_id: UUID) -> PreparedActionClaim:
        with self._lock:
            existing = self._actions.get(confirmation_id)
            if existing is None:
                raise RuntimeError("prepared action does not exist")
            if existing.result is not None:
                return PreparedActionClaim(PreparedActionClaimStatus.REPLAY, existing)
            if existing.executing:
                return PreparedActionClaim(PreparedActionClaimStatus.IN_PROGRESS, existing)
            claimed = replace(existing, executing=True)
            self._actions[confirmation_id] = claimed
            return PreparedActionClaim(PreparedActionClaimStatus.EXECUTE, claimed)

    def complete(
        self,
        confirmation_id: UUID,
        result: AgentExecutionResult,
    ) -> StoredPreparedAction:
        with self._lock:
            existing = self._actions.get(confirmation_id)
            if existing is None:
                raise RuntimeError("prepared action does not exist")
            if existing.result is not None and existing.result != result:
                raise RuntimeError("prepared action result is immutable")
            if existing.result is None and not existing.executing:
                raise RuntimeError("prepared action completion requires an execution claim")
            completed = replace(existing, result=result, executing=False)
            self._actions[confirmation_id] = completed
            return completed

    def abandon(self, confirmation_id: UUID) -> None:
        with self._lock:
            existing = self._actions.get(confirmation_id)
            if existing is not None and existing.result is None and existing.executing:
                self._actions[confirmation_id] = replace(existing, executing=False)


class TAIOrchestrationRuntime:
    """Join identity, RAG, planning, tools, confirmation, audit and evaluation."""

    def __init__(
        self,
        *,
        rag_pipeline: GroundedRAGPipeline,
        tool_planner: ToolPlanner | None,
        tool_runtime: AgentToolRuntime | None,
        confirmation_authority: HMACToolConfirmationAuthority | None,
        idempotency: OrchestrationIdempotencyRepository,
        prepared_actions: PreparedActionRepository,
        admission: AdmissionController | None = None,
        audit_sink: OrchestrationAuditSink | None = None,
        evaluation_sink: RuntimeEvaluationSink | None = None,
        policy: OrchestrationPolicy | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._rag_pipeline = rag_pipeline
        self._tool_planner = tool_planner or NoToolPlanner()
        self._tool_runtime = tool_runtime
        self._confirmation_authority = confirmation_authority
        self._idempotency = idempotency
        self._prepared_actions = prepared_actions
        self._admission = admission or ProcessAdmissionController()
        self._audit_sink = audit_sink or NullOrchestrationAuditSink()
        self._evaluation_sink = evaluation_sink or NullRuntimeEvaluationSink()
        self._policy = policy or OrchestrationPolicy()
        self._clock = clock or (lambda: datetime.now(UTC))

    def answer(
        self,
        request: OrchestrationRequest,
        *,
        now: datetime,
        cancellation: CancellationToken | None = None,
    ) -> OrchestrationResponse:
        self._validate_request(request, now)
        request_sha256 = _request_sha256(request)
        scope_sha256 = _idempotency_scope_sha256(request)
        claim = self._idempotency.claim(scope_sha256, request_sha256)
        if claim.status is IdempotencyClaimStatus.REPLAY:
            if claim.response is None:
                raise RuntimeError("replay claim is missing response")
            return replace(claim.response, replayed=True)
        if claim.status is IdempotencyClaimStatus.CONFLICT:
            raise OrchestrationError(
                OrchestrationErrorCode.IDEMPOTENCY_CONFLICT,
                "idempotency key was reused for a different request",
                retryable=False,
            )
        if claim.status is IdempotencyClaimStatus.IN_PROGRESS:
            raise OrchestrationError(
                OrchestrationErrorCode.REQUEST_IN_PROGRESS,
                "request with this idempotency key is already in progress",
                retryable=True,
                retry_after_seconds=1,
            )
        try:
            with self._admission.admit(_admission_scope(request.identity), now):
                response = self._execute(request, request_sha256, now, cancellation)
            self._idempotency.complete(scope_sha256, request_sha256, response)
            return response
        except Exception:
            self._idempotency.abandon(scope_sha256, request_sha256)
            raise

    def confirm_action(
        self,
        confirmation: ToolConfirmation,
        *,
        identity: IdentityContext,
        now: datetime,
    ) -> AgentExecutionResult:
        """Refuse to execute a confirmed action, and audit the refusal.

        Owner decision of 26.07.2026. This used to be the executor for confirmed writes:
        look up the prepared action, check its identity and confirmation binding, claim it
        atomically against replay and concurrency, run the tool and record the result. All
        of that only matters if a confirmed write is something TAI performs, and item 4 of
        the decision says it is not — even after the user confirms.

        The refusal is here because this is the single point where a confirmed write became
        a real one. Nothing upstream can produce a prepared action any more, so the only
        callers left are a client replaying a confirmation minted before this change, or a
        probe of the retained route. Both are refused — and both are recorded, because a
        silent refusal leaves no evidence that anyone tried.

        Exactly one denial event is written, before the error is raised, and it is the only
        side effect: no tool runs, no platform command is formed, no deal changes, no
        prepared action is stored, and nothing financial is touched. The refusal therefore
        stays idempotent in the sense that matters — repeating it mutates no platform state
        — while still auditing each attempt separately, since repeated probing is exactly
        what an operator needs to be able to see.
        """
        _aware(now, "now")
        self._audit_sink.record(
            _confirmation_denial_trace(
                confirmation=confirmation,
                identity=identity,
                now=now,
            )
        )
        raise OrchestrationError(
            OrchestrationErrorCode.TOOL_PLAN_REJECTED,
            "TAI is INFORMATIONAL_ONLY: confirmed actions are deferred by owner decision "
            "and no confirmation can be executed",
            retryable=False,
        )

    def _execute(
        self,
        request: OrchestrationRequest,
        request_sha256: str,
        now: datetime,
        cancellation: CancellationToken | None,
    ) -> OrchestrationResponse:
        self._check_control(request, cancellation)
        trace_id = uuid5(
            NAMESPACE_URL,
            f"tai-trace:{request.request_id}:{request_sha256}",
        )
        grounded = self._rag_pipeline.answer(
            GroundedAnswerRequest(
                request_id=request.request_id,
                question=request.question,
                tenant_id=(
                    None if request.identity.tenant_id is None else str(request.identity.tenant_id)
                ),
                requested_at=now,
            )
        )
        stage_now = self._check_control(request, cancellation)
        plan: AgentToolPlan | None = None
        tool_execution: AgentExecutionResult | None = None
        prepared: tuple[PreparedAction, ...] = ()
        reason = grounded.trace.reason
        status = _status_from_grounded(grounded.status)
        if grounded.status is GroundedAnswerStatus.ANSWERED:
            plan = self._tool_planner.plan(
                request=request,
                grounded=grounded,
                trace_id=trace_id,
                now=stage_now,
            )
            self._validate_plan(plan, trace_id)
            self._authorize_plan(plan, request.identity)
            stage_now = self._check_control(request, cancellation)
            safe_calls, confirmed_calls = _partition_calls(plan.calls)
            if safe_calls:
                if self._tool_runtime is None:
                    raise RuntimeError("tool plan requires an unconfigured tool runtime")
                safe_plan = replace(plan, calls=safe_calls)
                tool_execution = self._tool_runtime.execute(
                    safe_plan,
                    identity=request.identity,
                    now=stage_now,
                )
                stage_now = self._check_control(request, cancellation)
                if tool_execution.status is not AgentExecutionStatus.COMPLETED:
                    status = OrchestrationStatus.PARTIAL
                    reason = "one or more planned tools did not complete"
            if confirmed_calls:
                prepared = self._prepare_actions(
                    plan=plan,
                    calls=confirmed_calls,
                    identity=request.identity,
                    now=stage_now,
                )
        completed_at = self._check_control(request, cancellation)
        response = OrchestrationResponse(
            request_id=request.request_id,
            trace_id=trace_id,
            status=status,
            answer=grounded.answer,
            citations=_citations(grounded),
            knowledge_generation=grounded.trace.generation,
            model_id=grounded.trace.model_id,
            model_revision=grounded.trace.model_revision,
            model_route_id=grounded.trace.model_route_id,
            tool_execution=tool_execution,
            prepared_actions=prepared,
            reason=reason,
            completed_at=completed_at,
        )
        trace = _trace(
            request=request,
            response=response,
            grounded=grounded,
            request_sha256=request_sha256,
            plan=plan,
        )
        self._audit_sink.record(trace)
        self._evaluation_sink.observe(_evaluation_observation(trace, grounded, plan))
        return response

    def _prepare_actions(
        self,
        *,
        plan: AgentToolPlan,
        calls: tuple[PlannedToolCall, ...],
        identity: IdentityContext,
        now: datetime,
    ) -> tuple[PreparedAction, ...]:
        """Refuse to prepare an action. Owner decision of 26.07.2026.

        `_partition_calls` rejects every non-READ_ONLY plan, so this is already
        unreachable. It fails closed anyway rather than being left as a working minting
        path one refactor away from being called again: preparing an action is what
        produced the confirmation a user could then return with.
        """
        del plan, calls, identity, now
        raise OrchestrationError(
            OrchestrationErrorCode.TOOL_PLAN_REJECTED,
            "TAI is INFORMATIONAL_ONLY: no action is prepared for confirmation",
            retryable=False,
        )

    def _validate_request(self, request: OrchestrationRequest, now: datetime) -> None:
        _aware(now, "now")
        if len(request.question) > self._policy.maximum_question_chars:
            raise ValueError("question exceeds orchestration input budget")
        if request.deadline_at - request.requested_at > self._policy.maximum_request_duration:
            raise ValueError("request deadline exceeds orchestration policy")
        if now > request.deadline_at:
            raise OrchestrationError(
                OrchestrationErrorCode.REQUEST_TIMED_OUT,
                "request deadline has expired",
                retryable=True,
            )

    def _validate_plan(self, plan: AgentToolPlan, trace_id: UUID) -> None:
        if plan.trace_id != trace_id:
            raise OrchestrationError(
                OrchestrationErrorCode.TOOL_PLAN_REJECTED,
                "tool plan trace binding failed",
                retryable=False,
            )
        if len(plan.calls) > self._policy.maximum_planned_calls:
            raise OrchestrationError(
                OrchestrationErrorCode.TOOL_PLAN_REJECTED,
                "tool plan exceeds orchestration call budget",
                retryable=False,
            )
        if any(call.requested_mode is ToolMode.PRIVILEGED_WRITE for call in plan.calls):
            raise OrchestrationError(
                OrchestrationErrorCode.TOOL_PLAN_REJECTED,
                "AI tool plans cannot contain privileged writes",
                retryable=False,
            )

    def _authorize_plan(self, plan: AgentToolPlan, identity: IdentityContext) -> None:
        if not plan.calls:
            return
        if self._tool_runtime is None:
            raise OrchestrationError(
                OrchestrationErrorCode.TOOL_PLAN_REJECTED,
                "tool plan requires an unconfigured tool runtime",
                retryable=False,
            )
        try:
            self._tool_runtime.preflight(plan, identity=identity)
        except (PolicyDenied, TypeError, ValueError) as error:
            raise OrchestrationError(
                OrchestrationErrorCode.TOOL_PLAN_REJECTED,
                f"tool plan was denied by platform policy: {error}",
                retryable=False,
            ) from error

    def _check_control(
        self,
        request: OrchestrationRequest,
        cancellation: CancellationToken | None,
    ) -> datetime:
        now = self._clock()
        _aware(now, "clock")
        if cancellation is not None and cancellation.cancelled:
            raise OrchestrationError(
                OrchestrationErrorCode.REQUEST_CANCELLED,
                "request was cancelled",
                retryable=True,
            )
        if now > request.deadline_at:
            raise OrchestrationError(
                OrchestrationErrorCode.REQUEST_TIMED_OUT,
                "request deadline has expired",
                retryable=True,
            )
        return now


def _partition_calls(
    calls: tuple[PlannedToolCall, ...],
) -> tuple[tuple[PlannedToolCall, ...], tuple[PlannedToolCall, ...]]:
    # Owner decision of 26.07.2026: TAI is INFORMATIONAL_ONLY. READ_ONLY is the only mode
    # that can be carried out, so every other mode rejects the whole plan here rather than
    # being routed onward.
    #
    # This is the chokepoint that makes item 4 of the boundary true — TAI performs no
    # CONFIRMED_WRITE even after the user confirms. A confirmed write used to be split off
    # and handed to `_prepare_actions`, which minted a signed confirmation the user could
    # come back with. Now the plan never reaches that branch: there is nothing to confirm,
    # so confirming changes nothing. The confirmation authority below is left intact and
    # unreachable, so restoring confirmed actions is a deliberate future change under a new
    # owner decision rather than a flag someone flips.
    safe = tuple(call for call in calls if call.requested_mode is ToolMode.READ_ONLY)
    confirmed: tuple[PlannedToolCall, ...] = ()
    if len(safe) != len(calls):
        raise OrchestrationError(
            OrchestrationErrorCode.TOOL_PLAN_REJECTED,
            "TAI is INFORMATIONAL_ONLY: tool plan contains a mode that is not READ_ONLY",
            retryable=False,
        )
    return safe, confirmed


def _citations(grounded: GroundedAnswerResponse) -> tuple[OrchestrationCitation, ...]:
    cited = set(grounded.trace.citations)
    return tuple(
        OrchestrationCitation(
            citation_id=block.citation_id,
            source_id=block.source_id,
            chunk_id=block.chunk_id,
            generation=block.generation,
            trust_score=block.trust_score,
        )
        for block in grounded.context.blocks
        if block.citation_id in cited
    )


def _status_from_grounded(status: GroundedAnswerStatus) -> OrchestrationStatus:
    return {
        GroundedAnswerStatus.ANSWERED: OrchestrationStatus.ANSWERED,
        GroundedAnswerStatus.ABSTAINED: OrchestrationStatus.ABSTAINED,
        GroundedAnswerStatus.REJECTED: OrchestrationStatus.REJECTED,
    }[status]


def _request_sha256(request: OrchestrationRequest) -> str:
    return _sha256(
        {
            "locale": request.locale,
            "question": request.question.strip(),
            "request_id": request.request_id.strip(),
            "roles": sorted(request.identity.roles),
            "session_id": str(request.identity.session_id),
            "tenant_id": (
                None if request.identity.tenant_id is None else str(request.identity.tenant_id)
            ),
            "user_id": str(request.identity.user_id),
            "authenticated": request.identity.authenticated,
            "mfa_verified": request.identity.mfa_verified,
        }
    )


def _idempotency_scope_sha256(request: OrchestrationRequest) -> str:
    return _sha256(
        {
            "idempotency_key": request.idempotency_key.strip(),
            "session_id": str(request.identity.session_id),
            "tenant_id": (
                None if request.identity.tenant_id is None else str(request.identity.tenant_id)
            ),
            "user_id": str(request.identity.user_id),
        }
    )


def _admission_scope(identity: IdentityContext) -> str:
    return f"{identity.tenant_id or 'public'}:{identity.user_id}"


def _trace(
    *,
    request: OrchestrationRequest,
    response: OrchestrationResponse,
    grounded: GroundedAnswerResponse,
    request_sha256: str,
    plan: AgentToolPlan | None,
) -> OrchestrationTrace:
    payload: dict[str, Any] = {
        "citations": list(grounded.trace.citations),
        "generation": grounded.trace.generation,
        "model_id": grounded.trace.model_id,
        "model_revision": grounded.trace.model_revision,
        "model_route_id": grounded.trace.model_route_id,
        "prepared_action_count": len(response.prepared_actions),
        "request_id": request.request_id,
        "request_sha256": request_sha256,
        "source_ids": list(grounded.trace.source_ids),
        "status": response.status.value,
        "tool_plan_sha256": None if plan is None else _plan_sha256(plan),
        "tool_status": (
            None if response.tool_execution is None else response.tool_execution.status.value
        ),
        "trace_id": str(response.trace_id),
    }
    return OrchestrationTrace(
        request_id=request.request_id,
        trace_id=response.trace_id,
        tenant_id=request.identity.tenant_id,
        user_id=request.identity.user_id,
        session_id=request.identity.session_id,
        request_sha256=request_sha256,
        status=response.status,
        rag_status=grounded.status,
        model_id=grounded.trace.model_id,
        model_revision=grounded.trace.model_revision,
        model_route_id=grounded.trace.model_route_id,
        generation=grounded.trace.generation,
        source_ids=grounded.trace.source_ids,
        citations=grounded.trace.citations,
        tool_plan_sha256=None if plan is None else _plan_sha256(plan),
        tool_status=(
            None if response.tool_execution is None else response.tool_execution.status
        ),
        prepared_action_count=len(response.prepared_actions),
        reason=response.reason,
        completed_at=response.completed_at,
        trace_sha256=_sha256(payload),
    )


#: Stable machine-readable code for the refusal. Queried on, so it must not drift with the
#: wording of the message.
CONFIRMATION_DENIAL_REASON_CODE = "CONFIRMATION_DISABLED_BY_OWNER_DECISION"
CONFIRMATION_DENIAL_OUTCOME = "DENIED"
INFORMATIONAL_ONLY_BOUNDARY = "INFORMATIONAL_ONLY"
CONFIRMATION_ROUTE_CATEGORY = "PLATFORM_ACTION_CONFIRMATION"
#: No model is invoked on this path. The column is NOT NULL, so it says so rather than
#: naming a model that never ran.
CONFIRMATION_DENIAL_MODEL_ID = "NOT_INVOKED"


def _confirmation_denial_trace(
    *,
    confirmation: ToolConfirmation,
    identity: IdentityContext,
    now: datetime,
) -> OrchestrationTrace:
    """Build the audit event for a refused confirmation.

    What is deliberately absent, because an audit row is read by more people than the
    request was: the confirmation's HMAC signature, the confirmation id itself, the call
    arguments, the prompt, any payload, any document, and anything financial. The
    confirmation is identified by a digest of its id, which lets an operator correlate
    repeated probes of the same confirmation without the audit becoming a place to recover
    a token from.

    Identifiers come from the server-derived `IdentityContext` only. No role is recorded at
    all: the refusal does not depend on one, and a role in an audit row invites being read
    as the authority that produced the decision.

    `organization_id` and `release_version` stay `None` rather than being guessed.
    `IdentityContext` carries no organization, and the package exposes no release constant;
    inventing either would put a value in the audit that nothing established.
    """
    correlation = hashlib.sha256(
        str(confirmation.confirmation_id).encode("utf-8")
    ).hexdigest()
    trace_id = uuid4()
    completed_at = now.astimezone(UTC)
    payload: dict[str, Any] = {
        "boundary": INFORMATIONAL_ONLY_BOUNDARY,
        "confirmation_correlation_sha256": correlation,
        "denial_reason_code": CONFIRMATION_DENIAL_REASON_CODE,
        "outcome": CONFIRMATION_DENIAL_OUTCOME,
        "route_category": CONFIRMATION_ROUTE_CATEGORY,
        "session_id": str(identity.session_id),
        "tenant_id": None if identity.tenant_id is None else str(identity.tenant_id),
        "trace_id": str(trace_id),
        "user_id": str(identity.user_id),
        "completed_at": completed_at.isoformat(),
    }
    return OrchestrationTrace(
        request_id=f"confirmation-denial:{correlation}",
        trace_id=trace_id,
        tenant_id=identity.tenant_id,
        user_id=identity.user_id,
        session_id=identity.session_id,
        request_sha256=correlation,
        status=OrchestrationStatus.REJECTED,
        rag_status=GroundedAnswerStatus.REJECTED,
        model_id=CONFIRMATION_DENIAL_MODEL_ID,
        model_revision=None,
        model_route_id=None,
        generation=None,
        source_ids=(),
        citations=(),
        tool_plan_sha256=None,
        tool_status=AgentExecutionStatus.DENIED,
        prepared_action_count=0,
        reason=CONFIRMATION_DENIAL_REASON_CODE,
        completed_at=completed_at,
        trace_sha256=_sha256(payload),
        outcome=CONFIRMATION_DENIAL_OUTCOME,
        denial_reason_code=CONFIRMATION_DENIAL_REASON_CODE,
        boundary=INFORMATIONAL_ONLY_BOUNDARY,
        route_category=CONFIRMATION_ROUTE_CATEGORY,
        organization_id=None,
        release_version=None,
    )


def _evaluation_observation(
    trace: OrchestrationTrace,
    grounded: GroundedAnswerResponse,
    plan: AgentToolPlan | None,
) -> RuntimeEvaluationObservation:
    return RuntimeEvaluationObservation(
        request_id=trace.request_id,
        trace_id=trace.trace_id,
        status=trace.status,
        tenant_id=trace.tenant_id,
        source_ids=trace.source_ids,
        citations=trace.citations,
        model_invoked=grounded.trace.model_invoked,
        tool_modes=() if plan is None else tuple(call.requested_mode for call in plan.calls),
        tool_status=trace.tool_status,
        reason=trace.reason,
        trace_sha256=trace.trace_sha256,
        observed_at=trace.completed_at,
    )


def _plan_sha256(plan: AgentToolPlan) -> str:
    return _sha256(
        {
            "calls": [
                {
                    "arguments": dict(call.arguments),
                    "call_id": call.call_id,
                    "requested_mode": call.requested_mode.value,
                    "tool_name": call.tool_name,
                }
                for call in plan.calls
            ],
            "plan_id": str(plan.plan_id),
            "trace_id": str(plan.trace_id),
        }
    )


def _sha256(payload: Any) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
        allow_nan=False,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")
