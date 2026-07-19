from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from html.parser import HTMLParser
from typing import Protocol
from urllib.parse import urljoin, urlparse
from uuid import UUID

from tai.loader_state import (
    LoaderLease,
    LoaderRunStatus,
    LoaderScheduler,
    LoaderStateRepository,
)
from tai.managed_loader import FetchDisposition, FetchRequest, SourceFetcher
from tai.source_coverage import (
    CoverageTopic,
    OfficialSourceCatalog,
    OfficialSourceDefinition,
    SourceObservation,
)

_DATE_FUTURE_TOLERANCE = timedelta(minutes=5)
_ISO_DATE = re.compile(r"(?<!\d)(20\d{2})[-/.](0[1-9]|1[0-2])[-/.]([0-2]\d|3[01])(?!\d)")
_DMY_DATE = re.compile(r"(?<!\d)([0-2]?\d|3[01])[./-](0?\d|1[0-2])[./-](20\d{2})(?!\d)")
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
    source_id: str

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

    def __post_init__(self) -> None:
        if not self.source_id.strip():
            raise ValueError("adapter source_id must not be blank")
        if not self.topics:
            raise ValueError("adapter topics must not be empty")
        if not self.required_marker_groups or any(
            not group or any(not marker.strip() for marker in group)
            for group in self.required_marker_groups
        ):
            raise ValueError("adapter marker groups must not be empty")
        if not self.count_dates_as_documents and not self.document_suffixes:
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
        for group in self.required_marker_groups:
            if not any(marker.casefold() in normalized for marker in group):
                raise MetadataExtractionError("source_required_marker_missing")

        parser = _HTMLSnapshotParser()
        try:
            parser.feed(body)
            parser.close()
        except Exception as error:
            raise MetadataExtractionError("source_html_parse_failed") from error

        dates = _extract_dates("\n".join(parser.text_chunks), fetched_at)
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
                    for href in parser.links
                    if (url := _trusted_document_url(source, href)) is not None
                    and _matches_suffix(url, self.document_suffixes)
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
        self.links: list[str] = []

    def handle_data(self, data: str) -> None:
        compact = " ".join(data.split())
        if compact:
            self.text_chunks.append(compact)

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
            self.links.append(href)


@dataclass(frozen=True, slots=True)
class OfficialObservationDefinition:
    source: OfficialSourceDefinition
    adapter: OfficialMetadataAdapter
    fetcher: SourceFetcher
    retry_interval: timedelta = timedelta(hours=1)
    maximum_failures: int = 5

    def __post_init__(self) -> None:
        if self.adapter.source_id != self.source.source_id:
            raise ValueError("adapter must be bound to the same official source")
        if self.retry_interval <= timedelta(0):
            raise ValueError("retry_interval must be positive")
        if self.maximum_failures < 1:
            raise ValueError("maximum_failures must be positive")


class OfficialObservationDefinitionRegistry:
    def __init__(self, definitions: tuple[OfficialObservationDefinition, ...]) -> None:
        if not definitions:
            raise ValueError("observation definitions must not be empty")
        source_ids = tuple(definition.source.source_id for definition in definitions)
        if len(source_ids) != len(set(source_ids)):
            raise ValueError("observation definition source_ids must be unique")
        self._definitions = {
            definition.source.source_id: definition for definition in definitions
        }

    def resolve(self, source_id: str) -> OfficialObservationDefinition:
        try:
            return self._definitions[source_id]
        except KeyError as error:
            raise LookupError(f"unknown official observation source: {source_id}") from error


class OfficialObservationRunStatus(StrEnum):
    FETCHED = "FETCHED"
    NOT_MODIFIED = "NOT_MODIFIED"
    RETRYABLE_FAILURE = "RETRYABLE_FAILURE"
    PERMANENT_FAILURE = "PERMANENT_FAILURE"


@dataclass(frozen=True, slots=True)
class OfficialObservationRunEvidence:
    source_id: str
    worker_id: str
    lease_token: UUID
    started_at: datetime
    completed_at: datetime
    status: OfficialObservationRunStatus
    reasons: tuple[str, ...]
    observation_sha256: str | None
    content_sha256: str | None

    def __post_init__(self) -> None:
        if not self.source_id.strip() or not self.worker_id.strip():
            raise ValueError("run source_id and worker_id must not be blank")
        _aware(self.started_at, "started_at")
        _aware(self.completed_at, "completed_at")
        if self.completed_at < self.started_at:
            raise ValueError("completed_at must not precede started_at")
        if not self.reasons:
            raise ValueError("run reasons must not be empty")
        if self.observation_sha256 is not None:
            _sha256(self.observation_sha256, "observation_sha256")
        if self.content_sha256 is not None:
            _sha256(self.content_sha256, "content_sha256")

    @property
    def run_sha256(self) -> str:
        payload = {
            "completed_at": self.completed_at.isoformat(),
            "content_sha256": self.content_sha256,
            "lease_token": str(self.lease_token),
            "observation_sha256": self.observation_sha256,
            "reasons": list(self.reasons),
            "schema_version": "tai.official-observation-run.v1",
            "source_id": self.source_id,
            "started_at": self.started_at.isoformat(),
            "status": self.status.value,
            "worker_id": self.worker_id,
        }
        canonical = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class OfficialObservationCommitAuthority(Protocol):
    def latest_observation(self, source_id: str) -> SourceObservation | None: ...

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
    ) -> bool: ...


@dataclass(frozen=True, slots=True)
class OfficialObservationWorkerExecution:
    source_id: str | None
    status: OfficialObservationRunStatus | None
    committed: bool
    reasons: tuple[str, ...]
    run_sha256: str | None


class LostOfficialObservationLeaseError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class _RunOutcome:
    loader_status: LoaderRunStatus
    run_status: OfficialObservationRunStatus
    next_run_at: datetime | None
    consecutive_failures: int
    reasons: tuple[str, ...]
    observation: SourceObservation | None
    etag: str | None
    last_modified: str | None


class OfficialSourceObservationWorker:
    def __init__(
        self,
        *,
        loader_repository: LoaderStateRepository,
        authority: OfficialObservationCommitAuthority,
        definitions: OfficialObservationDefinitionRegistry,
        worker_id: str,
        lease_duration: timedelta,
    ) -> None:
        if not worker_id.strip():
            raise ValueError("worker_id must not be blank")
        if lease_duration <= timedelta(0):
            raise ValueError("lease_duration must be positive")
        self._loader_repository = loader_repository
        self._authority = authority
        self._definitions = definitions
        self._worker_id = worker_id
        self._lease_duration = lease_duration

    def run_once(self, *, now: datetime) -> OfficialObservationWorkerExecution:
        _aware(now, "now")
        lease = LoaderScheduler(self._loader_repository).acquire(
            worker_id=self._worker_id,
            now=now,
            lease_duration=self._lease_duration,
        )
        if lease is None:
            return OfficialObservationWorkerExecution(
                source_id=None,
                status=None,
                committed=False,
                reasons=("no_due_official_source",),
                run_sha256=None,
            )
        state = self._loader_repository.get(lease.source_id)
        if state is None:
            raise RuntimeError("claimed official loader state disappeared")
        definition = self._definitions.resolve(lease.source_id)
        lease = self._renew_or_raise(lease, now)
        response = definition.fetcher.fetch(
            FetchRequest(
                source_id=state.source_id,
                source_uri=state.source_uri,
                etag=state.etag,
                last_modified=state.last_modified,
            )
        )
        completed_at = response.fetched_at
        _aware(completed_at, "fetched_at")
        if completed_at < now - self._lease_duration:
            raise ValueError("fetch response timestamp predates active lease")
        lease = self._renew_or_raise(lease, completed_at)
        outcome = self._outcome(
            definition=definition,
            current_failures=state.consecutive_failures,
            response=response,
        )
        evidence = OfficialObservationRunEvidence(
            source_id=lease.source_id,
            worker_id=self._worker_id,
            lease_token=lease.token,
            started_at=now,
            completed_at=completed_at,
            status=outcome.run_status,
            reasons=outcome.reasons,
            observation_sha256=(
                outcome.observation.observation_sha256
                if outcome.observation is not None
                else None
            ),
            content_sha256=(
                outcome.observation.content_sha256
                if outcome.observation is not None
                else None
            ),
        )
        committed = self._authority.commit_run(
            lease=lease,
            status=outcome.loader_status,
            next_run_at=outcome.next_run_at,
            etag=outcome.etag,
            last_modified=outcome.last_modified,
            consecutive_failures=outcome.consecutive_failures,
            observation=outcome.observation,
            evidence=evidence,
        )
        if not committed:
            raise LostOfficialObservationLeaseError(
                "official observation commit rejected by fencing authority"
            )
        return OfficialObservationWorkerExecution(
            source_id=lease.source_id,
            status=outcome.run_status,
            committed=True,
            reasons=outcome.reasons,
            run_sha256=evidence.run_sha256,
        )

    def _outcome(
        self,
        *,
        definition: OfficialObservationDefinition,
        current_failures: int,
        response: object,
    ) -> _RunOutcome:
        from tai.managed_loader import FetchResponse

        if not isinstance(response, FetchResponse):
            raise TypeError("official fetcher returned an invalid response")
        source = definition.source
        if response.disposition is FetchDisposition.FETCHED:
            if response.body is None:
                return self._failure_outcome(
                    definition=definition,
                    current_failures=current_failures,
                    completed_at=response.fetched_at,
                    reason="source_fetched_body_missing",
                    etag=response.etag,
                    last_modified=response.last_modified,
                    permanent=False,
                )
            try:
                metadata = definition.adapter.parse(
                    source=source,
                    body=response.body,
                    fetched_at=response.fetched_at,
                )
            except MetadataExtractionError as error:
                return self._failure_outcome(
                    definition=definition,
                    current_failures=current_failures,
                    completed_at=response.fetched_at,
                    reason=error.error_code,
                    etag=response.etag,
                    last_modified=response.last_modified,
                    permanent=False,
                )
            content_sha256 = hashlib.sha256(response.body.encode("utf-8")).hexdigest()
            observation = SourceObservation(
                source_id=source.source_id,
                observed_at=response.fetched_at,
                latest_publication_at=metadata.latest_publication_at,
                last_success_at=response.fetched_at,
                document_count=metadata.document_count,
                consecutive_failures=0,
                observed_topics=metadata.observed_topics,
                content_sha256=content_sha256,
            )
            return _RunOutcome(
                loader_status=LoaderRunStatus.SUCCEEDED,
                run_status=OfficialObservationRunStatus.FETCHED,
                next_run_at=response.fetched_at + source.expected_update_interval,
                consecutive_failures=0,
                reasons=("official_source_observed",),
                observation=observation,
                etag=response.etag,
                last_modified=response.last_modified,
            )
        if response.disposition is FetchDisposition.NOT_MODIFIED:
            previous = self._authority.latest_observation(source.source_id)
            if previous is None:
                return self._failure_outcome(
                    definition=definition,
                    current_failures=current_failures,
                    completed_at=response.fetched_at,
                    reason="source_not_modified_without_baseline",
                    etag=response.etag,
                    last_modified=response.last_modified,
                    permanent=False,
                )
            observation = SourceObservation(
                source_id=previous.source_id,
                observed_at=response.fetched_at,
                latest_publication_at=previous.latest_publication_at,
                last_success_at=response.fetched_at,
                document_count=previous.document_count,
                consecutive_failures=0,
                observed_topics=previous.observed_topics,
                content_sha256=previous.content_sha256,
            )
            return _RunOutcome(
                loader_status=LoaderRunStatus.NOT_MODIFIED,
                run_status=OfficialObservationRunStatus.NOT_MODIFIED,
                next_run_at=response.fetched_at + source.expected_update_interval,
                consecutive_failures=0,
                reasons=("official_source_not_modified",),
                observation=observation,
                etag=response.etag,
                last_modified=response.last_modified,
            )
        permanent = response.disposition is FetchDisposition.PERMANENT_FAILURE
        return self._failure_outcome(
            definition=definition,
            current_failures=current_failures,
            completed_at=response.fetched_at,
            reason=response.error_code or "official_source_fetch_failed",
            etag=response.etag,
            last_modified=response.last_modified,
            permanent=permanent,
        )

    def _failure_outcome(
        self,
        *,
        definition: OfficialObservationDefinition,
        current_failures: int,
        completed_at: datetime,
        reason: str,
        etag: str | None,
        last_modified: str | None,
        permanent: bool,
    ) -> _RunOutcome:
        failures = current_failures + 1
        exhausted = failures >= definition.maximum_failures
        effective_permanent = permanent or exhausted
        previous = self._authority.latest_observation(definition.source.source_id)
        observation = None
        if previous is not None:
            observation = SourceObservation(
                source_id=previous.source_id,
                observed_at=completed_at,
                latest_publication_at=previous.latest_publication_at,
                last_success_at=previous.last_success_at,
                document_count=previous.document_count,
                consecutive_failures=failures,
                observed_topics=previous.observed_topics,
                content_sha256=previous.content_sha256,
            )
        reasons = (reason,)
        if exhausted:
            reasons += ("failure_budget_exhausted",)
        if effective_permanent:
            return _RunOutcome(
                loader_status=LoaderRunStatus.PERMANENT_FAILURE,
                run_status=OfficialObservationRunStatus.PERMANENT_FAILURE,
                next_run_at=None,
                consecutive_failures=failures,
                reasons=reasons,
                observation=observation,
                etag=etag,
                last_modified=last_modified,
            )
        return _RunOutcome(
            loader_status=LoaderRunStatus.RETRYABLE_FAILURE,
            run_status=OfficialObservationRunStatus.RETRYABLE_FAILURE,
            next_run_at=completed_at + definition.retry_interval,
            consecutive_failures=failures,
            reasons=reasons,
            observation=observation,
            etag=etag,
            last_modified=last_modified,
        )

    def _renew_or_raise(self, lease: LoaderLease, now: datetime) -> LoaderLease:
        renewed = self._loader_repository.heartbeat(
            lease=lease,
            now=now,
            lease_duration=self._lease_duration,
        )
        if renewed is None:
            raise LostOfficialObservationLeaseError(
                "official observation heartbeat rejected by fencing authority"
            )
        return renewed


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
        ),
        HTMLMetadataAdapter(
            source_id="official.mcx.opendata",
            topics=frozenset({CoverageTopic.GRAIN_TRACEABILITY}),
            required_marker_groups=(("открыт", "зерн"),),
            document_suffixes=frozenset({".csv", ".json", ".xls", ".xlsx", ".zip"}),
        ),
    )


def definitions_from_catalog(
    *,
    catalog: OfficialSourceCatalog,
    fetchers: dict[str, SourceFetcher],
) -> tuple[OfficialObservationDefinition, ...]:
    adapters = {adapter.source_id: adapter for adapter in default_html_metadata_adapters()}
    definitions: list[OfficialObservationDefinition] = []
    for source in catalog.sources:
        adapter = adapters.get(source.source_id)
        fetcher = fetchers.get(source.source_id)
        if adapter is None or fetcher is None:
            raise ValueError(f"missing adapter or fetcher for official source {source.source_id}")
        definitions.append(
            OfficialObservationDefinition(
                source=source,
                adapter=adapter,
                fetcher=fetcher,
            )
        )
    return tuple(definitions)


def _extract_dates(text: str, reference: datetime) -> tuple[datetime, ...]:
    _aware(reference, "reference")
    values: set[datetime] = set()
    for match in _ISO_DATE.finditer(text):
        _add_date(values, int(match[1]), int(match[2]), int(match[3]), reference)
    for match in _DMY_DATE.finditer(text):
        _add_date(values, int(match[3]), int(match[2]), int(match[1]), reference)
    for match in _RU_DATE.finditer(text):
        month = _RU_MONTHS.get(match[2].casefold())
        if month is not None:
            _add_date(values, int(match[3]), month, int(match[1]), reference)
    return tuple(sorted(values))


def _add_date(
    values: set[datetime],
    year: int,
    month: int,
    day: int,
    reference: datetime,
) -> None:
    try:
        values.add(datetime(year, month, day, tzinfo=reference.tzinfo))
    except ValueError:
        return


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


def _matches_suffix(url: str, suffixes: frozenset[str]) -> bool:
    path = urlparse(url).path.casefold()
    return any(path.endswith(suffix) for suffix in suffixes)


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")


def _sha256(value: str, name: str) -> None:
    if re.fullmatch(r"[0-9a-f]{64}", value) is None:
        raise ValueError(f"{name} must be lowercase SHA-256")
