from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from hashlib import sha256
from urllib.parse import urlparse


class SourceAuthority(StrEnum):
    OFFICIAL = "OFFICIAL"
    SCIENTIFIC = "SCIENTIFIC"
    INDUSTRY = "INDUSTRY"
    INTERNAL = "INTERNAL"


class KnowledgeDomain(StrEnum):
    REGULATION = "REGULATION"
    MARKET = "MARKET"
    AGRONOMY = "AGRONOMY"
    LOGISTICS = "LOGISTICS"
    QUALITY = "QUALITY"
    FINANCE = "FINANCE"
    PLATFORM = "PLATFORM"


class AdmissionStatus(StrEnum):
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


@dataclass(frozen=True, slots=True)
class SourcePolicy:
    source_id: str
    authority: SourceAuthority
    domains: frozenset[KnowledgeDomain]
    allowed_hosts: frozenset[str]
    maximum_age: timedelta
    minimum_trust_score: float
    requires_effective_date: bool = True


@dataclass(frozen=True, slots=True)
class SourceDocument:
    source_id: str
    source_uri: str
    title: str
    body: str
    published_at: datetime | None
    effective_at: datetime | None
    fetched_at: datetime
    trust_score: float
    domain: KnowledgeDomain
    checksum_sha256: str

    @classmethod
    def build(
        cls,
        *,
        source_id: str,
        source_uri: str,
        title: str,
        body: str,
        published_at: datetime | None,
        effective_at: datetime | None,
        fetched_at: datetime,
        trust_score: float,
        domain: KnowledgeDomain,
    ) -> SourceDocument:
        checksum = sha256(body.encode("utf-8")).hexdigest()
        return cls(
            source_id=source_id,
            source_uri=source_uri,
            title=title,
            body=body,
            published_at=published_at,
            effective_at=effective_at,
            fetched_at=fetched_at,
            trust_score=trust_score,
            domain=domain,
            checksum_sha256=checksum,
        )


@dataclass(frozen=True, slots=True)
class AdmissionDecision:
    status: AdmissionStatus
    reasons: tuple[str, ...]
    document: SourceDocument

    @property
    def accepted(self) -> bool:
        return self.status is AdmissionStatus.ACCEPTED


class SourceRegistry:
    def __init__(self, policies: tuple[SourcePolicy, ...]) -> None:
        self._policies = {policy.source_id: policy for policy in policies}

    def policy_for(self, source_id: str) -> SourcePolicy | None:
        return self._policies.get(source_id)

    def admit(self, document: SourceDocument, *, now: datetime | None = None) -> AdmissionDecision:
        reference_time = now or datetime.now(UTC)
        reasons: list[str] = []
        policy = self.policy_for(document.source_id)

        if policy is None:
            reasons.append("source_not_registered")
            return AdmissionDecision(AdmissionStatus.REJECTED, tuple(reasons), document)

        parsed = urlparse(document.source_uri)
        if parsed.scheme not in {"https", "repo"}:
            reasons.append("unsupported_source_scheme")
        if parsed.scheme == "https" and parsed.hostname not in policy.allowed_hosts:
            reasons.append("source_host_not_allowed")
        if document.domain not in policy.domains:
            reasons.append("domain_not_allowed")
        if document.trust_score < policy.minimum_trust_score:
            reasons.append("trust_score_below_policy")
        if not document.title.strip() or not document.body.strip():
            reasons.append("empty_document")
        if policy.requires_effective_date and document.effective_at is None:
            reasons.append("effective_date_required")
        if document.fetched_at > reference_time + timedelta(minutes=5):
            reasons.append("fetched_at_in_future")
        if reference_time - document.fetched_at > policy.maximum_age:
            reasons.append("document_stale")
        expected_checksum = sha256(document.body.encode("utf-8")).hexdigest()
        if document.checksum_sha256 != expected_checksum:
            reasons.append("checksum_mismatch")

        status = AdmissionStatus.ACCEPTED if not reasons else AdmissionStatus.REJECTED
        return AdmissionDecision(status, tuple(reasons), document)


DEFAULT_AGRO_SOURCE_REGISTRY = SourceRegistry(
    (
        SourcePolicy(
            source_id="official.minselhoz",
            authority=SourceAuthority.OFFICIAL,
            domains=frozenset(
                {
                    KnowledgeDomain.REGULATION,
                    KnowledgeDomain.MARKET,
                    KnowledgeDomain.AGRONOMY,
                }
            ),
            allowed_hosts=frozenset({"mcx.gov.ru"}),
            maximum_age=timedelta(days=31),
            minimum_trust_score=0.95,
        ),
        SourcePolicy(
            source_id="official.rosstat",
            authority=SourceAuthority.OFFICIAL,
            domains=frozenset({KnowledgeDomain.MARKET}),
            allowed_hosts=frozenset({"rosstat.gov.ru"}),
            maximum_age=timedelta(days=45),
            minimum_trust_score=0.95,
        ),
        SourcePolicy(
            source_id="internal.platform",
            authority=SourceAuthority.INTERNAL,
            domains=frozenset({KnowledgeDomain.PLATFORM}),
            allowed_hosts=frozenset(),
            maximum_age=timedelta(days=14),
            minimum_trust_score=1.0,
        ),
    )
)
