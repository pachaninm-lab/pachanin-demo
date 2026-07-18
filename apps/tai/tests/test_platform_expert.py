from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import tai.expert as expert
import tai.knowledge as knowledge
from tai.main import app

client = TestClient(app)


def test_platform_expert_returns_grounded_answer() -> None:
    answer = expert.answer_platform_question(
        expert.PlatformQuestion(
            question="Как определяется роль пользователя?",
            tenant_id=None,
        )
    )

    assert answer.metadata["grounded"] is True
    assert answer.sources[0].source_id == "platform.roles.server-authoritative"
    assert answer.model_route == "deterministic-retrieval-v1"


def test_unknown_question_is_not_hallucinated() -> None:
    with pytest.raises(expert.GroundingError, match="no verified platform knowledge"):
        expert.answer_platform_question(
            expert.PlatformQuestion(question="квантовая телепортация", tenant_id=None)
        )


def test_tenant_record_isolated_from_other_tenant() -> None:
    tenant_a = uuid4()
    tenant_b = uuid4()
    store = knowledge.KnowledgeStore(
        (
            knowledge.KnowledgeRecord(
                record_id="tenant.secret",
                title="Внутренний регламент",
                body="Секретный порядок tenant A",
                version="1",
                source_uri="tenant://a/regulation",
                effective_at=datetime(2026, 7, 18, tzinfo=UTC),
                trust_score=1.0,
                scope=knowledge.KnowledgeScope.TENANT,
                tenant_id=tenant_a,
                tags=frozenset({"регламент"}),
            ),
        )
    )

    with pytest.raises(expert.GroundingError):
        expert.answer_platform_question(
            expert.PlatformQuestion(question="регламент", tenant_id=tenant_b),
            store=store,
        )

    answer = expert.answer_platform_question(
        expert.PlatformQuestion(question="регламент", tenant_id=tenant_a),
        store=store,
    )
    assert answer.sources[0].source_id == "tenant.secret"


def test_health_reports_runtime_and_knowledge_state() -> None:
    live = client.get("/health/live")
    ready = client.get("/health/ready")

    assert live.status_code == 200
    assert live.json() == {"status": "ok"}
    assert ready.status_code == 503
    assert ready.json()["status"] == "not_ready"
    assert ready.json()["orchestration"] == "unconfigured"


def test_default_entrypoint_fails_closed_without_runtime_or_identity_authority() -> None:
    response = client.post(
        "/v1/platform/answer",
        json={
            "request_id": "request-unconfigured",
            "question": "Как определяется роль пользователя?",
            "locale": "ru",
            "deadline_ms": 60_000,
        },
        headers={"Idempotency-Key": "idempotency-unconfigured"},
    )

    assert response.status_code == 503
    assert response.json()["code"] == "RUNTIME_NOT_CONFIGURED"
