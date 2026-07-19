from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from tai import live_source_evidence_cli
from tai.live_source_evidence import (
    LiveCollectionStatus,
    LiveEvidenceBundle,
    LiveSourceResult,
    LiveSourceResultStatus,
)
from tai.source_coverage import (
    CoverageRequirement,
    CoverageTopic,
    OfficialSourceCatalog,
    OfficialSourceCoverageAuthority,
    OfficialSourceDefinition,
    SourceFormat,
    SourceObservation,
)
from tai.source_health import (
    SourceHealthStatus,
    SourceHistoryStatus,
    SourceRefreshOutcome,
)

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)
REPOSITORY_SHA = "b" * 40


class _Collector:
    bundle: LiveEvidenceBundle

    def __init__(self, **kwargs: object) -> None:
        assert kwargs["repository_sha"] == REPOSITORY_SHA

    def collect(self) -> LiveEvidenceBundle:
        return self.bundle


def _catalog() -> OfficialSourceCatalog:
    return OfficialSourceCatalog(
        sources=(
            OfficialSourceDefinition(
                source_id="official.cbr.key-rate",
                owner="Банк России",
                entrypoint_uri="https://www.cbr.ru/hd_base/KeyRate/",
                allowed_hosts=frozenset({"www.cbr.ru"}),
                topics=frozenset({CoverageTopic.FINANCE_RATES}),
                formats=frozenset({SourceFormat.HTML}),
                expected_update_interval=timedelta(days=7),
                maximum_publication_age=timedelta(days=31),
                verified_at=NOW - timedelta(days=1),
            ),
        ),
        requirements=(
            CoverageRequirement(
                topic=CoverageTopic.FINANCE_RATES,
                minimum_official_sources=1,
                maximum_publication_age=timedelta(days=31),
            ),
        ),
    )


def _bundle() -> LiveEvidenceBundle:
    catalog = _catalog()
    assessment = OfficialSourceCoverageAuthority().assess(
        catalog=catalog,
        observations=(),
        now=NOW,
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
                refresh_outcome=SourceRefreshOutcome.RETRYABLE_FAILURE,
                observation=None,
            ),
        ),
        assessment=assessment,
    )


def _complete_bundle() -> LiveEvidenceBundle:
    catalog = _catalog()
    observation = SourceObservation(
        source_id="official.cbr.key-rate",
        observed_at=NOW,
        latest_publication_at=NOW - timedelta(days=1),
        last_success_at=NOW,
        consecutive_failures=0,
        document_count=1,
        observed_topics=frozenset({CoverageTopic.FINANCE_RATES}),
        content_sha256="d" * 64,
    )
    assessment = OfficialSourceCoverageAuthority().assess(
        catalog=catalog,
        observations=(observation,),
        now=NOW,
    )
    return LiveEvidenceBundle(
        repository_sha=REPOSITORY_SHA,
        catalog_sha256="c" * 64,
        started_at=NOW - timedelta(seconds=1),
        completed_at=NOW,
        status=LiveCollectionStatus.COMPLETE,
        source_results=(
            LiveSourceResult(
                source_id="official.cbr.key-rate",
                status=LiveSourceResultStatus.OBSERVED,
                started_at=NOW - timedelta(seconds=1),
                completed_at=NOW,
                reason="official_source_observed",
                refresh_outcome=SourceRefreshOutcome.SUCCEEDED,
                observation=observation,
            ),
        ),
        assessment=assessment,
    )
def _read(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def test_cli_writes_failed_live_result_as_valid_artifact(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(
        live_source_evidence_cli,
        "load_official_source_catalog",
        lambda path: _catalog(),
    )
    monkeypatch.setattr(
        live_source_evidence_cli,
        "live_definitions",
        lambda **kwargs: (object(),),
    )
    _Collector.bundle = _bundle()
    monkeypatch.setattr(
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

    assert result == 3
    manifest = _read(output / "live-run-manifest.json")
    observations = _read(output / "source-observations.v1.json")
    coverage = _read(output / "coverage-assessment.json")
    dashboard = _read(output / "source-health-dashboard.v1.json")
    history = _read(output / "source-health-history.v1.json")
    acceptance = _read(output / "knowledge-acceptance.v1.json")
    index = _read(output / "evidence-bundle-index.v1.json")
    assert manifest["status"] == "FAILED"
    assert len(str(manifest["evidence_bundle_sha256"])) == 64
    assert observations["observations"] == []
    assert coverage["all_critical_covered"] is False
    assert dashboard["status"] == "CRITICAL"
    assert history["cycles"][0]["events"][0]["outcome"] == "RETRYABLE_FAILURE"
    assert acceptance["accepted"] is False
    assert len(str(index["index_sha256"])) == 64
    assert '"status": "FAILED"' in capsys.readouterr().out


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


def test_acceptance_rejects_catalog_reduced_to_relative_100_percent() -> None:
    acceptance = live_source_evidence_cli._knowledge_acceptance(
        catalog=_catalog(),
        bundle=_complete_bundle(),
        dashboard_status=SourceHealthStatus.HEALTHY,
        dashboard_sha256="e" * 64,
        history_status=SourceHistoryStatus.BOOTSTRAP,
        require_complete=True,
    )

    assert acceptance["accepted"] is False
    assert acceptance["coverage_basis_points"] == 10_000
    assert acceptance["reasons"] == [
        "OFFICIAL_SOURCE_SET_NOT_GOVERNED",
        "CRITICAL_TOPIC_SET_NOT_GOVERNED",
    ]


def test_invalid_previous_history_becomes_machine_readable_gap(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        live_source_evidence_cli,
        "load_official_source_catalog",
        lambda path: _catalog(),
    )
    monkeypatch.setattr(
        live_source_evidence_cli,
        "live_definitions",
        lambda **kwargs: (object(),),
    )
    _Collector.bundle = _bundle()
    monkeypatch.setattr(
        live_source_evidence_cli,
        "LiveSourceEvidenceCollector",
        _Collector,
    )
    previous = tmp_path / "corrupt-history.json"
    previous.write_text("not-json", encoding="utf-8")
    output = tmp_path / "evidence"

    result = live_source_evidence_cli.main(
        [
            str(tmp_path / "catalog.json"),
            "--repository-sha",
            REPOSITORY_SHA,
            "--output-dir",
            str(output),
            "--previous-history",
            str(previous),
            "--history-status",
            "CONTIGUOUS",
        ]
    )

    assert result == 3
    dashboard = _read(output / "source-health-dashboard.v1.json")
    assert dashboard["history_status"] == "GAP"
    assert any(
        alert["code"] == "HISTORY_GAP"
        for alert in dashboard["alerts"]
    )
    assert not (output / "collector-error.json").exists()
