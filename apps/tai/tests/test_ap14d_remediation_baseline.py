from __future__ import annotations

import json
from pathlib import Path


def test_ap14d_remediation_baseline_is_exact_and_machine_readable() -> None:
    path = (
        Path(__file__).resolve().parents[1]
        / "knowledge-sources"
        / "AP-14D-REMEDIATION-BASELINE.json"
    )
    payload = json.loads(path.read_text(encoding="utf-8"))

    assert payload["schema_version"] == "tai.ap14d.remediation-baseline.v1"
    assert payload["exact_source_sha"] == (
        "08824d0925c853cf5ee31e460c1580a2861e4b6d"
    )
    assert payload["workflow_run_id"] == 29686367649
    assert payload["source_count"] == 5
    assert payload["observed_source_count"] == 2
    assert payload["healthy_topic_coverage_basis_points"] == 1250
    assert len(payload["catalog_sha256"]) == 64
    assert len(payload["evidence_bundle_sha256"]) == 64
    source_results = payload["source_results"]
    assert isinstance(source_results, list)
    assert len(source_results) == 5
    assert {result["source_id"] for result in source_results} == {
        "official.mcx.opendata",
        "official.rosstat.agriculture",
        "official.eec.grain-regulation",
        "official.mintrans.rail-tariffs",
        "official.cbr.key-rate",
    }
