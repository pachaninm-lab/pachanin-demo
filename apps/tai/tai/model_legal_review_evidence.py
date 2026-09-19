from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from tai.model_bundle_v2_common import (
    _bounded_text,
    _identity,
    _immutable_locator,
    _parse_timestamp,
    _revision,
    _sha256,
)
from tai.model_bundle_v2_types import CandidateRole, DeclaredFile


class HumanLegalDecision(StrEnum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class HumanLegalRecordType(StrEnum):
    ATTRIBUTED_RECORD = "ATTRIBUTED_RECORD"
    SIGNED_RECORD = "SIGNED_RECORD"


class HumanLegalReviewStatus(StrEnum):
    PENDING_HUMAN_DECISION = "PENDING_HUMAN_DECISION"
    APPROVED_FOR_CONVERSION = "APPROVED_FOR_CONVERSION"
    REJECTED = "REJECTED"
    INVALID = "INVALID"


@dataclass(frozen=True, slots=True)
class HumanLegalReviewRecord:
    decision: HumanLegalDecision
    reviewer_type: str
    reviewer_id: str
    reviewer_name: str
    reviewed_at: str
    license_spdx: str
    decision_basis: str
    conditions: tuple[str, ...]
    record_type: HumanLegalRecordType
    attestation_reference: str
    license_text_sha256: str

    def __post_init__(self) -> None:
        if self.reviewer_type != "HUMAN":
            raise ValueError("legal review record reviewer_type must be HUMAN")
        _identity(self.reviewer_id, "legal reviewer id")
        _bounded_text(self.reviewer_name, "legal reviewer name", maximum=200)
        _parse_timestamp(self.reviewed_at, "legal reviewed_at")
        _identity(self.license_spdx, "legal review license SPDX")
        _bounded_text(self.decision_basis, "legal decision basis", maximum=2_000)
        if len(self.conditions) > 32 or len(self.conditions) != len(set(self.conditions)):
            raise ValueError("legal review conditions must be bounded and unique")
        for condition in self.conditions:
            _bounded_text(condition, "legal review condition", maximum=1_000)
        _immutable_locator(self.attestation_reference)
        _sha256(self.license_text_sha256, "legal review license text sha256")


@dataclass(frozen=True, slots=True)
class HumanLegalReviewAttestation:
    authority_sha256: str
    model_id: str
    revision: str
    role: CandidateRole
    source_acceptance_exact_main_sha: str
    source_acceptance_git_blob_sha: str
    model_card_sha256: str
    license_text_sha256: str
    legal_packet_sha256: str
    source_manifest_sha256: str
    source_files_sha256: str
    intended_use_sha256: str
    review_record: DeclaredFile
    decision: HumanLegalDecision
    reviewer_id: str
    reviewed_at: str
    attestation_reference: str

    def __post_init__(self) -> None:
        _sha256(self.authority_sha256, "legal review authority sha256")
        _identity(self.model_id, "legal review attestation model id")
        _revision(self.revision, "legal review attestation revision")
        _revision(self.source_acceptance_exact_main_sha, "source acceptance exact main")
        _revision(self.source_acceptance_git_blob_sha, "source acceptance git blob")
        for value, name in (
            (self.model_card_sha256, "attestation model card sha256"),
            (self.license_text_sha256, "attestation license text sha256"),
            (self.legal_packet_sha256, "attestation legal packet sha256"),
            (self.source_manifest_sha256, "attestation source manifest sha256"),
            (self.source_files_sha256, "attestation source files sha256"),
            (self.intended_use_sha256, "attestation intended use sha256"),
        ):
            _sha256(value, name)
        _identity(self.reviewer_id, "legal review attestation reviewer id")
        _parse_timestamp(self.reviewed_at, "legal review attestation reviewed_at")
        _immutable_locator(self.attestation_reference)


@dataclass(frozen=True, slots=True)
class ModelLegalReviewReport:
    model_id: str
    revision: str
    role: CandidateRole
    status: HumanLegalReviewStatus
    valid_record: bool
    conversion_allowed: bool
    decision: HumanLegalDecision | None
    reviewer_id: str | None
    reviewed_at: str | None
    review_record_sha256: str | None
    attestation_sha256: str | None
    reasons: tuple[str, ...]
    authority_sha256: str
    intended_use_sha256: str
