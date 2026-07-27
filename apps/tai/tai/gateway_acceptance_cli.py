"""CLI for re-deriving and verifying the exact-main Gateway acceptance evidence."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from tai.gateway_acceptance import acceptance_payload, verify_gateway_acceptance


def _canonical(payload: dict[str, object]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tai-gateway-acceptance",
        description="Re-derive the read-only Gateway acceptance evidence from an exact-main tree.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    for name in ("render", "verify"):
        sub = subparsers.add_parser(name)
        sub.add_argument("--root", type=Path, required=True)
        sub.add_argument("--exact-main-sha", required=True)
        sub.add_argument("--evidence", type=Path, required=True)

    arguments = parser.parse_args(argv)

    try:
        report = verify_gateway_acceptance(arguments.root, arguments.exact_main_sha)
    except (FileNotFoundError, ValueError) as error:
        print(f"gateway acceptance could not be derived: {error}", file=sys.stderr)
        return 2

    rendered = _canonical(acceptance_payload(report))

    if arguments.command == "render":
        # Written even when a check fails: an honest record of a failed
        # derivation is more useful than no record, and `verify` is what gates.
        arguments.evidence.parent.mkdir(parents=True, exist_ok=True)
        arguments.evidence.write_text(rendered, encoding="utf-8")

    if arguments.command == "verify":
        if not arguments.evidence.is_file():
            print(f"evidence record is missing: {arguments.evidence}", file=sys.stderr)
            return 1
        stored = arguments.evidence.read_text(encoding="utf-8")
        if stored != rendered:
            print(
                "stored gateway acceptance evidence does not match the tree it claims to describe",
                file=sys.stderr,
            )
            return 1

    for check in report.failures:
        print(f"FAILED {check.check_id}: {check.detail}", file=sys.stderr)

    if not report.passed:
        return 1

    print(f"gateway acceptance re-derived: {len(report.checks)} checks, all passed")
    print(f"accepted items: {', '.join(report.accepted_items())}")
    return 0


if __name__ == "__main__":  # pragma: no cover - module entry point
    raise SystemExit(main())
