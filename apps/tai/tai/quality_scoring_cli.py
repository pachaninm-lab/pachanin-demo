from __future__ import annotations

import argparse
import json
from pathlib import Path

from tai import quality_scoring as scoring
from tai import quality_scoring_contract as contract


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate AP-13C.1d governed human quality scoring evidence."
    )
    commands = parser.add_subparsers(dest="command", required=True)
    authority = commands.add_parser("validate-authority")
    authority.add_argument("authority", type=Path)
    authority.add_argument("--output", type=Path)
    manifest = commands.add_parser("validate-manifest")
    manifest.add_argument("manifest", type=Path)
    manifest.add_argument("--output", type=Path)
    verify = commands.add_parser("verify")
    verify.add_argument("authority", type=Path)
    verify.add_argument("runtime_authority", type=Path)
    verify.add_argument("runtime_report", type=Path)
    verify.add_argument("runtime_manifest", type=Path)
    verify.add_argument("runtime_original_root", type=Path)
    verify.add_argument("runtime_restored_root", type=Path)
    verify.add_argument("accepted_assessment", type=Path)
    verify.add_argument("case_manifest", type=Path)
    verify.add_argument("scoring_manifest", type=Path)
    missing = Path("__missing_reviewer_evidence__")
    verify.add_argument("reviewer_identity_secret", type=Path, nargs="?", default=missing)
    verify.add_argument("reviewer_evidence_manifest", type=Path, nargs="?", default=missing)
    verify.add_argument("reviewer_original_root", type=Path, nargs="?", default=missing)
    verify.add_argument("reviewer_restored_root", type=Path, nargs="?", default=missing)
    verify.add_argument("provider_inventory_receipt", type=Path, nargs="?", default=missing)
    verify.add_argument("provider_inventory_secret", type=Path, nargs="?", default=missing)
    verify.add_argument(
        "--trusted-identity-secret-sha256",
        default="0" * 64,
    )
    verify.add_argument(
        "--trusted-provider-inventory-secret-sha256",
        default="0" * 64,
    )
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
                "schema_version": "tai.quality-scoring-authority-validation.v1",
                "status": "VALID",
                "authority_sha256": authority["authority_sha256"],
                "required_profiles": list(contract.PROFILES),
                "required_observations": 348,
                "runtime_reverification_required": True,
                "accepted_assessment_required": True,
                "authenticated_reviewers_required": True,
                "external_evidence_reproduction_required": True,
                "trusted_provider_inventory_required": True,
                "quality_scoring_status": "PENDING_QUALITY_SCORING",
                **contract.EXPECTED_MATURITY,
            }
            _emit(result, args.output)
            return 0
        if args.command == "validate-manifest":
            manifest = contract.load_scoring_manifest(args.manifest)
            result = {
                "schema_version": "tai.quality-scoring-manifest-validation.v1",
                "status": manifest["lifecycle"],
                "manifest_sha256": manifest["manifest_sha256"],
                "quality_scoring_status": manifest["quality_scoring_status"],
                **contract.EXPECTED_MATURITY,
            }
            _emit(result, args.output)
            return 0 if manifest["lifecycle"] == "COMPLETE" else 2
        report = scoring.verify_quality_scoring(
            args.authority,
            args.runtime_authority,
            args.runtime_report,
            args.runtime_manifest,
            args.runtime_original_root,
            args.runtime_restored_root,
            args.accepted_assessment,
            args.case_manifest,
            args.scoring_manifest,
            args.reviewer_identity_secret,
            args.trusted_identity_secret_sha256,
            args.reviewer_evidence_manifest,
            args.reviewer_original_root,
            args.reviewer_restored_root,
            args.provider_inventory_receipt,
            args.provider_inventory_secret,
            args.trusted_provider_inventory_secret_sha256,
            evaluated_at=args.evaluated_at,
        )
        _emit(report, args.output)
        return 0 if report["accepted"] is True else 2
    except contract.QualityScoringError as exc:
        result = {
            "schema_version": "tai.quality-scoring-cli-error.v1",
            "status": "REJECTED",
            "reason": f"CONTRACT_INVALID:{exc}",
            "quality_scoring_status": "PENDING_QUALITY_SCORING",
            **contract.EXPECTED_MATURITY,
        }
        _emit(result, getattr(args, "output", None))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
