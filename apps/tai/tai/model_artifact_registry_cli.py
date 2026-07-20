from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import cast

from tai.llama_toolchain import (
    ToolchainVerificationReport,
    build_evidence_to_canonical_json,
    collect_llama_toolchain_build_evidence,
    load_llama_toolchain_authority,
    load_llama_toolchain_build_evidence,
    source_tree_sha256,
    verify_llama_toolchain,
)
from tai.model_artifact_registry import (
    BundleVerificationReport,
    load_artifact_bundle,
    load_candidate_registry,
    registry_to_canonical_json,
    verify_artifact_bundle,
)
from tai.model_bundle_v2 import (
    authority_sha256_v2,
    load_local_model_bundle_v2,
    load_model_bundle_authority_v2,
    report_payload_v2,
    verify_local_model_bundle_v2,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tai-model-artifacts",
        description="Validate pinned model candidates and verify local artifact bundles.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_parser = subparsers.add_parser("validate-registry")
    validate_parser.add_argument("registry", type=Path)
    validate_parser.add_argument("--output", type=Path)

    verify_parser = subparsers.add_parser("verify-bundle")
    verify_parser.add_argument("registry", type=Path)
    verify_parser.add_argument("bundle", type=Path)
    verify_parser.add_argument("bundle_root", type=Path)
    verify_parser.add_argument("--output", type=Path)

    authority_v2_parser = subparsers.add_parser("validate-bundle-authority-v2")
    authority_v2_parser.add_argument("authority", type=Path)
    authority_v2_parser.add_argument("--output", type=Path)

    verify_v2_parser = subparsers.add_parser("verify-bundle-v2")
    verify_v2_parser.add_argument("authority", type=Path)
    verify_v2_parser.add_argument("bundle", type=Path)
    verify_v2_parser.add_argument("bundle_root", type=Path)
    verify_v2_parser.add_argument("restored_root", type=Path)
    verify_v2_parser.add_argument("--output", type=Path)

    toolchain_parser = subparsers.add_parser("verify-toolchain")
    toolchain_parser.add_argument("authority", type=Path)
    toolchain_parser.add_argument("evidence", type=Path)
    toolchain_parser.add_argument("evidence_root", type=Path)
    toolchain_parser.add_argument("--output", type=Path)

    tree_parser = subparsers.add_parser("hash-source-tree")
    tree_parser.add_argument("checkout", type=Path)
    tree_parser.add_argument("--output", type=Path)

    collect_parser = subparsers.add_parser("collect-toolchain-evidence")
    collect_parser.add_argument("authority", type=Path)
    collect_parser.add_argument("evidence_root", type=Path)
    collect_parser.add_argument("--cmake-executable", required=True)
    collect_parser.add_argument("--c-compiler-executable", required=True)
    collect_parser.add_argument("--cxx-compiler-executable", required=True)
    collect_parser.add_argument("--output", type=Path, required=True)
    collect_parser.add_argument("--verification-output", type=Path)

    arguments = parser.parse_args(argv)
    try:
        if arguments.command == "validate-registry":
            registry = load_candidate_registry(arguments.registry)
            canonical = registry_to_canonical_json(registry)
            validation_payload: dict[str, object] = {
                "candidate_count": len(registry.candidates),
                "registry_sha256": _sha256_text(canonical),
                "schema_version": "tai.model-candidate-registry-validation.v1",
                "status": "VALID",
            }
            _write_json(validation_payload, arguments.output)
            return 0

        if arguments.command == "validate-bundle-authority-v2":
            authority_v2 = load_model_bundle_authority_v2(arguments.authority)
            validation_payload_v2: dict[str, object] = {
                "authority_sha256": authority_sha256_v2(authority_v2),
                "model_count": len(authority_v2.models),
                "schema_version": "tai.model-bundle-authority-validation.v2",
                "status": "VALID",
            }
            _write_json(validation_payload_v2, arguments.output)
            return 0

        if arguments.command == "verify-bundle-v2":
            authority_v2 = load_model_bundle_authority_v2(arguments.authority)
            bundle_v2 = load_local_model_bundle_v2(arguments.bundle)
            report_v2 = verify_local_model_bundle_v2(
                authority=authority_v2,
                bundle=bundle_v2,
                bundle_root=arguments.bundle_root,
                restored_root=arguments.restored_root,
            )
            _write_json(report_payload_v2(report_v2), arguments.output)
            return 0 if report_v2.verified else 2

        if arguments.command == "hash-source-tree":
            tree_payload: dict[str, object] = {
                "checkout": str(arguments.checkout),
                "schema_version": "tai.source-tree-digest.v1",
                "sha256": source_tree_sha256(arguments.checkout),
                "status": "HASHED",
            }
            _write_json(tree_payload, arguments.output)
            return 0

        if arguments.command == "collect-toolchain-evidence":
            authority = load_llama_toolchain_authority(arguments.authority)
            collected = collect_llama_toolchain_build_evidence(
                authority=authority,
                evidence_root=arguments.evidence_root,
                cmake_executable=arguments.cmake_executable,
                c_compiler_executable=arguments.c_compiler_executable,
                cxx_compiler_executable=arguments.cxx_compiler_executable,
            )
            collected_payload = cast(
                dict[str, object],
                json.loads(build_evidence_to_canonical_json(collected)),
            )
            _write_json(collected_payload, arguments.output)
            collected_report = verify_llama_toolchain(
                authority=authority,
                evidence=collected,
                evidence_root=arguments.evidence_root,
            )
            if arguments.verification_output is not None:
                _write_json(
                    _toolchain_report_payload(collected_report),
                    arguments.verification_output,
                )
            return 0 if collected_report.verified else 2

        if arguments.command == "verify-bundle":
            registry = load_candidate_registry(arguments.registry)
            bundle = load_artifact_bundle(arguments.bundle)
            report = verify_artifact_bundle(
                registry=registry,
                bundle=bundle,
                bundle_root=arguments.bundle_root,
            )
            _write_json(_bundle_report_payload(report), arguments.output)
            return 0 if report.verified else 2

        authority = load_llama_toolchain_authority(arguments.authority)
        evidence = load_llama_toolchain_build_evidence(arguments.evidence)
        toolchain_report = verify_llama_toolchain(
            authority=authority,
            evidence=evidence,
            evidence_root=arguments.evidence_root,
        )
        _write_json(_toolchain_report_payload(toolchain_report), arguments.output)
        return 0 if toolchain_report.verified else 2
    except ValueError as error:
        error_payload: dict[str, object] = {
            "error": str(error),
            "schema_version": "tai.model-artifact-cli-error.v1",
            "status": "INVALID",
        }
        _write_json(error_payload, getattr(arguments, "output", None))
        return 2


def _bundle_report_payload(report: BundleVerificationReport) -> dict[str, object]:
    return {
        "model_id": report.model_id,
        "reasons": list(report.reasons),
        "report_sha256": report.report_sha256,
        "revision": report.revision,
        "schema_version": "tai.model-artifact-verification-report.v1",
        "status": report.status.value,
        "verified_files": list(report.verified_files),
    }


def _toolchain_report_payload(
    report: ToolchainVerificationReport,
) -> dict[str, object]:
    return {
        "authority_sha256": report.authority_sha256,
        "evidence_sha256": report.evidence_sha256,
        "reasons": list(report.reasons),
        "report_sha256": report.report_sha256,
        "schema_version": "tai.llama-cpp-toolchain-verification-report.v1",
        "status": report.status.value,
        "verified_files": list(report.verified_files),
        "verified_targets": list(report.verified_targets),
    }


def _write_json(payload: dict[str, object], output: Path | None) -> None:
    rendered = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if output is None:
        sys.stdout.write(rendered)
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(rendered, encoding="utf-8")


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
