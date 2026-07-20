from __future__ import annotations

import hashlib
import stat
from pathlib import Path, PurePosixPath
from typing import cast

from tai.llama_toolchain_collect import (
    _bounded_directory,
    _regular_or_directory_without_symlink,
    _verified_root,
    source_tree_sha256,
)
from tai.llama_toolchain_types import (
    _EMPTY_SHA256,
    AuthorityReference,
    BuildCommandsEvidence,
    BuildEnvironmentEvidence,
    BuildEvidenceStatus,
    BuildLogsEvidence,
    EvidenceFile,
    IdentityEvidence,
    LlamaToolchainAuthority,
    LlamaToolchainBuildEvidence,
    SourceEvidence,
    ToolchainVerificationReport,
    ToolchainVerificationStatus,
    _canonical_json,
    _file_sha256,
    _VerifiedFile,
)


def verify_llama_toolchain(
    *,
    authority: LlamaToolchainAuthority,
    evidence: LlamaToolchainBuildEvidence,
    evidence_root: Path,
) -> ToolchainVerificationReport:
    reasons: list[str] = []
    verified_files: list[str] = []
    verified_targets: list[str] = []
    _verify_authority_reference(authority, evidence.authority, reasons)

    if evidence.status is BuildEvidenceStatus.PENDING_BUILD:
        pending_status = (
            ToolchainVerificationStatus.PENDING_BUILD
            if not reasons
            else ToolchainVerificationStatus.REJECTED
        )
        reasons.append("BUILD_PENDING")
        return _report(
            status=pending_status,
            reasons=reasons,
            authority=authority,
            evidence=evidence,
            verified_files=verified_files,
            verified_targets=verified_targets,
        )

    source = cast(SourceEvidence, evidence.source)
    environment = cast(BuildEnvironmentEvidence, evidence.environment)
    commands = cast(BuildCommandsEvidence, evidence.commands)
    logs = cast(BuildLogsEvidence, evidence.logs)

    if source.checkout_path != authority.build_profile.checkout_path:
        reasons.append("SOURCE_CHECKOUT_PATH_MISMATCH")
    if commands.configure != authority.build_profile.configure_command:
        reasons.append("CONFIGURE_COMMAND_MISMATCH")
    if commands.build != authority.build_profile.build_command:
        reasons.append("BUILD_COMMAND_MISMATCH")
    if environment.operating_system != authority.build_profile.operating_system:
        reasons.append("OPERATING_SYSTEM_MISMATCH")
    if environment.architecture != authority.build_profile.architecture:
        reasons.append("ARCHITECTURE_MISMATCH")
    if environment.generator != authority.build_profile.generator:
        reasons.append("CMAKE_GENERATOR_MISMATCH")

    layout = authority.evidence_layout
    path_comparisons = (
        (source.source_archive.path, layout.source_archive_path, "SOURCE_ARCHIVE_PATH_MISMATCH"),
        (source.git_head_output.path, layout.git_head_output_path, "SOURCE_HEAD_PATH_MISMATCH"),
        (
            source.git_status_output.path,
            layout.git_status_output_path,
            "SOURCE_STATUS_PATH_MISMATCH",
        ),
        (
            environment.cmake.output.path,
            layout.cmake_identity_output_path,
            "CMAKE_IDENTITY_PATH_MISMATCH",
        ),
        (
            environment.c_compiler.output.path,
            layout.c_compiler_identity_output_path,
            "C_COMPILER_IDENTITY_PATH_MISMATCH",
        ),
        (
            environment.cxx_compiler.output.path,
            layout.cxx_compiler_identity_output_path,
            "CXX_COMPILER_IDENTITY_PATH_MISMATCH",
        ),
        (logs.configure_log.path, layout.configure_log_path, "CONFIGURE_LOG_PATH_MISMATCH"),
        (logs.build_log.path, layout.build_log_path, "BUILD_LOG_PATH_MISMATCH"),
        (logs.cmake_cache.path, layout.cmake_cache_path, "CMAKE_CACHE_PATH_MISMATCH"),
    )
    for actual_path, expected_path, reason in path_comparisons:
        if actual_path != expected_path:
            reasons.append(reason)

    checkout = _bounded_directory(
        evidence_root,
        source.checkout_path,
        reasons,
        reason_prefix="SOURCE_CHECKOUT",
    )
    if checkout is not None:
        git_metadata = _regular_or_directory_without_symlink(
            checkout / ".git",
            require_directory=True,
        )
        if git_metadata == "MISSING":
            reasons.append("SOURCE_GIT_METADATA_MISSING")
        elif git_metadata == "SYMLINK":
            reasons.append("SOURCE_GIT_METADATA_SYMLINK")
        elif git_metadata == "WRONG_TYPE":
            reasons.append("SOURCE_GIT_METADATA_NOT_DIRECTORY")
        try:
            digest = source_tree_sha256(checkout)
        except ValueError:
            reasons.append("SOURCE_TREE_INVALID")
        else:
            if digest != source.checkout_tree_sha256:
                reasons.append("SOURCE_TREE_SHA256_MISMATCH")

    checked: dict[str, _VerifiedFile] = {}
    for declared_file in (
        source.git_head_output,
        source.git_status_output,
        source.source_archive,
        environment.cmake.output,
        environment.c_compiler.output,
        environment.cxx_compiler.output,
        logs.configure_log,
        logs.build_log,
        logs.cmake_cache,
    ):
        verified = _verify_file(evidence_root, declared_file, reasons)
        if verified is not None:
            checked[declared_file.path] = verified
            verified_files.append(declared_file.path)

    head_file = checked.get(source.git_head_output.path)
    if head_file is not None:
        try:
            head = head_file.path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            reasons.append("SOURCE_HEAD_OUTPUT_INVALID")
        else:
            if head not in {authority.commit, authority.commit + "\n"}:
                reasons.append("SOURCE_HEAD_COMMIT_MISMATCH")

    status_file = checked.get(source.git_status_output.path)
    if status_file is not None:
        try:
            status_bytes = status_file.path.read_bytes()
        except OSError:
            reasons.append("SOURCE_STATUS_OUTPUT_INVALID")
        else:
            if status_bytes != b"" or source.git_status_output.sha256 != _EMPTY_SHA256:
                reasons.append("SOURCE_CHECKOUT_DIRTY")

    _verify_identity_output(
        "CMAKE",
        environment.cmake,
        checked,
        reasons,
    )
    _verify_identity_output(
        "C_COMPILER",
        environment.c_compiler,
        checked,
        reasons,
    )
    _verify_identity_output(
        "CXX_COMPILER",
        environment.cxx_compiler,
        checked,
        reasons,
    )

    expected = {item.target: item.path for item in authority.build_profile.required_targets}
    declared_binaries = {item.target: item for item in evidence.binaries}
    if set(expected) != set(declared_binaries):
        reasons.append("BINARY_TARGET_SET_MISMATCH")
    binary_identities: set[tuple[int, int]] = set()
    for target in sorted(set(expected) & set(declared_binaries)):
        binary = declared_binaries[target]
        if binary.path != expected[target]:
            reasons.append(f"BINARY_PATH_MISMATCH:{target}")
        verified = _verify_file(
            evidence_root,
            EvidenceFile(binary.path, binary.sha256, binary.size_bytes),
            reasons,
        )
        if verified is None:
            continue
        verified_files.append(binary.path)
        identity = (verified.device, verified.inode)
        if identity in binary_identities:
            reasons.append("BINARY_FILE_ALIAS")
            continue
        binary_identities.add(identity)
        if binary.path == expected[target]:
            verified_targets.append(target)

    status = (
        ToolchainVerificationStatus.VERIFIED
        if not reasons
        else ToolchainVerificationStatus.REJECTED
    )
    return _report(
        status=status,
        reasons=reasons,
        authority=authority,
        evidence=evidence,
        verified_files=verified_files,
        verified_targets=verified_targets,
    )


def _verify_authority_reference(
    authority: LlamaToolchainAuthority,
    reference: AuthorityReference,
    reasons: list[str],
) -> None:
    comparisons = (
        (reference.toolchain_name, authority.toolchain_name, "TOOLCHAIN_NAME_MISMATCH"),
        (reference.repository_uri, authority.repository_uri, "REPOSITORY_URI_MISMATCH"),
        (reference.release, authority.release, "RELEASE_MISMATCH"),
        (reference.commit, authority.commit, "COMMIT_MISMATCH"),
        (reference.profile_id, authority.build_profile.profile_id, "BUILD_PROFILE_MISMATCH"),
        (
            reference.authority_sha256,
            authority.authority_sha256,
            "AUTHORITY_SHA256_MISMATCH",
        ),
    )
    for actual, expected, reason in comparisons:
        if actual != expected:
            reasons.append(reason)


def _verify_identity_output(
    prefix: str,
    identity: IdentityEvidence,
    checked: dict[str, _VerifiedFile],
    reasons: list[str],
) -> None:
    verified = checked.get(identity.output.path)
    if verified is None:
        return
    try:
        output = verified.path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        reasons.append(f"{prefix}_IDENTITY_OUTPUT_INVALID")
        return
    if identity.version not in output:
        reasons.append(f"{prefix}_VERSION_MISMATCH")


def _verify_file(
    root: Path,
    declared: EvidenceFile,
    reasons: list[str],
) -> _VerifiedFile | None:
    try:
        resolved_root = _verified_root(root)
    except ValueError:
        reasons.append("EVIDENCE_ROOT_INVALID")
        return None
    current = resolved_root
    parts = PurePosixPath(declared.path).parts
    for index, part in enumerate(parts):
        current = current / part
        try:
            current_status = current.lstat()
        except FileNotFoundError:
            reasons.append(f"FILE_MISSING:{declared.path}")
            return None
        except OSError:
            reasons.append(f"FILE_UNREADABLE:{declared.path}")
            return None
        if stat.S_ISLNK(current_status.st_mode):
            reasons.append(f"FILE_SYMLINK:{declared.path}")
            return None
        if index < len(parts) - 1 and not stat.S_ISDIR(current_status.st_mode):
            reasons.append(f"FILE_PARENT_NOT_DIRECTORY:{declared.path}")
            return None
    if not stat.S_ISREG(current_status.st_mode):
        reasons.append(f"FILE_NOT_REGULAR:{declared.path}")
        return None
    if current_status.st_size != declared.size_bytes:
        reasons.append(f"FILE_SIZE_MISMATCH:{declared.path}")
        return None
    try:
        digest = _file_sha256(current)
    except OSError:
        reasons.append(f"FILE_UNREADABLE:{declared.path}")
        return None
    if digest != declared.sha256:
        reasons.append(f"FILE_SHA256_MISMATCH:{declared.path}")
        return None
    return _VerifiedFile(
        path=current,
        relative_path=declared.path,
        device=current_status.st_dev,
        inode=current_status.st_ino,
    )


def _report(
    *,
    status: ToolchainVerificationStatus,
    reasons: list[str],
    authority: LlamaToolchainAuthority,
    evidence: LlamaToolchainBuildEvidence,
    verified_files: list[str],
    verified_targets: list[str],
) -> ToolchainVerificationReport:
    normalized_reasons = tuple(sorted(set(reasons)))
    normalized_files = tuple(sorted(set(verified_files)))
    normalized_targets = tuple(sorted(set(verified_targets)))
    payload = {
        "authority_sha256": authority.authority_sha256,
        "evidence_sha256": evidence.evidence_sha256,
        "reasons": list(normalized_reasons),
        "schema_version": "tai.llama-cpp-toolchain-verification-report.v1",
        "status": status.value,
        "verified_files": list(normalized_files),
        "verified_targets": list(normalized_targets),
    }
    return ToolchainVerificationReport(
        status=status,
        reasons=normalized_reasons,
        authority_sha256=authority.authority_sha256,
        evidence_sha256=evidence.evidence_sha256,
        verified_files=normalized_files,
        verified_targets=normalized_targets,
        report_sha256=hashlib.sha256(_canonical_json(payload).encode()).hexdigest(),
    )
