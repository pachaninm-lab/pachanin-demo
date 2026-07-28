from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, cast

from tai.reg_ru_s3_compatibility import (
    ContractError,
    build_bucket_policy,
    canonical_json,
    ensure_private_output,
    evaluate_compatibility,
    load_json,
    validate_attestation,
    validate_authority,
    validate_final_policy,
)


def _write_json(
    path: Path,
    payload: dict[str, object],
    *,
    reserved: bool = False,
) -> None:
    file_descriptor = ensure_private_output(path, reserved=reserved)
    try:
        with os.fdopen(file_descriptor, "w", encoding="utf-8") as output:
            output.write(
                json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
            )
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def _load_optional_policy(path: Path) -> dict[str, object] | None:
    if path.read_text(encoding="utf-8").strip() == "NO_BUCKET_POLICY":
        return None
    return load_json(path)


def _unwrap_aws_policy(path: Path) -> dict[str, object]:
    wrapper = load_json(path)
    raw_policy = wrapper.get("Policy")
    if isinstance(raw_policy, str):
        payload: Any = json.loads(raw_policy)
    else:
        payload = raw_policy
    if not isinstance(payload, dict):
        raise ContractError("AWS_BUCKET_POLICY_WRAPPER_INVALID")
    return cast(dict[str, object], payload)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate and evaluate the dormant local REG.RU S3 compatibility probe"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_parser = subparsers.add_parser("validate")
    validate_parser.add_argument("--authority", type=Path, required=True)
    validate_parser.add_argument("--attestation", type=Path, required=True)
    validate_parser.add_argument("--output", type=Path, required=True)

    unwrap_parser = subparsers.add_parser("unwrap-policy")
    unwrap_parser.add_argument("--aws-output", type=Path, required=True)
    unwrap_parser.add_argument("--output", type=Path, required=True)

    reserve_parser = subparsers.add_parser("reserve-output")
    reserve_parser.add_argument("--output", type=Path, required=True)

    build_parser = subparsers.add_parser("build-policy")
    build_parser.add_argument("--authority", type=Path, required=True)
    build_parser.add_argument("--attestation", type=Path, required=True)
    build_parser.add_argument("--existing-policy", type=Path, required=True)
    build_parser.add_argument("--mode", choices=("canary", "final"), required=True)
    build_parser.add_argument("--canary-object-key")
    build_parser.add_argument("--use-nonmatching-selector", action="store_true")
    build_parser.add_argument("--output", type=Path, required=True)

    policy_parser = subparsers.add_parser("validate-policy")
    policy_parser.add_argument("--authority", type=Path, required=True)
    policy_parser.add_argument("--attestation", type=Path, required=True)
    policy_parser.add_argument("--policy", type=Path, required=True)

    evaluate_parser = subparsers.add_parser("evaluate")
    evaluate_parser.add_argument("--authority", type=Path, required=True)
    evaluate_parser.add_argument("--attestation", type=Path, required=True)
    evaluate_parser.add_argument("--observed", type=Path, required=True)
    evaluate_parser.add_argument("--output", type=Path, required=True)
    evaluate_parser.add_argument("--reserved-output", action="store_true")

    args = parser.parse_args(argv)
    try:
        if args.command == "unwrap-policy":
            _write_json(args.output, _unwrap_aws_policy(args.aws_output))
            return 0
        if args.command == "reserve-output":
            file_descriptor = ensure_private_output(args.output)
            os.close(file_descriptor)
            return 0

        authority = load_json(args.authority)
        validate_authority(authority)
        attestation = load_json(args.attestation)
        hashes = validate_attestation(
            authority,
            attestation,
            attestation_path=args.attestation.resolve(),
        )
        if args.command == "validate":
            _write_json(
                args.output,
                {
                    "status": "LOCAL_ATTESTATION_VALID",
                    **hashes,
                    "credentials_loaded": False,
                    "mutation_attempted": False,
                },
            )
            return 0
        if args.command == "build-policy":
            policy = build_bucket_policy(
                authority,
                attestation,
                _load_optional_policy(args.existing_policy),
                mode=args.mode,
                canary_object_key=args.canary_object_key,
                use_nonmatching_selector=args.use_nonmatching_selector,
            )
            _write_json(args.output, policy)
            return 0
        if args.command == "validate-policy":
            validate_final_policy(authority, attestation, load_json(args.policy))
            print("POLICY_VALID")
            return 0
        if args.command == "evaluate":
            report = evaluate_compatibility(
                authority,
                attestation,
                load_json(args.observed),
                attestation_hashes=hashes,
            )
            _write_json(args.output, report, reserved=args.reserved_output)
            print(canonical_json(report))
            return 0 if report["status"] == "VERIFIED_REG_RU_S3_COMPATIBILITY" else 2
    except (ContractError, OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"FAILED_CLOSED:{exc}", file=sys.stderr)
        return 2
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
