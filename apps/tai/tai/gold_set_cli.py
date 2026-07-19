from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from tai.gold_set import (
    GoldSetAuthority,
    assessment_payload,
    load_gold_set_manifest,
    manifest_payload,
)
from tai.gold_set_candidate import build_platform_agro_candidate


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tai-gold-set",
        description="Build and assess governed platform/agro gold-set evidence.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    candidate_parser = subparsers.add_parser("emit-candidate")
    candidate_parser.add_argument("--exact-head", required=True)
    candidate_parser.add_argument("--created-at", required=True)
    candidate_parser.add_argument("--output", type=Path, required=True)

    assess_parser = subparsers.add_parser("assess")
    assess_parser.add_argument("manifest", type=Path)
    assess_parser.add_argument("--at", required=True)
    assess_parser.add_argument("--output", type=Path)

    arguments = parser.parse_args(argv)
    try:
        if arguments.command == "emit-candidate":
            manifest = build_platform_agro_candidate(
                exact_head_sha=arguments.exact_head,
                created_at=_datetime(arguments.created_at, "--created-at"),
            )
            payload = manifest_payload(manifest)
            payload["maturity"] = "CANDIDATE_REQUIRES_HUMAN_REVIEW"
            _write_json(arguments.output, payload)
            sys.stdout.write(
                json.dumps(
                    {
                        "manifest_sha256": manifest.manifest_sha256,
                        "question_count": len(manifest.questions),
                        "status": "CANDIDATE",
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                )
                + "\n"
            )
            return 0

        manifest = load_gold_set_manifest(arguments.manifest)
        assessment = GoldSetAuthority().assess(
            manifest=manifest,
            assessed_at=_datetime(arguments.at, "--at"),
        )
        payload = assessment_payload(assessment)
        _write_json(arguments.output, payload)
        return 0 if assessment.accepted else 2
    except (OSError, ValueError) as error:
        payload = {
            "error": str(error),
            "schema_version": "tai.gold-set-cli-error.v1",
            "status": "INVALID",
        }
        _write_json(getattr(arguments, "output", None), payload)
        return 2


def _datetime(value: str, name: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{name} must be an ISO-8601 datetime") from error
    if parsed.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")
    return parsed


def _write_json(path: Path | None, payload: dict[str, object]) -> None:
    rendered = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if path is None:
        sys.stdout.write(rendered)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(rendered, encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
