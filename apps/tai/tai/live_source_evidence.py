from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from tai.managed_loader import FetchDisposition, FetchRequest, SourceFetcher
from tai.official_source_fetcher import OfficialFetchPolicy, OfficialSourceHTTPFetcher
from tai.official_source_observation import (
    OfficialObservationDefinition,
    definitions_from_catalog,
)
from tai.source_coverage import (
    CoverageAssessment,
    CoverageTopic,
    OfficialSourceCatalog,
    OfficialSourceCoverageAuthority,
    SourceObservation,
    assessment_payload,
    catalog_canonical_json,
)
from tai.source_health import SourceRefreshEvent, SourceRefreshOutcome

_GIT_OBJECT_ID = re.compile(r"(?:[0-9a-f]{40}|[0-9a-f]{64})")
_MAX_PUBLIC_EXCERPT_CHARS = 16_000
_IGNORED_HTML_TAGS = frozenset({"script", "style", "noscript", "svg", "template"})


class LiveCollectionStatus(StrEnum):
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class LiveSourceResultStatus(StrEnum):
    OBSERVED = "OBSERVED"
    FAILED = "FAILED"


@dataclass(frozen=True, slots=True)
class PublicSourceProfile:
    geography: str
    language: str
    citation_label: str

    def __post_init__(self) -> None:
        if not self.geography.strip():
            raise ValueError("public source geography must not be blank")
        if self.language not in {"ru", "en", "zh"}:
            raise ValueError("public source language is unsupported")
        if not self.citation_label.strip():
            raise ValueError("public source citation label must not be blank")


@dataclass(frozen=True, slots=True)
class OfficialKnowledgeExcerpt:
    source_id: str
    owner: str
    citation_uri: str
    citation_label: str
    geography: str
    language: str
    published_at: datetime
    retrieved_at: datetime
    topics: tuple[str, ...]
    text: str
    content_sha256: str
    excerpt_sha256: str

    def __post_init__(self) -> None:
        if not self.source_id.strip() or not self.owner.strip():
            raise ValueError("knowledge excerpt source identity must not be blank")
        parsed = urlparse(self.citation_uri)
        if parsed.scheme != "https" or not parsed.hostname:
            raise ValueError("knowledge excerpt citation must use HTTPS")
        if not self.citation_label.strip() or not self.geography.strip():
            raise ValueError("knowledge excerpt public metadata must not be blank")
        if self.language not in {"ru", "en", "zh"}:
            raise ValueError("knowledge excerpt language is unsupported")
        _aware(self.published_at, "published_at")
        _aware(self.retrieved_at, "retrieved_at")
        if self.published_at > self.retrieved_at:
            raise ValueError("knowledge excerpt publication is in the future")
        if not self.topics or tuple(sorted(set(self.topics))) != self.topics:
            raise ValueError("knowledge excerpt topics must be unique and sorted")
        if not self.text.strip() or len(self.text) > _MAX_PUBLIC_EXCERPT_CHARS:
            raise ValueError("knowledge excerpt text is blank or exceeds the limit")
        _sha256(self.content_sha256, "content_sha256")
        _sha256(self.excerpt_sha256, "excerpt_sha256")
        expected = hashlib.sha256(self.text.encode("utf-8")).hexdigest()
        if self.excerpt_sha256 != expected:
            raise ValueError("knowledge excerpt digest does not match text")


@dataclass(frozen=True, slots=True)
class LiveSourceResult:
    source_id: str
    status: LiveSourceResultStatus
    started_at: datetime
    completed_at: datetime
    reason: str
    refresh_outcome: SourceRefreshOutcome
    observation: SourceObservation | None
    knowledge_excerpt: OfficialKnowledgeExcerpt | None = None

    def __post_init__(self) -> None:
        if not self.source_id.strip():
            raise ValueError("live source result source_id must not be blank")
        _aware(self.started_at, "started_at")
        _aware(self.completed_at, "completed_at")
        if self.completed_at < self.started_at:
            raise ValueError("live source result completed_at precedes started_at")
        if not self.reason.strip():
            raise ValueError("live source result reason must not be blank")
        if self.status is LiveSourceResultStatus.OBSERVED:
            if self.observation is None or self.knowledge_excerpt is None:
                raise ValueError("observed live result requires observation and knowledge")
        elif self.observation is not None or self.knowledge_excerpt is not None:
            raise ValueError("failed live result cannot carry observation or knowledge")
        if self.observation is not None and self.observation.source_id != self.source_id:
            raise ValueError("live result observation source_id mismatch")
        if (
            self.knowledge_excerpt is not None
            and self.knowledge_excerpt.source_id != self.source_id
        ):
            raise ValueError("live result knowledge source_id mismatch")
        if (
            self.status is LiveSourceResultStatus.OBSERVED
            and not self.refresh_outcome.successful
        ):
            raise ValueError("observed live result requires successful refresh outcome")
        if (
            self.status is LiveSourceResultStatus.FAILED
            and self.refresh_outcome.successful
        ):
            raise ValueError("failed live result cannot have successful refresh outcome")


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

    @property
    def knowledge_excerpts(self) -> tuple[OfficialKnowledgeExcerpt, ...]:
        return tuple(
            result.knowledge_excerpt
            for result in self.source_results
            if result.knowledge_excerpt is not None
        )


class LiveSourceEvidenceCollector:
    def __init__(
        self,
        *,
        catalog: OfficialSourceCatalog,
        definitions: tuple[OfficialObservationDefinition, ...],
        repository_sha: str,
        public_profiles: Mapping[str, PublicSourceProfile] | None = None,
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
        resolved_profiles = dict(public_profiles or {})
        unknown_profiles = set(resolved_profiles).difference(catalog_source_ids)
        if unknown_profiles:
            raise ValueError("public profiles contain an unknown official source")
        self._catalog = catalog
        self._definitions = definitions
        self._repository_sha = repository_sha
        self._profiles = resolved_profiles
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
                refresh_outcome=(
                    SourceRefreshOutcome.RETRYABLE_FAILURE
                    if response.disposition is FetchDisposition.RETRYABLE_FAILURE
                    else SourceRefreshOutcome.PERMANENT_FAILURE
                ),
                observation=None,
            )
        if response.body is None:
            return LiveSourceResult(
                source_id=definition.source.source_id,
                status=LiveSourceResultStatus.FAILED,
                started_at=started_at,
                completed_at=completed_at,
                reason="live_source_fetched_body_missing",
                refresh_outcome=SourceRefreshOutcome.PERMANENT_FAILURE,
                observation=None,
            )
        try:
            metadata = definition.adapter.parse(
                source=definition.source,
                body=response.body,
                fetched_at=completed_at,
            )
            text = _extract_public_text(response.body)
        except ValueError as error:
            return LiveSourceResult(
                source_id=definition.source.source_id,
                status=LiveSourceResultStatus.FAILED,
                started_at=started_at,
                completed_at=completed_at,
                reason=str(error) or "live_source_metadata_invalid",
                refresh_outcome=SourceRefreshOutcome.PERMANENT_FAILURE,
                observation=None,
            )
        content_sha256 = hashlib.sha256(response.body.encode("utf-8")).hexdigest()
        observation = SourceObservation(
            source_id=definition.source.source_id,
            observed_at=completed_at,
            latest_publication_at=metadata.latest_publication_at,
            last_success_at=completed_at,
            document_count=metadata.document_count,
            consecutive_failures=0,
            observed_topics=metadata.observed_topics,
            content_sha256=content_sha256,
        )
        profile = self._profiles.get(
            definition.source.source_id,
            _fallback_profile(definition.source.source_id, definition.source.owner),
        )
        excerpt = OfficialKnowledgeExcerpt(
            source_id=definition.source.source_id,
            owner=definition.source.owner,
            citation_uri=definition.source.entrypoint_uri,
            citation_label=profile.citation_label,
            geography=profile.geography,
            language=profile.language,
            published_at=metadata.latest_publication_at,
            retrieved_at=completed_at,
            topics=tuple(sorted(topic.value for topic in metadata.observed_topics)),
            text=text,
            content_sha256=content_sha256,
            excerpt_sha256=hashlib.sha256(text.encode("utf-8")).hexdigest(),
        )
        return LiveSourceResult(
            source_id=definition.source.source_id,
            status=LiveSourceResultStatus.OBSERVED,
            started_at=started_at,
            completed_at=completed_at,
            reason="official_source_observed",
            refresh_outcome=SourceRefreshOutcome.SUCCEEDED,
            observation=observation,
            knowledge_excerpt=excerpt,
        )

    def _now(self) -> datetime:
        value = self._clock()
        _aware(value, "clock value")
        return value


def load_public_source_profiles(path: Path) -> dict[str, PublicSourceProfile]:
    try:
        root = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError("cannot load public source profiles") from error
    if not isinstance(root, dict) or not isinstance(root.get("sources"), list):
        raise ValueError("official source catalog has no source array")
    profiles: dict[str, PublicSourceProfile] = {}
    for raw in root["sources"]:
        if not isinstance(raw, dict) or not isinstance(raw.get("source_id"), str):
            raise ValueError("official source profile entry is invalid")
        public = raw.get("public_profile")
        if not isinstance(public, dict):
            raise ValueError("official source public_profile is required")
        source_id = str(raw["source_id"])
        profiles[source_id] = PublicSourceProfile(
            geography=_required_string(public, "geography"),
            language=_required_string(public, "language"),
            citation_label=_required_string(public, "citation_label"),
        )
    return profiles


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
            "refresh_outcome": result.refresh_outcome.value,
            "source_id": result.source_id,
            "started_at": result.started_at.isoformat(),
            "status": result.status.value,
        }
        if result.observation is not None:
            result_payload["content_sha256"] = result.observation.content_sha256
            result_payload["observation_sha256"] = (
                result.observation.observation_sha256
            )
        if result.knowledge_excerpt is not None:
            result_payload["excerpt_sha256"] = result.knowledge_excerpt.excerpt_sha256
        results.append(result_payload)
    return {
        "all_critical_covered": bundle.assessment.all_critical_covered,
        "catalog_sha256": bundle.catalog_sha256,
        "completed_at": bundle.completed_at.isoformat(),
        "coverage_basis_points": bundle.assessment.coverage_basis_points,
        "critical_coverage_basis_points": (
            bundle.assessment.critical_coverage_basis_points
        ),
        "knowledge_excerpt_count": len(bundle.knowledge_excerpts),
        "observed_source_count": len(bundle.observations),
        "repository_sha": bundle.repository_sha,
        "schema_version": "tai.live-official-source-run.v2",
        "source_count": len(bundle.source_results),
        "source_results": results,
        "started_at": bundle.started_at.isoformat(),
        "status": bundle.status.value,
    }


def refresh_events(bundle: LiveEvidenceBundle) -> tuple[SourceRefreshEvent, ...]:
    events: list[SourceRefreshEvent] = []
    for result in bundle.source_results:
        observation = result.observation
        events.append(
            SourceRefreshEvent(
                source_id=result.source_id,
                started_at=result.started_at,
                completed_at=result.completed_at,
                outcome=result.refresh_outcome,
                reason=result.reason,
                observation_sha256=(
                    observation.observation_sha256
                    if observation is not None
                    else None
                ),
                content_sha256=(
                    observation.content_sha256 if observation is not None else None
                ),
                latest_publication_at=(
                    observation.latest_publication_at
                    if observation is not None
                    else None
                ),
                last_success_at=(
                    observation.last_success_at if observation is not None else None
                ),
                document_count=(
                    observation.document_count if observation is not None else None
                ),
                observed_topics=(
                    tuple(
                        sorted(
                            topic.value for topic in observation.observed_topics
                        )
                    )
                    if observation is not None
                    else ()
                ),
            )
        )
    return tuple(events)


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


def public_knowledge_payload(bundle: LiveEvidenceBundle) -> dict[str, object]:
    sources = []
    for excerpt in bundle.knowledge_excerpts:
        sources.append(
            {
                "citation_label": excerpt.citation_label,
                "citation_uri": excerpt.citation_uri,
                "content_sha256": excerpt.content_sha256,
                "excerpt_sha256": excerpt.excerpt_sha256,
                "geography": excerpt.geography,
                "language": excerpt.language,
                "observation_period": {
                    "end": excerpt.published_at.date().isoformat(),
                    "precision": "publication_date",
                    "start": None,
                },
                "owner": excerpt.owner,
                "published_at": excerpt.published_at.isoformat(),
                "retrieved_at": excerpt.retrieved_at.isoformat(),
                "source_id": excerpt.source_id,
                "text": excerpt.text,
                "topics": list(excerpt.topics),
            }
        )
    return {
        "claim_policy": {
            "conflicts": "preserve_each_source_and_disclose_disagreement",
            "current_claims": "require_source_publication_geography_and_retrieval_time",
            "missing_evidence": "abstain_or_request_one_clarification",
            "model_memory": "not_authoritative_for_changing_facts",
        },
        "generated_at": bundle.completed_at.isoformat(),
        "repository_sha": bundle.repository_sha,
        "schema_version": "tai.public-live-knowledge.v1",
        "source_count": len(sources),
        "sources": sources,
    }


def coverage_payload(bundle: LiveEvidenceBundle) -> dict[str, object]:
    return assessment_payload(bundle.assessment)


def evidence_bundle_sha256(bundle: LiveEvidenceBundle) -> str:
    payload = {
        "assessment": coverage_payload(bundle),
        "manifest": run_manifest_payload(bundle),
        "observations": observations_payload(bundle),
        "public_knowledge": public_knowledge_payload(bundle),
    }
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class _VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text_chunks: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        del attrs
        if tag.casefold() in _IGNORED_HTML_TAGS:
            self._ignored_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() in _IGNORED_HTML_TAGS and self._ignored_depth:
            self._ignored_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._ignored_depth:
            return
        compact = " ".join(data.split())
        if compact:
            self.text_chunks.append(compact)


def _extract_public_text(body: str) -> str:
    parser = _VisibleTextParser()
    try:
        parser.feed(body)
        parser.close()
    except Exception as error:
        raise ValueError("source_public_text_parse_failed") from error
    chunks: list[str] = []
    seen: set[str] = set()
    for raw in parser.text_chunks:
        compact = unicodedata.normalize("NFKC", raw).strip()
        if len(compact) < 3 or compact in seen:
            continue
        seen.add(compact)
        chunks.append(compact)
    text = "\n".join(chunks)
    text = "".join(character for character in text if character >= " " or character == "\n")
    text = text[:_MAX_PUBLIC_EXCERPT_CHARS].strip()
    if len(text) < 40:
        raise ValueError("source_public_text_empty")
    return text


def _fallback_profile(source_id: str, owner: str) -> PublicSourceProfile:
    geography = "EAEU" if source_id.startswith("official.eec.") else "Russian Federation"
    return PublicSourceProfile(
        geography=geography,
        language="ru",
        citation_label=owner,
    )


def _required_string(payload: Mapping[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"public source profile {key} is required")
    return value.strip()


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")


def _sha256(value: str, name: str) -> None:
    if re.fullmatch(r"[0-9a-f]{64}", value) is None:
        raise ValueError(f"{name} must be lowercase SHA-256")
