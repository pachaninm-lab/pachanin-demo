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
key="$RUNNER_TEMP/p0-direct-mx-canary-key"; known="$RUNNER_TEMP/p0-direct-mx-canary-known"
validate_key(){ local src="$1" pub; tr -d '\r' < "$src" > "$key"; chmod 600 "$key"; grep -Eq '^(ssh-|ecdsa-|sk-)' "$key" && return 1; pub="$(mktemp)"; ssh-keygen -y -P '' -f "$key" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }; rm -f "$pub"; }
try_slot(){ local raw="$1" a b c; [[ -n "$raw" ]] || return 1; a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"; printf '%s\n' "$raw" > "$a"; validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }; rm -f "$a" "$b" "$c"; return 1; }
try_slot "${PC_PROD_SSH_KEY:-}" || try_slot "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_slot "${VPS_SSH_KEY:-}"
scan="$(mktemp)"; match="$(mktemp)"; ready=0
for attempt in 1 2 3; do : > "$scan"; : > "$match"; ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true; while IFS= read -r line; do [[ -n "$line" ]] || continue; fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"; [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"; done < "$scan"; sort -u -o "$match" "$match"; [[ "$(grep -c . "$match" || true)" == 1 ]] && { ready=1; break; }; ((attempt==3)) || sleep "$attempt"; done
[[ "$ready" == 1 ]]; mv "$match" "$known"; rm -f "$scan"; chmod 600 "$known"
safe="$(ssh -i "$key" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known" -o ConnectTimeout=15 "$user@$host" "bash -s -- '$CANARY_ID'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
canary="$1"; [[ "$canary" =~ ^pc-p0-direct-mx-canary-[0-9]{6,24}$ ]]
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api'); (( ${#api_ids[@]} == 1 )); api_id="${api_ids[0]}"
recipient="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const {PrismaClient}=require('@prisma/client'); let db;
(async()=>{const url=String(process.env.STAFF_DATABASE_URL||'').trim(); if(!url) throw new Error('DB_URL'); db=new PrismaClient({datasources:{db:{url}}}); const p=(await db.$queryRawUnsafe("SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user"))[0]; if(!p||p.current_user!=='pc_staff_runtime'||p.rolsuper||p.rolbypassrls) throw new Error('PRINCIPAL'); const rows=await db.$queryRawUnsafe("SELECT auth.staff_reviewer_password_reset_subject() AS email"); const e=String(rows?.[0]?.email||''); if(!/^[^\\s@]{1,64}@[^\\s@]{1,189}$/.test(e)) throw new Error('SUBJECT'); process.stdout.write(e);})().catch(()=>process.exitCode=1).finally(async()=>{if(db) await db.$disconnect().catch(()=>{});});
NODE
)"
[[ "$recipient" =~ ^[^[:space:]@]{1,64}@[^[:space:]@]{1,189}$ ]]
RECIPIENT="$recipient" CANARY="$canary" docker exec -i -e RECIPIENT -e CANARY "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const dns=require('node:dns').promises;
const net=require('node:net');
const tls=require('node:tls');
const recipient=String(process.env.RECIPIENT||''); const canary=String(process.env.CANARY||'');
const sender='access@xn----8sbjf4befbjgs9b.xn--p1ai'; const ehlo='xn----8sbjf4befbjgs9b.xn--p1ai';
const safe=v=>String(v??'NONE').toUpperCase().replace(/[^A-Z0-9_:-]/g,'_').slice(0,80)||'NONE';
function connectMx(host){return new Promise((resolve,reject)=>{const socket=net.createConnection({host,port:25});socket.setTimeout(15000);socket.once('error',reject);socket.once('timeout',()=>reject(new Error('TIMEOUT')));socket.once('connect',()=>resolve(socket));});}
class Session{
  constructor(socket){this.socket=socket;this.buf='';socket.setEncoding('utf8');}
  read(){return new Promise((resolve,reject)=>{const parse=()=>{const lines=this.buf.split('\r\n');let used=0,code=null,final=false;for(let i=0;i<lines.length-1;i++){const line=lines[i];used+=line.length+2;const m=/^(\d{3})([ -])/.exec(line);if(!m)continue;code=Number(m[1]);if(m[2]===' '){final=true;break;}}if(final&&code){this.buf=this.buf.slice(used);cleanup();resolve(code);}};const data=c=>{this.buf+=c;parse();};const err=()=>{cleanup();reject(new Error('SOCKET'));};const cleanup=()=>{this.socket.off('data',data);this.socket.off('error',err);};this.socket.on('data',data);this.socket.on('error',err);parse();});}
  async cmd(line,expected){this.socket.write(`${line}\r\n`);const code=await this.read();if(!expected.includes(code)){const e=new Error(`SMTP_${code}`);e.smtpCode=code;throw e;}return code;}
}
(async()=>{
  const domain=recipient.slice(recipient.lastIndexOf('@')+1); const mx=(await dns.resolveMx(domain)).sort((a,b)=>a.priority-b.priority).slice(0,2); if(!mx.length) throw new Error('NO_MX');
  let delivered=false,last='NONE';
  for(const target of mx){let socket;try{
    socket=await connectMx(target.exchange); let s=new Session(socket); await s.read(); await s.cmd(`EHLO ${ehlo}`,[250]); await s.cmd('STARTTLS',[220]);
    socket=await new Promise((resolve,reject)=>{const secured=tls.connect({socket,servername:target.exchange,rejectUnauthorized:true,minVersion:'TLSv1.2'},()=>resolve(secured));secured.once('error',reject);});
    s=new Session(socket); await s.cmd(`EHLO ${ehlo}`,[250]); await s.cmd(`MAIL FROM:<${sender}>`,[250]); await s.cmd(`RCPT TO:<${recipient}>`,[250,251]); await s.cmd('DATA',[354]);
    const message=[`From: PC-CROP <${sender}>`,`To: <${recipient}>`,'Subject: PC-CROP delivery canary',`Date: ${new Date().toUTCString()}`,`Message-ID: <${canary}@xn----8sbjf4befbjgs9b.xn--p1ai>`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 7bit','Auto-Submitted: auto-generated','X-Auto-Response-Suppress: All','',`PC-CROP production mail delivery canary ${canary}. No credentials, tokens or personal data.`].join('\r\n');
    socket.write(`${message}\r\n.\r\n`); const accepted=await s.read(); if(accepted!==250){const e=new Error(`SMTP_${accepted}`);e.smtpCode=accepted;throw e;} delivered=true; try{await s.cmd('QUIT',[221]);}catch{} socket.destroy(); break;
  }catch(e){last=safe(e?.smtpCode||e?.code||e?.name||'UNKNOWN');try{socket?.destroy();}catch{}}}
  console.log(`DIRECT_CANARY_SMTP_ACCEPTED=${delivered?'PASS':'FAIL'}`); console.log(`DIRECT_CANARY_SAFE_ERROR=${delivered?'NONE':last}`); console.log('DATABASE_MUTATION=NONE'); console.log('IDENTITY_MUTATION=NONE'); console.log('MAIL_MUTATION=SYNTHETIC_CANARY_ONLY'); if(!delivered) process.exitCode=1;
})().catch(e=>{console.log('DIRECT_CANARY_SMTP_ACCEPTED=FAIL');console.log(`DIRECT_CANARY_SAFE_ERROR=${safe(e?.smtpCode||e?.code||e?.name||'UNKNOWN')}`);console.log('DATABASE_MUTATION=NONE');console.log('IDENTITY_MUTATION=NONE');console.log('MAIL_MUTATION=SYNTHETIC_CANARY_ONLY');process.exitCode=1;});
NODE
unset recipient
REMOTE
)"
printf '%s\n' "$safe" | grep -E '^(DIRECT_CANARY_SMTP_ACCEPTED|DIRECT_CANARY_SAFE_ERROR|DATABASE_MUTATION|IDENTITY_MUTATION|MAIL_MUTATION)='
grep -Fxq 'DIRECT_CANARY_SMTP_ACCEPTED=PASS' <<< "$safe"
message_id="<$CANARY_ID@xn----8sbjf4befbjgs9b.xn--p1ai>"
mailbox_result=0
for attempt in 1 2 3 4 5 6; do
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
  status,data=c.search(None,'ALL')
  if status!='OK': sys.exit(74)
  matches=0
  for ident in reversed((data[0] or b'').split()[-1000:]):
    st,rows=c.fetch(ident,'(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID SUBJECT)])')
    if st!='OK': continue
    raw=next((x[1] for x in rows if isinstance(x,tuple) and len(x)>1),None)
    if not raw: continue
    msg=email.message_from_bytes(raw,policy=default)
    if str(msg.get('message-id') or '').strip()==mid: matches+=1
  print(f'DIRECT_CANARY_MAILBOX_MATCH_COUNT={matches}')
  print('DIRECT_CANARY_MAILBOX_READ_ONLY=PASS')
  sys.exit(0 if matches==1 else 3)
finally:
  try:c.logout()
  except Exception:pass
PY
  rc=$?
  set -e
  if [[ "$rc" == 0 ]]; then mailbox_result=1; break; fi
  [[ "$rc" == 3 ]] || exit "$rc"
  (( attempt==6 )) || sleep 10
done
[[ "$mailbox_result" == 1 ]]
printf '%s\n' 'DIRECT_CANARY_DELIVERY_GATE=PASS' 'PRODUCTION_MUTATION=SYNTHETIC_CANARY_MAIL_ONLY'
rm -f -- "$key" "$known"
