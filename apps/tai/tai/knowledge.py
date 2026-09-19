from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID


class KnowledgeScope(StrEnum):
    PUBLIC = "PUBLIC"
    TENANT = "TENANT"


@dataclass(frozen=True, slots=True)
class KnowledgeRecord:
    record_id: str
    title: str
    body: str
    version: str
    source_uri: str
    effective_at: datetime
    trust_score: float
    scope: KnowledgeScope = KnowledgeScope.PUBLIC
    tenant_id: UUID | None = None
    tags: frozenset[str] = frozenset()


@dataclass(frozen=True, slots=True)
class RetrievalResult:
    record: KnowledgeRecord
    score: float


class KnowledgeStore:
    def __init__(self, records: tuple[KnowledgeRecord, ...]) -> None:
        self._records = records

    def retrieve(
        self,
        query: str,
        *,
        tenant_id: UUID | None,
        limit: int = 5,
    ) -> tuple[RetrievalResult, ...]:
        terms = frozenset(query.casefold().split())
        ranked: list[RetrievalResult] = []

        for record in self._records:
            if record.scope is KnowledgeScope.TENANT and record.tenant_id != tenant_id:
                continue

            haystack = " ".join((record.title, record.body, " ".join(record.tags))).casefold()
            matched = sum(1 for term in terms if term in haystack)
            if matched == 0:
                continue

            score = matched / max(len(terms), 1)
            ranked.append(RetrievalResult(record=record, score=score))

        ranked.sort(
            key=lambda item: (
                item.score,
                item.record.trust_score,
                item.record.effective_at,
            ),
            reverse=True,
        )
        return tuple(ranked[:limit])


DEFAULT_PLATFORM_KNOWLEDGE = KnowledgeStore(
    (
        KnowledgeRecord(
            record_id="platform.deal.authority",
            title="Сделка является главным объектом платформы",
            body=(
                "Состояние Сделки изменяется только серверными командами платформы. "
                "AI не владеет authoritative state и не может подтверждать деньги, "
                "выбирать победителя аукциона или подписывать документы."
            ),
            version="platform-knowledge.2026-07-18.1",
            source_uri="repo://docs/platform-v7/deal-authority",
            effective_at=datetime(2026, 7, 18, tzinfo=UTC),
            trust_score=1.0,
            tags=frozenset({"сделка", "authority", "деньги", "аукцион"}),
        ),
        KnowledgeRecord(
            record_id="platform.roles.server-authoritative",
            title="Роль и tenant определяются сервером",
            body=(
                "Роль пользователя и tenant берутся из подтверждённой membership-сессии. "
                "Клиент и AI не могут самостоятельно выбирать или повышать роль."
            ),
            version="platform-knowledge.2026-07-18.1",
            source_uri="repo://apps/api/auth/memberships",
            effective_at=datetime(2026, 7, 18, tzinfo=UTC),
            trust_score=1.0,
            tags=frozenset({"роль", "tenant", "доступ", "membership"}),
        ),
        KnowledgeRecord(
            record_id="platform.flow.canonical",
            title="Канонический путь исполнения сделки",
            body=(
                "Условия и допуск переходят в аукцион, затем в Сделку, логистику, "
                "приёмку, лабораторию, документы, деньги, спор при необходимости, "
                "доказательства и закрытие."
            ),
            version="platform-knowledge.2026-07-18.1",
            source_uri="repo://docs/platform-v7/canonical-deal-flow",
            effective_at=datetime(2026, 7, 18, tzinfo=UTC),
            trust_score=1.0,
            tags=frozenset({"этапы", "сделка", "логистика", "лаборатория"}),
        ),
    )
)
