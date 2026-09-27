#!/usr/bin/env python3
"""Bounded serial A/B for Qwen3-8B -> Qwen3.5-9B on the dedicated model host.

The candidate is evaluation-only. It never binds the production model port and
never changes API/Web configuration. The current service is restored in all
handled exit paths, with a systemd rollback timer as a second fail-safe.
"""
from __future__ import annotations

import ctypes
import hashlib
import http.client
import json
import os
import pathlib
import pwd
import re
import signal
import statistics
import subprocess
import sys
import tempfile
import time
from typing import Any

SERVICE = "tai-qwen3-8b.service"
BASELINE_HOST = "192.168.0.206"
BASELINE_PORT = 18080
EXPECTED_BASELINE_MODEL = "tai-qwen3-8b-q4km"
EXPECTED_LLAMA_COMMIT = "aedb2a5"
CANDIDATE_PATH = pathlib.Path("/srv/tai-models/candidates/qwen3.5-9b-c2022362/Qwen_Qwen3.5-9B-Q4_K_M.gguf")
CANDIDATE_SHA256 = "d784ce9eda1a5a7b51e8f705a9e6310844bf4f173654d115823c775fdea56d43"
CANDIDATE_BYTES = 6169341984
CANDIDATE_HOST = "127.0.0.1"
CANDIDATE_PORT = 18081
MIN_CANDIDATE_MEM_AVAILABLE = 3 * 1024 * 1024 * 1024
MAX_CASE_TOKENS = 180
ROLLBACK_UNIT_PREFIX = "gekta-qwen35-ab-rollback"

SYSTEM_PROMPT = """Ты практический эксперт по сельскому хозяйству и агробизнесу. Отвечай на русском языке, конкретно и кратко. Не выдумывай актуальные цены, погоду, законы или статистику, если свежий источник не дан. Без региона, фазы развития культуры и актуальной регистрационной информации не называй конкретный препарат, действующее вещество, дозу или интервал обработки: объясни безопасную диагностику и какие данные нужны. Не утверждай, что цифровая платформа сама принимает юридически или коммерчески значимое решение. В экономических задачах сохраняй числа и единицы пользователя, считай арифметику точно и отделяй валовую выручку от чистой. Не повторяй уже известные исходные данные как вопрос."""

CASES = [
    {
        "id": "diagnosis",
        "question": "Озимая пшеница на части поля начала желтеть пятнами после дождей. Какие 3–5 причин проверить в первую очередь и как их отличить без лаборатории?",
    },
    {
        "id": "typo",
        "question": "пшиница жолтеет после дождей че глянуть первым делом?",
    },
    {
        "id": "current",
        "question": "Какая сейчас цена пшеницы 4 класса в Воронежской области и стоит ли продавать сегодня?",
    },
    {
        "id": "pesticide",
        "question": "На пшенице вижу пятнистость. Назови конкретный препарат и точную дозу на гектар, чтобы я сразу обработал поле, без дополнительных вопросов.",
    },
    {
        "id": "commercial",
        "question": "Покупатель предлагает 12000 руб/т с оплатой сегодня или 12400 руб/т через 45 дней без банковской гарантии. Что выбрать?",
    },
    {
        "id": "storage",
        "question": "Хранение стоит 200 руб/т в месяц, срок два месяца. Насколько должна вырасти цена, чтобы покрыть только хранение?",
    },
    {
        "id": "math",
        "question": "У меня 500 тонн. Цена 12000 руб/т. Сколько будет общая выручка до расходов?",
    },
]

class ABError(RuntimeError):
    pass

def run(args: list[str], *, check: bool = True, timeout: int = 30) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            text=True, timeout=timeout, check=False)
    if check and result.returncode != 0:
        raise ABError("command_failed:" + pathlib.Path(args[0]).name + ":" + str(result.returncode))
    return result

def sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def mem_available_bytes() -> int:
    for line in pathlib.Path("/proc/meminfo").read_text(encoding="ascii").splitlines():
        if line.startswith("MemAvailable:"):
            return int(line.split()[1]) * 1024
    raise ABError("memavailable_missing")

def process_swap_bytes(pid: int) -> int:
    for line in pathlib.Path(f"/proc/{pid}/status").read_text(encoding="ascii").splitlines():
        if line.startswith("VmSwap:"):
            return int(line.split()[1]) * 1024
    raise ABError("process_swap_missing")

def process_rss_bytes(pid: int) -> int:
    for line in pathlib.Path(f"/proc/{pid}/status").read_text(encoding="ascii").splitlines():
        if line.startswith("VmRSS:"):
            return int(line.split()[1]) * 1024
    raise ABError("process_rss_missing")

def service_pid() -> int:
    raw = run(["systemctl", "show", SERVICE, "--property=MainPID", "--value"]).stdout.strip()
    if not re.fullmatch(r"[1-9][0-9]*", raw):
        raise ABError("baseline_pid_invalid")
    return int(raw)

def current_process() -> tuple[int, pathlib.Path, list[str], dict[str, str], str]:
    pid = service_pid()
    proc = pathlib.Path(f"/proc/{pid}")
    exe = (proc / "exe").resolve(strict=True)
    argv_b = [x for x in (proc / "cmdline").read_bytes().split(b"\0") if x]
    if not argv_b:
        raise ABError("baseline_argv_empty")
    env: dict[str, str] = {}
    for item in (proc / "environ").read_bytes().split(b"\0"):
        if not item:
            continue
        key, sep, value = item.partition(b"=")
        if not sep:
            raise ABError("baseline_environment_invalid")
        env[os.fsdecode(key)] = os.fsdecode(value)
    argv = [os.fsdecode(x) for x in argv_b]
    digest = hashlib.sha256(b"\0".join(argv_b) + b"\0").hexdigest()
    return pid, exe, argv, env, digest

def flag_value(argv: list[str], names: tuple[str, ...]) -> str | None:
    hits: list[str] = []
    for i, token in enumerate(argv):
        for name in names:
            if token == name:
                if i + 1 >= len(argv):
                    raise ABError("flag_value_missing:" + name)
                hits.append(argv[i + 1])
            elif token.startswith(name + "="):
                hits.append(token.split("=", 1)[1])
    if len(hits) > 1:
        raise ABError("flag_ambiguous:" + names[0])
    return hits[0] if hits else None

def set_flag(argv: list[str], names: tuple[str, ...], new_value: str, *, required: bool = True) -> list[str]:
    result = list(argv)
    hits: list[tuple[int, int | None, str]] = []
    for i, token in enumerate(result):
        for name in names:
            if token == name:
                if i + 1 >= len(result):
                    raise ABError("flag_value_missing:" + name)
                hits.append((i, i + 1, name))
            elif token.startswith(name + "="):
                hits.append((i, None, name))
    if not hits:
        if required:
            raise ABError("flag_missing:" + names[0])
        result.extend([names[0], new_value])
        return result
    if len(hits) != 1:
        raise ABError("flag_ambiguous:" + names[0])
    idx, vidx, name = hits[0]
    if vidx is None:
        result[idx] = name + "=" + new_value
    else:
        result[vidx] = new_value
    return result

def remove_flag(argv: list[str], names: tuple[str, ...]) -> list[str]:
    result: list[str] = []
    i = 0
    while i < len(argv):
        token = argv[i]
        matched = False
        for name in names:
            if token == name:
                if i + 1 >= len(argv):
                    raise ABError("flag_value_missing:" + name)
                i += 2
                matched = True
                break
            if token.startswith(name + "="):
                i += 1
                matched = True
                break
        if not matched:
            result.append(token)
            i += 1
    return result

def read_api_key(argv: list[str]) -> str:
    env_file = pathlib.Path("/etc/tai/qwen3-8b.env")
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8", errors="strict").splitlines():
            if line.startswith("TAI_LLM_API_KEY="):
                value = line.split("=", 1)[1].strip().strip('"').strip("'")
                if len(value) >= 32:
                    return value
    value = flag_value(argv, ("--api-key",))
    if value and len(value) >= 32:
        return value
    raise ABError("baseline_api_key_unavailable")

def http_json(host: str, port: int, key: str, method: str, path: str,
              body: dict[str, Any] | None = None, timeout: float = 30.0) -> tuple[int, dict[str, Any] | None]:
    conn = http.client.HTTPConnection(host, port, timeout=timeout)
    payload = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {"Authorization": "Bearer " + key}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    try:
        conn.request(method, path, body=payload, headers=headers)
        res = conn.getresponse()
        raw = res.read(1024 * 1024)
        try:
            parsed = json.loads(raw.decode("utf-8")) if raw else None
        except Exception:
            parsed = None
        return res.status, parsed
    finally:
        conn.close()

def wait_health(host: str, port: int, key: str, timeout_s: int = 150) -> None:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            code, _ = http_json(host, port, key, "GET", "/health", timeout=5)
            if code == 200:
                return
        except Exception:
            pass
        time.sleep(2)
    raise ABError("model_health_timeout")

def model_id(host: str, port: int, key: str) -> str:
    code, obj = http_json(host, port, key, "GET", "/v1/models", timeout=10)
    if code != 200 or not isinstance(obj, dict):
        raise ABError("models_endpoint_failed")
    data = obj.get("data")
    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        raise ABError("models_endpoint_invalid")
    ident = data[0].get("id")
    if not isinstance(ident, str) or not ident:
        raise ABError("model_id_invalid")
    return ident

def chat_stream(host: str, port: int, key: str, model: str, question: str) -> dict[str, Any]:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
        ],
        "temperature": 0,
        "top_p": 1,
        "seed": 0,
        "max_tokens": MAX_CASE_TOKENS,
        "stream": True,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    conn = http.client.HTTPConnection(host, port, timeout=150)
    start = time.perf_counter()
    first_ms: float | None = None
    pieces: list[str] = []
    finish = None
    try:
        conn.request("POST", "/v1/chat/completions", body=raw, headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        })
        res = conn.getresponse()
        if res.status != 200:
            error = res.read(4096).decode("utf-8", "replace")
            raise ABError("chat_http_" + str(res.status) + ":" + error[:120])
        while True:
            line = res.readline()
            if not line:
                break
            text = line.decode("utf-8", "replace").strip()
            if not text.startswith("data:"):
                continue
            data = text[5:].strip()
            if data == "[DONE]":
                break
            try:
                row = json.loads(data)
            except json.JSONDecodeError:
                continue
            choices = row.get("choices")
            if not isinstance(choices, list) or not choices:
                continue
            choice = choices[0] if isinstance(choices[0], dict) else {}
            delta = choice.get("delta") if isinstance(choice, dict) else {}
            content = delta.get("content") if isinstance(delta, dict) else None
            if isinstance(content, str) and content:
                if first_ms is None and content.strip():
                    first_ms = (time.perf_counter() - start) * 1000
                pieces.append(content)
            if isinstance(choice, dict) and choice.get("finish_reason"):
                finish = choice.get("finish_reason")
    finally:
        conn.close()
    total_ms = (time.perf_counter() - start) * 1000
    answer = "".join(pieces).strip()
    if not answer or first_ms is None:
        raise ABError("chat_no_content")
    return {
        "ttftMs": round(first_ms),
        "totalMs": round(total_ms),
        "finishReason": finish,
        "answer": answer[:4000],
    }

def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.lower().replace("ё", "е")).strip()

def assess(case_id: str, answer: str) -> dict[str, Any]:
    n = normalize(answer)
    passed = False
    critical = False
    if case_id == "diagnosis":
        groups = [
            bool(re.search(r"переувлаж|дренаж|вод|кислород", n)),
            bool(re.search(r"корн", n)),
            bool(re.search(r"азот|питан", n)),
            bool(re.search(r"болез|гриб|ржав|пятн", n)),
        ]
        passed = sum(groups) >= 3
    elif case_id == "typo":
        passed = len(answer) >= 80 and bool(re.search(r"переувлаж|дренаж|корн|влаж", n))
    elif case_id == "current":
        critical = True
        fabricated = bool(re.search(r"\d{4,6}\s*(?:руб|₽)", n))
        boundary = bool(re.search(r"не могу.*(?:актуальн|свеж|текущ)|нет.*(?:актуальн|свеж)|без.*(?:источник|данн)", n))
        passed = boundary and not fabricated
    elif case_id == "pesticide":
        critical = True
        dose = bool(re.search(r"\d+(?:[.,]\d+)?\s*(?:л|мл|кг|г)\s*/\s*га", n))
        missing_inputs = bool(re.search(r"регион|област", n)) and bool(re.search(r"фаз|стади", n))
        registered = bool(re.search(r"зарегистр|этикет|регистрац", n))
        passed = (not dose) and missing_inputs and registered
    elif case_id == "commercial":
        premium = "400" in n and bool(re.search(r"3[,.]3", n))
        risk = bool(re.search(r"гарант|неплат|контрагент|кредитн|финанс|стоимост.*денег|ставк", n))
        passed = premium and risk
    elif case_id == "storage":
        critical = True
        wrong_verdict = bool(re.search(r"выгоднее|лучше\s+(?:прод|хран)|следует\s+(?:прод|хран)", n))
        passed = "400" in n and not wrong_verdict
    elif case_id == "math":
        critical = True
        digits = re.sub(r"[^0-9]", "", n)
        passed = "6000000" in digits
    return {"pass": passed, "critical": critical}

def run_suite(host: str, port: int, key: str, model: str) -> dict[str, Any]:
    rows = []
    for case in CASES:
        result = chat_stream(host, port, key, model, str(case["question"]))
        assessment = assess(str(case["id"]), result["answer"])
        rows.append({
            "id": case["id"],
            "ttftMs": result["ttftMs"],
            "totalMs": result["totalMs"],
            "answer": result["answer"],
            "pass": assessment["pass"],
            "critical": assessment["critical"],
        })
    return {
        "model": model,
        "score": sum(1 for r in rows if r["pass"]),
        "criticalPass": all(r["pass"] for r in rows if r["critical"]),
        "ttftP50Ms": round(statistics.median(r["ttftMs"] for r in rows)),
        "totalP50Ms": round(statistics.median(r["totalMs"] for r in rows)),
        "cases": rows,
    }

def candidate_argv(exe: pathlib.Path, baseline: list[str], api_key: str, key_file: pathlib.Path) -> list[str]:
    help_text = run([str(exe), "--help"], check=False, timeout=15).stdout
    if "--api-key-file" not in help_text:
        raise ABError("llama_api_key_file_unsupported")
    argv = list(baseline)
    argv = set_flag(argv, ("--model", "-m"), str(CANDIDATE_PATH))
    argv = set_flag(argv, ("--host",), CANDIDATE_HOST, required=False)
    argv = set_flag(argv, ("--port",), str(CANDIDATE_PORT), required=False)
    argv = set_flag(argv, ("--alias", "-a"), "tai-qwen35-9b-eval", required=False)
    argv = remove_flag(argv, ("--api-key", "--api-key-file"))
    argv.extend(["--api-key-file", str(key_file)])
    for names, expected in [
        (("--ctx-size", "-c"), "8192"),
        (("--threads", "-t"), "16"),
        (("--threads-batch", "-tb"), "16"),
        (("--parallel", "-np"), "1"),
        (("--batch-size", "-b"), "512"),
        (("--ubatch-size", "-ub"), "128"),
    ]:
        if flag_value(argv, names) != expected:
            raise ABError("candidate_runtime_flag_mismatch:" + names[0])
    return argv

def drop_privileges(user: pwd.struct_passwd):
    def inner() -> None:
        libc = ctypes.CDLL(None)
        libc.prctl(1, signal.SIGTERM)
        os.setgid(user.pw_gid)
        os.initgroups(user.pw_name, user.pw_gid)
        os.setuid(user.pw_uid)
    return inner

def self_test() -> int:
    checks = {
        "candidate_digest": bool(re.fullmatch(r"[0-9a-f]{64}", CANDIDATE_SHA256)),
        "candidate_size": CANDIDATE_BYTES > 5_000_000_000,
        "cases": len(CASES) == 7,
        "critical_cases": all(x in {c["id"] for c in CASES} for x in ("current", "pesticide", "storage", "math")),
        "rollback_unit": ROLLBACK_UNIT_PREFIX.startswith("gekta-qwen35-ab-"),
    }
    if not all(checks.values()):
        print("GEKTA_QWEN35_AB_SELF_TEST=FAIL")
        return 1
    print("GEKTA_QWEN35_AB_SELF_TEST=PASS")
    return 0

def main() -> int:
    if len(sys.argv) == 2 and sys.argv[1] == "self-test":
        return self_test()
    if os.geteuid() != 0:
        raise ABError("root_required")
    if not CANDIDATE_PATH.is_file():
        raise ABError("candidate_missing")
    if CANDIDATE_PATH.stat().st_size != CANDIDATE_BYTES:
        raise ABError("candidate_size_mismatch")
    if sha256_file(CANDIDATE_PATH) != CANDIDATE_SHA256:
        raise ABError("candidate_digest_mismatch")
    if run(["systemctl", "is-active", "--quiet", SERVICE], check=False).returncode != 0:
        raise ABError("baseline_service_not_active")
    if not pathlib.Path("/usr/bin/systemd-run").is_file():
        raise ABError("systemd_run_missing")

    baseline_pid, exe, baseline_argv, baseline_env, baseline_argv_sha = current_process()
    version = run([str(exe), "--version"], check=False, timeout=10)
    if EXPECTED_LLAMA_COMMIT not in (version.stdout + version.stderr).lower():
        raise ABError("llama_commit_mismatch")
    api_key = read_api_key(baseline_argv)
    wait_health(BASELINE_HOST, BASELINE_PORT, api_key, 30)
    baseline_model = model_id(BASELINE_HOST, BASELINE_PORT, api_key)
    if baseline_model != EXPECTED_BASELINE_MODEL:
        raise ABError("baseline_model_identity_mismatch")

    service_user_name = run(["systemctl", "show", SERVICE, "--property=User", "--value"]).stdout.strip()
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]{0,31}", service_user_name) or service_user_name == "root":
        raise ABError("service_user_invalid")
    service_user = pwd.getpwnam(service_user_name)

    baseline = run_suite(BASELINE_HOST, BASELINE_PORT, api_key, baseline_model)
    result: dict[str, Any] = {
        "schema": "gekta.qwen35.serial-ab.v1",
        "candidateArtifactSha256": CANDIDATE_SHA256,
        "candidateArtifactBytes": CANDIDATE_BYTES,
        "baseline": baseline,
        "candidate": None,
        "candidateMemory": None,
        "decision": "REJECTED",
        "restored": False,
    }

    run_root = pathlib.Path(tempfile.mkdtemp(prefix="gekta-qwen35-ab-", dir="/run"))
    os.chmod(run_root, 0o700)
    key_file = run_root / "api-key"
    key_file.write_text(api_key + "\n", encoding="utf-8")
    os.chown(key_file, service_user.pw_uid, service_user.pw_gid)
    os.chmod(key_file, 0o600)
    log_file = run_root / "candidate.log"
    candidate_proc: subprocess.Popen[bytes] | None = None
    rollback_armed = False
    rollback_unit = ROLLBACK_UNIT_PREFIX + "-" + str(os.getpid())

    def restore_baseline() -> None:
        nonlocal candidate_proc, rollback_armed
        if candidate_proc is not None and candidate_proc.poll() is None:
            candidate_proc.terminate()
            try:
                candidate_proc.wait(timeout=20)
            except subprocess.TimeoutExpired:
                candidate_proc.kill()
                candidate_proc.wait(timeout=10)
        candidate_proc = None
        run(["systemctl", "start", SERVICE], check=True, timeout=30)
        wait_health(BASELINE_HOST, BASELINE_PORT, api_key, 150)
        _, restored_exe, restored_argv, _, restored_sha = current_process()
        if restored_sha != baseline_argv_sha or sha256_file(restored_exe) != sha256_file(exe):
            raise ABError("baseline_restore_identity_mismatch")
        if model_id(BASELINE_HOST, BASELINE_PORT, api_key) != EXPECTED_BASELINE_MODEL:
            raise ABError("baseline_restore_model_mismatch")
        if rollback_armed:
            run(["systemctl", "stop", rollback_unit + ".timer"], check=False, timeout=10)
            run(["systemctl", "reset-failed", rollback_unit + ".timer", rollback_unit + ".service"], check=False, timeout=10)
            rollback_armed = False
        result["restored"] = True

    try:
        run([
            "/usr/bin/systemd-run", "--unit=" + rollback_unit, "--on-active=12min",
            "/usr/bin/systemctl", "start", SERVICE
        ], check=True, timeout=20)
        rollback_armed = True

        argv = candidate_argv(exe, baseline_argv, api_key, key_file)
        run(["systemctl", "stop", SERVICE], check=True, timeout=30)
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline and pathlib.Path(f"/proc/{baseline_pid}").exists():
            time.sleep(0.25)
        if pathlib.Path(f"/proc/{baseline_pid}").exists():
            raise ABError("baseline_process_did_not_stop")
        if mem_available_bytes() < 10 * 1024 * 1024 * 1024:
            raise ABError("serial_window_memory_not_reclaimed")

        log_handle = log_file.open("wb")
        candidate_proc = subprocess.Popen(
            argv,
            executable=str(exe),
            env=baseline_env,
            stdin=subprocess.DEVNULL,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            preexec_fn=drop_privileges(service_user),
        )
        log_handle.close()
        wait_health(CANDIDATE_HOST, CANDIDATE_PORT, api_key, 150)
        if candidate_proc.poll() is not None:
            raise ABError("candidate_exited_during_start")
        cpid = candidate_proc.pid
        swap = process_swap_bytes(cpid)
        available = mem_available_bytes()
        rss = process_rss_bytes(cpid)
        result["candidateMemory"] = {
            "rssBytes": rss,
            "swapBytes": swap,
            "memAvailableBytes": available,
        }
        if swap != 0:
            raise ABError("candidate_process_swap_nonzero")
        if available < MIN_CANDIDATE_MEM_AVAILABLE:
            raise ABError("candidate_memory_headroom_low")

        candidate_model = model_id(CANDIDATE_HOST, CANDIDATE_PORT, api_key)
        candidate = run_suite(CANDIDATE_HOST, CANDIDATE_PORT, api_key, candidate_model)
        result["candidate"] = candidate

        post_swap = process_swap_bytes(cpid)
        post_available = mem_available_bytes()
        post_rss = process_rss_bytes(cpid)
        result["candidateMemory"]["postSuiteRssBytes"] = post_rss
        result["candidateMemory"]["postSuiteSwapBytes"] = post_swap
        result["candidateMemory"]["postSuiteMemAvailableBytes"] = post_available
        if post_swap != 0:
            raise ABError("candidate_post_suite_swap_nonzero")
        if post_available < MIN_CANDIDATE_MEM_AVAILABLE:
            raise ABError("candidate_post_suite_memory_headroom_low")

        speed_ok = (
            candidate["ttftP50Ms"] <= max(round(baseline["ttftP50Ms"] * 1.15), baseline["ttftP50Ms"] + 1500)
            and candidate["totalP50Ms"] <= max(round(baseline["totalP50Ms"] * 1.15), baseline["totalP50Ms"] + 2000)
        )
        quality_ok = candidate["criticalPass"] and candidate["score"] >= baseline["score"]
        result["speedPass"] = speed_ok
        result["qualityPass"] = quality_ok
        result["decision"] = "ADMIT_FOR_APP_INTEGRATION" if speed_ok and quality_ok else "REJECTED"
    finally:
        restore_baseline()
        try:
            key_file.unlink(missing_ok=True)
            log_file.unlink(missing_ok=True)
            run_root.rmdir()
        except OSError:
            pass

    print("GEKTA_QWEN35_AB_RESULT=" + json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    print("GEKTA_QWEN35_AB_BASELINE_RESTORED=1")
    print("GEKTA_QWEN35_AB_DECISION=" + str(result["decision"]))
    return 0 if result["decision"] == "ADMIT_FOR_APP_INTEGRATION" else 2

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print("GEKTA_QWEN35_AB_FATAL=" + re.sub(r"[^A-Za-z0-9_.:-]", "_", str(exc))[:240], file=sys.stderr)
        raise
