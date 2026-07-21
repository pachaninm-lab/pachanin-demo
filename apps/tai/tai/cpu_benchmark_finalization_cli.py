from __future__ import annotations

import argparse
import json
from pathlib import Path

from tai import cpu_benchmark_finalization as finalization
from tai import cpu_benchmark_finalization_contract as contract


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate AP-13C.1e governed CPU/fallback benchmark finalization."
    )
    commands = parser.add_subparsers(dest="command", required=True)
    authority = commands.add_parser("validate-authority")
    authority.add_argument("authority", type=Path)
    authority.add_argument("--output", type=Path)
    manifest = commands.add_parser("validate-manifest")
    manifest.add_argument("manifest", type=Path)
    manifest.add_argument("--output", type=Path)
    verify = commands.add_parser("verify")
    for name in (
        "authority",
        "joint_authority",
        "bundle_authority",
        "runtime_authority",
        "runtime_report",
        "runtime_manifest",
        "runtime_original_root",
        "runtime_restored_root",
        "quality_authority",
        "quality_report",
        "quality_scoring_manifest",
        "accepted_assessment",
        "case_manifest",
        "mistral_benchmark_manifest",
        "mistral_benchmark_original_root",
        "mistral_benchmark_restored_root",
        "finalization_manifest",
    ):
        verify.add_argument(name, type=Path)
    verify.add_argument("--evaluated-at", required=True)
    verify.add_argument("--output", type=Path)
    return parser


def _emit(value: dict[str, object], output: Path | None) -> None:
    if output is not None:
        contract.write_json(output, value)
    print(json.dumps(value, ensure_ascii=False, sort_keys=True))


def main() -> int:
    args = _parser().parse_args()
    try:
        if args.command == "validate-authority":
            authority = contract.load_authority(args.authority)
            result: dict[str, object] = {
                "schema_version": "tai.cpu-benchmark-finalization-authority-validation.v1",
                "status": "VALID",
                "authority_sha256": authority["authority_sha256"],
                "verified_cpu_profiles": [
                    contract.QWEN_CPU_PROFILE,
                    contract.MISTRAL_CPU_PROFILE,
                ],
                "required_gpu_profile": contract.QWEN_GPU_PROFILE,
                "qwen_primary_benchmark_status": "PENDING_BENCHMARK",
                "mistral_fallback_benchmark_status": (
                    "PENDING_REAL_FINALIZATION_EVIDENCE"
                ),
                "joint_benchmark_status": "PENDING_BENCHMARK",
                "model_admission_status": "PENDING_ADMISSION",
                "production_operational_status": "NOT_ATTESTED",
            }
            _emit(result, args.output)
            return 0
        if args.command == "validate-manifest":
            manifest = contract.load_manifest(args.manifest)
            result = {
                "schema_version": "tai.cpu-benchmark-finalization-manifest-validation.v1",
                "status": manifest["lifecycle"],
                "manifest_sha256": manifest["manifest_sha256"],
                "qwen_primary_benchmark_status": manifest[
                    "qwen_primary_benchmark_status"
                ],
                "mistral_fallback_benchmark_status": manifest[
                    "mistral_fallback_benchmark_status"
                ],
                "joint_benchmark_status": manifest["joint_benchmark_status"],
                "model_admission_status": manifest["model_admission_status"],
                "production_operational_status": manifest[
                    "production_operational_status"
                ],
            }
            _emit(result, args.output)
            return 0 if manifest["lifecycle"] == "COMPLETE_CPU_FALLBACK_SLICE" else 2
        report = finalization.verify_finalization(
            args.authority,
            args.joint_authority,
            args.bundle_authority,
            args.runtime_authority,
            args.runtime_report,
            args.runtime_manifest,
            args.runtime_original_root,
            args.runtime_restored_root,
            args.quality_authority,
            args.quality_report,
            args.quality_scoring_manifest,
            args.accepted_assessment,
            args.case_manifest,
            args.mistral_benchmark_manifest,
            args.mistral_benchmark_original_root,
            args.mistral_benchmark_restored_root,
            args.finalization_manifest,
            evaluated_at=args.evaluated_at,
        )
        _emit(report, args.output)
        return 0 if report["accepted"] is True else 2
    except contract.FinalizationError as exc:
        result = {
            "schema_version": "tai.cpu-benchmark-finalization-cli-error.v1",
            "status": "REJECTED",
            "reason": f"CONTRACT_INVALID:{exc}",
            "qwen_primary_benchmark_status": "PENDING_BENCHMARK",
            "mistral_fallback_benchmark_status": (
                "PENDING_REAL_FINALIZATION_EVIDENCE"
            ),
            "joint_benchmark_status": "PENDING_BENCHMARK",
            "model_admission_status": "PENDING_ADMISSION",
            "production_operational_status": "NOT_ATTESTED",
        }
        _emit(result, getattr(args, "output", None))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
