#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
RECONCILE_ACTIVE_RUNTIME="${PC_RECONCILE_ACTIVE_RUNTIME:-0}"

fail() { printf 'ERROR_CODE=%s\n' "$1" >&2; exit "${2:-1}"; }
decode() {
  [[ -z "${1:-}" ]] && return 0
  printf '%s' "$1" | base64 -d
}

[[ "$ACTION" == provision ]] || fail INVALID_ACTION 2
[[ "$RECONCILE_ACTIVE_RUNTIME" =~ ^[01]$ ]] || fail INVALID_RECONCILE_MODE 3

prod_dir="$(decode "$PROD_DIR_B64")"
active_dir=""
if [[ -z "$prod_dir" || "$RECONCILE_ACTIVE_RUNTIME" == 1 ]]; then
  mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  (( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 4
  active_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "${web_ids[0]}")"
fi
[[ -n "$prod_dir" ]] || prod_dir="$active_dir"
[[ -n "$prod_dir" && "$prod_dir" == /* && "$prod_dir" != / && -d "$prod_dir" && ! -L "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 5
prod_dir="$(realpath -e -- "$prod_dir")" || fail PRODUCTION_DIRECTORY_INVALID 5
if [[ -n "$active_dir" ]]; then
  [[ "$active_dir" == /* && "$active_dir" != / && -d "$active_dir" && ! -L "$active_dir" ]] || fail ACTIVE_PRODUCTION_DIRECTORY_INVALID 6
  active_dir="$(realpath -e -- "$active_dir")" || fail ACTIVE_PRODUCTION_DIRECTORY_INVALID 6
fi

api_file="$prod_dir/.pc-gekta-api-runtime.env"
web_file="$prod_dir/.pc-gekta-web-runtime.env"
[[ "$api_file" == "$prod_dir"/* && "$web_file" == "$prod_dir"/* ]] || fail RUNTIME_FILE_OUTSIDE_PRODUCTION_DIRECTORY 7
[[ ! -L "$api_file" && ! -L "$web_file" ]] || fail RUNTIME_FILE_SYMLINK_FORBIDDEN 8

valid_api_path() {
  local candidate="$1"
  [[ -f "$candidate" && ! -L "$candidate" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$candidate")" == '600:0:0' ]] || return 1
  python3 - "$candidate" <<'PY'
import re
import sys

raw = open(sys.argv[1], encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    raise SystemExit(1)
lines = raw.rstrip('\n').split('\n')
if len(lines) != 2:
    raise SystemExit(1)
values = {}
for line in lines:
    name, separator, value = line.partition('=')
    if not separator or name in values:
        raise SystemExit(1)
    values[name] = value
if set(values) != {'GEKTA_PHONE_ENCRYPTION_KEY', 'GEKTA_PHONE_LOOKUP_PEPPER'}:
    raise SystemExit(1)
if not re.fullmatch(r'[A-Fa-f0-9]{64}', values['GEKTA_PHONE_ENCRYPTION_KEY']):
    raise SystemExit(1)
if not re.fullmatch(r'[A-Fa-f0-9]{96}', values['GEKTA_PHONE_LOOKUP_PEPPER']):
    raise SystemExit(1)
PY
}

valid_web_path() {
  local candidate="$1"
  [[ -f "$candidate" && ! -L "$candidate" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$candidate")" == '600:0:0' ]] || return 1
  python3 - "$candidate" <<'PY'
import re
import sys

raw = open(sys.argv[1], encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    raise SystemExit(1)
lines = raw.rstrip('\n').split('\n')
if len(lines) != 2:
    raise SystemExit(1)
values = {}
for line in lines:
    name, separator, value = line.partition('=')
    if not separator or name in values or not re.fullmatch(r'[A-Fa-f0-9]{96}', value):
        raise SystemExit(1)
    values[name] = value
if set(values) != {'MFA_LOGIN_TICKET_SECRET', 'GEKTA_ANONYMOUS_SESSION_SECRET'}:
    raise SystemExit(1)
if values['MFA_LOGIN_TICKET_SECRET'] == values['GEKTA_ANONYMOUS_SESSION_SECRET']:
    raise SystemExit(1)
PY
}

valid_purpose_separation() {
  python3 - "$1" "$2" <<'PY'
import sys

def values(path):
    return dict(line.split('=', 1) for line in open(path, encoding='utf-8').read().rstrip('\n').split('\n'))

api = values(sys.argv[1])
web = values(sys.argv[2])
purpose_secrets = {
    api['GEKTA_PHONE_LOOKUP_PEPPER'],
    web['MFA_LOGIN_TICKET_SECRET'],
    web['GEKTA_ANONYMOUS_SESSION_SECRET'],
}
if len(purpose_secrets) != 3:
    raise SystemExit(1)
PY
}

runtime_pair_state() {
  local first="$1" second="$2"
  if [[ -e "$first" || -e "$second" ]]; then
    [[ -e "$first" && -e "$second" ]] || return 2
    return 0
  fi
  return 1
}

authority_reconciled=0
if [[ "$RECONCILE_ACTIVE_RUNTIME" == 1 && -n "$active_dir" && "$active_dir" != "$prod_dir" ]]; then
  active_api_file="$active_dir/.pc-gekta-api-runtime.env"
  active_web_file="$active_dir/.pc-gekta-web-runtime.env"
  [[ "$active_api_file" == "$active_dir"/* && "$active_web_file" == "$active_dir"/* ]] || fail ACTIVE_RUNTIME_FILE_OUTSIDE_PRODUCTION_DIRECTORY 9
  [[ ! -L "$active_api_file" && ! -L "$active_web_file" ]] || fail ACTIVE_RUNTIME_FILE_SYMLINK_FORBIDDEN 10
  active_state=0
  runtime_pair_state "$active_api_file" "$active_web_file" || active_state=$?
  case "$active_state" in
    0)
      valid_api_path "$active_api_file" || fail EXISTING_ACTIVE_API_RUNTIME_INVALID 11
      valid_web_path "$active_web_file" || fail EXISTING_ACTIVE_WEB_RUNTIME_INVALID 12
      valid_purpose_separation "$active_api_file" "$active_web_file" || fail EXISTING_ACTIVE_RUNTIME_PURPOSE_CONFLICT 28
      canonical_state=0
      runtime_pair_state "$api_file" "$web_file" || canonical_state=$?
      case "$canonical_state" in
        0)
          valid_api_path "$api_file" || fail EXISTING_API_RUNTIME_INVALID 13
          valid_web_path "$web_file" || fail EXISTING_WEB_RUNTIME_INVALID 14
          valid_purpose_separation "$api_file" "$web_file" || fail EXISTING_RUNTIME_PURPOSE_CONFLICT 29
          cmp -s -- "$active_api_file" "$api_file" && cmp -s -- "$active_web_file" "$web_file" \
            || fail RUNTIME_AUTHORITY_CONFLICT 15
          rm -f -- "$active_api_file" "$active_web_file" || fail RUNTIME_AUTHORITY_CLEANUP_FAILED 16
          ;;
        1)
          mv -- "$active_api_file" "$api_file" || fail RUNTIME_AUTHORITY_RECONCILE_FAILED 17
          if ! mv -- "$active_web_file" "$web_file"; then
            mv -- "$api_file" "$active_api_file" || fail RUNTIME_AUTHORITY_ROLLBACK_FAILED 18
            fail RUNTIME_AUTHORITY_RECONCILE_FAILED 17
          fi
          ;;
        *) fail CANONICAL_RUNTIME_PAIR_INCOMPLETE 19 ;;
      esac
      authority_reconciled=1
      ;;
    1) ;;
    *) fail ACTIVE_RUNTIME_PAIR_INCOMPLETE 20 ;;
  esac
fi

canonical_state=0
runtime_pair_state "$api_file" "$web_file" || canonical_state=$?
runtime_status=EXISTING
case "$canonical_state" in
  0)
    valid_api_path "$api_file" || fail EXISTING_API_RUNTIME_INVALID 13
    valid_web_path "$web_file" || fail EXISTING_WEB_RUNTIME_INVALID 14
    valid_purpose_separation "$api_file" "$web_file" || fail EXISTING_RUNTIME_PURPOSE_CONFLICT 29
    ;;
  1)
    phone_key="$(openssl rand -hex 32)"
    phone_pepper="$(openssl rand -hex 48)"
    mfa_secret="$(openssl rand -hex 48)"
    anonymous_secret="$(openssl rand -hex 48)"
    [[ "$phone_key" =~ ^[A-Fa-f0-9]{64}$ ]] || fail RUNTIME_SECRET_GENERATION_FAILED 21
    [[ "$phone_pepper" =~ ^[A-Fa-f0-9]{96}$ && "$mfa_secret" =~ ^[A-Fa-f0-9]{96}$ && "$anonymous_secret" =~ ^[A-Fa-f0-9]{96}$ ]] \
      || fail RUNTIME_SECRET_GENERATION_FAILED 21
    [[ "$phone_pepper" != "$mfa_secret" && "$phone_pepper" != "$anonymous_secret" && "$mfa_secret" != "$anonymous_secret" ]] \
      || fail RUNTIME_SECRET_GENERATION_FAILED 21
    umask 077
    api_temp="$(mktemp "$prod_dir/.pc-gekta-api-runtime.env.XXXXXX")"
    web_temp="$(mktemp "$prod_dir/.pc-gekta-web-runtime.env.XXXXXX")"
    trap 'rm -f "${api_temp:-}" "${web_temp:-}"' EXIT
    printf 'GEKTA_PHONE_ENCRYPTION_KEY=%s\nGEKTA_PHONE_LOOKUP_PEPPER=%s\n' "$phone_key" "$phone_pepper" > "$api_temp"
    printf 'MFA_LOGIN_TICKET_SECRET=%s\nGEKTA_ANONYMOUS_SESSION_SECRET=%s\n' "$mfa_secret" "$anonymous_secret" > "$web_temp"
    chown 0:0 "$api_temp" "$web_temp"
    chmod 0600 "$api_temp" "$web_temp"
    valid_api_path "$api_temp" || fail GENERATED_API_RUNTIME_INVALID 22
    valid_web_path "$web_temp" || fail GENERATED_WEB_RUNTIME_INVALID 23
    mv -- "$api_temp" "$api_file" || fail RUNTIME_INSTALL_FAILED 24
    if ! mv -- "$web_temp" "$web_file"; then
      rm -f -- "$api_file" || fail RUNTIME_INSTALL_ROLLBACK_FAILED 25
      fail RUNTIME_INSTALL_FAILED 24
    fi
    trap - EXIT
    runtime_status=CREATED
    ;;
  *) fail CANONICAL_RUNTIME_PAIR_INCOMPLETE 19 ;;
esac

valid_api_path "$api_file" || fail API_RUNTIME_VERIFICATION_FAILED 26
valid_web_path "$web_file" || fail WEB_RUNTIME_VERIFICATION_FAILED 27
valid_purpose_separation "$api_file" "$web_file" || fail RUNTIME_PURPOSE_SEPARATION_FAILED 30
printf 'GEKTA_API_RUNTIME_PROVISION=%s\n' "$runtime_status"
printf 'GEKTA_WEB_RUNTIME_PROVISION=%s\n' "$runtime_status"
printf 'GEKTA_RUNTIME_VALID=1\n'
printf 'GEKTA_RUNTIME_AUTHORITY_RECONCILED=%s\n' "$authority_reconciled"
