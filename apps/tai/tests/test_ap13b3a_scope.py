from __future__ import annotations

import json
from pathlib import Path

SCOPE_PATH = (
    Path(__file__).resolve().parents[1]
    / "governance"
    / "scopes"
    / "ap-13b3a-2836.json"
)

EXPECTED_PATHS = {
    "apps/tai/governance/scopes/ap-13b3a-2836.json",
    "apps/tai/model-artifacts/README.md",
    "apps/tai/model-artifacts/local-model-artifact-bundle.schema.v2.json",
    "apps/tai/model-artifacts/mistral-7b-instruct-v0.3.bundle.v2.pending.json",
    "apps/tai/model-artifacts/model-bundle-acquisition-runbook.v2.md",
    "apps/tai/model-artifacts/model-bundle-authority.v2.json",
    "apps/tai/model-artifacts/qwen3-8b.bundle.v2.pending.json",
    "apps/tai/tai/model_artifact_registry_cli.py",
    "apps/tai/tai/model_bundle_v2.py",
    "apps/tai/tai/model_bundle_v2_common.py",
    "apps/tai/tai/model_bundle_v2_parse.py",
    "apps/tai/tai/model_bundle_v2_serialize.py",
    "apps/tai/tai/model_bundle_v2_types.py",
    "apps/tai/tai/model_bundle_v2_verify.py",
    "apps/tai/tests/test_ap13b3a_scope.py",
    "apps/tai/tests/model_bundle_v2_support.py",
    "apps/tai/tests/test_model_bundle_v2_adversarial.py",
    "apps/tai/tests/test_model_bundle_v2_contract.py",
}


def test_ap13b3a_scope_is_exact_and_fail_closed() -> None:
    scope = json.loads(SCOPE_PATH.read_text(encoding="utf-8"))

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b3a-model-bundle-authority"
    assert scope["status"] == "active"
    assert scope["parent_issue"] == 2835
    assert scope["issue"] == 2836
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert any(
        "every registered source weight shard" in item
        for item in scope["forbidden_capabilities"]
    )
    assert any("independent restore" in item for item in scope["acceptance"])
    assert any(
        "exact model_id, revision, source_uri" in item
        for item in scope["acceptance"]
    )
    assert any("ATTRIBUTED_RECORD" in item for item in scope["acceptance"])
    assert any("retention_expires_at" in item for item in scope["acceptance"])
    assert any("PENDING_ACQUISITION" in item for item in scope["acceptance"])
