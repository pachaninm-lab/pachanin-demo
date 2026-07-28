#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE
unset AWS_SHARED_CREDENTIALS_FILE AWS_CONFIG_FILE BOTO_CONFIG
unset PYTHONHOME PYTHONPATH PYTHONSTARTUP PYTHONINSPECT
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

usage() {
  echo "usage: $0 --authority FILE --output REPORT.json" >&2
}

AUTHORITY=""
OUTPUT=""
while (($#)); do
  case "$1" in
    --authority)
      AUTHORITY="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT="${2:-}"
      shift 2
      ;;
    *)
      usage
      exit 64
      ;;
  esac
done
[[ -n "$AUTHORITY" && -n "$OUTPUT" ]] || { usage; exit 64; }
[[ -t 0 && -t 1 ]] || {
  echo "FAILED_CLOSED:INTERACTIVE_TTY_REQUIRED" >&2
  exit 2
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
TAI_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
TMP_ROOT="$(mktemp -d)"
chmod 700 "$TMP_ROOT"
cleanup() {
  local status=$?
  trap - EXIT HUP INT TERM
  rm -rf -- "$TMP_ROOT"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

command -v python3 >/dev/null || {
  echo "FAILED_CLOSED:PYTHON3_NOT_FOUND" >&2
  exit 2
}
python3 - <<'PY'
import sys
if sys.version_info < (3, 12):
    raise SystemExit("Python 3.12+ is required")
PY

EXPECTED_BOTO3="1.43.18"
EXPECTED_BOTOCORE="1.43.18"
PYTHON_BIN="python3"
PYTHON_SITE=""

sdk_is_exact() {
  "$1" - "$EXPECTED_BOTO3" "$EXPECTED_BOTOCORE" <<'PY'
import sys
try:
    import boto3
    import botocore
except ImportError:
    raise SystemExit(1)
raise SystemExit(
    0
    if (boto3.__version__, botocore.__version__) == (sys.argv[1], sys.argv[2])
    else 1
)
PY
}

if ! sdk_is_exact "$PYTHON_BIN"; then
  if python3 -m venv "$TMP_ROOT/venv" >/dev/null 2>&1; then
    PYTHON_BIN="$TMP_ROOT/venv/bin/python"
    if ! env -i \
      HOME="$TMP_ROOT" \
      PATH="$PATH" \
      PIP_CONFIG_FILE=/dev/null \
      "$PYTHON_BIN" -m pip install \
        --disable-pip-version-check \
        --no-input \
        --no-cache-dir \
        "boto3==$EXPECTED_BOTO3" \
        "botocore==$EXPECTED_BOTOCORE"; then
      echo "FAILED_CLOSED:EPHEMERAL_BOTO3_BOOTSTRAP_FAILED" >&2
      exit 2
    fi
  elif python3 -m pip --version >/dev/null 2>&1; then
    PYTHON_SITE="$TMP_ROOT/site"
    mkdir -m 700 "$PYTHON_SITE"
    if ! env -i \
      HOME="$TMP_ROOT" \
      PATH="$PATH" \
      PIP_CONFIG_FILE=/dev/null \
      python3 -m pip install \
        --disable-pip-version-check \
        --no-input \
        --no-cache-dir \
        --target "$PYTHON_SITE" \
        "boto3==$EXPECTED_BOTO3" \
        "botocore==$EXPECTED_BOTOCORE"; then
      echo "FAILED_CLOSED:EPHEMERAL_BOTO3_BOOTSTRAP_FAILED" >&2
      exit 2
    fi
  else
    echo "FAILED_CLOSED:EPHEMERAL_BOTO3_BOOTSTRAP_UNAVAILABLE" >&2
    exit 2
  fi
fi

if [[ -n "$PYTHON_SITE" ]]; then
  export PYTHONPATH="$PYTHON_SITE:$TAI_ROOT"
else
  export PYTHONPATH="$TAI_ROOT"
fi
sdk_is_exact "$PYTHON_BIN" || {
  echo "FAILED_CLOSED:BOTO3_BOTOCORE_VERSION_MISMATCH" >&2
  exit 2
}

export AWS_EC2_METADATA_DISABLED="true"
export AWS_DEFAULT_REGION="us-east-1"
export AWS_REQUEST_CHECKSUM_CALCULATION="when_required"
export AWS_RESPONSE_CHECKSUM_VALIDATION="when_required"
export REQUESTS_CA_BUNDLE="/etc/ssl/certs/ca-certificates.crt"

"$PYTHON_BIN" -m tai.reg_ru_s3_compatibility_v2 \
  --authority "$AUTHORITY" \
  --output "$OUTPUT"
