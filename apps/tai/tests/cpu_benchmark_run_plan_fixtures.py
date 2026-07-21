from __future__ import annotations

import copy
import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import quote

from tai import cpu_benchmark_execution as execution
from tai import cpu_benchmark_run_plan as run_plan
from tai.model_bundle_v2 import authority_sha256_v2, load_model_bundle_authority_v2

TAI_ROOT = Path(__file__).resolve().parents[1]
RUN_PLAN_AUTHORITY = TAI_ROOT / "model-artifacts/cpu-benchmark-run-plan-authority.v1.json"
EXECUTION_AUTHORITY = TAI_ROOT / "model-artifacts/cpu-benchmark-execution-authority.v1.json"
BUNDLE_AUTHORITY = TAI_ROOT / "model-artifacts/model-bundle-authority.v2.json"
BENCHMARK_AUTHORITY = TAI_ROOT / "model-artifacts/model-benchmark-admission-authority.v2.json"
FINALIZATION_AUTHORITY = TAI_ROOT / "model-artifacts/model-bundle-finalization-authority.v1.json"
PENDING = TAI_ROOT / "model-artifacts/cpu-benchmark-run-plan.pending.json"
EXACT_MAIN = "a" * 40
FINALIZATION_MAIN = "b" * 40
NOW = datetime(2026, 7, 21, 18, 0, tzinfo=UTC)


def _canonical(value: object) -> str:
    return execution.canonical_sha256(value)


def _signed(value: dict[str, Any], field: str) -> dict[str, Any]:
    output = copy.deepcopy(value)
    output.pop(field, None)
    output[field] = _canonical(output)
    return output


def _write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _declared(path: str, seed: str, size: int = 100) -> dict[str, object]:
    return {
        "path": path,
        "sha256": hashlib.sha256(seed.encode()).hexdigest(),
        "size_bytes": size,
    }


def _ref(root: Path, path: Path) -> dict[str, object]:
    payload = path.read_bytes()
    return {
        "path": path.relative_to(root).as_posix(),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "size_bytes": len(payload),
    }


def _model_fixture(
    root: Path,
    *,
    key: str,
    role: str,
    model_id: str,
    revision: str,
    profile_id: str,
    artifact_path: str,
    archive_seed: str,
    version_id: str,
    now: datetime,
    bundle_authority_sha: str,
) -> dict[str, Any]:
    model_root = (
        root
        / "finalization-artifact/bundle-finalization-evidence/remote/evidence/models"
        / key
    )
    archive_sha = hashlib.sha256(archive_seed.encode()).hexdigest()
    archive_size = 5_000_000 + len(key)
    uploaded = now - timedelta(days=1)
    retention = uploaded + timedelta(days=90, hours=1)
    restored = now - timedelta(hours=20)
    endpoint = "s3.storage.selcloud.ru"
    bucket = "tai-model-bundles"
    object_key = f"tai/objects/sha256/{archive_sha}/{key}.tar"
    locator = (
        f"s3+version://{endpoint}/{bucket}/{object_key}"
        f"?versionId={quote(version_id, safe='')}#sha256={archive_sha}"
    )

    binary_names = ("llama-cli", "llama-server", "llama-quantize", "llama-bench")
    binaries = [
        {
            "name": name,
            "file": _declared(f"toolchain/bin/{name}", f"binary:{name}", 1_000 + index),
        }
        for index, name in enumerate(binary_names)
    ]
    binary_sha = {item["name"]: item["file"]["sha256"] for item in binaries}
    q4_output = _declared(artifact_path, f"q4:{key}", 4_000_000_000)
    manifest: dict[str, Any] = {
        "schema_version": "tai.external-model-bundle.v1",
        "lifecycle": "COMPLETE",
        "role": role,
        "model_id": model_id,
        "revision": revision,
        "authority_sha256": bundle_authority_sha,
        "remote_inventory": {},
        "source_files": [],
        "legal_review": {
            "decision": "APPROVED",
            "reviewer_type": "HUMAN",
        },
        "toolchain_package": {
            "name": "ggml-org/llama.cpp",
            "release": "b9637",
            "commit": "aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3",
            "profile": "linux-x86_64-cpu-release-static-v1",
            "authority_sha256": (
                "3064250e63baed7bdcfd20851e1d3ea2c86fc33f087b69a2a4fcff18c384374b"
            ),
            "package": _declared("toolchain/package.tar.gz", "package", 10_000),
            "build_manifest": _declared("toolchain/build-manifest.json", "build", 1_000),
            "verification_report": _declared(
                "toolchain/verification-report.json", "verification", 1_000
            ),
            "verification_status": "VERIFIED",
            "immutable_locator": (
                "gh-actions://pachaninm-lab/pachanin-demo/actions/artifacts/"
                f"123@sha256:{hashlib.sha256(b'package').hexdigest()}"
            ),
            "binaries": binaries,
        },
        "conversion": {},
        "quantizations": [
            {
                "runtime_class": "CPU",
                "quantization": "Q4_K_M",
                "argv": [
                    "toolchain/bin/llama-quantize",
                    f"artifacts/{key}-intermediate.gguf",
                    artifact_path,
                    "Q4_K_M",
                ],
                "log": _declared("quantization/q4.log", f"log:{key}", 100),
                "output": q4_output,
                "input_sha256": hashlib.sha256(f"input:{key}".encode()).hexdigest(),
                "quantize_binary_sha256": binary_sha["llama-quantize"],
            }
        ],
        "storage": {
            "archive": {
                "sha256": archive_sha,
                "size_bytes": archive_size,
                "media_type": "application/x-tar",
            },
            "payload_index": _declared("storage/payload-index.json", f"index:{key}"),
            "immutable_locator": locator,
            "object": {
                "endpoint_host": endpoint,
                "region": "ru-1",
                "bucket": bucket,
                "key": object_key,
                "version_id": version_id,
                "etag": f'"etag-{key}"',
            },
            "uploaded_at": uploaded.isoformat(),
            "retention_mode": "COMPLIANCE",
            "retention_days": 90,
            "retention_expires_at": retention.isoformat(),
            "restored_at": restored.isoformat(),
            "upload_record": _declared("storage/upload-record.json", f"upload:{key}"),
            "restore_record": _declared("storage/restore-record.json", f"restore:{key}"),
        },
        "benchmark_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }
    manifest_path = model_root / "manifest.json"
    _write(manifest_path, manifest)
    manifest_file_sha = hashlib.sha256(manifest_path.read_bytes()).hexdigest()

    object_record = {
        "endpoint_host": endpoint,
        "region": "ru-1",
        "bucket": bucket,
        "key": object_key,
        "version_id": version_id,
        "etag": f'"etag-{key}"',
        "archive_sha256": archive_sha,
        "archive_size_bytes": archive_size,
        "uploaded_at": uploaded.isoformat(),
        "retention_expires_at": retention.isoformat(),
        "restored_at": restored.isoformat(),
        "immutable_locator": locator,
    }
    object_path = model_root / "object-record.json"
    _write(object_path, object_record)

    report = _signed(
        {
            "schema_version": "tai.external-model-bundle-verification-report.v1",
            "status": "VERIFIED",
            "reasons": [],
            "model_id": model_id,
            "revision": revision,
            "authority_sha256": bundle_authority_sha,
            "manifest_sha256": manifest_file_sha,
            "archive_sha256": archive_sha,
            "archive_size_bytes": archive_size,
            "verified_original_files": 40,
            "verified_restored_files": 30,
            "benchmark_status": "NOT_RUN",
            "model_admission_status": "NOT_DONE",
            "production_operational_status": "NOT_ATTESTED",
        },
        "report_sha256",
    )
    report_path = model_root / "verification-report.json"
    _write(report_path, report)
    return {
        "key": key,
        "role": role,
        "model_id": model_id,
        "revision": revision,
        "profile_id": profile_id,
        "artifact_path": artifact_path,
        "manifest": manifest,
        "manifest_path": manifest_path,
        "object_record": object_record,
        "object_path": object_path,
        "report": report,
        "report_path": report_path,
        "archive_sha256": archive_sha,
        "archive_size_bytes": archive_size,
        "version_id": version_id,
        "immutable_locator": locator,
    }


def build_fixture(tmp_path: Path, *, now: datetime = NOW) -> dict[str, Any]:
    root = tmp_path / "inputs"
    root.mkdir(parents=True)
    execution_authority = execution.load_execution_authority(EXECUTION_AUTHORITY)
    bundle_authority = load_model_bundle_authority_v2(BUNDLE_AUTHORITY)
    bundle_authority_sha = authority_sha256_v2(bundle_authority)

    assessment = _signed(
        {
            "schema_version": "tai.gold-set-assessment.v1",
            "version": "tai-platform-agro-58-v1",
            "accepted": True,
            "status": "ACCEPTED",
            "corpus_sha256": hashlib.sha256(b"gold-corpus").hexdigest(),
            "component_sha256": {
                "cases": hashlib.sha256(b"cases").hexdigest(),
                "expert_reviews": hashlib.sha256(b"reviews").hexdigest(),
            },
            "counts": {
                "total_cases": 58,
                "critical_cases": 23,
                "reviewed_cases": 58,
                "unreviewed_cases": 0,
            },
            "quality_targets": {
                "platform_accuracy_minimum": 0.95,
                "agro_accuracy_minimum": 0.90,
            },
            "blocking_reasons": [],
            "missing_review_case_ids": [],
        },
        "assessment_sha256",
    )
    assessment_path = root / "gold-assessment.json"
    _write(assessment_path, assessment)

    readiness = _signed(
        {
            "schema_version": "tai.cpu-benchmark-execution-readiness.v1",
            "status": "READY_FOR_EXTERNAL_EXECUTION",
            "ready": True,
            "exact_main": EXACT_MAIN,
            "evaluated_at": (now - timedelta(minutes=5)).isoformat(),
            "authority_sha256": execution_authority["authority_sha256"],
            "prerequisite_report_sha256": hashlib.sha256(b"prerequisite").hexdigest(),
            "gold_corpus_sha256": assessment["corpus_sha256"],
            "gold_assessment_sha256": assessment["assessment_sha256"],
            "required_profiles": [
                "qwen3-8b-cpu-q4-k-m",
                "mistral-7b-fallback-cpu-q4-k-m",
            ],
            "reasons": [],
            **run_plan.MATURITY,
        },
        "report_sha256",
    )
    readiness_path = root / "readiness.json"
    _write(readiness_path, readiness)

    qwen = _model_fixture(
        root,
        key="qwen3-8b",
        role="PRIMARY",
        model_id="Qwen/Qwen3-8B",
        revision="895c8d171bc03c30e113cd7a28c02494b5e068b7",
        profile_id="qwen3-8b-cpu-q4-k-m",
        artifact_path="artifacts/qwen3-8b-q4-k-m.gguf",
        archive_seed="qwen-archive",
        version_id="qwen-version-1",
        now=now,
        bundle_authority_sha=bundle_authority_sha,
    )
    mistral = _model_fixture(
        root,
        key="mistral-7b-instruct-v0.3",
        role="FALLBACK",
        model_id="mistralai/Mistral-7B-Instruct-v0.3",
        revision="c170c708c41dac9275d15a8fff4eca08d52bab71",
        profile_id="mistral-7b-fallback-cpu-q4-k-m",
        artifact_path="artifacts/mistral-7b-instruct-v0.3-q4-k-m.gguf",
        archive_seed="mistral-archive",
        version_id="mistral-version-1",
        now=now,
        bundle_authority_sha=bundle_authority_sha,
    )
    models = [qwen, mistral]

    finalization = _signed(
        {
            "schema_version": "tai.model-bundle-finalization-report.v1",
            "status": "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED",
            "completed_at": (now - timedelta(hours=1)).isoformat(),
            "models": [
                {
                    "key": model["key"],
                    "model_id": model["model_id"],
                    "revision": model["revision"],
                    "archive_sha256": model["archive_sha256"],
                    "archive_size_bytes": model["archive_size_bytes"],
                    "immutable_locator": model["immutable_locator"],
                    "version_id": model["version_id"],
                    "verification_report_sha256": model["report"]["report_sha256"],
                }
                for model in models
            ],
            "local_archive_copy_retained": False,
            "benchmark_status": "NOT_RUN",
            "model_admission_status": "NOT_DONE",
            "production_operational_status": "NOT_ATTESTED",
            "reasons": [],
        },
        "report_sha256",
    )
    finalization_path = (
        root
        / "finalization-artifact/bundle-finalization-evidence/remote/evidence"
        / "finalization-report.json"
    )
    _write(finalization_path, finalization)

    index: dict[str, Any] = {
        "schema_version": "tai.cpu-benchmark-run-plan-inputs.v1",
        "finalization_run": {
            "workflow_name": "TAI Immutable Model Bundle Finalization",
            "workflow_run_id": 123456,
            "workflow_run_attempt": 1,
            "head_sha": FINALIZATION_MAIN,
            "head_branch": "main",
            "event": "issue_comment",
            "conclusion": "success",
            "artifact_id": 987654,
            "artifact_name": (
                f"tai-model-bundle-finalization-{FINALIZATION_MAIN}-123456-1"
            ),
            "artifact_digest": f"sha256:{hashlib.sha256(b'artifact').hexdigest()}",
        },
        "readiness": _ref(root, readiness_path),
        "gold_assessment": _ref(root, assessment_path),
        "finalization_report": _ref(root, finalization_path),
        "models": [
            {
                "model_key": model["key"],
                "manifest": _ref(root, model["manifest_path"]),
                "object_record": _ref(root, model["object_path"]),
                "verification_report": _ref(root, model["report_path"]),
            }
            for model in models
        ],
        "planned_roots": [
            {
                "model_key": model["key"],
                "original_root": (
                    f"/srv/tai-models/benchmark-runs/{EXACT_MAIN}/"
                    f"{model['key']}/original"
                ),
                "restored_root": (
                    f"/srv/tai-models/benchmark-runs/{EXACT_MAIN}/"
                    f"{model['key']}/clean-restore"
                ),
            }
            for model in models
        ],
    }
    index_path = root / "input-index.json"
    _write(index_path, index)
    return {
        "root": root,
        "index": index,
        "index_path": index_path,
        "assessment": assessment,
        "assessment_path": assessment_path,
        "readiness": readiness,
        "readiness_path": readiness_path,
        "finalization": finalization,
        "finalization_path": finalization_path,
        "models": {model["key"]: model for model in models},
        "now": now,
        "compile_kwargs": {
            "authority_path": RUN_PLAN_AUTHORITY,
            "input_root": root,
            "input_index_path": index_path,
            "execution_authority_path": EXECUTION_AUTHORITY,
            "model_bundle_authority_path": BUNDLE_AUTHORITY,
            "benchmark_authority_path": BENCHMARK_AUTHORITY,
            "finalization_authority_path": FINALIZATION_AUTHORITY,
            "exact_main": EXACT_MAIN,
            "evaluated_at": now.isoformat(),
        },
    }


def refresh_ref(fixture: dict[str, Any], field: str, path: Path) -> None:
    fixture["index"][field] = _ref(fixture["root"], path)
    _write(fixture["index_path"], fixture["index"])


def refresh_model_refs(fixture: dict[str, Any], key: str) -> None:
    model = fixture["models"][key]
    entry = next(item for item in fixture["index"]["models"] if item["model_key"] == key)
    entry["manifest"] = _ref(fixture["root"], model["manifest_path"])
    entry["object_record"] = _ref(fixture["root"], model["object_path"])
    entry["verification_report"] = _ref(fixture["root"], model["report_path"])
    _write(fixture["index_path"], fixture["index"])


def sync_model_report_and_finalization(fixture: dict[str, Any], key: str) -> None:
    model = fixture["models"][key]
    model["report"]["manifest_sha256"] = hashlib.sha256(
        model["manifest_path"].read_bytes()
    ).hexdigest()
    model["report"] = _signed(model["report"], "report_sha256")
    _write(model["report_path"], model["report"])
    finalization_model = next(
        item for item in fixture["finalization"]["models"] if item["key"] == key
    )
    finalization_model["verification_report_sha256"] = model["report"]["report_sha256"]
    fixture["finalization"] = _signed(fixture["finalization"], "report_sha256")
    _write(fixture["finalization_path"], fixture["finalization"])
    refresh_ref(fixture, "finalization_report", fixture["finalization_path"])
    refresh_model_refs(fixture, key)
