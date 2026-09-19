from __future__ import annotations

import json
from pathlib import Path

SCOPE_PATH = (
    Path(__file__).resolve().parents[1]
    / "governance"
    / "scopes"
    / "ap-15a-2823.json"
)

EXPECTED_PATHS = {
    "apps/tai/governance/scopes/ap-15a-2823.json",
    "apps/tai/tai/retrieval_index.py",
    "apps/tai/tai/semantic_retrieval.py",
    "apps/tai/tai/hybrid_retrieval.py",
    "apps/tai/tai/retrieval_benchmark.py",
    "apps/tai/tests/test_ap15a_scope.py",
    "apps/tai/tests/test_semantic_retrieval.py",
    "apps/tai/tests/test_hybrid_retrieval.py",
    "apps/tai/tests/test_retrieval_benchmark.py",
}


def test_ap15a_scope_is_exact_and_fail_closed() -> None:
    scope = json.loads(SCOPE_PATH.read_text(encoding="utf-8"))

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-15a-hybrid-retrieval-authority"
    assert scope["status"] == "active"
    assert scope["parent_issue"] == 2726
    assert scope["issue"] == 2823
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert "synthetic benchmark promoted to operational evidence" in scope[
        "forbidden_capabilities"
    ]
    assert "production default switch from lexical to hybrid retrieval" in scope[
        "forbidden_capabilities"
    ]
