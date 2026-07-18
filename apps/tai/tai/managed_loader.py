from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from hashlib import sha256
from typing import Protocol

from tai.source_governance import KnowledgeDomain, SourceDocument, SourceRegistry


class FetchDisposition(StrEnum):
    FETCHED = "FETCHED"
    NOT_MODIFIED = "NOT_MODIFIED"
    RETRYABLE_FAILURE = "RETRYABLE_FAILURE"
    PERMANENT_FAILURE = "PERMANENT_FAILURE"


@dataclass(frozen=True, slots=True)
class FetchRequest:
    source_id: str
    source_uri: str
    etag: str | None = None
    last_modified: str | None = None


@dataclass(frozen=True, slots=True)
class FetchResponse:
    disposition: FetchDisposition
    body: str | None
    fetched_at: datetime
    etag: str | None = None
    last_modified: str | None = None
    error_code: str | None = None


class SourceFetcher(Protocol):
    def fetch(self, request: FetchRequest) -> FetchResponse: ...


@dataclass(frozen=True, slots=True)
class NormalizationInput:
    source_id: str
    source_uri: str
    title: str
    raw_body: str
    published_at: datetime | None
    effective_at: datetime | None
    fetched_at: datetime
    trust_score: float
    domain: KnowledgeDomain


class DocumentNormalizer:
    def normalize(self, item: NormalizationInput) -> SourceDocument:
        title = " ".join(item.title.split())
        body = "\n".join(line.strip() for line in item.raw_body.splitlines() if line.strip())
        return SourceDocument(
            source_id=item.source_id,
            source_uri=item.source_uri,
            title=title,
            body=body,
            published_at=item.published_at,
            effective_at=item.effective_at,
            fetched_at=item.fetched_at,
            trust_score=item.trust_score,
            domain=item.domain,
            checksum_sha256=sha256(body.encode("utf-8")).hexdigest(),
        )


@dataclass(frozen=True, slots=True)
class LoaderSchedule:
    source_id: str
    interval: timedelta
    retry_interval: timedelta
    maximum_failures: int

    def next_run_at(
        self,
        *,
        completed_at: datetime,
        disposition: FetchDisposition,
        consecutive_failures: int,
    ) -> datetime | None:
        if consecutive_failures >= self.maximum_failures:
            return None
        if disposition is FetchDisposition.RETRYABLE_FAILURE:
            return completed_at + self.retry_interval
        if disposition is FetchDisposition.PERMANENT_FAILURE:
            return None
        return completed_at + self.interval


@dataclass(frozen=True, slots=True)
class LoaderResult:
    disposition: FetchDisposition
    document: SourceDocument | None
    reasons: tuple[str, ...]
    next_run_at: datetime | None
    etag: str | None
    last_modified: str | None


class ManagedSourceLoader:
    def __init__(
        self,
        *,
        fetcher: SourceFetcher,
        normalizer: DocumentNormalizer,
        registry: SourceRegistry,
        schedule: LoaderSchedule,
    ) -> None:
        self._fetcher = fetcher
        self._normalizer = normalizer
        self._registry = registry
        self._schedule = schedule

    def run(
        self,
        *,
        request: FetchRequest,
        title: str,
        published_at: datetime | None,
        effective_at: datetime | None,
        trust_score: float,
        domain: KnowledgeDomain,
        consecutive_failures: int = 0,
    ) -> LoaderResult:
        response = self._fetcher.fetch(request)
        next_run_at = self._schedule.next_run_at(
            completed_at=response.fetched_at,
            disposition=response.disposition,
            consecutive_failures=consecutive_failures,
        )

        if response.disposition is FetchDisposition.NOT_MODIFIED:
            return LoaderResult(
                disposition=response.disposition,
                document=None,
                reasons=("source_not_modified",),
                next_run_at=next_run_at,
                etag=response.etag,
                last_modified=response.last_modified,
            )

        if response.disposition in {
            FetchDisposition.RETRYABLE_FAILURE,
            FetchDisposition.PERMANENT_FAILURE,
        }:
            reason = response.error_code or "source_fetch_failed"
            return LoaderResult(
                disposition=response.disposition,
                document=None,
                reasons=(reason,),
                next_run_at=next_run_at,
                etag=response.etag,
                last_modified=response.last_modified,
            )

        if response.body is None:
            return LoaderResult(
                disposition=FetchDisposition.PERMANENT_FAILURE,
                document=None,
                reasons=("fetched_body_missing",),
                next_run_at=None,
                etag=response.etag,
                last_modified=response.last_modified,
            )

        document = self._normalizer.normalize(
            NormalizationInput(
                source_id=request.source_id,
                source_uri=request.source_uri,
                title=title,
                raw_body=response.body,
                published_at=published_at,
                effective_at=effective_at,
                fetched_at=response.fetched_at,
                trust_score=trust_score,
                domain=domain,
            )
        )
        decision = self._registry.admit(document, now=response.fetched_at)
        return LoaderResult(
            disposition=response.disposition,
            document=document if decision.accepted else None,
            reasons=decision.reasons,
            next_run_at=next_run_at,
            etag=response.etag,
            last_modified=response.last_modified,
        )


DEFAULT_OFFICIAL_SCHEDULE = LoaderSchedule(
    source_id="official",
    interval=timedelta(days=1),
    retry_interval=timedelta(hours=1),
    maximum_failures=5,
)


def utc_now() -> datetime:
    return datetime.now(UTC)
