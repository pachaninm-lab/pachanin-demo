from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from tai import gold_set_cli
from tai.gold_set import load_gold_set_manifest

HEAD = "7be7489fc22840da1f41ed70cdf4c2877f2847e2"
AT = "2026-07-19T14:00:00+00:00"


def _read(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def test_cli_emits_machine_readable_candidate_and_rejects_it_as_unapproved(
    tmp_path: Path,
) -> None:
    candidate_path = tmp_path / "candidate.json"
    assessment_path = tmp_path / "assessment.json"

    emit_result = gold_set_cli.main(
        [
            "emit-candidate",
            "--exact-head",
            HEAD,
            "--created-at",
            AT,
            "--output",
            str(candidate_path),
        ]
    )
    assess_result = gold_set_cli.main(
        [
            "assess",
            str(candidate_path),
            "--at",
            AT,
            "--output",
            str(assessment_path),
        ]
    )

    assert emit_result == 0
    assert assess_result == 2
    candidate = _read(candidate_path)
    assessment = _read(assessment_path)
    assert candidate["maturity"] == "CANDIDATE_REQUIRES_HUMAN_REVIEW"
    assert len(candidate["questions"]) == 42
    assert len(candidate["manifest_sha256"]) == 64
    assert assessment["accepted"] is False
    assert assessment["platform_question_count"] == 21
    assert assessment["agro_question_count"] == 21
    assert "QUESTIONS_NOT_HUMAN_APPROVED" in assessment["rejection_reasons"]
    assert load_gold_set_manifest(candidate_path).manifest_sha256 == candidate[
        "manifest_sha256"
    ]


def test_cli_structural_error_is_nonzero_and_uploadable(tmp_path: Path) -> None:
    invalid = tmp_path / "invalid.json"
    invalid.write_text("{}\n", encoding="utf-8")
    output = tmp_path / "error.json"

    result = gold_set_cli.main(
        [
            "assess",
            str(invalid),
            "--at",
            AT,
            "--output",
            str(output),
        ]
    )

    assert result == 2
    error = _read(output)
    assert error["status"] == "INVALID"
    assert error["schema_version"] == "tai.gold-set-cli-error.v1"
