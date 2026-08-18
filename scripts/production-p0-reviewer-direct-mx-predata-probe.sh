#!/usr/bin/env bash
set -Eeuo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP required}"
DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"; user="$(trim "${PC_PROD_SSH_USER:-}")"; port="$(trim "${PC_PROD_SSH_PORT:-22}")"; expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]; [[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]; [[ "$port" =~ ^[0-9]+$ ]] && ((port>=1 && port<=65535)); [[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u | grep -Fxq "$DEFAULT_HOST"
key="$RUNNER_TEMP/p0-direct-mx-key"; known="$RUNNER_TEMP/p0-direct-mx-known"
validate_key(){ local src="$1" pub; tr -d '\r' < "$src" > "$key"; chmod 600 "$key"; grep -Eq '^(ssh-|ecdsa-|sk-)' "$key" && return 1; pub="$(mktemp)"; ssh-keygen -y -P '' -f "$key" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }; rm -f "$pub"; }
try_slot(){ local raw="$1" a b c; [[ -n "$raw" ]] || return 1; a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"; printf '%s\n' "$raw" > "$a"; validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }; rm -f "$a" "$b" "$c"; return 1; }
try_slot "${PC_PROD_SSH_KEY:-}" || try_slot "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_slot "${VPS_SSH_KEY:-}"
scan="$(mktemp)"; match="$(mktemp)"; ready=0
for attempt in 1 2 3; do : > "$scan"; : > "$match"; ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true; while IFS= read -r line; do [[ -n "$line" ]] || continue; fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"; [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"; done < "$scan"; sort -u -o "$match" "$match"; [[ "$(grep -c . "$match" || true)" == 1 ]] && { ready=1; break; }; ((attempt==3)) || sleep "$attempt"; done
[[ "$ready" == 1 ]]; mv "$match" "$known"; rm -f "$scan"; chmod 600 "$known"
safe="$(ssh -i "$key" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known" -o ConnectTimeout=15 "$user@$host" 'bash -s' 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
[[ "$(id -u)" -eq 0 ]]
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"
docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const dns = require('node:dns').promises;
const net = require('node:net');
let db;
const safeCode = (v) => String(v ?? 'NONE').replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 64) || 'NONE';
function smtpSession(host, recipient) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: 25 });
    socket.setTimeout(12000);
    socket.setEncoding('utf8');
    let buffer = '', stage = 'GREETING', timer;
    const result = { network: 'FAIL', greeting: 'NONE', ehlo: 'NONE', mail: 'NONE', rcpt: 'NONE', starttls: 'NO', error: 'NONE' };
    const done = () => { clearTimeout(timer); socket.destroy(); resolve(result); };
    const send = (line) => socket.write(`${line}\r\n`);
    const nextResponse = (callback) => {
      const consume = () => {
        const lines = buffer.split('\r\n');
        if (lines.length < 2) return;
        let used = 0, code = null, final = null;
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i]; used += line.length + 2;
          const m = /^(\d{3})([ -])/.exec(line);
          if (!m) continue;
          code = m[1];
          if (m[2] === ' ') { final = line; break; }
        }
        if (!final || !code) return;
        buffer = buffer.slice(used);
        callback(code, final);
      };
      const handler = (chunk) => { buffer += chunk; consume(); };
      socket.once('data', handler);
      consume();
    };
    const fail = (e) => { result.error = safeCode(e?.code || e?.name || 'NETWORK'); done(); };
    socket.once('error', fail); socket.once('timeout', () => fail({code:'TIMEOUT'}));
    timer = setTimeout(() => fail({code:'TOTAL_TIMEOUT'}), 15000);
    nextResponse((g) => {
      result.network = 'PASS'; result.greeting = g; if (g !== '220') return done();
      stage = 'EHLO'; send('EHLO xn----8sbjf4befbjgs9b.xn--p1ai');
      nextResponse((e, line) => {
        result.ehlo = e; result.starttls = /STARTTLS/i.test(line) ? 'YES' : 'NO'; if (e !== '250') return done();
        stage = 'MAIL_FROM'; send('MAIL FROM:<access@xn----8sbjf4befbjgs9b.xn--p1ai>');
        nextResponse((m) => {
          result.mail = m; if (m !== '250') return done();
          stage = 'RCPT_TO'; send(`RCPT TO:<${recipient}>`);
          nextResponse((r) => {
            result.rcpt = r;
            try { send('RSET'); send('QUIT'); } catch {}
            done();
          });
        });
      });
    });
  });
}
(async () => {
  const url = String(process.env.STAFF_DATABASE_URL || '').trim();
  if (!url) throw new Error('DB_URL');
  db = new PrismaClient({ datasources: { db: { url } } });
  const p = (await db.$queryRawUnsafe("SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user"))[0];
  if (!p || p.current_user !== 'pc_staff_runtime' || p.rolsuper || p.rolbypassrls) throw new Error('PRINCIPAL');
  const rows = await db.$queryRawUnsafe("SELECT auth.staff_reviewer_password_reset_subject() AS email");
  const email = String(rows?.[0]?.email || '');
  if (!/^[^\\s@]{1,64}@[^\\s@]{1,189}$/.test(email)) throw new Error('SUBJECT');
  const domain = email.slice(email.lastIndexOf('@') + 1);
  const mx = (await dns.resolveMx(domain)).sort((a,b) => a.priority - b.priority).slice(0,2);
  console.log(`DIRECT_MX_COUNT=${mx.length}`);
  if (!mx.length) { console.log('DIRECT_MX_RESULT=NO_MX'); return; }
  let best = null;
  for (const item of mx) {
    const r = await smtpSession(item.exchange, email);
    if (!best || r.rcpt === '250' || r.rcpt === '251') best = r;
    if (r.rcpt === '250' || r.rcpt === '251') break;
  }
  console.log(`DIRECT_MX_NETWORK=${best?.network || 'FAIL'}`);
  console.log(`DIRECT_MX_GREETING=${safeCode(best?.greeting)}`);
  console.log(`DIRECT_MX_EHLO=${safeCode(best?.ehlo)}`);
  console.log(`DIRECT_MX_MAIL_FROM=${safeCode(best?.mail)}`);
  console.log(`DIRECT_MX_RCPT=${safeCode(best?.rcpt)}`);
  console.log(`DIRECT_MX_STARTTLS_ADVERTISED=${best?.starttls || 'NO'}`);
  console.log(`DIRECT_MX_SAFE_ERROR=${safeCode(best?.error)}`);
  console.log('MAIL_SENT=NO');
  console.log('PRODUCTION_MUTATION=NONE');
})().catch((e) => {
  console.log(`DIRECT_MX_RESULT=FAIL`);
  console.log(`DIRECT_MX_SAFE_ERROR=${safeCode(e?.code || e?.name || 'UNKNOWN')}`);
  console.log('MAIL_SENT=NO');
  console.log('PRODUCTION_MUTATION=NONE');
  process.exitCode = 1;
}).finally(async () => { if (db) await db.$disconnect().catch(() => undefined); });
NODE
REMOTE
)"
printf '%s\n' "$safe" | grep -E '^(DIRECT_MX_COUNT|DIRECT_MX_RESULT|DIRECT_MX_NETWORK|DIRECT_MX_GREETING|DIRECT_MX_EHLO|DIRECT_MX_MAIL_FROM|DIRECT_MX_RCPT|DIRECT_MX_STARTTLS_ADVERTISED|DIRECT_MX_SAFE_ERROR|MAIL_SENT|PRODUCTION_MUTATION)='
grep -Fxq 'MAIL_SENT=NO' <<< "$safe"; grep -Fxq 'PRODUCTION_MUTATION=NONE' <<< "$safe"
rm -f -- "$key" "$known"
