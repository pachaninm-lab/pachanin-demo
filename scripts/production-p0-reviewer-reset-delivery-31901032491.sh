#!/usr/bin/env bash
set -Eeuo pipefail

CORE_BLOB='115fee96ea9feb45b75291031f263d7856e7790d'
OLD_COMMAND='/production p0-reviewer-reset-delivery-diagnose 31667978433'
TARGET_COMMAND='/production p0-reviewer-reset-delivery-diagnose 31901032491'
OLD_RUN='31667978433'
TARGET_RUN='31901032491'
OLD_SHA='d2dd7972105cc59002263455b5ae0eb8d8f2d386'
TARGET_SHA='056ed4461dafb5e7dab2efc9ea5a0d5877523169'
OLD_SINCE='2026-08-13T04:45:10Z'
TARGET_SINCE='2026-08-15T18:24:20Z'
OLD_UNTIL='2026-08-13T04:45:24Z'
TARGET_UNTIL='2026-08-15T18:25:20Z'

fail() { printf 'P0_REVIEWER_RESET_DELIVERY_CURRENT_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }
command -v git >/dev/null 2>&1 || fail GIT_REQUIRED 2
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 3

tmp="$(mktemp)"
cleanup(){ rm -f -- "$tmp"; }
trap cleanup EXIT

git cat-file blob "$CORE_BLOB" > "$tmp" 2>/dev/null || fail CORE_BLOB_MISSING 4
[[ "$(git hash-object "$tmp")" == "$CORE_BLOB" ]] || fail CORE_BLOB_MISMATCH 5

P0_OLD_COMMAND="$OLD_COMMAND" P0_TARGET_COMMAND="$TARGET_COMMAND" \
P0_OLD_RUN="$OLD_RUN" P0_TARGET_RUN="$TARGET_RUN" \
P0_OLD_SHA="$OLD_SHA" P0_TARGET_SHA="$TARGET_SHA" \
P0_OLD_SINCE="$OLD_SINCE" P0_TARGET_SINCE="$TARGET_SINCE" \
P0_OLD_UNTIL="$OLD_UNTIL" P0_TARGET_UNTIL="$TARGET_UNTIL" \
python3 - "$tmp" <<'PY'
from pathlib import Path
import os, sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
pairs=[
    (os.environ['P0_OLD_COMMAND'], os.environ['P0_TARGET_COMMAND']),
    (os.environ['P0_OLD_RUN'], os.environ['P0_TARGET_RUN']),
    (os.environ['P0_OLD_SHA'], os.environ['P0_TARGET_SHA']),
    (os.environ['P0_OLD_SINCE'], os.environ['P0_TARGET_SINCE']),
    (os.environ['P0_OLD_UNTIL'], os.environ['P0_TARGET_UNTIL']),
    ('retained d2dd web-container cardinality', 'retained 056ed web-container cardinality'),
]
for old,new in pairs:
    if old not in s:
        raise SystemExit('SOURCE_LITERAL_MISSING='+old)
    s=s.replace(old,new)
required=[
    "COMMAND='/production p0-reviewer-reset-delivery-diagnose 31901032491'",
    "SOURCE_RUN_ID='31901032491'",
    "EXPECTED_DEPLOYED_SHA='056ed4461dafb5e7dab2efc9ea5a0d5877523169'",
    "LOG_SINCE='2026-08-15T18:24:20Z'",
    "LOG_UNTIL='2026-08-15T18:25:20Z'",
    "docker logs --since \"$log_since\" --until \"$log_until\"",
    "grep -F 'password_reset_delivery_result'",
    'MAIL_SENT_BY_DIAGNOSTIC=NO',
    'PRODUCTION_MUTATION=NONE',
    'StrictHostKeyChecking=yes',
]
missing=[x for x in required if x not in s]
if missing:
    raise SystemExit('SECURITY_INVARIANT_MISSING='+'|'.join(missing))
for forbidden in ('/api/auth/forgot-password','auth/password-reset/request','MAIL FROM:','RCPT TO:','AUTH PLAIN'):
    if forbidden in s:
        raise SystemExit('FORBIDDEN_SEND_OR_MUTATION_SURFACE='+forbidden.replace(' ','_'))
p.write_text(s,encoding='utf-8')
PY
chmod 0700 "$tmp"
/usr/bin/bash --noprofile --norc -n "$tmp"

if [[ "${PC_P0_REVIEWER_RESET_DELIVERY_CURRENT_VALIDATE_ONLY:-0}" == 1 ]]; then
  printf 'P0_REVIEWER_RESET_DELIVERY_CURRENT_WRAPPER=PASS\n'
  printf 'P0_REVIEWER_RESET_DELIVERY_SOURCE_RUN=%s\n' "$TARGET_RUN"
  printf 'P0_REVIEWER_RESET_DELIVERY_TARGET_SHA=%s\n' "$TARGET_SHA"
  exit 0
fi

exec /usr/bin/bash --noprofile --norc "$tmp" "$@"
