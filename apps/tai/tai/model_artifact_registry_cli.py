from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from tai.model_artifact_registry import (
    BundleVerificationReport,
    load_artifact_bundle,
    load_candidate_registry,
    registry_to_canonical_json,
    verify_artifact_bundle,
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

    arguments = parser.parse_args(argv)
    try:
        if arguments.command == "validate-registry":
            registry = load_candidate_registry(arguments.registry)
            canonical = registry_to_canonical_json(registry)
            payload = {
                "candidate_count": len(registry.candidates),
                "registry_sha256": _sha256_text(canonical),
                "schema_version": "tai.model-candidate-registry-validation.v1",
                "status": "VALID",
            }
            _write_json(payload, arguments.output)
            return 0

        registry = load_candidate_registry(arguments.registry)
        bundle = load_artifact_bundle(arguments.bundle)
        report = verify_artifact_bundle(
            registry=registry,
            bundle=bundle,
            bundle_root=arguments.bundle_root,
        )
        _write_json(_report_payload(report), arguments.output)
        return 0 if report.verified else 2
    except ValueError as error:
        payload = {
            "error": str(error),
            "schema_version": "tai.model-artifact-cli-error.v1",
            "status": "INVALID",
        }
        _write_json(payload, getattr(arguments, "output", None))
        return 2


def _report_payload(report: BundleVerificationReport) -> dict[str, object]:
    return {
        "model_id": report.model_id,
        "reasons": list(report.reasons),
        "report_sha256": report.report_sha256,
        "revision": report.revision,
        "schema_version": "tai.model-artifact-verification-report.v1",
        "status": report.status.value,
        "verified_files": list(report.verified_files),
    }


def _write_json(payload: dict[str, object], output: Path | None) -> None:
    rendered = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if output is None:
        sys.stdout.write(rendered)
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(rendered, encoding="utf-8")


def _sha256_text(value: str) -> str:
    import hashlib

    return hashlib.sha256(value.encode("utf-8")).hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
