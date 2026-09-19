from __future__ import annotations

import hashlib
import json
import os
import subprocess
from pathlib import Path
from typing import Any

import pytest

TAI_ROOT = Path(__file__).parents[1]
PROBE = TAI_ROOT / "model-artifacts" / "exact-main-probe.v1.sh"
BASH = Path("/usr/bin/bash")
SHA = "a08ea173ebfffd14dff7c9efdc4e39e9ff3c757f"
OTHER_SHA = "b" * 40


def _fake_git(tmp_path: Path) -> Path:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    git = bin_dir / "git"
    git.write_text(
        """#!/usr/bin/env bash
set -u
case "${1:-}" in
  rev-parse)
    exit_code="${FAKE_REV_PARSE_EXIT:-0}"
    if [[ "$exit_code" != 0 ]]; then exit "$exit_code"; fi
    printf '%s\n' "${FAKE_HEAD_SHA:-}"
    ;;
  ls-remote)
    exit_code="${FAKE_LS_REMOTE_EXIT:-0}"
    if [[ "$exit_code" != 0 ]]; then exit "$exit_code"; fi
    printf '%s' "${FAKE_REMOTE_ROWS:-}"
    ;;
  status)
    exit_code="${FAKE_STATUS_EXIT:-0}"
    if [[ "$exit_code" != 0 ]]; then exit "$exit_code"; fi
    printf '%s' "${FAKE_STATUS_OUTPUT:-}"
    ;;
  *)
    printf 'unexpected fake git command: %s\n' "$*" >&2
    exit 97
    ;;
esac
""",
        encoding="utf-8",
    )
    git.chmod(0o700)
    return bin_dir


def _run(
    tmp_path: Path,
    *,
    github_ref: str = "refs/heads/main",
    github_sha: str = SHA,
    head_sha: str = SHA,
    remote_rows: str | None = None,
    rev_parse_exit: int = 0,
    ls_remote_exit: int = 0,
    status_output: str = "",
    status_exit: int = 0,
    report: bool = True,
) -> tuple[subprocess.CompletedProcess[str], Path]:
    bin_dir = _fake_git(tmp_path)
    report_path = tmp_path / "probe-report.json"
    rows = remote_rows
    if rows is None:
        rows = f"{SHA}\trefs/heads/main\n"
    env = {
        **os.environ,
        "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
        "GITHUB_REF": github_ref,
        "GITHUB_SHA": github_sha,
        "FAKE_HEAD_SHA": head_sha,
        "FAKE_REMOTE_ROWS": rows,
        "FAKE_REV_PARSE_EXIT": str(rev_parse_exit),
        "FAKE_LS_REMOTE_EXIT": str(ls_remote_exit),
        "FAKE_STATUS_OUTPUT": status_output,
        "FAKE_STATUS_EXIT": str(status_exit),
    }
    if report:
        env["EXACT_MAIN_PROBE_REPORT"] = str(report_path)
    result = subprocess.run(  # noqa: S603 - controlled absolute Bash and repository script
        [str(BASH), str(PROBE)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    return result, report_path


def _json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def test_stable_live_main_is_confirmed_with_digest_bound_report(tmp_path: Path) -> None:
    result, report_path = _run(tmp_path)

    assert result.returncode == 0, result.stderr
    assert result.stdout == f"EXACT_MAIN_CONFIRMED:{SHA}\n"
    assert result.stderr == ""
    report = _json(report_path)
    assert report == {
        "schema_version": "tai.exact-main-probe-report.v1",
        "status": "EXACT_MAIN_CONFIRMED",
        "event_ref": "refs/heads/main",
        "event_sha": SHA,
        "checked_out_sha": SHA,
        "remote_main_ref": "refs/heads/main",
        "remote_main_sha": SHA,
        "clean_worktree": True,
        "report_sha256": report["report_sha256"],
    }
    unsigned = {key: value for key, value in report.items() if key != "report_sha256"}
    expected = hashlib.sha256(
        json.dumps(
            unsigned,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    ).hexdigest()
    assert report["report_sha256"] == expected


def test_report_is_optional_for_read_only_probe(tmp_path: Path) -> None:
    result, report_path = _run(tmp_path, report=False)

    assert result.returncode == 0
    assert not report_path.exists()


@pytest.mark.parametrize(
    ("kwargs", "reason"),
    [
        ({"github_ref": "refs/heads/develop"}, "EVENT_REF_NOT_MAIN"),
        ({"github_sha": "main"}, "EVENT_SHA_INVALID"),
        ({"rev_parse_exit": 1}, "CHECKED_OUT_HEAD_UNREADABLE"),
        ({"head_sha": "bad"}, "CHECKED_OUT_SHA_INVALID"),
        ({"head_sha": OTHER_SHA}, "CHECKED_OUT_SHA_MISMATCH"),
        ({"ls_remote_exit": 2}, "LIVE_MAIN_LOOKUP_FAILED"),
        ({"remote_rows": ""}, "LIVE_MAIN_CARDINALITY_INVALID"),
        (
            {
                "remote_rows": (
                    f"{SHA}\trefs/heads/main\n{SHA}\trefs/heads/main\n"
                )
            },
            "LIVE_MAIN_CARDINALITY_INVALID",
        ),
        ({"remote_rows": "bad\trefs/heads/main\n"}, "LIVE_MAIN_SHA_INVALID"),
        ({"remote_rows": f"{SHA}\trefs/heads/other\n"}, "LIVE_MAIN_REF_INVALID"),
        ({"remote_rows": f"{OTHER_SHA}\trefs/heads/main\n"}, "LIVE_MAIN_MOVED"),
        ({"status_output": "?? unexpected.txt\n"}, "WORKTREE_DIRTY"),
        ({"status_exit": 3}, "WORKTREE_STATUS_FAILED"),
    ],
)
def test_probe_rejects_ambiguous_or_changed_authority(
    tmp_path: Path,
    kwargs: dict[str, object],
    reason: str,
) -> None:
    result, report_path = _run(tmp_path, **kwargs)  # type: ignore[arg-type]

    assert result.returncode == 2
    assert result.stdout == ""
    assert f"EXACT_MAIN_REJECTED:{reason}" in result.stderr
    assert not report_path.exists()


def test_remote_row_with_extra_field_is_rejected(tmp_path: Path) -> None:
    result, _ = _run(
        tmp_path,
        remote_rows=f"{SHA}\trefs/heads/main\textra\n",
    )

    assert result.returncode == 2
    assert "EXACT_MAIN_REJECTED:LIVE_MAIN_ROW_INVALID" in result.stderr


def test_probe_uses_only_read_only_live_branch_lookup() -> None:
    source = PROBE.read_text(encoding="utf-8")

    assert "git ls-remote --exit-code --heads origin refs/heads/main" in source
    assert "git rev-parse --verify 'HEAD^{commit}'" in source
    assert "git status --porcelain=v1 --untracked-files=all" in source
    assert "refs/remotes/origin/main" not in source
    for forbidden in ("git push", "git fetch", "git update-ref", "git reset", "git checkout"):
        assert forbidden not in source
