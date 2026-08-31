#!/usr/bin/env python3
"""Fail-closed runtime helper for the bounded Gekta G3B threads candidate.

Installed once by root at /usr/local/sbin/gekta-qwen-g3b. GitHub never gets a
root SSH credential. The existing model-host principal may sudo only the exact
`threads16`, `rollback`, and `status` commands through a generated sudoers rule.

The transient candidate replaces only ExecStart. It snapshots the already
running llama-server executable, argv and environment, changes exactly
--threads 8 -> 16 and --threads-batch 8 -> 16, then execs the same binary under
the existing systemd service user. Every unrelated argv byte and environment
entry is preserved. A failed restart or verification automatically restores the
original root-owned launcher.
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
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import time
from typing import Iterable, Sequence

SERVICE = "tai-qwen3-8b.service"
HELPER_PATH = pathlib.Path("/usr/local/sbin/gekta-qwen-g3b")
STATE_DIR = pathlib.Path("/var/lib/gekta-qwen-g3b")
CANDIDATE_PATH = STATE_DIR / "candidate.json"
BASELINE_PATH = STATE_DIR / "baseline.json"
DROPIN_DIR = pathlib.Path("/etc/systemd/system/tai-qwen3-8b.service.d")
DROPIN_PATH = DROPIN_DIR / "99-gekta-g3b.conf"
LOCK_PATH = pathlib.Path("/run/lock/gekta-qwen-g3b.lock")
SYSTEMCTL = pathlib.Path("/usr/bin/systemctl")
EXPECTED_LLAMA_COMMIT_PREFIX = "aedb2a5"
START_TIMEOUT_SECONDS = 90
SAFE_ENV = {
    "PATH": "/usr/sbin:/usr/bin:/sbin:/bin",
    "LC_ALL": "C",
    "LANG": "C",
}

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
    "threads": b"8",
    "threads_batch": b"8",
    "parallel": b"1",
    "ctx_size": b"8192",
    "batch_size": b"512",
    "ubatch_size": b"128",
}


class G3BError(RuntimeError):
    pass


def _die(message: str) -> "NoReturn":
    raise G3BError(message)


def _run(args: Sequence[str], *, check: bool = True, timeout: int = 20) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        list(args),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
        timeout=timeout,
        env=SAFE_ENV,
    )
    if check and result.returncode != 0:
        _die(f"command_failed:{pathlib.Path(args[0]).name}:{result.returncode}")
    return result


def _systemctl(*args: str, check: bool = True, timeout: int = 30) -> subprocess.CompletedProcess[str]:
    if not SYSTEMCTL.is_file():
        _die("systemctl_missing")
    return _run([str(SYSTEMCTL), *args], check=check, timeout=timeout)


def _show(prop: str) -> str:
    return _systemctl("show", SERVICE, "--property", prop, "--value").stdout.strip()


def _service_pid() -> int:
    value = _show("MainPID")
    if not re.fullmatch(r"[1-9][0-9]*", value):
        _die("service_mainpid_invalid")
    return int(value)


def _service_user() -> pwd.struct_passwd:
    value = _show("User")
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]{0,31}", value):
        _die("service_user_invalid")
    if value == "root":
        _die("service_user_must_not_be_root")
    try:
        return pwd.getpwnam(value)
    except KeyError as exc:
        raise G3BError("service_user_missing") from exc


def _require_private_primary_group(user: pwd.struct_passwd) -> None:
    members = {entry.pw_name for entry in pwd.getpwall() if entry.pw_gid == user.pw_gid}
    try:
        group = grp.getgrgid(user.pw_gid)
    except KeyError as exc:
        raise G3BError("service_group_missing") from exc
    members.update(group.gr_mem)
    if members != {user.pw_name}:
        _die("service_primary_group_not_private")


def _require_root() -> None:
    if os.geteuid() != 0:
        _die("root_required")


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _unb64(value: str) -> bytes:
    try:
        return base64.b64decode(value.encode("ascii"), validate=True)
    except Exception as exc:  # noqa: BLE001 - fail closed on malformed state
        raise G3BError("state_base64_invalid") from exc


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
        raise G3BError("process_snapshot_unavailable") from exc
    argv = [part for part in raw_cmdline.split(b"\0") if part]
    if not argv:
        _die("process_argv_empty")
    env_pairs: list[tuple[bytes, bytes]] = []
    seen: set[bytes] = set()
    for entry in raw_environ.split(b"\0"):
        if not entry:
            continue
        key, sep, value = entry.partition(b"=")
        if not sep or not key or b"\0" in key or b"=" in key or key in seen:
            _die("process_environment_invalid")
        seen.add(key)
        env_pairs.append((key, value))
    return exe, argv, env_pairs


def _flag_hits(argv: Sequence[bytes], aliases: Iterable[bytes]) -> list[tuple[int, int | None, bytes, bytes]]:
    alias_tuple = tuple(aliases)
    hits: list[tuple[int, int | None, bytes, bytes]] = []
    for index, token in enumerate(argv):
        for alias in alias_tuple:
            if token == alias:
                if index + 1 >= len(argv):
                    _die("flag_value_missing")
                hits.append((index, index + 1, alias, argv[index + 1]))
            elif token.startswith(alias + b"="):
                hits.append((index, None, alias, token[len(alias) + 1 :]))
    return hits


def _flag_value(argv: Sequence[bytes], name: str, *, required: bool = True) -> bytes | None:
    hits = _flag_hits(argv, FLAG_ALIASES[name])
    if not hits:
        if required:
            _die(f"flag_missing:{name}")
        return None
    if len(hits) != 1:
        _die(f"flag_duplicate:{name}")
    value = hits[0][3]
    if not value:
        _die(f"flag_empty:{name}")
    return value


def _replace_flag(argv: Sequence[bytes], name: str, old: bytes, new: bytes) -> list[bytes]:
    result = list(argv)
    hits = _flag_hits(result, FLAG_ALIASES[name])
    if len(hits) != 1:
        _die(f"flag_cardinality:{name}")
    token_index, value_index, alias, value = hits[0]
    if value != old:
        _die(f"flag_baseline_mismatch:{name}")
    if value_index is None:
        result[token_index] = alias + b"=" + new
    else:
        result[value_index] = new
    return result


def _normalized_argv(argv: Sequence[bytes]) -> list[bytes]:
    result = list(argv)
    for name, marker in (("threads", b"<THREADS>"), ("threads_batch", b"<THREADS_BATCH>")):
        hits = _flag_hits(result, FLAG_ALIASES[name])
        if len(hits) != 1:
            _die(f"flag_cardinality:{name}")
        token_index, value_index, alias, _ = hits[0]
        if value_index is None:
            result[token_index] = alias + b"=" + marker
        else:
            result[value_index] = marker
    return result


def _validate_baseline(argv: Sequence[bytes]) -> None:
    for name, expected in BASELINE_EXPECTED.items():
        if _flag_value(argv, name) != expected:
            _die(f"baseline_flag_mismatch:{name}")
    # The threads-family trial must not silently introduce a different KV or
    # scheduler family. We do not require absence as a product invariant; we
    # require that the candidate preserves whatever baseline actually has.


def _candidate_argv(argv: Sequence[bytes]) -> list[bytes]:
    _validate_baseline(argv)
    candidate = _replace_flag(argv, "threads", b"8", b"16")
    candidate = _replace_flag(candidate, "threads_batch", b"8", b"16")
    if _flag_value(candidate, "parallel") != b"1":
        _die("candidate_parallel_changed")
    if _flag_value(candidate, "ctx_size") != b"8192":
        _die("candidate_ctx_changed")
    if _cmdline_bytes(_normalized_argv(candidate)) != _cmdline_bytes(_normalized_argv(argv)):
        _die("candidate_unrelated_argv_changed")
    return candidate


def _parse_port(argv: Sequence[bytes]) -> int:
    value = _flag_value(argv, "port", required=False)
    if value is None:
        return 8080
    try:
        port = int(value.decode("ascii"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise G3BError("port_invalid") from exc
    if not 1 <= port <= 65535:
        _die("port_out_of_range")
    return port


def _parse_probe_host(argv: Sequence[bytes]) -> str:
    value = _flag_value(argv, "host", required=False)
    if value is None:
        return "127.0.0.1"
    try:
        host = value.decode("ascii")
    except UnicodeDecodeError as exc:
        raise G3BError("host_invalid") from exc
    if host in {"0.0.0.0", "127.0.0.1", "localhost"}:
        return "127.0.0.1"
    if host in {"::", "::1"}:
        return "::1"
    # Never resolve an arbitrary hostname from the privileged helper. A literal
    # private address is sufficient for a local readiness probe.
    import ipaddress

    try:
        address = ipaddress.ip_address(host)
    except ValueError as exc:
        raise G3BError("host_not_literal_or_loopback") from exc
    if not (address.is_private or address.is_loopback):
        _die("model_listener_not_private")
    return host


def _version_matches(exe: pathlib.Path) -> bool:
    result = _run([str(exe), "--version"], check=False, timeout=10)
    combined = (result.stdout + "\n" + result.stderr).lower()
    return result.returncode == 0 and EXPECTED_LLAMA_COMMIT_PREFIX in combined


def _snapshot_baseline() -> tuple[dict[str, object], dict[str, object]]:
    if _systemctl("is-active", "--quiet", SERVICE, check=False).returncode != 0:
        _die("baseline_service_not_active")
    user = _service_user()
    _require_private_primary_group(user)
    pid = _service_pid()
    exe, argv, env_pairs = _read_proc(pid)
    _validate_baseline(argv)
    if not _version_matches(exe):
        _die("llama_commit_mismatch")
    candidate = _candidate_argv(argv)
    exe_digest = _file_sha(exe)
    normalized_digest = _sha(_cmdline_bytes(_normalized_argv(argv)))
    baseline_digest = _sha(_cmdline_bytes(argv))
    candidate_digest = _sha(_cmdline_bytes(candidate))
    port = _parse_port(argv)
    probe_host = _parse_probe_host(argv)

    credential = {
        "schema": "gekta.g3b.candidate.v1",
        "service_uid": user.pw_uid,
        "service_gid": user.pw_gid,
        "exe_b64": _b64(os.fsencode(exe)),
        "exe_sha256": exe_digest,
        "argv_b64": [_b64(item) for item in candidate],
        "env_b64": [[_b64(key), _b64(value)] for key, value in env_pairs],
        "candidate_cmdline_sha256": candidate_digest,
        "normalized_cmdline_sha256": normalized_digest,
    }
    metadata = {
        "schema": "gekta.g3b.baseline.v1",
        "service_uid": user.pw_uid,
        "service_gid": user.pw_gid,
        "baseline_cmdline_sha256": baseline_digest,
        "candidate_cmdline_sha256": candidate_digest,
        "normalized_cmdline_sha256": normalized_digest,
        "exe_sha256": exe_digest,
        "port": port,
        "probe_host": probe_host,
    }
    return credential, metadata


def _atomic_json(path: pathlib.Path, value: dict[str, object], mode: int, uid: int, gid: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    temp_path = pathlib.Path(temporary)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, sort_keys=True, separators=(",", ":"))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chown(temp_path, uid, gid)
        os.chmod(temp_path, mode)
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def _atomic_text(path: pathlib.Path, value: str, mode: int = 0o644) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    temp_path = pathlib.Path(temporary)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(value)
            handle.flush()
            os.fsync(handle.fileno())
        os.chown(temp_path, 0, 0)
        os.chmod(temp_path, mode)
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def _load_json(path: pathlib.Path, expected_schema: str) -> dict[str, object]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise G3BError("state_read_failed") from exc
    if not isinstance(raw, dict) or raw.get("schema") != expected_schema:
        _die("state_schema_invalid")
    return raw


def _dropin_text() -> str:
    return (
        "# Managed only by /usr/local/sbin/gekta-qwen-g3b for issue #3896.\n"
        "[Service]\n"
        "ExecStart=\n"
        "ExecStart=/usr/local/sbin/gekta-qwen-g3b exec\n"
    )


def _socket_ready(host: str, port: int) -> bool:
    family = socket.AF_INET6 if ":" in host else socket.AF_INET
    try:
        with socket.socket(family, socket.SOCK_STREAM) as sock:
            sock.settimeout(1.0)
            return sock.connect_ex((host, port)) == 0
    except OSError:
        return False


def _current_facts() -> dict[str, object]:
    active = _systemctl("is-active", "--quiet", SERVICE, check=False).returncode == 0
    if not active:
        return {"active": False}
    pid = _service_pid()
    exe, argv, _ = _read_proc(pid)
    facts: dict[str, object] = {
        "active": True,
        "threads": (_flag_value(argv, "threads", required=False) or b"").decode("ascii", "ignore"),
        "threads_batch": (_flag_value(argv, "threads_batch", required=False) or b"").decode("ascii", "ignore"),
        "parallel": (_flag_value(argv, "parallel", required=False) or b"").decode("ascii", "ignore"),
        "ctx_size": (_flag_value(argv, "ctx_size", required=False) or b"").decode("ascii", "ignore"),
        "cmdline_sha256": _sha(_cmdline_bytes(argv)),
        "normalized_cmdline_sha256": _sha(_cmdline_bytes(_normalized_argv(argv))),
        "exe_sha256": _file_sha(exe),
    }
    return facts


def _wait_for(expected_cmdline_sha: str, normalized_sha: str, exe_sha: str, host: str, port: int) -> None:
    deadline = time.monotonic() + START_TIMEOUT_SECONDS
    last_reason = "service_not_active"
    while time.monotonic() < deadline:
        try:
            facts = _current_facts()
            if not facts.get("active"):
                last_reason = "service_not_active"
            elif facts.get("cmdline_sha256") != expected_cmdline_sha:
                last_reason = "cmdline_mismatch"
            elif facts.get("normalized_cmdline_sha256") != normalized_sha:
                last_reason = "normalized_cmdline_mismatch"
            elif facts.get("exe_sha256") != exe_sha:
                last_reason = "executable_mismatch"
            elif not _socket_ready(host, port):
                last_reason = "listener_not_ready"
            else:
                return
        except G3BError as exc:
            last_reason = str(exc)
        time.sleep(2)
    _die(f"candidate_readiness_failed:{last_reason}")


def _cleanup_state() -> None:
    for path in (CANDIDATE_PATH, BASELINE_PATH):
        try:
            path.unlink()
        except FileNotFoundError:
            pass
    try:
        STATE_DIR.rmdir()
    except OSError:
        pass


def _restore_original(metadata: dict[str, object], *, cleanup: bool) -> None:
    try:
        DROPIN_PATH.unlink()
    except FileNotFoundError:
        pass
    _systemctl("daemon-reload")
    _systemctl("restart", SERVICE, timeout=30)
    _wait_for(
        str(metadata["baseline_cmdline_sha256"]),
        str(metadata["normalized_cmdline_sha256"]),
        str(metadata["exe_sha256"]),
        str(metadata["probe_host"]),
        int(metadata["port"]),
    )
    facts = _current_facts()
    if facts.get("threads") != "8" or facts.get("threads_batch") != "8":
        _die("rollback_threads_not_baseline")
    if facts.get("parallel") != "1" or facts.get("ctx_size") != "8192":
        _die("rollback_scheduler_not_baseline")
    if cleanup:
        _cleanup_state()


def _with_lock():
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    handle = LOCK_PATH.open("a+")
    fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
    return handle


def _threads16() -> None:
    _require_root()
    with _with_lock():
        if DROPIN_PATH.exists() or CANDIDATE_PATH.exists() or BASELINE_PATH.exists():
            facts = _current_facts()
            if (
                DROPIN_PATH.exists()
                and CANDIDATE_PATH.exists()
                and BASELINE_PATH.exists()
                and facts.get("threads") == "16"
                and facts.get("threads_batch") == "16"
                and facts.get("parallel") == "1"
                and facts.get("ctx_size") == "8192"
            ):
                print("GEKTA_G3B_STATE=CANDIDATE")
                print("GEKTA_G3B_RESULT=ALREADY_ACTIVE")
                return
            _die("candidate_state_not_clean")

        credential, metadata = _snapshot_baseline()
        uid = int(metadata["service_uid"])
        gid = int(metadata["service_gid"])
        STATE_DIR.mkdir(mode=0o750, parents=True, exist_ok=False)
        os.chown(STATE_DIR, 0, gid)
        os.chmod(STATE_DIR, 0o750)
        _atomic_json(CANDIDATE_PATH, credential, 0o640, 0, gid)
        _atomic_json(BASELINE_PATH, metadata, 0o600, 0, 0)
        DROPIN_DIR.mkdir(mode=0o755, parents=True, exist_ok=True)
        _atomic_text(DROPIN_PATH, _dropin_text(), 0o644)

        try:
            _systemctl("daemon-reload")
            _systemctl("restart", SERVICE, timeout=30)
            _wait_for(
                str(metadata["candidate_cmdline_sha256"]),
                str(metadata["normalized_cmdline_sha256"]),
                str(metadata["exe_sha256"]),
                str(metadata["probe_host"]),
                int(metadata["port"]),
            )
            facts = _current_facts()
            if facts.get("threads") != "16" or facts.get("threads_batch") != "16":
                _die("candidate_threads_not_active")
            if facts.get("parallel") != "1" or facts.get("ctx_size") != "8192":
                _die("candidate_scheduler_drift")
        except Exception as candidate_error:  # noqa: BLE001 - rollback must run for every failure
            rollback_error: Exception | None = None
            try:
                _restore_original(metadata, cleanup=True)
                print("GEKTA_G3B_AUTO_ROLLBACK=SUCCESS")
            except Exception as exc:  # noqa: BLE001
                rollback_error = exc
                print("GEKTA_G3B_AUTO_ROLLBACK=FAILED")
            if rollback_error is not None:
                raise G3BError(f"candidate_failed_and_rollback_failed:{candidate_error}:{rollback_error}") from candidate_error
            raise

        print("GEKTA_G3B_STATE=CANDIDATE")
        print("GEKTA_G3B_THREADS=16")
        print("GEKTA_G3B_THREADS_BATCH=16")
        print("GEKTA_G3B_PARALLEL=1")
        print("GEKTA_G3B_CTX_SIZE=8192")
        print("GEKTA_G3B_RESULT=APPLIED")


def _rollback() -> None:
    _require_root()
    with _with_lock():
        if not DROPIN_PATH.exists() and not BASELINE_PATH.exists() and not CANDIDATE_PATH.exists():
            facts = _current_facts()
            if (
                facts.get("active")
                and facts.get("threads") == "8"
                and facts.get("threads_batch") == "8"
                and facts.get("parallel") == "1"
                and facts.get("ctx_size") == "8192"
            ):
                print("GEKTA_G3B_STATE=BASELINE")
                print("GEKTA_G3B_RESULT=ALREADY_BASELINE")
                return
            _die("rollback_metadata_missing")
        if not BASELINE_PATH.exists():
            _die("rollback_baseline_metadata_missing")
        metadata = _load_json(BASELINE_PATH, "gekta.g3b.baseline.v1")
        _restore_original(metadata, cleanup=True)
        print("GEKTA_G3B_STATE=BASELINE")
        print("GEKTA_G3B_THREADS=8")
        print("GEKTA_G3B_THREADS_BATCH=8")
        print("GEKTA_G3B_PARALLEL=1")
        print("GEKTA_G3B_CTX_SIZE=8192")
        print("GEKTA_G3B_RESULT=ROLLED_BACK")


def _status() -> None:
    _require_root()
    with _with_lock():
        facts = _current_facts()
        if not facts.get("active"):
            print("GEKTA_G3B_STATE=SERVICE_DOWN")
            print("GEKTA_G3B_RESULT=STATUS")
            return
        threads = str(facts.get("threads", ""))
        threads_batch = str(facts.get("threads_batch", ""))
        parallel = str(facts.get("parallel", ""))
        ctx_size = str(facts.get("ctx_size", ""))
        if DROPIN_PATH.exists() and CANDIDATE_PATH.exists() and BASELINE_PATH.exists() and threads == "16" and threads_batch == "16":
            state = "CANDIDATE"
        elif not DROPIN_PATH.exists() and threads == "8" and threads_batch == "8":
            state = "BASELINE"
        else:
            state = "UNKNOWN"
        print(f"GEKTA_G3B_STATE={state}")
        print(f"GEKTA_G3B_THREADS={threads or 'UNKNOWN'}")
        print(f"GEKTA_G3B_THREADS_BATCH={threads_batch or 'UNKNOWN'}")
        print(f"GEKTA_G3B_PARALLEL={parallel or 'UNKNOWN'}")
        print(f"GEKTA_G3B_CTX_SIZE={ctx_size or 'UNKNOWN'}")
        print("GEKTA_G3B_RESULT=STATUS")


def _exec_candidate() -> "NoReturn":
    if os.geteuid() == 0:
        _die("candidate_exec_must_use_service_user")
    data = _load_json(CANDIDATE_PATH, "gekta.g3b.candidate.v1")
    if os.geteuid() != int(data.get("service_uid", -1)) or os.getegid() != int(data.get("service_gid", -1)):
        _die("candidate_exec_identity_mismatch")
    exe = pathlib.Path(os.fsdecode(_unb64(str(data["exe_b64"]))))
    if not exe.is_file() or _file_sha(exe) != data.get("exe_sha256"):
        _die("candidate_exec_binary_mismatch")
    argv_raw = data.get("argv_b64")
    env_raw = data.get("env_b64")
    if not isinstance(argv_raw, list) or not isinstance(env_raw, list):
        _die("candidate_exec_state_invalid")
    argv = [_unb64(str(item)) for item in argv_raw]
    env: dict[bytes, bytes] = {}
    for pair in env_raw:
        if not isinstance(pair, list) or len(pair) != 2:
            _die("candidate_exec_environment_invalid")
        key = _unb64(str(pair[0]))
        value = _unb64(str(pair[1]))
        if not key or b"=" in key or b"\0" in key or b"\0" in value or key in env:
            _die("candidate_exec_environment_invalid")
        env[key] = value
    if _sha(_cmdline_bytes(argv)) != data.get("candidate_cmdline_sha256"):
        _die("candidate_exec_cmdline_digest_mismatch")
    if _sha(_cmdline_bytes(_normalized_argv(argv))) != data.get("normalized_cmdline_sha256"):
        _die("candidate_exec_normalized_digest_mismatch")
    if _flag_value(argv, "threads") != b"16" or _flag_value(argv, "threads_batch") != b"16":
        _die("candidate_exec_threads_invalid")
    if _flag_value(argv, "parallel") != b"1" or _flag_value(argv, "ctx_size") != b"8192":
        _die("candidate_exec_scheduler_invalid")
    os.execve(os.fsencode(exe), argv, env)


def _bootstrap_check() -> None:
    _require_root()
    if not HELPER_PATH.is_file():
        _die("installed_helper_missing")
    helper_stat = HELPER_PATH.stat()
    if helper_stat.st_uid != 0 or helper_stat.st_gid != 0 or helper_stat.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
        _die("installed_helper_permissions_invalid")
    user = _service_user()
    _require_private_primary_group(user)
    if DROPIN_PATH.exists() or CANDIDATE_PATH.exists() or BASELINE_PATH.exists():
        _die("bootstrap_requires_clean_baseline")
    _, metadata = _snapshot_baseline()
    if int(metadata["service_uid"]) != user.pw_uid:
        _die("bootstrap_service_identity_drift")
    print("GEKTA_G3B_BOOTSTRAP=READY")
    print("GEKTA_G3B_BASELINE_THREADS=8")
    print("GEKTA_G3B_BASELINE_THREADS_BATCH=8")
    print("GEKTA_G3B_BASELINE_PARALLEL=1")
    print("GEKTA_G3B_BASELINE_CTX_SIZE=8192")


def _self_test() -> None:
    baseline = [
        b"/opt/llama-server",
        b"--model", b"/private/model.gguf",
        b"--ctx-size", b"8192",
        b"--threads", b"8",
        b"--threads-batch=8",
        b"--parallel", b"1",
        b"--batch-size", b"512",
        b"--ubatch-size", b"128",
        b"--api-key", b"do-not-print",
        b"--metrics",
    ]
    candidate = _candidate_argv(baseline)
    assert _flag_value(candidate, "threads") == b"16"
    assert _flag_value(candidate, "threads_batch") == b"16"
    assert _flag_value(candidate, "parallel") == b"1"
    assert _flag_value(candidate, "ctx_size") == b"8192"
    assert _cmdline_bytes(_normalized_argv(candidate)) == _cmdline_bytes(_normalized_argv(baseline))
    assert baseline[baseline.index(b"--api-key") + 1] == candidate[candidate.index(b"--api-key") + 1]
    try:
        _candidate_argv([item for item in baseline if item != b"1"])
    except G3BError:
        pass
    else:
        raise AssertionError("parallel drift must fail closed")
    print("GEKTA_G3B_SELF_TEST=PASS")


def main() -> int:
    if len(sys.argv) != 2:
        print("GEKTA_G3B_ERROR=invalid_argument_count", file=sys.stderr)
        return 64
    action = sys.argv[1]
    try:
        if action == "threads16":
            _threads16()
        elif action == "rollback":
            _rollback()
        elif action == "status":
            _status()
        elif action == "exec":
            _exec_candidate()
        elif action == "bootstrap-check":
            _bootstrap_check()
        elif action == "self-test":
            _self_test()
        else:
            _die("action_not_allowed")
        return 0
    except G3BError as exc:
        safe = re.sub(r"[^A-Za-z0-9_.:-]+", "_", str(exc))[:180] or "unknown"
        print(f"GEKTA_G3B_ERROR={safe}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
