from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from tai import qwen_preview_runtime as runtime


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate governed Qwen read-only preview runtime evidence.")
    commands = parser.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate-authority")
    validate.add_argument("authority", type=Path)
    validate.add_argument("--output", type=Path)

    pending = commands.add_parser("validate-pending")
    pending.add_argument("manifest", type=Path)
    pending.add_argument("--output", type=Path)

    verify = commands.add_parser("verify-evidence")
    verify.add_argument("authority", type=Path)
    verify.add_argument("evidence", type=Path)
    verify.add_argument("--exact-main", required=True)
    verify.add_argument("--evaluated-at", required=True)
    verify.add_argument("--output", type=Path)
    return parser


def _emit(value: dict[str, Any], output: Path | None) -> None:
    if output is not None:
        runtime.write_json(output, value)
    print(json.dumps(value, ensure_ascii=False, sort_keys=True))


def main() -> int:
    args = _parser().parse_args()
    try:
        if args.command == "validate-authority":
            authority = runtime.load_authority(args.authority)
            _emit(
                {
                    "schema_version": "tai.qwen-preview-runtime-authority-validation.v1",
                    "status": "VALID",
                    "authority_sha256": authority["authority_sha256"],
                    "protected_access_allowed": False,
                    **runtime.MATURITY,
                },
                args.output,
            )
            return 0
        if args.command == "validate-pending":
            pending = runtime.load_pending(args.manifest)
            _emit(pending, args.output)
            return 2
        evidence = runtime.verify_evidence(
            args.authority,
            args.evidence,
            exact_main=args.exact_main,
            evaluated_at=args.evaluated_at,
        )
        _emit(evidence, args.output)
        return 0
    except runtime.PreviewRuntimeError as exc:
        _emit(
            {
                "schema_version": "tai.qwen-preview-runtime-cli-error.v1",
                "status": "REJECTED",
                "accepted": False,
                "reason": f"QWEN_PREVIEW_RUNTIME_INVALID:{exc}",
                **runtime.MATURITY,
            },
            getattr(args, "output", None),
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
