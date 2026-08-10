#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"
TARGET_SHA="${2:-}"
RUN_ID="${3:-manual}"
INTAKE_REQUEST_NUMBER="${4:-}"
INTAKE_CORRELATION_ID="${5:-}"
API_IMAGE="${PC_API_IMAGE:-}"
WEB_IMAGE="${PC_WEB_IMAGE:-}"
MIGRATION_IMAGE="${PC_MIGRATION_IMAGE:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
PROD_COMPOSE_B64="${PC_PROD_COMPOSE_B64:-}"
PROD_PROJECT_B64="${PC_PROD_PROJECT_B64:-}"
BACKUP_EVIDENCE_B64="${PC_PROD_BACKUP_EVIDENCE_FILE_B64:-${PC_BACKUP_EVIDENCE_FILE_B64:-}}"
STATE_ROOT="/var/lib/pc-release-authority"
STATE_FILE="$STATE_ROOT/full-stack-${RUN_ID}.state"

fail() { printf 'ERROR_CODE=%s\n' "$1" >&2; exit "${2:-1}"; }
decode() { [[ -z "$1" ]] || printf '%s' "$1" | base64 -d; }
trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }

[[ "$ACTION" =~ ^(audit|deploy|rollback|verify-intake)$ ]] || fail INVALID_ACTION 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
[[ "$RUN_ID" =~ ^[A-Za-z0-9._:-]{1,128}$ ]] || fail INVALID_RUN_ID 4

prod_dir="$(decode "$PROD_DIR_B64")"
prod_compose="$(decode "$PROD_COMPOSE_B64")"
prod_project="$(decode "$PROD_PROJECT_B64")"
backup_evidence="$(decode "$BACKUP_EVIDENCE_B64")"
auth_opaque_token_env_file=""
staff_database_env_file=""

resolve_compose_authority() {
  if [[ -n "$prod_dir" && -n "$prod_compose" ]]; then return; fi
  mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  (( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 10
  local web_id="${web_ids[0]}"
  prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
  prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
  prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
  [[ -n "$prod_dir" && -n "$prod_compose" && -n "$prod_project" ]] || fail COMPOSE_LABEL_AUTHORITY_MISSING 11
}

resolve_compose_authority
[[ -d "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 12

resolve_auth_opaque_token_env_file() {
  auth_opaque_token_env_file="${PC_AUTH_OPAQUE_TOKEN_ENV_FILE:-$prod_dir/.pc-auth-opaque-token.env}"
  [[ "$auth_opaque_token_env_file" == "$prod_dir"/* ]] || fail AUTH_OPAQUE_TOKEN_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 17
  [[ -f "$auth_opaque_token_env_file" && ! -L "$auth_opaque_token_env_file" ]] || fail AUTH_OPAQUE_TOKEN_ENV_FILE_MISSING 18
  [[ "$(stat -c '%a:%u:%g' "$auth_opaque_token_env_file")" == '600:0:0' ]] || fail AUTH_OPAQUE_TOKEN_ENV_FILE_PERMISSIONS_INVALID 19
  [[ "$(wc -l < "$auth_opaque_token_env_file" | tr -d '[:space:]')" == 1 ]] || fail AUTH_OPAQUE_TOKEN_ENV_FILE_CONTENT_INVALID 21
  grep -Eq '^AUTH_OPAQUE_TOKEN_DIGEST_KEY=[A-Fa-f0-9]{64,}$' "$auth_opaque_token_env_file" || fail AUTH_OPAQUE_TOKEN_ENV_FILE_CONTENT_INVALID 22
}

resolve_auth_opaque_token_env_file

resolve_staff_database_env_file() {
  staff_database_env_file="${PC_STAFF_DATABASE_ENV_FILE:-$prod_dir/.pc-staff-database.env}"
  [[ "$staff_database_env_file" == "$prod_dir"/* ]] || fail STAFF_DATABASE_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 52
  [[ -f "$staff_database_env_file" && ! -L "$staff_database_env_file" ]] || fail STAFF_DATABASE_ENV_FILE_MISSING 53
  [[ "$(stat -c '%a:%u:%g' "$staff_database_env_file")" == '600:0:0' ]] || fail STAFF_DATABASE_ENV_FILE_PERMISSIONS_INVALID 54
  [[ "$(wc -l < "$staff_database_env_file" | tr -d '[:space:]')" == 1 ]] || fail STAFF_DATABASE_ENV_FILE_CONTENT_INVALID 55
  python3 - "$staff_database_env_file" <<'PY' || fail STAFF_DATABASE_ENV_FILE_CONTENT_INVALID 56
import sys
from urllib.parse import urlsplit

line = open(sys.argv[1], encoding='utf-8').read().rstrip('\n')
if not line.startswith('STAFF_DATABASE_URL='):
    raise SystemExit(1)
url = urlsplit(line.split('=', 1)[1])
if url.scheme not in ('postgresql', 'postgres') or url.username != 'pc_staff_runtime' or not url.password or not url.hostname or not url.path.strip('/'):
    raise SystemExit(1)
PY
}

resolve_staff_database_env_file

IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
full_override="$prod_dir/compose.production-full-stack-image.override.yml"
for raw in "${raw_files[@]}"; do
  file="$(trim "$raw")"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" ]] || fail PROTECTED_COMPOSE_FILE_MISSING 13
  [[ "$file" == "$full_override" ]] || compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || fail COMPOSE_AUTHORITY_EMPTY 14

dc=(docker compose --project-directory "$prod_dir")
[[ -z "$prod_project" ]] || dc+=(--project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done

compose_json="$(mktemp)"
"${dc[@]}" config --format json > "$compose_json"
service_inventory="$(python3 - "$compose_json" <<'PY'
import json, re, sys
cfg = json.load(open(sys.argv[1], encoding='utf-8'))
services = cfg.get('services') or {}
for required in ('api', 'web'):
    if required not in services:
        raise SystemExit(f'MISSING:{required}')
candidates = []
postgres = []
for name, service in services.items():
    image = str(service.get('image') or '')
    command = service.get('command')
    command = ' '.join(command) if isinstance(command, list) else str(command or '')
    if re.search(r'(^|[-_])(migrate|migration)([-_]|$)', name, re.I) or 'grainflow-migration' in image or ('prisma' in command and 'migrate' in command):
        candidates.append(name)
    if image.startswith('postgres:') or '/postgres:' in image:
        postgres.append(name)
if len(candidates) != 1:
    raise SystemExit(f'MIGRATION_COUNT:{len(candidates)}')
print(candidates[0])
print(postgres[0] if len(postgres) == 1 else '')
PY
)" || fail COMPOSE_SERVICE_DISCOVERY_FAILED 15
migration_service="$(printf '%s\n' "$service_inventory" | sed -n '1p')"
postgres_service="$(printf '%s\n' "$service_inventory" | sed -n '2p')"
rm -f "$compose_json"

compose_id() { "${dc[@]}" ps -q "$1" | head -1; }
api_id="$(compose_id api)"
web_id="$(compose_id web)"
[[ -n "$api_id" && -n "$web_id" ]] || fail TARGET_RUNTIME_MISSING 16
baseline_api_image="$(docker inspect --format '{{.Config.Image}}' "$api_id")"
baseline_web_image="$(docker inspect --format '{{.Config.Image}}' "$web_id")"
baseline_api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
baseline_web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"

snapshot_unrelated() {
  local output="$1"
  docker ps --format '{{.ID}} {{.Labels}}' | awk '
    $0 !~ /com.docker.compose.service=api(,|$)/ &&
    $0 !~ /com.docker.compose.service=web(,|$)/ &&
    $0 !~ /com.docker.compose.service=watchtower(,|$)/ {print $1}' | sort > "$output"
}

write_override() {
  local api_image="$1" web_image="$2" migration_image="$3" destination="$4"
  umask 077
  cat > "$destination.tmp" <<YAML
services:
  api:
    image: ${api_image}
    pull_policy: never
    env_file:
      - ${auth_opaque_token_env_file}
      - ${staff_database_env_file}
  web:
    image: ${web_image}
    pull_policy: never
  ${migration_service}:
    image: ${migration_image}
    pull_policy: never
YAML
  mv "$destination.tmp" "$destination"
  chmod 0600 "$destination"
}

dc_target=("${dc[@]}" -f "$full_override")

verify_image() {
  local image="$1"
  docker pull "$image" >/dev/null
  [[ "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")" == "$TARGET_SHA" ]] || fail IMAGE_REVISION_MISMATCH 20
}

wait_api() {
  local id attempt
  for attempt in $(seq 1 30); do
    id="$("${dc_target[@]}" ps -q api | head -1)"
    if [[ -n "$id" ]] && docker exec "$id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then return 0; fi
    sleep 4
  done
  return 1
}

redact_api_startup_log() {
  sed -E \
    -e 's#([A-Za-z][A-Za-z0-9+.-]*://)[^[:space:]@/]+@#\1[REDACTED]@#g' \
    -e 's#(password|token|secret|authorization|api[_-]?key)([[:space:]]*[:=][[:space:]]*)[^[:space:],;}]+#\1\2[REDACTED]#gI'
}

emit_api_startup_diagnostics() {
  local id state restart_count exit_code oom_killed
  id="$("${dc_target[@]}" ps -q api | head -1)"
  printf 'API_STARTUP_DIAGNOSTICS_BEGIN\n' >&2
  if [[ -z "$id" ]]; then
    printf 'API_STARTUP_CONTAINER=missing\n' >&2
    printf 'API_STARTUP_DIAGNOSTICS_END\n' >&2
    return 0
  fi

  state="$(docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || true)"
  restart_count="$(docker inspect --format '{{.RestartCount}}' "$id" 2>/dev/null || true)"
  exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$id" 2>/dev/null || true)"
  oom_killed="$(docker inspect --format '{{.State.OOMKilled}}' "$id" 2>/dev/null || true)"
  printf 'API_STARTUP_CONTAINER_STATE=%s\n' "${state:-unknown}" >&2
  printf 'API_STARTUP_RESTART_COUNT=%s\n' "${restart_count:-unknown}" >&2
  printf 'API_STARTUP_EXIT_CODE=%s\n' "${exit_code:-unknown}" >&2
  printf 'API_STARTUP_OOM_KILLED=%s\n' "${oom_killed:-unknown}" >&2
  printf 'API_STARTUP_LOG_TAIL_BEGIN\n' >&2
  docker logs --tail 80 "$id" 2>&1 | redact_api_startup_log >&2 || true
  printf 'API_STARTUP_LOG_TAIL_END\n' >&2
  printf 'API_STARTUP_DIAGNOSTICS_END\n' >&2
}

wait_web() {
  local id state attempt
  for attempt in $(seq 1 30); do
    id="$("${dc_target[@]}" ps -q web | head -1)"
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
    [[ "$state" == healthy ]] && return 0
    sleep 4
  done
  return 1
}

is_revision() {
  local revision="$1"
  [[ "${#revision}" == 40 && "$revision" != *[!0123456789abcdef]* ]]
}

# One container's build revision, or a non-zero status if it cannot be read.
container_revision() {
  docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$1"
}

rollback_images() {
  local restored_api_id restored_web_id
  [[ -f "$STATE_FILE" ]] || return 1
  # shellcheck disable=SC1090
  source "$STATE_FILE"
  is_revision "$BASELINE_API_REVISION" || return 1
  is_revision "$BASELINE_WEB_REVISION" || return 1
  write_override "$BASELINE_API_IMAGE" "$BASELINE_WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override"
  "${dc_target[@]}" config --quiet
  "${dc_target[@]}" up -d --no-deps --pull never api web
  wait_api && wait_web || return 1
  restored_api_id="$("${dc_target[@]}" ps -q api | head -1)"
  restored_web_id="$("${dc_target[@]}" ps -q web | head -1)"
  [[ -n "$restored_api_id" && -n "$restored_web_id" ]] || return 1
  # The label name must reach Docker wrapped in real double quotes. Escaping
  # them inside a single-quoted shell word does not escape anything — the shell
  # passes the backslashes through literally and Go rejects the template with
  # `unexpected "\" in operand`. That made both reads fail, left both variables
  # empty, and so made the comparisons below unsatisfiable: this rollback path
  # could never report success, whatever had actually happened to the
  # containers. Every other template in this file already quotes it correctly.
  restored_api_revision="$(container_revision "$restored_api_id")" || return 2
  restored_web_revision="$(container_revision "$restored_web_id")" || return 2
  # Unreadable and wrong are different failures and must not share an exit code.
  # Conflating them is what let a broken verifier be reported as a failed
  # restore, sending the investigation at the containers instead of the check.
  is_revision "$restored_api_revision" || return 2
  is_revision "$restored_web_revision" || return 2
  [[ "$restored_api_revision" == "$BASELINE_API_REVISION" ]] || return 3
  [[ "$restored_web_revision" == "$BASELINE_WEB_REVISION" ]] || return 3
}

verify_durable_intake_local_postgres() {
  local pg_id sql result audit_id outbox_id
  pg_id="$(compose_id "$postgres_service")"
  [[ -n "$pg_id" ]] || fail POSTGRES_RUNTIME_MISSING 43
  sql="SELECT CASE WHEN count(*) = 1 AND bool_and(a.action = 'public:organization-intake:create' AND a.outcome = 'SUCCESS' AND a.\"correlationId\" = r.\"correlationId\") AND bool_and(o.type = 'PUBLIC_ORGANIZATION_CONNECTION_REQUESTED' AND o.\"correlationId\" = r.\"correlationId\" AND o.\"auditId\" = r.\"auditEventId\" AND NOT (o.payload ?| ARRAY['organizationName','inn','contactName','position','phone','email','payloadHash'])) THEN 'PASS' ELSE 'FAIL' END || '|' || min(r.\"auditEventId\") || '|' || min(r.\"outboxEntryId\") FROM public.public_organization_connection_requests r JOIN public.audit_events a ON a.id = r.\"auditEventId\" JOIN public.outbox_entries o ON o.id = r.\"outboxEntryId\" WHERE r.\"requestNumber\" = '$INTAKE_REQUEST_NUMBER' AND r.\"correlationId\" = '$INTAKE_CORRELATION_ID';"
  result="$(docker exec "$pg_id" sh -ceu 'test -n "${POSTGRES_USER:-}"; test -n "${POSTGRES_DB:-}"; psql -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --tuples-only --no-align --command "$1"' sh "$sql" | tr -d '[:space:]')"
  [[ "$result" =~ ^PASS\|audit-[A-Za-z0-9-]+\|outbox-[A-Za-z0-9-]+$ ]] || fail DURABLE_INTAKE_EVIDENCE_FAILED 44
  IFS='|' read -r _ audit_id outbox_id <<< "$result"
  printf 'DURABLE_INTAKE_EVIDENCE_MODE=COMPOSE_POSTGRES_DIRECT_JOIN\n'
  printf 'DURABLE_INTAKE_AUDIT_ID=%s\n' "$audit_id"
  printf 'DURABLE_INTAKE_OUTBOX_ID=%s\n' "$outbox_id"
}

verify_durable_intake_external_postgres() {
  local exact_api_id exact_api_revision result release_prefix release_run_id
  exact_api_id="$(compose_id api)"
  [[ -n "$exact_api_id" ]] || fail API_RUNTIME_MISSING_FOR_DB_EVIDENCE 45
  exact_api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$exact_api_id")"
  [[ "$exact_api_revision" == "$TARGET_SHA" ]] || fail API_DB_EVIDENCE_REVISION_MISMATCH 46

  release_prefix="release-intake:${TARGET_SHA}:"
  [[ "$INTAKE_CORRELATION_ID" == "$release_prefix"* ]] || fail EXTERNAL_POSTGRES_RELEASE_RUN_ID_UNAVAILABLE 47
  release_run_id="${INTAKE_CORRELATION_ID#"$release_prefix"}"
  [[ "$release_run_id" =~ ^[A-Za-z0-9._:-]{1,64}$ ]] || fail EXTERNAL_POSTGRES_RELEASE_RUN_ID_INVALID 48

  result="$(docker exec -i "$exact_api_id" /nodejs/bin/node - "$TARGET_SHA" "$release_run_id" "$INTAKE_REQUEST_NUMBER" "$INTAKE_CORRELATION_ID" <<'NODE'
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const [targetSha, runId, requestNumber, correlationId] = process.argv.slice(2);
const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

if (!/^[0-9a-f]{40}$/.test(targetSha ?? '')
  || !/^[A-Za-z0-9._:-]{1,128}$/.test(runId ?? '')
  || !/^PC-[0-9]{8}-[0-9A-F]{12}$/.test(requestNumber ?? '')
  || !/^[A-Za-z0-9._:-]{8,128}$/.test(correlationId ?? '')) {
  fail('EXTERNAL_POSTGRES_EVIDENCE_INPUT_INVALID');
  process.exit(1);
}

const sha7 = targetSha.slice(0, 7);
const idempotencyKey = `release-intake:${targetSha}:${runId}`;
const request = {
  organizationName: `ООО Системная проверка Прозрачная Цена ${sha7} ${runId}`,
  inn: '7707083893',
  contactName: 'Системный оператор',
  position: 'Release acceptance',
  phone: '+74950000000',
  email: `release-${sha7}-${runId}@procent-agro.test`.toLowerCase(),
  organizationRole: 'PUBLIC_INDUSTRY_PARTNER',
  scenario: 'EXTERNAL_INTEGRATION',
  locale: 'ru',
  consentVersion: 'public-organization-connect-v1',
};
const payloadHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT request_number, request_status, replay, correlation_id FROM public.lookup_public_organization_connection_request($1, $2)',
    idempotencyKey,
    payloadHash,
  );
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('EXTERNAL_POSTGRES_REQUEST_LOOKUP_FAILED');
  const row = rows[0];
  if (row.request_number !== requestNumber
    || row.request_status !== 'NEW'
    || row.replay !== true
    || row.correlation_id !== correlationId) {
    throw new Error('EXTERNAL_POSTGRES_REQUEST_EVIDENCE_MISMATCH');
  }

  const constraints = await prisma.$queryRawUnsafe(`
    SELECT
      count(*)::int AS constraint_count,
      bool_and(contype = 'f' AND convalidated AND confdeltype = 'r') AS constraints_valid,
      bool_and(
        (conname = 'public_org_connection_requests_audit_fkey' AND confrelid = 'public.audit_events'::regclass)
        OR
        (conname = 'public_org_connection_requests_outbox_fkey' AND confrelid = 'public.outbox_entries'::regclass)
      ) AS targets_valid
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.public_organization_connection_requests'::regclass
      AND conname IN (
        'public_org_connection_requests_audit_fkey',
        'public_org_connection_requests_outbox_fkey'
      )
  `);
  const constraint = constraints[0];
  if (constraint?.constraint_count !== 2
    || constraint?.constraints_valid !== true
    || constraint?.targets_valid !== true) {
    throw new Error('EXTERNAL_POSTGRES_FK_EVIDENCE_INVALID');
  }

  const attributes = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int AS not_null_count
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.public_organization_connection_requests'::regclass
      AND attname IN ('auditEventId', 'outboxEntryId')
      AND attnotnull
      AND NOT attisdropped
  `);
  if (attributes[0]?.not_null_count !== 2) throw new Error('EXTERNAL_POSTGRES_FK_COLUMNS_NULLABLE');

  process.stdout.write('PASS|REFERENTIAL_INTEGRITY|REFERENTIAL_INTEGRITY\n');
})()
  .catch((error) => {
    process.stderr.write(`${String(error?.message ?? error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
NODE
)" || fail EXTERNAL_POSTGRES_DURABLE_INTAKE_EVIDENCE_FAILED 49

  [[ "$result" == 'PASS|REFERENTIAL_INTEGRITY|REFERENTIAL_INTEGRITY' ]] || fail EXTERNAL_POSTGRES_DURABLE_INTAKE_EVIDENCE_INVALID 51
  printf 'DURABLE_INTAKE_EVIDENCE_MODE=EXTERNAL_POSTGRES_API_SECURITY_DEFINER\n'
  printf 'DURABLE_INTAKE_AUDIT_ID=REFERENTIAL_INTEGRITY_CONFIRMED\n'
  printf 'DURABLE_INTAKE_OUTBOX_ID=REFERENTIAL_INTEGRITY_CONFIRMED\n'
}

verify_durable_intake() {
  [[ "$INTAKE_REQUEST_NUMBER" =~ ^PC-[0-9]{8}-[0-9A-F]{12}$ ]] || fail INTAKE_REQUEST_NUMBER_INVALID 40
  [[ "$INTAKE_CORRELATION_ID" =~ ^[A-Za-z0-9._:-]{8,128}$ ]] || fail INTAKE_CORRELATION_ID_INVALID 41

  if [[ -n "$postgres_service" ]]; then
    verify_durable_intake_local_postgres
  else
    verify_durable_intake_external_postgres
  fi

  printf 'DURABLE_INTAKE_DB=PASS\n'
}

if [[ "$ACTION" == verify-intake ]]; then
  verify_durable_intake
  exit 0
fi

if [[ "$ACTION" == rollback ]]; then
  # Distinguished on purpose. A rollback that restored the wrong revision and a
  # rollback whose verification could not run are different incidents with
  # different responses, and reporting both as AUTOMATIC_ROLLBACK_FAILED cost an
  # investigation round. None of these is a success and none may be treated as
  # one — the run still fails, it just says which check failed.
  rollback_rc=0
  rollback_images || rollback_rc=$?
  case "$rollback_rc" in
    0) : ;;
    2) fail ROLLBACK_REVISION_UNREADABLE 57 ;;
    3) fail ROLLBACK_REVISION_MISMATCH 58 ;;
    *) fail AUTOMATIC_ROLLBACK_FAILED 50 ;;
  esac
  printf 'ROLLBACK_COMPLETE=1\n'
  printf 'RESTORED_API_REVISION=%s\n' "$restored_api_revision"
  printf 'RESTORED_WEB_REVISION=%s\n' "$restored_web_revision"
  printf 'ROLLBACK_CONTAINER_REVISIONS_VERIFIED=1\n'
  exit 0
fi

printf 'COMPOSE_AUTHORITY_RESOLVED=1\n'
printf 'MIGRATION_SERVICE_RESOLVED=1\n'
printf 'BASELINE_API_REVISION=%s\n' "$baseline_api_revision"
printf 'BASELINE_WEB_REVISION=%s\n' "$baseline_web_revision"

if [[ "$ACTION" == audit ]]; then
  printf 'AUDIT_COMPLETE=1\n'
  exit 0
fi

[[ -n "$API_IMAGE" && -n "$WEB_IMAGE" && -n "$MIGRATION_IMAGE" ]] || fail EXACT_IMAGES_REQUIRED 21
verify_image "$API_IMAGE"
verify_image "$WEB_IMAGE"
verify_image "$MIGRATION_IMAGE"

# Shared release-authority root: traverse-only for the runner group. `chmod 0700`
# here preserved the group and stripped its `--x`, which is exactly the state the
# host was found in — and it lands after the controller has set 0710, because this
# release and the preflight both fire on the same image build. The runner then
# cannot reach runner-input and activation dies before the controller is invoked.
install -d -m 0710 -o root -g pcactions "$STATE_ROOT"
umask 077
cat > "$STATE_FILE" <<STATE
BASELINE_API_IMAGE='$baseline_api_image'
BASELINE_WEB_IMAGE='$baseline_web_image'
BASELINE_API_REVISION='$baseline_api_revision'
BASELINE_WEB_REVISION='$baseline_web_revision'
MIGRATION_IMAGE='$MIGRATION_IMAGE'
STATE
chmod 0600 "$STATE_FILE"

before_ids="$(mktemp)"
after_ids="$(mktemp)"
snapshot_unrelated "$before_ids"
mutated=0
on_error() {
  rc=$?
  if (( mutated == 1 )); then rollback_images >/dev/null 2>&1 || true; fi
  printf 'DEPLOYMENT_COMPLETE=0\n' >&2
  printf 'ROLLBACK_ATTEMPTED=%s\n' "$mutated" >&2
  exit "$rc"
}
trap on_error ERR

if [[ -n "$postgres_service" ]]; then
  pg_id="$(compose_id "$postgres_service")"
  [[ -n "$pg_id" ]] || fail POSTGRES_RUNTIME_MISSING 22
  backup_dir="$STATE_ROOT/backups"
  mkdir -p "$backup_dir"
  chmod 0700 "$backup_dir"
  backup_name="predeploy-${TARGET_SHA}-${RUN_ID}.backup"
  docker exec "$pg_id" sh -ceu 'umask 077; : "${POSTGRES_USER:?}"; : "${POSTGRES_DB:?}"; pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" --file="$1" "$POSTGRES_DB"' sh "/tmp/$backup_name"
  docker cp "$pg_id:/tmp/$backup_name" "$backup_dir/$backup_name" >/dev/null
  docker exec "$pg_id" rm -f "/tmp/$backup_name"
  chmod 0600 "$backup_dir/$backup_name"
  [[ -s "$backup_dir/$backup_name" ]] || fail BACKUP_EMPTY 23
  sha256sum "$backup_dir/$backup_name" > "$backup_dir/$backup_name.sha256"
  chmod 0600 "$backup_dir/$backup_name.sha256"
  printf 'BACKUP_MODE=LOGICAL_COMPOSE_POSTGRES\n'
elif [[ -n "$backup_evidence" && -f "$backup_evidence" ]]; then
  [[ "$(stat -c '%a' "$backup_evidence")" =~ ^(400|440|600|640)$ ]] || fail BACKUP_EVIDENCE_PERMISSIONS 24
  grep -Fq 'STATUS=PASS' "$backup_evidence" || fail BACKUP_EVIDENCE_INVALID 25
  printf 'BACKUP_MODE=PROTECTED_EXTERNAL_EVIDENCE\n'
else
  fail BACKUP_AUTHORITY_UNAVAILABLE 26
fi

write_override "$API_IMAGE" "$WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override"
"${dc_target[@]}" config --quiet
mutated=1
"${dc_target[@]}" run --rm --no-deps --pull never "$migration_service"
printf 'MIGRATION_COMPLETE=1\n'
"${dc_target[@]}" up -d --no-deps --pull never api
if ! wait_api; then
  emit_api_startup_diagnostics
  fail API_READINESS_FAILED 30
fi
"${dc_target[@]}" up -d --no-deps --pull never web
wait_web || fail WEB_HEALTH_FAILED 31

mapfile -t watchtower_ids < <(docker ps -aq --filter 'label=com.docker.compose.service=watchtower')
for id in "${watchtower_ids[@]}"; do
  docker update --restart=no "$id" >/dev/null || true
  docker stop "$id" >/dev/null || true
done

snapshot_unrelated "$after_ids"
cmp -s "$before_ids" "$after_ids" || fail NON_TARGET_CONTAINER_CHANGED 32
rm -f "$before_ids" "$after_ids"

new_api_id="$("${dc_target[@]}" ps -q api | head -1)"
new_web_id="$("${dc_target[@]}" ps -q web | head -1)"
new_api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$new_api_id")"
new_web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$new_web_id")"
[[ "$new_api_revision" == "$TARGET_SHA" && "$new_web_revision" == "$TARGET_SHA" ]] || fail RUNNING_REVISION_MISMATCH 33
trap - ERR
printf 'DEPLOYED_API_REVISION=%s\n' "$new_api_revision"
printf 'DEPLOYED_WEB_REVISION=%s\n' "$new_web_revision"
printf 'WATCHTOWER_RETIRED=1\n'
printf 'DEPLOYMENT_COMPLETE=1\n'
