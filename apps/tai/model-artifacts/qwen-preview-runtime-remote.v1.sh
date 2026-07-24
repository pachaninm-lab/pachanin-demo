#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RUN_ROOT="${1:?run root required}"
EXACT_MAIN="${2:?exact main required}"
WORKFLOW_RUN_ID="${3:?workflow run id required}"
WORKFLOW_RUN_ATTEMPT="${4:?workflow run attempt required}"
AUTHORITY="$RUN_ROOT/control/qwen-preview-runtime-authority.v1.json"
RAW_ROOT="$RUN_ROOT/raw"
EVIDENCE_ROOT="$RUN_ROOT/evidence"
SERVER_PID=""
SERVER_PGID=""
SERVER_START_TICKS=""
RSS_GUARD_PID=""
PORT=18080
HOST=127.0.0.1
MAX_RSS_BYTES=12000000000
RSS_PEAK_FILE="$RUN_ROOT/control/rss-peak-bytes"
RSS_BREACH_FILE="$RUN_ROOT/control/rss-limit-exceeded"
RSS_READY_FILE="$RUN_ROOT/control/rss-guard-ready"

die() {
  printf 'QWEN_PREVIEW_FAILED:%s\n' "$1" >&2
  exit 1
}

[[ "$EXACT_MAIN" =~ ^[0-9a-f]{40}$ ]] || die exact_main_invalid
[[ "$WORKFLOW_RUN_ID" =~ ^[1-9][0-9]*$ ]] || die run_id_invalid
[[ "$WORKFLOW_RUN_ATTEMPT" =~ ^[1-9][0-9]*$ ]] || die run_attempt_invalid
EXPECTED_RUN_ROOT="/srv/tai-models/preview-runs/$EXACT_MAIN/$WORKFLOW_RUN_ID-$WORKFLOW_RUN_ATTEMPT"
[[ "$RUN_ROOT" == "$EXPECTED_RUN_ROOT" ]] || die run_root_invalid
[[ "$(id -un)" == "tai-model" ]] || die user_invalid
[[ "$(uname -s)" == "Linux" && "$(uname -m)" == "x86_64" ]] || die platform_invalid
[[ -d /srv/tai-models && ! -L /srv/tai-models ]] || die workspace_invalid
[[ -f "$AUTHORITY" && ! -L "$AUTHORITY" ]] || die authority_missing

command -v curl >/dev/null
command -v jq >/dev/null
command -v python3 >/dev/null
command -v sha256sum >/dev/null
command -v ss >/dev/null
command -v stat >/dev/null

listener_present() {
  ss -H -ltn "sport = :$PORT" | grep -q .
}

listener_present && die listener_already_present
mkdir -p "$RAW_ROOT" "$EVIDENCE_ROOT"

stop_server() {
  if [[ -z "$SERVER_PGID" ]]; then
    return
  fi
  kill -TERM -- "-$SERVER_PGID" 2>/dev/null || true
  kill -CONT -- "-$SERVER_PGID" 2>/dev/null || true
  if [[ -n "$SERVER_PID" ]]; then
    for _ in $(seq 1 30); do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 1
    done
  fi
  kill -KILL -- "-$SERVER_PGID" 2>/dev/null || true
  if [[ -n "$SERVER_PID" ]]; then
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  SERVER_PID=""
  SERVER_PGID=""
  SERVER_START_TICKS=""
}

stop_rss_guard() {
  if [[ -z "$RSS_GUARD_PID" ]]; then
    return
  fi
  for _ in $(seq 1 20); do
    kill -0 "$RSS_GUARD_PID" 2>/dev/null || break
    sleep 0.05
  done
  if kill -0 "$RSS_GUARD_PID" 2>/dev/null; then
    kill -TERM "$RSS_GUARD_PID" 2>/dev/null || true
  fi
  wait "$RSS_GUARD_PID" 2>/dev/null || true
  RSS_GUARD_PID=""
}

cleanup() {
  local code=$?
  trap - EXIT INT TERM ERR
  stop_server
  stop_rss_guard
  rm -rf "$RAW_ROOT"
  if listener_present; then
    printf 'listener remains on %s:%s after cleanup\n' "$HOST" "$PORT" >&2
    code=1
  fi
  exit "$code"
}
trap cleanup EXIT INT TERM ERR

mapfile -t CONVERSION_BINDING < <(python3 - "$AUTHORITY" <<'PY'
import json
import sys
from pathlib import Path

authority = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
conversion = authority["conversion_input"]
expected = {
    "exact_main_sha": "8bd494dc4954baaf699cffa243951392ff451ebb",
    "workflow_run_id": 29810648430,
    "workflow_run_attempt": 1,
    "root": (
        "/srv/tai-models/conversion-runs/"
        "8bd494dc4954baaf699cffa243951392ff451ebb/29810648430-1"
    ),
    "report_path": (
        "/srv/tai-models/conversion-runs/"
        "8bd494dc4954baaf699cffa243951392ff451ebb/29810648430-1/"
        "evidence/conversion-report.json"
    ),
    "required_root_state": "COMPLETE",
    "required_report_status": (
        "CONVERSION_AND_QUANTIZATION_COMPLETE_PENDING_BUNDLE_RESTORE"
    ),
    "source_model_id": "Qwen/Qwen3-8B",
    "source_revision": "895c8d171bc03c30e113cd7a28c02494b5e068b7",
    "required_step_key": "qwen3-8b-q4-k-m",
    "required_step_status": "COMPLETE",
    "output_path": "artifacts/qwen3-8b-q4-k-m.gguf",
    "conversion_authority_path": (
        "/srv/tai-models/conversion-runs/"
        "8bd494dc4954baaf699cffa243951392ff451ebb/29810648430-1/"
        "control/model-conversion-authority.v1.json"
    ),
    "conversion_authority_sha256": (
        "e7531a0d19fbdb92d14fa84d8bb3fd5a4a012ee61e3bf7cc632513bd435388f4"
    ),
    "step_report_path": (
        "/srv/tai-models/conversion-runs/"
        "8bd494dc4954baaf699cffa243951392ff451ebb/29810648430-1/"
        "evidence/steps/qwen3-8b-q4-k-m.json"
    ),
    "report_sha256": (
        "056c0203f382f6e3e1e57ebf145448cfddbff4718456fac7a2a84c6420185241"
    ),
    "model_sha256": (
        "107afd988cdbdcced3b8e76ebc3a8e83b5a18a5c796fca20778410cb9c47a814"
    ),
    "model_size_bytes": 5027784032,
}
if conversion != expected:
    raise SystemExit("conversion input authority mismatch")
print(conversion["root"])
print(conversion["report_path"])
PY
)
(( ${#CONVERSION_BINDING[@]} == 2 )) || die conversion_binding_invalid
CONVERSION_ROOT="${CONVERSION_BINDING[0]}"
CONVERSION_REPORT="${CONVERSION_BINDING[1]}"
[[ -d "$CONVERSION_ROOT" && ! -L "$CONVERSION_ROOT" ]] || die conversion_root_invalid
[[ -f "$CONVERSION_REPORT" && ! -L "$CONVERSION_REPORT" ]] || die conversion_report_not_found

python3 - "$AUTHORITY" "$CONVERSION_REPORT" "$RUN_ROOT/control/selected.json" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

authority_path, report_path, output_path = map(Path, sys.argv[1:])
authority = json.loads(authority_path.read_text(encoding="utf-8"))
conversion = authority["conversion_input"]
conversion_root = Path(conversion["root"])
expected_report = Path(conversion["report_path"])
conversion_authority_path = Path(conversion["conversion_authority_path"])
step_report_path = Path(conversion["step_report_path"])
if conversion_root.resolve(strict=True) != conversion_root:
    raise SystemExit("conversion root is not exact")
if report_path != expected_report or report_path.parent.parent != conversion_root:
    raise SystemExit("conversion report path mismatch")
if report_path.resolve(strict=True) != report_path or report_path.is_symlink():
    raise SystemExit("conversion report is not exact")
if conversion_authority_path.parent.parent != conversion_root:
    raise SystemExit("conversion authority path mismatch")
if (
    not conversion_authority_path.is_file()
    or conversion_authority_path.is_symlink()
    or conversion_authority_path.resolve(strict=True) != conversion_authority_path
):
    raise SystemExit("conversion authority is not exact")
if step_report_path.parent.parent.parent != conversion_root:
    raise SystemExit("conversion step path mismatch")
if (
    not step_report_path.is_file()
    or step_report_path.is_symlink()
    or step_report_path.resolve(strict=True) != step_report_path
):
    raise SystemExit("conversion step evidence is not exact")
if (
    hashlib.sha256(conversion_authority_path.read_bytes()).hexdigest()
    != conversion["conversion_authority_sha256"]
):
    raise SystemExit("conversion authority digest mismatch")
status_path = conversion_root / "status.json"
if not status_path.is_file() or status_path.is_symlink():
    raise SystemExit("conversion root status missing")
root_status = json.loads(status_path.read_text(encoding="utf-8"))
if root_status.get("state") != conversion["required_root_state"]:
    raise SystemExit("conversion root is not complete")

report = json.loads(report_path.read_text(encoding="utf-8"))
unsigned = dict(report)
report_sha = unsigned.pop("report_sha256")
rendered = json.dumps(
    unsigned,
    ensure_ascii=False,
    separators=(",", ":"),
    sort_keys=True,
)
if hashlib.sha256(rendered.encode()).hexdigest() != report_sha:
    raise SystemExit("conversion report digest mismatch")
if report_sha != conversion["report_sha256"]:
    raise SystemExit("conversion report is not the accepted report")
if report.get("status") != conversion["required_report_status"]:
    raise SystemExit("conversion report status mismatch")
if report.get("exact_main_sha") != conversion["exact_main_sha"]:
    raise SystemExit("conversion exact-main mismatch")
if report.get("workflow_run_id") != conversion["workflow_run_id"]:
    raise SystemExit("conversion workflow run mismatch")
if report.get("workflow_run_attempt") != conversion["workflow_run_attempt"]:
    raise SystemExit("conversion workflow attempt mismatch")
if report.get("host_role") != authority["target"]["host_role"]:
    raise SystemExit("conversion host role mismatch")
if report.get("workspace_root") != authority["target"]["workspace_root"]:
    raise SystemExit("conversion workspace mismatch")
if report.get("toolchain_status") != "VERIFIED_RESTORED":
    raise SystemExit("conversion toolchain is not restored")
if report.get("benchmark_status") != "NOT_RUN":
    raise SystemExit("unexpected conversion benchmark state")
if report.get("model_admission_status") != "NOT_DONE":
    raise SystemExit("unexpected conversion admission state")
if report.get("production_operational_status") != "NOT_ATTESTED":
    raise SystemExit("unexpected conversion production state")

source_verification = report.get("source_verification")
if not isinstance(source_verification, dict):
    raise SystemExit("source verification missing")
if source_verification.get("status") != "VERIFIED":
    raise SystemExit("source verification is not complete")
source_models = source_verification.get("models")
if not isinstance(source_models, list):
    raise SystemExit("source model list missing")
source_matches = [
    item
    for item in source_models
    if isinstance(item, dict)
    and item.get("model_id") == conversion["source_model_id"]
    and item.get("revision") == conversion["source_revision"]
]
if len(source_matches) != 1:
    raise SystemExit("exact source model and revision missing")

steps = report.get("steps")
if not isinstance(steps, list):
    raise SystemExit("conversion steps missing")
step_matches = [
    item
    for item in steps
    if isinstance(item, dict)
    and item.get("step_key") == conversion["required_step_key"]
]
if len(step_matches) != 1:
    raise SystemExit("exact Q4_K_M step missing")
step = step_matches[0]
if step.get("status") != conversion["required_step_status"]:
    raise SystemExit("Q4_K_M step is not complete")
if step.get("exit_code") != 0:
    raise SystemExit("Q4_K_M step exit code is not zero")
step_evidence = json.loads(step_report_path.read_text(encoding="utf-8"))
if step_evidence != step:
    raise SystemExit("Q4_K_M step file and report disagree")
step_output = step.get("output")
if not isinstance(step_output, dict):
    raise SystemExit("Q4_K_M step output missing")
if step_output.get("path") != conversion["output_path"]:
    raise SystemExit("Q4_K_M step output path mismatch")

outputs = report.get("outputs")
if not isinstance(outputs, list):
    raise SystemExit("conversion outputs missing")
records = [
    item
    for item in outputs
    if isinstance(item, dict)
    and item.get("path") == conversion["output_path"]
]
if len(records) != 1 or records[0] != step_output:
    raise SystemExit("Q4_K_M output is not bound to the complete step")
record = records[0]
if record.get("sha256") != conversion["model_sha256"]:
    raise SystemExit("Q4_K_M model digest is not accepted")
if record.get("size_bytes") != conversion["model_size_bytes"]:
    raise SystemExit("Q4_K_M model size is not accepted")
model_path = conversion_root / record["path"]
server_path = conversion_root / "toolchain/bin/llama-server"
for path in (model_path, server_path):
    if not path.is_file() or path.is_symlink():
        raise SystemExit("bound runtime file missing")
    if path.resolve(strict=True) != path:
        raise SystemExit("bound runtime file is not exact")


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            value.update(chunk)
    return value.hexdigest()


if model_path.stat().st_size != record["size_bytes"]:
    raise SystemExit("model size mismatch")
if digest(model_path) != record["sha256"]:
    raise SystemExit("model digest mismatch")
if server_path.stat().st_size != authority["toolchain"]["llama_server_size_bytes"]:
    raise SystemExit("llama-server size mismatch")
if digest(server_path) != authority["toolchain"]["llama_server_sha256"]:
    raise SystemExit("llama-server digest mismatch")
output = {
    "conversion_exact_main_sha": conversion["exact_main_sha"],
    "conversion_workflow_run_id": conversion["workflow_run_id"],
    "conversion_workflow_run_attempt": conversion["workflow_run_attempt"],
    "conversion_step_key": conversion["required_step_key"],
    "conversion_step_status": conversion["required_step_status"],
    "conversion_report_sha256": report_sha,
    "model_path": str(model_path),
    "model_sha256": record["sha256"],
    "model_size_bytes": record["size_bytes"],
    "llama_server_path": str(server_path),
}
output_path.write_text(
    json.dumps(output, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
)
PY

MODEL_PATH="$(jq -r '.model_path' "$RUN_ROOT/control/selected.json")"
LLAMA_SERVER="$(jq -r '.llama_server_path' "$RUN_ROOT/control/selected.json")"
THREADS="$(nproc)"
if (( THREADS > 14 )); then THREADS=14; fi
if (( THREADS < 2 )); then THREADS=2; fi

start_rss_guard() {
  rm -f "$RSS_PEAK_FILE" "$RSS_BREACH_FILE" "$RSS_READY_FILE"
  python3 - \
    "$SERVER_PID" \
    "$SERVER_PGID" \
    "$SERVER_START_TICKS" \
    "$MAX_RSS_BYTES" \
    "$RSS_PEAK_FILE" \
    "$RSS_BREACH_FILE" \
    "$RSS_READY_FILE" <<'RSS_GUARD_PY' &
import os
import signal
import sys
import time
from pathlib import Path

root_pid = int(sys.argv[1])
root_pgid = int(sys.argv[2])
root_start_ticks = int(sys.argv[3])
limit = int(sys.argv[4])
peak_path = Path(sys.argv[5])
breach_path = Path(sys.argv[6])
ready_path = Path(sys.argv[7])
page_size = os.sysconf("SC_PAGE_SIZE")


def read_stat(pid: int) -> tuple[str, int, int, int, int] | None:
    try:
        raw = Path(f"/proc/{pid}/stat").read_text(encoding="utf-8")
        fields = raw[raw.rfind(")") + 2 :].split()
        return (
            fields[0],
            int(fields[1]),
            int(fields[2]),
            int(fields[3]),
            int(fields[19]),
        )
    except (FileNotFoundError, IndexError, OSError, ValueError):
        return None


def read_process_table() -> dict[int, tuple[str, int, int, int, int]]:
    table: dict[int, tuple[str, int, int, int, int]] = {}
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        pid = int(entry.name)
        stat = read_stat(pid)
        if stat is not None:
            table[pid] = stat
    return table


def process_tree(table: dict[int, tuple[str, int, int, int, int]]) -> set[int]:
    root = table.get(root_pid)
    if root is None:
        return set()
    _, _, process_group, session_id, start_ticks = root
    if (
        process_group != root_pgid
        or session_id != root_pgid
        or start_ticks != root_start_ticks
    ):
        return set()
    live = {
        pid
        for pid, (_, _, candidate_group, _, _) in table.items()
        if candidate_group == root_pgid
    }
    changed = True
    while changed:
        changed = False
        for pid, (_, parent_pid, _, _, _) in table.items():
            if parent_pid in live and pid not in live:
                live.add(pid)
                changed = True
    return live


def rss_bytes(pid: int) -> int:
    try:
        fields = Path(f"/proc/{pid}/statm").read_text(encoding="utf-8").split()
        return int(fields[1]) * page_size
    except (FileNotFoundError, IndexError, OSError, ValueError):
        return 0


def atomic_write(path: Path, value: str) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(value + "\n", encoding="utf-8")
    os.replace(temporary, path)


def signal_tree(pids: set[int], signum: signal.Signals) -> None:
    if not pids:
        return
    try:
        os.killpg(root_pgid, signum)
    except ProcessLookupError:
        pass
    for pid in sorted(pids, reverse=True):
        try:
            os.kill(pid, signum)
        except ProcessLookupError:
            pass


peak = 1
try:
    initial = read_stat(root_pid)
    if initial is None:
        raise RuntimeError("root process missing")
    _, _, initial_pgid, initial_sid, initial_start = initial
    if (
        initial_pgid != root_pgid
        or initial_sid != root_pgid
        or initial_start != root_start_ticks
    ):
        raise RuntimeError("root identity mismatch")
    table = read_process_table()
    tracked = process_tree(table)
    observed = sum(rss_bytes(pid) for pid in tracked)
    peak = max(peak, observed)
    atomic_write(peak_path, str(peak))
    atomic_write(ready_path, "READY")
    while True:
        root = read_stat(root_pid)
        if root is None:
            atomic_write(peak_path, str(peak))
            raise SystemExit(0)
        _, _, process_group, session_id, start_ticks = root
        if (
            process_group != root_pgid
            or session_id != root_pgid
            or start_ticks != root_start_ticks
        ):
            raise RuntimeError("root identity changed")
        table = read_process_table()
        tracked = process_tree(table)
        observed = sum(rss_bytes(pid) for pid in tracked)
        peak = max(peak, observed)
        atomic_write(peak_path, str(peak))
        if observed > limit:
            atomic_write(breach_path, f"memory_limit_exceeded:{observed}")
            signal_tree(tracked, signal.SIGTERM)
            time.sleep(2)
            signal_tree(tracked, signal.SIGKILL)
            raise SystemExit(97)
        time.sleep(0.05)
except SystemExit:
    raise
except Exception as exc:
    atomic_write(breach_path, f"rss_guard_failed:{type(exc).__name__}")
    table = read_process_table()
    signal_tree(process_tree(table), signal.SIGTERM)
    time.sleep(1)
    signal_tree(process_tree(read_process_table()), signal.SIGKILL)
    raise
RSS_GUARD_PY
  RSS_GUARD_PID=$!
}

rss_guard_healthy() {
  [[ -n "$RSS_GUARD_PID" ]] \
    && kill -0 "$RSS_GUARD_PID" 2>/dev/null \
    && [[ ! -e "$RSS_BREACH_FILE" ]]
}

START_NS="$(date +%s%N)"
python3 - "$LLAMA_SERVER" "$MODEL_PATH" "$HOST" "$PORT" "$THREADS" \
  >"$RAW_ROOT/llama-server.log" 2>&1 <<'SERVER_LAUNCH_PY' &
import os
import signal
import sys

server, model, host, port, threads = sys.argv[1:]
os.setsid()
os.kill(os.getpid(), signal.SIGSTOP)
os.execv(
    server,
    [
        server,
        "-m",
        model,
        "--host",
        host,
        "--port",
        port,
        "--ctx-size",
        "4096",
        "--threads",
        threads,
        "--parallel",
        "1",
    ],
)
SERVER_LAUNCH_PY
SERVER_PID=$!
SERVER_IDENTITY=""
for _ in $(seq 1 100); do
  if SERVER_IDENTITY="$(python3 - "$SERVER_PID" <<'PY'
import sys
from pathlib import Path

pid = int(sys.argv[1])
try:
    raw = Path(f"/proc/{pid}/stat").read_text(encoding="utf-8")
    fields = raw[raw.rfind(")") + 2 :].split()
    state = fields[0]
    process_group = int(fields[2])
    session_id = int(fields[3])
    start_ticks = int(fields[19])
except (FileNotFoundError, IndexError, OSError, ValueError):
    raise SystemExit(1)
if state != "T" or process_group != pid or session_id != pid:
    raise SystemExit(1)
print(f"{process_group} {start_ticks}")
PY
  )"; then
    break
  fi
  kill -0 "$SERVER_PID" 2>/dev/null || die server_launcher_exited
  sleep 0.05
done
read -r SERVER_PGID SERVER_START_TICKS <<<"$SERVER_IDENTITY"
[[ "$SERVER_PGID" == "$SERVER_PID" ]] || die server_process_group_invalid
[[ "$SERVER_START_TICKS" =~ ^[1-9][0-9]*$ ]] || die server_start_time_invalid
start_rss_guard
for _ in $(seq 1 100); do
  [[ -s "$RSS_READY_FILE" ]] && break
  [[ ! -e "$RSS_BREACH_FILE" ]] || die rss_guard_failed_before_resume
  kill -0 "$RSS_GUARD_PID" 2>/dev/null || die rss_guard_exited_before_resume
  sleep 0.05
done
[[ "$(<"$RSS_READY_FILE")" == "READY" ]] || die rss_guard_not_ready
kill -CONT -- "-$SERVER_PGID"

READY=false
for _ in $(seq 1 180); do
  [[ ! -e "$RSS_BREACH_FILE" ]] || die memory_limit_exceeded
  rss_guard_healthy || die rss_guard_failed_before_ready
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    die server_exited_before_ready
  fi
  if curl --fail --silent --show-error --max-time 2 "http://$HOST:$PORT/health" >"$RAW_ROOT/health.json" 2>/dev/null; then
    READY=true
    break
  fi
  sleep 1
done
[[ "$READY" == true ]] || die readiness_timeout
listener_present || die loopback_listener_missing
if ss -H -ltn "sport = :$PORT" | grep -Ev "127\.0\.0\.1:$PORT|\[::ffff:127\.0\.0\.1\]:$PORT" | grep -q .; then
  die public_listener_detected
fi
STARTUP_MS="$(( ($(date +%s%N) - START_NS) / 1000000 ))"
(( STARTUP_MS > 0 && STARTUP_MS <= 180000 )) || die startup_limit_exceeded

cat >"$RAW_ROOT/prompts.tsv" <<'EOF'
RU	Ответь одним коротким предложением на русском языке: что такое платформа «Прозрачная Цена»? Не используй инструменты и не придумывай факты.
EN	Answer in one short English sentence: what is the Transparent Price platform? Do not use tools or invent facts.
ZH	请用一句简短的中文回答：什么是“透明价格”平台？不要使用工具，也不要编造事实。
EOF

: >"$EVIDENCE_ROOT/smoke.jsonl"
while IFS=$'\t' read -r LANGUAGE PROMPT; do
  PROMPT_FILE="$RAW_ROOT/prompt-$LANGUAGE.txt"
  REQUEST_FILE="$RAW_ROOT/request-$LANGUAGE.json"
  RESPONSE_FILE="$RAW_ROOT/response-$LANGUAGE.json"
  printf '%s' "$PROMPT" >"$PROMPT_FILE"
  python3 - "$PROMPT_FILE" "$REQUEST_FILE" <<'PY'
import json
import sys
from pathlib import Path

prompt = Path(sys.argv[1]).read_text(encoding="utf-8")
payload = {
    "model": "qwen3-8b-q4-k-m",
    "messages": [
        {"role": "system", "content": "Return only the requested answer. Do not expose reasoning."},
        {"role": "user", "content": prompt},
    ],
    "temperature": 0,
    "top_p": 1,
    "seed": 42,
    "max_tokens": 128,
    "stream": False,
    "chat_template_kwargs": {"enable_thinking": False},
}
Path(sys.argv[2]).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
PY
  REQUEST_START="$(date +%s%N)"
  set +e
  HTTP_STATUS="$(curl --silent --show-error --max-time 120 \
    --output "$RESPONSE_FILE" --write-out '%{http_code}' \
    -H 'Content-Type: application/json' --data-binary "@$REQUEST_FILE" \
    "http://$HOST:$PORT/v1/chat/completions")"
  CURL_STATUS=$?
  set -e
  ELAPSED_MS="$(( ($(date +%s%N) - REQUEST_START) / 1000000 ))"
  [[ ! -e "$RSS_BREACH_FILE" ]] || die memory_limit_exceeded
  rss_guard_healthy || die rss_guard_failed_during_smoke
  (( CURL_STATUS == 0 )) || die "smoke_transport_$LANGUAGE"
  [[ "$HTTP_STATUS" == 200 ]] || die "smoke_http_$LANGUAGE"
  python3 - "$LANGUAGE" "$PROMPT_FILE" "$RESPONSE_FILE" "$ELAPSED_MS" "$HTTP_STATUS" >>"$EVIDENCE_ROOT/smoke.jsonl" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

language, prompt_path, response_path, elapsed, status = sys.argv[1:]
prompt = Path(prompt_path).read_text(encoding="utf-8")
body = json.loads(Path(response_path).read_text(encoding="utf-8"))
content = body["choices"][0]["message"]["content"]
assert isinstance(content, str) and content.strip()
usage = body["usage"]
prompt_tokens = int(usage["prompt_tokens"])
completion_tokens = int(usage["completion_tokens"])
total_tokens = int(usage["total_tokens"])
assert prompt_tokens > 0 and 0 < completion_tokens <= 128
assert total_tokens == prompt_tokens + completion_tokens
record = {
    "language": language,
    "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
    "response_sha256": hashlib.sha256(content.encode()).hexdigest(),
    "elapsed_ms": int(elapsed),
    "http_status": int(status),
    "prompt_tokens": prompt_tokens,
    "completion_tokens": completion_tokens,
    "total_tokens": total_tokens,
    "response_bytes": len(content.encode()),
}
print(json.dumps(record, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
PY
  [[ ! -e "$RSS_BREACH_FILE" ]] || die memory_limit_exceeded
  rss_guard_healthy || die rss_guard_failed_after_smoke
  (( ELAPSED_MS > 0 && ELAPSED_MS <= 120000 )) || die request_timeout_exceeded
done <"$RAW_ROOT/prompts.tsv"

stop_server
stop_rss_guard
[[ ! -e "$RSS_BREACH_FILE" ]] || die memory_limit_exceeded
[[ -s "$RSS_PEAK_FILE" ]] || die rss_peak_missing
PEAK_RSS="$(<"$RSS_PEAK_FILE")"
[[ "$PEAK_RSS" =~ ^[1-9][0-9]*$ ]] || die rss_peak_invalid
(( PEAK_RSS <= MAX_RSS_BYTES )) || die memory_limit_exceeded
rm -rf "$RAW_ROOT"
listener_present && die listener_cleanup_failed

python3 - "$AUTHORITY" "$RUN_ROOT/control/selected.json" "$EVIDENCE_ROOT/smoke.jsonl" "$EVIDENCE_ROOT/qwen-preview-runtime-evidence.json" "$EXACT_MAIN" "$WORKFLOW_RUN_ID" "$WORKFLOW_RUN_ATTEMPT" "$STARTUP_MS" "$PEAK_RSS" <<'PY'
import hashlib
import json
import socket
import sys
from datetime import datetime, timezone
from pathlib import Path

authority_path, selected_path, smoke_path, output_path = map(Path, sys.argv[1:5])
exact_main, run_id, run_attempt, startup_ms, peak_rss = sys.argv[5:]
authority = json.loads(authority_path.read_text(encoding="utf-8"))
selected = json.loads(selected_path.read_text(encoding="utf-8"))
smoke = [json.loads(line) for line in smoke_path.read_text(encoding="utf-8").splitlines()]
payload = {
    "schema_version": "tai.qwen-preview-runtime-evidence.v1",
    "status": "READ_ONLY_OPERATIONAL_PREVIEW_PENDING_EXTERNAL_IMMUTABILITY",
    "accepted": True,
    "exact_main_sha": exact_main,
    "authority_sha256": authority["authority_sha256"],
    "executed_at": datetime.now(timezone.utc).isoformat(),
    "workflow": {"run_id": int(run_id), "run_attempt": int(run_attempt)},
    "host": {
        "role": authority["target"]["host_role"],
        "user": authority["target"]["required_user"],
        "workspace_root": authority["target"]["workspace_root"],
        "hostname_sha256": hashlib.sha256(socket.gethostname().encode()).hexdigest(),
        "listen_host": authority["target"]["listen_host"],
        "listen_port": authority["target"]["listen_port"],
        "listener_before": False,
        "listener_during": True,
        "listener_after": False,
        "public_listener": False,
    },
    "model": {
        "model_id": authority["model"]["model_id"],
        "revision": authority["model"]["revision"],
        "quantization": authority["model"]["quantization"],
        "path_label": authority["model"]["conversion_output_path"],
        "sha256": selected["model_sha256"],
        "size_bytes": selected["model_size_bytes"],
        "conversion_report_sha256": selected["conversion_report_sha256"],
        "conversion_status": authority["model"]["required_conversion_status"],
    },
    "toolchain": authority["toolchain"],
    "limits": authority["limits"],
    "runtime": {
        "health_status": "READY",
        "startup_ms": int(startup_ms),
        "peak_rss_bytes": int(peak_rss),
        "active_requests": 1,
        "queued_requests": 0,
    },
    "smoke": smoke,
    "cleanup": {
        "raw_deleted": True,
        "process_stopped": True,
        "listener_removed": True,
        "rollback_verified": True,
    },
    "maturity_boundary": authority["maturity_boundary"],
    "reasons": [],
}
rendered = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
payload["evidence_sha256"] = hashlib.sha256(rendered.encode()).hexdigest()
output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY

trap - EXIT INT TERM ERR
printf '%s\n' 'READ_ONLY_OPERATIONAL_PREVIEW_PENDING_EXTERNAL_IMMUTABILITY'
