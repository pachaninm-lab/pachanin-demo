#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
GENERIC_PEPPER_DERIVATION_LABEL='pc-auth-generic-hash-pepper:v1'

fail() { printf 'ERROR_CODE=%s\n' "$1" >&2; exit "${2:-1}"; }
decode() {
  # An unset optional input is valid: the caller then derives the authoritative
  # Compose directory from the single running web service.  Return success so
  # `set -e` does not skip that fail-closed discovery path.
  [[ -z "${1:-}" ]] && return 0
  printf '%s' "$1" | base64 -d
}

[[ "$ACTION" == provision ]] || fail INVALID_ACTION 2
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 3
active_web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$active_web_id")"
discovered_prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$active_web_id")"
[[ -n "$project" ]] || fail COMPOSE_PROJECT_AUTHORITY_MISSING 3

prod_dir="$(decode "$PROD_DIR_B64")"
[[ -z "$prod_dir" ]] && prod_dir="$discovered_prod_dir"
[[ "$prod_dir" == "$discovered_prod_dir" ]] || fail PRODUCTION_DIRECTORY_AUTHORITY_MISMATCH 3
[[ -n "$prod_dir" && "$prod_dir" == /* && "$prod_dir" != / && -d "$prod_dir" && ! -L "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 3

mapfile -t api_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail COMPOSE_API_AUTHORITY_AMBIGUOUS 3
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$active_web_id")"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ && "$web_revision" == "$api_revision" ]] || fail ACTIVE_REVISION_PARITY_INVALID 3

key_file="$prod_dir/.pc-auth-opaque-token.env"
[[ "$key_file" == "$prod_dir"/* ]] || fail KEY_FILE_OUTSIDE_PRODUCTION_DIRECTORY 4
[[ ! -L "$key_file" ]] || fail KEY_FILE_SYMLINK_FORBIDDEN 5
[[ -e "$key_file" ]] || fail EXISTING_OPAQUE_KEY_FILE_MISSING 6

valid_file() {
  local candidate="$1" expected_shape="$2"
  [[ -f "$candidate" && ! -L "$candidate" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$candidate")" == '600:0:0' ]] || return 1
  python3 - "$candidate" "$expected_shape" "$GENERIC_PEPPER_DERIVATION_LABEL" <<'PY'
import hashlib
import hmac
import re
import sys

candidate, expected_shape, label = sys.argv[1:]
raw = open(candidate, 'rb').read()
if not raw.endswith(b'\n') or b'\r' in raw or b'\0' in raw:
    raise SystemExit(1)
try:
    lines = raw[:-1].decode('ascii').split('\n')
except UnicodeDecodeError:
    raise SystemExit(1)
if expected_shape == 'legacy':
    if len(lines) != 1:
        raise SystemExit(1)
elif expected_shape == 'current':
    if len(lines) != 2:
        raise SystemExit(1)
else:
    raise SystemExit(1)
opaque_match = re.fullmatch(r'AUTH_OPAQUE_TOKEN_DIGEST_KEY=([A-Fa-f0-9]{64,})', lines[0])
if not opaque_match:
    raise SystemExit(1)
if expected_shape == 'current':
    pepper_match = re.fullmatch(r'AUTH_TOKEN_PEPPER=([a-f0-9]{64})', lines[1])
    if not pepper_match:
        raise SystemExit(1)
    expected = hmac.new(
        opaque_match.group(1).encode('ascii'),
        label.encode('ascii'),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(pepper_match.group(1), expected):
        raise SystemExit(1)
PY
}

active_authority_relationship() {
  local candidate="$1" expected_shape="$2" container_id="$3"
  python3 - "$candidate" "$expected_shape" "$container_id" "$GENERIC_PEPPER_DERIVATION_LABEL" <<'PY'
import hmac
import json
import re
import subprocess
import sys

candidate, expected_shape, container_id, label = sys.argv[1:]
completed = subprocess.run(
    ['docker', 'inspect', container_id],
    check=False,
    stdout=subprocess.PIPE,
    stderr=subprocess.DEVNULL,
    text=True,
    encoding='utf-8',
)
if completed.returncode != 0:
    raise SystemExit(1)
try:
    documents = json.loads(completed.stdout)
except (json.JSONDecodeError, UnicodeError):
    raise SystemExit(1)
if not isinstance(documents, list) or len(documents) != 1:
    raise SystemExit(1)

assignments = {}
duplicates = set()
for raw_assignment in documents[0].get('Config', {}).get('Env', []) or []:
    name, separator, value = str(raw_assignment).partition('=')
    if not separator:
        continue
    if name in assignments:
        duplicates.add(name)
    assignments[name] = value
if {'AUTH_OPAQUE_TOKEN_DIGEST_KEY', 'AUTH_TOKEN_PEPPER'} & duplicates:
    raise SystemExit(1)

raw = open(candidate, 'rb').read()
try:
    lines = raw[:-1].decode('ascii').split('\n')
except UnicodeDecodeError:
    raise SystemExit(1)
opaque_match = re.fullmatch(r'AUTH_OPAQUE_TOKEN_DIGEST_KEY=([A-Fa-f0-9]{64,})', lines[0])
if not opaque_match:
    raise SystemExit(1)
file_opaque = opaque_match.group(1)
active_opaque = assignments.get('AUTH_OPAQUE_TOKEN_DIGEST_KEY')
if not active_opaque or not hmac.compare_digest(active_opaque, file_opaque):
    raise SystemExit(1)

active_pepper = assignments.get('AUTH_TOKEN_PEPPER')
if expected_shape == 'legacy':
    if active_pepper is not None:
        raise SystemExit(1)
    raise SystemExit(10)
if expected_shape != 'current' or len(lines) != 2:
    raise SystemExit(1)
pepper_match = re.fullmatch(r'AUTH_TOKEN_PEPPER=([a-f0-9]{64})', lines[1])
if not pepper_match:
    raise SystemExit(1)
if active_pepper is None:
    raise SystemExit(11)
if not hmac.compare_digest(active_pepper, pepper_match.group(1)):
    raise SystemExit(1)
expected = hmac.new(file_opaque.encode('ascii'), label.encode('ascii'), 'sha256').hexdigest()
if not hmac.compare_digest(active_pepper, expected):
    raise SystemExit(1)
raise SystemExit(12)
PY
}

read_only_impact_preflight() {
  local container_id="$1" impact_marker
  if impact_marker="$(docker exec -i "$container_id" /nodejs/bin/node --input-type=commonjs - 2>/dev/null <<'NODE'
const { PrismaClient } = require('@prisma/client');

const safeSecret = /^[A-Za-z0-9._~+/=-]{32,512}$/;
let database;

(async () => {
  const authUrl = String(process.env.AUTH_DATABASE_URL || '').trim();
  const dealUrl = String(process.env.DATABASE_URL || '').trim();
  const opaque = String(process.env.AUTH_OPAQUE_TOKEN_DIGEST_KEY || '');
  const generic = process.env.AUTH_TOKEN_PEPPER;
  if (!authUrl || !dealUrl || authUrl === dealUrl) throw new Error('DATASOURCE');
  if (!safeSecret.test(opaque) || generic !== undefined) throw new Error('RUNTIME');

  const readOnlyUrl = new URL(authUrl);
  const existingOptions = readOnlyUrl.searchParams.get('options');
  readOnlyUrl.searchParams.set(
    'options',
    `${existingOptions ? `${existingOptions} ` : ''}-c default_transaction_read_only=on`,
  );
  database = new PrismaClient({ datasources: { db: { url: readOnlyUrl.toString() } } });

  const aggregate = await database.$transaction(async (tx) => {
    const principalRows = await tx.$queryRawUnsafe(`
      SELECT current_setting('transaction_read_only') = 'on' AS read_only,
             NOT rolsuper AS no_super,
             NOT rolbypassrls AS no_bypass,
             NOT rolinherit AS no_inherit,
             has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_usage,
             has_table_privilege(current_user, 'auth.login_throttles', 'SELECT') AS login_select,
             has_table_privilege(current_user, 'auth.registration_applications', 'SELECT') AS registration_select,
             has_table_privilege(current_user, 'auth.registration_public_attempts', 'SELECT') AS attempt_select,
             has_table_privilege(current_user, 'auth.organization_invitations', 'SELECT') AS invitation_select,
             has_table_privilege(current_user, 'auth.organization_membership_command_events', 'SELECT') AS membership_event_select,
             has_table_privilege(current_user, 'auth.mfa_recovery_challenges', 'SELECT') AS mfa_recovery_select
      FROM pg_roles WHERE rolname = current_user
    `);
    const principal = principalRows[0];
    if (!principal || !Object.values(principal).every((value) => value === true)) {
      throw new Error('PRINCIPAL');
    }

    const rows = await tx.$queryRawUnsafe(`
      SELECT
        EXISTS (SELECT 1 FROM auth.login_throttles) AS login_rows,
        EXISTS (SELECT 1 FROM auth.registration_applications) AS registration_rows,
        EXISTS (SELECT 1 FROM auth.registration_public_attempts) AS registration_attempt_rows,
        EXISTS (SELECT 1 FROM auth.organization_invitations) AS invitation_rows,
        EXISTS (SELECT 1 FROM auth.organization_membership_command_events) AS membership_event_rows,
        EXISTS (SELECT 1 FROM auth.mfa_recovery_challenges) AS mfa_recovery_rows
    `);
    if (rows.length !== 1 || Object.values(rows[0]).some((value) => typeof value !== 'boolean')) {
      throw new Error('AGGREGATE');
    }
    return rows[0];
  }, { isolationLevel: 'Serializable' });

  if (Object.values(aggregate).some(Boolean)) throw new Error('PERSISTED_STATE');
  process.stdout.write('AUTH_HASH_IMPACT_PREFLIGHT=SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE\n');
})()
  .catch(() => { process.exitCode = 1; })
  .finally(async () => {
    if (database) await database.$disconnect().catch(() => undefined);
  });
NODE
)"; then
    :
  else
    fail AUTH_HASH_IMPACT_PREFLIGHT_FAILED 9
  fi
  [[ "$impact_marker" == 'AUTH_HASH_IMPACT_PREFLIGHT=SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE' ]] \
    || fail AUTH_HASH_IMPACT_PREFLIGHT_INVALID 9
  printf '%s\n' "$impact_marker"
}

write_current_file() {
  local source="$1" destination="$2"
  python3 - "$source" "$destination" "$GENERIC_PEPPER_DERIVATION_LABEL" <<'PY'
import hashlib
import hmac
import os
import re
import sys

source, destination, label = sys.argv[1:]
raw = open(source, 'rb').read()
if not raw.endswith(b'\n') or b'\r' in raw or b'\0' in raw:
    raise SystemExit(1)
try:
    lines = raw[:-1].decode('ascii').split('\n')
except UnicodeDecodeError:
    raise SystemExit(1)
if len(lines) != 1:
    raise SystemExit(1)
opaque_match = re.fullmatch(r'AUTH_OPAQUE_TOKEN_DIGEST_KEY=([A-Fa-f0-9]{64,})', lines[0])
if not opaque_match:
    raise SystemExit(1)
opaque = opaque_match.group(1)
pepper = hmac.new(opaque.encode('ascii'), label.encode('ascii'), hashlib.sha256).hexdigest()
payload = f'AUTH_OPAQUE_TOKEN_DIGEST_KEY={opaque}\nAUTH_TOKEN_PEPPER={pepper}\n'.encode('ascii')
descriptor = os.open(destination, os.O_WRONLY | os.O_TRUNC | os.O_NOFOLLOW)
try:
    if os.write(descriptor, payload) != len(payload):
        raise SystemExit(1)
    os.fsync(descriptor)
finally:
    os.close(descriptor)
PY
}

temporary_file=''
cleanup() { [[ -z "$temporary_file" ]] || rm -f -- "$temporary_file"; }
trap cleanup EXIT

expected_shape=''
if valid_file "$key_file" current; then
  expected_shape='current'
elif valid_file "$key_file" legacy; then
  expected_shape='legacy'
else
  fail EXISTING_KEY_FILE_INVALID 6
fi

authority_rc=0
active_authority_relationship "$key_file" "$expected_shape" "$api_id" || authority_rc=$?
printf 'ACTIVE_PRODUCTION_REVISION=%s\n' "$api_revision"
case "$authority_rc" in
  10)
    [[ "$expected_shape" == 'legacy' ]] || fail ACTIVE_AUTHORITY_RELATIONSHIP_INVALID 9
    read_only_impact_preflight "$api_id"
    ;;
  11)
    [[ "$expected_shape" == 'current' ]] || fail ACTIVE_AUTHORITY_RELATIONSHIP_INVALID 9
    read_only_impact_preflight "$api_id"
    ;;
  12)
    [[ "$expected_shape" == 'current' ]] || fail ACTIVE_AUTHORITY_RELATIONSHIP_INVALID 9
    printf 'AUTH_HASH_IMPACT_PREFLIGHT=NO_MUTATION_CURRENT_AUTHORITY\n'
    ;;
  *)
    fail ACTIVE_AUTHORITY_RELATIONSHIP_INVALID 9
    ;;
esac

provision_state=''
if [[ "$expected_shape" == 'current' ]]; then
  provision_state='EXISTING'
else
  umask 077
  temporary_file="$(mktemp "$prod_dir/.pc-auth-opaque-token.env.XXXXXX")"
  write_current_file "$key_file" "$temporary_file" || fail KEY_DERIVATION_FAILED 7
  chown 0:0 "$temporary_file"
  chmod 0600 "$temporary_file"
  valid_file "$temporary_file" current || fail KEY_FILE_VERIFICATION_FAILED 8
  mv -f "$temporary_file" "$key_file"
  temporary_file=''
  provision_state='MIGRATED'
fi

valid_file "$key_file" current || fail KEY_FILE_VERIFICATION_FAILED 8
printf 'AUTH_OPAQUE_TOKEN_KEY_PROVISION=EXISTING\n'
printf 'AUTH_GENERIC_HASH_PEPPER_PROVISION=%s\n' "$provision_state"
printf 'AUTH_OPAQUE_TOKEN_KEY_VALID=1\n'
printf 'AUTH_GENERIC_HASH_PEPPER_VALID=1\n'
printf 'AUTH_KEY_MATERIAL_DISCLOSURE=NONE\n'
