from __future__ import annotations

import argparse
import json
from pathlib import Path

from tai.model_bundle_s3_preflight import evaluate_s3_preflight


def _load_json(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"JSON root must be an object: {path}")
    return payload


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Evaluate TAI S3 bundle preflight")
    parser.add_argument("requirements", type=Path)
    parser.add_argument("observed", type=Path)
    parser.add_argument("--exact-main", required=True)
    parser.add_argument("--workflow-run-id", required=True, type=int)
    parser.add_argument("--workflow-run-attempt", required=True, type=int)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)

    report = evaluate_s3_preflight(
        _load_json(args.requirements),
        _load_json(args.observed),
        exact_main_sha=args.exact_main,
        workflow_run_id=args.workflow_run_id,
        workflow_run_attempt=args.workflow_run_attempt,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    return 0 if report["status"] == "READY_FOR_BUNDLE_UPLOAD" else 2


if __name__ == "__main__":
    raise SystemExit(main())
