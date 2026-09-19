from __future__ import annotations

from collections import deque
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast
from uuid import UUID

import pytest

from tai.loader_state import LoaderLease, LoaderRunStatus
from tai.official_source_observation import (
    OfficialObservationRunEvidence,
    OfficialObservationRunStatus,
)
from tai.postgres_official_source_observation import (
    PostgreSQLOfficialObservationAuthority,
)
from tai.source_coverage import CoverageTopic, SourceObservation

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)
TOKEN = UUID("00000000-0000-0000-0000-000000000001")


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


def _lease() -> LoaderLease:
    return LoaderLease(
        source_id="official.cbr.key-rate",
        token=TOKEN,
        owner="worker-1",
        expires_at=NOW + timedelta(minutes=5),
        version=3,
    )


def _observation() -> SourceObservation:
    return SourceObservation(
        source_id="official.cbr.key-rate",
        observed_at=NOW,
        latest_publication_at=NOW - timedelta(days=1),
        last_success_at=NOW,
        document_count=2,
        consecutive_failures=0,
        observed_topics=frozenset({CoverageTopic.FINANCE_RATES}),
        content_sha256="a" * 64,
    )


def _evidence(observation: SourceObservation | None = None) -> OfficialObservationRunEvidence:
    return OfficialObservationRunEvidence(
        source_id="official.cbr.key-rate",
        worker_id="worker-1",
        lease_token=TOKEN,
        started_at=NOW - timedelta(seconds=1),
        completed_at=NOW,
        status=OfficialObservationRunStatus.FETCHED,
        reasons=("official_source_observed",),
        observation_sha256=(
            observation.observation_sha256 if observation is not None else None
        ),
        content_sha256=(observation.content_sha256 if observation is not None else None),
    )


def _parameters(value: object) -> tuple[Any, ...]:
    assert isinstance(value, tuple)
    return cast(tuple[Any, ...], value)


def test_atomic_commit_fences_state_then_inserts_observation_and_run() -> None:
    observation = _observation()
    evidence = _evidence(observation)
    connection = _Connection(
        [
            {"version": 4},
            {"observation_sha256": observation.observation_sha256},
            {"run_sha256": evidence.run_sha256},
        ]
    )
    authority = PostgreSQLOfficialObservationAuthority(_Factory(connection))

    accepted = authority.commit_run(
        lease=_lease(),
        status=LoaderRunStatus.SUCCEEDED,
        next_run_at=NOW + timedelta(days=7),
        etag='"v2"',
        last_modified="Sun, 19 Jul 2026 10:00:00 GMT",
        consecutive_failures=0,
        observation=observation,
        evidence=evidence,
    )

    assert accepted is True
    assert connection.commits == 1
    assert connection.rollbacks == 0
    assert len(connection.cursor_value.calls) == 3
    update_query, raw_update_parameters = connection.cursor_value.calls[0]
    assert "UPDATE tai_loader_state" in update_query
    update_parameters = _parameters(raw_update_parameters)
    assert TOKEN in update_parameters
    assert 3 in update_parameters
    observation_query, raw_observation_parameters = connection.cursor_value.calls[1]
    assert "INSERT INTO tai_official_source_observations" in observation_query
    assert observation.observation_sha256 in _parameters(raw_observation_parameters)
    run_query, raw_run_parameters = connection.cursor_value.calls[2]
    assert "INSERT INTO tai_official_source_run_evidence" in run_query
    assert evidence.run_sha256 in _parameters(raw_run_parameters)


def test_failure_run_without_baseline_commits_only_run_evidence() -> None:
    evidence = OfficialObservationRunEvidence(
        source_id="official.cbr.key-rate",
        worker_id="worker-1",
        lease_token=TOKEN,
        started_at=NOW,
        completed_at=NOW,
        status=OfficialObservationRunStatus.RETRYABLE_FAILURE,
        reasons=("source_http_503",),
        observation_sha256=None,
        content_sha256=None,
    )
    connection = _Connection([{"version": 4}, {"run_sha256": evidence.run_sha256}])
    authority = PostgreSQLOfficialObservationAuthority(_Factory(connection))

    accepted = authority.commit_run(
        lease=_lease(),
        status=LoaderRunStatus.RETRYABLE_FAILURE,
        next_run_at=NOW + timedelta(hours=1),
        etag=None,
        last_modified=None,
        consecutive_failures=1,
        observation=None,
        evidence=evidence,
    )

    assert accepted is True
    assert len(connection.cursor_value.calls) == 2
    assert "tai_official_source_run_evidence" in connection.cursor_value.calls[1][0]


def test_stale_fencing_token_rolls_back_without_any_evidence() -> None:
    connection = _Connection([None])
    authority = PostgreSQLOfficialObservationAuthority(_Factory(connection))

    accepted = authority.commit_run(
        lease=_lease(),
        status=LoaderRunStatus.SUCCEEDED,
        next_run_at=NOW + timedelta(days=7),
        etag=None,
        last_modified=None,
        consecutive_failures=0,
        observation=_observation(),
        evidence=_evidence(_observation()),
    )

    assert accepted is False
    assert connection.commits == 0
    assert connection.rollbacks == 1
    assert len(connection.cursor_value.calls) == 1


def test_observation_or_run_digest_conflict_rolls_back_whole_transaction() -> None:
    observation = _observation()
    evidence = _evidence(observation)
    observation_conflict = _Connection([{"version": 4}, None])
    run_conflict = _Connection(
        [
            {"version": 4},
            {"observation_sha256": observation.observation_sha256},
            None,
        ]
    )

    with pytest.raises(RuntimeError, match="observation digest"):
        PostgreSQLOfficialObservationAuthority(
            _Factory(observation_conflict)
        ).commit_run(
            lease=_lease(),
            status=LoaderRunStatus.SUCCEEDED,
            next_run_at=NOW,
            etag=None,
            last_modified=None,
            consecutive_failures=0,
            observation=observation,
            evidence=evidence,
        )
    with pytest.raises(RuntimeError, match="run digest"):
        PostgreSQLOfficialObservationAuthority(_Factory(run_conflict)).commit_run(
            lease=_lease(),
            status=LoaderRunStatus.SUCCEEDED,
            next_run_at=NOW,
            etag=None,
            last_modified=None,
            consecutive_failures=0,
            observation=observation,
            evidence=evidence,
        )

    assert observation_conflict.rollbacks == 1
    assert run_conflict.rollbacks == 1
    assert observation_conflict.commits == 0
    assert run_conflict.commits == 0


def test_latest_observation_reads_json_topics_or_returns_none() -> None:
    row = {
        "source_id": "official.cbr.key-rate",
        "observed_at": NOW,
        "latest_publication_at": NOW - timedelta(days=1),
        "last_success_at": NOW,
        "document_count": 2,
        "consecutive_failures": 0,
        "observed_topics": '["FINANCE_RATES"]',
        "content_sha256": "a" * 64,
    }
    populated_connection = _Connection([row])
    empty_connection = _Connection([None])

    populated = PostgreSQLOfficialObservationAuthority(
        _Factory(populated_connection)
    ).latest_observation("official.cbr.key-rate")
    empty = PostgreSQLOfficialObservationAuthority(
        _Factory(empty_connection)
    ).latest_observation("official.cbr.key-rate")

    assert populated is not None
    assert populated.observed_topics == frozenset({CoverageTopic.FINANCE_RATES})
    assert empty is None
    assert populated_connection.commits == 1
    assert empty_connection.commits == 1


def test_commit_rejects_evidence_bound_to_another_source_or_token() -> None:
    connection = _Connection([])
    authority = PostgreSQLOfficialObservationAuthority(_Factory(connection))
    wrong_source = OfficialObservationRunEvidence(
        source_id="official.other.source",
        worker_id="worker-1",
        lease_token=TOKEN,
        started_at=NOW,
        completed_at=NOW,
        status=OfficialObservationRunStatus.FETCHED,
        reasons=("ok",),
        observation_sha256=None,
        content_sha256=None,
    )
    wrong_token = OfficialObservationRunEvidence(
        source_id="official.cbr.key-rate",
        worker_id="worker-1",
        lease_token=UUID("00000000-0000-0000-0000-000000000002"),
        started_at=NOW,
        completed_at=NOW,
        status=OfficialObservationRunStatus.FETCHED,
        reasons=("ok",),
        observation_sha256=None,
        content_sha256=None,
    )

    with pytest.raises(ValueError, match="source"):
        authority.commit_run(
            lease=_lease(),
            status=LoaderRunStatus.SUCCEEDED,
            next_run_at=NOW,
            etag=None,
            last_modified=None,
            consecutive_failures=0,
            observation=None,
            evidence=wrong_source,
        )
    with pytest.raises(ValueError, match="token"):
        authority.commit_run(
            lease=_lease(),
            status=LoaderRunStatus.SUCCEEDED,
            next_run_at=NOW,
            etag=None,
            last_modified=None,
            consecutive_failures=0,
            observation=None,
            evidence=wrong_token,
        )

    assert connection.cursor_value.calls == []


def test_migration_registers_unique_lease_evidence_and_manifest_version() -> None:
    root = Path(__file__).parents[1] / "tai" / "migrations"
    migration = (root / "0017_official_source_run_evidence.sql").read_text()
    manifest = (root / "manifest.json").read_text()

    assert "CREATE TABLE IF NOT EXISTS tai_official_source_run_evidence" in migration
    assert "UNIQUE INDEX IF NOT EXISTS tai_official_source_run_lease_idx" in migration
    assert "REFERENCES tai_official_source_observations" in migration
    assert '"path": "0017_official_source_run_evidence.sql"' in manifest
    assert '"version": 18' in manifest
