#!/usr/bin/env bash
set -Eeuo pipefail

: "${DEPLOYED_SHA:?}"
: "${DEFAULT_HOST:?}"
: "${LIVE_DOMAIN:?}"
: "${SSH_USER_SECRET:?}"
: "${SSH_HOST_FINGERPRINT_SECRET:?}"

[[ "$DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ ]]
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
ssh -i "$key" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 "$user@$host" "bash -s -- '$DEPLOYED_SHA'" > "$out" <<'REMOTE'
set -Eeuo pipefail
target="$1"
emit(){ printf '%s=%s\n' "$1" "$2"; }
finish(){ emit RUNTIME_BOUNDARY_CLASS "$1"; emit AUTHORITY_FILE_CLASS "$2"; emit PRODUCTION_MUTATION NONE; exit 0; }
test "$(id -u)" -eq 0 || finish ROOT_REQUIRED NOT_CHECKED

mapfile -t webs < <(docker ps -q --filter 'label=com.docker.compose.service=web')
test "${#webs[@]}" -eq 1 || finish RUNTIME_WEB_CARDINALITY_INVALID NOT_CHECKED
web="${webs[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web" 2>/dev/null || true)"
work="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web" 2>/dev/null || true)"
test -n "$project" && test -n "$work" && test -d "$work" && test ! -L "$work" || finish COMPOSE_AUTHORITY_MISSING NOT_CHECKED
work="$(realpath -e -- "$work")"

classify_file(){
python3 - "$1" "$2" "$3" <<'PY'
import os,re,stat,sys
p,kind,expected_mode=sys.argv[1:]
try:
    st=os.lstat(p)
except OSError:
    print('MISSING'); raise SystemExit
if stat.S_ISLNK(st.st_mode) or not stat.S_ISREG(st.st_mode):
    print('TYPE'); raise SystemExit
if stat.S_IMODE(st.st_mode) != int(expected_mode,8) or st.st_uid != 0 or st.st_gid != 0:
    print('ACCESS'); raise SystemExit
try:
    raw=open(p,encoding='utf-8').read()
except Exception:
    print('READ'); raise SystemExit
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    print('FORMAT'); raise SystemExit
vals={}
for line in raw.rstrip('\n').split('\n'):
    k,s,v=line.partition('=')
    if not s or k in vals:
        print('FORMAT'); raise SystemExit
    vals[k]=v
expected={
 'web':{'MFA_LOGIN_TICKET_SECRET','GEKTA_ANONYMOUS_SESSION_SECRET'},
 'api':{'GEKTA_PHONE_ENCRYPTION_KEY','GEKTA_PHONE_LOOKUP_PEPPER'},
 'reset':{'PASSWORD_RESET_DELIVERY_KEY','REGISTRATION_DELIVERY_KEY'},
 'transport':{'PC_SMTP_HOST','PC_SMTP_PORT','PC_SMTP_USER','PC_SMTP_PASS','PC_MAIL_FROM'},
}.get(kind,set())
if set(vals)!=expected:
    print('KEYSET'); raise SystemExit
hex64=lambda v: bool(re.fullmatch(r'[A-Fa-f0-9]{64}',v or ''))
hex96=lambda v: bool(re.fullmatch(r'[A-Fa-f0-9]{96}',v or ''))
if kind=='web':
    if not all(hex96(vals[k]) for k in expected) or len({vals[k] for k in expected}) != 2:
        print('SHAPE'); raise SystemExit
elif kind=='api':
    if not hex64(vals['GEKTA_PHONE_ENCRYPTION_KEY']) or not hex96(vals['GEKTA_PHONE_LOOKUP_PEPPER']):
        print('SHAPE'); raise SystemExit
elif kind=='reset':
    if not all(hex96(vals[k]) for k in expected) or vals['PASSWORD_RESET_DELIVERY_KEY']==vals['REGISTRATION_DELIVERY_KEY']:
        print('SHAPE'); raise SystemExit
elif kind=='transport':
    if vals['PC_SMTP_HOST']!='mail.hosting.reg.ru' or vals['PC_SMTP_PORT']!='465':
        print('ENDPOINT'); raise SystemExit
    canonical='access@xn----8sbjf4befbjgs9b.xn--p1ai'
    if vals['PC_SMTP_USER']!=canonical or vals['PC_MAIL_FROM']!=canonical:
        print('IDENTITY'); raise SystemExit
    pw=vals['PC_SMTP_PASS']
    if not 8<=len(pw)<=512 or any(c in pw for c in '\r\n\0'):
        print('PASSWORD'); raise SystemExit
print('PASS')
PY
}
webf="$(classify_file "$work/.pc-gekta-web-runtime.env" web 600)"
apif="$(classify_file "$work/.pc-gekta-api-runtime.env" api 600)"
resetf="$(classify_file "$work/.pc-password-reset-delivery.env" reset 600)"
transportf="$(classify_file /var/lib/pc-secret-authority/runtime/transport.env transport 444)"
authority="WEB_${webf}_API_${apif}_RESET_${resetf}_TRANSPORT_${transportf}"
if test "$webf" != PASS || test "$apif" != PASS || test "$resetf" != PASS || test "$transportf" != PASS; then
  finish AUTHORITY_FILE_INVALID "$authority"
fi

short="${target:0:7}"
target_api_image="ghcr.io/pachaninm-lab/grainflow-api:sha-${short}"
target_web_image="ghcr.io/pachaninm-lab/grainflow-web:sha-${short}"
for pair in "$target_api_image:$target" "$target_web_image:$target"; do
  image="${pair%:*}"; revision="${pair##*:}"
  docker image inspect "$image" >/dev/null 2>&1 || finish TARGET_IMAGE_MISSING "$authority"
  actual="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image" 2>/dev/null || true)"
  test "$actual" = "$revision" || finish TARGET_IMAGE_REVISION_MISMATCH "$authority"
done

image_env_names(){
  docker image inspect --format '{{json .Config.Env}}' "$1" \
    | python3 -c "import json,sys; print('\\n'.join(sorted(str(x).partition('=')[0] for x in (json.load(sys.stdin) or []))))"
}
api_image_names="$(image_env_names "$target_api_image")"
web_image_names="$(image_env_names "$target_web_image")"
grep -Eq '^(PC_SMTP_|PC_MAIL_FROM$|RESEND_API_KEY$|RESEND_FROM_EMAIL$|AUTH_MAIL_)' <<< "$web_image_names" \
  && finish TARGET_WEB_IMAGE_FORBIDDEN_MAIL_AUTHORITY "$authority"
grep -Eq '^(PC_SMTP_|PC_MAIL_FROM$|RESEND_API_KEY$|RESEND_FROM_EMAIL$|AUTH_MAIL_DATABASE_URL_FILE$|AUTH_MAIL_TRANSPORT_FILE$)' <<< "$api_image_names" \
  && finish TARGET_API_IMAGE_FORBIDDEN_MAIL_AUTHORITY "$authority"
grep -Eq '^(PC_SMTP_PASS$|AUTH_MAIL_DATABASE_URL$)' <<< "$api_image_names" \
  && finish TARGET_WORKER_IMAGE_PLAINTEXT_SECRET "$authority"

cfg_label="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web" 2>/dev/null || true)"
test -n "$cfg_label" || finish COMPOSE_CONFIG_FILES_MISSING "$authority"
full_override="$work/compose.production-full-stack-image.override.yml"
IFS=',' read -r -a raw_files <<< "$cfg_label"
compose_args=(docker compose --project-directory "$work" --project-name "$project")
base_count=0
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"; file="${file%"${file##*[![:space:]]}"}"
  test -n "$file" || continue
  [[ "$file" = /* ]] || file="$work/$file"
  test -f "$file" && test ! -L "$file" || finish COMPOSE_CONFIG_FILE_INVALID "$authority"
  file="$(realpath -e -- "$file")"
  test "$file" = "$full_override" && continue
  compose_args+=( -f "$file" ); ((base_count+=1))
done
((base_count >= 1)) || finish COMPOSE_BASE_AUTHORITY_EMPTY "$authority"

override="$({ python3 - \
  "$target_api_image" "$target_web_image" "$work" <<'PY'
import json,sys
api_image,web_image,work=sys.argv[1:]
runtime='/var/lib/pc-secret-authority/runtime'
print(json.dumps({'services':{
 'api':{
   'image':api_image,'pull_policy':'never',
   'env_file':[f'{work}/.pc-auth-opaque-token.env',f'{work}/.pc-staff-database.env',f'{work}/.pc-password-reset-delivery.env',f'{work}/.pc-gekta-api-runtime.env'],
   'environment':{
     'AUTH_MAIL_OUTBOX_KEYRING_DIR':'/run/pc-auth-mail/keyring',
     'AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE':'/run/pc-auth-mail/current-key-version',
     'PC_PUBLIC_SITE_URL':'https://xn----8sbjf4befbjgs9b.xn--p1ai'},
   'volumes':[f'{runtime}/keyring:/run/pc-auth-mail/keyring:ro',f'{runtime}/current-key-version:/run/pc-auth-mail/current-key-version:ro']},
 'web':{
   'image':web_image,'pull_policy':'never',
   'env_file':[f'{work}/.pc-password-reset-delivery.env',f'{work}/.pc-gekta-web-runtime.env']},
 'auth-mail-worker':{
   'image':api_image,'pull_policy':'never','command':['dist/apps/api/src/auth-mail-worker.js'],
   'environment':{
     'NODE_ENV':'production','RUNTIME_COMPONENT':'auth-mail-worker','AUTH_MAIL_WORKER_ENABLED':'true','AUTH_MAIL_WORKER_HEALTH_PORT':'3003',
     'AUTH_MAIL_OUTBOX_KEYRING_DIR':'/run/pc-auth-mail/keyring','AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE':'/run/pc-auth-mail/current-key-version',
     'AUTH_MAIL_DATABASE_URL_FILE':'/run/pc-auth-mail/database-url','AUTH_MAIL_TRANSPORT_FILE':'/run/pc-auth-mail/transport.env'},
   'volumes':[f'{runtime}/keyring:/run/pc-auth-mail/keyring:ro',f'{runtime}/current-key-version:/run/pc-auth-mail/current-key-version:ro',f'{runtime}/database-url:/run/pc-auth-mail/database-url:ro',f'{runtime}/transport.env:/run/pc-auth-mail/transport.env:ro']}
}}))
PY
} )"

modelclass="$(printf '%s\n' "$override" \
  | "${compose_args[@]}" -f - config --format json 2>/dev/null \
  | python3 -c '
import json,sys
try: d=json.load(sys.stdin)
except Exception: print("TARGET_MODEL_PARSE_FAILED"); raise SystemExit
s=d.get("services") or {}
if not {"api","web","auth-mail-worker"}.issubset(s): print("TARGET_MODEL_SERVICE_MISSING"); raise SystemExit
def env(name):
    raw=(s.get(name) or {}).get("environment") or {}
    if isinstance(raw,list): return {str(x).partition("=")[0]:str(x).partition("=")[2] for x in raw}
    return {str(k):"" if v is None else str(v) for k,v in raw.items()}
web,api,worker=env("web"),env("api"),env("auth-mail-worker")
if any(k.startswith("PC_SMTP_") or k in {"PC_MAIL_FROM","RESEND_API_KEY","RESEND_FROM_EMAIL"} or k.startswith("AUTH_MAIL_") for k in web): print("TARGET_MODEL_WEB_FORBIDDEN_MAIL_AUTHORITY"); raise SystemExit
if any(k.startswith("PC_SMTP_") or k in {"PC_MAIL_FROM","RESEND_API_KEY","RESEND_FROM_EMAIL","AUTH_MAIL_DATABASE_URL_FILE","AUTH_MAIL_TRANSPORT_FILE"} for k in api): print("TARGET_MODEL_API_FORBIDDEN_MAIL_AUTHORITY"); raise SystemExit
if {"PC_SMTP_PASS","AUTH_MAIL_DATABASE_URL"} & set(worker): print("TARGET_MODEL_WORKER_PLAINTEXT_SECRET"); raise SystemExit
if api.get("AUTH_MAIL_OUTBOX_KEYRING_DIR")!="/run/pc-auth-mail/keyring" or api.get("AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE")!="/run/pc-auth-mail/current-key-version": print("TARGET_MODEL_API_FILE_BOUNDARY_MISSING"); raise SystemExit
expected={"AUTH_MAIL_DATABASE_URL_FILE":"/run/pc-auth-mail/database-url","AUTH_MAIL_TRANSPORT_FILE":"/run/pc-auth-mail/transport.env","AUTH_MAIL_OUTBOX_KEYRING_DIR":"/run/pc-auth-mail/keyring","AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE":"/run/pc-auth-mail/current-key-version"}
if any(worker.get(k)!=v for k,v in expected.items()): print("TARGET_MODEL_WORKER_FILE_BOUNDARY_MISSING"); raise SystemExit
print("TARGET_MODEL_PASS")
' 2>/dev/null)" || finish TARGET_MODEL_RENDER_FAILED "$authority"
test "$modelclass" = TARGET_MODEL_PASS || finish "$modelclass" "$authority"

mapfile -t apis < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
mapfile -t workers < <(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker')
test "${#apis[@]}" -eq 1 || finish TARGET_STATIC_BOUNDARY_PASS_API_CARDINALITY_INVALID "$authority"
if test "${#workers[@]}" -eq 0; then finish TARGET_STATIC_BOUNDARY_PASS_CURRENT_WORKER_ABSENT "$authority"; fi
test "${#workers[@]}" -eq 1 || finish TARGET_STATIC_BOUNDARY_PASS_WORKER_CARDINALITY_INVALID "$authority"
api="${apis[0]}"; worker="${workers[0]}"
arev="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api" 2>/dev/null || true)"
wrev="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web" 2>/dev/null || true)"
mrev="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker" 2>/dev/null || true)"
if test "$arev" != "$target" && test "$wrev" != "$target"; then finish TARGET_STATIC_BOUNDARY_PASS_API_WEB_REVISION_DRIFT "$authority"; fi
if test "$arev" != "$target"; then finish TARGET_STATIC_BOUNDARY_PASS_API_REVISION_DRIFT "$authority"; fi
if test "$wrev" != "$target"; then finish TARGET_STATIC_BOUNDARY_PASS_WEB_REVISION_DRIFT "$authority"; fi
if test "$mrev" != "$target"; then finish TARGET_STATIC_BOUNDARY_PASS_WORKER_REVISION_DRIFT "$authority"; fi

container_env_names(){
  docker inspect --format '{{json .Config.Env}}' "$1" \
    | python3 -c "import json,sys; print('\\n'.join(sorted(str(x).partition('=')[0] for x in (json.load(sys.stdin) or []))))"
}
web_names="$(container_env_names "$web")"; api_names="$(container_env_names "$api")"; worker_names="$(container_env_names "$worker")"
grep -Eq '^(PC_SMTP_|PC_MAIL_FROM$|RESEND_API_KEY$|RESEND_FROM_EMAIL$|AUTH_MAIL_)' <<< "$web_names" \
  && finish CURRENT_TARGET_WEB_FORBIDDEN_MAIL_AUTHORITY "$authority"
grep -Eq '^(PC_SMTP_|PC_MAIL_FROM$|RESEND_API_KEY$|RESEND_FROM_EMAIL$|AUTH_MAIL_DATABASE_URL_FILE$|AUTH_MAIL_TRANSPORT_FILE$)' <<< "$api_names" \
  && finish CURRENT_TARGET_API_FORBIDDEN_MAIL_AUTHORITY "$authority"
grep -Eq '^(PC_SMTP_PASS$|AUTH_MAIL_DATABASE_URL$)' <<< "$worker_names" \
  && finish CURRENT_TARGET_WORKER_PLAINTEXT_SECRET "$authority"
finish CURRENT_TARGET_RUNTIME_BOUNDARY_PASS "$authority"
REMOTE

grep -E '^(RUNTIME_BOUNDARY_CLASS|AUTHORITY_FILE_CLASS|PRODUCTION_MUTATION)=' "$out"
test "$(grep '^PRODUCTION_MUTATION=' "$out")" = 'PRODUCTION_MUTATION=NONE'
