from __future__ import annotations

import json
from pathlib import Path


def test_official_source_diagnostic_registry_is_bounded_and_private() -> None:
    path = (
        Path(__file__).resolve().parents[1]
        / "knowledge-sources"
        / "AP-14D-DIAGNOSTIC-CODES.v1.json"
    )
    payload = json.loads(path.read_text(encoding="utf-8"))

    assert payload["schema_version"] == "tai.official-source-diagnostic-codes.v1"
    codes = payload["codes"]
    assert isinstance(codes, list)
    code_names = [entry["code"] for entry in codes]
    assert code_names == sorted(code_names)
    assert len(code_names) == len(set(code_names))
    assert "source_transport_failure" not in code_names
    assert "exception" not in payload["privacy_contract"].casefold()
    assert all(isinstance(entry["retryable"], bool) for entry in codes)
