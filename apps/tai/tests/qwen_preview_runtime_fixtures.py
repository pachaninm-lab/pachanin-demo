from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

from tai import qwen_preview_runtime as runtime

EXACT_MAIN = "a" * 40
EXECUTED_AT = "2026-07-22T04:00:00+00:00"
EVALUATED_AT = "2026-07-22T04:10:00+00:00"


def authority_path() -> Path:
    return Path(__file__).parents[1] / "model-artifacts" / "qwen-preview-runtime-authority.v1.json"


def pending_path() -> Path:
    return Path(__file__).parents[1] / "model-artifacts" / "qwen-preview-runtime.pending.json"


def valid_evidence() -> dict[str, Any]:
    authority = runtime.load_authority(authority_path())
    smoke: list[dict[str, Any]] = []
    for index, language in enumerate(("RU", "EN", "ZH"), start=1):
        smoke.append(
            {
                "language": language,
                "prompt_sha256": f"{index:064x}",
                "response_sha256": f"{index + 10:064x}",
                "elapsed_ms": 1000 * index,
                "http_status": 200,
                "prompt_tokens": 20 + index,
                "completion_tokens": 10 + index,
                "total_tokens": 30 + 2 * index,
                "response_bytes": 100 + index,
            }
        )
    evidence: dict[str, Any] = {
        "schema_version": "tai.qwen-preview-runtime-evidence.v1",
        "status": "READ_ONLY_OPERATIONAL_PREVIEW_PENDING_EXTERNAL_IMMUTABILITY",
        "accepted": True,
        "exact_main_sha": EXACT_MAIN,
        "authority_sha256": authority["authority_sha256"],
        "executed_at": EXECUTED_AT,
        "workflow": {"run_id": 12345, "run_attempt": 1},
        "host": {
            "role": "DEDICATED_MODEL_HOST",
            "user": "tai-model",
            "workspace_root": "/srv/tai-models",
            "hostname_sha256": "b" * 64,
            "listen_host": "127.0.0.1",
            "listen_port": 18080,
            "listener_before": False,
            "listener_during": True,
            "listener_after": False,
            "public_listener": False,
        },
        "model": {
            "model_id": "Qwen/Qwen3-8B",
            "revision": "895c8d171bc03c30e113cd7a28c02494b5e068b7",
            "quantization": "Q4_K_M",
            "path_label": "artifacts/qwen3-8b-q4-k-m.gguf",
            "sha256": "c" * 64,
            "size_bytes": 5_000_000_000,
            "conversion_report_sha256": "d" * 64,
            "conversion_status": "CONVERSION_AND_QUANTIZATION_COMPLETE_PENDING_BUNDLE_RESTORE",
        },
        "toolchain": copy.deepcopy(authority["toolchain"]),
        "limits": copy.deepcopy(authority["limits"]),
        "runtime": {
            "health_status": "READY",
            "startup_ms": 25000,
            "peak_rss_bytes": 7_000_000_000,
            "active_requests": 1,
            "queued_requests": 0,
        },
        "smoke": smoke,
        "cleanup": {
            "raw_deleted": True,
            "process_stopped": True,
            "listener_removed": True,
            "rollback_verified": True,
        },
        "maturity_boundary": copy.deepcopy(authority["maturity_boundary"]),
        "reasons": [],
    }
    evidence["evidence_sha256"] = runtime.canonical_sha256(evidence)
    return evidence


def resign(evidence: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(evidence)
    result.pop("evidence_sha256", None)
    result["evidence_sha256"] = runtime.canonical_sha256(result)
    return result


def write_evidence(path: Path, evidence: dict[str, Any]) -> Path:
    runtime.write_json(path, evidence)
    return path
