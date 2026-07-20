from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-model-host-preflight.yml"
REQUIREMENTS_PATH = (
    TAI_ROOT / "model-artifacts" / "model-host-preflight-requirements.v1.json"
)
SCOPE_PATH = (
    TAI_ROOT / "governance" / "scopes" / "ap-13b3-model-host-preflight-2835.json"
)
BUILD_ACCEPTANCE_PATH = (
    TAI_ROOT / "model-artifacts" / "llama-cpp-build-acceptance.v1.json"
)

EXPECTED_PATHS = {
    ".github/workflows/tai-model-host-preflight.yml",
    "apps/tai/governance/scopes/ap-13b3-model-host-preflight-2835.json",
    "apps/tai/model-artifacts/model-host-preflight-requirements.v1.json",
    "apps/tai/tests/test_model_host_preflight_workflow.py",
}
QWEN_REVISION = "895c8d171bc03c30e113cd7a28c02494b5e068b7"
MISTRAL_REVISION = "c170c708c41dac9275d15a8fff4eca08d52bab71"
AUTHORITY_SHA256 = (
    "3064250e63baed7bdcfd20851e1d3ea2c86fc33f087b69a2a4fcff18c384374b"
)


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _workflow() -> str:
    return WORKFLOW_PATH.read_text(encoding="utf-8")


def test_scope_is_exact_and_preserves_the_maturity_boundary() -> None:
    scope = _load(SCOPE_PATH)

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b3-model-host-preflight"
    assert scope["status"] == "active"
    assert scope["parent_issue"] == 2726
    assert scope["issue"] == 2835
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert "model source download, source archive creation, conversion or quantization" in scope[
        "forbidden_capabilities"
    ]
    assert "automatic legal approval or legal decision inference" in scope[
        "forbidden_capabilities"
    ]
    assert "production readiness or operational attestation claim" in scope[
        "forbidden_capabilities"
    ]


def test_requirements_demand_a_dedicated_isolated_host() -> None:
    requirements = _load(REQUIREMENTS_PATH)

    assert requirements["schema_version"] == "tai.model-host-preflight-requirements.v1"
    assert requirements["issue"] == 2835
    assert requirements["target"] == {
        "architecture": "x86_64",
        "host_role": "DEDICATED_MODEL_HOST",
        "operating_system": "linux",
        "production_workloads_allowed": False,
    }
    assert requirements["minimums"] == {
        "cpu_count": 4,
        "memory_available_bytes": 8_589_934_592,
        "memory_total_bytes": 16_106_127_360,
        "storage_available_bytes": 180_000_000_000,
    }
    assert requirements["workspace"]["dedicated_mount_required"] is True
    assert requirements["workspace"]["existing_directory_required"] is True
    assert requirements["workspace"]["candidate_paths"] == [
        "/srv/tai-models",
        "/opt/tai-models",
        "/var/lib/tai-models",
    ]
    assert requirements["required_tools"] == [
        "curl",
        "docker",
        "git",
        "gzip",
        "sha256sum",
        "tar",
    ]


def test_requirements_bind_exact_model_revisions_and_no_mutable_ref() -> None:
    requirements = _load(REQUIREMENTS_PATH)
    endpoints = requirements["exact_source_endpoints"]
    serialized = json.dumps(endpoints, sort_keys=True)

    assert QWEN_REVISION in serialized
    assert MISTRAL_REVISION in serialized
    assert "Qwen/Qwen3-8B/resolve/" + QWEN_REVISION in serialized
    assert (
        "mistralai/Mistral-7B-Instruct-v0.3/resolve/" + MISTRAL_REVISION
        in serialized
    )
    for forbidden_ref in ("/resolve/main/", "/resolve/master/", "/resolve/latest/"):
        assert forbidden_ref not in serialized
    assert requirements["accepted_http_statuses"] == [200]


def test_accepted_llama_toolchain_dependency_is_real_and_restored() -> None:
    build = _load(BUILD_ACCEPTANCE_PATH)

    assert build["schema_version"] == "tai.llama-cpp-build-acceptance.v1"
    assert build["status"] == "VERIFIED_RESTORED"
    assert build["authority"]["authority_sha256"] == AUTHORITY_SHA256
    assert build["evidence"]["verification_report"]["status"] == "VERIFIED"
    assert build["evidence"]["verification_report"]["reasons"] == []
    assert build["restore"]["independent_reverification"] is True
    assert build["maturity_boundary"]["production_operational_status"] == "NOT_ATTESTED"


def test_workflow_is_owner_only_exact_main_and_command_bound() -> None:
    workflow = _workflow()

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
    assert "github.event.issue.number == 2835" in workflow
    assert (
        "github.event.comment.body == '/tai probe model-host exact-main'" in workflow
    )
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "github.event.comment.user.login == github.repository_owner" in workflow
    assert "cancel-in-progress: false" in workflow


def test_workflow_has_minimal_repository_permissions_and_exact_checkout() -> None:
    workflow = _workflow()

    assert "permissions:\n  contents: read" in workflow
    assert "contents: write" not in workflow
    assert "actions: write" not in workflow
    assert "issues: write" not in workflow
    assert "packages: write" not in workflow
    assert "id-token: write" not in workflow
    assert "persist-credentials: false" in workflow
    assert "ref: ${{ github.sha }}" in workflow
    assert 'test "$(git rev-parse HEAD)" = "$GITHUB_SHA"' in workflow
    assert 'test "$GITHUB_REF" = \'refs/heads/main\'' in workflow
    assert (
        'test "$(git rev-parse refs/remotes/origin/main)" = "$GITHUB_SHA"'
        in workflow
    )


def test_dedicated_credentials_are_preferred_and_production_is_fail_closed() -> None:
    workflow = _workflow()

    for secret in (
        "TAI_MODEL_HOST",
        "TAI_MODEL_SSH_USER",
        "TAI_MODEL_SSH_PORT",
        "TAI_MODEL_SSH_KEY",
        "TAI_MODEL_SSH_PASSWORD",
    ):
        assert f"secrets.{secret}" in workflow
    assert "host_class='DEDICATED_MODEL_HOST'" in workflow
    assert "host_class='PRODUCTION_FALLBACK'" in workflow
    assert "DEDICATED_MODEL_HOST_NOT_CONFIGURED" in workflow
    assert "SHARED_PRODUCTION_WORKLOAD_PRESENT" in workflow
    assert "MODEL_HOST_SSH_CREDENTIALS_ABSENT" in workflow
    assert "READY_FOR_CONTROLLED_ACQUISITION" in workflow
    assert "NOT_READY" in workflow


def test_remote_probe_is_read_only_and_downloads_no_model_bytes() -> None:
    workflow = _workflow()
    step = workflow[
        workflow.index("      - name: Execute read-only remote probe") : workflow.index(
            "      - name: Build fail-closed machine-readable preflight result"
        )
    ]
    remote = step[
        step.index("          remote_script=\"$(cat <<'REMOTE'") : step.index(
            "          REMOTE\n          )\""
        )
    ]

    assert "MUTATION_MODE=READ_ONLY" in remote
    assert "curl -sSIL" in remote
    assert "findmnt" in remote
    assert "df -P -B1" in remote
    assert "docker ps" in remote
    assert "docker info" in remote

    forbidden = (
        "apt-get",
        "dnf ",
        "yum ",
        "apk add",
        "mkdir ",
        "touch ",
        "rm -",
        "mv ",
        "cp ",
        "chmod ",
        "chown ",
        "docker pull",
        "docker run",
        "docker compose up",
        "docker stop",
        "docker restart",
        "git clone",
        "git checkout",
        "huggingface-cli",
        "snapshot_download",
        "curl -o",
        "curl --output",
        "wget ",
        "dd ",
        "truncate ",
        "mount ",
        "systemctl ",
    )
    for token in forbidden:
        assert token not in remote

    assert "model-00001-of-00005.safetensors" in remote
    assert "model-00001-of-00003.safetensors" in remote
    assert QWEN_REVISION in remote
    assert MISTRAL_REVISION in remote


def test_result_classification_is_fail_closed_and_machine_readable() -> None:
    workflow = _workflow()

    required_reasons = (
        "DEDICATED_MODEL_HOST_NOT_CONFIGURED",
        "OPERATING_SYSTEM_MISMATCH",
        "ARCHITECTURE_MISMATCH",
        "CPU_CAPACITY_BELOW_MINIMUM",
        "TOTAL_MEMORY_BELOW_MINIMUM",
        "AVAILABLE_MEMORY_BELOW_MINIMUM",
        "DEDICATED_WORKSPACE_ABSENT",
        "DEDICATED_WORKSPACE_MOUNT_ABSENT",
        "WORKSPACE_STORAGE_BELOW_MINIMUM",
        "SHARED_PRODUCTION_WORKLOAD_PRESENT",
        "REQUIRED_TOOL_MISSING:",
        "EXACT_SOURCE_ENDPOINT_UNREACHABLE:",
    )
    for reason in required_reasons:
        assert reason in workflow

    assert '"schema_version": "tai.model-host-preflight-result.v1"' in workflow
    assert '"status": "READY_FOR_CONTROLLED_ACQUISITION" if not reasons else "NOT_READY"' in workflow
    assert '"reasons": sorted(set(reasons))' in workflow
    assert '"repository_sha": os.environ["GITHUB_SHA"]' in workflow
    assert '"workflow_run_id": int(os.environ["GITHUB_RUN_ID"])' in workflow
    assert '"accepted_toolchain"' in workflow


def test_workflow_uploads_only_small_probe_evidence() -> None:
    workflow = _workflow()
    upload = workflow[
        workflow.index("      - name: Upload exact-main preflight evidence") : workflow.index(
            "      - name: Publish preflight summary"
        )
    ]

    assert "actions/upload-artifact@v4" in upload
    assert "path: model-host-preflight" in upload
    assert "retention-days: 30" in upload
    assert "compression-level: 0" in upload
    assert "overwrite: false" in upload
    assert ".safetensors" not in upload
    assert ".gguf" not in upload
    assert "model weights" not in upload.lower()


def test_workflow_never_manufactures_legal_or_operational_acceptance() -> None:
    workflow = _workflow()
    requirements = _load(REQUIREMENTS_PATH)
    maturity = requirements["maturity_boundary"]

    assert maturity == {
        "benchmarks": "NOT_DONE",
        "legal_review": "NOT_DONE",
        "model_acquisition": "PENDING_ACQUISITION",
        "model_admission": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }
    assert 'result["maturity_boundary"]["model_acquisition"] == "PENDING_ACQUISITION"' in workflow
    assert 'result["maturity_boundary"]["legal_review"] == "NOT_DONE"' in workflow
    assert 'result["maturity_boundary"]["benchmarks"] == "NOT_DONE"' in workflow
    assert 'result["maturity_boundary"]["model_admission"] == "NOT_DONE"' in workflow
    assert (
        'result["maturity_boundary"]["production_operational_status"] == "NOT_ATTESTED"'
        in workflow
    )
    assert "APPROVED" not in workflow
    assert "ADMITTED" not in workflow
