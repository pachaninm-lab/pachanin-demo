from __future__ import annotations

from tai.model_bundle_v2_common import _canonical_json, _sha256_text
from tai.model_bundle_v2_types import (
    ConversionEvidence,
    DeclaredFile,
    DeclaredSourceFile,
    LegalReviewEvidence,
    LocalModelBundleV2,
    ModelBundleAuthority,
    RemoteInventoryEvidence,
    StorageEvidence,
    ToolchainPackageEvidence,
)


def authority_to_canonical_json_v2(authority: ModelBundleAuthority) -> str:
    return _canonical_json(_authority_payload(authority))


def bundle_to_canonical_json_v2(bundle: LocalModelBundleV2) -> str:
    return _canonical_json(_bundle_payload(bundle))


def authority_sha256_v2(authority: ModelBundleAuthority) -> str:
    return _sha256_text(authority_to_canonical_json_v2(authority))


def source_files_sha256_v2(source_files: tuple[DeclaredSourceFile, ...]) -> str:
    payload = [
        {
            "path": item.path,
            "role": item.role.value,
            "sha256": item.sha256,
            "size_bytes": item.size_bytes,
        }
        for item in sorted(source_files, key=lambda value: value.path)
    ]
    return _sha256_text(_canonical_json(payload))


def _authority_payload(authority: ModelBundleAuthority) -> dict[str, object]:
    return {
        "models": [
            {
                "conversion": {
                    "argv": list(model.conversion.argv),
                    "converter_path": model.conversion.converter_path,
                    "intermediate_format": model.conversion.intermediate_format,
                    "intermediate_path": model.conversion.intermediate_path,
                },
                "license_spdx": model.license_spdx,
                "model_card_uri": model.model_card_uri,
                "model_id": model.model_id,
                "quantizations": [
                    {
                        "argv": list(item.argv),
                        "output_path": item.output_path,
                        "quantization": item.quantization,
                        "runtime_class": item.runtime_class.value,
                    }
                    for item in model.quantizations
                ],
                "revision": model.revision,
                "role": model.role.value,
                "source_inventory": [
                    {
                        "disposition": item.disposition.value,
                        "exclusion_reason": item.exclusion_reason,
                        "path": item.path,
                        "role": item.role.value,
                    }
                    for item in model.inventory
                ],
                "source_uri": model.source_uri,
            }
            for model in authority.models
        ],
        "schema_version": "tai.model-bundle-authority.v2",
        "toolchain": {
            "authority_sha256": authority.toolchain.authority_sha256,
            "commit": authority.toolchain.commit,
            "name": authority.toolchain.name,
            "profile": authority.toolchain.profile,
            "release": authority.toolchain.release,
            "required_binaries": list(authority.toolchain.required_binaries),
            "uri": authority.toolchain.uri,
        },
    }


def _bundle_payload(bundle: LocalModelBundleV2) -> dict[str, object]:
    return {
        "authority_sha256": bundle.authority_sha256,
        "conversion": _conversion_payload(bundle.conversion),
        "legal_review": _legal_payload(bundle.legal_review),
        "lifecycle": bundle.lifecycle.value,
        "model_id": bundle.model_id,
        "quantizations": [
            {
                "argv": list(item.argv),
                "input_sha256": item.input_sha256,
                "log": _file_payload(item.log),
                "output": _file_payload(item.output),
                "quantization": item.quantization,
                "quantize_binary_sha256": item.quantize_binary_sha256,
                "runtime_class": item.runtime_class.value,
            }
            for item in bundle.quantizations
        ],
        "remote_inventory": _remote_payload(bundle.remote_inventory),
        "revision": bundle.revision,
        "role": bundle.role.value,
        "schema_version": "tai.local-model-artifact-bundle.v2",
        "source_files": [
            {
                "path": item.path,
                "role": item.role.value,
                "sha256": item.sha256,
                "size_bytes": item.size_bytes,
            }
            for item in bundle.source_files
        ],
        "storage": _storage_payload(bundle.storage),
        "toolchain_package": _toolchain_payload(bundle.toolchain_package),
    }


def _file_payload(value: DeclaredFile) -> dict[str, object]:
    return {"path": value.path, "sha256": value.sha256, "size_bytes": value.size_bytes}


def _remote_payload(value: RemoteInventoryEvidence | None) -> object:
    if value is None:
        return None
    return {
        "model_id": value.model_id,
        "revision": value.revision,
        "source_uri": value.source_uri,
        "entries": [
            {
                "path": item.path,
                "remote_identity": item.remote_identity,
                "size_bytes": item.size_bytes,
            }
            for item in value.entries
        ],
        "evidence_file": _file_payload(value.evidence_file),
        "observed_at": value.observed_at,
    }


def _legal_payload(value: LegalReviewEvidence | None) -> object:
    if value is None:
        return None
    return {
        "decision": value.decision.value,
        "attestation_reference": value.attestation_reference,
        "conditions": list(value.conditions),
        "decision_basis": value.decision_basis,
        "license_spdx": value.license_spdx,
        "license_text": _file_payload(value.license_text),
        "record_type": value.record_type.value,
        "review_record": _file_payload(value.review_record),
        "reviewed_at": value.reviewed_at,
        "reviewer_id": value.reviewer_id,
        "reviewer_name": value.reviewer_name,
        "reviewer_type": value.reviewer_type.value,
    }


def _toolchain_payload(value: ToolchainPackageEvidence | None) -> object:
    if value is None:
        return None
    return {
        "authority_sha256": value.authority_sha256,
        "binaries": [
            {"file": _file_payload(item.file), "name": item.name} for item in value.binaries
        ],
        "build_manifest": _file_payload(value.build_manifest),
        "commit": value.commit,
        "immutable_locator": value.immutable_locator,
        "name": value.name,
        "package": _file_payload(value.package),
        "profile": value.profile,
        "release": value.release,
        "verification_report": _file_payload(value.verification_report),
        "verification_status": value.verification_status,
    }


def _conversion_payload(value: ConversionEvidence | None) -> object:
    if value is None:
        return None
    return {
        "argv": list(value.argv),
        "converter": _file_payload(value.converter),
        "intermediate": _file_payload(value.intermediate),
        "log": _file_payload(value.log),
        "python_dependencies": _file_payload(value.python_dependencies),
        "python_identity": value.python_identity,
        "source_files_sha256": value.source_files_sha256,
        "toolchain_package_sha256": value.toolchain_package_sha256,
    }


def _storage_payload(value: StorageEvidence | None) -> object:
    if value is None:
        return None
    return {
        "bundle_archive": _file_payload(value.bundle_archive),
        "immutable_locator": value.immutable_locator,
        "payload_index": _file_payload(value.payload_index),
        "restored_at": value.restored_at,
        "restore_record": _file_payload(value.restore_record),
        "retention_days": value.retention_days,
        "retention_expires_at": value.retention_expires_at,
        "uploaded_at": value.uploaded_at,
        "upload_record": _file_payload(value.upload_record),
    }
