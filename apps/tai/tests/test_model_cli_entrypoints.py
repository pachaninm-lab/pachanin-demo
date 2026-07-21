from __future__ import annotations

import json
from pathlib import Path

import pytest

from tai import model_legal_review_cli, model_source_acquisition_cli

TAI_ROOT = Path(__file__).parents[1]
LEGAL_AUTHORITY = TAI_ROOT / "model-artifacts" / "model-legal-review-authority.v1.json"
SOURCE_ACCEPTANCE = (
    TAI_ROOT / "model-artifacts" / "model-source-acquisition-acceptance.v1.json"
)
QWEN_REVISION = "895c8d171bc03c30e113cd7a28c02494b5e068b7"


def _read_json(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def test_model_legal_review_cli_routes_and_fails_closed(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    validation = tmp_path / "validation.json"
    assert model_legal_review_cli.main(
        [
            "validate-authority",
            str(LEGAL_AUTHORITY),
            str(SOURCE_ACCEPTANCE),
            "--output",
            str(validation),
        ]
    ) == 0
    assert _read_json(validation)["status"] == "VALID"

    evidence_root = tmp_path / "empty-evidence"
    evaluation = tmp_path / "evaluation.json"
    assert model_legal_review_cli.main(
        [
            "evaluate-all",
            str(LEGAL_AUTHORITY),
            str(SOURCE_ACCEPTANCE),
            str(evidence_root),
            "--output",
            str(evaluation),
        ]
    ) == 2
    assert _read_json(evaluation)["status"] == "PENDING_HUMAN_DECISION"

    model_report = tmp_path / "model-report.json"
    assert model_legal_review_cli.main(
        [
            "verify-model",
            str(LEGAL_AUTHORITY),
            str(SOURCE_ACCEPTANCE),
            str(evidence_root),
            "Qwen/Qwen3-8B",
            QWEN_REVISION,
            "--output",
            str(model_report),
        ]
    ) == 2
    assert _read_json(model_report)["status"] == "PENDING_HUMAN_DECISION"

    missing_authority = tmp_path / "missing-authority.json"
    assert model_legal_review_cli.main(
        [
            "validate-authority",
            str(missing_authority),
            str(SOURCE_ACCEPTANCE),
        ]
    ) == 2
    error = json.loads(capsys.readouterr().out)
    assert error["status"] == "INVALID"
    assert error["production_operational_status"] == "NOT_ATTESTED"


def test_model_source_acquisition_cli_json_boundaries(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    remote_inventory = tmp_path / "remote-inventory.json"
    remote_inventory.write_text('{"model_id": "example/model"}\n', encoding="utf-8")
    output = tmp_path / "download-plan.json"

    def fake_download_plan(payload: dict[str, object]) -> dict[str, object]:
        assert payload == {"model_id": "example/model"}
        return {
            "schema_version": "tai.test-download-plan.v1",
            "status": "VALID",
        }

    monkeypatch.setattr(
        model_source_acquisition_cli,
        "download_plan",
        fake_download_plan,
    )
    assert model_source_acquisition_cli.main(
        ["download-plan", str(remote_inventory), "--output", str(output)]
    ) == 0
    assert _read_json(output)["status"] == "VALID"

    malformed = tmp_path / "malformed.json"
    malformed.write_text("{", encoding="utf-8")
    failure = tmp_path / "failure.json"
    assert model_source_acquisition_cli.main(
        ["download-plan", str(malformed), "--output", str(failure)]
    ) == 2
    assert _read_json(failure)["status"] == "INVALID"

    non_object = tmp_path / "array.json"
    non_object.write_text("[]\n", encoding="utf-8")
    with pytest.raises(ValueError, match="JSON evidence must be an object"):
        model_source_acquisition_cli._load_object(non_object)

    model_source_acquisition_cli._write_json(
        None,
        {"schema_version": "tai.test-stdout.v1", "status": "VALID"},
    )
    stdout_payload = json.loads(capsys.readouterr().out)
    assert stdout_payload["status"] == "VALID"
