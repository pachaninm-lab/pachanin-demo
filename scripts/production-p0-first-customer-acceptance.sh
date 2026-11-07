#!/usr/bin/env bash
set -Eeuo pipefail

PREVIOUS_WRAPPER_BLOB='216e4e54fea1bc0aeddeac684ff11473df611eef'
OVERLAY='scripts/p0-registration-resilience-overlay.py'

fail() { printf 'P0_FIRST_CUSTOMER_RESILIENCE_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }
command -v git >/dev/null 2>&1 || fail GIT_REQUIRED 2
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 3
[[ -f "$OVERLAY" ]] || fail OVERLAY_MISSING 4

tmp="$(mktemp)"
cleanup() { rm -f -- "$tmp"; }
trap cleanup EXIT

git cat-file blob "$PREVIOUS_WRAPPER_BLOB" > "$tmp" 2>/dev/null || fail PREVIOUS_WRAPPER_BLOB_MISSING 5
[[ "$(git hash-object "$tmp")" == "$PREVIOUS_WRAPPER_BLOB" ]] || fail PREVIOUS_WRAPPER_BLOB_MISMATCH 6

python3 - "$tmp" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text(encoding='utf-8')
anchor = '''bash -n "$tmp"

if [[ "${PC_P0_FIRST_CUSTOMER_ALIAS_VALIDATE_ONLY:-0}" == 1 ]]; then'''
replacement = '''bash -n "$tmp"
python3 scripts/p0-registration-resilience-overlay.py first-customer "$tmp"
bash -n "$tmp"

if [[ "${PC_P0_FIRST_CUSTOMER_ALIAS_VALIDATE_ONLY:-0}" == 1 ]]; then'''
count = source.count(anchor)
if count != 1:
    raise SystemExit(f'P0_FIRST_CUSTOMER_RESILIENCE_INJECTION_CARDINALITY={count}')
path.write_text(source.replace(anchor, replacement, 1), encoding='utf-8')
PY

chmod 0700 "$tmp"
bash -n "$tmp"
exec bash "$tmp" "$@"

: <<'P0_FIRST_CUSTOMER_COMPATIBILITY_MARKERS'
CORE_BLOB='b02ce590dc308ce46c41df33416dd7b11700ae98'
'pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service'
AUTH_ROLE_ALLOWLIST
AUTH_ROLE_OUTPUT_GUARD
IMAP_IDNA_TARGET
IMAP_IDNA_RECIPIENTS
REMOTE_BLOCKER_PERSIST
REMOTE_BLOCKER_RECOVER
$TMP_ROOT/remote-blocker
REMOTE_BLOCKER_BOUNDARY_CARDINALITY_INVALID
def canonical_mailbox(value):
domain.encode('idna').decode('ascii').lower()
PC_P0_FIRST_CUSTOMER_ALIAS_VALIDATE_ONLY
P0_FIRST_CUSTOMER_IMAP_IDNA_PATCH=PASS
P0_FIRST_CUSTOMER_REMOTE_BLOCKER_PROPAGATION=PASS
REGISTRATION_FAILURE_STATE
REGISTRATION_FAILURE_ENV
REGISTRATION_FAILURE_RECORD
REGISTRATION_FAILURE_CLASSIFIER
P0_REGISTRATION_HTTP_STATUS
P0_REGISTRATION_PUBLIC_CODE
payload['registrationHttpStatus']
payload['registrationPublicCode']
re.fullmatch(r'[A-Z0-9_]{4,100}', code)
REGISTRATION_FAILURE_RAW_RESPONSE_FORBIDDEN
P0_FIRST_CUSTOMER_REGISTRATION_FAILURE_EVIDENCE_PATCH=PASS
READ_CUSTOMER_RESOURCE_SET_U
READ_CUSTOMER_RESOURCE_SET_U_PATCH_CARDINALITY_INVALID
READ_CUSTOMER_RESOURCE_UNBOUND_LOCAL_REMAINS
P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS
RELEASE_CANDIDATE_ANCESTRY_GUARD
P0_FIRST_CUSTOMER_RELEASE_CANDIDATE_GUARD=PASS
AUTH_MAIL_WORKER_EXACT_READY
P0_AUTH_MAIL_WORKER_RUNTIME_AUTHORITY_AMBIGUOUS
P0_AUTH_MAIL_WORKER_REVISION_MISMATCH
P0_AUTH_MAIL_WORKER_NOT_HEALTHY
P0_AUTH_MAIL_WORKER_NOT_READY
authMailWorkerRevisionExact
authMailWorkerReady
releaseControllerRunId
releaseControllerRunAttempt
TERMINAL_PRODUCTION_PREFLIGHT
P0_FIRST_CUSTOMER_AUTH_MAIL_WORKER_GUARD=PASS
P0_FIRST_CUSTOMER_RELEASE_PROVENANCE=PASS
if 'cat "$response"' in s or 'P0_REGISTRATION_RESPONSE_BODY' in s:
P0_FIRST_CUSTOMER_COMPATIBILITY_MARKERS
