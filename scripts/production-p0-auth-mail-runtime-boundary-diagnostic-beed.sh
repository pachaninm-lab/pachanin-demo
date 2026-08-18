#!/usr/bin/env bash
set -Eeuo pipefail

: "${TARGET_SHA:?}"
: "${DEFAULT_HOST:?}"
: "${LIVE_DOMAIN:?}"
: "${SSH_USER_SECRET:?}"
: "${SSH_HOST_FINGERPRINT_SECRET:?}"

trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
host="$(trim "${SSH_HOST_SECRET:-$DEFAULT_HOST}")"
user="$(trim "$SSH_USER_SECRET")"
port="$(trim "${SSH_PORT_SECRET:-22}")"
expected="$(trim "$SSH_HOST_FINGERPRINT_SECRET")"
test "$host" = "$DEFAULT_HOST"
[[ "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]]; ((port>=1 && port<=65535))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u | grep -Fxq "$DEFAULT_HOST"
mkdir -p "$HOME/.ssh"; chmod 700 "$HOME/.ssh"
key="$HOME/.ssh/id_pc_prod"
validate(){ local src="$1" pub; tr -d '\r' < "$src" > "$key"; chmod 600 "$key"; pub="$(mktemp)"; ssh-keygen -y -P '' -f "$key" > "$pub" 2>/dev/null; local rc=$?; rm -f "$pub"; return $rc; }
try_key(){
  local raw="$1" a b c
  test -n "$raw" || return 1
  a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"
  printf '%s\n' "$raw" > "$a"; validate "$a" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate "$b" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "$raw" | base64 -d > "$c" 2>/dev/null && validate "$c" && { rm -f "$a" "$b" "$c"; return 0; }
  rm -f "$a" "$b" "$c"; return 1
}
try_key "${SSH_KEY_PRIMARY:-}" || try_key "${SSH_KEY_SECONDARY:-}" || try_key "${SSH_KEY_FALLBACK:-}"
scan="$(mktemp)"; match="$(mktemp)"
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
while IFS= read -r line; do
  fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  test "$fp" != "$expected" || printf '%s\n' "$line" >> "$match"
done < "$scan"
sort -u -o "$match" "$match"; test "$(grep -c . "$match")" = 1
mv "$match" "$HOME/.ssh/known_hosts"; chmod 600 "$HOME/.ssh/known_hosts"; rm -f "$scan"

out="$(mktemp)"; trap 'rm -f "$out"' EXIT
ssh -i "$key" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 "$user@$host" "bash -s -- '$TARGET_SHA'" > "$out" <<'REMOTE'
set -Eeuo pipefail
target="$1"
emit(){ printf '%s=%s\n' "$1" "$2"; }
finish(){ emit RUNTIME_BOUNDARY_CLASS "$1"; emit AUTHORITY_FILE_CLASS "$2"; emit PRODUCTION_MUTATION NONE; exit 0; }
test "$(id -u)" -eq 0 || finish ROOT_REQUIRED NOT_CHECKED
mapfile -t webs < <(docker ps -q --filter 'label=com.docker.compose.service=web')
test "${#webs[@]}" -eq 1 || finish RUNTIME_CARDINALITY_INVALID NOT_CHECKED
web="${webs[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web")"
work="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web")"
test -n "$project" && test -n "$work" && test -d "$work" || finish COMPOSE_AUTHORITY_MISSING NOT_CHECKED
mapfile -t apis < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
mapfile -t workers < <(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker')
test "${#apis[@]}" -eq 1 && test "${#workers[@]}" -eq 1 || finish RUNTIME_CARDINALITY_INVALID NOT_CHECKED
api="${apis[0]}"; worker="${workers[0]}"
arev="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api" 2>/dev/null || true)"
wrev="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web" 2>/dev/null || true)"
mrev="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker" 2>/dev/null || true)"
parity=0; test "$arev" = "$target" && test "$wrev" = "$target" && test "$mrev" = "$target" && parity=1 || true

classify_file(){
python3 - "$1" "$2" <<'PY'
import re,sys
p,kind=sys.argv[1:]
try: raw=open(p,encoding='utf-8').read()
except Exception: print('MISSING'); raise SystemExit
if not raw.endswith('\n') or '\r' in raw or '\0' in raw: print('FORMAT'); raise SystemExit
vals={}
for line in raw.rstrip('\n').split('\n'):
    k,s,v=line.partition('=')
    if not s or k in vals: print('FORMAT'); raise SystemExit
    vals[k]=v
expected={
 'web':{'MFA_LOGIN_TICKET_SECRET','GEKTA_ANONYMOUS_SESSION_SECRET'},
 'api':{'GEKTA_PHONE_ENCRYPTION_KEY','GEKTA_PHONE_LOOKUP_PEPPER'},
 'reset':{'PASSWORD_RESET_DELIVERY_KEY'},
 'transport':{'PC_SMTP_HOST','PC_SMTP_PORT','PC_SMTP_USER','PC_SMTP_PASS','PC_MAIL_FROM'},
}.get(kind,set())
if set(vals)!=expected: print('KEYSET'); raise SystemExit
if kind=='transport':
    if vals['PC_SMTP_HOST']!='mail.hosting.reg.ru' or vals['PC_SMTP_PORT']!='465': print('TRANSPORT_ENDPOINT'); raise SystemExit
    if vals['PC_MAIL_FROM']!='access@xn----8sbjf4befbjgs9b.xn--p1ai': print('TRANSPORT_SENDER'); raise SystemExit
    if not re.fullmatch(r'[^\s@<>]+@[^\s@<>]+',vals['PC_SMTP_USER']): print('TRANSPORT_USER'); raise SystemExit
    pw=vals['PC_SMTP_PASS']
    if not 8<=len(pw)<=512 or any(c in pw for c in '\r\n\0'): print('TRANSPORT_PASSWORD'); raise SystemExit
print('PASS')
PY
}
webf="$(classify_file "$work/.pc-gekta-web-runtime.env" web)"
apif="$(classify_file "$work/.pc-gekta-api-runtime.env" api)"
resetf="$(classify_file "$work/.pc-password-reset-delivery.env" reset)"
transportf="$(classify_file /var/lib/pc-secret-authority/runtime/transport.env transport)"
authority="WEB_${webf}_API_${apif}_RESET_${resetf}_TRANSPORT_${transportf}"
if test "$webf" != PASS || test "$apif" != PASS || test "$resetf" != PASS || test "$transportf" != PASS; then finish AUTHORITY_FILE_INVALID "$authority"; fi

envnames(){ docker inspect --format '{{json .Config.Env}}' "$1" | python3 -c "import json,sys; print('\\n'.join(sorted(str(x).partition('=')[0] for x in (json.load(sys.stdin) or []))))"; }
webn="$(envnames "$web")"; apin="$(envnames "$api")"; workern="$(envnames "$worker")"
grep -Eq '^AUTH_MAIL_' <<< "$webn" && finish WEB_WORKER_AUTHORITY_PRESENT "$authority"
grep -Eq '^(PC_SMTP_|PC_MAIL_FROM|RESEND_API_KEY|RESEND_FROM_EMAIL|AUTH_MAIL_DATABASE_URL_FILE|AUTH_MAIL_TRANSPORT_FILE)$' <<< "$apin" && finish API_FORBIDDEN_MAIL_AUTHORITY_PRESENT "$authority"
grep -Eq '^(PC_SMTP_PASS|AUTH_MAIL_DATABASE_URL)$' <<< "$workern" && finish WORKER_PLAINTEXT_SECRET_PRESENT "$authority"

cfg_label="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web" 2>/dev/null || true)"
test -n "$cfg_label" || finish COMPOSE_CONFIG_FILES_MISSING "$authority"
IFS=',' read -r -a files <<< "$cfg_label"; args=()
for f in "${files[@]}"; do test -f "$f" || finish COMPOSE_CONFIG_FILE_MISSING "$authority"; args+=( -f "$f" ); done
model="$(mktemp)"; trap 'rm -f "$model"' EXIT
docker compose -p "$project" "${args[@]}" config --format json > "$model" 2>/dev/null || finish COMPOSE_CONFIG_RENDER_FAILED "$authority"
modelclass="$(python3 - "$model" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); s=d.get('services',{})
def env(x):
    e=s.get(x,{}).get('environment') or {}
    if isinstance(e,list): return {str(v).partition('=')[0] for v in e}
    return set(map(str,e))
web,api,worker=env('web'),env('api'),env('auth-mail-worker')
if any(k.startswith('AUTH_MAIL_') for k in web): print('MODEL_WEB_WORKER_AUTHORITY'); raise SystemExit
if api & {'PC_SMTP_HOST','PC_SMTP_PORT','PC_SMTP_USER','PC_SMTP_PASS','PC_MAIL_FROM','RESEND_API_KEY','RESEND_FROM_EMAIL','AUTH_MAIL_DATABASE_URL_FILE','AUTH_MAIL_TRANSPORT_FILE'}: print('MODEL_API_FORBIDDEN_MAIL_AUTHORITY'); raise SystemExit
if worker & {'PC_SMTP_PASS','AUTH_MAIL_DATABASE_URL'}: print('MODEL_WORKER_PLAINTEXT_SECRET'); raise SystemExit
print('PASS')
PY
)"
test "$modelclass" = PASS || finish "$modelclass" "$authority"
if test "$parity" = 1; then finish CURRENT_RUNTIME_BOUNDARY_PASS "$authority"; else finish CURRENT_RUNTIME_CLEAN_BUT_WORKER_REVISION_DRIFT "$authority"; fi
REMOTE

grep -E '^(RUNTIME_BOUNDARY_CLASS|AUTHORITY_FILE_CLASS|PRODUCTION_MUTATION)=' "$out"
test "$(grep '^PRODUCTION_MUTATION=' "$out")" = 'PRODUCTION_MUTATION=NONE'
