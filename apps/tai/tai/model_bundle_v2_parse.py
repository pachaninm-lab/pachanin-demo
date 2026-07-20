from __future__ import annotations

from pathlib import Path

from tai.model_bundle_v2_common import (
    _array,
    _expect_keys,
    _integer,
    _load_json_strict,
    _nullable_string,
    _object,
    _optional_object,
    _string,
    _strings,
)
from tai.model_bundle_v2_types import (
    AuthorityInventoryEntry,
    BundleLifecycle,
    CandidateRole,
    ConversionEvidence,
    ConversionPlan,
    DeclaredFile,
    DeclaredSourceFile,
    InventoryDisposition,
    LegalReviewDecision,
    LegalReviewEvidence,
    LocalModelBundleV2,
    ModelBundleAuthority,
    ModelBundlePlan,
    ObservedRemoteFile,
    QuantizationEvidence,
    QuantizationPlan,
    RemoteInventoryEvidence,
    ReviewerType,
    SourceFileRole,
    StorageEvidence,
    ToolchainAuthority,
    ToolchainBinaryEvidence,
    ToolchainPackageEvidence,
)
from tai.model_runtime import ModelRuntimeClass


def load_model_bundle_authority_v2(path: Path) -> ModelBundleAuthority:
    payload = _load_json_strict(path)
    _expect_keys(payload, {"schema_version", "toolchain", "models"}, set(), "authority")
    if _string(payload, "schema_version") != "tai.model-bundle-authority.v2":
        raise ValueError("unsupported model bundle authority schema")
    return ModelBundleAuthority(
        toolchain=_toolchain_authority(payload.get("toolchain")),
        models=tuple(_model_plan(item) for item in _array(payload, "models")),
    )


def load_local_model_bundle_v2(path: Path) -> LocalModelBundleV2:
    payload = _load_json_strict(path)
    _expect_keys(
        payload,
        {
            "schema_version",
            "lifecycle",
            "role",
            "model_id",
            "revision",
            "authority_sha256",
            "remote_inventory",
            "source_files",
            "legal_review",
            "toolchain_package",
            "conversion",
            "quantizations",
            "storage",
        },
        set(),
        "bundle",
    )
    if _string(payload, "schema_version") != "tai.local-model-artifact-bundle.v2":
        raise ValueError("unsupported local model bundle schema")
    return LocalModelBundleV2(
        lifecycle=BundleLifecycle(_string(payload, "lifecycle")),
        role=CandidateRole(_string(payload, "role")),
        model_id=_string(payload, "model_id"),
        revision=_string(payload, "revision"),
        authority_sha256=_string(payload, "authority_sha256"),
        remote_inventory=_optional_object(
            payload, "remote_inventory", _remote_inventory
        ),
        source_files=tuple(
            _source_file(item) for item in _array(payload, "source_files")
        ),
        legal_review=_optional_object(payload, "legal_review", _legal_review),
        toolchain_package=_optional_object(
            payload, "toolchain_package", _toolchain_package
        ),
        conversion=_optional_object(payload, "conversion", _conversion),
        quantizations=tuple(
            _quantization_evidence(item) for item in _array(payload, "quantizations")
        ),
        storage=_optional_object(payload, "storage", _storage),
    )


def _toolchain_authority(value: object) -> ToolchainAuthority:
    payload = _object(value, "toolchain authority")
    _expect_keys(
        payload,
        {
            "name",
            "uri",
            "release",
            "commit",
            "profile",
            "authority_sha256",
            "required_binaries",
        },
        set(),
        "toolchain authority",
    )
    return ToolchainAuthority(
        name=_string(payload, "name"),
        uri=_string(payload, "uri"),
        release=_string(payload, "release"),
        commit=_string(payload, "commit"),
        profile=_string(payload, "profile"),
        authority_sha256=_string(payload, "authority_sha256"),
        required_binaries=tuple(_strings(payload, "required_binaries")),
    )


def _model_plan(value: object) -> ModelBundlePlan:
    payload = _object(value, "model plan")
    _expect_keys(
        payload,
        {
            "role",
            "model_id",
            "revision",
            "source_uri",
            "model_card_uri",
            "license_spdx",
            "source_inventory",
            "conversion",
            "quantizations",
        },
        set(),
        "model plan",
    )
    return ModelBundlePlan(
        role=CandidateRole(_string(payload, "role")),
        model_id=_string(payload, "model_id"),
        revision=_string(payload, "revision"),
        source_uri=_string(payload, "source_uri"),
        model_card_uri=_string(payload, "model_card_uri"),
        license_spdx=_string(payload, "license_spdx"),
        inventory=tuple(
            _authority_inventory_entry(item)
            for item in _array(payload, "source_inventory")
        ),
        conversion=_conversion_plan(payload.get("conversion")),
        quantizations=tuple(
            _quantization_plan(item) for item in _array(payload, "quantizations")
        ),
    )


def _authority_inventory_entry(value: object) -> AuthorityInventoryEntry:
    payload = _object(value, "authority inventory entry")
    _expect_keys(
        payload,
        {"path", "role", "disposition", "exclusion_reason"},
        set(),
        "authority inventory entry",
    )
    return AuthorityInventoryEntry(
        path=_string(payload, "path"),
        role=SourceFileRole(_string(payload, "role")),
        disposition=InventoryDisposition(_string(payload, "disposition")),
        exclusion_reason=_nullable_string(payload, "exclusion_reason"),
    )


def _conversion_plan(value: object) -> ConversionPlan:
    payload = _object(value, "conversion plan")
    _expect_keys(
        payload,
        {"intermediate_path", "intermediate_format", "converter_path", "argv"},
        set(),
        "conversion plan",
    )
    return ConversionPlan(
        intermediate_path=_string(payload, "intermediate_path"),
        intermediate_format=_string(payload, "intermediate_format"),
        converter_path=_string(payload, "converter_path"),
        argv=tuple(_strings(payload, "argv")),
    )


def _quantization_plan(value: object) -> QuantizationPlan:
    payload = _object(value, "quantization plan")
    _expect_keys(
        payload,
        {"runtime_class", "quantization", "output_path", "argv"},
        set(),
        "quantization plan",
    )
    return QuantizationPlan(
        runtime_class=ModelRuntimeClass(_string(payload, "runtime_class")),
        quantization=_string(payload, "quantization"),
        output_path=_string(payload, "output_path"),
        argv=tuple(_strings(payload, "argv")),
    )


def _remote_inventory(value: object) -> RemoteInventoryEvidence:
    payload = _object(value, "remote inventory")
    _expect_keys(
        payload,
        {"observed_at", "evidence_file", "entries"},
        set(),
        "remote inventory",
    )
    return RemoteInventoryEvidence(
        observed_at=_string(payload, "observed_at"),
        evidence_file=_declared_file(payload.get("evidence_file")),
        entries=tuple(_observed_remote_file(item) for item in _array(payload, "entries")),
    )


def _observed_remote_file(value: object) -> ObservedRemoteFile:
    payload = _object(value, "remote inventory entry")
    _expect_keys(
        payload,
        {"path", "size_bytes", "remote_identity"},
        set(),
        "remote inventory entry",
    )
    return ObservedRemoteFile(
        path=_string(payload, "path"),
        size_bytes=_integer(payload, "size_bytes"),
        remote_identity=_string(payload, "remote_identity"),
    )


def _source_file(value: object) -> DeclaredSourceFile:
    payload = _object(value, "source file")
    _expect_keys(
        payload,
        {"path", "role", "sha256", "size_bytes"},
        set(),
        "source file",
    )
    return DeclaredSourceFile(
        path=_string(payload, "path"),
        role=SourceFileRole(_string(payload, "role")),
        sha256=_string(payload, "sha256"),
        size_bytes=_integer(payload, "size_bytes"),
    )


def _legal_review(value: object) -> LegalReviewEvidence:
    payload = _object(value, "legal review")
    _expect_keys(
        payload,
        {
            "decision",
            "reviewer_type",
            "reviewer_id",
            "reviewer_name",
            "reviewed_at",
            "license_spdx",
            "decision_basis",
            "license_text",
            "review_record",
        },
        set(),
        "legal review",
    )
    return LegalReviewEvidence(
        decision=LegalReviewDecision(_string(payload, "decision")),
        reviewer_type=ReviewerType(_string(payload, "reviewer_type")),
        reviewer_id=_string(payload, "reviewer_id"),
        reviewer_name=_string(payload, "reviewer_name"),
        reviewed_at=_string(payload, "reviewed_at"),
        license_spdx=_string(payload, "license_spdx"),
        decision_basis=_string(payload, "decision_basis"),
        license_text=_declared_file(payload.get("license_text")),
        review_record=_declared_file(payload.get("review_record")),
    )


def _toolchain_package(value: object) -> ToolchainPackageEvidence:
    payload = _object(value, "toolchain package")
    _expect_keys(
        payload,
        {
            "name",
            "release",
            "commit",
            "profile",
            "authority_sha256",
            "package",
            "build_manifest",
            "verification_report",
            "verification_status",
            "immutable_locator",
            "binaries",
        },
        set(),
        "toolchain package",
    )
    return ToolchainPackageEvidence(
        name=_string(payload, "name"),
        release=_string(payload, "release"),
        commit=_string(payload, "commit"),
        profile=_string(payload, "profile"),
        authority_sha256=_string(payload, "authority_sha256"),
        package=_declared_file(payload.get("package")),
        build_manifest=_declared_file(payload.get("build_manifest")),
        verification_report=_declared_file(payload.get("verification_report")),
        verification_status=_string(payload, "verification_status"),
        immutable_locator=_string(payload, "immutable_locator"),
        binaries=tuple(
            _toolchain_binary(item) for item in _array(payload, "binaries")
        ),
    )


def _toolchain_binary(value: object) -> ToolchainBinaryEvidence:
    payload = _object(value, "toolchain binary")
    _expect_keys(payload, {"name", "file"}, set(), "toolchain binary")
    return ToolchainBinaryEvidence(
        name=_string(payload, "name"),
        file=_declared_file(payload.get("file")),
    )


def _conversion(value: object) -> ConversionEvidence:
    payload = _object(value, "conversion evidence")
    _expect_keys(
        payload,
        {
            "python_identity",
            "python_dependencies",
            "converter",
            "argv",
            "log",
            "intermediate",
            "source_files_sha256",
            "toolchain_package_sha256",
        },
        set(),
        "conversion evidence",
    )
    return ConversionEvidence(
        python_identity=_string(payload, "python_identity"),
        python_dependencies=_declared_file(payload.get("python_dependencies")),
        converter=_declared_file(payload.get("converter")),
        argv=tuple(_strings(payload, "argv")),
        log=_declared_file(payload.get("log")),
        intermediate=_declared_file(payload.get("intermediate")),
        source_files_sha256=_string(payload, "source_files_sha256"),
        toolchain_package_sha256=_string(payload, "toolchain_package_sha256"),
    )


def _quantization_evidence(value: object) -> QuantizationEvidence:
    payload = _object(value, "quantization evidence")
    _expect_keys(
        payload,
        {
            "runtime_class",
            "quantization",
            "argv",
            "log",
            "output",
            "input_sha256",
            "quantize_binary_sha256",
        },
        set(),
        "quantization evidence",
    )
    return QuantizationEvidence(
        runtime_class=ModelRuntimeClass(_string(payload, "runtime_class")),
        quantization=_string(payload, "quantization"),
        argv=tuple(_strings(payload, "argv")),
        log=_declared_file(payload.get("log")),
        output=_declared_file(payload.get("output")),
        input_sha256=_string(payload, "input_sha256"),
        quantize_binary_sha256=_string(payload, "quantize_binary_sha256"),
    )


def _storage(value: object) -> StorageEvidence:
    payload = _object(value, "storage evidence")
    _expect_keys(
        payload,
        {
            "bundle_archive",
            "payload_index",
            "immutable_locator",
            "upload_record",
            "restore_record",
        },
        set(),
        "storage evidence",
    )
    return StorageEvidence(
        bundle_archive=_declared_file(payload.get("bundle_archive")),
        payload_index=_declared_file(payload.get("payload_index")),
        immutable_locator=_string(payload, "immutable_locator"),
        upload_record=_declared_file(payload.get("upload_record")),
        restore_record=_declared_file(payload.get("restore_record")),
    )


def _declared_file(value: object) -> DeclaredFile:
    payload = _object(value, "declared file")
    _expect_keys(payload, {"path", "sha256", "size_bytes"}, set(), "declared file")
    return DeclaredFile(
        path=_string(payload, "path"),
        sha256=_string(payload, "sha256"),
        size_bytes=_integer(payload, "size_bytes"),
    )
