#!/usr/bin/env python3
"""Gekta SPEED #3896 G3C admission-gate v2.

This wrapper preserves the already-audited G3C one-factor controller and changes
only its memory admission signal plus the G3C systemd drop-in precedence needed
to layer after the proven G3B threads16 runtime.

V2 feeds the base controller the llama-server process VmSwap value from
/proc/<pid>/status while preserving its existing MemAvailable >= 3 GiB
threshold, exact argv/environment checks, readiness checks and automatic
rollback. The ubatch experiment itself remains exactly 128 -> 512.
"""

from __future__ import annotations

import importlib.util
import pathlib
import re
import stat
import sys

INSTALLED_WRAPPER = pathlib.Path("/usr/local/sbin/gekta-qwen-g3c")
INSTALLED_BASE = pathlib.Path("/usr/local/libexec/gekta-qwen-g3c-base.py")
REPOSITORY_BASE = pathlib.Path(__file__).with_name("gekta-qwen-g3c-runtime.py")
G3B_DROPIN_NAME = "99-gekta-g3b.conf"
G3C_DROPIN = pathlib.Path(
    "/etc/systemd/system/tai-qwen3-8b.service.d/99-gekta-g3c.conf"
)


def _select_base() -> pathlib.Path:
    here = pathlib.Path(__file__).resolve(strict=True)
    installed = INSTALLED_WRAPPER.resolve(strict=False)
    if here == installed:
        return INSTALLED_BASE
    return REPOSITORY_BASE


def _load_base(path: pathlib.Path):
    if not path.is_file() or path.is_symlink():
        raise SystemExit("GEKTA_G3C_ERROR=base_helper_missing_or_unsafe")
    if path == INSTALLED_BASE:
        mode = path.stat()
        if mode.st_uid != 0 or mode.st_gid != 0 or mode.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
            raise SystemExit("GEKTA_G3C_ERROR=base_helper_permissions_invalid")
    spec = importlib.util.spec_from_file_location("gekta_qwen_g3c_base", path)
    if spec is None or spec.loader is None:
        raise SystemExit("GEKTA_G3C_ERROR=base_helper_import_invalid")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


base = _load_base(_select_base())
if G3C_DROPIN.name <= G3B_DROPIN_NAME:
    raise SystemExit("GEKTA_G3C_ERROR=dropin_precedence_invalid")
base.DROPIN_PATH = G3C_DROPIN
_original_mem_facts = base._mem_facts


def _process_swap_kb(pid: int) -> int:
    try:
        text = pathlib.Path(f"/proc/{pid}/status").read_text(encoding="ascii")
    except OSError as exc:
        raise base.G3CError("process_swap_unavailable") from exc
    match = re.search(r"^VmSwap:\s+(\d+)\s+kB$", text, re.MULTILINE)
    if not match:
        raise base.G3CError("process_swap_missing")
    return int(match.group(1))


def _model_mem_facts() -> tuple[int, int]:
    # Linux documents MemAvailable as the estimate of memory available for new
    # work without swapping. VmSwap in /proc/<pid>/status is the swap used by
    # that process's anonymous private data. Global SwapUsed is intentionally
    # not an admission blocker because it may belong to unrelated/stale pages.
    mem_available_kb, _system_swap_used_kb = _original_mem_facts()
    pid = base._service_pid()
    process_swap_kb = _process_swap_kb(pid)
    if base._service_pid() != pid:
        raise base.G3CError("service_pid_changed_during_memory_snapshot")
    return mem_available_kb, process_swap_kb


base._mem_facts = _model_mem_facts


def _dropin_precedence_self_test() -> None:
    if base.DROPIN_PATH != G3C_DROPIN or G3C_DROPIN.name <= G3B_DROPIN_NAME:
        raise AssertionError("G3C drop-in must sort after the proven G3B drop-in")
    print("GEKTA_G3C_DROPIN_PRECEDENCE_SELF_TEST=PASS")


def _swap_gate_self_test() -> None:
    base._memory_gate(base.MIN_MEM_AVAILABLE_KB, 0)
    try:
        base._memory_gate(base.MIN_MEM_AVAILABLE_KB, 1)
    except base.G3CError as exc:
        if str(exc) != "swap_used":
            raise
    else:
        raise AssertionError("model process swap must fail closed")
    try:
        base._memory_gate(base.MIN_MEM_AVAILABLE_KB - 1, 0)
    except base.G3CError as exc:
        if str(exc) != "memory_headroom_low":
            raise
    else:
        raise AssertionError("low MemAvailable must fail closed")
    print("GEKTA_G3C_SWAP_GATE_SELF_TEST=PASS")


def main() -> int:
    if len(sys.argv) == 2 and sys.argv[1] == "self-test":
        _dropin_precedence_self_test()
        _swap_gate_self_test()
    return int(base.main())


if __name__ == "__main__":
    raise SystemExit(main())
