from __future__ import annotations

import json
import sys
from pathlib import Path

from tai import qwen_preview_runtime_cli as cli
from tests.qwen_preview_runtime_fixtures import (
    EVALUATED_AT,
    EXACT_MAIN,
    authority_path,
    pending_path,
    valid_evidence,
    write_evidence,
)


def _run(monkeypatch: object, capsys: object, argv: list[str]) -> tuple[int, dict[str, object]]:
    monkeypatch.setattr(sys, "argv", ["qwen-preview-runtime", *argv])
    code = cli.main()
    output = json.loads(capsys.readouterr().out)
    assert isinstance(output, dict)
    return code, output


def test_cli_validates_authority_and_pending(monkeypatch: object, capsys: object) -> None:
    code, output = _run(
        monkeypatch,
        capsys,
        ["validate-authority", str(authority_path())],
    )
    assert code == 0
    assert output["status"] == "VALID"
    assert output["protected_access_allowed"] is False

    code, output = _run(
        monkeypatch,
        capsys,
        ["validate-pending", str(pending_path())],
    )
    assert code == 2
    assert output["status"] == "PENDING_PROTECTED_EXECUTION"


def test_cli_verifies_and_writes_evidence(
    tmp_path: Path, monkeypatch: object, capsys: object
) -> None:
    evidence_path = write_evidence(tmp_path / "evidence.json", valid_evidence())
    output_path = tmp_path / "verified.json"
    code, output = _run(
        monkeypatch,
        capsys,
        [
            "verify-evidence",
            str(authority_path()),
            str(evidence_path),
            "--exact-main",
            EXACT_MAIN,
            "--evaluated-at",
            EVALUATED_AT,
            "--output",
            str(output_path),
        ],
    )
    assert code == 0
    assert output["accepted"] is True
    assert json.loads(output_path.read_text(encoding="utf-8"))["accepted"] is True


def test_cli_rejects_invalid_evidence(
    tmp_path: Path, monkeypatch: object, capsys: object
) -> None:
    evidence = valid_evidence()
    evidence["exact_main_sha"] = "b" * 40
    evidence_path = write_evidence(tmp_path / "invalid.json", evidence)
    code, output = _run(
        monkeypatch,
        capsys,
        [
            "verify-evidence",
            str(authority_path()),
            str(evidence_path),
            "--exact-main",
            EXACT_MAIN,
            "--evaluated-at",
            EVALUATED_AT,
        ],
    )
    assert code == 2
    assert output["status"] == "REJECTED"
    assert output["accepted"] is False
    assert "QWEN_PREVIEW_RUNTIME_INVALID" in str(output["reason"])
