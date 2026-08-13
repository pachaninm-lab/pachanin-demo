#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-smtp-rcpt-diagnose current-main'

key_path="$RUNNER_TEMP/pc-p0-reviewer-rcpt-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-rcpt-known-hosts"
TARGET_SHA='unknown'
failure_reason='BOOTSTRAP_FAILED'
result_published=0

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer SMTP recipient diagnostic

- exact main: \`$TARGET_SHA\`
- result: \`FAIL_CLOSED\`
- blocker: \`REVIEWER_SMTP_RCPT_DIAGNOSTIC_FAILED\`
- failure class: \`$failure_reason\`
- reviewer identity exposure: \`NONE\`
- mail sent: \`NO\`
- DATA command: \`NO\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null || true
  fi
  exit "$rc"
}

trap cleanup EXIT
trap publish_failure ERR

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

guard_main() {
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
  [[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
  [[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
}

failure_reason='MAIN_GUARD_FAILED'
TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
guard_main
[[ -z "$(git status --porcelain=v1)" ]]

host="$(trim "${PC_PROD_HOST:-}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"

failure_reason='SSH_AUTHORITY_INVALID'
[[ -n "$host" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
mapfile -t dns_ipv4 < <(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u)
(( ${#dns_ipv4[@]} >= 1 ))
printf '%s\n' "${dns_ipv4[@]}" | grep -Fxq "$host"

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

validate_key() {
  local source="$1" pub
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  pub="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }
  rm -f "$pub"
}

try_key() {
  local raw="$1" plain escaped decoded
  [[ -n "$raw" ]] || return 1
  plain="$(mktemp)"; escaped="$(mktemp)"; decoded="$(mktemp)"
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

failure_reason='SSH_PRIVATE_KEY_INVALID'
try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

failure_reason='SSH_HOST_KEY_INVALID'
scan="$(mktemp)"; match="$(mktemp)"
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]]
while IFS= read -r line; do
  got="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$got" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
rm -f "$scan"
[[ "$(grep -c . "$match" || true)" == '1' ]]
mv "$match" "$known_hosts"
chmod 0600 "$known_hosts"

failure_reason='MAIN_GUARD_FAILED'
guard_main

failure_reason='REMOTE_DIAGNOSTIC_FAILED'
result="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$TARGET_SHA'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
target_sha="$1"
[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$project" ]]
mapfile -t api_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ && "$web_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$api_revision" == "$web_revision" ]]
unset api_revision web_revision project

# Resolve the unique reviewer only inside REG.RU. The email is captured into a
# root-shell variable and never reaches SSH stdout, Actions env, artifacts,
# repository files or process arguments.
subject_output="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - 2>/dev/null <<'NODE'
const { PrismaClient } = require('@prisma/client');
let db;
const fail = (code) => { throw new Error(code); };
(async () => {
  const databaseUrl = String(process.env.STAFF_DATABASE_URL || '').trim();
  if (!databaseUrl) fail('STAFF_DATABASE_URL_MISSING');
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const principals = await db.$queryRawUnsafe(`
    SELECT current_user AS user_name,
           rolsuper,
           rolbypassrls,
           has_table_privilege(current_user, 'public.users', 'SELECT') AS can_read_users,
           has_table_privilege(current_user, 'public.user_orgs', 'SELECT') AS can_read_memberships,
           has_table_privilege(current_user, 'public.organizations', 'SELECT') AS can_read_organizations,
           has_table_privilege(current_user, 'auth.staff_assignments', 'SELECT') AS can_read_assignments,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_password_reset_subject()'), 'EXECUTE'), false) AS reset_subject_execute
    FROM pg_roles
    WHERE rolname = current_user
  `);
  const p = principals[0];
  if (!p || p.user_name !== 'pc_staff_runtime' || p.rolsuper || p.rolbypassrls
      || p.can_read_users || p.can_read_memberships || p.can_read_organizations || p.can_read_assignments
      || !p.reset_subject_execute) fail('REVIEWER_SUBJECT_PRINCIPAL_BOUNDARY_INVALID');
  const rows = await db.$queryRawUnsafe(`SELECT auth.staff_reviewer_password_reset_subject() AS reviewer_email`);
  if (rows.length !== 1) fail('REVIEWER_SUBJECT_CARDINALITY_INVALID');
  const email = String(rows[0].reviewer_email || '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(email) || email.length > 254) {
    fail('REVIEWER_SUBJECT_INVALID');
  }
  process.stdout.write(`SUBJECT|${email}`);
})().catch(() => { process.exitCode = 1; }).finally(async () => {
  if (db) await db.$disconnect().catch(() => undefined);
});
NODE
)"
IFS='|' read -r subject_tag reviewer_email <<< "$subject_output"
[[ "$subject_tag" == 'SUBJECT' ]]
[[ "$reviewer_email" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$ ]]
(( ${#reviewer_email} <= 254 ))
unset subject_output subject_tag

# The reviewer address travels to the Web container through stdin only. The
# bootstrap shell consumes the first line into a transient environment variable;
# the remaining stdin is the Node program. No process argument contains PII.
probe_output="$({
  printf '%s\n' "$reviewer_email"
  cat <<'NODE'
const tls = require('node:tls');
const started = Date.now();
let stageStarted = started;
let lastStage = 'CONNECT';
let responseBudgetExceeded = false;
let appBudgetExceeded = false;
let completed = false;
let buffer = '';
let waiter = null;

const clean = (value) => {
  const v = String(value || '').trim();
  return v && !/[\r\n\0]/.test(v) ? v : '';
};
const host = clean(process.env.PC_SMTP_HOST);
const user = clean(process.env.PC_SMTP_USER);
const pass = clean(process.env.PC_SMTP_PASS);
const from = clean(process.env.PC_MAIL_FROM) || user;
const recipient = clean(process.env.P0_RCPT_TO);
const port = Number(clean(process.env.PC_SMTP_PORT) || '465');

function bucket(ms) {
  if (!Number.isFinite(ms)) return 'UNKNOWN';
  if (ms <= 2500) return 'LE_2500';
  if (ms <= 5000) return 'LE_5000';
  if (ms <= 7500) return 'LE_7500';
  if (ms <= 10000) return 'LE_10000';
  return 'GT_10000';
}
function emit(config, result) {
  if (completed) return;
  completed = true;
  const elapsed = Date.now() - started;
  if (elapsed > 7500) appBudgetExceeded = true;
  console.log('RUNTIME_PAIR=CONSISTENT');
  console.log('REVIEWER_SUBJECT=UNIQUE_READY');
  console.log(`SMTP_RCPT_CONFIG=${config}`);
  console.log(`SMTP_RCPT_RESULT=${result}`);
  console.log(`SMTP_RCPT_LAST_STAGE=${lastStage}`);
  console.log(`SMTP_RCPT_TOTAL_BUCKET=${bucket(elapsed)}`);
  console.log(`SMTP_RCPT_RESPONSE_5000_BUDGET=${responseBudgetExceeded ? 'FAIL' : 'PASS'}`);
  console.log(`SMTP_RCPT_APP_7500_BUDGET=${appBudgetExceeded ? 'FAIL' : 'PASS'}`);
  console.log('SMTP_RCPT_DATA_COMMAND=NO');
  console.log('SMTP_RCPT_MAIL_SENT=NO');
  console.log('PRODUCTION_MUTATION=NONE');
}

if (!host || !user || !pass || !from || !recipient || !Number.isInteger(port)) {
  emit('MISSING', 'CONFIG_OR_SUBJECT_MISSING');
  process.exit(0);
}
if (host !== 'mail.hosting.reg.ru' || port !== 465) {
  emit('AUTHORITY_MISMATCH', 'CONFIG_AUTHORITY_MISMATCH');
  process.exit(0);
}
if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(recipient) || recipient.length > 254) {
  emit('VALID', 'SUBJECT_INVALID');
  process.exit(0);
}

const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
const totalTimer = setTimeout(() => {
  try { socket.destroy(); } catch {}
  emit('VALID', 'DIAGNOSTIC_TIMEOUT');
}, 15000);
const appTimer = setTimeout(() => { appBudgetExceeded = true; }, 7500);

function finish(config, result) {
  clearTimeout(totalTimer);
  clearTimeout(appTimer);
  try { socket.destroy(); } catch {}
  emit(config, result);
}
function code(response) { return Number(String(response).slice(0, 3)); }
function drain() {
  if (!waiter) return;
  const lines = buffer.split(/\r?\n/);
  const complete = lines.findIndex((line) => /^\d{3} /.test(line));
  if (complete < 0) return;
  const response = lines.slice(0, complete + 1).join('\n');
  buffer = lines.slice(complete + 1).join('\n');
  const resolve = waiter;
  waiter = null;
  if (Date.now() - stageStarted > 5000) responseBudgetExceeded = true;
  resolve(response);
}
function nextResponse(stageName) {
  lastStage = stageName;
  stageStarted = Date.now();
  return new Promise((resolve) => { waiter = resolve; drain(); });
}
async function command(value, stageName) {
  socket.write(`${value}\r\n`);
  const response = await nextResponse(stageName);
  const smtpCode = code(response);
  if (smtpCode < 200 || smtpCode >= 400) {
    const error = new Error('SMTP_REJECTED');
    error.smtpCode = smtpCode;
    throw error;
  }
  return smtpCode;
}

socket.on('data', (chunk) => { buffer += chunk.toString('utf8'); drain(); });
socket.on('error', () => finish('VALID', lastStage === 'CONNECT' ? 'NETWORK_OR_TLS_ERROR' : 'SOCKET_ERROR'));
socket.setTimeout(12000, () => finish('VALID', 'SOCKET_TIMEOUT'));
socket.once('secureConnect', async () => {
  try {
    const greeting = await nextResponse('GREETING');
    if (code(greeting) !== 220) return finish('VALID', 'GREETING_REJECTED');
    const ehloCode = await command('EHLO transparent-price.local', 'EHLO');
    if (ehloCode !== 250) return finish('VALID', 'EHLO_REJECTED');
    const auth = Buffer.from(`\u0000${user}\u0000${pass}`, 'utf8').toString('base64');
    const authCode = await command(`AUTH PLAIN ${auth}`, 'AUTH_PLAIN');
    if (authCode !== 235) return finish('VALID', 'AUTH_REJECTED');
    const mailCode = await command(`MAIL FROM:<${from}>`, 'MAIL_FROM');
    if (mailCode !== 250) return finish('VALID', 'MAIL_FROM_REJECTED');
    socket.write(`RCPT TO:<${recipient}>\r\n`);
    const rcptResponse = await nextResponse('RCPT_TO');
    const rcptCode = code(rcptResponse);
    if (rcptCode >= 400 && rcptCode < 500) return finish('VALID', 'RCPT_TEMPFAIL');
    if (rcptCode >= 500) return finish('VALID', 'RCPT_REJECTED');
    if (![250, 251].includes(rcptCode)) return finish('VALID', 'RCPT_UNEXPECTED');
    socket.write('RSET\r\n');
    const rsetResponse = await nextResponse('RSET');
    if (code(rsetResponse) !== 250) return finish('VALID', 'RSET_REJECTED');
    lastStage = 'COMPLETE';
    socket.write('QUIT\r\n');
    clearTimeout(totalTimer);
    clearTimeout(appTimer);
    socket.end();
    emit('VALID', 'PASS_RCPT');
  } catch (error) {
    const smtpCode = Number(error && error.smtpCode || 0);
    if (lastStage === 'AUTH_PLAIN' && [534, 535].includes(smtpCode)) return finish('VALID', 'AUTH_REJECTED');
    if (lastStage === 'MAIL_FROM') return finish('VALID', smtpCode >= 400 && smtpCode < 500 ? 'MAIL_FROM_TEMPFAIL' : 'MAIL_FROM_REJECTED');
    return finish('VALID', 'PROTOCOL_REJECTED');
  }
});
NODE
} | docker exec -i "$web_id" /bin/sh -c 'IFS= read -r P0_RCPT_TO || exit 70; export P0_RCPT_TO; exec /nodejs/bin/node --input-type=commonjs -' 2>/dev/null)"
unset reviewer_email web_id api_id

printf '%s\n' "$probe_output"
REMOTE
)"

for required in \
  RUNTIME_PAIR REVIEWER_SUBJECT SMTP_RCPT_CONFIG SMTP_RCPT_RESULT SMTP_RCPT_LAST_STAGE \
  SMTP_RCPT_TOTAL_BUCKET SMTP_RCPT_RESPONSE_5000_BUDGET SMTP_RCPT_APP_7500_BUDGET \
  SMTP_RCPT_DATA_COMMAND SMTP_RCPT_MAIL_SENT PRODUCTION_MUTATION; do
  count="$(grep -Ec "^${required}=[A-Z0-9_]+$" <<< "$result" || true)"
  [[ "$count" == '1' ]]
done

grep -Fxq 'RUNTIME_PAIR=CONSISTENT' <<< "$result"
grep -Fxq 'REVIEWER_SUBJECT=UNIQUE_READY' <<< "$result"
grep -Fxq 'SMTP_RCPT_DATA_COMMAND=NO' <<< "$result"
grep -Fxq 'SMTP_RCPT_MAIL_SENT=NO' <<< "$result"
grep -Fxq 'PRODUCTION_MUTATION=NONE' <<< "$result"

runtime_pair="$(grep '^RUNTIME_PAIR=' <<< "$result" | cut -d= -f2-)"
subject_state="$(grep '^REVIEWER_SUBJECT=' <<< "$result" | cut -d= -f2-)"
config_class="$(grep '^SMTP_RCPT_CONFIG=' <<< "$result" | cut -d= -f2-)"
rcpt_result="$(grep '^SMTP_RCPT_RESULT=' <<< "$result" | cut -d= -f2-)"
last_stage="$(grep '^SMTP_RCPT_LAST_STAGE=' <<< "$result" | cut -d= -f2-)"
total_bucket="$(grep '^SMTP_RCPT_TOTAL_BUCKET=' <<< "$result" | cut -d= -f2-)"
response_budget="$(grep '^SMTP_RCPT_RESPONSE_5000_BUDGET=' <<< "$result" | cut -d= -f2-)"
app_budget="$(grep '^SMTP_RCPT_APP_7500_BUDGET=' <<< "$result" | cut -d= -f2-)"
unset result

failure_reason='MAIN_GUARD_AFTER_FAILED'
git fetch --no-tags origin main >/dev/null
guard_main
[[ -z "$(git status --porcelain=v1)" ]]

failure_reason='EVIDENCE_PUBLICATION_FAILED'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer SMTP recipient diagnostic

- exact diagnostic main: \`$TARGET_SHA\`
- runtime pair: \`$runtime_pair\`
- reviewer subject: \`$subject_state / identity not published\`
- SMTP config class: \`$config_class\`
- result: \`$rcpt_result\`
- last protocol stage: \`$last_stage\`
- total latency bucket through recipient stage: \`$total_bucket\`
- current 5s response budget through recipient stage: \`$response_budget\`
- current 7.5s SMTP budget through recipient stage: \`$app_budget\`
- authenticated SMTP: \`AUTH PLAIN\`
- recipient command: \`YES / reviewer subject resolved privately\`
- DATA command: \`NO\`
- mail sent: \`NO\`
- reviewer email / credentials / raw env / raw SMTP response: \`NOT_PUBLISHED\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
result_published=1

printf 'REVIEWER_SMTP_RCPT_RESULT=%s\nPRODUCTION_MUTATION=NONE\n' "$rcpt_result"
