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
one(
    "p.write_text(s,encoding='utf-8')",
    r"""one(
    '''prime_csrf() {
  local label="$1" jar="$TMP_ROOT/$label.cookies" page="$TMP_ROOT/$label-csrf.html" status''',
    '''prime_csrf() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies" page="$TMP_ROOT/$label-csrf.html" status''',
    'PRIME_CSRF_LABEL_BOUND_BEFORE_JAR',
)
one(
    '''register_and_verify() {
  local label="$1" jar="$TMP_ROOT/$label.cookies"''',
    '''register_and_verify() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies"''',
    'REGISTER_LABEL_BOUND_BEFORE_JAR',
)
one(
    '''login_identity() {
  local label="$1" mode="$2" jar="$TMP_ROOT/$label.cookies"''',
    '''login_identity() {
  local label="$1" mode="$2"
  local jar="$TMP_ROOT/$label.cookies"''',
    'LOGIN_LABEL_BOUND_BEFORE_JAR',
)
one(
    '''logout_identity() {
  local label="$1" jar="$TMP_ROOT/$label.cookies"''',
    '''logout_identity() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies"''',
    'LOGOUT_LABEL_BOUND_BEFORE_JAR',
)

unsafe_jar_bindings = [
    '  local label="$1" jar="$TMP_ROOT/$label.cookies"',
    '  local label="$1" mode="$2" jar="$TMP_ROOT/$label.cookies"',
]
if any(fragment in s for fragment in unsafe_jar_bindings):
    raise SystemExit('BASH_DYNAMIC_SCOPE_COOKIE_JAR_BINDING_REMAINS')
required_jar_bindings = [
    '''prime_csrf() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies"''',
    '''register_and_verify() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies"''',
    '''login_identity() {
  local label="$1" mode="$2"
  local jar="$TMP_ROOT/$label.cookies"''',
    '''logout_identity() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies"''',
]
if any(fragment not in s for fragment in required_jar_bindings):
    raise SystemExit('LABEL_BOUND_COOKIE_JAR_INVARIANT_MISSING')

one(
    '--max-time 40',
    '--max-time 110',
    'HTTP_REQUEST_TIMEOUT_ENVELOPE',
)
if s.count('--max-time 110') != 1:
    raise SystemExit('HTTP_REQUEST_TIMEOUT_ENVELOPE_INVALID')

one(
    r'''assert_exact_main() {
  local actual
  actual="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null)" \
    || fail P0_EXACT_MAIN_LOOKUP_FAILED 11
  [[ "$actual" == "$TARGET_SHA" ]] || fail P0_MAIN_ADVANCED_DURING_MATRIX 12
}
''',
    r'''assert_release_candidate() {
  local actual
  actual="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null)" \
    || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
  [[ "$actual" =~ ^[0-9a-f]{40}$ ]] || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
  git fetch --no-tags origin main >/dev/null 2>&1 || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
  [[ "$(git rev-parse origin/main)" == "$actual" ]] || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
  git cat-file -e "$TARGET_SHA^{commit}" 2>/dev/null || fail P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR 12
  git merge-base --is-ancestor "$TARGET_SHA" "$actual" || fail P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR 12
}
''',
    'RELEASE_CANDIDATE_ANCESTRY_GUARD',
)
one(
    '''def assert_main():
    result = subprocess.run(
        ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/commits/main", '--jq', '.sha'],
        check=False, capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        raise SystemExit(43)
    if result.stdout.strip() != os.environ['P0_TARGET_SHA']:
        raise SystemExit(42)
''',
    '''def assert_release_candidate():
    result = subprocess.run(
        ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/commits/main", '--jq', '.sha'],
        check=False, capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        raise SystemExit(43)
    actual = result.stdout.strip()
    target = os.environ['P0_TARGET_SHA']
    if actual == target:
        return
    compare = subprocess.run(
        ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/compare/{target}...{actual}", '--jq', '.status'],
        check=False, capture_output=True, text=True, timeout=20,
    )
    if compare.returncode != 0:
        raise SystemExit(43)
    if compare.stdout.strip() != 'ahead':
        raise SystemExit(42)
''',
    'MAILBOX_RELEASE_CANDIDATE_ANCESTRY_GUARD',
)
one(
    '  for command in gh curl python3 node ssh awk sha256sum sort; do',
    '  for command in gh git curl python3 node ssh awk sha256sum sort; do',
    'RELEASE_CANDIDATE_GIT_PREREQUISITE',
)
remaining=s.count('assert_exact_main')
if remaining != 8:
    raise SystemExit(f'RELEASE_CANDIDATE_CALL_CARDINALITY_INVALID={remaining}')
s=s.replace('assert_exact_main','assert_release_candidate')
remaining_python=s.count('assert_main()')
if remaining_python != 1:
    raise SystemExit(f'MAILBOX_RELEASE_CANDIDATE_CALL_CARDINALITY_INVALID={remaining_python}')
s=s.replace('assert_main()','assert_release_candidate()')
one(
    '    42) fail P0_MAIN_ADVANCED_DURING_MATRIX 12 ;;\n    43) fail P0_EXACT_MAIN_LOOKUP_FAILED 11 ;;',
    '    42) fail P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR 12 ;;\n    43) fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11 ;;',
    'MAILBOX_RELEASE_CANDIDATE_BLOCKER_MAPPING',
)
if 'P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR' not in s or 'git merge-base --is-ancestor' not in s:
    raise SystemExit('RELEASE_CANDIDATE_GUARD_MISSING')

one(
    r'''docker exec "$api_id" /nodejs/bin/node -e \
  "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" \
  >/dev/null 2>&1 || remote_fail P0_PRODUCTION_API_NOT_READY 9
if [[ "$mode" == preflight ]]; then''',
    r'''docker exec "$api_id" /nodejs/bin/node -e \
  "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" \
  >/dev/null 2>&1 || remote_fail P0_PRODUCTION_API_NOT_READY 9
mapfile -t worker_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=auth-mail-worker')
(( ${#worker_ids[@]} == 1 )) || remote_fail P0_AUTH_MAIL_WORKER_RUNTIME_AUTHORITY_AMBIGUOUS 13
worker_id="${worker_ids[0]}"
worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker_id")"
[[ "$worker_revision" == "$target" ]] || remote_fail P0_AUTH_MAIL_WORKER_REVISION_MISMATCH 14
worker_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$worker_id")"
[[ "$worker_health" == healthy ]] || remote_fail P0_AUTH_MAIL_WORKER_NOT_HEALTHY 15
docker exec "$worker_id" /nodejs/bin/node -e \
  "fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(async r=>{if(!r.ok)process.exit(1);const x=await r.json();if(x.status!=='ready'||x.component!=='auth-mail-worker'||x.checks?.database!==true)process.exit(1)}).catch(()=>process.exit(1))" \
  >/dev/null 2>&1 || remote_fail P0_AUTH_MAIL_WORKER_NOT_READY 16
if [[ "$mode" == preflight ]]; then''',
    'AUTH_MAIL_WORKER_EXACT_READY',
)
exact_marker="printf 'P0_REMOTE_EXACT_REVISIONS=PASS\\n'"
if s.count(exact_marker) != 2:
    raise SystemExit(f'EXACT_REVISION_MARKER_CARDINALITY_INVALID={s.count(exact_marker)}')
s=s.replace(exact_marker, exact_marker + "\nprintf 'P0_AUTH_MAIL_WORKER_REVISION=PASS\\n'\nprintf 'P0_AUTH_MAIL_WORKER_READY=PASS\\n'")
one(
    '''  CURRENT_STAGE=production-preflight
  remote_authority preflight | grep -Fxq P0_REMOTE_EXACT_REVISIONS=PASS \\
    || fail P0_PRODUCTION_PREFLIGHT_FAILED 90''',
    '''  CURRENT_STAGE=production-preflight
  preflight_output="$(remote_authority preflight)"
  grep -Fxq P0_REMOTE_EXACT_REVISIONS=PASS <<< "$preflight_output" \\
    || fail P0_PRODUCTION_PREFLIGHT_FAILED 90
  grep -Fxq P0_AUTH_MAIL_WORKER_REVISION=PASS <<< "$preflight_output" \\
    || fail P0_AUTH_MAIL_WORKER_REVISION_MISMATCH 90
  grep -Fxq P0_AUTH_MAIL_WORKER_READY=PASS <<< "$preflight_output" \\
    || fail P0_AUTH_MAIL_WORKER_NOT_READY 90''',
    'AUTH_MAIL_WORKER_PREFLIGHT_CONSUMER',
)
one(
    "    'logoutRelogin': True,",
    "    'logoutRelogin': True,\n    'production': {\n        'apiRevisionExact': True,\n        'webRevisionExact': True,\n        'authMailWorkerRevisionExact': True,\n        'authMailWorkerReady': True,\n    },",
    'AUTH_MAIL_WORKER_RESULT_EVIDENCE',
)
one(
    "  CURRENT_STAGE=evidence-finalization\n  assert_release_candidate\n  write_success_record",
    "  CURRENT_STAGE=evidence-finalization\n  preflight_output=\"$(remote_authority preflight)\"\n  grep -Fxq P0_REMOTE_EXACT_REVISIONS=PASS <<< \"$preflight_output\" || fail P0_PRODUCTION_REVISION_CHANGED 91\n  grep -Fxq P0_AUTH_MAIL_WORKER_REVISION=PASS <<< \"$preflight_output\" || fail P0_AUTH_MAIL_WORKER_REVISION_MISMATCH 91\n  grep -Fxq P0_AUTH_MAIL_WORKER_READY=PASS <<< \"$preflight_output\" || fail P0_AUTH_MAIL_WORKER_NOT_READY 91\n  assert_release_candidate\n  write_success_record",
    'TERMINAL_PRODUCTION_PREFLIGHT',
)
if 'authMailWorkerRevisionExact' not in s or 'P0_AUTH_MAIL_WORKER_NOT_READY' not in s:
    raise SystemExit('AUTH_MAIL_WORKER_GUARD_MISSING')

p.write_text(s,encoding='utf-8')""",
    'LABEL_BOUND_COOKIE_JAR_PATCH_INJECTION',
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
if 'BASH_DYNAMIC_SCOPE_COOKIE_JAR_BINDING_REMAINS' not in s or 'LABEL_BOUND_COOKIE_JAR_INVARIANT_MISSING' not in s:
    raise SystemExit('LABEL_BOUND_COOKIE_JAR_PATCH_MISSING')
if 'HTTP_REQUEST_TIMEOUT_ENVELOPE' not in s or "'--max-time 110'" not in s:
    raise SystemExit('HTTP_REQUEST_TIMEOUT_PATCH_MISSING')

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
  printf 'P0_ALL_ROLE_LABEL_BOUND_COOKIE_JARS=PASS\n'
  printf 'P0_ALL_ROLE_HTTP_TIMEOUT_ENVELOPE=PASS\n'
  printf 'P0_ALL_ROLE_RELEASE_CANDIDATE_GUARD=PASS\n'
  printf 'P0_ALL_ROLE_AUTH_MAIL_WORKER_GUARD=PASS\n'
  exit 0
fi

bash "$tmp" "$@"
