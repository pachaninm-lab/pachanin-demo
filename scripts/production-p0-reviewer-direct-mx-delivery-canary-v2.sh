#!/usr/bin/env bash
set -Eeuo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP required}"
: "${CANARY_ID:?CANARY_ID required}"
DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
[[ "$CANARY_ID" =~ ^pc-p0-direct-mx-canary-[0-9]{6,24}$ ]]
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"; user="$(trim "${PC_PROD_SSH_USER:-}")"; port="$(trim "${PC_PROD_SSH_PORT:-22}")"; expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]; [[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]; [[ "$port" =~ ^[0-9]+$ ]] && ((port>=1 && port<=65535)); [[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u | grep -Fxq "$DEFAULT_HOST"
key="$RUNNER_TEMP/p0-direct-mx-canary-v2-key"; known="$RUNNER_TEMP/p0-direct-mx-canary-v2-known"
validate_key(){ local src="$1" pub; tr -d '\r' < "$src" > "$key"; chmod 600 "$key"; grep -Eq '^(ssh-|ecdsa-|sk-)' "$key" && return 1; pub="$(mktemp)"; ssh-keygen -y -P '' -f "$key" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }; rm -f "$pub"; }
try_slot(){ local raw="$1" a b c; [[ -n "$raw" ]] || return 1; a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"; printf '%s\n' "$raw" > "$a"; validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }; rm -f "$a" "$b" "$c"; return 1; }
try_slot "${PC_PROD_SSH_KEY:-}" || try_slot "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_slot "${VPS_SSH_KEY:-}"
scan="$(mktemp)"; match="$(mktemp)"; ready=0
for attempt in 1 2 3; do
  : > "$scan"; : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true
  while IFS= read -r line; do [[ -n "$line" ]] || continue; fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"; [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"; done < "$scan"
  sort -u -o "$match" "$match"; [[ "$(grep -c . "$match" || true)" == 1 ]] && { ready=1; break; }; ((attempt==3)) || sleep "$attempt"
done
[[ "$ready" == 1 ]]; mv "$match" "$known"; rm -f "$scan"; chmod 600 "$known"
set +e
safe="$(ssh -i "$key" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known" -o ConnectTimeout=15 "$user@$host" "bash -s -- '$CANARY_ID'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
canary="$1"; [[ "$canary" =~ ^pc-p0-direct-mx-canary-[0-9]{6,24}$ ]]
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api'); (( ${#api_ids[@]} == 1 )); api_id="${api_ids[0]}"
recipient="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const {PrismaClient}=require('@prisma/client'); let db;
(async()=>{const url=String(process.env.STAFF_DATABASE_URL||'').trim(); if(!url) throw new Error('DB_URL'); db=new PrismaClient({datasources:{db:{url}}}); const p=(await db.$queryRawUnsafe("SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user"))[0]; if(!p||p.current_user!=='pc_staff_runtime'||p.rolsuper||p.rolbypassrls) throw new Error('PRINCIPAL'); const r=await db.$queryRawUnsafe("SELECT auth.staff_reviewer_password_reset_subject() AS email"); const e=String(r?.[0]?.email||''); if(!/^[^\\s@]{1,64}@[^\\s@]{1,189}$/.test(e)) throw new Error('SUBJECT'); process.stdout.write(e);})().catch(()=>process.exitCode=1).finally(async()=>{if(db) await db.$disconnect().catch(()=>{});});
NODE
)"
[[ "$recipient" =~ ^[^[:space:]@]{1,64}@[^[:space:]@]{1,189}$ ]]
mx_lines="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - "$recipient" <<'NODE'
const dns=require('node:dns').promises; const email=process.argv[2]; const domain=email.slice(email.lastIndexOf('@')+1); (async()=>{for(const x of (await dns.resolveMx(domain)).sort((a,b)=>a.priority-b.priority).slice(0,2)) console.log(x.exchange);})().catch(()=>process.exitCode=1);
NODE
)"
mapfile -t mxs <<< "$mx_lines"; unset mx_lines; (( ${#mxs[@]} >= 1 && ${#mxs[@]} <= 2 ))
RECIPIENT="$recipient" CANARY="$canary" MX1="${mxs[0]}" MX2="${mxs[1]:-}" python3 - <<'PY'
import os,re,smtplib,ssl,sys
from email.message import EmailMessage
from email.policy import SMTP
recipient=os.environ['RECIPIENT']; canary=os.environ['CANARY']; mxs=[x for x in [os.environ.get('MX1',''),os.environ.get('MX2','')] if x]
sender='access@xn----8sbjf4befbjgs9b.xn--p1ai'
def safe(v): return re.sub(r'[^A-Z0-9_:-]','_',str(v).upper())[:80] or 'NONE'
msg=EmailMessage(policy=SMTP); msg['From']=f'PC-CROP <{sender}>'; msg['To']=recipient; msg['Subject']='PC-CROP delivery canary'; msg['Message-ID']=f'<{canary}@xn----8sbjf4befbjgs9b.xn--p1ai>'; msg['Auto-Submitted']='auto-generated'; msg['X-Auto-Response-Suppress']='All'; msg.set_content(f'PC-CROP production mail delivery canary {canary}. No credentials, tokens or personal data.',cte='7bit')
accepted=False; last='NONE'; stage='BOOTSTRAP'
for mx in mxs:
    s=None
    try:
        stage='CONNECT'; s=smtplib.SMTP(mx,25,timeout=15); code,_=s.ehlo();
        if code!=250 or not s.has_extn('starttls'): raise RuntimeError('STARTTLS_REQUIRED')
        stage='STARTTLS'; code,_=s.starttls(context=ssl.create_default_context());
        if code!=220: raise RuntimeError('STARTTLS_FAILED')
        code,_=s.ehlo();
        if code!=250: raise RuntimeError('EHLO_TLS_FAILED')
        stage='SEND'; refused=s.sendmail(sender,[recipient],msg.as_bytes(policy=SMTP))
        if refused: raise RuntimeError('RECIPIENT_REFUSED')
        accepted=True; stage='ACCEPTED'; last='NONE'
        try:s.quit()
        except Exception:pass
        break
    except Exception as e:
        last=safe(getattr(e,'smtp_code',None) or getattr(e,'verify_code',None) or type(e).__name__); stage=safe(stage)
        try:
            if s:s.close()
        except Exception:pass
print(f'DIRECT_CANARY_SMTP_ACCEPTED={"PASS" if accepted else "FAIL"}')
print(f'DIRECT_CANARY_STAGE={stage}')
print(f'DIRECT_CANARY_SAFE_ERROR={last}')
print('DATABASE_MUTATION=NONE'); print('IDENTITY_MUTATION=NONE'); print('MAIL_MUTATION=SYNTHETIC_CANARY_ONLY')
sys.exit(0 if accepted else 5)
PY
unset recipient
REMOTE
)"
remote_rc=$?
set -e
printf '%s\n' "$safe" | grep -E '^(DIRECT_CANARY_SMTP_ACCEPTED|DIRECT_CANARY_STAGE|DIRECT_CANARY_SAFE_ERROR|DATABASE_MUTATION|IDENTITY_MUTATION|MAIL_MUTATION)=' || true
[[ "$remote_rc" == 0 ]]
grep -Fxq 'DIRECT_CANARY_SMTP_ACCEPTED=PASS' <<< "$safe"
message_id="<$CANARY_ID@xn----8sbjf4befbjgs9b.xn--p1ai>"; mailbox_result=0
for attempt in 1 2 3 4 5 6 7 8 9; do
  set +e
  MESSAGE_ID="$message_id" python3 - <<'PY'
import email,imaplib,os,re,ssl,sys
from email.policy import default
mid=os.environ['MESSAGE_ID']; host=os.environ.get('PC_P0_IMAP_HOST','').strip(); user=os.environ.get('PC_P0_IMAP_USER','').strip(); password=os.environ.get('PC_P0_IMAP_PASSWORD',''); port=int((os.environ.get('PC_P0_IMAP_PORT') or '993').strip()); folder=(os.environ.get('PC_P0_IMAP_FOLDER') or 'INBOX').strip() or 'INBOX'
if not host or not user or not password or not re.fullmatch(r'<pc-p0-direct-mx-canary-[0-9]{6,24}@xn----8sbjf4befbjgs9b\.xn--p1ai>',mid): sys.exit(71)
c=imaplib.IMAP4_SSL(host,port,ssl_context=ssl.create_default_context(),timeout=15)
try:
  if c.login(user,password)[0]!='OK': sys.exit(72)
  if c.select(folder,readonly=True)[0]!='OK': sys.exit(73)
  st,data=c.search(None,'ALL');
  if st!='OK': sys.exit(74)
  matches=0
  for ident in reversed((data[0] or b'').split()[-1000:]):
    st,rows=c.fetch(ident,'(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])')
    if st!='OK': continue
    raw=next((x[1] for x in rows if isinstance(x,tuple) and len(x)>1),None)
    if raw and str(email.message_from_bytes(raw,policy=default).get('message-id') or '').strip()==mid: matches+=1
  print(f'DIRECT_CANARY_MAILBOX_MATCH_COUNT={matches}'); print('DIRECT_CANARY_MAILBOX_READ_ONLY=PASS'); sys.exit(0 if matches==1 else 3)
finally:
  try:c.logout()
  except Exception:pass
PY
  rc=$?; set -e
  if [[ "$rc" == 0 ]]; then mailbox_result=1; break; fi
  [[ "$rc" == 3 ]] || exit "$rc"; (( attempt==9 )) || sleep 10
done
[[ "$mailbox_result" == 1 ]]
printf '%s\n' 'DIRECT_CANARY_DELIVERY_GATE=PASS' 'PRODUCTION_MUTATION=SYNTHETIC_CANARY_MAIL_ONLY'
rm -f -- "$key" "$known"
