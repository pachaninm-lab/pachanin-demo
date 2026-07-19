from __future__ import annotations

from collections import deque
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from tai.postgres_source_coverage import PostgreSQLOfficialSourceCoverageRepository
from tai.source_coverage import (
    CoverageRequirement,
    CoverageTopic,
    OfficialSourceCatalog,
    OfficialSourceCoverageAuthority,
    OfficialSourceDefinition,
    SourceFormat,
    SourceObservation,
)

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)


def _observation() -> SourceObservation:
    return SourceObservation(
        source_id="official.example.market",
        observed_at=NOW - timedelta(hours=1),
        latest_publication_at=NOW - timedelta(days=1),
        last_success_at=NOW - timedelta(hours=1),
        document_count=3,
        consecutive_failures=0,
        observed_topics=frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
        content_sha256="a" * 64,
    )


def _assessment() -> object:
    catalog = OfficialSourceCatalog(
        sources=(
            OfficialSourceDefinition(
                source_id="official.example.market",
                owner="Official Example Authority",
                entrypoint_uri="https://data.example.gov/market",
                allowed_hosts=frozenset({"data.example.gov"}),
                topics=frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
                formats=frozenset({SourceFormat.JSON}),
                expected_update_interval=timedelta(days=7),
                maximum_publication_age=timedelta(days=31),
                verified_at=NOW - timedelta(days=1),
            ),
        ),
        requirements=(
            CoverageRequirement(
                topic=CoverageTopic.GRAIN_MARKET_PRICES,
                minimum_official_sources=1,
                maximum_publication_age=timedelta(days=31),
            ),
        ),
    )
    return OfficialSourceCoverageAuthority().assess(
        catalog=catalog,
        observations=(_observation(),),
        now=NOW,
    )


class _Cursor:
    def __init__(self, rows: list[dict[str, Any] | None]) -> None:
        self._rows = deque(rows)
        self.calls: list[tuple[str, object]] = []

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        del args

    def execute(self, query: str, parameters: object) -> None:
        self.calls.append((query, parameters))

    def fetchone(self) -> dict[str, Any] | None:
        return self._rows.popleft() if self._rows else None


class _Connection:
    def __init__(self, rows: list[dict[str, Any] | None]) -> None:
        self.cursor_value = _Cursor(rows)
        self.commits = 0
        self.rollbacks = 0

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        del args

    def cursor(self) -> _Cursor:
        return self.cursor_value

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


class _Factory:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    def __call__(self) -> _Connection:
        return self.connection


def test_repository_records_observation_immutably() -> None:
    observation = _observation()
    connection = _Connection(
        [{"observation_sha256": observation.observation_sha256}]
    )
    repository = PostgreSQLOfficialSourceCoverageRepository(_Factory(connection))

    repository.record_observation(observation)

    assert connection.commits == 1
    assert connection.rollbacks == 0
    query, parameters = connection.cursor_value.calls[0]
    assert "INSERT INTO tai_official_source_observations" in query
    assert observation.observation_sha256 in parameters
    assert '"GRAIN_MARKET_PRICES"' in parameters


def test_repository_records_assessment_immutably() -> None:
    assessment = _assessment()
    assert hasattr(assessment, "assessment_sha256")
    connection = _Connection(
        [{"assessment_sha256": assessment.assessment_sha256}]
    )
    repository = PostgreSQLOfficialSourceCoverageRepository(_Factory(connection))

    repository.record_assessment(assessment)

    assert connection.commits == 1
    query, parameters = connection.cursor_value.calls[0]
    assert "tai_official_source_coverage_assessments" in query
    assert assessment.assessment_sha256 in parameters
    assert '"status":"COVERED"' in parameters


@pytest.mark.parametrize("method_name", ["record_observation", "record_assessment"])
def test_repository_rolls_back_on_digest_conflict(method_name: str) -> None:
    connection = _Connection([None])
    repository = PostgreSQLOfficialSourceCoverageRepository(_Factory(connection))
    value = _observation() if method_name == "record_observation" else _assessment()

    with pytest.raises(RuntimeError, match="different evidence"):
        getattr(repository, method_name)(value)

    assert connection.commits == 0
    assert connection.rollbacks == 1


def test_repository_lists_latest_observations_from_json_text_and_array() -> None:
    rows = [
        {
            "source_id": "official.example.market",
            "observed_at": NOW - timedelta(hours=1),
            "latest_publication_at": NOW - timedelta(days=1),
            "last_success_at": NOW - timedelta(hours=1),
            "document_count": 3,
            "consecutive_failures": 0,
            "observed_topics": '["GRAIN_MARKET_PRICES"]',
            "content_sha256": "a" * 64,
        },
        {
            "source_id": "official.example.production",
            "observed_at": NOW - timedelta(hours=2),
            "latest_publication_at": NOW - timedelta(days=2),
            "last_success_at": NOW - timedelta(hours=2),
            "document_count": 2,
            "consecutive_failures": 0,
            "observed_topics": ["AGRICULTURE_PRODUCTION"],
            "content_sha256": "b" * 64,
        },
        None,
    ]
    connection = _Connection(rows)
    repository = PostgreSQLOfficialSourceCoverageRepository(_Factory(connection))

    observations = repository.list_latest_observations()

    assert len(observations) == 2
    assert observations[0].source_id == "official.example.market"
    assert observations[1].observed_topics == frozenset(
        {CoverageTopic.AGRICULTURE_PRODUCTION}
    )
    assert connection.commits == 1


def test_repository_returns_current_assessment_metadata_or_none() -> None:
    metadata = {
        "assessment_sha256": "c" * 64,
        "generated_at": NOW,
        "coverage_basis_points": 8_750,
        "critical_coverage_basis_points": 8_750,
        "all_critical_covered": False,
    }
    populated = PostgreSQLOfficialSourceCoverageRepository(
        _Factory(_Connection([metadata, None]))
    )
    empty = PostgreSQLOfficialSourceCoverageRepository(
        _Factory(_Connection([None]))
    )

    assert populated.current_assessment_metadata() == metadata
    assert empty.current_assessment_metadata() is None


def test_repository_rejects_invalid_stored_topics_and_timestamp() -> None:
    invalid_topics = _Connection(
        [
            {
                "source_id": "official.example.market",
                "observed_at": NOW,
                "latest_publication_at": NOW,
                "last_success_at": NOW,
                "document_count": 1,
                "consecutive_failures": 0,
                "observed_topics": {"wrong": "shape"},
                "content_sha256": "a" * 64,
            },
            None,
        ]
    )
    invalid_time = _Connection(
        [
            {
                "source_id": "official.example.market",
                "observed_at": "not-a-datetime",
                "latest_publication_at": NOW,
                "last_success_at": NOW,
                "document_count": 1,
                "consecutive_failures": 0,
                "observed_topics": ["GRAIN_MARKET_PRICES"],
                "content_sha256": "a" * 64,
            },
            None,
        ]
    )

    with pytest.raises(ValueError, match="observed_topics"):
        PostgreSQLOfficialSourceCoverageRepository(
            _Factory(invalid_topics)
        ).list_latest_observations()
    with pytest.raises(ValueError, match="observed_at"):
        PostgreSQLOfficialSourceCoverageRepository(
            _Factory(invalid_time)
        ).list_latest_observations()
