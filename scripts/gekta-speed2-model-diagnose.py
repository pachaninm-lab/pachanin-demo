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
FIXED_SYSTEM_A = (
    "You are synthetic SPEED-2 cache retention probe A. "
    "This is read-only diagnostic text with no user data. "
    "Use no tools, private data, current facts, prices, weather, laws, or external claims. "
    "Answer the next diagnostic instruction with one safe word only. "
) * 5
FIXED_SYSTEM_B = (
    "Independent synthetic SPEED-2 retention probe B starts here. "
    "It deliberately uses a different fixed prefix and contains no user data. "
    "Do not use tools, secrets, current facts, prices, weather, laws, or external claims. "
    "Return one harmless word for the diagnostic instruction. "
) * 5


def run(*args: str, timeout: float = 8.0) -> str:
    child_env = os.environ.copy()
    child_env["LC_ALL"] = "C"
    cp = subprocess.run(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=timeout,
        check=False,
        env=child_env,
    )
    if cp.returncode != 0:
        raise DiagError(f"command_failed:{args[0]}:{cp.returncode}")
    return cp.stdout


def kb_value(text: str | None, key: str) -> int:
    if not text:
        return 0
    m = re.search(rf"^{re.escape(key)}:\s+(\d+)\s+kB$", text, re.M)
    return int(m.group(1)) if m else 0


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
            key, value = part.split(b"=", 1)
            result[key] = value
    return result


def env_text(env: dict[bytes, bytes], key: bytes) -> str | None:
    raw = env.get(key)
    if raw is None:
        return None
    return raw.decode("ascii", "ignore").strip()


def parse_bool(text: str | None) -> bool | None:
    if text is None:
        return None
    value = text.strip().lower()
    if value in {"1", "true", "yes", "on", "enabled"}:
        return True
    if value in {"0", "false", "no", "off", "disabled"}:
        return False
    return None


def effective_bool(
    args: list[str],
    env: dict[bytes, bytes],
    positive: str,
    negative: str,
    env_key: bytes,
    default: bool,
) -> tuple[bool, str]:
    if positive in args:
        return True, "ARGV"
    if negative in args:
        return False, "ARGV"
    neg_env_key = env_key.replace(b"LLAMA_ARG_", b"LLAMA_ARG_NO_", 1)
    if neg_env_key in env:
        return False, "ENV_NEGATIVE"
    parsed = parse_bool(env_text(env, env_key))
    if parsed is not None:
        return parsed, "ENV"
    return default, "PINNED_BUILD_DEFAULT"


def effective_int(
    args: list[str],
    env: dict[bytes, bytes],
    names: tuple[str, ...],
    env_key: bytes,
    default: int,
) -> tuple[int, str]:
    value = first_flag(args, names)
    if value is not None:
        try:
            return int(value), "ARGV"
        except ValueError:
            raise DiagError("invalid_integer_flag")
    text = env_text(env, env_key)
    if text is not None:
        try:
            return int(text), "ENV"
        except ValueError:
            raise DiagError("invalid_integer_env")
    return default, "PINNED_BUILD_DEFAULT"


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
        stat = path.stat()
        if not path.is_file() or stat.st_size > 65536:
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
        match = re.fullmatch(r"socket:\[(\d+)\]", target)
        if match:
            inodes.add(match.group(1))

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
            if not 1 <= port <= 65535:
                continue
            if table_name == "net/tcp":
                host = decode_ipv4(address_hex)
                if not host:
                    continue
                endpoints.append(("127.0.0.1" if host == "0.0.0.0" else host, port, "PROC"))
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
        if not 1 <= port <= 65535 or (host, port) in seen:
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
    for host, port_value, source in owned_listener_endpoints(proc):
        add(host, str(port_value), source)
    return out


def http_request(
    host: str,
    port: int,
    bearer: str,
    method: str,
    path: str,
    body: dict[str, Any] | None = None,
    timeout: float = 8.0,
) -> tuple[int, bytes]:
    conn = http.client.HTTPConnection(host, port, timeout=timeout)
    headers = {"Authorization": f"Bearer {bearer}"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    try:
        conn.request(method, path, body=data, headers=headers)
        response = conn.getresponse()
        return response.status, response.read(1_000_000)
    finally:
        conn.close()


def parse_metrics(raw: bytes) -> dict[str, float]:
    text = raw.decode("utf-8", "replace")
    found: dict[str, float] = {}
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        match = re.match(r"^([^\s{]+)(?:\{[^}]*\})?\s+([-+0-9.eE]+)$", line)
        if not match or match.group(1) not in METRIC_NAMES:
            continue
        try:
            value = float(match.group(2))
        except ValueError:
            continue
        found[match.group(1)] = found.get(match.group(1), 0.0) + value
    return found


def metric_delta(after: dict[str, float], before: dict[str, float], key: str) -> float | None:
    if key not in after or key not in before:
        return None
    value = after[key] - before[key]
    return value if value >= -1e-9 else None


def get_json(host: str, port: int, bearer: str, path: str) -> dict[str, Any]:
    status, raw = http_request(host, port, bearer, "GET", path)
    if status != 200:
        raise DiagError(f"http_{path.strip('/').replace('/', '_')}_{status}")
    obj = json.loads(raw.decode("utf-8"))
    if not isinstance(obj, dict):
        raise DiagError("json_object_expected")
    return obj


def post_chat(
    host: str,
    port: int,
    bearer: str,
    model: str,
    system_text: str,
    suffix: str,
) -> tuple[int, float, int | None, int | None]:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_text},
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
        return status, elapsed_ms, None, None
    try:
        obj = json.loads(raw.decode("utf-8"))
        usage = obj.get("usage") if isinstance(obj, dict) else None
        prompt = usage.get("prompt_tokens") if isinstance(usage, dict) else None
        details = usage.get("prompt_tokens_details") if isinstance(usage, dict) else None
        cached = details.get("cached_tokens") if isinstance(details, dict) else None
        prompt_tokens = int(prompt) if isinstance(prompt, int) and prompt >= 0 else None
        cached_tokens = int(cached) if isinstance(cached, int) and cached >= 0 else None
    except Exception:
        prompt_tokens = None
        cached_tokens = None
    return status, elapsed_ms, prompt_tokens, cached_tokens


def model_id_from_endpoint(host: str, port: int, bearer: str) -> str:
    obj = get_json(host, port, bearer, "/v1/models")
    data = obj.get("data")
    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        raise DiagError("model_id_unresolved")
    model = data[0].get("id")
    if not isinstance(model, str) or not 1 <= len(model) <= 512:
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
    status_text = (proc / "status").read_text(encoding="utf-8")
    meminfo = pathlib.Path("/proc/meminfo").read_text(encoding="utf-8")
    exe = (proc / "exe").resolve(strict=True)

    version_text = run(str(exe), "--version")
    version_match = re.search(r"version:\s*(\d+)\s+\(([0-9a-fA-F]{7,40})\)", version_text)
    build = int(version_match.group(1)) if version_match else 0
    commit = version_match.group(2).lower() if version_match else "unknown"
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
    flags = {key: first_flag(args, names) for key, names in flag_map.items()}

    cache_prompt, cache_prompt_source = effective_bool(
        args, env, "--cache-prompt", "--no-cache-prompt", b"LLAMA_ARG_CACHE_PROMPT", True
    )
    cache_idle_slots, cache_idle_source = effective_bool(
        args, env, "--cache-idle-slots", "--no-cache-idle-slots", b"LLAMA_ARG_CACHE_IDLE_SLOTS", True
    )
    cache_ram_mib, cache_ram_source = effective_int(
        args, env, ("--cache-ram",), b"LLAMA_ARG_CACHE_RAM", 8192
    )
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
        topology = pathlib.Path(f"/sys/devices/system/cpu/cpu{cpu}/topology")
        try:
            physical.add(
                (
                    (topology / "physical_package_id").read_text().strip(),
                    (topology / "core_id").read_text().strip(),
                )
            )
        except OSError:
            physical.clear()
            break

    cpuinfo = pathlib.Path("/proc/cpuinfo").read_text(encoding="utf-8", errors="replace")
    model_match = re.search(r"^model name\s*:\s*(.+)$", cpuinfo, re.M)
    cpu_model = model_match.group(1).strip() if model_match else "unknown"
    host_flags_match = re.search(r"^flags\s*:\s*(.+)$", cpuinfo, re.M)
    host_flags = set(host_flags_match.group(1).split()) if host_flags_match else set()

    governors: set[str] = set()
    for cpu in affinity:
        path = pathlib.Path(f"/sys/devices/system/cpu/cpu{cpu}/cpufreq/scaling_governor")
        try:
            value = path.read_text(encoding="ascii").strip()
            if re.fullmatch(r"[a-z0-9_-]{1,32}", value):
                governors.add(value)
        except OSError:
            pass

    node_root = pathlib.Path("/sys/devices/system/node")
    numa_nodes = sum(1 for path in node_root.glob("node[0-9]*") if path.is_dir()) if node_root.exists() else 0

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
        for quant in (
            "Q2_K", "Q3_K_S", "Q3_K_M", "Q3_K_L", "Q4_0", "Q4_K_S", "Q4_K_M",
            "Q5_0", "Q5_K_S", "Q5_K_M", "Q6_K", "Q8_0", "F16", "BF16",
        ):
            if quant in upper:
                model_quant = quant
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
            "cache_prompt_source": cache_prompt_source,
            "cache_idle_slots_effective": cache_idle_slots,
            "cache_idle_slots_source": cache_idle_source,
            "cache_ram_mib": cache_ram_mib,
            "cache_ram_source": cache_ram_source,
            "cache_prompt_capability": "--cache-prompt" in help_text,
            "cache_reuse_capability": "--cache-reuse" in help_text,
            "cache_idle_slots_capability": "--cache-idle-slots" in help_text,
            "cache_ram_capability": "--cache-ram" in help_text,
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
            "rss": kb_value(status_text, "VmRSS"),
            "vm_swap": kb_value(status_text, "VmSwap"),
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
    metrics0: dict[str, float] = {}
    for host, port, source in endpoints:
        try:
            status_code, raw = http_request(host, port, bearer, "GET", "/metrics", timeout=4.0)
        except Exception:
            continue
        if status_code == 200:
            selected = (host, port, source)
            metrics0 = parse_metrics(raw)
            break
    if selected is None:
        raise DiagError("metrics_endpoint_unresolved")
    host, port, source = selected
    evidence["model_http"] = {
        "auth_source": auth_source,
        "port_source": source,
        "metrics": {key.split(":", 1)[1]: metrics0.get(key) for key in METRIC_NAMES},
    }

    if op == "diagnose":
        model_id = model_id_from_endpoint(host, port, bearer)

        def probe(
            label: str,
            system_text: str,
            suffix: str,
            before: dict[str, float],
        ) -> tuple[dict[str, Any], dict[str, float]]:
            status_code, wall_ms, usage_prompt, usage_cached = post_chat(
                host, port, bearer, model_id, system_text, suffix
            )
            metrics_status, metrics_raw = http_request(host, port, bearer, "GET", "/metrics", timeout=4.0)
            if metrics_status != 200:
                raise DiagError(f"metrics_after_{label.lower()}_failed")
            after = parse_metrics(metrics_raw)
            prompt_delta = metric_delta(after, before, "llamacpp:prompt_tokens_total")
            prompt_seconds = metric_delta(after, before, "llamacpp:prompt_seconds_total")
            predicted_delta = metric_delta(after, before, "llamacpp:tokens_predicted_total")
            predicted_seconds = metric_delta(after, before, "llamacpp:tokens_predicted_seconds_total")
            uncontaminated = bool(
                usage_prompt is not None
                and prompt_delta is not None
                and prompt_delta <= usage_prompt + 1
                and predicted_delta is not None
                and predicted_delta <= 1.0 + 1e-9
            )
            row = {
                "label": label,
                "http_status": status_code,
                "wall_ms": round(wall_ms, 3),
                "usage_prompt_tokens": usage_prompt,
                "usage_cached_tokens": usage_cached,
                "usage_cache_ratio": (
                    round(usage_cached / usage_prompt, 6)
                    if usage_prompt and usage_cached is not None
                    else None
                ),
                "metric_window_uncontaminated": uncontaminated,
                "metric_prompt_tokens_delta": round(prompt_delta, 6) if prompt_delta is not None else None,
                "metric_prompt_ms_delta": round(prompt_seconds * 1000.0, 3) if prompt_seconds is not None else None,
                "metric_predicted_tokens_delta": round(predicted_delta, 6) if predicted_delta is not None else None,
                "metric_predicted_ms_delta": round(predicted_seconds * 1000.0, 3) if predicted_seconds is not None else None,
            }
            return row, after

        a1, m1 = probe("A1", FIXED_SYSTEM_A, "Diagnostic A1. Reply OK.", metrics0)
        a2, m2 = probe("A2", FIXED_SYSTEM_A, "Diagnostic A2. Reply OK.", m1)
        b1, m3 = probe("B1", FIXED_SYSTEM_B, "Diagnostic B1. Reply OK.", m2)
        a3, _m4 = probe("A3", FIXED_SYSTEM_A, "Diagnostic A3. Reply OK.", m3)

        def warm(row: dict[str, Any]) -> bool | None:
            prompt_tokens = row.get("usage_prompt_tokens")
            cached_tokens = row.get("usage_cached_tokens")
            if not isinstance(prompt_tokens, int) or prompt_tokens <= 0 or not isinstance(cached_tokens, int):
                return None
            return cached_tokens / prompt_tokens >= 0.80

        warm_a2 = warm(a2)
        warm_a3 = warm(a3)
        if warm_a2 is True and warm_a3 is True:
            retention_verdict = "SURVIVES_INTERVENING_PREFIX"
        elif warm_a2 is True and warm_a3 is False:
            retention_verdict = "LOST_AFTER_INTERVENING_PREFIX"
        else:
            retention_verdict = "INDETERMINATE"

        evidence["synthetic_cache_probe"] = {
            "fixed_prefix_sha256": hashlib.sha256(FIXED_SYSTEM_A.encode("utf-8")).hexdigest(),
            "fixed_prefix_chars": len(FIXED_SYSTEM_A),
            "model_identity_sha256": hashlib.sha256(model_id.encode("utf-8")).hexdigest(),
            "request_a": a1,
            "request_b": a2,
            "metric_window_b_uncontaminated": a2["metric_window_uncontaminated"],
            "reused_token_estimate_b": a2["usage_cached_tokens"],
            "cache_hit_estimated": bool(warm_a2),
            "note": "Synthetic cache probe only; exact OAI cached-token telemetry is preferred over cumulative metric inference.",
        }
        evidence["cache_retention_probe"] = {
            "prefix_a_sha256": hashlib.sha256(FIXED_SYSTEM_A.encode("utf-8")).hexdigest(),
            "prefix_b_sha256": hashlib.sha256(FIXED_SYSTEM_B.encode("utf-8")).hexdigest(),
            "prefix_a_chars": len(FIXED_SYSTEM_A),
            "prefix_b_chars": len(FIXED_SYSTEM_B),
            "sequence": [a1, a2, b1, a3],
            "a2_warm_before_intervening_prefix": warm_a2,
            "a3_warm_after_intervening_prefix": warm_a3,
            "retention_verdict": retention_verdict,
            "diagnostic_only": True,
            "configuration_mutation": "NONE",
            "note": "A1->A2 warms prefix A, B1 introduces a distinct fixed prefix, A3 tests whether A remains reusable after B. No prompt text is published.",
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
        print(
            json.dumps(
                {
                    "schema": "gekta.speed2.s2-0.model-diagnostic.v1",
                    "result": "FAIL_CLOSED",
                    "error_code": code,
                    "privacy": {
                        "prompt_content_published": False,
                        "credentials_published": False,
                        "raw_environment_published": False,
                        "raw_argv_published": False,
                    },
                },
                separators=(",", ":"),
            )
        )
        raise SystemExit(40)
