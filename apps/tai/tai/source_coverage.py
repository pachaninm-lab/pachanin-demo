from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlparse

_SOURCE_ID = re.compile(r"^[a-z0-9][a-z0-9._-]{2,127}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class CoverageTopic(StrEnum):
    GRAIN_MARKET_PRICES = "GRAIN_MARKET_PRICES"
    AGRICULTURE_PRODUCTION = "AGRICULTURE_PRODUCTION"
    GRAIN_REGULATION = "GRAIN_REGULATION"
    GRAIN_QUALITY = "GRAIN_QUALITY"
    GRAIN_TRACEABILITY = "GRAIN_TRACEABILITY"
    LOGISTICS_TARIFFS = "LOGISTICS_TARIFFS"
    FINANCE_RATES = "FINANCE_RATES"
    AGRONOMY_RECOMMENDATIONS = "AGRONOMY_RECOMMENDATIONS"


class SourceFormat(StrEnum):
    HTML = "HTML"
    XLSX = "XLSX"
    CSV = "CSV"
    JSON = "JSON"
    ZIP = "ZIP"
    PDF = "PDF"


class TopicCoverageStatus(StrEnum):
    COVERED = "COVERED"
    STALE = "STALE"
    GAP = "GAP"
    UNOBSERVED = "UNOBSERVED"


@dataclass(frozen=True, slots=True)
class OfficialSourceDefinition:
    source_id: str
    owner: str
    entrypoint_uri: str
    allowed_hosts: frozenset[str]
    topics: frozenset[CoverageTopic]
    formats: frozenset[SourceFormat]
    expected_update_interval: timedelta
    maximum_publication_age: timedelta
    verified_at: datetime

    def __post_init__(self) -> None:
        if _SOURCE_ID.fullmatch(self.source_id) is None:
            raise ValueError("source_id must be a portable lowercase identity")
        if not self.owner.strip():
            raise ValueError("source owner must not be blank")
        parsed = urlparse(self.entrypoint_uri)
        if parsed.scheme != "https" or not parsed.hostname:
            raise ValueError("official source entrypoint must use HTTPS")
        if parsed.username or parsed.password or parsed.fragment:
            raise ValueError("official source entrypoint must not contain credentials or fragment")
        if not self.allowed_hosts or parsed.hostname not in self.allowed_hosts:
            raise ValueError("entrypoint host must be explicitly allowed")
        if any(not host or host != host.lower() for host in self.allowed_hosts):
            raise ValueError("allowed hosts must be non-empty lowercase names")
        if not self.topics:
            raise ValueError("official source topics must not be empty")
        if not self.formats:
            raise ValueError("official source formats must not be empty")
        if self.expected_update_interval <= timedelta(0):
            raise ValueError("expected update interval must be positive")
        if self.maximum_publication_age < self.expected_update_interval:
            raise ValueError("maximum publication age must cover update interval")
        _aware(self.verified_at, "verified_at")


@dataclass(frozen=True, slots=True)
class CoverageRequirement:
    topic: CoverageTopic
    minimum_official_sources: int
    maximum_publication_age: timedelta
    critical: bool = True

    def __post_init__(self) -> None:
        if self.minimum_official_sources < 1:
            raise ValueError("minimum_official_sources must be positive")
        if self.maximum_publication_age <= timedelta(0):
            raise ValueError("maximum_publication_age must be positive")


@dataclass(frozen=True, slots=True)
class OfficialSourceCatalog:
    sources: tuple[OfficialSourceDefinition, ...]
    requirements: tuple[CoverageRequirement, ...]

    def __post_init__(self) -> None:
        if not self.sources or not self.requirements:
            raise ValueError("source catalog and requirements must not be empty")
        source_ids = tuple(source.source_id for source in self.sources)
        if len(source_ids) != len(set(source_ids)):
            raise ValueError("official source identities must be unique")
        topics = tuple(requirement.topic for requirement in self.requirements)
        if len(topics) != len(set(topics)):
            raise ValueError("coverage requirement topics must be unique")

    def source_for(self, source_id: str) -> OfficialSourceDefinition | None:
        return next(
            (source for source in self.sources if source.source_id == source_id),
            None,
        )


@dataclass(frozen=True, slots=True)
class SourceObservation:
    source_id: str
    observed_at: datetime
    latest_publication_at: datetime
    last_success_at: datetime
    document_count: int
    consecutive_failures: int
    observed_topics: frozenset[CoverageTopic]
    content_sha256: str

    def __post_init__(self) -> None:
        if _SOURCE_ID.fullmatch(self.source_id) is None:
            raise ValueError("observation source_id is invalid")
        _aware(self.observed_at, "observed_at")
        _aware(self.latest_publication_at, "latest_publication_at")
        _aware(self.last_success_at, "last_success_at")
        if self.document_count < 1:
            raise ValueError("document_count must be positive")
        if self.consecutive_failures < 0:
            raise ValueError("consecutive_failures must not be negative")
        if not self.observed_topics:
            raise ValueError("observed_topics must not be empty")
        _sha256(self.content_sha256, "content_sha256")

    @property
    def observation_sha256(self) -> str:
        return _hash_payload(
            {
                "consecutive_failures": self.consecutive_failures,
                "content_sha256": self.content_sha256,
                "document_count": self.document_count,
                "last_success_at": self.last_success_at.isoformat(),
                "latest_publication_at": self.latest_publication_at.isoformat(),
                "observed_at": self.observed_at.isoformat(),
                "observed_topics": sorted(topic.value for topic in self.observed_topics),
                "schema_version": "tai.source-observation.v1",
                "source_id": self.source_id,
            }
        )


@dataclass(frozen=True, slots=True)
class TopicCoverage:
    topic: CoverageTopic
    status: TopicCoverageStatus
    healthy_source_ids: tuple[str, ...]
    reasons: tuple[str, ...]
    critical: bool


@dataclass(frozen=True, slots=True)
class CoverageAssessment:
    generated_at: datetime
    topics: tuple[TopicCoverage, ...]
    coverage_basis_points: int
    critical_coverage_basis_points: int
    all_critical_covered: bool
    assessment_sha256: str


class OfficialSourceCoverageAuthority:
    """Count only fresh, healthy and actually observed official sources."""

    _FUTURE_TOLERANCE = timedelta(minutes=5)

    def assess(
        self,
        *,
        catalog: OfficialSourceCatalog,
        observations: tuple[SourceObservation, ...],
        now: datetime,
    ) -> CoverageAssessment:
        _aware(now, "now")
        by_source: dict[str, SourceObservation] = {}
        duplicate_ids: set[str] = set()
        for observation in observations:
            if observation.source_id in by_source:
                duplicate_ids.add(observation.source_id)
            by_source[observation.source_id] = observation

        topic_results = tuple(
            self._assess_topic(
                catalog=catalog,
                requirement=requirement,
                observations=by_source,
                duplicate_ids=duplicate_ids,
                now=now,
            )
            for requirement in catalog.requirements
        )
        covered_count = sum(
            result.status is TopicCoverageStatus.COVERED
            for result in topic_results
        )
        critical = tuple(result for result in topic_results if result.critical)
        critical_covered = sum(
            result.status is TopicCoverageStatus.COVERED for result in critical
        )
        coverage_basis_points = covered_count * 10_000 // len(topic_results)
        critical_basis_points = critical_covered * 10_000 // len(critical)
        all_critical_covered = critical_covered == len(critical)
        digest = _assessment_sha256(
            now=now,
            topics=topic_results,
            coverage_basis_points=coverage_basis_points,
            critical_coverage_basis_points=critical_basis_points,
            all_critical_covered=all_critical_covered,
        )
        return CoverageAssessment(
            generated_at=now,
            topics=topic_results,
            coverage_basis_points=coverage_basis_points,
            critical_coverage_basis_points=critical_basis_points,
            all_critical_covered=all_critical_covered,
            assessment_sha256=digest,
        )

    def _assess_topic(
        self,
        *,
        catalog: OfficialSourceCatalog,
        requirement: CoverageRequirement,
        observations: dict[str, SourceObservation],
        duplicate_ids: set[str],
        now: datetime,
    ) -> TopicCoverage:
        candidates = tuple(
            source
            for source in catalog.sources
            if requirement.topic in source.topics
        )
        if not candidates:
            return TopicCoverage(
                topic=requirement.topic,
                status=TopicCoverageStatus.GAP,
                healthy_source_ids=(),
                reasons=("NO_REGISTERED_OFFICIAL_SOURCE",),
                critical=requirement.critical,
            )

        healthy: list[str] = []
        reasons: list[str] = []
        observed_count = 0
        stale_count = 0
        for source in candidates:
            observation = observations.get(source.source_id)
            if observation is None:
                reasons.append(f"SOURCE_UNOBSERVED:{source.source_id}")
                continue
            observed_count += 1
            source_reasons = self._observation_reasons(
                source=source,
                requirement=requirement,
                observation=observation,
                duplicate=source.source_id in duplicate_ids,
                now=now,
            )
            if source_reasons:
                reasons.extend(source_reasons)
                if any("STALE" in reason for reason in source_reasons):
                    stale_count += 1
            else:
                healthy.append(source.source_id)

        if len(healthy) >= requirement.minimum_official_sources:
            status = TopicCoverageStatus.COVERED
        elif observed_count == 0:
            status = TopicCoverageStatus.UNOBSERVED
        elif stale_count:
            status = TopicCoverageStatus.STALE
        else:
            status = TopicCoverageStatus.GAP
        if len(healthy) < requirement.minimum_official_sources:
            reasons.append(
                "INSUFFICIENT_HEALTHY_SOURCES:"
                f"{len(healthy)}/{requirement.minimum_official_sources}"
            )
        return TopicCoverage(
            topic=requirement.topic,
            status=status,
            healthy_source_ids=tuple(sorted(healthy)),
            reasons=tuple(sorted(set(reasons))),
            critical=requirement.critical,
        )

    def _observation_reasons(
        self,
        *,
        source: OfficialSourceDefinition,
        requirement: CoverageRequirement,
        observation: SourceObservation,
        duplicate: bool,
        now: datetime,
    ) -> tuple[str, ...]:
        reasons: list[str] = []
        if duplicate:
            reasons.append(f"DUPLICATE_OBSERVATION:{source.source_id}")
        if requirement.topic not in observation.observed_topics:
            reasons.append(f"TOPIC_NOT_OBSERVED:{source.source_id}")
        future_limit = now + self._FUTURE_TOLERANCE
        if observation.observed_at > future_limit:
            reasons.append(f"OBSERVED_AT_FUTURE:{source.source_id}")
        if observation.latest_publication_at > future_limit:
            reasons.append(f"PUBLICATION_AT_FUTURE:{source.source_id}")
        if observation.last_success_at > future_limit:
            reasons.append(f"LAST_SUCCESS_AT_FUTURE:{source.source_id}")
        if observation.consecutive_failures:
            reasons.append(f"SOURCE_FAILURES:{source.source_id}")
        freshness_limit = min(
            source.maximum_publication_age,
            requirement.maximum_publication_age,
        )
        if now - observation.latest_publication_at > freshness_limit:
            reasons.append(f"PUBLICATION_STALE:{source.source_id}")
        if now - observation.last_success_at > source.expected_update_interval:
            reasons.append(f"OBSERVATION_STALE:{source.source_id}")
        return tuple(reasons)


def load_official_source_catalog(path: Path) -> OfficialSourceCatalog:
    payload = _load_json(path)
    if payload.get("schema_version") != "tai.official-source-catalog.v1":
        raise ValueError("unsupported official source catalog schema")
    sources = tuple(
        _parse_source(item) for item in _array(payload, "sources")
    )
    requirements = tuple(
        _parse_requirement(item) for item in _array(payload, "requirements")
    )
    return OfficialSourceCatalog(sources=sources, requirements=requirements)


def load_source_observations(path: Path) -> tuple[SourceObservation, ...]:
    payload = _load_json(path)
    if payload.get("schema_version") != "tai.source-observations.v1":
        raise ValueError("unsupported source observations schema")
    return tuple(
        _parse_observation(item) for item in _array(payload, "observations")
    )


def catalog_canonical_json(catalog: OfficialSourceCatalog) -> str:
    payload = {
        "requirements": [
            {
                "critical": requirement.critical,
                "maximum_publication_age_seconds": int(
                    requirement.maximum_publication_age.total_seconds()
                ),
                "minimum_official_sources": requirement.minimum_official_sources,
                "topic": requirement.topic.value,
            }
            for requirement in catalog.requirements
        ],
        "schema_version": "tai.official-source-catalog.v1",
        "sources": [
            {
                "allowed_hosts": sorted(source.allowed_hosts),
                "entrypoint_uri": source.entrypoint_uri,
                "expected_update_interval_seconds": int(
                    source.expected_update_interval.total_seconds()
                ),
                "formats": sorted(item.value for item in source.formats),
                "maximum_publication_age_seconds": int(
                    source.maximum_publication_age.total_seconds()
                ),
                "owner": source.owner,
                "source_id": source.source_id,
                "topics": sorted(topic.value for topic in source.topics),
                "verified_at": source.verified_at.isoformat(),
            }
            for source in catalog.sources
        ],
    }
    return _canonical_json(payload)


def assessment_payload(assessment: CoverageAssessment) -> dict[str, object]:
    return {
        "all_critical_covered": assessment.all_critical_covered,
        "assessment_sha256": assessment.assessment_sha256,
        "coverage_basis_points": assessment.coverage_basis_points,
        "critical_coverage_basis_points": (
            assessment.critical_coverage_basis_points
        ),
        "generated_at": assessment.generated_at.isoformat(),
        "schema_version": "tai.official-source-coverage-assessment.v1",
        "topics": [
            {
                "critical": topic.critical,
                "healthy_source_ids": list(topic.healthy_source_ids),
                "reasons": list(topic.reasons),
                "status": topic.status.value,
                "topic": topic.topic.value,
            }
            for topic in assessment.topics
        ],
    }


def _parse_source(value: object) -> OfficialSourceDefinition:
    payload = _object(value, "official source")
    return OfficialSourceDefinition(
        source_id=_string(payload, "source_id"),
        owner=_string(payload, "owner"),
        entrypoint_uri=_string(payload, "entrypoint_uri"),
        allowed_hosts=frozenset(_strings(payload, "allowed_hosts")),
        topics=frozenset(
            CoverageTopic(item) for item in _strings(payload, "topics")
        ),
        formats=frozenset(
            SourceFormat(item) for item in _strings(payload, "formats")
        ),
        expected_update_interval=timedelta(
            seconds=_integer(payload, "expected_update_interval_seconds")
        ),
        maximum_publication_age=timedelta(
            seconds=_integer(payload, "maximum_publication_age_seconds")
        ),
        verified_at=_datetime(payload, "verified_at"),
    )


def _parse_requirement(value: object) -> CoverageRequirement:
    payload = _object(value, "coverage requirement")
    return CoverageRequirement(
        topic=CoverageTopic(_string(payload, "topic")),
        minimum_official_sources=_integer(payload, "minimum_official_sources"),
        maximum_publication_age=timedelta(
            seconds=_integer(payload, "maximum_publication_age_seconds")
        ),
        critical=_boolean(payload, "critical"),
    )


def _parse_observation(value: object) -> SourceObservation:
    payload = _object(value, "source observation")
    return SourceObservation(
        source_id=_string(payload, "source_id"),
        observed_at=_datetime(payload, "observed_at"),
        latest_publication_at=_datetime(payload, "latest_publication_at"),
        last_success_at=_datetime(payload, "last_success_at"),
        document_count=_integer(payload, "document_count"),
        consecutive_failures=_integer(payload, "consecutive_failures"),
        observed_topics=frozenset(
            CoverageTopic(item) for item in _strings(payload, "observed_topics")
        ),
        content_sha256=_string(payload, "content_sha256"),
    )


def _assessment_sha256(
    *,
    now: datetime,
    topics: tuple[TopicCoverage, ...],
    coverage_basis_points: int,
    critical_coverage_basis_points: int,
    all_critical_covered: bool,
) -> str:
    return _hash_payload(
        {
            "all_critical_covered": all_critical_covered,
            "coverage_basis_points": coverage_basis_points,
            "critical_coverage_basis_points": critical_coverage_basis_points,
            "generated_at": now.isoformat(),
            "schema_version": "tai.official-source-coverage-assessment.v1",
            "topics": [
                {
                    "critical": topic.critical,
                    "healthy_source_ids": list(topic.healthy_source_ids),
                    "reasons": list(topic.reasons),
                    "status": topic.status.value,
                    "topic": topic.topic.value,
                }
                for topic in topics
            ],
        }
    )


def _hash_payload(payload: object) -> str:
    return hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()


def _canonical_json(payload: object) -> str:
    return json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot load JSON from {path}") from error
    return _object(value, "root payload")


def _object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be a JSON object")
    if any(not isinstance(key, str) for key in value):
        raise ValueError(f"{name} keys must be strings")
    return cast(dict[str, Any], value)


def _array(payload: dict[str, Any], key: str) -> list[object]:
    value = payload.get(key)
    if not isinstance(value, list):
        raise ValueError(f"{key} must be an array")
    return cast(list[object], value)


def _strings(payload: dict[str, Any], key: str) -> list[str]:
    values = _array(payload, key)
    if not values or any(not isinstance(item, str) for item in values):
        raise ValueError(f"{key} must be a non-empty string array")
    return cast(list[str], values)


def _string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value


def _integer(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{key} must be an integer")
    return value


def _boolean(payload: dict[str, Any], key: str) -> bool:
    value = payload.get(key)
    if not isinstance(value, bool):
        raise ValueError(f"{key} must be a boolean")
    return value


def _datetime(payload: dict[str, Any], key: str) -> datetime:
    raw = _string(payload, key)
    try:
        value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{key} must be an ISO-8601 datetime") from error
    _aware(value, key)
    return value


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")


def _sha256(value: str, name: str) -> None:
    if _SHA256.fullmatch(value) is None:
        raise ValueError(f"{name} must be a lowercase SHA-256 digest")
