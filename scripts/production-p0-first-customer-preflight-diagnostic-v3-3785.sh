#!/usr/bin/env bash
set -Eeuo pipefail

CORE='scripts/production-p0-first-customer-preflight-diagnostic-3785.sh'
EXPECTED_CORE_BLOB='3e6e1b2cc5eb2f79c331f027d01e196df956154d'

fail() { printf 'P0_PREFLIGHT_V3_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }

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

# Preserve the proven v2 expected-status handling: the inherited ERR trap must
# not intercept the deliberate non-zero AUTH_ERROR / ADMIN_ERROR probes.
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

# v2 proved the auth principal compound predicate is the real failing boundary.
# Split that single safe predicate into mutually-exclusive machine-readable
# classes. No role name, URL, database name, credential, container or raw error
# is published; the only additional output is the bounded ERROR_CODE already
# emitted by the reviewed core.
replace_once(
    "    if(!p||!knownRoles.has(p.role_name)||p.rolsuper!==false||p.rolbypassrls!==false||p.schema_usage!==true||p.membership_select!==true||t?.relrowsecurity!==true||t?.relforcerowsecurity!==true) fail('P0_AUTH_RUNTIME_PRINCIPAL_INVALID');",
    "    if(!p) fail('P0_AUTH_RUNTIME_PRINCIPAL_ROW_MISSING');\n"
    "    if(!knownRoles.has(p.role_name)) fail('P0_AUTH_RUNTIME_ROLE_UNEXPECTED');\n"
    "    if(p.rolsuper!==false) fail('P0_AUTH_RUNTIME_SUPERUSER_UNSAFE');\n"
    "    if(p.rolbypassrls!==false) fail('P0_AUTH_RUNTIME_BYPASSRLS_UNSAFE');\n"
    "    if(p.schema_usage!==true) fail('P0_AUTH_RUNTIME_PUBLIC_SCHEMA_USAGE_MISSING');\n"
    "    if(p.membership_select!==true) fail('P0_AUTH_RUNTIME_MEMBERSHIP_SELECT_MISSING');\n"
    "    if(t?.relrowsecurity!==true) fail('P0_USER_ORGS_RLS_DISABLED');\n"
    "    if(t?.relforcerowsecurity!==true) fail('P0_USER_ORGS_FORCE_RLS_DISABLED');",
    'AUTH_PRINCIPAL_CLASSIFICATION',
)
replace_once(
    '## Production P0 first-customer read-only preflight diagnostic',
    '## Production P0 first-customer read-only preflight diagnostic v3',
    'EVIDENCE_TITLE',
)

required_codes = [
    'P0_AUTH_RUNTIME_PRINCIPAL_ROW_MISSING',
    'P0_AUTH_RUNTIME_ROLE_UNEXPECTED',
    'P0_AUTH_RUNTIME_SUPERUSER_UNSAFE',
    'P0_AUTH_RUNTIME_BYPASSRLS_UNSAFE',
    'P0_AUTH_RUNTIME_PUBLIC_SCHEMA_USAGE_MISSING',
    'P0_AUTH_RUNTIME_MEMBERSHIP_SELECT_MISSING',
    'P0_USER_ORGS_RLS_DISABLED',
    'P0_USER_ORGS_FORCE_RLS_DISABLED',
]
if any(source.count(code) != 1 for code in required_codes):
    raise SystemExit('AUTH_PRINCIPAL_CLASSIFIER_CARDINALITY_INVALID')
if "P0_AUTH_RUNTIME_PRINCIPAL_INVALID" in source:
    raise SystemExit('COMPOUND_AUTH_PRINCIPAL_CLASSIFIER_REMAINS')
if source.count('trap - ERR') != 3:
    raise SystemExit('ERR_TRAP_SUSPEND_CARDINALITY_INVALID')
if source.count('trap unexpected ERR') != 3:
    raise SystemExit('ERR_TRAP_RESTORE_CARDINALITY_INVALID')
if source.count('SET TRANSACTION READ ONLY') < 2:
    raise SystemExit('READ_ONLY_BOUNDARY_MISSING')
if 'PRODUCTION_MUTATION=NONE' not in source and 'PRODUCTION_MUTATION NONE' not in source:
    raise SystemExit('MUTATION_EVIDENCE_MISSING')

Path(target_path).write_text(source, encoding='utf-8')
PY

chmod 0700 "$patched"
bash -n "$patched"

if [[ "${PC_P0_PREFLIGHT_V3_VALIDATE_ONLY:-0}" == 1 ]]; then
  printf 'P0_PREFLIGHT_V3_WRAPPER_VALIDATE=PASS\n'
  exit 0
fi

export PC_P0_PREFLIGHT_DIAGNOSTIC_COMMAND='/production p0-first-customer-preflight-diagnostic 280c'
bash "$patched"
