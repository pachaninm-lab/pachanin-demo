from __future__ import annotations

from dataclasses import dataclass

from tai.model_bundle_v2_common import (
    _bounded_text,
    _identity,
    _parse_timestamp,
    _relative_path,
    _revision,
    _sha256,
)
from tai.model_bundle_v2_types import CandidateRole


@dataclass(frozen=True, slots=True)
class SourceAcceptanceReference:
    path: str
    git_blob_sha: str
    accepted_main_sha: str
    source_exact_main_sha: str
    model_bundle_authority_sha256: str
    status: str

    def __post_init__(self) -> None:
        _relative_path(self.path, "source acceptance path")
        _revision(self.git_blob_sha, "source acceptance git blob sha")
        _revision(self.accepted_main_sha, "source acceptance accepted main sha")
        _revision(self.source_exact_main_sha, "source acquisition exact main sha")
        _sha256(
            self.model_bundle_authority_sha256,
            "source acceptance model bundle authority sha256",
        )
        if self.status != "VERIFIED_SOURCE_RESTORED_LEGAL_PENDING":
            raise ValueError("source acceptance status must remain legal-pending")


@dataclass(frozen=True, slots=True)
class LegalReviewToolchain:
    name: str
    release: str
    commit: str
    authority_sha256: str

    def __post_init__(self) -> None:
        _identity(self.name, "legal review toolchain name")
        _identity(self.release, "legal review toolchain release")
        _revision(self.commit, "legal review toolchain commit")
        _sha256(self.authority_sha256, "legal review toolchain authority sha256")


@dataclass(frozen=True, slots=True)
class IntendedUse:
    product: str
    platform: str
    use_class: str
    operation_scope: str
    conversion_toolchain: LegalReviewToolchain
    source_weight_redistribution: bool
    community_prebuilt_artifacts: bool
    benchmark_or_admission_claim: bool
    production_readiness_claim: bool

    def __post_init__(self) -> None:
        _bounded_text(self.product, "intended use product", maximum=200)
        _bounded_text(self.platform, "intended use platform", maximum=200)
        _identity(self.use_class, "intended use class")
        _identity(self.operation_scope, "intended use operation scope")
        if self.source_weight_redistribution:
            raise ValueError("source weight redistribution must remain disabled")
        if self.community_prebuilt_artifacts:
            raise ValueError("community prebuilt artifacts must remain disabled")
        if self.benchmark_or_admission_claim:
            raise ValueError("legal review cannot make benchmark or admission claims")
        if self.production_readiness_claim:
            raise ValueError("legal review cannot make production readiness claims")


@dataclass(frozen=True, slots=True)
class LegalReviewModelPlan:
    role: CandidateRole
    model_id: str
    revision: str
    license_spdx: str
    model_card_sha256: str
    license_text_sha256: str
    legal_packet_sha256: str
    source_manifest_sha256: str
    source_files_sha256: str
    review_record_path: str
    attestation_path: str

    def __post_init__(self) -> None:
        _identity(self.model_id, "legal review model id")
        _revision(self.revision, "legal review model revision")
        _identity(self.license_spdx, "legal review license SPDX")
        for value, name in (
            (self.model_card_sha256, "model card sha256"),
            (self.license_text_sha256, "license text sha256"),
            (self.legal_packet_sha256, "legal packet sha256"),
            (self.source_manifest_sha256, "source manifest sha256"),
            (self.source_files_sha256, "source files sha256"),
        ):
            _sha256(value, name)
        _relative_path(self.review_record_path, "legal review record path")
        _relative_path(self.attestation_path, "legal review attestation path")
        if self.review_record_path == self.attestation_path:
            raise ValueError("legal review record and attestation paths must differ")


@dataclass(frozen=True, slots=True)
class ModelLegalReviewAuthority:
    program_issue: int
    parent_issue: int
    issue: int
    source_acceptance: SourceAcceptanceReference
    review_not_before: str
    intended_use: IntendedUse
    reviewer_type: str
    reviewer_identity_prefixes: tuple[str, ...]
    attributed_record_issue: int
    accepted_decisions: tuple[str, ...]
    accepted_record_types: tuple[str, ...]
    models: tuple[LegalReviewModelPlan, ...]
    maturity_boundary: dict[str, str]

    def __post_init__(self) -> None:
        if (self.program_issue, self.parent_issue, self.issue) != (2726, 2835, 2877):
            raise ValueError("legal review issue chain is invalid")
        _parse_timestamp(self.review_not_before, "legal review not-before timestamp")
        if self.reviewer_type != "HUMAN":
            raise ValueError("legal reviewer type must be HUMAN")
        if not self.reviewer_identity_prefixes:
            raise ValueError("legal reviewer identity prefixes must not be empty")
        if len(self.reviewer_identity_prefixes) != len(set(self.reviewer_identity_prefixes)):
            raise ValueError("legal reviewer identity prefixes must be unique")
        if any(not item.endswith(":") or len(item) > 40 for item in self.reviewer_identity_prefixes):
            raise ValueError("legal reviewer identity prefix is invalid")
        if self.attributed_record_issue != self.issue:
            raise ValueError("attributed record issue must equal legal review issue")
        if set(self.accepted_decisions) != {"APPROVED", "REJECTED"}:
            raise ValueError("legal review authority requires APPROVED and REJECTED")
        if set(self.accepted_record_types) != {"ATTRIBUTED_RECORD", "SIGNED_RECORD"}:
            raise ValueError("legal review authority requires both record types")
        if len(self.models) != 2:
            raise ValueError("legal review authority requires exactly two models")
        if len({(item.model_id, item.revision) for item in self.models}) != 2:
            raise ValueError("legal review model identities must be unique")
        if {item.role for item in self.models} != {
            CandidateRole.PRIMARY,
            CandidateRole.FALLBACK,
        }:
            raise ValueError("legal review authority requires primary and fallback")
        expected = {
            "legal_decision": "PENDING_HUMAN_DECISION",
            "conversion": "NOT_RUN",
            "quantization": "NOT_RUN",
            "benchmarks": "NOT_RUN",
            "model_admission": "NOT_DONE",
            "production_operational_status": "NOT_ATTESTED",
        }
        if self.maturity_boundary != expected:
            raise ValueError("legal review maturity boundary is invalid")
