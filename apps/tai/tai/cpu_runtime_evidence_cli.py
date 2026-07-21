from __future__ import annotations

import argparse
import json
from pathlib import Path

from tai import cpu_runtime_evidence as runtime_evidence


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate or verify immutable AP-13C.1c raw CPU runtime evidence."
    )
    commands = parser.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate-authority")
    validate.add_argument("authority", type=Path)
    validate.add_argument("--output", type=Path)

    verify = commands.add_parser("verify-runtime-evidence")
    verify.add_argument("authority", type=Path)
    verify.add_argument("manifest", type=Path)
    verify.add_argument("original_root", type=Path)
    verify.add_argument("restored_root", type=Path)
    verify.add_argument("--output", type=Path)
    return parser


def _emit(value: dict[str, object], output: Path | None) -> None:
    if output is not None:
        runtime_evidence.write_json(output, value)
    print(json.dumps(value, ensure_ascii=False, sort_keys=True))


def main() -> int:
    arguments = _parser().parse_args()
    try:
        if arguments.command == "validate-authority":
            authority = runtime_evidence.load_authority(arguments.authority)
            result: dict[str, object] = {
                "schema_version": "tai.cpu-runtime-evidence-authority-validation.v1",
                "status": "VALID",
                "authority_sha256": authority["authority_sha256"],
                "runtime_profiles": [
                    item["profile_id"] for item in authority["runtime_profiles"]
                ],
                "quality_scoring_status": "PENDING_QUALITY_SCORING",
                "benchmark_status": "PENDING_BENCHMARK",
                "model_admission_status": "PENDING_ADMISSION",
                "production_operational_status": "NOT_ATTESTED",
            }
            _emit(result, arguments.output)
            return 0
        report = runtime_evidence.verify_runtime_evidence(
            arguments.authority,
            arguments.manifest,
            arguments.original_root,
            arguments.restored_root,
        )
        _emit(report, arguments.output)
        return (
            0
            if report["status"]
            == "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING"
            else 2
        )
    except runtime_evidence.RuntimeEvidenceError as exc:
        result = {
            "schema_version": "tai.cpu-runtime-evidence-cli-error.v1",
            "status": "REJECTED",
            "reason": f"CONTRACT_INVALID:{exc}",
            "quality_scoring_status": "PENDING_QUALITY_SCORING",
            "benchmark_status": "PENDING_BENCHMARK",
            "model_admission_status": "PENDING_ADMISSION",
            "production_operational_status": "NOT_ATTESTED",
        }
        _emit(result, getattr(arguments, "output", None))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
