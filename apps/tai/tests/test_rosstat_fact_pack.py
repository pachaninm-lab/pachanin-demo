from __future__ import annotations

from dataclasses import replace
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from tai.rosstat_fact_pack import (
    MEASURE_CODE,
    PACK_ID,
    CorpusFactChunk,
    FactQueryStatus,
    RosstatFactPackService,
    _canonical_decimal,
    canonical_fact_pack_manifest,
    extract_rosstat_facts,
)
from tai.rosstat_vshp2016254 import (
    ATTRIBUTION,
    DATA_SHA256,
    DATA_URI,
    HISTORICAL_LABEL,
    SOURCE_ID,
)

NOW = datetime(2026, 7, 29, 12, 0, tzinfo=UTC)
SNAPSHOT_SHA = "b" * 64
ARTIFACT_SHA = "a" * 64


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


def _chunk(ordinal: int, xpath: str, value: str) -> CorpusFactChunk:
    return CorpusFactChunk(
        snapshot_id=7,
        snapshot_sha256=SNAPSHOT_SHA,
        chunk_id=f"{ordinal + 1:064x}",
        artifact_sha256=ARTIFACT_SHA,
        source_id=SOURCE_ID,
        source_uri=DATA_URI,
        chunk_text=_paragraph(xpath, value),
        publication_date=date(2018, 12, 11),
        effective_date=date(2018, 12, 11),
        period_start=date(2016, 1, 1),
        period_end=date(2016, 12, 31),
        observed_at=NOW,
    )


def _generic_chunks(value: str = "00123.4500") -> tuple[CorpusFactChunk, ...]:
    prefix = "/GenericData[1]/DataSet[1]/Series[1]"
    return (
        _chunk(0, f"{prefix}/SeriesKey[1]/Value[1]/@concept", "TERRITOR"),
        _chunk(1, f"{prefix}/SeriesKey[1]/Value[1]/@value", "RU"),
        _chunk(2, f"{prefix}/SeriesKey[1]/Value[2]/@concept", "UNIT_MEASURE"),
        _chunk(3, f"{prefix}/SeriesKey[1]/Value[2]/@value", "HECTARE"),
        _chunk(4, f"{prefix}/Obs[1]/ObsDimension[1]/@value", "2016"),
        _chunk(5, f"{prefix}/Obs[1]/ObsValue[1]/@value", value),
    )


def test_extracts_deterministic_generic_sdmx_fact() -> None:
    facts = extract_rosstat_facts(_generic_chunks())

    assert len(facts) == 1
    fact = facts[0]
    assert fact.measure_code == MEASURE_CODE
    assert fact.exact_value == "123.45"
    assert Decimal(fact.exact_value) == Decimal("123.45")
    assert fact.unit_code == "HECTARE"
    assert fact.dimensions == (
        ("TERRITOR", "RU"),
        ("TIME_PERIOD", "2016"),
        ("UNIT_MEASURE", "HECTARE"),
    )
    assert fact.source_snapshot_id == 7
    assert fact.source_uri == DATA_URI
    assert fact.xpath.endswith("/ObsValue[1]/@value")
    assert fact.xpath in fact.provenance_locators

    shuffled = tuple(reversed(_generic_chunks()))
    replay = extract_rosstat_facts(shuffled)
    assert replay == facts
    assert canonical_fact_pack_manifest(replay) == canonical_fact_pack_manifest(facts)


def test_extracts_compact_sdmx_and_canonicalizes_negative_zero() -> None:
    prefix = "/CompactData[1]/DataSet[1]/Series[2]"
    chunks = (
        _chunk(0, f"{prefix}/@TERRITOR", "RU"),
        _chunk(1, f"{prefix}/@UNIT_MEASURE", "HECTARE"),
        _chunk(2, f"{prefix}/Obs[3]/@TIME_PERIOD", "2016"),
        _chunk(3, f"{prefix}/Obs[3]/@OBS_VALUE", "-0.0000"),
    )

    fact = extract_rosstat_facts(chunks)[0]

    assert fact.exact_value == "0"
    assert fact.dimensions == (
        ("TERRITOR", "RU"),
        ("TIME_PERIOD", "2016"),
        ("UNIT_MEASURE", "HECTARE"),
    )


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1", "1"),
        ("001.2300", "1.23"),
        ("-0", "0"),
        ("0.00000100", "0.000001"),
        ("100000000000000000000.00", "100000000000000000000"),
    ],
)
def test_decimal_authority_is_exact(raw: str, expected: str) -> None:
    assert _canonical_decimal(raw) == expected


@pytest.mark.parametrize("raw", ["NaN", "Infinity", "1e3", "", "abc", "1,5"])
def test_decimal_authority_rejects_noncanonical_or_nonfinite(raw: str) -> None:
    with pytest.raises(ValueError):
        _canonical_decimal(raw)


def test_fact_materialization_fails_closed() -> None:
    with pytest.raises(ValueError, match="decimal"):
        extract_rosstat_facts(_generic_chunks("not-a-number"))

    incomplete = _generic_chunks()[:-1]
    with pytest.raises(ValueError, match="no governed numeric"):
        extract_rosstat_facts(incomplete)

    wrong_source = _chunk(0, "/Series[1]/@TERRITOR", "RU")
    with pytest.raises(ValueError, match="unexpected fact-pack source"):
        replace(wrong_source, source_id="official.other.source")

    duplicate = list(_generic_chunks())
    duplicate_xpath = duplicate[-1].chunk_text.split("XPath: ", 1)[1].splitlines()[0]
    duplicate.append(_chunk(8, duplicate_xpath, "999"))
    with pytest.raises(ValueError, match="conflicting duplicate"):
        extract_rosstat_facts(tuple(duplicate))


def test_pack_identity_is_source_specific() -> None:
    assert PACK_ID == "factpack.rosstat.7708234640-vshp2016254"
    assert PACK_ID.endswith("7708234640-vshp2016254")


def test_localized_response_contract_is_model_free() -> None:
    facts = extract_rosstat_facts(_generic_chunks())
    row = facts[0]

    class Cursor:
        def __init__(self) -> None:
            self.rows: list[dict[str, object]] = []

        def __enter__(self) -> Cursor:
            return self

        def __exit__(self, *_args: object) -> bool:
            return False

        def execute(self, query: str, params: tuple[object, ...]) -> None:
            normalized = " ".join(query.split()).casefold()
            if "from tai_public_fact_pack_versions" in normalized:
                self.rows = [
                    {
                        "version_id": 9,
                        "fact_count": 1,
                        "dimension_codes": [
                            "TERRITOR",
                            "TIME_PERIOD",
                            "UNIT_MEASURE",
                        ],
                    }
                ]
            elif "select 1 from tai_public_fact_pack_facts" in normalized:
                self.rows = [{"?column?": 1}]
            elif "from tai_active_public_fact_pack_facts_v1" in normalized:
                self.rows = [
                    {
                        "fact_id": row.fact_id,
                        "source_snapshot_id": row.source_snapshot_id,
                        "artifact_sha256": row.artifact_sha256,
                        "chunk_id": row.chunk_id,
                        "source_uri": row.source_uri,
                        "xpath": row.xpath,
                        "dimensions": dict(row.dimensions),
                        "measure_code": row.measure_code,
                        "exact_value_text": row.exact_value,
                        "unit_code": row.unit_code,
                    }
                ]
            else:
                raise AssertionError(normalized)

        def fetchone(self) -> dict[str, object] | None:
            return None if not self.rows else self.rows.pop(0)

    class Connection:
        def cursor(self) -> Cursor:
            return Cursor()

        def commit(self) -> None:
            pass

        def rollback(self) -> None:
            pass

    class Factory:
        def __enter__(self) -> Connection:
            return Connection()

        def __exit__(self, *_args: object) -> bool:
            return False

    def factory() -> Factory:
        return Factory()

    service = RosstatFactPackService(factory)  # type: ignore[arg-type]
    identities = []
    for locale in ("ru", "en", "zh"):
        response = service.query(
            locale=locale,
            dimensions={"TERRITOR": "RU", "TIME_PERIOD": "2016"},
        )
        assert response.status is FactQueryStatus.SUPPORTED
        assert response.model_invoked is False
        assert response.facts[0].exact_value == "123.45"
        assert response.facts[0].citation.source_uri == DATA_URI
        identities.append(response.facts[0].fact_id)
    assert len(set(identities)) == 1

    with pytest.raises(ValueError, match="unsupported locale"):
        service.query(locale="de", dimensions={"TERRITOR": "RU"})
    with pytest.raises(ValueError, match="ambiguous"):
        service.query(locale="ru", dimensions={})
