from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path, PurePosixPath
from typing import cast
from urllib.parse import urlsplit

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_GIT_COMMIT = re.compile(r"^[0-9a-f]{40}$")
_RELEASE = re.compile(r"^b[0-9]{1,10}$")
_IDENTITY = re.compile(r"^[A-Za-z0-9._:/+-]{1,180}$")
_TARGET = re.compile(r"^llama-[a-z0-9-]{1,64}$")
_EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()
_CHUNK_SIZE = 1024 * 1024
_REQUIRED_TARGETS = ("llama-cli", "llama-server", "llama-quantize", "llama-bench")


class BuildEvidenceStatus(StrEnum):
    PENDING_BUILD = "PENDING_BUILD"
    BUILT = "BUILT"


class ToolchainVerificationStatus(StrEnum):
    VERIFIED = "VERIFIED"
    PENDING_BUILD = "PENDING_BUILD"
    REJECTED = "REJECTED"


@dataclass(frozen=True, slots=True)
class AuthorityTarget:
    target: str
    path: str

    def __post_init__(self) -> None:
        if _TARGET.fullmatch(self.target) is None:
            raise ValueError("target must be a portable llama.cpp executable target")
        _relative_path(self.path, "target path")


@dataclass(frozen=True, slots=True)
class BuildProfile:
    profile_id: str
    operating_system: str
    architecture: str
    generator: str
    checkout_path: str
    configure_command: tuple[str, ...]
    build_command: tuple[str, ...]
    required_targets: tuple[AuthorityTarget, ...]

    def __post_init__(self) -> None:
        _identity(self.profile_id, "profile_id")
        _identity(self.operating_system, "operating_system")
        _identity(self.architecture, "architecture")
        _bounded_text(self.generator, "generator", maximum=120)
        _relative_path(self.checkout_path, "checkout_path")
        _command(self.configure_command, "configure_command")
        _command(self.build_command, "build_command")
        if not self.required_targets:
            raise ValueError("required_targets must not be empty")
        targets = tuple(item.target for item in self.required_targets)
        paths = tuple(item.path for item in self.required_targets)
        if len(targets) != len(set(targets)):
            raise ValueError("required target names must be unique")
        if targets != _REQUIRED_TARGETS:
            raise ValueError("required_targets must declare the four controlled llama.cpp targets")
        if len(paths) != len(set(paths)):
            raise ValueError("required target paths must be unique")


@dataclass(frozen=True, slots=True)
class EvidenceLayout:
    source_archive_path: str
    git_head_output_path: str
    git_status_output_path: str
    cmake_identity_output_path: str
    c_compiler_identity_output_path: str
    cxx_compiler_identity_output_path: str
    configure_log_path: str
    build_log_path: str
    cmake_cache_path: str

    def __post_init__(self) -> None:
        paths = (
            self.source_archive_path,
            self.git_head_output_path,
            self.git_status_output_path,
            self.cmake_identity_output_path,
            self.c_compiler_identity_output_path,
            self.cxx_compiler_identity_output_path,
            self.configure_log_path,
            self.build_log_path,
            self.cmake_cache_path,
        )
        for path in paths:
            _relative_path(path, "evidence layout path")
        if len(paths) != len(set(paths)):
            raise ValueError("evidence layout paths must be unique")


@dataclass(frozen=True, slots=True)
class LlamaToolchainAuthority:
    toolchain_name: str
    repository_uri: str
    release: str
    commit: str
    source_archive_uri: str
    evidence_layout: EvidenceLayout
    build_profile: BuildProfile

    def __post_init__(self) -> None:
        _identity(self.toolchain_name, "toolchain_name")
        _https_uri(self.repository_uri, "repository_uri")
        if _RELEASE.fullmatch(self.release) is None:
            raise ValueError("release must be an immutable llama.cpp build tag")
        _commit(self.commit, "commit")
        _https_uri(self.source_archive_uri, "source_archive_uri")
        archive = urlsplit(self.source_archive_uri)
        repository = urlsplit(self.repository_uri)
        if archive.netloc != repository.netloc:
            raise ValueError("source_archive_uri host must match repository_uri")
        if self.commit not in archive.path:
            raise ValueError("source_archive_uri must contain the exact full commit")
        if self.release in archive.path:
            raise ValueError("source_archive_uri must use the exact commit, not the release tag")
        controlled_paths = (
            *(item.path for item in self.build_profile.required_targets),
            self.evidence_layout.source_archive_path,
            self.evidence_layout.git_head_output_path,
            self.evidence_layout.git_status_output_path,
            self.evidence_layout.cmake_identity_output_path,
            self.evidence_layout.c_compiler_identity_output_path,
            self.evidence_layout.cxx_compiler_identity_output_path,
            self.evidence_layout.configure_log_path,
            self.evidence_layout.build_log_path,
            self.evidence_layout.cmake_cache_path,
        )
        if len(controlled_paths) != len(set(controlled_paths)):
            raise ValueError("authority target and evidence paths must be unique")

    @property
    def authority_sha256(self) -> str:
        from tai.llama_toolchain_contract import authority_to_canonical_json

        return hashlib.sha256(authority_to_canonical_json(self).encode()).hexdigest()


@dataclass(frozen=True, slots=True)
class AuthorityReference:
    toolchain_name: str
    repository_uri: str
    release: str
    commit: str
    profile_id: str
    authority_sha256: str

    def __post_init__(self) -> None:
        _identity(self.toolchain_name, "authority toolchain_name")
        _https_uri(self.repository_uri, "authority repository_uri")
        if _RELEASE.fullmatch(self.release) is None:
            raise ValueError("authority release must be an immutable llama.cpp build tag")
        _commit(self.commit, "authority commit")
        _identity(self.profile_id, "authority profile_id")
        _sha256(self.authority_sha256, "authority_sha256")


@dataclass(frozen=True, slots=True)
class EvidenceFile:
    path: str
    sha256: str
    size_bytes: int

    def __post_init__(self) -> None:
        _relative_path(self.path, "evidence file path")
        _sha256(self.sha256, "evidence file sha256")
        if self.size_bytes < 0:
            raise ValueError("evidence file size must not be negative")


@dataclass(frozen=True, slots=True)
class SourceEvidence:
    checkout_path: str
    checkout_tree_sha256: str
    git_head_output: EvidenceFile
    git_status_output: EvidenceFile
    source_archive: EvidenceFile

    def __post_init__(self) -> None:
        _relative_path(self.checkout_path, "source checkout_path")
        _sha256(self.checkout_tree_sha256, "checkout_tree_sha256")
        paths = (
            self.git_head_output.path,
            self.git_status_output.path,
            self.source_archive.path,
        )
        if len(paths) != len(set(paths)):
            raise ValueError("source evidence file paths must be unique")
        if self.git_head_output.size_bytes < 1 or self.source_archive.size_bytes < 1:
            raise ValueError("source head and archive evidence must be non-empty")


@dataclass(frozen=True, slots=True)
class IdentityEvidence:
    executable: str
    version: str
    output: EvidenceFile

    def __post_init__(self) -> None:
        _bounded_text(self.executable, "identity executable", maximum=512)
        _bounded_text(self.version, "identity version", maximum=512)
        if self.output.size_bytes < 1:
            raise ValueError("identity output evidence must be non-empty")


@dataclass(frozen=True, slots=True)
class BuildEnvironmentEvidence:
    operating_system: str
    architecture: str
    generator: str
    cmake: IdentityEvidence
    c_compiler: IdentityEvidence
    cxx_compiler: IdentityEvidence

    def __post_init__(self) -> None:
        _identity(self.operating_system, "environment operating_system")
        _identity(self.architecture, "environment architecture")
        _bounded_text(self.generator, "environment generator", maximum=120)
        paths = (
            self.cmake.output.path,
            self.c_compiler.output.path,
            self.cxx_compiler.output.path,
        )
        if len(paths) != len(set(paths)):
            raise ValueError("identity output paths must be unique")


@dataclass(frozen=True, slots=True)
class BuildCommandsEvidence:
    configure: tuple[str, ...]
    build: tuple[str, ...]

    def __post_init__(self) -> None:
        _command(self.configure, "evidence configure command")
        _command(self.build, "evidence build command")


@dataclass(frozen=True, slots=True)
class BuildLogsEvidence:
    configure_log: EvidenceFile
    build_log: EvidenceFile
    cmake_cache: EvidenceFile

    def __post_init__(self) -> None:
        files = (self.configure_log, self.build_log, self.cmake_cache)
        if any(item.size_bytes < 1 for item in files):
            raise ValueError("build log and CMake cache evidence must be non-empty")
        paths = tuple(item.path for item in files)
        if len(paths) != len(set(paths)):
            raise ValueError("build log evidence paths must be unique")


@dataclass(frozen=True, slots=True)
class BinaryEvidence:
    target: str
    path: str
    sha256: str
    size_bytes: int

    def __post_init__(self) -> None:
        if _TARGET.fullmatch(self.target) is None:
            raise ValueError("binary target must be a portable llama.cpp target")
        _relative_path(self.path, "binary path")
        _sha256(self.sha256, "binary sha256")
        if self.size_bytes < 1:
            raise ValueError("binary size must be positive")


@dataclass(frozen=True, slots=True)
class LlamaToolchainBuildEvidence:
    status: BuildEvidenceStatus
    authority: AuthorityReference
    pending_reason: str | None
    source: SourceEvidence | None
    environment: BuildEnvironmentEvidence | None
    commands: BuildCommandsEvidence | None
    logs: BuildLogsEvidence | None
    binaries: tuple[BinaryEvidence, ...]

    def __post_init__(self) -> None:
        if self.pending_reason is not None:
            _bounded_text(self.pending_reason, "pending_reason", maximum=500)
        if self.status is BuildEvidenceStatus.PENDING_BUILD:
            if self.pending_reason is None:
                raise ValueError("PENDING_BUILD evidence requires pending_reason")
            if any(
                item is not None
                for item in (self.source, self.environment, self.commands, self.logs)
            ) or self.binaries:
                raise ValueError("PENDING_BUILD evidence must not fabricate build observations")
            return
        if self.pending_reason is not None:
            raise ValueError("BUILT evidence must not contain pending_reason")
        if any(
            item is None
            for item in (self.source, self.environment, self.commands, self.logs)
        ):
            raise ValueError("BUILT evidence requires source, environment, commands and logs")
        if not self.binaries:
            raise ValueError("BUILT evidence requires binaries")
        targets = tuple(item.target for item in self.binaries)
        paths = tuple(item.path for item in self.binaries)
        if len(targets) != len(set(targets)):
            raise ValueError("binary target names must be unique")
        if len(paths) != len(set(paths)):
            raise ValueError("binary paths must be unique")
        all_paths = _all_declared_paths(self)
        if len(all_paths) != len(set(all_paths)):
            raise ValueError("all declared evidence paths must be unique")

    @property
    def evidence_sha256(self) -> str:
        from tai.llama_toolchain_contract import build_evidence_to_canonical_json

        return hashlib.sha256(build_evidence_to_canonical_json(self).encode()).hexdigest()


@dataclass(frozen=True, slots=True)
class ToolchainVerificationReport:
    status: ToolchainVerificationStatus
    reasons: tuple[str, ...]
    authority_sha256: str
    evidence_sha256: str
    verified_files: tuple[str, ...]
    verified_targets: tuple[str, ...]
    report_sha256: str

    @property
    def verified(self) -> bool:
        return self.status is ToolchainVerificationStatus.VERIFIED


@dataclass(frozen=True, slots=True)
class _VerifiedFile:
    path: Path
    relative_path: str
    device: int
    inode: int


def _all_declared_paths(evidence: LlamaToolchainBuildEvidence) -> tuple[str, ...]:
    source = cast(SourceEvidence, evidence.source)
    environment = cast(BuildEnvironmentEvidence, evidence.environment)
    logs = cast(BuildLogsEvidence, evidence.logs)
    return (
        source.git_head_output.path,
        source.git_status_output.path,
        source.source_archive.path,
        environment.cmake.output.path,
        environment.c_compiler.output.path,
        environment.cxx_compiler.output.path,
        logs.configure_log.path,
        logs.build_log.path,
        logs.cmake_cache.path,
        *(item.path for item in evidence.binaries),
    )


def _canonical_json(payload: object) -> str:
    return json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _identity(value: str, name: str) -> None:
    if _IDENTITY.fullmatch(value) is None:
        raise ValueError(f"{name} must be a portable bounded identity")


def _commit(value: str, name: str) -> None:
    if _GIT_COMMIT.fullmatch(value) is None:
        raise ValueError(f"{name} must be a full lowercase 40-character Git commit")


def _sha256(value: str, name: str) -> None:
    if _SHA256.fullmatch(value) is None:
        raise ValueError(f"{name} must be a lowercase SHA-256 digest")


def _https_uri(value: str, name: str) -> None:
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError(f"{name} must be a bounded credential-free HTTPS URI")


def _relative_path(value: str, name: str) -> None:
    if "\\" in value or "\x00" in value:
        raise ValueError(f"{name} must be a bounded POSIX relative path")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or value.startswith("./"):
        raise ValueError(f"{name} must be a bounded POSIX relative path")
    if not path.parts or any(part in {"", "."} for part in path.parts):
        raise ValueError(f"{name} must be a bounded POSIX relative path")


def _command(value: tuple[str, ...], name: str) -> None:
    if not value:
        raise ValueError(f"{name} must not be empty")
    for item in value:
        _bounded_text(item, name, maximum=1000)


def _bounded_text(value: str, name: str, *, maximum: int) -> None:
    if not value or len(value) > maximum or any(ord(character) < 32 for character in value):
        raise ValueError(f"{name} must be bounded printable text")


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(_CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()

