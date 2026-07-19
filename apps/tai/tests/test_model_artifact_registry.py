from __future__ import annotations

import hashlib
import json
from pathlib import Path

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
TOOLCHAIN_COMMIT = "b" * 40


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _registry_payload(*, approved: bool = True) -> dict[str, object]:
    license_path = "licenses/model-a/LICENSE" if approved else None
    return {
        "schema_version": "tai.model-candidate-registry.v1",
        "candidates": [
            {
                "role": "PRIMARY",
                "model_id": "owner/model-a",
                "revision": REVISION,
                "source_uri": (
                    "https://models.example/owner/model-a/tree/" + REVISION
                ),
                "model_card_uri": (
                    "https://models.example/owner/model-a/blob/"
                    + REVISION
                    + "/README.md"
                ),
                "license_spdx": "Apache-2.0",
                "license_review_status": "APPROVED" if approved else "PENDING",
                "license_text_path": license_path,
                "tokenizer_files": ["sources/model-a/tokenizer.json"],
                "weight_files": ["sources/model-a/model.safetensors"],
                "quantization_recipes": [
                    {
                        "runtime_class": "CPU",
                        "format": "GGUF",
                        "quantization": "Q4_K_M",
                        "toolchain_name": "ggml-org/llama.cpp",
                        "toolchain_uri": "https://github.com/ggml-org/llama.cpp",
                        "toolchain_release": "b9637",
                        "toolchain_commit": TOOLCHAIN_COMMIT,
                        "output_path": "artifacts/model-a-q4-k-m.gguf",
                    },
                    {
                        "runtime_class": "GPU_SHARED",
                        "format": "GGUF",
                        "quantization": "Q8_0",
                        "toolchain_name": "ggml-org/llama.cpp",
                        "toolchain_uri": "https://github.com/ggml-org/llama.cpp",
                        "toolchain_release": "b9637",
                        "toolchain_commit": TOOLCHAIN_COMMIT,
                        "output_path": "artifacts/model-a-q8-0.gguf",
                    },
                ],
            },
            {
                "role": "FALLBACK",
                "model_id": "owner/model-b",
                "revision": "c" * 40,
                "source_uri": (
                    "https://models.example/owner/model-b/tree/" + "c" * 40
                ),
                "model_card_uri": (
                    "https://models.example/owner/model-b/blob/"
                    + "c" * 40
                    + "/README.md"
                ),
                "license_spdx": "Apache-2.0",
                "license_review_status": "PENDING",
                "license_text_path": None,
                "tokenizer_files": ["sources/model-b/tokenizer.json"],
                "weight_files": ["sources/model-b/model.safetensors"],
                "quantization_recipes": [
                    {
                        "runtime_class": "CPU",
                        "format": "GGUF",
                        "quantization": "Q4_K_M",
                        "toolchain_name": "ggml-org/llama.cpp",
                        "toolchain_uri": "https://github.com/ggml-org/llama.cpp",
                        "toolchain_release": "b9637",
                        "toolchain_commit": TOOLCHAIN_COMMIT,
                        "output_path": "artifacts/model-b-q4-k-m.gguf",
                    }
                ],
            },
        ],
    }


def _prepare_bundle(tmp_path: Path) -> tuple[Path, Path, Path]:
    registry_path = tmp_path / "registry.json"
    _write_json(registry_path, _registry_payload())

    files = {
        "licenses/model-a/LICENSE": b"Apache License evidence\n",
        "sources/model-a/tokenizer.json": b'{"tokenizer":"pinned"}\n',
        "artifacts/model-a-q4-k-m.gguf": b"cpu-artifact",
        "artifacts/model-a-q8-0.gguf": b"gpu-artifact",
    }
    for relative_path, content in files.items():
        target = tmp_path / "bundle" / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)

    bundle_path = tmp_path / "bundle.json"
    _write_json(
        bundle_path,
        {
            "schema_version": "tai.local-model-artifact-bundle.v1",
            "model_id": "owner/model-a",
            "revision": REVISION,
            "license_text": {
                "path": "licenses/model-a/LICENSE",
                "sha256": _sha256(files["licenses/model-a/LICENSE"]),
                "size_bytes": len(files["licenses/model-a/LICENSE"]),
            },
            "tokenizers": [
                {
                    "path": "sources/model-a/tokenizer.json",
                    "sha256": _sha256(
                        files["sources/model-a/tokenizer.json"]
                    ),
                    "size_bytes": len(
                        files["sources/model-a/tokenizer.json"]
                    ),
                }
            ],
            "artifacts": [
                {
                    "path": "artifacts/model-a-q4-k-m.gguf",
                    "sha256": _sha256(
                        files["artifacts/model-a-q4-k-m.gguf"]
                    ),
                    "size_bytes": len(
                        files["artifacts/model-a-q4-k-m.gguf"]
                    ),
                    "runtime_class": "CPU",
                    "quantization": "Q4_K_M",
                    "toolchain_commit": TOOLCHAIN_COMMIT,
                },
                {
                    "path": "artifacts/model-a-q8-0.gguf",
                    "sha256": _sha256(files["artifacts/model-a-q8-0.gguf"]),
                    "size_bytes": len(files["artifacts/model-a-q8-0.gguf"]),
                    "runtime_class": "GPU_SHARED",
                    "quantization": "Q8_0",
                    "toolchain_commit": TOOLCHAIN_COMMIT,
                },
            ],
        },
    )
    return registry_path, bundle_path, tmp_path / "bundle"


def test_repository_candidate_registry_is_pinned_and_intentionally_pending() -> None:
    registry_path = (
        Path(__file__).resolve().parents[1]
        / "model-artifacts"
        / "candidates.v1.json"
    )

    registry = load_candidate_registry(registry_path)

    assert [item.role for item in registry.candidates] == [
        CandidateRole.PRIMARY,
        CandidateRole.FALLBACK,
    ]
    assert all(
        item.license_review_status is LicenseReviewStatus.PENDING
        for item in registry.candidates
    )
    assert all(item.revision not in {"main", "master"} for item in registry.candidates)
    assert all(item.revision in item.source_uri for item in registry.candidates)
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
    assert "FILE_SIZE_MISMATCH:artifacts/model-a-q4-k-m.gguf" in report.reasons


def test_bundle_verification_rejects_pending_license_and_missing_toolchain_commit(
    tmp_path: Path,
) -> None:
    registry_path, bundle_path, bundle_root = _prepare_bundle(tmp_path)
    payload = _registry_payload(approved=False)
    primary = payload["candidates"][0]  # type: ignore[index]
    primary["quantization_recipes"][0]["toolchain_commit"] = None  # type: ignore[index]
    primary["quantization_recipes"][1]["toolchain_commit"] = None  # type: ignore[index]
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


def test_cli_validates_repository_registry_without_claiming_artifacts(
    tmp_path: Path,
) -> None:
    registry_path = (
        Path(__file__).resolve().parents[1]
        / "model-artifacts"
        / "candidates.v1.json"
    )
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


@pytest.mark.parametrize(
    "mutation",
    [
        lambda payload: payload.update({"schema_version": "wrong"}),
        lambda payload: payload["candidates"][0].update({"revision": "main"}),
        lambda payload: payload["candidates"][0].update(
            {"source_uri": "http://insecure"}
        ),
        lambda payload: payload["candidates"][0].update(
            {"license_review_status": "APPROVED", "license_text_path": None}
        ),
    ],
)
def test_registry_rejects_mutable_or_incomplete_authority(
    tmp_path: Path,
    mutation: object,
) -> None:
    payload = _registry_payload()
    assert callable(mutation)
    mutation(payload)
    registry_path = tmp_path / "invalid.json"
    _write_json(registry_path, payload)

    with pytest.raises(ValueError):
        load_candidate_registry(registry_path)
