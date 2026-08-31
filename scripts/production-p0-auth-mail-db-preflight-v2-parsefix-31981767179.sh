#!/usr/bin/env bash
set -Eeuo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_DB_PREFLIGHT_V2_COMMAND:?PC_AUTH_MAIL_DB_PREFLIGHT_V2_COMMAND is required}"

COMMAND='/production p0-auth-mail-db-preflight-v2-parsefix 31981767179 current-main'
SOURCE='scripts/production-p0-auth-mail-db-preflight-v2-31981767179.sh'
TMP="$RUNNER_TEMP/production-p0-auth-mail-db-preflight-v2-parsefix.sh"

[[ "$PC_AUTH_MAIL_DB_PREFLIGHT_V2_COMMAND" == "$COMMAND" ]]
[[ "${PRODUCTION_MUTATION_ALLOWED:-false}" == 'false' ]]
[[ "${PC_IS_PRODUCTION:-false}" == 'true' ]]
[[ -f "$SOURCE" ]]

cleanup() {
  rm -f -- "$TMP"
}
trap cleanup EXIT

python3 - "$SOURCE" "$TMP" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1])
target = Path(sys.argv[2])
text = source.read_text(encoding='utf-8')

replacements = [
    (
        "COMMAND='/production p0-auth-mail-db-preflight-v2 31981767179 current-main'",
        "COMMAND='/production p0-auth-mail-db-preflight-v2-parsefix 31981767179 current-main'",
    ),
    (
        "set +e\noutput=\"$(ssh ",
        "if output=\"$(ssh ",
    ),
    (
        ")\"\nssh_rc=$?\nset -e\n\nremote_marker=",
        ")\"; then\n  ssh_rc=0\nelse\n  ssh_rc=$?\nfi\n\nremote_marker=",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'parsefix source mismatch: expected one occurrence, got {count}')
    text = text.replace(old, new, 1)

target.write_text(text, encoding='utf-8')
PY

chmod 0700 "$TMP"
bash -n "$TMP"
exec bash "$TMP"
