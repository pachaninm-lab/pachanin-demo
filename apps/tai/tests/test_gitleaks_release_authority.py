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
    ]
    assert all(_FINGERPRINT.fullmatch(entry) is not None for entry in entries)
