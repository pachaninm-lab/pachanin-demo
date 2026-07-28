from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID


class KnowledgeScope(StrEnum):
    PUBLIC = "PUBLIC"
    TENANT = "TENANT"


class FactAuthority(StrEnum):
    """Who is entitled to say this, which decides what re-confirming it means.

    A statement about how the platform behaves is settled by reading the
    platform; a statement about a regulation is not, however confident the
    wording. Recording the authority per fact keeps the second kind from
    inheriting the certainty of the first.
    """

    #: Derived from this repository's own behaviour.
    PLATFORM_CODE = "PLATFORM_CODE"
    #: Taken from a source registered in `official-sources.v1.json`.
    OFFICIAL_SOURCE = "OFFICIAL_SOURCE"
    #: Stated by an operator; true until an operator says otherwise.
    OPERATOR_STATEMENT = "OPERATOR_STATEMENT"


@dataclass(frozen=True, slots=True)
class KnowledgeRecord:
    """One retrievable fact, with the metadata that decides whether it may be used.

    `effective_at` is when the fact started being true, `observed_at` is when it
    was last confirmed against its authority, and `expires_at` is when it stops
    being usable without re-confirmation. All three are required: a fact that
    cannot say when it was last checked, or when it stops being true, is not
    evidence — it is a sentence someone wrote once.
    """

    record_id: str
    title: str
    body: str
    version: str
    source_uri: str
    effective_at: datetime
    trust_score: float
    authority: FactAuthority
    observed_at: datetime
    expires_at: datetime
    scope: KnowledgeScope = KnowledgeScope.PUBLIC
    tenant_id: UUID | None = None
    tags: frozenset[str] = frozenset()
    #: Required for OFFICIAL_SOURCE: which registered source this came from.
    source_id: str | None = None

    def __post_init__(self) -> None:
        for name in ("effective_at", "observed_at", "expires_at"):
            value: datetime = getattr(self, name)
            if value.tzinfo is None:
                raise ValueError(f"{name} must be timezone-aware")
        # A fact observed before it took effect, or expiring before it was
        # observed, describes an ordering nobody can act on.
        if self.observed_at < self.effective_at:
            raise ValueError("observed_at must not precede effective_at")
        if self.expires_at <= self.observed_at:
            raise ValueError("expires_at must follow observed_at")
        if self.authority is FactAuthority.OFFICIAL_SOURCE and not self.source_id:
            raise ValueError("an official-source fact must name its registered source")
        if self.authority is not FactAuthority.OFFICIAL_SOURCE and self.source_id:
            raise ValueError("only an official-source fact may name a registered source")

    def usable_at(self, moment: datetime) -> bool:
        """Whether this fact may be stated at ``moment``."""
        return self.effective_at <= moment < self.expires_at


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
        now: datetime | None = None,
    ) -> tuple[RetrievalResult, ...]:
        """Facts that match, are in force and have not expired.

        Expiry drops the record rather than flagging it. A retrieved fact is one
        the assistant is entitled to state, and an expired fact carries exactly
        the confidence of a fresh one once it reaches the answer — the only place
        the difference can still be acted on is here.
        """
        moment = now if now is not None else datetime.now(UTC)
        terms = frozenset(query.casefold().split())
        ranked: list[RetrievalResult] = []

        for record in self._records:
            if record.scope is KnowledgeScope.TENANT and record.tenant_id != tenant_id:
                continue
            if not record.usable_at(moment):
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
            authority=FactAuthority.PLATFORM_CODE,
            observed_at=datetime(2026, 7, 18, tzinfo=UTC),
            expires_at=datetime(2027, 1, 14, tzinfo=UTC),
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
            authority=FactAuthority.PLATFORM_CODE,
            observed_at=datetime(2026, 7, 18, tzinfo=UTC),
            expires_at=datetime(2027, 1, 14, tzinfo=UTC),
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
            authority=FactAuthority.PLATFORM_CODE,
            observed_at=datetime(2026, 7, 18, tzinfo=UTC),
            expires_at=datetime(2027, 1, 14, tzinfo=UTC),
            tags=frozenset({"этапы", "сделка", "логистика", "лаборатория"}),
        ),
    )
)
