#!/usr/bin/env bash
set -Eeuo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP required}"
: "${CONTROLLED_IMAP_HASH:?CONTROLLED_IMAP_HASH required}"
: "${CANARY_NONCE:?CANARY_NONCE required}"
DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
[[ "$CONTROLLED_IMAP_HASH" =~ ^[0-9a-f]{64}$ ]]
[[ "$CANARY_NONCE" =~ ^[0-9a-f]{32}$ ]]
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"; user="$(trim "${PC_PROD_SSH_USER:-}")"; port="$(trim "${PC_PROD_SSH_PORT:-22}")"; expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]; [[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]; [[ "$port" =~ ^[0-9]+$ ]] && ((port>=1 && port<=65535)); [[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u | grep -Fxq "$DEFAULT_HOST"
key="$RUNNER_TEMP/p0-direct-mx-canary-key"; known="$RUNNER_TEMP/p0-direct-mx-canary-known"
validate_key(){ local src="$1" pub; tr -d '\r' < "$src" > "$key"; chmod 600 "$key"; grep -Eq '^(ssh-|ecdsa-|sk-)' "$key" && return 1; pub="$(mktemp)"; ssh-keygen -y -P '' -f "$key" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }; rm -f "$pub"; }
try_slot(){ local raw="$1" a b c; [[ -n "$raw" ]] || return 1; a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"; printf '%s\n' "$raw" > "$a"; validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }; rm -f "$a" "$b" "$c"; return 1; }
try_slot "${PC_PROD_SSH_KEY:-}" || try_slot "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_slot "${VPS_SSH_KEY:-}"
scan="$(mktemp)"; match="$(mktemp)"; ready=0
for attempt in 1 2 3; do : > "$scan"; : > "$match"; ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true; while IFS= read -r line; do [[ -n "$line" ]] || continue; fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"; [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"; done < "$scan"; sort -u -o "$match" "$match"; [[ "$(grep -c . "$match" || true)" == 1 ]] && { ready=1; break; }; ((attempt==3)) || sleep "$attempt"; done
[[ "$ready" == 1 ]]; mv "$match" "$known"; rm -f "$scan"; chmod 600 "$known"
safe="$(ssh -i "$key" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known" -o ConnectTimeout=15 "$user@$host" "bash -s -- '$CONTROLLED_IMAP_HASH' '$CANARY_NONCE'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
control_hash="$1"; nonce="$2"
[[ "$(id -u)" -eq 0 ]]
[[ "$control_hash" =~ ^[0-9a-f]{64}$ ]]; [[ "$nonce" =~ ^[0-9a-f]{32}$ ]]
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )); api_id="${api_ids[0]}"
subject="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const {PrismaClient}=require('@prisma/client'); let db;
(async()=>{const url=String(process.env.STAFF_DATABASE_URL||'').trim(); if(!url) throw new Error('DB_URL'); db=new PrismaClient({datasources:{db:{url}}}); const p=(await db.$queryRawUnsafe("SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user"))[0]; if(!p||p.current_user!=='pc_staff_runtime'||p.rolsuper||p.rolbypassrls) throw new Error('PRINCIPAL'); const r=await db.$queryRawUnsafe("SELECT auth.staff_reviewer_password_reset_subject() AS email"); const e=String(r?.[0]?.email||'').trim().toLowerCase(); if(!/^[^\\s@]{1,64}@[^\\s@]{1,189}$/.test(e)) throw new Error('SUBJECT'); process.stdout.write(e);})().catch(()=>process.exitCode=1).finally(async()=>{if(db) await db.$disconnect().catch(()=>{});});
NODE
)"
reviewer_hash="$(printf '%s' "$subject" | sha256sum | awk '{print $1}')"
if [[ "$reviewer_hash" != "$control_hash" ]]; then
  echo 'REVIEWER_EQUALS_CONTROLLED_IMAP=NO'
  echo 'CANARY_SENT=NO'
  echo 'PRODUCTION_MUTATION=NONE'
  exit 42
fi
echo 'REVIEWER_EQUALS_CONTROLLED_IMAP=YES'
mx="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - "$subject" <<'NODE'
const dns=require('node:dns').promises; const email=process.argv[2]; const domain=email.slice(email.lastIndexOf('@')+1); (async()=>{const mx=(await dns.resolveMx(domain)).sort((a,b)=>a.priority-b.priority); if(!mx.length) process.exit(2); process.stdout.write(mx[0].exchange);})().catch(()=>process.exitCode=1);
NODE
)"
SUBJECT="$subject" MX="$mx" NONCE="$nonce" python3 - <<'PY'
import email.utils, os, re, smtplib, ssl
recipient=os.environ['SUBJECT']; mx=os.environ['MX']; nonce=os.environ['NONCE']
if not re.fullmatch(r'[A-Za-z0-9.-]{1,253}', mx): raise SystemExit(71)
message_id=f'<pc-crop-canary-{nonce}@xn----8sbjf4befbjgs9b.xn--p1ai>'
lines=[
 'From: Transparent Price <access@xn----8sbjf4befbjgs9b.xn--p1ai>',
 f'To: <{recipient}>',
 'Subject: PC-CROP delivery canary',
 f'Date: {email.utils.formatdate(localtime=False, usegmt=True)}',
 f'Message-ID: {message_id}',
 'MIME-Version: 1.0',
 'Content-Type: text/plain; charset=UTF-8',
 'Content-Transfer-Encoding: 8bit',
 'Auto-Submitted: auto-generated',
 'X-Auto-Response-Suppress: All',
 '',
 'PC-CROP synthetic delivery canary. This message contains no credential, token, reset link, verification link, personal data, or user action.',
]
message='\r\n'.join(lines)
s=None
try:
    s=smtplib.SMTP(mx,25,timeout=15)
    code,_=s.ehlo('xn----8sbjf4befbjgs9b.xn--p1ai')
    if code!=250 or not s.has_extn('starttls'): raise RuntimeError('STARTTLS_REQUIRED')
    code,_=s.starttls(context=ssl.create_default_context())
    if code!=220: raise RuntimeError('STARTTLS_FAILED')
    code,_=s.ehlo('xn----8sbjf4befbjgs9b.xn--p1ai')
    if code!=250: raise RuntimeError('EHLO_TLS_FAILED')
    code,_=s.mail('access@xn----8sbjf4befbjgs9b.xn--p1ai')
    if code!=250: raise RuntimeError(f'MAIL_FROM_{code}')
    code,_=s.rcpt(recipient)
    if code not in (250,251): raise RuntimeError(f'RCPT_{code}')
    code,_=s.data(message)
    print(f'CANARY_FINAL_CODE={code}')
    print(f'CANARY_SENT={"YES" if code==250 else "NO"}')
    if code!=250: raise RuntimeError(f'DATA_FINAL_{code}')
    try: s.quit()
    except Exception: pass
finally:
    try:
        if s: s.close()
    except Exception: pass
print('PRODUCTION_MUTATION=SYNTHETIC_MAIL_CANARY_ONLY')
PY
REMOTE
)"
printf '%s\n' "$safe" | grep -E '^(REVIEWER_EQUALS_CONTROLLED_IMAP|CANARY_FINAL_CODE|CANARY_SENT|PRODUCTION_MUTATION)='
grep -Fxq 'REVIEWER_EQUALS_CONTROLLED_IMAP=YES' <<< "$safe"
grep -Fxq 'CANARY_SENT=YES' <<< "$safe"
grep -Fxq 'PRODUCTION_MUTATION=SYNTHETIC_MAIL_CANARY_ONLY' <<< "$safe"
rm -f -- "$key" "$known"
