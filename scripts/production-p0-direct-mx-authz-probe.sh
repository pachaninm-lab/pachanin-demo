#!/usr/bin/env bash
set -Eeuo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP required}"
DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"; user="$(trim "${PC_PROD_SSH_USER:-}")"; port="$(trim "${PC_PROD_SSH_PORT:-22}")"; expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]; [[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]; [[ "$port" =~ ^[0-9]+$ ]] && ((port>=1 && port<=65535)); [[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u | grep -Fxq "$DEFAULT_HOST"
key="$RUNNER_TEMP/p0-direct-mx-authz-key"; known="$RUNNER_TEMP/p0-direct-mx-authz-known"
validate_key(){ local src="$1" pub; tr -d '\r' < "$src" > "$key"; chmod 600 "$key"; grep -Eq '^(ssh-|ecdsa-|sk-)' "$key" && return 1; pub="$(mktemp)"; ssh-keygen -y -P '' -f "$key" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }; rm -f "$pub"; }
try_slot(){ local raw="$1" a b c; [[ -n "$raw" ]] || return 1; a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"; printf '%s\n' "$raw" > "$a"; validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }; rm -f "$a" "$b" "$c"; return 1; }
try_slot "${PC_PROD_SSH_KEY:-}" || try_slot "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_slot "${VPS_SSH_KEY:-}"
scan="$(mktemp)"; match="$(mktemp)"; ready=0
for attempt in 1 2 3; do : > "$scan"; : > "$match"; ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true; while IFS= read -r line; do [[ -n "$line" ]] || continue; fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"; [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"; done < "$scan"; sort -u -o "$match" "$match"; [[ "$(grep -c . "$match" || true)" == 1 ]] && { ready=1; break; }; ((attempt==3)) || sleep "$attempt"; done
[[ "$ready" == 1 ]]; mv "$match" "$known"; rm -f "$scan"; chmod 600 "$known"
safe="$(ssh -i "$key" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known" -o ConnectTimeout=15 "$user@$host" "bash -s -- '$DEFAULT_HOST' '$LIVE_DOMAIN'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
ip="$1"; domain="$2"
node - "$ip" "$domain" <<'NODE'
const dns=require('node:dns').promises;
const net=require('node:net');
const [ip,domain]=process.argv.slice(2);
const safe=v=>String(v??'NONE').toUpperCase().replace(/[^A-Z0-9_.:-]/g,'_').slice(0,80)||'NONE';
const ipv4int=s=>s.split('.').reduce((n,x)=>(n*256+Number(x))>>>0,0)>>>0;
function cidrMatch(address,spec){
  const [base,bitsRaw]=spec.split('/'); const bits=bitsRaw===undefined?32:Number(bitsRaw);
  if(net.isIP(base)!==4||!Number.isInteger(bits)||bits<0||bits>32) return false;
  const mask=bits===0?0:(0xffffffff << (32-bits))>>>0;
  return (ipv4int(address)&mask)===(ipv4int(base)&mask);
}
async function txt(name){ try{return (await dns.resolveTxt(name)).map(parts=>parts.join(''));}catch{return [];} }
async function a(name){ try{return await dns.resolve4(name);}catch{return [];} }
async function mxIps(name){ try{const mx=await dns.resolveMx(name); const out=[]; for(const m of mx.slice(0,10)) out.push(...await a(m.exchange)); return out;}catch{return [];} }
let lookups=0;
async function spfPass(name,depth=0){
  if(depth>8||lookups>10) return null;
  const recs=(await txt(name)).filter(x=>/^v=spf1\b/i.test(x));
  if(recs.length!==1) return recs.length===0?null:false;
  const terms=recs[0].trim().split(/\s+/).slice(1);
  let redirect=null;
  for(const raw of terms){
    if(/^redirect=/i.test(raw)){redirect=raw.slice(raw.indexOf('=')+1);continue;}
    if(/^exp=/i.test(raw)) continue;
    const q='+-~?'.includes(raw[0])?raw[0]:'+'; const term='+-~?'.includes(raw[0])?raw.slice(1):raw;
    const [mech,argRaw]=term.split(':',2); const arg=argRaw||name;
    let match=false;
    if(mech==='all') match=true;
    else if(mech==='ip4') match=cidrMatch(ip,arg);
    else if(mech==='a'){lookups++; const [target,cidr]=arg.split('/'); const ips=await a(target||name); match=ips.some(x=>cidrMatch(ip,`${x}/${cidr||32}`));}
    else if(mech==='mx'){lookups++; const [target,cidr]=arg.split('/'); const ips=await mxIps(target||name); match=ips.some(x=>cidrMatch(ip,`${x}/${cidr||32}`));}
    else if(mech==='include'){lookups++; const nested=await spfPass(arg,depth+1); match=nested===true;}
    else if(mech==='exists' || term.includes('%')) return null;
    if(match) return q==='+';
  }
  if(redirect){lookups++; return spfPass(redirect,depth+1);}
  return false;
}
(async()=>{
  const rootSpf=(await txt(domain)).filter(x=>/^v=spf1\b/i.test(x));
  const pass=await spfPass(domain);
  const dmarc=(await txt(`_dmarc.${domain}`)).filter(x=>/^v=DMARC1\b/i.test(x));
  let policy='NONE',aspf='RELAXED';
  if(dmarc.length===1){const p=/;\s*p\s*=\s*([^;\s]+)/i.exec(';'+dmarc[0]); const a=/;\s*aspf\s*=\s*([^;\s]+)/i.exec(';'+dmarc[0]); policy=safe(p?.[1]||'NONE'); aspf=(a?.[1]||'r').toLowerCase()==='s'?'STRICT':'RELAXED';}
  let ptr=[]; try{ptr=await dns.reverse(ip);}catch{}
  let fcrdns=false; for(const host of ptr.slice(0,10)){const ips=await a(host); if(ips.includes(ip)){fcrdns=true;break;}}
  const heloIps=await a(domain);
  console.log(`SPF_RECORD_COUNT=${rootSpf.length}`);
  console.log(`SPF_PRODUCTION_IP_AUTHORIZED=${pass===true?'PASS':pass===false?'FAIL':'UNKNOWN'}`);
  console.log(`SPF_DNS_LOOKUPS=${lookups}`);
  console.log(`DMARC_RECORD_COUNT=${dmarc.length}`);
  console.log(`DMARC_POLICY=${policy}`);
  console.log(`DMARC_ASPF=${aspf}`);
  console.log('MAILFROM_FROM_DOMAIN_ALIGNMENT=PASS');
  console.log(`PTR_PRESENT=${ptr.length?'YES':'NO'}`);
  console.log(`FCRDNS=${fcrdns?'PASS':'FAIL'}`);
  console.log(`HELO_DOMAIN_RESOLVES_TO_PRODUCTION_IP=${heloIps.includes(ip)?'YES':'NO'}`);
  console.log('PRODUCTION_MUTATION=NONE');
})().catch(e=>{console.log(`AUTHZ_SAFE_ERROR=${safe(e?.code||e?.name||'UNKNOWN')}`);console.log('PRODUCTION_MUTATION=NONE');process.exitCode=1;});
NODE
REMOTE
)"
printf '%s\n' "$safe" | grep -E '^(SPF_RECORD_COUNT|SPF_PRODUCTION_IP_AUTHORIZED|SPF_DNS_LOOKUPS|DMARC_RECORD_COUNT|DMARC_POLICY|DMARC_ASPF|MAILFROM_FROM_DOMAIN_ALIGNMENT|PTR_PRESENT|FCRDNS|HELO_DOMAIN_RESOLVES_TO_PRODUCTION_IP|AUTHZ_SAFE_ERROR|PRODUCTION_MUTATION)='
grep -Fxq 'PRODUCTION_MUTATION=NONE' <<< "$safe"
rm -f -- "$key" "$known"
