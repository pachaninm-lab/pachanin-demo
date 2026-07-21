from __future__ import annotations

import argparse
import json
from pathlib import Path

from tai import cpu_benchmark_external_runner as runner


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate AP-13C.1c inputs and compile an exact external CPU benchmark run plan."
    )
    commands = parser.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate-authority")
    validate.add_argument("authority", type=Path)
    validate.add_argument("--output", type=Path)

    compile_plan = commands.add_parser("compile-plan")
    compile_plan.add_argument("authority", type=Path)
    compile_plan.add_argument("execution_authority", type=Path)
    compile_plan.add_argument("readiness", type=Path)
    compile_plan.add_argument("gold_assessment", type=Path)
    compile_plan.add_argument("bundle_authority", type=Path)
    compile_plan.add_argument("benchmark_authority", type=Path)
    compile_plan.add_argument("finalization_source", type=Path)
    compile_plan.add_argument("finalization_root", type=Path)
    compile_plan.add_argument("--exact-main", required=True)
    compile_plan.add_argument("--run-id", required=True)
    compile_plan.add_argument("--planned-at", required=True)
    compile_plan.add_argument("--output", type=Path, required=True)
    return parser


def _emit(value: dict[str, object], output: Path | None) -> None:
    if output is not None:
        runner.write_json(output, value)
    print(json.dumps(value, ensure_ascii=False, sort_keys=True))


def main() -> int:
    args = _parser().parse_args()
    try:
        if args.command == "validate-authority":
            authority = runner.load_runner_authority(args.authority)
            report: dict[str, object] = {
                "schema_version": "tai.cpu-benchmark-external-runner-authority-validation.v1",
                "status": "VALID",
                "authority_sha256": authority["authority_sha256"],
                "models": [item["key"] for item in authority["models"]],
                "benchmark_status": "PENDING_BENCHMARK",
                "model_admission_status": "PENDING_ADMISSION",
                "production_operational_status": "NOT_ATTESTED",
            }
            _emit(report, args.output)
            return 0
        plan = runner.compile_run_plan(
            args.authority,
            args.execution_authority,
            args.readiness,
            args.gold_assessment,
            args.bundle_authority,
            args.benchmark_authority,
            args.finalization_source,
            args.finalization_root,
            exact_main=args.exact_main,
            run_id=args.run_id,
            planned_at=args.planned_at,
        )
        _emit(plan, args.output)
        return 0
    except (runner.ExternalRunPlanError, ValueError) as exc:
        report = {
            "schema_version": "tai.cpu-benchmark-external-runner-cli-error.v1",
            "status": "REJECTED",
            "reason": f"CONTRACT_INVALID:{exc}",
            "benchmark_status": "PENDING_BENCHMARK",
            "model_admission_status": "PENDING_ADMISSION",
            "production_operational_status": "NOT_ATTESTED",
        }
        _emit(report, getattr(args, "output", None))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
