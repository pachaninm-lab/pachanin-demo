from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from tai.industrial_gap_report import (
    AcceptanceBacklog,
    AcceptanceItem,
    AcceptanceStatus,
    DiscoveryContext,
    FinalStatus,
    ModelDescriptor,
    ProductionOperationalManifest,
    SubsystemStatus,
    backlog_canonical_json,
    canonical_json,
    derive_final_status,
    gap_report_payload,
    load_backlog,
    manifest_payload,
)
from tai.industrial_gap_report_cli import main

REPOSITORY_BACKLOG = (
    Path(__file__).resolve().parents[1] / "governance" / "industrial-acceptance-backlog.v1.json"
)
REPOSITORY_GAP_REPORT = (
    Path(__file__).resolve().parents[1] / "governance" / "current-industrial-gap-report.json"
)
REPOSITORY_MANIFEST = (
    Path(__file__).resolve().parents[1]
    / "governance"
    / "tai-production-operational-manifest.json"
)
REPOSITORY_RELEASE_ID = "tai-industrial-discovery-2026-07-25"

MAIN_SHA = "ca2e1ecec47b4dec1868d681f2d25c0aaaac8444"
QWEN_REVISION = "895c8d171bc03c30e113cd7a28c02494b5e068b7"
MISTRAL_REVISION = "c170c708c41dac9275d15a8fff4eca08d52bab71"

ALL_SUBSYSTEMS = {
    "benchmark": SubsystemStatus.PENDING_BENCHMARK,
    "document_intelligence": SubsystemStatus.NOT_STARTED,
    "gateway": SubsystemStatus.NOT_ACTIVATED,
    "knowledge": SubsystemStatus.PARTIAL,
    "model_admission": SubsystemStatus.PENDING_ADMISSION,
    "model_artifact": SubsystemStatus.PENDING_ACQUISITION,
    "observability": SubsystemStatus.PARTIAL,
    "production_deployment": SubsystemStatus.NOT_ACTIVATED,
    "retrieval": SubsystemStatus.PARTIAL,
    "safe_tools": SubsystemStatus.PARTIAL,
    "ui": SubsystemStatus.NOT_ACTIVATED,
}


def _discovery() -> DiscoveryContext:
    return DiscoveryContext(
        exact_main_sha=MAIN_SHA,
        generated_at=datetime(2026, 7, 25, 14, 10, tzinfo=UTC),
        open_pull_request_count=173,
        open_issue_count=209,
        counts_method="search total_count for pull requests; GraphQL totalCount for issues",
        stale_branches=("agent/tai-gateway-ui-readonly-3004",),
        failing_main_workflows=(".github/workflows/tai-gateway-ui-readonly-binding.yml",),
    )


def _model(role: str) -> ModelDescriptor:
    if role == "primary":
        return ModelDescriptor(
            model_id="Qwen/Qwen3-8B",
            revision=QWEN_REVISION,
            quantization="Q4_K_M",
            status=SubsystemStatus.PENDING_ACQUISITION,
        )
    return ModelDescriptor(
        model_id="mistralai/Mistral-7B-Instruct-v0.3",
        revision=MISTRAL_REVISION,
        quantization="Q4_K_M",
        status=SubsystemStatus.PENDING_ACQUISITION,
    )


def _backlog(*items: AcceptanceItem) -> AcceptanceBacklog:
    return AcceptanceBacklog(
        discovery=_discovery(),
        items=tuple(sorted(items, key=lambda item: item.item_id)),
        subsystems=dict(ALL_SUBSYSTEMS),
        primary_model=_model("primary"),
        fallback_model=_model("fallback"),
    )


def _accepted(item_id: str, stage: str = "A") -> AcceptanceItem:
    return AcceptanceItem(
        item_id=item_id,
        stage=stage,
        title=f"accepted item {item_id}",
        mandatory=True,
        status=AcceptanceStatus.ACCEPTED,
        evidence_refs=("https://github.com/pachaninm-lab/pachanin-demo/actions/runs/1",),
    )


def _blocked(item_id: str, stage: str = "A") -> AcceptanceItem:
    return AcceptanceItem(
        item_id=item_id,
        stage=stage,
        title=f"blocked item {item_id}",
        mandatory=True,
        status=AcceptanceStatus.BLOCKED,
        blocking_reason="dependency is unfinished",
    )


class TestAcceptanceItemInvariants:
    def test_accepted_item_requires_evidence(self) -> None:
        with pytest.raises(ValueError, match="requires at least one evidence ref"):
            AcceptanceItem(
                item_id="A.01",
                stage="A",
                title="claim without evidence",
                mandatory=True,
                status=AcceptanceStatus.ACCEPTED,
            )

    def test_accepted_item_rejects_blocking_reason(self) -> None:
        with pytest.raises(ValueError, match="must not carry a blocking reason"):
            AcceptanceItem(
                item_id="A.01",
                stage="A",
                title="contradictory item",
                mandatory=True,
                status=AcceptanceStatus.ACCEPTED,
                evidence_refs=("apps/tai/README.md",),
                blocking_reason="still blocked",
            )

    @pytest.mark.parametrize(
        "status", [AcceptanceStatus.BLOCKED, AcceptanceStatus.REGRESSED]
    )
    def test_unfinished_item_requires_reason(self, status: AcceptanceStatus) -> None:
        with pytest.raises(ValueError, match="requires a blocking reason"):
            AcceptanceItem(
                item_id="A.01", stage="A", title="silent blocker", mandatory=True, status=status
            )

    def test_not_started_item_rejects_evidence(self) -> None:
        with pytest.raises(ValueError, match="must not carry evidence"):
            AcceptanceItem(
                item_id="A.01",
                stage="A",
                title="unstarted with evidence",
                mandatory=True,
                status=AcceptanceStatus.NOT_STARTED,
                evidence_refs=("apps/tai/README.md",),
            )

    def test_stage_must_be_a_known_letter(self) -> None:
        with pytest.raises(ValueError, match="stage must be a single letter"):
            AcceptanceItem(
                item_id="M.01",
                stage="M",
                title="unknown stage",
                mandatory=True,
                status=AcceptanceStatus.NOT_STARTED,
            )

    def test_duplicate_evidence_is_rejected(self) -> None:
        with pytest.raises(ValueError, match="evidence references must be unique"):
            AcceptanceItem(
                item_id="A.01",
                stage="A",
                title="duplicated evidence",
                mandatory=True,
                status=AcceptanceStatus.ACCEPTED,
                evidence_refs=("apps/tai/README.md", "apps/tai/README.md"),
            )


class TestBacklogInvariants:
    def test_items_must_be_sorted(self) -> None:
        with pytest.raises(ValueError, match="sorted by item_id"):
            AcceptanceBacklog(
                discovery=_discovery(),
                items=(_accepted("A.02"), _accepted("A.01")),
                subsystems=dict(ALL_SUBSYSTEMS),
                primary_model=_model("primary"),
                fallback_model=_model("fallback"),
            )

    def test_missing_subsystem_status_is_rejected(self) -> None:
        subsystems = dict(ALL_SUBSYSTEMS)
        del subsystems["gateway"]
        with pytest.raises(ValueError, match="subsystem status is missing: gateway"):
            AcceptanceBacklog(
                discovery=_discovery(),
                items=(_accepted("A.01"),),
                subsystems=subsystems,
                primary_model=_model("primary"),
                fallback_model=_model("fallback"),
            )

    def test_unknown_subsystem_status_is_rejected(self) -> None:
        subsystems = dict(ALL_SUBSYSTEMS)
        subsystems["telepathy"] = SubsystemStatus.ACCEPTED
        with pytest.raises(ValueError, match="unknown subsystem status: telepathy"):
            AcceptanceBacklog(
                discovery=_discovery(),
                items=(_accepted("A.01"),),
                subsystems=subsystems,
                primary_model=_model("primary"),
                fallback_model=_model("fallback"),
            )

    def test_negative_open_counts_are_rejected(self) -> None:
        """Counts replaced enumerated lists after the lists silently under-reported."""
        with pytest.raises(ValueError, match="open_pull_request_count must not be negative"):
            DiscoveryContext(
                exact_main_sha=MAIN_SHA,
                generated_at=datetime(2026, 7, 25, tzinfo=UTC),
                open_pull_request_count=-1,
                open_issue_count=0,
                counts_method="search total_count",
                stale_branches=(),
                failing_main_workflows=(),
            )

    def test_counts_must_say_how_they_were_obtained(self) -> None:
        """A bare number cannot be audited; the method is what makes it checkable."""
        with pytest.raises(ValueError, match="counts_method"):
            DiscoveryContext(
                exact_main_sha=MAIN_SHA,
                generated_at=datetime(2026, 7, 25, tzinfo=UTC),
                open_pull_request_count=173,
                open_issue_count=209,
                counts_method="",
                stale_branches=(),
                failing_main_workflows=(),
            )

    def test_naive_timestamp_is_rejected(self) -> None:
        with pytest.raises(ValueError, match="aware UTC timestamp"):
            DiscoveryContext(
                exact_main_sha=MAIN_SHA,
                generated_at=datetime(2026, 7, 25),  # noqa: DTZ001
                open_pull_request_count=0,
                open_issue_count=0,
                counts_method="search total_count",
                stale_branches=(),
                failing_main_workflows=(),
            )


class TestFinalStatusDerivation:
    def test_pass_requires_every_mandatory_item_accepted(self) -> None:
        backlog = _backlog(_accepted("A.01"), _accepted("B.01", stage="B"))
        assert derive_final_status(backlog) is FinalStatus.PASS

    def test_single_blocked_item_prevents_pass(self) -> None:
        backlog = _backlog(_accepted("A.01"), _blocked("B.01", stage="B"))
        assert derive_final_status(backlog) is FinalStatus.NOT_ATTESTED

    def test_regressed_mandatory_item_is_a_hard_fail(self) -> None:
        regressed = AcceptanceItem(
            item_id="A.02",
            stage="A",
            title="exact main is red",
            mandatory=True,
            status=AcceptanceStatus.REGRESSED,
            blocking_reason="two workflow files fail at startup",
        )
        backlog = _backlog(_accepted("A.01"), regressed)
        assert derive_final_status(backlog) is FinalStatus.FAIL

    def test_optional_regression_downgrades_to_not_attested(self) -> None:
        regressed = AcceptanceItem(
            item_id="A.02",
            stage="A",
            title="optional regression",
            mandatory=False,
            status=AcceptanceStatus.REGRESSED,
            blocking_reason="non-blocking regression",
        )
        backlog = _backlog(_accepted("A.01"), regressed)
        assert derive_final_status(backlog) is FinalStatus.NOT_ATTESTED

    def test_in_progress_item_never_counts_as_accepted(self) -> None:
        in_progress = AcceptanceItem(
            item_id="B.01",
            stage="B",
            title="partially built",
            mandatory=True,
            status=AcceptanceStatus.IN_PROGRESS,
            evidence_refs=("apps/tai/tai/model_runtime.py",),
        )
        backlog = _backlog(_accepted("A.01"), in_progress)
        assert derive_final_status(backlog) is FinalStatus.NOT_ATTESTED
        assert backlog.totals().mandatory_accepted == 1


class TestTotals:
    def test_percentage_is_reproducible_from_counts(self) -> None:
        backlog = _backlog(_accepted("A.01"), _blocked("B.01", stage="B"), _blocked("C.01", "C"))
        totals = backlog.totals()
        assert totals.total == 3
        assert totals.accepted == 1
        assert totals.blocked == 2
        assert totals.remaining == 2
        assert totals.completion_percent == round(
            100 * totals.mandatory_accepted / totals.mandatory_total, 2
        )
        assert totals.to_json_object()["completion_formula"] == (
            "100 * mandatory_accepted / mandatory_total"
        )

    def test_percentage_states_what_it_counts(self) -> None:
        """The number was read as overall product readiness. It never was that.

        It counts readiness evidence gates carrying accepted exact-main evidence. A
        subsystem can be fully built and still contribute nothing until its gate has
        evidence, so the figure floors far below what exists — which is exactly the
        misreading this label exists to prevent.
        """
        scope = _backlog(_accepted("A.01")).totals().to_json_object()["completion_scope"]
        assert scope.startswith("READINESS_EVIDENCE_GATES_WITH_ACCEPTED_EXACT_MAIN_EVIDENCE")
        assert "Not overall TAI implementation progress" in scope
        assert "not product readiness" in scope


class TestManifest:
    def test_forbidden_production_provider_is_rejected(self) -> None:
        backlog = _backlog(_accepted("A.01"))
        for provider in ("Vercel", "NETLIFY"):
            with pytest.raises(ValueError, match="not admissible as production hosting"):
                ProductionOperationalManifest(
                    backlog=backlog, release_id="release-one", provider=provider
                )

    def test_production_domain_is_pinned(self) -> None:
        backlog = _backlog(_accepted("A.01"))
        with pytest.raises(ValueError, match="production domain must be"):
            ProductionOperationalManifest(
                backlog=backlog, release_id="release-one", production_domain="example.com"
            )

    def test_manifest_final_status_is_derived_not_supplied(self) -> None:
        backlog = _backlog(_accepted("A.01"), _blocked("L.10", stage="L"))
        payload = manifest_payload(backlog, "release-one")
        assert payload["final_status"] == FinalStatus.NOT_ATTESTED.value
        assert payload["open_blockers"] == ["L.10"]
        assert payload["infrastructure"] == {
            "production_domain": "процент-агро.рф",
            "provider": "REG.RU",
            "region": "RU",
        }

    def test_stage_acceptance_reports_counts(self) -> None:
        backlog = _backlog(_accepted("B.01", stage="B"), _blocked("B.02", stage="B"))
        runtime = manifest_payload(backlog, "release-one")["runtime_acceptance"]
        assert runtime == {
            "accepted": 1,
            "blocking_items": ["B.02"],
            "stage": "B",
            "status": "NOT_ATTESTED",
            "total": 2,
        }


class TestGapReport:
    def test_blocking_items_and_execution_order_agree(self) -> None:
        backlog = _backlog(_accepted("A.01"), _blocked("C.01", stage="C"), _blocked("B.01", "B"))
        payload = gap_report_payload(backlog)
        assert payload["recommended_execution_order"] == ["B.01", "C.01"]
        assert [entry["item_id"] for entry in payload["blocking_items"]] == ["B.01", "C.01"]
        assert payload["operational_acceptance_status"] == FinalStatus.NOT_ATTESTED.value

    def test_required_gap_report_fields_are_present(self) -> None:
        payload = gap_report_payload(_backlog(_accepted("A.01")))
        for field in (
            "exact_main_sha",
            "generated_at",
            "open_pull_request_count",
            "open_issue_count",
            "counts_method",
            "stale_branches",
            "model_artifact_status",
            "benchmark_status",
            "model_admission_status",
            "knowledge_status",
            "gateway_status",
            "ui_status",
            "safe_tools_status",
            "production_deployment_status",
            "operational_acceptance_status",
            "blocking_items",
            "recommended_execution_order",
        ):
            assert field in payload, field
        assert payload["generated_at"] == "2026-07-25T14:10:00Z"


class TestRoundTrip:
    def test_backlog_survives_serialization(self, tmp_path: Path) -> None:
        backlog = _backlog(_accepted("A.01"), _blocked("B.01", stage="B"))
        path = tmp_path / "backlog.json"
        path.write_text(backlog_canonical_json(backlog), encoding="utf-8")
        assert backlog_canonical_json(load_backlog(path)) == backlog_canonical_json(backlog)

    def test_wrong_schema_is_rejected(self, tmp_path: Path) -> None:
        path = tmp_path / "backlog.json"
        path.write_text(json.dumps({"schema": "other.v1"}), encoding="utf-8")
        with pytest.raises(ValueError, match="backlog schema must be"):
            load_backlog(path)

    def test_canonical_json_preserves_cyrillic(self) -> None:
        assert "процент-агро.рф" in canonical_json(
            manifest_payload(_backlog(_accepted("A.01")), "release-one")
        )


class TestRepositoryEvidence:
    """The committed governance documents must match the committed backlog exactly."""

    def test_committed_backlog_is_valid(self) -> None:
        backlog = load_backlog(REPOSITORY_BACKLOG)
        assert backlog.discovery.exact_main_sha == MAIN_SHA
        assert backlog.primary_model.model_id == "Qwen/Qwen3-8B"
        assert backlog.primary_model.revision == QWEN_REVISION
        assert backlog.fallback_model.model_id == "mistralai/Mistral-7B-Instruct-v0.3"
        assert backlog.fallback_model.revision == MISTRAL_REVISION

    def test_committed_documents_have_no_drift(self) -> None:
        backlog = load_backlog(REPOSITORY_BACKLOG)
        assert REPOSITORY_GAP_REPORT.read_text(encoding="utf-8") == canonical_json(
            gap_report_payload(backlog)
        )
        assert REPOSITORY_MANIFEST.read_text(encoding="utf-8") == canonical_json(
            manifest_payload(backlog, REPOSITORY_RELEASE_ID)
        )

    def test_committed_status_is_not_attested_or_worse(self) -> None:
        assert derive_final_status(load_backlog(REPOSITORY_BACKLOG)) is not FinalStatus.PASS

    def test_committed_backlog_covers_every_stage(self) -> None:
        backlog = load_backlog(REPOSITORY_BACKLOG)
        for stage in "ABCDEFGHIJKL":
            assert backlog.stage_items(stage), stage


class TestCli:
    def test_verify_accepts_freshly_rendered_documents(self, tmp_path: Path) -> None:
        gap_report = tmp_path / "gap.json"
        manifest = tmp_path / "manifest.json"
        arguments = [
            str(REPOSITORY_BACKLOG),
            "--release-id",
            REPOSITORY_RELEASE_ID,
            "--gap-report",
            str(gap_report),
            "--manifest",
            str(manifest),
        ]
        assert main(["render", *arguments]) == 0
        assert main(["verify", *arguments]) == 0

    def test_verify_detects_drift(self, tmp_path: Path) -> None:
        gap_report = tmp_path / "gap.json"
        manifest = tmp_path / "manifest.json"
        arguments = [
            str(REPOSITORY_BACKLOG),
            "--release-id",
            REPOSITORY_RELEASE_ID,
            "--gap-report",
            str(gap_report),
            "--manifest",
            str(manifest),
        ]
        assert main(["render", *arguments]) == 0
        # Forge the number, which is what someone would actually forge. This used to
        # rewrite the literal "FAIL", so the day the backlog stopped deriving FAIL the
        # mutation silently became a no-op and the test passed by not testing anything.
        forged = json.loads(gap_report.read_text(encoding="utf-8"))
        forged["totals"]["completion_percent"] = 100.0
        gap_report.write_text(canonical_json(forged), encoding="utf-8")
        assert main(["verify", *arguments]) == 2

    def test_verify_guards_the_committed_documents(self) -> None:
        assert (
            main(
                [
                    "verify",
                    str(REPOSITORY_BACKLOG),
                    "--release-id",
                    REPOSITORY_RELEASE_ID,
                    "--gap-report",
                    str(REPOSITORY_GAP_REPORT),
                    "--manifest",
                    str(REPOSITORY_MANIFEST),
                ]
            )
            == 0
        )

    def test_invalid_backlog_exits_non_zero(self, tmp_path: Path) -> None:
        path = tmp_path / "backlog.json"
        path.write_text(json.dumps({"schema": "wrong"}), encoding="utf-8")
        assert main(["validate", str(path)]) == 2

    def test_validate_accepts_the_committed_backlog(self) -> None:
        assert main(["validate", str(REPOSITORY_BACKLOG)]) == 0
