from __future__ import annotations

import json
import sys
from pathlib import Path

from tai import quality_scoring_cli as cli
from tai.quality_scoring_contract import (
    EXPECTED_MATURITY,
    canonical_sha256,
    expected_authority,
    write_json,
)


def _pending(path: Path) -> None:
    value: dict[str, object] = {
        "schema_version": "tai.quality-scoring-evidence.v1",
        "lifecycle": "PENDING_HUMAN_SCORING",
        "pending_reason": "Human evidence is absent.",
        "exact_main": None,
        "authority_sha256": None,
        "runtime_report_sha256": None,
        "observation_index_sha256": None,
        "annotations": [],
        "storage": None,
        "scored_at": None,
        "quality_scoring_status": "PENDING_QUALITY_SCORING",
        **EXPECTED_MATURITY,
    }
    value["manifest_sha256"] = canonical_sha256(value)
    write_json(path, value)


def test_validate_authority_and_pending_manifest(
    monkeypatch, capsys, tmp_path: Path
) -> None:
    authority = tmp_path / "authority.json"
    pending = tmp_path / "pending.json"
    output = tmp_path / "output.json"
    write_json(authority, expected_authority())
    _pending(pending)
    monkeypatch.setattr(
        sys,
        "argv",
        ["quality", "validate-authority", str(authority), "--output", str(output)],
    )
    assert cli.main() == 0
    value = json.loads(output.read_text(encoding="utf-8"))
    assert value["status"] == "VALID"
    assert value["required_observations"] == 348
    assert value["runtime_reverification_required"] is True
    assert value["accepted_assessment_required"] is True
    assert json.loads(capsys.readouterr().out) == value
    monkeypatch.setattr(sys, "argv", ["quality", "validate-manifest", str(pending)])
    assert cli.main() == 2
    value = json.loads(capsys.readouterr().out)
    assert value["status"] == "PENDING_HUMAN_SCORING"
    assert value["production_operational_status"] == "NOT_ATTESTED"


def test_verify_and_contract_error_paths(monkeypatch, capsys, tmp_path: Path) -> None:
    accepted = {
        "schema_version": "tai.quality-scoring-verification.v1",
        "status": "QUALITY_SCORING_VERIFIED_PENDING_BENCHMARK_FINALIZATION",
        "accepted": True,
    }
    monkeypatch.setattr(
        cli.scoring, "verify_quality_scoring", lambda *args, **kwargs: accepted
    )
    paths = [
        str(tmp_path / name)
        for name in ("a", "ra", "rr", "rm", "ro", "rs", "aa", "c", "s")
    ]
    monkeypatch.setattr(
        sys,
        "argv",
        ["quality", "verify", *paths, "--evaluated-at", "2026-07-21T18:00:00Z"],
    )
    assert cli.main() == 0
    assert json.loads(capsys.readouterr().out) == accepted
    invalid = tmp_path / "invalid.json"
    invalid.write_text("{}\n", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["quality", "validate-manifest", str(invalid)])
    assert cli.main() == 2
    value = json.loads(capsys.readouterr().out)
    assert value["status"] == "REJECTED"
    assert value["quality_scoring_status"] == "PENDING_QUALITY_SCORING"
    assert value["model_admission_status"] == "PENDING_ADMISSION"
