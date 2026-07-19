from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path

from tai.source_coverage import (
    OfficialSourceCoverageAuthority,
    assessment_payload,
    catalog_canonical_json,
    load_official_source_catalog,
    load_source_observations,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tai-source-coverage",
        description="Validate official source catalogs and assess observed coverage.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_parser = subparsers.add_parser("validate-catalog")
    validate_parser.add_argument("catalog", type=Path)
    validate_parser.add_argument("--output", type=Path)

    assess_parser = subparsers.add_parser("assess")
    assess_parser.add_argument("catalog", type=Path)
    assess_parser.add_argument("observations", type=Path)
    assess_parser.add_argument("--at", required=True)
    assess_parser.add_argument("--output", type=Path)

    arguments = parser.parse_args(argv)
    try:
        catalog = load_official_source_catalog(arguments.catalog)
        if arguments.command == "validate-catalog":
            canonical = catalog_canonical_json(catalog)
            payload: dict[str, object] = {
                "catalog_sha256": hashlib.sha256(
                    canonical.encode("utf-8")
                ).hexdigest(),
                "requirement_count": len(catalog.requirements),
                "schema_version": "tai.official-source-catalog-validation.v1",
                "source_count": len(catalog.sources),
                "status": "VALID",
            }
            _write_json(payload, arguments.output)
            return 0

        observations = load_source_observations(arguments.observations)
        assessment = OfficialSourceCoverageAuthority().assess(
            catalog=catalog,
            observations=observations,
            now=_parse_datetime(arguments.at),
        )
        _write_json(assessment_payload(assessment), arguments.output)
        return 0 if assessment.all_critical_covered else 2
    except ValueError as error:
        _write_json(
            {
                "error": str(error),
                "schema_version": "tai.source-coverage-cli-error.v1",
                "status": "INVALID",
            },
            getattr(arguments, "output", None),
        )
        return 2


def _parse_datetime(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("--at must be an ISO-8601 datetime") from error
    if parsed.utcoffset() is None:
        raise ValueError("--at must be timezone-aware")
    return parsed


def _write_json(payload: dict[str, object], output: Path | None) -> None:
    rendered = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if output is None:
        sys.stdout.write(rendered)
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(rendered, encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
