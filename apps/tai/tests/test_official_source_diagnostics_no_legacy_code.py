from __future__ import annotations

from pathlib import Path


def test_live_diagnostic_path_does_not_emit_legacy_generic_transport_code() -> None:
    implementation = (
        Path(__file__).resolve().parents[1]
        / "tai"
        / "official_source_diagnostics.py"
    ).read_text(encoding="utf-8")

    assert '"source_transport_failure"' not in implementation
    assert '"source_transport_unknown"' in implementation
