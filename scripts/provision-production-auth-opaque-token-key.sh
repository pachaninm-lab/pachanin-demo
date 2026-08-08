#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"

fail() { printf 'ERROR_CODE=%s\n' "$1" >&2; exit "${2:-1}"; }
decode() { [[ -n "$1" ]] && printf '%s' "$1" | base64 -d; }

[[ "$ACTION" == provision ]] || fail INVALID_ACTION 2
prod_dir="$(decode "$PROD_DIR_B64")"
if [[ -z "$prod_dir" ]]; then
  mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  (( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 3
  prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "${web_ids[0]}")"
fi
[[ -n "$prod_dir" && "$prod_dir" == /* && "$prod_dir" != / && -d "$prod_dir" && ! -L "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 3

key_file="$prod_dir/.pc-auth-opaque-token.env"
[[ "$key_file" == "$prod_dir"/* ]] || fail KEY_FILE_OUTSIDE_PRODUCTION_DIRECTORY 4
[[ ! -L "$key_file" ]] || fail KEY_FILE_SYMLINK_FORBIDDEN 5

valid_file() {
  [[ -f "$key_file" && ! -L "$key_file" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$key_file")" == '600:0:0' ]] || return 1
  [[ "$(wc -l < "$key_file" | tr -d '[:space:]')" == 1 ]] || return 1
  grep -Eq '^AUTH_OPAQUE_TOKEN_DIGEST_KEY=[A-Fa-f0-9]{64,}$' "$key_file"
}

if [[ -e "$key_file" ]]; then
  valid_file || fail EXISTING_KEY_FILE_INVALID 6
  printf 'AUTH_OPAQUE_TOKEN_KEY_PROVISION=EXISTING\n'
else
  key_material="$(openssl rand -hex 48)"
  [[ "$key_material" =~ ^[A-Fa-f0-9]{96}$ ]] || fail KEY_GENERATION_FAILED 7
  umask 077
  temporary_file="$(mktemp "$prod_dir/.pc-auth-opaque-token.env.XXXXXX")"
  trap 'rm -f "$temporary_file"' EXIT
  printf 'AUTH_OPAQUE_TOKEN_DIGEST_KEY=%s\n' "$key_material" > "$temporary_file"
  chown 0:0 "$temporary_file"
  chmod 0600 "$temporary_file"
  mv -f "$temporary_file" "$key_file"
  trap - EXIT
  printf 'AUTH_OPAQUE_TOKEN_KEY_PROVISION=CREATED\n'
fi

valid_file || fail KEY_FILE_VERIFICATION_FAILED 8
printf 'AUTH_OPAQUE_TOKEN_KEY_VALID=1\n'
