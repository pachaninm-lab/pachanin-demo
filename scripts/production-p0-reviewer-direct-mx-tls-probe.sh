#!/usr/bin/env bash
set -Eeuo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP required}"
DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"; user="$(trim "${PC_PROD_SSH_USER:-}")"; port="$(trim "${PC_PROD_SSH_PORT:-22}")"; expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]; [[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]; [[ "$port" =~ ^[0-9]+$ ]] && ((port>=1 && port<=65535)); [[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u | grep -Fxq "$DEFAULT_HOST"
key="$RUNNER_TEMP/p0-direct-mx-tls-key"; known="$RUNNER_TEMP/p0-direct-mx-tls-known"
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
(( ${#api_ids[@]} == 1 )); api_id="${api_ids[0]}"
subject="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const {PrismaClient}=require('@prisma/client'); let db;
(async()=>{const url=String(process.env.STAFF_DATABASE_URL||'').trim(); db=new PrismaClient({datasources:{db:{url}}}); const p=(await db.$queryRawUnsafe("SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user"))[0]; if(!p||p.current_user!=='pc_staff_runtime'||p.rolsuper||p.rolbypassrls) throw new Error('PRINCIPAL'); const r=await db.$queryRawUnsafe("SELECT auth.staff_reviewer_password_reset_subject() AS email"); const e=String(r?.[0]?.email||''); if(!/^[^\\s@]{1,64}@[^\\s@]{1,189}$/.test(e)) throw new Error('SUBJECT'); process.stdout.write(e);})().catch(()=>process.exitCode=1).finally(async()=>{if(db) await db.$disconnect().catch(()=>{});});
NODE
)"
mx_lines="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - "$subject" <<'NODE'
const dns=require('node:dns').promises; const email=process.argv[2]; const domain=email.slice(email.lastIndexOf('@')+1); (async()=>{const mx=(await dns.resolveMx(domain)).sort((a,b)=>a.priority-b.priority).slice(0,2); for(const x of mx) console.log(x.exchange);})().catch(()=>process.exitCode=1);
NODE
)"
mapfile -t mxs <<< "$mx_lines"; unset mx_lines
(( ${#mxs[@]} >= 1 && ${#mxs[@]} <= 2 ))
SUBJECT="$subject" MX1="${mxs[0]}" MX2="${mxs[1]:-}" python3 - <<'PY'
import os,re,smtplib,ssl
subject=os.environ['SUBJECT']; mxs=[x for x in [os.environ.get('MX1',''),os.environ.get('MX2','')] if x]
def clean(v): return re.sub(r'[^A-Z0-9_:-]','_',str(v).upper())[:50] or 'NONE'
print(f'DIRECT_TLS_MX_COUNT={len(mxs)}')
secure_accept=0
for idx,mx in enumerate(mxs,1):
    network='FAIL'; starttls='NO'; tls_ok='NO'; mail='NONE'; rcpt='NONE'; err='NONE'; s=None
    try:
        s=smtplib.SMTP(timeout=12); code,_=s.connect(mx,25); network='PASS' if code==220 else 'FAIL'; code,_=s.ehlo();
        if code==250 and s.has_extn('starttls'):
            starttls='YES'; code,_=s.starttls(context=ssl.create_default_context()); tls_ok='YES' if code==220 else 'NO'; code,_=s.ehlo()
        code,_=s.mail('access@xn----8sbjf4befbjgs9b.xn--p1ai'); mail=str(code)
        if code==250:
            code,_=s.rcpt(subject); rcpt=str(code)
        try: s.rset(); s.quit()
        except Exception: pass
    except Exception as e:
        err=clean(getattr(e,'smtp_code',None) or type(e).__name__)
        try:
            if s: s.close()
        except Exception: pass
    if starttls=='YES' and tls_ok=='YES' and rcpt in ('250','251'): secure_accept+=1
    print(f'MX{idx}_NETWORK={network}'); print(f'MX{idx}_STARTTLS={starttls}'); print(f'MX{idx}_TLS_HANDSHAKE={tls_ok}'); print(f'MX{idx}_MAIL_FROM={clean(mail)}'); print(f'MX{idx}_RCPT={clean(rcpt)}'); print(f'MX{idx}_SAFE_ERROR={err}')
print(f'DIRECT_TLS_ACCEPTING_MX_COUNT={secure_accept}')
print('MAIL_SENT=NO'); print('PRODUCTION_MUTATION=NONE')
PY
REMOTE
)"
printf '%s\n' "$safe" | grep -E '^(DIRECT_TLS_MX_COUNT|MX[12]_(NETWORK|STARTTLS|TLS_HANDSHAKE|MAIL_FROM|RCPT|SAFE_ERROR)|DIRECT_TLS_ACCEPTING_MX_COUNT|MAIL_SENT|PRODUCTION_MUTATION)='
grep -Fxq 'MAIL_SENT=NO' <<< "$safe"; grep -Fxq 'PRODUCTION_MUTATION=NONE' <<< "$safe"
rm -f -- "$key" "$known"
