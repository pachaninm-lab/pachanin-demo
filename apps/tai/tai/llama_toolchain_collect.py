from __future__ import annotations

import hashlib
import os
import platform
import stat
from pathlib import Path, PurePosixPath

from tai.llama_toolchain_types import (
    AuthorityReference,
    BinaryEvidence,
    BuildCommandsEvidence,
    BuildEnvironmentEvidence,
    BuildEvidenceStatus,
    BuildLogsEvidence,
    EvidenceFile,
    IdentityEvidence,
    LlamaToolchainAuthority,
    LlamaToolchainBuildEvidence,
    SourceEvidence,
    _canonical_json,
    _file_sha256,
    _relative_path,
)


def collect_llama_toolchain_build_evidence(
    *,
    authority: LlamaToolchainAuthority,
    evidence_root: Path,
    cmake_executable: str,
    c_compiler_executable: str,
    cxx_compiler_executable: str,
) -> LlamaToolchainBuildEvidence:
    layout = authority.evidence_layout
    checkout = _collect_directory(evidence_root, authority.build_profile.checkout_path)
    source = SourceEvidence(
        checkout_path=authority.build_profile.checkout_path,
        checkout_tree_sha256=source_tree_sha256(checkout),
        git_head_output=_collect_file(evidence_root, layout.git_head_output_path),
        git_status_output=_collect_file(evidence_root, layout.git_status_output_path),
        source_archive=_collect_file(evidence_root, layout.source_archive_path),
    )
    cmake_output = _collect_file(evidence_root, layout.cmake_identity_output_path)
    c_output = _collect_file(evidence_root, layout.c_compiler_identity_output_path)
    cxx_output = _collect_file(evidence_root, layout.cxx_compiler_identity_output_path)
    environment = BuildEnvironmentEvidence(
        operating_system=platform.system().lower(),
        architecture=_normalized_architecture(platform.machine()),
        generator=authority.build_profile.generator,
        cmake=IdentityEvidence(
            executable=cmake_executable,
            version=_first_line(evidence_root, cmake_output),
            output=cmake_output,
        ),
        c_compiler=IdentityEvidence(
            executable=c_compiler_executable,
            version=_first_line(evidence_root, c_output),
            output=c_output,
        ),
        cxx_compiler=IdentityEvidence(
            executable=cxx_compiler_executable,
            version=_first_line(evidence_root, cxx_output),
            output=cxx_output,
        ),
    )
    logs = BuildLogsEvidence(
        configure_log=_collect_file(evidence_root, layout.configure_log_path),
        build_log=_collect_file(evidence_root, layout.build_log_path),
        cmake_cache=_collect_file(evidence_root, layout.cmake_cache_path),
    )
    binaries = tuple(
        BinaryEvidence(
            target=target.target,
            path=target.path,
            sha256=declared.sha256,
            size_bytes=declared.size_bytes,
        )
        for target in authority.build_profile.required_targets
        for declared in (_collect_file(evidence_root, target.path),)
    )
    return LlamaToolchainBuildEvidence(
        status=BuildEvidenceStatus.BUILT,
        authority=AuthorityReference(
            toolchain_name=authority.toolchain_name,
            repository_uri=authority.repository_uri,
            release=authority.release,
            commit=authority.commit,
            profile_id=authority.build_profile.profile_id,
            authority_sha256=authority.authority_sha256,
        ),
        pending_reason=None,
        source=source,
        environment=environment,
        commands=BuildCommandsEvidence(
            configure=authority.build_profile.configure_command,
            build=authority.build_profile.build_command,
        ),
        logs=logs,
        binaries=binaries,
    )


def source_tree_sha256(checkout: Path) -> str:
    try:
        root_status = checkout.lstat()
    except OSError as error:
        raise ValueError("source checkout cannot be inspected") from error
    if stat.S_ISLNK(root_status.st_mode) or not stat.S_ISDIR(root_status.st_mode):
        raise ValueError("source checkout must be a non-symlink directory")
    entries: list[dict[str, object]] = []
    try:
        for current_root, directory_names, file_names in os.walk(
            checkout,
            topdown=True,
            followlinks=False,
        ):
            current = Path(current_root)
            relative_root = current.relative_to(checkout)
            if relative_root == Path("."):
                directory_names[:] = sorted(name for name in directory_names if name != ".git")
            else:
                directory_names.sort()
            file_names.sort()
            for name in directory_names:
                path = current / name
                status = path.lstat()
                if stat.S_ISLNK(status.st_mode):
                    entries.append(
                        {
                            "path": path.relative_to(checkout).as_posix(),
                            "target": os.readlink(path),
                            "type": "symlink",
                        }
                    )
            for name in file_names:
                path = current / name
                relative = path.relative_to(checkout).as_posix()
                status = path.lstat()
                if stat.S_ISREG(status.st_mode):
                    entries.append(
                        {
                            "path": relative,
                            "sha256": _file_sha256(path),
                            "size_bytes": status.st_size,
                            "type": "file",
                        }
                    )
                elif stat.S_ISLNK(status.st_mode):
                    entries.append(
                        {
                            "path": relative,
                            "target": os.readlink(path),
                            "type": "symlink",
                        }
                    )
                else:
                    raise ValueError("source checkout contains a special file")
    except OSError as error:
        raise ValueError("source checkout tree cannot be hashed") from error
    return hashlib.sha256(_canonical_json(entries).encode()).hexdigest()


def _collect_directory(root: Path, relative_path: str) -> Path:
    reasons: list[str] = []
    directory = _bounded_directory(
        root,
        relative_path,
        reasons,
        reason_prefix="COLLECTION_DIRECTORY",
    )
    if directory is None:
        detail = reasons[0] if reasons else "COLLECTION_DIRECTORY_INVALID"
        raise ValueError(f"cannot collect directory {relative_path}: {detail}")
    return directory


def _collect_file(root: Path, relative_path: str) -> EvidenceFile:
    _relative_path(relative_path, "collected file path")
    try:
        resolved_root = _verified_root(root)
    except ValueError as error:
        raise ValueError("cannot collect from invalid evidence root") from error
    current = resolved_root
    parts = PurePosixPath(relative_path).parts
    for index, part in enumerate(parts):
        current = current / part
        try:
            current_status = current.lstat()
        except OSError as error:
            raise ValueError(
                f"cannot collect missing or unreadable file {relative_path}"
            ) from error
        if stat.S_ISLNK(current_status.st_mode):
            raise ValueError(f"cannot collect symlink file {relative_path}")
        if index < len(parts) - 1 and not stat.S_ISDIR(current_status.st_mode):
            raise ValueError(f"cannot collect file through non-directory {relative_path}")
    if not stat.S_ISREG(current_status.st_mode):
        raise ValueError(f"cannot collect non-regular file {relative_path}")
    try:
        digest = _file_sha256(current)
    except OSError as error:
        raise ValueError(f"cannot hash collected file {relative_path}") from error
    return EvidenceFile(
        path=relative_path,
        sha256=digest,
        size_bytes=current_status.st_size,
    )


def _first_line(root: Path, declared: EvidenceFile) -> str:
    path = _verified_root(root) / declared.path
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError) as error:
        raise ValueError(f"identity output is not valid UTF-8: {declared.path}") from error
    if not lines or not lines[0].strip():
        raise ValueError(f"identity output has no first line: {declared.path}")
    return lines[0].strip()


def _normalized_architecture(value: str) -> str:
    normalized = value.strip().lower()
    aliases = {"amd64": "x86_64", "x64": "x86_64", "arm64": "aarch64"}
    return aliases.get(normalized, normalized)


def _bounded_directory(
    root: Path,
    relative_path: str,
    reasons: list[str],
    *,
    reason_prefix: str,
) -> Path | None:
    try:
        resolved_root = _verified_root(root)
    except ValueError:
        reasons.append("EVIDENCE_ROOT_INVALID")
        return None
    current = resolved_root
    for part in PurePosixPath(relative_path).parts:
        current = current / part
        try:
            current_status = current.lstat()
        except FileNotFoundError:
            reasons.append(f"{reason_prefix}_MISSING")
            return None
        except OSError:
            reasons.append(f"{reason_prefix}_UNREADABLE")
            return None
        if stat.S_ISLNK(current_status.st_mode):
            reasons.append(f"{reason_prefix}_SYMLINK")
            return None
        if not stat.S_ISDIR(current_status.st_mode):
            reasons.append(f"{reason_prefix}_NOT_DIRECTORY")
            return None
    return current


def _verified_root(root: Path) -> Path:
    try:
        status = root.lstat()
    except OSError as error:
        raise ValueError("evidence root cannot be inspected") from error
    if stat.S_ISLNK(status.st_mode) or not stat.S_ISDIR(status.st_mode):
        raise ValueError("evidence root must be a non-symlink directory")
    return root.resolve(strict=True)


def _regular_or_directory_without_symlink(
    path: Path,
    *,
    require_directory: bool,
) -> str:
    try:
        status = path.lstat()
    except FileNotFoundError:
        return "MISSING"
    except OSError:
        return "WRONG_TYPE"
    if stat.S_ISLNK(status.st_mode):
        return "SYMLINK"
    expected = stat.S_ISDIR(status.st_mode) if require_directory else stat.S_ISREG(status.st_mode)
    return "OK" if expected else "WRONG_TYPE"
