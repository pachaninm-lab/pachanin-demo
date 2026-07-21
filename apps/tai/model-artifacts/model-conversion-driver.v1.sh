#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RUN_ROOT="${1:?run root is required}"
CONTROL_ROOT="$RUN_ROOT/control"
AUTHORITY="$CONTROL_ROOT/model-conversion-authority.v1.json"
EVIDENCE_ROOT="$RUN_ROOT/evidence"
LOG_ROOT="$RUN_ROOT/logs"
STATUS_PATH="$RUN_ROOT/status.json"
DRIVER_LOG="$RUN_ROOT/driver.log"
LOCK_PATH="$RUN_ROOT/.conversion.lock"

mkdir -p "$EVIDENCE_ROOT/steps" "$LOG_ROOT" "$RUN_ROOT/artifacts/quarantine"
exec > >(tee -a "$DRIVER_LOG") 2>&1
exec 9>"$LOCK_PATH"
flock -n 9 || { echo 'another conversion driver holds the run lock' >&2; exit 73; }

write_status() {
  local state="$1"
  local reason="${2:-}"
  STATE="$state" REASON="$reason" STATUS_PATH="$STATUS_PATH" python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

payload = {
    "schema_version": "tai.model-conversion-remote-status.v1",
    "state": os.environ["STATE"],
    "reason": os.environ.get("REASON", ""),
    "updated_at": datetime.now(timezone.utc).isoformat(),
}
Path(os.environ["STATUS_PATH"]).write_text(
    json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
)
PY
}

failure() {
  local code=$?
  trap - ERR
  write_status FAILED_CLOSED "driver_exit_${code}"
  echo "conversion driver failed with exit code $code" >&2
  exit "$code"
}
trap failure ERR

write_status RUNNING

test -f "$AUTHORITY"
test "$(id -un)" = 'tai-model'
test "$(uname -s)" = 'Linux'
test "$(uname -m)" = 'x86_64'

ROOT_SOURCE="$(findmnt -rn -o SOURCE -T /)"
WORKSPACE_SOURCE="$(findmnt -rn -o SOURCE -T /srv/tai-models)"
test -n "$WORKSPACE_SOURCE"
test "$WORKSPACE_SOURCE" != "$ROOT_SOURCE"
test "$(nproc)" -ge 16
MEM_TOTAL="$(awk '/MemTotal:/{printf "%.0f", $2 * 1024}' /proc/meminfo)"
SWAP_TOTAL="$(awk '/SwapTotal:/{printf "%.0f", $2 * 1024}' /proc/meminfo)"
WORKSPACE_AVAILABLE="$(df -P -B1 /srv/tai-models | awk 'NR==2{print $4}')"
test "$MEM_TOTAL" -ge 15000000000
test "$SWAP_TOTAL" -ge 15000000000
test "$WORKSPACE_AVAILABLE" -ge 140000000000

for command_name in curl flock gzip sha256sum tar python3 stat findmnt; do
  command -v "$command_name" >/dev/null
done

EXACT_MAIN_SHA="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["execution"]["exact_main_sha"])' "$AUTHORITY")"
RUN_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["execution"]["workflow_run_id"])' "$AUTHORITY")"
RUN_ATTEMPT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["execution"]["workflow_run_attempt"])' "$AUTHORITY")"
test "$RUN_ROOT" = "/srv/tai-models/conversion-runs/$EXACT_MAIN_SHA/$RUN_ID-$RUN_ATTEMPT"

TOOLCHAIN_ARCHIVE="$CONTROL_ROOT/toolchain/llama-cpp-b9637-evidence.tar.gz"
TOOLCHAIN_EXPECTED_SHA="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["toolchain_acceptance"]["package_sha256"])' "$AUTHORITY")"
TOOLCHAIN_EXPECTED_SIZE="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["toolchain_acceptance"]["package_size_bytes"])' "$AUTHORITY")"
test "$(stat -c %s "$TOOLCHAIN_ARCHIVE")" = "$TOOLCHAIN_EXPECTED_SIZE"
test "$(sha256sum "$TOOLCHAIN_ARCHIVE" | awk '{print $1}')" = "$TOOLCHAIN_EXPECTED_SHA"
if tar -tzf "$TOOLCHAIN_ARCHIVE" | grep -E '(^/|(^|/)\.\.(/|$))'; then
  echo 'unsafe path in accepted toolchain archive' >&2
  exit 1
fi

TOOLCHAIN_RESTORE="$RUN_ROOT/toolchain/restore"
if [[ ! -f "$TOOLCHAIN_RESTORE/.verified" ]]; then
  mkdir -p "$TOOLCHAIN_RESTORE"
  tar -xzf "$TOOLCHAIN_ARCHIVE" -C "$TOOLCHAIN_RESTORE"
fi
LLAMA_ROOT="$TOOLCHAIN_RESTORE/llama-evidence"
CONVERTER_SOURCE="$LLAMA_ROOT/source/llama.cpp/convert_hf_to_gguf.py"
REQ_MAIN="$LLAMA_ROOT/source/llama.cpp/requirements/requirements-convert_hf_to_gguf.txt"
REQ_LEGACY="$LLAMA_ROOT/source/llama.cpp/requirements/requirements-convert_legacy_llama.txt"
BIN_SOURCE="$LLAMA_ROOT/build/llama.cpp-b9637/bin"

verify_bound_file() {
  local path="$1" expected_sha="$2" expected_size="$3"
  test -f "$path"
  test ! -L "$path"
  test "$(stat -c %s "$path")" = "$expected_size"
  test "$(sha256sum "$path" | awk '{print $1}')" = "$expected_sha"
}

CONVERTER_SHA="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["toolchain_acceptance"]["converter"]["sha256"])' "$AUTHORITY")"
CONVERTER_SIZE="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["toolchain_acceptance"]["converter"]["size_bytes"])' "$AUTHORITY")"
verify_bound_file "$CONVERTER_SOURCE" "$CONVERTER_SHA" "$CONVERTER_SIZE"
verify_bound_file "$REQ_MAIN" 'd6ee53814f8069932540c3c06f03121914098b3485c7a48bb7baa4e6358943d8' 397
verify_bound_file "$REQ_LEGACY" '64e5b8f1be7f0e88b79ec24e10cfc9defe5f3c061f730a3e2f88423e152f5bc0' 102
verify_bound_file "$BIN_SOURCE/llama-cli" '1f97b492e7739ec9e10b9a7da5317a27b70845873d060b7ede2c2d2f3e92f849' 12399720
verify_bound_file "$BIN_SOURCE/llama-server" '1b26384ad90d9ae8fe65b2a3e2dfd08c70d92663b2127d5f479f34774b4a6dbf' 12940416
verify_bound_file "$BIN_SOURCE/llama-quantize" '77ae93aca41abd98f6b1e63478c09de77ab558d11d6cea6f1f53949310920e20' 5616560
verify_bound_file "$BIN_SOURCE/llama-bench" 'eac9d7ee5e75a84668755caf44a09d3e1c5907d2b88fab205c27ad1e57bef335' 10023592

mkdir -p "$RUN_ROOT/toolchain/bin" "$RUN_ROOT/toolchain/source" "$RUN_ROOT/toolchain/requirements"
install -m 700 "$CONVERTER_SOURCE" "$RUN_ROOT/toolchain/source/convert_hf_to_gguf.py"
install -m 700 "$BIN_SOURCE/llama-cli" "$RUN_ROOT/toolchain/bin/llama-cli"
install -m 700 "$BIN_SOURCE/llama-server" "$RUN_ROOT/toolchain/bin/llama-server"
install -m 700 "$BIN_SOURCE/llama-quantize" "$RUN_ROOT/toolchain/bin/llama-quantize"
install -m 700 "$BIN_SOURCE/llama-bench" "$RUN_ROOT/toolchain/bin/llama-bench"
install -m 600 "$REQ_MAIN" "$RUN_ROOT/toolchain/requirements/requirements-convert_hf_to_gguf.txt"
install -m 600 "$REQ_LEGACY" "$RUN_ROOT/toolchain/requirements/requirements-convert_legacy_llama.txt"
touch "$TOOLCHAIN_RESTORE/.verified"

python3 - "$AUTHORITY" "$CONTROL_ROOT" "$RUN_ROOT" <<'PY'
import hashlib
import json
import sys
from pathlib import Path, PurePosixPath

authority_path, control_root_raw, run_root_raw = map(Path, sys.argv[1:])
authority = json.loads(authority_path.read_text())
control_root = control_root_raw.resolve()
run_root = run_root_raw.resolve()


def canonical(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def digest(value: object) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


for model in authority["models"]:
    metadata_root = control_root / "source-metadata" / model["key"]
    manifest = json.loads((metadata_root / "source-manifest.json").read_text())
    plan = json.loads((metadata_root / "download-plan.json").read_text())
    report = json.loads((metadata_root / "acquisition-report.json").read_text())
    assert manifest["model_id"] == model["model_id"]
    assert manifest["revision"] == model["revision"]
    assert manifest["source_files_sha256"] == model["source_files_sha256"]
    assert digest(manifest) == model["source_manifest_sha256"]
    assert report["source_manifest_sha256"] == model["source_manifest_sha256"]
    assert report["source_files_sha256"] == model["source_files_sha256"]
    by_path = {entry["path"]: entry for entry in plan["entries"]}
    files = manifest["files"]
    assert set(by_path) == {item["path"] for item in files}
    output = run_root / "evidence" / f"{model['key']}-download.tsv"
    lines = []
    for item in files:
        relative = item["path"]
        parts = PurePosixPath(relative).parts
        assert parts and parts[0] == "sources" and ".." not in parts
        planned = by_path[relative]
        assert planned["size_bytes"] == item["size_bytes"]
        values = [relative, planned["download_uri"], str(item["size_bytes"]), item["sha256"]]
        assert all("\t" not in value and "\n" not in value for value in values)
        lines.append("\t".join(values))
    output.write_text("\n".join(lines) + "\n")
PY

for plan in "$EVIDENCE_ROOT"/*-download.tsv; do
  while IFS=$'\t' read -r relative_path uri expected_size expected_sha; do
    target="$RUN_ROOT/$relative_path"
    partial="${target}.partial"
    mkdir -p "$(dirname "$target")"
    if [[ -f "$target" ]] \
      && [[ "$(stat -c %s "$target")" = "$expected_size" ]] \
      && [[ "$(sha256sum "$target" | awk '{print $1}')" = "$expected_sha" ]]; then
      printf 'SOURCE_REUSE\t%s\n' "$relative_path"
      continue
    fi
    if [[ -f "$target" ]]; then
      mv "$target" "$RUN_ROOT/artifacts/quarantine/$(basename "$target").$(date -u +%Y%m%dT%H%M%SZ)"
    fi
    printf 'SOURCE_START\t%s\t%s\n' "$relative_path" "$expected_size"
    curl --fail --silent --show-error --location \
      --proto '=https' --tlsv1.2 \
      --retry 20 --retry-all-errors --retry-delay 5 \
      --connect-timeout 30 --max-time 14400 \
      --continue-at - --output "$partial" "$uri"
    test "$(stat -c %s "$partial")" = "$expected_size"
    test "$(sha256sum "$partial" | awk '{print $1}')" = "$expected_sha"
    mv "$partial" "$target"
    printf 'SOURCE_DONE\t%s\t%s\n' "$relative_path" "$expected_size"
  done < "$plan"
done

python3 - "$AUTHORITY" "$CONTROL_ROOT" "$RUN_ROOT" <<'PY'
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

authority_path, control_root, run_root = map(Path, sys.argv[1:])
authority = json.loads(authority_path.read_text())
verified_models = []
for model in authority["models"]:
    metadata = control_root / "source-metadata" / model["key"]
    manifest = json.loads((metadata / "source-manifest.json").read_text())
    verified = []
    for item in manifest["files"]:
        path = run_root / item["path"]
        assert path.is_file() and not path.is_symlink()
        assert path.stat().st_size == item["size_bytes"]
        value = hashlib.sha256()
        with path.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                value.update(chunk)
        assert value.hexdigest() == item["sha256"]
        verified.append(item["path"])
    verified_models.append(
        {
            "model_id": model["model_id"],
            "revision": model["revision"],
            "source_files_sha256": model["source_files_sha256"],
            "source_manifest_sha256": model["source_manifest_sha256"],
            "verified_files": verified,
        }
    )
payload = {
    "schema_version": "tai.model-conversion-source-verification.v1",
    "status": "VERIFIED",
    "verified_at": datetime.now(timezone.utc).isoformat(),
    "models": verified_models,
    "reasons": [],
}
(run_root / "evidence" / "source-verification.json").write_text(
    json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
)
PY

VENV="$RUN_ROOT/conversion/venv"
mkdir -p "$RUN_ROOT/conversion"
if [[ ! -x "$VENV/bin/python3" ]]; then
  python3 -m venv "$VENV"
fi
"$VENV/bin/python3" -m pip install --upgrade pip
(
  cd "$RUN_ROOT/toolchain/requirements"
  "$VENV/bin/python3" -m pip install -r requirements-convert_hf_to_gguf.txt
)
"$VENV/bin/python3" -m pip freeze --all | LC_ALL=C sort > "$EVIDENCE_ROOT/python-dependencies.txt"
"$VENV/bin/python3" --version > "$EVIDENCE_ROOT/python-version.txt" 2>&1
"$VENV/bin/python3" -m pip --version > "$EVIDENCE_ROOT/pip-version.txt"

run_authority_step() {
  local step_key="$1" output_relative="$2"
  shift 2
  local step_record="$EVIDENCE_ROOT/steps/$step_key.json"
  local output="$RUN_ROOT/$output_relative"
  if [[ -f "$step_record" && -f "$output" ]]; then
    if STEP_RECORD="$step_record" OUTPUT_PATH="$output" python3 - <<'PY'
import hashlib
import json
import os
from pathlib import Path

record = json.loads(Path(os.environ["STEP_RECORD"]).read_text())
output = Path(os.environ["OUTPUT_PATH"])
assert record["status"] == "COMPLETE"
assert record["output"]["size_bytes"] == output.stat().st_size
value = hashlib.sha256()
with output.open("rb") as stream:
    while chunk := stream.read(1024 * 1024):
        value.update(chunk)
assert record["output"]["sha256"] == value.hexdigest()
PY
    then
      echo "STEP_REUSE $step_key"
      return
    fi
  fi
  if [[ -f "$output" ]]; then
    mv "$output" "$RUN_ROOT/artifacts/quarantine/$(basename "$output").$(date -u +%Y%m%dT%H%M%SZ)"
  fi
  mkdir -p "$(dirname "$output")"
  local log_path="$LOG_ROOT/$step_key.log"
  local argv_path="$EVIDENCE_ROOT/steps/$step_key.argv.json"
  python3 - "$argv_path" "$@" <<'PY'
import json
import sys
from pathlib import Path

Path(sys.argv[1]).write_text(json.dumps(sys.argv[2:], ensure_ascii=False, indent=2) + "\n")
PY
  local started_at completed_at exit_code
  started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  set +e
  (
    cd "$RUN_ROOT"
    PYTHONPATH="$LLAMA_ROOT/source/llama.cpp:$LLAMA_ROOT/source/llama.cpp/gguf-py" PATH="$VENV/bin:$PATH" timeout --signal=TERM --kill-after=120 21600 "$@"
  ) >"$log_path" 2>&1
  exit_code=$?
  set -e
  completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [[ "$exit_code" -ne 0 ]]; then
    STEP_KEY="$step_key" STARTED_AT="$started_at" COMPLETED_AT="$completed_at" EXIT_CODE="$exit_code" LOG_PATH="$log_path" RECORD_PATH="$step_record" python3 - <<'PY'
import hashlib
import json
import os
from pathlib import Path

log = Path(os.environ["LOG_PATH"])
payload = {
    "schema_version": "tai.model-conversion-step.v1",
    "step_key": os.environ["STEP_KEY"],
    "status": "FAILED_CLOSED",
    "started_at": os.environ["STARTED_AT"],
    "completed_at": os.environ["COMPLETED_AT"],
    "exit_code": int(os.environ["EXIT_CODE"]),
    "log": {
        "path": str(log),
        "size_bytes": log.stat().st_size,
        "sha256": hashlib.sha256(log.read_bytes()).hexdigest(),
    },
}
Path(os.environ["RECORD_PATH"]).write_text(
    json.dumps(payload, indent=2, sort_keys=True) + "\n"
)
PY
    return "$exit_code"
  fi
  test -s "$output"
  STEP_KEY="$step_key" STARTED_AT="$started_at" COMPLETED_AT="$completed_at" EXIT_CODE="$exit_code" LOG_PATH="$log_path" RECORD_PATH="$step_record" OUTPUT_PATH="$output" OUTPUT_RELATIVE="$output_relative" ARGV_PATH="$argv_path" python3 - <<'PY'
import hashlib
import json
import os
from pathlib import Path


def declared(path: Path, label: str) -> dict[str, object]:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            value.update(chunk)
    return {"path": label, "size_bytes": path.stat().st_size, "sha256": value.hexdigest()}


log = Path(os.environ["LOG_PATH"])
output = Path(os.environ["OUTPUT_PATH"])
payload = {
    "schema_version": "tai.model-conversion-step.v1",
    "step_key": os.environ["STEP_KEY"],
    "status": "COMPLETE",
    "started_at": os.environ["STARTED_AT"],
    "completed_at": os.environ["COMPLETED_AT"],
    "exit_code": int(os.environ["EXIT_CODE"]),
    "argv": json.loads(Path(os.environ["ARGV_PATH"]).read_text()),
    "log": declared(log, str(log)),
    "output": declared(output, os.environ["OUTPUT_RELATIVE"]),
}
Path(os.environ["RECORD_PATH"]).write_text(
    json.dumps(payload, indent=2, sort_keys=True) + "\n"
)
PY
}

mapfile -t QWEN_CONVERT < <(python3 -c 'import json,sys; a=json.load(open(sys.argv[1])); print("\n".join(a["models"][0]["conversion_argv"]))' "$AUTHORITY")
mapfile -t QWEN_Q4 < <(python3 -c 'import json,sys; a=json.load(open(sys.argv[1])); print("\n".join(a["models"][0]["quantizations"][0]["argv"]))' "$AUTHORITY")
mapfile -t QWEN_Q8 < <(python3 -c 'import json,sys; a=json.load(open(sys.argv[1])); print("\n".join(a["models"][0]["quantizations"][1]["argv"]))' "$AUTHORITY")
mapfile -t MISTRAL_CONVERT < <(python3 -c 'import json,sys; a=json.load(open(sys.argv[1])); print("\n".join(a["models"][1]["conversion_argv"]))' "$AUTHORITY")
mapfile -t MISTRAL_Q4 < <(python3 -c 'import json,sys; a=json.load(open(sys.argv[1])); print("\n".join(a["models"][1]["quantizations"][0]["argv"]))' "$AUTHORITY")

run_authority_step qwen3-8b-convert artifacts/qwen3-8b-bf16.gguf "${QWEN_CONVERT[@]}"
run_authority_step qwen3-8b-q4-k-m artifacts/qwen3-8b-q4-k-m.gguf "${QWEN_Q4[@]}"
run_authority_step qwen3-8b-q8-0 artifacts/qwen3-8b-q8-0.gguf "${QWEN_Q8[@]}"
run_authority_step mistral-7b-instruct-v0.3-convert artifacts/mistral-7b-instruct-v0.3-f16.gguf "${MISTRAL_CONVERT[@]}"
run_authority_step mistral-7b-instruct-v0.3-q4-k-m artifacts/mistral-7b-instruct-v0.3-q4-k-m.gguf "${MISTRAL_Q4[@]}"

python3 - "$AUTHORITY" "$RUN_ROOT" <<'PY'
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

authority_path, run_root = map(Path, sys.argv[1:])
authority = json.loads(authority_path.read_text())
step_records = []
for path in sorted((run_root / "evidence" / "steps").glob("*.json")):
    if path.name.endswith(".argv.json"):
        continue
    payload = json.loads(path.read_text())
    assert payload["status"] == "COMPLETE"
    step_records.append(payload)
expected_steps = {
    "qwen3-8b-convert",
    "qwen3-8b-q4-k-m",
    "qwen3-8b-q8-0",
    "mistral-7b-instruct-v0.3-convert",
    "mistral-7b-instruct-v0.3-q4-k-m",
}
assert {item["step_key"] for item in step_records} == expected_steps


def file_record(path: Path, relative: str) -> dict[str, object]:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            value.update(chunk)
    return {"path": relative, "size_bytes": path.stat().st_size, "sha256": value.hexdigest()}


outputs = []
for model in authority["models"]:
    outputs.append(
        file_record(run_root / model["intermediate"]["path"], model["intermediate"]["path"])
    )
    for quantization in model["quantizations"]:
        outputs.append(file_record(run_root / quantization["path"], quantization["path"]))
report = {
    "schema_version": "tai.model-conversion-report.v1",
    "status": authority["result"]["complete_status"],
    "exact_main_sha": authority["execution"]["exact_main_sha"],
    "workflow_run_id": authority["execution"]["workflow_run_id"],
    "workflow_run_attempt": authority["execution"]["workflow_run_attempt"],
    "completed_at": datetime.now(timezone.utc).isoformat(),
    "host_role": authority["target"]["host_role"],
    "workspace_root": authority["target"]["workspace_root"],
    "legal_review_status": authority["legal_review"]["required_status"],
    "source_acceptance_status": authority["source_acceptance"]["status"],
    "toolchain_status": authority["toolchain_acceptance"]["status"],
    "source_verification": json.loads(
        (run_root / "evidence" / "source-verification.json").read_text()
    ),
    "python_environment": {
        "python_version": file_record(
            run_root / "evidence" / "python-version.txt", "evidence/python-version.txt"
        ),
        "pip_version": file_record(
            run_root / "evidence" / "pip-version.txt", "evidence/pip-version.txt"
        ),
        "dependencies": file_record(
            run_root / "evidence" / "python-dependencies.txt",
            "evidence/python-dependencies.txt",
        ),
    },
    "steps": step_records,
    "outputs": outputs,
    "benchmark_status": authority["result"]["benchmark_status"],
    "model_admission_status": authority["result"]["model_admission_status"],
    "production_operational_status": authority["result"]["production_operational_status"],
    "reasons": [],
}
rendered = json.dumps(report, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
report["report_sha256"] = hashlib.sha256(rendered.encode()).hexdigest()
(run_root / "evidence" / "conversion-report.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
)
PY

write_status COMPLETE
trap - ERR
echo 'CONVERSION_AND_QUANTIZATION_COMPLETE_PENDING_BUNDLE_RESTORE'
