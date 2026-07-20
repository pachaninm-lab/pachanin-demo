from __future__ import annotations

import argparse
import json
from pathlib import Path

from tai.model_benchmark_admission_v2 import (
    ContractError,
    admit_models,
    load_authority,
    verify_benchmark,
    write_json,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Verify AP-13C benchmark evidence and AP-13D admission v2."
    )
    commands = parser.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate-authority")
    validate.add_argument("authority", type=Path)
    validate.add_argument("--output", type=Path)

    verify = commands.add_parser("verify-benchmark")
    verify.add_argument("authority", type=Path)
    verify.add_argument("bundle_authority", type=Path)
    verify.add_argument("manifest", type=Path)
    verify.add_argument("original_root", type=Path)
    verify.add_argument("restored_root", type=Path)
    verify.add_argument("--output", type=Path)

    admit = commands.add_parser("admit")
    admit.add_argument("authority", type=Path)
    admit.add_argument("primary_report", type=Path)
    admit.add_argument("fallback_report", type=Path)
    admit.add_argument("--evaluated-at", required=True)
    admit.add_argument("--output", type=Path)
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
                "schema_version": "tai.model-benchmark-authority-validation.v2",
                "status": "VALID",
                "authority_sha256": authority["authority_sha256"],
                "runtime_profiles": [
                    item["profile_id"] for item in authority["runtime_profiles"]
                ],
            }
            _emit(result, args.output)
            return 0
        if args.command == "verify-benchmark":
            report = verify_benchmark(
                args.authority,
                args.bundle_authority,
                args.manifest,
                args.original_root,
                args.restored_root,
            )
            _emit(report, args.output)
            return 0 if report["status"] == "VERIFIED" else 2
        decision = admit_models(
            args.authority,
            args.primary_report,
            args.fallback_report,
            evaluated_at=args.evaluated_at,
        )
        _emit(decision, args.output)
        return 0 if decision["status"] == "ADMITTED" else 2
    except ContractError as exc:
        result = {
            "schema_version": "tai.model-benchmark-cli-error.v1",
            "status": "REJECTED",
            "reason": f"CONTRACT_INVALID:{exc}",
        }
        _emit(result, getattr(args, "output", None))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
