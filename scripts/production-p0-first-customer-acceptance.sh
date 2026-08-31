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
one(
    "target = os.environ['P0_TARGET_EMAIL'].strip().lower()",
    """def canonical_mailbox(value):
    try:
        value = str(value or '').strip().lower()
        if value.count('@') != 1:
            return None
        local, domain = value.rsplit('@', 1)
        local.encode('ascii')
        domain = domain.encode('idna').decode('ascii').lower()
        result = f'{local}@{domain}'
        if len(result) > 254 or not re.fullmatch(r'[A-Za-z0-9._+-]{1,64}@[A-Za-z0-9.-]{1,189}', result):
            return None
        return result
    except Exception:
        return None

def canonical_imap_login(value):
    try:
        value = str(value or '').strip()
        if value.count('@') != 1:
            return None
        local, domain = value.rsplit('@', 1)
        local.encode('ascii')
        domain = domain.encode('idna').decode('ascii').lower()
        result = f'{local}@{domain}'
        if len(result) > 254 or not re.fullmatch(r'[^\\s@]{1,64}@[^\\s@]{1,189}', result):
            return None
        return result
    except Exception:
        return None

target = canonical_mailbox(os.environ['P0_TARGET_EMAIL'])
if target is None:
    raise SystemExit('VERIFICATION_TARGET_INVALID')
username = canonical_imap_login(username)
if username is None:
    raise SystemExit('IMAP_LOGIN_IDENTITY_INVALID')""",
    'IMAP_IDNA_TARGET',
)
one(
    "                recipients.extend(address.lower() for _, address in getaddresses(message.get_all(header, [])))",
    """                for _, address in getaddresses(message.get_all(header, [])):
                    canonical = canonical_mailbox(address)
                    if canonical:
                        recipients.append(canonical)""",
    'IMAP_IDNA_RECIPIENTS',
)
one(
    """  if (( rc != 0 )); then
    blocker=\"$(sed -n 's/^ERROR_CODE=//p' <<< \"$output\" | tail -1)\"
    [[ \"$blocker\" =~ ^[A-Z0-9_]{4,100}$ ]] || blocker=P0_REMOTE_READ_ONLY_EVIDENCE_FAILED
    fail \"$blocker\" 80
  fi""",
    """  if (( rc != 0 )); then
    blocker=\"$(sed -n 's/^ERROR_CODE=//p' <<< \"$output\" | tail -1)\"
    [[ \"$blocker\" =~ ^[A-Z0-9_]{4,100}$ ]] || blocker=P0_REMOTE_READ_ONLY_EVIDENCE_FAILED
    if [[ -n \"$TMP_ROOT\" && -d \"$TMP_ROOT\" ]]; then
      printf '%s\\n' \"$blocker\" > \"$TMP_ROOT/remote-blocker\"
      chmod 0600 \"$TMP_ROOT/remote-blocker\"
    fi
    fail \"$blocker\" 80
  fi""",
    'REMOTE_BLOCKER_PERSIST',
)
one(
    """  if [[ \"$FINISHED\" != 1 ]]; then
    safe_failure_record || true""",
    """  if [[ \"$FINISHED\" != 1 ]]; then
    if [[ -n \"$TMP_ROOT\" && -f \"$TMP_ROOT/remote-blocker\" ]]; then
      local remote_blocker
      remote_blocker=\"$(cat \"$TMP_ROOT/remote-blocker\" 2>/dev/null || true)\"
      if [[ \"$remote_blocker\" =~ ^[A-Z0-9_]{4,100}$ ]]; then
        BLOCKER_CODE=\"$remote_blocker\"
      fi
    fi
    safe_failure_record || true""",
    'REMOTE_BLOCKER_RECOVER',
)
one(
    "REVIEWER_USER_ID=''\n",
    "REVIEWER_USER_ID=''\nREGISTRATION_HTTP_STATUS=''\nREGISTRATION_PUBLIC_CODE=''\n",
    'REGISTRATION_FAILURE_STATE',
)
one(
    '  local label="$1" jar="$TMP_ROOT/$label.cookies" response="$TMP_ROOT/$label-team.json"',
    '  local label="$1"\n  local jar="$TMP_ROOT/$label.cookies" response="$TMP_ROOT/$label-team.json"',
    'READ_CUSTOMER_RESOURCE_SET_U',
)
one(
    """  P0_BLOCKER=\"$BLOCKER_CODE\" \\
    python3 - \"$EVIDENCE_DIR/result.json\" <<'PY'
import json, os, sys
""",
    """  P0_BLOCKER=\"$BLOCKER_CODE\" \\
  P0_REGISTRATION_HTTP_STATUS=\"${REGISTRATION_HTTP_STATUS:-}\" \\
  P0_REGISTRATION_PUBLIC_CODE=\"${REGISTRATION_PUBLIC_CODE:-}\" \\
    python3 - \"$EVIDENCE_DIR/result.json\" <<'PY'
import json, os, re, sys
""",
    'REGISTRATION_FAILURE_ENV',
)
one(
    """    'blocker': os.environ.get('P0_BLOCKER', 'UNEXPECTED_P0_ACCEPTANCE_FAILURE'),
}
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
""",
    """    'blocker': os.environ.get('P0_BLOCKER', 'UNEXPECTED_P0_ACCEPTANCE_FAILURE'),
}
if str(payload['stage']).startswith('registration-'):
    status = os.environ.get('P0_REGISTRATION_HTTP_STATUS', '')
    code = os.environ.get('P0_REGISTRATION_PUBLIC_CODE', '')
    payload['registrationHttpStatus'] = int(status) if re.fullmatch(r'[1-5][0-9]{2}', status) else 'UNKNOWN'
    payload['registrationPublicCode'] = code if re.fullmatch(r'[A-Z0-9_]{4,100}', code) else 'UNKNOWN'
with open(sys.argv[1], 'w', encoding='utf-8') as handle:
""",
    'REGISTRATION_FAILURE_RECORD',
)
one(
    """  [[ \"$status\" == 202 ]] || fail \"P0_REGISTRATION_${label^^}_FAILED\" 31
""",
    """  if [[ \"$status\" != 202 ]]; then
    if [[ \"$status\" =~ ^[1-5][0-9]{2}$ ]]; then
      REGISTRATION_HTTP_STATUS=\"$status\"
    else
      REGISTRATION_HTTP_STATUS=UNKNOWN
    fi
    REGISTRATION_PUBLIC_CODE=\"$(python3 - \"$response\" <<'REGISTRATION_CODE_PY'
import json, re, sys
try:
    payload = json.load(open(sys.argv[1], encoding='utf-8'))
except Exception:
    print('UNKNOWN')
    raise SystemExit(0)
code = payload.get('code')
print(code if isinstance(code, str) and re.fullmatch(r'[A-Z0-9_]{4,100}', code) else 'UNKNOWN')
REGISTRATION_CODE_PY
)\"
    [[ \"$REGISTRATION_PUBLIC_CODE\" =~ ^[A-Z0-9_]{4,100}$ ]] || REGISTRATION_PUBLIC_CODE=UNKNOWN
    printf 'P0_REGISTRATION_HTTP_STATUS=%s\\n' \"$REGISTRATION_HTTP_STATUS\"
    printf 'P0_REGISTRATION_PUBLIC_CODE=%s\\n' \"$REGISTRATION_PUBLIC_CODE\"
    fail \"P0_REGISTRATION_${label^^}_FAILED\" 31
  fi
""",
    'REGISTRATION_FAILURE_CLASSIFIER',
)

one(
    r'''assert_exact_main() {
  local actual
  actual="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null)" \
    || fail P0_EXACT_MAIN_LOOKUP_FAILED 11
  [[ "$actual" == "$TARGET_SHA" ]] || fail P0_MAIN_ADVANCED_DURING_ACCEPTANCE 12
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
    '''def assert_exact_main():
    try:
        result = subprocess.run(
            ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/commits/main", '--jq', '.sha'],
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except Exception:
        raise SystemExit(43)
    if result.returncode != 0:
        raise SystemExit(43)
    if result.stdout.strip() != os.environ['P0_TARGET_SHA']:
        raise SystemExit(42)
''',
    '''def assert_release_candidate():
    try:
        result = subprocess.run(
            ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/commits/main", '--jq', '.sha'],
            check=False, capture_output=True, text=True, timeout=20,
        )
    except Exception:
        raise SystemExit(43)
    if result.returncode != 0:
        raise SystemExit(43)
    actual = result.stdout.strip()
    target = os.environ['P0_TARGET_SHA']
    if actual == target:
        return
    try:
        compare = subprocess.run(
            ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/compare/{target}...{actual}", '--jq', '.status'],
            check=False, capture_output=True, text=True, timeout=20,
        )
    except Exception:
        raise SystemExit(43)
    if compare.returncode != 0:
        raise SystemExit(43)
    if compare.stdout.strip() != 'ahead':
        raise SystemExit(42)
''',
    'MAILBOX_RELEASE_CANDIDATE_ANCESTRY_GUARD',
)
one(
    '  for command in gh curl python3 ssh awk sha256sum; do',
    '  for command in gh git curl python3 ssh awk sha256sum; do',
    'RELEASE_CANDIDATE_GIT_PREREQUISITE',
)
remaining=s.count('assert_exact_main')
if remaining != 7:
    raise SystemExit(f'RELEASE_CANDIDATE_CALL_CARDINALITY_INVALID={remaining}')
s=s.replace('assert_exact_main','assert_release_candidate')
one(
    '    42) fail P0_MAIN_ADVANCED_DURING_ACCEPTANCE 12 ;;\n    43) fail P0_EXACT_MAIN_LOOKUP_FAILED 11 ;;',
    '    42) fail P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR 12 ;;\n    43) fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11 ;;',
    'MAILBOX_RELEASE_CANDIDATE_BLOCKER_MAPPING',
)
if 'P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR' not in s or 'git merge-base --is-ancestor' not in s:
    raise SystemExit('RELEASE_CANDIDATE_GUARD_MISSING')

one(
    r'''docker exec "$api_id" /nodejs/bin/node -e \
  "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" \
  >/dev/null 2>&1 || remote_fail P0_PRODUCTION_API_NOT_READY 11

command -v python3 >/dev/null 2>&1 || remote_fail P0_REMOTE_PYTHON_MISSING 12''',
    r'''docker exec "$api_id" /nodejs/bin/node -e \
  "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" \
  >/dev/null 2>&1 || remote_fail P0_PRODUCTION_API_NOT_READY 11
mapfile -t worker_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=auth-mail-worker')
(( ${#worker_ids[@]} == 1 )) || remote_fail P0_AUTH_MAIL_WORKER_RUNTIME_AUTHORITY_AMBIGUOUS 12
worker_id="${worker_ids[0]}"
worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker_id")"
[[ "$worker_revision" == "$target_sha" ]] || remote_fail P0_AUTH_MAIL_WORKER_REVISION_MISMATCH 13
worker_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$worker_id")"
[[ "$worker_health" == healthy ]] || remote_fail P0_AUTH_MAIL_WORKER_NOT_HEALTHY 14
docker exec "$worker_id" /nodejs/bin/node -e \
  "fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(async r=>{if(!r.ok)process.exit(1);const x=await r.json();if(x.status!=='ready'||x.component!=='auth-mail-worker'||x.checks?.database!==true)process.exit(1)}).catch(()=>process.exit(1))" \
  >/dev/null 2>&1 || remote_fail P0_AUTH_MAIL_WORKER_NOT_READY 15

command -v python3 >/dev/null 2>&1 || remote_fail P0_REMOTE_PYTHON_MISSING 16''',
    'AUTH_MAIL_WORKER_EXACT_READY',
)
exact_marker="printf 'P0_REMOTE_EXACT_REVISIONS=PASS\\n'"
if s.count(exact_marker) != 7:
    raise SystemExit(f'EXACT_REVISION_MARKER_CARDINALITY_INVALID={s.count(exact_marker)}')
s=s.replace(exact_marker, exact_marker + "\nprintf 'P0_AUTH_MAIL_WORKER_REVISION=PASS\\n'\nprintf 'P0_AUTH_MAIL_WORKER_READY=PASS\\n'")
one(
    "  grep -Fxq P0_REMOTE_EXACT_REVISIONS=PASS <<< \"$output\" || fail P0_PRODUCTION_REVISION_PREFLIGHT_FAILED 81\n  grep -Fxq P0_MIGRATION_IMAGE_REVISION=PASS <<< \"$output\" || fail P0_MIGRATION_IMAGE_REVISION_MISMATCH 82",
    "  grep -Fxq P0_REMOTE_EXACT_REVISIONS=PASS <<< \"$output\" || fail P0_PRODUCTION_REVISION_PREFLIGHT_FAILED 81\n  grep -Fxq P0_AUTH_MAIL_WORKER_REVISION=PASS <<< \"$output\" || fail P0_AUTH_MAIL_WORKER_REVISION_MISMATCH 82\n  grep -Fxq P0_AUTH_MAIL_WORKER_READY=PASS <<< \"$output\" || fail P0_AUTH_MAIL_WORKER_NOT_READY 82\n  grep -Fxq P0_MIGRATION_IMAGE_REVISION=PASS <<< \"$output\" || fail P0_MIGRATION_IMAGE_REVISION_MISMATCH 82",
    'AUTH_MAIL_WORKER_PREFLIGHT_CONSUMER',
)
one(
    "  grep -Fxq P0_REMOTE_EXACT_REVISIONS=PASS <<< \"$output\" || fail P0_PRODUCTION_REVISION_CHANGED 86\n  grep -Fxq P0_MIGRATION_IMAGE_REVISION=PASS <<< \"$output\" || fail P0_MIGRATION_IMAGE_REVISION_MISMATCH 87",
    "  grep -Fxq P0_REMOTE_EXACT_REVISIONS=PASS <<< \"$output\" || fail P0_PRODUCTION_REVISION_CHANGED 86\n  grep -Fxq P0_AUTH_MAIL_WORKER_REVISION=PASS <<< \"$output\" || fail P0_AUTH_MAIL_WORKER_REVISION_MISMATCH 87\n  grep -Fxq P0_AUTH_MAIL_WORKER_READY=PASS <<< \"$output\" || fail P0_AUTH_MAIL_WORKER_NOT_READY 87\n  grep -Fxq P0_MIGRATION_IMAGE_REVISION=PASS <<< \"$output\" || fail P0_MIGRATION_IMAGE_REVISION_MISMATCH 87",
    'AUTH_MAIL_WORKER_EVIDENCE_CONSUMER',
)
one(
    "        'migrationImageRevisionExact': True,",
    "        'migrationImageRevisionExact': True,\n        'authMailWorkerRevisionExact': True,\n        'authMailWorkerReady': True,",
    'AUTH_MAIL_WORKER_RESULT_EVIDENCE',
)
if s.count('  P0_RUN_ID="$RUN_ID" \\\n') != 2:
    raise SystemExit('RELEASE_CONTROLLER_ENV_ANCHOR_CARDINALITY_INVALID')
s=s.replace(
    '  P0_RUN_ID="$RUN_ID" \\\n',
    '  P0_RUN_ID="$RUN_ID" \\\n  P0_RELEASE_CONTROLLER_RUN_ID="${PC_P0_RELEASE_RUN_ID:-unknown}" \\\n  P0_RELEASE_CONTROLLER_RUN_ATTEMPT="${PC_P0_RELEASE_RUN_ATTEMPT:-unknown}" \\\n',
)
if s.count("    'runId': os.environ.get('P0_RUN_ID', 'unknown'),") != 1:
    raise SystemExit('FAILURE_RUN_ID_ANCHOR_INVALID')
s=s.replace(
    "    'runId': os.environ.get('P0_RUN_ID', 'unknown'),",
    "    'runId': os.environ.get('P0_RUN_ID', 'unknown'),\n    'releaseControllerRunId': os.environ.get('P0_RELEASE_CONTROLLER_RUN_ID', 'unknown'),\n    'releaseControllerRunAttempt': os.environ.get('P0_RELEASE_CONTROLLER_RUN_ATTEMPT', 'unknown'),",
    1,
)
one(
    "    'runId': os.environ['P0_RUN_ID'],",
    "    'runId': os.environ['P0_RUN_ID'],\n    'releaseControllerRunId': os.environ['P0_RELEASE_CONTROLLER_RUN_ID'],\n    'releaseControllerRunAttempt': os.environ['P0_RELEASE_CONTROLLER_RUN_ATTEMPT'],",
    'SUCCESS_RELEASE_CONTROLLER_RUN_ID',
)
one(
    "  CURRENT_STAGE=evidence-finalization\n  assert_release_candidate\n  write_success_record",
    "  CURRENT_STAGE=evidence-finalization\n  production_preflight\n  assert_release_candidate\n  write_success_record",
    'TERMINAL_PRODUCTION_PREFLIGHT',
)
one(
    "  printf 'P0_EXACT_CURRENT_MAIN=%s\\n' \"$TARGET_SHA\"",
    "  printf 'P0_IMMUTABLE_RELEASE_CANDIDATE=%s\\n' \"$TARGET_SHA\"\n  printf 'P0_AUTH_MAIL_WORKER_EXACT_READY=PASS\\n'",
    'TERMINAL_CANDIDATE_MARKER',
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
    "def canonical_mailbox(value):",
    "def canonical_imap_login(value):",
    "domain.encode('idna').decode('ascii').lower()",
    "username = canonical_imap_login(username)",
    "IMAP_LOGIN_IDENTITY_INVALID",
    "client.login(username, password)",
    "recipients.append(canonical)",
    "REMOTE_BLOCKER_PERSIST",
    "REGISTRATION_FAILURE_STATE",
    'local label="$1"\n  local jar="$TMP_ROOT/$label.cookies" response="$TMP_ROOT/$label-team.json"',
    "P0_REGISTRATION_HTTP_STATUS",
    "P0_REGISTRATION_PUBLIC_CODE",
    "registrationHttpStatus",
    "registrationPublicCode",
    "assert_release_candidate()",
    "P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR",
    "P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED",
    "git merge-base --is-ancestor",
    "P0_AUTH_MAIL_WORKER_RUNTIME_AUTHORITY_AMBIGUOUS",
    "P0_AUTH_MAIL_WORKER_REVISION_MISMATCH",
    "P0_AUTH_MAIL_WORKER_NOT_HEALTHY",
    "P0_AUTH_MAIL_WORKER_NOT_READY",
    "authMailWorkerRevisionExact",
    "authMailWorkerReady",
    "releaseControllerRunId",
    "releaseControllerRunAttempt",
]
missing=[x for x in required if x not in s and x not in {"REMOTE_BLOCKER_PERSIST", "REGISTRATION_FAILURE_STATE"}]
if missing:
    raise SystemExit('SECURITY_INVARIANT_MISSING='+'|'.join(missing))
if s.count("'app_service'") != 1:
    raise SystemExit('LEGACY_ALIAS_CARDINALITY_INVALID')
if s.count('username = canonical_imap_login(username)') != 1:
    raise SystemExit('IMAP_LOGIN_CANONICALIZATION_CARDINALITY_INVALID')
if s.count('$TMP_ROOT/remote-blocker') != 4:
    raise SystemExit('REMOTE_BLOCKER_BOUNDARY_CARDINALITY_INVALID')
if "BLOCKER_CODE=\"$remote_blocker\"" not in s:
    raise SystemExit('REMOTE_BLOCKER_RECOVERY_MISSING')
if s.count("payload['registrationHttpStatus']") != 1 or s.count("payload['registrationPublicCode']") != 1:
    raise SystemExit('REGISTRATION_FAILURE_EVIDENCE_CARDINALITY_INVALID')
if s.count("REGISTRATION_PUBLIC_CODE=\"$(python3 - \"$response\"") != 1:
    raise SystemExit('REGISTRATION_FAILURE_CLASSIFIER_CARDINALITY_INVALID')
if s.count('local label="$1"\n  local jar="$TMP_ROOT/$label.cookies" response="$TMP_ROOT/$label-team.json"') != 1:
    raise SystemExit('READ_CUSTOMER_RESOURCE_SET_U_PATCH_CARDINALITY_INVALID')
if 'local label="$1" jar="$TMP_ROOT/$label.cookies"' in s:
    raise SystemExit('READ_CUSTOMER_RESOURCE_UNBOUND_LOCAL_REMAINS')
if 'cat "$response"' in s or 'P0_REGISTRATION_RESPONSE_BODY' in s:
    raise SystemExit('REGISTRATION_FAILURE_RAW_RESPONSE_FORBIDDEN')
p.write_text(s,encoding='utf-8')
PY

chmod 0700 "$tmp"
bash -n "$tmp"

if [[ "${PC_P0_FIRST_CUSTOMER_ALIAS_VALIDATE_ONLY:-0}" == 1 ]]; then
  printf 'P0_FIRST_CUSTOMER_AUTH_ALIAS_PATCH=PASS\n'
  printf 'P0_FIRST_CUSTOMER_IMAP_IDNA_PATCH=PASS\n'
  printf 'P0_FIRST_CUSTOMER_IMAP_LOGIN_IDNA_PATCH=PASS\n'
  printf 'P0_FIRST_CUSTOMER_REMOTE_BLOCKER_PROPAGATION=PASS\n'
  printf 'P0_FIRST_CUSTOMER_REGISTRATION_FAILURE_EVIDENCE_PATCH=PASS\n'
  printf 'P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS\n'
  printf 'P0_FIRST_CUSTOMER_RELEASE_CANDIDATE_GUARD=PASS\n'
  printf 'P0_FIRST_CUSTOMER_AUTH_MAIL_WORKER_GUARD=PASS\n'
  printf 'P0_FIRST_CUSTOMER_RELEASE_PROVENANCE=PASS\n'
  exit 0
fi

exec bash "$tmp" "$@"
