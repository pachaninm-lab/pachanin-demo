from __future__ import annotations

import argparse
import json
from pathlib import Path

from tai import cpu_benchmark_execution as execution


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate AP-13C.1a CPU benchmark execution readiness."
    )
    commands = parser.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate-authority")
    validate.add_argument("authority", type=Path)
    validate.add_argument("--output", type=Path)

    readiness = commands.add_parser("evaluate-readiness")
    readiness.add_argument("authority", type=Path)
    readiness.add_argument("prerequisite_report", type=Path)
    readiness.add_argument("gold_assessment", type=Path)
    readiness.add_argument("--exact-main", required=True)
    readiness.add_argument("--evaluated-at", required=True)
    readiness.add_argument("--output", type=Path)
    return parser


def _emit(value: dict[str, object], output: Path | None) -> None:
    if output is not None:
        execution.write_json(output, value)
    print(json.dumps(value, ensure_ascii=False, sort_keys=True))


def main() -> int:
    args = _parser().parse_args()
    try:
        if args.command == "validate-authority":
            authority = execution.load_execution_authority(args.authority)
            result: dict[str, object] = {
                "schema_version": "tai.cpu-benchmark-execution-authority-validation.v1",
                "status": "VALID",
                "authority_sha256": authority["authority_sha256"],
                "required_profiles": authority["benchmark_authority"][
                    "required_profiles"
                ],
                "benchmark_status": "PENDING_BENCHMARK",
                "model_admission_status": "PENDING_ADMISSION",
                "production_operational_status": "NOT_ATTESTED",
            }
            _emit(result, args.output)
            return 0

        report = execution.evaluate_readiness(
            args.authority,
            args.prerequisite_report,
            args.gold_assessment,
            exact_main=args.exact_main,
            evaluated_at=args.evaluated_at,
        )
        _emit(report, args.output)
        return 0 if report["status"] == "READY_FOR_EXTERNAL_EXECUTION" else 2
    except execution.ExecutionContractError as exc:
        result = {
            "schema_version": "tai.cpu-benchmark-execution-cli-error.v1",
            "status": "REJECTED",
            "reason": f"CONTRACT_INVALID:{exc}",
            "benchmark_status": "PENDING_BENCHMARK",
            "model_admission_status": "PENDING_ADMISSION",
            "production_operational_status": "NOT_ATTESTED",
        }
        _emit(result, getattr(args, "output", None))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
