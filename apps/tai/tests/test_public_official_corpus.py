from __future__ import annotations

import hashlib
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

import pytest

from tai.public_official_corpus import (
    PublicArtifactProvenance,
    PublicCorpusArtifact,
    PublicOfficialCorpusBuilder,
    PublicSourceAdmission,
    SourceAdmissionStatus,
    SourceClass,
    SourceLocatorKind,
)

NOW = datetime(2026, 7, 28, 18, 0, tzinfo=UTC)
TEXT = "ФГИС Зерно публикует официальный порядок учета партий. " * 20
PAYLOAD = TEXT.strip().encode("utf-8")
DIGEST = hashlib.sha256(PAYLOAD).hexdigest()


def admission(**changes: object) -> PublicSourceAdmission:
    value = PublicSourceAdmission(
        source_id="official.specagro.fgis-grain.manual",
        source_class=SourceClass.OFFICIAL_MANUAL,
        rights_decision_id="AP14F0-PUBLIC_MANUAL_REVIEWED",
        official_uri="https://specagro.ru/fgis/api",
        host_pin="specagro.ru",
        rights_review_due_at=NOW + timedelta(days=180),
        admitted_at=NOW - timedelta(days=1),
        trust_score=0.95,
    )
    return replace(value, **changes)


def provenance(**changes: object) -> PublicArtifactProvenance:
    value = PublicArtifactProvenance(
        record_id="prov_0123456789abcdef",
        source_id="official.specagro.fgis-grain.manual",
        source_class=SourceClass.OFFICIAL_MANUAL,
        rights_decision_id="AP14F0-PUBLIC_MANUAL_REVIEWED",
        official_uri="https://specagro.ru/fgis/api",
        host_pin="specagro.ru",
        content_sha256=DIGEST,
        media_type="text/plain",
        size_bytes=len(PAYLOAD),
        publication_date=date(2026, 7, 1),
        effective_date=date(2026, 7, 1),
        observed_at=NOW - timedelta(hours=2),
        locator_kind=SourceLocatorKind.SECTION,
        locator_value="section:api-participant-manual",
        freshness_due_at=NOW + timedelta(days=30),
    )
    return replace(value, **changes)


def artifact(**changes: object) -> PublicCorpusArtifact:
    value = PublicCorpusArtifact(provenance=provenance(), normalized_text=TEXT)
    return replace(value, **changes)


def test_builds_deterministic_public_snapshot_and_shared_retrieval_documents() -> None:
    first = PublicOfficialCorpusBuilder().build(
        admissions=(admission(),), artifacts=(artifact(),), now=NOW
    )
    second = PublicOfficialCorpusBuilder().build(
        admissions=(admission(),), artifacts=(artifact(),), now=NOW
    )

    assert first.snapshot_sha256 == second.snapshot_sha256
    assert first.source_ids == ("official.specagro.fgis-grain.manual",)
    assert first.artifact_sha256s == (DIGEST,)
    assert len(first.chunks) >= 1
    assert [chunk.chunk_id for chunk in first.chunks] == [
        document.chunk.chunk_id for document in first.retrieval_documents
    ]
    assert all(document.tenant_id is None for document in first.retrieval_documents)
    assert all(document.revoked is False for document in first.retrieval_documents)
    assert all(document.trust_score == 0.95 for document in first.retrieval_documents)
    assert all(
        document.valid_until == NOW + timedelta(days=30)
        for document in first.retrieval_documents
    )


def test_artifact_rejects_digest_size_and_unsupported_media_type() -> None:
    with pytest.raises(ValueError, match="size"):
        PublicCorpusArtifact(
            provenance=provenance(size_bytes=len(PAYLOAD) + 1),
            normalized_text=TEXT,
        )
    with pytest.raises(ValueError, match="digest"):
        PublicCorpusArtifact(
            provenance=provenance(content_sha256="a" * 64),
            normalized_text=TEXT,
        )
    with pytest.raises(ValueError, match="media_type"):
        provenance(media_type="application/pdf")


def test_builder_fails_closed_on_withdrawn_or_expired_source_rights() -> None:
    withdrawn = admission(status=SourceAdmissionStatus.WITHDRAWN)
    expired = admission(rights_review_due_at=NOW - timedelta(seconds=1))

    with pytest.raises(ValueError, match="withdrawn or rights-expired"):
        PublicOfficialCorpusBuilder().build(
            admissions=(withdrawn,), artifacts=(artifact(),), now=NOW
        )
    with pytest.raises(ValueError, match="withdrawn or rights-expired"):
        PublicOfficialCorpusBuilder().build(
            admissions=(expired,), artifacts=(artifact(),), now=NOW
        )


def test_builder_fails_closed_on_stale_future_or_cross_authority_provenance() -> None:
    stale = artifact(
        provenance=provenance(freshness_due_at=NOW - timedelta(seconds=1))
    )
    future = artifact(
        provenance=provenance(effective_date=NOW.date() + timedelta(days=1))
    )
    wrong_decision = artifact(
        provenance=provenance(rights_decision_id="AP14F0-OTHER_PUBLIC_DECISION")
    )

    with pytest.raises(ValueError, match="stale or not yet effective"):
        PublicOfficialCorpusBuilder().build(
            admissions=(admission(),), artifacts=(stale,), now=NOW
        )
    with pytest.raises(ValueError, match="stale or not yet effective"):
        PublicOfficialCorpusBuilder().build(
            admissions=(admission(),), artifacts=(future,), now=NOW
        )
    with pytest.raises(ValueError, match="rights decision"):
        PublicOfficialCorpusBuilder().build(
            admissions=(admission(),), artifacts=(wrong_decision,), now=NOW
        )


def test_builder_rejects_host_uri_class_and_missing_admission_mismatch() -> None:
    with pytest.raises(ValueError, match="host pin"):
        PublicOfficialCorpusBuilder().build(
            admissions=(
                admission(
                    host_pin="api.specagro.ru",
                    official_uri="https://api.specagro.ru/fgis/api",
                ),
            ),
            artifacts=(artifact(),),
            now=NOW,
        )
    with pytest.raises(ValueError, match="source class"):
        PublicOfficialCorpusBuilder().build(
            admissions=(admission(source_class=SourceClass.OFFICIAL_REGULATION),),
            artifacts=(artifact(),),
            now=NOW,
        )
    with pytest.raises(ValueError, match="no public-official admission"):
        PublicOfficialCorpusBuilder().build(
            admissions=(), artifacts=(artifact(),), now=NOW
        )


def test_builder_rejects_duplicate_admission_ids_and_empty_artifacts() -> None:
    with pytest.raises(ValueError, match="unique"):
        PublicOfficialCorpusBuilder().build(
            admissions=(admission(), admission()), artifacts=(artifact(),), now=NOW
        )
    with pytest.raises(ValueError, match="at least one"):
        PublicOfficialCorpusBuilder().build(
            admissions=(admission(),), artifacts=(), now=NOW
        )
