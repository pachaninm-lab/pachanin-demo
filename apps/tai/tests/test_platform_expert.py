from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from tai.expert import GroundingError, PlatformQuestion, answer_platform_question
from tai.knowledge import KnowledgeRecord, KnowledgeScope, KnowledgeStore
from tai.main import app


client = TestClient(app)


def test_platform_expert_returns_grounded_answer() -> None:
    response = client.post(
        "/v1/platform/answer",
        json={"question": "Как определяется роль пользователя?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["grounded"] is True
    assert body["sources"][0]["source_id"] == "platform.roles.server-authoritative"
    assert body["model_route"] == "deterministic-retrieval-v1"


def test_unknown_question_is_not_hallucinated() -> None:
    response = client.post(
        "/v1/platform/answer",
        json={"question": "квантовая телепортация"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "no verified platform knowledge found"


def test_tenant_record_isolated_from_other_tenant() -> None:
    tenant_a = uuid4()
    tenant_b = uuid4()
    store = KnowledgeStore(
        (
            KnowledgeRecord(
                record_id="tenant.secret",
                title="Внутренний регламент",
                body="Секретный порядок tenant A",
                version="1",
                source_uri="tenant://a/regulation",
                effective_at=datetime(2026, 7, 18, tzinfo=UTC),
                trust_score=1.0,
                scope=KnowledgeScope.TENANT,
                tenant_id=tenant_a,
                tags=frozenset({"регламент"}),
            ),
        )
    )

    with pytest.raises(GroundingError):
        answer_platform_question(
            PlatformQuestion(question="регламент", tenant_id=tenant_b),
            store=store,
        )

    answer = answer_platform_question(
        PlatformQuestion(question="регламент", tenant_id=tenant_a),
        store=store,
    )
    assert answer.sources[0].source_id == "tenant.secret"


def test_health_reports_runtime_and_knowledge_state() -> None:
    live = client.get("/health/live")
    ready = client.get("/health/ready")

    assert live.status_code == 200
    assert live.json() == {"status": "ok"}
    assert ready.status_code == 200
    assert ready.json()["knowledge"] == "platform-knowledge.2026-07-18.1"
