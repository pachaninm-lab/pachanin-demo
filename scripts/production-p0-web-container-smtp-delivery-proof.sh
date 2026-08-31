#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
: "${TARGET_SHA:?TARGET_SHA is required}"
: "${MAILBOX_USER:?MAILBOX_USER is required}"
: "${MAILBOX_PASSWORD:?MAILBOX_PASSWORD is required}"
: "${EMAIL_TEMPLATE:?EMAIL_TEMPLATE is required}"
: "${PC_PROD_HOST:?PC_PROD_HOST is required}"
: "${PC_PROD_SSH_USER:?PC_PROD_SSH_USER is required}"
: "${PC_PROD_SSH_HOST_FINGERPRINT:?PC_PROD_SSH_HOST_FINGERPRINT is required}"

LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
ACCEPTANCE_MAIL_DOMAIN='acceptance.xn----8sbjf4befbjgs9b.xn--p1ai'
SMTP_HOST='mail.hosting.reg.ru'
SMTP_PORT='465'
IMAP_PORT='993'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-web-container-smtp-delivery-proof current-main'

key_path="$RUNNER_TEMP/pc-web-delivery-key"
known_hosts="$RUNNER_TEMP/pc-web-delivery-known-hosts"
send_cfg="$RUNNER_TEMP/pc-web-delivery-send-${GITHUB_RUN_ID}.json"
receipt_cfg="$RUNNER_TEMP/pc-web-delivery-receipt-${GITHUB_RUN_ID}.json"
result_file="$RUNNER_TEMP/pc-web-delivery-result-${GITHUB_RUN_ID}.txt"

RESULT='FAIL'
WEB_CONTAINER_CARDINALITY='UNKNOWN'
WEB_SMTP_DELIVERY_RESULT='NOT_RUN'
WEB_SMTP_LAST_STAGE='NOT_RUN'
WEB_SMTP_TOTAL_BUCKET='UNKNOWN'
WEB_SMTP_RESPONSE_5000_BUDGET='UNKNOWN'
WEB_SMTP_APP_7500_BUDGET='UNKNOWN'
WEB_SMTP_MAIL_SENT='NO'
IMAP_RECEIPT_RESULT='NOT_RUN'
PRODUCTION_MUTATION='NONE'
FAILURE_STAGE='BOOTSTRAP'
PUBLISHED=0

cleanup() {
  rm -f -- "$key_path" "$known_hosts" "$send_cfg" "$receipt_cfg" "$result_file"
}

current_main() {
  gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null
}

guard_main() {
  [[ "$(current_main)" == "$TARGET_SHA" ]]
}

publish() {
  [[ "$PUBLISHED" == 0 ]] || return 0
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 Web-container SMTP acceptance delivery proof

- exact main at SMTP transaction: \`$TARGET_SHA\`
- result: \`$RESULT\`
- Web container cardinality: \`$WEB_CONTAINER_CARDINALITY\`
- SMTP delivery result: \`$WEB_SMTP_DELIVERY_RESULT\`
- last SMTP stage: \`$WEB_SMTP_LAST_STAGE\`
- total latency bucket: \`$WEB_SMTP_TOTAL_BUCKET\`
- current 5s response budget: \`$WEB_SMTP_RESPONSE_5000_BUDGET\`
- current 7.5s total budget: \`$WEB_SMTP_APP_7500_BUDGET\`
- acceptance mail sent: \`$WEB_SMTP_MAIL_SENT\`
- isolated acceptance IMAP receipt: \`$IMAP_RECEIPT_RESULT\`
- failure stage: \`$FAILURE_STAGE\`
- reviewer identity / reset / password / TOTP / session access: \`NONE\`
- production mutation: \`$PRODUCTION_MUTATION\`
- database/runtime/deployment mutation: \`NONE\`
- recipient / sender / marker / credentials / raw SMTP / raw IMAP: \`NOT_PUBLISHED\`
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
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
[[ -z "$(git status --porcelain=v1)" ]]
guard_main

FAILURE_STAGE='PROTECTED_INPUT_VALIDATION'
safe_scalar(){ [[ -n "$1" && "$1" != *$'\n'* && "$1" != *$'\r'* ]]; }
safe_scalar "$MAILBOX_USER"
safe_scalar "$MAILBOX_PASSWORD"
safe_scalar "$EMAIL_TEMPLATE"

umask 077
SEND_CFG="$send_cfg" RECEIPT_CFG="$receipt_cfg" python3 - <<'PY'
import json, os, re, secrets

domain = 'acceptance.xn----8sbjf4befbjgs9b.xn--p1ai'
user = str(os.environ['MAILBOX_USER']).strip().lower()
password = str(os.environ['MAILBOX_PASSWORD'])
template = str(os.environ['EMAIL_TEMPLATE']).strip().lower()
run_id = str(os.environ['GITHUB_RUN_ID'])
target_sha = str(os.environ['TARGET_SHA'])

def ascii_email(value):
    if value.count('@') != 1:
        raise SystemExit(21)
    local, host = value.rsplit('@', 1)
    local.encode('ascii')
    host = host.encode('idna').decode('ascii').lower()
    result = f'{local}@{host}'
    if len(result) > 254 or not re.fullmatch(r'[A-Za-z0-9._+-]{1,64}@[A-Za-z0-9.-]{1,189}', result):
        raise SystemExit(21)
    return result

mailbox = ascii_email(user)
if not mailbox.endswith('@' + domain):
    raise SystemExit(21)
if not password or any(c in password for c in ('\n', '\r', '\x00')):
    raise SystemExit(21)

if template.count('{identity}') == 1 and '{run}' not in template and '{slot}' not in template:
    recipient = template.replace('{identity}', f'webdelivery-{run_id}')
elif template.count('{identity}') == 0 and template.count('{run}') == 1 and template.count('{slot}') == 1:
    recipient = template.replace('{run}', run_id).replace('{slot}', 'webdelivery')
else:
    raise SystemExit(22)
recipient = ascii_email(recipient)
if not recipient.endswith('@' + domain):
    raise SystemExit(22)
marker = f'PC-CROP-WEB-DELIVERY-{target_sha[:12]}-{run_id}-{secrets.token_hex(8)}'.upper()
if not re.fullmatch(r'[A-Z0-9-]{20,128}', marker):
    raise SystemExit(23)

with open(os.environ['SEND_CFG'], 'w', encoding='utf-8') as handle:
    json.dump({'recipient': recipient, 'marker': marker}, handle, ensure_ascii=True, separators=(',', ':'))
with open(os.environ['RECEIPT_CFG'], 'w', encoding='utf-8') as handle:
    json.dump({'user': mailbox, 'password': password, 'recipient': recipient, 'marker': marker}, handle, ensure_ascii=True, separators=(',', ':'))
PY
chmod 0600 "$send_cfg" "$receipt_cfg"

FAILURE_STAGE='SSH_IDENTITY'
mkdir -p "$HOME/.ssh"
chmod 0700 "$HOME/.ssh"
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
host="$(trim "$PC_PROD_HOST")"
user="$(trim "$PC_PROD_SSH_USER")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "$PC_PROD_SSH_HOST_FINGERPRINT")"
[[ -n "$host" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
mapfile -t dns_ipv4 < <(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u)
(( ${#dns_ipv4[@]} >= 1 ))
printf '%s\n' "${dns_ipv4[@]}" | grep -Fxq "$host"

validate_key(){
  local source="$1" pub
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  pub="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }
  rm -f "$pub"
}
try_slot(){
  local raw="$1" a b c
  [[ -n "$raw" ]] || return 1
  a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"
  printf '%s\n' "$raw" > "$a"
  validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$b"
  validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }
  rm -f "$a" "$b" "$c"
  return 1
}
try_slot "${PC_PROD_SSH_KEY:-}" || try_slot "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_slot "${VPS_SSH_KEY:-}"

scan="$(mktemp)"; match="$(mktemp)"
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]]
while IFS= read -r line; do
  got="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$got" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
rm -f "$scan"
[[ "$(grep -c . "$match" || true)" == 1 ]]
mv "$match" "$known_hosts"
chmod 0600 "$known_hosts"
ssh_common=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15)
scp_common=(-i "$key_path" -P "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts")
ssh "${ssh_common[@]}" "$user@$host" 'set -Eeuo pipefail; [[ "$(id -u)" -eq 0 ]]; command -v docker >/dev/null; command -v python3 >/dev/null' >/dev/null

guard_main
FAILURE_STAGE='WEB_SMTP_TRANSACTION'
remote_send="/tmp/pc-web-delivery-send-${GITHUB_RUN_ID}.json"
scp "${scp_common[@]}" "$send_cfg" "$user@$host:$remote_send"
ssh "${ssh_common[@]}" "$user@$host" "bash -s -- '$remote_send'" > "$result_file" <<'REMOTE'
set -Eeuo pipefail
cfg="$1"
[[ "$(id -u)" -eq 0 ]]
chmod 0600 "$cfg"
tmp="$(mktemp -d /root/pc-web-delivery.XXXXXX)"
chmod 0700 "$tmp"
cleanup(){ rm -rf -- "$tmp" "$cfg"; }
trap cleanup EXIT
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
if (( ${#web_ids[@]} != 1 )); then
  cardinality="$([[ ${#web_ids[@]} == 0 ]] && echo ZERO || echo MULTIPLE)"
  printf 'WEB_CONTAINER_CARDINALITY=%s\nWEB_SMTP_DELIVERY_RESULT=FAIL\nWEB_SMTP_LAST_STAGE=DISCOVERY\nWEB_SMTP_TOTAL_BUCKET=UNKNOWN\nWEB_SMTP_RESPONSE_5000_BUDGET=UNKNOWN\nWEB_SMTP_APP_7500_BUDGET=UNKNOWN\nWEB_SMTP_MAIL_SENT=NO\nPRODUCTION_MUTATION=NONE\n' "$cardinality"
  exit 0
fi
web_id="${web_ids[0]}"
payload="$tmp/send.js"
cat > "$payload" <<'NODE'
const tls = require('node:tls');
const MAIL_TIMEOUT_MS = 5_000;
const recipient = __RECIPIENT__;
const marker = __MARKER__;
const started = Date.now();
let lastStage = 'CONFIG';
let responseBudget = 'PASS';
let done = false;
let buffer = '';
let waiter = null;

function clean(value) {
  const v = String(value || '').trim();
  return v && !/[\r\n\0]/.test(v) ? v : '';
}
function bucket(ms) {
  if (!Number.isFinite(ms)) return 'UNKNOWN';
  if (ms <= 2500) return 'LE_2500';
  if (ms <= 5000) return 'LE_5000';
  if (ms <= 7500) return 'LE_7500';
  return 'GT_7500';
}
function emit(result, sent) {
  if (done) return;
  done = true;
  const elapsed = Date.now() - started;
  console.log('WEB_CONTAINER_CARDINALITY=ONE');
  console.log(`WEB_SMTP_DELIVERY_RESULT=${result}`);
  console.log(`WEB_SMTP_LAST_STAGE=${lastStage}`);
  console.log(`WEB_SMTP_TOTAL_BUCKET=${bucket(elapsed)}`);
  console.log(`WEB_SMTP_RESPONSE_5000_BUDGET=${responseBudget}`);
  console.log(`WEB_SMTP_APP_7500_BUDGET=${elapsed <= 7500 ? 'PASS' : 'FAIL'}`);
  console.log(`WEB_SMTP_MAIL_SENT=${sent ? 'YES' : 'NO'}`);
  console.log(`PRODUCTION_MUTATION=${sent ? 'ACCEPTANCE_MAIL_ONLY' : 'NONE'}`);
}

const host = clean(process.env.PC_SMTP_HOST);
const port = Number(clean(process.env.PC_SMTP_PORT) || '465');
const user = clean(process.env.PC_SMTP_USER);
const pass = clean(process.env.PC_SMTP_PASS);
const from = clean(process.env.PC_MAIL_FROM) || user;
if (host !== 'mail.hosting.reg.ru' || port !== 465 || !user || !pass || !from) {
  emit('FAIL', false);
  process.exit(0);
}

const mime = [
  `From: <${from}>`,
  `To: ${recipient}`,
  'Subject: PC-CROP Web SMTP delivery acceptance',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: 8bit',
  '',
  'Production Web-container SMTP delivery verification.',
  `Verification marker: ${marker}`,
].join('\r\n');

const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
const totalTimeout = setTimeout(() => {
  lastStage = 'TOTAL_TIMEOUT';
  try { socket.destroy(); } catch {}
  emit('FAIL', false);
}, MAIL_TIMEOUT_MS + 2_500);

function drain() {
  if (!waiter) return;
  const lines = buffer.split(/\r?\n/);
  const complete = lines.findIndex((line) => /^\d{3} /.test(line));
  if (complete < 0) return;
  const response = lines.slice(0, complete + 1).join('\n');
  buffer = lines.slice(complete + 1).join('\n');
  const resolve = waiter;
  waiter = null;
  resolve(response);
}
function readResponse(stage) {
  lastStage = stage;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      responseBudget = 'FAIL';
      waiter = null;
      reject(new Error('smtp_timeout'));
    }, MAIL_TIMEOUT_MS);
    waiter = (response) => {
      clearTimeout(timeout);
      resolve(response);
    };
    drain();
  });
}
function code(response) { return Number(String(response).slice(0, 3)); }
async function command(value, allowed, stage) {
  socket.write(`${value}\r\n`);
  const response = await readResponse(stage);
  if (!allowed.includes(code(response))) throw new Error('smtp_rejected');
}

socket.on('data', (chunk) => { buffer += chunk.toString('utf8'); drain(); });
socket.once('error', () => { clearTimeout(totalTimeout); emit('FAIL', false); });
socket.once('secureConnect', async () => {
  try {
    const greeting = await readResponse('GREETING');
    if (code(greeting) !== 220) throw new Error('smtp_rejected');
    await command('EHLO transparent-price.local', [250], 'EHLO');
    const auth = Buffer.from(`\u0000${user}\u0000${pass}`, 'utf8').toString('base64');
    await command(`AUTH PLAIN ${auth}`, [235], 'AUTH_PLAIN');
    await command(`MAIL FROM:<${from}>`, [250], 'MAIL_FROM');
    await command(`RCPT TO:<${recipient}>`, [250, 251], 'RCPT_TO');
    await command('DATA', [354], 'DATA');
    lastStage = 'DATA_BODY';
    socket.write(`${mime}\r\n.\r\n`);
    const accepted = await readResponse('DATA_ACCEPT');
    if (code(accepted) !== 250) throw new Error('smtp_rejected');
    lastStage = 'COMPLETE';
    socket.write('QUIT\r\n');
    clearTimeout(totalTimeout);
    socket.end();
    emit('PASS', true);
  } catch {
    clearTimeout(totalTimeout);
    try { socket.destroy(); } catch {}
    emit('FAIL', false);
  }
});
NODE
PAYLOAD="$payload" CFG="$cfg" python3 - <<'PY'
import json, os, re
cfg = json.load(open(os.environ['CFG'], encoding='utf-8'))
recipient = str(cfg.get('recipient', ''))
marker = str(cfg.get('marker', ''))
if not re.fullmatch(r'[A-Za-z0-9._+-]{1,64}@acceptance\.xn----8sbjf4befbjgs9b\.xn--p1ai', recipient):
    raise SystemExit(31)
if not re.fullmatch(r'[A-Z0-9-]{20,128}', marker):
    raise SystemExit(32)
path = os.environ['PAYLOAD']
text = open(path, encoding='utf-8').read()
text = text.replace('__RECIPIENT__', json.dumps(recipient)).replace('__MARKER__', json.dumps(marker))
open(path, 'w', encoding='utf-8').write(text)
PY
chmod 0600 "$payload"
send_result="$(docker exec -i "$web_id" /nodejs/bin/node --input-type=commonjs - < "$payload" 2>/dev/null)"
for key in WEB_CONTAINER_CARDINALITY WEB_SMTP_DELIVERY_RESULT WEB_SMTP_LAST_STAGE WEB_SMTP_TOTAL_BUCKET WEB_SMTP_RESPONSE_5000_BUDGET WEB_SMTP_APP_7500_BUDGET WEB_SMTP_MAIL_SENT PRODUCTION_MUTATION; do
  line="$(grep -E "^${key}=[A-Z0-9_-]+$" <<< "$send_result" | tail -1)"
  [[ -n "$line" ]]
  printf '%s\n' "$line"
done
REMOTE

for key in WEB_CONTAINER_CARDINALITY WEB_SMTP_DELIVERY_RESULT WEB_SMTP_LAST_STAGE WEB_SMTP_TOTAL_BUCKET WEB_SMTP_RESPONSE_5000_BUDGET WEB_SMTP_APP_7500_BUDGET WEB_SMTP_MAIL_SENT PRODUCTION_MUTATION; do
  value="$(awk -F= -v key="$key" '$1 == key {print $2}' "$result_file" | tail -1)"
  [[ "$value" =~ ^[A-Z0-9_-]+$ ]]
  printf -v "$key" '%s' "$value"
done
[[ "$WEB_SMTP_DELIVERY_RESULT" == PASS ]]
[[ "$WEB_SMTP_MAIL_SENT" == YES ]]
[[ "$PRODUCTION_MUTATION" == ACCEPTANCE_MAIL_ONLY ]]

FAILURE_STAGE='POST_SMTP_MAIN_GUARD'
guard_main
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]

FAILURE_STAGE='IMAP_RECEIPT'
remote_receipt="/tmp/pc-web-delivery-receipt-${GITHUB_RUN_ID}.json"
scp "${scp_common[@]}" "$receipt_cfg" "$user@$host:$remote_receipt"
IMAP_RECEIPT_RESULT="$(ssh "${ssh_common[@]}" "$user@$host" "python3 - '$remote_receipt' '$SMTP_HOST' '$IMAP_PORT'" <<'PY'
import email, imaplib, json, os, re, ssl, sys, time
from email.utils import getaddresses

cfg_path, host, port_raw = sys.argv[1:4]

def ascii_email(value):
    if value.count('@') != 1:
        raise ValueError()
    local, domain = value.rsplit('@', 1)
    local.encode('ascii')
    result = f"{local}@{domain.encode('idna').decode('ascii').lower()}"
    if not re.fullmatch(r'[A-Za-z0-9._+-]{1,64}@[A-Za-z0-9.-]{1,189}', result):
        raise ValueError()
    return result

def message_text(message):
    parts = []
    iterator = message.walk() if message.is_multipart() else (message,)
    for part in iterator:
        if part.get_content_type() not in ('text/plain', 'text/html'):
            continue
        try:
            payload = part.get_payload(decode=True)
            if payload is None:
                text = str(part.get_payload())
            else:
                text = payload.decode(part.get_content_charset() or 'utf-8', errors='replace')
            parts.append(text)
        except Exception:
            pass
    return '\n'.join(parts)

try:
    os.chmod(cfg_path, 0o600)
    cfg = json.load(open(cfg_path, encoding='utf-8'))
    user = ascii_email(str(cfg.get('user', '')))
    password = str(cfg.get('password', ''))
    recipient = ascii_email(str(cfg.get('recipient', '')))
    marker = str(cfg.get('marker', ''))
    if not user.endswith('@acceptance.xn----8sbjf4befbjgs9b.xn--p1ai'): raise ValueError()
    if not recipient.endswith('@acceptance.xn----8sbjf4befbjgs9b.xn--p1ai'): raise ValueError()
    if not password or any(c in password for c in ('\n','\r','\x00')): raise ValueError()
    if not re.fullmatch(r'[A-Z0-9-]{20,128}', marker): raise ValueError()
    context = ssl.create_default_context()
    deadline = time.time() + 120
    while time.time() < deadline:
        box = None
        try:
            box = imaplib.IMAP4_SSL(host, int(port_raw), ssl_context=context, timeout=15)
            box.login(user, password)
            status, _ = box.select('INBOX', readonly=True)
            if status != 'OK': raise RuntimeError()
            status, data = box.search(None, 'ALL')
            if status != 'OK': raise RuntimeError()
            identifiers = (data[0] or b'').split()[-250:]
            for identifier in reversed(identifiers):
                status, rows = box.fetch(identifier, '(BODY.PEEK[])')
                if status != 'OK': continue
                raw = next((item[1] for item in rows if isinstance(item, tuple) and len(item) > 1), None)
                if not raw: continue
                parsed = email.message_from_bytes(raw)
                if marker not in message_text(parsed): continue
                recipients = []
                for header in ('to','cc','delivered-to','x-original-to','envelope-to'):
                    recipients.extend(ascii_email(addr) for _, addr in getaddresses(parsed.get_all(header, [])) if addr)
                if recipient not in recipients: continue
                box.logout()
                print('PASS')
                raise SystemExit(0)
            box.logout()
        except imaplib.IMAP4.error:
            if box:
                try: box.logout()
                except Exception: pass
            print('AUTH_OR_PROTOCOL_FAIL')
            raise SystemExit(0)
        except Exception:
            if box:
                try: box.logout()
                except Exception: pass
        time.sleep(5)
    print('NOT_FOUND')
finally:
    try: os.remove(cfg_path)
    except Exception: pass
PY
)"
[[ "$IMAP_RECEIPT_RESULT" =~ ^(PASS|AUTH_OR_PROTOCOL_FAIL|NOT_FOUND)$ ]]
[[ "$IMAP_RECEIPT_RESULT" == PASS ]]

RESULT='PASS'
FAILURE_STAGE='NONE'
publish
