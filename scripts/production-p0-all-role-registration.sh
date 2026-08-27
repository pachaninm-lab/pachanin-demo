#!/usr/bin/env bash
set -Eeuo pipefail

BASE_WRAPPER_BLOB='e0b35654ee3cd72c5838377cf3a1bbc43d6897d6'

fail() { printf 'P0_ALL_ROLE_SESSION_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }
command -v git >/dev/null 2>&1 || fail GIT_REQUIRED 2
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 3

tmp="$(mktemp)"
cleanup(){ rm -f -- "$tmp"; }
trap cleanup EXIT

git cat-file blob "$BASE_WRAPPER_BLOB" > "$tmp" 2>/dev/null || fail BASE_WRAPPER_BLOB_MISSING 4
[[ "$(git hash-object "$tmp")" == "$BASE_WRAPPER_BLOB" ]] || fail BASE_WRAPPER_BLOB_MISMATCH 5

python3 - "$tmp" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text(encoding='utf-8')

def one(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'PATCH_CARDINALITY_{label}={count}')
    s = s.replace(old, new, 1)

one(
    """    const imported = await context.cookies(origin);
    const importedNames = new Set(imported.filter((cookie) => cookie.value).map((cookie) => cookie.name));
    for (const required of ['pc_access_token', 'pc_v7_cabinet']) {
      if (!importedNames.has(required)) fail('P0_CHROMIUM_AUTH_COOKIE_MISSING');
    }
""",
    """    // Cookie enumeration is not an authentication authority. The two
    // server-authoritative probes below consume the exact production cookies:
    // /api/auth/me requires pc_access_token, while cabinet middleware requires
    // the signed pc_v7_cabinet session. Either missing/invalid cookie therefore
    // still fails closed without relying on BrowserContext.cookies() introspection.
""",
    'CHROMIUM_SERVER_AUTHORITY',
)
one(
    '    "P0_CHROMIUM_AUTH_COOKIE_MISSING",\n',
    '',
    'CHROMIUM_OBSOLETE_COOKIE_BLOCKER_INVARIANT',
)
one(
    """if s.count(\"for (const required of ['pc_access_token', 'pc_v7_cabinet'])\") != 1:
    raise SystemExit('CHROMIUM_REQUIRED_COOKIE_PROOF_CARDINALITY_INVALID')
""",
    """if s.count(\"context.request.get(origin + '/api/auth/me'\") != 1:
    raise SystemExit('CHROMIUM_ACCESS_COOKIE_AUTHORITY_CARDINALITY_INVALID')
if s.count('const cabinetResponse = await context.request.get(origin + route') != 1:
    raise SystemExit('CHROMIUM_CABINET_COOKIE_AUTHORITY_CARDINALITY_INVALID')
if 'P0_CHROMIUM_AUTH_COOKIE_MISSING' in s:
    raise SystemExit('CHROMIUM_COOKIE_ENUMERATION_AUTHORITY_REMAINS')
""",
    'CHROMIUM_SERVER_AUTHORITY_CARDINALITY',
)

p.write_text(s, encoding='utf-8')
PY

chmod 0700 "$tmp"
bash -n "$tmp"

if [[ "${PC_P0_ALL_ROLE_IDNA_VALIDATE_ONLY:-0}" == 1 ]]; then
  printf 'P0_ALL_ROLE_CHROMIUM_SERVER_AUTHORITY_WRAPPER=PASS\n'
fi

exec bash "$tmp" "$@"
