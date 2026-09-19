from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any, cast

import pytest

from tai.llama_toolchain import (
    BuildEvidenceStatus,
    ToolchainVerificationStatus,
    authority_to_canonical_json,
    build_evidence_to_canonical_json,
    collect_llama_toolchain_build_evidence,
    load_llama_toolchain_authority,
    load_llama_toolchain_build_evidence,
    source_tree_sha256,
    verify_llama_toolchain,
)
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


def test_repository_authority_pins_exact_release_commit_profile_and_targets() -> None:
    authority = load_llama_toolchain_authority(AUTHORITY_PATH)

    assert authority.release == "b9637"
    assert authority.commit == COMMIT
    assert authority.commit in authority.source_archive_uri
    assert authority.release not in authority.source_archive_uri
    assert authority.build_profile.operating_system == "linux"
    assert authority.build_profile.architecture == "x86_64"
    assert [item.target for item in authority.build_profile.required_targets] == [
        "llama-cli",
        "llama-server",
        "llama-quantize",
        "llama-bench",
    ]
    assert len(authority.authority_sha256) == 64
    assert authority_to_canonical_json(authority).startswith('{"build_profile"')


def test_all_quantization_recipes_bind_to_the_exact_toolchain_commit() -> None:
    authority = load_llama_toolchain_authority(AUTHORITY_PATH)
    registry = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8"))
    recipes = [
        recipe
        for candidate in registry["candidates"]
        for recipe in candidate["quantization_recipes"]
    ]

    assert len(recipes) == 3
    assert all(recipe["toolchain_release"] == authority.release for recipe in recipes)
    assert all(recipe["toolchain_commit"] == authority.commit for recipe in recipes)
    assert all(recipe["toolchain_uri"] == authority.repository_uri for recipe in recipes)


def test_committed_baseline_is_pending_and_cannot_verify(tmp_path: Path) -> None:
    authority = load_llama_toolchain_authority(AUTHORITY_PATH)
    evidence = load_llama_toolchain_build_evidence(BASELINE_PATH)
    report = verify_llama_toolchain(
        authority=authority,
        evidence=evidence,
        evidence_root=tmp_path,
    )

    assert evidence.status is BuildEvidenceStatus.PENDING_BUILD
    assert evidence.source is None
    assert evidence.binaries == ()
    assert report.status is ToolchainVerificationStatus.PENDING_BUILD
    assert report.reasons == ("BUILD_PENDING",)
    assert not report.verified
    assert len(report.evidence_sha256) == 64
    assert len(report.report_sha256) == 64


def test_complete_exact_build_evidence_verifies(tmp_path: Path) -> None:
    evidence_path, _, evidence_root = _prepare_built_evidence(tmp_path)
    report = _verify(evidence_path, evidence_root)

    assert report.status is ToolchainVerificationStatus.VERIFIED
    assert report.reasons == ()
    assert report.verified_targets == (
        "llama-bench",
        "llama-cli",
        "llama-quantize",
        "llama-server",
    )
    assert len(report.verified_files) == 13
    assert len(report.report_sha256) == 64
    evidence = load_llama_toolchain_build_evidence(evidence_path)
    assert build_evidence_to_canonical_json(evidence).startswith('{"authority"')


def test_collector_reads_standard_layout_and_emits_verifiable_evidence(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, _, evidence_root = _prepare_built_evidence(tmp_path)
    authority = load_llama_toolchain_authority(AUTHORITY_PATH)
    monkeypatch.setattr("tai.llama_toolchain.platform.system", lambda: "Linux")
    monkeypatch.setattr("tai.llama_toolchain.platform.machine", lambda: "AMD64")

    collected = collect_llama_toolchain_build_evidence(
        authority=authority,
        evidence_root=evidence_root,
        cmake_executable="/usr/bin/cmake",
        c_compiler_executable="/usr/bin/cc",
        cxx_compiler_executable="/usr/bin/c++",
    )
    report = verify_llama_toolchain(
        authority=authority,
        evidence=collected,
        evidence_root=evidence_root,
    )

    assert collected.status is BuildEvidenceStatus.BUILT
    assert report.status is ToolchainVerificationStatus.VERIFIED
    assert collected.environment is not None
    assert collected.environment.cmake.version == "cmake version 3.31.6"


def test_collector_cli_writes_evidence_and_verification_report(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, _, evidence_root = _prepare_built_evidence(tmp_path)
    monkeypatch.setattr("tai.llama_toolchain.platform.system", lambda: "Linux")
    monkeypatch.setattr("tai.llama_toolchain.platform.machine", lambda: "x86_64")
    output = tmp_path / "collected.json"
    verification = tmp_path / "collected-verification.json"

    result = main(
        [
            "collect-toolchain-evidence",
            str(AUTHORITY_PATH),
            str(evidence_root),
            "--cmake-executable",
            "/usr/bin/cmake",
            "--c-compiler-executable",
            "/usr/bin/cc",
            "--cxx-compiler-executable",
            "/usr/bin/c++",
            "--output",
            str(output),
            "--verification-output",
            str(verification),
        ]
    )

    assert result == 0
    assert json.loads(output.read_text(encoding="utf-8"))["status"] == "BUILT"
    report = json.loads(verification.read_text(encoding="utf-8"))
    assert report["status"] == "VERIFIED"


def test_cli_hashes_source_tree_without_git_metadata(tmp_path: Path) -> None:
    checkout = tmp_path / "checkout"
    (checkout / ".git").mkdir(parents=True)
    (checkout / "source.cpp").write_text("source\n", encoding="utf-8")
    output = tmp_path / "tree.json"

    result = main(["hash-source-tree", str(checkout), "--output", str(output)])
    payload = json.loads(output.read_text(encoding="utf-8"))

    assert result == 0
    assert payload["status"] == "HASHED"
    assert payload["sha256"] == source_tree_sha256(checkout)


def test_cli_returns_two_for_pending_and_zero_only_for_verified(tmp_path: Path) -> None:
    pending_output = tmp_path / "pending-report.json"
    pending_result = main(
        [
            "verify-toolchain",
            str(AUTHORITY_PATH),
            str(BASELINE_PATH),
            str(tmp_path),
            "--output",
            str(pending_output),
        ]
    )
    evidence_path, _, evidence_root = _prepare_built_evidence(tmp_path / "built")
    verified_output = tmp_path / "verified-report.json"
    verified_result = main(
        [
            "verify-toolchain",
            str(AUTHORITY_PATH),
            str(evidence_path),
            str(evidence_root),
            "--output",
            str(verified_output),
        ]
    )

    assert pending_result == 2
    assert json.loads(pending_output.read_text(encoding="utf-8"))["status"] == "PENDING_BUILD"
    assert verified_result == 0
    verified = json.loads(verified_output.read_text(encoding="utf-8"))
    assert verified["status"] == "VERIFIED"
    assert len(verified["report_sha256"]) == 64


def test_command_platform_and_authority_drift_fail_closed(tmp_path: Path) -> None:
    evidence_path, payload, evidence_root = _prepare_built_evidence(tmp_path)
    authority_ref = cast(dict[str, Any], payload["authority"])
    commands = cast(dict[str, Any], payload["commands"])
    environment = cast(dict[str, Any], payload["environment"])
    authority_ref["commit"] = "f" * 40
    cast(list[str], commands["configure"]).append("-DUNDECLARED=ON")
    cast(list[str], commands["build"])[-1] = "9"
    environment["operating_system"] = "darwin"
    environment["architecture"] = "arm64"
    environment["generator"] = "Unix Makefiles"
    _reload(evidence_path, payload)

    report = _verify(evidence_path, evidence_root)

    assert {
        "COMMIT_MISMATCH",
        "CONFIGURE_COMMAND_MISMATCH",
        "BUILD_COMMAND_MISMATCH",
        "OPERATING_SYSTEM_MISMATCH",
        "ARCHITECTURE_MISMATCH",
        "CMAKE_GENERATOR_MISMATCH",
    }.issubset(report.reasons)
    assert report.status is ToolchainVerificationStatus.REJECTED


def test_dirty_or_wrong_checkout_cannot_verify(tmp_path: Path) -> None:
    evidence_path, payload, evidence_root = _prepare_built_evidence(tmp_path)
    source = cast(dict[str, Any], payload["source"])
    dirty = b" M src/llama.cpp\n"
    source["git_status_output"] = _declare(
        evidence_root,
        "evidence/git-status.txt",
        dirty,
    )
    wrong_head = ("f" * 40 + "\n").encode()
    source["git_head_output"] = _declare(
        evidence_root,
        "evidence/git-head.txt",
        wrong_head,
    )
    checkout = evidence_root / cast(str, source["checkout_path"])
    (checkout / "src" / "llama.cpp").write_text("tampered\n", encoding="utf-8")
    _reload(evidence_path, payload)

    report = _verify(evidence_path, evidence_root)

    assert "SOURCE_CHECKOUT_DIRTY" in report.reasons
    assert "SOURCE_HEAD_COMMIT_MISMATCH" in report.reasons
    assert "SOURCE_TREE_SHA256_MISMATCH" in report.reasons


def test_missing_git_metadata_and_identity_mismatch_are_rejected(tmp_path: Path) -> None:
    evidence_path, payload, evidence_root = _prepare_built_evidence(tmp_path)
    source = cast(dict[str, Any], payload["source"])
    checkout = evidence_root / cast(str, source["checkout_path"])
    for path in (checkout / ".git").iterdir():
        path.unlink()
    (checkout / ".git").rmdir()
    environment = cast(dict[str, Any], payload["environment"])
    cast(dict[str, Any], environment["cmake"])["version"] = "99.99"
    cast(dict[str, Any], environment["c_compiler"])["version"] = "clang"
    cast(dict[str, Any], environment["cxx_compiler"])["version"] = "clang++"
    _reload(evidence_path, payload)

    report = _verify(evidence_path, evidence_root)

    assert "SOURCE_GIT_METADATA_MISSING" in report.reasons
    assert "CMAKE_VERSION_MISMATCH" in report.reasons
    assert "C_COMPILER_VERSION_MISMATCH" in report.reasons
    assert "CXX_COMPILER_VERSION_MISMATCH" in report.reasons


def test_binary_digest_size_missing_and_target_set_fail_closed(tmp_path: Path) -> None:
    evidence_path, payload, evidence_root = _prepare_built_evidence(tmp_path)
    binaries = cast(list[dict[str, Any]], payload["binaries"])
    first = binaries[0]
    (evidence_root / cast(str, first["path"])).write_bytes(b"tampered and longer")
    missing = binaries[1]
    (evidence_root / cast(str, missing["path"])).unlink()
    binaries.pop()
    _reload(evidence_path, payload)

    report = _verify(evidence_path, evidence_root)

    assert "BINARY_TARGET_SET_MISMATCH" in report.reasons
    assert f"FILE_SIZE_MISMATCH:{first['path']}" in report.reasons
    assert f"FILE_MISSING:{missing['path']}" in report.reasons


def test_binary_path_mismatch_and_digest_mismatch_are_rejected(tmp_path: Path) -> None:
    evidence_path, payload, evidence_root = _prepare_built_evidence(tmp_path)
    binaries = cast(list[dict[str, Any]], payload["binaries"])
    first = binaries[0]
    old_path = cast(str, first["path"])
    new_path = "build/llama.cpp-b9637/bin/not-llama-cli"
    (evidence_root / new_path).parent.mkdir(parents=True, exist_ok=True)
    (evidence_root / new_path).write_bytes((evidence_root / old_path).read_bytes())
    first["path"] = new_path
    first["sha256"] = "0" * 64
    _reload(evidence_path, payload)

    report = _verify(evidence_path, evidence_root)

    assert "BINARY_PATH_MISMATCH:llama-cli" in report.reasons
    assert f"FILE_SHA256_MISMATCH:{new_path}" in report.reasons


def test_symlink_binary_and_hardlink_alias_are_rejected(tmp_path: Path) -> None:
    evidence_path, payload, evidence_root = _prepare_built_evidence(tmp_path)
    binaries = cast(list[dict[str, Any]], payload["binaries"])
    first_path = evidence_root / cast(str, binaries[0]["path"])
    second_path = evidence_root / cast(str, binaries[1]["path"])
    second_path.unlink()
    try:
        second_path.symlink_to(first_path)
    except OSError:
        pytest.skip("symlinks are unavailable")
    _reload(evidence_path, payload)
    symlink_report = _verify(evidence_path, evidence_root)
    assert f"FILE_SYMLINK:{binaries[1]['path']}" in symlink_report.reasons

    second_path.unlink()
    os.link(first_path, second_path)
    second_content = first_path.read_bytes()
    binaries[1]["sha256"] = _sha256(second_content)
    binaries[1]["size_bytes"] = len(second_content)
    _reload(evidence_path, payload)
    alias_report = _verify(evidence_path, evidence_root)
    assert "BINARY_FILE_ALIAS" in alias_report.reasons

