from __future__ import annotations

from datetime import UTC, datetime, timedelta

from tai.loader_state import (
    InMemoryLoaderStateRepository,
    LoaderRunStatus,
    LoaderScheduler,
)

NOW = datetime(2026, 7, 18, 12, tzinfo=UTC)
LEASE = timedelta(minutes=5)


def test_scheduling_is_idempotent() -> None:
    repository = InMemoryLoaderStateRepository()
    scheduler = LoaderScheduler(repository)

    first = scheduler.ensure_scheduled(
        source_id="official.minselhoz",
        source_uri="https://mcx.gov.ru/report",
        next_run_at=NOW,
    )
    second = scheduler.ensure_scheduled(
        source_id="official.minselhoz",
        source_uri="https://mcx.gov.ru/report",
        next_run_at=NOW + timedelta(hours=1),
    )

    assert first == second
    assert second.version == 1
    assert second.next_run_at == NOW


def test_source_id_cannot_be_rebound_to_another_uri() -> None:
    repository = InMemoryLoaderStateRepository()
    repository.schedule(
        source_id="official.minselhoz",
        source_uri="https://mcx.gov.ru/report",
        next_run_at=NOW,
    )

    try:
        repository.schedule(
            source_id="official.minselhoz",
            source_uri="https://example.invalid/report",
            next_run_at=NOW,
        )
    except ValueError as error:
        assert str(error) == "source_id is already bound to another URI"
    else:
        raise AssertionError("source URI rebinding must fail closed")


def test_only_one_worker_claims_due_source() -> None:
    repository = InMemoryLoaderStateRepository()
    scheduler = LoaderScheduler(repository)
    scheduler.ensure_scheduled(
        source_id="official.minselhoz",
        source_uri="https://mcx.gov.ru/report",
        next_run_at=NOW,
    )

    first = scheduler.acquire(worker_id="worker-a", now=NOW, lease_duration=LEASE)
    second = scheduler.acquire(worker_id="worker-b", now=NOW, lease_duration=LEASE)

    assert first is not None
    assert second is None
    assert first.owner == "worker-a"


def test_expired_lease_can_be_recovered_with_new_fencing_token() -> None:
    repository = InMemoryLoaderStateRepository()
    scheduler = LoaderScheduler(repository)
    scheduler.ensure_scheduled(
        source_id="official.minselhoz",
        source_uri="https://mcx.gov.ru/report",
        next_run_at=NOW,
    )
    stale = scheduler.acquire(worker_id="worker-a", now=NOW, lease_duration=LEASE)
    assert stale is not None

    recovered = scheduler.acquire(
        worker_id="worker-b",
        now=NOW + LEASE,
        lease_duration=LEASE,
    )

    assert recovered is not None
    assert recovered.owner == "worker-b"
    assert recovered.token != stale.token
    assert recovered.version > stale.version


def test_heartbeat_extends_only_current_lease() -> None:
    repository = InMemoryLoaderStateRepository()
    repository.schedule(
        source_id="official.minselhoz",
        source_uri="https://mcx.gov.ru/report",
        next_run_at=NOW,
    )
    lease = repository.claim_due(worker_id="worker-a", now=NOW, lease_duration=LEASE)
    assert lease is not None

    renewed = repository.heartbeat(
        lease=lease,
        now=NOW + timedelta(minutes=1),
        lease_duration=LEASE,
    )

    assert renewed is not None
    assert renewed.expires_at == NOW + timedelta(minutes=6)
    assert renewed.version == lease.version + 1
    assert repository.heartbeat(
        lease=lease,
        now=NOW + timedelta(minutes=2),
        lease_duration=LEASE,
    ) is None


def test_stale_worker_cannot_complete_after_takeover() -> None:
    repository = InMemoryLoaderStateRepository()
    repository.schedule(
        source_id="official.minselhoz",
        source_uri="https://mcx.gov.ru/report",
        next_run_at=NOW,
    )
    stale = repository.claim_due(worker_id="worker-a", now=NOW, lease_duration=LEASE)
    assert stale is not None
    current = repository.claim_due(
        worker_id="worker-b",
        now=NOW + LEASE,
        lease_duration=LEASE,
    )
    assert current is not None

    accepted = repository.complete(
        lease=stale,
        status=LoaderRunStatus.SUCCEEDED,
        next_run_at=NOW + timedelta(days=1),
        etag='"stale"',
        last_modified=None,
        consecutive_failures=0,
    )

    assert accepted is False
    state = repository.get("official.minselhoz")
    assert state is not None
    assert state.lease_token == current.token


def test_completion_persists_conditional_fetch_state_and_releases_lease() -> None:
    repository = InMemoryLoaderStateRepository()
    repository.schedule(
        source_id="official.minselhoz",
        source_uri="https://mcx.gov.ru/report",
        next_run_at=NOW,
    )
    lease = repository.claim_due(worker_id="worker-a", now=NOW, lease_duration=LEASE)
    assert lease is not None

    accepted = repository.complete(
        lease=lease,
        status=LoaderRunStatus.NOT_MODIFIED,
        next_run_at=NOW + timedelta(days=1),
        etag='"v4"',
        last_modified="Sat, 18 Jul 2026 12:00:00 GMT",
        consecutive_failures=0,
    )

    assert accepted is True
    state = repository.get("official.minselhoz")
    assert state is not None
    assert state.status is LoaderRunStatus.NOT_MODIFIED
    assert state.etag == '"v4"'
    assert state.lease_token is None
    assert state.next_run_at == NOW + timedelta(days=1)


def test_scheduler_rejects_invalid_worker_and_lease_duration() -> None:
    scheduler = LoaderScheduler(InMemoryLoaderStateRepository())

    for worker_id, duration in (("", LEASE), ("worker", timedelta(0))):
        try:
            scheduler.acquire(worker_id=worker_id, now=NOW, lease_duration=duration)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid scheduler acquisition must fail closed")
