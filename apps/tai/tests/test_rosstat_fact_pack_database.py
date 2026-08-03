from __future__ import annotations

import os
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import psycopg
import pytest
from psycopg import errors
from psycopg.rows import dict_row

from tai.postgres_loader_state import ConnectionFactory
from tai.rosstat_fact_pack import (
    PACK_ID,
    FactPackSyncResult,
    FactQueryStatus,
    RosstatFactPackService,
    RosstatFactPackSynchronizer,
)
from tai.rosstat_vshp2016254 import (
    ATTRIBUTION,
    DATA_SHA256,
    DATA_URI,
    HISTORICAL_LABEL,
    RIGHTS_DECISION_ID,
    SOURCE_ID,
)

NOW = datetime(2026, 7, 29, 12, 0, tzinfo=UTC)
ARTIFACT_SHA = "a" * 64
SNAPSHOT_SHA = "b" * 64


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _paragraph(xpath: str, value: str) -> str:
    return "\n".join(
        (
            HISTORICAL_LABEL,
            ATTRIBUTION,
            f"Официальный URI данных: {DATA_URI}",
            "URI структуры SDMX: https://rosstat.gov.ru/opendata/structure.xml",
            "Дата публикации: 2018-12-11",
            "Период данных: 2016-01-01 — 2016-12-31",
            f"SHA-256 исходного XML: {DATA_SHA256}",
            f"XPath: {xpath}",
            f"Значение: {value}",
        )
    )


def _connection_factory(url: str) -> ConnectionFactory:
    @contextmanager
    def factory() -> Iterator[Any]:
        with psycopg.connect(url, row_factory=dict_row) as connection:
            yield connection

    return cast(ConnectionFactory, factory)


def _prepare_database(url: str) -> None:
    root = _repo_root() / "apps/tai/tai/migrations"
    migration_0019 = (root / "0019_public_official_corpus.sql").read_text(
        encoding="utf-8"
    )
    migration_0020 = (
        root / "0020_public_official_corpus_audit_authority.sql"
    ).read_text(encoding="utf-8")
    migration_0022 = (root / "0022_public_fact_pack_authority.sql").read_text(
        encoding="utf-8"
    )
    prefix = "/GenericData[1]/DataSet[1]/Series[1]"
    records = (
        (f"{prefix}/SeriesKey[1]/Value[1]/@concept", "TERRITOR"),
        (f"{prefix}/SeriesKey[1]/Value[1]/@value", "RU"),
        (f"{prefix}/SeriesKey[1]/Value[2]/@concept", "UNIT_MEASURE"),
        (f"{prefix}/SeriesKey[1]/Value[2]/@value", "HECTARE"),
        (f"{prefix}/Obs[1]/ObsDimension[1]/@value", "2016"),
        (f"{prefix}/Obs[1]/ObsValue[1]/@value", "123.4500"),
    )

    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as connection:
        connection.execute(migration_0019)
        connection.execute(
            """
            INSERT INTO tai_public_corpus_source_admissions (
                source_id, data_plane, source_class, rights_decision_id,
                official_uri, host_pin, rights_review_due_at, admitted_at,
                trust_score, status
            ) VALUES (
                %s, 'PUBLIC_OFFICIAL', 'OPEN_DATASET', %s, %s,
                'rosstat.gov.ru', '2030-01-01T00:00:00Z',
                '2026-07-29T10:00:00Z', 0.970, 'ADMITTED'
            )
            """,
            (SOURCE_ID, RIGHTS_DECISION_ID, DATA_URI),
        )
        connection.execute(
            """
            INSERT INTO tai_public_corpus_artifacts (
                artifact_sha256, record_id, source_id, source_class,
                rights_decision_id, official_uri, host_pin, media_type,
                size_bytes, publication_date, effective_date, observed_at,
                locator_kind, locator_value, freshness_due_at, unit,
                period_start, period_end, status
            ) VALUES (
                %s, %s, %s, 'OPEN_DATASET', %s, %s, 'rosstat.gov.ru',
                'text/plain', 4096, '2018-12-11', '2018-12-11',
                '2026-07-29T10:00:00Z', 'XML_XPATH',
                '/GenericData[1]/DataSet[1]', '2030-01-01T00:00:00Z',
                NULL, '2016-01-01', '2016-12-31', 'ADMITTED'
            )
            """,
            (
                ARTIFACT_SHA,
                f"prov_{ARTIFACT_SHA[:32]}",
                SOURCE_ID,
                RIGHTS_DECISION_ID,
                DATA_URI,
            ),
        )
        row = connection.execute(
            """
            INSERT INTO tai_public_corpus_snapshots (
                snapshot_sha256, status, created_at, source_ids,
                artifact_sha256s
            ) VALUES (
                %s, 'BUILDING', '2026-07-29T10:01:00Z',
                jsonb_build_array(%s::text), jsonb_build_array(%s::text)
            )
            RETURNING snapshot_id
            """,
            (SNAPSHOT_SHA, SOURCE_ID, ARTIFACT_SHA),
        ).fetchone()
        assert row is not None
        snapshot_id = int(row["snapshot_id"])
        for ordinal, (xpath, value) in enumerate(records):
            text = _paragraph(xpath, value)
            connection.execute(
                """
                INSERT INTO tai_public_corpus_chunks (
                    snapshot_id, chunk_id, artifact_sha256, source_id,
                    ordinal, chunk_text, token_estimate, trust_score,
                    valid_until
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, 0.970, %s)
                """,
                (
                    snapshot_id,
                    f"{ordinal + 1:064x}",
                    ARTIFACT_SHA,
                    SOURCE_ID,
                    ordinal,
                    text,
                    max(1, (len(text) + 3) // 4),
                    datetime(2030, 1, 1, tzinfo=UTC),
                ),
            )
        connection.execute(
            "SELECT tai_activate_public_corpus_snapshot(%s)", (snapshot_id,)
        ).fetchone()
        connection.execute(migration_0020)
        connection.execute(migration_0022)


@pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"),
    reason="PostgreSQL acceptance URL is not configured",
)
def test_postgresql_fact_pack_concurrency_query_withdrawal_and_immutability() -> None:
    url = os.environ["TEST_DATABASE_URL"]
    _prepare_database(url)
    factory = _connection_factory(url)

    def synchronize(offset: int) -> FactPackSyncResult:
        return RosstatFactPackSynchronizer(factory).sync(
            now=NOW.replace(microsecond=offset)
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        first, second = tuple(pool.map(synchronize, (1, 2)))

    created = [result for result in (first, second) if result.created_version]
    replayed = [result for result in (first, second) if not result.created_version]
    assert len(created) == 1
    assert len(replayed) == 1
    assert created[0].version_id == replayed[0].version_id
    assert created[0].manifest_sha256 == replayed[0].manifest_sha256
    assert created[0].fact_count == 1

    service = RosstatFactPackService(factory)
    responses = tuple(
        service.query(
            locale=locale,
            dimensions={"TERRITOR": "RU", "TIME_PERIOD": "2016"},
        )
        for locale in ("ru", "en", "zh")
    )
    assert {response.status for response in responses} == {
        FactQueryStatus.SUPPORTED
    }
    assert {response.model_invoked for response in responses} == {False}
    assert len({response.facts[0].fact_id for response in responses}) == 1
    assert {response.facts[0].exact_value for response in responses} == {
        "123.45"
    }
    assert {response.facts[0].citation.source_uri for response in responses} == {
        DATA_URI
    }
    assert {response.facts[0].citation.source_id for response in responses} == {
        SOURCE_ID
    }

    replay = RosstatFactPackSynchronizer(factory).sync(
        now=NOW.replace(microsecond=3)
    )
    assert replay.created_version is False
    assert replay.version_id == created[0].version_id

    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as connection:
        counts = connection.execute(
            """
            SELECT
                count(*) FILTER (WHERE status = 'ACTIVE') AS active_versions,
                count(*) AS total_versions
            FROM tai_public_fact_pack_versions
            WHERE pack_id = %s
            """,
            (PACK_ID,),
        ).fetchone()
        assert counts == {"active_versions": 1, "total_versions": 1}

        facts = connection.execute(
            """
            SELECT exact_value::TEXT AS numeric_text, exact_value_text,
                   dimensions, provenance_locators
            FROM tai_active_public_fact_pack_facts_v1
            WHERE pack_id = %s
            """,
            (PACK_ID,),
        ).fetchall()
        assert len(facts) == 1
        assert facts[0]["numeric_text"] == facts[0]["exact_value_text"] == "123.45"
        assert facts[0]["dimensions"]["TERRITOR"] == "RU"
        assert facts[0]["provenance_locators"]

        with pytest.raises(errors.RaiseException):
            connection.execute(
                """
                UPDATE tai_public_fact_pack_versions
                SET status = 'RETIRED'
                WHERE pack_id = %s AND status = 'ACTIVE'
                """,
                (PACK_ID,),
            )
        with pytest.raises(errors.RaiseException):
            connection.execute("DELETE FROM tai_public_fact_pack_audit")

        connection.execute(
            "SELECT tai_withdraw_public_corpus_source(%s, %s, %s, %s)",
            (
                SOURCE_ID,
                "test-operator",
                "SOURCE_WITHDRAWN",
                datetime(2026, 7, 29, 12, 30, tzinfo=UTC),
            ),
        ).fetchone()

    withdrawal = RosstatFactPackSynchronizer(factory).sync(
        now=datetime(2026, 7, 29, 12, 31, tzinfo=UTC)
    )
    assert withdrawal.created_version is True
    assert withdrawal.fact_count == 0
    assert withdrawal.source_snapshot_id is None
    assert withdrawal.previous_version_id == created[0].version_id

    abstained = service.query(
        locale="ru",
        dimensions={"TERRITOR": "RU", "TIME_PERIOD": "2016"},
    )
    assert abstained.status is FactQueryStatus.ABSTAINED
    assert abstained.facts == ()
    assert abstained.model_invoked is False

    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as connection:
        active = connection.execute(
            """
            SELECT version_id, fact_count, source_snapshot_id
            FROM tai_public_fact_pack_versions
            WHERE pack_id = %s AND status = 'ACTIVE'
            """,
            (PACK_ID,),
        ).fetchone()
        assert active is not None
        assert active["version_id"] == withdrawal.version_id
        assert active["fact_count"] == 0
        assert active["source_snapshot_id"] is None
        stale = connection.execute(
            """
            SELECT count(*) AS count
            FROM tai_active_public_fact_pack_facts_v1
            WHERE pack_id = %s
            """,
            (PACK_ID,),
        ).fetchone()
        assert stale == {"count": 0}

        retired_snapshot = connection.execute(
            """
            SELECT snapshot_id, snapshot_sha256
            FROM tai_public_corpus_snapshots
            WHERE snapshot_sha256 = %s
            """,
            (SNAPSHOT_SHA,),
        ).fetchone()
        assert retired_snapshot is not None
        invalid_version = connection.execute(
            """
            INSERT INTO tai_public_fact_pack_versions (
                pack_id, manifest_sha256, source_snapshot_id,
                source_snapshot_sha256, status, fact_count,
                dimension_codes, created_at
            ) VALUES (
                %s, %s, %s, %s, 'BUILDING', 1,
                '["TERRITOR","TIME_PERIOD","UNIT_MEASURE"]'::jsonb,
                '2026-07-29T12:32:00Z'
            )
            RETURNING version_id
            """,
            (
                PACK_ID,
                "c" * 64,
                retired_snapshot["snapshot_id"],
                retired_snapshot["snapshot_sha256"],
            ),
        ).fetchone()
        assert invalid_version is not None
        prior_version = created[0].version_id
        connection.execute(
            """
            INSERT INTO tai_public_fact_pack_facts (
                version_id, fact_id, source_id, source_snapshot_id,
                source_snapshot_sha256, artifact_sha256, chunk_id,
                source_uri, xpath, dimensions, measure_code,
                exact_value, exact_value_text, unit_code,
                publication_date, effective_date, period_start,
                period_end, observed_at, provenance_locators,
                provenance_sha256
            )
            SELECT
                %s, fact_id, source_id, source_snapshot_id,
                source_snapshot_sha256, artifact_sha256, chunk_id,
                source_uri, xpath, dimensions, measure_code,
                exact_value, exact_value_text, unit_code,
                publication_date, effective_date, period_start,
                period_end, observed_at, provenance_locators,
                provenance_sha256
            FROM tai_public_fact_pack_facts
            WHERE version_id = %s
            """,
            (invalid_version["version_id"], prior_version),
        )
        with pytest.raises(errors.RaiseException, match="source snapshot is not active"):
            connection.execute(
                "SELECT tai_activate_public_fact_pack_version(%s)",
                (invalid_version["version_id"],),
            )
