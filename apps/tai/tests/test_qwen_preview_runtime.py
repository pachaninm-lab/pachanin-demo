from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

import pytest

from tai import qwen_preview_runtime as runtime
from tests.qwen_preview_runtime_fixtures import (
    EVALUATED_AT,
    EXACT_MAIN,
    authority_path,
    pending_path,
    resign,
    valid_evidence,
    write_evidence,
)

Mutation = Callable[[dict[str, Any]], None]


def _verify(tmp_path: Path, evidence: dict[str, Any]) -> dict[str, Any]:
    path = write_evidence(tmp_path / "evidence.json", evidence)
    return runtime.verify_evidence(
        authority_path(), path, exact_main=EXACT_MAIN, evaluated_at=EVALUATED_AT
    )


def test_authority_pending_and_valid_evidence(tmp_path: Path) -> None:
    authority = runtime.load_authority(authority_path())
    assert authority["authority_sha256"] == "f7e25bfbcc8d39249d918c6800365734ab889e5d47f6e053c2df11214db461cb"
    pending = runtime.load_pending(pending_path())
    assert pending["accepted"] is False
    evidence = _verify(tmp_path, valid_evidence())
    assert evidence["accepted"] is True
    assert {item["language"] for item in evidence["smoke"]} == {"RU", "EN", "ZH"}


def _set(path: tuple[str | int, ...], value: object) -> Mutation:
    def mutate(payload: dict[str, Any]) -> None:
        current: Any = payload
        for key in path[:-1]:
            current = current[key]
        current[path[-1]] = value

    return mutate


@pytest.mark.parametrize(
    ("mutation", "match"),
    [
        (_set(("exact_main_sha",), "b" * 40), "exact-main"),
        (_set(("authority_sha256",), "e" * 64), "authority digest"),
        (_set(("executed_at",), "2026-07-20T00:00:00+00:00"), "freshness"),
        (_set(("host", "user"), "root"), "host binding"),
        (_set(("host", "listener_before"), True), "listener lifecycle"),
        (_set(("host", "listener_during"), False), "listener lifecycle"),
        (_set(("host", "listener_after"), True), "listener lifecycle"),
        (_set(("host", "public_listener"), True), "listener lifecycle"),
        (_set(("model", "model_id"), "other/model"), "model identity"),
        (_set(("toolchain", "release"), "latest"), "toolchain"),
        (_set(("limits", "context_tokens"), 8192), "runtime limits"),
        (_set(("runtime", "health_status"), "STARTING"), "readiness"),
        (_set(("runtime", "queued_requests"), 1), "readiness"),
        (_set(("runtime", "startup_ms"), 180001), "resource limit"),
        (_set(("runtime", "peak_rss_bytes"), 12000000001), "resource limit"),
        (_set(("smoke", 0, "http_status"), 500), "failed or timed out"),
        (_set(("smoke", 0, "elapsed_ms"), 120001), "failed or timed out"),
        (_set(("smoke", 0, "completion_tokens"), 129), "token or payload"),
        (_set(("smoke", 0, "response_bytes"), 65537), "token or payload"),
        (_set(("cleanup", "raw_deleted"), False), "cleanup"),
        (_set(("maturity_boundary", "production_operational_status"), "ATTESTED"), "maturity"),
    ],
)
def test_fail_closed_mutations(
    tmp_path: Path, mutation: Mutation, match: str
) -> None:
    evidence = valid_evidence()
    mutation(evidence)
    with pytest.raises(runtime.PreviewRuntimeError, match=match):
        _verify(tmp_path, resign(evidence))


def test_incomplete_duplicate_and_raw_evidence_are_rejected(tmp_path: Path) -> None:
    evidence = valid_evidence()
    evidence["smoke"] = evidence["smoke"][:2]
    with pytest.raises(runtime.PreviewRuntimeError, match="coverage"):
        _verify(tmp_path, resign(evidence))

    evidence = valid_evidence()
    evidence["smoke"][2]["language"] = "EN"
    with pytest.raises(runtime.PreviewRuntimeError, match="languages"):
        _verify(tmp_path, resign(evidence))

    evidence = valid_evidence()
    evidence["raw_response"] = "forbidden"
    with pytest.raises(runtime.PreviewRuntimeError, match="raw material"):
        _verify(tmp_path, resign(evidence))

    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text('{"schema_version":"x","schema_version":"y"}', encoding="utf-8")
    with pytest.raises(runtime.PreviewRuntimeError, match="duplicate JSON key"):
        runtime.load_json(duplicate)


def test_self_digest_unknown_keys_and_pending_escalation_fail(tmp_path: Path) -> None:
    evidence = valid_evidence()
    evidence["evidence_sha256"] = "f" * 64
    with pytest.raises(runtime.PreviewRuntimeError, match="self digest"):
        _verify(tmp_path, evidence)

    evidence = valid_evidence()
    evidence["unknown"] = True
    with pytest.raises(runtime.PreviewRuntimeError, match="keys invalid"):
        _verify(tmp_path, resign(evidence))

    pending = runtime.load_json(pending_path())
    pending["accepted"] = True
    path = tmp_path / "pending.json"
    runtime.write_json(path, pending)
    with pytest.raises(runtime.PreviewRuntimeError, match="cannot claim"):
        runtime.load_pending(path)


def test_authority_digest_and_model_drift_fail(tmp_path: Path) -> None:
    authority = runtime.load_json(authority_path())
    authority["authority_sha256"] = "0" * 64
    path = tmp_path / "authority.json"
    runtime.write_json(path, authority)
    with pytest.raises(runtime.PreviewRuntimeError, match="self digest"):
        runtime.load_authority(path)

    authority = runtime.load_json(authority_path())
    authority["model"]["quantization"] = "Q8_0"
    authority.pop("authority_sha256")
    authority["authority_sha256"] = runtime.canonical_sha256(authority)
    runtime.write_json(path, authority)
    with pytest.raises(runtime.PreviewRuntimeError, match="model authority"):
        runtime.load_authority(path)
