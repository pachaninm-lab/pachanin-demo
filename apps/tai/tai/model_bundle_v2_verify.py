from __future__ import annotations

from datetime import timedelta
from pathlib import Path, PurePosixPath
from typing import cast

from tai.model_bundle_v2_common import (
    _BINARY_NAMES,
    _bounded_regular_file,
    _canonical_json,
    _file_sha256,
    _load_json_strict,
    _parse_timestamp,
    _sha256_text,
)
from tai.model_bundle_v2_serialize import (
    authority_sha256_v2,
    bundle_to_canonical_json_v2,
    source_files_sha256_v2,
)
from tai.model_bundle_v2_types import (
    BundleLifecycle,
    BundleVerificationReportV2,
    BundleVerificationStatus,
    DeclaredFile,
    LegalReviewDecision,
    LocalModelBundleV2,
    ModelBundleAuthority,
    ModelBundlePlan,
    ReviewerType,
    SourceFileRole,
    _VerificationState,
)


def verify_local_model_bundle_v2(
    *,
    authority: ModelBundleAuthority,
    bundle: LocalModelBundleV2,
    bundle_root: Path,
    restored_root: Path | None,
) -> BundleVerificationReportV2:
    authority_digest = authority_sha256_v2(authority)
    manifest_digest = _sha256_text(bundle_to_canonical_json_v2(bundle))
    reasons: list[str] = []
    plan = _find_plan(authority, bundle)
    if bundle.authority_sha256 != authority_digest:
        reasons.append("AUTHORITY_SHA256_MISMATCH")
    if plan is None:
        reasons.append("MODEL_NOT_AUTHORIZED")
    elif plan.role is not bundle.role:
        reasons.append("MODEL_ROLE_MISMATCH")

    if bundle.lifecycle is BundleLifecycle.PENDING_ACQUISITION:
        if reasons:
            pending_status = BundleVerificationStatus.REJECTED
            pending_reasons = tuple(sorted(set(reasons)))
        else:
            pending_status = BundleVerificationStatus.PENDING_ACQUISITION
            pending_reasons = ("ACQUISITION_PENDING",)
        return _report(
            bundle=bundle,
            status=pending_status,
            reasons=pending_reasons,
            verified_files=(),
            restored_files=(),
            authority_sha256=authority_digest,
            manifest_sha256=manifest_digest,
        )

    state = _VerificationState(reasons, [], [], set(), set())
    _verify_complete_sections(bundle, state)
    if plan is not None:
        _verify_authority_contract(authority, plan, bundle, state)
        _verify_remote_inventory_record(plan, bundle, bundle_root, state)
        _verify_legal_review_record(plan, bundle, bundle_root, state)
    _verify_locator_and_retention(bundle, bundle_root, state)
    _verify_original_and_restore(bundle, bundle_root, restored_root, state)
    if plan is not None and bundle_root.exists():
        _verify_shard_index(plan, bundle, bundle_root, state)
    _verify_embedded_toolchain_report(bundle, bundle_root, authority, state)

    unique_reasons = tuple(sorted(set(state.reasons)))
    status = (
        BundleVerificationStatus.VERIFIED
        if not unique_reasons
        else BundleVerificationStatus.REJECTED
    )
    return _report(
        bundle=bundle,
        status=status,
        reasons=unique_reasons,
        verified_files=tuple(sorted(set(state.verified))),
        restored_files=tuple(sorted(set(state.restored))),
        authority_sha256=authority_digest,
        manifest_sha256=manifest_digest,
    )


def _verify_complete_sections(bundle: LocalModelBundleV2, state: _VerificationState) -> None:
    sections = {
        "REMOTE_INVENTORY": bundle.remote_inventory,
        "SOURCE_FILES": bundle.source_files or None,
        "LEGAL_REVIEW": bundle.legal_review,
        "TOOLCHAIN_PACKAGE": bundle.toolchain_package,
        "CONVERSION": bundle.conversion,
        "QUANTIZATIONS": bundle.quantizations or None,
        "STORAGE": bundle.storage,
    }
    for name, value in sections.items():
        if value is None:
            state.reasons.append(f"MANIFEST_SECTION_MISSING:{name}")


def _verify_authority_contract(
    authority: ModelBundleAuthority,
    plan: ModelBundlePlan,
    bundle: LocalModelBundleV2,
    state: _VerificationState,
) -> None:
    remote = bundle.remote_inventory
    if remote is not None:
        if (remote.model_id, remote.revision, remote.source_uri) != (
            plan.model_id,
            plan.revision,
            plan.source_uri,
        ):
            state.reasons.append("REMOTE_INVENTORY_AUTHORITY_MISMATCH")
        expected_remote = {item.path for item in plan.inventory}
        declared_remote = {item.path for item in remote.entries}
        if declared_remote != expected_remote:
            state.reasons.append("REMOTE_INVENTORY_SET_MISMATCH")
        remote_by_path = {item.path: item for item in remote.entries}
        for source in bundle.source_files:
            observed = remote_by_path.get(source.path)
            if observed is not None and observed.size_bytes != source.size_bytes:
                state.reasons.append(f"REMOTE_LOCAL_SIZE_MISMATCH:{source.path}")

    expected_sources = {(item.path, item.role) for item in plan.selected_inventory}
    declared_sources = {(item.path, item.role) for item in bundle.source_files}
    if declared_sources != expected_sources:
        state.reasons.append("SOURCE_FILE_SET_MISMATCH")
    if not any(item.role is SourceFileRole.WEIGHT_SHARD for item in bundle.source_files):
        state.reasons.append("SOURCE_WEIGHT_SHARDS_MISSING")
    if sum(item.role is SourceFileRole.SHARD_INDEX for item in bundle.source_files) != 1:
        state.reasons.append("SOURCE_SHARD_INDEX_MISSING_OR_DUPLICATE")

    legal = bundle.legal_review
    if legal is not None:
        if legal.decision is not LegalReviewDecision.APPROVED:
            state.reasons.append("LEGAL_REVIEW_NOT_APPROVED")
        if legal.reviewer_type is not ReviewerType.HUMAN:
            state.reasons.append("LEGAL_REVIEWER_NOT_HUMAN")
        if legal.license_spdx != plan.license_spdx:
            state.reasons.append("LICENSE_SPDX_MISMATCH")

    toolchain = bundle.toolchain_package
    if toolchain is not None:
        expected_toolchain = authority.toolchain
        if (
            toolchain.name,
            toolchain.release,
            toolchain.commit,
            toolchain.profile,
            toolchain.authority_sha256,
        ) != (
            expected_toolchain.name,
            expected_toolchain.release,
            expected_toolchain.commit,
            expected_toolchain.profile,
            expected_toolchain.authority_sha256,
        ):
            state.reasons.append("TOOLCHAIN_PACKAGE_AUTHORITY_MISMATCH")
        if {item.name for item in toolchain.binaries} != set(expected_toolchain.required_binaries):
            state.reasons.append("TOOLCHAIN_BINARY_SET_MISMATCH")

    conversion = bundle.conversion
    if conversion is not None:
        if conversion.argv != plan.conversion.argv:
            state.reasons.append("CONVERSION_ARGV_MISMATCH")
        if conversion.converter.path != plan.conversion.converter_path:
            state.reasons.append("CONVERTER_PATH_MISMATCH")
        if conversion.intermediate.path != plan.conversion.intermediate_path:
            state.reasons.append("INTERMEDIATE_PATH_MISMATCH")
        if conversion.source_files_sha256 != source_files_sha256_v2(bundle.source_files):
            state.reasons.append("CONVERSION_SOURCE_BINDING_MISMATCH")
        if (
            toolchain is not None
            and conversion.toolchain_package_sha256 != toolchain.package.sha256
        ):
            state.reasons.append("CONVERSION_TOOLCHAIN_BINDING_MISMATCH")

    expected_quantizations = {
        (item.runtime_class, item.quantization): item for item in plan.quantizations
    }
    declared_quantizations = {
        (item.runtime_class, item.quantization): item for item in bundle.quantizations
    }
    if set(declared_quantizations) != set(expected_quantizations):
        state.reasons.append("QUANTIZATION_SET_MISMATCH")
    quantize_sha = _toolchain_binary_sha(bundle, "llama-quantize")
    for identity, declared in declared_quantizations.items():
        expected_quantization = expected_quantizations.get(identity)
        if expected_quantization is None:
            continue
        if declared.argv != expected_quantization.argv:
            state.reasons.append(f"QUANTIZATION_ARGV_MISMATCH:{identity[0].value}:{identity[1]}")
        if declared.output.path != expected_quantization.output_path:
            state.reasons.append(
                f"QUANTIZATION_OUTPUT_PATH_MISMATCH:{identity[0].value}:{identity[1]}"
            )
        if conversion is not None and declared.input_sha256 != conversion.intermediate.sha256:
            state.reasons.append(
                f"QUANTIZATION_INPUT_BINDING_MISMATCH:{identity[0].value}:{identity[1]}"
            )
        if quantize_sha is not None and declared.quantize_binary_sha256 != quantize_sha:
            state.reasons.append(
                f"QUANTIZATION_BINARY_BINDING_MISMATCH:{identity[0].value}:{identity[1]}"
            )


def _verify_remote_inventory_record(
    plan: ModelBundlePlan,
    bundle: LocalModelBundleV2,
    bundle_root: Path,
    state: _VerificationState,
) -> None:
    remote = bundle.remote_inventory
    if remote is None:
        return
    try:
        path = _bounded_regular_file(bundle_root, remote.evidence_file.path)
        payload = _load_json_strict(path)
    except ValueError as error:
        state.reasons.append(f"REMOTE_INVENTORY_EVIDENCE_INVALID:{error}")
        return
    expected: dict[str, object] = {
        "schema_version": "tai.remote-model-inventory-evidence.v1",
        "model_id": plan.model_id,
        "revision": plan.revision,
        "source_uri": plan.source_uri,
        "observed_at": remote.observed_at,
        "entries": [
            {
                "path": item.path,
                "remote_identity": item.remote_identity,
                "size_bytes": item.size_bytes,
            }
            for item in remote.entries
        ],
    }
    if payload != expected:
        state.reasons.append("REMOTE_INVENTORY_EVIDENCE_MISMATCH")


def _verify_legal_review_record(
    plan: ModelBundlePlan,
    bundle: LocalModelBundleV2,
    bundle_root: Path,
    state: _VerificationState,
) -> None:
    legal = bundle.legal_review
    if legal is None:
        return
    try:
        path = _bounded_regular_file(bundle_root, legal.review_record.path)
        payload = _load_json_strict(path)
    except ValueError as error:
        state.reasons.append(f"LEGAL_REVIEW_RECORD_INVALID:{error}")
        return
    expected: dict[str, object] = {
        "schema_version": "tai.model-legal-review-record.v1",
        "decision": legal.decision.value,
        "reviewer_type": legal.reviewer_type.value,
        "reviewer_id": legal.reviewer_id,
        "reviewer_name": legal.reviewer_name,
        "reviewed_at": legal.reviewed_at,
        "license_spdx": plan.license_spdx,
        "decision_basis": legal.decision_basis,
        "conditions": list(legal.conditions),
        "record_type": legal.record_type.value,
        "attestation_reference": legal.attestation_reference,
        "license_text_sha256": legal.license_text.sha256,
    }
    if payload != expected:
        state.reasons.append("LEGAL_REVIEW_RECORD_MISMATCH")


def _verify_locator_and_retention(
    bundle: LocalModelBundleV2,
    bundle_root: Path,
    state: _VerificationState,
) -> None:
    toolchain = bundle.toolchain_package
    if toolchain is not None and not _locator_binds_sha256(
        toolchain.immutable_locator, toolchain.package.sha256
    ):
        state.reasons.append("TOOLCHAIN_PACKAGE_LOCATOR_SHA256_MISMATCH")

    storage = bundle.storage
    if storage is None:
        return
    if not _locator_binds_sha256(storage.immutable_locator, storage.bundle_archive.sha256):
        state.reasons.append("STORAGE_LOCATOR_ARCHIVE_SHA256_MISMATCH")
    uploaded = _parse_timestamp(storage.uploaded_at, "storage uploaded_at")
    expires = _parse_timestamp(storage.retention_expires_at, "storage retention_expires_at")
    restored = _parse_timestamp(storage.restored_at, "storage restored_at")
    if uploaded + timedelta(days=storage.retention_days) != expires:
        state.reasons.append("STORAGE_RETENTION_INTERVAL_MISMATCH")
    if restored > expires:
        state.reasons.append("STORAGE_RESTORE_OUTSIDE_RETENTION")

    _verify_storage_record(
        bundle_root=bundle_root,
        declared=storage.upload_record,
        expected={
            "schema_version": "tai.model-bundle-upload-record.v1",
            "archive_sha256": storage.bundle_archive.sha256,
            "immutable_locator": storage.immutable_locator,
            "uploaded_at": storage.uploaded_at,
            "retention_days": storage.retention_days,
            "retention_expires_at": storage.retention_expires_at,
        },
        reason="STORAGE_UPLOAD_RECORD_MISMATCH",
        state=state,
    )
    _verify_storage_record(
        bundle_root=bundle_root,
        declared=storage.restore_record,
        expected={
            "schema_version": "tai.model-bundle-restore-record.v1",
            "archive_sha256": storage.bundle_archive.sha256,
            "immutable_locator": storage.immutable_locator,
            "restored_at": storage.restored_at,
        },
        reason="STORAGE_RESTORE_RECORD_MISMATCH",
        state=state,
    )


def _verify_storage_record(
    *,
    bundle_root: Path,
    declared: DeclaredFile,
    expected: dict[str, object],
    reason: str,
    state: _VerificationState,
) -> None:
    try:
        path = _bounded_regular_file(bundle_root, declared.path)
        payload = _load_json_strict(path)
    except ValueError as error:
        state.reasons.append(f"{reason}:{error}")
        return
    if payload != expected:
        state.reasons.append(reason)


def _locator_binds_sha256(locator: str, digest: str) -> bool:
    return any(
        token in locator for token in (f"@sha256:{digest}", f"#sha256={digest}", f"sha256:{digest}")
    )


def _verify_original_and_restore(
    bundle: LocalModelBundleV2,
    bundle_root: Path,
    restored_root: Path | None,
    state: _VerificationState,
) -> None:
    declared = _all_declared_files(bundle)
    paths = tuple(item.path for item in declared)
    if len(paths) != len(set(paths)):
        state.reasons.append("DECLARED_FILE_PATH_DUPLICATE")
    _verify_declared_files(
        root=bundle_root,
        declared=declared,
        prefix="",
        reasons=state.reasons,
        verified=state.verified,
        seen_inodes=state.original_inodes,
    )
    if restored_root is None:
        state.reasons.append("RESTORED_ROOT_REQUIRED")
        return
    _verify_declared_files(
        root=restored_root,
        declared=declared,
        prefix="RESTORED_",
        reasons=state.reasons,
        verified=state.restored,
        seen_inodes=state.restored_inodes,
    )


def _verify_declared_files(
    *,
    root: Path,
    declared: tuple[DeclaredFile, ...],
    prefix: str,
    reasons: list[str],
    verified: list[str],
    seen_inodes: set[tuple[int, int]],
) -> None:
    for item in declared:
        try:
            path = _bounded_regular_file(root, item.path)
        except ValueError as error:
            if str(error) == "file does not exist":
                reasons.append(f"{prefix}FILE_MISSING:{item.path}")
            else:
                reasons.append(f"{prefix}FILE_UNSAFE:{item.path}:{error}")
            continue
        try:
            metadata = path.stat()
        except OSError:
            reasons.append(f"{prefix}FILE_MISSING:{item.path}")
            continue
        inode = (metadata.st_dev, metadata.st_ino)
        if inode in seen_inodes:
            reasons.append(f"{prefix}FILE_INODE_ALIAS:{item.path}")
            continue
        seen_inodes.add(inode)
        if metadata.st_size != item.size_bytes:
            reasons.append(f"{prefix}FILE_SIZE_MISMATCH:{item.path}")
        elif _file_sha256(path) != item.sha256:
            reasons.append(f"{prefix}FILE_SHA256_MISMATCH:{item.path}")
        else:
            verified.append(item.path)


def _verify_shard_index(
    plan: ModelBundlePlan,
    bundle: LocalModelBundleV2,
    bundle_root: Path,
    state: _VerificationState,
) -> None:
    indexes = [item for item in bundle.source_files if item.role is SourceFileRole.SHARD_INDEX]
    if len(indexes) != 1:
        return
    index = indexes[0]
    try:
        path = _bounded_regular_file(bundle_root, index.path)
        payload = _load_json_strict(path)
    except ValueError as error:
        state.reasons.append(f"SHARD_INDEX_INVALID:{error}")
        return
    weight_map = payload.get("weight_map")
    if not isinstance(weight_map, dict) or not weight_map:
        state.reasons.append("SHARD_INDEX_WEIGHT_MAP_INVALID")
        return
    if any(
        not isinstance(key, str) or not isinstance(value, str) for key, value in weight_map.items()
    ):
        state.reasons.append("SHARD_INDEX_WEIGHT_MAP_INVALID")
        return
    referenced = {cast(str, value) for value in weight_map.values()}
    expected = {
        PurePosixPath(item.path).name
        for item in plan.selected_inventory
        if item.role is SourceFileRole.WEIGHT_SHARD
    }
    if referenced != expected:
        state.reasons.append("SHARD_INDEX_SHARD_SET_MISMATCH")


def _verify_embedded_toolchain_report(
    bundle: LocalModelBundleV2,
    bundle_root: Path,
    authority: ModelBundleAuthority,
    state: _VerificationState,
) -> None:
    toolchain = bundle.toolchain_package
    if toolchain is None:
        return
    try:
        report_path = _bounded_regular_file(bundle_root, toolchain.verification_report.path)
        payload = _load_json_strict(report_path)
    except ValueError as error:
        state.reasons.append(f"TOOLCHAIN_VERIFICATION_REPORT_INVALID:{error}")
        return
    if payload.get("status") != "VERIFIED":
        state.reasons.append("TOOLCHAIN_VERIFICATION_REPORT_NOT_VERIFIED")
    if payload.get("authority_sha256") != authority.toolchain.authority_sha256:
        state.reasons.append("TOOLCHAIN_VERIFICATION_REPORT_AUTHORITY_MISMATCH")
    targets = payload.get("verified_targets")
    if not isinstance(targets, list) or set(targets) != _BINARY_NAMES:
        state.reasons.append("TOOLCHAIN_VERIFICATION_REPORT_TARGET_SET_MISMATCH")


def _all_declared_files(bundle: LocalModelBundleV2) -> tuple[DeclaredFile, ...]:
    files: list[DeclaredFile] = [item.file for item in bundle.source_files]
    if bundle.remote_inventory is not None:
        files.append(bundle.remote_inventory.evidence_file)
    if bundle.legal_review is not None:
        files.extend([bundle.legal_review.license_text, bundle.legal_review.review_record])
    if bundle.toolchain_package is not None:
        package = bundle.toolchain_package
        files.extend([package.package, package.build_manifest, package.verification_report])
        files.extend(item.file for item in package.binaries)
    if bundle.conversion is not None:
        conversion = bundle.conversion
        files.extend(
            [
                conversion.python_dependencies,
                conversion.converter,
                conversion.log,
                conversion.intermediate,
            ]
        )
    for quantization in bundle.quantizations:
        files.extend([quantization.log, quantization.output])
    if bundle.storage is not None:
        storage = bundle.storage
        files.extend(
            [
                storage.bundle_archive,
                storage.payload_index,
                storage.upload_record,
                storage.restore_record,
            ]
        )
    return tuple(files)


def _find_plan(
    authority: ModelBundleAuthority, bundle: LocalModelBundleV2
) -> ModelBundlePlan | None:
    return next(
        (
            item
            for item in authority.models
            if (item.model_id, item.revision) == (bundle.model_id, bundle.revision)
        ),
        None,
    )


def _toolchain_binary_sha(bundle: LocalModelBundleV2, name: str) -> str | None:
    package = bundle.toolchain_package
    if package is None:
        return None
    return next((item.file.sha256 for item in package.binaries if item.name == name), None)


def _report(
    *,
    bundle: LocalModelBundleV2,
    status: BundleVerificationStatus,
    reasons: tuple[str, ...],
    verified_files: tuple[str, ...],
    restored_files: tuple[str, ...],
    authority_sha256: str,
    manifest_sha256: str,
) -> BundleVerificationReportV2:
    payload: dict[str, object] = {
        "authority_sha256": authority_sha256,
        "manifest_sha256": manifest_sha256,
        "model_id": bundle.model_id,
        "reasons": list(reasons),
        "restored_files": list(restored_files),
        "revision": bundle.revision,
        "schema_version": "tai.model-bundle-verification-report.v2",
        "status": status.value,
        "verified_files": list(verified_files),
    }
    return BundleVerificationReportV2(
        model_id=bundle.model_id,
        revision=bundle.revision,
        status=status,
        reasons=reasons,
        verified_files=verified_files,
        restored_files=restored_files,
        authority_sha256=authority_sha256,
        manifest_sha256=manifest_sha256,
        report_sha256=_sha256_text(_canonical_json(payload)),
    )


def report_payload_v2(report: BundleVerificationReportV2) -> dict[str, object]:
    return {
        "authority_sha256": report.authority_sha256,
        "manifest_sha256": report.manifest_sha256,
        "model_id": report.model_id,
        "reasons": list(report.reasons),
        "report_sha256": report.report_sha256,
        "restored_files": list(report.restored_files),
        "revision": report.revision,
        "schema_version": "tai.model-bundle-verification-report.v2",
        "status": report.status.value,
        "verified_files": list(report.verified_files),
    }
