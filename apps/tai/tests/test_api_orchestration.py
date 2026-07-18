from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

from fastapi.testclient import TestClient

from tai.agent_runtime import (
    AgentToolPlan,
    AgentToolRuntime,
    AuthorizedToolInvocation,
    HMACToolConfirmationAuthority,
    InMemoryConfirmationUseRepository,
    PlannedToolCall,
    ToolExecutorRegistry,
)
from tai.context_assembly import ContextAssembler
from tai.contracts import ToolMode
from tai.identity_assertion import (
    HMACPlatformIdentityAuthority,
    PlatformIdentityAssertion,
    canonical_api_request_sha256,
)
from tai.knowledge_chunking import KnowledgeChunk
from tai.main import create_app
from tai.model_runtime import (
    ModelAttemptStatus,
    ModelGenerationResult,
    ModelInvocationAttempt,
)
from tai.orchestration import (
    InMemoryOrchestrationIdempotencyRepository,
    InMemoryPreparedActionRepository,
    NoToolPlanner,
    OrchestrationRequest,
    TAIOrchestrationRuntime,
)
from tai.rag_pipeline import GroundedAnswerResponse, GroundedRAGPipeline
from tai.retrieval_index import (
    InMemoryRetrievalIndexRepository,
    LexicalRetriever,
    RetrievalDocument,
)
from tai.retrieval_service import RetrievalService

NOW = datetime(2026, 7, 18, 17, 0, tzinfo=UTC)
USER_ID = UUID("10000000-0000-0000-0000-000000000001")
TENANT_ID = UUID("20000000-0000-0000-0000-000000000002")
SESSION_ID = UUID("30000000-0000-0000-0000-000000000003")
IDENTITY_SECRET = b"api-platform-identity-secret-32-bytes"
CONFIRMATION_SECRET = b"api-tool-confirmation-secret-32-bytes"
REQUEST_TOKEN_A = "a" * 16
REQUEST_TOKEN_B = "b" * 16


class _Model:
    def generate(
        self,
        prompt: str,
        *,
        request_id: str,
        now: datetime,
        maximum_output_chars: int,
    ) -> ModelGenerationResult:
        assert "official-quality" in prompt
        assert request_id == "api-request-1"
        assert now == NOW
        assert maximum_output_chars > 0
        return ModelGenerationResult(
            text="Качество подтверждают лабораторией [S1].",
            model_id="local-api-model",
            revision="r1",
            route_id="e" * 64,
            attempts=(
                ModelInvocationAttempt(
                    model_id="local-api-model",
                    revision="r1",
                    status=ModelAttemptStatus.SUCCEEDED,
                    reason=None,
                ),
            ),
        )


class _Planner:
    def __init__(self, call: PlannedToolCall) -> None:
        self._call = call

    def plan(
        self,
        *,
        request: OrchestrationRequest,
        grounded: GroundedAnswerResponse,
        trace_id: UUID,
        now: datetime,
    ) -> AgentToolPlan:
        assert grounded.answer
        return AgentToolPlan(
            trace_id=trace_id,
            plan_id=uuid5(NAMESPACE_URL, f"api-plan:{request.request_id}"),
            calls=(self._call,),
            generated_at=now,
        )


class _Handler:
    def __init__(self) -> None:
        self.calls: list[AuthorizedToolInvocation] = []

    def execute(self, invocation: AuthorizedToolInvocation) -> dict[str, Any]:
        self.calls.append(invocation)
        return {"acknowledged": True}


def _runtime(
    *,
    planner: _Planner | None = None,
    handlers: dict[str, _Handler] | None = None,
) -> TAIOrchestrationRuntime:
    index = InMemoryRetrievalIndexRepository()
    generation = index.begin_generation()
    index.add(
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
                tenant_id=None,
                trust_score=1.0,
                valid_until=None,
            ),
        ),
    )
    index.activate(generation)
    confirmation = HMACToolConfirmationAuthority(CONFIRMATION_SECRET)
    return TAIOrchestrationRuntime(
        rag_pipeline=GroundedRAGPipeline(
            retrieval_service=RetrievalService(LexicalRetriever(index)),
            context_assembler=ContextAssembler(),
            model_gateway=_Model(),
        ),
        tool_planner=planner or NoToolPlanner(),
        tool_runtime=AgentToolRuntime(
            handlers=ToolExecutorRegistry(handlers or {}),
            confirmation_authority=confirmation,
            confirmation_uses=InMemoryConfirmationUseRepository(),
        ),
        confirmation_authority=confirmation,
        idempotency=InMemoryOrchestrationIdempotencyRepository(),
        prepared_actions=InMemoryPreparedActionRepository(),
        clock=lambda: NOW,
    )


def _payload(question: str = "Как проверяют качество пшеницы?") -> dict[str, object]:
    return {
        "request_id": "api-request-1",
        "question": question,
        "locale": "ru",
        "deadline_ms": 60_000,
    }


def _headers(
    authority: HMACPlatformIdentityAuthority,
    payload: dict[str, object],
) -> dict[str, str]:
    signed = authority.issue(
        PlatformIdentityAssertion(
            request_id="api-request-1",
            request_sha256=canonical_api_request_sha256(
                method="POST",
                path="/v1/platform/answer",
                payload=payload,
                idempotency_key=REQUEST_TOKEN_A,
            ),
            user_id=USER_ID,
            tenant_id=TENANT_ID,
            roles=("buyer",),
            session_id=SESSION_ID,
            mfa_verified=True,
            issued_at=NOW,
            expires_at=NOW + timedelta(seconds=30),
        )
    )
    return {
        "Idempotency-Key": REQUEST_TOKEN_A,
        "X-TAI-Identity-Assertion": signed.payload,
        "X-TAI-Identity-Signature": signed.signature_sha256,
    }


def _confirmation_headers(
    authority: HMACPlatformIdentityAuthority,
    payload: dict[str, object],
) -> dict[str, str]:
    signed = authority.issue(
        PlatformIdentityAssertion(
            request_id="api-confirm-1",
            request_sha256=canonical_api_request_sha256(
                method="POST",
                path="/v1/platform/actions/confirm",
                payload=payload,
            ),
            user_id=USER_ID,
            tenant_id=TENANT_ID,
            roles=("buyer",),
            session_id=SESSION_ID,
            mfa_verified=True,
            issued_at=NOW,
            expires_at=NOW + timedelta(seconds=30),
        )
    )
    return {
        "X-TAI-Identity-Assertion": signed.payload,
        "X-TAI-Identity-Signature": signed.signature_sha256,
    }


def test_api_uses_signed_identity_and_unified_orchestration_runtime() -> None:
    authority = HMACPlatformIdentityAuthority(IDENTITY_SECRET)
    client = TestClient(
        create_app(
            runtime=_runtime(),
            identity_authority=authority,
            now_provider=lambda: NOW,
        )
    )
    payload = _payload()

    response = client.post(
        "/v1/platform/answer",
        json=payload,
        headers=_headers(authority, payload),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "tai.orchestration.response.v1"
    assert body["status"] == "ANSWERED"
    assert body["model_id"] == "local-api-model"
    assert body["citations"][0]["source_id"] == "official-quality"
    assert body["replayed"] is False


def test_api_rejects_missing_or_payload_rebound_identity() -> None:
    authority = HMACPlatformIdentityAuthority(IDENTITY_SECRET)
    client = TestClient(
        create_app(
            runtime=_runtime(),
            identity_authority=authority,
            now_provider=lambda: NOW,
        )
    )
    payload = _payload()

    missing = client.post(
        "/v1/platform/answer",
        json=payload,
        headers={"Idempotency-Key": REQUEST_TOKEN_A},
    )
    rebound = client.post(
        "/v1/platform/answer",
        json=_payload("Изменённый вопрос о качестве"),
        headers=_headers(authority, payload),
    )
    idempotency_rebound_headers = _headers(authority, payload)
    idempotency_rebound_headers["Idempotency-Key"] = REQUEST_TOKEN_B
    idempotency_rebound = client.post(
        "/v1/platform/answer",
        json=payload,
        headers=idempotency_rebound_headers,
    )

    assert missing.status_code == 401
    assert missing.json()["code"] == "IDENTITY_ASSERTION_REQUIRED"
    assert rebound.status_code == 401
    assert rebound.json()["code"] == "IDENTITY_ASSERTION_INVALID"
    assert idempotency_rebound.status_code == 401
    assert idempotency_rebound.json()["code"] == "IDENTITY_ASSERTION_INVALID"


def test_api_confirmation_executes_prepared_write_once() -> None:
    authority = HMACPlatformIdentityAuthority(IDENTITY_SECRET)
    call = PlannedToolCall(
        call_id="api-ack-risk",
        tool_name="acknowledgeRisk",
        arguments={"riskId": "risk-api-1"},
        requested_mode=ToolMode.CONFIRMED_WRITE,
    )
    handler = _Handler()
    client = TestClient(
        create_app(
            runtime=_runtime(
                planner=_Planner(call),
                handlers={"acknowledgeRisk": handler},
            ),
            identity_authority=authority,
            now_provider=lambda: NOW,
        )
    )
    answer_payload = _payload()
    prepared = client.post(
        "/v1/platform/answer",
        json=answer_payload,
        headers=_headers(authority, answer_payload),
    ).json()["prepared_actions"][0]
    confirmation_payload: dict[str, object] = {
        "request_id": "api-confirm-1",
        "explicit_user_confirmation": True,
        "confirmation": prepared["confirmation"],
    }
    headers = _confirmation_headers(authority, confirmation_payload)

    first = client.post(
        "/v1/platform/actions/confirm",
        json=confirmation_payload,
        headers=headers,
    )
    replay = client.post(
        "/v1/platform/actions/confirm",
        json=confirmation_payload,
        headers=headers,
    )

    assert first.status_code == 200
    assert first.json()["status"] == "COMPLETED"
    assert replay.json() == first.json()
    assert len(handler.calls) == 1


def test_api_validation_errors_use_canonical_error_contract() -> None:
    response = TestClient(create_app()).post(
        "/v1/platform/answer",
        json={"request_id": "bad", "question": ""},
    )

    assert response.status_code == 422
    assert response.json()["schema_version"] == "tai.error.v1"
    assert response.json()["code"] == "REQUEST_VALIDATION_FAILED"

    invalid_confirmation = TestClient(create_app()).post(
        "/v1/platform/actions/confirm",
        json={
            "request_id": "api-confirm-invalid",
            "explicit_user_confirmation": True,
            "confirmation": {
                "confirmation_id": "10000000-0000-0000-0000-000000000001",
                "call_id": "invalid call identifier",
                "request_sha256": "not-a-digest",
                "user_id": str(USER_ID),
                "tenant_id": str(TENANT_ID),
                "session_id": str(SESSION_ID),
                "issued_at": NOW.isoformat(),
                "expires_at": (NOW + timedelta(seconds=30)).isoformat(),
                "mfa_verified": True,
                "signature_sha256": "not-a-signature",
            },
        },
    )
    assert invalid_confirmation.status_code == 422
    assert invalid_confirmation.json()["code"] == "REQUEST_VALIDATION_FAILED"
