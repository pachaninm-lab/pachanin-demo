from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import Callable

from tai.managed_loader import FetchDisposition, FetchRequest, SourceFetcher
from tai.official_source_fetcher import OfficialFetchPolicy, OfficialSourceHTTPFetcher
from tai.official_source_observation import (
    OfficialObservationDefinition,
    definitions_from_catalog,
)
from tai.source_coverage import (
    CoverageAssessment,
    OfficialSourceCatalog,
    OfficialSourceCoverageAuthority,
    SourceObservation,
    assessment_payload,
    catalog_canonical_json,
)

_GIT_OBJECT_ID = re.compile(r"(?:[0-9a-f]{40}|[0-9a-f]{64})")


class LiveCollectionStatus(StrEnum):
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class LiveSourceResultStatus(StrEnum):
    OBSERVED = "OBSERVED"
    FAILED = "FAILED"


@dataclass(frozen=True, slots=True)
class LiveSourceResult:
    source_id: str
    status: LiveSourceResultStatus
    started_at: datetime
    completed_at: datetime
    reason: str
    observation: SourceObservation | None

    def __post_init__(self) -> None:
        if not self.source_id.strip():
            raise ValueError("live source result source_id must not be blank")
        _aware(self.started_at, "started_at")
        _aware(self.completed_at, "completed_at")
        if self.completed_at < self.started_at:
            raise ValueError("live source result completed_at precedes started_at")
        if not self.reason.strip():
            raise ValueError("live source result reason must not be blank")
        if self.status is LiveSourceResultStatus.OBSERVED and self.observation is None:
            raise ValueError("observed live source result requires an observation")
        if self.status is LiveSourceResultStatus.FAILED and self.observation is not None:
            raise ValueError("failed live source result cannot carry an observation")
        if self.observation is not None and self.observation.source_id != self.source_id:
            raise ValueError("live result observation source_id mismatch")


@dataclass(frozen=True, slots=True)
class LiveEvidenceBundle:
    repository_sha: str
    catalog_sha256: str
    started_at: datetime
    completed_at: datetime
    status: LiveCollectionStatus
    source_results: tuple[LiveSourceResult, ...]
    assessment: CoverageAssessment

    def __post_init__(self) -> None:
        if _GIT_OBJECT_ID.fullmatch(self.repository_sha) is None:
            raise ValueError("repository_sha must be a lowercase Git object id")
        _sha256(self.catalog_sha256, "catalog_sha256")
        _aware(self.started_at, "started_at")
        _aware(self.completed_at, "completed_at")
        if self.completed_at < self.started_at:
            raise ValueError("live evidence completed_at precedes started_at")
        if not self.source_results:
            raise ValueError("live evidence source_results must not be empty")
        source_ids = tuple(result.source_id for result in self.source_results)
        if len(source_ids) != len(set(source_ids)):
            raise ValueError("live evidence source ids must be unique")
        observed_count = sum(
            result.status is LiveSourceResultStatus.OBSERVED
            for result in self.source_results
        )
        expected_status = (
            LiveCollectionStatus.FAILED
            if observed_count == 0
            else LiveCollectionStatus.COMPLETE
            if observed_count == len(self.source_results)
            else LiveCollectionStatus.PARTIAL
        )
        if self.status is not expected_status:
            raise ValueError("live evidence collection status is inconsistent")

    @property
    def observations(self) -> tuple[SourceObservation, ...]:
        return tuple(
            result.observation
            for result in self.source_results
            if result.observation is not None
        )


class LiveSourceEvidenceCollector:
    def __init__(
        self,
        *,
        catalog: OfficialSourceCatalog,
        definitions: tuple[OfficialObservationDefinition, ...],
        repository_sha: str,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        if _GIT_OBJECT_ID.fullmatch(repository_sha) is None:
            raise ValueError("repository_sha must be a lowercase Git object id")
        if not definitions:
            raise ValueError("live evidence definitions must not be empty")
        catalog_source_ids = tuple(source.source_id for source in catalog.sources)
        definition_source_ids = tuple(
            definition.source.source_id for definition in definitions
        )
        if definition_source_ids != catalog_source_ids:
            raise ValueError(
                "live evidence definitions must match catalog source order exactly"
            )
        self._catalog = catalog
        self._definitions = definitions
        self._repository_sha = repository_sha
        self._clock = clock or (lambda: datetime.now(UTC))

    def collect(self) -> LiveEvidenceBundle:
        started_at = self._now()
        results = tuple(self._collect_one(definition) for definition in self._definitions)
        completed_at = self._now()
        observations = tuple(
            result.observation for result in results if result.observation is not None
        )
        assessment = OfficialSourceCoverageAuthority().assess(
            catalog=self._catalog,
            observations=observations,
            now=completed_at,
        )
        observed_count = len(observations)
        status = (
            LiveCollectionStatus.FAILED
            if observed_count == 0
            else LiveCollectionStatus.COMPLETE
            if observed_count == len(results)
            else LiveCollectionStatus.PARTIAL
        )
        canonical_catalog = catalog_canonical_json(self._catalog)
        return LiveEvidenceBundle(
            repository_sha=self._repository_sha,
            catalog_sha256=hashlib.sha256(
                canonical_catalog.encode("utf-8")
            ).hexdigest(),
            started_at=started_at,
            completed_at=completed_at,
            status=status,
            source_results=results,
            assessment=assessment,
        )

    def _collect_one(
        self,
        definition: OfficialObservationDefinition,
    ) -> LiveSourceResult:
        started_at = self._now()
        response = definition.fetcher.fetch(
            FetchRequest(
                source_id=definition.source.source_id,
                source_uri=definition.source.entrypoint_uri,
            )
        )
        completed_at = response.fetched_at
        _aware(completed_at, "fetched_at")
        if response.disposition is not FetchDisposition.FETCHED:
            reason = response.error_code or (
                "source_not_modified_without_live_baseline"
                if response.disposition is FetchDisposition.NOT_MODIFIED
                else "live_source_fetch_failed"
            )
            return LiveSourceResult(
                source_id=definition.source.source_id,
                status=LiveSourceResultStatus.FAILED,
                started_at=started_at,
                completed_at=completed_at,
                reason=reason,
                observation=None,
            )
        if response.body is None:
            return LiveSourceResult(
                source_id=definition.source.source_id,
                status=LiveSourceResultStatus.FAILED,
                started_at=started_at,
                completed_at=completed_at,
                reason="live_source_fetched_body_missing",
                observation=None,
            )
        try:
            metadata = definition.adapter.parse(
                source=definition.source,
                body=response.body,
                fetched_at=completed_at,
            )
        except ValueError as error:
            return LiveSourceResult(
                source_id=definition.source.source_id,
                status=LiveSourceResultStatus.FAILED,
                started_at=started_at,
                completed_at=completed_at,
                reason=str(error) or "live_source_metadata_invalid",
                observation=None,
            )
        observation = SourceObservation(
            source_id=definition.source.source_id,
            observed_at=completed_at,
            latest_publication_at=metadata.latest_publication_at,
            last_success_at=completed_at,
            document_count=metadata.document_count,
            consecutive_failures=0,
            observed_topics=metadata.observed_topics,
            content_sha256=hashlib.sha256(response.body.encode("utf-8")).hexdigest(),
        )
        return LiveSourceResult(
            source_id=definition.source.source_id,
            status=LiveSourceResultStatus.OBSERVED,
            started_at=started_at,
            completed_at=completed_at,
            reason="official_source_observed",
            observation=observation,
        )

    def _now(self) -> datetime:
        value = self._clock()
        _aware(value, "clock value")
        return value


def live_definitions(
    *,
    catalog: OfficialSourceCatalog,
    timeout_seconds: float,
) -> tuple[OfficialObservationDefinition, ...]:
    fetchers: dict[str, SourceFetcher] = {}
    for source in catalog.sources:
        fetchers[source.source_id] = OfficialSourceHTTPFetcher(
            policy=OfficialFetchPolicy(
                allowed_hosts=source.allowed_hosts,
                timeout_seconds=timeout_seconds,
            )
        )
    return definitions_from_catalog(catalog=catalog, fetchers=fetchers)


def run_manifest_payload(bundle: LiveEvidenceBundle) -> dict[str, object]:
    results: list[dict[str, object]] = []
    for result in bundle.source_results:
        result_payload: dict[str, object] = {
            "completed_at": result.completed_at.isoformat(),
            "reason": result.reason,
            "source_id": result.source_id,
            "started_at": result.started_at.isoformat(),
            "status": result.status.value,
        }
        if result.observation is not None:
            result_payload["content_sha256"] = result.observation.content_sha256
            result_payload["observation_sha256"] = (
                result.observation.observation_sha256
            )
        results.append(result_payload)
    return {
        "all_critical_covered": bundle.assessment.all_critical_covered,
        "catalog_sha256": bundle.catalog_sha256,
        "completed_at": bundle.completed_at.isoformat(),
        "coverage_basis_points": bundle.assessment.coverage_basis_points,
        "critical_coverage_basis_points": (
            bundle.assessment.critical_coverage_basis_points
        ),
        "observed_source_count": len(bundle.observations),
        "repository_sha": bundle.repository_sha,
        "schema_version": "tai.live-official-source-run.v1",
        "source_count": len(bundle.source_results),
        "source_results": results,
        "started_at": bundle.started_at.isoformat(),
        "status": bundle.status.value,
    }


def observations_payload(bundle: LiveEvidenceBundle) -> dict[str, object]:
    observations = []
    for observation in bundle.observations:
        observations.append(
            {
                "consecutive_failures": observation.consecutive_failures,
                "content_sha256": observation.content_sha256,
                "document_count": observation.document_count,
                "last_success_at": observation.last_success_at.isoformat(),
                "latest_publication_at": observation.latest_publication_at.isoformat(),
                "observed_at": observation.observed_at.isoformat(),
                "observed_topics": sorted(
                    topic.value for topic in observation.observed_topics
                ),
                "source_id": observation.source_id,
            }
        )
    return {
        "observations": observations,
        "schema_version": "tai.source-observations.v1",
    }


def coverage_payload(bundle: LiveEvidenceBundle) -> dict[str, object]:
    return assessment_payload(bundle.assessment)


def evidence_bundle_sha256(bundle: LiveEvidenceBundle) -> str:
    payload = {
        "assessment": coverage_payload(bundle),
        "manifest": run_manifest_payload(bundle),
        "observations": observations_payload(bundle),
    }
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")


def _sha256(value: str, name: str) -> None:
    if re.fullmatch(r"[0-9a-f]{64}", value) is None:
        raise ValueError(f"{name} must be lowercase SHA-256")
