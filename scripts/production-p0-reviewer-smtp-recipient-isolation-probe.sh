#!/usr/bin/env bash
set -Eeuo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP required}"
DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"; user="$(trim "${PC_PROD_SSH_USER:-}")"; port="$(trim "${PC_PROD_SSH_PORT:-22}")"; expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]; [[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]; [[ "$port" =~ ^[0-9]+$ ]] && ((port>=1 && port<=65535)); [[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u | grep -Fxq "$DEFAULT_HOST"
key="$RUNNER_TEMP/p0-smtp-isolation-key"; known="$RUNNER_TEMP/p0-smtp-isolation-known"
validate_key(){ local src="$1" pub; tr -d '\r' < "$src" > "$key"; chmod 600 "$key"; grep -Eq '^(ssh-|ecdsa-|sk-)' "$key" && return 1; pub="$(mktemp)"; ssh-keygen -y -P '' -f "$key" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }; rm -f "$pub"; }
try_slot(){ local raw="$1" a b c; [[ -n "$raw" ]] || return 1; a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"; printf '%s\n' "$raw" > "$a"; validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }; rm -f "$a" "$b" "$c"; return 1; }
try_slot "${PC_PROD_SSH_KEY:-}" || try_slot "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_slot "${VPS_SSH_KEY:-}"
scan="$(mktemp)"; match="$(mktemp)"; ready=0
for attempt in 1 2 3; do : > "$scan"; : > "$match"; ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true; while IFS= read -r line; do [[ -n "$line" ]] || continue; fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"; [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"; done < "$scan"; sort -u -o "$match" "$match"; [[ "$(grep -c . "$match" || true)" == 1 ]] && { ready=1; break; }; ((attempt==3)) || sleep "$attempt"; done
[[ "$ready" == 1 ]]; mv "$match" "$known"; rm -f "$scan"; chmod 600 "$known"
safe="$(ssh -i "$key" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known" -o ConnectTimeout=15 "$user@$host" 'bash -s' 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
[[ "$(id -u)" -eq 0 ]]
tmp="$(mktemp -d /root/pc-smtp-isolation.XXXXXX)"; chmod 700 "$tmp"; trap 'rm -rf -- "$tmp"' EXIT
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web'); (( ${#web_ids[@]} == 1 )); web_id="${web_ids[0]}"; project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"; [[ -n "$project" ]]
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api'); mapfile -t worker_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker'); (( ${#api_ids[@]} == 1 && ${#worker_ids[@]} == 1 )); api_id="${api_ids[0]}"; worker_id="${worker_ids[0]}"
reviewer="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const {PrismaClient}=require('@prisma/client'); let db;
(async()=>{const url=String(process.env.STAFF_DATABASE_URL||'').trim(); if(!url) throw new Error('DB_URL'); db=new PrismaClient({datasources:{db:{url}}}); const rows=await db.$queryRawUnsafe("SELECT auth.staff_reviewer_password_reset_subject() AS email"); if(rows.length!==1) throw new Error('CARDINALITY'); const e=String(rows[0].email||''); if(!/^[^\\s@]{1,64}@[^\\s@]{1,189}$/.test(e)) throw new Error('SUBJECT'); process.stdout.write(e);})().catch(()=>process.exitCode=1).finally(async()=>{if(db) await db.$disconnect().catch(()=>{});});
NODE
)"; printf '%s' "$reviewer" > "$tmp/reviewer"; unset reviewer; chmod 600 "$tmp/reviewer"
docker exec -i "$worker_id" /nodejs/bin/node --input-type=commonjs - <<'NODE' > "$tmp/config.json"
const {readFileSync}=require('node:fs'); const path=String(process.env.AUTH_MAIL_TRANSPORT_FILE||'').trim(); if(!path) process.exit(2); const out={}; for(const src of readFileSync(path,'utf8').split(/\r?\n/)){const line=src.trim(); if(!line||line.startsWith('#')) continue; const i=line.indexOf('='); if(i<=0) process.exit(3); out[line.slice(0,i).trim()]=line.slice(i+1).trim();} process.stdout.write(JSON.stringify({host:out.PC_SMTP_HOST||'',user:out.PC_SMTP_USER||'',pass:out.PC_SMTP_PASS||'',from:out.PC_MAIL_FROM||out.PC_SMTP_USER||''}));
NODE
chmod 600 "$tmp/config.json"
python3 - "$tmp/config.json" "$tmp/reviewer" <<'PY'
import base64,json,re,socket,ssl,sys
cfg=json.load(open(sys.argv[1],encoding='utf-8')); reviewer=open(sys.argv[2],encoding='utf-8').read().strip()
def mb(v):
    v=str(v or '').strip()
    if v.count('@')!=1 or re.search(r'[\r\n\x00<> ]',v): raise SystemExit(31)
    local,domain=v.rsplit('@',1); local.encode('ascii'); domain=domain.encode('idna').decode('ascii').lower(); return f'{local}@{domain}'
def readresp(f):
    first=f.readline(4096)
    if not first or len(first)<4 or not first[:3].isdigit(): raise SystemExit(32)
    c=first[:3].decode('ascii'); final=first
    if first[3:4]==b'-':
        while True:
            line=f.readline(4096)
            if not line: raise SystemExit(33)
            final=line
            if line.startswith(c.encode()+b' '): break
    return c
def cmd(sock,f,text):
    sock.sendall(text.encode('ascii')+b'\r\n'); return readresp(f)
host=str(cfg.get('host') or '').strip().lower(); auth_user=mb(cfg.get('user')); password=str(cfg.get('pass') or ''); sender=mb(cfg.get('from')); reviewer=mb(reviewer)
if host!='mail.hosting.reg.ru' or len(password)<8: raise SystemExit(34)
raw=socket.create_connection((host,587),timeout=15); raw.settimeout(15); f=raw.makefile('rb')
if readresp(f)!='220': raise SystemExit(35)
if cmd(raw,f,'EHLO xn----8sbjf4befbjgs9b.xn--p1ai')!='250': raise SystemExit(36)
if cmd(raw,f,'STARTTLS')!='220': raise SystemExit(37)
sock=ssl.create_default_context().wrap_socket(raw,server_hostname=host); sock.settimeout(15); f=sock.makefile('rb')
if cmd(sock,f,'EHLO xn----8sbjf4befbjgs9b.xn--p1ai')!='250': raise SystemExit(38)
auth=base64.b64encode(('\x00'+auth_user+'\x00'+password).encode()).decode()
if cmd(sock,f,'AUTH PLAIN '+auth)!='235': raise SystemExit(39)
def rcpt(target):
    mail=cmd(sock,f,f'MAIL FROM:<{sender}>')
    if mail!='250': return 'MAIL_'+mail
    code=cmd(sock,f,f'RCPT TO:<{target}>')
    try: cmd(sock,f,'RSET')
    except Exception: pass
    return code
reviewer_code=rcpt(reviewer)
self_code=rcpt(auth_user)
try: cmd(sock,f,'QUIT')
except Exception: pass
sock.close()
print('REVIEWER_EQUALS_SMTP_USER=' + ('YES' if reviewer.lower()==auth_user.lower() else 'NO'))
print('REVIEWER_RCPT_CODE='+re.sub(r'[^A-Z0-9_:-]','_',reviewer_code)[:40])
print('SELF_RCPT_CODE='+re.sub(r'[^A-Z0-9_:-]','_',self_code)[:40])
print('MAIL_SENT=NO')
print('PRODUCTION_MUTATION=NONE')
PY
REMOTE
)"
printf '%s\n' "$safe" | grep -E '^(REVIEWER_EQUALS_SMTP_USER|REVIEWER_RCPT_CODE|SELF_RCPT_CODE|MAIL_SENT|PRODUCTION_MUTATION)='
grep -Fxq 'MAIL_SENT=NO' <<< "$safe"; grep -Fxq 'PRODUCTION_MUTATION=NONE' <<< "$safe"
rm -f -- "$key" "$known"
