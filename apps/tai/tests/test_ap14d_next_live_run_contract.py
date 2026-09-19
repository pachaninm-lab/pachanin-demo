from __future__ import annotations

from pathlib import Path


def test_next_live_run_contract_rejects_legacy_generic_failure() -> None:
    path = (
        Path(__file__).resolve().parents[1]
        / "knowledge-sources"
        / "AP-14D-NEXT-LIVE-RUN.md"
    )
    contract = path.read_text(encoding="utf-8")

    assert "exact `main`" in contract
    assert "source_transport_failure" in contract
    assert "must emit one registered bounded diagnostic code" in contract
    assert "contents: read" in contract
    assert "not production attestation" in contract
