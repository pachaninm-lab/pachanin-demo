#!/usr/bin/env python3
"""Fail-closed Gekta SPEED #3896 ubatch candidate helper.

The helper is installed manually by root on the dedicated model host. GitHub
never receives root SSH. The model-host service principal may sudo only the
exact commands `ubatch512`, `rollback`, and `status`.

G3C layers after the already-proven G3B threads=16 drop-in. It snapshots the
currently running llama-server executable, argv and environment, changes only
--ubatch-size 128 -> 512, and preserves every other byte. Any restart,
readiness, memory or exact-argv failure automatically restores the snapshot.
"""

from __future__ import annotations

import base64
import fcntl
import grp
import hashlib
import json
import os
import pathlib
import pwd
import re
import socket
import stat
import subprocess
import sys
import tempfile
import time
from typing import Iterable, NoReturn, Sequence

SERVICE = "tai-qwen3-8b.service"
HELPER_PATH = pathlib.Path("/usr/local/sbin/gekta-qwen-g3c")
STATE_DIR = pathlib.Path("/var/lib/gekta-qwen-g3c")
CANDIDATE_PATH = STATE_DIR / "candidate.json"
BASELINE_PATH = STATE_DIR / "baseline.json"
DROPIN_DIR = pathlib.Path("/etc/systemd/system/tai-qwen3-8b.service.d")
DROPIN_PATH = DROPIN_DIR / "100-gekta-g3c.conf"
LOCK_PATH = pathlib.Path("/run/lock/gekta-qwen-g3c.lock")
SYSTEMCTL = pathlib.Path("/usr/bin/systemctl")
EXPECTED_LLAMA_COMMIT_PREFIX = "aedb2a5"
START_TIMEOUT_SECONDS = 90
MIN_MEM_AVAILABLE_KB = 3 * 1024 * 1024
SAFE_ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C", "LANG": "C"}

FLAG_ALIASES: dict[str, tuple[bytes, ...]] = {
    "threads": (b"--threads", b"-t"),
    "threads_batch": (b"--threads-batch", b"-tb"),
    "parallel": (b"--parallel", b"-np"),
    "ctx_size": (b"--ctx-size", b"-c"),
    "batch_size": (b"--batch-size", b"-b"),
    "ubatch_size": (b"--ubatch-size", b"-ub"),
    "port": (b"--port",),
    "host": (b"--host",),
}
BASELINE_EXPECTED = {
    "threads": b"16",
    "threads_batch": b"16",
    "parallel": b"1",
    "ctx_size": b"8192",
    "batch_size": b"512",
    "ubatch_size": b"128",
}


class G3CError(RuntimeError):
    pass


def _die(message: str) -> NoReturn:
    raise G3CError(message)


def _run(args: Sequence[str], *, check: bool = True, timeout: int = 20) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(list(args), stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True, check=False, timeout=timeout, env=SAFE_ENV)
    if check and result.returncode != 0:
        _die(f"command_failed:{pathlib.Path(args[0]).name}:{result.returncode}")
    return result


def _systemctl(*args: str, check: bool = True, timeout: int = 30) -> subprocess.CompletedProcess[str]:
    if not SYSTEMCTL.is_file():
        _die("systemctl_missing")
    return _run([str(SYSTEMCTL), *args], check=check, timeout=timeout)


def _show(prop: str) -> str:
    return _systemctl("show", SERVICE, "--property", prop, "--value").stdout.strip()


def _require_root() -> None:
    if os.geteuid() != 0:
        _die("root_required")


def _service_pid() -> int:
    value = _show("MainPID")
    if not re.fullmatch(r"[1-9][0-9]*", value):
        _die("service_mainpid_invalid")
    return int(value)


def _service_user() -> pwd.struct_passwd:
    value = _show("User")
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]{0,31}", value) or value == "root":
        _die("service_user_invalid")
    try:
        return pwd.getpwnam(value)
    except KeyError as exc:
        raise G3CError("service_user_missing") from exc


def _require_private_primary_group(user: pwd.struct_passwd) -> None:
    try:
        group = grp.getgrgid(user.pw_gid)
    except KeyError as exc:
        raise G3CError("service_group_missing") from exc
    members = {entry.pw_name for entry in pwd.getpwall() if entry.pw_gid == user.pw_gid}
    members.update(group.gr_mem)
    if members != {user.pw_name}:
        _die("service_primary_group_not_private")


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _unb64(value: str) -> bytes:
    try:
        return base64.b64decode(value.encode("ascii"), validate=True)
    except Exception as exc:
        raise G3CError("state_base64_invalid") from exc


def _cmdline_bytes(argv: Sequence[bytes]) -> bytes:
    return b"\0".join(argv) + b"\0"


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _file_sha(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_proc(pid: int) -> tuple[pathlib.Path, list[bytes], list[tuple[bytes, bytes]]]:
    proc = pathlib.Path(f"/proc/{pid}")
    try:
        exe = (proc / "exe").resolve(strict=True)
        raw_cmdline = (proc / "cmdline").read_bytes()
        raw_environ = (proc / "environ").read_bytes()
    except OSError as exc:
        raise G3CError("process_snapshot_unavailable") from exc
    argv = [part for part in raw_cmdline.split(b"\0") if part]
    if not argv:
        _die("process_argv_empty")
    pairs: list[tuple[bytes, bytes]] = []
    seen: set[bytes] = set()
    for entry in raw_environ.split(b"\0"):
        if not entry:
            continue
        key, sep, value = entry.partition(b"=")
        if not sep or not key or b"\0" in key or b"=" in key or key in seen:
            _die("process_environment_invalid")
        seen.add(key)
        pairs.append((key, value))
    return exe, argv, pairs


def _flag_hits(argv: Sequence[bytes], aliases: Iterable[bytes]) -> list[tuple[int, int | None, bytes, bytes]]:
    hits: list[tuple[int, int | None, bytes, bytes]] = []
    for index, token in enumerate(argv):
        for alias in aliases:
            if token == alias:
                if index + 1 >= len(argv):
                    _die("flag_value_missing")
                hits.append((index, index + 1, alias, argv[index + 1]))
            elif token.startswith(alias + b"="):
                hits.append((index, None, alias, token[len(alias) + 1:]))
    return hits


def _flag_value(argv: Sequence[bytes], name: str, *, required: bool = True) -> bytes | None:
    hits = _flag_hits(argv, FLAG_ALIASES[name])
    if not hits:
        if required:
            _die(f"flag_missing:{name}")
        return None
    if len(hits) != 1 or not hits[0][3]:
        _die(f"flag_cardinality:{name}")
    return hits[0][3]


def _replace_flag(argv: Sequence[bytes], name: str, old: bytes, new: bytes) -> list[bytes]:
    result = list(argv)
    hits = _flag_hits(result, FLAG_ALIASES[name])
    if len(hits) != 1 or hits[0][3] != old:
        _die(f"flag_baseline_mismatch:{name}")
    token_index, value_index, alias, _ = hits[0]
    if value_index is None:
        result[token_index] = alias + b"=" + new
    else:
        result[value_index] = new
    return result


def _normalized_argv(argv: Sequence[bytes]) -> list[bytes]:
    result = list(argv)
    hits = _flag_hits(result, FLAG_ALIASES["ubatch_size"])
    if len(hits) != 1:
        _die("flag_cardinality:ubatch_size")
    token_index, value_index, alias, _ = hits[0]
    if value_index is None:
        result[token_index] = alias + b"=<UBATCH>"
    else:
        result[value_index] = b"<UBATCH>"
    return result


def _validate_baseline(argv: Sequence[bytes]) -> None:
    for name, expected in BASELINE_EXPECTED.items():
        if _flag_value(argv, name) != expected:
            _die(f"baseline_flag_mismatch:{name}")


def _candidate_argv(argv: Sequence[bytes]) -> list[bytes]:
    _validate_baseline(argv)
    candidate = _replace_flag(argv, "ubatch_size", b"128", b"512")
    if _cmdline_bytes(_normalized_argv(candidate)) != _cmdline_bytes(_normalized_argv(argv)):
        _die("candidate_unrelated_argv_changed")
    for name, expected in BASELINE_EXPECTED.items():
        if name != "ubatch_size" and _flag_value(candidate, name) != expected:
            _die(f"candidate_unrelated_flag_changed:{name}")
    return candidate


def _parse_port(argv: Sequence[bytes]) -> int:
    raw = _flag_value(argv, "port", required=False)
    if raw is None:
        return 8080
    try:
        value = int(raw.decode("ascii"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise G3CError("port_invalid") from exc
    if not 1 <= value <= 65535:
        _die("port_out_of_range")
    return value


def _parse_probe_host(argv: Sequence[bytes]) -> str:
    raw = _flag_value(argv, "host", required=False)
    if raw is None:
        return "127.0.0.1"
    try:
        host = raw.decode("ascii")
    except UnicodeDecodeError as exc:
        raise G3CError("host_invalid") from exc
    if host in {"0.0.0.0", "127.0.0.1", "localhost"}:
        return "127.0.0.1"
    if host in {"::", "::1"}:
        return "::1"
    _die("model_listener_not_loopback")


def _version_matches(exe: pathlib.Path) -> bool:
    result = _run([str(exe), "--version"], check=False, timeout=10)
    return result.returncode == 0 and EXPECTED_LLAMA_COMMIT_PREFIX in (result.stdout + result.stderr).lower()


def _mem_facts() -> tuple[int, int]:
    values: dict[str, int] = {}
    try:
        for line in pathlib.Path("/proc/meminfo").read_text(encoding="ascii").splitlines():
            key, sep, rest = line.partition(":")
            if sep and key in {"MemAvailable", "SwapTotal", "SwapFree"}:
                values[key] = int(rest.strip().split()[0])
    except (OSError, ValueError, IndexError) as exc:
        raise G3CError("meminfo_unavailable") from exc
    if "MemAvailable" not in values or "SwapTotal" not in values or "SwapFree" not in values:
        _die("meminfo_incomplete")
    return values["MemAvailable"], max(0, values["SwapTotal"] - values["SwapFree"])


def _snapshot_baseline() -> tuple[dict[str, object], dict[str, object]]:
    if _systemctl("is-active", "--quiet", SERVICE, check=False).returncode != 0:
        _die("baseline_service_not_active")
    user = _service_user()
    _require_private_primary_group(user)
    exe, argv, env_pairs = _read_proc(_service_pid())
    _validate_baseline(argv)
    if not _version_matches(exe):
        _die("llama_commit_mismatch")
    mem_available, swap_used = _mem_facts()
    if swap_used != 0 or mem_available < MIN_MEM_AVAILABLE_KB:
        _die("baseline_memory_gate_failed")
    candidate = _candidate_argv(argv)
    normalized = _sha(_cmdline_bytes(_normalized_argv(argv)))
    exe_digest = _file_sha(exe)
    credential = {
        "schema": "gekta.g3c.candidate.v1",
        "service_uid": user.pw_uid,
        "service_gid": user.pw_gid,
        "exe_b64": _b64(os.fsencode(exe)),
        "exe_sha256": exe_digest,
        "argv_b64": [_b64(item) for item in candidate],
        "env_b64": [[_b64(k), _b64(v)] for k, v in env_pairs],
        "candidate_cmdline_sha256": _sha(_cmdline_bytes(candidate)),
        "normalized_cmdline_sha256": normalized,
    }
    metadata = {
        "schema": "gekta.g3c.baseline.v1",
        "service_uid": user.pw_uid,
        "service_gid": user.pw_gid,
        "baseline_cmdline_sha256": _sha(_cmdline_bytes(argv)),
        "candidate_cmdline_sha256": _sha(_cmdline_bytes(candidate)),
        "normalized_cmdline_sha256": normalized,
        "exe_sha256": exe_digest,
        "port": _parse_port(argv),
        "probe_host": _parse_probe_host(argv),
    }
    return credential, metadata


def _atomic_json(path: pathlib.Path, value: dict[str, object], mode: int, uid: int, gid: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    temp = pathlib.Path(temporary)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, sort_keys=True, separators=(",", ":"))
            handle.write("\n"); handle.flush(); os.fsync(handle.fileno())
        os.chown(temp, uid, gid); os.chmod(temp, mode); os.replace(temp, path)
    finally:
        if temp.exists(): temp.unlink()


def _atomic_text(path: pathlib.Path, value: str, mode: int = 0o644) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    temp = pathlib.Path(temporary)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(value); handle.flush(); os.fsync(handle.fileno())
        os.chown(temp, 0, 0); os.chmod(temp, mode); os.replace(temp, path)
    finally:
        if temp.exists(): temp.unlink()


def _load_json(path: pathlib.Path, schema: str) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise G3CError("state_read_failed") from exc
    if not isinstance(value, dict) or value.get("schema") != schema:
        _die("state_schema_invalid")
    return value


def _dropin_text() -> str:
    return "# Gekta SPEED #3896 G3C\n[Service]\nExecStart=\nExecStart=/usr/local/sbin/gekta-qwen-g3c exec\n"


def _socket_ready(host: str, port: int) -> bool:
    family = socket.AF_INET6 if ":" in host else socket.AF_INET
    try:
        with socket.socket(family, socket.SOCK_STREAM) as sock:
            sock.settimeout(1.0)
            return sock.connect_ex((host, port)) == 0
    except OSError:
        return False


def _current_facts() -> dict[str, object]:
    if _systemctl("is-active", "--quiet", SERVICE, check=False).returncode != 0:
        return {"active": False}
    exe, argv, _ = _read_proc(_service_pid())
    mem_available, swap_used = _mem_facts()
    facts: dict[str, object] = {"active": True, "cmdline_sha256": _sha(_cmdline_bytes(argv)),
                               "normalized_cmdline_sha256": _sha(_cmdline_bytes(_normalized_argv(argv))),
                               "exe_sha256": _file_sha(exe), "mem_available_kb": mem_available,
                               "swap_used_kb": swap_used}
    for name in ("threads", "threads_batch", "parallel", "ctx_size", "batch_size", "ubatch_size"):
        facts[name] = (_flag_value(argv, name, required=False) or b"").decode("ascii", "ignore")
    return facts


def _wait_for(expected_cmdline: str, normalized: str, exe_sha: str, host: str, port: int) -> dict[str, object]:
    deadline = time.monotonic() + START_TIMEOUT_SECONDS
    last = "service_not_active"
    while time.monotonic() < deadline:
        try:
            facts = _current_facts()
            if not facts.get("active"): last = "service_not_active"
            elif facts.get("cmdline_sha256") != expected_cmdline: last = "cmdline_mismatch"
            elif facts.get("normalized_cmdline_sha256") != normalized: last = "normalized_cmdline_mismatch"
            elif facts.get("exe_sha256") != exe_sha: last = "executable_mismatch"
            elif not _socket_ready(host, port): last = "listener_not_ready"
            elif int(facts.get("swap_used_kb", 1)) != 0: last = "swap_used"
            elif int(facts.get("mem_available_kb", 0)) < MIN_MEM_AVAILABLE_KB: last = "memory_headroom_low"
            else: return facts
        except G3CError as exc:
            last = str(exc)
        time.sleep(2)
    _die(f"readiness_failed:{last}")


def _cleanup_state() -> None:
    for path in (CANDIDATE_PATH, BASELINE_PATH):
        try: path.unlink()
        except FileNotFoundError: pass
    try: STATE_DIR.rmdir()
    except OSError: pass


def _validate_baseline_from_facts(facts: dict[str, object]) -> None:
    for name, expected in BASELINE_EXPECTED.items():
        if str(facts.get(name, "")) != expected.decode("ascii"):
            _die(f"runtime_baseline_mismatch:{name}")


def _restore(metadata: dict[str, object], *, cleanup: bool) -> dict[str, object]:
    try: DROPIN_PATH.unlink()
    except FileNotFoundError: pass
    _systemctl("daemon-reload")
    _systemctl("restart", SERVICE, timeout=30)
    facts = _wait_for(str(metadata["baseline_cmdline_sha256"]), str(metadata["normalized_cmdline_sha256"]),
                      str(metadata["exe_sha256"]), str(metadata["probe_host"]), int(metadata["port"]))
    _validate_baseline_from_facts(facts)
    if cleanup: _cleanup_state()
    return facts


def _with_lock():
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    handle = LOCK_PATH.open("a+")
    fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
    return handle


def _ubatch512() -> None:
    _require_root()
    with _with_lock():
        if DROPIN_PATH.exists() or CANDIDATE_PATH.exists() or BASELINE_PATH.exists():
            facts = _current_facts()
            if DROPIN_PATH.exists() and CANDIDATE_PATH.exists() and BASELINE_PATH.exists() and facts.get("ubatch_size") == "512":
                print("GEKTA_G3C_STATE=CANDIDATE"); print("GEKTA_G3C_RESULT=ALREADY_ACTIVE"); return
            _die("candidate_state_not_clean")
        credential, metadata = _snapshot_baseline()
        gid = int(metadata["service_gid"])
        STATE_DIR.mkdir(mode=0o750, parents=True, exist_ok=False); os.chown(STATE_DIR, 0, gid); os.chmod(STATE_DIR, 0o750)
        _atomic_json(CANDIDATE_PATH, credential, 0o640, 0, gid)
        _atomic_json(BASELINE_PATH, metadata, 0o600, 0, 0)
        DROPIN_DIR.mkdir(mode=0o755, parents=True, exist_ok=True)
        _atomic_text(DROPIN_PATH, _dropin_text())
        try:
            _systemctl("daemon-reload"); _systemctl("restart", SERVICE, timeout=30)
            facts = _wait_for(str(metadata["candidate_cmdline_sha256"]), str(metadata["normalized_cmdline_sha256"]),
                              str(metadata["exe_sha256"]), str(metadata["probe_host"]), int(metadata["port"]))
            if facts.get("ubatch_size") != "512": _die("candidate_ubatch_not_active")
            for name, expected in BASELINE_EXPECTED.items():
                if name != "ubatch_size" and str(facts.get(name, "")) != expected.decode("ascii"):
                    _die(f"candidate_unrelated_runtime_drift:{name}")
        except Exception as candidate_error:
            rollback_error: Exception | None = None
            try:
                _restore(metadata, cleanup=True); print("GEKTA_G3C_AUTO_ROLLBACK=SUCCESS")
            except Exception as exc:
                rollback_error = exc; print("GEKTA_G3C_AUTO_ROLLBACK=FAILED")
            if rollback_error is not None:
                raise G3CError(f"candidate_failed_and_rollback_failed:{candidate_error}:{rollback_error}") from candidate_error
            raise
        print("GEKTA_G3C_STATE=CANDIDATE")
        print("GEKTA_G3C_UBATCH=512")
        print(f"GEKTA_G3C_MEM_AVAILABLE_KB={facts['mem_available_kb']}")
        print("GEKTA_G3C_SWAP_USED_KB=0")
        print("GEKTA_G3C_RESULT=APPLIED")


def _rollback() -> None:
    _require_root()
    with _with_lock():
        if not DROPIN_PATH.exists() and not BASELINE_PATH.exists() and not CANDIDATE_PATH.exists():
            facts = _current_facts(); _validate_baseline_from_facts(facts)
            print("GEKTA_G3C_STATE=BASELINE"); print("GEKTA_G3C_RESULT=ALREADY_BASELINE"); return
        if not BASELINE_PATH.exists(): _die("rollback_baseline_metadata_missing")
        facts = _restore(_load_json(BASELINE_PATH, "gekta.g3c.baseline.v1"), cleanup=True)
        print("GEKTA_G3C_STATE=BASELINE")
        print("GEKTA_G3C_UBATCH=128")
        print(f"GEKTA_G3C_MEM_AVAILABLE_KB={facts['mem_available_kb']}")
        print("GEKTA_G3C_RESULT=ROLLED_BACK")


def _status() -> None:
    _require_root()
    with _with_lock():
        facts = _current_facts()
        if not facts.get("active"):
            print("GEKTA_G3C_STATE=SERVICE_DOWN"); print("GEKTA_G3C_RESULT=STATUS"); return
        ubatch = str(facts.get("ubatch_size", ""))
        state = "CANDIDATE" if DROPIN_PATH.exists() and CANDIDATE_PATH.exists() and BASELINE_PATH.exists() and ubatch == "512" else (
            "BASELINE" if not DROPIN_PATH.exists() and ubatch == "128" else "UNKNOWN")
        print(f"GEKTA_G3C_STATE={state}")
        print(f"GEKTA_G3C_UBATCH={ubatch or 'UNKNOWN'}")
        print(f"GEKTA_G3C_THREADS={facts.get('threads') or 'UNKNOWN'}")
        print(f"GEKTA_G3C_THREADS_BATCH={facts.get('threads_batch') or 'UNKNOWN'}")
        print(f"GEKTA_G3C_PARALLEL={facts.get('parallel') or 'UNKNOWN'}")
        print(f"GEKTA_G3C_CTX_SIZE={facts.get('ctx_size') or 'UNKNOWN'}")
        print(f"GEKTA_G3C_BATCH_SIZE={facts.get('batch_size') or 'UNKNOWN'}")
        print(f"GEKTA_G3C_MEM_AVAILABLE_KB={facts.get('mem_available_kb') or 0}")
        print(f"GEKTA_G3C_SWAP_USED_KB={facts.get('swap_used_kb') or 0}")
        print("GEKTA_G3C_RESULT=STATUS")


def _exec_candidate() -> NoReturn:
    if os.geteuid() == 0: _die("candidate_exec_must_use_service_user")
    data = _load_json(CANDIDATE_PATH, "gekta.g3c.candidate.v1")
    if os.geteuid() != int(data.get("service_uid", -1)) or os.getegid() != int(data.get("service_gid", -1)):
        _die("candidate_exec_identity_mismatch")
    exe = pathlib.Path(os.fsdecode(_unb64(str(data["exe_b64"]))))
    if not exe.is_file() or _file_sha(exe) != data.get("exe_sha256"): _die("candidate_exec_binary_mismatch")
    argv_raw, env_raw = data.get("argv_b64"), data.get("env_b64")
    if not isinstance(argv_raw, list) or not isinstance(env_raw, list): _die("candidate_exec_state_invalid")
    argv = [_unb64(str(item)) for item in argv_raw]
    env: dict[bytes, bytes] = {}
    for pair in env_raw:
        if not isinstance(pair, list) or len(pair) != 2: _die("candidate_exec_environment_invalid")
        key, value = _unb64(str(pair[0])), _unb64(str(pair[1]))
        if not key or b"=" in key or b"\0" in key or b"\0" in value or key in env: _die("candidate_exec_environment_invalid")
        env[key] = value
    if _sha(_cmdline_bytes(argv)) != data.get("candidate_cmdline_sha256"): _die("candidate_exec_cmdline_digest_mismatch")
    if _sha(_cmdline_bytes(_normalized_argv(argv))) != data.get("normalized_cmdline_sha256"): _die("candidate_exec_normalized_digest_mismatch")
    if _flag_value(argv, "ubatch_size") != b"512": _die("candidate_exec_ubatch_invalid")
    for name, expected in BASELINE_EXPECTED.items():
        if name != "ubatch_size" and _flag_value(argv, name) != expected: _die(f"candidate_exec_unrelated_flag_invalid:{name}")
    os.execve(os.fsencode(exe), argv, env)


def _bootstrap_check() -> None:
    _require_root()
    st = HELPER_PATH.stat() if HELPER_PATH.is_file() else None
    if st is None or st.st_uid != 0 or st.st_gid != 0 or st.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
        _die("installed_helper_permissions_invalid")
    user = _service_user(); _require_private_primary_group(user)
    if DROPIN_PATH.exists() or CANDIDATE_PATH.exists() or BASELINE_PATH.exists(): _die("bootstrap_requires_clean_g3c_state")
    _, metadata = _snapshot_baseline()
    if int(metadata["service_uid"]) != user.pw_uid: _die("bootstrap_service_identity_drift")
    print("GEKTA_G3C_BOOTSTRAP=READY")
    print("GEKTA_G3C_BASELINE_UBATCH=128")
    print("GEKTA_G3C_CANDIDATE_UBATCH=512")


def _self_test() -> None:
    baseline = [b"/opt/llama-server", b"--ctx-size", b"8192", b"--threads", b"16", b"--threads-batch=16",
                b"--parallel", b"1", b"--batch-size", b"512", b"--ubatch-size", b"128", b"--api-key", b"secret"]
    candidate = _candidate_argv(baseline)
    assert _flag_value(candidate, "ubatch_size") == b"512"
    assert _cmdline_bytes(_normalized_argv(candidate)) == _cmdline_bytes(_normalized_argv(baseline))
    assert candidate[candidate.index(b"--api-key") + 1] == b"secret"
    for name in ("threads", "threads_batch", "parallel", "ctx_size", "batch_size"):
        assert _flag_value(candidate, name) == BASELINE_EXPECTED[name]
    try: _candidate_argv(_replace_flag(baseline, "parallel", b"1", b"2"))
    except G3CError: pass
    else: raise AssertionError("parallel drift must fail closed")
    print("GEKTA_G3C_SELF_TEST=PASS")


def main() -> int:
    if len(sys.argv) != 2:
        print("GEKTA_G3C_ERROR=invalid_argument_count", file=sys.stderr); return 64
    try:
        action = sys.argv[1]
        if action == "ubatch512": _ubatch512()
        elif action == "rollback": _rollback()
        elif action == "status": _status()
        elif action == "exec": _exec_candidate()
        elif action == "bootstrap-check": _bootstrap_check()
        elif action == "self-test": _self_test()
        else: _die("action_not_allowed")
        return 0
    except (G3CError, OSError, subprocess.SubprocessError) as exc:
        safe = re.sub(r"[^A-Za-z0-9_.:-]+", "_", str(exc))[:180] or "unknown"
        print(f"GEKTA_G3C_ERROR={safe}", file=sys.stderr); return 1


if __name__ == "__main__":
    raise SystemExit(main())
