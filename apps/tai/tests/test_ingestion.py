from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from tai.ingestion import IngestionLedger, IngestionState
from tai.source_governance import (
    DEFAULT_AGRO_SOURCE_REGISTRY,
    KnowledgeDomain,
    SourceDocument,
)

NOW = datetime(2026, 7, 18, 12, 0, tzinfo=UTC)


def document(*, body: str = "Подтверждённый обзор рынка зерна.") -> SourceDocument:
    return SourceDocument.build(
        source_id="official.minselhoz",
        source_uri="https://mcx.gov.ru/analytics/grain-market",
        title="Обзор зернового рынка",
        body=body,
        published_at=NOW - timedelta(days=1),
        effective_at=NOW - timedelta(days=1),
        fetched_at=NOW,
        trust_score=0.99,
        domain=KnowledgeDomain.MARKET,
    )


def test_accepted_document_creates_grounded_record() -> None:
    ledger = IngestionLedger()

    result = ledger.ingest(
        document(),
        manifest_id="manifest-1",
        version="agro.2026-07-18.1",
        now=NOW,
        registry=DEFAULT_AGRO_SOURCE_REGISTRY,
    )

    assert result.manifest.state is IngestionState.ACCEPTED
    assert result.record is not None
    assert result.record.source_uri.startswith("https://mcx.gov.ru/")
    assert result.record.version == "agro.2026-07-18.1"


def test_rejected_document_is_quarantined_without_record() -> None:
    ledger = IngestionLedger()
    tampered = replace(document(), body="Подменённый текст")

    result = ledger.ingest(
        tampered,
        manifest_id="manifest-bad",
        version="agro.2026-07-18.bad",
        now=NOW,
        registry=DEFAULT_AGRO_SOURCE_REGISTRY,
    )

    assert result.manifest.state is IngestionState.QUARANTINED
    assert "checksum_mismatch" in result.manifest.reasons
    assert result.record is None


def test_duplicate_checksum_is_not_reindexed() -> None:
    ledger = IngestionLedger()
    source = document()
    ledger.ingest(
        source,
        manifest_id="manifest-1",
        version="v1",
        now=NOW,
        registry=DEFAULT_AGRO_SOURCE_REGISTRY,
    )

    duplicate = ledger.ingest(
        source,
        manifest_id="manifest-2",
        version="v1-copy",
        now=NOW,
        registry=DEFAULT_AGRO_SOURCE_REGISTRY,
    )

    assert duplicate.manifest.state is IngestionState.DUPLICATE
    assert duplicate.record is None
    assert duplicate.manifest.reasons == ("checksum_already_ingested", "manifest-1")


def test_new_source_version_supersedes_prior_manifest() -> None:
    ledger = IngestionLedger()
    ledger.ingest(
        document(),
        manifest_id="manifest-1",
        version="v1",
        now=NOW,
        registry=DEFAULT_AGRO_SOURCE_REGISTRY,
    )

    updated = ledger.ingest(
        document(body="Обновлённый подтверждённый обзор рынка зерна."),
        manifest_id="manifest-2",
        version="v2",
        now=NOW,
        registry=DEFAULT_AGRO_SOURCE_REGISTRY,
    )

    assert updated.manifest.state is IngestionState.ACCEPTED
    assert updated.manifest.supersedes_manifest_id == "manifest-1"
    assert ledger.get("manifest-1").state is IngestionState.SUPERSEDED


def test_active_manifest_can_be_revoked() -> None:
    ledger = IngestionLedger()
    ledger.ingest(
        document(),
        manifest_id="manifest-1",
        version="v1",
        now=NOW,
        registry=DEFAULT_AGRO_SOURCE_REGISTRY,
    )

    revoked = ledger.revoke("manifest-1", reason="publisher_retraction")

    assert revoked.state is IngestionState.REVOKED
    assert revoked.reasons == ("publisher_retraction",)


def test_manifest_ids_are_immutable() -> None:
    ledger = IngestionLedger()
    ledger.ingest(
        document(),
        manifest_id="manifest-1",
        version="v1",
        now=NOW,
        registry=DEFAULT_AGRO_SOURCE_REGISTRY,
    )

    with pytest.raises(ValueError, match="manifest_id_already_exists"):
        ledger.ingest(
            document(body="Другая версия"),
            manifest_id="manifest-1",
            version="v2",
            now=NOW,
            registry=DEFAULT_AGRO_SOURCE_REGISTRY,
        )
