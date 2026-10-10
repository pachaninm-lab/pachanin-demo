#!/usr/bin/env bash
set -Eeuo pipefail

CORE='scripts/production-p0-first-customer-preflight-diagnostic-3785.sh'
EXPECTED_CORE_BLOB='3e6e1b2cc5eb2f79c331f027d01e196df956154d'

fail() { printf 'P0_AUTH_ALIAS_V4_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }

[[ -f "$CORE" && ! -L "$CORE" ]] || fail CORE_MISSING 2
command -v git >/dev/null 2>&1 || fail GIT_REQUIRED 3
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 4
[[ "$(git hash-object "$CORE")" == "$EXPECTED_CORE_BLOB" ]] || fail CORE_BLOB_MISMATCH 5

patched="$(mktemp)"
cleanup(){ rm -f -- "$patched"; }
trap cleanup EXIT

python3 - "$CORE" "$patched" <<'PY'
from pathlib import Path
import sys

source_path, target_path = map(Path, sys.argv[1:3])
source = source_path.read_text(encoding='utf-8')

def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'PATCH_CARDINALITY_{label}={count}')
    source = source.replace(old, new, 1)

# Preserve the proven v2/v3 expected-status boundary.
replace_once(
    'compose_phase=PASS\n\nset +e\nauth_output=',
    'compose_phase=PASS\n\ntrap - ERR\nset +e\nauth_output=',
    'AUTH_ERR_TRAP_SUSPEND',
)
replace_once(
    'auth_rc=$?\nset -e\nif (( auth_rc != 0 )); then',
    'auth_rc=$?\nset -e\ntrap unexpected ERR\nif (( auth_rc != 0 )); then',
    'AUTH_ERR_TRAP_RESTORE',
)
replace_once(
    "NODE\n\nset +e\nadmin_output=\"$(cat \"$migration_db\" | docker exec -i \"$api_id\" /nodejs/bin/node -e \"$admin_node\" 2>/dev/null)\"",
    "NODE\n\ntrap - ERR\nset +e\nadmin_output=\"$(cat \"$migration_db\" | docker exec -i \"$api_id\" /nodejs/bin/node -e \"$admin_node\" 2>/dev/null)\"",
    'ADMIN_ERR_TRAP_SUSPEND',
)
replace_once(
    'admin_rc=$?\nset -e\nif (( admin_rc != 0 )); then',
    'admin_rc=$?\nset -e\ntrap unexpected ERR\nif (( admin_rc != 0 )); then',
    'ADMIN_ERR_TRAP_RESTORE',
)

# One-factor differential probe. v3 proved the deployed role is outside the
# three canonical aliases. Historical production authority explicitly hardens
# the legacy app_service auth principal. Admit only that single legacy alias,
# while preserving every privilege/RLS check and all later read-only evidence.
replace_once(
    "const knownRoles = new Set(['pc_auth_runtime','one_deal_auth','app_auth']);",
    "const knownRoles = new Set(['pc_auth_runtime','one_deal_auth','app_auth','app_service']);",
    'LEGACY_ALIAS_ALLOWLIST',
)
replace_once(
    "AUTH_PRINCIPAL\\|(pc_auth_runtime|one_deal_auth|app_auth)$",
    "AUTH_PRINCIPAL\\|(pc_auth_runtime|one_deal_auth|app_auth|app_service)$",
    'LEGACY_ALIAS_OUTPUT_GUARD',
)

# Keep the granular v3 invariant classifier so any failure after the single
# alias change remains machine-readable and does not expose the role name.
replace_once(
    "if(!p||!knownRoles.has(p.role_name)||p.rolsuper!==false||p.rolbypassrls!==false||p.schema_usage!==true||p.membership_select!==true||t?.relrowsecurity!==true||t?.relforcerowsecurity!==true) fail('P0_AUTH_RUNTIME_PRINCIPAL_INVALID');",
    "if(!p) fail('P0_AUTH_PRINCIPAL_ROW_MISSING');\n    if(!knownRoles.has(p.role_name)) fail('P0_AUTH_PRINCIPAL_ROLE_UNEXPECTED');\n    if(p.rolsuper!==false) fail('P0_AUTH_PRINCIPAL_SUPERUSER_INVALID');\n    if(p.rolbypassrls!==false) fail('P0_AUTH_PRINCIPAL_BYPASSRLS_INVALID');\n    if(p.schema_usage!==true) fail('P0_AUTH_SCHEMA_USAGE_MISSING');\n    if(p.membership_select!==true) fail('P0_AUTH_MEMBERSHIP_SELECT_MISSING');\n    if(!t) fail('P0_AUTH_MEMBERSHIP_TABLE_ROW_MISSING');\n    if(t.relrowsecurity!==true) fail('P0_AUTH_MEMBERSHIP_RLS_DISABLED');\n    if(t.relforcerowsecurity!==true) fail('P0_AUTH_MEMBERSHIP_FORCE_RLS_DISABLED');",
    'AUTH_PRINCIPAL_GRANULAR_CLASSIFIER',
)
replace_once(
    '## Production P0 first-customer read-only preflight diagnostic',
    '## Production P0 hardened legacy auth-alias differential diagnostic v4',
    'EVIDENCE_TITLE',
)

if source.count("'app_service'") != 1:
    raise SystemExit('LEGACY_ALIAS_CARDINALITY_INVALID')
if source.count('trap - ERR') != 3 or source.count('trap unexpected ERR') != 3:
    raise SystemExit('ERR_TRAP_CARDINALITY_INVALID')
if source.count('SET TRANSACTION READ ONLY') < 2:
    raise SystemExit('READ_ONLY_BOUNDARY_MISSING')
if 'PRODUCTION_MUTATION=NONE' not in source and 'PRODUCTION_MUTATION NONE' not in source:
    raise SystemExit('MUTATION_EVIDENCE_MISSING')

Path(target_path).write_text(source, encoding='utf-8')
PY

chmod 0700 "$patched"
bash -n "$patched"

if [[ "${PC_P0_AUTH_ALIAS_V4_VALIDATE_ONLY:-0}" == 1 ]]; then
  printf 'P0_AUTH_ALIAS_V4_WRAPPER_VALIDATE=PASS\n'
  exit 0
fi

export PC_P0_PREFLIGHT_DIAGNOSTIC_COMMAND='/production p0-first-customer-preflight-diagnostic 280c'
bash "$patched"
