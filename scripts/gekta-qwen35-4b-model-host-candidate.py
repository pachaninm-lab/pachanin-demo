#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import os
import pathlib
import pwd
import re
import select
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

SERVICE = "tai-qwen3-8b.service"
BASELINE_ALIAS = "tai-qwen3-8b-q4km"
CANDIDATE_ALIAS = "tai-qwen35-4b-q4km"
CANDIDATE_URL = "https://huggingface.co/bartowski/Qwen_Qwen3.5-4B-GGUF/resolve/4168f45a16a1290d65a4ec0fa312ae917a4c15d6/Qwen_Qwen3.5-4B-Q4_K_M.gguf"
CANDIDATE_SHA256 = "13c16f426047e2de38cd075bdade4a7bcbc8c774384876f677740cda65f8a983"
CANDIDATE_SIZE = 3013027808
CANDIDATE_HOST = "127.0.0.1"
CANDIDATE_PORT = 18081
LEASE_SECONDS = 420
LEASE_TERM_MARGIN_SECONDS = 2.0
LEASE_KILL_MARGIN_SECONDS = 1.0
LEASE_POLL_SECONDS = 0.25
CANDIDATE_NICE_DELTA = 10
MIN_FREE_BYTES = 7_000_000_000
MIN_MEM_BEFORE_KB = 8 * 1024 * 1024
MIN_MEM_READY_KB = 3 * 1024 * 1024
MIN_MEM_RUNTIME_KB = 2 * 1024 * 1024
MAX_CANDIDATE_RSS_KB = 7 * 1024 * 1024
EXPECTED = {
    "threads": "16",
    "threads_batch": "16",
    "parallel": "1",
    "ctx": "8192",
    "batch": "512",
    "ubatch": "128",
}
ALIASES = {
    "model": ("--model", "-m"),
    "alias": ("--alias",),
    "host": ("--host",),
    "port": ("--port", "--listen-port"),
    "api_key": ("--api-key",),
    "threads": ("--threads", "-t"),
    "threads_batch": ("--threads-batch", "-tb"),
    "parallel": ("--parallel", "-np"),
    "ctx": ("--ctx-size", "-c"),
    "batch": ("--batch-size", "-b"),
    "ubatch": ("--ubatch-size", "-ub"),
}
BASE_DIR = pathlib.Path.home() / ".cache" / "gekta-qwen35-4b-candidate"
CANDIDATE_DIR = BASE_DIR / "models"
STATE_DIR = BASE_DIR / "state"
CANDIDATE_PATH = CANDIDATE_DIR / ("qwen35-4b-q4-k-m-" + CANDIDATE_SHA256[:12] + ".gguf")
PID_PATH = STATE_DIR / "candidate.pid"
CANDIDATE_IDENTITY_PATH = STATE_DIR / "candidate-identity.json"
WATCHDOG_PID_PATH = STATE_DIR / "watchdog.pid"
STATE_PATH = STATE_DIR / "baseline-state.json"
LOG_PATH = STATE_DIR / "candidate.log"
WATCHDOG_LOG_PATH = STATE_DIR / "watchdog.log"
LOCK_PATH = STATE_DIR / "candidate.lock"

class CandidateError(RuntimeError):
    pass

def fail(message: str) -> None:
    raise CandidateError(message)

def emit(key: str, value) -> None:
    text = str(value)
    if not re.fullmatch(r"[A-Za-z0-9_.:/-]+", text):
        text = hashlib.sha256(text.encode("utf-8", "replace")).hexdigest()
    print("QWEN35_CANDIDATE_%s=%s" % (key, text), flush=True)

def command(args, check=True, timeout=30, env=None):
    result = subprocess.run(
        args,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
        timeout=timeout,
        check=False,
    )
    if check and result.returncode != 0:
        fail("command_failed:%s:%s" % (pathlib.Path(args[0]).name, result.returncode))
    return result

def systemctl_read(*args, check=True, timeout=30):
    forbidden = {"stop", "restart", "start", "kill", "enable", "disable", "daemon-reload", "set-property"}
    if any(str(item) in forbidden for item in args):
        fail("systemctl_mutation_forbidden")
    return command(["/usr/bin/systemctl", *args], check=check, timeout=timeout)

def require_nonroot() -> str:
    if os.geteuid() == 0:
        fail("root_forbidden")
    name = pwd.getpwuid(os.geteuid()).pw_name
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]{0,31}", name):
        fail("runtime_user_invalid")
    return name

def service_pid() -> int:
    raw = systemctl_read("show", SERVICE, "--property=MainPID", "--value").stdout.strip()
    if not re.fullmatch(r"[1-9][0-9]*", raw):
        fail("baseline_pid_invalid")
    return int(raw)

def service_user() -> str:
    raw = systemctl_read("show", SERVICE, "--property=User", "--value").stdout.strip()
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]{0,31}", raw) or raw == "root":
        fail("service_user_invalid")
    return raw

def service_restarts() -> int:
    raw = systemctl_read("show", SERVICE, "--property=NRestarts", "--value").stdout.strip()
    if not re.fullmatch(r"[0-9]+", raw):
        fail("baseline_restarts_invalid")
    return int(raw)

def read_proc(pid: int):
    root = pathlib.Path("/proc/%d" % pid)
    exe = (root / "exe").resolve(strict=True)
    cmdline = (root / "cmdline").read_bytes()
    argv = [item for item in cmdline.split(b"\0") if item]
    raw_env = [item for item in (root / "environ").read_bytes().split(b"\0") if item]
    if not argv:
        fail("baseline_argv_empty")
    env = {}
    for item in raw_env:
        key, sep, value = item.partition(b"=")
        if not sep or not key:
            fail("baseline_environment_invalid")
        env[key.decode("utf-8", "surrogateescape")] = value.decode("utf-8", "surrogateescape")
    return exe, argv, env, cmdline

def proc_kb(pid: int, key: str) -> int:
    try:
        text = pathlib.Path("/proc/%d/status" % pid).read_text(encoding="ascii", errors="replace")
    except FileNotFoundError:
        fail("process_status_missing")
    match = re.search(r"^%s:\s+([0-9]+)\s+kB$" % re.escape(key), text, re.M)
    if not match:
        fail("process_status_key_missing:%s" % key)
    return int(match.group(1))

def mem_available_kb() -> int:
    text = pathlib.Path("/proc/meminfo").read_text(encoding="ascii")
    match = re.search(r"^MemAvailable:\s+([0-9]+)\s+kB$" , text, re.M)
    if not match:
        fail("memavailable_missing")
    return int(match.group(1))

def flag_hits(argv, names):
    hits = []
    for index, token in enumerate(argv):
        for name in names:
            alias = name.encode("ascii")
            if token == alias:
                if index + 1 >= len(argv):
                    fail("flag_value_missing")
                hits.append((index, index + 1, alias, argv[index + 1]))
            elif token.startswith(alias + b"="):
                hits.append((index, None, alias, token[len(alias) + 1:]))
    return hits

def flag_value(argv, key, required=True):
    hits = flag_hits(argv, ALIASES[key])
    if not hits:
        if required:
            fail("flag_missing:%s" % key)
        return None
    if len(hits) != 1 or not hits[0][3]:
        fail("flag_cardinality:%s" % key)
    return hits[0][3]

def first_api_key(raw: str) -> str:
    for item in raw.split(","):
        value = item.strip()
        if value:
            return value
    return ""

def effective_api_key(argv, env) -> str:
    cli = flag_value(argv, "api_key", required=False)
    if cli is not None:
        key = first_api_key(cli.decode("utf-8", "replace"))
        if key:
            return key
    return first_api_key(str(env.get("LLAMA_API_KEY", "")))

def replace_flag(argv, key, value):
    result = list(argv)
    hits = flag_hits(result, ALIASES[key])
    if not hits:
        result.extend([ALIASES[key][0].encode("ascii"), value])
        return result
    if len(hits) != 1:
        fail("flag_cardinality:%s" % key)
    token_index, value_index, alias, _ = hits[0]
    if value_index is None:
        result[token_index] = alias + b"=" + value
    else:
        result[value_index] = value
    return result

def remove_flag(argv, key):
    result = list(argv)
    hits = flag_hits(result, ALIASES[key])
    if len(hits) > 1:
        fail("flag_cardinality:%s" % key)
    if not hits:
        return result
    token_index, value_index, _, _ = hits[0]
    if value_index is None:
        del result[token_index]
    else:
        del result[token_index:value_index + 1]
    return result

def sha_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(8 * 1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()

def http_json(host, port, path, bearer, timeout=5):
    conn = http.client.HTTPConnection(host, port, timeout=timeout)
    try:
        conn.request("GET", path, headers={"Authorization": "Bearer " + bearer, "Accept": "application/json"})
        response = conn.getresponse()
        raw = response.read(1024 * 1024)
        try:
            parsed = json.loads(raw.decode("utf-8", "replace")) if raw else {}
        except json.JSONDecodeError:
            parsed = {}
        return response.status, parsed
    finally:
        conn.close()

def listener_open() -> bool:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.4)
    try:
        return sock.connect_ex((CANDIDATE_HOST, CANDIDATE_PORT)) == 0
    finally:
        sock.close()

def verify_listener_absent() -> None:
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        if not listener_open():
            emit("LISTENER_ABSENT", 1)
            return
        time.sleep(0.25)
    fail("candidate_listener_still_present")

def snapshot_baseline():
    require_nonroot()
    if systemctl_read("is-active", "--quiet", SERVICE, check=False).returncode != 0:
        fail("baseline_service_inactive")
    runtime_user = require_nonroot()
    expected_user = service_user()
    if runtime_user != expected_user:
        fail("runtime_user_not_service_user")
    pid = service_pid()
    exe, argv, env, cmdline = read_proc(pid)
    version = command([str(exe), "--version"], check=False, timeout=10)
    if version.returncode != 0 or "aedb2a5" not in (version.stdout + version.stderr).lower():
        fail("llama_build_mismatch")
    help_text = command([str(exe), "--help"], check=False, timeout=10)
    if help_text.returncode != 0 or "LLAMA_API_KEY" not in (help_text.stdout + help_text.stderr):
        fail("llama_api_key_env_contract_missing")
    for key, expected in EXPECTED.items():
        actual = (flag_value(argv, key) or b"").decode("ascii", "ignore")
        if actual != expected:
            fail("baseline_flag_mismatch:%s" % key)
    alias = (flag_value(argv, "alias") or b"").decode("utf-8", "replace")
    if alias != BASELINE_ALIAS:
        fail("baseline_alias_mismatch")
    api_key = effective_api_key(argv, env)
    if len(api_key) < 32:
        fail("baseline_api_key_missing")
    return {
        "pid": pid,
        "exe": str(exe),
        "cmdlineSha256": hashlib.sha256(cmdline).hexdigest(),
        "apiKeySha256": hashlib.sha256(api_key.encode("utf-8")).hexdigest(),
        "restarts": service_restarts(),
        "vmSwapKb": proc_kb(pid, "VmSwap"),
        "startTime": process_start_time(pid),
    }, exe, argv, env

def baseline_runtime_healthy() -> bool:
    state, _, argv, env = snapshot_baseline()
    alias = (flag_value(argv, "alias") or b"").decode("utf-8", "replace")
    raw_host = (flag_value(argv, "host", required=False) or b"127.0.0.1").decode("ascii", "ignore")
    host = "127.0.0.1" if raw_host in {"0.0.0.0", "::", "localhost"} else raw_host
    raw_port = (flag_value(argv, "port", required=False) or b"8080").decode("ascii", "ignore")
    key = effective_api_key(argv, env)
    if alias != BASELINE_ALIAS or not raw_port.isdigit() or len(key) < 32:
        return False
    try:
        status_code, payload = http_json(host, int(raw_port), "/v1/models", key, timeout=3)
    except OSError:
        return False
    ids = [row.get("id") for row in payload.get("data", []) if isinstance(row, dict)]
    return status_code == 200 and BASELINE_ALIAS in ids and state["vmSwapKb"] == 0

def baseline_matches_state(expected: dict) -> bool:
    try:
        current, _, _, _ = snapshot_baseline()
    except Exception:
        return False
    return (
        current["pid"] == expected.get("pid")
        and current["exe"] == expected.get("exe")
        and current["cmdlineSha256"] == expected.get("cmdlineSha256")
        and current["apiKeySha256"] == expected.get("apiKeySha256")
        and current["restarts"] == expected.get("restarts")
        and current["startTime"] == expected.get("startTime")
    )

def baseline_process_matches_state(expected: dict) -> bool:
    # The lease watchdog must not run systemctl or llama subprocess probes after
    # candidate release. Revalidate the exact already-snapshotted baseline task
    # directly through /proc so a blocked command cannot postpone hard expiry.
    pid = expected.get("pid")
    if not isinstance(pid, int) or pid <= 0:
        return False
    try:
        if process_start_time(pid) != expected.get("startTime"):
            return False
        exe, argv, env, cmdline = read_proc(pid)
        api_key = effective_api_key(argv, env)
        return (
            str(exe) == expected.get("exe")
            and hashlib.sha256(cmdline).hexdigest() == expected.get("cmdlineSha256")
            and hashlib.sha256(api_key.encode("utf-8")).hexdigest() == expected.get("apiKeySha256")
            and proc_kb(pid, "VmSwap") == expected.get("vmSwapKb") == 0
        )
    except Exception:
        return False

def save_state(state: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(STATE_DIR, 0o700)
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    os.chmod(tmp, 0o600)
    os.replace(tmp, STATE_PATH)

def load_state() -> dict:
    try:
        value = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        fail("baseline_state_missing")
    if not isinstance(value, dict) or not isinstance(value.get("pid"), int):
        fail("baseline_state_invalid")
    return value

def ensure_start_capacity(state: dict) -> None:
    if state.get("vmSwapKb") != 0 or proc_kb(state["pid"], "VmSwap") != 0:
        fail("baseline_swap_nonzero")
    available = mem_available_kb()
    if available < MIN_MEM_BEFORE_KB:
        fail("candidate_mem_headroom_low")
    if listener_open():
        fail("candidate_port_in_use")
    emit("BASELINE_SWAP_KB", 0)
    emit("MEM_BEFORE_KB", available)

def download_candidate() -> None:
    CANDIDATE_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(CANDIDATE_DIR, 0o700)
    if shutil.disk_usage(CANDIDATE_DIR).free < MIN_FREE_BYTES:
        fail("candidate_disk_headroom_low")
    if CANDIDATE_PATH.exists():
        if CANDIDATE_PATH.is_symlink() or not CANDIDATE_PATH.is_file():
            fail("candidate_path_unsafe")
        if CANDIDATE_PATH.stat().st_uid != os.geteuid():
            fail("candidate_owner_mismatch")
        if CANDIDATE_PATH.stat().st_size != CANDIDATE_SIZE or sha_file(CANDIDATE_PATH) != CANDIDATE_SHA256:
            fail("candidate_existing_mismatch")
        emit("PREPARE", "REUSED")
        return
    fd, name = tempfile.mkstemp(prefix=".qwen35-4b.", dir=str(CANDIDATE_DIR))
    os.close(fd)
    tmp = pathlib.Path(name)
    try:
        request = urllib.request.Request(CANDIDATE_URL, headers={"User-Agent": "transparent-price/qwen35-candidate"})
        digest = hashlib.sha256()
        size = 0
        with urllib.request.urlopen(request, timeout=90) as response, tmp.open("wb") as out:
            while True:
                chunk = response.read(8 * 1024 * 1024)
                if not chunk:
                    break
                next_size = size + len(chunk)
                if next_size > CANDIDATE_SIZE:
                    fail("candidate_download_size_mismatch")
                out.write(chunk)
                digest.update(chunk)
                size = next_size
            out.flush()
            os.fsync(out.fileno())
        if size != CANDIDATE_SIZE:
            fail("candidate_download_size_mismatch")
        if digest.hexdigest() != CANDIDATE_SHA256:
            fail("candidate_download_hash_mismatch")
        os.chmod(tmp, 0o400)
        os.replace(tmp, CANDIDATE_PATH)
    finally:
        if tmp.exists():
            tmp.unlink()
    emit("PREPARE", "DOWNLOADED")

def write_pid(path: pathlib.Path, pid: int) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(STATE_DIR, 0o700)
    path.write_text("%d\n" % pid, encoding="ascii")
    os.chmod(path, 0o600)

def boot_id() -> str:
    try:
        value = pathlib.Path("/proc/sys/kernel/random/boot_id").read_text(encoding="ascii").strip().lower()
    except OSError:
        fail("candidate_boot_id_missing")
    if not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", value):
        fail("candidate_boot_id_invalid")
    return value

def process_start_time(pid: int) -> int:
    try:
        raw = pathlib.Path("/proc/%d/stat" % pid).read_text(encoding="ascii", errors="replace")
    except FileNotFoundError:
        fail("candidate_process_stat_missing")
    try:
        _, tail = raw.rsplit(")", 1)
        fields = tail.strip().split()
        value = int(fields[19])
    except (ValueError, IndexError):
        fail("candidate_process_stat_invalid")
    if value <= 0:
        fail("candidate_process_starttime_invalid")
    return value

def write_candidate_identity(pid: int) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(STATE_DIR, 0o700)
    identity = {"bootId": boot_id(), "pid": pid, "startTime": process_start_time(pid)}
    tmp = CANDIDATE_IDENTITY_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(identity, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    os.chmod(tmp, 0o600)
    os.replace(tmp, CANDIDATE_IDENTITY_PATH)

def read_candidate_identity() -> dict:
    try:
        identity = json.loads(CANDIDATE_IDENTITY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        fail("candidate_recovery_identity_invalid")
    if (
        not isinstance(identity, dict)
        or set(identity) != {"bootId", "pid", "startTime"}
        or not isinstance(identity["bootId"], str)
        or not isinstance(identity["pid"], int)
        or not isinstance(identity["startTime"], int)
        or identity["pid"] <= 0
        or identity["startTime"] <= 0
        or identity["bootId"] != boot_id()
    ):
        fail("candidate_recovery_identity_invalid")
    return identity

def process_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        fail("candidate_process_permission_denied")

def candidate_process_matches(pid: int) -> bool:
    if not process_alive(pid):
        return False
    try:
        argv = [item for item in pathlib.Path("/proc/%d/cmdline" % pid).read_bytes().split(b"\0") if item]
        model = flag_value(argv, "model", required=False)
        alias = flag_value(argv, "alias", required=False)
    except (FileNotFoundError, CandidateError):
        return False
    return model == os.fsencode(CANDIDATE_PATH) and alias == CANDIDATE_ALIAS.encode("utf-8")

def watchdog_process_matches(pid: int) -> bool:
    if not process_alive(pid):
        return False
    try:
        argv = pathlib.Path("/proc/%d/cmdline" % pid).read_bytes()
    except FileNotFoundError:
        return False
    return b"_watchdog" in argv and os.fsencode(pathlib.Path(__file__).resolve()) in argv

def candidate_guard_process_matches(pid: int) -> bool:
    if not process_alive(pid):
        return False
    try:
        argv = [item for item in pathlib.Path("/proc/%d/cmdline" % pid).read_bytes().split(b"\0") if item]
    except FileNotFoundError:
        return False
    return (
        b"_candidate_exec_guard" in argv
        and os.fsencode(pathlib.Path(__file__).resolve()) in argv
    )

def owned_candidate_process_matches(pid: int) -> bool:
    return candidate_guard_process_matches(pid) or candidate_process_matches(pid)

def candidate_exec_argv_status(argv) -> int:
    if (
        not isinstance(argv, list)
        or not argv
        or len(argv) > 128
        or any(not isinstance(item, str) or not item or len(item) > 4096 or "\0" in item for item in argv)
    ):
        return 79
    encoded = [os.fsencode(item) for item in argv]
    try:
        model = flag_value(encoded, "model", required=False)
        alias = flag_value(encoded, "alias", required=False)
    except CandidateError:
        return 80
    if model != os.fsencode(CANDIDATE_PATH) or alias != CANDIDATE_ALIAS.encode("utf-8"):
        return 80
    return 0

def candidate_exec_guard(guard_fd: int) -> int:
    if guard_fd < 3:
        return 77
    # Remain blocked until the owner process explicitly releases this guard.
    # Validation after the token prevents any pre-release validation path from
    # closing the pipe and racing the parent.
    try:
        token = os.read(guard_fd, 2)
    finally:
        os.close(guard_fd)
    if token != b"G":
        return 81
    raw = os.environ.pop("QWEN35_GUARDED_ARGV_JSON", "")
    try:
        argv = json.loads(raw)
    except json.JSONDecodeError:
        return 78
    status = candidate_exec_argv_status(argv)
    if status:
        return status
    # Lower CPU scheduling priority in this same process, then exec llama
    # directly. Avoid external nice/ionice wrappers so the pidfd/recovery
    # identity remains the exact llama task after release.
    try:
        resulting_nice = os.nice(CANDIDATE_NICE_DELTA)
    except OSError:
        return 83
    if resulting_nice < CANDIDATE_NICE_DELTA:
        return 83
    os.execvpe(argv[0], argv, os.environ)
    return 82

def stop_owned_child(proc: subprocess.Popen, pidfd: int) -> None:
    if proc.poll() is not None:
        return
    try:
        signal.pidfd_send_signal(pidfd, signal.SIGTERM, None, 0)
    except ProcessLookupError:
        proc.wait(timeout=3)
        return
    try:
        proc.wait(timeout=15)
        return
    except subprocess.TimeoutExpired:
        pass
    try:
        signal.pidfd_send_signal(pidfd, signal.SIGKILL, None, 0)
    except ProcessLookupError:
        proc.wait(timeout=3)
        return
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        fail("candidate_owned_process_survived_sigkill")

def pidfd_exited(pidfd: int) -> bool:
    poller = select.poll()
    poller.register(pidfd, select.POLLIN | select.POLLHUP | select.POLLERR)
    return bool(poller.poll(0))

def wait_pidfd_exit(pidfd: int, timeout_seconds: float) -> bool:
    poller = select.poll()
    poller.register(pidfd, select.POLLIN | select.POLLHUP | select.POLLERR)
    return bool(poller.poll(max(0, int(timeout_seconds * 1000))))

def open_recovery_pidfd(identity: dict):
    if not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal"):
        fail("pidfd_signal_unavailable")
    pid = identity["pid"]
    try:
        fd = os.pidfd_open(pid, 0)
    except ProcessLookupError:
        return None
    try:
        if pidfd_exited(fd):
            return fd
        if process_start_time(pid) != identity["startTime"]:
            fail("candidate_recovery_identity_mismatch")
        return fd
    except Exception:
        os.close(fd)
        raise

def recovery_process_active() -> bool:
    if not CANDIDATE_IDENTITY_PATH.exists():
        if PID_PATH.exists():
            fail("candidate_recovery_identity_missing")
        return False
    identity = read_candidate_identity()
    fd = open_recovery_pidfd(identity)
    if fd is None:
        return False
    try:
        return not pidfd_exited(fd)
    finally:
        os.close(fd)

def stop_pidfd_owned_process(pidfd: int) -> None:
    if pidfd_exited(pidfd):
        return
    try:
        signal.pidfd_send_signal(pidfd, signal.SIGTERM, None, 0)
    except ProcessLookupError:
        return
    if wait_pidfd_exit(pidfd, 15):
        return
    try:
        signal.pidfd_send_signal(pidfd, signal.SIGKILL, None, 0)
    except ProcessLookupError:
        return
    if not wait_pidfd_exit(pidfd, 5):
        fail("pidfd_owned_process_survived_sigkill")

def process_nice(pid: int) -> int:
    try:
        raw = pathlib.Path("/proc/%d/stat" % pid).read_text(encoding="ascii", errors="replace")
        _, tail = raw.rsplit(")", 1)
        fields = tail.strip().split()
        if len(fields) <= 16:
            fail("candidate_stat_invalid")
        return int(fields[16])
    except (FileNotFoundError, ProcessLookupError, PermissionError, ValueError):
        fail("candidate_nice_unavailable")

def process_group_members(pgid: int) -> list[int]:
    members: list[int] = []
    for entry in pathlib.Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            raw = (entry / "stat").read_text(encoding="ascii", errors="replace")
            _, tail = raw.rsplit(")", 1)
            fields = tail.strip().split()
            if len(fields) >= 3 and int(fields[2]) == pgid:
                members.append(int(entry.name))
        except (FileNotFoundError, ProcessLookupError, PermissionError, ValueError):
            continue
    return sorted(members)

def require_isolated_candidate_group(pid: int) -> None:
    if not candidate_process_matches(pid):
        fail("candidate_identity_missing")
    if process_group_members(pid) != [pid]:
        fail("candidate_process_group_not_isolated")

def open_candidate_pidfd(pid: int):
    if not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal"):
        fail("pidfd_signal_unavailable")
    try:
        fd = os.pidfd_open(pid, 0)
    except ProcessLookupError:
        return None
    try:
        if not candidate_process_matches(pid):
            os.close(fd)
            return None
        try:
            if os.getpgid(pid) != pid:
                fail("candidate_process_group_mismatch")
        except ProcessLookupError:
            os.close(fd)
            return None
        return fd
    except Exception:
        os.close(fd)
        raise

def open_owned_candidate_pidfd(pid: int):
    if not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal"):
        fail("pidfd_signal_unavailable")
    try:
        fd = os.pidfd_open(pid, 0)
    except ProcessLookupError:
        return None
    try:
        if pidfd_exited(fd):
            os.close(fd)
            return None
        if not owned_candidate_process_matches(pid):
            os.close(fd)
            return None
        if pidfd_exited(fd):
            os.close(fd)
            return None
        try:
            if os.getpgid(pid) != pid:
                fail("candidate_process_group_mismatch")
        except ProcessLookupError:
            os.close(fd)
            return None
        if pidfd_exited(fd):
            os.close(fd)
            return None
        return fd
    except Exception:
        os.close(fd)
        raise

def signal_candidate(pid: int, sig) -> None:
    fd = open_candidate_pidfd(pid)
    if fd is None:
        return
    try:
        # Signal the already-verified candidate through its pidfd only. Never
        # signal by a reusable numeric PID/PGID.
        require_isolated_candidate_group(pid)
        signal.pidfd_send_signal(fd, sig, None, 0)
    except ProcessLookupError:
        return
    except PermissionError:
        fail("candidate_signal_permission_denied")
    finally:
        os.close(fd)

def stop_candidate_pid(pid: int) -> None:
    fd = open_owned_candidate_pidfd(pid)
    if fd is None:
        if process_alive(pid):
            fail("candidate_owned_identity_unrecognized")
        return
    try:
        stop_pidfd_owned_process(fd)
    finally:
        os.close(fd)

def stop_candidate() -> None:
    if not CANDIDATE_IDENTITY_PATH.exists():
        if PID_PATH.exists():
            fail("candidate_recovery_identity_missing")
        return
    identity = read_candidate_identity()
    fd = open_recovery_pidfd(identity)
    if fd is None:
        return
    try:
        if not pidfd_exited(fd):
            stop_pidfd_owned_process(fd)
        if not pidfd_exited(fd):
            fail("candidate_recovery_process_alive")
    finally:
        os.close(fd)

def stop_watchdog() -> None:
    fd = None
    try:
        raw = WATCHDOG_PID_PATH.read_text(encoding="ascii").strip()
        if not re.fullmatch(r"[1-9][0-9]*", raw):
            WATCHDOG_PID_PATH.unlink(missing_ok=True)
            return
        pid = int(raw)
        if not watchdog_process_matches(pid):
            WATCHDOG_PID_PATH.unlink(missing_ok=True)
            return
        if not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal"):
            fail("pidfd_signal_unavailable")
        fd = os.pidfd_open(pid, 0)
        if watchdog_process_matches(pid):
            signal.pidfd_send_signal(fd, signal.SIGTERM, None, 0)
    except (OSError, ProcessLookupError):
        pass
    finally:
        if fd is not None:
            os.close(fd)
    WATCHDOG_PID_PATH.unlink(missing_ok=True)

def launch_watchdog(candidate_pid: int, baseline_pid: int):
    if not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal"):
        fail("pidfd_signal_unavailable")
    ready_read, ready_write = os.pipe()
    arm_read, arm_write = os.pipe()
    os.set_inheritable(ready_write, True)
    os.set_inheritable(arm_read, True)
    log = WATCHDOG_LOG_PATH.open("ab", buffering=0)
    proc = None
    watchdog_pidfd = None
    pid_recorded = False
    try:
        proc = subprocess.Popen(
            [
                sys.executable,
                str(pathlib.Path(__file__).resolve()),
                "_watchdog",
                "--candidate-pid",
                str(candidate_pid),
                "--baseline-pid",
                str(baseline_pid),
                "--watchdog-ready-fd",
                str(ready_write),
                "--watchdog-arm-fd",
                str(arm_read),
            ],
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            cwd="/",
            start_new_session=True,
            close_fds=True,
            pass_fds=(ready_write, arm_read),
        )
        os.close(ready_write)
        ready_write = -1
        os.close(arm_read)
        arm_read = -1
        watchdog_pidfd = os.pidfd_open(proc.pid, 0)
        write_pid(WATCHDOG_PID_PATH, proc.pid)
        pid_recorded = True

        readable, _, _ = select.select([ready_read], [], [], 5)
        if not readable:
            fail("candidate_watchdog_ready_timeout")
        token = os.read(ready_read, 2)
        if token != b"R" or proc.poll() is not None or pidfd_exited(watchdog_pidfd):
            fail("candidate_watchdog_not_ready")
        return watchdog_pidfd, arm_write
    except Exception:
        stopped = False
        try:
            if arm_write >= 0:
                os.close(arm_write)
                arm_write = -1
            if ready_read >= 0:
                os.close(ready_read)
                ready_read = -1
            if proc is not None:
                try:
                    proc.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    if watchdog_pidfd is not None:
                        stop_owned_child(proc, watchdog_pidfd)
                    else:
                        fail("watchdog_unowned_child_did_not_exit")
            stopped = True
        finally:
            if stopped and pid_recorded:
                WATCHDOG_PID_PATH.unlink(missing_ok=True)
            if watchdog_pidfd is not None:
                os.close(watchdog_pidfd)
        raise
    finally:
        if ready_read >= 0:
            os.close(ready_read)
        if ready_write >= 0:
            os.close(ready_write)
        if arm_read >= 0:
            os.close(arm_read)

def enforce_hard_lease(candidate_pidfd: int, cancel: threading.Event, armed: threading.Event) -> None:
    start = time.monotonic()
    term_at = start + max(0.0, LEASE_SECONDS - LEASE_TERM_MARGIN_SECONDS)
    kill_at = start + max(0.0, LEASE_SECONDS - LEASE_KILL_MARGIN_SECONDS)
    if kill_at <= term_at:
        fail("candidate_lease_margin_invalid")
    armed.set()
    term_sent = False
    try:
        while True:
            if cancel.is_set() or pidfd_exited(candidate_pidfd):
                return
            now = time.monotonic()
            if not term_sent and now >= term_at:
                try:
                    signal.pidfd_send_signal(candidate_pidfd, signal.SIGTERM, None, 0)
                except ProcessLookupError:
                    return
                term_sent = True
            if now >= kill_at:
                try:
                    signal.pidfd_send_signal(candidate_pidfd, signal.SIGKILL, None, 0)
                except ProcessLookupError:
                    pass
                return
            next_at = kill_at if term_sent else term_at
            cancel.wait(min(LEASE_POLL_SECONDS, max(0.0, next_at - time.monotonic())))
    finally:
        os.close(candidate_pidfd)

def watchdog(candidate_pid: int, baseline_pid: int, ready_fd: int, arm_fd: int) -> int:
    candidate_seen = False
    candidate_pidfd = None
    lease_thread = None
    lease_cancel = threading.Event()
    lease_armed = threading.Event()
    try:
        if (
            ready_fd < 3
            or arm_fd < 3
            or not hasattr(os, "pidfd_open")
            or not hasattr(signal, "pidfd_send_signal")
        ):
            return 78
        state = load_state()
        if state.get("pid") != baseline_pid:
            return 71
        candidate_pidfd = os.pidfd_open(candidate_pid, 0)
        if not candidate_guard_process_matches(candidate_pid):
            return 77

        # Full baseline verification is allowed only while the candidate remains
        # inert behind the pre-exec guard.
        if not baseline_matches_state(state):
            return 72

        lease_pidfd = os.dup(candidate_pidfd)
        lease_thread = threading.Thread(
            target=enforce_hard_lease,
            args=(lease_pidfd, lease_cancel, lease_armed),
            name="qwen35-hard-lease",
            daemon=False,
        )
        lease_thread.start()
        if not lease_armed.wait(1.0) or not lease_thread.is_alive():
            lease_cancel.set()
            stop_pidfd_owned_process(candidate_pidfd)
            return 78

        if os.write(ready_fd, b"R") != 1:
            lease_cancel.set()
            stop_pidfd_owned_process(candidate_pidfd)
            return 78
        os.close(ready_fd)
        ready_fd = -1

        # READY is only pidfd + hard-lease ownership of the inert guard.
        # The watchdog cannot enter monitoring or signal the candidate until
        # the parent proves that G was written successfully by sending A.
        arm_timeout = min(
            30.0,
            max(0.0, LEASE_SECONDS - LEASE_KILL_MARGIN_SECONDS),
        )
        readable, _, _ = select.select([arm_fd], [], [], arm_timeout)
        if not readable:
            stop_pidfd_owned_process(candidate_pidfd)
            lease_cancel.set()
            verify_listener_absent()
            return 79
        arm_token = os.read(arm_fd, 2)
        os.close(arm_fd)
        arm_fd = -1
        if arm_token != b"A":
            stop_pidfd_owned_process(candidate_pidfd)
            lease_cancel.set()
            verify_listener_absent()
            return 79

        identity_deadline = time.monotonic() + 20
        monitor_stop_at = time.monotonic() + max(
            0.0,
            LEASE_SECONDS - LEASE_KILL_MARGIN_SECONDS,
        )
        while True:
            if pidfd_exited(candidate_pidfd):
                lease_cancel.set()
                try:
                    verify_listener_absent()
                except CandidateError:
                    return 76
                return 0
            if time.monotonic() >= monitor_stop_at:
                stop_pidfd_owned_process(candidate_pidfd)
                lease_cancel.set()
                try:
                    verify_listener_absent()
                except CandidateError:
                    return 76
                return 0

            if not candidate_seen:
                if candidate_process_matches(candidate_pid):
                    candidate_seen = True
                elif time.monotonic() >= identity_deadline:
                    stop_pidfd_owned_process(candidate_pidfd)
                    lease_cancel.set()
                    try:
                        verify_listener_absent()
                    except CandidateError:
                        return 76
                    return 77
                else:
                    if not baseline_process_matches_state(state):
                        stop_pidfd_owned_process(candidate_pidfd)
                        lease_cancel.set()
                        return 72
                    wait_pidfd_exit(
                        candidate_pidfd,
                        min(0.1, max(0.0, monitor_stop_at - time.monotonic())),
                    )
                    continue

            if not candidate_process_matches(candidate_pid):
                stop_pidfd_owned_process(candidate_pidfd)
                lease_cancel.set()
                try:
                    verify_listener_absent()
                except CandidateError:
                    return 76
                return 77
            if not baseline_process_matches_state(state):
                stop_pidfd_owned_process(candidate_pidfd)
                lease_cancel.set()
                return 72
            if proc_kb(candidate_pid, "VmRSS") > MAX_CANDIDATE_RSS_KB:
                stop_pidfd_owned_process(candidate_pidfd)
                lease_cancel.set()
                return 73
            if mem_available_kb() < MIN_MEM_RUNTIME_KB:
                stop_pidfd_owned_process(candidate_pidfd)
                lease_cancel.set()
                return 74
            wait_pidfd_exit(
                candidate_pidfd,
                min(2.0, max(0.0, monitor_stop_at - time.monotonic())),
            )
    except Exception:
        try:
            if candidate_pidfd is not None:
                stop_pidfd_owned_process(candidate_pidfd)
                if pidfd_exited(candidate_pidfd):
                    lease_cancel.set()
        except Exception:
            pass
        return 75
    finally:
        if ready_fd >= 0:
            try:
                os.close(ready_fd)
            except OSError:
                pass
        if arm_fd >= 0:
            try:
                os.close(arm_fd)
            except OSError:
                pass
        if candidate_pidfd is not None:
            try:
                if pidfd_exited(candidate_pidfd):
                    lease_cancel.set()
            except Exception:
                pass
            os.close(candidate_pidfd)
        if lease_thread is not None and lease_cancel.is_set():
            lease_thread.join(timeout=1.0)

def wait_candidate(pid: int, key: str, baseline_state: dict) -> None:
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        if not candidate_process_matches(pid):
            fail("candidate_process_exited")
        require_isolated_candidate_group(pid)
        if not baseline_matches_state(baseline_state):
            stop_candidate_pid(pid)
            fail("baseline_changed_during_candidate")
        if proc_kb(pid, "VmRSS") > MAX_CANDIDATE_RSS_KB:
            stop_candidate_pid(pid)
            fail("candidate_rss_limit_exceeded")
        if mem_available_kb() < MIN_MEM_RUNTIME_KB:
            stop_candidate_pid(pid)
            fail("candidate_runtime_headroom_low")
        try:
            status, payload = http_json(CANDIDATE_HOST, CANDIDATE_PORT, "/v1/models", key, timeout=2)
            ids = [row.get("id") for row in payload.get("data", []) if isinstance(row, dict)]
            if status == 200 and CANDIDATE_ALIAS in ids:
                return
        except OSError:
            pass
        time.sleep(1)
    stop_candidate_pid(pid)
    fail("candidate_readiness_timeout")

def prepare() -> None:
    require_nonroot()
    state, _, _, _ = snapshot_baseline()
    ensure_start_capacity(state)
    verify_listener_absent()
    save_state(state)
    download_candidate()
    emit("ARTIFACT_SHA256", CANDIDATE_SHA256)
    emit("ARTIFACT_BYTES", CANDIDATE_SIZE)
    emit("PREPARE_STATUS", "PASS")

# Diagnostic values are a closed vocabulary; private stderr never leaves this
# helper. They classify observed log text, not model readiness or acceptance.
START_LOG_LIMIT = 64 * 1024
START_PHASES = frozenset({"guard_spawn", "guard_setup", "identity", "readiness", "post_ready"})
START_LOG_CLASSES = frozenset({
    "no_log", "unclassified", "model_architecture_unsupported", "tokenizer_unsupported",
    "model_format_error", "runtime_library_error", "allocation_failure", "bind_failure",
    "argument_rejected", "model_load_error", "multiple_errors", "log_unavailable",
})

def open_candidate_log():
    # Keep an owned read/write descriptor for this exact inode. O_NONBLOCK
    # prevents a substituted FIFO from blocking before the regular-file check.
    import stat
    fd = os.open(LOG_PATH, os.O_RDWR | os.O_APPEND | os.O_CREAT | os.O_CLOEXEC | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_nlink != 1:
            fail("candidate_log_unsafe")
        os.fchmod(fd, 0o600)
        log = os.fdopen(fd, "a+b", buffering=0)
        return log, (info.st_dev, info.st_ino, info.st_size)
    except BaseException:
        os.close(fd)
        raise

def classify_start_log(raw: bytes) -> str:
    # The caller caps the private segment; this pure classifier also rejects
    # oversized or non-byte input so tests/callers cannot bypass that bound.
    if not isinstance(raw, bytes) or len(raw) > START_LOG_LIMIT:
        return "log_unavailable"
    if not raw:
        return "no_log"
    value = raw.lower()
    patterns = (
        ("model_architecture_unsupported", (b"unknown model architecture:", b"unsupported model architecture:")),
        ("tokenizer_unsupported", (b"unknown pre-tokenizer type:", b"unsupported tokenizer type:")),
        ("model_format_error", (b"gguf_init_from_file: invalid magic", b"gguf_init_from_file: unsupported version")),
        ("runtime_library_error", (b"error while loading shared libraries:", b"symbol lookup error:")),
        ("allocation_failure", (b"failed to allocate", b"cannot allocate memory", b"std::bad_alloc")),
        ("bind_failure", (b"address already in use",)),
        ("argument_rejected", (b"error: invalid argument:", b"error: unknown argument:", b"unrecognized argument:")),
    )
    matches = {code for code, tokens in patterns if any(token in value for token in tokens)}
    if len(matches) > 1:
        return "multiple_errors"
    if matches:
        return matches.pop()
    if b"error loading model" in value or b"failed to load model" in value:
        return "model_load_error"
    return "unclassified"

def candidate_start_diagnostic(log, cursor: tuple) -> tuple[str, int, int]:
    # Called only after owned-child exit and listener-absence proof. Read from
    # the already-open inode, never reopen a path or inspect an older attempt.
    import stat
    try:
        if not isinstance(cursor, tuple) or len(cursor) != 3 or any(type(item) is not int or item < 0 for item in cursor):
            return "log_unavailable", 0, 0
        fd = log.fileno()
        info = os.fstat(fd)
        if (
            not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid()
            or info.st_nlink != 1 or info.st_mode & 0o077
            or (info.st_dev, info.st_ino) != cursor[:2] or info.st_size < cursor[2]
        ):
            return "log_unavailable", 0, 0
        length = info.st_size - cursor[2]
        truncated = int(length > START_LOG_LIMIT)
        offset = max(cursor[2], info.st_size - START_LOG_LIMIT)
        raw = os.pread(fd, min(length, START_LOG_LIMIT), offset)
        after = os.fstat(fd)
        if (after.st_size, after.st_mtime_ns, after.st_ctime_ns) != (info.st_size, info.st_mtime_ns, info.st_ctime_ns):
            return "log_unavailable", 0, 0
        if len(raw) != min(length, START_LOG_LIMIT):
            return "log_unavailable", 0, 0
        read_bytes = len(raw)
        if truncated:
            # A suffix cut through a line is not evidence of that line's text.
            _, separator, raw = raw.partition(b"\n")
            if not separator:
                return "unclassified", read_bytes, 1
        return classify_start_log(raw), read_bytes, truncated
    except (OSError, ValueError, AttributeError, TypeError):
        return "log_unavailable", 0, 0

def emit_candidate_start_diagnostic(log, cursor: tuple, phase: str) -> None:
    # Diagnostics must not mask the original start/cleanup exception or turn
    # an unsuccessful start into a successful command.
    try:
        code, read_bytes, truncated = candidate_start_diagnostic(log, cursor)
        if code not in START_LOG_CLASSES or phase not in START_PHASES:
            code, phase, read_bytes, truncated = "log_unavailable", "guard_spawn", 0, 0
        emit("START_PHASE", phase)
        emit("START_LOG_CLASS", code)
        emit("START_LOG_BYTES", read_bytes)
        emit("START_LOG_TRUNCATED", truncated)
    except Exception:
        pass

def start(candidate_key: str) -> None:
    require_nonroot()
    if len(candidate_key) < 32 or not re.fullmatch(r"[A-Za-z0-9._~-]{32,128}", candidate_key):
        fail("candidate_key_invalid")
    if not CANDIDATE_PATH.is_file() or CANDIDATE_PATH.stat().st_uid != os.geteuid():
        fail("candidate_artifact_missing")
    if CANDIDATE_PATH.stat().st_size != CANDIDATE_SIZE or sha_file(CANDIDATE_PATH) != CANDIDATE_SHA256:
        fail("candidate_artifact_mismatch")
    if PID_PATH.exists() or CANDIDATE_IDENTITY_PATH.exists():
        if recovery_process_active():
            fail("candidate_already_active")
        verify_listener_absent()
        stop_watchdog()
        PID_PATH.unlink(missing_ok=True)
        CANDIDATE_IDENTITY_PATH.unlink(missing_ok=True)
    state, exe, argv, env = snapshot_baseline()
    ensure_start_capacity(state)
    save_state(state)
    argv = [os.fsencode(exe), *argv[1:]]
    argv = replace_flag(argv, "model", os.fsencode(CANDIDATE_PATH))
    argv = replace_flag(argv, "alias", CANDIDATE_ALIAS.encode("utf-8"))
    argv = replace_flag(argv, "host", CANDIDATE_HOST.encode("ascii"))
    argv = replace_flag(argv, "port", str(CANDIDATE_PORT).encode("ascii"))
    argv = remove_flag(argv, "api_key")
    env["LLAMA_API_KEY"] = candidate_key
    for key in ("NOTIFY_SOCKET", "WATCHDOG_PID", "WATCHDOG_USEC", "INVOCATION_ID", "JOURNAL_STREAM"):
        env.pop(key, None)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(STATE_DIR, 0o700)
    log, log_cursor = open_candidate_log()
    if not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal"):
        fail("pidfd_signal_unavailable")

    candidate_argv = [os.fsdecode(item) for item in argv]
    if candidate_exec_argv_status(candidate_argv) != 0:
        fail("candidate_guard_argv_invalid")
    guard_read, guard_write = os.pipe()
    os.set_inheritable(guard_read, True)
    guard_env = dict(env)
    guard_env["QWEN35_GUARDED_ARGV_JSON"] = json.dumps(candidate_argv, separators=(",", ":"))
    proc = None
    initial_pidfd = None
    watchdog_pidfd = None
    watchdog_arm_write = -1
    released = False
    armed = False
    start_phase = "guard_spawn"
    try:
        proc = subprocess.Popen(
            [
                sys.executable,
                str(pathlib.Path(__file__).resolve()),
                "_candidate_exec_guard",
                "--candidate-guard-fd",
                str(guard_read),
            ],
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            env=guard_env,
            cwd="/",
            start_new_session=True,
            close_fds=True,
            pass_fds=(guard_read,),
        )
        os.close(guard_read)
        guard_read = -1

        try:
            initial_pidfd = os.pidfd_open(proc.pid, 0)
        except OSError:
            fail("candidate_pidfd_setup_failed")

        start_phase = "guard_setup"
        write_candidate_identity(proc.pid)
        write_pid(PID_PATH, proc.pid)
        watchdog_pidfd, watchdog_arm_write = launch_watchdog(proc.pid, state["pid"])

        if not baseline_matches_state(state):
            fail("baseline_changed_before_candidate_release")
        try:
            written = os.write(guard_write, b"G")
        except BrokenPipeError:
            fail("candidate_guard_exited_before_release")
        if written != 1:
            fail("candidate_guard_release_failed")
        released = True
        try:
            os.close(guard_write)
        finally:
            guard_write = -1

        if os.write(watchdog_arm_write, b"A") != 1:
            fail("candidate_watchdog_arm_failed")
        armed = True
        try:
            os.close(watchdog_arm_write)
        finally:
            watchdog_arm_write = -1

        start_phase = "identity"
        identity_deadline = time.monotonic() + 5
        while time.monotonic() < identity_deadline:
            returncode = proc.poll()
            if returncode is not None:
                fail("candidate_guard_or_exec_exited:%d" % returncode)
            if initial_pidfd is None or pidfd_exited(initial_pidfd):
                fail("candidate_guard_or_exec_exited")
            if candidate_process_matches(proc.pid):
                break
            time.sleep(0.05)
        if not candidate_process_matches(proc.pid):
            fail("candidate_identity_not_established")
        require_isolated_candidate_group(proc.pid)
        if process_nice(proc.pid) < CANDIDATE_NICE_DELTA:
            fail("candidate_priority_not_lowered")

        live_argv = [item for item in pathlib.Path("/proc/%d/cmdline" % proc.pid).read_bytes().split(b"\0") if item]
        if flag_hits(live_argv, ALIASES["api_key"]):
            fail("candidate_key_present_in_cmdline")

        start_phase = "readiness"
        wait_candidate(proc.pid, candidate_key, state)
        start_phase = "post_ready"
        if proc_kb(proc.pid, "VmSwap") != 0:
            fail("candidate_swap_nonzero")
        available = mem_available_kb()
        if available < MIN_MEM_READY_KB:
            fail("candidate_ready_headroom_low")
        if not baseline_matches_state(state) or not baseline_runtime_healthy():
            fail("baseline_not_healthy_with_candidate")
        if watchdog_pidfd is None or pidfd_exited(watchdog_pidfd):
            fail("candidate_watchdog_not_alive")
    except Exception as start_error:
        if guard_write >= 0:
            try:
                os.close(guard_write)
            except OSError:
                pass
            guard_write = -1
        if guard_read >= 0:
            try:
                os.close(guard_read)
            except OSError:
                pass
            guard_read = -1
        if watchdog_arm_write >= 0:
            try:
                os.close(watchdog_arm_write)
            except OSError:
                pass
            watchdog_arm_write = -1
        try:
            if proc is not None:
                if released:
                    if initial_pidfd is None:
                        fail("candidate_start_cleanup_pidfd_missing")
                    stop_owned_child(proc, initial_pidfd)
                else:
                    try:
                        proc.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        fail("candidate_guard_did_not_exit")
                if proc.poll() is None:
                    fail("candidate_start_cleanup_process_alive")
            verify_listener_absent()
            stop_watchdog()
            PID_PATH.unlink(missing_ok=True)
            CANDIDATE_IDENTITY_PATH.unlink(missing_ok=True)
        except Exception as cleanup_error:
            raise CandidateError("candidate_start_cleanup_failed") from cleanup_error
        emit_candidate_start_diagnostic(log, log_cursor, start_phase)
        raise start_error
    finally:
        if initial_pidfd is not None:
            os.close(initial_pidfd)
        if watchdog_pidfd is not None:
            os.close(watchdog_pidfd)
        if watchdog_arm_write >= 0:
            try:
                os.close(watchdog_arm_write)
            except OSError:
                pass
        if guard_write >= 0:
            try:
                os.close(guard_write)
            except OSError:
                pass
        if guard_read >= 0:
            try:
                os.close(guard_read)
            except OSError:
                pass
        try:
            log.close()
        except OSError:
            pass

    emit("NONROOT_PARALLEL", 1)
    emit("START", "PASS")
    emit("ALIAS", CANDIDATE_ALIAS)
    emit("PORT", CANDIDATE_PORT)
    emit("BASELINE_PID", state["pid"])
    emit("CANDIDATE_PID", proc.pid)
    emit("CANDIDATE_RSS_KB", proc_kb(proc.pid, "VmRSS"))
    emit("MEM_AVAILABLE_KB", available)
    emit("LEASE_SECONDS", LEASE_SECONDS)

def cleanup() -> None:
    require_nonroot()
    state = load_state()
    stop_candidate()
    verify_listener_absent()
    stop_watchdog()
    PID_PATH.unlink(missing_ok=True)
    CANDIDATE_IDENTITY_PATH.unlink(missing_ok=True)
    if not baseline_matches_state(state):
        fail("baseline_changed_after_candidate")
    if not baseline_runtime_healthy():
        fail("baseline_health_failed_after_candidate")
    if proc_kb(state["pid"], "VmSwap") != 0:
        fail("baseline_swap_after_candidate")
    emit("BASELINE_UNCHANGED", 1)
    emit("CANDIDATE_ACTIVE", 0)
    emit("CLEANUP_STATUS", "PASS")

def status() -> None:
    require_nonroot()
    baseline = 0
    unchanged = 0
    try:
        baseline = int(baseline_runtime_healthy())
        if STATE_PATH.exists():
            unchanged = int(baseline_matches_state(load_state()))
    except Exception:
        baseline = 0
    candidate = 0
    if PID_PATH.exists() or CANDIDATE_IDENTITY_PATH.exists():
        try:
            candidate = int(recovery_process_active())
        except Exception:
            candidate = 1
    emit("BASELINE_ACTIVE", baseline)
    emit("BASELINE_UNCHANGED", unchanged)
    emit("CANDIDATE_ACTIVE", candidate)
    emit("LISTENER_ACTIVE", int(listener_open()))
    emit("MEM_AVAILABLE_KB", mem_available_kb())

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["prepare", "start", "cleanup", "status", "_watchdog", "_candidate_exec_guard"])
    parser.add_argument("--candidate-key-stdin", action="store_true")
    parser.add_argument("--candidate-pid", type=int, default=0)
    parser.add_argument("--baseline-pid", type=int, default=0)
    parser.add_argument("--candidate-guard-fd", type=int, default=-1)
    parser.add_argument("--watchdog-ready-fd", type=int, default=-1)
    parser.add_argument("--watchdog-arm-fd", type=int, default=-1)
    args = parser.parse_args()
    require_nonroot()
    if args.action == "_candidate_exec_guard":
        return candidate_exec_guard(args.candidate_guard_fd)
    if args.action == "_watchdog":
        if args.candidate_pid <= 0 or args.baseline_pid <= 0:
            return 76
        return watchdog(args.candidate_pid, args.baseline_pid, args.watchdog_ready_fd, args.watchdog_arm_fd)
    import fcntl
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(STATE_DIR, 0o700)
    try:
        with LOCK_PATH.open("w") as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            if args.action == "prepare":
                prepare()
            elif args.action == "start":
                if not args.candidate_key_stdin:
                    fail("candidate_key_stdin_required")
                candidate_key = sys.stdin.read(129).strip()
                if not candidate_key or sys.stdin.read(1):
                    fail("candidate_key_stdin_invalid")
                start(candidate_key)
            elif args.action == "cleanup":
                cleanup()
            else:
                status()
        return 0
    except CandidateError as exc:
        emit("ERROR", str(exc))
        return 1
    except Exception as exc:
        emit("ERROR", "unexpected:" + type(exc).__name__)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
