from __future__ import annotations

import argparse
import json
import os
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import psycopg
from psycopg.rows import dict_row
from tai.postgres_loader_state import ConnectionFactory
from tai.postgres_public_official_corpus import PostgreSQLPublicOfficialCorpusAuthority
from tai.public_corpus_retrieval_sync import (
    RosstatSharedRetrievalService,
    RosstatSharedRetrievalSynchronizer,
    SharedRetrievalStatus,
)
from tai.public_official_corpus import AuthorityAuditContext
from tai.rosstat_vshp2016254 import (
    DATA_URI,
    SOURCE_ID,
    RosstatVshp2016254Materializer,
)

MIGRATIONS = (
    Path("apps/tai/tai/migrations/0005_retrieval_index.sql"),
    Path("apps/tai/tai/migrations/0019_public_official_corpus.sql"),
    Path("apps/tai/tai/migrations/0020_public_official_corpus_audit_authority.sql"),
)
QUESTIONS = {
    "ru": (
        "Что показывает структура сельскохозяйственных угодий?"
    ),
    "en": "What does the agricultural land structure dataset show?",
    "zh": "农业用地结构数据集显示什么？",
}


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("observed_at must be timezone-aware")
    return value.astimezone(UTC)


def _parse_datetime(value: str) -> datetime:
    return _aware(datetime.fromisoformat(value.replace("Z", "+00:00")))


def _apply_migrations(database_url: str) -> None:
    with psycopg.connect(database_url, autocommit=True) as connection:
        for migration in MIGRATIONS:
            connection.execute(migration.read_text(encoding="utf-8"))


def _connection_factory(database_url: str) -> ConnectionFactory:
    @contextmanager
    def factory() -> Iterator[Any]:
        with psycopg.connect(database_url, row_factory=dict_row) as connection:
            yield connection

    return cast(ConnectionFactory, factory)


def _fetch_all(
    database_url: str,
    query: str,
    parameters: tuple[object, ...] = (),
) -> tuple[dict[str, Any], ...]:
    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        rows = connection.execute(query, parameters).fetchall()
        return tuple(dict(row) for row in rows)


def verify(
    *,
    database_url: str,
    passport_csv: Path,
    structure_xml: Path,
    data_xml: Path,
    observed_at: datetime,
    evidence_output: Path,
) -> dict[str, object]:
    observed = _aware(observed_at)
    _apply_migrations(database_url)
    factory = _connection_factory(database_url)
    materialization = RosstatVshp2016254Materializer().materialize(
        passport_csv=passport_csv.read_bytes(),
        structure_xml=structure_xml.read_bytes(),
        data_xml=data_xml.read_bytes(),
        observed_at=observed,
    )
    authority = PostgreSQLPublicOfficialCorpusAuthority(factory)

    authority.admit_source(
        materialization.admission,
        AuthorityAuditContext(
            actor_id="tai-ap14f1d-verifier",
            reason_code="ROSSTAT_SOURCE_ADMISSION",
            created_at=observed,
        ),
    )
    authority.record_artifact(
        materialization.provenance,
        AuthorityAuditContext(
            actor_id="tai-ap14f1d-verifier",
            reason_code="ROSSTAT_ARTIFACT_ADMISSION",
            created_at=observed + timedelta(seconds=1),
        ),
    )
    snapshot_id = authority.persist_snapshot(
        materialization.snapshot,
        AuthorityAuditContext(
            actor_id="tai-ap14f1d-verifier",
            reason_code="ROSSTAT_SNAPSHOT_BUILD",
            created_at=observed + timedelta(seconds=2),
        ),
    )
    authority.activate_snapshot(
        snapshot_id,
        AuthorityAuditContext(
            actor_id="tai-ap14f1d-verifier",
            reason_code="ROSSTAT_SNAPSHOT_ACTIVATE",
            created_at=observed + timedelta(seconds=3),
        ),
    )

    synchronizer = RosstatSharedRetrievalSynchronizer(factory)
    sync_at = observed + timedelta(seconds=4)
    with ThreadPoolExecutor(max_workers=2) as executor:
        concurrent_results = tuple(
            executor.map(
                lambda _: RosstatSharedRetrievalSynchronizer(factory).sync(now=sync_at),
                range(2),
            )
        )
    created_results = tuple(
        result for result in concurrent_results if result.created_generation
    )
    if len(created_results) != 1:
        raise RuntimeError("concurrent sync did not create exactly one generation")
    first_sync = created_results[0]
    if first_sync.generation is None:
        raise RuntimeError("initial shared retrieval generation was not created")
    if {result.generation for result in concurrent_results} != {first_sync.generation}:
        raise RuntimeError("concurrent sync returned divergent generation identities")
    if {result.manifest_sha256 for result in concurrent_results} != {
        first_sync.manifest_sha256
    }:
        raise RuntimeError("concurrent sync returned divergent manifests")
    if first_sync.source_document_count != len(materialization.snapshot.chunks):
        raise RuntimeError("shared retrieval source count differs from snapshot chunks")
    generation_rows_before_withdrawal = _fetch_all(
        database_url,
        "SELECT generation, status FROM tai_retrieval_generations ORDER BY generation",
    )
    if generation_rows_before_withdrawal != (
        {"generation": first_sync.generation, "status": "ACTIVE"},
    ):
        raise RuntimeError(
            f"concurrent sync left non-authoritative generations: "
            f"{generation_rows_before_withdrawal}"
        )
    replay_sync = synchronizer.sync(now=observed + timedelta(seconds=5))
    if replay_sync.created_generation:
        raise RuntimeError("identical shared retrieval replay created a generation")
    if replay_sync.generation != first_sync.generation:
        raise RuntimeError(
            "identical shared retrieval replay changed generation identity"
        )
    if replay_sync.manifest_sha256 != first_sync.manifest_sha256:
        raise RuntimeError("identical shared retrieval replay changed manifest digest")

    service = RosstatSharedRetrievalService(factory)
    localized = {
        locale: service.retrieve(
            locale=locale,
            request_id=f"tai-ap14f1d-{locale}",
            text=question,
            now=observed + timedelta(seconds=6),
        )
        for locale, question in QUESTIONS.items()
    }
    if any(
        response.status is not SharedRetrievalStatus.SUPPORTED
        for response in localized.values()
    ):
        raise RuntimeError(
            "one or more localized Rosstat queries abstained unexpectedly"
        )
    chunk_sets = {response.chunk_ids for response in localized.values()}
    source_sets = {
        frozenset(response.source_ids) for response in localized.values()
    }
    if len(chunk_sets) != 1 or len(source_sets) != 1:
        raise RuntimeError("localized queries returned different evidence")
    if source_sets != {frozenset({SOURCE_ID})}:
        raise RuntimeError("localized query returned an unexpected source")
    if any(
        citation.source_uri != DATA_URI
        or citation.source_id != SOURCE_ID
        or "2016" not in citation.historical_limitation
        for response in localized.values()
        for citation in response.citations
    ):
        raise RuntimeError("localized citation contract failed")
    if any(response.model_invoked for response in localized.values()):
        raise RuntimeError("evidence retrieval invoked a model")

    irrelevant = service.retrieve(
        locale="ru",
        request_id="tai-ap14f1d-irrelevant",
        text="Какая сейчас цена подсолнечника?",
        now=observed + timedelta(seconds=7),
    )
    if irrelevant.status is not SharedRetrievalStatus.ABSTAINED:
        raise RuntimeError("irrelevant query did not abstain")
    if irrelevant.citations or irrelevant.model_invoked:
        raise RuntimeError("irrelevant query fabricated evidence or invoked a model")

    authority.withdraw_source(
        source_id=SOURCE_ID,
        audit=AuthorityAuditContext(
            actor_id="tai-ap14f1d-verifier",
            reason_code="ROSSTAT_SOURCE_WITHDRAW",
            created_at=observed + timedelta(seconds=8),
        ),
    )
    withdrawal_sync = synchronizer.sync(now=observed + timedelta(seconds=9))
    if not withdrawal_sync.created_generation:
        raise RuntimeError("withdrawal did not create a replacement generation")
    if withdrawal_sync.generation is None:
        raise RuntimeError("withdrawal replacement generation is absent")
    if withdrawal_sync.generation == first_sync.generation:
        raise RuntimeError("withdrawal reused the stale retrieval generation")
    if withdrawal_sync.source_document_count != 0:
        raise RuntimeError("withdrawal left Rosstat documents in desired manifest")
    if withdrawal_sync.document_count != 0:
        raise RuntimeError("isolated withdrawal generation is not empty")

    withdrawn = service.retrieve(
        locale="en",
        request_id="tai-ap14f1d-withdrawn",
        text=QUESTIONS["en"],
        now=observed + timedelta(seconds=10),
    )
    if withdrawn.status is not SharedRetrievalStatus.ABSTAINED:
        raise RuntimeError("withdrawn Rosstat source remains retrievable")
    if withdrawn.chunk_ids or withdrawn.citations or withdrawn.model_invoked:
        raise RuntimeError("withdrawn Rosstat response contains stale evidence")

    generations = _fetch_all(
        database_url,
        """
        SELECT generation, status
        FROM tai_retrieval_generations
        ORDER BY generation
        """,
    )
    status_by_generation = {
        int(row["generation"]): str(row["status"]) for row in generations
    }
    if status_by_generation.get(first_sync.generation) != "RETIRED":
        raise RuntimeError("prior retrieval generation is not RETIRED")
    if status_by_generation.get(withdrawal_sync.generation) != "ACTIVE":
        raise RuntimeError("withdrawal generation is not ACTIVE")
    active_target_chunks = _fetch_all(
        database_url,
        """
        SELECT c.chunk_id
        FROM tai_retrieval_chunks AS c
        JOIN tai_retrieval_generations AS g
          ON g.generation = c.generation
         AND g.status = 'ACTIVE'
        WHERE c.source_id = %s
        """,
        (SOURCE_ID,),
    )
    if active_target_chunks:
        raise RuntimeError(
            "active retrieval generation contains withdrawn Rosstat chunks"
        )

    sample = next(iter(localized.values()))
    evidence: dict[str, object] = {
        "schemaVersion": "tai.ap14f1d-shared-retrieval-evidence.v1",
        "exactHead": os.environ.get("EXACT_HEAD", "LOCAL_UNATTESTED"),
        "sourceId": SOURCE_ID,
        "sourceUri": DATA_URI,
        "snapshotId": snapshot_id,
        "snapshotSha256": materialization.snapshot_sha256,
        "artifactSha256": materialization.artifact_sha256,
        "firstGeneration": first_sync.generation,
        "firstManifestSha256": first_sync.manifest_sha256,
        "concurrentSyncResultCount": len(concurrent_results),
        "concurrentCreatedGenerationCount": len(created_results),
        "replayGeneration": replay_sync.generation,
        "replayCreatedGeneration": replay_sync.created_generation,
        "localizedLocales": sorted(localized),
        "localizedChunkIds": list(sample.chunk_ids),
        "localizedSourceIds": list(sample.source_ids),
        "everyCitationHasExactSourceUri": True,
        "everyCitationHasHistoricalLimitation": True,
        "irrelevantQueryStatus": irrelevant.status.value,
        "withdrawalGeneration": withdrawal_sync.generation,
        "withdrawalManifestSha256": withdrawal_sync.manifest_sha256,
        "activeTargetChunkCountAfterWithdrawal": len(active_target_chunks),
        "withdrawnQueryStatus": withdrawn.status.value,
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
    parser.add_argument("--passport-csv", type=Path, required=True)
    parser.add_argument("--structure-xml", type=Path, required=True)
    parser.add_argument("--data-xml", type=Path, required=True)
    parser.add_argument("--observed-at", required=True)
    parser.add_argument("--evidence-output", type=Path, required=True)
    args = parser.parse_args()

    evidence = verify(
        database_url=args.database_url,
        passport_csv=args.passport_csv,
        structure_xml=args.structure_xml,
        data_xml=args.data_xml,
        observed_at=_parse_datetime(args.observed_at),
        evidence_output=args.evidence_output,
    )
    print(json.dumps(evidence, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
