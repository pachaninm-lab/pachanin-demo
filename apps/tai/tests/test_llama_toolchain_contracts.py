from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, cast

import pytest

from tai.llama_toolchain import (
    ToolchainVerificationStatus,
    load_llama_toolchain_authority,
    load_llama_toolchain_build_evidence,
    source_tree_sha256,
    verify_llama_toolchain,
)
import tai.model_artifact_registry_cli as artifact_cli
from tai.model_artifact_registry_cli import main

ROOT = Path(__file__).resolve().parents[1]
AUTHORITY_PATH = ROOT / "model-artifacts" / "llama-cpp-toolchain-authority.v1.json"
BASELINE_PATH = ROOT / "model-artifacts" / "llama-cpp-build-baseline.v1.json"
SCHEMA_PATH = ROOT / "model-artifacts" / "llama-cpp-build-evidence.schema.v1.json"
CANDIDATES_PATH = ROOT / "model-artifacts" / "candidates.v1.json"
COMMIT = "aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3"


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _authority_payload() -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(AUTHORITY_PATH.read_text(encoding="utf-8")))


def _declare(root: Path, relative_path: str, content: bytes) -> dict[str, object]:
    target = root / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return {
        "path": relative_path,
        "sha256": _sha256(content),
        "size_bytes": len(content),
    }


def _prepare_built_evidence(tmp_path: Path) -> tuple[Path, dict[str, Any], Path]:
    authority = load_llama_toolchain_authority(AUTHORITY_PATH)
    evidence_root = tmp_path / "evidence-root"
    checkout = evidence_root / authority.build_profile.checkout_path
    (checkout / ".git").mkdir(parents=True)
    (checkout / ".git" / "config").write_text("[core]\n", encoding="utf-8")
    (checkout / "CMakeLists.txt").write_text("project(llama)\n", encoding="utf-8")
    (checkout / "src").mkdir()
    (checkout / "src" / "llama.cpp").write_text("int llama = 1;\n", encoding="utf-8")

    source = {
        "checkout_path": authority.build_profile.checkout_path,
        "checkout_tree_sha256": source_tree_sha256(checkout),
        "git_head_output": _declare(
            evidence_root,
            "evidence/git-head.txt",
            (authority.commit + "\n").encode(),
        ),
        "git_status_output": _declare(
            evidence_root,
            "evidence/git-status.txt",
            b"",
        ),
        "source_archive": _declare(
            evidence_root,
            authority.evidence_layout.source_archive_path,
            b"exact source archive bytes",
        ),
    }
    environment = {
        "operating_system": authority.build_profile.operating_system,
        "architecture": authority.build_profile.architecture,
        "generator": authority.build_profile.generator,
        "cmake": {
            "executable": "/usr/bin/cmake",
            "version": "3.31.6",
            "output": _declare(
                evidence_root,
                authority.evidence_layout.cmake_identity_output_path,
                b"cmake version 3.31.6\n",
            ),
        },
        "c_compiler": {
            "executable": "/usr/bin/cc",
            "version": "14.2.0",
            "output": _declare(
                evidence_root,
                authority.evidence_layout.c_compiler_identity_output_path,
                b"cc (GCC) 14.2.0\n",
            ),
        },
        "cxx_compiler": {
            "executable": "/usr/bin/c++",
            "version": "14.2.0",
            "output": _declare(
                evidence_root,
                authority.evidence_layout.cxx_compiler_identity_output_path,
                b"c++ (GCC) 14.2.0\n",
            ),
        },
    }
    logs = {
        "configure_log": _declare(
            evidence_root,
            authority.evidence_layout.configure_log_path,
            b"configure completed\n",
        ),
        "build_log": _declare(
            evidence_root,
            authority.evidence_layout.build_log_path,
            b"build completed\n",
        ),
        "cmake_cache": _declare(
            evidence_root,
            authority.evidence_layout.cmake_cache_path,
            b"CMAKE_BUILD_TYPE:STRING=Release\n",
        ),
    }
    binaries: list[dict[str, object]] = []
    for index, target in enumerate(authority.build_profile.required_targets):
        declaration = _declare(
            evidence_root,
            target.path,
            f"binary-{index}-{target.target}".encode(),
        )
        binaries.append({"target": target.target, **declaration})

    payload: dict[str, Any] = {
        "schema_version": "tai.llama-cpp-build-evidence.v1",
        "status": "BUILT",
        "authority": {
            "toolchain_name": authority.toolchain_name,
            "repository_uri": authority.repository_uri,
            "release": authority.release,
            "commit": authority.commit,
            "profile_id": authority.build_profile.profile_id,
            "authority_sha256": authority.authority_sha256,
        },
        "pending_reason": None,
        "source": source,
        "environment": environment,
        "commands": {
            "configure": list(authority.build_profile.configure_command),
            "build": list(authority.build_profile.build_command),
        },
        "logs": logs,
        "binaries": binaries,
    }
    evidence_path = tmp_path / "built-evidence.json"
    _write_json(evidence_path, payload)
    return evidence_path, payload, evidence_root


def _reload(
    evidence_path: Path,
    payload: dict[str, Any],
) -> None:
    _write_json(evidence_path, payload)


def _verify(evidence_path: Path, evidence_root: Path):  # type: ignore[no-untyped-def]
    return verify_llama_toolchain(
        authority=load_llama_toolchain_authority(AUTHORITY_PATH),
        evidence=load_llama_toolchain_build_evidence(evidence_path),
        evidence_root=evidence_root,
    )


def test_duplicate_or_escaping_paths_and_fabricated_pending_are_invalid(tmp_path: Path) -> None:
    evidence_path, payload, _ = _prepare_built_evidence(tmp_path)
    binaries = cast(list[dict[str, Any]], payload["binaries"])
    binaries[1]["path"] = binaries[0]["path"]
    _reload(evidence_path, payload)
    with pytest.raises(ValueError, match="binary paths must be unique"):
        load_llama_toolchain_build_evidence(evidence_path)

    binaries[1]["path"] = "../escape"
    _reload(evidence_path, payload)
    with pytest.raises(ValueError, match="bounded POSIX relative path"):
        load_llama_toolchain_build_evidence(evidence_path)

    pending = cast(dict[str, Any], json.loads(BASELINE_PATH.read_text(encoding="utf-8")))
    pending["binaries"] = [binaries[0]]
    _reload(evidence_path, pending)
    with pytest.raises(ValueError, match="must not fabricate"):
        load_llama_toolchain_build_evidence(evidence_path)


def test_mutable_or_short_authority_and_unknown_keys_are_invalid(tmp_path: Path) -> None:
    payload = _authority_payload()
    payload["commit"] = "aedb2a5"
    path = tmp_path / "authority.json"
    _write_json(path, payload)
    with pytest.raises(ValueError, match="full lowercase 40-character"):
        load_llama_toolchain_authority(path)

    payload = _authority_payload()
    payload["source_archive_uri"] = (
        "https://github.com/ggml-org/llama.cpp/archive/b9637.tar.gz"
    )
    _write_json(path, payload)
    with pytest.raises(ValueError, match="exact full commit"):
        load_llama_toolchain_authority(path)

    payload = _authority_payload()
    payload["unexpected"] = True
    _write_json(path, payload)
    with pytest.raises(ValueError, match="keys mismatch"):
        load_llama_toolchain_authority(path)


def test_checkout_and_evidence_root_symlinks_fail_closed(tmp_path: Path) -> None:
    evidence_path, payload, evidence_root = _prepare_built_evidence(tmp_path)
    source = cast(dict[str, Any], payload["source"])
    checkout_path = evidence_root / cast(str, source["checkout_path"])
    real_checkout = tmp_path / "real-checkout"
    checkout_path.rename(real_checkout)
    try:
        checkout_path.symlink_to(real_checkout, target_is_directory=True)
    except OSError:
        pytest.skip("symlinks are unavailable")
    report = _verify(evidence_path, evidence_root)
    assert "SOURCE_CHECKOUT_SYMLINK" in report.reasons

    evidence_root_link = tmp_path / "root-link"
    evidence_root_link.symlink_to(evidence_root, target_is_directory=True)
    root_report = _verify(evidence_path, evidence_root_link)
    assert "EVIDENCE_ROOT_INVALID" in root_report.reasons


def test_source_tree_digest_excludes_git_and_includes_symlink_target(tmp_path: Path) -> None:
    checkout = tmp_path / "checkout"
    (checkout / ".git").mkdir(parents=True)
    (checkout / ".git" / "state").write_text("one", encoding="utf-8")
    (checkout / "file").write_text("content", encoding="utf-8")
    try:
        (checkout / "link").symlink_to("file")
    except OSError:
        pytest.skip("symlinks are unavailable")
    first = source_tree_sha256(checkout)
    (checkout / ".git" / "state").write_text("two", encoding="utf-8")
    assert source_tree_sha256(checkout) == first
    (checkout / "link").unlink()
    (checkout / "link").symlink_to("other")
    assert source_tree_sha256(checkout) != first


def test_verifier_treats_manifest_commands_as_data_only(tmp_path: Path) -> None:
    authority_payload = _authority_payload()
    profile = cast(dict[str, Any], authority_payload["build_profile"])
    marker = tmp_path / "must-not-exist"
    profile["configure_command"] = [str(marker)]
    authority_path = tmp_path / "authority.json"
    _write_json(authority_path, authority_payload)
    authority = load_llama_toolchain_authority(authority_path)

    evidence_path, payload, evidence_root = _prepare_built_evidence(tmp_path / "build")
    authority_ref = cast(dict[str, Any], payload["authority"])
    authority_ref["authority_sha256"] = authority.authority_sha256
    commands = cast(dict[str, Any], payload["commands"])
    commands["configure"] = [str(marker)]
    _reload(evidence_path, payload)
    report = verify_llama_toolchain(
        authority=authority,
        evidence=load_llama_toolchain_build_evidence(evidence_path),
        evidence_root=evidence_root,
    )

    assert not marker.exists()
    assert "CONFIGURE_COMMAND_MISMATCH" not in report.reasons


def test_cli_returns_structured_invalid_report(tmp_path: Path) -> None:
    invalid = tmp_path / "invalid.json"
    invalid.write_text("not-json", encoding="utf-8")
    output = tmp_path / "error.json"
    result = main(
        [
            "verify-toolchain",
            str(AUTHORITY_PATH),
            str(invalid),
            str(tmp_path),
            "--output",
            str(output),
        ]
    )
    payload = json.loads(output.read_text(encoding="utf-8"))

    assert result == 2
    assert payload["status"] == "INVALID"
    assert payload["schema_version"] == "tai.model-artifact-cli-error.v1"


def test_external_evidence_schema_is_strict_and_models_pending_and_built() -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["additionalProperties"] is False
    assert len(schema["oneOf"]) == 2
    assert schema["$defs"]["commit"]["pattern"] == "^[0-9a-f]{40}$"
    assert schema["$defs"]["binaryEvidence"]["additionalProperties"] is False


def test_authority_loader_rejects_ambiguous_or_incomplete_profiles(tmp_path: Path) -> None:
    path = tmp_path / "authority-invalid.json"

    def reject(payload: dict[str, Any], match: str) -> None:
        _write_json(path, payload)
        with pytest.raises(ValueError, match=match):
            load_llama_toolchain_authority(path)

    payload = _authority_payload()
    profile = cast(dict[str, Any], payload["build_profile"])
    targets = cast(list[dict[str, Any]], profile["required_targets"])
    targets[0]["target"] = "not-a-controlled-target"
    reject(payload, "portable llama.cpp executable target")

    payload = _authority_payload()
    cast(dict[str, Any], payload["build_profile"])["required_targets"] = []
    reject(payload, "must not be empty")

    payload = _authority_payload()
    profile = cast(dict[str, Any], payload["build_profile"])
    targets = cast(list[dict[str, Any]], profile["required_targets"])
    targets[1]["target"] = targets[0]["target"]
    reject(payload, "target names must be unique")

    payload = _authority_payload()
    profile = cast(dict[str, Any], payload["build_profile"])
    targets = cast(list[dict[str, Any]], profile["required_targets"])
    targets[0]["target"] = "llama-other"
    reject(payload, "four controlled")

    payload = _authority_payload()
    profile = cast(dict[str, Any], payload["build_profile"])
    targets = cast(list[dict[str, Any]], profile["required_targets"])
    targets[1]["path"] = targets[0]["path"]
    reject(payload, "target paths must be unique")

    payload = _authority_payload()
    layout = cast(dict[str, Any], payload["evidence_layout"])
    layout["build_log_path"] = layout["configure_log_path"]
    reject(payload, "evidence layout paths must be unique")

    payload = _authority_payload()
    payload["release"] = "latest"
    reject(payload, "immutable llama.cpp build tag")

    payload = _authority_payload()
    payload["source_archive_uri"] = f"https://example.com/archive/{COMMIT}.tar.gz"
    reject(payload, "host must match")

    payload = _authority_payload()
    payload["source_archive_uri"] = (
        f"https://github.com/ggml-org/llama.cpp/archive/b9637-{COMMIT}.tar.gz"
    )
    reject(payload, "not the release tag")

    payload = _authority_payload()
    layout = cast(dict[str, Any], payload["evidence_layout"])
    profile = cast(dict[str, Any], payload["build_profile"])
    targets = cast(list[dict[str, Any]], profile["required_targets"])
    layout["source_archive_path"] = targets[0]["path"]
    reject(payload, "authority target and evidence paths must be unique")


def test_evidence_loader_rejects_malformed_built_contracts(tmp_path: Path) -> None:
    evidence_path, original, _ = _prepare_built_evidence(tmp_path)

    def fresh() -> dict[str, Any]:
        return cast(dict[str, Any], json.loads(json.dumps(original)))

    def reject(payload: dict[str, Any], match: str) -> None:
        _reload(evidence_path, payload)
        with pytest.raises(ValueError, match=match):
            load_llama_toolchain_build_evidence(evidence_path)

    payload = fresh()
    cast(dict[str, Any], payload["authority"])["release"] = "main"
    reject(payload, "immutable llama.cpp build tag")

    payload = fresh()
    source = cast(dict[str, Any], payload["source"])
    cast(dict[str, Any], source["source_archive"])["size_bytes"] = -1
    reject(payload, "must not be negative")

    payload = fresh()
    source = cast(dict[str, Any], payload["source"])
    cast(dict[str, Any], source["source_archive"])["path"] = cast(
        dict[str, Any], source["git_head_output"]
    )["path"]
    reject(payload, "source evidence file paths must be unique")

    payload = fresh()
    source = cast(dict[str, Any], payload["source"])
    cast(dict[str, Any], source["git_head_output"])["size_bytes"] = 0
    reject(payload, "source head and archive evidence must be non-empty")

    payload = fresh()
    environment = cast(dict[str, Any], payload["environment"])
    cast(dict[str, Any], cast(dict[str, Any], environment["cmake"])["output"])[
        "size_bytes"
    ] = 0
    reject(payload, "identity output evidence must be non-empty")

    payload = fresh()
    environment = cast(dict[str, Any], payload["environment"])
    cmake_output = cast(dict[str, Any], environment["cmake"])["output"]
    cast(dict[str, Any], environment["c_compiler"])["output"] = cmake_output
    reject(payload, "identity output paths must be unique")

    payload = fresh()
    logs = cast(dict[str, Any], payload["logs"])
    cast(dict[str, Any], logs["build_log"])["size_bytes"] = 0
    reject(payload, "build log and CMake cache evidence must be non-empty")

    payload = fresh()
    logs = cast(dict[str, Any], payload["logs"])
    cast(dict[str, Any], logs["build_log"])["path"] = cast(
        dict[str, Any], logs["configure_log"]
    )["path"]
    reject(payload, "build log evidence paths must be unique")

    payload = fresh()
    binaries = cast(list[dict[str, Any]], payload["binaries"])
    binaries[0]["target"] = "bad"
    reject(payload, "portable llama.cpp target")

    payload = fresh()
    binaries = cast(list[dict[str, Any]], payload["binaries"])
    binaries[0]["size_bytes"] = 0
    reject(payload, "binary size must be positive")

    payload = fresh()
    payload["pending_reason"] = "not pending"
    reject(payload, "BUILT evidence must not contain pending_reason")

    payload = fresh()
    payload["source"] = None
    reject(payload, "requires source, environment, commands and logs")

    payload = fresh()
    payload["binaries"] = []
    reject(payload, "requires binaries")

    payload = fresh()
    binaries = cast(list[dict[str, Any]], payload["binaries"])
    binaries[1]["target"] = binaries[0]["target"]
    reject(payload, "binary target names must be unique")

    payload = fresh()
    binaries = cast(list[dict[str, Any]], payload["binaries"])
    logs = cast(dict[str, Any], payload["logs"])
    binaries[0]["path"] = cast(dict[str, Any], logs["configure_log"])["path"]
    reject(payload, "all declared evidence paths must be unique")


def test_pending_authority_drift_is_rejected_not_reported_as_clean_pending(
    tmp_path: Path,
) -> None:
    payload = cast(dict[str, Any], json.loads(BASELINE_PATH.read_text(encoding="utf-8")))
    cast(dict[str, Any], payload["authority"])["authority_sha256"] = "0" * 64
    path = tmp_path / "pending-drift.json"
    _write_json(path, payload)

    report = verify_llama_toolchain(
        authority=load_llama_toolchain_authority(AUTHORITY_PATH),
        evidence=load_llama_toolchain_build_evidence(path),
        evidence_root=tmp_path,
    )

    assert report.status is ToolchainVerificationStatus.REJECTED
    assert report.reasons == ("AUTHORITY_SHA256_MISMATCH", "BUILD_PENDING")


def test_evidence_paths_are_authority_bound(tmp_path: Path) -> None:
    evidence_path, payload, evidence_root = _prepare_built_evidence(tmp_path)
    source = cast(dict[str, Any], payload["source"])
    environment = cast(dict[str, Any], payload["environment"])
    logs = cast(dict[str, Any], payload["logs"])

    replacements = {
        cast(dict[str, Any], source["source_archive"])["path"]: "alternate/archive.tar.gz",
        cast(dict[str, Any], source["git_head_output"])["path"]: "alternate/head.txt",
        cast(dict[str, Any], source["git_status_output"])["path"]: "alternate/status.txt",
        cast(dict[str, Any], cast(dict[str, Any], environment["cmake"])["output"])[
            "path"
        ]: "alternate/cmake.txt",
        cast(
            dict[str, Any], cast(dict[str, Any], environment["c_compiler"])["output"]
        )["path"]: "alternate/cc.txt",
        cast(
            dict[str, Any], cast(dict[str, Any], environment["cxx_compiler"])["output"]
        )["path"]: "alternate/cxx.txt",
        cast(dict[str, Any], logs["configure_log"])["path"]: "alternate/configure.log",
        cast(dict[str, Any], logs["build_log"])["path"]: "alternate/build.log",
        cast(dict[str, Any], logs["cmake_cache"])["path"]: "alternate/CMakeCache.txt",
    }
    for old_path, new_path in replacements.items():
        old = evidence_root / cast(str, old_path)
        new = evidence_root / new_path
        new.parent.mkdir(parents=True, exist_ok=True)
        new.write_bytes(old.read_bytes())
    cast(dict[str, Any], source["source_archive"])["path"] = "alternate/archive.tar.gz"
    cast(dict[str, Any], source["git_head_output"])["path"] = "alternate/head.txt"
    cast(dict[str, Any], source["git_status_output"])["path"] = "alternate/status.txt"
    cast(dict[str, Any], cast(dict[str, Any], environment["cmake"])["output"])[
        "path"
    ] = "alternate/cmake.txt"
    cast(dict[str, Any], cast(dict[str, Any], environment["c_compiler"])["output"])[
        "path"
    ] = "alternate/cc.txt"
    cast(dict[str, Any], cast(dict[str, Any], environment["cxx_compiler"])["output"])[
        "path"
    ] = "alternate/cxx.txt"
    cast(dict[str, Any], logs["configure_log"])["path"] = "alternate/configure.log"
    cast(dict[str, Any], logs["build_log"])["path"] = "alternate/build.log"
    cast(dict[str, Any], logs["cmake_cache"])["path"] = "alternate/CMakeCache.txt"
    _reload(evidence_path, payload)

    report = _verify(evidence_path, evidence_root)

    assert {
        "SOURCE_ARCHIVE_PATH_MISMATCH",
        "SOURCE_HEAD_PATH_MISMATCH",
        "SOURCE_STATUS_PATH_MISMATCH",
        "CMAKE_IDENTITY_PATH_MISMATCH",
        "C_COMPILER_IDENTITY_PATH_MISMATCH",
        "CXX_COMPILER_IDENTITY_PATH_MISMATCH",
        "CONFIGURE_LOG_PATH_MISMATCH",
        "BUILD_LOG_PATH_MISMATCH",
        "CMAKE_CACHE_PATH_MISMATCH",
    }.issubset(report.reasons)


def test_schema_versions_and_pending_reason_are_mandatory(tmp_path: Path) -> None:
    authority_payload = _authority_payload()
    authority_payload["schema_version"] = "wrong"
    authority_path = tmp_path / "wrong-authority.json"
    _write_json(authority_path, authority_payload)
    with pytest.raises(ValueError, match="unsupported llama.cpp toolchain authority schema"):
        load_llama_toolchain_authority(authority_path)

    pending = cast(dict[str, Any], json.loads(BASELINE_PATH.read_text(encoding="utf-8")))
    pending["schema_version"] = "wrong"
    evidence_path = tmp_path / "wrong-evidence.json"
    _write_json(evidence_path, pending)
    with pytest.raises(ValueError, match="unsupported llama.cpp build evidence schema"):
        load_llama_toolchain_build_evidence(evidence_path)

    pending["schema_version"] = "tai.llama-cpp-build-evidence.v1"
    pending["pending_reason"] = None
    _write_json(evidence_path, pending)
    with pytest.raises(ValueError, match="requires pending_reason"):
        load_llama_toolchain_build_evidence(evidence_path)


def test_cli_validates_model_registry_without_claiming_build(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Registry:
        candidates = (object(), object())

    monkeypatch.setattr(artifact_cli, "load_candidate_registry", lambda _: Registry())
    monkeypatch.setattr(artifact_cli, "registry_to_canonical_json", lambda _: "{}")
    output = tmp_path / "registry-validation.json"
    assert main(["validate-registry", str(CANDIDATES_PATH), "--output", str(output)]) == 0
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["status"] == "VALID"
    assert payload["candidate_count"] == 2
    assert len(payload["registry_sha256"]) == 64
