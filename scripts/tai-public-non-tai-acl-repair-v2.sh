#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ACTION="${1:-}"
TARGET_SHA="${2:-}"
RUN_ID="${3:-}"
OUTPUT_FILE="${4:-}"

[[ "$ACTION" =~ ^(apply|rollback|finalize)$ ]] || { echo INVALID_ACTION >&2; exit 2; }
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo INVALID_TARGET_SHA >&2; exit 2; }
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || { echo INVALID_RUN_ID >&2; exit 2; }
[[ "$OUTPUT_FILE" == "/var/lib/pc-release-authority/runner-output/${RUN_ID}/public-non-tai-acl-repair-v2.json" ]] || { echo INVALID_OUTPUT_PATH >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo ROOT_AUTHORITY_REQUIRED >&2; exit 2; }

readonly ROLE_NAME='tai_runtime'
readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'
readonly STATE_ROOT="/var/lib/pc-release-authority/tai-public-acl-v2-${RUN_ID}"
readonly OUTPUT_DIR="${OUTPUT_FILE%/*}"
readonly INVENTORY_FILE="$STATE_ROOT/inventory.json"
readonly REVOKE_SQL="$STATE_ROOT/revoke.sql"
readonly RESTORE_SQL="$STATE_ROOT/restore.sql"
readonly METADATA_FILE="$STATE_ROOT/metadata.env"

install -d -m 0700 -o root -g root "$OUTPUT_DIR"
COMPOSE_PROJECT=''
DB_SERVICE=''
DB_NAME=''
DB_ADMIN=''
DB_ID=''
MUTATION_PERFORMED=false
ROLLBACK_PERFORMED=false

write_evidence() {
  local status="$1" passed="$2" error_code="$3"
  local inventory='{}'
  [[ ! -s "$INVENTORY_FILE" ]] || inventory="$(cat "$INVENTORY_FILE")"
  python3 - "$OUTPUT_FILE" "$TARGET_SHA" "$RUN_ID" "$status" "$passed" "$error_code" \
    "$MUTATION_PERFORMED" "$ROLLBACK_PERFORMED" "$COMPOSE_PROJECT" "$DB_SERVICE" "$DB_NAME" "$inventory" <<'PY'
import json,os,sys
path,sha,run_id,status,passed,error,mutation,rollback,project,service,database,inventory=sys.argv[1:]
report={
 'schemaVersion':'tai.public-non-tai-acl-repair.v2','targetSha':sha,'runId':run_id,
 'hosting':'REG_RU_VPS_ONLY','newRecurringCostRub':0,'status':status,
 'errorCode':error or None,'role':'tai_runtime','composeProject':project or None,
 'databaseService':service or None,'databaseName':database or None,
 'inventory':json.loads(inventory),'mutationPerformed':mutation=='true',
 'rollbackPrepared':True,'rollbackPerformed':rollback=='true',
 'dropOwnedUsed':False,'reassignOwnedUsed':False,'dropRoleUsed':False,
 'applicationDeploymentPerformed':False,'modelMutationPerformed':False,
 'passed':passed=='true'}
with open(path,'w',encoding='utf-8') as h:
 json.dump(report,h,sort_keys=True,separators=(',',':')); h.write('\n')
os.chmod(path,0o600)
PY
}

fail_evidence() {
  local rc="$1" code="$2" status="${3:-FAILED_NO_MUTATION}"
  write_evidence "$status" false "$code"
  echo "$code" >&2
  exit "$rc"
}

psql_admin() {
  docker exec -i "$DB_ID" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME" "$@"
}

resolve_authority() {
  mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  exact_web=()
  for id in "${web_ids[@]}"; do
    [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)" == "$TARGET_SHA" ]] && exact_web+=("$id")
  done
  (( ${#exact_web[@]} == 1 )) || return 10
  local web_id="${exact_web[0]}" prod_dir override api_id database_url
  COMPOSE_PROJECT="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
  prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
  [[ "$COMPOSE_PROJECT" =~ ^[A-Za-z0-9._-]+$ && -d "$prod_dir" ]] || return 11
  override="$prod_dir/compose.tai-agro-os.override.yml"
  [[ ! -e "$ENV_FILE" && ! -L "$ENV_FILE" && ! -e "$override" && ! -L "$override" ]] || return 12
  mapfile -t tai_ids < <(docker ps -aq --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" --filter 'label=com.docker.compose.service=tai')
  (( ${#tai_ids[@]} == 0 )) || return 13
  mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" --filter 'label=com.docker.compose.service=api')
  (( ${#api_ids[@]} == 1 )) || return 14
  api_id="${api_ids[0]}"
  [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")" == "$TARGET_SHA" ]] || return 15
  database_url="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api_id" | sed -n 's/^DATABASE_URL=//p' | head -1)"
  readarray -t authority < <(python3 - "$database_url" <<'PY'
import re,sys
from urllib.parse import parse_qsl,unquote,urlsplit
v=sys.argv[1]
if not v or v!=v.strip() or re.search(r'[\x00-\x20\x7f]',v): raise SystemExit(2)
p=urlsplit(v)
if p.scheme not in {'postgres','postgresql'} or not p.hostname: raise SystemExit(3)
keys=[k.strip().lower() for k,_ in parse_qsl(p.query,keep_blank_values=True,strict_parsing=True,max_num_fields=32)]
if len(keys)!=len(set(keys)) or {'database','dbname','host','hostaddr','port','service','socket','unix_socket'}.intersection(keys): raise SystemExit(4)
name=unquote(p.path[1:]) if p.path.startswith('/') else ''
if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,62}',name): raise SystemExit(5)
print(p.hostname); print(name)
PY
) || return 16
  (( ${#authority[@]} == 2 )) || return 16
  DB_SERVICE="${authority[0]}"; DB_NAME="${authority[1]}"
  mapfile -t db_ids < <(docker ps -q --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" --filter "label=com.docker.compose.service=$DB_SERVICE")
  (( ${#db_ids[@]} == 1 )) || return 17
  DB_ID="${db_ids[0]}"
  [[ "$DB_ID" =~ ^[0-9a-f]{12,64}$ && "$(docker inspect --format '{{.State.Status}}' "$DB_ID")" == running ]] || return 18
  local image repository postgres_db postgres_user pgdata durable=0
  image="$(docker inspect --format '{{.Config.Image}}' "$DB_ID")"
  repository="${image%%@*}"; repository="${repository##*/}"; repository="${repository%%:*}"
  [[ "$repository" == postgres || "$repository" == postgresql ]] || return 19
  postgres_db="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$DB_ID" | sed -n 's/^POSTGRES_DB=//p' | head -1)"
  postgres_user="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$DB_ID" | sed -n 's/^POSTGRES_USER=//p' | head -1)"
  pgdata="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$DB_ID" | sed -n 's/^PGDATA=//p' | head -1)"; [[ -n "$pgdata" ]] || pgdata='/var/lib/postgresql/data'
  [[ "$postgres_db" == "$DB_NAME" && "$postgres_user" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]] || return 20
  DB_ADMIN="$postgres_user"
  while IFS=$'\t' read -r type destination source; do
    [[ "$type" == volume || "$type" == bind ]] || continue
    [[ -n "$source" ]] || continue
    [[ "$pgdata" == "$destination" || "$pgdata" == "$destination"/* ]] && durable=1
  done < <(docker inspect --format '{{range .Mounts}}{{printf "%s\t%s\t%s\n" .Type .Destination .Source}}{{end}}' "$DB_ID")
  (( durable == 1 )) || return 21
  local admin
  admin="$(psql_admin -AtF $'\t' -c "SELECT rolsuper,rolcreaterole FROM pg_catalog.pg_roles WHERE rolname='${DB_ADMIN}';")"
  [[ "$(printf '%s\n' "$admin" | grep -c .)" == 1 ]] || return 22
  IFS=$'\t' read -r super createrole <<< "$admin"
  [[ "$super" == t || "$createrole" == t ]] || return 23
}

load_metadata() {
  [[ -s "$METADATA_FILE" && ! -L "$METADATA_FILE" ]] || return 1
  source "$METADATA_FILE"
  [[ "$SAVED_TARGET_SHA" == "$TARGET_SHA" ]]
  resolve_authority
  [[ "$COMPOSE_PROJECT" == "$SAVED_COMPOSE_PROJECT" && "$DB_SERVICE" == "$SAVED_DB_SERVICE" && "$DB_NAME" == "$SAVED_DB_NAME" ]]
}

explicit_public_acl_count() {
  psql_admin -Atc "
    WITH relations AS (
      SELECT c.oid,c.relacl
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname NOT LIKE 'tai\\_%' ESCAPE '\\' AND c.relkind IN ('r','v','m','p','f')
    )
    SELECT
      (SELECT COUNT(*) FROM relations r WHERE EXISTS (SELECT 1 FROM aclexplode(r.relacl) x WHERE x.grantee=0))
      +
      (SELECT COUNT(*) FROM pg_catalog.pg_attribute a JOIN relations r ON r.oid=a.attrelid
       WHERE a.attnum>0 AND NOT a.attisdropped AND EXISTS (SELECT 1 FROM aclexplode(a.attacl) x WHERE x.grantee=0));"
}

effective_non_tai_count() {
  psql_admin -Atc "
    SELECT COUNT(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname NOT LIKE 'tai\\_%' ESCAPE '\\' AND c.relkind IN ('r','v','m','p','f')
      AND EXISTS (SELECT 1 FROM (VALUES
        (has_table_privilege('${ROLE_NAME}',format('%I.%I',n.nspname,c.relname),'SELECT')),
        (has_table_privilege('${ROLE_NAME}',format('%I.%I',n.nspname,c.relname),'INSERT')),
        (has_table_privilege('${ROLE_NAME}',format('%I.%I',n.nspname,c.relname),'UPDATE')),
        (has_table_privilege('${ROLE_NAME}',format('%I.%I',n.nspname,c.relname),'DELETE')),
        (has_table_privilege('${ROLE_NAME}',format('%I.%I',n.nspname,c.relname),'TRUNCATE')),
        (has_table_privilege('${ROLE_NAME}',format('%I.%I',n.nspname,c.relname),'REFERENCES')),
        (has_table_privilege('${ROLE_NAME}',format('%I.%I',n.nspname,c.relname),'TRIGGER'))
      ) v(allowed) WHERE v.allowed);"
}

if [[ "$ACTION" == rollback ]]; then
  load_metadata || fail_evidence 40 TAI_PUBLIC_ACL_V2_ROLLBACK_AUTHORITY_INVALID ROLLBACK_FAILED
  [[ -f "$STATE_ROOT/APPLIED" && ! -f "$STATE_ROOT/FINALIZED" && -s "$RESTORE_SQL" ]] || fail_evidence 41 TAI_PUBLIC_ACL_V2_ROLLBACK_STATE_INVALID ROLLBACK_FAILED
  psql_admin < "$RESTORE_SQL" >/dev/null || fail_evidence 42 TAI_PUBLIC_ACL_V2_ROLLBACK_TRANSACTION_FAILED ROLLBACK_FAILED
  [[ "$(effective_non_tai_count)" == 2 ]] || fail_evidence 43 TAI_PUBLIC_ACL_V2_ROLLBACK_POSTCONDITION_FAILED ROLLBACK_FAILED
  ROLLBACK_PERFORMED=true; touch "$STATE_ROOT/ROLLED_BACK"
  write_evidence ROLLED_BACK false TAI_PUBLIC_ACL_V2_ACCEPTANCE_FAILED
  echo TAI_PUBLIC_NON_TAI_ACL_V2_ROLLBACK=PASS
  exit 0
fi

if [[ "$ACTION" == finalize ]]; then
  load_metadata || fail_evidence 50 TAI_PUBLIC_ACL_V2_FINALIZE_AUTHORITY_INVALID FINALIZE_FAILED
  [[ -f "$STATE_ROOT/APPLIED" && ! -f "$STATE_ROOT/ROLLED_BACK" ]] || fail_evidence 51 TAI_PUBLIC_ACL_V2_FINALIZE_STATE_INVALID FINALIZE_FAILED
  [[ "$(explicit_public_acl_count)" == 0 && "$(effective_non_tai_count)" == 0 ]] || fail_evidence 52 TAI_PUBLIC_ACL_V2_FINALIZE_POSTCONDITION_FAILED FINALIZE_FAILED
  MUTATION_PERFORMED=true; touch "$STATE_ROOT/FINALIZED"
  write_evidence ACCEPTED true ''
  echo TAI_PUBLIC_NON_TAI_ACL_V2_FINALIZE=PASS
  exit 0
fi

[[ ! -e "$STATE_ROOT" && ! -L "$STATE_ROOT" ]] || fail_evidence 10 TAI_PUBLIC_ACL_V2_STATE_EXISTS BLOCKED_AUTHORITY
install -d -m 0700 -o root -g root "$STATE_ROOT"
resolve_authority || fail_evidence 11 TAI_PUBLIC_ACL_V2_AUTHORITY_INVALID BLOCKED_AUTHORITY

role_boundary="$(psql_admin -AtF $'\t' <<SQL
WITH r AS (SELECT oid,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls,rolconnlimit FROM pg_roles WHERE rolname='${ROLE_NAME}')
SELECT r.rolcanlogin,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolinherit,r.rolreplication,r.rolbypassrls,r.rolconnlimit,
 (SELECT COUNT(*) FROM pg_auth_members WHERE member=r.oid),(SELECT COUNT(*) FROM pg_auth_members WHERE roleid=r.oid),
 (SELECT COUNT(*) FROM pg_stat_activity WHERE usename='${ROLE_NAME}'),
 (SELECT COUNT(*) FROM pg_class WHERE relowner=r.oid),(SELECT COUNT(*) FROM pg_namespace WHERE nspowner=r.oid),
 (SELECT COUNT(*) FROM pg_proc WHERE proowner=r.oid),(SELECT COUNT(*) FROM pg_type WHERE typowner=r.oid),
 (SELECT COUNT(*) FROM pg_database WHERE datdba=r.oid),
 (SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname NOT LIKE 'tai\\_%' ESCAPE '\\' AND c.relkind IN ('r','v','m','p','f') AND EXISTS (SELECT 1 FROM aclexplode(c.relacl) x WHERE x.grantee=r.oid)),
 (SELECT COUNT(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname NOT LIKE 'tai\\_%' ESCAPE '\\' AND a.attnum>0 AND NOT a.attisdropped AND EXISTS (SELECT 1 FROM aclexplode(a.attacl) x WHERE x.grantee=r.oid))
FROM r;
SQL
)"
[[ "$(printf '%s\n' "$role_boundary" | grep -c .)" == 1 ]] || fail_evidence 12 TAI_PUBLIC_ACL_V2_ROLE_MISSING BLOCKED_ORPHAN_BOUNDARY
IFS=$'\t' read -r canlogin super createdb createrole inherit replication bypass connlimit memberships grants sessions owned_rel owned_schema owned_proc owned_type owned_db direct_rel direct_col <<< "$role_boundary"
[[ "$canlogin" == t && "$super" == f && "$createdb" == f && "$createrole" == f && "$inherit" == f && "$replication" == f && "$bypass" == f && "$connlimit" == 20 ]] || fail_evidence 13 TAI_PUBLIC_ACL_V2_ROLE_ATTRIBUTES_INVALID BLOCKED_BOUNDARY
[[ "$memberships" == 0 && "$grants" == 0 && "$sessions" == 0 && "$owned_rel" == 0 && "$owned_schema" == 0 && "$owned_proc" == 0 && "$owned_type" == 0 && "$owned_db" == 0 && "$direct_rel" == 0 && "$direct_col" == 0 ]] || fail_evidence 14 TAI_PUBLIC_ACL_V2_ROLE_BOUNDARY_INVALID BLOCKED_BOUNDARY

psql_admin -Atc "
WITH relations AS (
 SELECT n.nspname,c.relname,c.oid,c.relkind,c.relacl
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname NOT LIKE 'tai\\_%' ESCAPE '\\' AND c.relkind IN ('r','v','m','p','f')
), inventory AS (
 SELECT r.oid,r.nspname,r.relname,r.relkind,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('grantorOid',x.grantor::bigint,'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.privilege_type,x.grantor) FROM aclexplode(r.relacl) x WHERE x.grantee=0),'[]'::jsonb) relation_grants,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('columnOrdinal',a.attnum,'grantorOid',x.grantor::bigint,'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY a.attnum,x.privilege_type,x.grantor) FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped AND x.grantee=0),'[]'::jsonb) column_grants,
  ARRAY(SELECT p.privilege FROM (VALUES
   ('SELECT',has_table_privilege('${ROLE_NAME}',format('%I.%I',r.nspname,r.relname),'SELECT')),
   ('INSERT',has_table_privilege('${ROLE_NAME}',format('%I.%I',r.nspname,r.relname),'INSERT')),
   ('UPDATE',has_table_privilege('${ROLE_NAME}',format('%I.%I',r.nspname,r.relname),'UPDATE')),
   ('DELETE',has_table_privilege('${ROLE_NAME}',format('%I.%I',r.nspname,r.relname),'DELETE')),
   ('TRUNCATE',has_table_privilege('${ROLE_NAME}',format('%I.%I',r.nspname,r.relname),'TRUNCATE')),
   ('REFERENCES',has_table_privilege('${ROLE_NAME}',format('%I.%I',r.nspname,r.relname),'REFERENCES')),
   ('TRIGGER',has_table_privilege('${ROLE_NAME}',format('%I.%I',r.nspname,r.relname),'TRIGGER'))
  ) p(privilege,allowed) WHERE p.allowed)::text[] effective
 FROM relations r
)
SELECT jsonb_build_object('schemaVersion','tai.public-non-tai-acl-inventory.v2','relations',COALESCE(jsonb_agg(jsonb_build_object('relationOid',oid::bigint,'relationKind',relkind,'publicRelationGrants',relation_grants,'publicColumnGrants',column_grants,'effectivePrivileges',effective) ORDER BY oid) FILTER (WHERE COALESCE(array_length(effective,1),0)>0),'[]'::jsonb)) FROM inventory;" > "$INVENTORY_FILE" || fail_evidence 15 TAI_PUBLIC_ACL_V2_INVENTORY_QUERY_FAILED FAILED_NO_MUTATION
chmod 0600 "$INVENTORY_FILE"
python3 - "$INVENTORY_FILE" <<'PY' || fail_evidence 16 TAI_PUBLIC_ACL_V2_INVENTORY_BOUNDARY_INVALID BLOCKED_BOUNDARY
import json,sys
v=json.load(open(sys.argv[1],encoding='utf-8')); rows=v.get('relations') or []
if v.get('schemaVersion')!='tai.public-non-tai-acl-inventory.v2' or len(rows)!=2: raise SystemExit(2)
allowed={'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'}
for row in rows:
 if not isinstance(row.get('relationOid'),int) or row['relationOid']<=0: raise SystemExit(3)
 if not row.get('effectivePrivileges') or not set(row['effectivePrivileges']).issubset(allowed): raise SystemExit(4)
 if not (row.get('publicRelationGrants') or row.get('publicColumnGrants')): raise SystemExit(5)
PY

{
 echo BEGIN\;
 psql_admin -Atc "SELECT format('REVOKE %s ON TABLE %I.%I FROM PUBLIC;',string_agg(DISTINCT x.privilege_type,', ' ORDER BY x.privilege_type),n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(c.relacl) x WHERE n.nspname='public' AND c.relname NOT LIKE 'tai\\_%' ESCAPE '\\' AND c.relkind IN ('r','v','m','p','f') AND x.grantee=0 GROUP BY n.nspname,c.relname ORDER BY n.nspname,c.relname;"
 psql_admin -Atc "SELECT format('REVOKE %s (%I) ON TABLE %I.%I FROM PUBLIC;',string_agg(DISTINCT x.privilege_type,', ' ORDER BY x.privilege_type),a.attname,n.nspname,c.relname) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(a.attacl) x WHERE n.nspname='public' AND c.relname NOT LIKE 'tai\\_%' ESCAPE '\\' AND c.relkind IN ('r','v','m','p','f') AND a.attnum>0 AND NOT a.attisdropped AND x.grantee=0 GROUP BY n.nspname,c.relname,a.attnum,a.attname ORDER BY n.nspname,c.relname,a.attnum;"
 echo COMMIT\;
} > "$REVOKE_SQL"
{
 echo BEGIN\;
 psql_admin -Atc "SELECT format('GRANT %s ON TABLE %I.%I TO PUBLIC%s;',x.privilege_type,n.nspname,c.relname,CASE WHEN x.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(c.relacl) x WHERE n.nspname='public' AND c.relname NOT LIKE 'tai\\_%' ESCAPE '\\' AND c.relkind IN ('r','v','m','p','f') AND x.grantee=0 ORDER BY c.oid,x.privilege_type;"
 psql_admin -Atc "SELECT format('GRANT %s (%I) ON TABLE %I.%I TO PUBLIC%s;',x.privilege_type,a.attname,n.nspname,c.relname,CASE WHEN x.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(a.attacl) x WHERE n.nspname='public' AND c.relname NOT LIKE 'tai\\_%' ESCAPE '\\' AND c.relkind IN ('r','v','m','p','f') AND a.attnum>0 AND NOT a.attisdropped AND x.grantee=0 ORDER BY c.oid,a.attnum,x.privilege_type;"
 echo COMMIT\;
} > "$RESTORE_SQL"
chmod 0600 "$REVOKE_SQL" "$RESTORE_SQL"
[[ "$(grep -c '^REVOKE ' "$REVOKE_SQL")" -ge 1 && "$(grep -c '^GRANT ' "$RESTORE_SQL")" -ge 1 ]] || fail_evidence 17 TAI_PUBLIC_ACL_V2_SQL_EMPTY BLOCKED_BOUNDARY
cat > "$METADATA_FILE" <<EOF_META
SAVED_TARGET_SHA=$TARGET_SHA
SAVED_COMPOSE_PROJECT=$COMPOSE_PROJECT
SAVED_DB_SERVICE=$DB_SERVICE
SAVED_DB_NAME=$DB_NAME
EOF_META
chmod 0600 "$METADATA_FILE"
psql_admin < "$REVOKE_SQL" >/dev/null || fail_evidence 18 TAI_PUBLIC_ACL_V2_REVOKE_TRANSACTION_FAILED FAILED_TRANSACTION_ROLLED_BACK
MUTATION_PERFORMED=true
touch "$STATE_ROOT/APPLIED"
[[ "$(explicit_public_acl_count)" == 0 && "$(effective_non_tai_count)" == 0 ]] || fail_evidence 19 TAI_PUBLIC_ACL_V2_APPLY_POSTCONDITION_FAILED FAILED_POSTCONDITION
write_evidence APPLIED_PENDING_ACCEPTANCE true ''
echo TAI_PUBLIC_NON_TAI_ACL_V2_APPLY=PASS
