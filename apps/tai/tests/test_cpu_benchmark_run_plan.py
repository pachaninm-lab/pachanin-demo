from __future__ import annotations

import copy
import hashlib
from datetime import timedelta
from pathlib import Path
from urllib.parse import quote

import pytest
from cpu_benchmark_run_plan_fixtures import (
    EXACT_MAIN,
    NOW,
    PENDING,
    RUN_PLAN_AUTHORITY,
    _signed,
    _write,
    build_fixture,
    refresh_model_refs,
    refresh_ref,
    sync_model_report_and_finalization,
)

from tai import cpu_benchmark_run_plan as run_plan


def _compile(fixture: dict[str, object]) -> dict[str, object]:
    return run_plan.compile_run_plan(**fixture["compile_kwargs"])


def test_complete_run_plan_is_bounded_and_ready(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    result = _compile(fixture)
    assert result["status"] == run_plan.PLAN_STATUS
    assert result["accepted"] is True
    assert result["exact_main"] == EXACT_MAIN
    assert len(result["models"]) == 2
    assert result["protected_access_policy"] == {
        "compiler_performed_protected_access": False,
        "runner_access_allowed_after_status": run_plan.PLAN_STATUS,
        "ssh_allowed_before_plan": False,
        "s3_read_allowed_before_plan": False,
        "s3_mutation_allowed": False,
    }
    assert result["benchmark_status"] == "PENDING_BENCHMARK"
    assert result["model_admission_status"] == "PENDING_ADMISSION"
    assert result["production_operational_status"] == "NOT_ATTESTED"
    assert result["plan_sha256"] == run_plan.execution.canonical_sha256(
        {key: value for key, value in result.items() if key != "plan_sha256"}
    )
    rendered = str(result).lower()
    for forbidden in ("raw prompt", "raw response", "secret_access_key", "private key"):
        assert forbidden not in rendered


def test_authority_and_pending_baseline_are_exact(tmp_path: Path) -> None:
    authority = run_plan.load_authority(RUN_PLAN_AUTHORITY)
    assert authority["issue"] == 2991
    assert authority["authority_sha256"]
    pending = run_plan.load_pending(PENDING)
    assert pending["status"] == run_plan.PENDING_STATUS

    weakened = run_plan.expected_authority()
    weakened["plan_policy"]["validity_hours"] = 48
    path = tmp_path / "weak-authority.json"
    _write(path, weakened)
    with pytest.raises(run_plan.RunPlanError, match="differs from"):
        run_plan.load_authority(path)

    contaminated = copy.deepcopy(pending)
    contaminated["exact_main"] = EXACT_MAIN
    contaminated = _signed(contaminated, "plan_sha256")
    path = tmp_path / "contaminated-pending.json"
    _write(path, contaminated)
    with pytest.raises(run_plan.RunPlanError, match="contaminated"):
        run_plan.load_pending(path)


@pytest.mark.parametrize(
    ("mutation", "match"),
    [
        ("stale-readiness", "stale"),
        ("future-readiness", "future"),
        ("wrong-exact-main", "not accepted"),
        ("assessment-rejected", "not fully accepted"),
        ("assessment-blocked", "not fully accepted"),
        ("finalization-rejected", "not accepted"),
        ("finalization-stale", "stale"),
        ("finalization-future", "future"),
        ("artifact-digest", "artifact digest"),
        ("artifact-name", "workflow run"),
        ("root-alias", "independent"),
        ("root-traversal", "outside"),
        ("root-missing", "coverage"),
        ("model-duplicate", "unique"),
        ("model-missing", "coverage"),
        ("unknown-index-field", "keys invalid"),
        ("oversized-ref", "size limit"),
        ("drifted-ref", "declared file identity"),
        ("traversal-ref", "bounded relative"),
    ],
)
def test_top_level_and_prerequisite_failures_are_rejected(
    tmp_path: Path, mutation: str, match: str
) -> None:
    fixture = build_fixture(tmp_path)
    readiness_mutations = {"stale-readiness", "future-readiness", "wrong-exact-main"}
    if mutation in readiness_mutations:
        if mutation == "stale-readiness":
            fixture["readiness"]["evaluated_at"] = (NOW - timedelta(hours=25)).isoformat()
        elif mutation == "future-readiness":
            fixture["readiness"]["evaluated_at"] = (NOW + timedelta(hours=1)).isoformat()
        else:
            fixture["readiness"]["exact_main"] = "c" * 40
        fixture["readiness"] = _signed(fixture["readiness"], "report_sha256")
        _write(fixture["readiness_path"], fixture["readiness"])
        refresh_ref(fixture, "readiness", fixture["readiness_path"])
    elif mutation.startswith("assessment"):
        if mutation == "assessment-rejected":
            fixture["assessment"]["accepted"] = False
        else:
            fixture["assessment"]["blocking_reasons"] = ["BLOCKED"]
        fixture["assessment"] = _signed(fixture["assessment"], "assessment_sha256")
        _write(fixture["assessment_path"], fixture["assessment"])
        refresh_ref(fixture, "gold_assessment", fixture["assessment_path"])
    elif mutation.startswith("finalization"):
        if mutation == "finalization-rejected":
            fixture["finalization"]["status"] = "FAILED_CLOSED"
        elif mutation == "finalization-stale":
            fixture["finalization"]["completed_at"] = (
                NOW - timedelta(days=91)
            ).isoformat()
        else:
            fixture["finalization"]["completed_at"] = (
                NOW + timedelta(hours=1)
            ).isoformat()
        fixture["finalization"] = _signed(fixture["finalization"], "report_sha256")
        _write(fixture["finalization_path"], fixture["finalization"])
        refresh_ref(fixture, "finalization_report", fixture["finalization_path"])
    elif mutation == "artifact-digest":
        fixture["index"]["finalization_run"]["artifact_digest"] = "mutable"
        _write(fixture["index_path"], fixture["index"])
    elif mutation == "artifact-name":
        fixture["index"]["finalization_run"]["artifact_name"] = "wrong"
        _write(fixture["index_path"], fixture["index"])
    elif mutation == "root-alias":
        roots = fixture["index"]["planned_roots"]
        roots[0]["restored_root"] = roots[0]["original_root"]
        _write(fixture["index_path"], fixture["index"])
    elif mutation == "root-traversal":
        fixture["index"]["planned_roots"][0][
            "original_root"
        ] = "/srv/tai-models/benchmark-runs/../escape"
        _write(fixture["index_path"], fixture["index"])
    elif mutation == "root-missing":
        fixture["index"]["planned_roots"].pop()
        _write(fixture["index_path"], fixture["index"])
    elif mutation == "model-duplicate":
        fixture["index"]["models"][1]["model_key"] = fixture["index"]["models"][0][
            "model_key"
        ]
        _write(fixture["index_path"], fixture["index"])
    elif mutation == "model-missing":
        fixture["index"]["models"].pop()
        _write(fixture["index_path"], fixture["index"])
    elif mutation == "unknown-index-field":
        fixture["index"]["unknown"] = True
        _write(fixture["index_path"], fixture["index"])
    elif mutation == "oversized-ref":
        fixture["index"]["readiness"]["size_bytes"] = 10_000_001
        _write(fixture["index_path"], fixture["index"])
    elif mutation == "drifted-ref":
        fixture["readiness_path"].write_text("{}\n", encoding="utf-8")
    else:
        fixture["index"]["readiness"]["path"] = "../readiness.json"
        _write(fixture["index_path"], fixture["index"])
    with pytest.raises(run_plan.RunPlanError, match=match):
        _compile(fixture)


def test_duplicate_keys_and_symlink_inputs_fail_closed(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    fixture["index_path"].write_text(
        '{"schema_version":"x","schema_version":"y"}\n', encoding="utf-8"
    )
    with pytest.raises(run_plan.RunPlanError, match="duplicate JSON key"):
        _compile(fixture)

    fixture = build_fixture(tmp_path / "symlink")
    link = fixture["root"] / "readiness-link.json"
    link.symlink_to(fixture["readiness_path"])
    fixture["index"]["readiness"] = {
        "path": "readiness-link.json",
        "sha256": hashlib.sha256(link.read_bytes()).hexdigest(),
        "size_bytes": link.stat().st_size,
    }
    _write(fixture["index_path"], fixture["index"])
    with pytest.raises(run_plan.RunPlanError, match="symlink"):
        _compile(fixture)


@pytest.mark.parametrize(
    ("mutation", "match"),
    [
        ("legal-review", "legal review"),
        ("toolchain-identity", "toolchain package identity"),
        ("binary-missing", "binary coverage"),
        ("q4-missing", "Q4_K_M artifact is absent"),
        ("q4-path", "Q4_K_M artifact binding"),
        ("storage-object", "object record differs"),
        ("locator", "immutable object locator"),
        ("retention", "retention does not cover"),
        ("report-rejected", "verification report is not accepted"),
        ("finalization-archive", "finalization summary"),
    ],
)
def test_model_evidence_tampering_is_rejected(
    tmp_path: Path, mutation: str, match: str
) -> None:
    fixture = build_fixture(tmp_path)
    key = "qwen3-8b"
    model = fixture["models"][key]
    manifest = model["manifest"]
    record = model["object_record"]
    report = model["report"]
    if mutation == "legal-review":
        manifest["legal_review"]["decision"] = "REJECTED"
    elif mutation == "toolchain-identity":
        manifest["toolchain_package"]["release"] = "other"
    elif mutation == "binary-missing":
        manifest["toolchain_package"]["binaries"].pop()
    elif mutation == "q4-missing":
        manifest["quantizations"] = []
    elif mutation == "q4-path":
        manifest["quantizations"][0]["output"]["path"] = "artifacts/other.gguf"
    elif mutation == "storage-object":
        record["version_id"] = "other-version"
        _write(model["object_path"], record)
    elif mutation == "locator":
        bad = (
            "s3+version://s3.storage.selcloud.ru/tai-model-bundles/"
            f"{record['key']}?versionId={quote(record['version_id'], safe='')}"
            f"#sha256={'f' * 64}"
        )
        record["immutable_locator"] = bad
        manifest["storage"]["immutable_locator"] = bad
        _write(model["object_path"], record)
    elif mutation == "retention":
        expires = (NOW + timedelta(minutes=30)).isoformat()
        record["retention_expires_at"] = expires
        manifest["storage"]["retention_expires_at"] = expires
        _write(model["object_path"], record)
    elif mutation == "report-rejected":
        report["status"] = "REJECTED"
        report["reasons"] = ["FAIL"]
        model["report"] = _signed(report, "report_sha256")
        _write(model["report_path"], model["report"])
    else:
        item = next(
            entry for entry in fixture["finalization"]["models"] if entry["key"] == key
        )
        item["archive_sha256"] = "f" * 64
        fixture["finalization"] = _signed(fixture["finalization"], "report_sha256")
        _write(fixture["finalization_path"], fixture["finalization"])
        refresh_ref(fixture, "finalization_report", fixture["finalization_path"])

    if mutation not in {"storage-object", "report-rejected", "finalization-archive"}:
        _write(model["manifest_path"], manifest)
    refresh_model_refs(fixture, key)
    with pytest.raises(run_plan.RunPlanError, match=match):
        _compile(fixture)


def test_cross_model_toolchain_and_immutable_aliases_are_rejected(
    tmp_path: Path,
) -> None:
    fixture = build_fixture(tmp_path)
    qwen = fixture["models"]["qwen3-8b"]
    qwen["manifest"]["toolchain_package"]["binaries"][0]["file"][
        "sha256"
    ] = hashlib.sha256(b"different-cli").hexdigest()
    _write(qwen["manifest_path"], qwen["manifest"])
    sync_model_report_and_finalization(fixture, "qwen3-8b")
    with pytest.raises(run_plan.RunPlanError, match="differ across"):
        _compile(fixture)

    fixture = build_fixture(tmp_path / "alias")
    qwen = fixture["models"]["qwen3-8b"]
    mistral = fixture["models"]["mistral-7b-instruct-v0.3"]
    for field in (
        "archive_sha256",
        "archive_size_bytes",
        "immutable_locator",
        "version_id",
    ):
        mistral["object_record"][field] = qwen["object_record"][field]
    mistral["manifest"]["storage"]["archive"]["sha256"] = qwen["archive_sha256"]
    mistral["manifest"]["storage"]["archive"]["size_bytes"] = qwen[
        "archive_size_bytes"
    ]
    mistral["manifest"]["storage"]["immutable_locator"] = qwen["immutable_locator"]
    for field in ("endpoint_host", "region", "bucket", "key", "version_id", "etag"):
        mistral["manifest"]["storage"]["object"][field] = qwen["object_record"][field]
    _write(mistral["manifest_path"], mistral["manifest"])
    _write(mistral["object_path"], mistral["object_record"])
    mistral["report"]["archive_sha256"] = qwen["archive_sha256"]
    mistral["report"]["archive_size_bytes"] = qwen["archive_size_bytes"]
    sync_model_report_and_finalization(fixture, "mistral-7b-instruct-v0.3")
    finalization_model = next(
        item
        for item in fixture["finalization"]["models"]
        if item["key"] == "mistral-7b-instruct-v0.3"
    )
    finalization_model["archive_sha256"] = qwen["archive_sha256"]
    finalization_model["archive_size_bytes"] = qwen["archive_size_bytes"]
    finalization_model["immutable_locator"] = qwen["immutable_locator"]
    finalization_model["version_id"] = qwen["version_id"]
    fixture["finalization"] = _signed(fixture["finalization"], "report_sha256")
    _write(fixture["finalization_path"], fixture["finalization"])
    refresh_ref(fixture, "finalization_report", fixture["finalization_path"])
    refresh_model_refs(fixture, "mistral-7b-instruct-v0.3")
    with pytest.raises(run_plan.RunPlanError, match="aliases"):
        _compile(fixture)


def test_low_level_path_and_locator_contracts(tmp_path: Path) -> None:
    with pytest.raises(run_plan.RunPlanError, match="bounded relative"):
        run_plan._relative("/absolute", "path")
    with pytest.raises(run_plan.RunPlanError, match="outside"):
        run_plan._planned_root(
            str(tmp_path / "root"), "root", "/srv/tai-models/benchmark-runs"
        )
    record = {
        "endpoint_host": "host",
        "bucket": "bucket",
        "key": "prefix/object.tar",
        "version_id": "version",
        "archive_sha256": "a" * 64,
    }
    with pytest.raises(run_plan.RunPlanError, match="exact immutable"):
        run_plan._locator("https://host/object", record, "locator")
    path = tmp_path / "value.txt"
    path.write_text("value", encoding="utf-8")
    assert len(run_plan._git_blob_sha1(path)) == 40
