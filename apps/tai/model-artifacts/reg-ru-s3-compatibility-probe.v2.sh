#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

usage() {
  echo "usage: $0 --authority FILE --output REPORT.json" >&2
}

AUTHORITY=""
OUTPUT=""
while (($#)); do
  case "$1" in
    --authority) AUTHORITY="${2:-}"; shift 2 ;;
    --output) OUTPUT="${2:-}"; shift 2 ;;
    *) usage; exit 64 ;;
  esac
done

[[ -n "$AUTHORITY" && -n "$OUTPUT" ]] || { usage; exit 64; }
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
TAI_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
export PYTHONPATH="$TAI_ROOT${PYTHONPATH:+:$PYTHONPATH}"
exec python3 -m tai.reg_ru_s3_compatibility_v2 \
  --authority "$AUTHORITY" \
  --output "$OUTPUT"
