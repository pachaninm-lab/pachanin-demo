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
    _stage_acceptance,
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
REPOSITORY_GATEWAY_EVIDENCE = (
    Path(__file__).resolve().parents[1]
    / "governance"
    / "gateway-exact-main-acceptance.v1.json"
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

#: The exact main the committed backlog records its discovery against. It moves whenever
#: the snapshot is re-derived, which is the point: the snapshot must name the commit the
#: evidence was actually audited on, not an older one that happens to still parse.
MAIN_SHA = "d79064333ff5653baa43528fd6a956bd9b2fbb87"
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


def _disabled_gateway_backlog(*items: AcceptanceItem) -> AcceptanceBacklog:
    """A backlog whose gateway is accepted on exact main but deliberately off."""
    subsystems = dict(ALL_SUBSYSTEMS)
    subsystems["gateway"] = SubsystemStatus.ACCEPTED_DISABLED_PENDING_MODEL_ADMISSION
    return AcceptanceBacklog(
        discovery=_discovery(),
        items=tuple(sorted(items, key=lambda item: item.item_id)),
        subsystems=subsystems,
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
            "deferred_by_owner_decision": 0,
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


def _deferred(item_id: str, stage: str = "A", *, mandatory: bool = True) -> AcceptanceItem:
    return AcceptanceItem(
        item_id=item_id,
        stage=stage,
        title=f"deferred item {item_id}",
        mandatory=mandatory,
        status=AcceptanceStatus.DEFERRED_BY_OWNER_DECISION,
        blocking_reason="owner decision 26.07.2026: out of scope for this release",
    )


class TestOwnerDeferral:
    """Owner decision of 26.07.2026 put confirmed actions outside this release.

    BLOCKED was the wrong shape for those items. It says "waiting on something", keeps
    counting against readiness, and puts the work on the recommended execution order —
    inviting someone to build exactly what the owner forbade. It also made PASS
    unreachable by construction, so the manifest would have reported NOT_ATTESTED forever
    for a reason unrelated to readiness.
    """

    def test_a_deferred_item_must_state_the_decision(self) -> None:
        with pytest.raises(ValueError, match="requires a blocking reason"):
            AcceptanceItem(
                item_id="Z.01",
                stage="A",
                title="deferred without a reason",
                mandatory=True,
                status=AcceptanceStatus.DEFERRED_BY_OWNER_DECISION,
            )

    def test_deferral_applies_only_to_mandatory_items(self) -> None:
        """Deferring an optional item changes nothing, so it reads as a decision nobody made."""
        with pytest.raises(ValueError, match="only to mandatory items"):
            _deferred("Z.02", mandatory=False)

    def test_a_deferred_item_leaves_the_mandatory_denominator(self) -> None:
        backlog = _backlog(_accepted("A.01"), _blocked("A.02"), _deferred("A.03"))
        totals = backlog.totals()

        assert totals.mandatory_total == 2
        assert totals.mandatory_accepted == 1
        assert totals.mandatory_deferred == 1
        assert totals.completion_percent == 50.0

    def test_the_deferred_count_travels_with_the_percentage(self) -> None:
        """A denominator that shrank silently would read as progress."""
        rendered = _backlog(_accepted("A.01"), _deferred("A.02")).totals().to_json_object()

        assert rendered["mandatory_total"] == 1
        assert rendered["mandatory_deferred_by_owner_decision"] == 1

    def test_a_deferred_item_is_not_a_blocker(self) -> None:
        backlog = _backlog(_accepted("A.01"), _blocked("A.02"), _deferred("A.03"))

        blocking = [item.item_id for item in backlog.blocking_items()]
        assert blocking == ["A.02"]

    def test_a_deferred_item_is_never_counted_as_accepted(self) -> None:
        """Deferral removes an obligation; it proves nothing."""
        totals = _backlog(_deferred("A.01"), _deferred("A.02")).totals()

        assert totals.accepted == 0
        assert totals.mandatory_accepted == 0

    def test_deferral_does_not_manufacture_a_pass(self) -> None:
        """A release with real work outstanding stays NOT_ATTESTED."""
        backlog = _backlog(_accepted("A.01"), _blocked("A.02"), _deferred("A.03"))

        assert derive_final_status(backlog) is FinalStatus.NOT_ATTESTED

    def test_a_release_whose_only_gap_was_deferred_can_pass(self) -> None:
        """This is the point: an item the owner ruled out must not block attestation forever."""
        backlog = _backlog(_accepted("A.01"), _deferred("A.02"))

        assert derive_final_status(backlog) is FinalStatus.PASS

    def test_a_regression_still_fails_alongside_a_deferral(self) -> None:
        regressed = AcceptanceItem(
            item_id="A.02",
            stage="A",
            title="regressed item",
            mandatory=True,
            status=AcceptanceStatus.REGRESSED,
            blocking_reason="a previously accepted gate broke",
        )
        backlog = _backlog(_accepted("A.01"), regressed, _deferred("A.03"))

        assert derive_final_status(backlog) is FinalStatus.FAIL

    def test_stage_acceptance_uses_the_same_denominator_as_the_totals(self) -> None:
        """Otherwise the manifest contradicts itself.

        Counting a deferred item in its stage while excluding it from the mandatory
        totals means that once every attemptable item is accepted, final_status reads
        PASS while the stage holding the deferred item still reads NOT_ATTESTED. A reader
        has no way to tell which number is wrong.
        """
        backlog = _backlog(_accepted("I.01", stage="I"), _deferred("I.02", stage="I"))
        stage = _stage_acceptance(backlog, "I")

        assert stage["total"] == 1
        assert stage["accepted"] == 1
        assert stage["deferred_by_owner_decision"] == 1
        assert stage["status"] == FinalStatus.PASS.value
        assert derive_final_status(backlog) is FinalStatus.PASS

    def test_a_stage_of_only_deferred_items_is_not_a_pass(self) -> None:
        """An empty denominator must not manufacture a pass out of nothing proven."""
        backlog = _backlog(_accepted("A.01"), _deferred("L.09", stage="L"))
        stage = _stage_acceptance(backlog, "L")

        assert stage["total"] == 0
        assert stage["accepted"] == 0
        assert stage["deferred_by_owner_decision"] == 1
        assert stage["status"] == FinalStatus.NOT_ATTESTED.value

    def test_a_deferred_item_is_not_listed_as_a_stage_blocker(self) -> None:
        backlog = _backlog(
            _accepted("I.01", stage="I"),
            _blocked("I.03", stage="I"),
            _deferred("I.02", stage="I"),
        )

        assert _stage_acceptance(backlog, "I")["blocking_items"] == ["I.03"]

    def test_a_deferral_does_not_lift_a_stage_whose_own_work_is_unfinished(self) -> None:
        """Deferring one item must not carry the rest of the stage over the line.

        Removing an item from the denominator raises the ratio for everything left. If
        the stage could reach PASS while an in-scope item is still unproven, an owner
        decision about work that will never be built would read as acceptance of work
        that simply has not been done.
        """
        backlog = _backlog(
            _accepted("I.01", stage="I"),
            _blocked("I.03", stage="I"),
            _deferred("I.02", stage="I"),
        )
        stage = _stage_acceptance(backlog, "I")

        assert stage["total"] == 2
        assert stage["accepted"] == 1
        assert stage["deferred_by_owner_decision"] == 1
        assert stage["status"] == FinalStatus.NOT_ATTESTED.value

    def test_a_stage_regression_still_fails_beside_a_deferral(self) -> None:
        regressed = AcceptanceItem(
            item_id="L.01",
            stage="L",
            title="regressed stage item",
            mandatory=True,
            status=AcceptanceStatus.REGRESSED,
            blocking_reason="a previously accepted gate broke",
        )
        backlog = _backlog(regressed, _deferred("L.09", stage="L"))

        assert _stage_acceptance(backlog, "L")["status"] == FinalStatus.FAIL.value


class TestAcceptedButDeliberatelyDisabledSubsystem:
    """A subsystem can be finished, proven and switched off on purpose.

    NOT_ACTIVATED conflated two situations a reader has to tell apart: a
    subsystem nobody built, and one that is built, verified on exact main, and
    waiting on an admission decision that is not an engineering task.
    """

    def test_the_status_is_representable_and_survives_a_render_round_trip(self) -> None:
        backlog = _disabled_gateway_backlog(_accepted("H.01", stage="H"))

        payload = gap_report_payload(backlog)

        assert payload["gateway_status"] == "ACCEPTED_DISABLED_PENDING_MODEL_ADMISSION"

    def test_it_does_not_make_the_overall_attestation_pass(self) -> None:
        """Proven is not running.

        The whole point of the status is that it reports what was proven without
        claiming the subsystem is live, so it must never move the final verdict.
        """
        backlog = _disabled_gateway_backlog(
            _accepted("H.01", stage="H"),
            _blocked("H.06", stage="H"),
        )

        assert derive_final_status(backlog) is FinalStatus.NOT_ATTESTED
        assert _stage_acceptance(backlog, "H")["blocking_items"] == ["H.06"]


class TestGatewayStageOnExactMain:
    """The committed backlog is itself an assertion, so it is checked here."""

    def test_the_gateway_stage_is_accepted_except_for_the_activation_item(self) -> None:
        backlog = load_backlog(REPOSITORY_BACKLOG)
        stage = _stage_acceptance(backlog, "H")

        assert stage["accepted"] == 5
        assert stage["blocking_items"] == ["H.06"]
        assert stage["status"] == FinalStatus.NOT_ATTESTED.value

    def test_the_gateway_subsystem_reports_accepted_but_disabled(self) -> None:
        backlog = load_backlog(REPOSITORY_BACKLOG)

        assert (
            backlog.subsystems["gateway"]
            is SubsystemStatus.ACCEPTED_DISABLED_PENDING_MODEL_ADMISSION
        )

    def test_the_protocol_item_no_longer_names_a_write_event(self) -> None:
        """H.02 used to name prepared_action and decision as protocol events.

        The read-only contract has neither. Accepting the item as written would
        have attested to a protocol the gateway deliberately does not speak.
        """
        backlog = load_backlog(REPOSITORY_BACKLOG)
        title = next(item.title for item in backlog.items if item.item_id == "H.02")

        assert "prepared_action" not in title
        assert "decision" not in title
        for event in ("meta", "token", "citation", "assessment", "done", "error"):
            assert event in title

    def test_every_accepted_gateway_item_cites_the_re_derivable_evidence(self) -> None:
        """Evidence has to be something a later reader can re-run.

        A commit link says what changed; it does not say the property still
        holds. The acceptance record does, because a test re-derives it.
        """
        backlog = load_backlog(REPOSITORY_BACKLOG)
        accepted = [
            item
            for item in backlog.items
            if item.stage == "H" and item.status is AcceptanceStatus.ACCEPTED
        ]

        assert len(accepted) == 5
        for item in accepted:
            assert "apps/tai/governance/gateway-exact-main-acceptance.v1.json" in item.evidence_refs
            assert "apps/tai/tests/test_gateway_acceptance.py" in item.evidence_refs

    def test_the_backlog_records_the_exact_main_the_evidence_was_derived_from(self) -> None:
        backlog = load_backlog(REPOSITORY_BACKLOG)
        evidence = json.loads(REPOSITORY_GATEWAY_EVIDENCE.read_text(encoding="utf-8"))

        assert backlog.discovery.exact_main_sha == evidence["exact_main_sha"]
