from __future__ import annotations

from tai import live_source_evidence_cli
from tai.official_source_diagnostics import diagnostic_live_definitions


def test_live_source_cli_uses_diagnostic_definition_factory() -> None:
    assert live_source_evidence_cli.live_definitions is diagnostic_live_definitions
