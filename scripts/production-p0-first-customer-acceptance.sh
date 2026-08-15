#!/usr/bin/env bash
set -Eeuo pipefail

CORE_BLOB='b02ce590dc308ce46c41df33416dd7b11700ae98'

fail() { printf 'P0_FIRST_CUSTOMER_ALIAS_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }
command -v git >/dev/null 2>&1 || fail GIT_REQUIRED 2
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 3

tmp="$(mktemp)"
cleanup(){ rm -f -- "$tmp"; }
trap cleanup EXIT

git cat-file blob "$CORE_BLOB" > "$tmp" 2>/dev/null || fail CORE_BLOB_MISSING 4
[[ "$(git hash-object "$tmp")" == "$CORE_BLOB" ]] || fail CORE_BLOB_MISMATCH 5

python3 - "$tmp" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')

def one(old,new,label):
    global s
    count=s.count(old)
    if count != 1:
        raise SystemExit(f'PATCH_CARDINALITY_{label}={count}')
    s=s.replace(old,new,1)

one(
    "const knownRoles = new Set(['pc_auth_runtime', 'one_deal_auth', 'app_auth']);",
    "const knownRoles = new Set(['pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service']);",
    'AUTH_ROLE_ALLOWLIST',
)
one(
    r"AUTH_PRINCIPAL\|(pc_auth_runtime|one_deal_auth|app_auth)$",
    r"AUTH_PRINCIPAL\|(pc_auth_runtime|one_deal_auth|app_auth|app_service)$",
    'AUTH_ROLE_OUTPUT_GUARD',
)

required=[
    "principal.rolsuper !== false",
    "principal.rolbypassrls !== false",
    "principal.schema_usage !== true",
    "principal.membership_select !== true",
    "table?.relrowsecurity !== true",
    "table?.relforcerowsecurity !== true",
    "SET TRANSACTION READ ONLY",
    "P0_AUTH_RUNTIME_PRINCIPAL_INVALID",
]
missing=[x for x in required if x not in s]
if missing:
    raise SystemExit('SECURITY_INVARIANT_MISSING='+'|'.join(missing))
if s.count("'app_service'") != 1:
    raise SystemExit('LEGACY_ALIAS_CARDINALITY_INVALID')
p.write_text(s,encoding='utf-8')
PY

chmod 0700 "$tmp"
bash -n "$tmp"

if [[ "${PC_P0_FIRST_CUSTOMER_ALIAS_VALIDATE_ONLY:-0}" == 1 ]]; then
  printf 'P0_FIRST_CUSTOMER_AUTH_ALIAS_PATCH=PASS\n'
  exit 0
fi

exec bash "$tmp" "$@"
