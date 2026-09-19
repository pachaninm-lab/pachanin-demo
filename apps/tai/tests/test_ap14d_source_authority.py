from __future__ import annotations

import json
from pathlib import Path

from tai.source_coverage import CoverageTopic, load_official_source_catalog


def _knowledge_sources() -> Path:
    return Path(__file__).resolve().parents[1] / "knowledge-sources"


def test_ap14d_source_authority_is_bounded_and_catalog_aligned() -> None:
    root = _knowledge_sources()
    evidence = json.loads(
        (root / "AP-14D-SOURCE-AUTHORITY.v1.json").read_text(encoding="utf-8")
    )
    catalog = load_official_source_catalog(root / "official-sources.v1.json")

    assert evidence["schema_version"] == "tai.ap14d-source-authority.v1"
    decisions = {item["source_id"]: item for item in evidence["decisions"]}
    assert set(decisions) == {
        "official.eec.grain-regulation",
        "official.rosselhoscenter.agronomy",
        "official.specagro.fgis-grain",
    }

    for source_id, decision in decisions.items():
        source = catalog.source_for(source_id)
        assert source is not None
        assert decision["official_uri"] == source.entrypoint_uri
        assert decision["expected_update_interval_seconds"] == int(
            source.expected_update_interval.total_seconds()
        )
        assert decision["maximum_publication_age_seconds"] == int(
            source.maximum_publication_age.total_seconds()
        )
        assert set(decision["observed_topics"]) == {
            topic.value for topic in source.topics
        }
        assert decision["acceptance_basis"]

    eec = catalog.source_for("official.eec.grain-regulation")
    agronomy = catalog.source_for("official.rosselhoscenter.agronomy")
    grain_traceability = catalog.source_for("official.specagro.fgis-grain")
    assert eec is not None
    assert agronomy is not None
    assert grain_traceability is not None
    assert eec.maximum_publication_age.total_seconds() == 63_072_000
    assert agronomy.maximum_publication_age.total_seconds() == 34_560_000
    assert agronomy.topics == frozenset({CoverageTopic.AGRONOMY_RECOMMENDATIONS})
    assert grain_traceability.allowed_hosts == frozenset({"specagro.ru"})
    assert grain_traceability.maximum_publication_age.total_seconds() == 31_536_000
    assert grain_traceability.topics == frozenset({CoverageTopic.GRAIN_TRACEABILITY})

    controls = evidence["controls"]
    assert controls == {
        "exact_host_allowlist_required": True,
        "publication_date_must_be_contextual": True,
        "unrelated_newer_dates_must_not_refresh_authority": True,
        "silent_freshness_extension_forbidden": True,
        "live_observation_required_for_coverage": True,
    }
