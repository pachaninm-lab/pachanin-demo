"""CLI for rendering and verifying the TAI industrial gap report and manifest."""

from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

from tai.industrial_gap_report import (
    AcceptanceBacklog,
    FinalStatus,
    canonical_json,
    derive_final_status,
    gap_report_payload,
    load_backlog,
    manifest_payload,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tai-industrial-gap-report",
        description="Render and verify the exact-main industrial acceptance evidence.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_parser = subparsers.add_parser("validate")
    validate_parser.add_argument("backlog", type=Path)

    render_parser = subparsers.add_parser("render")
    render_parser.add_argument("backlog", type=Path)
    render_parser.add_argument("--release-id", required=True)
    render_parser.add_argument("--gap-report", type=Path, required=True)
    render_parser.add_argument("--manifest", type=Path, required=True)

    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("backlog", type=Path)
    verify_parser.add_argument("--release-id", required=True)
    verify_parser.add_argument("--gap-report", type=Path, required=True)
    verify_parser.add_argument("--manifest", type=Path, required=True)

    arguments = parser.parse_args(argv)

    try:
        backlog = load_backlog(arguments.backlog)
    except (OSError, ValueError) as error:
        print(f"backlog is invalid: {error}", file=sys.stderr)
        return 2

    if arguments.command == "validate":
        _print_summary(backlog)
        return 0

    try:
        gap_report = canonical_json(gap_report_payload(backlog))
        manifest = canonical_json(manifest_payload(backlog, arguments.release_id))
    except ValueError as error:
        print(f"rendering failed: {error}", file=sys.stderr)
        return 2

    if arguments.command == "render":
        arguments.gap_report.write_text(gap_report, encoding="utf-8")
        arguments.manifest.write_text(manifest, encoding="utf-8")
        _print_summary(backlog)
        return 0

    drift = _drift(arguments.gap_report, gap_report) + _drift(arguments.manifest, manifest)
    for message in drift:
        print(message, file=sys.stderr)
    if drift:
        return 2

    _print_summary(backlog)
    return 0


def _drift(path: Path, expected: str) -> list[str]:
    try:
        actual = path.read_text(encoding="utf-8")
    except OSError as error:
        return [f"{path}: unreadable ({error})"]
    if actual != expected:
        expected_digest = hashlib.sha256(expected.encode("utf-8")).hexdigest()
        actual_digest = hashlib.sha256(actual.encode("utf-8")).hexdigest()
        return [f"{path}: drifted from backlog (expected {expected_digest}, found {actual_digest})"]
    return []


def _print_summary(backlog: AcceptanceBacklog) -> None:
    totals = backlog.totals()
    status = derive_final_status(backlog)
    print(f"exact_main_sha: {backlog.discovery.exact_main_sha}")
    print(f"final_status: {status.value}")
    print(
        "acceptance items: "
        f"total={totals.total} accepted={totals.accepted} blocked={totals.blocked} "
        f"regressed={totals.regressed} remaining={totals.remaining}"
    )
    print(
        "mandatory completion: "
        f"{totals.mandatory_accepted}/{totals.mandatory_total} "
        f"= {totals.completion_percent}% (100 * mandatory_accepted / mandatory_total)"
    )
    if status is not FinalStatus.PASS:
        print(f"open blockers: {len(backlog.blocking_items())}")


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    raise SystemExit(main())
