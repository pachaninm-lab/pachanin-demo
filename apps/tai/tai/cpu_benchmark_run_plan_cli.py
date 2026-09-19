from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from tai import cpu_benchmark_run_plan as run_plan


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Compile the fail-closed AP-13C.1c.0 external CPU benchmark run plan."
    )
    commands = parser.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate-authority")
    validate.add_argument("authority", type=Path)
    validate.add_argument("--output", type=Path)

    pending = commands.add_parser("validate-pending")
    pending.add_argument("manifest", type=Path)
    pending.add_argument("--output", type=Path)

    compile_command = commands.add_parser("compile")
    compile_command.add_argument("authority", type=Path)
    compile_command.add_argument("input_root", type=Path)
    compile_command.add_argument("input_index", type=Path)
    compile_command.add_argument("execution_authority", type=Path)
    compile_command.add_argument("model_bundle_authority", type=Path)
    compile_command.add_argument("benchmark_authority", type=Path)
    compile_command.add_argument("finalization_authority", type=Path)
    compile_command.add_argument("--exact-main", required=True)
    compile_command.add_argument("--evaluated-at", required=True)
    compile_command.add_argument("--output", type=Path)
    return parser


def _emit(value: dict[str, Any], output: Path | None) -> None:
    if output is not None:
        run_plan.write_json(output, value)
    print(json.dumps(value, ensure_ascii=False, sort_keys=True))


def main() -> int:
    args = _parser().parse_args()
    try:
        if args.command == "validate-authority":
            authority = run_plan.load_authority(args.authority)
            result: dict[str, Any] = {
                "schema_version": "tai.cpu-benchmark-run-plan-authority-validation.v1",
                "status": "VALID",
                "authority_sha256": authority["authority_sha256"],
                "protected_access_allowed": False,
                **run_plan.MATURITY,
            }
            _emit(result, args.output)
            return 0
        if args.command == "validate-pending":
            pending = run_plan.load_pending(args.manifest)
            _emit(pending, args.output)
            return 2

        result = run_plan.compile_run_plan(
            authority_path=args.authority,
            input_root=args.input_root,
            input_index_path=args.input_index,
            execution_authority_path=args.execution_authority,
            model_bundle_authority_path=args.model_bundle_authority,
            benchmark_authority_path=args.benchmark_authority,
            finalization_authority_path=args.finalization_authority,
            exact_main=args.exact_main,
            evaluated_at=args.evaluated_at,
        )
        _emit(result, args.output)
        return 0
    except run_plan.RunPlanError as exc:
        result = {
            "schema_version": "tai.cpu-benchmark-run-plan-cli-error.v1",
            "status": "REJECTED",
            "accepted": False,
            "reason": f"RUN_PLAN_INVALID:{exc}",
            "protected_access_allowed": False,
            **run_plan.MATURITY,
        }
        _emit(result, getattr(args, "output", None))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
