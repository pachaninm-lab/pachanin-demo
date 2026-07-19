from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from tai.official_source_metadata import (
    HTMLMetadataAdapter,
    MetadataExtractionError,
    default_html_metadata_adapters,
)
from tai.source_coverage import (
    CoverageTopic,
    OfficialSourceDefinition,
    SourceFormat,
)

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)


def _source() -> OfficialSourceDefinition:
    return OfficialSourceDefinition(
        source_id="official.mintrans.rail-tariffs",
        owner="Министерство транспорта Российской Федерации",
        entrypoint_uri="https://mintrans.gov.ru/activities/222/documents",
        allowed_hosts=frozenset({"mintrans.gov.ru"}),
        topics=frozenset({CoverageTopic.LOGISTICS_TARIFFS}),
        formats=frozenset({SourceFormat.HTML, SourceFormat.PDF}),
        expected_update_interval=timedelta(days=365),
        maximum_publication_age=timedelta(days=400),
        verified_at=NOW - timedelta(days=1),
    )


def _adapter() -> HTMLMetadataAdapter:
    return next(
        adapter
        for adapter in default_html_metadata_adapters()
        if adapter.source_id == "official.mintrans.rail-tariffs"
    )


def test_mintrans_counts_opaque_routes_and_uses_latest_tariff_date() -> None:
    body = """
    <html><body>
      <section>
        <time>20 Мая 2026</time>
        <h2>Протокол Совета по железнодорожному транспорту</h2>
        <a href="/file/600001">Список участников</a>
      </section>
      <section>
        <time>10 Декабря 2025</time>
        <h2>Протокол заседания Совета</h2>
        <a href="/file/590001">Приложения</a>
      </section>
      <section>
        <time>28 Ноября 2025</time>
        <h2>Приказ о Тарифной политике железных дорог</h2>
        <p>Перевозки грузов в международном сообщении на 2026 год.</p>
        <a href="/file/552015">Приказ в формате PDF</a>
        <a href="/file/552016">Приказ в формате DOC</a>
        <a href="/file/not-numeric">Не документ</a>
        <a href="https://evil.example/file/552017">Внешняя копия</a>
      </section>
    </body></html>
    """

    metadata = _adapter().parse(source=_source(), body=body, fetched_at=NOW)

    assert metadata.latest_publication_at == datetime(2025, 11, 28, tzinfo=UTC)
    assert metadata.document_count == 2
    assert metadata.observed_topics == frozenset({CoverageTopic.LOGISTICS_TARIFFS})


def test_mintrans_does_not_borrow_later_unrelated_document_date() -> None:
    body = """
    <h2>Тарифная политика железных дорог и перевозки грузов</h2>
    <a href="/file/552015">Тарифный документ без даты</a>
    <time>20 Мая 2026</time>
    <h2>Протокол Совета по железнодорожному транспорту</h2>
    <a href="/file/600001">Протокол</a>
    """

    with pytest.raises(MetadataExtractionError, match="publication_date_missing"):
        _adapter().parse(source=_source(), body=body, fetched_at=NOW)


def test_mintrans_rejects_future_tariff_date_with_valid_file_route() -> None:
    body = """
    <time>20 Июля 2026</time>
    <h2>Тарифная политика железных дорог</h2>
    <p>Перевозки грузов.</p>
    <a href="/file/552015">Документ</a>
    """

    with pytest.raises(MetadataExtractionError, match="publication_date_future"):
        _adapter().parse(source=_source(), body=body, fetched_at=NOW)


def test_document_path_patterns_are_validated_and_required() -> None:
    with pytest.raises(ValueError, match="valid regex"):
        HTMLMetadataAdapter(
            source_id="official.mintrans.rail-tariffs",
            topics=frozenset({CoverageTopic.LOGISTICS_TARIFFS}),
            required_marker_groups=(("тариф",),),
            document_suffixes=frozenset(),
            document_path_patterns=("[",),
        )

    with pytest.raises(ValueError, match="counting strategy"):
        HTMLMetadataAdapter(
            source_id="official.mintrans.rail-tariffs",
            topics=frozenset({CoverageTopic.LOGISTICS_TARIFFS}),
            required_marker_groups=(("тариф",),),
            document_suffixes=frozenset(),
        )
