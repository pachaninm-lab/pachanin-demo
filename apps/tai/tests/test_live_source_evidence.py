from __future__ import annotations

from collections import deque
from datetime import UTC, datetime, timedelta

import pytest

from tai.live_source_evidence import (
    LiveCollectionStatus,
    LiveEvidenceBundle,
    LiveSourceEvidenceCollector,
    LiveSourceResult,
    LiveSourceResultStatus,
    coverage_payload,
    evidence_bundle_sha256,
    observations_payload,
    run_manifest_payload,
)
from tai.managed_loader import FetchDisposition, FetchRequest, FetchResponse
from tai.official_source_observation import (
    OfficialObservationDefinition,
    default_html_metadata_adapters,
)
from tai.source_coverage import (
    CoverageRequirement,
    CoverageTopic,
    OfficialSourceCatalog,
    OfficialSourceDefinition,
    SourceFormat,
)
from tai.source_health import SourceRefreshOutcome

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)
REPOSITORY_SHA = "a" * 40


class _Fetcher:
    def __init__(self, response: FetchResponse) -> None:
        self.response = response
        self.requests: list[FetchRequest] = []

    def fetch(self, request: FetchRequest) -> FetchResponse:
        self.requests.append(request)
        return self.response


class _Clock:
    def __init__(self, values: tuple[datetime, ...]) -> None:
        self.values = deque(values)

    def __call__(self) -> datetime:
        return self.values.popleft()


def _source(
    source_id: str,
    topic: CoverageTopic,
    uri: str,
    host: str,
) -> OfficialSourceDefinition:
    return OfficialSourceDefinition(
        source_id=source_id,
        owner="Official Authority",
        entrypoint_uri=uri,
        allowed_hosts=frozenset({host}),
        topics=frozenset({topic}),
        formats=frozenset({SourceFormat.HTML}),
        expected_update_interval=timedelta(days=7),
        maximum_publication_age=timedelta(days=31),
        verified_at=NOW - timedelta(days=1),
    )


def _catalog() -> OfficialSourceCatalog:
    return OfficialSourceCatalog(
        sources=(
            _source(
                "official.cbr.key-rate",
                CoverageTopic.FINANCE_RATES,
                "https://www.cbr.ru/hd_base/KeyRate/",
                "www.cbr.ru",
            ),
            _source(
                "official.mcx.opendata",
                CoverageTopic.GRAIN_TRACEABILITY,
                "https://opendata.mcx.ru/",
                "opendata.mcx.ru",
            ),
        ),
        requirements=(
            CoverageRequirement(
                topic=CoverageTopic.FINANCE_RATES,
                minimum_official_sources=1,
                maximum_publication_age=timedelta(days=31),
            ),
            CoverageRequirement(
                topic=CoverageTopic.GRAIN_TRACEABILITY,
                minimum_official_sources=1,
                maximum_publication_age=timedelta(days=31),
            ),
        ),
    )


def _definition(
    source: OfficialSourceDefinition,
    response: FetchResponse,
) -> tuple[OfficialObservationDefinition, _Fetcher]:
    adapter = next(
        item
        for item in default_html_metadata_adapters()
        if item.source_id == source.source_id
    )
    fetcher = _Fetcher(response)
    return (
        OfficialObservationDefinition(
            source=source,
            adapter=adapter,
            fetcher=fetcher,
        ),
        fetcher,
    )


def _success(source_id: str) -> FetchResponse:
    body = (
        "<h1>Ключевая ставка</h1><time>18.07.2026</time>"
        if source_id == "official.cbr.key-rate"
        else (
            "<h1>Открытые данные по зерну</h1><time>18.07.2026</time>"
            "<a href='/grain.csv'>CSV</a>"
        )
    )
    return FetchResponse(
        disposition=FetchDisposition.FETCHED,
        body=body,
        fetched_at=NOW,
    )


def _collector(
    responses: tuple[FetchResponse, FetchResponse],
) -> tuple[LiveSourceEvidenceCollector, tuple[_Fetcher, _Fetcher]]:
    catalog = _catalog()
    first, first_fetcher = _definition(catalog.sources[0], responses[0])
    second, second_fetcher = _definition(catalog.sources[1], responses[1])
    clock = _Clock(
        (
            NOW - timedelta(seconds=3),
            NOW - timedelta(seconds=2),
            NOW - timedelta(seconds=1),
            NOW,
        )
    )
    return (
        LiveSourceEvidenceCollector(
            catalog=catalog,
            definitions=(first, second),
            repository_sha=REPOSITORY_SHA,
            clock=clock,
        ),
        (first_fetcher, second_fetcher),
    )


def test_complete_collection_produces_observations_assessment_and_digest() -> None:
    collector, fetchers = _collector(
        (
            _success("official.cbr.key-rate"),
            _success("official.mcx.opendata"),
        )
    )

    bundle = collector.collect()

    assert bundle.status is LiveCollectionStatus.COMPLETE
    assert len(bundle.observations) == 2
    assert bundle.assessment.all_critical_covered is True
    assert bundle.assessment.coverage_basis_points == 10000
    assert [request.source_id for request in fetchers[0].requests] == [
        "official.cbr.key-rate"
    ]
    assert [request.source_id for request in fetchers[1].requests] == [
        "official.mcx.opendata"
    ]
    manifest = run_manifest_payload(bundle)
    observations = observations_payload(bundle)
    assessment = coverage_payload(bundle)
    assert manifest["status"] == "COMPLETE"
    assert manifest["repository_sha"] == REPOSITORY_SHA
    assert manifest["observed_source_count"] == 2
    assert len(observations["observations"]) == 2
    assert assessment["all_critical_covered"] is True
    assert len(evidence_bundle_sha256(bundle)) == 64
    assert evidence_bundle_sha256(bundle) == evidence_bundle_sha256(bundle)


def test_partial_collection_keeps_failed_topic_unobserved() -> None:
    failure = FetchResponse(
        disposition=FetchDisposition.RETRYABLE_FAILURE,
        body=None,
        fetched_at=NOW,
        error_code="source_http_503",
    )
    collector, _ = _collector((_success("official.cbr.key-rate"), failure))

    bundle = collector.collect()

    assert bundle.status is LiveCollectionStatus.PARTIAL
    assert len(bundle.observations) == 1
    assert bundle.assessment.all_critical_covered is False
    assert bundle.assessment.coverage_basis_points == 5000
    assert bundle.source_results[1].status is LiveSourceResultStatus.FAILED
    assert bundle.source_results[1].reason == "source_http_503"
    topic_payloads = {
        item["topic"]: item for item in coverage_payload(bundle)["topics"]
    }
    assert topic_payloads["GRAIN_TRACEABILITY"]["status"] == "UNOBSERVED"


def test_all_failed_collection_is_failed_without_fake_observations() -> None:
    failure = FetchResponse(
        disposition=FetchDisposition.PERMANENT_FAILURE,
        body=None,
        fetched_at=NOW,
        error_code="source_content_prompt_injection_detected",
    )
    not_modified = FetchResponse(
        disposition=FetchDisposition.NOT_MODIFIED,
        body=None,
        fetched_at=NOW,
    )
    collector, _ = _collector((failure, not_modified))

    bundle = collector.collect()

    assert bundle.status is LiveCollectionStatus.FAILED
    assert bundle.observations == ()
    assert bundle.assessment.coverage_basis_points == 0
    assert bundle.source_results[0].reason == (
        "source_content_prompt_injection_detected"
    )
    assert bundle.source_results[1].reason == (
        "source_not_modified_without_live_baseline"
    )


def test_metadata_failure_is_recorded_per_source_not_raised_as_success() -> None:
    malformed = FetchResponse(
        disposition=FetchDisposition.FETCHED,
        body="<html>no governed marker 18.07.2026</html>",
        fetched_at=NOW,
    )
    collector, _ = _collector((malformed, _success("official.mcx.opendata")))

    bundle = collector.collect()

    assert bundle.status is LiveCollectionStatus.PARTIAL
    assert bundle.source_results[0].status is LiveSourceResultStatus.FAILED
    assert bundle.source_results[0].reason == "source_required_marker_missing"
    assert len(bundle.observations) == 1


def test_collector_requires_exact_catalog_order_and_valid_repository_sha() -> None:
    catalog = _catalog()
    first, _ = _definition(catalog.sources[0], _success(catalog.sources[0].source_id))
    second, _ = _definition(catalog.sources[1], _success(catalog.sources[1].source_id))

    with pytest.raises(ValueError, match="source order exactly"):
        LiveSourceEvidenceCollector(
            catalog=catalog,
            definitions=(second, first),
            repository_sha=REPOSITORY_SHA,
        )
    with pytest.raises(ValueError, match="Git object id"):
        LiveSourceEvidenceCollector(
            catalog=catalog,
            definitions=(first, second),
            repository_sha="main",
        )


def test_bundle_and_result_invariants_reject_inconsistent_evidence() -> None:
    catalog = _catalog()
    collector, _ = _collector(
        (
            _success("official.cbr.key-rate"),
            _success("official.mcx.opendata"),
        )
    )
    valid = collector.collect()

    with pytest.raises(ValueError, match="inconsistent"):
        LiveEvidenceBundle(
            repository_sha=valid.repository_sha,
            catalog_sha256=valid.catalog_sha256,
            started_at=valid.started_at,
            completed_at=valid.completed_at,
            status=LiveCollectionStatus.PARTIAL,
            source_results=valid.source_results,
            assessment=valid.assessment,
        )
    with pytest.raises(ValueError, match="requires an observation"):
        LiveSourceResult(
            source_id=catalog.sources[0].source_id,
            status=LiveSourceResultStatus.OBSERVED,
            started_at=NOW,
            completed_at=NOW,
            reason="invalid",
            refresh_outcome=SourceRefreshOutcome.SUCCEEDED,
            observation=None,
        )
