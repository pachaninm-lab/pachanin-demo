from __future__ import annotations

import json
from pathlib import Path

SCOPE_PATH = Path(__file__).resolve().parents[1] / "governance" / "scopes" / "ap-13b2a-2828.json"

EXPECTED_PATHS = {
    "apps/tai/governance/scopes/ap-13b2a-2828.json",
    "apps/tai/model-artifacts/README.md",
    "apps/tai/model-artifacts/candidates.v1.json",
    "apps/tai/model-artifacts/llama-cpp-build-baseline.v1.json",
    "apps/tai/model-artifacts/llama-cpp-build-evidence.schema.v1.json",
    "apps/tai/model-artifacts/llama-cpp-source-build-runbook.md",
    "apps/tai/model-artifacts/llama-cpp-toolchain-authority.v1.json",
    "apps/tai/tai/llama_toolchain.py",
    "apps/tai/tai/llama_toolchain_collect.py",
    "apps/tai/tai/llama_toolchain_contract.py",
    "apps/tai/tai/llama_toolchain_types.py",
    "apps/tai/tai/llama_toolchain_verify.py",
    "apps/tai/tai/model_artifact_registry_cli.py",
    "apps/tai/tests/test_ap13b2a_scope.py",
    "apps/tai/tests/test_llama_toolchain.py",
    "apps/tai/tests/test_llama_toolchain_contracts.py",
}


def test_ap13b2a_scope_is_exact_and_fail_closed() -> None:
    scope = json.loads(SCOPE_PATH.read_text(encoding="utf-8"))

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b2a-llama-toolchain-authority"
    assert scope["status"] == "active"
    assert scope["parent_issue"] == 2726
    assert scope["issue"] == 2828
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert (
        "execution of configure, build or other argv read from a manifest by the verifier"
        in scope["forbidden_capabilities"]
    )
    assert (
        "production readiness or operational attestation claim" in scope["forbidden_capabilities"]
    )
    assert any("PENDING_BUILD" in item for item in scope["acceptance"])
