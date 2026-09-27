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
CANDIDATE_DIR = pathlib.Path("/srv/tai-models/candidates")
CANDIDATE_PATH = CANDIDATE_DIR / ("qwen35-4b-q4-k-m-" + CANDIDATE_SHA256[:12] + ".gguf")
STATE_DIR = pathlib.Path("/var/lib/gekta-qwen35-4b-candidate")
PID_PATH = STATE_DIR / "candidate.pid"
WATCHDOG_PID_PATH = STATE_DIR / "watchdog.pid"
LOG_PATH = STATE_DIR / "candidate.log"
LOCK_PATH = pathlib.Path("/run/lock/gekta-qwen35-4b-candidate.lock")
CANDIDATE_HOST = "127.0.0.1"
CANDIDATE_PORT = 18081
LEASE_SECONDS = 420
MIN_FREE_BYTES = 7000000000
MIN_MEM_AFTER_STOP_KB = 8 * 1024 * 1024
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
SAFE_ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C", "LANG": "C"}

class CandidateError(RuntimeError):
    pass

def fail(message):
    raise CandidateError(message)

def emit(key, value):
    text = str(value)
    if not re.fullmatch(r"[A-Za-z0-9_.:/-]+", text):
        text = hashlib.sha256(text.encode("utf-8", "replace")).hexdigest()
    print("QWEN35_CANDIDATE_%s=%s" % (key, text), flush=True)

def command(args, check=True, timeout=30):
    result = subprocess.run(
        args,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=SAFE_ENV,
        timeout=timeout,
        check=False,
    )
    if check and result.returncode != 0:
        fail("command_failed:%s:%s" % (pathlib.Path(args[0]).name, result.returncode))
    return result

def systemctl(*args, check=True, timeout=30):
    return command(["/usr/bin/systemctl", *args], check=check, timeout=timeout)

def service_pid():
    raw = systemctl("show", SERVICE, "--property=MainPID", "--value").stdout.strip()
    if not re.fullmatch(r"[1-9][0-9]*", raw):
        fail("baseline_pid_invalid")
    return int(raw)

def service_user():
    raw = systemctl("show", SERVICE, "--property=User", "--value").stdout.strip()
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]{0,31}", raw) or raw == "root":
        fail("service_user_invalid")
    try:
        return pwd.getpwnam(raw)
    except KeyError:
        fail("service_user_missing")

def read_proc(pid):
    root = pathlib.Path("/proc/%d" % pid)
    exe = (root / "exe").resolve(strict=True)
    argv = [item for item in (root / "cmdline").read_bytes().split(b"\0") if item]
    raw_env = [item for item in (root / "environ").read_bytes().split(b"\0") if item]
    if not argv:
        fail("baseline_argv_empty")
    env = {}
    for item in raw_env:
        key, sep, value = item.partition(b"=")
        if not sep or not key:
            fail("baseline_environment_invalid")
        env[key.decode("utf-8", "surrogateescape")] = value.decode("utf-8", "surrogateescape")
    return exe, argv, env

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

def sha_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(8 * 1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()

def mem_available_kb():
    for line in pathlib.Path("/proc/meminfo").read_text(encoding="ascii").splitlines():
        if line.startswith("MemAvailable:"):
            return int(line.split()[1])
    fail("memavailable_missing")

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

def snapshot_baseline():
    if systemctl("is-active", "--quiet", SERVICE, check=False).returncode != 0:
        fail("baseline_service_inactive")
    user = service_user()
    pid = service_pid()
    exe, argv, env = read_proc(pid)
    version = command([str(exe), "--version"], check=False, timeout=10)
    if version.returncode != 0 or "aedb2a5" not in (version.stdout + version.stderr).lower():
        fail("llama_build_mismatch")
    for key, expected in EXPECTED.items():
        actual = (flag_value(argv, key) or b"").decode("ascii", "ignore")
        if actual != expected:
            fail("baseline_flag_mismatch:%s" % key)
    alias = (flag_value(argv, "alias") or b"").decode("utf-8", "replace")
    if alias != BASELINE_ALIAS:
        fail("baseline_alias_mismatch")
    return user, exe, argv, env

def download_candidate():
    CANDIDATE_DIR.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(CANDIDATE_DIR).free < MIN_FREE_BYTES:
        fail("candidate_disk_headroom_low")
    if CANDIDATE_PATH.exists():
        if CANDIDATE_PATH.is_symlink() or not CANDIDATE_PATH.is_file():
            fail("candidate_path_unsafe")
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
                out.write(chunk)
                digest.update(chunk)
                size += len(chunk)
            out.flush()
            os.fsync(out.fileno())
        if size != CANDIDATE_SIZE:
            fail("candidate_download_size_mismatch")
        if digest.hexdigest() != CANDIDATE_SHA256:
            fail("candidate_download_hash_mismatch")
        user = service_user()
        os.chown(tmp, user.pw_uid, user.pw_gid)
        os.chmod(tmp, 0o400)
        os.replace(tmp, CANDIDATE_PATH)
    finally:
        if tmp.exists():
            tmp.unlink()
    emit("PREPARE", "DOWNLOADED")

def write_pid(path, pid):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("%d\n" % pid, encoding="ascii")
    os.chown(path, 0, 0)
    os.chmod(path, 0o600)

def launch_watchdog():
    shell = (
        "sleep %d; "
        "if [ -r '%s' ]; then p=$(cat '%s' 2>/dev/null || true); "
        "case \"$p\" in ''|*[!0-9]*) ;; *) kill \"$p\" 2>/dev/null || true ;; esac; fi; "
        "/usr/bin/systemctl start '%s' >/dev/null 2>&1 || true"
    ) % (LEASE_SECONDS, PID_PATH, PID_PATH, SERVICE)
    proc = subprocess.Popen(
        ["/bin/sh", "-c", shell],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=SAFE_ENV,
        start_new_session=True,
    )
    write_pid(WATCHDOG_PID_PATH, proc.pid)

def stop_watchdog():
    try:
        raw = WATCHDOG_PID_PATH.read_text(encoding="ascii").strip()
        if re.fullmatch(r"[1-9][0-9]*", raw):
            os.kill(int(raw), signal.SIGTERM)
    except (OSError, ProcessLookupError):
        pass
    WATCHDOG_PID_PATH.unlink(missing_ok=True)

def drop_user(user):
    os.initgroups(user.pw_name, user.pw_gid)
    os.setgid(user.pw_gid)
    os.setuid(user.pw_uid)

def wait_candidate(pid, key):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        try:
            os.kill(pid, 0)
        except OSError:
            fail("candidate_process_exited")
        try:
            status, payload = http_json(CANDIDATE_HOST, CANDIDATE_PORT, "/v1/models", key, timeout=2)
            ids = [row.get("id") for row in payload.get("data", []) if isinstance(row, dict)]
            if status == 200 and CANDIDATE_ALIAS in ids:
                return
        except OSError:
            pass
        time.sleep(1)
    fail("candidate_readiness_timeout")

def stop_candidate():
    pid = None
    try:
        raw = PID_PATH.read_text(encoding="ascii").strip()
        if re.fullmatch(r"[1-9][0-9]*", raw):
            pid = int(raw)
    except OSError:
        pass
    if pid:
        try:
            os.killpg(pid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            try:
                os.kill(pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            try:
                os.kill(pid, 0)
            except OSError:
                break
            time.sleep(0.25)
    PID_PATH.unlink(missing_ok=True)

def baseline_runtime_healthy():
    _, _, argv, _ = snapshot_baseline()
    alias = (flag_value(argv, "alias") or b"").decode("utf-8", "replace")
    raw_host = (flag_value(argv, "host", required=False) or b"127.0.0.1").decode("ascii", "ignore")
    host = "127.0.0.1" if raw_host in {"0.0.0.0", "::", "localhost"} else raw_host
    raw_port = (flag_value(argv, "port", required=False) or b"8080").decode("ascii", "ignore")
    key = (flag_value(argv, "api_key") or b"").decode("utf-8", "replace")
    if alias != BASELINE_ALIAS or not raw_port.isdigit() or len(key) < 32:
        return False
    try:
        status_code, payload = http_json(host, int(raw_port), "/v1/models", key, timeout=3)
    except OSError:
        return False
    ids = [row.get("id") for row in payload.get("data", []) if isinstance(row, dict)]
    return status_code == 200 and BASELINE_ALIAS in ids


def verify_baseline():
    systemctl("start", SERVICE, check=False)
    deadline = time.monotonic() + 90
    last = "unknown"
    while time.monotonic() < deadline:
        try:
            if baseline_runtime_healthy():
                emit("ROLLBACK", "PASS")
                return
            last = "runtime_not_healthy"
        except Exception as exc:
            last = type(exc).__name__
        time.sleep(1)
    fail("rollback_verification_failed:%s" % last)

def prepare():
    snapshot_baseline()
    download_candidate()
    emit("ARTIFACT_SHA256", CANDIDATE_SHA256)
    emit("ARTIFACT_BYTES", CANDIDATE_SIZE)
    emit("PREPARE_STATUS", "PASS")

def start(candidate_key):
    if len(candidate_key) < 32 or not re.fullmatch(r"[A-Za-z0-9._~-]{32,128}", candidate_key):
        fail("candidate_key_invalid")
    if not CANDIDATE_PATH.is_file() or CANDIDATE_PATH.stat().st_size != CANDIDATE_SIZE:
        fail("candidate_artifact_missing")
    if sha_file(CANDIDATE_PATH) != CANDIDATE_SHA256:
        fail("candidate_artifact_hash_mismatch")
    if PID_PATH.exists():
        fail("candidate_already_active")
    user, exe, argv, env = snapshot_baseline()
    launch_watchdog()
    systemctl("stop", SERVICE)
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline and mem_available_kb() < MIN_MEM_AFTER_STOP_KB:
        time.sleep(1)
    if mem_available_kb() < MIN_MEM_AFTER_STOP_KB:
        fail("memory_not_reclaimed")
    argv = replace_flag(argv, "model", os.fsencode(CANDIDATE_PATH))
    argv = replace_flag(argv, "alias", CANDIDATE_ALIAS.encode("utf-8"))
    argv = replace_flag(argv, "host", CANDIDATE_HOST.encode("ascii"))
    argv = replace_flag(argv, "port", str(CANDIDATE_PORT).encode("ascii"))
    argv = replace_flag(argv, "api_key", candidate_key.encode("ascii"))
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log = LOG_PATH.open("ab", buffering=0)
    proc = subprocess.Popen(
        [os.fsdecode(item) for item in argv],
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        env=env,
        cwd="/",
        preexec_fn=lambda: drop_user(user),
        start_new_session=True,
    )
    write_pid(PID_PATH, proc.pid)
    wait_candidate(proc.pid, candidate_key)
    emit("START", "PASS")
    emit("ALIAS", CANDIDATE_ALIAS)
    emit("PORT", CANDIDATE_PORT)
    emit("MEM_AVAILABLE_KB", mem_available_kb())
    emit("LEASE_SECONDS", LEASE_SECONDS)

def rollback():
    stop_candidate()
    verify_baseline()
    stop_watchdog()
    emit("ROLLBACK_STATUS", "PASS")

def status():
    try:
        baseline = baseline_runtime_healthy()
    except Exception:
        baseline = False
    candidate = 0
    if PID_PATH.exists():
        try:
            pid = int(PID_PATH.read_text(encoding="ascii").strip())
            os.kill(pid, 0)
            candidate = 1
        except Exception:
            candidate = 0
    emit("BASELINE_ACTIVE", int(baseline))
    emit("CANDIDATE_ACTIVE", candidate)

def main():
    if os.geteuid() != 0:
        emit("ERROR", "root_required")
        return 2
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["prepare", "start", "rollback", "status"])
    parser.add_argument("--candidate-key", default="")
    args = parser.parse_args()
    import fcntl
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        with LOCK_PATH.open("w") as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            if args.action == "prepare":
                prepare()
            elif args.action == "start":
                try:
                    start(args.candidate_key)
                except Exception:
                    try:
                        rollback()
                    except Exception as rollback_error:
                        emit("ROLLBACK_ERROR", type(rollback_error).__name__)
                    raise
            elif args.action == "rollback":
                rollback()
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
