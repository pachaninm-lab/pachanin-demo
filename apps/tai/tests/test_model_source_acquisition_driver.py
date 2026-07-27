"""The acquisition driver must actually acquire, not merely refuse politely.

A script that has only ever been observed failing is not a script anyone should
hand to an owner with network access. These tests run the real driver end to
end against a local origin that serves the fixture repository, and then break
the things it is supposed to catch.
"""

from __future__ import annotations

import json
import subprocess
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

from tai.model_bundle_v2 import load_model_bundle_authority_v2

TAI_ROOT = Path(__file__).resolve().parents[1]
DRIVER = TAI_ROOT / "model-artifacts" / "model-source-acquisition-driver.v1.sh"
AUTHORITY_PATH = TAI_ROOT / "model-artifacts" / "model-bundle-authority.v2.json"
MODEL_ID = "Qwen/Qwen3-8B"
PREFIX = "sources/qwen3-8b/"


def _authority_plan():
    authority = load_model_bundle_authority_v2(AUTHORITY_PATH)
    return next(item for item in authority.models if item.model_id == MODEL_ID)


def _build_origin(root: Path, *, revision: str, license_spdx: str = "apache-2.0") -> None:
    """Lay out a directory that answers like the upstream model host."""
    plan = _authority_plan()
    selected_weights = [
        Path(item.path).name
        for item in plan.selected_inventory
        if item.role.value == "WEIGHT_SHARD"
    ]

    contents: dict[str, bytes] = {}
    for item in plan.inventory:
        relative = item.path.removeprefix(PREFIX)
        if relative == "model.safetensors.index.json":
            weight_map = {
                f"layer.{index}": shard for index, shard in enumerate(selected_weights, start=1)
            }
            contents[relative] = json.dumps({"weight_map": weight_map}, sort_keys=True).encode()
        else:
            contents[relative] = f"fixture:{relative}\n".encode()

    api = {
        "sha": revision,
        "cardData": {"license": license_spdx},
        "siblings": [
            {
                "rfilename": relative,
                "size": len(content),
                "blobId": f"blob-{index:02d}",
                "lfs": {"oid": f"oid-{index:02d}", "pointerSize": 128, "size": len(content)},
            }
            for index, (relative, content) in enumerate(sorted(contents.items()), start=1)
        ],
    }

    api_path = root / "api" / "models" / MODEL_ID / "revision" / revision
    api_path.parent.mkdir(parents=True, exist_ok=True)
    api_path.write_text(json.dumps(api), encoding="utf-8")

    for relative, content in contents.items():
        blob = root / MODEL_ID / "resolve" / revision / relative
        blob.parent.mkdir(parents=True, exist_ok=True)
        blob.write_bytes(content)


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args: object) -> None:  # noqa: D102 - silence the test run
        return


@pytest.fixture
def origin(tmp_path: Path):
    """A local stand-in for the upstream host, serving the fixture repository."""
    root = tmp_path / "origin"
    root.mkdir()
    revision = _authority_plan().revision
    _build_origin(root, revision=revision)

    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(_QuietHandler, directory=str(root)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", root, revision
    finally:
        server.shutdown()
        server.server_close()


def _run(
    base_url: str, output_root: Path, model_id: str = MODEL_ID
) -> subprocess.CompletedProcess[str]:
    # The command is this repository's own driver with test-controlled paths.
    return subprocess.run(  # noqa: S603 - fixed argv, no shell, no external input
        [str(DRIVER), "--model-id", model_id, "--output-root", str(output_root)],
        capture_output=True,
        text=True,
        env={
            # The driver runs `python3`; point it at the interpreter running
            # the tests so the check exercises the code, not the environment.
            "PATH": f"{Path(sys.executable).parent}:/usr/local/bin:/usr/bin:/bin",
            "TAI_HUGGINGFACE_BASE": base_url,
            "PYTHONPATH": str(TAI_ROOT),
            "HOME": str(output_root),
        },
        check=False,
    )


def test_the_driver_acquires_and_verifies_the_pinned_revision(origin, tmp_path: Path) -> None:
    base_url, _, revision = origin
    output_root = tmp_path / "out"

    result = _run(base_url, output_root)

    assert result.returncode == 0, result.stderr
    assert "acquisition complete and verified" in result.stdout

    manifest = json.loads((output_root / "evidence" / "source-manifest.json").read_text())
    assert manifest["revision"] == revision
    assert manifest["model_id"] == MODEL_ID

    # The payload is on disk, laid out the way the manifest step expects.
    plan = _authority_plan()
    for item in plan.selected_inventory:
        assert (output_root / "payload" / item.path).is_file(), item.path


def test_a_second_run_resumes_instead_of_refetching(origin, tmp_path: Path) -> None:
    base_url, _, _ = origin
    output_root = tmp_path / "out"

    assert _run(base_url, output_root).returncode == 0
    second = _run(base_url, output_root)

    assert second.returncode == 0, second.stderr
    assert "already present" in second.stdout


def test_it_refuses_a_revision_upstream_does_not_match(origin, tmp_path: Path) -> None:
    # The upstream answer claims a different commit than the authority pinned.
    base_url, root, revision = origin
    api_path = root / "api" / "models" / MODEL_ID / "revision" / revision
    payload = json.loads(api_path.read_text())
    payload["sha"] = "0" * 40
    api_path.write_text(json.dumps(payload), encoding="utf-8")

    output_root = tmp_path / "out"
    result = _run(base_url, output_root)

    assert result.returncode == 1
    assert "does not match the pinned authority" in result.stderr
    # Nothing was fetched: refusing after the transfer would defeat the point.
    assert not any((output_root / "payload").rglob("*.safetensors"))


def test_it_refuses_a_licence_that_drifted_upstream(origin, tmp_path: Path) -> None:
    base_url, root, revision = origin
    api_path = root / "api" / "models" / MODEL_ID / "revision" / revision
    payload = json.loads(api_path.read_text())
    payload["cardData"]["license"] = "proprietary"
    api_path.write_text(json.dumps(payload), encoding="utf-8")

    result = _run(base_url, tmp_path / "out")

    assert result.returncode == 1
    assert "does not match the pinned authority" in result.stderr


def test_it_refuses_an_ungoverned_file_appearing_upstream(origin, tmp_path: Path) -> None:
    # A file nobody approved is a supply-chain change, even if it looks harmless.
    base_url, root, revision = origin
    api_path = root / "api" / "models" / MODEL_ID / "revision" / revision
    payload = json.loads(api_path.read_text())
    payload["siblings"].append(
        {
            "rfilename": "surprise.bin",
            "size": 4,
            "blobId": "blob-99",
            "lfs": {"oid": "oid-99", "pointerSize": 128, "size": 4},
        }
    )
    api_path.write_text(json.dumps(payload), encoding="utf-8")

    result = _run(base_url, tmp_path / "out")

    assert result.returncode == 1
    assert "does not match the pinned authority" in result.stderr


def test_it_refuses_a_truncated_download(origin, tmp_path: Path) -> None:
    # Truncation is the failure a size check exists for: the file looks real.
    base_url, root, revision = origin
    plan = _authority_plan()
    victim = next(
        item for item in plan.selected_inventory if item.role.value == "WEIGHT_SHARD"
    )
    blob = root / MODEL_ID / "resolve" / revision / victim.path.removeprefix(PREFIX)
    blob.write_bytes(b"")

    result = _run(base_url, tmp_path / "out")

    assert result.returncode == 1
    assert "size mismatch" in result.stderr


def test_it_refuses_a_model_that_is_not_pinned(origin, tmp_path: Path) -> None:
    base_url, _, _ = origin

    result = _run(base_url, tmp_path / "out", model_id="Someone/Unapproved-7B")

    assert result.returncode == 1
    assert "could not resolve the pinned revision" in result.stderr
