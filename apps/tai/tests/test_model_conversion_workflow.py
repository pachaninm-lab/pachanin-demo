from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-model-conversion.yml"
AUTHORITY_PATH = TAI_ROOT / "model-artifacts" / "model-conversion-authority.v1.json"
BUNDLE_AUTHORITY_PATH = TAI_ROOT / "model-artifacts" / "model-bundle-authority.v2.json"
DRIVER_PATH = TAI_ROOT / "model-artifacts" / "model-conversion-driver.v1.sh"
ORCHESTRATOR_PATHS = (
    TAI_ROOT / "model-artifacts" / "model-conversion-prerequisites.v1.sh",
    TAI_ROOT / "model-artifacts" / "model-conversion-artifacts.v1.sh",
    TAI_ROOT / "model-artifacts" / "model-conversion-transport.v1.sh",
)

SCOPE_PATH = (
    TAI_ROOT
    / "governance"
    / "scopes"
    / "ap-13b3d-governed-conversion-2932.json"
)

EXPECTED_PATHS = {
    ".gitleaksignore",
    ".github/workflows/tai-model-conversion.yml",
    "apps/tai/governance/scopes/ap-13b3d-governed-conversion-2932.json",
    "apps/tai/model-artifacts/model-conversion-authority.v1.json",
    "apps/tai/model-artifacts/model-conversion-driver.v1.sh",
    "apps/tai/model-artifacts/model-conversion-orchestrator-master.v1.sh",
    "apps/tai/model-artifacts/model-conversion-prerequisites.v1.sh",
    "apps/tai/model-artifacts/model-conversion-artifacts.v1.sh",
    "apps/tai/model-artifacts/model-conversion-transport.v1.sh",
    "apps/tai/tests/test_gitleaks_release_authority.py",
    "apps/tai/tests/test_model_conversion_workflow.py",
}
COMMAND = "/tai convert model-bundles exact-main"
STATUS_COMMAND = "/tai conversion status exact-main"
QWEN_REVISION = "895c8d171bc03c30e113cd7a28c02494b5e068b7"
MISTRAL_REVISION = "c170c708c41dac9275d15a8fff4eca08d52bab71"


def _json(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def test_scope_is_narrow_and_preserves_maturity_boundary() -> None:
    scope = _json(SCOPE_PATH)
    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b3d-governed-conversion"
    assert (scope["program_issue"], scope["parent_issue"], scope["issue"]) == (
        2726,
        2835,
        2932,
    )
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert "benchmark, model admission or production-readiness claim" in scope[
        "forbidden_capabilities"
    ]
    assert "production_operational_status remains NOT_ATTESTED" in scope["acceptance"]


def test_authority_matches_exact_bundle_plans_and_outputs() -> None:
    authority = _json(AUTHORITY_PATH)
    bundle = _json(BUNDLE_AUTHORITY_PATH)
    assert authority["schema_version"] == "tai.model-conversion-authority.v1"
    assert authority["command"] == COMMAND
    assert authority["target"] == {
        "host_role": "DEDICATED_MODEL_HOST",
        "production_fallback_allowed": False,
        "required_user": "tai-model",
        "run_root_template": (
            "conversion-runs/{exact_main_sha}/"
            "{workflow_run_id}-{workflow_run_attempt}"
        ),
        "ssh_secret_prefix": "TAI_MODEL_",
        "workspace_root": "/srv/tai-models",
    }
    assert authority["bundle_authority"]["authority_sha256"] == (
        "3391ea2ba4ddd855b45c5f389f12ffe3ddffb7cc4f46a4048d7357ffcdda6022"
    )
    by_identity = {
        (model["model_id"], model["revision"]): model
        for model in authority["models"]
    }
    assert set(by_identity) == {
        ("Qwen/Qwen3-8B", QWEN_REVISION),
        ("mistralai/Mistral-7B-Instruct-v0.3", MISTRAL_REVISION),
    }
    for bundle_model in bundle["models"]:
        model = by_identity[(bundle_model["model_id"], bundle_model["revision"])]
        assert model["role"] == bundle_model["role"]
        assert model["conversion_argv"] == bundle_model["conversion"]["argv"]
        assert model["intermediate"] == {
            "format": bundle_model["conversion"]["intermediate_format"],
            "path": bundle_model["conversion"]["intermediate_path"],
        }
        assert model["quantizations"] == [
            {
                "argv": item["argv"],
                "path": item["output_path"],
                "quantization": item["quantization"],
                "runtime_class": item["runtime_class"],
            }
            for item in bundle_model["quantizations"]
        ]
    assert authority["result"] == {
        "benchmark_status": "NOT_RUN",
        "complete_status": (
            "CONVERSION_AND_QUANTIZATION_COMPLETE_PENDING_BUNDLE_RESTORE"
        ),
        "failed_status": "FAILED_CLOSED",
        "large_artifacts_in_git": False,
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }


def test_workflow_is_owner_only_exact_main_and_dedicated_host_only() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    assert "issue_comment:" in workflow
    assert "types: [created]" in workflow
    assert "push:" not in workflow
    assert "schedule:" not in workflow
    assert "workflow_dispatch:" not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert "github.actor == github.repository_owner" in workflow
    assert "github.triggering_actor == github.repository_owner" in workflow
    assert "github.event.issue.number == 2835" in workflow
    assert f"github.event.comment.body == '{COMMAND}'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "actions: read\n  contents: read\n  issues: write" in workflow
    assert "contents: write" not in workflow
    assert "actions: write" not in workflow
    for secret in (
        "TAI_MODEL_HOST",
        "TAI_MODEL_SSH_USER",
        "TAI_MODEL_SSH_PORT",
        "TAI_MODEL_SSH_KEY",
    ):
        assert secret in workflow
    for forbidden in (
        "TAI_MODEL_SSH_PASSWORD",
        "PC_PROD_HOST",
        "PC_PROD_SSH_USER",
        "PC_PROD_SSH_KEY",
        "PC_PROD_SSH_PASSWORD",
        "VPS_SSH_KEY",
        "VPS_SSH_PASSWORD",
        "195.19.12.120",
    ):
        assert forbidden not in workflow


def test_workflow_exposes_owner_only_bounded_status_relay() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    assert "  status:" in workflow
    assert "github.event.issue.number == 2932" in workflow
    assert f"github.event.comment.body == '{STATUS_COMMAND}'" in workflow
    assert '"repos/$REPOSITORY/issues/2835/comments?per_page=100"' in workflow
    assert '.user.login == "github-actions[bot]"' in workflow
    assert 'startswith("## TAI governed model conversion")' in workflow
    assert '"repos/$REPOSITORY/issues/2932/comments"' in workflow
    assert "TAI_MODEL_HOST" not in workflow[workflow.index("  status:") :]
    assert "production operational status" not in workflow[
        workflow.index("  status:") :
    ]


def test_workflow_verifies_release_legal_source_and_toolchain_before_remote_start() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    orchestrator = "\n".join(path.read_text(encoding="utf-8") for path in ORCHESTRATOR_PATHS)
    assert "Execute governed dedicated-host conversion" in workflow
    assert "model-conversion-orchestrator-master.v1.sh" in workflow
    release_index = orchestrator.index("TAI Release Acceptance")
    legal_index = orchestrator.index("model_legal_review_cli")
    artifact_index = orchestrator.index("accepted-artifacts/artifacts.tsv")
    remote_index = orchestrator.index('ssh_command "install -d')
    assert release_index < legal_index < artifact_index < remote_index
    assert "expected = f'tai-release-attestation-{exact}'" in orchestrator
    assert "attestation['accepted'] is True" in orchestrator
    assert "ALL_APPROVED_FOR_CONVERSION" in orchestrator
    assert "VERIFIED_SOURCE_RESTORED_LEGAL_PENDING" in orchestrator
    assert "VERIFIED_RESTORED" in orchestrator
    assert "artifact.zip" in orchestrator
    assert "control-manifest.sha256" in orchestrator
    assert "model-conversion-driver.v1.sh" in orchestrator


def test_release_acceptance_wait_covers_upstream_timeout() -> None:
    prerequisites = ORCHESTRATOR_PATHS[0].read_text(encoding="utf-8")
    attempts_match = re.search(
        r"^RELEASE_WAIT_ATTEMPTS=(\d+)$", prerequisites, re.MULTILINE
    )
    interval_match = re.search(
        r"^RELEASE_WAIT_INTERVAL_SECONDS=(\d+)$", prerequisites, re.MULTILINE
    )
    assert attempts_match is not None
    assert interval_match is not None
    attempts = int(attempts_match.group(1))
    interval_seconds = int(interval_match.group(1))
    assert attempts * interval_seconds >= 60 * 60
    assert 'seq 1 "$RELEASE_WAIT_ATTEMPTS"' in prerequisites
    assert '"$attempt" -eq "$RELEASE_WAIT_ATTEMPTS"' in prerequisites
    assert 'sleep "$RELEASE_WAIT_INTERVAL_SECONDS"' in prerequisites


def test_driver_confines_mutation_and_executes_only_declared_outputs() -> None:
    driver = DRIVER_PATH.read_text(encoding="utf-8")
    assert "test \"$(id -un)\" = 'tai-model'" in driver
    assert "test \"$RUN_ROOT\" = \"/srv/tai-models/conversion-runs/" in driver
    assert "flock -n 9" in driver
    assert "WORKSPACE_SOURCE" in driver
    assert "SOURCE_REUSE" in driver
    assert "artifacts/quarantine" in driver
    assert "conversion_argv" in driver
    assert "quantizations" in driver
    assert "$LLAMA_ROOT/source/llama.cpp" in driver
    assert "$LLAMA_ROOT/source/llama.cpp/gguf-py" in driver
    assert "qwen3-8b-bf16.gguf" in driver
    assert "qwen3-8b-q4-k-m.gguf" in driver
    assert "qwen3-8b-q8-0.gguf" in driver
    assert "mistral-7b-instruct-v0.3-f16.gguf" in driver
    assert "mistral-7b-instruct-v0.3-q4-k-m.gguf" in driver
    assert "CONVERSION_AND_QUANTIZATION_COMPLETE_PENDING_BUNDLE_RESTORE" in driver
    assert "production_operational_status" in driver
    for forbidden in (
        "sudo ",
        "systemctl ",
        "docker run",
        "docker pull",
        "/etc/",
        "/var/lib/postgresql",
    ):
        assert forbidden not in driver


def test_only_bounded_metadata_returns_to_github() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    orchestrator = "\n".join(path.read_text(encoding="utf-8") for path in ORCHESTRATOR_PATHS)
    upload = workflow[workflow.index("Upload bounded conversion evidence") :]
    assert "remote-evidence" in upload
    assert "control-package/model-conversion-authority.v1.json" in upload
    assert "control-package/control-manifest.sha256" in upload
    assert "artifacts/*.gguf" not in upload
    assert "sources/" not in upload
    assert "tar -czf - status.json evidence logs" in orchestrator
    assert "retention-days: 90" in upload
    assert "compression-level: 0" in upload
    assert "overwrite: false" in upload
    assert "include-hidden-files: false" in upload
