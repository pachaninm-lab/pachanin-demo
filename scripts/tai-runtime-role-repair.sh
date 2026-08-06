#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
OUTPUT_FILE="${3:-}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'INVALID_TARGET_SHA' >&2; exit 2; }
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || { echo 'INVALID_RUN_ID' >&2; exit 2; }
[[ "$OUTPUT_FILE" == "/var/lib/pc-release-authority/runner-output/${RUN_ID}/runtime-role-repair.json" ]] \
  || { echo 'INVALID_OUTPUT_PATH' >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo 'ROOT_AUTHORITY_REQUIRED' >&2; exit 2; }

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly FULL_STACK_INPUT="/var/lib/pc-release-authority/runner-input/${RUN_ID}/full-stack-release.json"
readonly FULL_STACK_CONTROLLER="$SCRIPT_DIR/pc-full-stack-controller.sh"
readonly LEGACY_REPAIR="$SCRIPT_DIR/tai-runtime-role-repair-legacy.sh"
readonly LEGACY_BLOB='ff1c984440794a2a73267c5e1886b3308a152c49'

if [[ -e "$FULL_STACK_INPUT" || -L "$FULL_STACK_INPUT" ]]; then
  [[ -f "$FULL_STACK_INPUT" && ! -L "$FULL_STACK_INPUT" ]] || {
    echo 'FULL_STACK_INPUT_INVALID' >&2
    exit 20
  }
  [[ -f "$FULL_STACK_CONTROLLER" && ! -L "$FULL_STACK_CONTROLLER" ]] || {
    echo 'FULL_STACK_CONTROLLER_INVALID' >&2
    exit 21
  }
  exec bash "$FULL_STACK_CONTROLLER" "$TARGET_SHA" "$RUN_ID" "$OUTPUT_FILE"
fi

[[ -f "$LEGACY_REPAIR" && ! -L "$LEGACY_REPAIR" ]] || {
  echo 'LEGACY_REPAIR_FILE_INVALID' >&2
  exit 30
}
[[ "$(git hash-object "$LEGACY_REPAIR")" == "$LEGACY_BLOB" ]] || {
  echo 'LEGACY_REPAIR_BLOB_MISMATCH' >&2
  exit 31
}
exec bash "$LEGACY_REPAIR" "$TARGET_SHA" "$RUN_ID" "$OUTPUT_FILE"
