from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from tai import live_source_evidence_cli
from tai.live_source_evidence import (
    LiveCollectionStatus,
    LiveEvidenceBundle,
    LiveSourceResult,
    LiveSourceResultStatus,
)
from tai.source_coverage import (
    CoverageAssessment,
    CoverageTopic,
    TopicCoverage,
    TopicCoverageStatus,
)

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)
REPOSITORY_SHA = "b" * 40


class _Collector:
    bundle: LiveEvidenceBundle

    def __init__(self, **kwargs: object) -> None:
        assert kwargs["repository_sha"] == REPOSITORY_SHA

    def collect(self) -> LiveEvidenceBundle:
        return self.bundle


def _bundle() -> LiveEvidenceBundle:
    assessment = CoverageAssessment(
        generated_at=NOW,
        coverage_basis_points=0,
        critical_coverage_basis_points=0,
        all_critical_covered=False,
        topics=(
            TopicCoverage(
                topic=CoverageTopic.FINANCE_RATES,
                status=TopicCoverageStatus.UNOBSERVED,
                required_sources=1,
                healthy_source_ids=(),
                stale_source_ids=(),
                reasons=("no_successful_observation",),
            ),
        ),
    )
    return LiveEvidenceBundle(
        repository_sha=REPOSITORY_SHA,
        catalog_sha256="c" * 64,
        started_at=NOW - timedelta(seconds=1),
        completed_at=NOW,
        status=LiveCollectionStatus.FAILED,
        source_results=(
            LiveSourceResult(
                source_id="official.cbr.key-rate",
                status=LiveSourceResultStatus.FAILED,
                started_at=NOW - timedelta(seconds=1),
                completed_at=NOW,
                reason="source_http_503",
                observation=None,
            ),
        ),
        assessment=assessment,
    )


def _read(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def test_cli_writes_failed_or_partial_live_result_as_valid_artifact(
    tmp_path: Path,
    monkeypatch: object,
    capsys: object,
) -> None:
    monkeypatch.setattr(  # type: ignore[attr-defined]
        live_source_evidence_cli,
        "load_official_source_catalog",
        lambda path: object(),
    )
    monkeypatch.setattr(  # type: ignore[attr-defined]
        live_source_evidence_cli,
        "live_definitions",
        lambda **kwargs: (object(),),
    )
    _Collector.bundle = _bundle()
    monkeypatch.setattr(  # type: ignore[attr-defined]
        live_source_evidence_cli,
        "LiveSourceEvidenceCollector",
        _Collector,
    )
    output = tmp_path / "evidence"

    result = live_source_evidence_cli.main(
        [
            str(tmp_path / "catalog.json"),
            "--repository-sha",
            REPOSITORY_SHA,
            "--output-dir",
            str(output),
        ]
    )

    assert result == 0
    manifest = _read(output / "live-run-manifest.json")
    observations = _read(output / "source-observations.v1.json")
    coverage = _read(output / "coverage-assessment.json")
    assert manifest["status"] == "FAILED"
    assert len(str(manifest["evidence_bundle_sha256"])) == 64
    assert observations["observations"] == []
    assert coverage["all_critical_covered"] is False
    captured = capsys.readouterr()  # type: ignore[attr-defined]
    assert '"status": "FAILED"' in captured.out


def test_cli_structural_error_is_nonzero_and_still_uploadable(tmp_path: Path) -> None:
    output = tmp_path / "invalid"

    result = live_source_evidence_cli.main(
        [
            str(tmp_path / "missing-catalog.json"),
            "--repository-sha",
            REPOSITORY_SHA,
            "--output-dir",
            str(output),
            "--timeout-seconds",
            "0.1",
        ]
    )

    assert result == 2
    error = _read(output / "collector-error.json")
    assert error["status"] == "INVALID"
    assert "between 1 and 60" in str(error["error"])
