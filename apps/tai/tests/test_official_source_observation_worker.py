from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from tai.loader_state import (
    InMemoryLoaderStateRepository,
    LoaderLease,
    LoaderRunStatus,
    LoaderScheduler,
)
from tai.managed_loader import FetchDisposition, FetchRequest, FetchResponse
from tai.official_source_observation import (
    LostOfficialObservationLeaseError,
    OfficialObservationDefinition,
    OfficialObservationDefinitionRegistry,
    OfficialObservationRunEvidence,
    OfficialObservationRunStatus,
    OfficialSourceObservationWorker,
    default_html_metadata_adapters,
)
from tai.source_coverage import (
    CoverageTopic,
    OfficialSourceDefinition,
    SourceFormat,
    SourceObservation,
)

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)
SOURCE_ID = "official.cbr.key-rate"


class _Fetcher:
    def __init__(self, response: FetchResponse) -> None:
        self.response = response
        self.requests: list[FetchRequest] = []

    def fetch(self, request: FetchRequest) -> FetchResponse:
        self.requests.append(request)
        return self.response


class _Authority:
    def __init__(
        self,
        loader_repository: InMemoryLoaderStateRepository,
        *,
        reject_commit: bool = False,
    ) -> None:
        self.loader_repository = loader_repository
        self.reject_commit = reject_commit
        self.observations: dict[str, SourceObservation] = {}
        self.evidence: list[OfficialObservationRunEvidence] = []

    def latest_observation(self, source_id: str) -> SourceObservation | None:
        return self.observations.get(source_id)

    def commit_run(
        self,
        *,
        lease: LoaderLease,
        status: LoaderRunStatus,
        next_run_at: datetime | None,
        etag: str | None,
        last_modified: str | None,
        consecutive_failures: int,
        observation: SourceObservation | None,
        evidence: OfficialObservationRunEvidence,
    ) -> bool:
        if self.reject_commit:
            return False
        accepted = self.loader_repository.complete(
            lease=lease,
            status=status,
            next_run_at=next_run_at,
            etag=etag,
            last_modified=last_modified,
            consecutive_failures=consecutive_failures,
        )
        if not accepted:
            return False
        if observation is not None:
            self.observations[observation.source_id] = observation
        self.evidence.append(evidence)
        return True


def _source() -> OfficialSourceDefinition:
    return OfficialSourceDefinition(
        source_id=SOURCE_ID,
        owner="Банк России",
        entrypoint_uri="https://www.cbr.ru/hd_base/KeyRate/",
        allowed_hosts=frozenset({"www.cbr.ru"}),
        topics=frozenset({CoverageTopic.FINANCE_RATES}),
        formats=frozenset({SourceFormat.HTML}),
        expected_update_interval=timedelta(days=7),
        maximum_publication_age=timedelta(days=31),
        verified_at=NOW - timedelta(days=1),
    )


def _success_response(body: str | None = None) -> FetchResponse:
    return FetchResponse(
        disposition=FetchDisposition.FETCHED,
        body=body
        or (
            "<h1>Ключевая ставка Банка России</h1>"
            "<table><tr><td>18.07.2026</td></tr>"
            "<tr><td>01.07.2026</td></tr></table>"
        ),
        fetched_at=NOW,
        etag='"cbr-v2"',
        last_modified="Sun, 19 Jul 2026 10:00:00 GMT",
    )


def _baseline() -> SourceObservation:
    return SourceObservation(
        source_id=SOURCE_ID,
        observed_at=NOW - timedelta(days=1),
        latest_publication_at=NOW - timedelta(days=2),
        last_success_at=NOW - timedelta(days=1),
        document_count=3,
        consecutive_failures=0,
        observed_topics=frozenset({CoverageTopic.FINANCE_RATES}),
        content_sha256="a" * 64,
    )


def _build_worker(
    response: FetchResponse,
    *,
    authority: _Authority | None = None,
    maximum_failures: int = 5,
    due_at: datetime = NOW,
) -> tuple[
    OfficialSourceObservationWorker,
    InMemoryLoaderStateRepository,
    _Authority,
    _Fetcher,
]:
    repository = authority.loader_repository if authority else InMemoryLoaderStateRepository()
    effective_authority = authority or _Authority(repository)
    fetcher = _Fetcher(response)
    adapter = next(
        item for item in default_html_metadata_adapters() if item.source_id == SOURCE_ID
    )
    definition = OfficialObservationDefinition(
        source=_source(),
        adapter=adapter,
        fetcher=fetcher,
        maximum_failures=maximum_failures,
    )
    LoaderScheduler(repository).ensure_scheduled(
        source_id=SOURCE_ID,
        source_uri=definition.source.entrypoint_uri,
        next_run_at=due_at,
    )
    worker = OfficialSourceObservationWorker(
        loader_repository=repository,
        authority=effective_authority,
        definitions=OfficialObservationDefinitionRegistry((definition,)),
        worker_id="official-worker-1",
        lease_duration=timedelta(minutes=5),
    )
    return worker, repository, effective_authority, fetcher


def test_success_records_observation_and_fenced_run_evidence() -> None:
    worker, repository, authority, fetcher = _build_worker(_success_response())

    execution = worker.run_once(now=NOW)

    assert execution.status is OfficialObservationRunStatus.FETCHED
    assert execution.committed is True
    assert execution.run_sha256 == authority.evidence[0].run_sha256
    observation = authority.observations[SOURCE_ID]
    assert observation.latest_publication_at == datetime(2026, 7, 18, tzinfo=UTC)
    assert observation.document_count == 2
    assert observation.consecutive_failures == 0
    state = repository.get(SOURCE_ID)
    assert state is not None
    assert state.status is LoaderRunStatus.SUCCEEDED
    assert state.next_run_at == NOW + timedelta(days=7)
    assert state.lease_token is None
    assert fetcher.requests[0].source_uri == _source().entrypoint_uri


def test_not_modified_requires_baseline_and_refreshes_last_success() -> None:
    response = FetchResponse(
        disposition=FetchDisposition.NOT_MODIFIED,
        body=None,
        fetched_at=NOW,
        etag='"same"',
    )
    repository = InMemoryLoaderStateRepository()
    with_baseline = _Authority(repository)
    with_baseline.observations[SOURCE_ID] = _baseline()
    worker, _, _, _ = _build_worker(response, authority=with_baseline)

    execution = worker.run_once(now=NOW)

    assert execution.status is OfficialObservationRunStatus.NOT_MODIFIED
    refreshed = with_baseline.observations[SOURCE_ID]
    assert refreshed.latest_publication_at == NOW - timedelta(days=2)
    assert refreshed.last_success_at == NOW
    assert refreshed.content_sha256 == "a" * 64

    missing_worker, missing_repository, missing_authority, _ = _build_worker(response)
    missing_execution = missing_worker.run_once(now=NOW)
    missing_state = missing_repository.get(SOURCE_ID)
    assert missing_execution.status is OfficialObservationRunStatus.RETRYABLE_FAILURE
    assert missing_execution.reasons == ("source_not_modified_without_baseline",)
    assert missing_authority.observations == {}
    assert missing_state is not None
    assert missing_state.consecutive_failures == 1


def test_retryable_failure_preserves_previous_success_but_marks_it_unhealthy() -> None:
    response = FetchResponse(
        disposition=FetchDisposition.RETRYABLE_FAILURE,
        body=None,
        fetched_at=NOW,
        error_code="source_http_503",
    )
    repository = InMemoryLoaderStateRepository()
    authority = _Authority(repository)
    authority.observations[SOURCE_ID] = _baseline()
    worker, _, _, _ = _build_worker(response, authority=authority)

    execution = worker.run_once(now=NOW)

    assert execution.status is OfficialObservationRunStatus.RETRYABLE_FAILURE
    failed = authority.observations[SOURCE_ID]
    assert failed.last_success_at == NOW - timedelta(days=1)
    assert failed.observed_at == NOW
    assert failed.consecutive_failures == 1
    assert failed.content_sha256 == "a" * 64


def test_failure_budget_and_permanent_security_failure_stop_schedule() -> None:
    exhausted_response = FetchResponse(
        disposition=FetchDisposition.RETRYABLE_FAILURE,
        body=None,
        fetched_at=NOW,
        error_code="source_transport_failure",
    )
    exhausted_worker, exhausted_repository, _, _ = _build_worker(
        exhausted_response,
        maximum_failures=1,
    )
    exhausted = exhausted_worker.run_once(now=NOW)
    exhausted_state = exhausted_repository.get(SOURCE_ID)
    assert exhausted.status is OfficialObservationRunStatus.PERMANENT_FAILURE
    assert exhausted.reasons == (
        "source_transport_failure",
        "failure_budget_exhausted",
    )
    assert exhausted_state is not None
    assert exhausted_state.next_run_at is None

    security_response = FetchResponse(
        disposition=FetchDisposition.PERMANENT_FAILURE,
        body=None,
        fetched_at=NOW,
        error_code="source_content_prompt_injection_detected",
    )
    security_worker, security_repository, _, _ = _build_worker(security_response)
    security = security_worker.run_once(now=NOW)
    security_state = security_repository.get(SOURCE_ID)
    assert security.status is OfficialObservationRunStatus.PERMANENT_FAILURE
    assert security.reasons == ("source_content_prompt_injection_detected",)
    assert security_state is not None
    assert security_state.status is LoaderRunStatus.PERMANENT_FAILURE


def test_metadata_failure_is_retryable_and_does_not_create_coverage() -> None:
    worker, repository, authority, _ = _build_worker(
        _success_response("<html>нет маркера 18.07.2026</html>")
    )

    execution = worker.run_once(now=NOW)

    state = repository.get(SOURCE_ID)
    assert execution.status is OfficialObservationRunStatus.RETRYABLE_FAILURE
    assert execution.reasons == ("source_required_marker_missing",)
    assert authority.observations == {}
    assert state is not None
    assert state.consecutive_failures == 1


def test_lost_token_and_no_due_source_never_commit_evidence() -> None:
    repository = InMemoryLoaderStateRepository()
    rejecting = _Authority(repository, reject_commit=True)
    worker, _, _, _ = _build_worker(_success_response(), authority=rejecting)
    with pytest.raises(LostOfficialObservationLeaseError, match="fencing authority"):
        worker.run_once(now=NOW)
    assert rejecting.observations == {}
    assert rejecting.evidence == []

    idle_worker, _, idle_authority, idle_fetcher = _build_worker(
        _success_response(),
        due_at=NOW + timedelta(hours=1),
    )
    idle = idle_worker.run_once(now=NOW)
    assert idle.committed is False
    assert idle.reasons == ("no_due_official_source",)
    assert idle_fetcher.requests == []
    assert idle_authority.evidence == []
