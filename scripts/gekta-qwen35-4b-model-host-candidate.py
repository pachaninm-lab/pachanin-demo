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
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
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
    )

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
    if not candidate_process_matches(pid):
        return
    signal_candidate(pid, signal.SIGTERM)
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline and candidate_process_matches(pid):
        time.sleep(0.25)
    if candidate_process_matches(pid):
        signal_candidate(pid, signal.SIGKILL)
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline and candidate_process_matches(pid):
            time.sleep(0.1)
    if candidate_process_matches(pid):
        fail("candidate_process_survived_sigkill")

def stop_candidate() -> None:
    pid = None
    try:
        raw = PID_PATH.read_text(encoding="ascii").strip()
        if re.fullmatch(r"[1-9][0-9]*", raw):
            pid = int(raw)
    except OSError:
        pass
    if pid:
        stop_candidate_pid(pid)
    PID_PATH.unlink(missing_ok=True)

def stop_watchdog() -> None:
    try:
        raw = WATCHDOG_PID_PATH.read_text(encoding="ascii").strip()
        if not re.fullmatch(r"[1-9][0-9]*", raw):
            WATCHDOG_PID_PATH.unlink(missing_ok=True)
            return
        pid = int(raw)
        if watchdog_process_matches(pid):
            os.kill(pid, signal.SIGTERM)
    except (OSError, ProcessLookupError):
        pass
    WATCHDOG_PID_PATH.unlink(missing_ok=True)

def launch_watchdog(candidate_pid: int, baseline_pid: int) -> None:
    log = WATCHDOG_LOG_PATH.open("ab", buffering=0)
    proc = subprocess.Popen(
        [
            sys.executable,
            str(pathlib.Path(__file__).resolve()),
            "_watchdog",
            "--candidate-pid",
            str(candidate_pid),
            "--baseline-pid",
            str(baseline_pid),
        ],
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        cwd="/",
        start_new_session=True,
        close_fds=True,
    )
    write_pid(WATCHDOG_PID_PATH, proc.pid)

def watchdog(candidate_pid: int, baseline_pid: int) -> int:
    deadline = time.monotonic() + LEASE_SECONDS
    try:
        state = load_state()
        if state.get("pid") != baseline_pid:
            return 71
        while time.monotonic() < deadline:
            if not candidate_process_matches(candidate_pid):
                try:
                    verify_listener_absent()
                except CandidateError:
                    return 76
                return 0
            if not baseline_matches_state(state):
                stop_candidate_pid(candidate_pid)
                return 72
            if proc_kb(candidate_pid, "VmRSS") > MAX_CANDIDATE_RSS_KB:
                stop_candidate_pid(candidate_pid)
                return 73
            if mem_available_kb() < MIN_MEM_RUNTIME_KB:
                stop_candidate_pid(candidate_pid)
                return 74
            time.sleep(2)
        stop_candidate_pid(candidate_pid)
        verify_listener_absent()
        return 0
    except Exception:
        try:
            stop_candidate_pid(candidate_pid)
        except Exception:
            pass
        return 75

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

def start(candidate_key: str) -> None:
    require_nonroot()
    if len(candidate_key) < 32 or not re.fullmatch(r"[A-Za-z0-9._~-]{32,128}", candidate_key):
        fail("candidate_key_invalid")
    if not CANDIDATE_PATH.is_file() or CANDIDATE_PATH.stat().st_uid != os.geteuid():
        fail("candidate_artifact_missing")
    if CANDIDATE_PATH.stat().st_size != CANDIDATE_SIZE or sha_file(CANDIDATE_PATH) != CANDIDATE_SHA256:
        fail("candidate_artifact_mismatch")
    if PID_PATH.exists():
        try:
            old_pid = int(PID_PATH.read_text(encoding="ascii").strip())
        except Exception:
            old_pid = 0
        if old_pid and candidate_process_matches(old_pid):
            fail("candidate_already_active")
        PID_PATH.unlink(missing_ok=True)
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
    nice = shutil.which("nice")
    ionice = shutil.which("ionice")
    if not nice or not ionice:
        fail("priority_tool_missing")
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(STATE_DIR, 0o700)
    log = LOG_PATH.open("ab", buffering=0)
    proc = subprocess.Popen(
        [nice, "-n", "10", ionice, "-c", "3", *[os.fsdecode(item) for item in argv]],
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        env=env,
        cwd="/",
        start_new_session=True,
        close_fds=True,
    )
    identity_deadline = time.monotonic() + 5
    while time.monotonic() < identity_deadline and process_alive(proc.pid):
        if candidate_process_matches(proc.pid):
            break
        time.sleep(0.05)
    if not candidate_process_matches(proc.pid):
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3)
        fail("candidate_identity_not_established")
    require_isolated_candidate_group(proc.pid)
    live_argv = [item for item in pathlib.Path("/proc/%d/cmdline" % proc.pid).read_bytes().split(b"\0") if item]
    if flag_hits(live_argv, ALIASES["api_key"]):
        stop_candidate_pid(proc.pid)
        fail("candidate_key_present_in_cmdline")
    write_pid(PID_PATH, proc.pid)
    launch_watchdog(proc.pid, state["pid"])
    try:
        wait_candidate(proc.pid, candidate_key, state)
        if proc_kb(proc.pid, "VmSwap") != 0:
            fail("candidate_swap_nonzero")
        available = mem_available_kb()
        if available < MIN_MEM_READY_KB:
            fail("candidate_ready_headroom_low")
        if not baseline_matches_state(state) or not baseline_runtime_healthy():
            fail("baseline_not_healthy_with_candidate")
    except Exception:
        stop_candidate_pid(proc.pid)
        verify_listener_absent()
        raise
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
    stop_watchdog()
    verify_listener_absent()
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
    if PID_PATH.exists():
        try:
            pid = int(PID_PATH.read_text(encoding="ascii").strip())
            candidate = int(candidate_process_matches(pid))
        except Exception:
            candidate = 0
    emit("BASELINE_ACTIVE", baseline)
    emit("BASELINE_UNCHANGED", unchanged)
    emit("CANDIDATE_ACTIVE", candidate)
    emit("LISTENER_ACTIVE", int(listener_open()))
    emit("MEM_AVAILABLE_KB", mem_available_kb())

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["prepare", "start", "cleanup", "status", "_watchdog"])
    parser.add_argument("--candidate-key", default="")
    parser.add_argument("--candidate-key-stdin", action="store_true")
    parser.add_argument("--candidate-pid", type=int, default=0)
    parser.add_argument("--baseline-pid", type=int, default=0)
    args = parser.parse_args()
    require_nonroot()
    if args.action == "_watchdog":
        if args.candidate_pid <= 0 or args.baseline_pid <= 0:
            return 76
        return watchdog(args.candidate_pid, args.baseline_pid)
    import fcntl
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(STATE_DIR, 0o700)
    try:
        with LOCK_PATH.open("w") as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            if args.action == "prepare":
                prepare()
            elif args.action == "start":
                candidate_key = args.candidate_key
                if args.candidate_key_stdin:
                    if candidate_key:
                        fail("candidate_key_source_ambiguous")
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
