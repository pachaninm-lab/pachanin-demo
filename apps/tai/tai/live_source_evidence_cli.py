from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from tai.live_source_evidence import (
    LiveSourceEvidenceCollector,
    coverage_payload,
    evidence_bundle_sha256,
    observations_payload,
    run_manifest_payload,
)
from tai.official_source_diagnostics import (
    diagnostic_live_definitions as live_definitions,
)
from tai.source_coverage import load_official_source_catalog


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tai-live-source-evidence",
        description=(
            "Collect controlled read-only evidence from governed official sources."
        ),
    )
    parser.add_argument("catalog", type=Path)
    parser.add_argument("--repository-sha", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--timeout-seconds", type=float, default=20.0)
    arguments = parser.parse_args(argv)

    try:
        if not 1.0 <= arguments.timeout_seconds <= 60.0:
            raise ValueError("--timeout-seconds must be between 1 and 60")
        catalog = load_official_source_catalog(arguments.catalog)
        definitions = live_definitions(
            catalog=catalog,
            timeout_seconds=arguments.timeout_seconds,
        )
        bundle = LiveSourceEvidenceCollector(
            catalog=catalog,
            definitions=definitions,
            repository_sha=arguments.repository_sha,
        ).collect()
        output_dir: Path = arguments.output_dir
        output_dir.mkdir(parents=True, exist_ok=True)
        manifest = run_manifest_payload(bundle)
        manifest["evidence_bundle_sha256"] = evidence_bundle_sha256(bundle)
        _write_json(output_dir / "live-run-manifest.json", manifest)
        _write_json(
            output_dir / "source-observations.v1.json",
            observations_payload(bundle),
        )
        _write_json(
            output_dir / "coverage-assessment.json",
            coverage_payload(bundle),
        )
        sys.stdout.write(
            json.dumps(
                {
                    "all_critical_covered": bundle.assessment.all_critical_covered,
                    "evidence_bundle_sha256": manifest["evidence_bundle_sha256"],
                    "observed_source_count": len(bundle.observations),
                    "status": bundle.status.value,
                },
                ensure_ascii=False,
                sort_keys=True,
            )
            + "\n"
        )
        return 0
    except (OSError, ValueError) as error:
        output_dir = arguments.output_dir
        output_dir.mkdir(parents=True, exist_ok=True)
        _write_json(
            output_dir / "collector-error.json",
            {
                "error": str(error),
                "repository_sha": arguments.repository_sha,
                "schema_version": "tai.live-official-source-error.v1",
                "status": "INVALID",
            },
        )
        return 2


def _write_json(path: Path, payload: dict[str, object]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    raise SystemExit(main())
