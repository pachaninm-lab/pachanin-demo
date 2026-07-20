from __future__ import annotations

import json
from pathlib import Path
from typing import Any

TAI_ROOT = Path(__file__).parents[1]
ARTIFACTS = TAI_ROOT / "model-artifacts"
SCOPE_PATH = (
    TAI_ROOT
    / "governance"
    / "scopes"
    / "ap-13b3-source-acquisition-acceptance-2835.json"
)
ACCEPTANCE_PATH = ARTIFACTS / "model-source-acquisition-acceptance.v1.json"
QWEN_LOCATOR_PATH = (
    ARTIFACTS / "qwen3-8b-source-acquisition-locator.accepted.v1.json"
)
MISTRAL_LOCATOR_PATH = (
    ARTIFACTS
    / "mistral-7b-instruct-v0.3-source-acquisition-locator.accepted.v1.json"
)

EXPECTED_PATHS = {
    "apps/tai/governance/scopes/ap-13b3-source-acquisition-acceptance-2835.json",
    "apps/tai/model-artifacts/mistral-7b-instruct-v0.3-source-acquisition-locator.accepted.v1.json",
    "apps/tai/model-artifacts/model-source-acquisition-acceptance.v1.json",
    "apps/tai/model-artifacts/qwen3-8b-source-acquisition-locator.accepted.v1.json",
    "apps/tai/tests/test_model_source_acquisition_acceptance.py",
}


def _load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def test_acceptance_is_bound_to_real_exact_main_execution() -> None:
    acceptance = _load(ACCEPTANCE_PATH)

    assert acceptance["schema_version"] == "tai.model-source-acquisition-acceptance.v1"
    assert acceptance["status"] == "VERIFIED_SOURCE_RESTORED_LEGAL_PENDING"
    assert acceptance["accepted_scope"] == "SOURCE_ACQUISITION_ONLY"
    assert acceptance["repository_sha"] == (
        "4a7b04731aa204b741691a334d7adfe7785d6463"
    )
    assert acceptance["authority_sha256"] == (
        "3391ea2ba4ddd855b45c5f389f12ffe3ddffb7cc4f46a4048d7357ffcdda6022"
    )
    assert acceptance["workflow"] == {
        "conclusion": "success",
        "name": "TAI Exact Model Source Acquisition",
        "run_attempt": "1",
        "run_id": "29736320896",
    }
    release = acceptance["exact_main_release_acceptance"]
    assert release["run_id"] == "29736286811"
    assert release["artifact_id"] == "8458569949"
    assert release["accepted"] is True
    assert release["production_operational_status"] == "NOT_ATTESTED"
    assert acceptance["reasons"] == []


def test_both_exact_models_are_locally_hashed_and_cleanly_restored() -> None:
    acceptance = _load(ACCEPTANCE_PATH)
    models = {model["role"]: model for model in acceptance["models"]}

    assert set(models) == {"PRIMARY", "FALLBACK"}
    qwen = models["PRIMARY"]
    mistral = models["FALLBACK"]

    assert qwen["model_id"] == "Qwen/Qwen3-8B"
    assert qwen["revision"] == "895c8d171bc03c30e113cd7a28c02494b5e068b7"
    assert qwen["selected_source_files"] == 13
    assert qwen["selected_source_bytes"] == 16397448266
    assert qwen["source_files_sha256"] == (
        "d3ef5d7334761a40cf857c247d2e2e2af383cd7c3c1e7c180414d07a15f9f2d4"
    )

    assert mistral["model_id"] == "mistralai/Mistral-7B-Instruct-v0.3"
    assert mistral["revision"] == "c170c708c41dac9275d15a8fff4eca08d52bab71"
    assert mistral["selected_source_files"] == 13
    assert mistral["selected_source_bytes"] == 14499391334
    assert mistral["source_files_sha256"] == (
        "377ffe04a6583e425ca78709afd065989bc6055dd12fcdc904837edffba3cc9e"
    )

    for model in models.values():
        assert model["status"] == "VERIFIED_SOURCE_RESTORED_LEGAL_PENDING"
        assert model["reasons"] == []
        assert model["source_bytes_storage"] == {
            "clean_redownload_reverified": True,
            "copied_to_git_or_actions_artifact": False,
            "locally_hashed": True,
            "type": "UPSTREAM_EXACT_REVISION_RESTORABLE",
        }
        assert model["metadata_artifact"]["retention_days"] == 90
        assert model["locator_artifact"]["retention_days"] == 90


def test_accepted_locators_match_combined_acceptance() -> None:
    acceptance = _load(ACCEPTANCE_PATH)
    accepted_models = {model["model_id"]: model for model in acceptance["models"]}

    for path in (QWEN_LOCATOR_PATH, MISTRAL_LOCATOR_PATH):
        locator = _load(path)
        model = accepted_models[locator["model_id"]]

        assert locator["schema_version"] == (
            "tai.model-source-acquisition-accepted-locator.v1"
        )
        assert locator["status"] == model["status"]
        assert locator["repository_sha"] == acceptance["repository_sha"]
        assert locator["workflow_run_id"] == acceptance["workflow"]["run_id"]
        assert locator["workflow_run_attempt"] == "1"
        assert locator["revision"] == model["revision"]
        assert locator["role"] == model["role"]
        assert locator["source_files_sha256"] == model["source_files_sha256"]
        assert locator["source_manifest_sha256"] == model["source_manifest_sha256"]
        assert locator["evidence_artifact"] == {
            **model["metadata_artifact"],
            "url": locator["evidence_artifact"]["url"],
        }
        assert locator["locator_artifact"] == model["locator_artifact"]
        assert locator["source_bytes_storage"] == model["source_bytes_storage"]
        assert locator["reasons"] == []


def test_acceptance_preserves_human_legal_and_model_maturity_boundaries() -> None:
    acceptance = _load(ACCEPTANCE_PATH)
    boundary = acceptance["maturity_boundary"]

    assert boundary == {
        "benchmarks": "NOT_DONE",
        "f16_bf16_conversion": "NOT_RUN",
        "human_legal_decisions": "PENDING_HUMAN_DECISION",
        "model_admission": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
        "q4_k_m_quantization": "NOT_RUN",
        "q8_0_quantization": "NOT_RUN",
    }
    for model in acceptance["models"]:
        assert model["legal_review_status"] == "PENDING_HUMAN_DECISION"
        assert model["conversion_status"] == "NOT_RUN"
        assert model["quantization_status"] == "NOT_RUN"
        assert model["model_admission_status"] == "NOT_DONE"


def test_governance_scope_is_exact_and_forbids_maturity_inflation() -> None:
    scope = _load(SCOPE_PATH)

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b3-source-evidence-acceptance"
    assert scope["status"] == "active"
    assert scope["issue"] == 2835
    assert scope["parent_issue"] == 2726
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert "automated APPROVED or REJECTED legal decision" in scope[
        "forbidden_capabilities"
    ]
    assert "benchmark or model admission claim" in scope["forbidden_capabilities"]
    assert "production readiness or operational attestation claim" in scope[
        "forbidden_capabilities"
    ]
