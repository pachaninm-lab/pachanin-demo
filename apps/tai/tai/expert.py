from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID, uuid4

from .contracts import AIResponse, AnswerType, RiskLevel, SourceRef
from .knowledge import DEFAULT_PLATFORM_KNOWLEDGE, KnowledgeStore


@dataclass(frozen=True, slots=True)
class PlatformQuestion:
    question: str
    tenant_id: UUID | None


class GroundingError(LookupError):
    pass


def answer_platform_question(
    request: PlatformQuestion,
    *,
    store: KnowledgeStore = DEFAULT_PLATFORM_KNOWLEDGE,
) -> AIResponse:
    results = store.retrieve(request.question, tenant_id=request.tenant_id)
    if not results:
        raise GroundingError("no verified platform knowledge found")

    best = results[0]
    record = best.record
    confidence = min(1.0, (best.score * 0.7) + (record.trust_score * 0.3))

    return AIResponse(
        trace_id=uuid4(),
        answer_type=AnswerType.FACT,
        direct_answer=record.body,
        grounds=[record.title],
        sources=[
            SourceRef(
                source_id=record.record_id,
                title=record.title,
                uri=record.source_uri,
                version=record.version,
                effective_at=record.effective_at,
                retrieved_at=record.effective_at,
                trust_score=record.trust_score,
            )
        ],
        confidence=confidence,
        risk_level=RiskLevel.LOW,
        limitations=["Ответ ограничен подтверждёнными записями Platform Knowledge."],
        model_route="deterministic-retrieval-v1",
        knowledge_version=record.version,
        policy_version="tai.policy.v1",
        metadata={"grounded": True, "retrieval_score": best.score},
    )
