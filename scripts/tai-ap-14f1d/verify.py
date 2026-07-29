from __future__ import annotations

import argparse
import hashlib
import json
import os
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import psycopg
from psycopg.rows import dict_row

from tai.knowledge_chunking import ChunkingPolicy, DeterministicKnowledgeChunker, KnowledgeChunk
from tai.postgres_loader_state import ConnectionFactory
from tai.postgres_public_official_corpus import PostgreSQLPublicOfficialCorpusAuthority
from tai.postgres_retrieval_index import PostgreSQLRetrievalIndexRepository
from tai.public_corpus_shared_retrieval import (
    GovernedPublicCorpusRetrievalSynchronizer,
    RosstatSharedRetrievalService,
    SharedRetrievalLocale,
    SharedRetrievalStatus,
)
from tai.public_official_corpus import (
    AuthorityAuditContext,
    PublicArtifactProvenance,
    PublicCorpusArtifact,
    PublicOfficialCorpusBuilder,
    PublicSourceAdmission,
    SourceClass,
    SourceLocatorKind,
)
from tai.retrieval_index import LexicalRetriever, RetrievalDocument
from tai.retrieval_service import RetrievalService
from tai.rosstat_vshp2016254 import (
    ATTRIBUTION,
    DATA_URI,
    EFFECTIVE_DATE,
    FRESHNESS_DUE_AT,
    HISTORICAL_LABEL,
    HOST_PIN,
    PERIOD_END,
    PERIOD_START,
    PUBLICATION_DATE,
    RIGHTS_DECISION_ID,
    RIGHTS_REVIEW_DUE_AT,
    SOURCE_ID,
)

MIGRATIONS = (
    Path("apps/tai/tai/migrations/0005_retrieval_index.sql"),
    Path("apps/tai/tai/migrations/0019_public_official_corpus.sql"),
    Path("apps/tai/tai/migrations/0020_public_official_corpus_audit_authority.sql"),
)


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("observed_at must be timezone-aware")
    return value.astimezone(UTC)


def _parse_datetime(value: str) -> datetime:
    return _aware(datetime.fromisoformat(value.replace("Z", "+00:00")))


def _connection_factory(database_url: str) -> ConnectionFactory:
    @contextmanager
    def factory() -> Iterator[Any]:
        with psycopg.connect(database_url, row_factory=dict_row) as connection:
            yield connection

    return cast(ConnectionFactory, factory)


def _apply_migrations(database_url: str) -> None:
    with psycopg.connect(database_url, autocommit=True) as connection:
        for migration in MIGRATIONS:
            connection.execute(migration.read_text(encoding="utf-8"))


def _fetch_all(database_url: str, query: str) -> tuple[dict[str, Any], ...]:
    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        return tuple(dict(row) for row in connection.execute(query).fetchall())


def _materialization(observed: datetime) -> tuple[
    PublicSourceAdmission,
    PublicArtifactProvenance,
    PublicCorpusArtifact,
]:
    text = "\n".join(
        (
            HISTORICAL_LABEL,
            ATTRIBUTION,
            f"Источник: {DATA_URI}",
            "XPath: /GenericData[1]/DataSet[1]/Series[1]/Obs[1]/@OBS_VALUE",
            "Площадь сельскохозяйственных угодий по данным переписи 2016 года: 123.45.",
        )
    )
    payload = text.encode("utf-8")
    digest = hashlib.sha256(payload).hexdigest()
    admission = PublicSourceAdmission(
        source_id=SOURCE_ID,
        source_class=SourceClass.OPEN_DATASET,
        rights_decision_id=RIGHTS_DECISION_ID,
        official_uri=DATA_URI,
        host_pin=HOST_PIN,
        rights_review_due_at=RIGHTS_REVIEW_DUE_AT,
        admitted_at=observed,
        trust_score=0.97,
    )
    provenance = PublicArtifactProvenance(
        record_id=f"prov_{digest[:32]}",
        source_id=SOURCE_ID,
        source_class=SourceClass.OPEN_DATASET,
        rights_decision_id=RIGHTS_DECISION_ID,
        official_uri=DATA_URI,
        host_pin=HOST_PIN,
        content_sha256=digest,
        media_type="text/plain",
        size_bytes=len(payload),
        publication_date=PUBLICATION_DATE,
        effective_date=EFFECTIVE_DATE,
        observed_at=observed,
        locator_kind=SourceLocatorKind.XML_XPATH,
        locator_value="/GenericData[1]/DataSet[1]",
        freshness_due_at=FRESHNESS_DUE_AT,
        period_start=PERIOD_START,
        period_end=PERIOD_END,
    )
    return admission, provenance, PublicCorpusArtifact(provenance, text)


def _baseline_document(observed: datetime) -> RetrievalDocument:
    text = "Платформа содержит независимое руководство по сельскохозяйственным сделкам."
    return RetrievalDocument(
        chunk=KnowledgeChunk(
            chunk_id=hashlib.sha256(b"ap14f1d-baseline").hexdigest(),
            source_id="official.platform.manual",
            document_checksum_sha256=hashlib.sha256(text.encode()).hexdigest(),
            ordinal=0,
            text=text,
            token_estimate=max(1, (len(text) + 3) // 4),
        ),
        tenant_id=None,
        trust_score=0.95,
        valid_until=observed + timedelta(days=30),
        revoked=False,
    )


def verify(
    *,
    database_url: str,
    observed_at: datetime,
    evidence_output: Path,
) -> dict[str, object]:
    observed = _aware(observed_at)
    _apply_migrations(database_url)
    factory = _connection_factory(database_url)
    corpus_authority = PostgreSQLPublicOfficialCorpusAuthority(factory)
    retrieval_repository = PostgreSQLRetrievalIndexRepository(factory)

    admission, provenance, artifact = _materialization(observed)
    snapshot = PublicOfficialCorpusBuilder(
        DeterministicKnowledgeChunker(
            ChunkingPolicy(max_chars=4096, overlap_chars=0, min_chars=1)
        )
    ).build(admissions=(admission,), artifacts=(artifact,), now=observed)
    corpus_authority.admit_source(
        admission,
        AuthorityAuditContext(
            actor_id="tai-ap14f1d-verifier",
            reason_code="ROSSTAT_SOURCE_ADMISSION",
            created_at=observed,
        ),
    )
    corpus_authority.record_artifact(
        provenance,
        AuthorityAuditContext(
            actor_id="tai-ap14f1d-verifier",
            reason_code="ROSSTAT_ARTIFACT_ADMISSION",
            created_at=observed + timedelta(seconds=1),
        ),
    )
    snapshot_id = corpus_authority.persist_snapshot(
        snapshot,
        AuthorityAuditContext(
            actor_id="tai-ap14f1d-verifier",
            reason_code="ROSSTAT_SNAPSHOT_BUILD",
            created_at=observed + timedelta(seconds=2),
        ),
    )
    corpus_authority.activate_snapshot(
        snapshot_id,
        AuthorityAuditContext(
            actor_id="tai-ap14f1d-verifier",
            reason_code="ROSSTAT_SNAPSHOT_ACTIVATE",
            created_at=observed + timedelta(seconds=3),
        ),
    )

    baseline_generation = retrieval_repository.begin_generation()
    retrieval_repository.add(
        baseline_generation,
        (_baseline_document(observed),),
    )
    retrieval_repository.activate(baseline_generation)
    synchronizer = GovernedPublicCorpusRetrievalSynchronizer(
        public_corpus=corpus_authority,
        retrieval_index=retrieval_repository,
    )
    first = synchronizer.synchronize(now=observed + timedelta(seconds=4))
    replay = synchronizer.synchronize(now=observed + timedelta(seconds=5))
    if not first.changed or replay.changed:
        raise RuntimeError("retrieval synchronization replay contract failed")
    if first.active_generation != replay.active_generation:
        raise RuntimeError("idempotent replay changed the active generation")
    if first.previous_generation != baseline_generation or first.total_document_count != 2:
        raise RuntimeError("baseline retrieval knowledge was not preserved")

    retrieval = RosstatSharedRetrievalService(
        RetrievalService(LexicalRetriever(retrieval_repository))
    )
    localized = tuple(
        retrieval.retrieve(
            request_id=f"ap14f1d-{locale.value}",
            text="площадь сельскохозяйственных угодий",
            locale=locale,
            now=observed + timedelta(seconds=6),
        )
        for locale in SharedRetrievalLocale
    )
    if any(item.status is not SharedRetrievalStatus.SUPPORTED for item in localized):
        raise RuntimeError("localized Rosstat retrieval did not return supported evidence")
    chunk_sets = {tuple(hit.chunk_id for hit in item.retrieval.hits) for item in localized}
    source_sets = {tuple(hit.source_id for hit in item.retrieval.hits) for item in localized}
    if len(chunk_sets) != 1 or source_sets != {(SOURCE_ID,)}:
        raise RuntimeError("localized retrieval evidence differs by locale")
    if any(
        citation.source_uri != DATA_URI or citation.source_id != SOURCE_ID
        for item in localized
        for citation in item.citations
    ):
        raise RuntimeError("localized retrieval returned an invalid citation")
    if len({item.citations[0].historical_limitation for item in localized}) != 3:
        raise RuntimeError("historical limitation was not localized")

    irrelevant = retrieval.retrieve(
        request_id="ap14f1d-irrelevant",
        text="квантовая оптика",
        locale="ru",
        now=observed + timedelta(seconds=7),
    )
    if irrelevant.status is not SharedRetrievalStatus.ABSTAINED or irrelevant.citations:
        raise RuntimeError("unsupported query did not abstain")

    corpus_authority.withdraw_source(
        source_id=SOURCE_ID,
        audit=AuthorityAuditContext(
            actor_id="tai-ap14f1d-verifier",
            reason_code="ROSSTAT_SOURCE_WITHDRAW",
            created_at=observed + timedelta(seconds=8),
        ),
    )
    withdrawn = synchronizer.synchronize(now=observed + timedelta(seconds=9))
    withdrawn_replay = synchronizer.synchronize(now=observed + timedelta(seconds=10))
    if not withdrawn.changed or withdrawn.target_document_count != 0:
        raise RuntimeError("withdrawal did not replace the Rosstat retrieval slice")
    if withdrawn_replay.changed or withdrawn_replay.active_generation != withdrawn.active_generation:
        raise RuntimeError("withdrawal replay was not idempotent")

    after_withdrawal = retrieval.retrieve(
        request_id="ap14f1d-withdrawn",
        text="площадь сельскохозяйственных угодий",
        locale="ru",
        now=observed + timedelta(seconds=11),
    )
    if after_withdrawal.status is not SharedRetrievalStatus.ABSTAINED:
        raise RuntimeError("withdrawn Rosstat source remains retrievable")
    active_documents = retrieval_repository.active_documents()
    if {item.document.chunk.source_id for item in active_documents} != {
        "official.platform.manual"
    }:
        raise RuntimeError("withdrawal damaged baseline knowledge or retained Rosstat")

    generations = _fetch_all(
        database_url,
        """
        SELECT generation, status
        FROM tai_retrieval_generations
        ORDER BY generation
        """,
    )
    if len(generations) != 3:
        raise RuntimeError("unexpected retrieval generation count")
    if [item["status"] for item in generations] != ["RETIRED", "RETIRED", "ACTIVE"]:
        raise RuntimeError(f"retrieval generation status mismatch: {generations}")
    target_active_count = _fetch_all(
        database_url,
        f"""
        SELECT count(*) AS count
        FROM tai_retrieval_chunks AS chunks
        JOIN tai_retrieval_generations AS generations
          ON generations.generation = chunks.generation
         AND generations.status = 'ACTIVE'
        WHERE chunks.source_id = '{SOURCE_ID}'
        """,
    )[0]["count"]
    if int(target_active_count) != 0:
        raise RuntimeError("active PostgreSQL retrieval generation retained Rosstat chunks")

    evidence: dict[str, object] = {
        "schemaVersion": "tai.ap14f1d-shared-retrieval-evidence.v1",
        "exactHead": os.environ.get("EXACT_HEAD", "LOCAL_UNATTESTED"),
        "sourceId": SOURCE_ID,
        "observedAt": observed.isoformat(),
        "snapshotId": snapshot_id,
        "snapshotSha256": snapshot.snapshot_sha256,
        "baselineGeneration": baseline_generation,
        "activatedGeneration": first.active_generation,
        "withdrawalGeneration": withdrawn.active_generation,
        "initialTargetManifestSha256": first.target_manifest_sha256,
        "initialActiveManifestSha256": first.active_manifest_sha256,
        "withdrawnTargetManifestSha256": withdrawn.target_manifest_sha256,
        "withdrawnActiveManifestSha256": withdrawn.active_manifest_sha256,
        "initialChunkIds": list(first.chunk_ids),
        "localizedStatuses": {
            item.locale.value: item.status.value for item in localized
        },
        "localizedCitationUri": DATA_URI,
        "localizedSourceIds": list(next(iter(source_sets))),
        "irrelevantQueryStatus": irrelevant.status.value,
        "withdrawnQueryStatus": after_withdrawal.status.value,
        "activeTargetCountAfterWithdrawal": int(target_active_count),
        "generationStatuses": [item["status"] for item in generations],
        "baselinePreserved": True,
        "replayIdempotent": True,
        "withdrawalReplayIdempotent": True,
        "modelInvoked": False,
        "tenantId": None,
        "operationalStatus": "NOT_ATTESTED",
        "productionHosting": "REG_RU_VPS_ONLY",
    }
    evidence_output.parent.mkdir(parents=True, exist_ok=True)
    evidence_output.write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return evidence


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", required=True)
    parser.add_argument("--observed-at", required=True)
    parser.add_argument("--evidence-output", type=Path, required=True)
    args = parser.parse_args()
    evidence = verify(
        database_url=args.database_url,
        observed_at=_parse_datetime(args.observed_at),
        evidence_output=args.evidence_output,
    )
    print(json.dumps(evidence, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
