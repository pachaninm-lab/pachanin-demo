from __future__ import annotations

import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from tai.source_coverage import (
    CoverageAssessment,
    CoverageRequirement,
    CoverageTopic,
    OfficialSourceCatalog,
    OfficialSourceCoverageAuthority,
    OfficialSourceDefinition,
    SourceFormat,
    SourceObservation,
    TopicCoverageStatus,
    assessment_payload,
    catalog_canonical_json,
    load_official_source_catalog,
    load_source_observations,
)
from tai.source_coverage_cli import main

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)
CONTENT_SHA = "a" * 64


def _repository_catalog_path() -> Path:
    return (
        Path(__file__).resolve().parents[1]
        / "knowledge-sources"
        / "official-sources.v1.json"
    )


def _observation(
    source_id: str,
    topics: frozenset[CoverageTopic],
    *,
    observed_at: datetime = NOW - timedelta(hours=1),
    latest_publication_at: datetime = NOW - timedelta(days=1),
    last_success_at: datetime = NOW - timedelta(hours=1),
    consecutive_failures: int = 0,
) -> SourceObservation:
    return SourceObservation(
        source_id=source_id,
        observed_at=observed_at,
        latest_publication_at=latest_publication_at,
        last_success_at=last_success_at,
        document_count=3,
        consecutive_failures=consecutive_failures,
        observed_topics=topics,
        content_sha256=CONTENT_SHA,
    )


def _healthy_repository_observations() -> tuple[SourceObservation, ...]:
    return (
        _observation(
            "official.mcx.opendata",
            frozenset({CoverageTopic.GRAIN_TRACEABILITY}),
        ),
        _observation(
            "official.rosstat.agriculture",
            frozenset(
                {
                    CoverageTopic.GRAIN_MARKET_PRICES,
                    CoverageTopic.AGRICULTURE_PRODUCTION,
                }
            ),
        ),
        _observation(
            "official.eec.grain-regulation",
            frozenset(
                {
                    CoverageTopic.GRAIN_REGULATION,
                    CoverageTopic.GRAIN_QUALITY,
                }
            ),
        ),
        _observation(
            "official.mintrans.rail-tariffs",
            frozenset({CoverageTopic.LOGISTICS_TARIFFS}),
        ),
        _observation(
            "official.cbr.key-rate",
            frozenset({CoverageTopic.FINANCE_RATES}),
        ),
    )


def test_repository_catalog_is_governed_but_exposes_agronomy_gap() -> None:
    catalog = load_official_source_catalog(_repository_catalog_path())

    assert len(catalog.sources) == 5
    assert len(catalog.requirements) == 8
    assert all(source.entrypoint_uri.startswith("https://") for source in catalog.sources)
    assert catalog.source_for("official.rosstat.agriculture") is not None
    assert catalog.source_for("missing") is None
    assert not any(
        CoverageTopic.AGRONOMY_RECOMMENDATIONS in source.topics
        for source in catalog.sources
    )
    canonical = catalog_canonical_json(catalog)
    assert canonical == catalog_canonical_json(catalog)
    assert "AGRONOMY_RECOMMENDATIONS" in canonical


def test_no_observations_are_unobserved_and_not_knowledge() -> None:
    catalog = load_official_source_catalog(_repository_catalog_path())

    assessment = OfficialSourceCoverageAuthority().assess(
        catalog=catalog,
        observations=(),
        now=NOW,
    )

    statuses = {topic.topic: topic.status for topic in assessment.topics}
    assert statuses[CoverageTopic.GRAIN_MARKET_PRICES] is TopicCoverageStatus.UNOBSERVED
    assert statuses[CoverageTopic.AGRONOMY_RECOMMENDATIONS] is TopicCoverageStatus.GAP
    assert assessment.coverage_basis_points == 0
    assert assessment.critical_coverage_basis_points == 0
    assert assessment.all_critical_covered is False
    assert len(assessment.assessment_sha256) == 64


def test_seven_observed_topics_produce_8750_and_keep_agronomy_gap() -> None:
    catalog = load_official_source_catalog(_repository_catalog_path())

    assessment = OfficialSourceCoverageAuthority().assess(
        catalog=catalog,
        observations=_healthy_repository_observations(),
        now=NOW,
    )

    by_topic = {topic.topic: topic for topic in assessment.topics}
    assert assessment.coverage_basis_points == 8_750
    assert assessment.critical_coverage_basis_points == 8_750
    assert assessment.all_critical_covered is False
    assert by_topic[CoverageTopic.GRAIN_MARKET_PRICES].status is TopicCoverageStatus.COVERED
    agronomy = by_topic[CoverageTopic.AGRONOMY_RECOMMENDATIONS]
    assert agronomy.status is TopicCoverageStatus.GAP
    assert agronomy.reasons == ("NO_REGISTERED_OFFICIAL_SOURCE",)
    payload = assessment_payload(assessment)
    assert payload["assessment_sha256"] == assessment.assessment_sha256
    assert len(payload["topics"]) == 8  # type: ignore[arg-type]


def _single_topic_catalog(*, minimum_sources: int = 1) -> OfficialSourceCatalog:
    source = OfficialSourceDefinition(
        source_id="official.example.market",
        owner="Official Example Authority",
        entrypoint_uri="https://data.example.gov/market",
        allowed_hosts=frozenset({"data.example.gov"}),
        topics=frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
        formats=frozenset({SourceFormat.JSON}),
        expected_update_interval=timedelta(days=7),
        maximum_publication_age=timedelta(days=31),
        verified_at=NOW - timedelta(days=1),
    )
    return OfficialSourceCatalog(
        sources=(source,),
        requirements=(
            CoverageRequirement(
                topic=CoverageTopic.GRAIN_MARKET_PRICES,
                minimum_official_sources=minimum_sources,
                maximum_publication_age=timedelta(days=31),
            ),
        ),
    )


def test_single_healthy_source_can_close_a_custom_critical_topic() -> None:
    catalog = _single_topic_catalog()
    observation = _observation(
        "official.example.market",
        frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
    )
    authority = OfficialSourceCoverageAuthority()

    first = authority.assess(catalog=catalog, observations=(observation,), now=NOW)
    second = authority.assess(catalog=catalog, observations=(observation,), now=NOW)

    assert first == second
    assert first.coverage_basis_points == 10_000
    assert first.critical_coverage_basis_points == 10_000
    assert first.all_critical_covered is True
    assert first.topics[0].healthy_source_ids == ("official.example.market",)


@pytest.mark.parametrize(
    ("observation", "expected_status", "expected_reason"),
    [
        (
            _observation(
                "official.example.market",
                frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
                latest_publication_at=NOW - timedelta(days=32),
            ),
            TopicCoverageStatus.STALE,
            "PUBLICATION_STALE:official.example.market",
        ),
        (
            _observation(
                "official.example.market",
                frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
                last_success_at=NOW - timedelta(days=8),
            ),
            TopicCoverageStatus.STALE,
            "OBSERVATION_STALE:official.example.market",
        ),
        (
            _observation(
                "official.example.market",
                frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
                consecutive_failures=1,
            ),
            TopicCoverageStatus.GAP,
            "SOURCE_FAILURES:official.example.market",
        ),
        (
            _observation(
                "official.example.market",
                frozenset({CoverageTopic.AGRICULTURE_PRODUCTION}),
            ),
            TopicCoverageStatus.GAP,
            "TOPIC_NOT_OBSERVED:official.example.market",
        ),
        (
            _observation(
                "official.example.market",
                frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
                observed_at=NOW + timedelta(minutes=6),
            ),
            TopicCoverageStatus.GAP,
            "OBSERVED_AT_FUTURE:official.example.market",
        ),
        (
            _observation(
                "official.example.market",
                frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
                latest_publication_at=NOW + timedelta(minutes=6),
            ),
            TopicCoverageStatus.GAP,
            "PUBLICATION_AT_FUTURE:official.example.market",
        ),
        (
            _observation(
                "official.example.market",
                frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
                last_success_at=NOW + timedelta(minutes=6),
            ),
            TopicCoverageStatus.GAP,
            "LAST_SUCCESS_AT_FUTURE:official.example.market",
        ),
    ],
)
def test_unhealthy_observations_fail_closed(
    observation: SourceObservation,
    expected_status: TopicCoverageStatus,
    expected_reason: str,
) -> None:
    assessment = OfficialSourceCoverageAuthority().assess(
        catalog=_single_topic_catalog(),
        observations=(observation,),
        now=NOW,
    )

    result = assessment.topics[0]
    assert result.status is expected_status
    assert expected_reason in result.reasons
    assert "INSUFFICIENT_HEALTHY_SOURCES:0/1" in result.reasons


def test_duplicate_observations_and_insufficient_source_policy_fail_closed() -> None:
    observation = _observation(
        "official.example.market",
        frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
    )

    duplicate = OfficialSourceCoverageAuthority().assess(
        catalog=_single_topic_catalog(),
        observations=(observation, replace(observation, document_count=4)),
        now=NOW,
    )
    insufficient = OfficialSourceCoverageAuthority().assess(
        catalog=_single_topic_catalog(minimum_sources=2),
        observations=(observation,),
        now=NOW,
    )

    assert duplicate.topics[0].status is TopicCoverageStatus.GAP
    assert "DUPLICATE_OBSERVATION:official.example.market" in duplicate.topics[0].reasons
    assert insufficient.topics[0].status is TopicCoverageStatus.GAP
    assert "INSUFFICIENT_HEALTHY_SOURCES:1/2" in insufficient.topics[0].reasons


def _write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_observation_loader_and_cli_assessment_are_fail_closed(tmp_path: Path) -> None:
    observations_path = tmp_path / "observations.json"
    _write_json(
        observations_path,
        {
            "schema_version": "tai.source-observations.v1",
            "observations": [],
        },
    )
    output = tmp_path / "assessment.json"

    observations = load_source_observations(observations_path)
    result = main(
        [
            "assess",
            str(_repository_catalog_path()),
            str(observations_path),
            "--at",
            NOW.isoformat(),
            "--output",
            str(output),
        ]
    )

    assert observations == ()
    assert result == 2
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["all_critical_covered"] is False
    assert payload["coverage_basis_points"] == 0


def test_cli_validates_catalog_without_claiming_coverage(tmp_path: Path) -> None:
    output = tmp_path / "catalog.json"

    result = main(
        [
            "validate-catalog",
            str(_repository_catalog_path()),
            "--output",
            str(output),
        ]
    )

    payload = json.loads(output.read_text(encoding="utf-8"))
    assert result == 0
    assert payload["status"] == "VALID"
    assert payload["source_count"] == 5
    assert payload["requirement_count"] == 8
    assert len(payload["catalog_sha256"]) == 64


@pytest.mark.parametrize(
    ("factory", "message"),
    [
        (
            lambda: OfficialSourceDefinition(
                source_id="official.bad",
                owner="Owner",
                entrypoint_uri="http://data.example.gov",
                allowed_hosts=frozenset({"data.example.gov"}),
                topics=frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
                formats=frozenset({SourceFormat.JSON}),
                expected_update_interval=timedelta(days=1),
                maximum_publication_age=timedelta(days=2),
                verified_at=NOW,
            ),
            "HTTPS",
        ),
        (
            lambda: OfficialSourceDefinition(
                source_id="official.bad",
                owner="Owner",
                entrypoint_uri="https://data.example.gov",
                allowed_hosts=frozenset({"other.example.gov"}),
                topics=frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
                formats=frozenset({SourceFormat.JSON}),
                expected_update_interval=timedelta(days=1),
                maximum_publication_age=timedelta(days=2),
                verified_at=NOW,
            ),
            "explicitly allowed",
        ),
        (
            lambda: CoverageRequirement(
                topic=CoverageTopic.GRAIN_MARKET_PRICES,
                minimum_official_sources=0,
                maximum_publication_age=timedelta(days=1),
            ),
            "minimum_official_sources",
        ),
        (
            lambda: SourceObservation(
                source_id="official.bad",
                observed_at=NOW,
                latest_publication_at=NOW,
                last_success_at=NOW,
                document_count=0,
                consecutive_failures=0,
                observed_topics=frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
                content_sha256=CONTENT_SHA,
            ),
            "document_count",
        ),
    ],
)
def test_invalid_source_policy_or_observation_is_rejected(
    factory: object,
    message: str,
) -> None:
    assert callable(factory)
    with pytest.raises(ValueError, match=message):
        factory()


def test_cli_invalid_datetime_and_invalid_json_return_two(tmp_path: Path) -> None:
    observations_path = tmp_path / "observations.json"
    observations_path.write_text("not-json", encoding="utf-8")
    output = tmp_path / "error.json"

    invalid_json = main(
        [
            "assess",
            str(_repository_catalog_path()),
            str(observations_path),
            "--at",
            NOW.isoformat(),
            "--output",
            str(output),
        ]
    )
    invalid_time = main(
        [
            "assess",
            str(_repository_catalog_path()),
            str(observations_path),
            "--at",
            "not-a-time",
            "--output",
            str(output),
        ]
    )

    assert invalid_json == 2
    assert invalid_time == 2
    assert json.loads(output.read_text(encoding="utf-8"))["status"] == "INVALID"


def test_assessment_type_is_stable() -> None:
    assessment = OfficialSourceCoverageAuthority().assess(
        catalog=_single_topic_catalog(),
        observations=(
            _observation(
                "official.example.market",
                frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
            ),
        ),
        now=NOW,
    )
    assert isinstance(assessment, CoverageAssessment)
