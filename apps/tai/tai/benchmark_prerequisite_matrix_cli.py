from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from tai.benchmark_prerequisite_matrix import MatrixError, evaluate_matrix, write_json


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Evaluate AP-13C benchmark prerequisites without maturity inflation."
    )
    parser.add_argument("authority", type=Path)
    parser.add_argument("observation", type=Path)
    parser.add_argument("--evaluated-at")
    parser.add_argument("--output", type=Path)
    return parser


def main() -> int:
    arguments = build_parser().parse_args()
    report: dict[str, object]
    try:
        evaluated_at = (
            datetime.fromisoformat(arguments.evaluated_at.replace("Z", "+00:00"))
            if arguments.evaluated_at
            else None
        )
        if evaluated_at is not None and evaluated_at.utcoffset() is None:
            raise ValueError("--evaluated-at must be timezone-aware")
        report = evaluate_matrix(
            arguments.authority,
            arguments.observation,
            evaluated_at=evaluated_at,
        )
    except (MatrixError, ValueError) as exc:
        report = {
            "schema_version": "tai.benchmark-prerequisite-cli-error.v1",
            "status": "REJECTED",
            "reason": f"CONTRACT_INVALID:{exc}",
            "benchmark_status": "PENDING_BENCHMARK",
            "model_admission_status": "PENDING_ADMISSION",
            "production_operational_status": "NOT_ATTESTED",
        }
    if arguments.output is not None:
        write_json(arguments.output, report)
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0 if report["status"] == "READY_FOR_JOINT_MODEL_ADMISSION" else 2


if __name__ == "__main__":
    raise SystemExit(main())
