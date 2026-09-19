#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${TARGET_SHA:?TARGET_SHA is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-smtp-stage-probe current-main'
EXPECTED_DEPLOYED_SHA='7b66f65f8fc7fc4bbedb56c94088ad1473462c92'

key_path="$RUNNER_TEMP/pc-reviewer-smtp-stage-key"
known_hosts="$RUNNER_TEMP/pc-reviewer-smtp-stage-known-hosts"
result_file="$RUNNER_TEMP/pc-reviewer-smtp-stage-result.txt"
scan=''
scan_raw=''
match=''
PUBLISHED=0
RESULT='FAIL'
LAST_STAGE='NOT_RUN'
SMTP_CODE='NONE'
SMTP_CODE_FAMILY='NONE'
MAIL_SENT='NO'
FAILURE_STAGE='BOOTSTRAP'

cleanup() {
  rm -f -- "$key_path" "$known_hosts" "$result_file"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$scan_raw" ]] || rm -f -- "$scan_raw"
  [[ -z "$match" ]] || rm -f -- "$match"
}

current_main() {
  gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null
}

guard_main() {
  [[ "$(current_main)" == "$TARGET_SHA" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
  [[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
  [[ -z "$(git status --porcelain=v1)" ]]
  git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"
}

publish() {
  [[ "$PUBLISHED" == '0' ]] || return 0
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer SMTP stage probe

- command: \`$COMMAND\`
- exact main: \`$TARGET_SHA\`
- expected active API/Web revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`$RESULT\`
- last SMTP stage: \`$LAST_STAGE\`
- SMTP code: \`$SMTP_CODE\`
- SMTP code family: \`$SMTP_CODE_FAMILY\`
- mail sent: \`$MAIL_SENT\`
- failure stage: \`$FAILURE_STAGE\`
- reviewer identity / sender / SMTP credentials / raw protocol output: \`NOT_PUBLISHED\`
- reset request / password / MFA / session mutation: \`NONE\`
- database write / deployment / container lifecycle mutation: \`NONE\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null || true
  PUBLISHED=1
}

on_error() {
  local rc=$?
  trap - ERR
  publish || true
  exit "$rc"
}

trap cleanup EXIT
trap on_error ERR

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
guard_main

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"

FAILURE_STAGE='SSH_INPUT_VALIDATION'
[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]

domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"

validate_key() {
  local source="$1" public_key
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  public_key="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$public_key" 2>/dev/null \
    || { rm -f "$public_key"; return 1; }
  rm -f "$public_key"
}

try_key() {
  local raw="$1" plain escaped decoded
  [[ -n "$raw" ]] || return 1
  plain="$(mktemp)"
  escaped="$(mktemp)"
  decoded="$(mktemp)"
  printf '%s\n' "$raw" > "$plain"
  validate_key "$plain" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$escaped"
  validate_key "$escaped" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "$raw" | base64 --decode > "$decoded" 2>/dev/null \
    && validate_key "$decoded" \
    && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  rm -f "$plain" "$escaped" "$decoded"
  return 1
}

FAILURE_STAGE='SSH_PRIVATE_KEY_INVALID'
try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

guard_main

FAILURE_STAGE='SSH_HOST_KEY_SCAN_FAILED'
scan="$(mktemp)"
scan_raw="$(mktemp)"
match="$(mktemp)"
scan_ready=0
for attempt in 1 2 3; do
  : > "$scan_raw"
  : > "$scan"
  /usr/bin/ssh-keyscan -T 10 -p "$port" "$host" > "$scan_raw" 2>/dev/null || true
  if [[ -s "$scan_raw" ]]; then
    sort -u "$scan_raw" > "$scan"
    if [[ -s "$scan" ]]; then
      scan_ready=1
      break
    fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$scan_ready" == '1' ]]

FAILURE_STAGE='SSH_HOST_KEY_FINGERPRINT_MISMATCH'
while IFS= read -r line; do
  fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
[[ "$(grep -c . "$match" || true)" == '1' ]]
mv "$match" "$known_hosts"
match=''
rm -f -- "$scan" "$scan_raw"
scan=''
scan_raw=''
chmod 0600 "$known_hosts"

guard_main

FAILURE_STAGE='REMOTE_EXECUTION'
ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$TARGET_SHA' '$EXPECTED_DEPLOYED_SHA'" > "$result_file" <<'REMOTE'
set -Eeuo pipefail
target_sha="$1"
expected_revision="$2"
[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$expected_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
command -v python3 >/dev/null 2>&1

remote_tmp="$(mktemp -d /root/pc-reviewer-smtp-stage.XXXXXX)"
chmod 0700 "$remote_tmp"
cleanup_remote() { rm -rf -- "$remote_tmp"; }
trap cleanup_remote EXIT

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$project" ]]
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" == "$web_revision" ]]
[[ "$api_revision" == "$expected_revision" ]]

subject_output="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const fail = (code) => { throw new Error(code); };
const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/;
let db;
(async () => {
  const databaseUrl = String(process.env.STAFF_DATABASE_URL || '').trim();
  if (!databaseUrl) fail('P0_STAFF_DATABASE_URL_MISSING');
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const principals = await db.$queryRawUnsafe(`
    SELECT current_user AS user_name,
           rolsuper,
           rolbypassrls,
           has_table_privilege(current_user, 'public.users', 'SELECT') AS can_read_users,
           has_table_privilege(current_user, 'public.user_orgs', 'SELECT') AS can_read_memberships,
           has_table_privilege(current_user, 'public.organizations', 'SELECT') AS can_read_organizations,
           has_table_privilege(current_user, 'auth.staff_assignments', 'SELECT') AS can_read_assignments,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_preflight()'), 'EXECUTE'), false) AS preflight_execute,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_login_readiness()'), 'EXECUTE'), false) AS readiness_execute,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_password_reset_subject()'), 'EXECUTE'), false) AS reset_subject_execute
    FROM pg_roles WHERE rolname = current_user
  `);
  const p = principals[0];
  if (!p || p.user_name !== 'pc_staff_runtime' || p.rolsuper || p.rolbypassrls
      || p.can_read_users || p.can_read_memberships || p.can_read_organizations || p.can_read_assignments
      || !p.preflight_execute || !p.readiness_execute || !p.reset_subject_execute) {
    fail('P0_REVIEWER_SMTP_PRINCIPAL_BOUNDARY_INVALID');
  }
  const rows = await db.$queryRawUnsafe(`
    SELECT preflight.active_owner_count,
           preflight.usable_reviewer_count,
           readiness.assignment_ready_count,
           readiness.active_identity_ready_count,
           readiness.membership_ready_count,
           readiness.password_ready_count,
           readiness.mfa_enrolled_ready_count,
           readiness.login_ready_count,
           auth.staff_reviewer_password_reset_subject() AS reviewer_email
    FROM auth.staff_reviewer_preflight() preflight
    CROSS JOIN auth.staff_reviewer_login_readiness() readiness
  `);
  if (rows.length !== 1) fail('P0_REVIEWER_SMTP_READINESS_CARDINALITY_INVALID');
  const row = rows[0];
  const counts = [row.active_owner_count,row.usable_reviewer_count,row.assignment_ready_count,row.active_identity_ready_count,row.membership_ready_count,row.password_ready_count,row.mfa_enrolled_ready_count,row.login_ready_count].map((v) => Number(v || 0));
  if (counts.join('|') !== '1|1|1|1|1|0|0|0') fail('P0_REVIEWER_SMTP_READINESS_NOT_EXACT');
  const email = String(row.reviewer_email || '');
  if (!emailPattern.test(email) || email.length > 254) fail('P0_REVIEWER_SMTP_SUBJECT_INVALID');
  process.stdout.write(`SUBJECT|${email}`);
})().catch((error) => {
  const code = String(error?.message || 'P0_REVIEWER_SMTP_DB_FAILURE').replace(/[^A-Z0-9_-]/gi, '').slice(0, 96);
  process.stderr.write(`${code || 'P0_REVIEWER_SMTP_DB_FAILURE'}\n`);
  process.exitCode = 1;
}).finally(async () => { if (db) await db.$disconnect().catch(() => undefined); });
NODE
)"
IFS='|' read -r subject_tag reviewer_email <<< "$subject_output"
[[ "$subject_tag" == 'SUBJECT' ]]
[[ "$reviewer_email" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$ ]]
(( ${#reviewer_email} <= 254 ))
unset subject_output

smtp_json="$(docker exec -i "$web_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const payload = {
  host: String(process.env.PC_SMTP_HOST || '').trim(),
  port: String(process.env.PC_SMTP_PORT || '465').trim(),
  user: String(process.env.PC_SMTP_USER || ''),
  pass: String(process.env.PC_SMTP_PASS || ''),
  from: String(process.env.PC_MAIL_FROM || process.env.PC_SMTP_USER || '').trim(),
};
process.stdout.write(JSON.stringify(payload));
NODE
)"
[[ -n "$smtp_json" ]]
printf '%s' "$smtp_json" > "$remote_tmp/smtp.json"
printf '%s' "$reviewer_email" > "$remote_tmp/recipient.txt"
unset smtp_json reviewer_email
chmod 0600 "$remote_tmp/smtp.json" "$remote_tmp/recipient.txt"

cat > "$remote_tmp/probe.py" <<'PY'
import base64
import json
import re
import socket
import ssl
import sys

cfg_path, recipient_path = sys.argv[1:3]
with open(cfg_path, 'r', encoding='utf-8') as handle:
    cfg = json.load(handle)
with open(recipient_path, 'r', encoding='utf-8') as handle:
    recipient = handle.read().strip()

def mailbox(value):
    value = str(value or '').strip()
    if value.count('@') != 1 or any(c in value for c in '\r\n\x00<> '):
        raise ValueError('mailbox')
    local, domain = value.rsplit('@', 1)
    local.encode('ascii')
    domain_ascii = domain.encode('idna').decode('ascii').lower()
    if not local or not re.fullmatch(r'[\x21-\x7e]+', local) or not re.fullmatch(r'[A-Za-z0-9.-]+', domain_ascii):
        raise ValueError('mailbox')
    return f'{local}@{domain_ascii}'

def emit(result, stage, code='NONE'):
    family = f'{code[0]}XX' if re.fullmatch(r'[2-5][0-9]{2}', code) else 'NONE'
    print(f'PROBE_RESULT={result}')
    print(f'LAST_STAGE={stage}')
    print(f'SMTP_CODE={code}')
    print(f'SMTP_CODE_FAMILY={family}')
    print('MAIL_SENT=NO')
    print('PRODUCTION_MUTATION=NONE')

host = str(cfg.get('host') or '').strip()
port_raw = str(cfg.get('port') or '465').strip()
user = str(cfg.get('user') or '')
password = str(cfg.get('pass') or '')
try:
    sender = mailbox(cfg.get('from') or user)
    recipient = mailbox(recipient)
    port = int(port_raw)
except Exception:
    emit('FAIL', 'CONFIG')
    raise SystemExit(0)
if host != 'mail.hosting.reg.ru' or port != 465 or not user or not password or any(c in user + password for c in '\r\n\x00'):
    emit('FAIL', 'CONFIG')
    raise SystemExit(0)

stage = 'CONNECT'
try:
    raw = socket.create_connection((host, port), timeout=5.0)
    context = ssl.create_default_context()
    sock = context.wrap_socket(raw, server_hostname=host)
    sock.settimeout(5.0)
    stream = sock.makefile('rb')

    def read_response():
        first = stream.readline(4096)
        if not first or len(first) < 4 or not first[:3].isdigit():
            return None
        code = first[:3].decode('ascii', 'strict')
        if first[3:4] == b'-':
            while True:
                line = stream.readline(4096)
                if not line:
                    return None
                if line.startswith(code.encode() + b' '):
                    break
        return code

    def command(label, value, allowed):
        nonlocal_stage[0] = label
        sock.sendall(value + b'\r\n')
        code = read_response()
        if code not in allowed:
            emit('FAIL', label, code or 'NONE')
            try: sock.sendall(b'RSET\r\n')
            except Exception: pass
            try: sock.sendall(b'QUIT\r\n')
            except Exception: pass
            raise SystemExit(0)
        return code

    nonlocal_stage = ['GREETING']
    code = read_response()
    if code != '220':
        emit('FAIL', 'GREETING', code or 'NONE')
        raise SystemExit(0)
    command('EHLO', b'EHLO transparent-price.local', {'250'})
    auth = base64.b64encode(('\x00' + user + '\x00' + password).encode('utf-8'))
    command('AUTH', b'AUTH PLAIN ' + auth, {'235'})
    command('MAIL_FROM', f'MAIL FROM:<{sender}>'.encode('ascii'), {'250'})
    rcpt_code = command('RCPT_TO', f'RCPT TO:<{recipient}>'.encode('ascii'), {'250','251'})
    sock.sendall(b'RSET\r\n')
    reset_code = read_response()
    if reset_code != '250':
        emit('FAIL', 'RSET', reset_code or 'NONE')
        raise SystemExit(0)
    sock.sendall(b'QUIT\r\n')
    emit('PASS', 'RCPT_TO', rcpt_code)
except SystemExit:
    raise
except Exception:
    emit('FAIL', nonlocal_stage[0] if 'nonlocal_stage' in locals() else stage)
PY
chmod 0700 "$remote_tmp/probe.py"
python3 "$remote_tmp/probe.py" "$remote_tmp/smtp.json" "$remote_tmp/recipient.txt"
REMOTE

FAILURE_STAGE='EVIDENCE_VALIDATION'
result="$(grep '^PROBE_RESULT=' "$result_file" | tail -n1 | cut -d= -f2-)"
stage="$(grep '^LAST_STAGE=' "$result_file" | tail -n1 | cut -d= -f2-)"
code="$(grep '^SMTP_CODE=' "$result_file" | tail -n1 | cut -d= -f2-)"
family="$(grep '^SMTP_CODE_FAMILY=' "$result_file" | tail -n1 | cut -d= -f2-)"
mail_sent="$(grep '^MAIL_SENT=' "$result_file" | tail -n1 | cut -d= -f2-)"
mutation="$(grep '^PRODUCTION_MUTATION=' "$result_file" | tail -n1 | cut -d= -f2-)"
[[ "$result" == 'PASS' || "$result" == 'FAIL' ]]
[[ "$stage" =~ ^(CONNECT|CONFIG|GREETING|EHLO|AUTH|MAIL_FROM|RCPT_TO|RSET)$ ]]
[[ "$code" == 'NONE' || "$code" =~ ^[2-5][0-9]{2}$ ]]
[[ "$family" == 'NONE' || "$family" =~ ^[2-5]XX$ ]]
[[ "$mail_sent" == 'NO' ]]
[[ "$mutation" == 'NONE' ]]

RESULT="$result"
LAST_STAGE="$stage"
SMTP_CODE="$code"
SMTP_CODE_FAMILY="$family"
MAIL_SENT='NO'
FAILURE_STAGE='NONE'
guard_main
publish
printf 'P0_REVIEWER_SMTP_STAGE_PROBE=%s\n' "$RESULT"
printf 'P0_REVIEWER_SMTP_LAST_STAGE=%s\n' "$LAST_STAGE"
printf 'P0_REVIEWER_SMTP_CODE=%s\n' "$SMTP_CODE"
