from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from tai.live_source_evidence import (
    LiveCollectionStatus,
    LiveEvidenceBundle,
    LiveSourceEvidenceCollector,
    coverage_payload,
    evidence_bundle_sha256,
    observations_payload,
    refresh_events,
    run_manifest_payload,
)
from tai.official_source_diagnostics import (
    diagnostic_live_definitions as live_definitions,
)
from tai.source_coverage import (
    CoverageTopic,
    OfficialSourceCatalog,
    load_official_source_catalog,
)
from tai.source_health import (
    OfficialSourceHealthAuthority,
    SourceHealthHistory,
    SourceHealthStatus,
    SourceHistoryStatus,
    SourceRefreshCycle,
    active_alerts_payload,
    load_source_health_history,
    merge_source_health_history,
    source_health_dashboard_payload,
    source_health_history_payload,
)

_REQUIRED_SOURCE_IDS = frozenset(
    {
        "official.cbr.key-rate",
        "official.eec.grain-regulation",
        "official.mcx.opendata",
        "official.mintrans.rail-tariffs",
        "official.rosselhoscenter.agronomy",
        "official.rosstat.agriculture",
    }
)
_REQUIRED_CRITICAL_TOPICS = frozenset(CoverageTopic)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tai-live-source-evidence",
        description=(
            "Collect controlled read-only evidence from governed official sources."
        ),
    )
    parser.add_argument("catalog", type=Path)
    parser.add_argument("--repository-sha", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--timeout-seconds", type=float, default=20.0)
    parser.add_argument("--run-id", type=int, default=1)
    parser.add_argument("--run-attempt", type=int, default=1)
    parser.add_argument(
        "--trigger",
        choices=("issue_comment", "schedule", "workflow_dispatch"),
        default="workflow_dispatch",
    )
    parser.add_argument("--previous-history", type=Path)
    parser.add_argument(
        "--history-status",
        choices=tuple(item.value for item in SourceHistoryStatus),
    )
    parser.add_argument("--remediation-baseline", type=Path)
    parser.add_argument("--require-complete-coverage", action="store_true")
    arguments = parser.parse_args(argv)

    try:
        if not 1.0 <= arguments.timeout_seconds <= 60.0:
            raise ValueError("--timeout-seconds must be between 1 and 60")
        catalog = load_official_source_catalog(arguments.catalog)
        definitions = live_definitions(
            catalog=catalog,
            timeout_seconds=arguments.timeout_seconds,
        )
        bundle = LiveSourceEvidenceCollector(
            catalog=catalog,
            definitions=definitions,
            repository_sha=arguments.repository_sha,
        ).collect()
        output_dir: Path = arguments.output_dir
        output_dir.mkdir(parents=True, exist_ok=True)
        bundle_sha256 = evidence_bundle_sha256(bundle)
        manifest = run_manifest_payload(bundle)
        manifest["evidence_bundle_sha256"] = bundle_sha256
        _write_json(output_dir / "live-run-manifest.json", manifest)
        _write_json(
            output_dir / "source-observations.v1.json",
            observations_payload(bundle),
        )
        _write_json(
            output_dir / "coverage-assessment.json",
            coverage_payload(bundle),
        )
        previous, history_status = _history_input(
            path=arguments.previous_history,
            requested_status=(
                SourceHistoryStatus(arguments.history_status)
                if arguments.history_status is not None
                else None
            ),
            catalog_sha256=bundle.catalog_sha256,
        )
        cycle = SourceRefreshCycle(
            repository_sha=bundle.repository_sha,
            run_id=arguments.run_id,
            run_attempt=arguments.run_attempt,
            trigger=arguments.trigger,
            started_at=bundle.started_at,
            completed_at=bundle.completed_at,
            evidence_bundle_sha256=bundle_sha256,
            events=refresh_events(bundle),
        )
        history = merge_source_health_history(
            previous=previous,
            current=cycle,
            catalog_sha256=bundle.catalog_sha256,
        )
        dashboard = OfficialSourceHealthAuthority().assess(
            catalog=catalog,
            history=history,
            history_status=history_status,
            coverage=bundle.assessment,
            now=bundle.completed_at,
        )
        history_payload = source_health_history_payload(history)
        dashboard_payload = source_health_dashboard_payload(dashboard)
        alerts_payload = active_alerts_payload(dashboard)
        _write_json(output_dir / "source-health-history.v1.json", history_payload)
        _write_json(output_dir / "source-health-dashboard.v1.json", dashboard_payload)
        _write_json(output_dir / "active-alerts.v1.json", alerts_payload)
        remediation = _remediation_trace(
            baseline_path=arguments.remediation_baseline,
            bundle=bundle,
            bundle_sha256=bundle_sha256,
        )
        _write_json(output_dir / "remediation-trace.v1.json", remediation)
        acceptance = _knowledge_acceptance(
            catalog=catalog,
            bundle=bundle,
            dashboard_status=dashboard.status,
            dashboard_sha256=dashboard.dashboard_sha256,
            history_status=history_status,
            require_complete=arguments.require_complete_coverage,
        )
        _write_json(output_dir / "knowledge-acceptance.v1.json", acceptance)
        index = _evidence_index(output_dir)
        _write_json(output_dir / "evidence-bundle-index.v1.json", index)
        sys.stdout.write(
            json.dumps(
                {
                    "all_critical_covered": bundle.assessment.all_critical_covered,
                    "dashboard_status": dashboard.status.value,
                    "evidence_bundle_sha256": bundle_sha256,
                    "evidence_index_sha256": index["index_sha256"],
                    "history_status": history_status.value,
                    "knowledge_accepted": acceptance["accepted"],
                    "observed_source_count": len(bundle.observations),
                    "status": bundle.status.value,
                },
                ensure_ascii=False,
                sort_keys=True,
            )
            + "\n"
        )
        if dashboard.status is SourceHealthStatus.CRITICAL:
            return 3
        if arguments.require_complete_coverage and not acceptance["accepted"]:
            return 3
        return 0
    except (OSError, ValueError) as error:
        output_dir = arguments.output_dir
        output_dir.mkdir(parents=True, exist_ok=True)
        _write_json(
            output_dir / "collector-error.json",
            {
                "error": str(error),
                "repository_sha": arguments.repository_sha,
                "schema_version": "tai.live-official-source-error.v1",
                "status": "INVALID",
            },
        )
        return 2


def _write_json(path: Path, payload: dict[str, object]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _knowledge_acceptance(
    *,
    catalog: OfficialSourceCatalog,
    bundle: LiveEvidenceBundle,
    dashboard_status: SourceHealthStatus,
    dashboard_sha256: str,
    history_status: SourceHistoryStatus,
    require_complete: bool,
) -> dict[str, object]:
    reasons: list[str] = []
    source_ids = frozenset(source.source_id for source in catalog.sources)
    critical_topics = frozenset(
        requirement.topic
        for requirement in catalog.requirements
        if requirement.critical
    )
    if source_ids != _REQUIRED_SOURCE_IDS:
        reasons.append("OFFICIAL_SOURCE_SET_NOT_GOVERNED")
    if critical_topics != _REQUIRED_CRITICAL_TOPICS:
        reasons.append("CRITICAL_TOPIC_SET_NOT_GOVERNED")
    if bundle.status is not LiveCollectionStatus.COMPLETE:
        reasons.append("COLLECTION_NOT_COMPLETE")
    if bundle.assessment.coverage_basis_points != 10_000:
        reasons.append("TOPIC_COVERAGE_NOT_COMPLETE")
    if bundle.assessment.critical_coverage_basis_points != 10_000:
        reasons.append("CRITICAL_COVERAGE_NOT_COMPLETE")
    if not bundle.assessment.all_critical_covered:
        reasons.append("CRITICAL_TOPICS_NOT_COVERED")
    if dashboard_status is not SourceHealthStatus.HEALTHY:
        reasons.append("SOURCE_HEALTH_NOT_HEALTHY")
    if history_status is SourceHistoryStatus.GAP:
        reasons.append("SOURCE_HISTORY_GAP")
    accepted = not reasons
    payload: dict[str, object] = {
        "accepted": accepted,
        "all_critical_covered": bundle.assessment.all_critical_covered,
        "assessment_sha256": bundle.assessment.assessment_sha256,
        "collection_status": bundle.status.value,
        "coverage_basis_points": bundle.assessment.coverage_basis_points,
        "governed_source_ids": sorted(source_ids),
        "governed_critical_topics": sorted(
            topic.value for topic in critical_topics
        ),
        "critical_coverage_basis_points": (
            bundle.assessment.critical_coverage_basis_points
        ),
        "dashboard_sha256": dashboard_sha256,
        "history_status": history_status.value,
        "reasons": reasons,
        "repository_sha": bundle.repository_sha,
        "required_complete_coverage": require_complete,
        "required_source_ids": sorted(_REQUIRED_SOURCE_IDS),
        "required_critical_topics": sorted(
            topic.value for topic in _REQUIRED_CRITICAL_TOPICS
        ),
        "schema_version": "tai.exact-main-knowledge-acceptance.v1",
        "source_count": len(bundle.source_results),
        "topic_statuses": [
            {"status": topic.status.value, "topic": topic.topic.value}
            for topic in bundle.assessment.topics
        ],
    }
    payload["acceptance_sha256"] = _payload_sha256(payload)
    return payload


def _history_input(
    *,
    path: Path | None,
    requested_status: SourceHistoryStatus | None,
    catalog_sha256: str,
) -> tuple[SourceHealthHistory | None, SourceHistoryStatus]:
    if requested_status is SourceHistoryStatus.GAP:
        return None, SourceHistoryStatus.GAP
    if path is None:
        if requested_status is SourceHistoryStatus.CONTIGUOUS:
            return None, SourceHistoryStatus.GAP
        return None, SourceHistoryStatus.BOOTSTRAP
    try:
        previous = load_source_health_history(path)
    except (OSError, ValueError):
        return None, SourceHistoryStatus.GAP
    if (
        previous.catalog_sha256 != catalog_sha256
        or requested_status is SourceHistoryStatus.BOOTSTRAP
    ):
        return None, SourceHistoryStatus.GAP
    return previous, SourceHistoryStatus.CONTIGUOUS


def _remediation_trace(
    *,
    baseline_path: Path | None,
    bundle: LiveEvidenceBundle,
    bundle_sha256: str,
) -> dict[str, object]:
    baseline: dict[str, object] | None = None
    if baseline_path is not None:
        raw = json.loads(baseline_path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise ValueError("remediation baseline must be an object")
        baseline = {str(key): value for key, value in raw.items()}
    previous_by_source: dict[str, dict[str, object]] = {}
    if baseline is not None:
        source_results = baseline.get("source_results")
        if not isinstance(source_results, list):
            raise ValueError("remediation baseline source_results must be an array")
        for value in source_results:
            if not isinstance(value, dict) or not isinstance(value.get("source_id"), str):
                raise ValueError("remediation baseline source result is invalid")
            previous_by_source[str(value["source_id"])] = {
                str(key): item for key, item in value.items()
            }
    payload: dict[str, object] = {
        "baseline_evidence_bundle_sha256": (
            baseline.get("evidence_bundle_sha256") if baseline is not None else None
        ),
        "current_evidence_bundle_sha256": bundle_sha256,
        "repository_sha": bundle.repository_sha,
        "schema_version": "tai.ap14d-remediation-trace.v1",
        "sources": [
            {
                "baseline": previous_by_source.get(result.source_id),
                "current": {
                    "reason": result.reason,
                    "refresh_outcome": result.refresh_outcome.value,
                    "status": result.status.value,
                },
                "source_id": result.source_id,
            }
            for result in bundle.source_results
        ],
    }
    payload["trace_sha256"] = _payload_sha256(payload)
    return payload


def _evidence_index(output_dir: Path) -> dict[str, object]:
    names = (
        "active-alerts.v1.json",
        "coverage-assessment.json",
        "knowledge-acceptance.v1.json",
        "live-run-manifest.json",
        "remediation-trace.v1.json",
        "source-health-dashboard.v1.json",
        "source-health-history.v1.json",
        "source-observations.v1.json",
    )
    files = [
        {
            "path": name,
            "sha256": hashlib.sha256((output_dir / name).read_bytes()).hexdigest(),
        }
        for name in names
    ]
    payload: dict[str, object] = {
        "files": files,
        "schema_version": "tai.live-evidence-index.v1",
    }
    payload["index_sha256"] = _payload_sha256(payload)
    return payload


def _payload_sha256(payload: object) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
