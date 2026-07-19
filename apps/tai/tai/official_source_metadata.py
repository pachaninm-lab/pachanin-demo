from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta
from html.parser import HTMLParser
from typing import Protocol
from urllib.parse import urljoin, urlparse

from tai.source_coverage import (
    CoverageTopic,
    OfficialSourceDefinition,
)

_DATE_FUTURE_TOLERANCE = timedelta(minutes=5)
_ISO_DATE = re.compile(
    r"(?<!\d)(20\d{2})[-/.](0[1-9]|1[0-2])[-/.]([0-2]\d|3[01])(?!\d)"
)
_DMY_DATE = re.compile(
    r"(?<!\d)([0-2]?\d|3[01])[./-](0?\d|1[0-2])[./-](20\d{2})(?!\d)"
)
_RU_DATE = re.compile(
    r"(?<!\d)([0-2]?\d|3[01])\s+"
    r"(январ[ья]|феврал[ья]|марта|апрел[ья]|мая|июн[ья]|июл[ья]|августа|"
    r"сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья])\s+(20\d{2})(?!\d)",
    re.IGNORECASE,
)
_RU_MONTHS = {
    "января": 1,
    "январь": 1,
    "февраля": 2,
    "февраль": 2,
    "марта": 3,
    "апреля": 4,
    "апрель": 4,
    "мая": 5,
    "июня": 6,
    "июнь": 6,
    "июля": 7,
    "июль": 7,
    "августа": 8,
    "сентября": 9,
    "сентябрь": 9,
    "октября": 10,
    "октябрь": 10,
    "ноября": 11,
    "ноябрь": 11,
    "декабря": 12,
    "декабрь": 12,
}


class MetadataExtractionError(ValueError):
    def __init__(self, error_code: str) -> None:
        super().__init__(error_code)
        self.error_code = error_code


@dataclass(frozen=True, slots=True)
class OfficialSourceMetadata:
    latest_publication_at: datetime
    document_count: int
    observed_topics: frozenset[CoverageTopic]

    def __post_init__(self) -> None:
        _aware(self.latest_publication_at, "latest_publication_at")
        if self.document_count < 1:
            raise ValueError("document_count must be positive")
        if not self.observed_topics:
            raise ValueError("observed_topics must not be empty")


class OfficialMetadataAdapter(Protocol):
    @property
    def source_id(self) -> str: ...

    def parse(
        self,
        *,
        source: OfficialSourceDefinition,
        body: str,
        fetched_at: datetime,
    ) -> OfficialSourceMetadata: ...


@dataclass(frozen=True, slots=True)
class HTMLMetadataAdapter:
    source_id: str
    topics: frozenset[CoverageTopic]
    required_marker_groups: tuple[tuple[str, ...], ...]
    document_suffixes: frozenset[str]
    count_dates_as_documents: bool = False
    document_path_patterns: tuple[str, ...] = ()
    publication_marker_groups: tuple[tuple[str, ...], ...] = ()

    def __post_init__(self) -> None:
        if not self.source_id.strip():
            raise ValueError("adapter source_id must not be blank")
        if not self.topics:
            raise ValueError("adapter topics must not be empty")
        _validate_marker_groups(
            self.required_marker_groups,
            "adapter marker groups must not be empty",
        )
        if self.publication_marker_groups:
            _validate_marker_groups(
                self.publication_marker_groups,
                "publication marker groups must not be empty",
            )
        for pattern in self.document_path_patterns:
            if not pattern.strip():
                raise ValueError("document path pattern must not be blank")
            try:
                re.compile(pattern)
            except re.error as error:
                raise ValueError("document path pattern must be valid regex") from error
        if (
            not self.count_dates_as_documents
            and not self.document_suffixes
            and not self.document_path_patterns
        ):
            raise ValueError("adapter must define a document counting strategy")

    def parse(
        self,
        *,
        source: OfficialSourceDefinition,
        body: str,
        fetched_at: datetime,
    ) -> OfficialSourceMetadata:
        _aware(fetched_at, "fetched_at")
        if source.source_id != self.source_id:
            raise MetadataExtractionError("adapter_source_identity_mismatch")
        if not self.topics.issubset(source.topics):
            raise MetadataExtractionError("adapter_topic_scope_exceeds_catalog")
        normalized = unicodedata.normalize("NFKC", body).casefold()
        if not _marker_groups_match(normalized, self.required_marker_groups):
            raise MetadataExtractionError("source_required_marker_missing")

        parser = _HTMLSnapshotParser()
        try:
            parser.feed(body)
            parser.close()
        except Exception as error:
            raise MetadataExtractionError("source_html_parse_failed") from error

        text = "\n".join(parser.text_chunks)
        contextual_ranges = (
            _contextual_date_ranges(
                text,
                fetched_at,
                self.publication_marker_groups,
            )
            if self.publication_marker_groups
            else ()
        )
        dates = (
            tuple(sorted({value for _, _, value in contextual_ranges}))
            if self.publication_marker_groups
            else _extract_dates(text, fetched_at)
        )
        if not dates:
            raise MetadataExtractionError("source_publication_date_missing")
        latest_publication_at = max(dates)
        if latest_publication_at > fetched_at + _DATE_FUTURE_TOLERANCE:
            raise MetadataExtractionError("source_publication_date_future")

        if self.count_dates_as_documents:
            document_count = len(set(dates))
        else:
            document_count = len(
                {
                    url
                    for href, position in parser.links
                    if (
                        not contextual_ranges
                        or _position_in_ranges(position, contextual_ranges)
                    )
                    and (url := _trusted_document_url(source, href)) is not None
                    and _matches_document_locator(
                        url,
                        suffixes=self.document_suffixes,
                        path_patterns=self.document_path_patterns,
                    )
                }
            )
        if document_count < 1:
            raise MetadataExtractionError("source_document_count_empty")
        return OfficialSourceMetadata(
            latest_publication_at=latest_publication_at,
            document_count=document_count,
            observed_topics=self.topics,
        )


class _HTMLSnapshotParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text_chunks: list[str] = []
        self.links: list[tuple[str, int]] = []
        self._text_length = 0

    def handle_data(self, data: str) -> None:
        compact = " ".join(data.split())
        if compact:
            self.text_chunks.append(compact)
            self._text_length += len(compact) + 1

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        if tag.casefold() != "a":
            return
        href = next(
            (
                value
                for name, value in attrs
                if name.casefold() == "href" and value is not None
            ),
            None,
        )
        if href:
            self.links.append((href, self._text_length))


def default_html_metadata_adapters() -> tuple[HTMLMetadataAdapter, ...]:
    return (
        HTMLMetadataAdapter(
            source_id="official.cbr.key-rate",
            topics=frozenset({CoverageTopic.FINANCE_RATES}),
            required_marker_groups=(("ключевая ставка",),),
            document_suffixes=frozenset(),
            count_dates_as_documents=True,
        ),
        HTMLMetadataAdapter(
            source_id="official.rosstat.agriculture",
            topics=frozenset(
                {
                    CoverageTopic.GRAIN_MARKET_PRICES,
                    CoverageTopic.AGRICULTURE_PRODUCTION,
                }
            ),
            required_marker_groups=(("сельск",), ("цен", "производств")),
            document_suffixes=frozenset({".csv", ".pdf", ".xls", ".xlsx", ".zip"}),
        ),
        HTMLMetadataAdapter(
            source_id="official.eec.grain-regulation",
            topics=frozenset(
                {CoverageTopic.GRAIN_REGULATION, CoverageTopic.GRAIN_QUALITY}
            ),
            required_marker_groups=(("зерн",), ("техническ", "безопасност")),
            document_suffixes=frozenset({".pdf", ".doc", ".docx"}),
        ),
        HTMLMetadataAdapter(
            source_id="official.mintrans.rail-tariffs",
            topics=frozenset({CoverageTopic.LOGISTICS_TARIFFS}),
            required_marker_groups=(("тариф",), ("железнодорож", "перевоз")),
            document_suffixes=frozenset({".pdf", ".doc", ".docx", ".xls", ".xlsx"}),
            document_path_patterns=(r"/file/[0-9]+",),
            publication_marker_groups=(("тариф",), ("железнодорож", "перевоз")),
        ),
        HTMLMetadataAdapter(
            source_id="official.mcx.opendata",
            topics=frozenset({CoverageTopic.GRAIN_TRACEABILITY}),
            required_marker_groups=(("открыт", "зерн"),),
            document_suffixes=frozenset({".csv", ".json", ".xls", ".xlsx", ".zip"}),
        ),
    )


def _validate_marker_groups(
    groups: tuple[tuple[str, ...], ...],
    error_message: str,
) -> None:
    if not groups or any(
        not group or any(not marker.strip() for marker in group)
        for group in groups
    ):
        raise ValueError(error_message)


def _marker_groups_match(
    normalized_text: str,
    groups: tuple[tuple[str, ...], ...],
) -> bool:
    return all(
        any(marker.casefold() in normalized_text for marker in group)
        for group in groups
    )


def _extract_dates(text: str, reference: datetime) -> tuple[datetime, ...]:
    return tuple(
        sorted({value for _, value in _date_occurrences(text, reference)})
    )


def _contextual_date_ranges(
    text: str,
    reference: datetime,
    marker_groups: tuple[tuple[str, ...], ...],
) -> tuple[tuple[int, int, datetime], ...]:
    occurrences = _date_occurrences(text, reference)
    ranges: list[tuple[int, int, datetime]] = []
    for index, (position, value) in enumerate(occurrences):
        end = occurrences[index + 1][0] if index + 1 < len(occurrences) else len(text)
        segment = unicodedata.normalize("NFKC", text[position:end]).casefold()
        if _marker_groups_match(segment, marker_groups):
            ranges.append((position, end, value))
    return tuple(ranges)


def _position_in_ranges(
    position: int,
    ranges: tuple[tuple[int, int, datetime], ...],
) -> bool:
    return any(start <= position < end for start, end, _ in ranges)


def _date_occurrences(
    text: str,
    reference: datetime,
) -> tuple[tuple[int, datetime], ...]:
    _aware(reference, "reference")
    values: set[tuple[int, datetime]] = set()
    for match in _ISO_DATE.finditer(text):
        value = _date_value(
            int(match[1]),
            int(match[2]),
            int(match[3]),
            reference,
        )
        if value is not None:
            values.add((match.start(), value))
    for match in _DMY_DATE.finditer(text):
        value = _date_value(
            int(match[3]),
            int(match[2]),
            int(match[1]),
            reference,
        )
        if value is not None:
            values.add((match.start(), value))
    for match in _RU_DATE.finditer(text):
        month = _RU_MONTHS.get(match[2].casefold())
        if month is None:
            continue
        value = _date_value(int(match[3]), month, int(match[1]), reference)
        if value is not None:
            values.add((match.start(), value))
    return tuple(sorted(values, key=lambda item: (item[0], item[1])))


def _date_value(
    year: int,
    month: int,
    day: int,
    reference: datetime,
) -> datetime | None:
    try:
        return datetime(year, month, day, tzinfo=reference.tzinfo)
    except ValueError:
        return None


def _trusted_document_url(
    source: OfficialSourceDefinition,
    href: str,
) -> str | None:
    absolute = urljoin(source.entrypoint_uri, href)
    parsed = urlparse(absolute)
    if parsed.scheme != "https" or parsed.hostname not in source.allowed_hosts:
        return None
    if parsed.username or parsed.password or parsed.fragment:
        return None
    return absolute


def _matches_document_locator(
    url: str,
    *,
    suffixes: frozenset[str],
    path_patterns: tuple[str, ...],
) -> bool:
    path = urlparse(url).path.casefold()
    if any(path.endswith(suffix) for suffix in suffixes):
        return True
    return any(re.fullmatch(pattern, path) is not None for pattern in path_patterns)


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")
