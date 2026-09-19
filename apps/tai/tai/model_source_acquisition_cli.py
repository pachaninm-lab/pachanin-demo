from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from tai.model_source_acquisition import (
    assemble_acquisition_report,
    build_legal_review_packet,
    collect_source_manifest,
    download_plan,
    reconcile_huggingface_inventory,
    verify_restored_sources,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tai-model-source-acquisition",
        description="Collect and verify exact model source acquisition evidence.",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    reconcile = commands.add_parser("reconcile-inventory")
    _identity_arguments(reconcile)
    reconcile.add_argument("api_response", type=Path)
    reconcile.add_argument("--observed-at", required=True)
    reconcile.add_argument("--output", type=Path, required=True)

    plan = commands.add_parser("download-plan")
    plan.add_argument("remote_inventory", type=Path)
    plan.add_argument("--output", type=Path, required=True)

    collect = commands.add_parser("collect-source")
    _identity_arguments(collect)
    collect.add_argument("remote_inventory", type=Path)
    collect.add_argument("source_root", type=Path)
    collect.add_argument("--output", type=Path, required=True)

    legal = commands.add_parser("legal-packet")
    _identity_arguments(legal)
    legal.add_argument("source_manifest", type=Path)
    legal.add_argument("source_root", type=Path)
    legal.add_argument("license_text", type=Path)
    legal.add_argument("--license-uri", required=True)
    legal.add_argument("--prepared-at", required=True)
    legal.add_argument("--output", type=Path, required=True)

    restore = commands.add_parser("verify-restore")
    restore.add_argument("source_manifest", type=Path)
    restore.add_argument("restored_root", type=Path)
    restore.add_argument("--output", type=Path, required=True)

    report = commands.add_parser("assemble-report")
    report.add_argument("remote_inventory", type=Path)
    report.add_argument("source_manifest", type=Path)
    report.add_argument("legal_packet", type=Path)
    report.add_argument("restore_report", type=Path)
    report.add_argument("--repository-sha", required=True)
    report.add_argument("--workflow-run-id", required=True)
    report.add_argument("--workflow-run-attempt", required=True)
    report.add_argument("--output", type=Path, required=True)

    arguments = parser.parse_args(argv)
    try:
        payload = _execute(arguments)
        _write_json(arguments.output, payload)
        return 0
    except ValueError as error:
        _write_json(
            getattr(arguments, "output", None),
            {
                "schema_version": "tai.model-source-acquisition-cli-error.v1",
                "status": "INVALID",
                "error": str(error),
            },
        )
        return 2


def _identity_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("authority", type=Path)
    parser.add_argument("model_id")
    parser.add_argument("revision")


def _execute(arguments: argparse.Namespace) -> dict[str, object]:
    if arguments.command == "reconcile-inventory":
        return reconcile_huggingface_inventory(
            authority_path=arguments.authority,
            model_id=arguments.model_id,
            revision=arguments.revision,
            api_response_path=arguments.api_response,
            observed_at=arguments.observed_at,
        )
    if arguments.command == "download-plan":
        return download_plan(_load_object(arguments.remote_inventory))
    if arguments.command == "collect-source":
        return collect_source_manifest(
            authority_path=arguments.authority,
            model_id=arguments.model_id,
            revision=arguments.revision,
            remote_inventory=_load_object(arguments.remote_inventory),
            source_root=arguments.source_root,
        )
    if arguments.command == "legal-packet":
        return build_legal_review_packet(
            authority_path=arguments.authority,
            model_id=arguments.model_id,
            revision=arguments.revision,
            source_manifest=_load_object(arguments.source_manifest),
            source_root=arguments.source_root,
            license_text_path=arguments.license_text,
            license_text_uri=arguments.license_uri,
            prepared_at=arguments.prepared_at,
        )
    if arguments.command == "verify-restore":
        return verify_restored_sources(
            source_manifest=_load_object(arguments.source_manifest),
            restored_root=arguments.restored_root,
        )
    if arguments.command == "assemble-report":
        return assemble_acquisition_report(
            remote_inventory=_load_object(arguments.remote_inventory),
            source_manifest=_load_object(arguments.source_manifest),
            legal_packet=_load_object(arguments.legal_packet),
            restore_report=_load_object(arguments.restore_report),
            repository_sha=arguments.repository_sha,
            workflow_run_id=arguments.workflow_run_id,
            workflow_run_attempt=arguments.workflow_run_attempt,
        )
    raise ValueError("unsupported command")


def _load_object(path: Path) -> dict[str, object]:
    try:
        value: Any = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"invalid JSON evidence: {path}") from error
    if not isinstance(value, dict):
        raise ValueError("JSON evidence must be an object")
    return value


def _write_json(path: Path | None, payload: dict[str, object]) -> None:
    rendered = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if path is None:
        sys.stdout.write(rendered)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(rendered, encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
