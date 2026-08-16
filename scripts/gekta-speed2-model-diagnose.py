#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import http.client
import json
import os
import pathlib
import re
import socket
import subprocess
import sys
import time
from typing import Any

class DiagError(RuntimeError):
    def __init__(self, code: str):
        safe = re.sub(r"[^A-Z0-9_]+", "_", code.upper()).strip("_")[:80]
        super().__init__(safe)
        self.code = safe or "UNCLASSIFIED_FAILURE"

SERVICE = "tai-qwen3-8b.service"
SAFE_ISA = ("avx", "avx2", "avx512f", "avx512bw", "avx512vl", "fma", "f16c", "vnni", "avx_vnni")
METRIC_NAMES = (
    "llamacpp:prompt_tokens_total",
    "llamacpp:prompt_seconds_total",
    "llamacpp:prompt_tokens_seconds",
    "llamacpp:tokens_predicted_total",
    "llamacpp:tokens_predicted_seconds_total",
    "llamacpp:predicted_tokens_seconds",
    "llamacpp:requests_processing",
    "llamacpp:requests_deferred",
)
FIXED_SYSTEM = (
    "You are a read-only agricultural assistant. "
    "Answer the next short synthetic diagnostic request with one safe word only. "
    "Do not use tools, private data, current facts, prices, weather, laws, or external claims. "
    "This fixed text exists only to measure prompt-cache behavior and contains no user data. "
) * 4

def run(*args: str, timeout: float = 8.0) -> str:
    child_env = os.environ.copy()
    child_env["LC_ALL"] = "C"
    cp = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                        text=True, timeout=timeout, check=False, env=child_env)
    if cp.returncode != 0:
        raise DiagError(f"command_failed:{args[0]}:{cp.returncode}")
    return cp.stdout

def kb_value(text: str, key: str) -> int:
    m = re.search(rf"^{re.escape(key)}:\s+(\d+)\s+kB$", text, re.M)
    return int(m.group(1)) if m else 0

def parse_cmdline(raw: bytes) -> list[str]:
    return [part.decode("utf-8", "replace") for part in raw.split(b"\0") if part]

def first_flag(args: list[str], names: tuple[str, ...]) -> str | None:
    for i, token in enumerate(args):
        for name in names:
            if token == name and i + 1 < len(args):
                return args[i + 1]
            if token.startswith(name + "="):
                return token.split("=", 1)[1]
    return None

def env_map(raw: bytes) -> dict[bytes, bytes]:
    result: dict[bytes, bytes] = {}
    for part in raw.split(b"\0"):
        if b"=" in part:
            k, v = part.split(b"=", 1)
            result[k] = v
    return result

def clean_key(value: bytes) -> str | None:
    value = value.strip()
    if not (32 <= len(value) <= 4096):
        return None
    try:
        text = value.decode("ascii")
    except UnicodeDecodeError:
        return None
    if any(ord(ch) < 33 or ord(ch) > 126 for ch in text):
        return None
    return text

def first_key(value: bytes) -> str | None:
    for candidate in value.split(b","):
        key = clean_key(candidate)
        if key:
            return key
    return None

def resolve_bearer(args_raw: list[bytes], env: dict[bytes, bytes]) -> tuple[str, str]:
    for i, token in enumerate(args_raw):
        if token == b"--api-key" and i + 1 < len(args_raw):
            key = first_key(args_raw[i + 1])
            if key:
                return key, "ARGV"
        if token.startswith(b"--api-key="):
            key = first_key(token.split(b"=", 1)[1])
            if key:
                return key, "ARGV"
    key = first_key(env.get(b"LLAMA_API_KEY", b""))
    if key:
        return key, "ENV"

    key_file: bytes | None = None
    for i, token in enumerate(args_raw):
        if token == b"--api-key-file" and i + 1 < len(args_raw):
            key_file = args_raw[i + 1]
            break
        if token.startswith(b"--api-key-file="):
            key_file = token.split(b"=", 1)[1]
            break
    if key_file is None:
        key_file = env.get(b"LLAMA_ARG_API_KEY_FILE")
    if key_file:
        path = pathlib.Path(os.fsdecode(key_file))
        st = path.stat()
        if not path.is_file() or st.st_size > 65536:
            raise DiagError("api_key_file_invalid")
        for line in path.read_bytes().splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith(b"#"):
                continue
            key = clean_key(stripped)
            if key:
                return key, "FILE"
    raise DiagError("auth_source_missing")

def decode_ipv4(hex_address: str) -> str | None:
    try:
        return socket.inet_ntoa(bytes.fromhex(hex_address)[::-1])
    except (OSError, ValueError):
        return None

def owned_listener_endpoints(proc: pathlib.Path) -> list[tuple[str, int, str]]:
    inodes: set[str] = set()
    try:
        entries = tuple((proc / "fd").iterdir())
    except OSError:
        return []
    for entry in entries:
        try:
            target = os.readlink(entry)
        except OSError:
            continue
        m = re.fullmatch(r"socket:\[(\d+)\]", target)
        if m:
            inodes.add(m.group(1))
    endpoints: list[tuple[str, int, str]] = []
    for table_name in ("net/tcp", "net/tcp6"):
        try:
            lines = (proc / table_name).read_text(encoding="ascii", errors="replace").splitlines()[1:]
        except OSError:
            continue
        for line in lines:
            fields = line.split()
            if len(fields) < 10 or fields[3] != "0A" or fields[9] not in inodes:
                continue
            try:
                address_hex, port_hex = fields[1].split(":", 1)
                port = int(port_hex, 16)
            except (ValueError, IndexError):
                continue
            if not (1 <= port <= 65535):
                continue
            if table_name == "net/tcp":
                host = decode_ipv4(address_hex)
                if not host:
                    continue
                if host == "0.0.0.0":
                    host = "127.0.0.1"
                endpoints.append((host, port, "PROC"))
            else:
                endpoints.append(("::1", port, "PROC"))
    return endpoints

def resolve_endpoints(args: list[str], env: dict[bytes, bytes], proc: pathlib.Path) -> list[tuple[str, int, str]]:
    out: list[tuple[str, int, str]] = []
    seen: set[tuple[str, int]] = set()
    def add(host: str, raw_port: str | bytes | None, source: str) -> None:
        if raw_port is None:
            return
        if isinstance(raw_port, bytes):
            raw_port = raw_port.decode("ascii", "ignore").strip()
        try:
            port = int(raw_port)
        except (TypeError, ValueError):
            return
        if not (1 <= port <= 65535) or (host, port) in seen:
            return
        seen.add((host, port))
        out.append((host, port, source))
    port = first_flag(args, ("--port", "--listen-port"))
    if port:
        add("127.0.0.1", port, "ARGV")
        add("::1", port, "ARGV")
    for key in (b"LLAMA_ARG_PORT", b"LLAMA_PORT"):
        if key in env:
            add("127.0.0.1", env[key], "ENV")
            add("::1", env[key], "ENV")
    for host, p, source in owned_listener_endpoints(proc):
        add(host, str(p), source)
    return out

def http_request(host: str, port: int, bearer: str, method: str, path: str,
                 body: dict[str, Any] | None = None, timeout: float = 8.0) -> tuple[int, bytes]:
    conn = http.client.HTTPConnection(host, port, timeout=timeout)
    headers = {"Authorization": f"Bearer {bearer}"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    try:
        conn.request(method, path, body=data, headers=headers)
        resp = conn.getresponse()
        raw = resp.read(1_000_000)
        return resp.status, raw
    finally:
        conn.close()

def parse_metrics(raw: bytes) -> dict[str, float]:
    text = raw.decode("utf-8", "replace")
    found: dict[str, float] = {}
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([^\s{]+)(?:\{[^}]*\})?\s+([-+0-9.eE]+)$", line)
        if not m or m.group(1) not in METRIC_NAMES:
            continue
        try:
            value = float(m.group(2))
        except ValueError:
            continue
        found[m.group(1)] = found.get(m.group(1), 0.0) + value
    return found

def metric_delta(after: dict[str, float], before: dict[str, float], key: str) -> float | None:
    if key not in after or key not in before:
        return None
    value = after[key] - before[key]
    return value if value >= -1e-9 else None

def get_json(host: str, port: int, bearer: str, path: str) -> dict[str, Any]:
    status, raw = http_request(host, port, bearer, "GET", path)
    if status != 200:
        raise DiagError(f"http_{path.strip('/').replace('/','_')}_{status}")
    obj = json.loads(raw.decode("utf-8"))
    if not isinstance(obj, dict):
        raise DiagError("json_object_expected")
    return obj

def post_chat(host: str, port: int, bearer: str, model: str, suffix: str) -> tuple[int, float, int | None]:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": FIXED_SYSTEM},
            {"role": "user", "content": suffix},
        ],
        "temperature": 0,
        "seed": 0,
        "max_tokens": 1,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    started = time.perf_counter()
    status, raw = http_request(host, port, bearer, "POST", "/v1/chat/completions", payload, timeout=20.0)
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    if status != 200:
        return status, elapsed_ms, None
    try:
        obj = json.loads(raw.decode("utf-8"))
        usage = obj.get("usage") if isinstance(obj, dict) else None
        prompt = usage.get("prompt_tokens") if isinstance(usage, dict) else None
        prompt_tokens = int(prompt) if isinstance(prompt, int) and prompt >= 0 else None
    except Exception:
        prompt_tokens = None
    return status, elapsed_ms, prompt_tokens

def model_id_from_endpoint(host: str, port: int, bearer: str) -> str:
    obj = get_json(host, port, bearer, "/v1/models")
    data = obj.get("data")
    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        raise DiagError("model_id_unresolved")
    model = data[0].get("id")
    if not isinstance(model, str) or not (1 <= len(model) <= 512):
        raise DiagError("model_id_invalid")
    return model

def main() -> int:
    op = sys.argv[1] if len(sys.argv) > 1 else "status"
    if op not in {"status", "diagnose"}:
        raise SystemExit(2)

    if run("systemctl", "is-active", SERVICE).strip() != "active":
        raise DiagError("service_inactive")
    pid_text = run("systemctl", "show", SERVICE, "--property=MainPID", "--value").strip()
    if not pid_text.isdigit() or int(pid_text) <= 0:
        raise DiagError("model_pid_invalid")
    pid = int(pid_text)
    proc = pathlib.Path(f"/proc/{pid}")
    if proc.stat().st_uid != os.geteuid():
        raise DiagError("service_user_mismatch")

    cmdline_raw = (proc / "cmdline").read_bytes()
    environ_raw = (proc / "environ").read_bytes()
    args_raw = [part for part in cmdline_raw.split(b"\0") if part]
    args = [part.decode("utf-8", "replace") for part in args_raw]
    env = env_map(environ_raw)
    status = (proc / "status").read_text(encoding="utf-8")
    meminfo = pathlib.Path("/proc/meminfo").read_text(encoding="utf-8")
    exe = (proc / "exe").resolve(strict=True)

    version_text = run(str(exe), "--version")
    vm = re.search(r"version:\s*(\d+)\s+\(([0-9a-fA-F]{7,40})\)", version_text)
    build = int(vm.group(1)) if vm else 0
    commit = vm.group(2).lower() if vm else "unknown"
    help_text = run(str(exe), "--help", timeout=12.0)

    flag_map: dict[str, tuple[str, ...]] = {
        "threads": ("--threads", "-t"),
        "threads_batch": ("--threads-batch", "-tb"),
        "parallel": ("--parallel", "-np"),
        "ctx_size": ("--ctx-size", "-c"),
        "batch_size": ("--batch-size", "-b"),
        "ubatch_size": ("--ubatch-size", "-ub"),
        "cache_reuse": ("--cache-reuse",),
    }
    flags = {k: first_flag(args, names) for k, names in flag_map.items()}
    cache_prompt = False if "--no-cache-prompt" in args else True
    if "--cache-prompt" in args:
        cache_prompt = True
    env_cache = env.get(b"LLAMA_ARG_CACHE_PROMPT")
    if env_cache is not None and "--cache-prompt" not in args and "--no-cache-prompt" not in args:
        text = env_cache.decode("ascii", "ignore").strip().lower()
        if text in {"0", "false", "no", "off"}:
            cache_prompt = False
        elif text in {"1", "true", "yes", "on"}:
            cache_prompt = True
    if flags["cache_reuse"] is None and b"LLAMA_ARG_CACHE_REUSE" in env:
        flags["cache_reuse"] = env[b"LLAMA_ARG_CACHE_REUSE"].decode("ascii", "ignore").strip()

    baseline_matches = (
        str(flags.get("threads")) == "16"
        and str(flags.get("threads_batch")) == "16"
        and str(flags.get("parallel")) == "1"
        and str(flags.get("ctx_size")) == "8192"
        and str(flags.get("batch_size")) == "512"
        and str(flags.get("ubatch_size")) == "128"
    )
    if op == "diagnose" and not baseline_matches:
        raise DiagError("RUNTIME_BASELINE_MISMATCH")

    try:
        smaps = (proc / "smaps_rollup").read_text(encoding="utf-8")
    except OSError:
        smaps = None

    affinity = sorted(os.sched_getaffinity(pid))
    physical: set[tuple[str, str]] = set()
    for cpu in affinity:
        top = pathlib.Path(f"/sys/devices/system/cpu/cpu{cpu}/topology")
        try:
            physical.add(((top / "physical_package_id").read_text().strip(),
                          (top / "core_id").read_text().strip()))
        except OSError:
            physical.clear()
            break

    cpuinfo = pathlib.Path("/proc/cpuinfo").read_text(encoding="utf-8", errors="replace")
    model_match = re.search(r"^model name\s*:\s*(.+)$", cpuinfo, re.M)
    cpu_model = model_match.group(1).strip() if model_match else "unknown"
    flags_match = re.search(r"^flags\s*:\s*(.+)$", cpuinfo, re.M)
    host_flags = set(flags_match.group(1).split()) if flags_match else set()

    governors: set[str] = set()
    for cpu in affinity:
        p = pathlib.Path(f"/sys/devices/system/cpu/cpu{cpu}/cpufreq/scaling_governor")
        try:
            value = p.read_text(encoding="ascii").strip()
            if re.fullmatch(r"[a-z0-9_-]{1,32}", value):
                governors.add(value)
        except OSError:
            pass

    numa_nodes = 0
    node_root = pathlib.Path("/sys/devices/system/node")
    if node_root.exists():
        numa_nodes = sum(1 for p in node_root.glob("node[0-9]*") if p.is_dir())

    model_path = first_flag(args, ("--model", "-m"))
    if not model_path and b"LLAMA_ARG_MODEL" in env:
        model_path = os.fsdecode(env[b"LLAMA_ARG_MODEL"])
    model_size = None
    model_quant = "unknown"
    model_path_hash = None
    if model_path:
        model_path_hash = hashlib.sha256(model_path.encode("utf-8", "replace")).hexdigest()
        try:
            model_size = pathlib.Path(model_path).stat().st_size
        except OSError:
            pass
        upper = pathlib.Path(model_path).name.upper()
        for q in ("Q2_K", "Q3_K_S", "Q3_K_M", "Q3_K_L", "Q4_0", "Q4_K_S", "Q4_K_M", "Q5_0", "Q5_K_S", "Q5_K_M", "Q6_K", "Q8_0", "F16", "BF16"):
            if q in upper:
                model_quant = q
                break

    evidence: dict[str, Any] = {
        "schema": "gekta.speed2.s2-0.model-diagnostic.v1",
        "result": "PASS",
        "operation": op,
        "service_active": True,
        "service_restarts": int(run("systemctl", "show", SERVICE, "--property=NRestarts", "--value").strip() or 0),
        "restart_policy": run("systemctl", "show", SERVICE, "--property=Restart", "--value").strip(),
        "llama_build": build,
        "llama_commit": commit,
        "cmdline_sha256": hashlib.sha256(cmdline_raw).hexdigest(),
        "environment_sha256": hashlib.sha256(environ_raw).hexdigest(),
        "executable_sha256": hashlib.sha256(exe.read_bytes()).hexdigest(),
        "runtime": {
            **flags,
            "cache_prompt_effective": cache_prompt,
            "cache_prompt_capability": "--cache-prompt" in help_text,
            "cache_reuse_capability": "--cache-reuse" in help_text,
            "slots_capability": "--slots" in help_text,
            "metrics_capability": "--metrics" in help_text,
            "accepted_speed3896_baseline_matches": baseline_matches,
        },
        "cpu": {
            "model": cpu_model[:160],
            "logical": os.cpu_count() or 0,
            "affinity_count": len(affinity),
            "physical_cores_in_affinity": len(physical),
            "numa_nodes": numa_nodes,
            "governors": sorted(governors),
            "isa": {name: name in host_flags for name in SAFE_ISA},
        },
        "memory_kb": {
            "mem_total": kb_value(meminfo, "MemTotal"),
            "mem_available": kb_value(meminfo, "MemAvailable"),
            "swap_total": kb_value(meminfo, "SwapTotal"),
            "swap_free": kb_value(meminfo, "SwapFree"),
            "global_swap_used": max(0, kb_value(meminfo, "SwapTotal") - kb_value(meminfo, "SwapFree")),
            "rss": kb_value(status, "VmRSS"),
            "vm_swap": kb_value(status, "VmSwap"),
            "pss": kb_value(smaps, "Pss") if smaps else None,
        },
        "model": {
            "path_sha256": model_path_hash,
            "size_bytes": model_size,
            "quantization_from_filename": model_quant,
        },
        "privacy": {
            "prompt_content_published": False,
            "credentials_published": False,
            "raw_environment_published": False,
            "raw_argv_published": False,
        },
    }

    bearer, auth_source = resolve_bearer(args_raw, env)
    endpoints = resolve_endpoints(args, env, proc)
    selected: tuple[str, int, str] | None = None
    for host, port, source in endpoints:
        try:
            st, raw = http_request(host, port, bearer, "GET", "/metrics", timeout=4.0)
        except Exception:
            continue
        if st == 200:
            selected = (host, port, source)
            metrics0 = parse_metrics(raw)
            break
    if selected is None:
        raise DiagError("metrics_endpoint_unresolved")
    host, port, source = selected
    evidence["model_http"] = {
        "auth_source": auth_source,
        "port_source": source,
        "metrics": {k.split(":", 1)[1]: metrics0.get(k) for k in METRIC_NAMES},
    }

    if op == "diagnose":
        model_id = model_id_from_endpoint(host, port, bearer)
        before_a = metrics0
        st_a, wall_a, usage_a = post_chat(host, port, bearer, model_id, "Synthetic cache probe A. Reply OK.")
        st_m1, raw_m1 = http_request(host, port, bearer, "GET", "/metrics", timeout=4.0)
        if st_m1 != 200:
            raise DiagError("metrics_after_a_failed")
        after_a = parse_metrics(raw_m1)

        st_b, wall_b, usage_b = post_chat(host, port, bearer, model_id, "Synthetic cache probe B. Reply OK.")
        st_m2, raw_m2 = http_request(host, port, bearer, "GET", "/metrics", timeout=4.0)
        if st_m2 != 200:
            raise DiagError("metrics_after_b_failed")
        after_b = parse_metrics(raw_m2)

        def req(label: str, status_code: int, wall_ms: float, usage_prompt: int | None,
                before: dict[str, float], after: dict[str, float]) -> dict[str, Any]:
            p_tokens = metric_delta(after, before, "llamacpp:prompt_tokens_total")
            p_seconds = metric_delta(after, before, "llamacpp:prompt_seconds_total")
            pred_tokens = metric_delta(after, before, "llamacpp:tokens_predicted_total")
            pred_seconds = metric_delta(after, before, "llamacpp:tokens_predicted_seconds_total")
            return {
                "label": label,
                "http_status": status_code,
                "wall_ms": round(wall_ms, 3),
                "usage_prompt_tokens": usage_prompt,
                "metric_prompt_tokens_delta": round(p_tokens, 6) if p_tokens is not None else None,
                "metric_prompt_ms_delta": round(p_seconds * 1000.0, 3) if p_seconds is not None else None,
                "metric_predicted_tokens_delta": round(pred_tokens, 6) if pred_tokens is not None else None,
                "metric_predicted_ms_delta": round(pred_seconds * 1000.0, 3) if pred_seconds is not None else None,
            }

        a = req("A", st_a, wall_a, usage_a, before_a, after_a)
        b = req("B", st_b, wall_b, usage_b, after_a, after_b)
        reused_estimate = None
        uncontaminated_b = False
        if b["usage_prompt_tokens"] is not None and b["metric_prompt_tokens_delta"] is not None:
            uncontaminated_b = b["metric_prompt_tokens_delta"] <= b["usage_prompt_tokens"] + 1
            if uncontaminated_b:
                reused_estimate = max(0, int(round(b["usage_prompt_tokens"] - b["metric_prompt_tokens_delta"])))
        evidence["synthetic_cache_probe"] = {
            "fixed_prefix_sha256": hashlib.sha256(FIXED_SYSTEM.encode("utf-8")).hexdigest(),
            "fixed_prefix_chars": len(FIXED_SYSTEM),
            "model_identity_sha256": hashlib.sha256(model_id.encode("utf-8")).hexdigest(),
            "request_a": a,
            "request_b": b,
            "metric_window_b_uncontaminated": uncontaminated_b,
            "reused_token_estimate_b": reused_estimate,
            "cache_hit_estimated": bool(uncontaminated_b and reused_estimate and reused_estimate > 0),
            "note": "Synthetic fixed-prefix probe only; not final production acceptance.",
        }

    print(json.dumps(evidence, sort_keys=True, separators=(",", ":"), ensure_ascii=True))
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        code = exc.code if isinstance(exc, DiagError) else type(exc).__name__.upper()
        if not re.fullmatch(r"[A-Z0-9_]{3,80}", code):
            code = "UNCLASSIFIED_FAILURE"
        print(json.dumps({
            "schema": "gekta.speed2.s2-0.model-diagnostic.v1",
            "result": "FAIL_CLOSED",
            "error_code": code,
            "privacy": {
                "prompt_content_published": False,
                "credentials_published": False,
                "raw_environment_published": False,
                "raw_argv_published": False,
            },
        }, separators=(",", ":")))
        raise SystemExit(40)
