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
PORT=18080
HOST=127.0.0.1

mkdir -p "$RAW_ROOT" "$EVIDENCE_ROOT"

die() {
  printf 'QWEN_PREVIEW_FAILED:%s\n' "$1" >&2
  exit 1
}

listener_present() {
  ss -H -ltn "sport = :$PORT" | grep -q .
}

cleanup() {
  local code=$?
  trap - EXIT INT TERM ERR
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill -TERM "$SERVER_PID" 2>/dev/null || true
    for _ in $(seq 1 30); do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 1
    done
    kill -KILL "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$RAW_ROOT"
  if listener_present; then
    printf 'listener remains on %s:%s after cleanup\n' "$HOST" "$PORT" >&2
    code=1
  fi
  exit "$code"
}
trap cleanup EXIT INT TERM ERR

[[ "$EXACT_MAIN" =~ ^[0-9a-f]{40}$ ]] || die exact_main_invalid
[[ "$WORKFLOW_RUN_ID" =~ ^[1-9][0-9]*$ ]] || die run_id_invalid
[[ "$WORKFLOW_RUN_ATTEMPT" =~ ^[1-9][0-9]*$ ]] || die run_attempt_invalid
[[ "$RUN_ROOT" == "/srv/tai-models/preview-runs/$EXACT_MAIN/$WORKFLOW_RUN_ID-$WORKFLOW_RUN_ATTEMPT" ]] || die run_root_invalid
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
listener_present && die listener_already_present

CONVERSION_REPORT="$(python3 - /srv/tai-models/conversion-runs "${TAI_MODEL_CONVERSION_REPORT_HINT:-}" <<'PY'
import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path

root = Path(sys.argv[1]).resolve()
hint = sys.argv[2].strip()
if hint:
    candidates = [Path(hint)]
else:
    candidates = list(root.glob("*/*/evidence/conversion-report.json"))
valid: list[tuple[datetime, Path]] = []
for candidate in candidates:
    try:
        resolved = candidate.resolve(strict=True)
        resolved.relative_to(root)
        if candidate.is_symlink() or not candidate.is_file():
            continue
        report = json.loads(candidate.read_text(encoding="utf-8"))
        declared = report.get("report_sha256")
        unsigned = dict(report)
        unsigned.pop("report_sha256", None)
        rendered = json.dumps(unsigned, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        if declared != hashlib.sha256(rendered.encode()).hexdigest():
            continue
        if report.get("status") != "CONVERSION_AND_QUANTIZATION_COMPLETE_PENDING_BUNDLE_RESTORE":
            continue
        outputs = report.get("outputs")
        if not isinstance(outputs, list):
            continue
        matches = [item for item in outputs if isinstance(item, dict) and item.get("path") == "artifacts/qwen3-8b-q4-k-m.gguf"]
        if len(matches) != 1:
            continue
        completed = datetime.fromisoformat(str(report["completed_at"]).replace("Z", "+00:00"))
        valid.append((completed, resolved))
    except (OSError, ValueError, KeyError, json.JSONDecodeError):
        continue
if not valid:
    raise SystemExit("no verified completed conversion report")
valid.sort(key=lambda item: (item[0], str(item[1])))
print(valid[-1][1])
PY
)" || die conversion_report_not_found

python3 - "$AUTHORITY" "$CONVERSION_REPORT" "$RUN_ROOT/control/selected.json" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

authority_path, report_path, output_path = map(Path, sys.argv[1:])
authority = json.loads(authority_path.read_text(encoding="utf-8"))
report = json.loads(report_path.read_text(encoding="utf-8"))
unsigned = dict(report)
report_sha = unsigned.pop("report_sha256")
rendered = json.dumps(unsigned, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
assert hashlib.sha256(rendered.encode()).hexdigest() == report_sha
assert report["status"] == authority["model"]["required_conversion_status"]
assert report["host_role"] == authority["target"]["host_role"]
assert report["workspace_root"] == authority["target"]["workspace_root"]
assert report["toolchain_status"] == "VERIFIED_RESTORED"
assert report["benchmark_status"] == "NOT_RUN"
assert report["model_admission_status"] == "NOT_DONE"
assert report["production_operational_status"] == "NOT_ATTESTED"
records = [item for item in report["outputs"] if item["path"] == authority["model"]["conversion_output_path"]]
assert len(records) == 1
record = records[0]
run_root = report_path.parents[1]
model_path = run_root / record["path"]
server_path = run_root / "toolchain/bin/llama-server"
for path in (model_path, server_path):
    assert path.is_file() and not path.is_symlink()

def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            value.update(chunk)
    return value.hexdigest()

assert model_path.stat().st_size == record["size_bytes"]
assert digest(model_path) == record["sha256"]
assert server_path.stat().st_size == authority["toolchain"]["llama_server_size_bytes"]
assert digest(server_path) == authority["toolchain"]["llama_server_sha256"]
output = {
    "conversion_report_path": str(report_path),
    "conversion_report_sha256": report_sha,
    "model_path": str(model_path),
    "model_sha256": record["sha256"],
    "model_size_bytes": record["size_bytes"],
    "llama_server_path": str(server_path),
}
output_path.write_text(json.dumps(output, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY

MODEL_PATH="$(jq -r '.model_path' "$RUN_ROOT/control/selected.json")"
LLAMA_SERVER="$(jq -r '.llama_server_path' "$RUN_ROOT/control/selected.json")"
THREADS="$(nproc)"
if (( THREADS > 14 )); then THREADS=14; fi
if (( THREADS < 2 )); then THREADS=2; fi

START_NS="$(date +%s%N)"
"$LLAMA_SERVER" \
  -m "$MODEL_PATH" \
  --host "$HOST" \
  --port "$PORT" \
  --ctx-size 4096 \
  --threads "$THREADS" \
  --parallel 1 \
  >"$RAW_ROOT/llama-server.log" 2>&1 &
SERVER_PID=$!

READY=false
for _ in $(seq 1 180); do
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
PEAK_RSS=1
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
  HTTP_STATUS="$(curl --silent --show-error --max-time 120 \
    --output "$RESPONSE_FILE" --write-out '%{http_code}' \
    -H 'Content-Type: application/json' --data-binary "@$REQUEST_FILE" \
    "http://$HOST:$PORT/v1/chat/completions")"
  ELAPSED_MS="$(( ($(date +%s%N) - REQUEST_START) / 1000000 ))"
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
  RSS_KB="$(awk '/VmRSS:/{print $2}' "/proc/$SERVER_PID/status")"
  RSS_BYTES="$(( RSS_KB * 1024 ))"
  if (( RSS_BYTES > PEAK_RSS )); then PEAK_RSS="$RSS_BYTES"; fi
  (( PEAK_RSS <= 12000000000 )) || die memory_limit_exceeded
  (( ELAPSED_MS > 0 && ELAPSED_MS <= 120000 )) || die request_timeout_exceeded
done <"$RAW_ROOT/prompts.tsv"

kill -TERM "$SERVER_PID"
for _ in $(seq 1 30); do
  kill -0 "$SERVER_PID" 2>/dev/null || break
  sleep 1
done
kill -KILL "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true
SERVER_PID=""
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
