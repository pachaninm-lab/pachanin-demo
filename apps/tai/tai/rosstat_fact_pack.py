from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from enum import StrEnum
from typing import Any

from psycopg.types.json import Jsonb

from tai.postgres_loader_state import ConnectionFactory
from tai.rosstat_vshp2016254 import (
    ATTRIBUTION,
    DATA_SHA256,
    DATA_URI,
    DATASET_CODE,
    HISTORICAL_LABEL,
    SOURCE_ID,
)

PACK_ID = "factpack.rosstat.7708234640-vshp2016254"
PACK_SCHEMA_VERSION = "tai.public-fact-pack.rosstat.v1"
MEASURE_CODE = "OBS_VALUE"
_SYNC_LOCK = "tai.fact-pack.rosstat.7708234640-vshp2016254.v1"
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_CODE = re.compile(r"^[A-Z][A-Z0-9_]{0,63}$")
_RAW_DECIMAL = re.compile(r"^[+-]?\d+(?:\.\d+)?$")
_DECIMAL = re.compile(r"^-?(?:0|[1-9]\d*)(?:\.\d+)?$")
_PARAGRAPH = re.compile(
    re.escape(HISTORICAL_LABEL)
    + r"\n"
    + re.escape(ATTRIBUTION)
    + r"\nОфициальный URI данных: (?P<source_uri>https://[^\n]+)"
    + r"\nURI структуры SDMX: https://[^\n]+"
    + r"\nДата публикации: (?P<publication_date>\d{4}-\d{2}-\d{2})"
    + r"\nПериод данных: (?P<period_start>\d{4}-\d{2}-\d{2}) — "
    + r"(?P<period_end>\d{4}-\d{2}-\d{2})"
    + r"\nSHA-256 исходного XML: (?P<data_sha256>[0-9a-f]{64})"
    + r"\nXPath: (?P<xpath>/[^\n]+)"
    + r"\nЗначение: (?P<value>[^\n]+)"
)
_SERIES_KEY = re.compile(
    r"/Series\[(?P<series>\d+)\]/SeriesKey\[1\]/Value\[(?P<entry>\d+)\]"
    r"/@(?P<field>concept|value)$"
)
_GENERIC_OBS = re.compile(
    r"/Series\[(?P<series>\d+)\]/Obs\[(?P<obs>\d+)\]/"
    r"(?P<field>ObsDimension|ObsValue)\[1\]/@value$"
)
_COMPACT_SERIES = re.compile(
    r"/Series\[(?P<series>\d+)\]/@(?P<code>[A-Za-z][A-Za-z0-9_]*)$"
)
_COMPACT_OBS = re.compile(
    r"/Series\[(?P<series>\d+)\]/Obs\[(?P<obs>\d+)\]/"
    r"@(?P<code>[A-Za-z][A-Za-z0-9_]*)$"
)

_MESSAGES = {
    "ru": {
        "supported": "Найдены точные структурированные исторические факты Росстата.",
        "abstained": "Подтверждённых структурированных фактов по запросу не найдено.",
        "limitation": (
            "Исторические данные Всероссийской сельскохозяйственной переписи "
            "2016 года; не являются текущими рыночными или хозяйственными данными."
        ),
    },
    "en": {
        "supported": "Exact structured historical Rosstat facts were found.",
        "abstained": "No confirmed structured facts were found for the query.",
        "limitation": (
            "Historical 2016 Russian agricultural census data; not current market "
            "data or current evidence about a specific farm."
        ),
    },
    "zh": {
        "supported": "已找到俄罗斯统计局的精确结构化历史事实。",
        "abstained": "未找到与该查询匹配的已确认结构化事实。",
        "limitation": "俄罗斯2016年农业普查历史数据；不是当前市场或特定农场的当前证据。",
    },
}


class FactQueryStatus(StrEnum):
    SUPPORTED = "SUPPORTED"
    ABSTAINED = "ABSTAINED"


@dataclass(frozen=True, slots=True)
class CorpusFactChunk:
    snapshot_id: int
    snapshot_sha256: str
    chunk_id: str
    artifact_sha256: str
    source_id: str
    source_uri: str
    chunk_text: str
    publication_date: date
    effective_date: date
    period_start: date
    period_end: date
    observed_at: datetime

    def __post_init__(self) -> None:
        if self.snapshot_id < 1:
            raise ValueError("snapshot_id must be positive")
        for label, digest in (
            ("snapshot_sha256", self.snapshot_sha256),
            ("chunk_id", self.chunk_id),
            ("artifact_sha256", self.artifact_sha256),
        ):
            if not _SHA256.fullmatch(digest):
                raise ValueError(f"{label} must be lowercase SHA-256")
        if self.source_id != SOURCE_ID:
            raise ValueError("unexpected fact-pack source")
        if self.source_uri != DATA_URI:
            raise ValueError("unexpected fact-pack source URI")
        if HISTORICAL_LABEL not in self.chunk_text:
            raise ValueError("historical limitation is missing")
        if self.effective_date < self.publication_date:
            raise ValueError("effective date precedes publication date")
        if self.period_end < self.period_start:
            raise ValueError("invalid fact period")
        _aware(self.observed_at)


@dataclass(frozen=True, slots=True)
class RosstatFact:
    fact_id: str
    source_snapshot_id: int
    source_snapshot_sha256: str
    artifact_sha256: str
    chunk_id: str
    source_uri: str
    xpath: str
    dimensions: tuple[tuple[str, str], ...]
    measure_code: str
    exact_value: str
    unit_code: str | None
    publication_date: date
    effective_date: date
    period_start: date
    period_end: date
    observed_at: datetime
    provenance_locators: tuple[str, ...]
    provenance_sha256: str

    def __post_init__(self) -> None:
        for label, digest in (
            ("fact_id", self.fact_id),
            ("source_snapshot_sha256", self.source_snapshot_sha256),
            ("artifact_sha256", self.artifact_sha256),
            ("chunk_id", self.chunk_id),
            ("provenance_sha256", self.provenance_sha256),
        ):
            if not _SHA256.fullmatch(digest):
                raise ValueError(f"{label} must be lowercase SHA-256")
        if self.source_snapshot_id < 1:
            raise ValueError("source_snapshot_id must be positive")
        if self.source_uri != DATA_URI:
            raise ValueError("fact source URI mismatch")
        if not self.xpath.startswith("/") or len(self.xpath) > 1024:
            raise ValueError("fact XPath is invalid")
        if self.measure_code != MEASURE_CODE:
            raise ValueError("unsupported measure code")
        if _canonical_decimal(self.exact_value) != self.exact_value:
            raise ValueError("fact value is not canonical decimal")
        if not self.dimensions:
            raise ValueError("fact dimensions must not be empty")
        if tuple(sorted(self.dimensions)) != self.dimensions:
            raise ValueError("fact dimensions must be sorted")
        if len({code for code, _ in self.dimensions}) != len(self.dimensions):
            raise ValueError("fact dimensions must be unique")
        for code, value in self.dimensions:
            if not _CODE.fullmatch(code) or not value or len(value) > 256:
                raise ValueError("fact dimension is invalid")
        if not self.provenance_locators or self.xpath not in self.provenance_locators:
            raise ValueError("fact provenance locators are incomplete")


@dataclass(frozen=True, slots=True)
class FactPackSyncResult:
    version_id: int
    previous_version_id: int | None
    created_version: bool
    manifest_sha256: str
    fact_count: int
    source_snapshot_id: int | None


@dataclass(frozen=True, slots=True)
class FactCitation:
    source_id: str
    source_uri: str
    artifact_sha256: str
    snapshot_id: int
    chunk_id: str
    xpath: str
    historical_limitation: str


@dataclass(frozen=True, slots=True)
class LocalizedFact:
    fact_id: str
    dimensions: tuple[tuple[str, str], ...]
    measure_code: str
    exact_value: str
    unit_code: str | None
    citation: FactCitation


@dataclass(frozen=True, slots=True)
class LocalizedFactResponse:
    locale: str
    status: FactQueryStatus
    message: str
    pack_id: str
    version_id: int | None
    query_sha256: str
    facts: tuple[LocalizedFact, ...]
    model_invoked: bool = False


@dataclass(frozen=True, slots=True)
class _SourceRecord:
    xpath: str
    value: str
    chunk: CorpusFactChunk


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("datetime must be timezone-aware")
    return value.astimezone(UTC)


def _canonical_decimal(raw: str) -> str:
    normalized = raw.strip()
    if len(normalized) > 256:
        raise ValueError("decimal value is too large")
    if not _RAW_DECIMAL.fullmatch(normalized):
        raise ValueError("fact measure is not a plain decimal")
    try:
        value = Decimal(normalized)
    except InvalidOperation as error:
        raise ValueError("fact measure is not an exact decimal") from error
    if not value.is_finite():
        raise ValueError("fact measure must be finite")
    rendered = format(value, "f")
    if "." in rendered:
        rendered = rendered.rstrip("0").rstrip(".")
    if rendered in {"-0", ""}:
        rendered = "0"
    if not _DECIMAL.fullmatch(rendered):
        raise ValueError("canonical decimal is invalid")
    digits = len(rendered.replace("-", "").replace(".", ""))
    if digits > 120:
        raise ValueError("decimal precision exceeds authority limit")
    return rendered


def _canonical_json(value: object) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def _digest(value: object) -> str:
    return hashlib.sha256(_canonical_json(value)).hexdigest()


def _source_records(chunks: Sequence[CorpusFactChunk]) -> tuple[_SourceRecord, ...]:
    if not chunks:
        return ()
    snapshot_ids = {chunk.snapshot_id for chunk in chunks}
    snapshot_digests = {chunk.snapshot_sha256 for chunk in chunks}
    artifact_digests = {chunk.artifact_sha256 for chunk in chunks}
    if len(snapshot_ids) != 1 or len(snapshot_digests) != 1:
        raise ValueError("mixed active corpus snapshots")
    if len(artifact_digests) != 1:
        raise ValueError("mixed Rosstat artifacts in one fact-pack materialization")

    records: list[_SourceRecord] = []
    seen: dict[str, str] = {}
    for chunk in sorted(chunks, key=lambda item: item.chunk_id):
        matches = tuple(_PARAGRAPH.finditer(chunk.chunk_text))
        if not matches:
            raise ValueError("chunk contains no complete governed Rosstat record")
        for match in matches:
            if match.group("source_uri") != DATA_URI:
                raise ValueError("record source URI mismatch")
            if match.group("data_sha256") != DATA_SHA256:
                raise ValueError("record raw XML digest mismatch")
            xpath = match.group("xpath").strip()
            value = " ".join(match.group("value").split())
            previous = seen.get(xpath)
            if previous is not None and previous != value:
                raise ValueError("conflicting duplicate XPath record")
            if previous is not None:
                continue
            seen[xpath] = value
            records.append(_SourceRecord(xpath=xpath, value=value, chunk=chunk))
    return tuple(sorted(records, key=lambda item: item.xpath))


def extract_rosstat_facts(chunks: Sequence[CorpusFactChunk]) -> tuple[RosstatFact, ...]:
    records = _source_records(chunks)
    if not records:
        return ()

    series_dimensions: dict[int, dict[str, tuple[str, str]]] = {}
    series_compact: dict[int, dict[str, tuple[str, str]]] = {}
    observations: dict[tuple[int, int], dict[str, _SourceRecord]] = {}

    generic_pairs: dict[tuple[int, int], dict[str, _SourceRecord]] = {}
    for record in records:
        match = _SERIES_KEY.search(record.xpath)
        if match:
            key = (int(match.group("series")), int(match.group("entry")))
            generic_pairs.setdefault(key, {})[match.group("field")] = record
            continue
        match = _GENERIC_OBS.search(record.xpath)
        if match:
            key = (int(match.group("series")), int(match.group("obs")))
            observations.setdefault(key, {})[match.group("field")] = record
            continue
        match = _COMPACT_OBS.search(record.xpath)
        if match:
            key = (int(match.group("series")), int(match.group("obs")))
            code = match.group("code").upper()
            field = "ObsValue" if code == MEASURE_CODE else code
            observations.setdefault(key, {})[field] = record
            continue
        match = _COMPACT_SERIES.search(record.xpath)
        if match:
            series = int(match.group("series"))
            code = match.group("code").upper()
            if code not in {MEASURE_CODE, "TIME_PERIOD"}:
                series_compact.setdefault(series, {})[code] = (
                    record.value,
                    record.xpath,
                )

    for (series, _entry), pair in sorted(generic_pairs.items()):
        if set(pair) != {"concept", "value"}:
            raise ValueError("incomplete SDMX series-key pair")
        code = pair["concept"].value.upper()
        value = pair["value"].value
        if not _CODE.fullmatch(code):
            raise ValueError("invalid SDMX dimension code")
        previous = series_dimensions.setdefault(series, {}).get(code)
        candidate = (value, pair["value"].xpath)
        if previous is not None and previous != candidate:
            raise ValueError("conflicting SDMX series dimension")
        series_dimensions[series][code] = candidate

    facts: list[RosstatFact] = []
    seen_fact_ids: set[str] = set()
    for (series, _obs), fields in sorted(observations.items()):
        value_record = fields.get("ObsValue")
        if value_record is None:
            continue
        dimensions: dict[str, tuple[str, str]] = {}
        dimensions.update(series_dimensions.get(series, {}))
        dimensions.update(series_compact.get(series, {}))

        time_record = fields.get("ObsDimension") or fields.get("TIME_PERIOD")
        if time_record is None:
            raise ValueError("observation time dimension is missing")
        dimensions["TIME_PERIOD"] = (time_record.value, time_record.xpath)
        if not dimensions:
            raise ValueError("observation dimensions are missing")

        exact_value = _canonical_decimal(value_record.value)
        unit_code = None
        for unit_dimension in ("UNIT_MEASURE", "UNIT", "UNIT_CODE"):
            if unit_dimension in dimensions:
                unit_code = dimensions[unit_dimension][0]
                break
        normalized_dimensions = tuple(
            sorted((code, value) for code, (value, _locator) in dimensions.items())
        )
        locators = tuple(
            sorted(
                {locator for _value, locator in dimensions.values()}
                | {value_record.xpath}
            )
        )
        chunk = value_record.chunk
        provenance_payload = {
            "schema": PACK_SCHEMA_VERSION,
            "source_id": SOURCE_ID,
            "source_uri": DATA_URI,
            "snapshot_id": chunk.snapshot_id,
            "snapshot_sha256": chunk.snapshot_sha256,
            "artifact_sha256": chunk.artifact_sha256,
            "chunk_id": chunk.chunk_id,
            "xpath": value_record.xpath,
            "locators": locators,
        }
        provenance_sha = _digest(provenance_payload)
        fact_payload = {
            **provenance_payload,
            "dimensions": normalized_dimensions,
            "measure_code": MEASURE_CODE,
            "exact_value": exact_value,
            "unit_code": unit_code,
            "publication_date": chunk.publication_date.isoformat(),
            "effective_date": chunk.effective_date.isoformat(),
            "period_start": chunk.period_start.isoformat(),
            "period_end": chunk.period_end.isoformat(),
        }
        fact_id = _digest(fact_payload)
        if fact_id in seen_fact_ids:
            raise ValueError("duplicate fact identity")
        seen_fact_ids.add(fact_id)
        facts.append(
            RosstatFact(
                fact_id=fact_id,
                source_snapshot_id=chunk.snapshot_id,
                source_snapshot_sha256=chunk.snapshot_sha256,
                artifact_sha256=chunk.artifact_sha256,
                chunk_id=chunk.chunk_id,
                source_uri=DATA_URI,
                xpath=value_record.xpath,
                dimensions=normalized_dimensions,
                measure_code=MEASURE_CODE,
                exact_value=exact_value,
                unit_code=unit_code,
                publication_date=chunk.publication_date,
                effective_date=chunk.effective_date,
                period_start=chunk.period_start,
                period_end=chunk.period_end,
                observed_at=_aware(chunk.observed_at),
                provenance_locators=locators,
                provenance_sha256=provenance_sha,
            )
        )
    if records and not facts:
        raise ValueError("no governed numeric observations found")
    return tuple(sorted(facts, key=lambda item: item.fact_id))


def canonical_fact_pack_manifest(facts: Sequence[RosstatFact]) -> str:
    return _digest(
        {
            "schema": PACK_SCHEMA_VERSION,
            "pack_id": PACK_ID,
            "source_id": SOURCE_ID,
            "dataset_code": DATASET_CODE,
            "facts": [
                {
                    "fact_id": fact.fact_id,
                    "snapshot_id": fact.source_snapshot_id,
                    "snapshot_sha256": fact.source_snapshot_sha256,
                    "artifact_sha256": fact.artifact_sha256,
                    "chunk_id": fact.chunk_id,
                    "xpath": fact.xpath,
                    "dimensions": fact.dimensions,
                    "measure_code": fact.measure_code,
                    "exact_value": fact.exact_value,
                    "unit_code": fact.unit_code,
                    "provenance_sha256": fact.provenance_sha256,
                }
                for fact in sorted(facts, key=lambda item: item.fact_id)
            ],
        }
    )


class RosstatFactPackSynchronizer:
    """Materialize one admitted Rosstat snapshot into durable exact fact authority."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def sync(
        self,
        *,
        now: datetime,
        actor_id: str = "tai-ap14f2a",
        reason_code: str = "FACT_PACK_SYNC",
    ) -> FactPackSyncResult:
        observed = _aware(now)
        actor = actor_id.strip()
        reason = reason_code.strip().upper()
        if not actor or not _CODE.fullmatch(reason):
            raise ValueError("audit actor or reason is invalid")

        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                        (_SYNC_LOCK,),
                    )
                    self._ensure_definition(cursor, observed)
                    current = self._active_version(cursor)
                    chunks = self._active_chunks(cursor, observed)
                    facts = extract_rosstat_facts(chunks)
                    manifest = canonical_fact_pack_manifest(facts)
                    if current is not None and current["manifest_sha256"] == manifest:
                        connection.commit()
                        return FactPackSyncResult(
                            version_id=int(current["version_id"]),
                            previous_version_id=int(current["version_id"]),
                            created_version=False,
                            manifest_sha256=manifest,
                            fact_count=len(facts),
                            source_snapshot_id=(
                                None if not facts else facts[0].source_snapshot_id
                            ),
                        )

                    snapshot_ids = {fact.source_snapshot_id for fact in facts}
                    snapshot_digests = {fact.source_snapshot_sha256 for fact in facts}
                    if len(snapshot_ids) > 1 or len(snapshot_digests) > 1:
                        raise RuntimeError("mixed source snapshots in desired fact pack")
                    source_snapshot_id = None if not facts else next(iter(snapshot_ids))
                    source_snapshot_sha256 = (
                        None if not facts else next(iter(snapshot_digests))
                    )
                    dimension_codes = sorted(
                        {code for fact in facts for code, _value in fact.dimensions}
                    )
                    cursor.execute(
                        """
                        INSERT INTO tai_public_fact_pack_versions (
                            pack_id, manifest_sha256, source_snapshot_id,
                            source_snapshot_sha256, status, fact_count,
                            dimension_codes, created_at
                        ) VALUES (%s, %s, %s, %s, 'BUILDING', %s, %s, %s)
                        RETURNING version_id
                        """,
                        (
                            PACK_ID,
                            manifest,
                            source_snapshot_id,
                            source_snapshot_sha256,
                            len(facts),
                            Jsonb(dimension_codes),
                            observed,
                        ),
                    )
                    row = cursor.fetchone()
                    if row is None:
                        raise RuntimeError("fact-pack version insert returned no row")
                    version_id = int(row["version_id"])
                    self._insert_facts(cursor, version_id, facts)
                    cursor.execute(
                        "SELECT tai_activate_public_fact_pack_version(%s)",
                        (version_id,),
                    )
                    cursor.fetchone()
                    activated = self._active_version(cursor)
                    if activated is None or int(activated["version_id"]) != version_id:
                        raise RuntimeError("fact-pack activation did not become authoritative")
                    payload = {
                        "pack_id": PACK_ID,
                        "version_id": version_id,
                        "manifest_sha256": manifest,
                        "fact_count": len(facts),
                        "source_snapshot_id": source_snapshot_id,
                    }
                    payload_sha = _digest(payload)
                    event_sha = _digest(
                        {
                            "schema": "tai.public-fact-pack.audit.v1",
                            "event_type": "VERSION_ACTIVATED",
                            "actor_id": actor,
                            "reason_code": reason,
                            "created_at": observed.isoformat(),
                            "payload_sha256": payload_sha,
                        }
                    )
                    cursor.execute(
                        """
                        INSERT INTO tai_public_fact_pack_audit (
                            event_sha256, event_type, pack_id, version_id,
                            manifest_sha256, actor_id, reason_code,
                            payload_sha256, created_at
                        ) VALUES (%s, 'VERSION_ACTIVATED', %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            event_sha,
                            PACK_ID,
                            version_id,
                            manifest,
                            actor,
                            reason,
                            payload_sha,
                            observed,
                        ),
                    )
                connection.commit()
            except Exception:
                connection.rollback()
                raise

        return FactPackSyncResult(
            version_id=version_id,
            previous_version_id=(
                None if current is None else int(current["version_id"])
            ),
            created_version=True,
            manifest_sha256=manifest,
            fact_count=len(facts),
            source_snapshot_id=source_snapshot_id,
        )

    @staticmethod
    def _ensure_definition(cursor: Any, now: datetime) -> None:
        cursor.execute(
            """
            INSERT INTO tai_public_fact_pack_definitions (
                pack_id, source_id, dataset_code, schema_version,
                measure_codes, supported_locales, status, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, 'ACTIVE', %s
            )
            ON CONFLICT (pack_id) DO NOTHING
            """,
            (
                PACK_ID,
                SOURCE_ID,
                DATASET_CODE,
                PACK_SCHEMA_VERSION,
                Jsonb([MEASURE_CODE]),
                Jsonb(sorted(_MESSAGES)),
                now,
            ),
        )
        cursor.execute(
            """
            SELECT source_id, dataset_code, schema_version, measure_codes,
                   supported_locales, status
            FROM tai_public_fact_pack_definitions
            WHERE pack_id = %s
            """,
            (PACK_ID,),
        )
        row = cursor.fetchone()
        if row is None or (
            str(row["source_id"]) != SOURCE_ID
            or str(row["dataset_code"]) != DATASET_CODE
            or str(row["schema_version"]) != PACK_SCHEMA_VERSION
            or list(row["measure_codes"]) != [MEASURE_CODE]
            or sorted(str(item) for item in row["supported_locales"]) != sorted(_MESSAGES)
            or str(row["status"]) != "ACTIVE"
        ):
            raise RuntimeError("fact-pack definition conflicts with immutable authority")

    @staticmethod
    def _active_version(cursor: Any) -> Mapping[str, Any] | None:
        cursor.execute(
            """
            SELECT version_id, manifest_sha256, source_snapshot_id, fact_count,
                   dimension_codes
            FROM tai_public_fact_pack_versions
            WHERE pack_id = %s AND status = 'ACTIVE'
            ORDER BY version_id
            FOR UPDATE
            """,
            (PACK_ID,),
        )
        rows = _all_rows(cursor)
        if len(rows) > 1:
            raise RuntimeError("multiple active fact-pack versions detected")
        return None if not rows else rows[0]

    @staticmethod
    def _active_chunks(cursor: Any, now: datetime) -> tuple[CorpusFactChunk, ...]:
        cursor.execute(
            """
            SELECT
                chunk.snapshot_id,
                snapshot.snapshot_sha256,
                chunk.chunk_id,
                chunk.artifact_sha256,
                chunk.source_id,
                artifact.official_uri AS source_uri,
                chunk.chunk_text,
                artifact.publication_date,
                artifact.effective_date,
                artifact.period_start,
                artifact.period_end,
                artifact.observed_at
            FROM tai_active_public_corpus_chunks_v1 AS chunk
            JOIN tai_public_corpus_snapshots AS snapshot
              ON snapshot.snapshot_id = chunk.snapshot_id
             AND snapshot.status = 'ACTIVE'
            JOIN tai_public_corpus_artifacts AS artifact
              ON artifact.artifact_sha256 = chunk.artifact_sha256
             AND artifact.source_id = chunk.source_id
             AND artifact.status = 'ADMITTED'
            JOIN tai_public_corpus_source_admissions AS admission
              ON admission.source_id = chunk.source_id
             AND admission.status = 'ADMITTED'
            WHERE chunk.source_id = %s
              AND chunk.valid_until > %s
              AND artifact.freshness_due_at > %s
              AND admission.rights_review_due_at > %s
            ORDER BY chunk.snapshot_id, chunk.ordinal, chunk.chunk_id
            """,
            (SOURCE_ID, now, now, now),
        )
        rows = _all_rows(cursor)
        return tuple(
            CorpusFactChunk(
                snapshot_id=int(row["snapshot_id"]),
                snapshot_sha256=str(row["snapshot_sha256"]),
                chunk_id=str(row["chunk_id"]),
                artifact_sha256=str(row["artifact_sha256"]),
                source_id=str(row["source_id"]),
                source_uri=str(row["source_uri"]),
                chunk_text=str(row["chunk_text"]),
                publication_date=row["publication_date"],
                effective_date=row["effective_date"],
                period_start=row["period_start"],
                period_end=row["period_end"],
                observed_at=row["observed_at"],
            )
            for row in rows
        )

    @staticmethod
    def _insert_facts(
        cursor: Any, version_id: int, facts: Sequence[RosstatFact]
    ) -> None:
        query = """
            INSERT INTO tai_public_fact_pack_facts (
                version_id, fact_id, source_id, source_snapshot_id,
                source_snapshot_sha256, artifact_sha256, chunk_id,
                source_uri, xpath, dimensions, measure_code,
                exact_value, exact_value_text, unit_code,
                publication_date, effective_date, period_start,
                period_end, observed_at, provenance_locators,
                provenance_sha256
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """
        for fact in facts:
            cursor.execute(
                query,
                (
                    version_id,
                    fact.fact_id,
                    SOURCE_ID,
                    fact.source_snapshot_id,
                    fact.source_snapshot_sha256,
                    fact.artifact_sha256,
                    fact.chunk_id,
                    fact.source_uri,
                    fact.xpath,
                    Jsonb(dict(fact.dimensions)),
                    fact.measure_code,
                    Decimal(fact.exact_value),
                    fact.exact_value,
                    fact.unit_code,
                    fact.publication_date,
                    fact.effective_date,
                    fact.period_start,
                    fact.period_end,
                    fact.observed_at,
                    Jsonb(list(fact.provenance_locators)),
                    fact.provenance_sha256,
                ),
            )


class RosstatFactPackService:
    """Bounded model-free exact query service for the active fact-pack version."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def query(
        self,
        *,
        locale: str,
        dimensions: Mapping[str, str],
        measure_code: str = MEASURE_CODE,
        limit: int = 50,
    ) -> LocalizedFactResponse:
        normalized_locale = locale.strip().lower()
        if normalized_locale not in _MESSAGES:
            raise ValueError("unsupported locale")
        if measure_code.strip().upper() != MEASURE_CODE:
            raise ValueError("unsupported measure")
        if not dimensions:
            raise ValueError("ambiguous fact query requires at least one dimension")
        if limit < 1 or limit > 100:
            raise ValueError("fact query limit is out of bounds")
        normalized_dimensions: dict[str, str] = {}
        for raw_code, raw_value in dimensions.items():
            code = raw_code.strip().upper()
            value = " ".join(raw_value.split())
            if not _CODE.fullmatch(code) or not value or len(value) > 256:
                raise ValueError("invalid dimension filter")
            normalized_dimensions[code] = value

        query_sha = _digest(
            {
                "schema": "tai.public-fact-pack.query.v1",
                "pack_id": PACK_ID,
                "locale": normalized_locale,
                "measure_code": MEASURE_CODE,
                "dimensions": sorted(normalized_dimensions.items()),
                "limit": limit,
            }
        )
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT version_id, fact_count, dimension_codes
                        FROM tai_public_fact_pack_versions
                        WHERE pack_id = %s AND status = 'ACTIVE'
                        ORDER BY version_id
                        """,
                        (PACK_ID,),
                    )
                    versions = _all_rows(cursor)
                    if len(versions) > 1:
                        raise RuntimeError("multiple active fact-pack versions detected")
                    if not versions:
                        connection.commit()
                        return self._response(
                            locale=normalized_locale,
                            query_sha=query_sha,
                            version_id=None,
                            facts=(),
                        )
                    version_id = int(versions[0]["version_id"])
                    if int(versions[0]["fact_count"]) == 0:
                        connection.commit()
                        return self._response(
                            locale=normalized_locale,
                            query_sha=query_sha,
                            version_id=version_id,
                            facts=(),
                        )
                    dimension_codes = {
                        str(item) for item in versions[0]["dimension_codes"]
                    }
                    unknown = sorted(set(normalized_dimensions) - dimension_codes)
                    if unknown:
                        raise ValueError(
                            "unknown fact dimension: " + ",".join(unknown)
                        )
                    for code, value in sorted(normalized_dimensions.items()):
                        cursor.execute(
                            """
                            SELECT 1
                            FROM tai_public_fact_pack_facts
                            WHERE version_id = %s
                              AND dimensions ->> %s = %s
                            LIMIT 1
                            """,
                            (version_id, code, value),
                        )
                        if cursor.fetchone() is None:
                            raise ValueError(f"unknown fact dimension value: {code}")

                    cursor.execute(
                        """
                        SELECT
                            fact_id, source_snapshot_id, artifact_sha256,
                            chunk_id, source_uri, xpath, dimensions,
                            measure_code, exact_value_text, unit_code
                        FROM tai_active_public_fact_pack_facts_v1
                        WHERE pack_id = %s
                          AND measure_code = %s
                          AND dimensions @> %s
                        ORDER BY fact_id
                        LIMIT %s
                        """,
                        (
                            PACK_ID,
                            MEASURE_CODE,
                            Jsonb(normalized_dimensions),
                            limit,
                        ),
                    )
                    rows = _all_rows(cursor)
                connection.commit()
            except Exception:
                connection.rollback()
                raise

        facts = tuple(
            LocalizedFact(
                fact_id=str(row["fact_id"]),
                dimensions=tuple(
                    sorted(
                        (str(code), str(value))
                        for code, value in row["dimensions"].items()
                    )
                ),
                measure_code=str(row["measure_code"]),
                exact_value=str(row["exact_value_text"]),
                unit_code=(
                    None if row["unit_code"] is None else str(row["unit_code"])
                ),
                citation=FactCitation(
                    source_id=SOURCE_ID,
                    source_uri=str(row["source_uri"]),
                    artifact_sha256=str(row["artifact_sha256"]),
                    snapshot_id=int(row["source_snapshot_id"]),
                    chunk_id=str(row["chunk_id"]),
                    xpath=str(row["xpath"]),
                    historical_limitation=_MESSAGES[normalized_locale]["limitation"],
                ),
            )
            for row in rows
        )
        return self._response(
            locale=normalized_locale,
            query_sha=query_sha,
            version_id=version_id,
            facts=facts,
        )

    @staticmethod
    def _response(
        *,
        locale: str,
        query_sha: str,
        version_id: int | None,
        facts: tuple[LocalizedFact, ...],
    ) -> LocalizedFactResponse:
        status = (
            FactQueryStatus.SUPPORTED if facts else FactQueryStatus.ABSTAINED
        )
        message_key = "supported" if facts else "abstained"
        return LocalizedFactResponse(
            locale=locale,
            status=status,
            message=_MESSAGES[locale][message_key],
            pack_id=PACK_ID,
            version_id=version_id,
            query_sha256=query_sha,
            facts=facts,
            model_invoked=False,
        )


def _all_rows(cursor: Any) -> tuple[Mapping[str, Any], ...]:
    rows: list[Mapping[str, Any]] = []
    while True:
        row = cursor.fetchone()
        if row is None:
            return tuple(rows)
        rows.append(row)
