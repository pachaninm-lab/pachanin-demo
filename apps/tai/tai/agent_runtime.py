from __future__ import annotations

import hashlib
import hmac
import json
import math
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any, Protocol
from uuid import UUID, uuid4

from tai.contracts import IdentityContext, ToolMode, ToolRequest
from tai.policy import PolicyDenied, ToolDefinition, authorize_tool

_IDENTIFIER = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
_RESERVED_ARGUMENT_KEYS = frozenset(
    {
        "accesstoken",
        "authenticated",
        "authorization",
        "cookie",
        "explicituserconfirmation",
        "headers",
        "justification",
        "mfaverified",
        "refreshtoken",
        "role",
        "roles",
        "sessionid",
        "tenantid",
        "userid",
    }
)


class AgentExecutionStatus(StrEnum):
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    DENIED = "DENIED"
    FAILED = "FAILED"


class ToolInvocationStatus(StrEnum):
    SUCCEEDED = "SUCCEEDED"
    DENIED = "DENIED"
    FAILED = "FAILED"


@dataclass(frozen=True, slots=True)
class PlannedToolCall:
    call_id: str
    tool_name: str
    arguments: Mapping[str, Any]
    requested_mode: ToolMode

    def __post_init__(self) -> None:
        if _IDENTIFIER.fullmatch(self.call_id.strip()) is None:
            raise ValueError("call_id must use a bounded portable identifier")
        if _IDENTIFIER.fullmatch(self.tool_name.strip()) is None:
            raise ValueError("tool_name must use a bounded portable identifier")
        if self.requested_mode is ToolMode.PROHIBITED:
            raise ValueError("a prohibited mode cannot be planned")


@dataclass(frozen=True, slots=True)
class AgentToolPlan:
    trace_id: UUID
    plan_id: UUID
    calls: tuple[PlannedToolCall, ...]
    generated_at: datetime

    def __post_init__(self) -> None:
        _validate_aware(self.generated_at, "generated_at")
        call_ids = [call.call_id for call in self.calls]
        if len(call_ids) != len(set(call_ids)):
            raise ValueError("tool call IDs must be unique inside a plan")


@dataclass(frozen=True, slots=True)
class ToolConfirmation:
    confirmation_id: UUID
    call_id: str
    request_sha256: str
    user_id: UUID
    tenant_id: UUID | None
    session_id: UUID
    issued_at: datetime
    expires_at: datetime
    mfa_verified: bool
    signature_sha256: str


@dataclass(frozen=True, slots=True)
class AgentRuntimePolicy:
    maximum_calls: int = 8
    maximum_argument_bytes: int = 32_768
    maximum_result_bytes: int = 262_144
    maximum_argument_depth: int = 12
    maximum_confirmation_ttl: timedelta = timedelta(minutes=5)
    stop_on_denial: bool = True
    stop_on_failure: bool = True

    def __post_init__(self) -> None:
        if not 1 <= self.maximum_calls <= 100:
            raise ValueError("maximum_calls must be between 1 and 100")
        if not 256 <= self.maximum_argument_bytes <= 1_048_576:
            raise ValueError("maximum_argument_bytes must be between 256 and 1048576")
        if not 256 <= self.maximum_result_bytes <= 4_194_304:
            raise ValueError("maximum_result_bytes must be between 256 and 4194304")
        if not 1 <= self.maximum_argument_depth <= 64:
            raise ValueError("maximum_argument_depth must be between 1 and 64")
        if self.maximum_confirmation_ttl <= timedelta(0):
            raise ValueError("maximum_confirmation_ttl must be positive")


@dataclass(frozen=True, slots=True)
class AuthorizedToolInvocation:
    trace_id: UUID
    plan_id: UUID
    call_id: str
    tool_name: str
    mode: ToolMode
    arguments: Mapping[str, Any]
    user_id: UUID
    tenant_id: UUID | None
    session_id: UUID
    idempotency_key: str
    requested_at: datetime


@dataclass(frozen=True, slots=True)
class ToolInvocationResult:
    call_id: str
    tool_name: str
    mode: ToolMode
    status: ToolInvocationStatus
    result: Mapping[str, Any] | None
    request_sha256: str
    result_sha256: str | None
    idempotency_key: str | None
    reason: str | None


@dataclass(frozen=True, slots=True)
class AgentExecutionResult:
    trace_id: UUID
    plan_id: UUID
    status: AgentExecutionStatus
    plan_sha256: str
    calls: tuple[ToolInvocationResult, ...]
    completed_at: datetime


@dataclass(frozen=True, slots=True)
class AgentAuditEvent:
    event_id: str
    trace_id: UUID
    plan_id: UUID
    call_id: str
    tool_name: str
    mode: ToolMode
    status: ToolInvocationStatus
    user_id: UUID
    tenant_id: UUID | None
    session_id: UUID
    request_sha256: str
    result_sha256: str | None
    idempotency_key: str | None
    reason: str | None
    occurred_at: datetime


class ToolHandler(Protocol):
    def execute(self, invocation: AuthorizedToolInvocation) -> Mapping[str, Any]: ...


class AgentAuditSink(Protocol):
    def record(self, event: AgentAuditEvent) -> None: ...


class ConfirmationUseRepository(Protocol):
    def claim(
        self,
        *,
        confirmation: ToolConfirmation,
        request_sha256: str,
        idempotency_key: str,
        used_at: datetime,
    ) -> bool: ...


class NullAgentAuditSink:
    def record(self, event: AgentAuditEvent) -> None:
        del event


class InMemoryConfirmationUseRepository:
    """Test/local repository. Production wiring must use durable PostgreSQL authority."""

    def __init__(self) -> None:
        self._claims: dict[UUID, tuple[str, str]] = {}

    def claim(
        self,
        *,
        confirmation: ToolConfirmation,
        request_sha256: str,
        idempotency_key: str,
        used_at: datetime,
    ) -> bool:
        del used_at
        binding = (request_sha256, idempotency_key)
        existing = self._claims.get(confirmation.confirmation_id)
        if existing is None:
            self._claims[confirmation.confirmation_id] = binding
            return True
        return existing == binding


class ToolExecutorRegistry:
    def __init__(self, handlers: Mapping[str, ToolHandler]) -> None:
        normalized: dict[str, ToolHandler] = {}
        for name, handler in handlers.items():
            tool_name = name.strip()
            if _IDENTIFIER.fullmatch(tool_name) is None:
                raise ValueError("registered tool name must use a portable identifier")
            normalized[tool_name] = handler
        self._handlers = normalized

    def resolve(self, tool_name: str) -> ToolHandler | None:
        return self._handlers.get(tool_name)


class HMACToolConfirmationAuthority:
    """Issue and verify confirmations bound to server identity and an exact call digest."""

    def __init__(
        self,
        secret: bytes,
        *,
        maximum_ttl: timedelta = timedelta(minutes=5),
    ) -> None:
        if len(secret) < 32:
            raise ValueError("confirmation secret must contain at least 32 bytes")
        if maximum_ttl <= timedelta(0):
            raise ValueError("maximum_ttl must be positive")
        self._secret = bytes(secret)
        self._maximum_ttl = maximum_ttl

    def issue(
        self,
        *,
        call: PlannedToolCall,
        trace_id: UUID,
        identity: IdentityContext,
        issued_at: datetime,
        expires_at: datetime,
    ) -> ToolConfirmation:
        _validate_aware(issued_at, "issued_at")
        _validate_aware(expires_at, "expires_at")
        if not identity.authenticated:
            raise PolicyDenied("authenticated server session required")
        if call.requested_mode is not ToolMode.CONFIRMED_WRITE:
            raise ValueError("confirmation can only be issued for confirmed writes")
        if expires_at <= issued_at:
            raise ValueError("confirmation expiry must be after issue time")
        if expires_at - issued_at > self._maximum_ttl:
            raise ValueError("confirmation TTL exceeds authority policy")
        request_sha256 = tool_request_sha256(trace_id, call)
        unsigned = ToolConfirmation(
            confirmation_id=uuid4(),
            call_id=call.call_id,
            request_sha256=request_sha256,
            user_id=identity.user_id,
            tenant_id=identity.tenant_id,
            session_id=identity.session_id,
            issued_at=issued_at,
            expires_at=expires_at,
            mfa_verified=identity.mfa_verified,
            signature_sha256="",
        )
        return replace_confirmation_signature(unsigned, self._signature(unsigned))

    def verify(
        self,
        confirmation: ToolConfirmation,
        *,
        call: PlannedToolCall,
        trace_id: UUID,
        identity: IdentityContext,
        now: datetime,
    ) -> bool:
        _validate_aware(now, "now")
        if not _confirmation_timestamps_valid(confirmation, now, self._maximum_ttl):
            return False
        try:
            expected_request = tool_request_sha256(trace_id, call)
        except (TypeError, ValueError):
            return False
        if confirmation.call_id != call.call_id:
            return False
        if confirmation.request_sha256 != expected_request:
            return False
        if confirmation.user_id != identity.user_id:
            return False
        if confirmation.tenant_id != identity.tenant_id:
            return False
        if confirmation.session_id != identity.session_id:
            return False
        if confirmation.mfa_verified != identity.mfa_verified:
            return False
        unsigned = replace_confirmation_signature(confirmation, "")
        return hmac.compare_digest(
            confirmation.signature_sha256,
            self._signature(unsigned),
        )

    def _signature(self, confirmation: ToolConfirmation) -> str:
        payload = _confirmation_payload(confirmation)
        return hmac.new(self._secret, payload.encode(), hashlib.sha256).hexdigest()


def replace_confirmation_signature(
    confirmation: ToolConfirmation,
    signature_sha256: str,
) -> ToolConfirmation:
    return ToolConfirmation(
        confirmation_id=confirmation.confirmation_id,
        call_id=confirmation.call_id,
        request_sha256=confirmation.request_sha256,
        user_id=confirmation.user_id,
        tenant_id=confirmation.tenant_id,
        session_id=confirmation.session_id,
        issued_at=confirmation.issued_at,
        expires_at=confirmation.expires_at,
        mfa_verified=confirmation.mfa_verified,
        signature_sha256=signature_sha256,
    )


class AgentToolRuntime:
    """Execute a bounded plan through deny-by-default platform policy and handlers."""

    def __init__(
        self,
        *,
        handlers: ToolExecutorRegistry,
        confirmation_authority: HMACToolConfirmationAuthority,
        confirmation_uses: ConfirmationUseRepository,
        audit_sink: AgentAuditSink | None = None,
        policy: AgentRuntimePolicy | None = None,
    ) -> None:
        self._handlers = handlers
        self._confirmation_authority = confirmation_authority
        self._confirmation_uses = confirmation_uses
        self._audit_sink = audit_sink or NullAgentAuditSink()
        self._policy = policy or AgentRuntimePolicy()

    def preflight(self, plan: AgentToolPlan, *, identity: IdentityContext) -> None:
        """Validate a model-produced plan without executing or consuming confirmation."""

        _safe_agent_plan_sha256(plan)
        if len(plan.calls) > self._policy.maximum_calls:
            raise ValueError("tool plan exceeds the maximum call count")
        if not identity.authenticated:
            raise PolicyDenied("authenticated server session required")
        for call in plan.calls:
            arguments = _validated_arguments(
                call.arguments,
                maximum_bytes=self._policy.maximum_argument_bytes,
                maximum_depth=self._policy.maximum_argument_depth,
            )
            if call.requested_mode is ToolMode.PRIVILEGED_WRITE:
                raise PolicyDenied("privileged writes are not executable by the AI agent")
            definition = authorize_tool(
                identity,
                ToolRequest(
                    trace_id=plan.trace_id,
                    tool_name=call.tool_name,
                    arguments=arguments,
                    requested_mode=call.requested_mode,
                    explicit_user_confirmation=(
                        call.requested_mode is ToolMode.CONFIRMED_WRITE
                    ),
                ),
            )
            if self._handlers.resolve(definition.name) is None:
                raise PolicyDenied("authorized tool has no registered executor")

    def execute(
        self,
        plan: AgentToolPlan,
        *,
        identity: IdentityContext,
        confirmations: tuple[ToolConfirmation, ...] = (),
        now: datetime,
    ) -> AgentExecutionResult:
        _validate_aware(now, "now")
        plan_sha256 = _safe_agent_plan_sha256(plan)
        if len(plan.calls) > self._policy.maximum_calls:
            raise ValueError("tool plan exceeds the maximum call count")
        if not identity.authenticated:
            raise PolicyDenied("authenticated server session required")
        confirmation_by_call = _confirmation_map(confirmations)
        results: list[ToolInvocationResult] = []
        for call in plan.calls:
            result = self._execute_call(
                plan=plan,
                call=call,
                identity=identity,
                confirmation=confirmation_by_call.get(call.call_id),
                now=now,
            )
            results.append(result)
            if result.status is ToolInvocationStatus.DENIED and self._policy.stop_on_denial:
                break
            if result.status is ToolInvocationStatus.FAILED and self._policy.stop_on_failure:
                break
        return AgentExecutionResult(
            trace_id=plan.trace_id,
            plan_id=plan.plan_id,
            status=_execution_status(tuple(results), len(plan.calls)),
            plan_sha256=plan_sha256,
            calls=tuple(results),
            completed_at=now,
        )

    def _execute_call(
        self,
        *,
        plan: AgentToolPlan,
        call: PlannedToolCall,
        identity: IdentityContext,
        confirmation: ToolConfirmation | None,
        now: datetime,
    ) -> ToolInvocationResult:
        request_sha256 = _safe_tool_request_sha256(plan.trace_id, call)
        idempotency_key = _idempotency_key(
            trace_id=plan.trace_id,
            plan_id=plan.plan_id,
            call=call,
            identity=identity,
            request_sha256=request_sha256,
        )
        result_payload: Mapping[str, Any] | None = None
        result_sha256: str | None = None
        reason: str | None = None
        status = ToolInvocationStatus.FAILED
        try:
            arguments = _validated_arguments(
                call.arguments,
                maximum_bytes=self._policy.maximum_argument_bytes,
                maximum_depth=self._policy.maximum_argument_depth,
            )
            definition = self._authorize(
                plan=plan,
                call=call,
                identity=identity,
                confirmation=confirmation,
                request_sha256=request_sha256,
                idempotency_key=idempotency_key,
                now=now,
            )
            handler = self._handlers.resolve(definition.name)
            if handler is None:
                raise RuntimeError("authorized tool has no registered executor")
            invocation = AuthorizedToolInvocation(
                trace_id=plan.trace_id,
                plan_id=plan.plan_id,
                call_id=call.call_id,
                tool_name=definition.name,
                mode=definition.mode,
                arguments=arguments,
                user_id=identity.user_id,
                tenant_id=identity.tenant_id,
                session_id=identity.session_id,
                idempotency_key=idempotency_key,
                requested_at=now,
            )
            result_payload = handler.execute(invocation)
            result_sha256 = _validated_result_sha256(
                result_payload,
                maximum_bytes=self._policy.maximum_result_bytes,
            )
            status = ToolInvocationStatus.SUCCEEDED
        except PolicyDenied as error:
            status = ToolInvocationStatus.DENIED
            reason = str(error)
        except Exception as error:
            status = ToolInvocationStatus.FAILED
            reason = type(error).__name__
            result_payload = None
            result_sha256 = None
        result = ToolInvocationResult(
            call_id=call.call_id,
            tool_name=call.tool_name,
            mode=call.requested_mode,
            status=status,
            result=result_payload,
            request_sha256=request_sha256,
            result_sha256=result_sha256,
            idempotency_key=idempotency_key,
            reason=reason,
        )
        self._audit_sink.record(
            _audit_event(
                plan=plan,
                call=call,
                identity=identity,
                result=result,
                occurred_at=now,
            )
        )
        return result

    def _authorize(
        self,
        *,
        plan: AgentToolPlan,
        call: PlannedToolCall,
        identity: IdentityContext,
        confirmation: ToolConfirmation | None,
        request_sha256: str,
        idempotency_key: str,
        now: datetime,
    ) -> ToolDefinition:
        if call.requested_mode is ToolMode.PRIVILEGED_WRITE:
            raise PolicyDenied("privileged writes are not executable by the AI agent")
        confirmed = False
        if call.requested_mode is ToolMode.CONFIRMED_WRITE:
            if confirmation is None:
                raise PolicyDenied("server-issued user confirmation required")
            if (
                confirmation.expires_at - confirmation.issued_at
                > self._policy.maximum_confirmation_ttl
            ):
                raise PolicyDenied("tool confirmation exceeds runtime TTL")
            confirmed = self._confirmation_authority.verify(
                confirmation,
                call=call,
                trace_id=plan.trace_id,
                identity=identity,
                now=now,
            )
            if not confirmed:
                raise PolicyDenied("tool confirmation is invalid or expired")
        request = ToolRequest(
            trace_id=plan.trace_id,
            tool_name=call.tool_name,
            arguments=dict(call.arguments),
            requested_mode=call.requested_mode,
            justification=None,
            explicit_user_confirmation=confirmed,
        )
        definition = authorize_tool(identity, request)
        if call.requested_mode is ToolMode.CONFIRMED_WRITE:
            if confirmation is None:
                raise RuntimeError("confirmed write lost its confirmation binding")
            claimed = self._confirmation_uses.claim(
                confirmation=confirmation,
                request_sha256=request_sha256,
                idempotency_key=idempotency_key,
                used_at=now,
            )
            if not claimed:
                raise PolicyDenied(
                    "tool confirmation is already bound to a different invocation"
                )
        return definition


def tool_request_sha256(trace_id: UUID, call: PlannedToolCall) -> str:
    payload = {
        "arguments": _canonical_json_value(call.arguments),
        "call_id": call.call_id,
        "mode": call.requested_mode.value,
        "tool_name": call.tool_name,
        "trace_id": str(trace_id),
    }
    return _sha256_json(payload)


def agent_plan_sha256(plan: AgentToolPlan) -> str:
    payload = {
        "calls": [
            {
                "arguments": _canonical_json_value(call.arguments),
                "call_id": call.call_id,
                "mode": call.requested_mode.value,
                "tool_name": call.tool_name,
            }
            for call in plan.calls
        ],
        "generated_at": plan.generated_at.isoformat(),
        "plan_id": str(plan.plan_id),
        "trace_id": str(plan.trace_id),
    }
    return _sha256_json(payload)


def _safe_tool_request_sha256(trace_id: UUID, call: PlannedToolCall) -> str:
    try:
        return tool_request_sha256(trace_id, call)
    except (TypeError, ValueError):
        return _sha256_json(
            {
                "arguments": "INVALID_JSON_VALUE",
                "call_id": call.call_id,
                "mode": call.requested_mode.value,
                "tool_name": call.tool_name,
                "trace_id": str(trace_id),
            }
        )


def _safe_agent_plan_sha256(plan: AgentToolPlan) -> str:
    try:
        return agent_plan_sha256(plan)
    except (TypeError, ValueError):
        return _sha256_json(
            {
                "calls": [
                    {
                        "arguments": "INVALID_JSON_VALUE",
                        "call_id": call.call_id,
                        "mode": call.requested_mode.value,
                        "tool_name": call.tool_name,
                    }
                    for call in plan.calls
                ],
                "generated_at": plan.generated_at.isoformat(),
                "plan_id": str(plan.plan_id),
                "trace_id": str(plan.trace_id),
            }
        )


def _validated_arguments(
    arguments: Mapping[str, Any],
    *,
    maximum_bytes: int,
    maximum_depth: int,
) -> Mapping[str, Any]:
    value = _canonical_json_value(
        arguments,
        maximum_depth=maximum_depth,
        enforce_authority_fields=True,
    )
    if not isinstance(value, dict):
        raise TypeError("tool arguments must be an object")
    if len(_canonical_json(value).encode()) > maximum_bytes:
        raise ValueError("tool arguments exceed the byte budget")
    return value


def _canonical_json_value(
    value: Any,
    *,
    maximum_depth: int = 64,
    enforce_authority_fields: bool = False,
) -> Any:
    return _canonicalize(
        value,
        depth=0,
        maximum_depth=maximum_depth,
        enforce_authority_fields=enforce_authority_fields,
    )


def _canonicalize(
    value: Any,
    *,
    depth: int,
    maximum_depth: int,
    enforce_authority_fields: bool,
) -> Any:
    if depth > maximum_depth:
        raise ValueError("tool data exceeds the nesting budget")
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("non-finite numbers are not allowed in tool data")
        return value
    if isinstance(value, Mapping):
        result: dict[str, Any] = {}
        for raw_key, raw_value in value.items():
            if not isinstance(raw_key, str):
                raise TypeError("tool object keys must be strings")
            key = raw_key.strip()
            normalized = "".join(
                character for character in key.casefold() if character.isalnum()
            )
            if not key:
                raise ValueError("tool object keys must not be blank")
            if enforce_authority_fields and normalized in _RESERVED_ARGUMENT_KEYS:
                raise PolicyDenied("tool arguments contain a reserved authority field")
            if enforce_authority_fields and key.startswith(("$", "__")):
                raise PolicyDenied("tool arguments contain a prohibited control field")
            result[key] = _canonicalize(
                raw_value,
                depth=depth + 1,
                maximum_depth=maximum_depth,
                enforce_authority_fields=enforce_authority_fields,
            )
        return {key: result[key] for key in sorted(result)}
    if isinstance(value, (list, tuple)):
        return [
            _canonicalize(
                item,
                depth=depth + 1,
                maximum_depth=maximum_depth,
                enforce_authority_fields=enforce_authority_fields,
            )
            for item in value
        ]
    raise TypeError("tool data must contain only JSON-compatible values")


def _validated_result_sha256(
    result: Mapping[str, Any],
    *,
    maximum_bytes: int,
) -> str:
    if not isinstance(result, Mapping):
        raise TypeError("tool result must be an object")
    canonical = _canonical_json(_canonical_json_value(result))
    if len(canonical.encode()) > maximum_bytes:
        raise ValueError("tool result exceeds the byte budget")
    return hashlib.sha256(canonical.encode()).hexdigest()


def _canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _sha256_json(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value).encode()).hexdigest()


def _confirmation_payload(confirmation: ToolConfirmation) -> str:
    return _canonical_json(
        {
            "call_id": confirmation.call_id,
            "confirmation_id": str(confirmation.confirmation_id),
            "expires_at": confirmation.expires_at.isoformat(),
            "issued_at": confirmation.issued_at.isoformat(),
            "mfa_verified": confirmation.mfa_verified,
            "request_sha256": confirmation.request_sha256,
            "session_id": str(confirmation.session_id),
            "tenant_id": (
                None if confirmation.tenant_id is None else str(confirmation.tenant_id)
            ),
            "user_id": str(confirmation.user_id),
        }
    )


def _confirmation_timestamps_valid(
    confirmation: ToolConfirmation,
    now: datetime,
    maximum_ttl: timedelta,
) -> bool:
    if confirmation.issued_at.utcoffset() is None:
        return False
    if confirmation.expires_at.utcoffset() is None:
        return False
    if confirmation.expires_at <= confirmation.issued_at:
        return False
    if confirmation.issued_at > now or confirmation.expires_at <= now:
        return False
    return confirmation.expires_at - confirmation.issued_at <= maximum_ttl


def _confirmation_map(
    confirmations: tuple[ToolConfirmation, ...],
) -> dict[str, ToolConfirmation]:
    result: dict[str, ToolConfirmation] = {}
    for confirmation in confirmations:
        if confirmation.call_id in result:
            raise ValueError("only one confirmation is allowed per tool call")
        result[confirmation.call_id] = confirmation
    return result


def _idempotency_key(
    *,
    trace_id: UUID,
    plan_id: UUID,
    call: PlannedToolCall,
    identity: IdentityContext,
    request_sha256: str,
) -> str:
    return _sha256_json(
        {
            "call_id": call.call_id,
            "plan_id": str(plan_id),
            "request_sha256": request_sha256,
            "session_id": str(identity.session_id),
            "tenant_id": (
                None if identity.tenant_id is None else str(identity.tenant_id)
            ),
            "trace_id": str(trace_id),
            "user_id": str(identity.user_id),
        }
    )


def _audit_event(
    *,
    plan: AgentToolPlan,
    call: PlannedToolCall,
    identity: IdentityContext,
    result: ToolInvocationResult,
    occurred_at: datetime,
) -> AgentAuditEvent:
    event_id = _sha256_json(
        {
            "call_id": call.call_id,
            "idempotency_key": result.idempotency_key,
            "mode": call.requested_mode.value,
            "occurred_at": occurred_at.isoformat(),
            "plan_id": str(plan.plan_id),
            "reason": result.reason,
            "request_sha256": result.request_sha256,
            "result_sha256": result.result_sha256,
            "session_id": str(identity.session_id),
            "status": result.status.value,
            "tenant_id": (
                None if identity.tenant_id is None else str(identity.tenant_id)
            ),
            "tool_name": call.tool_name,
            "trace_id": str(plan.trace_id),
            "user_id": str(identity.user_id),
        }
    )
    return AgentAuditEvent(
        event_id=event_id,
        trace_id=plan.trace_id,
        plan_id=plan.plan_id,
        call_id=call.call_id,
        tool_name=call.tool_name,
        mode=call.requested_mode,
        status=result.status,
        user_id=identity.user_id,
        tenant_id=identity.tenant_id,
        session_id=identity.session_id,
        request_sha256=result.request_sha256,
        result_sha256=result.result_sha256,
        idempotency_key=result.idempotency_key,
        reason=result.reason,
        occurred_at=occurred_at,
    )


def _execution_status(
    results: tuple[ToolInvocationResult, ...],
    planned_count: int,
) -> AgentExecutionStatus:
    if any(result.status is ToolInvocationStatus.FAILED for result in results):
        return AgentExecutionStatus.FAILED
    if any(result.status is ToolInvocationStatus.DENIED for result in results):
        return AgentExecutionStatus.DENIED
    if len(results) < planned_count:
        return AgentExecutionStatus.PARTIAL
    return AgentExecutionStatus.COMPLETED


def _validate_aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")
