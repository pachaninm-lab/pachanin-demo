from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from tai.model_bundle_v2 import authority_sha256_v2, load_model_bundle_authority_v2

TAI_ROOT = Path(__file__).parents[1]
ACCEPTANCE_PATH = (
    TAI_ROOT
    / "model-artifacts"
    / "model-source-acquisition-acceptance.v1.json"
)
AUTHORITY_PATH = TAI_ROOT / "model-artifacts" / "model-bundle-authority.v2.json"
SCOPE_PATH = (
    TAI_ROOT
    / "governance"
    / "scopes"
    / "ap-13b3-source-acquisition-acceptance-2835.json"
)

EXPECTED_PATHS = {
    "apps/tai/governance/scopes/ap-13b3-source-acquisition-acceptance-2835.json",
    "apps/tai/model-artifacts/model-source-acquisition-acceptance.v1.json",
    "apps/tai/tests/test_model_source_acquisition_acceptance.py",
}
EXPECTED_MAIN = "4a7b04731aa204b741691a334d7adfe7785d6463"
EXPECTED_AUTHORITY = (
    "3391ea2ba4ddd855b45c5f389f12ffe3ddffb7cc4f46a4048d7357ffcdda6022"
)
SHA256 = re.compile(r"^[0-9a-f]{64}$")
REVISION = re.compile(r"^[0-9a-f]{40}$")

EXPECTED_MODELS = {
    "PRIMARY": {
        "model_id": "Qwen/Qwen3-8B",
        "revision": "895c8d171bc03c30e113cd7a28c02494b5e068b7",
        "selected_source_bytes": 16_397_448_266,
        "selected_source_files": 13,
        "source_files_sha256": (
            "d3ef5d7334761a40cf857c247d2e2e2af383cd7c3c1e7c180414d07a15f9f2d4"
        ),
        "metadata_artifact_id": 8_458_597_272,
        "metadata_artifact_digest": (
            "3aa3c6edcd3abd972a53ef9eb078e3d16ac56bf9239ae823c794ac9a64e642e1"
        ),
        "locator_artifact_id": 8_458_597_677,
        "locator_artifact_digest": (
            "5f033bb16ad7a3f0795cc0a10900221fe2dede27fac4e3ecbf2d4605fad5371c"
        ),
    },
    "FALLBACK": {
        "model_id": "mistralai/Mistral-7B-Instruct-v0.3",
        "revision": "c170c708c41dac9275d15a8fff4eca08d52bab71",
        "selected_source_bytes": 14_499_391_334,
        "selected_source_files": 13,
        "source_files_sha256": (
            "377ffe04a6583e425ca78709afd065989bc6055dd12fcdc904837edffba3cc9e"
        ),
        "metadata_artifact_id": 8_458_566_162,
        "metadata_artifact_digest": (
            "5242ea40bb07234744096095712588431a684cb898bd6e6b10a3c948fad872ea"
        ),
        "locator_artifact_id": 8_458_566_536,
        "locator_artifact_digest": (
            "93a19fbc619a8238ef9ee556ea569179d96389ecad57cad660b40a4ec39b8cae"
        ),
    },
}


def _load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def test_acceptance_scope_is_exact_and_does_not_expand_model_maturity() -> None:
    scope = _load(SCOPE_PATH)

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b3-source-acquisition-acceptance"
    assert scope["status"] == "active"
    assert scope["parent_issue"] == 2726
    assert scope["issue"] == 2835
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert "automated legal approval or rejection" in scope[
        "forbidden_capabilities"
    ]
    assert "benchmark or model admission claim" in scope[
        "forbidden_capabilities"
    ]
    assert "production readiness or operational attestation claim" in scope[
        "forbidden_capabilities"
    ]


def test_acceptance_is_bound_to_exact_main_and_current_v2_authority() -> None:
    acceptance = _load(ACCEPTANCE_PATH)
    authority = load_model_bundle_authority_v2(AUTHORITY_PATH)

    assert acceptance["schema_version"] == (
        "tai.model-source-acquisition-acceptance.v1"
    )
    assert acceptance["status"] == "VERIFIED_SOURCE_RESTORED_LEGAL_PENDING"
    assert acceptance["issue"] == 2835
    assert acceptance["parent_issue"] == 2726
    assert acceptance["exact_main_sha"] == EXPECTED_MAIN
    assert REVISION.fullmatch(acceptance["exact_main_sha"]) is not None
    assert acceptance["authority_sha256"] == EXPECTED_AUTHORITY
    assert authority_sha256_v2(authority) == EXPECTED_AUTHORITY


def test_exact_main_release_acceptance_is_positive_but_not_operational() -> None:
    release = _load(ACCEPTANCE_PATH)["release_acceptance"]
    artifact = release["artifact"]
    attestation = release["attestation"]

    assert release["workflow_name"] == "TAI Release Acceptance"
    assert release["workflow_path"] == ".github/workflows/tai-release-acceptance.yml"
    assert release["run_id"] == 29_736_286_811
    assert release["run_attempt"] == 1
    assert release["conclusion"] == "success"
    assert artifact == {
        "digest": (
            "a70e38fe04a4d4a9d6514c71fc6286043c64e6b5091440799a6f6df94cacb89c"
        ),
        "expires_at": "2026-10-18T10:47:49Z",
        "id": 8_458_569_949,
    }
    assert attestation["accepted"] is True
    assert attestation["reasons"] == []
    assert SHA256.fullmatch(attestation["attestation_sha256"]) is not None
    assert attestation["production_operational_status"] == "NOT_ATTESTED"


def test_source_acquisition_run_is_owner_triggered_and_exact_main_bound() -> None:
    acquisition = _load(ACCEPTANCE_PATH)["source_acquisition"]

    assert acquisition == {
        "actor": "pachaninm-lab",
        "conclusion": "success",
        "event": "issue_comment",
        "head_branch": "main",
        "run_attempt": 1,
        "run_id": 29_736_320_896,
        "workflow_name": "TAI Exact Model Source Acquisition",
        "workflow_path": ".github/workflows/tai-model-source-acquisition.yml",
    }


def test_both_exact_model_sources_are_hash_and_restore_verified() -> None:
    acceptance = _load(ACCEPTANCE_PATH)
    models = acceptance["models"]

    assert len(models) == 2
    assert {item["role"] for item in models} == set(EXPECTED_MODELS)
    assert {item["model_id"] for item in models} == {
        value["model_id"] for value in EXPECTED_MODELS.values()
    }

    for model in models:
        expected = EXPECTED_MODELS[model["role"]]
        assert model["model_id"] == expected["model_id"]
        assert model["revision"] == expected["revision"]
        assert REVISION.fullmatch(model["revision"]) is not None
        assert model["status"] == "VERIFIED_SOURCE_RESTORED_LEGAL_PENDING"
        assert model["selected_source_bytes"] == expected["selected_source_bytes"]
        assert model["selected_source_files"] == expected["selected_source_files"]
        assert model["source_files_sha256"] == expected["source_files_sha256"]
        assert model["reasons"] == []

        for key in (
            "source_files_sha256",
            "remote_inventory_sha256",
            "source_manifest_sha256",
            "legal_packet_sha256",
            "restore_report_sha256",
            "acquisition_report_sha256",
            "acquisition_report_file_sha256",
        ):
            assert SHA256.fullmatch(model[key]) is not None

        metadata = model["metadata_artifact"]
        locator = model["locator_artifact"]
        assert metadata["id"] == expected["metadata_artifact_id"]
        assert metadata["digest"] == expected["metadata_artifact_digest"]
        assert locator["id"] == expected["locator_artifact_id"]
        assert locator["digest"] == expected["locator_artifact_digest"]
        assert metadata["retention_days"] == locator["retention_days"] == 90
        assert metadata["expires_at"] == locator["expires_at"]
        assert metadata["size_bytes"] < 100_000
        assert locator["size_bytes"] < 10_000

        storage = model["source_bytes_storage"]
        assert storage == {
            "clean_redownload_reverified": True,
            "copied_to_git_or_actions_artifact": False,
            "locally_hashed": True,
            "type": "UPSTREAM_EXACT_REVISION_RESTORABLE",
        }
        assert model["legal_review_status"] == "PENDING_HUMAN_DECISION"
        assert model["conversion_status"] == "NOT_RUN"
        assert model["quantization_status"] == "NOT_RUN"
        assert model["model_admission_status"] == "NOT_DONE"


def test_acceptance_contains_no_model_payload_or_false_maturity_claim() -> None:
    acceptance = _load(ACCEPTANCE_PATH)
    rendered = ACCEPTANCE_PATH.read_text(encoding="utf-8")
    boundary = acceptance["maturity_boundary"]

    assert ACCEPTANCE_PATH.stat().st_size < 10_000
    assert ".safetensors" not in rendered
    assert ".gguf" not in rendered
    assert "tokenizer.json" not in rendered
    assert "APPROVED" not in rendered
    assert "ADMITTED" not in rendered
    assert boundary == {
        "benchmarks": "NOT_RUN",
        "conversion": "NOT_RUN",
        "legal_review": "PENDING_HUMAN_DECISION",
        "model_admission": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
        "quantization": "NOT_RUN",
    }
