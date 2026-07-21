from __future__ import annotations

import argparse
import json
from pathlib import Path

from tai import cpu_runtime_evidence as runtime


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate AP-13C.1c immutable raw CPU runtime evidence."
    )
    commands = parser.add_subparsers(dest="command", required=True)

    validate_authority = commands.add_parser("validate-authority")
    validate_authority.add_argument("authority", type=Path)
    validate_authority.add_argument("--output", type=Path)

    validate_manifest = commands.add_parser("validate-manifest")
    validate_manifest.add_argument("manifest", type=Path)
    validate_manifest.add_argument("--output", type=Path)

    verify = commands.add_parser("verify-evidence")
    verify.add_argument("authority", type=Path)
    verify.add_argument("manifest", type=Path)
    verify.add_argument("original_root", type=Path)
    verify.add_argument("restored_root", type=Path)
    verify.add_argument("--evaluated-at", required=True)
    verify.add_argument("--output", type=Path)
    return parser


def _emit(value: dict[str, object], output: Path | None) -> None:
    if output is not None:
        runtime.write_json(output, value)
    print(json.dumps(value, ensure_ascii=False, sort_keys=True))


def main() -> int:
    args = _parser().parse_args()
    try:
        if args.command == "validate-authority":
            authority = runtime.load_runtime_authority(args.authority)
            result: dict[str, object] = {
                "schema_version": (
                    "tai.cpu-runtime-evidence-authority-validation.v1"
                ),
                "status": "VALID",
                "authority_sha256": authority["authority_sha256"],
                "execution_authority_sha256": authority[
                    "execution_authority_sha256"
                ],
                "required_profiles": [
                    profile["profile_id"]
                    for profile in authority["runtime_profiles"]
                ],
                "required_raw_observations": authority["corpus"][
                    "required_raw_observations_total"
                ],
                "quality_scoring_status": "PENDING_QUALITY_SCORING",
                "benchmark_status": "PENDING_BENCHMARK",
                "model_admission_status": "PENDING_ADMISSION",
                "production_operational_status": "NOT_ATTESTED",
            }
            _emit(result, args.output)
            return 0

        if args.command == "validate-manifest":
            manifest = runtime.load_runtime_manifest(args.manifest)
            result = {
                "schema_version": (
                    "tai.cpu-runtime-evidence-manifest-validation.v1"
                ),
                "status": manifest["lifecycle"],
                "manifest_sha256": manifest["manifest_sha256"],
                "runtime_verification_status": manifest[
                    "runtime_verification_status"
                ],
                "quality_scoring_status": manifest["quality_scoring_status"],
                "benchmark_status": manifest["benchmark_status"],
                "model_admission_status": manifest["model_admission_status"],
                "production_operational_status": manifest[
                    "production_operational_status"
                ],
            }
            _emit(result, args.output)
            return 0 if manifest["lifecycle"] == "COMPLETE" else 2

        report = runtime.verify_runtime_evidence(
            args.authority,
            args.manifest,
            args.original_root,
            args.restored_root,
            evaluated_at=args.evaluated_at,
        )
        _emit(report, args.output)
        return 0 if report["accepted"] is True else 2
    except runtime.RuntimeEvidenceError as exc:
        result = {
            "schema_version": "tai.cpu-runtime-evidence-cli-error.v1",
            "status": "REJECTED",
            "reason": f"CONTRACT_INVALID:{exc}",
            "runtime_verification_status": "PENDING_RUNTIME_EXECUTION",
            "quality_scoring_status": "PENDING_QUALITY_SCORING",
            "benchmark_status": "PENDING_BENCHMARK",
            "model_admission_status": "PENDING_ADMISSION",
            "production_operational_status": "NOT_ATTESTED",
        }
        _emit(result, getattr(args, "output", None))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
