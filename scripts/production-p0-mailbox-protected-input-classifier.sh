#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
: "${TARGET_SHA:?TARGET_SHA is required}"

RELEASE_ISSUE_NUMBER='3072'
ACCEPTANCE_MAIL_DOMAIN='acceptance.xn----8sbjf4befbjgs9b.xn--p1ai'
RESULT='FAIL'
REASON='UNEXPECTED_CLASSIFIER_FAILURE'
PUBLISHED=0

current_main() {
  gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null
}

guard_main() {
  [[ "$(current_main)" == "$TARGET_SHA" ]]
}

publish() {
  [[ "$PUBLISHED" == 0 ]] || return 0
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 mailbox protected-input classifier

- exact main: \`$TARGET_SHA\`
- result: \`$RESULT\`
- protected-input reason: \`$REASON\`
- SMTP / IMAP / SSH / Web container access: \`NONE\`
- reviewer identity / reset / password / TOTP / session access: \`NONE\`
- production / database / runtime / deployment mutation: \`NONE\`
- secret values / lengths / hashes / mailbox identity / template / credentials: \`NOT_PUBLISHED\`
- new recurring cost: \`0 RUB\`" >/dev/null || true
  PUBLISHED=1
}

on_error() {
  local rc=$?
  trap - ERR
  publish || true
  exit "$rc"
}

trap on_error ERR

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
[[ -z "$(git status --porcelain=v1)" ]]
guard_main

REASON="$(python3 - <<'PY'
import os
import re

DOMAIN = 'acceptance.xn----8sbjf4befbjgs9b.xn--p1ai'
ALLOWED = {
    'PASS',
    'MAILBOX_USER_MISSING',
    'MAILBOX_USER_UNSAFE_SCALAR',
    'MAILBOX_USER_SYNTAX',
    'MAILBOX_USER_DOMAIN',
    'MAILBOX_PASSWORD_MISSING',
    'MAILBOX_PASSWORD_UNSAFE_SCALAR',
    'EMAIL_TEMPLATE_MISSING',
    'EMAIL_TEMPLATE_UNSAFE_SCALAR',
    'EMAIL_TEMPLATE_SHAPE',
    'RENDERED_RECIPIENT_SYNTAX',
    'RENDERED_RECIPIENT_DOMAIN',
}

def emit(reason):
    if reason not in ALLOWED:
        raise SystemExit(90)
    print(reason)
    raise SystemExit(0)

def unsafe(value):
    return any(c in value for c in ('\n', '\r', '\x00'))

def ascii_email(value):
    try:
        if value.count('@') != 1:
            return None
        local, host = value.rsplit('@', 1)
        local.encode('ascii')
        host = host.encode('idna').decode('ascii').lower()
        result = f'{local}@{host}'
        if len(result) > 254:
            return None
        if not re.fullmatch(r'[A-Za-z0-9._+-]{1,64}@[A-Za-z0-9.-]{1,189}', result):
            return None
        return result
    except Exception:
        return None

user_raw = os.environ.get('MAILBOX_USER', '')
password = os.environ.get('MAILBOX_PASSWORD', '')
template_raw = os.environ.get('EMAIL_TEMPLATE', '')
run_id = os.environ.get('GITHUB_RUN_ID', '')

if not user_raw:
    emit('MAILBOX_USER_MISSING')
if unsafe(user_raw):
    emit('MAILBOX_USER_UNSAFE_SCALAR')
user = ascii_email(user_raw.strip().lower())
if user is None:
    emit('MAILBOX_USER_SYNTAX')
if not user.endswith('@' + DOMAIN):
    emit('MAILBOX_USER_DOMAIN')

if not password:
    emit('MAILBOX_PASSWORD_MISSING')
if unsafe(password):
    emit('MAILBOX_PASSWORD_UNSAFE_SCALAR')

if not template_raw:
    emit('EMAIL_TEMPLATE_MISSING')
if unsafe(template_raw):
    emit('EMAIL_TEMPLATE_UNSAFE_SCALAR')
template = template_raw.strip().lower()

if template.count('{identity}') == 1 and '{run}' not in template and '{slot}' not in template:
    recipient_raw = template.replace('{identity}', f'webdelivery-{run_id}')
elif template.count('{identity}') == 0 and template.count('{run}') == 1 and template.count('{slot}') == 1:
    recipient_raw = template.replace('{run}', run_id).replace('{slot}', 'webdelivery')
else:
    emit('EMAIL_TEMPLATE_SHAPE')

recipient = ascii_email(recipient_raw)
if recipient is None:
    emit('RENDERED_RECIPIENT_SYNTAX')
if not recipient.endswith('@' + DOMAIN):
    emit('RENDERED_RECIPIENT_DOMAIN')

emit('PASS')
PY
)"

[[ "$REASON" =~ ^(PASS|MAILBOX_USER_MISSING|MAILBOX_USER_UNSAFE_SCALAR|MAILBOX_USER_SYNTAX|MAILBOX_USER_DOMAIN|MAILBOX_PASSWORD_MISSING|MAILBOX_PASSWORD_UNSAFE_SCALAR|EMAIL_TEMPLATE_MISSING|EMAIL_TEMPLATE_UNSAFE_SCALAR|EMAIL_TEMPLATE_SHAPE|RENDERED_RECIPIENT_SYNTAX|RENDERED_RECIPIENT_DOMAIN)$ ]]
guard_main || {
  trap - ERR
  exit 91
}
if [[ "$REASON" == PASS ]]; then
  RESULT='PASS'
fi

publish
[[ "$RESULT" == PASS ]]
