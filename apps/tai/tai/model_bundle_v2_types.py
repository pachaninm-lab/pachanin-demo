from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from pathlib import PurePosixPath

from tai.model_bundle_v2_common import (
    _BINARY_NAMES,
    _RELEASE,
    _argv,
    _bounded_text,
    _https,
    _identity,
    _immutable_locator,
    _parse_timestamp,
    _relative_path,
    _revision,
    _sha256,
    _timestamp,
)
from tai.model_runtime import ModelRuntimeClass


class BundleLifecycle(StrEnum):
    PENDING_ACQUISITION = "PENDING_ACQUISITION"
    COMPLETE = "COMPLETE"


class BundleVerificationStatus(StrEnum):
    PENDING_ACQUISITION = "PENDING_ACQUISITION"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class CandidateRole(StrEnum):
    PRIMARY = "PRIMARY"
    FALLBACK = "FALLBACK"


class SourceFileRole(StrEnum):
    WEIGHT_SHARD = "WEIGHT_SHARD"
    SHARD_INDEX = "SHARD_INDEX"
    TOKENIZER = "TOKENIZER"
    CONFIG = "CONFIG"
    MODEL_CARD = "MODEL_CARD"
    AUXILIARY = "AUXILIARY"


class InventoryDisposition(StrEnum):
    SELECTED = "SELECTED"
    EXCLUDED = "EXCLUDED"


class LegalReviewDecision(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ReviewerType(StrEnum):
    HUMAN = "HUMAN"


class LegalReviewRecordType(StrEnum):
    ATTRIBUTED_RECORD = "ATTRIBUTED_RECORD"
    SIGNED_RECORD = "SIGNED_RECORD"


@dataclass(frozen=True, slots=True)
class DeclaredFile:
    path: str
    sha256: str
    size_bytes: int

    def __post_init__(self) -> None:
        _relative_path(self.path, "declared file path")
        _sha256(self.sha256, "declared file sha256")
        if self.size_bytes < 1:
            raise ValueError("declared file size must be positive")


@dataclass(frozen=True, slots=True)
class AuthorityInventoryEntry:
    path: str
    role: SourceFileRole
    disposition: InventoryDisposition
    exclusion_reason: str | None

    def __post_init__(self) -> None:
        _relative_path(self.path, "authority inventory path")
        if self.disposition is InventoryDisposition.SELECTED:
            if self.exclusion_reason is not None:
                raise ValueError("selected inventory entry cannot have exclusion_reason")
        elif self.exclusion_reason is None or not self.exclusion_reason.strip():
            raise ValueError("excluded inventory entry requires exclusion_reason")


@dataclass(frozen=True, slots=True)
class ConversionPlan:
    intermediate_path: str
    intermediate_format: str
    converter_path: str
    argv: tuple[str, ...]

    def __post_init__(self) -> None:
        _relative_path(self.intermediate_path, "conversion intermediate_path")
        if self.intermediate_format not in {"F16", "BF16"}:
            raise ValueError("conversion intermediate_format must be F16 or BF16")
        _relative_path(self.converter_path, "conversion converter_path")
        _argv(self.argv, "conversion argv")
        if self.intermediate_path not in self.argv:
            raise ValueError("conversion argv must contain intermediate_path")
        if self.converter_path not in self.argv:
            raise ValueError("conversion argv must contain converter_path")


@dataclass(frozen=True, slots=True)
class QuantizationPlan:
    runtime_class: ModelRuntimeClass
    quantization: str
    output_path: str
    argv: tuple[str, ...]

    def __post_init__(self) -> None:
        _identity(self.quantization, "quantization")
        _relative_path(self.output_path, "quantization output_path")
        _argv(self.argv, "quantization argv")
        if self.output_path not in self.argv:
            raise ValueError("quantization argv must contain output_path")
        if self.quantization not in self.argv:
            raise ValueError("quantization argv must contain quantization")


@dataclass(frozen=True, slots=True)
class ToolchainAuthority:
    name: str
    uri: str
    release: str
    commit: str
    profile: str
    authority_sha256: str
    required_binaries: tuple[str, ...]

    def __post_init__(self) -> None:
        _identity(self.name, "toolchain name")
        _https(self.uri, "toolchain uri")
        if _RELEASE.fullmatch(self.release) is None:
            raise ValueError("toolchain release must be a portable immutable tag")
        _revision(self.commit, "toolchain commit")
        _identity(self.profile, "toolchain profile")
        _sha256(self.authority_sha256, "toolchain authority_sha256")
        if set(self.required_binaries) != _BINARY_NAMES:
            raise ValueError("toolchain authority requires exactly four llama.cpp binaries")
        if len(self.required_binaries) != len(set(self.required_binaries)):
            raise ValueError("toolchain required_binaries must be unique")


@dataclass(frozen=True, slots=True)
class ModelBundlePlan:
    role: CandidateRole
    model_id: str
    revision: str
    source_uri: str
    model_card_uri: str
    license_spdx: str
    inventory: tuple[AuthorityInventoryEntry, ...]
    conversion: ConversionPlan
    quantizations: tuple[QuantizationPlan, ...]

    def __post_init__(self) -> None:
        _identity(self.model_id, "model_id")
        _revision(self.revision, "model revision")
        _https(self.source_uri, "source_uri")
        _https(self.model_card_uri, "model_card_uri")
        if self.revision not in self.source_uri:
            raise ValueError("source_uri must contain exact revision")
        if self.revision not in self.model_card_uri:
            raise ValueError("model_card_uri must contain exact revision")
        _identity(self.license_spdx, "license_spdx")
        if not self.inventory:
            raise ValueError("authority inventory must not be empty")
        inventory_paths = tuple(item.path for item in self.inventory)
        if len(inventory_paths) != len(set(inventory_paths)):
            raise ValueError("authority inventory paths must be unique")
        selected = tuple(
            item for item in self.inventory if item.disposition is InventoryDisposition.SELECTED
        )
        roles = {item.role for item in selected}
        required_roles = {
            SourceFileRole.WEIGHT_SHARD,
            SourceFileRole.SHARD_INDEX,
            SourceFileRole.TOKENIZER,
            SourceFileRole.CONFIG,
            SourceFileRole.MODEL_CARD,
        }
        if not required_roles.issubset(roles):
            raise ValueError("selected source inventory is missing a required source role")
        if sum(item.role is SourceFileRole.SHARD_INDEX for item in selected) != 1:
            raise ValueError("selected source inventory requires exactly one shard index")
        outputs = tuple(item.output_path for item in self.quantizations)
        if not outputs or len(outputs) != len(set(outputs)):
            raise ValueError("quantization outputs must be non-empty and unique")
        identities = tuple((item.runtime_class, item.quantization) for item in self.quantizations)
        if len(identities) != len(set(identities)):
            raise ValueError("quantization plan identities must be unique")
        if not any(item.runtime_class is ModelRuntimeClass.CPU for item in self.quantizations):
            raise ValueError("every model plan requires a CPU quantization")

    @property
    def selected_inventory(self) -> tuple[AuthorityInventoryEntry, ...]:
        return tuple(
            item for item in self.inventory if item.disposition is InventoryDisposition.SELECTED
        )


@dataclass(frozen=True, slots=True)
class ModelBundleAuthority:
    toolchain: ToolchainAuthority
    models: tuple[ModelBundlePlan, ...]

    def __post_init__(self) -> None:
        if not self.models:
            raise ValueError("model bundle authority must not be empty")
        identities = tuple((item.model_id, item.revision) for item in self.models)
        if len(identities) != len(set(identities)):
            raise ValueError("model bundle authority identities must be unique")
        roles = tuple(item.role for item in self.models)
        if roles.count(CandidateRole.PRIMARY) != 1:
            raise ValueError("model bundle authority requires exactly one primary")
        if CandidateRole.FALLBACK not in roles:
            raise ValueError("model bundle authority requires at least one fallback")


@dataclass(frozen=True, slots=True)
class ObservedRemoteFile:
    path: str
    size_bytes: int
    remote_identity: str

    def __post_init__(self) -> None:
        _relative_path(self.path, "remote inventory path")
        if self.size_bytes < 1:
            raise ValueError("remote inventory size must be positive")
        _bounded_text(self.remote_identity, "remote_identity", maximum=300)


@dataclass(frozen=True, slots=True)
class RemoteInventoryEvidence:
    model_id: str
    revision: str
    source_uri: str
    observed_at: str
    evidence_file: DeclaredFile
    entries: tuple[ObservedRemoteFile, ...]

    def __post_init__(self) -> None:
        _identity(self.model_id, "remote inventory model_id")
        _revision(self.revision, "remote inventory revision")
        _https(self.source_uri, "remote inventory source_uri")
        if self.revision not in self.source_uri:
            raise ValueError("remote inventory source_uri must contain exact revision")
        _timestamp(self.observed_at, "remote inventory observed_at")
        if not self.entries:
            raise ValueError("remote inventory entries must not be empty")
        paths = tuple(item.path for item in self.entries)
        if len(paths) != len(set(paths)):
            raise ValueError("remote inventory entries must have unique paths")


@dataclass(frozen=True, slots=True)
class DeclaredSourceFile:
    path: str
    role: SourceFileRole
    sha256: str
    size_bytes: int

    def __post_init__(self) -> None:
        _relative_path(self.path, "source file path")
        _sha256(self.sha256, "source file sha256")
        if self.size_bytes < 1:
            raise ValueError("source file size must be positive")

    @property
    def file(self) -> DeclaredFile:
        return DeclaredFile(self.path, self.sha256, self.size_bytes)


@dataclass(frozen=True, slots=True)
class LegalReviewEvidence:
    decision: LegalReviewDecision
    reviewer_type: ReviewerType
    reviewer_id: str
    reviewer_name: str
    reviewed_at: str
    license_spdx: str
    decision_basis: str
    conditions: tuple[str, ...]
    record_type: LegalReviewRecordType
    attestation_reference: str
    license_text: DeclaredFile
    review_record: DeclaredFile

    def __post_init__(self) -> None:
        _identity(self.reviewer_id, "legal reviewer_id")
        _bounded_text(self.reviewer_name, "legal reviewer_name", maximum=200)
        _timestamp(self.reviewed_at, "legal reviewed_at")
        _identity(self.license_spdx, "legal license_spdx")
        _bounded_text(self.decision_basis, "legal decision_basis", maximum=2_000)
        if len(self.conditions) > 32 or len(self.conditions) != len(set(self.conditions)):
            raise ValueError("legal review conditions must be bounded and unique")
        for condition in self.conditions:
            _bounded_text(condition, "legal review condition", maximum=1_000)
        _immutable_locator(self.attestation_reference)


@dataclass(frozen=True, slots=True)
class ToolchainBinaryEvidence:
    name: str
    file: DeclaredFile

    def __post_init__(self) -> None:
        if self.name not in _BINARY_NAMES:
            raise ValueError("unsupported toolchain binary name")
        if PurePosixPath(self.file.path).name != self.name:
            raise ValueError("toolchain binary path basename must equal binary name")


@dataclass(frozen=True, slots=True)
class ToolchainPackageEvidence:
    name: str
    release: str
    commit: str
    profile: str
    authority_sha256: str
    package: DeclaredFile
    build_manifest: DeclaredFile
    verification_report: DeclaredFile
    verification_status: str
    immutable_locator: str
    binaries: tuple[ToolchainBinaryEvidence, ...]

    def __post_init__(self) -> None:
        _identity(self.name, "toolchain package name")
        if _RELEASE.fullmatch(self.release) is None:
            raise ValueError("toolchain package release is invalid")
        _revision(self.commit, "toolchain package commit")
        _identity(self.profile, "toolchain package profile")
        _sha256(self.authority_sha256, "toolchain package authority_sha256")
        if self.verification_status != "VERIFIED":
            raise ValueError("toolchain package verification_status must be VERIFIED")
        _immutable_locator(self.immutable_locator)
        names = tuple(item.name for item in self.binaries)
        if set(names) != _BINARY_NAMES or len(names) != len(set(names)):
            raise ValueError("toolchain package requires exactly four unique binaries")


@dataclass(frozen=True, slots=True)
class ConversionEvidence:
    python_identity: str
    python_dependencies: DeclaredFile
    converter: DeclaredFile
    argv: tuple[str, ...]
    log: DeclaredFile
    intermediate: DeclaredFile
    source_files_sha256: str
    toolchain_package_sha256: str

    def __post_init__(self) -> None:
        _bounded_text(self.python_identity, "python_identity", maximum=500)
        _argv(self.argv, "conversion evidence argv")
        _sha256(self.source_files_sha256, "source_files_sha256")
        _sha256(self.toolchain_package_sha256, "toolchain_package_sha256")


@dataclass(frozen=True, slots=True)
class QuantizationEvidence:
    runtime_class: ModelRuntimeClass
    quantization: str
    argv: tuple[str, ...]
    log: DeclaredFile
    output: DeclaredFile
    input_sha256: str
    quantize_binary_sha256: str

    def __post_init__(self) -> None:
        _identity(self.quantization, "quantization evidence quantization")
        _argv(self.argv, "quantization evidence argv")
        _sha256(self.input_sha256, "quantization input_sha256")
        _sha256(self.quantize_binary_sha256, "quantize_binary_sha256")


@dataclass(frozen=True, slots=True)
class StorageEvidence:
    bundle_archive: DeclaredFile
    payload_index: DeclaredFile
    immutable_locator: str
    uploaded_at: str
    retention_days: int
    retention_expires_at: str
    restored_at: str
    upload_record: DeclaredFile
    restore_record: DeclaredFile

    def __post_init__(self) -> None:
        _immutable_locator(self.immutable_locator)
        uploaded = _parse_timestamp(self.uploaded_at, "storage uploaded_at")
        expires = _parse_timestamp(self.retention_expires_at, "storage retention_expires_at")
        restored = _parse_timestamp(self.restored_at, "storage restored_at")
        if self.retention_days < 1 or self.retention_days > 3_650:
            raise ValueError("storage retention_days must be between 1 and 3650")
        if expires <= uploaded:
            raise ValueError("storage retention_expires_at must follow uploaded_at")
        if restored < uploaded:
            raise ValueError("storage restored_at must not precede uploaded_at")


@dataclass(frozen=True, slots=True)
class LocalModelBundleV2:
    lifecycle: BundleLifecycle
    role: CandidateRole
    model_id: str
    revision: str
    authority_sha256: str
    remote_inventory: RemoteInventoryEvidence | None
    source_files: tuple[DeclaredSourceFile, ...]
    legal_review: LegalReviewEvidence | None
    toolchain_package: ToolchainPackageEvidence | None
    conversion: ConversionEvidence | None
    quantizations: tuple[QuantizationEvidence, ...]
    storage: StorageEvidence | None

    def __post_init__(self) -> None:
        _identity(self.model_id, "bundle model_id")
        _revision(self.revision, "bundle revision")
        _sha256(self.authority_sha256, "bundle authority_sha256")
        source_paths = tuple(item.path for item in self.source_files)
        if len(source_paths) != len(set(source_paths)):
            raise ValueError("bundle source file paths must be unique")
        quantization_ids = tuple(
            (item.runtime_class, item.quantization) for item in self.quantizations
        )
        if len(quantization_ids) != len(set(quantization_ids)):
            raise ValueError("bundle quantization evidence identities must be unique")
        if self.lifecycle is BundleLifecycle.PENDING_ACQUISITION and any(
            (
                self.remote_inventory is not None,
                bool(self.source_files),
                self.legal_review is not None,
                self.toolchain_package is not None,
                self.conversion is not None,
                bool(self.quantizations),
                self.storage is not None,
            )
        ):
            raise ValueError("PENDING_ACQUISITION baseline must not contain fabricated evidence")


@dataclass(frozen=True, slots=True)
class BundleVerificationReportV2:
    model_id: str
    revision: str
    status: BundleVerificationStatus
    reasons: tuple[str, ...]
    verified_files: tuple[str, ...]
    restored_files: tuple[str, ...]
    authority_sha256: str
    manifest_sha256: str
    report_sha256: str

    @property
    def verified(self) -> bool:
        return self.status is BundleVerificationStatus.VERIFIED


@dataclass(slots=True)
class _VerificationState:
    reasons: list[str]
    verified: list[str]
    restored: list[str]
    original_inodes: set[tuple[int, int]]
    restored_inodes: set[tuple[int, int]]
