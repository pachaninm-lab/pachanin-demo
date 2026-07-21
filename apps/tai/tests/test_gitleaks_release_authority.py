from __future__ import annotations

import json
import re
from pathlib import Path

_FINGERPRINT = re.compile(
    r"^[0-9a-f]{40}:[A-Za-z0-9_./-]+:generic-api-key:[1-9][0-9]*$"
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def test_gitleaks_exceptions_are_exact_and_release_attested() -> None:
    root = _repo_root()
    ignore_path = root / ".gitleaksignore"
    manifest = json.loads(
        (root / "apps/tai/release-source-manifest.json").read_text(encoding="utf-8")
    )
    entries = [
        line.strip()
        for line in ignore_path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]

    assert ".gitleaksignore" in manifest["files"]
    assert entries == [
        "b11c310787b81cfcfddd0be67f515f8f4a32cebd:"
        "apps/tai/tests/test_tool_planner.py:generic-api-key:42",
        "c5077eebcc9bbc47e3d650795e11b55f265428e8:"
        ".github/workflows/tai-model-source-acquisition.yml:generic-api-key:43",
        "ec4b80ce1ee4fa7cf18361f1ff536c34b5030948:"
        "apps/api/src/modules/commodity-profiles/commodity-profile-command.contract.spec.ts:"
        "generic-api-key:11",
        "d4f147c04c64b7565f11288b3b545c97340d7899:"
        "apps/tai/model-artifacts/model-conversion-authority.v1.json:generic-api-key:91",
        "387c77b28f89b467080371c3e55cbf376acdd28e:"
        "apps/tai/model-artifacts/model-bundle-finalization-authority.v1.json:"
        "generic-api-key:75",
        "d84b7faadf1b430e549850ccc5cce82a03d52d99:"
        "apps/tai/model-artifacts/cpu-benchmark-execution-authority.v1.json:"
        "generic-api-key:67",
        "ecdc1130ca1bc424f3ccecb072115e304722c971:"
        "apps/tai/tai/cpu_benchmark_execution.py:generic-api-key:413",
    ]
    assert all(_FINGERPRINT.fullmatch(entry) is not None for entry in entries)
