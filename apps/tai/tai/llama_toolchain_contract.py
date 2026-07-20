from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from tai.llama_toolchain_types import (
    AuthorityReference,
    AuthorityTarget,
    BinaryEvidence,
    BuildCommandsEvidence,
    BuildEnvironmentEvidence,
    BuildEvidenceStatus,
    BuildLogsEvidence,
    BuildProfile,
    EvidenceFile,
    EvidenceLayout,
    IdentityEvidence,
    LlamaToolchainAuthority,
    LlamaToolchainBuildEvidence,
    SourceEvidence,
    _canonical_json,
)


def load_llama_toolchain_authority(path: Path) -> LlamaToolchainAuthority:
    payload = _load(path)
    _exact_keys(
        payload,
        {
            "schema_version",
            "toolchain_name",
            "repository_uri",
            "release",
            "commit",
            "source_archive_uri",
            "evidence_layout",
            "build_profile",
        },
        "toolchain authority",
    )
    if payload.get("schema_version") != "tai.llama-cpp-toolchain-authority.v1":
        raise ValueError("unsupported llama.cpp toolchain authority schema")
    profile_payload = _object(payload.get("build_profile"), "build_profile")
    _exact_keys(
        profile_payload,
        {
            "profile_id",
            "operating_system",
            "architecture",
            "generator",
            "checkout_path",
            "configure_command",
            "build_command",
            "required_targets",
        },
        "build_profile",
    )
    return LlamaToolchainAuthority(
        toolchain_name=_string(payload, "toolchain_name"),
        repository_uri=_string(payload, "repository_uri"),
        release=_string(payload, "release"),
        commit=_string(payload, "commit"),
        source_archive_uri=_string(payload, "source_archive_uri"),
        evidence_layout=_evidence_layout(payload.get("evidence_layout")),
        build_profile=BuildProfile(
            profile_id=_string(profile_payload, "profile_id"),
            operating_system=_string(profile_payload, "operating_system"),
            architecture=_string(profile_payload, "architecture"),
            generator=_string(profile_payload, "generator"),
            checkout_path=_string(profile_payload, "checkout_path"),
            configure_command=tuple(_strings(profile_payload, "configure_command")),
            build_command=tuple(_strings(profile_payload, "build_command")),
            required_targets=tuple(
                _authority_target(item) for item in _array(profile_payload, "required_targets")
            ),
        ),
    )


def load_llama_toolchain_build_evidence(path: Path) -> LlamaToolchainBuildEvidence:
    payload = _load(path)
    _exact_keys(
        payload,
        {
            "schema_version",
            "status",
            "authority",
            "pending_reason",
            "source",
            "environment",
            "commands",
            "logs",
            "binaries",
        },
        "toolchain build evidence",
    )
    if payload.get("schema_version") != "tai.llama-cpp-build-evidence.v1":
        raise ValueError("unsupported llama.cpp build evidence schema")
    status = BuildEvidenceStatus(_string(payload, "status"))
    return LlamaToolchainBuildEvidence(
        status=status,
        authority=_authority_reference(payload.get("authority")),
        pending_reason=_optional_string(payload, "pending_reason"),
        source=_optional_source(payload.get("source")),
        environment=_optional_environment(payload.get("environment")),
        commands=_optional_commands(payload.get("commands")),
        logs=_optional_logs(payload.get("logs")),
        binaries=tuple(_binary(item) for item in _array(payload, "binaries")),
    )


def authority_to_canonical_json(authority: LlamaToolchainAuthority) -> str:
    return _canonical_json(_authority_payload(authority))


def build_evidence_to_canonical_json(evidence: LlamaToolchainBuildEvidence) -> str:
    return _canonical_json(_build_evidence_payload(evidence))


def _authority_payload(authority: LlamaToolchainAuthority) -> dict[str, object]:
    return {
        "build_profile": {
            "architecture": authority.build_profile.architecture,
            "build_command": list(authority.build_profile.build_command),
            "checkout_path": authority.build_profile.checkout_path,
            "configure_command": list(authority.build_profile.configure_command),
            "generator": authority.build_profile.generator,
            "operating_system": authority.build_profile.operating_system,
            "profile_id": authority.build_profile.profile_id,
            "required_targets": [
                {"path": item.path, "target": item.target}
                for item in authority.build_profile.required_targets
            ],
        },
        "commit": authority.commit,
        "evidence_layout": {
            "build_log_path": authority.evidence_layout.build_log_path,
            "c_compiler_identity_output_path": (
                authority.evidence_layout.c_compiler_identity_output_path
            ),
            "cmake_cache_path": authority.evidence_layout.cmake_cache_path,
            "cmake_identity_output_path": (authority.evidence_layout.cmake_identity_output_path),
            "configure_log_path": authority.evidence_layout.configure_log_path,
            "cxx_compiler_identity_output_path": (
                authority.evidence_layout.cxx_compiler_identity_output_path
            ),
            "git_head_output_path": authority.evidence_layout.git_head_output_path,
            "git_status_output_path": authority.evidence_layout.git_status_output_path,
            "source_archive_path": authority.evidence_layout.source_archive_path,
        },
        "release": authority.release,
        "repository_uri": authority.repository_uri,
        "schema_version": "tai.llama-cpp-toolchain-authority.v1",
        "source_archive_uri": authority.source_archive_uri,
        "toolchain_name": authority.toolchain_name,
    }


def _build_evidence_payload(evidence: LlamaToolchainBuildEvidence) -> dict[str, object]:
    source = evidence.source
    environment = evidence.environment
    commands = evidence.commands
    logs = evidence.logs
    return {
        "authority": {
            "authority_sha256": evidence.authority.authority_sha256,
            "commit": evidence.authority.commit,
            "profile_id": evidence.authority.profile_id,
            "release": evidence.authority.release,
            "repository_uri": evidence.authority.repository_uri,
            "toolchain_name": evidence.authority.toolchain_name,
        },
        "binaries": [
            {
                "path": item.path,
                "sha256": item.sha256,
                "size_bytes": item.size_bytes,
                "target": item.target,
            }
            for item in evidence.binaries
        ],
        "commands": (
            None
            if commands is None
            else {"build": list(commands.build), "configure": list(commands.configure)}
        ),
        "environment": (
            None
            if environment is None
            else {
                "architecture": environment.architecture,
                "c_compiler": _identity_payload(environment.c_compiler),
                "cmake": _identity_payload(environment.cmake),
                "cxx_compiler": _identity_payload(environment.cxx_compiler),
                "generator": environment.generator,
                "operating_system": environment.operating_system,
            }
        ),
        "logs": (
            None
            if logs is None
            else {
                "build_log": _file_payload(logs.build_log),
                "cmake_cache": _file_payload(logs.cmake_cache),
                "configure_log": _file_payload(logs.configure_log),
            }
        ),
        "pending_reason": evidence.pending_reason,
        "schema_version": "tai.llama-cpp-build-evidence.v1",
        "source": (
            None
            if source is None
            else {
                "checkout_path": source.checkout_path,
                "checkout_tree_sha256": source.checkout_tree_sha256,
                "git_head_output": _file_payload(source.git_head_output),
                "git_status_output": _file_payload(source.git_status_output),
                "source_archive": _file_payload(source.source_archive),
            }
        ),
        "status": evidence.status.value,
    }


def _identity_payload(identity: IdentityEvidence) -> dict[str, object]:
    return {
        "executable": identity.executable,
        "output": _file_payload(identity.output),
        "version": identity.version,
    }


def _file_payload(item: EvidenceFile) -> dict[str, object]:
    return {"path": item.path, "sha256": item.sha256, "size_bytes": item.size_bytes}


def _evidence_layout(value: object) -> EvidenceLayout:
    payload = _object(value, "evidence_layout")
    keys = {
        "source_archive_path",
        "git_head_output_path",
        "git_status_output_path",
        "cmake_identity_output_path",
        "c_compiler_identity_output_path",
        "cxx_compiler_identity_output_path",
        "configure_log_path",
        "build_log_path",
        "cmake_cache_path",
    }
    _exact_keys(payload, keys, "evidence_layout")
    return EvidenceLayout(
        source_archive_path=_string(payload, "source_archive_path"),
        git_head_output_path=_string(payload, "git_head_output_path"),
        git_status_output_path=_string(payload, "git_status_output_path"),
        cmake_identity_output_path=_string(payload, "cmake_identity_output_path"),
        c_compiler_identity_output_path=_string(payload, "c_compiler_identity_output_path"),
        cxx_compiler_identity_output_path=_string(payload, "cxx_compiler_identity_output_path"),
        configure_log_path=_string(payload, "configure_log_path"),
        build_log_path=_string(payload, "build_log_path"),
        cmake_cache_path=_string(payload, "cmake_cache_path"),
    )


def _authority_target(value: object) -> AuthorityTarget:
    payload = _object(value, "authority target")
    _exact_keys(payload, {"target", "path"}, "authority target")
    return AuthorityTarget(
        target=_string(payload, "target"),
        path=_string(payload, "path"),
    )


def _authority_reference(value: object) -> AuthorityReference:
    payload = _object(value, "authority reference")
    _exact_keys(
        payload,
        {
            "toolchain_name",
            "repository_uri",
            "release",
            "commit",
            "profile_id",
            "authority_sha256",
        },
        "authority reference",
    )
    return AuthorityReference(
        toolchain_name=_string(payload, "toolchain_name"),
        repository_uri=_string(payload, "repository_uri"),
        release=_string(payload, "release"),
        commit=_string(payload, "commit"),
        profile_id=_string(payload, "profile_id"),
        authority_sha256=_string(payload, "authority_sha256"),
    )


def _optional_source(value: object) -> SourceEvidence | None:
    if value is None:
        return None
    payload = _object(value, "source evidence")
    _exact_keys(
        payload,
        {
            "checkout_path",
            "checkout_tree_sha256",
            "git_head_output",
            "git_status_output",
            "source_archive",
        },
        "source evidence",
    )
    return SourceEvidence(
        checkout_path=_string(payload, "checkout_path"),
        checkout_tree_sha256=_string(payload, "checkout_tree_sha256"),
        git_head_output=_evidence_file(payload.get("git_head_output")),
        git_status_output=_evidence_file(payload.get("git_status_output")),
        source_archive=_evidence_file(payload.get("source_archive")),
    )


def _optional_environment(value: object) -> BuildEnvironmentEvidence | None:
    if value is None:
        return None
    payload = _object(value, "environment evidence")
    _exact_keys(
        payload,
        {
            "operating_system",
            "architecture",
            "generator",
            "cmake",
            "c_compiler",
            "cxx_compiler",
        },
        "environment evidence",
    )
    return BuildEnvironmentEvidence(
        operating_system=_string(payload, "operating_system"),
        architecture=_string(payload, "architecture"),
        generator=_string(payload, "generator"),
        cmake=_identity_evidence(payload.get("cmake"), "cmake"),
        c_compiler=_identity_evidence(payload.get("c_compiler"), "c_compiler"),
        cxx_compiler=_identity_evidence(payload.get("cxx_compiler"), "cxx_compiler"),
    )


def _identity_evidence(value: object, name: str) -> IdentityEvidence:
    payload = _object(value, name)
    _exact_keys(payload, {"executable", "version", "output"}, name)
    return IdentityEvidence(
        executable=_string(payload, "executable"),
        version=_string(payload, "version"),
        output=_evidence_file(payload.get("output")),
    )


def _optional_commands(value: object) -> BuildCommandsEvidence | None:
    if value is None:
        return None
    payload = _object(value, "commands evidence")
    _exact_keys(payload, {"configure", "build"}, "commands evidence")
    return BuildCommandsEvidence(
        configure=tuple(_strings(payload, "configure")),
        build=tuple(_strings(payload, "build")),
    )


def _optional_logs(value: object) -> BuildLogsEvidence | None:
    if value is None:
        return None
    payload = _object(value, "logs evidence")
    _exact_keys(
        payload,
        {"configure_log", "build_log", "cmake_cache"},
        "logs evidence",
    )
    return BuildLogsEvidence(
        configure_log=_evidence_file(payload.get("configure_log")),
        build_log=_evidence_file(payload.get("build_log")),
        cmake_cache=_evidence_file(payload.get("cmake_cache")),
    )


def _binary(value: object) -> BinaryEvidence:
    payload = _object(value, "binary evidence")
    _exact_keys(payload, {"target", "path", "sha256", "size_bytes"}, "binary evidence")
    return BinaryEvidence(
        target=_string(payload, "target"),
        path=_string(payload, "path"),
        sha256=_string(payload, "sha256"),
        size_bytes=_integer(payload, "size_bytes"),
    )


def _evidence_file(value: object) -> EvidenceFile:
    payload = _object(value, "evidence file")
    _exact_keys(payload, {"path", "sha256", "size_bytes"}, "evidence file")
    return EvidenceFile(
        path=_string(payload, "path"),
        sha256=_string(payload, "sha256"),
        size_bytes=_integer(payload, "size_bytes"),
    )


def _load(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot load JSON from {path}") from error
    return _object(payload, "root payload")


def _object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be a JSON object")
    if any(not isinstance(key, str) for key in value):
        raise ValueError(f"{name} keys must be strings")
    return cast(dict[str, Any], value)


def _array(payload: dict[str, Any], key: str) -> list[object]:
    value = payload.get(key)
    if not isinstance(value, list):
        raise ValueError(f"{key} must be an array")
    return cast(list[object], value)


def _strings(payload: dict[str, Any], key: str) -> list[str]:
    values = _array(payload, key)
    if not values or any(not isinstance(item, str) or not item for item in values):
        raise ValueError(f"{key} must be a non-empty string array")
    return cast(list[str], values)


def _string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value


def _optional_string(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be null or a non-empty string")
    return value


def _integer(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{key} must be an integer")
    return value


def _exact_keys(payload: dict[str, Any], expected: set[str], name: str) -> None:
    actual = set(payload)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise ValueError(f"{name} keys mismatch; missing={missing}; extra={extra}")
