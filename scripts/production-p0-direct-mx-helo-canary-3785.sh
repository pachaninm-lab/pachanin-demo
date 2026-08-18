#!/usr/bin/env bash
set -Eeuo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP required}"
: "${CANARY_ID:?CANARY_ID required}"
DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
[[ "$CANARY_ID" =~ ^pc-p0-helo-canary-[0-9]{6,24}$ ]]
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"; user="$(trim "${PC_PROD_SSH_USER:-}")"; port="$(trim "${PC_PROD_SSH_PORT:-22}")"; expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]; [[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]; [[ "$port" =~ ^[0-9]+$ ]] && ((port>=1 && port<=65535)); [[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u | grep -Fxq "$DEFAULT_HOST"
key="$RUNNER_TEMP/p0-helo-canary-key"; known="$RUNNER_TEMP/p0-helo-canary-known"
validate_key(){ local src="$1" pub; tr -d '\r' < "$src" > "$key"; chmod 600 "$key"; grep -Eq '^(ssh-|ecdsa-|sk-)' "$key" && return 1; pub="$(mktemp)"; ssh-keygen -y -P '' -f "$key" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }; rm -f "$pub"; }
try_slot(){ local raw="$1" a b c; [[ -n "$raw" ]] || return 1; a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"; printf '%s\n' "$raw" > "$a"; validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }; rm -f "$a" "$b" "$c"; return 1; }
try_slot "${PC_PROD_SSH_KEY:-}" || try_slot "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_slot "${VPS_SSH_KEY:-}"
scan="$(mktemp)"; match="$(mktemp)"; ready=0
for attempt in 1 2 3; do : > "$scan"; : > "$match"; ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true; while IFS= read -r line; do [[ -n "$line" ]] || continue; fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"; [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"; done < "$scan"; sort -u -o "$match" "$match"; [[ "$(grep -c . "$match" || true)" == 1 ]] && { ready=1; break; }; ((attempt==3)) || sleep "$attempt"; done
[[ "$ready" == 1 ]]; mv "$match" "$known"; rm -f "$scan"; chmod 600 "$known"
safe="$(ssh -i "$key" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known" -o ConnectTimeout=15 "$user@$host" "bash -s -- '$CANARY_ID'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
canary="$1"; [[ "$canary" =~ ^pc-p0-helo-canary-[0-9]{6,24}$ ]]
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api'); (( ${#api_ids[@]} == 1 )); api_id="${api_ids[0]}"
recipient="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const {PrismaClient}=require('@prisma/client'); let db;
(async()=>{const url=String(process.env.STAFF_DATABASE_URL||'').trim(); if(!url) throw new Error('DB_URL'); db=new PrismaClient({datasources:{db:{url}}}); const p=(await db.$queryRawUnsafe("SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user"))[0]; if(!p||p.current_user!=='pc_staff_runtime'||p.rolsuper||p.rolbypassrls) throw new Error('PRINCIPAL'); const r=await db.$queryRawUnsafe("SELECT auth.staff_reviewer_password_reset_subject() AS email"); const e=String(r?.[0]?.email||''); if(!/^[^\\s@]{1,64}@[^\\s@]{1,189}$/.test(e)) throw new Error('SUBJECT'); process.stdout.write(e);})().catch(()=>process.exitCode=1).finally(async()=>{if(db) await db.$disconnect().catch(()=>{});});
NODE
)"
mx="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - "$recipient" <<'NODE'
const dns=require('node:dns').promises; const email=process.argv[2]; const domain=email.slice(email.lastIndexOf('@')+1); (async()=>{const rows=(await dns.resolveMx(domain)).sort((a,b)=>a.priority-b.priority); if(!rows.length) process.exit(2); process.stdout.write(rows[0].exchange);})().catch(()=>process.exitCode=1);
NODE
)"
RECIPIENT="$recipient" MX="$mx" CANARY="$canary" python3 - <<'PY'
import os,re,smtplib,ssl,sys
from email.message import EmailMessage
from email.policy import SMTP
recipient=os.environ['RECIPIENT']; mx=os.environ['MX']; canary=os.environ['CANARY']
sender='access@xn----8sbjf4befbjgs9b.xn--p1ai'; helo='xn----8sbjf4befbjgs9b.xn--p1ai'
if not re.fullmatch(r'[A-Za-z0-9.-]{1,253}',mx): raise SystemExit(71)
msg=EmailMessage(policy=SMTP); msg['From']=f'PC-CROP <{sender}>'; msg['To']=recipient; msg['Subject']='PC-CROP EHLO delivery canary'; msg['Message-ID']=f'<{canary}@{helo}>'; msg['Auto-Submitted']='auto-generated'; msg['X-Auto-Response-Suppress']='All'; msg.set_content(f'PC-CROP EHLO-aligned synthetic mail canary {canary}. No credentials, tokens, links or personal data.',cte='7bit')
s=smtplib.SMTP(mx,25,local_hostname=helo,timeout=15)
try:
    code,_=s.ehlo(helo)
    if code!=250 or not s.has_extn('starttls'): raise RuntimeError('STARTTLS_REQUIRED')
    code,_=s.starttls(context=ssl.create_default_context())
    if code!=220: raise RuntimeError('STARTTLS_FAILED')
    code,_=s.ehlo(helo)
    if code!=250: raise RuntimeError('EHLO_TLS_FAILED')
    refused=s.sendmail(sender,[recipient],msg.as_bytes(policy=SMTP))
    if refused: raise RuntimeError('RECIPIENT_REFUSED')
    print('EHLO_CANARY_SMTP_ACCEPTED=PASS')
    print(f'EHLO_CANARY_ID={canary}')
    print('MAIL_MUTATION=SYNTHETIC_CANARY_ONLY')
    print('DATABASE_MUTATION=NONE')
    print('IDENTITY_MUTATION=NONE')
finally:
    try:s.quit()
    except Exception:pass
PY
REMOTE
)"
printf '%s\n' "$safe" | grep -E '^(EHLO_CANARY_SMTP_ACCEPTED|EHLO_CANARY_ID|MAIL_MUTATION|DATABASE_MUTATION|IDENTITY_MUTATION)='
grep -Fxq 'EHLO_CANARY_SMTP_ACCEPTED=PASS' <<< "$safe"
rm -f -- "$key" "$known"
