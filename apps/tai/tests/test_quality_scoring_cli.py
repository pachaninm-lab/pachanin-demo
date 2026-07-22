from __future__ import annotations

import copy
import hashlib
import json
import sys
from pathlib import Path

import pytest
from quality_scoring_fixtures import _fixture

from tai import quality_scoring as scoring
from tai import quality_scoring_cli as cli
from tai import quality_scoring_inputs as inputs
from tai.quality_scoring_contract import (
    EXPECTED_MATURITY,
    QualityScoringError,
    canonical_sha256,
    expected_authority,
    write_json,
)


def _pending(path: Path) -> None:
    value: dict[str, object] = {
        "schema_version": "tai.quality-scoring-evidence.v1",
        "lifecycle": "PENDING_HUMAN_SCORING",
        "pending_reason": "Human evidence is absent.",
        "exact_main": None,
        "authority_sha256": None,
        "runtime_report_sha256": None,
        "observation_index_sha256": None,
        "annotations": [],
        "storage": None,
        "scored_at": None,
        "quality_scoring_status": "PENDING_QUALITY_SCORING",
        **EXPECTED_MATURITY,
    }
    value["manifest_sha256"] = canonical_sha256(value)
    write_json(path, value)


def _resign(value: dict[str, object], field: str) -> dict[str, object]:
    output = copy.deepcopy(value)
    output.pop(field, None)
    output[field] = canonical_sha256(output)
    return output


def test_validate_authority_and_pending_manifest(
    monkeypatch, capsys, tmp_path: Path
) -> None:
    authority = tmp_path / "authority.json"
    pending = tmp_path / "pending.json"
    output = tmp_path / "output.json"
    write_json(authority, expected_authority())
    _pending(pending)
    monkeypatch.setattr(
        sys,
        "argv",
        ["quality", "validate-authority", str(authority), "--output", str(output)],
    )
    assert cli.main() == 0
    value = json.loads(output.read_text(encoding="utf-8"))
    assert value["status"] == "VALID"
    assert value["required_observations"] == 348
    assert value["runtime_reverification_required"] is True
    assert value["accepted_assessment_required"] is True
    assert json.loads(capsys.readouterr().out) == value
    monkeypatch.setattr(sys, "argv", ["quality", "validate-manifest", str(pending)])
    assert cli.main() == 2
    value = json.loads(capsys.readouterr().out)
    assert value["status"] == "PENDING_HUMAN_SCORING"
    assert value["production_operational_status"] == "NOT_ATTESTED"


def test_verify_and_contract_error_paths(monkeypatch, capsys, tmp_path: Path) -> None:
    accepted = {
        "schema_version": "tai.quality-scoring-verification.v1",
        "status": "QUALITY_SCORING_VERIFIED_PENDING_BENCHMARK_FINALIZATION",
        "accepted": True,
    }
    monkeypatch.setattr(
        cli.scoring, "verify_quality_scoring", lambda *args, **kwargs: accepted
    )
    paths = [
        str(tmp_path / name)
        for name in ("a", "ra", "rr", "rm", "ro", "rs", "aa", "c", "s")
    ]
    monkeypatch.setattr(
        sys,
        "argv",
        ["quality", "verify", *paths, "--evaluated-at", "2026-07-21T18:00:00Z"],
    )
    assert cli.main() == 0
    assert json.loads(capsys.readouterr().out) == accepted
    invalid = tmp_path / "invalid.json"
    invalid.write_text("{}\n", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["quality", "validate-manifest", str(invalid)])
    assert cli.main() == 2
    value = json.loads(capsys.readouterr().out)
    assert value["status"] == "REJECTED"
    assert value["quality_scoring_status"] == "PENDING_QUALITY_SCORING"
    assert value["model_admission_status"] == "PENDING_ADMISSION"


def test_safe_external_file_rejects_unsafe_absent_and_symlink_paths(
    tmp_path: Path,
) -> None:
    root = tmp_path / "root"
    root.mkdir()
    with pytest.raises(QualityScoringError, match="unsafe"):
        inputs._safe_external_file(root, "../escape.json")
    with pytest.raises(QualityScoringError, match="absent"):
        inputs._safe_external_file(root, "missing.json")
    target = tmp_path / "target.json"
    target.write_text("{}\n", encoding="utf-8")
    (root / "link.json").symlink_to(target)
    with pytest.raises(QualityScoringError, match="symlink"):
        inputs._safe_external_file(root, "link.json")


def test_runtime_report_fail_closed_matrix(monkeypatch, tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    authority = fixture["authority"]
    base = fixture["runtime"]
    runtime_path = tmp_path / "runtime-matrix.json"

    def check(mutator, message: str, *, authority_digest: str | None = None) -> None:
        report = copy.deepcopy(base)
        mutator(report)
        report = _resign(report, "report_sha256")
        write_json(runtime_path, report)
        monkeypatch.setattr(inputs, "verify_runtime_evidence", lambda *args: report)
        digest = authority_digest or str(report["authority_sha256"])
        monkeypatch.setattr(
            inputs,
            "load_runtime_authority",
            lambda path: {"authority_sha256": digest},
        )
        with pytest.raises(QualityScoringError, match=message):
            inputs.runtime_report(
                runtime_path,
                authority,
                fixture["runtime_authority_path"],
                fixture["runtime_manifest_path"],
                fixture["original_root"],
                fixture["restored_root"],
            )

    check(lambda row: row.__setitem__("schema_version", "wrong"), "schema mismatch")
    check(lambda row: row.__setitem__("runtime_profiles", {}), "profile verification")
    check(lambda row: row.__setitem__("raw_observation_count", 347), "count mismatch")
    check(
        lambda row: row.__setitem__("quality_scoring_status", "COMPLETE"),
        "quality status",
    )
    check(
        lambda row: row.__setitem__("benchmark_status", "COMPLETE"),
        "maturity boundary",
    )
    check(lambda row: None, "authority digest", authority_digest="f" * 64)
    check(
        lambda row: (
            row.__setitem__("status", "REJECTED"),
            row.__setitem__("reasons", ["x"]),
        ),
        "not verified",
    )


def test_accepted_assessment_fail_closed_matrix(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    authority = fixture["authority"]
    base = fixture["assessment"]
    path = tmp_path / "assessment-matrix.json"
    mutations = [
        (lambda row: row.__setitem__("schema_version", "wrong"), "schema mismatch"),
        (
            lambda row: row["counts"].__setitem__("reviewed_cases", 57),
            "coverage mismatch",
        ),
        (
            lambda row: row["quality_targets"].__setitem__(
                "platform_accuracy_minimum", 0.1
            ),
            "quality targets mismatch",
        ),
        (
            lambda row: row.__setitem__("blocking_reasons", ["blocked"]),
            "blocking reasons",
        ),
        (
            lambda row: row.__setitem__("missing_review_case_ids", ["case-01"]),
            "missing review",
        ),
    ]
    for mutator, message in mutations:
        value = copy.deepcopy(base)
        mutator(value)
        value = _resign(value, "assessment_sha256")
        write_json(path, value)
        with pytest.raises(QualityScoringError, match=message):
            inputs.accepted_assessment(path, authority)


def test_case_manifest_fail_closed_matrix(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    authority = fixture["authority"]
    assessment = fixture["assessment"]
    base = json.loads(fixture["cases_path"].read_text(encoding="utf-8"))
    path = tmp_path / "case-matrix.json"
    mutations = [
        (lambda row: row.__setitem__("schema_version", "wrong"), "schema mismatch"),
        (lambda row: row.__setitem__("version", "wrong"), "version mismatch"),
        (
            lambda row: row.__setitem__("assessment_sha256", "f" * 64),
            "assessment digest mismatch",
        ),
        (lambda row: row["cases"].pop(), "count mismatch"),
        (
            lambda row: row["cases"][1].__setitem__(
                "case_id", row["cases"][0]["case_id"]
            ),
            "duplicate case_id",
        ),
        (
            lambda row: row["cases"][0].__setitem__("domain", "UNKNOWN"),
            "domain is invalid",
        ),
        (
            lambda row: row["cases"][0].__setitem__("criticality", "UNKNOWN"),
            "criticality is invalid",
        ),
        (
            lambda row: row["cases"][0].__setitem__("domain", "AGRO"),
            "domain counts mismatch",
        ),
        (
            lambda row: row["cases"][0].__setitem__("criticality", "HIGH"),
            "critical case count mismatch",
        ),
    ]
    for mutator, message in mutations:
        value = copy.deepcopy(base)
        mutator(value)
        value = _resign(value, "manifest_sha256")
        write_json(path, value)
        with pytest.raises(QualityScoringError, match=message):
            inputs.case_manifest(path, authority, assessment)


def test_verified_runtime_source_fail_closed_matrix(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    base_manifest = json.loads(
        fixture["runtime_manifest_path"].read_text(encoding="utf-8")
    )
    runtime = fixture["runtime"]
    path = tmp_path / "runtime-source.json"
    mutations = [
        (
            lambda row: row.__setitem__("lifecycle", "PENDING_RUNTIME_EXECUTION"),
            "not complete",
        ),
        (lambda row: row.__setitem__("exact_main", "b" * 40), "exact-main mismatch"),
        (
            lambda row: row["corpus"].__setitem__("assessment_sha256", "f" * 64),
            "not bound to accepted",
        ),
        (
            lambda row: row["raw_observations"].__setitem__(
                "payload_path", "raw-observations/other.json"
            ),
            "locator mismatch",
        ),
    ]
    for mutator, message in mutations:
        value = copy.deepcopy(base_manifest)
        mutator(value)
        write_json(path, value)
        altered_runtime = {**runtime, "manifest_sha256": canonical_sha256(value)}
        with pytest.raises(QualityScoringError, match=message):
            inputs._verified_runtime_source(
                path,
                fixture["original_root"],
                altered_runtime,
                fixture["assessment"],
            )
    with pytest.raises(QualityScoringError, match="manifest digest mismatch"):
        inputs._verified_runtime_source(
            fixture["runtime_manifest_path"],
            fixture["original_root"],
            {**runtime, "manifest_sha256": "f" * 64},
            fixture["assessment"],
        )


def test_observation_index_fail_closed_matrix(monkeypatch, tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    case_map, _ = inputs.case_manifest(
        fixture["cases_path"],
        fixture["authority"],
        fixture["assessment"],
    )
    raw_manifest_base = json.loads(
        (fixture["original_root"] / "raw-observations/manifest.json").read_text(
            encoding="utf-8"
        )
    )
    raw_payload_base = json.loads(
        (fixture["original_root"] / "raw-observations/payload.json").read_text(
            encoding="utf-8"
        )
    )
    raw_manifest_path = tmp_path / "raw-manifest.json"
    raw_payload_path = tmp_path / "raw-payload.json"

    def execute(manifest: dict[str, object], payload: dict[str, object]) -> None:
        write_json(raw_manifest_path, manifest)
        write_json(raw_payload_path, payload)
        monkeypatch.setattr(
            inputs,
            "_verified_runtime_source",
            lambda *args: (
                {},
                raw_manifest_path,
                raw_payload_path,
                hashlib.sha256(raw_manifest_path.read_bytes()).hexdigest(),
                hashlib.sha256(raw_payload_path.read_bytes()).hexdigest(),
            ),
        )
        inputs.observation_index(
            fixture["runtime_manifest_path"],
            fixture["original_root"],
            fixture["runtime"],
            fixture["assessment"],
            case_map,
        )

    mutations = [
        (
            lambda manifest, payload: manifest.__setitem__("schema_version", "wrong"),
            "manifest schema mismatch",
        ),
        (
            lambda manifest, payload: manifest.__setitem__("suite_id", "wrong"),
            "suite mismatch",
        ),
        (
            lambda manifest, payload: manifest.__setitem__(
                "profile_ids", list(reversed(manifest["profile_ids"]))
            ),
            "profile order mismatch",
        ),
        (
            lambda manifest, payload: payload.__setitem__("schema_version", "wrong"),
            "payload schema mismatch",
        ),
        (
            lambda manifest, payload: payload.__setitem__("suite_id", "wrong"),
            "payload suite mismatch",
        ),
        (
            lambda manifest, payload: payload["entries"].pop(),
            "count mismatch",
        ),
        (
            lambda manifest, payload: payload["entries"][1].update(
                payload["entries"][0]
            ),
            "contains a duplicate",
        ),
        (
            lambda manifest, payload: payload["entries"][0].__setitem__(
                "request_id", "other-request"
            ),
            "metadata differs",
        ),
        (
            lambda manifest, payload: payload["entries"][0].__setitem__(
                "prompt", "altered prompt"
            ),
            "prompt digest mismatch",
        ),
        (
            lambda manifest, payload: payload["entries"][0].__setitem__(
                "response", "altered response"
            ),
            "response digest mismatch",
        ),
        (
            lambda manifest, payload: (
                manifest["entries"][0].__setitem__("status", "ERROR"),
                payload["entries"][0].__setitem__("status", "ERROR"),
            ),
            "not scoreable",
        ),
    ]
    for mutator, message in mutations:
        manifest = copy.deepcopy(raw_manifest_base)
        payload = copy.deepcopy(raw_payload_base)
        mutator(manifest, payload)
        with pytest.raises(QualityScoringError, match=message):
            execute(manifest, payload)


def test_quality_storage_fail_closed_matrix(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    base = fixture["manifest"]["storage"]
    mutations = [
        (lambda row: row.__setitem__("provider", "OTHER"), "provider mismatch"),
        (
            lambda row: row.__setitem__("immutability_status", "MUTABLE"),
            "not immutable",
        ),
        (lambda row: row.__setitem__("retention_days", 1), "retention"),
        (
            lambda row: row.__setitem__(
                "restored_root_id", row["original_root_id"]
            ),
            "not independent",
        ),
        (
            lambda row: row.__setitem__("annotations_sha256", "f" * 64),
            "annotation payload digest",
        ),
    ]
    for mutator, message in mutations:
        storage = copy.deepcopy(base)
        mutator(storage)
        with pytest.raises(QualityScoringError, match=message):
            scoring._storage(
                storage,
                fixture["authority"],
                fixture["manifest"]["annotations"],
            )
