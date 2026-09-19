from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from tai.model_legal_review import (
    HumanLegalReviewStatus,
    authority_sha256,
    evaluate_all_model_reviews,
    evaluate_model_review,
    intended_use_sha256,
    load_model_legal_review_authority,
    report_payload,
    validate_source_acceptance,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tai-model-legal-review",
        description="Validate human-only legal review evidence for exact model sources.",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate-authority")
    validate.add_argument("authority", type=Path)
    validate.add_argument("source_acceptance", type=Path)
    validate.add_argument("--output", type=Path)

    evaluate = commands.add_parser("evaluate-all")
    evaluate.add_argument("authority", type=Path)
    evaluate.add_argument("source_acceptance", type=Path)
    evaluate.add_argument("evidence_root", type=Path)
    evaluate.add_argument("--output", type=Path)

    model = commands.add_parser("verify-model")
    model.add_argument("authority", type=Path)
    model.add_argument("source_acceptance", type=Path)
    model.add_argument("evidence_root", type=Path)
    model.add_argument("model_id")
    model.add_argument("revision")
    model.add_argument("--output", type=Path)

    arguments = parser.parse_args(argv)
    try:
        authority = load_model_legal_review_authority(arguments.authority)
        if arguments.command == "validate-authority":
            validate_source_acceptance(authority, arguments.source_acceptance)
            payload: dict[str, object] = {
                "schema_version": "tai.model-legal-review-authority-validation.v1",
                "status": "VALID",
                "authority_sha256": authority_sha256(authority),
                "intended_use_sha256": intended_use_sha256(authority),
                "model_count": len(authority.models),
                "legal_decision": "PENDING_HUMAN_DECISION",
                "production_operational_status": "NOT_ATTESTED",
            }
            _write(payload, arguments.output)
            return 0
        if arguments.command == "evaluate-all":
            payload = evaluate_all_model_reviews(
                authority=authority,
                acceptance_path=arguments.source_acceptance,
                evidence_root=arguments.evidence_root,
            )
            _write(payload, arguments.output)
            return 0 if payload["status"] in {
                "ALL_APPROVED_FOR_CONVERSION",
                "COMPLETE_WITH_REJECTION",
            } else 2
        report = evaluate_model_review(
            authority=authority,
            acceptance_path=arguments.source_acceptance,
            evidence_root=arguments.evidence_root,
            model_id=arguments.model_id,
            revision=arguments.revision,
        )
        _write(report_payload(report), arguments.output)
        return 0 if report.status in {
            HumanLegalReviewStatus.APPROVED_FOR_CONVERSION,
            HumanLegalReviewStatus.REJECTED,
        } else 2
    except (ValueError, OSError) as error:
        _write(
            {
                "schema_version": "tai.model-legal-review-cli-error.v1",
                "status": "INVALID",
                "error": str(error),
                "production_operational_status": "NOT_ATTESTED",
            },
            getattr(arguments, "output", None),
        )
        return 2


def _write(payload: dict[str, object], output: Path | None) -> None:
    rendered = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if output is None:
        sys.stdout.write(rendered)
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(rendered, encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
