from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).parents[1]
ACCEPTANCE_PATH = ROOT / "model-artifacts" / "llama-cpp-build-acceptance.v1.json"
LOCATOR_PATH = (
    ROOT / "model-artifacts" / "llama-cpp-build-artifact-locator.accepted.v1.json"
)
SCOPE_PATH = (
    ROOT / "governance" / "scopes" / "ap-13b2b-build-acceptance-2832.json"
)

AUTHORITY_SHA256 = "3064250e63baed7bdcfd20851e1d3ea2c86fc33f087b69a2a4fcff18c384374b"
BUILD_SHA = "637d36f7e9bb152ee3c7b22545a9a83eca3e4388"
ACCEPTANCE_BASE_SHA = "b411a960cc259919e701704bfa652bd06d33c7d8"
EXPECTED_TARGETS = {
    "llama-cli": (
        12_399_720,
        "1f97b492e7739ec9e10b9a7da5317a27b70845873d060b7ede2c2d2f3e92f849",
    ),
    "llama-server": (
        12_940_416,
        "1b26384ad90d9ae8fe65b2a3e2dfd08c70d92663b2127d5f479f34774b4a6dbf",
    ),
    "llama-quantize": (
        5_616_560,
        "77ae93aca41abd98f6b1e63478c09de77ab558d11d6cea6f1f53949310920e20",
    ),
    "llama-bench": (
        10_023_592,
        "eac9d7ee5e75a84668755caf44a09d3e1c5907d2b88fab205c27ad1e57bef335",
    ),
}
EXPECTED_PATHS = {
    "apps/tai/governance/scopes/ap-13b2b-build-acceptance-2832.json",
    "apps/tai/model-artifacts/llama-cpp-build-acceptance.v1.json",
    "apps/tai/model-artifacts/llama-cpp-build-artifact-locator.accepted.v1.json",
    "apps/tai/tests/test_llama_toolchain_build_acceptance.py",
}


def _load(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_acceptance_binds_the_successful_exact_main_build() -> None:
    acceptance = _load(ACCEPTANCE_PATH)

    assert acceptance["schema_version"] == "tai.llama-cpp-build-acceptance.v1"
    assert acceptance["status"] == "VERIFIED_RESTORED"
    assert acceptance["issue"] == 2832
    assert acceptance["authority"]["authority_sha256"] == AUTHORITY_SHA256
    assert acceptance["authority"]["commit"] == (
        "aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3"
    )
    assert acceptance["build_run"] == {
        "actor": "pachaninm-lab",
        "command": "/tai build llama-cpp exact-main",
        "completed_at": "2026-07-20T08:18:51Z",
        "event": "issue_comment",
        "repository_sha": BUILD_SHA,
        "run_attempt": 1,
        "run_id": 29727061145,
        "started_at": "2026-07-20T08:12:01Z",
        "triggering_actor": "pachaninm-lab",
        "workflow_name": "TAI llama.cpp Exact Source Build",
        "workflow_path": ".github/workflows/tai-llama-toolchain-build.yml",
    }


def test_acceptance_records_only_metadata_for_all_four_binaries() -> None:
    acceptance = _load(ACCEPTANCE_PATH)
    binaries = acceptance["evidence"]["binaries"]

    observed = {
        entry["target"]: (entry["size_bytes"], entry["sha256"])
        for entry in binaries
    }
    assert observed == EXPECTED_TARGETS
    assert acceptance["evidence"]["verified_targets"] == [
        "llama-bench",
        "llama-cli",
        "llama-quantize",
        "llama-server",
    ]
    for entry in binaries:
        assert entry["path"].startswith("build/llama.cpp-b9637/bin/")
        assert not (ROOT / entry["path"]).exists()


def test_locator_and_external_artifact_identities_are_exact() -> None:
    acceptance = _load(ACCEPTANCE_PATH)
    locator = _load(LOCATOR_PATH)
    artifacts = acceptance["external_artifacts"]

    assert _sha256(LOCATOR_PATH) == (
        artifacts["locator_artifact"]["committed_locator_sha256"]
    )
    assert locator["status"] == "VERIFIED_RESTORED"
    assert locator["repository_sha"] == BUILD_SHA
    assert locator["workflow_run_id"] == "29727061145"
    assert locator["workflow_run_attempt"] == "1"
    assert locator["artifact"]["id"] == "8454821423"
    assert locator["artifact"]["digest"] == (
        "807f815e0265096150d87b4ff289d02e26fcd1d83cca891957c66a4e39054e52"
    )
    assert artifacts["package_artifact"]["api_digest"] == (
        "sha256:807f815e0265096150d87b4ff289d02e26fcd1d83cca891957c66a4e39054e52"
    )
    assert artifacts["locator_artifact"]["api_digest"] == (
        "sha256:db5f9213178f3bdd3e24c2e28fa979df705ebd78e03d4f9217f3fea5412e6227"
    )
    assert artifacts["package_artifact"]["expires_at"] == "2026-10-18T08:12:02Z"
    assert artifacts["locator_artifact"]["expires_at"] == "2026-10-18T08:12:02Z"


def test_restored_verification_and_authority_continuity_fail_closed() -> None:
    acceptance = _load(ACCEPTANCE_PATH)
    locator = _load(LOCATOR_PATH)

    restored = locator["restored_verification"]["content"]
    assert restored["status"] == "VERIFIED"
    assert restored["reasons"] == []
    assert restored["authority_sha256"] == AUTHORITY_SHA256
    assert acceptance["restore"]["independent_reverification"] is True
    assert acceptance["authority_continuity"] == {
        "acceptance_base_sha": ACCEPTANCE_BASE_SHA,
        "authority_changed": False,
        "build_repository_sha": BUILD_SHA,
        "changed_paths": [
            "apps/web/app/platform-v7/layout.tsx",
            "apps/web/app/platform-v7/page.tsx",
            "apps/web/tests/unit/platformV7PublicAiRouteAuthority.test.ts",
            "docs/platform-v7/autopilot/scopes/fix-public-ai-layout-authority.json",
            "scripts/p7-autopilot-guard.sh",
        ],
        "commits_after_build": 7,
        "compare_status": "ahead",
    }


def test_maturity_boundary_does_not_admit_models_or_production() -> None:
    acceptance = _load(ACCEPTANCE_PATH)
    maturity = acceptance["maturity_boundary"]

    assert maturity["model_acquisition"] == "PENDING_ACQUISITION"
    assert maturity["legal_review"] == "NOT_DONE"
    assert maturity["benchmarks"] == "NOT_DONE"
    assert maturity["model_admission"] == "NOT_DONE"
    assert maturity["production_operational_status"] == "NOT_ATTESTED"
    assert "model admitted" in maturity["forbidden_claims"]
    assert "operationally attested" in maturity["forbidden_claims"]


def test_scope_is_exact_and_forbids_large_or_privileged_artifacts() -> None:
    scope = _load(SCOPE_PATH)

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b2b-build-acceptance"
    assert scope["issue"] == 2832
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert "committed source archive, build package, log or compiled binary" in scope[
        "forbidden_capabilities"
    ]
    assert "production readiness or operational attestation claim" in scope[
        "forbidden_capabilities"
    ]
