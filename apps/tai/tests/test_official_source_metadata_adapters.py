from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest

from tai.managed_loader import FetchDisposition, FetchRequest, FetchResponse, SourceFetcher
from tai.official_source_observation import (
    HTMLMetadataAdapter,
    MetadataExtractionError,
    OfficialObservationDefinition,
    OfficialObservationDefinitionRegistry,
    OfficialObservationRunEvidence,
    OfficialObservationRunStatus,
    default_html_metadata_adapters,
    definitions_from_catalog,
)
from tai.source_coverage import (
    CoverageRequirement,
    CoverageTopic,
    OfficialSourceCatalog,
    OfficialSourceDefinition,
    SourceFormat,
)

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)


class _Fetcher:
    def fetch(self, request: FetchRequest) -> FetchResponse:
        return FetchResponse(
            disposition=FetchDisposition.FETCHED,
            body=f"<html>{request.source_id}</html>",
            fetched_at=NOW,
        )


@dataclass(frozen=True, slots=True)
class _AdapterFixture:
    source: OfficialSourceDefinition
    body: str
    expected_date: datetime
    expected_count: int


def _source(
    *,
    source_id: str,
    topics: frozenset[CoverageTopic],
    uri: str,
    hosts: frozenset[str],
) -> OfficialSourceDefinition:
    return OfficialSourceDefinition(
        source_id=source_id,
        owner="Official Authority",
        entrypoint_uri=uri,
        allowed_hosts=hosts,
        topics=topics,
        formats=frozenset({SourceFormat.HTML}),
        expected_update_interval=timedelta(days=7),
        maximum_publication_age=timedelta(days=31),
        verified_at=NOW - timedelta(days=1),
    )


def _fixtures() -> dict[str, _AdapterFixture]:
    return {
        "official.cbr.key-rate": _AdapterFixture(
            source=_source(
                source_id="official.cbr.key-rate",
                topics=frozenset({CoverageTopic.FINANCE_RATES}),
                uri="https://www.cbr.ru/hd_base/KeyRate/",
                hosts=frozenset({"www.cbr.ru"}),
            ),
            body=(
                "<h1>Ключевая ставка</h1><table>"
                "<tr><td>18.07.2026</td></tr><tr><td>01.07.2026</td></tr></table>"
            ),
            expected_date=datetime(2026, 7, 18, tzinfo=UTC),
            expected_count=2,
        ),
        "official.rosstat.agriculture": _AdapterFixture(
            source=_source(
                source_id="official.rosstat.agriculture",
                topics=frozenset(
                    {
                        CoverageTopic.GRAIN_MARKET_PRICES,
                        CoverageTopic.AGRICULTURE_PRODUCTION,
                    }
                ),
                uri="https://rosstat.gov.ru/enterprise_economy",
                hosts=frozenset({"rosstat.gov.ru"}),
            ),
            body=(
                "<h1>Цены и производство сельского хозяйства</h1>"
                "<time>17 июля 2026</time>"
                "<a href='/files/agro.xlsx'>XLSX</a>"
                "<a href='/files/agro.zip'>ZIP</a>"
            ),
            expected_date=datetime(2026, 7, 17, tzinfo=UTC),
            expected_count=2,
        ),
        "official.eec.grain-regulation": _AdapterFixture(
            source=_source(
                source_id="official.eec.grain-regulation",
                topics=frozenset(
                    {CoverageTopic.GRAIN_REGULATION, CoverageTopic.GRAIN_QUALITY}
                ),
                uri=(
                    "https://eec.eaeunion.org/comission/department/deptexreg/tr/"
                    "bezpoZerna.php"
                ),
                hosts=frozenset({"eec.eaeunion.org"}),
            ),
            body=(
                "<h1>Технический регламент безопасности зерна</h1>"
                "<time>2026-07-16</time><a href='rules.pdf'>PDF</a>"
            ),
            expected_date=datetime(2026, 7, 16, tzinfo=UTC),
            expected_count=1,
        ),
        "official.mintrans.rail-tariffs": _AdapterFixture(
            source=_source(
                source_id="official.mintrans.rail-tariffs",
                topics=frozenset({CoverageTopic.LOGISTICS_TARIFFS}),
                uri="https://mintrans.gov.ru/activities/222/documents",
                hosts=frozenset({"mintrans.gov.ru"}),
            ),
            body=(
                "<time>15.07.2026</time>"
                "<h1>Тариф на железнодорожные перевозки</h1>"
                "<a href='/docs/tariff.pdf'>PDF</a>"
            ),
            expected_date=datetime(2026, 7, 15, tzinfo=UTC),
            expected_count=1,
        ),
        "official.mcx.opendata": _AdapterFixture(
            source=_source(
                source_id="official.mcx.opendata",
                topics=frozenset({CoverageTopic.GRAIN_TRACEABILITY}),
                uri="https://opendata.mcx.ru/",
                hosts=frozenset({"opendata.mcx.ru"}),
            ),
            body=(
                "<h1>Открытые данные по зерну</h1><time>14 июля 2026</time>"
                "<a href='/datasets/grain.csv'>CSV</a>"
                "<a href='https://evil.example/grain.csv'>untrusted</a>"
            ),
            expected_date=datetime(2026, 7, 14, tzinfo=UTC),
            expected_count=1,
        ),
    }


@pytest.mark.parametrize("adapter", default_html_metadata_adapters())
def test_each_adapter_extracts_only_trusted_deterministic_metadata(
    adapter: HTMLMetadataAdapter,
) -> None:
    fixture = _fixtures()[adapter.source_id]

    metadata = adapter.parse(
        source=fixture.source,
        body=fixture.body,
        fetched_at=NOW,
    )

    assert metadata.latest_publication_at == fixture.expected_date
    assert metadata.document_count == fixture.expected_count
    assert metadata.observed_topics == adapter.topics


def test_adapter_rejects_future_date_untrusted_only_links_and_wrong_identity() -> None:
    adapter = next(
        item
        for item in default_html_metadata_adapters()
        if item.source_id == "official.rosstat.agriculture"
    )
    source = _fixtures()[adapter.source_id].source
    future = (
        "<h1>Цены сельского хозяйства</h1><time>20.07.2026</time>"
        "<a href='/files/agro.xlsx'>XLSX</a>"
    )
    untrusted_only = (
        "<h1>Цены сельского хозяйства</h1><time>18.07.2026</time>"
        "<a href='https://evil.example/agro.xlsx'>XLSX</a>"
    )
    wrong_source = _fixtures()["official.cbr.key-rate"].source

    with pytest.raises(MetadataExtractionError, match="date_future"):
        adapter.parse(source=source, body=future, fetched_at=NOW)
    with pytest.raises(MetadataExtractionError, match="document_count_empty"):
        adapter.parse(source=source, body=untrusted_only, fetched_at=NOW)
    with pytest.raises(MetadataExtractionError, match="identity_mismatch"):
        adapter.parse(source=wrong_source, body=future, fetched_at=NOW)


def test_adapter_rejects_missing_marker_date_documents_and_topic_overreach() -> None:
    adapter = HTMLMetadataAdapter(
        source_id="official.cbr.key-rate",
        topics=frozenset({CoverageTopic.FINANCE_RATES}),
        required_marker_groups=(("ключевая ставка",),),
        document_suffixes=frozenset(),
        count_dates_as_documents=True,
    )
    source = _fixtures()[adapter.source_id].source
    with pytest.raises(MetadataExtractionError, match="marker_missing"):
        adapter.parse(source=source, body="<time>18.07.2026</time>", fetched_at=NOW)
    with pytest.raises(MetadataExtractionError, match="date_missing"):
        adapter.parse(source=source, body="Ключевая ставка", fetched_at=NOW)

    overreach = HTMLMetadataAdapter(
        source_id=adapter.source_id,
        topics=frozenset(
            {CoverageTopic.FINANCE_RATES, CoverageTopic.GRAIN_MARKET_PRICES}
        ),
        required_marker_groups=(("ключевая ставка",),),
        document_suffixes=frozenset(),
        count_dates_as_documents=True,
    )
    with pytest.raises(MetadataExtractionError, match="topic_scope"):
        overreach.parse(
            source=source,
            body="Ключевая ставка 18.07.2026",
            fetched_at=NOW,
        )


def test_registry_catalog_binding_and_evidence_digest_fail_closed() -> None:
    fixture = _fixtures()["official.cbr.key-rate"]
    fetcher = _Fetcher()
    adapter = next(
        item
        for item in default_html_metadata_adapters()
        if item.source_id == fixture.source.source_id
    )
    definition = OfficialObservationDefinition(
        source=fixture.source,
        adapter=adapter,
        fetcher=fetcher,
    )
    registry = OfficialObservationDefinitionRegistry((definition,))
    assert registry.resolve(fixture.source.source_id) is definition
    with pytest.raises(LookupError, match="unknown official observation source"):
        registry.resolve("official.unknown")
    with pytest.raises(ValueError, match="unique"):
        OfficialObservationDefinitionRegistry((definition, definition))

    catalog = OfficialSourceCatalog(
        sources=(fixture.source,),
        requirements=(
            CoverageRequirement(
                topic=CoverageTopic.FINANCE_RATES,
                minimum_official_sources=1,
                maximum_publication_age=timedelta(days=31),
            ),
        ),
    )
    fetchers: dict[str, SourceFetcher] = {fixture.source.source_id: fetcher}
    definitions = definitions_from_catalog(catalog=catalog, fetchers=fetchers)
    assert definitions[0].source.source_id == fixture.source.source_id
    with pytest.raises(ValueError, match="missing adapter or fetcher"):
        definitions_from_catalog(catalog=catalog, fetchers={})

    evidence = OfficialObservationRunEvidence(
        source_id=fixture.source.source_id,
        worker_id="worker-1",
        lease_token=UUID("00000000-0000-0000-0000-000000000001"),
        started_at=NOW,
        completed_at=NOW + timedelta(seconds=1),
        status=OfficialObservationRunStatus.FETCHED,
        reasons=("official_source_observed",),
        observation_sha256="a" * 64,
        content_sha256="b" * 64,
    )
    assert len(evidence.run_sha256) == 64
    assert evidence.run_sha256 == evidence.run_sha256
    with pytest.raises(ValueError, match="reasons"):
        OfficialObservationRunEvidence(
            source_id=evidence.source_id,
            worker_id=evidence.worker_id,
            lease_token=evidence.lease_token,
            started_at=NOW,
            completed_at=NOW,
            status=evidence.status,
            reasons=(),
            observation_sha256=None,
            content_sha256=None,
        )
