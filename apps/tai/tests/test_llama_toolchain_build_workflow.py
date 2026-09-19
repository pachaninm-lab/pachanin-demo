from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).parents[3]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-llama-toolchain-build.yml"
SCOPE_PATH = (
    Path(__file__).parents[1]
    / "governance"
    / "scopes"
    / "ap-13b2b-2832.json"
)

EXPECTED_PATHS = {
    ".github/workflows/tai-llama-toolchain-build.yml",
    "apps/tai/governance/scopes/ap-13b2b-2832.json",
    "apps/tai/tests/test_llama_toolchain_build_workflow.py",
}

COMMIT = "aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3"
AUTHORITY_SHA256 = "3064250e63baed7bdcfd20851e1d3ea2c86fc33f087b69a2a4fcff18c384374b"


def test_ap13b2b_scope_is_exact_and_does_not_claim_a_completed_build() -> None:
    scope = json.loads(SCOPE_PATH.read_text(encoding="utf-8"))

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b2b-controlled-build-workflow"
    assert scope["status"] == "active"
    assert scope["parent_issue"] == 2726
    assert scope["issue"] == 2832
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert any("does not close issue 2832" in item for item in scope["acceptance"])
    assert "production readiness or operational attestation claim" in scope[
        "forbidden_capabilities"
    ]


def test_build_workflow_is_owner_only_exact_main_and_non_automatic() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert "workflow_dispatch:" in workflow
    assert "issue_comment:" in workflow
    assert "types: [created]" in workflow
    assert "pull_request:" not in workflow
    assert "push:" not in workflow
    assert "schedule:" not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert "github.actor == github.repository_owner" in workflow
    assert "github.triggering_actor == github.repository_owner" in workflow
    assert "github.event.issue.pull_request == null" in workflow
    assert "github.event.issue.number == 2832" in workflow
    assert "github.event.comment.body == '/tai build llama-cpp exact-main'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "github.event.comment.user.login == github.repository_owner" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "runs-on: ubuntu-24.04" in workflow


def test_build_workflow_has_read_only_credentials_and_no_secret_surface() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert "permissions:\n  contents: read\n  actions: read" in workflow
    assert "contents: write" not in workflow
    assert "actions: write" not in workflow
    assert "id-token: write" not in workflow
    assert "packages: write" not in workflow
    assert "secrets." not in workflow
    assert workflow.count("persist-credentials: false") == 2
    assert "repository: ggml-org/llama.cpp" in workflow
    assert f"ref: {COMMIT}" in workflow
    assert "clean: true" in workflow
    assert "lfs: false" in workflow
    assert "submodules: false" in workflow
    assert "Persisted Git authentication header is forbidden." in workflow


def test_build_workflow_binds_exact_authority_and_source_archive() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert "LLAMA_RELEASE: b9637" in workflow
    assert f"LLAMA_COMMIT: {COMMIT}" in workflow
    assert f"LLAMA_AUTHORITY_SHA256: {AUTHORITY_SHA256}" in workflow
    assert f'assert authority.commit == "{COMMIT}"' in workflow
    assert f'assert authority.authority_sha256 == "{AUTHORITY_SHA256}"' in workflow
    assert 'test "$(git -C repository rev-parse HEAD)" = "$GITHUB_SHA"' in workflow
    assert (
        'test "$(git -C repository rev-parse refs/remotes/origin/main)" = '
        '"$GITHUB_SHA"'
    ) in workflow
    assert 'test "$(git -C "$evidence_root/source/llama.cpp" rev-parse HEAD)" = ' in workflow
    assert '"$LLAMA_COMMIT"' in workflow
    assert '"$LLAMA_REPOSITORY/archive/$LLAMA_COMMIT.tar.gz"' in workflow
    assert "--proto '=https'" in workflow
    assert "--tlsv1.2" in workflow


def test_build_workflow_executes_the_exact_governed_configure_argv() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    configure = workflow[
        workflow.index("      - name: Configure exact governed build") : workflow.index(
            "      - name: Build exactly four governed targets"
        )
    ]

    expected_tokens = [
        "cmake \\",
        "-S source/llama.cpp \\",
        "-B build/llama.cpp-b9637 \\",
        "-G Ninja \\",
        "-DCMAKE_BUILD_TYPE=Release \\",
        "-DBUILD_SHARED_LIBS=OFF \\",
        "-DLLAMA_BUILD_COMMON=ON \\",
        "-DLLAMA_BUILD_TESTS=OFF \\",
        "-DLLAMA_BUILD_EXAMPLES=OFF \\",
        "-DLLAMA_BUILD_TOOLS=ON \\",
        "-DLLAMA_BUILD_SERVER=ON \\",
        "-DLLAMA_BUILD_APP=OFF \\",
        "-DLLAMA_BUILD_UI=OFF \\",
        "-DLLAMA_USE_PREBUILT_UI=OFF \\",
        "-DLLAMA_TOOLS_INSTALL=OFF \\",
        "-DLLAMA_OPENSSL=OFF \\",
        "-DLLAMA_LLGUIDANCE=OFF \\",
        "-DGGML_NATIVE=OFF \\",
    ]
    for token in expected_tokens:
        assert token in configure
    assert "CC: /usr/bin/cc" in configure
    assert "CXX: /usr/bin/c++" in configure
    assert "> evidence/configure.log 2>&1" in configure


def test_build_workflow_builds_only_the_four_governed_targets() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    build = workflow[
        workflow.index("      - name: Build exactly four governed targets") : workflow.index(
            "      - name: Reconfirm clean exact source and collect evidence"
        )
    ]

    assert "--build build/llama.cpp-b9637 \\" in build
    assert "--config Release \\" in build
    assert "--target \\" in build
    for target in ("llama-cli", "llama-server", "llama-quantize", "llama-bench"):
        assert f"            {target} \\" in build
        assert f"build/llama.cpp-b9637/bin/{target}" in build
    assert "--parallel 2 \\" in build
    assert "> evidence/build.log 2>&1" in build


def test_build_workflow_collects_verifies_packages_restores_and_reverifies() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert workflow.count("collect-toolchain-evidence") == 1
    assert workflow.count("verify-toolchain") == 2
    assert "llama-cpp-build.v1.json" in workflow
    assert "llama-cpp-verification.v1.json" in workflow
    assert "git-status.txt" in workflow
    assert "test ! -s \"$evidence_root/evidence/git-status.txt\"" in workflow
    assert "--sort=name" in workflow
    assert "--mtime='UTC 1970-01-01'" in workflow
    assert "--numeric-owner" in workflow
    assert "gzip -n -9" in workflow
    assert "llama-cpp-b9637-evidence.tar.gz.sha256" in workflow
    assert "sha256sum -c llama-cpp-b9637-evidence.tar.gz.sha256" in workflow
    assert 'index["repository_sha"] == os.environ["REPOSITORY_SHA"]' in workflow
    assert 'index["workflow_run_id"] == os.environ["RUN_ID"]' in workflow
    assert 'index["workflow_run_attempt"] == os.environ["RUN_ATTEMPT"]' in workflow
    assert "actions/upload-artifact@v4" in workflow
    assert "actions/download-artifact@v4" in workflow
    assert workflow.index("Upload immutable exact-main build package") < workflow.index(
        "Restore uploaded package for independent verification"
    )
    assert workflow.index("Verify restored immutable package") < workflow.index(
        "Create machine-readable artifact locator"
    )
    assert workflow.count("retention-days: 90") == 2
    assert "overwrite: false" in workflow
    assert "VERIFIED_RESTORED" in workflow


def test_workflow_preserves_fail_closed_maturity_boundary() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    forbidden = [
        "huggingface.co/Qwen",
        "huggingface.co/mistralai",
        "llama-quantize artifacts/",
        "ADMITTED",
        "production_attestation",
        "NOT_ATTESTED = false",
    ]
    for value in forbidden:
        assert value not in workflow
