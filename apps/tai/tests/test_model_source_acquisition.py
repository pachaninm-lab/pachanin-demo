from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import pytest

from tai.model_bundle_v2 import load_model_bundle_authority_v2
from tai.model_source_acquisition import (
    assemble_acquisition_report,
    build_legal_review_packet,
    collect_source_manifest,
    download_plan,
    reconcile_huggingface_inventory,
    verify_restored_sources,
)

AUTHORITY_PATH = (
    Path(__file__).parents[1]
    / "model-artifacts"
    / "model-bundle-authority.v2.json"
)
MODEL_ID = "Qwen/Qwen3-8B"
REVISION = "895c8d171bc03c30e113cd7a28c02494b5e068b7"
OBSERVED_AT = "2026-07-20T09:29:20Z"


def _fixture(tmp_path: Path) -> tuple[Path, Path, dict[str, bytes]]:
    authority = load_model_bundle_authority_v2(AUTHORITY_PATH)
    plan = next(item for item in authority.models if item.model_id == MODEL_ID)
    selected_weights = [
        Path(item.path).name
        for item in plan.selected_inventory
        if item.role.value == "WEIGHT_SHARD"
    ]
    contents: dict[str, bytes] = {}
    for item in plan.inventory:
        relative = item.path.removeprefix("sources/qwen3-8b/")
        if relative == "model.safetensors.index.json":
            weight_map = {
                f"layer.{index}": shard
                for index, shard in enumerate(selected_weights, start=1)
            }
            content = json.dumps({"weight_map": weight_map}, sort_keys=True).encode()
        else:
            content = f"fixture:{relative}\n".encode()
        contents[relative] = content

    api = {
        "sha": REVISION,
        "cardData": {"license": "apache-2.0"},
        "siblings": [
            {
                "rfilename": relative,
                "size": len(content),
                "blobId": f"blob-{index:02d}",
                "lfs": {
                    "oid": f"oid-{index:02d}",
                    "pointerSize": 128,
                    "size": len(content),
                },
            }
            for index, (relative, content) in enumerate(
                sorted(contents.items()), start=1
            )
        ],
    }
    api_path = tmp_path / "api.json"
    api_path.write_text(json.dumps(api), encoding="utf-8")

    source_root = tmp_path / "original"
    for item in plan.selected_inventory:
        relative = item.path.removeprefix("sources/qwen3-8b/")
        path = source_root / item.path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(contents[relative])
    return api_path, source_root, contents


def _evidence(tmp_path: Path) -> tuple[dict[str, Any], dict[str, Any], Path]:
    api_path, source_root, _ = _fixture(tmp_path)
    remote = reconcile_huggingface_inventory(
        authority_path=AUTHORITY_PATH,
        model_id=MODEL_ID,
        revision=REVISION,
        api_response_path=api_path,
        observed_at=OBSERVED_AT,
    )
    manifest = collect_source_manifest(
        authority_path=AUTHORITY_PATH,
        model_id=MODEL_ID,
        revision=REVISION,
        remote_inventory=remote,
        source_root=source_root,
    )
    return remote, manifest, source_root


def test_reconcile_collect_restore_and_assemble_honest_source_evidence(
    tmp_path: Path,
) -> None:
    remote, manifest, source_root = _evidence(tmp_path)
    plan = download_plan(remote)

    assert remote["status"] == "RECONCILED"
    assert remote["model_id"] == MODEL_ID
    assert remote["revision"] == REVISION
    assert len(plan["entries"]) == 13
    assert manifest["status"] == "COLLECTED"
    assert len(manifest["files"]) == 13

    license_text = tmp_path / "LICENSE-2.0.txt"
    license_text.write_text("Apache License Version 2.0 fixture\n", encoding="utf-8")
    legal = build_legal_review_packet(
        authority_path=AUTHORITY_PATH,
        model_id=MODEL_ID,
        revision=REVISION,
        source_manifest=manifest,
        source_root=source_root,
        license_text_path=license_text,
        license_text_uri="https://www.apache.org/licenses/LICENSE-2.0.txt",
        prepared_at="2026-07-20T09:40:00Z",
    )
    assert legal["status"] == "PENDING_HUMAN_DECISION"
    assert legal["required_human_record"]["decision"] is None
    assert legal["automation_boundary"] == "AUTOMATION_MUST_NOT_APPROVE_OR_REJECT"

    restored_root = tmp_path / "restored"
    shutil.copytree(source_root, restored_root)
    restore = verify_restored_sources(
        source_manifest=manifest,
        restored_root=restored_root,
    )
    report = assemble_acquisition_report(
        remote_inventory=remote,
        source_manifest=manifest,
        legal_packet=legal,
        restore_report=restore,
        repository_sha="a" * 40,
        workflow_run_id="123",
        workflow_run_attempt="1",
    )

    assert restore["status"] == "VERIFIED_SOURCE_RESTORED"
    assert restore["reasons"] == []
    assert report["status"] == "VERIFIED_SOURCE_RESTORED_LEGAL_PENDING"
    assert report["legal_review_status"] == "PENDING_HUMAN_DECISION"
    assert report["conversion_status"] == "NOT_RUN"
    assert report["quantization_status"] == "NOT_RUN"
    assert report["model_admission_status"] == "NOT_DONE"
    assert report["production_operational_status"] == "NOT_ATTESTED"


def test_inventory_rejects_ungoverned_upstream_path(tmp_path: Path) -> None:
    api_path, _, _ = _fixture(tmp_path)
    api = json.loads(api_path.read_text())
    api["siblings"].append(
        {"rfilename": "unexpected.bin", "size": 1, "blobId": "unexpected"}
    )
    api_path.write_text(json.dumps(api), encoding="utf-8")

    with pytest.raises(ValueError, match="upstream inventory drift"):
        reconcile_huggingface_inventory(
            authority_path=AUTHORITY_PATH,
            model_id=MODEL_ID,
            revision=REVISION,
            api_response_path=api_path,
            observed_at=OBSERVED_AT,
        )


def test_source_collection_rejects_shard_index_drift(tmp_path: Path) -> None:
    api_path, source_root, _ = _fixture(tmp_path)
    index_path = source_root / "sources/qwen3-8b/model.safetensors.index.json"
    index_path.write_text(
        json.dumps({"weight_map": {"layer.1": "unknown.safetensors"}}),
        encoding="utf-8",
    )
    api = json.loads(api_path.read_text())
    for item in api["siblings"]:
        if item["rfilename"] == "model.safetensors.index.json":
            item["size"] = index_path.stat().st_size
            item["lfs"]["size"] = index_path.stat().st_size
    api_path.write_text(json.dumps(api), encoding="utf-8")
    remote = reconcile_huggingface_inventory(
        authority_path=AUTHORITY_PATH,
        model_id=MODEL_ID,
        revision=REVISION,
        api_response_path=api_path,
        observed_at=OBSERVED_AT,
    )

    with pytest.raises(ValueError, match="exact selected shard set"):
        collect_source_manifest(
            authority_path=AUTHORITY_PATH,
            model_id=MODEL_ID,
            revision=REVISION,
            remote_inventory=remote,
            source_root=source_root,
        )


def test_source_collection_and_restore_reject_symlink_or_tampering(
    tmp_path: Path,
) -> None:
    remote, manifest, source_root = _evidence(tmp_path)
    target = source_root / "sources/qwen3-8b/config.json"
    original = target.read_bytes()
    target.unlink()
    external = tmp_path / "external-config.json"
    external.write_bytes(original)
    target.symlink_to(external)

    with pytest.raises(ValueError, match="non-symlink"):
        collect_source_manifest(
            authority_path=AUTHORITY_PATH,
            model_id=MODEL_ID,
            revision=REVISION,
            remote_inventory=remote,
            source_root=source_root,
        )

    target.unlink()
    target.write_bytes(original)
    restored_root = tmp_path / "restored"
    shutil.copytree(source_root, restored_root)
    restored_target = restored_root / "sources/qwen3-8b/config.json"
    restored_target.write_bytes(b"tampered")
    with pytest.raises(ValueError, match="restored source size mismatch"):
        verify_restored_sources(
            source_manifest=manifest,
            restored_root=restored_root,
        )


def test_assemble_rejects_automated_legal_decision(tmp_path: Path) -> None:
    remote, manifest, source_root = _evidence(tmp_path)
    license_text = tmp_path / "LICENSE-2.0.txt"
    license_text.write_text("Apache License Version 2.0 fixture\n", encoding="utf-8")
    legal = build_legal_review_packet(
        authority_path=AUTHORITY_PATH,
        model_id=MODEL_ID,
        revision=REVISION,
        source_manifest=manifest,
        source_root=source_root,
        license_text_path=license_text,
        license_text_uri="https://www.apache.org/licenses/LICENSE-2.0.txt",
        prepared_at="2026-07-20T09:40:00Z",
    )
    legal["status"] = "APPROVED"
    restored_root = tmp_path / "restored"
    shutil.copytree(source_root, restored_root)
    restore = verify_restored_sources(
        source_manifest=manifest,
        restored_root=restored_root,
    )

    with pytest.raises(ValueError, match="must not manufacture"):
        assemble_acquisition_report(
            remote_inventory=remote,
            source_manifest=manifest,
            legal_packet=legal,
            restore_report=restore,
            repository_sha="a" * 40,
            workflow_run_id="123",
            workflow_run_attempt="1",
        )
