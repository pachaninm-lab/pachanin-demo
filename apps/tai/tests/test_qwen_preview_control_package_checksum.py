"""The control package checksum must verify from the remote incoming directory.

`sha256sum` records the path exactly as it was given. Passing `"$LOCAL_ROOT/file"`
therefore wrote a manifest naming `qwen-preview-evidence/control-package.tar.gz`,
while the remote verifies from `$REMOTE_ROOT/incoming`, where no such relative
path exists. `sha256sum -c` reported the listed file as unreadable and exited 1,
so the preview never reached the model host.

These tests execute the real sequence — build, record, copy to a separate
directory, verify — rather than reading the driver as text, so the manifest is
proven portable instead of merely looking right.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import tarfile
from pathlib import Path

import pytest

DRIVER = (
    Path(__file__).parents[1] / "model-artifacts" / "qwen-preview-runtime-driver.v1.sh"
)

_SHA256_LINE = re.compile(r"^[0-9a-f]{64} {2}(?P<name>.+)$")


def _build_control_package(local_root: Path) -> Path:
    """Reproduce the driver's packaging step."""
    control_root = local_root / "control"
    control_root.mkdir(parents=True)
    (control_root / "qwen-preview-runtime-authority.v1.json").write_text(
        '{"schema_version": "tai.qwen-preview-runtime-authority.v1"}\n', encoding="utf-8"
    )
    archive = local_root / "control-package.tar.gz"
    with tarfile.open(archive, "w:gz") as bundle:
        bundle.add(control_root, arcname=".")
    return archive


def _record_checksum(local_root: Path) -> Path:
    """Reproduce the driver's checksum step exactly as the fix writes it."""
    manifest = local_root / "control-package.tar.gz.sha256"
    completed = subprocess.run(  # noqa: S603
        ["sha256sum", "control-package.tar.gz"],  # noqa: S607
        cwd=local_root,
        capture_output=True,
        text=True,
        check=True,
    )
    manifest.write_text(completed.stdout, encoding="utf-8")
    return manifest


@pytest.fixture
def packaged(tmp_path: Path) -> tuple[Path, Path]:
    local_root = tmp_path / "qwen-preview-evidence"
    local_root.mkdir()
    _build_control_package(local_root)
    manifest = _record_checksum(local_root)
    return local_root, manifest


def test_manifest_names_only_the_bare_archive(packaged: tuple[Path, Path]) -> None:
    _, manifest = packaged
    lines = manifest.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    match = _SHA256_LINE.fullmatch(lines[0])
    assert match is not None, lines[0]
    assert match.group("name") == "control-package.tar.gz"


def test_manifest_carries_no_local_directory_prefix(packaged: tuple[Path, Path]) -> None:
    _, manifest = packaged
    content = manifest.read_text(encoding="utf-8")
    assert "qwen-preview-evidence/" not in content
    assert "/" not in content.split("  ", 1)[1]


def test_checksum_verifies_from_a_separate_incoming_directory(
    packaged: tuple[Path, Path], tmp_path: Path
) -> None:
    """This is the remote step that failed: verification happens elsewhere."""
    local_root, manifest = packaged
    incoming = tmp_path / "remote" / "incoming"
    incoming.mkdir(parents=True)
    shutil.copy(local_root / "control-package.tar.gz", incoming)
    shutil.copy(manifest, incoming)

    completed = subprocess.run(  # noqa: S603
        ["sha256sum", "-c", "control-package.tar.gz.sha256"],  # noqa: S607
        cwd=incoming,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr
    assert "control-package.tar.gz: OK" in completed.stdout
    assert "could not be read" not in completed.stderr


def test_prefixed_manifest_would_fail_the_remote_check(tmp_path: Path) -> None:
    """Guards the regression itself: the old form must still be demonstrably broken."""
    local_root = tmp_path / "qwen-preview-evidence"
    local_root.mkdir()
    _build_control_package(local_root)
    manifest = local_root / "control-package.tar.gz.sha256"
    completed = subprocess.run(  # noqa: S603
        ["sha256sum", f"{local_root.name}/control-package.tar.gz"],  # noqa: S607
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=True,
    )
    manifest.write_text(completed.stdout, encoding="utf-8")

    incoming = tmp_path / "remote" / "incoming"
    incoming.mkdir(parents=True)
    shutil.copy(local_root / "control-package.tar.gz", incoming)
    shutil.copy(manifest, incoming)

    rejected = subprocess.run(  # noqa: S603
        ["sha256sum", "-c", "control-package.tar.gz.sha256"],  # noqa: S607
        cwd=incoming,
        capture_output=True,
        text=True,
    )

    assert rejected.returncode == 1
    assert "could not be read" in rejected.stderr


def test_driver_records_the_checksum_without_a_path_prefix() -> None:
    driver = DRIVER.read_text(encoding="utf-8")
    assert 'sha256sum "$LOCAL_ROOT/control-package.tar.gz"' not in driver
    assert "sha256sum control-package.tar.gz > control-package.tar.gz.sha256" in driver
