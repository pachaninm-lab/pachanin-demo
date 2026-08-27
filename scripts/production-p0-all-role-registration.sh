#!/usr/bin/env bash
set -Eeuo pipefail

BASE_WRAPPER_BLOB='718fa79314369361c9e5947dfee1dc1aafd7cb32'

fail() { printf 'P0_ALL_ROLE_PATH_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }
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
    "    if ((pathValue || '/') !== '/') continue;\n",
    "",
    'CHROMIUM_NONROOT_PATH_FILTER_REMOVAL',
)
one(
    """      path: '/',
      secure,
      httpOnly,
      sameSite: 'Lax',
""",
    """      path: pathValue || '/',
      secure,
      httpOnly,
      sameSite: 'Lax',
""",
    'CHROMIUM_EXACT_PATH_PRESERVATION',
)
one(
    """      if (cookie.domain !== browserHost
        || cookie.path !== '/'
        || cookie.secure !== true
        || cookie.httpOnly !== true) {
""",
    """      if (cookie.domain !== browserHost
        || cookie.secure !== true
        || cookie.httpOnly !== true) {
""",
    'CHROMIUM_SERVER_PATH_AUTHORITY',
)

if "if ((pathValue || '/') !== '/') continue;" in s:
    raise SystemExit('CHROMIUM_NONROOT_PATH_FILTER_REMAINS')
if "path: pathValue || '/'," not in s:
    raise SystemExit('CHROMIUM_EXACT_PATH_NOT_PRESERVED')
if "cookie.path !== '/'" in s:
    raise SystemExit('CHROMIUM_ROOT_PATH_ASSERTION_REMAINS')
if "context.request.get(origin + '/api/auth/me'" not in s:
    raise SystemExit('CHROMIUM_ACCESS_SERVER_AUTHORITY_MISSING')
if "const cabinetResponse = await context.request.get(origin + route" not in s:
    raise SystemExit('CHROMIUM_CABINET_SERVER_AUTHORITY_MISSING')
if "domain: target.hostname" not in s or "includeSubdomainsValue.toUpperCase() !== 'FALSE'" not in s:
    raise SystemExit('CHROMIUM_HOST_ONLY_SCOPE_GUARD_MISSING')
if "P0_CHROMIUM_JAR_ACCESS_COOKIE_MISSING" not in s or "P0_CHROMIUM_JAR_CABINET_COOKIE_MISSING" not in s:
    raise SystemExit('CHROMIUM_REQUIRED_JAR_COOKIE_GUARD_MISSING')

p.write_text(s, encoding='utf-8')
PY

chmod 0700 "$tmp"
bash -n "$tmp"

if [[ "${PC_P0_ALL_ROLE_IDNA_VALIDATE_ONLY:-0}" == 1 ]]; then
  set +e
  output="$(bash "$tmp" "$@" 2>&1)"
  rc=$?
  set -e
  printf '%s\n' "$output"
  (( rc == 0 )) || exit "$rc"
  printf 'P0_ALL_ROLE_CHROMIUM_EXACT_PATH_PRESERVATION=PASS\n'
  printf 'P0_ALL_ROLE_CHROMIUM_SERVER_PATH_AUTHORITY=PASS\n'
  exit 0
fi

bash "$tmp" "$@"
