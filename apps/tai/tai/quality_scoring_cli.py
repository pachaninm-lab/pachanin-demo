from __future__ import annotations

import argparse
import json
from pathlib import Path

from tai import quality_scoring as scoring
from tai.quality_scoring_contract import (
    EXPECTED_QUALITY_MATURITY,
    QualityScoringError,
    load_authority,
    write_json,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Verify governed human quality scoring."
    )
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate-authority")
    validate.add_argument("authority", type=Path)
    validate.add_argument("--output", type=Path)
    verify = commands.add_parser("verify")
    verify.add_argument("authority", type=Path)
    verify.add_argument("scoring_manifest", type=Path)
    verify.add_argument("trusted_runtime_report", type=Path)
    verify.add_argument("trusted_runtime_manifest", type=Path)
    verify.add_argument("trusted_assessment", type=Path)
    verify.add_argument("trusted_case_authority", type=Path)
    verify.add_argument("original_root", type=Path)
    verify.add_argument("restored_root", type=Path)
    verify.add_argument("--evaluated-at", required=True)
    verify.add_argument("--output", type=Path)
    return parser


def _emit(value: dict[str, object], output: Path | None) -> None:
    if output is not None:
        write_json(output, value)
    print(json.dumps(value, ensure_ascii=False, sort_keys=True))


def main() -> int:
    args = _parser().parse_args()
    try:
        if args.command == "validate-authority":
            authority = load_authority(args.authority)
            result: dict[str, object] = {
                "schema_version": "tai.quality-scoring-authority-validation.v2",
                "status": "VALID",
                "authority_sha256": authority["authority_sha256"],
                "required_observations": 348,
                "required_annotations": 486,
                "quality_scoring_status": "PENDING_QUALITY_SCORING",
                **EXPECTED_QUALITY_MATURITY,
            }
            _emit(result, args.output)
            return 0
        report = scoring.verify_quality_scoring(
            args.authority,
            args.scoring_manifest,
            args.trusted_runtime_report,
            args.trusted_runtime_manifest,
            args.trusted_assessment,
            args.trusted_case_authority,
            args.original_root,
            args.restored_root,
            evaluated_at=args.evaluated_at,
        )
        _emit(report, args.output)
        return 0 if report["accepted"] is True else 2
    except QualityScoringError as exc:
        result = {
            "schema_version": "tai.quality-scoring-cli-error.v2",
            "status": "REJECTED",
            "accepted": False,
            "reason": f"CONTRACT_INVALID:{exc}",
            "quality_scoring_status": "PENDING_QUALITY_SCORING",
            **EXPECTED_QUALITY_MATURITY,
        }
        _emit(result, getattr(args, "output", None))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
