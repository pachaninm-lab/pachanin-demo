from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Protocol
from uuid import uuid4

from fastapi import FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from tai.agent_runtime import ToolConfirmation, ToolInvocationResult
from tai.api_contracts import (
    APIErrorContract,
    AssistantAnswerRequest,
    AssistantAnswerResponse,
    AssistantConfirmationRequest,
    AssistantConfirmationResponse,
    CitationContract,
    PreparedActionContract,
    ToolCallResultContract,
    ToolConfirmationContract,
    ToolExecutionContract,
)
from tai.contracts import IdentityContext
from tai.identity_assertion import (
    HMACPlatformIdentityAuthority,
    IdentityAssertionError,
    SignedIdentityAssertion,
    canonical_api_request_sha256,
)
from tai.orchestration import (
    OrchestrationError,
    OrchestrationErrorCode,
    OrchestrationRequest,
    OrchestrationResponse,
    TAIOrchestrationRuntime,
)

_NowProvider = Callable[[], datetime]


@dataclass(frozen=True, slots=True)
class ReadinessStatus:
    ready: bool
    components: Mapping[str, str]
    reasons: tuple[str, ...] = ()


class ReadinessProbe(Protocol):
    def check(self) -> ReadinessStatus: ...


def create_app(
    *,
    runtime: TAIOrchestrationRuntime | None = None,
    identity_authority: HMACPlatformIdentityAuthority | None = None,
    now_provider: _NowProvider | None = None,
    readiness_probe: ReadinessProbe | None = None,
    configuration_error: str | None = None,
) -> FastAPI:
    app = FastAPI(title="Transparent Agro Intelligence", version="0.3.0")
    now = now_provider or (lambda: datetime.now(UTC))

    def readiness_state() -> ReadinessStatus:
        if configuration_error is not None:
            return ReadinessStatus(
                False,
                {
                    "billing": "disabled-by-architecture",
                    "orchestration": "unconfigured",
                },
                (configuration_error,),
            )
        configured = runtime is not None and identity_authority is not None
        if not configured:
            return ReadinessStatus(
                False,
                {
                    "billing": "disabled-by-architecture",
                    "orchestration": "unconfigured",
                },
                ("RUNTIME_NOT_CONFIGURED",),
            )
        if readiness_probe is None:
            return ReadinessStatus(
                True,
                {
                    "billing": "disabled-by-architecture",
                    "orchestration": "configured",
                },
            )
        try:
            probed = readiness_probe.check()
        except Exception:
            return ReadinessStatus(
                False,
                {
                    "billing": "disabled-by-architecture",
                    "orchestration": "configured",
                    "dependencies": "probe_failed",
                },
                ("READINESS_PROBE_FAILED",),
            )
        components = dict(probed.components)
        components.setdefault("billing", "disabled-by-architecture")
        components.setdefault("orchestration", "configured")
        return ReadinessStatus(probed.ready, components, probed.reasons)

    @app.exception_handler(RequestValidationError)
    async def request_validation_error(
        request: Request,
        error: RequestValidationError,
    ) -> JSONResponse:
        del request, error
        return _error(
            request_id=None,
            code="REQUEST_VALIDATION_FAILED",
            message="request does not satisfy the TAI API contract",
            retryable=False,
            status_code=422,
        )

    @app.get("/health/live")
    def liveness() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready")
    def readiness() -> JSONResponse:
        state = readiness_state()
        components = dict(state.components)
        return JSONResponse(
            status_code=200 if state.ready else 503,
            content={
                "status": "ready" if state.ready else "not_ready",
                "policy": "deny-by-default",
                "billing": components.pop(
                    "billing",
                    "disabled-by-architecture",
                ),
                "orchestration": components.pop(
                    "orchestration",
                    "configured" if runtime is not None else "unconfigured",
                ),
                "components": components,
                "reasons": list(state.reasons),
            },
        )

    @app.post(
        "/v1/platform/answer",
        response_model=AssistantAnswerResponse,
        responses={401: {"model": APIErrorContract}, 503: {"model": APIErrorContract}},
    )
    def platform_answer(
        payload: AssistantAnswerRequest,
        idempotency_key: Annotated[
            str | None,
            Header(
                alias="Idempotency-Key",
                min_length=16,
                max_length=160,
                pattern=r"^[A-Za-z0-9._:-]+$",
            ),
        ] = None,
        identity_payload: Annotated[
            str | None,
            Header(alias="X-TAI-Identity-Assertion"),
        ] = None,
        identity_signature: Annotated[
            str | None,
            Header(alias="X-TAI-Identity-Signature"),
        ] = None,
    ) -> AssistantAnswerResponse | JSONResponse:
        if runtime is None or identity_authority is None:
            return _error(
                request_id=payload.request_id,
                code="RUNTIME_NOT_CONFIGURED",
                message="TAI orchestration runtime is not configured",
                retryable=True,
                status_code=503,
            )
        if idempotency_key is None:
            return _error(
                request_id=payload.request_id,
                code="IDEMPOTENCY_KEY_REQUIRED",
                message="Idempotency-Key header is required",
                retryable=False,
                status_code=400,
            )
        identity = _verify_identity(
            authority=identity_authority,
            identity_payload=identity_payload,
            identity_signature=identity_signature,
            request_id=payload.request_id,
            request_sha256=canonical_api_request_sha256(
                method="POST",
                path="/v1/platform/answer",
                payload=payload.model_dump(mode="json"),
                idempotency_key=idempotency_key,
            ),
            now=now(),
        )
        if isinstance(identity, JSONResponse):
            return identity
        requested_at = now()
        try:
            response = runtime.answer(
                OrchestrationRequest(
                    request_id=payload.request_id,
                    idempotency_key=idempotency_key,
                    question=payload.question,
                    identity=identity,
                    requested_at=requested_at,
                    deadline_at=requested_at + timedelta(milliseconds=payload.deadline_ms),
                    locale=payload.locale,
                ),
                now=requested_at,
            )
        except OrchestrationError as error:
            return _orchestration_error(payload.request_id, error)
        except ValueError as error:
            return _error(
                request_id=payload.request_id,
                code="INVALID_REQUEST",
                message=str(error),
                retryable=False,
                status_code=400,
            )
        except Exception:
            return _error(
                request_id=payload.request_id,
                code="INTERNAL_ERROR",
                message="TAI orchestration failed without a safe response",
                retryable=True,
                status_code=500,
            )
        return _answer_contract(response)

    @app.post(
        "/v1/platform/actions/confirm",
        response_model=AssistantConfirmationResponse,
        responses={401: {"model": APIErrorContract}, 503: {"model": APIErrorContract}},
    )
    def confirm_action(
        payload: AssistantConfirmationRequest,
        identity_payload: Annotated[
            str | None,
            Header(alias="X-TAI-Identity-Assertion"),
        ] = None,
        identity_signature: Annotated[
            str | None,
            Header(alias="X-TAI-Identity-Signature"),
        ] = None,
    ) -> AssistantConfirmationResponse | JSONResponse:
        if runtime is None or identity_authority is None:
            return _error(
                request_id=payload.request_id,
                code="RUNTIME_NOT_CONFIGURED",
                message="TAI orchestration runtime is not configured",
                retryable=True,
                status_code=503,
            )
        identity = _verify_identity(
            authority=identity_authority,
            identity_payload=identity_payload,
            identity_signature=identity_signature,
            request_id=payload.request_id,
            request_sha256=canonical_api_request_sha256(
                method="POST",
                path="/v1/platform/actions/confirm",
                payload=payload.model_dump(mode="json"),
            ),
            now=now(),
        )
        if isinstance(identity, JSONResponse):
            return identity
        try:
            result = runtime.confirm_action(
                _confirmation(payload.confirmation),
                identity=identity,
                now=now(),
            )
        except OrchestrationError as error:
            return _orchestration_error(payload.request_id, error)
        except ValueError as error:
            return _error(
                request_id=payload.request_id,
                code="INVALID_REQUEST",
                message=str(error),
                retryable=False,
                status_code=400,
            )
        except Exception:
            return _error(
                request_id=payload.request_id,
                code="INTERNAL_ERROR",
                message="TAI action confirmation failed without a safe response",
                retryable=True,
                status_code=500,
            )
        return AssistantConfirmationResponse(
            request_id=payload.request_id,
            trace_id=result.trace_id,
            plan_id=result.plan_id,
            status=result.status.value,
            calls=[_tool_result(call) for call in result.calls],
            completed_at=result.completed_at,
        )

    return app


def _verify_identity(
    *,
    authority: HMACPlatformIdentityAuthority,
    identity_payload: str | None,
    identity_signature: str | None,
    request_id: str,
    request_sha256: str,
    now: datetime,
) -> IdentityContext | JSONResponse:
    if identity_payload is None or identity_signature is None:
        return _error(
            request_id=request_id,
            code="IDENTITY_ASSERTION_REQUIRED",
            message="server-issued identity assertion is required",
            retryable=False,
            status_code=401,
        )
    try:
        signed = SignedIdentityAssertion(
            payload=identity_payload,
            signature_sha256=identity_signature,
        )
        return authority.verify(
            signed,
            expected_request_id=request_id,
            expected_request_sha256=request_sha256,
            now=now,
        )
    except (IdentityAssertionError, ValueError):
        return _error(
            request_id=request_id,
            code="IDENTITY_ASSERTION_INVALID",
            message="server-issued identity assertion is invalid",
            retryable=False,
            status_code=401,
        )


def _answer_contract(response: OrchestrationResponse) -> AssistantAnswerResponse:
    return AssistantAnswerResponse(
        request_id=response.request_id,
        trace_id=response.trace_id,
        status=response.status,
        answer=response.answer,
        citations=[
            CitationContract(
                citation_id=item.citation_id,
                source_id=item.source_id,
                chunk_id=item.chunk_id,
                generation=item.generation,
                trust_score=item.trust_score,
            )
            for item in response.citations
        ],
        knowledge_generation=response.knowledge_generation,
        model_id=response.model_id,
        model_revision=response.model_revision,
        model_route_id=response.model_route_id,
        tool_execution=(
            None
            if response.tool_execution is None
            else ToolExecutionContract(
                plan_id=response.tool_execution.plan_id,
                status=response.tool_execution.status.value,
                calls=[_tool_result(call) for call in response.tool_execution.calls],
            )
        ),
        prepared_actions=[
            PreparedActionContract(
                trace_id=item.trace_id,
                plan_id=item.plan_id,
                call_id=item.call.call_id,
                tool_name=item.call.tool_name,
                mode=item.call.requested_mode,
                arguments=dict(item.call.arguments),
                confirmation=_confirmation_contract(item.confirmation),
            )
            for item in response.prepared_actions
        ],
        reason=response.reason,
        completed_at=response.completed_at,
        replayed=response.replayed,
    )


def _confirmation_contract(value: ToolConfirmation) -> ToolConfirmationContract:
    return ToolConfirmationContract(
        confirmation_id=value.confirmation_id,
        call_id=value.call_id,
        request_sha256=value.request_sha256,
        user_id=value.user_id,
        tenant_id=value.tenant_id,
        session_id=value.session_id,
        issued_at=value.issued_at,
        expires_at=value.expires_at,
        mfa_verified=value.mfa_verified,
        signature_sha256=value.signature_sha256,
    )


def _confirmation(value: ToolConfirmationContract) -> ToolConfirmation:
    return ToolConfirmation(
        confirmation_id=value.confirmation_id,
        call_id=value.call_id,
        request_sha256=value.request_sha256,
        user_id=value.user_id,
        tenant_id=value.tenant_id,
        session_id=value.session_id,
        issued_at=value.issued_at,
        expires_at=value.expires_at,
        mfa_verified=value.mfa_verified,
        signature_sha256=value.signature_sha256,
    )


def _tool_result(value: ToolInvocationResult) -> ToolCallResultContract:
    return ToolCallResultContract(
        call_id=value.call_id,
        tool_name=value.tool_name,
        mode=value.mode,
        status=value.status.value,
        result=None if value.result is None else dict(value.result),
        result_sha256=value.result_sha256,
        reason=value.reason,
    )


def _orchestration_error(request_id: str, error: OrchestrationError) -> JSONResponse:
    status_code = {
        OrchestrationErrorCode.IDEMPOTENCY_CONFLICT: 409,
        OrchestrationErrorCode.REQUEST_IN_PROGRESS: 409,
        OrchestrationErrorCode.OVERLOADED: 429,
        OrchestrationErrorCode.RATE_LIMITED: 429,
        OrchestrationErrorCode.REQUEST_TIMED_OUT: 408,
        OrchestrationErrorCode.REQUEST_CANCELLED: 408,
        OrchestrationErrorCode.TOOL_PLAN_REJECTED: 422,
    }[error.code]
    return _error(
        request_id=request_id,
        code=error.code.value,
        message=str(error),
        retryable=error.retryable,
        retry_after_seconds=error.retry_after_seconds,
        status_code=status_code,
    )


def _error(
    *,
    request_id: str | None,
    code: str,
    message: str,
    retryable: bool,
    status_code: int,
    retry_after_seconds: int | None = None,
) -> JSONResponse:
    contract = APIErrorContract(
        error_id=uuid4(),
        request_id=request_id,
        code=code,
        message=message,
        retryable=retryable,
        retry_after_seconds=retry_after_seconds,
    )
    headers = (
        None
        if retry_after_seconds is None
        else {"Retry-After": str(retry_after_seconds)}
    )
    return JSONResponse(
        status_code=status_code,
        content=contract.model_dump(mode="json"),
        headers=headers,
    )


app = create_app()
