#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ACTION="${1:-}"
TARGET_SHA="${2:-}"
RUN_ID="${3:-}"
OUTPUT_FILE="${4:-}"

[[ "$ACTION" =~ ^(apply|rollback|finalize)$ ]] || { echo 'INVALID_ACTION' >&2; exit 2; }
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'INVALID_TARGET_SHA' >&2; exit 2; }
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || { echo 'INVALID_RUN_ID' >&2; exit 2; }
[[ "$OUTPUT_FILE" == "/var/lib/pc-release-authority/runner-output/${RUN_ID}/public-non-tai-acl-repair.json" ]] \
  || { echo 'INVALID_OUTPUT_PATH' >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo 'ROOT_AUTHORITY_REQUIRED' >&2; exit 2; }

readonly ROLE_NAME='tai_runtime'
readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'
readonly STATE_ROOT="/var/lib/pc-release-authority/tai-public-acl-${RUN_ID}"
readonly OUTPUT_DIR="${OUTPUT_FILE%/*}"

install -d -m 0700 -o root -g root "$OUTPUT_DIR"

COMPOSE_PROJECT=''
DB_SERVICE=''
DB_NAME=''
DB_ADMIN=''
DB_ID=''
INVENTORY_FILE="$STATE_ROOT/inventory.json"
REVOKE_SQL="$STATE_ROOT/revoke.sql"
RESTORE_SQL="$STATE_ROOT/restore.sql"
METADATA_FILE="$STATE_ROOT/metadata.env"
MUTATION_PERFORMED=false
ROLLBACK_PERFORMED=false

write_evidence() {
  local status="$1" passed="$2" error_code="$3"
  local inventory='{}'
  [[ ! -s "$INVENTORY_FILE" ]] || inventory="$(cat "$INVENTORY_FILE")"
  python3 - "$OUTPUT_FILE" "$TARGET_SHA" "$RUN_ID" "$status" "$passed" "$error_code" \
    "$MUTATION_PERFORMED" "$ROLLBACK_PERFORMED" "$COMPOSE_PROJECT" "$DB_SERVICE" "$DB_NAME" "$inventory" <<'PY_EVIDENCE'
import json, os, sys
(
    path, sha, run_id, status, passed, error_code, mutation,
    rollback, project, db_service, db_name, inventory,
) = sys.argv[1:]
report = {
    'schemaVersion': 'tai.public-non-tai-acl-repair.v1',
    'targetSha': sha,
    'runId': run_id,
    'hosting': 'REG_RU_VPS_ONLY',
    'newRecurringCostRub': 0,
    'status': status,
    'errorCode': error_code or None,
    'role': 'tai_runtime',
    'composeProject': project or None,
    'databaseService': db_service or None,
    'databaseName': db_name or None,
    'inventory': json.loads(inventory),
    'mutationPerformed': mutation == 'true',
    'rollbackPrepared': True,
    'rollbackPerformed': rollback == 'true',
    'dropOwnedUsed': False,
    'reassignOwnedUsed': False,
    'dropRoleUsed': False,
    'applicationDeploymentPerformed': False,
    'modelMutationPerformed': False,
    'passed': passed == 'true',
}
with open(path, 'w', encoding='utf-8') as handle:
    json.dump(report, handle, sort_keys=True, separators=(',', ':'))
    handle.write('\n')
os.chmod(path, 0o600)
PY_EVIDENCE
}

fail_with_evidence() {
  local rc="$1" code="$2" status="${3:-FAILED_NO_MUTATION}"
  write_evidence "$status" false "$code"
  echo "$code" >&2
  exit "$rc"
}

resolve_running_db() {
  mapfile -t ids < <(
    docker ps -q \
      --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" \
      --filter "label=com.docker.compose.service=$DB_SERVICE"
  )
  (( ${#ids[@]} == 1 )) || return 1
  DB_ID="${ids[0]}"
  [[ "$DB_ID" =~ ^[0-9a-f]{12,64}$ ]] || return 1
  [[ "$(docker inspect --format '{{.State.Status}}' "$DB_ID")" == running ]] || return 1
  local image repository postgres_db postgres_user pgdata durable=0
  image="$(docker inspect --format '{{.Config.Image}}' "$DB_ID")"
  repository="${image%%@*}"; repository="${repository##*/}"; repository="${repository%%:*}"
  [[ "$repository" == postgres || "$repository" == postgresql ]] || return 1
  postgres_db="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$DB_ID" | sed -n 's/^POSTGRES_DB=//p' | head -1)"
  postgres_user="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$DB_ID" | sed -n 's/^POSTGRES_USER=//p' | head -1)"
  pgdata="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$DB_ID" | sed -n 's/^PGDATA=//p' | head -1)"
  [[ -n "$pgdata" ]] || pgdata='/var/lib/postgresql/data'
  [[ "$postgres_db" == "$DB_NAME" && "$postgres_user" == "$DB_ADMIN" ]] || return 1
  while IFS=$'\t' read -r type destination source; do
    [[ "$type" == volume || "$type" == bind ]] || continue
    [[ -n "$source" ]] || continue
    [[ "$pgdata" == "$destination" || "$pgdata" == "$destination"/* ]] && durable=1
  done < <(docker inspect --format '{{range .Mounts}}{{printf "%s\t%s\t%s\n" .Type .Destination .Source}}{{end}}' "$DB_ID")
  (( durable == 1 )) || return 1
}

psql_admin() {
  docker exec -i "$DB_ID" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME" "$@"
}

load_metadata() {
  [[ -s "$METADATA_FILE" && ! -L "$METADATA_FILE" ]] || return 1
  # shellcheck disable=SC1090
  source "$METADATA_FILE"
  [[ "$SAVED_TARGET_SHA" == "$TARGET_SHA" ]]
  [[ "$COMPOSE_PROJECT" =~ ^[A-Za-z0-9._-]+$ ]]
  [[ "$DB_SERVICE" =~ ^[A-Za-z0-9._-]+$ ]]
  [[ "$DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]
  [[ "$DB_ADMIN" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]
  resolve_running_db
}

count_effective_non_tai() {
  psql_admin -Atc "
    SELECT COUNT(*)::int
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
    WHERE namespace.nspname='public'
      AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
      AND relation.relkind IN ('r','v','m','p','f')
      AND has_table_privilege('${ROLE_NAME}', relation.oid,
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');
  "
}

if [[ "$ACTION" == rollback ]]; then
  load_metadata || fail_with_evidence 40 TAI_PUBLIC_ACL_ROLLBACK_AUTHORITY_INVALID ROLLBACK_FAILED
  [[ -f "$STATE_ROOT/APPLIED" && ! -f "$STATE_ROOT/FINALIZED" ]] \
    || fail_with_evidence 41 TAI_PUBLIC_ACL_ROLLBACK_STATE_INVALID ROLLBACK_FAILED
  [[ -s "$RESTORE_SQL" && ! -L "$RESTORE_SQL" && "$(stat -c '%U:%G:%a' "$RESTORE_SQL")" == root:root:600 ]] \
    || fail_with_evidence 42 TAI_PUBLIC_ACL_RESTORE_AUTHORITY_INVALID ROLLBACK_FAILED
  psql_admin < "$RESTORE_SQL" \
    || fail_with_evidence 43 TAI_PUBLIC_ACL_ROLLBACK_TRANSACTION_FAILED ROLLBACK_FAILED
  restored="$(count_effective_non_tai)"
  [[ "$restored" == 2 ]] \
    || fail_with_evidence 44 TAI_PUBLIC_ACL_ROLLBACK_POSTCONDITION_FAILED ROLLBACK_FAILED
  ROLLBACK_PERFORMED=true
  touch "$STATE_ROOT/ROLLED_BACK"
  write_evidence ROLLED_BACK false TAI_PUBLIC_ACL_ACCEPTANCE_FAILED
  echo 'TAI_PUBLIC_NON_TAI_ACL_ROLLBACK=PASS'
  exit 0
fi

if [[ "$ACTION" == finalize ]]; then
  load_metadata || fail_with_evidence 50 TAI_PUBLIC_ACL_FINALIZE_AUTHORITY_INVALID FINALIZE_FAILED
  [[ -f "$STATE_ROOT/APPLIED" && ! -f "$STATE_ROOT/ROLLED_BACK" ]] \
    || fail_with_evidence 51 TAI_PUBLIC_ACL_FINALIZE_STATE_INVALID FINALIZE_FAILED
  remaining="$(count_effective_non_tai)"
  [[ "$remaining" == 0 ]] \
    || fail_with_evidence 52 TAI_PUBLIC_ACL_FINALIZE_POSTCONDITION_FAILED FINALIZE_FAILED
  MUTATION_PERFORMED=true
  touch "$STATE_ROOT/FINALIZED"
  write_evidence ACCEPTED true ''
  echo 'TAI_PUBLIC_NON_TAI_ACL_FINALIZE=PASS'
  exit 0
fi

[[ ! -e "$STATE_ROOT" && ! -L "$STATE_ROOT" ]] \
  || fail_with_evidence 10 TAI_PUBLIC_ACL_STATE_ALREADY_EXISTS BLOCKED_AUTHORITY
install -d -m 0700 -o root -g root "$STATE_ROOT"
INVENTORY_FILE="$STATE_ROOT/inventory.json"
REVOKE_SQL="$STATE_ROOT/revoke.sql"
RESTORE_SQL="$STATE_ROOT/restore.sql"
METADATA_FILE="$STATE_ROOT/metadata.env"

[[ ! -e "$ENV_FILE" && ! -L "$ENV_FILE" ]] \
  || fail_with_evidence 11 TAI_PUBLIC_ACL_TAI_ENV_PRESENT BLOCKED_ORPHAN_BOUNDARY

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
exact_web_ids=()
for id in "${web_ids[@]}"; do
  revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)"
  [[ "$revision" == "$TARGET_SHA" ]] && exact_web_ids+=("$id")
done
(( ${#exact_web_ids[@]} == 1 )) \
  || fail_with_evidence 12 TAI_PUBLIC_ACL_WEB_AUTHORITY_AMBIGUOUS BLOCKED_AUTHORITY
web_id="${exact_web_ids[0]}"
COMPOSE_PROJECT="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
[[ "$COMPOSE_PROJECT" =~ ^[A-Za-z0-9._-]+$ && -d "$prod_dir" ]] \
  || fail_with_evidence 13 TAI_PUBLIC_ACL_COMPOSE_METADATA_INVALID BLOCKED_AUTHORITY
override="$prod_dir/compose.tai-agro-os.override.yml"
[[ ! -e "$override" && ! -L "$override" ]] \
  || fail_with_evidence 14 TAI_PUBLIC_ACL_TAI_OVERRIDE_PRESENT BLOCKED_ORPHAN_BOUNDARY
mapfile -t tai_ids < <(
  docker ps -aq \
    --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" \
    --filter 'label=com.docker.compose.service=tai'
)
(( ${#tai_ids[@]} == 0 )) \
  || fail_with_evidence 15 TAI_PUBLIC_ACL_TAI_SERVICE_PRESENT BLOCKED_ORPHAN_BOUNDARY

mapfile -t api_ids < <(
  docker ps -q \
    --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" \
    --filter 'label=com.docker.compose.service=api'
)
(( ${#api_ids[@]} == 1 )) \
  || fail_with_evidence 16 TAI_PUBLIC_ACL_API_AUTHORITY_AMBIGUOUS BLOCKED_AUTHORITY
api_id="${api_ids[0]}"
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")" == "$TARGET_SHA" ]] \
  || fail_with_evidence 17 TAI_PUBLIC_ACL_API_NOT_EXACT_MAIN BLOCKED_AUTHORITY
database_url="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api_id" | sed -n 's/^DATABASE_URL=//p' | head -1)"
readarray -t db_authority < <(python3 - "$database_url" <<'PY_DATABASE_URL'
import re, sys
from urllib.parse import parse_qsl, unquote, urlsplit
value=sys.argv[1]
if not value or value != value.strip() or re.search(r'[\x00-\x20\x7f]',value): raise SystemExit(2)
parsed=urlsplit(value)
if parsed.scheme not in {'postgres','postgresql'} or not parsed.hostname: raise SystemExit(3)
keys=[key.strip().lower() for key,_ in parse_qsl(parsed.query,keep_blank_values=True,strict_parsing=True,max_num_fields=32)]
if len(keys)!=len(set(keys)) or {'database','dbname','host','hostaddr','port','service','socket','unix_socket'}.intersection(keys): raise SystemExit(4)
name=unquote(parsed.path[1:]) if parsed.path.startswith('/') else ''
if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,62}',name): raise SystemExit(5)
print(parsed.hostname); print(name)
PY_DATABASE_URL
) || fail_with_evidence 18 TAI_PUBLIC_ACL_DATABASE_URL_INVALID BLOCKED_AUTHORITY
(( ${#db_authority[@]} == 2 )) \
  || fail_with_evidence 18 TAI_PUBLIC_ACL_DATABASE_URL_INVALID BLOCKED_AUTHORITY
DB_SERVICE="${db_authority[0]}"
DB_NAME="${db_authority[1]}"
mapfile -t db_ids < <(
  docker ps -q \
    --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" \
    --filter "label=com.docker.compose.service=$DB_SERVICE"
)
(( ${#db_ids[@]} == 1 )) \
  || fail_with_evidence 19 TAI_PUBLIC_ACL_DATABASE_AUTHORITY_AMBIGUOUS BLOCKED_AUTHORITY
DB_ID="${db_ids[0]}"
DB_ADMIN="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$DB_ID" | sed -n 's/^POSTGRES_USER=//p' | head -1)"
[[ "$DB_ADMIN" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]] \
  || fail_with_evidence 20 TAI_PUBLIC_ACL_DATABASE_ADMIN_INVALID BLOCKED_AUTHORITY
resolve_running_db \
  || fail_with_evidence 21 TAI_PUBLIC_ACL_DATABASE_RUNTIME_INVALID BLOCKED_AUTHORITY

admin_boundary="$(psql_admin -AtF $'\t' -c "SELECT rolsuper,rolcreaterole FROM pg_catalog.pg_roles WHERE rolname='${DB_ADMIN}';")"
[[ "$(printf '%s\n' "$admin_boundary" | grep -c .)" == 1 ]] \
  || fail_with_evidence 22 TAI_PUBLIC_ACL_DATABASE_ADMIN_MISSING BLOCKED_AUTHORITY
IFS=$'\t' read -r admin_super admin_createrole <<< "$admin_boundary"
[[ "$admin_super" == t || "$admin_createrole" == t ]] \
  || fail_with_evidence 22 TAI_PUBLIC_ACL_DATABASE_ADMIN_BOUNDARY_INVALID BLOCKED_AUTHORITY

role_exists="$(psql_admin -Atc "SELECT COUNT(*) FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}';")"
[[ "$role_exists" == 1 ]] \
  || fail_with_evidence 23 TAI_PUBLIC_ACL_RUNTIME_ROLE_MISSING BLOCKED_ORPHAN_BOUNDARY

psql_admin -Atc "
WITH role_row AS (
  SELECT oid,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,
         rolreplication,rolbypassrls,rolconnlimit
  FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'
), relations AS (
  SELECT relation.oid,namespace.nspname,relation.relname,relation.relkind,
         relation.relowner,relation.relacl
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
  WHERE namespace.nspname='public'
    AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
    AND relation.relkind IN ('r','v','m','p','f')
), effective AS (
  SELECT relation.*,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN has_table_privilege('${ROLE_NAME}',relation.oid,'SELECT') THEN 'SELECT' END,
      CASE WHEN has_table_privilege('${ROLE_NAME}',relation.oid,'INSERT') THEN 'INSERT' END,
      CASE WHEN has_table_privilege('${ROLE_NAME}',relation.oid,'UPDATE') THEN 'UPDATE' END,
      CASE WHEN has_table_privilege('${ROLE_NAME}',relation.oid,'DELETE') THEN 'DELETE' END,
      CASE WHEN has_table_privilege('${ROLE_NAME}',relation.oid,'TRUNCATE') THEN 'TRUNCATE' END,
      CASE WHEN has_table_privilege('${ROLE_NAME}',relation.oid,'REFERENCES') THEN 'REFERENCES' END,
      CASE WHEN has_table_privilege('${ROLE_NAME}',relation.oid,'TRIGGER') THEN 'TRIGGER' END
    ],NULL)::text[] AS effective_privileges
  FROM relations AS relation
), public_relation AS (
  SELECT relation.oid,
    COALESCE(jsonb_agg(jsonb_build_object(
      'privilege',acl.privilege_type,
      'grantable',acl.is_grantable,
      'grantor',pg_get_userbyid(acl.grantor)
    ) ORDER BY acl.privilege_type),'[]'::jsonb) AS entries
  FROM relations AS relation
  CROSS JOIN LATERAL aclexplode(COALESCE(relation.relacl,ARRAY[]::aclitem[])) AS acl
  WHERE acl.grantee=0
  GROUP BY relation.oid
), public_columns AS (
  SELECT attribute.attrelid AS oid,COUNT(*)::int AS count
  FROM pg_catalog.pg_attribute AS attribute
  CROSS JOIN LATERAL aclexplode(COALESCE(attribute.attacl,ARRAY[]::aclitem[])) AS acl
  WHERE attribute.attnum>0 AND NOT attribute.attisdropped AND acl.grantee=0
  GROUP BY attribute.attrelid
), direct_role AS (
  SELECT relation.oid,COUNT(*)::int AS count
  FROM relations AS relation,role_row
  CROSS JOIN LATERAL aclexplode(COALESCE(relation.relacl,ARRAY[]::aclitem[])) AS acl
  WHERE acl.grantee=role_row.oid
  GROUP BY relation.oid
), direct_role_columns AS (
  SELECT attribute.attrelid AS oid,COUNT(*)::int AS count
  FROM pg_catalog.pg_attribute AS attribute,role_row
  CROSS JOIN LATERAL aclexplode(COALESCE(attribute.attacl,ARRAY[]::aclitem[])) AS acl
  WHERE attribute.attnum>0 AND NOT attribute.attisdropped AND acl.grantee=role_row.oid
  GROUP BY attribute.attrelid
), role_boundary AS (
  SELECT jsonb_build_object(
    'canLogin',role_row.rolcanlogin,
    'superuser',role_row.rolsuper,
    'createdb',role_row.rolcreatedb,
    'createrole',role_row.rolcreaterole,
    'inherit',role_row.rolinherit,
    'replication',role_row.rolreplication,
    'bypassRls',role_row.rolbypassrls,
    'connectionLimit',role_row.rolconnlimit,
    'membershipCount',(SELECT COUNT(*) FROM pg_catalog.pg_auth_members WHERE member=role_row.oid),
    'memberGrantCount',(SELECT COUNT(*) FROM pg_catalog.pg_auth_members WHERE roleid=role_row.oid),
    'activeSessionCount',(SELECT COUNT(*) FROM pg_catalog.pg_stat_activity WHERE usename='${ROLE_NAME}'),
    'ownedRelationCount',(SELECT COUNT(*) FROM pg_catalog.pg_class WHERE relowner=role_row.oid),
    'ownedSchemaCount',(SELECT COUNT(*) FROM pg_catalog.pg_namespace WHERE nspowner=role_row.oid),
    'ownedFunctionCount',(SELECT COUNT(*) FROM pg_catalog.pg_proc WHERE proowner=role_row.oid),
    'ownedTypeCount',(SELECT COUNT(*) FROM pg_catalog.pg_type WHERE typowner=role_row.oid),
    'ownedDatabaseCount',(SELECT COUNT(*) FROM pg_catalog.pg_database WHERE datdba=role_row.oid),
    'ownedDefaultAclCount',(SELECT COUNT(*) FROM pg_catalog.pg_default_acl WHERE defaclrole=role_row.oid)
  ) AS value FROM role_row
)
SELECT jsonb_build_object(
  'roleBoundary',(SELECT value FROM role_boundary),
  'effectiveRelationCount',COUNT(*) FILTER (WHERE cardinality(effective.effective_privileges)>0),
  'relations',COALESCE(jsonb_agg(jsonb_build_object(
    'schema',effective.nspname,
    'name',effective.relname,
    'kind',effective.relkind,
    'effectivePrivileges',effective.effective_privileges,
    'publicRelationAcl',COALESCE(public_relation.entries,'[]'::jsonb),
    'publicColumnAclCount',COALESCE(public_columns.count,0),
    'directRoleAclCount',COALESCE(direct_role.count,0),
    'directRoleColumnAclCount',COALESCE(direct_role_columns.count,0)
  ) ORDER BY effective.nspname,effective.relname)
    FILTER (WHERE cardinality(effective.effective_privileges)>0),'[]'::jsonb)
)::text
FROM effective
LEFT JOIN public_relation USING (oid)
LEFT JOIN public_columns USING (oid)
LEFT JOIN direct_role USING (oid)
LEFT JOIN direct_role_columns USING (oid);
" > "$INVENTORY_FILE" \
  || fail_with_evidence 24 TAI_PUBLIC_ACL_INVENTORY_QUERY_FAILED BLOCKED_AUTHORITY
chmod 0600 "$INVENTORY_FILE"

python3 - "$INVENTORY_FILE" "$REVOKE_SQL" "$RESTORE_SQL" <<'PY_VALIDATE_AND_SQL'
import json,sys
inventory_path,revoke_path,restore_path=sys.argv[1:]
value=json.load(open(inventory_path,encoding='utf-8'))
role=value.get('roleBoundary') or {}
expected={
 'canLogin':True,'superuser':False,'createdb':False,'createrole':False,
 'inherit':False,'replication':False,'bypassRls':False,'connectionLimit':20,
 'membershipCount':0,'memberGrantCount':0,'activeSessionCount':0,
 'ownedRelationCount':0,'ownedSchemaCount':0,'ownedFunctionCount':0,
 'ownedTypeCount':0,'ownedDatabaseCount':0,'ownedDefaultAclCount':0,
}
for key,expected_value in expected.items():
    if role.get(key)!=expected_value: raise SystemExit(f'role boundary mismatch: {key}')
relations=value.get('relations') or []
if value.get('effectiveRelationCount')!=2 or len(relations)!=2:
    raise SystemExit('exactly two effective non-TAI relations are required')
allowed={'SELECT','REFERENCES'}
def ident(item): return '"'+str(item).replace('"','""')+'"'
revoke=['BEGIN;']; restore=['BEGIN;']
for relation in relations:
    if relation.get('schema')!='public' or str(relation.get('name','')).startswith('tai_'):
        raise SystemExit('relation scope invalid')
    if relation.get('directRoleAclCount')!=0 or relation.get('directRoleColumnAclCount')!=0:
        raise SystemExit('direct role ACL overlaps PUBLIC repair')
    if relation.get('publicColumnAclCount')!=0:
        raise SystemExit('PUBLIC column ACL is not authorized')
    effective=set(relation.get('effectivePrivileges') or [])
    entries=relation.get('publicRelationAcl') or []
    public={entry.get('privilege') for entry in entries}
    if not effective or not effective.issubset(allowed) or public!=effective:
        raise SystemExit('effective privileges are not exactly explained by allowed PUBLIC ACLs')
    if any(entry.get('grantable') is not False for entry in entries):
        raise SystemExit('PUBLIC grant option is forbidden')
    privileges=', '.join(sorted(effective))
    target=f"{ident(relation['schema'])}.{ident(relation['name'])}"
    revoke.append(f'REVOKE {privileges} ON TABLE {target} FROM PUBLIC;')
    restore.append(f'GRANT {privileges} ON TABLE {target} TO PUBLIC;')
revoke.append('COMMIT;'); restore.append('COMMIT;')
open(revoke_path,'w',encoding='utf-8').write('\n'.join(revoke)+'\n')
open(restore_path,'w',encoding='utf-8').write('\n'.join(restore)+'\n')
PY_VALIDATE_AND_SQL
chmod 0600 "$REVOKE_SQL" "$RESTORE_SQL"

cat > "$METADATA_FILE" <<EOF
SAVED_TARGET_SHA=$TARGET_SHA
COMPOSE_PROJECT=$COMPOSE_PROJECT
DB_SERVICE=$DB_SERVICE
DB_NAME=$DB_NAME
DB_ADMIN=$DB_ADMIN
EOF
chmod 0600 "$METADATA_FILE"

MUTATION_PERFORMED=true
touch "$STATE_ROOT/MUTATION_STARTED"
psql_admin < "$REVOKE_SQL" \
  || fail_with_evidence 25 TAI_PUBLIC_ACL_REVOKE_TRANSACTION_FAILED TRANSACTION_ROLLED_BACK
remaining="$(count_effective_non_tai)"
[[ "$remaining" == 0 ]] \
  || fail_with_evidence 26 TAI_PUBLIC_ACL_REVOKE_POSTCONDITION_FAILED POSTCONDITION_FAILED
rm -f "$STATE_ROOT/MUTATION_STARTED"
touch "$STATE_ROOT/APPLIED"
write_evidence APPLIED_PENDING_ACCEPTANCE false ''
echo 'TAI_PUBLIC_NON_TAI_ACL_APPLY=PASS'
