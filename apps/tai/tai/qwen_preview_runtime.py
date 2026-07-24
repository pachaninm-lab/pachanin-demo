from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_COMMIT = re.compile(r"^[0-9a-f]{40}$")
_EXPECTED_LANGUAGES = ("RU", "EN", "ZH")
_EXPECTED_MATURITY = {
    "preview_status": "READ_ONLY_OPERATIONAL_PREVIEW_PENDING_EXTERNAL_IMMUTABILITY",
    "benchmark_status": "PENDING_BENCHMARK",
    "model_admission_status": "PENDING_ADMISSION",
    "routing_status": "NOT_ACTIVATED",
    "ui_status": "NOT_ACTIVATED",
    "deployment_status": "NOT_ACTIVATED",
    "production_operational_status": "NOT_ATTESTED",
}
_EXPECTED_CONVERSION_INPUT: dict[str, object] = {
    "exact_main_sha": "8bd494dc4954baaf699cffa243951392ff451ebb",
    "workflow_run_id": 29810648430,
    "workflow_run_attempt": 1,
    "root": (
        "/srv/tai-models/conversion-runs/"
        "8bd494dc4954baaf699cffa243951392ff451ebb/29810648430-1"
    ),
    "report_path": (
        "/srv/tai-models/conversion-runs/"
        "8bd494dc4954baaf699cffa243951392ff451ebb/29810648430-1/"
        "evidence/conversion-report.json"
    ),
    "conversion_authority_path": (
        "/srv/tai-models/conversion-runs/"
        "8bd494dc4954baaf699cffa243951392ff451ebb/29810648430-1/"
        "control/model-conversion-authority.v1.json"
    ),
    "conversion_authority_sha256": (
        "e7531a0d19fbdb92d14fa84d8bb3fd5a4a012ee61e3bf7cc632513bd435388f4"
    ),
    "step_report_path": (
        "/srv/tai-models/conversion-runs/"
        "8bd494dc4954baaf699cffa243951392ff451ebb/29810648430-1/"
        "evidence/steps/qwen3-8b-q4-k-m.json"
    ),
    "required_root_state": "COMPLETE",
    "required_report_status": (
        "CONVERSION_AND_QUANTIZATION_COMPLETE_PENDING_BUNDLE_RESTORE"
    ),
    "report_sha256": (
        "056c0203f382f6e3e1e57ebf145448cfddbff4718456fac7a2a84c6420185241"
    ),
    "source_model_id": "Qwen/Qwen3-8B",
    "source_revision": "895c8d171bc03c30e113cd7a28c02494b5e068b7",
    "required_step_key": "qwen3-8b-q4-k-m",
    "required_step_status": "COMPLETE",
    "output_path": "artifacts/qwen3-8b-q4-k-m.gguf",
    "model_sha256": (
        "107afd988cdbdcced3b8e76ebc3a8e83b5a18a5c796fca20778410cb9c47a814"
    ),
    "model_size_bytes": 5027784032,
}
_RAW_KEYS = {
    "prompt",
    "response",
    "raw_prompt",
    "raw_response",
    "content",
    "messages",
    "choices",
}


class PreviewRuntimeError(ValueError):
    pass


def _reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise PreviewRuntimeError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicates
        )
    except (OSError, json.JSONDecodeError, PreviewRuntimeError) as exc:
        raise PreviewRuntimeError(f"invalid JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise PreviewRuntimeError(f"JSON root must be an object: {path}")
    return value


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )


def canonical_sha256(value: object) -> str:
    rendered = json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )
    return hashlib.sha256(rendered.encode("utf-8")).hexdigest()


def _self_digest(value: dict[str, Any], field: str) -> str:
    unsigned = dict(value)
    unsigned.pop(field, None)
    return canonical_sha256(unsigned)


def _keys(value: dict[str, Any], expected: set[str], name: str) -> None:
    missing = sorted(expected - set(value))
    unknown = sorted(set(value) - expected)
    if missing or unknown:
        raise PreviewRuntimeError(
            f"{name} keys invalid; missing={missing!r}, unknown={unknown!r}"
        )


def _object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise PreviewRuntimeError(f"{name} must be an object")
    return value


def _array(value: object, name: str) -> list[Any]:
    if not isinstance(value, list):
        raise PreviewRuntimeError(f"{name} must be an array")
    return value


def _text(value: object, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise PreviewRuntimeError(f"{name} must be a non-blank string")
    return value


def _integer(value: object, name: str, minimum: int = 0) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        raise PreviewRuntimeError(f"{name} must be an integer >= {minimum}")
    return value


def _boolean(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise PreviewRuntimeError(f"{name} must be a boolean")
    return value


def _sha(value: object, name: str) -> str:
    text = _text(value, name)
    if _SHA256.fullmatch(text) is None:
        raise PreviewRuntimeError(f"{name} must be a lowercase SHA-256")
    return text


def _commit(value: object, name: str) -> str:
    text = _text(value, name)
    if _COMMIT.fullmatch(text) is None:
        raise PreviewRuntimeError(f"{name} must be an exact lowercase commit")
    return text


def _timestamp(value: object, name: str) -> datetime:
    text = _text(value, name)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise PreviewRuntimeError(f"{name} must be an ISO-8601 timestamp") from exc
    if parsed.utcoffset() is None:
        raise PreviewRuntimeError(f"{name} must be timezone-aware")
    return parsed.astimezone(UTC)


def _assert_no_raw_material(value: object, path: str = "evidence") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key in _RAW_KEYS:
                raise PreviewRuntimeError(f"raw material field forbidden: {path}.{key}")
            _assert_no_raw_material(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _assert_no_raw_material(child, f"{path}[{index}]")


def load_authority(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    _keys(
        raw,
        {
            "schema_version",
            "program_issue",
            "parent_issue",
            "issue",
            "command",
            "conversion_input",
            "model",
            "toolchain",
            "target",
            "limits",
            "generation",
            "smoke",
            "evidence",
            "maturity_boundary",
            "authority_sha256",
        },
        "authority",
    )
    if raw["schema_version"] != "tai.qwen-preview-runtime-authority.v1":
        raise PreviewRuntimeError("unsupported authority schema")
    issue_binding = (
        _integer(raw["program_issue"], "program_issue", 1),
        _integer(raw["parent_issue"], "parent_issue", 1),
        _integer(raw["issue"], "issue", 1),
    )
    if issue_binding != (2726, 2971, 3003):
        raise PreviewRuntimeError("authority issue binding mismatch")
    if raw["command"] != "/tai run qwen read-only preview exact-main":
        raise PreviewRuntimeError("authority command mismatch")

    conversion_input = _object(raw["conversion_input"], "conversion_input")
    _keys(
        conversion_input,
        set(_EXPECTED_CONVERSION_INPUT),
        "conversion_input",
    )
    if conversion_input != _EXPECTED_CONVERSION_INPUT:
        raise PreviewRuntimeError("conversion input authority mismatch")

    model = _object(raw["model"], "model")
    _keys(
        model,
        {
            "key",
            "model_id",
            "revision",
            "role",
            "quantization",
            "conversion_output_path",
            "required_conversion_status",
        },
        "model",
    )
    expected_model = {
        "key": "qwen3-8b",
        "model_id": "Qwen/Qwen3-8B",
        "revision": "895c8d171bc03c30e113cd7a28c02494b5e068b7",
        "role": "PRIMARY",
        "quantization": "Q4_K_M",
        "conversion_output_path": "artifacts/qwen3-8b-q4-k-m.gguf",
        "required_conversion_status": (
            "CONVERSION_AND_QUANTIZATION_COMPLETE_PENDING_BUNDLE_RESTORE"
        ),
    }
    if model != expected_model:
        raise PreviewRuntimeError("model authority mismatch")

    toolchain = _object(raw["toolchain"], "toolchain")
    _keys(
        toolchain,
        {"release", "profile", "llama_server_sha256", "llama_server_size_bytes"},
        "toolchain",
    )
    expected_toolchain = {
        "release": "b9637",
        "profile": "linux-x86_64-cpu-release-static-v1",
        "llama_server_sha256": (
            "1b26384ad90d9ae8fe65b2a3e2dfd08c70d92663b2127d5f479f34774b4a6dbf"
        ),
        "llama_server_size_bytes": 12940416,
    }
    if toolchain != expected_toolchain:
        raise PreviewRuntimeError("toolchain authority mismatch")

    target = _object(raw["target"], "target")
    _keys(
        target,
        {"host_role", "required_user", "workspace_root", "listen_host", "listen_port"},
        "target",
    )
    expected_target = {
        "host_role": "DEDICATED_MODEL_HOST",
        "required_user": "tai-model",
        "workspace_root": "/srv/tai-models",
        "listen_host": "127.0.0.1",
        "listen_port": 18080,
    }
    if target != expected_target:
        raise PreviewRuntimeError("target must remain dedicated and loopback-only")

    limits = _object(raw["limits"], "limits")
    _keys(
        limits,
        {
            "context_tokens",
            "max_output_tokens",
            "request_timeout_seconds",
            "startup_timeout_seconds",
            "max_rss_bytes",
            "parallel_requests",
            "max_queued_requests",
        },
        "limits",
    )
    expected_limits = {
        "context_tokens": 4096,
        "max_output_tokens": 128,
        "request_timeout_seconds": 120,
        "startup_timeout_seconds": 180,
        "max_rss_bytes": 12000000000,
        "parallel_requests": 1,
        "max_queued_requests": 0,
    }
    if limits != expected_limits:
        raise PreviewRuntimeError("runtime limits drift")

    generation = _object(raw["generation"], "generation")
    if generation != {"temperature": 0, "top_p": 1, "seed": 42}:
        raise PreviewRuntimeError("generation must remain deterministic")

    smoke = _object(raw["smoke"], "smoke")
    _keys(smoke, {"languages", "endpoint", "require_non_empty_response"}, "smoke")
    expected_smoke = {
        "languages": list(_EXPECTED_LANGUAGES),
        "endpoint": "/v1/chat/completions",
        "require_non_empty_response": True,
    }
    if smoke != expected_smoke:
        raise PreviewRuntimeError("smoke contract mismatch")

    evidence = _object(raw["evidence"], "evidence")
    expected_evidence = {
        "schema_version": "tai.qwen-preview-runtime-evidence.v1",
        "raw_material_in_artifact": False,
        "retention_days": 90,
    }
    if evidence != expected_evidence:
        raise PreviewRuntimeError("evidence boundary mismatch")
    if _object(raw["maturity_boundary"], "maturity_boundary") != _EXPECTED_MATURITY:
        raise PreviewRuntimeError("maturity boundary escalated")

    declared = _sha(raw["authority_sha256"], "authority_sha256")
    if declared != _self_digest(raw, "authority_sha256"):
        raise PreviewRuntimeError("authority self digest mismatch")
    return raw


def load_pending(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    _keys(
        raw,
        {
            "schema_version",
            "status",
            "accepted",
            "protected_access_used",
            "reasons",
            "maturity_boundary",
        },
        "pending",
    )
    if (
        raw["schema_version"] != "tai.qwen-preview-runtime-pending.v1"
        or raw["status"] != "PENDING_PROTECTED_EXECUTION"
    ):
        raise PreviewRuntimeError("pending baseline status mismatch")
    if _boolean(raw["accepted"], "accepted") or _boolean(
        raw["protected_access_used"], "protected_access_used"
    ):
        raise PreviewRuntimeError("pending baseline cannot claim execution")
    if not _array(raw["reasons"], "reasons"):
        raise PreviewRuntimeError("pending baseline must explain blockers")
    if _object(raw["maturity_boundary"], "maturity_boundary") != _EXPECTED_MATURITY:
        raise PreviewRuntimeError("pending maturity boundary escalated")
    return raw


def verify_evidence(
    authority_path: Path,
    evidence_path: Path,
    *,
    exact_main: str,
    evaluated_at: str,
) -> dict[str, Any]:
    authority = load_authority(authority_path)
    evidence = load_json(evidence_path)
    _assert_no_raw_material(evidence)
    _keys(
        evidence,
        {
            "schema_version",
            "status",
            "accepted",
            "exact_main_sha",
            "authority_sha256",
            "executed_at",
            "workflow",
            "host",
            "model",
            "toolchain",
            "limits",
            "runtime",
            "smoke",
            "cleanup",
            "maturity_boundary",
            "reasons",
            "evidence_sha256",
        },
        "evidence",
    )
    if (
        evidence["schema_version"] != authority["evidence"]["schema_version"]
        or evidence["status"] != _EXPECTED_MATURITY["preview_status"]
        or not _boolean(evidence["accepted"], "accepted")
    ):
        raise PreviewRuntimeError("evidence status mismatch")
    if _commit(exact_main, "exact_main") != _commit(
        evidence["exact_main_sha"], "exact_main_sha"
    ):
        raise PreviewRuntimeError("exact-main mismatch")
    if (
        _sha(evidence["authority_sha256"], "authority_sha256")
        != authority["authority_sha256"]
    ):
        raise PreviewRuntimeError("authority digest mismatch")

    now = _timestamp(evaluated_at, "evaluated_at")
    executed = _timestamp(evidence["executed_at"], "executed_at")
    if executed > now + timedelta(minutes=5) or now - executed > timedelta(hours=24):
        raise PreviewRuntimeError("evidence freshness invalid")

    workflow = _object(evidence["workflow"], "workflow")
    _keys(workflow, {"run_id", "run_attempt"}, "workflow")
    _integer(workflow["run_id"], "workflow.run_id", 1)
    _integer(workflow["run_attempt"], "workflow.run_attempt", 1)

    host = _object(evidence["host"], "host")
    _keys(
        host,
        {
            "role",
            "user",
            "workspace_root",
            "hostname_sha256",
            "listen_host",
            "listen_port",
            "listener_before",
            "listener_during",
            "listener_after",
            "public_listener",
        },
        "host",
    )
    target = authority["target"]
    host_binding = (
        host["role"],
        host["user"],
        host["workspace_root"],
        host["listen_host"],
        host["listen_port"],
    )
    expected_host_binding = (
        target["host_role"],
        target["required_user"],
        target["workspace_root"],
        target["listen_host"],
        target["listen_port"],
    )
    if host_binding != expected_host_binding:
        raise PreviewRuntimeError("host binding mismatch")
    _sha(host["hostname_sha256"], "host.hostname_sha256")
    invalid_listener_lifecycle = (
        _boolean(host["listener_before"], "listener_before"),
        not _boolean(host["listener_during"], "listener_during"),
        _boolean(host["listener_after"], "listener_after"),
        _boolean(host["public_listener"], "public_listener"),
    )
    if any(invalid_listener_lifecycle):
        raise PreviewRuntimeError("loopback listener lifecycle invalid")

    model = _object(evidence["model"], "model")
    _keys(
        model,
        {
            "model_id",
            "revision",
            "quantization",
            "path_label",
            "sha256",
            "size_bytes",
            "conversion_report_sha256",
            "conversion_status",
        },
        "model",
    )
    expected_model = authority["model"]
    model_binding = (
        model["model_id"],
        model["revision"],
        model["quantization"],
        model["path_label"],
        model["conversion_status"],
    )
    expected_model_binding = (
        expected_model["model_id"],
        expected_model["revision"],
        expected_model["quantization"],
        expected_model["conversion_output_path"],
        expected_model["required_conversion_status"],
    )
    if model_binding != expected_model_binding:
        raise PreviewRuntimeError("model identity mismatch")
    model_sha256 = _sha(model["sha256"], "model.sha256")
    conversion_report_sha256 = _sha(
        model["conversion_report_sha256"],
        "model.conversion_report_sha256",
    )
    model_size_bytes = _integer(model["size_bytes"], "model.size_bytes", 1)
    conversion_input = authority["conversion_input"]
    if (
        model_sha256 != conversion_input["model_sha256"]
        or model_size_bytes != conversion_input["model_size_bytes"]
        or conversion_report_sha256 != conversion_input["report_sha256"]
    ):
        raise PreviewRuntimeError("model conversion provenance mismatch")

    toolchain = _object(evidence["toolchain"], "toolchain")
    if toolchain != authority["toolchain"]:
        raise PreviewRuntimeError("toolchain evidence mismatch")
    if _object(evidence["limits"], "limits") != authority["limits"]:
        raise PreviewRuntimeError("runtime limits mismatch")

    runtime = _object(evidence["runtime"], "runtime")
    _keys(
        runtime,
        {
            "health_status",
            "startup_ms",
            "peak_rss_bytes",
            "active_requests",
            "queued_requests",
        },
        "runtime",
    )
    if (
        runtime["health_status"] != "READY"
        or _integer(runtime["active_requests"], "active_requests") > 1
        or _integer(runtime["queued_requests"], "queued_requests") != 0
    ):
        raise PreviewRuntimeError("runtime readiness or concurrency invalid")
    startup_ms = _integer(runtime["startup_ms"], "startup_ms", 1)
    peak_rss_bytes = _integer(runtime["peak_rss_bytes"], "peak_rss_bytes", 1)
    if (
        startup_ms > authority["limits"]["startup_timeout_seconds"] * 1000
        or peak_rss_bytes > authority["limits"]["max_rss_bytes"]
    ):
        raise PreviewRuntimeError("runtime resource limit exceeded")

    smoke = _array(evidence["smoke"], "smoke")
    if len(smoke) != len(_EXPECTED_LANGUAGES):
        raise PreviewRuntimeError("smoke language coverage incomplete")
    observed: set[str] = set()
    for index, item_raw in enumerate(smoke):
        item = _object(item_raw, f"smoke[{index}]")
        _keys(
            item,
            {
                "language",
                "prompt_sha256",
                "response_sha256",
                "elapsed_ms",
                "http_status",
                "prompt_tokens",
                "completion_tokens",
                "total_tokens",
                "response_bytes",
            },
            f"smoke[{index}]",
        )
        language = _text(item["language"], f"smoke[{index}].language")
        observed.add(language)
        _sha(item["prompt_sha256"], "prompt_sha256")
        _sha(item["response_sha256"], "response_sha256")
        elapsed_ms = _integer(item["elapsed_ms"], "elapsed_ms", 1)
        if (
            _integer(item["http_status"], "http_status") != 200
            or elapsed_ms > authority["limits"]["request_timeout_seconds"] * 1000
        ):
            raise PreviewRuntimeError("smoke request failed or timed out")
        completion = _integer(item["completion_tokens"], "completion_tokens", 1)
        prompt = _integer(item["prompt_tokens"], "prompt_tokens", 1)
        total_tokens = _integer(item["total_tokens"], "total_tokens", 1)
        response_bytes = _integer(item["response_bytes"], "response_bytes", 1)
        if (
            completion > authority["limits"]["max_output_tokens"]
            or total_tokens != prompt + completion
            or response_bytes > 65536
        ):
            raise PreviewRuntimeError("smoke token or payload bound exceeded")
    if observed != set(_EXPECTED_LANGUAGES):
        raise PreviewRuntimeError("smoke languages mismatch")

    cleanup = _object(evidence["cleanup"], "cleanup")
    expected_cleanup = {
        "raw_deleted": True,
        "process_stopped": True,
        "listener_removed": True,
        "rollback_verified": True,
    }
    if cleanup != expected_cleanup:
        raise PreviewRuntimeError("cleanup or rollback proof missing")
    if _object(
        evidence["maturity_boundary"], "maturity_boundary"
    ) != _EXPECTED_MATURITY or _array(evidence["reasons"], "reasons"):
        raise PreviewRuntimeError("maturity or reasons invalid")

    declared = _sha(evidence["evidence_sha256"], "evidence_sha256")
    if declared != _self_digest(evidence, "evidence_sha256"):
        raise PreviewRuntimeError("evidence self digest mismatch")
    return evidence


MATURITY = dict(_EXPECTED_MATURITY)
