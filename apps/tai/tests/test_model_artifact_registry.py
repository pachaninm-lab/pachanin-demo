from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any, cast

import pytest

from tai.model_artifact_registry import (
    BundleVerificationStatus,
    CandidateRole,
    LicenseReviewStatus,
    load_artifact_bundle,
    load_candidate_registry,
    registry_to_canonical_json,
    verify_artifact_bundle,
)
from tai.model_artifact_registry_cli import main

REVISION = "a" * 40
FALLBACK_REVISION = "c" * 40
TOOLCHAIN_COMMIT = "b" * 40
Mutation = Callable[[dict[str, Any]], None]


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _recipe(
    runtime_class: str,
    quantization: str,
    output_path: str,
) -> dict[str, object]:
    return {
        "runtime_class": runtime_class,
        "format": "GGUF",
        "quantization": quantization,
        "toolchain_name": "ggml-org/llama.cpp",
        "toolchain_uri": "https://github.com/ggml-org/llama.cpp",
        "toolchain_release": "b9637",
        "toolchain_commit": TOOLCHAIN_COMMIT,
        "output_path": output_path,
    }


def _registry_payload(
    *,
    approved: bool = True,
    primary_weight_files: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "schema_version": "tai.model-candidate-registry.v1",
        "candidates": [
            {
                "role": "PRIMARY",
                "model_id": "owner/model-a",
                "revision": REVISION,
                "source_uri": ("https://models.example/owner/model-a/tree/" + REVISION),
                "model_card_uri": (
                    "https://models.example/owner/model-a/blob/" + REVISION + "/README.md"
                ),
                "license_spdx": "Apache-2.0",
                "license_review_status": "APPROVED" if approved else "PENDING",
                "license_text_path": ("licenses/model-a/LICENSE" if approved else None),
                "tokenizer_files": ["sources/model-a/tokenizer.json"],
                "weight_files": (
                    primary_weight_files
                    if primary_weight_files is not None
                    else ["sources/model-a/model.safetensors"]
                ),
                "quantization_recipes": [
                    _recipe("CPU", "Q4_K_M", "artifacts/model-a-q4-k-m.gguf"),
                    _recipe(
                        "GPU_SHARED",
                        "Q8_0",
                        "artifacts/model-a-q8-0.gguf",
                    ),
                ],
            },
            {
                "role": "FALLBACK",
                "model_id": "owner/model-b",
                "revision": FALLBACK_REVISION,
                "source_uri": ("https://models.example/owner/model-b/tree/" + FALLBACK_REVISION),
                "model_card_uri": (
                    "https://models.example/owner/model-b/blob/" + FALLBACK_REVISION + "/README.md"
                ),
                "license_spdx": "Apache-2.0",
                "license_review_status": "PENDING",
                "license_text_path": None,
                "tokenizer_files": ["sources/model-b/tokenizer.json"],
                "weight_files": ["sources/model-b/model.safetensors"],
                "quantization_recipes": [_recipe("CPU", "Q4_K_M", "artifacts/model-b-q4-k-m.gguf")],
            },
        ],
    }


def _primary(payload: dict[str, Any]) -> dict[str, Any]:
    candidates = cast(list[dict[str, Any]], payload["candidates"])
    return candidates[0]


def _prepare_bundle(tmp_path: Path) -> tuple[Path, Path, Path]:
    registry_path = tmp_path / "registry.json"
    _write_json(
        registry_path,
        _registry_payload(primary_weight_files=[]),
    )
    files = {
        "licenses/model-a/LICENSE": b"Apache License evidence\n",
        "sources/model-a/tokenizer.json": b'{"tokenizer":"pinned"}\n',
        "artifacts/model-a-q4-k-m.gguf": b"cpu-artifact",
        "artifacts/model-a-q8-0.gguf": b"gpu-artifact",
    }
    bundle_root = tmp_path / "bundle"
    for relative_path, content in files.items():
        target = bundle_root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)

    def declared(path: str) -> dict[str, object]:
        return {
            "path": path,
            "sha256": _sha256(files[path]),
            "size_bytes": len(files[path]),
        }

    bundle_path = tmp_path / "bundle.json"
    _write_json(
        bundle_path,
        {
            "schema_version": "tai.local-model-artifact-bundle.v1",
            "model_id": "owner/model-a",
            "revision": REVISION,
            "license_text": declared("licenses/model-a/LICENSE"),
            "tokenizers": [declared("sources/model-a/tokenizer.json")],
            "artifacts": [
                {
                    **declared("artifacts/model-a-q4-k-m.gguf"),
                    "runtime_class": "CPU",
                    "quantization": "Q4_K_M",
                    "toolchain_commit": TOOLCHAIN_COMMIT,
                },
                {
                    **declared("artifacts/model-a-q8-0.gguf"),
                    "runtime_class": "GPU_SHARED",
                    "quantization": "Q8_0",
                    "toolchain_commit": TOOLCHAIN_COMMIT,
                },
            ],
        },
    )
    return registry_path, bundle_path, bundle_root


def test_repository_registry_is_pinned_and_intentionally_pending() -> None:
    registry_path = Path(__file__).resolve().parents[1] / "model-artifacts" / "candidates.v1.json"
    registry = load_candidate_registry(registry_path)

    assert [item.role for item in registry.candidates] == [
        CandidateRole.PRIMARY,
        CandidateRole.FALLBACK,
    ]
    assert all(
        item.license_review_status is LicenseReviewStatus.PENDING for item in registry.candidates
    )
    assert all(item.revision in item.source_uri for item in registry.candidates)
    assert all(item.weight_files for item in registry.candidates)
    assert len(registry_to_canonical_json(registry)) > 100


def test_verified_bundle_requires_exact_files_and_recipes(tmp_path: Path) -> None:
    registry_path, bundle_path, bundle_root = _prepare_bundle(tmp_path)
    report = verify_artifact_bundle(
        registry=load_candidate_registry(registry_path),
        bundle=load_artifact_bundle(bundle_path),
        bundle_root=bundle_root,
    )

    assert report.status is BundleVerificationStatus.VERIFIED
    assert report.reasons == ()
    assert len(report.verified_files) == 4
    assert len(report.report_sha256) == 64


def test_v1_bundle_rejects_candidate_with_source_weights(
    tmp_path: Path,
) -> None:
    registry_path, bundle_path, bundle_root = _prepare_bundle(tmp_path)
    _write_json(registry_path, _registry_payload())
    report = verify_artifact_bundle(
        registry=load_candidate_registry(registry_path),
        bundle=load_artifact_bundle(bundle_path),
        bundle_root=bundle_root,
    )
    assert report.status is BundleVerificationStatus.REJECTED
    assert report.reasons == ("SOURCE_WEIGHT_EVIDENCE_UNSUPPORTED_BY_V1",)
    assert len(report.verified_files) == 4


def test_cli_returns_two_for_v1_candidate_with_source_weights(
    tmp_path: Path,
) -> None:
    registry_path, bundle_path, bundle_root = _prepare_bundle(tmp_path)
    _write_json(registry_path, _registry_payload())
    output = tmp_path / "report.json"
    result = main(
        [
            "verify-bundle",
            str(registry_path),
            str(bundle_path),
            str(bundle_root),
            "--output",
            str(output),
        ]
    )
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert result == 2
    assert payload["status"] == "REJECTED"
    assert payload["reasons"] == ["SOURCE_WEIGHT_EVIDENCE_UNSUPPORTED_BY_V1"]


def test_bundle_verification_fails_closed_on_digest_mismatch(tmp_path: Path) -> None:
    registry_path, bundle_path, bundle_root = _prepare_bundle(tmp_path)
    artifact = bundle_root / "artifacts/model-a-q4-k-m.gguf"
    artifact.write_bytes(b"tampered")
    report = verify_artifact_bundle(
        registry=load_candidate_registry(registry_path),
        bundle=load_artifact_bundle(bundle_path),
        bundle_root=bundle_root,
    )

    assert report.status is BundleVerificationStatus.REJECTED
    reason = "FILE_SIZE_MISMATCH:artifacts/model-a-q4-k-m.gguf"
    assert reason in report.reasons


def test_pending_license_and_missing_toolchain_commit_are_rejected(
    tmp_path: Path,
) -> None:
    registry_path, bundle_path, bundle_root = _prepare_bundle(tmp_path)
    payload = _registry_payload(approved=False)
    recipes = cast(list[dict[str, Any]], _primary(payload)["quantization_recipes"])
    for recipe in recipes:
        recipe["toolchain_commit"] = None
    _write_json(registry_path, payload)

    report = verify_artifact_bundle(
        registry=load_candidate_registry(registry_path),
        bundle=load_artifact_bundle(bundle_path),
        bundle_root=bundle_root,
    )

    assert report.status is BundleVerificationStatus.REJECTED
    assert "LICENSE_REVIEW_NOT_APPROVED" in report.reasons
    assert "TOOLCHAIN_FULL_COMMIT_MISSING" in report.reasons


def test_cli_returns_zero_only_for_verified_bundle(tmp_path: Path) -> None:
    registry_path, bundle_path, bundle_root = _prepare_bundle(tmp_path)
    output = tmp_path / "report.json"
    result = main(
        [
            "verify-bundle",
            str(registry_path),
            str(bundle_path),
            str(bundle_root),
            "--output",
            str(output),
        ]
    )

    assert result == 0
    assert json.loads(output.read_text(encoding="utf-8"))["status"] == "VERIFIED"


def test_cli_validates_registry_without_claiming_artifacts(tmp_path: Path) -> None:
    registry_path = Path(__file__).resolve().parents[1] / "model-artifacts" / "candidates.v1.json"
    output = tmp_path / "registry-report.json"
    result = main(
        [
            "validate-registry",
            str(registry_path),
            "--output",
            str(output),
        ]
    )
    payload = json.loads(output.read_text(encoding="utf-8"))

    assert result == 0
    assert payload["status"] == "VALID"
    assert payload["candidate_count"] == 2
    assert len(payload["registry_sha256"]) == 64


def _wrong_schema(payload: dict[str, Any]) -> None:
    payload["schema_version"] = "wrong"


def _mutable_revision(payload: dict[str, Any]) -> None:
    _primary(payload)["revision"] = "main"


def _insecure_source(payload: dict[str, Any]) -> None:
    _primary(payload)["source_uri"] = "http://insecure"


def _approved_without_license(payload: dict[str, Any]) -> None:
    primary = _primary(payload)
    primary["license_review_status"] = "APPROVED"
    primary["license_text_path"] = None


@pytest.mark.parametrize(
    "mutation",
    [_wrong_schema, _mutable_revision, _insecure_source, _approved_without_license],
)
def test_registry_rejects_mutable_or_incomplete_authority(
    tmp_path: Path,
    mutation: Mutation,
) -> None:
    payload = _registry_payload()
    mutation(payload)
    registry_path = tmp_path / "invalid.json"
    _write_json(registry_path, payload)

    with pytest.raises(ValueError):
        load_candidate_registry(registry_path)
