#!/usr/bin/env bash
# Invoked only by the accepted issue controller after immutable scope, exact
# source, review/CI and public DNS checks. This script never releases the API.
set -Eeuo pipefail
set +x
umask 077
exec 2>/dev/null

action="${1:-}"
target_sha="${2:-}"
run_id="${3:-}"
migration_digest="${PC_W1_MIGRATION_DIGEST:-}"
expected_baseline="${PC_W1_BASELINE_API_SHA:-}"
mutation=NONE
failure_emitted=0
probe_pid=''
probe_read=''
probe_write=''
temporary=''
emit(){ printf '%s=%s\n' "$1" "$2"; }
fail(){
  failure_emitted=1
  if [[ "$1" =~ ^[A-Z][A-Z0-9_]{2,95}$ ]]; then emit PC_W1_ERROR "$1"; else emit PC_W1_ERROR UNCLASSIFIED_REMOTE_FAILURE; fi
  emit PC_W1_DATABASE_MUTATION "$mutation"
  emit PC_W1_RESULT BLOCKED
  exit 1
}
cleanup(){
  local status=$?
  trap - EXIT ERR
  # A rejected probe has already closed its input. Its SIGPIPE must not replace
  # the original fail-closed status while best-effort cleanup releases handles.
  trap '' PIPE
  if [[ -n "$probe_write" ]]; then printf 'finish\n' >&"$probe_write" || true; exec {probe_write}>&- || true; fi
  if [[ -n "$probe_read" ]]; then exec {probe_read}<&- || true; fi
  if [[ -n "$probe_pid" ]]; then kill "$probe_pid" >/dev/null 2>&1 || true; fi
  [[ -z "$temporary" ]] || rm -rf -- "$temporary"
  if (( status != 0 && failure_emitted == 0 )); then
    emit PC_W1_ERROR UNCLASSIFIED_REMOTE_FAILURE
    emit PC_W1_DATABASE_MUTATION "$mutation"
    emit PC_W1_RESULT BLOCKED
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'fail UNCLASSIFIED_REMOTE_FAILURE' ERR
[[ "$#" == 3 && "$action" =~ ^(preflight|migrate)$ ]] || fail INVALID_ARGUMENTS
[[ "$target_sha" =~ ^[0-9a-f]{40}$ && "$run_id" =~ ^[1-9][0-9]{0,19}$ ]] || fail INVALID_TARGET_OR_RUN
[[ "$migration_digest" =~ ^ghcr\.io/pachaninm-lab/grainflow-migration@sha256:[0-9a-f]{64}$ ]] || fail MIGRATION_DIGEST_REQUIRED
[[ -n "${PC_W1_EXPECTED_MIGRATIONS_B64:-}" ]] || fail REPOSITORY_MANIFEST_REQUIRED
[[ "$action" != migrate || "$expected_baseline" =~ ^[0-9a-f]{40}$ ]] || fail PREFLIGHT_BASELINE_REQUIRED
[[ "$action" != migrate || "${PC_W1_EXPECTED_CATALOG_SHA256:-}" =~ ^[0-9a-f]{64}$ ]] || fail EXACT_IMAGE_REHEARSAL_CATALOG_REQUIRED
[[ "$action" != migrate || "${PC_W1_EXPECTED_BASELINE_CATALOG_SHA256:-}" =~ ^[0-9a-f]{64}$ ]] || fail EXACT_BASELINE_REHEARSAL_REQUIRED
[[ "$action" != migrate || "${PC_W1_EXPECTED_HISTORICAL_CATALOG_SHA256:-}" =~ ^[0-9a-f]{64}$ ]] || fail EXACT_HISTORICAL_REHEARSAL_REQUIRED
(( EUID == 0 )) || fail ROOT_BACKUP_AUTHORITY_REQUIRED
for command in docker python3 timeout sha256sum base64 flock stat; do command -v "$command" >/dev/null || fail REMOTE_PREREQUISITE_MISSING; done
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$script_dir/check-production-pc-crop-w1-acceptance.mjs" ]] || fail CHECKER_TRANSPORT_MISSING
checker_source="$(cat "$script_dir/check-production-pc-crop-w1-acceptance.mjs")"
[[ -n "$checker_source" ]] || fail CHECKER_TRANSPORT_EMPTY
temporary="$(mktemp -d /tmp/pc-w1-acceptance.XXXXXXXX)"
chmod 0700 "$temporary"
# Serialize this controller on the host as well as in the workflow. Other
# release contours must still share the production workflow concurrency group.
exec {lock_fd}>/run/lock/pc-crop-w1-acceptance.lock
flock -n "$lock_fd" || fail CONCURRENT_W1_RELEASE

docker pull "$migration_digest" >/dev/null || fail MIGRATION_IMAGE_PULL_FAILED
node_tool(){
  docker run --rm -i --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
    -e PC_W1_EXPECTED_MIGRATIONS_B64 --entrypoint /nodejs/bin/node "$migration_digest" \
    --input-type=module -e "$checker_source" -- --runtime-tool "$@"
}
docker image inspect "$migration_digest" | node_tool image "$target_sha" "$migration_digest" >/dev/null || fail MIGRATION_IMAGE_IDENTITY_INVALID
node_tool verify-image-files </dev/null >/dev/null || fail IMAGE_MIGRATION_CONTENT_MISMATCH

api_inventory="$(docker ps -q --no-trunc --filter label=com.docker.compose.service=api)"
mapfile -t api_ids <<< "$api_inventory"
(( ${#api_ids[@]} == 1 )) && [[ "${api_ids[0]}" =~ ^[0-9a-f]{64}$ ]] || fail API_CONTAINER_AMBIGUOUS
api_id="${api_ids[0]}"
[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_NOT_RUNNING
api_image_id="$(docker inspect --format '{{.Image}}' "$api_id")"
baseline_sha="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$api_image_id")"
[[ "$baseline_sha" =~ ^[0-9a-f]{40}$ ]] || fail BASELINE_API_REVISION_INVALID
[[ -z "$expected_baseline" || "$baseline_sha" == "$expected_baseline" ]] || fail PREFLIGHT_BASELINE_CHANGED
# Preserve source identity even when the later read-only ledger probe blocks.
# This is an observed OCI revision, not runtime compatibility or acceptance.
emit PC_W1_TARGET_SHA "$target_sha"
emit PC_W1_BASELINE_API_SHA "$baseline_sha"

decode(){ [[ -z "$1" ]] || printf '%s' "$1" | base64 -d; }
prod_dir="$(decode "${PC_PROD_DIR_B64:-}")"
prod_compose="$(decode "${PC_PROD_COMPOSE_B64:-}")"
prod_project="$(decode "${PC_PROD_PROJECT_B64:-}")"
[[ -n "$prod_dir" ]] || prod_dir="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$api_id")"
[[ -n "$prod_compose" ]] || prod_compose="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$api_id")"
[[ -n "$prod_project" ]] || prod_project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$api_id")"
[[ "$prod_dir" == /* && -d "$prod_dir" && "$prod_project" =~ ^[a-z0-9][a-z0-9_-]*$ && -n "$prod_compose" ]] || fail PRODUCTION_COMPOSE_AUTHORITY_INVALID
[[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$api_id")" == "$prod_project" ]] || fail COMPOSE_PROJECT_MISMATCH
dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
IFS=',' read -r -a compose_files <<< "$prod_compose"
for file in "${compose_files[@]}"; do
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" ]] || fail COMPOSE_SOURCE_MISSING
  dc+=(-f "$file")
done
"${dc[@]}" config --format json >"$temporary/compose.json" || fail COMPOSE_CONFIG_INVALID
migration_service="$(node_tool compose <"$temporary/compose.json")" || fail MIGRATION_SERVICE_AMBIGUOUS
baseline_config="$(sha256sum "$temporary/compose.json" | cut -d' ' -f1)"
cat >"$temporary/migration-image.yml" <<YAML
services:
  $migration_service:
    image: $migration_digest
    pull_policy: never
YAML
dc_migration=("${dc[@]}" -f "$temporary/migration-image.yml")
"${dc_migration[@]}" config --format json >"$temporary/target-compose.json" || fail MIGRATION_OVERRIDE_INVALID
node_tool compose <"$temporary/target-compose.json" >/dev/null || fail MIGRATION_OVERRIDE_INVALID
# Image is the only changed service property; verify this mechanically without
# exposing canonical source paths or environment values in evidence.
python3 - "$temporary/compose.json" "$temporary/target-compose.json" "$migration_service" "$migration_digest" <<'PY' >/dev/null || fail MIGRATION_OVERRIDE_SCOPE_INVALID
import json,sys
baseline=json.load(open(sys.argv[1])); target=json.load(open(sys.argv[2])); name=sys.argv[3]
expected=baseline['services'][name].copy(); expected['image']=sys.argv[4]; expected['pull_policy']='never'
baseline['services'][name]=expected
assert baseline==target
PY

runtime_snapshot(){
  local inventory
  inventory="$(docker ps -aq --no-trunc --filter "label=com.docker.compose.project=$prod_project")"
  [[ -n "$inventory" ]] || return 1
  mapfile -t runtime_ids <<< "$inventory"
  docker inspect "${runtime_ids[@]}" | node_tool runtime-fingerprint "${1:-}"
}
baseline_runtime="$(runtime_snapshot)" || fail RUNTIME_SNAPSHOT_FAILED
baseline_non_api="$(runtime_snapshot "$api_id")" || fail NON_API_SNAPSHOT_FAILED
assert_runtime_unchanged(){
  [[ "$(runtime_snapshot)" == "$baseline_runtime" ]] || fail API_OR_NON_API_RUNTIME_CHANGED
  [[ "$(runtime_snapshot "$api_id")" == "$baseline_non_api" ]] || fail NON_API_RUNTIME_CHANGED
  "${dc[@]}" config --format json >"$temporary/current-compose.json" || fail COMPOSE_CONFIG_UNAVAILABLE
  [[ "$(sha256sum "$temporary/current-compose.json" | cut -d' ' -f1)" == "$baseline_config" ]] || fail COMPOSE_CONFIGURATION_CHANGED
}
while IFS= read -r id; do
  [[ -n "$id" ]] || continue
  image="$(docker inspect --format '{{.Config.Image}}' "$id")"
  [[ "$image" != *containrrr/watchtower* ]] || fail WATCHTOWER_RUNNING
done < <(docker ps -q --no-trunc)

# The exporting API transaction is READ_ONLY. The migration image imports its
# live PostgreSQL snapshot, including database OID and session nonce checks.
# No URL-string equality or a successful command on another database suffices.
probe_open(){
  local phase="$1" probe_error
  coproc W1_PROBE { timeout 230s docker exec -i -e PC_W1_EXPECTED_MIGRATIONS_B64 -e PC_W1_EXPECTED_CATALOG_SHA256 \
    -e PC_W1_EXPECTED_BASELINE_CATALOG_SHA256 -e PC_W1_EXPECTED_HISTORICAL_CATALOG_SHA256 "$api_id" \
    /nodejs/bin/node --input-type=module -e "$checker_source" -- --runtime-probe "$phase"; }
  probe_pid="$W1_PROBE_PID"
  exec {probe_read}<&"${W1_PROBE[0]}"
  exec {probe_write}>&"${W1_PROBE[1]}"
  IFS= read -r -t 45 observation <&"$probe_read" || fail API_READ_ONLY_PROBE_FAILED
  printf '%s' "$observation" >"$temporary/observation.json"
  probe_error="$(node_tool probe-error <"$temporary/observation.json")" || fail API_PROBE_RESPONSE_INVALID
  node_tool probe-diagnostics <"$temporary/observation.json" || fail API_PROBE_RESPONSE_INVALID
  [[ -z "$probe_error" ]] || fail "$probe_error"
  node_tool snapshot-sql <"$temporary/observation.json" >"$temporary/identity.sql" || fail API_READ_ONLY_PROBE_REJECTED
  "${dc_migration[@]}" run --rm --no-deps --pull never -T --entrypoint /nodejs/bin/node "$migration_service" \
    node_modules/prisma/build/index.js db execute --schema prisma/schema.prisma --stdin <"$temporary/identity.sql" >/dev/null || fail API_MIGRATION_DATABASE_IDENTITY_UNPROVEN
}
probe_field(){ node_tool probe-field "$1" <"$temporary/observation.json"; }
probe_close(){
  local released
  printf 'finish\n' >&"$probe_write" || fail API_PROBE_RELEASE_FAILED
  IFS= read -r -t 20 released <&"$probe_read" || fail API_PROBE_RELEASE_FAILED
  [[ "$released" == '{"released":true}' ]] || fail API_PROBE_RELEASE_INVALID
  exec {probe_write}>&-
  exec {probe_read}<&-
  probe_write=''; probe_read=''
  wait "$probe_pid" || fail API_PROBE_TRANSACTION_FAILED
  probe_pid=''
}
probe_open pre
decision="$(probe_field decision)"
environment_hash="$(probe_field environmentHash)"
if [[ "$action" == migrate && "$decision" == READY_EXACT_EIGHT ]]; then
  [[ "$(probe_field lineageChecks)" == PASS ]] || fail EXACT_LINEAGE_REFERENCE_REQUIRED
  # An external database requires a separately reviewed, snapshot-bound backup
  # path. A free-form STATUS=PASS evidence file is never accepted here.
  postgres_inventory="$(docker ps -q --no-trunc --filter "label=com.docker.compose.project=$prod_project" --filter label=com.docker.compose.service=postgres)"
  mapfile -t postgres_ids <<< "$postgres_inventory"
  (( ${#postgres_ids[@]} == 1 )) && [[ "${postgres_ids[0]}" =~ ^[0-9a-f]{64}$ ]] || fail SNAPSHOT_BOUND_BACKUP_AUTHORITY_REQUIRED
  postgres_id="${postgres_ids[0]}"
  backup_dir="$(mktemp -d /root/pc-w1-backup.XXXXXXXX)"
  chmod 0700 "$backup_dir"
  backup="$backup_dir/database.dump"
  snapshot="$(probe_field snapshot)"
  timeout 100s docker exec "$postgres_id" sh -ceu '
    : "${POSTGRES_USER:?}" "${POSTGRES_DB:?}"
    exec pg_dump --format=custom --no-password --snapshot="$1" --username="$POSTGRES_USER" "$POSTGRES_DB"
  ' sh "$snapshot" >"$backup" || fail SNAPSHOT_BOUND_BACKUP_FAILED
  chmod 0600 "$backup"
  [[ -s "$backup" && "$(stat -c '%u:%a' "$backup")" == 0:600 ]] || fail BACKUP_FILE_INVALID
  docker exec -i "$postgres_id" pg_restore --list <"$backup" >/dev/null || fail BACKUP_ARCHIVE_UNREADABLE
  backup_sha="$(sha256sum "$backup" | cut -d' ' -f1)"
  backup_bytes="$(stat -c '%s' "$backup")"
  # The archive is retained on the server. This is no restore rehearsal and
  # does not establish functional rollback of the legacy lot registration API.
  probe_close
  assert_runtime_unchanged
  # A fresh exact-eight read closes the time spent creating the backup. Keep
  # this exporting session open through the bounded Prisma deployment.
  probe_open pre
  [[ "$(probe_field decision)" == READY_EXACT_EIGHT ]] || fail PENDING_SET_CHANGED_AFTER_BACKUP
  [[ "$(probe_field lineageChecks)" == PASS ]] || fail EXACT_LINEAGE_REFERENCE_REQUIRED
  [[ "$(probe_field environmentHash)" == "$environment_hash" ]] || fail API_ENVIRONMENT_CHANGED
  mutation=MAY_HAVE_PARTIALLY_APPLIED
  timeout 120s "${dc_migration[@]}" run --rm --no-deps --pull never -T "$migration_service" >/dev/null || fail BOUNDED_MIGRATION_FAILED
  probe_close
  probe_open post
  [[ "$(probe_field environmentHash)" == "$environment_hash" ]] || fail API_ENVIRONMENT_CHANGED
  mutation=BOUNDED_EIGHT_MIGRATIONS
  decision=MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE
fi
pending="$(probe_field pendingCount)"
legacy_initial_marker="$(probe_field legacyInitialMarker)"
tables="$(probe_field tables)"
structural="$(probe_field structuralChecks)"
catalog_hash="$(probe_field catalogHash)"
archived_ledger="$(probe_field historicalLineage)"
lineage_profile="$(probe_field lineageProfile)"
lineage_hash="$(probe_field lineageCatalogHash)"
lineage_checks="$(probe_field lineageChecks)"
probe_close
assert_runtime_unchanged

emit PC_W1_DATABASE_IDENTITY PASS
emit PC_W1_ARCHIVED_LEDGER "$archived_ledger"
emit PC_W1_LINEAGE_PROFILE "$lineage_profile"
emit PC_W1_LINEAGE_CATALOG_SHA256 "$lineage_hash"
emit PC_W1_LINEAGE_CHECKS "$lineage_checks"
emit PC_W1_PENDING_MIGRATIONS "$pending"
emit PC_W1_LEGACY_INITIAL_MARKER "$legacy_initial_marker"
emit PC_W1_SCHEMA_TABLES "$tables"
emit PC_W1_SCHEMA_STRUCTURAL_CHECKS "$structural"
[[ -z "$catalog_hash" ]] || emit PC_W1_SCHEMA_CATALOG_SHA256 "$catalog_hash"
emit PC_W1_API_ENVIRONMENT_SHA256 "$environment_hash"
emit PC_W1_NON_API_RUNTIME_SHA256 "$baseline_non_api"
emit PC_W1_RUNTIME_UNCHANGED PASS
if [[ "$mutation" == BOUNDED_EIGHT_MIGRATIONS ]]; then
  emit PC_W1_BACKUP_SHA256 "$backup_sha"
  emit PC_W1_BACKUP_BYTES "$backup_bytes"
  emit PC_W1_BACKUP_VERIFICATION ARCHIVE_LIST_ONLY
fi
emit PC_W1_DATABASE_ROLLBACK NOT_REHEARSED
emit PC_W1_DATABASE_MUTATION "$mutation"
emit PC_W1_AUTHENTICATED_ACCEPTANCE NOT_EVIDENCED
emit PC_W1_FULL_ACCEPTANCE NOT_EVIDENCED
emit PC_W1_LEGACY_LOT_ROLLBACK DEGRADED_FAIL_CLOSED
emit PC_W1_RESULT "$decision"
