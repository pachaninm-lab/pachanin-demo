from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Any, cast

from tai.model_bundle_v2 import (
    InventoryDisposition,
    SourceFileRole,
    authority_sha256_v2,
    load_local_model_bundle_v2,
    load_model_bundle_authority_v2,
    verify_local_model_bundle_v2,
)

MODEL_ARTIFACTS = Path(__file__).resolve().parents[1] / "model-artifacts"
AUTHORITY_PATH = MODEL_ARTIFACTS / "model-bundle-authority.v2.json"


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _write(root: Path, relative_path: str, content: bytes) -> dict[str, object]:
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return {
        "path": relative_path,
        "sha256": _sha256(content),
        "size_bytes": len(content),
    }


def _manifest_payload(
    tmp_path: Path, model_index: int = 0
) -> tuple[Path, Path, Path, dict[str, Any]]:
    authority = load_model_bundle_authority_v2(AUTHORITY_PATH)
    plan = authority.models[model_index]
    toolchain = authority.toolchain
    root = tmp_path / "bundle"

    remote_entries: list[dict[str, object]] = []
    source_files: list[dict[str, object]] = []
    for position, entry in enumerate(plan.inventory, start=1):
        remote_entries.append(
            {
                "path": entry.path,
                "size_bytes": 100 + position,
                "remote_identity": f"hf-revision-object-{position}",
            }
        )
        if entry.disposition is InventoryDisposition.EXCLUDED:
            continue
        if entry.role is SourceFileRole.SHARD_INDEX:
            shards = [
                Path(item.path).name
                for item in plan.selected_inventory
                if item.role is SourceFileRole.WEIGHT_SHARD
            ]
            content = json.dumps(
                {
                    "metadata": {"total_size": len(shards)},
                    "weight_map": {
                        f"tensor.{index}": shard for index, shard in enumerate(shards, start=1)
                    },
                },
                sort_keys=True,
            ).encode()
        else:
            content = f"source:{entry.path}\n".encode()
        declared = _write(root, entry.path, content)
        remote_entries[position - 1]["size_bytes"] = declared["size_bytes"]
        source_files.append({**declared, "role": entry.role.value})

    remote_evidence = _write(
        root,
        "evidence/remote-inventory.json",
        json.dumps(remote_entries, sort_keys=True).encode(),
    )
    license_text = _write(root, "legal/LICENSE.txt", b"Apache License 2.0\n")
    review_record = _write(
        root,
        "legal/review.json",
        b'{"decision":"APPROVED","reviewer_type":"HUMAN"}\n',
    )

    package = _write(root, "toolchain/package.tar.zst", b"controlled-toolchain-package")
    build_manifest = _write(root, "toolchain/build-manifest.json", b'{"status":"BUILT"}\n')
    verification_report_content = json.dumps(
        {
            "authority_sha256": toolchain.authority_sha256,
            "status": "VERIFIED",
            "verified_targets": list(toolchain.required_binaries),
        },
        sort_keys=True,
    ).encode()
    verification_report = _write(
        root,
        "toolchain/verification-report.json",
        verification_report_content,
    )
    binaries: list[dict[str, object]] = []
    binary_hashes: dict[str, str] = {}
    for name in toolchain.required_binaries:
        declared = _write(root, f"toolchain/bin/{name}", f"binary:{name}".encode())
        binaries.append({"name": name, "file": declared})
        binary_hashes[name] = cast(str, declared["sha256"])

    converter = _write(
        root,
        plan.conversion.converter_path,
        b"#!/usr/bin/env python3\n# exact converter\n",
    )
    python_dependencies = _write(
        root,
        "conversion/python-dependencies.txt",
        b"torch==2.7.1\ntransformers==4.53.0\n",
    )
    conversion_log = _write(root, "conversion/convert.log", b"conversion completed\n")
    intermediate = _write(
        root,
        plan.conversion.intermediate_path,
        b"synthetic-intermediate-gguf",
    )

    source_model = tuple(
        # The loader gives the exact dataclass representation used by the digest.
        # Construct it through a temporary partial manifest below after the files exist.
        source_files
    )
    # Replicate the canonical digest payload without coupling tests to JSON formatting.
    source_digest_payload = [
        {
            "path": item["path"],
            "role": item["role"],
            "sha256": item["sha256"],
            "size_bytes": item["size_bytes"],
        }
        for item in sorted(source_model, key=lambda value: cast(str, value["path"]))
    ]
    source_digest = _sha256(
        json.dumps(
            source_digest_payload,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode()
    )

    quantizations: list[dict[str, object]] = []
    for index, quantization in enumerate(plan.quantizations, start=1):
        log = _write(
            root,
            f"quantization/{index}-{quantization.quantization}.log",
            f"quantized:{quantization.quantization}\n".encode(),
        )
        output = _write(
            root,
            quantization.output_path,
            f"output:{quantization.quantization}".encode(),
        )
        quantizations.append(
            {
                "runtime_class": quantization.runtime_class.value,
                "quantization": quantization.quantization,
                "argv": list(quantization.argv),
                "log": log,
                "output": output,
                "input_sha256": intermediate["sha256"],
                "quantize_binary_sha256": binary_hashes["llama-quantize"],
            }
        )

    bundle_archive = _write(root, "storage/bundle.tar.zst", b"immutable-model-bundle")
    payload_index = _write(root, "storage/payload-index.json", b'{"files":"indexed"}\n')
    upload_record = _write(root, "storage/upload-record.json", b'{"status":"UPLOADED"}\n')
    restore_record = _write(root, "storage/restore-record.json", b'{"status":"RESTORED"}\n')

    payload: dict[str, Any] = {
        "schema_version": "tai.local-model-artifact-bundle.v2",
        "lifecycle": "COMPLETE",
        "role": plan.role.value,
        "model_id": plan.model_id,
        "revision": plan.revision,
        "authority_sha256": authority_sha256_v2(authority),
        "remote_inventory": {
            "observed_at": "2026-07-20T01:00:00Z",
            "evidence_file": remote_evidence,
            "entries": remote_entries,
        },
        "source_files": source_files,
        "legal_review": {
            "decision": "APPROVED",
            "reviewer_type": "HUMAN",
            "reviewer_id": "legal-reviewer-001",
            "reviewer_name": "Independent Legal Reviewer",
            "reviewed_at": "2026-07-20T01:15:00Z",
            "license_spdx": plan.license_spdx,
            "decision_basis": "Human review of the exact license text and intended use.",
            "license_text": license_text,
            "review_record": review_record,
        },
        "toolchain_package": {
            "name": toolchain.name,
            "release": toolchain.release,
            "commit": toolchain.commit,
            "profile": toolchain.profile,
            "authority_sha256": toolchain.authority_sha256,
            "package": package,
            "build_manifest": build_manifest,
            "verification_report": verification_report,
            "verification_status": "VERIFIED",
            "immutable_locator": (
                "gh-actions://pachaninm-lab/pachanin-demo/actions/runs/1/artifacts/2"
                f"@sha256:{package['sha256']}"
            ),
            "binaries": binaries,
        },
        "conversion": {
            "python_identity": "CPython 3.12.10 on linux-x86_64",
            "python_dependencies": python_dependencies,
            "converter": converter,
            "argv": list(plan.conversion.argv),
            "log": conversion_log,
            "intermediate": intermediate,
            "source_files_sha256": source_digest,
            "toolchain_package_sha256": package["sha256"],
        },
        "quantizations": quantizations,
        "storage": {
            "bundle_archive": bundle_archive,
            "payload_index": payload_index,
            "immutable_locator": (
                f"oci://registry.example/tai/model-bundle@sha256:{bundle_archive['sha256']}"
            ),
            "upload_record": upload_record,
            "restore_record": restore_record,
        },
    }
    manifest = tmp_path / "manifest.json"
    _write_json(manifest, payload)
    restored = tmp_path / "restored"
    shutil.copytree(root, restored)
    return manifest, root, restored, payload


def _verify(
    tmp_path: Path, *, model_index: int = 0
) -> tuple[Any, dict[str, Any], Path, Path, Path]:
    manifest, root, restored, payload = _manifest_payload(tmp_path, model_index)
    authority = load_model_bundle_authority_v2(AUTHORITY_PATH)
    bundle = load_local_model_bundle_v2(manifest)
    report = verify_local_model_bundle_v2(
        authority=authority,
        bundle=bundle,
        bundle_root=root,
        restored_root=restored,
    )
    return report, payload, manifest, root, restored
