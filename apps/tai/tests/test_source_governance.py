from dataclasses import replace
from datetime import UTC, datetime, timedelta

from tai.source_governance import (
    AdmissionStatus,
    DEFAULT_AGRO_SOURCE_REGISTRY,
    KnowledgeDomain,
    SourceDocument,
)

NOW = datetime(2026, 7, 18, 12, 0, tzinfo=UTC)


def official_document() -> SourceDocument:
    return SourceDocument.build(
        source_id="official.minselhoz",
        source_uri="https://mcx.gov.ru/analytics/grain-market",
        title="Обзор зернового рынка",
        body="Подтверждённые сведения о состоянии зернового рынка.",
        published_at=NOW - timedelta(days=1),
        effective_at=NOW - timedelta(days=1),
        fetched_at=NOW,
        trust_score=0.99,
        domain=KnowledgeDomain.MARKET,
    )


def test_registered_official_source_is_accepted() -> None:
    decision = DEFAULT_AGRO_SOURCE_REGISTRY.admit(official_document(), now=NOW)

    assert decision.status is AdmissionStatus.ACCEPTED
    assert decision.accepted is True
    assert decision.reasons == ()


def test_unknown_source_is_rejected() -> None:
    document = replace(official_document(), source_id="unknown.publisher")

    decision = DEFAULT_AGRO_SOURCE_REGISTRY.admit(document, now=NOW)

    assert decision.status is AdmissionStatus.REJECTED
    assert decision.reasons == ("source_not_registered",)


def test_wrong_host_is_rejected() -> None:
    document = replace(official_document(), source_uri="https://example.com/fake-market")

    decision = DEFAULT_AGRO_SOURCE_REGISTRY.admit(document, now=NOW)

    assert "source_host_not_allowed" in decision.reasons


def test_stale_document_is_rejected() -> None:
    document = replace(official_document(), fetched_at=NOW - timedelta(days=32))

    decision = DEFAULT_AGRO_SOURCE_REGISTRY.admit(document, now=NOW)

    assert "document_stale" in decision.reasons


def test_missing_effective_date_is_rejected() -> None:
    document = replace(official_document(), effective_at=None)

    decision = DEFAULT_AGRO_SOURCE_REGISTRY.admit(document, now=NOW)

    assert "effective_date_required" in decision.reasons


def test_checksum_tampering_is_rejected() -> None:
    document = replace(official_document(), body="Изменённый текст после вычисления checksum.")

    decision = DEFAULT_AGRO_SOURCE_REGISTRY.admit(document, now=NOW)

    assert "checksum_mismatch" in decision.reasons


def test_low_trust_score_and_wrong_domain_are_rejected() -> None:
    document = replace(
        official_document(),
        trust_score=0.5,
        domain=KnowledgeDomain.FINANCE,
    )

    decision = DEFAULT_AGRO_SOURCE_REGISTRY.admit(document, now=NOW)

    assert "trust_score_below_policy" in decision.reasons
    assert "domain_not_allowed" in decision.reasons


def test_repo_source_is_allowed_for_internal_platform_policy() -> None:
    document = SourceDocument.build(
        source_id="internal.platform",
        source_uri="repo://docs/platform-v7/deal-authority",
        title="Авторитет состояния Сделки",
        body="Сделка изменяется только серверными командами.",
        published_at=NOW,
        effective_at=NOW,
        fetched_at=NOW,
        trust_score=1.0,
        domain=KnowledgeDomain.PLATFORM,
    )

    decision = DEFAULT_AGRO_SOURCE_REGISTRY.admit(document, now=NOW)

    assert decision.accepted is True
