#!/usr/bin/env python3
from pathlib import Path

DEPLOY = Path("scripts/tai-reg-ru-deploy.sh")
CHECKER = Path("scripts/check-tai-reg-ru-deploy.mjs")

deploy = DEPLOY.read_text(encoding="utf-8")
checker = CHECKER.read_text(encoding="utf-8")

admin_needle = '''docker exec "$DB_ID" psql --version >/dev/null

set_internal_deploy_stage TAI_DEPLOY_STATE_AUTHORITY_PREPARATION_FAILED
'''
admin_replacement = '''docker exec "$DB_ID" psql --version >/dev/null

set_internal_deploy_stage TAI_DEPLOY_DATABASE_ADMIN_AUTHORITY_FAILED
db_admin_authority="$(psql_admin -AtF $'\\t' -c "SELECT rolsuper, rolcreaterole FROM pg_catalog.pg_roles WHERE rolname = '${DB_ADMIN}';")"
[[ "$(printf '%s\\n' "$db_admin_authority" | grep -c .)" == 1 ]]
IFS=$'\\t' read -r db_admin_super db_admin_createrole <<< "$db_admin_authority"
[[ "$db_admin_super" == t || "$db_admin_createrole" == t ]]

set_internal_deploy_stage TAI_DEPLOY_STATE_AUTHORITY_PREPARATION_FAILED
'''
if admin_needle not in deploy:
    raise SystemExit("database admin authority insertion point not found")
deploy = deploy.replace(admin_needle, admin_replacement, 1)

start_marker = "set_internal_deploy_stage TAI_DEPLOY_DATABASE_ROLE_MATERIALIZATION_FAILED\n"
end_marker = "\nset_internal_deploy_stage TAI_DEPLOY_ENVIRONMENT_MATERIALIZATION_FAILED\n"
start = deploy.find(start_marker)
end = deploy.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("database role materialization block not found")

role_block = r'''if [[ "$role_exists" == 0 ]]; then
  # Mark ownership before the first CREATE ROLE attempt. Every later failure,
  # including a partially applied grant sequence, therefore reaches the same
  # deterministic DROP OWNED / DROP ROLE rollback path.
  ROLE_CREATED=1

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_ROLE_CREATE_FAILED
  psql_admin <<SQL
CREATE ROLE ${ROLE_NAME}
  LOGIN
  PASSWORD '${db_password}'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS
  CONNECTION LIMIT 20;
SQL

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_CONNECT_GRANT_FAILED
  psql_admin -c "GRANT CONNECT ON DATABASE ${DB_NAME} TO ${ROLE_NAME};"

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_SCHEMA_GRANT_FAILED
  psql_admin -c "GRANT USAGE ON SCHEMA public TO ${ROLE_NAME};"

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_RELATION_GRANTS_FAILED
  psql_admin <<SQL
DO \$grant\$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT format('%I.%I', schemaname, tablename) AS relation_name
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'tai\\_%' ESCAPE '\\'
  LOOP
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ' || item.relation_name || ' TO ${ROLE_NAME}';
  END LOOP;
  FOR item IN
    SELECT format('%I.%I', schemaname, viewname) AS relation_name
    FROM pg_catalog.pg_views
    WHERE schemaname = 'public' AND viewname LIKE 'tai\\_%' ESCAPE '\\'
  LOOP
    EXECUTE 'GRANT SELECT ON TABLE ' || item.relation_name || ' TO ${ROLE_NAME}';
  END LOOP;
  FOR item IN
    SELECT format('%I.%I', schemaname, matviewname) AS relation_name
    FROM pg_catalog.pg_matviews
    WHERE schemaname = 'public' AND matviewname LIKE 'tai\\_%' ESCAPE '\\'
  LOOP
    EXECUTE 'GRANT SELECT ON TABLE ' || item.relation_name || ' TO ${ROLE_NAME}';
  END LOOP;
  FOR item IN
    SELECT format('%I.%I', sequence_schema, sequence_name) AS relation_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public' AND sequence_name LIKE 'tai\\_%' ESCAPE '\\'
  LOOP
    EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE ' || item.relation_name || ' TO ${ROLE_NAME}';
  END LOOP;
END;
\$grant\$;
SQL

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_ROLE_ATTESTATION_FAILED
  created_role_count="$(psql_admin -Atc "SELECT COUNT(*)::int FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}';")"
  [[ "$created_role_count" == 1 ]]
  created_role_attributes="$(psql_admin -AtF $'\t' -c "SELECT rolsuper, rolcreatedb, rolcreaterole, rolinherit, rolreplication, rolbypassrls, rolconnlimit FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}';")"
  IFS=$'\t' read -r created_super created_db created_role created_inherit created_replication created_bypass created_connlimit <<< "$created_role_attributes"
  [[ "$created_super" == f && "$created_db" == f && "$created_role" == f ]]
  [[ "$created_inherit" == f && "$created_replication" == f && "$created_bypass" == f ]]
  [[ "$created_connlimit" == 20 ]]

  missing_tai_privileges="$(psql_admin -Atc "
    WITH missing_relations AS (
      SELECT COUNT(*)::int AS count
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relname LIKE 'tai\\_%' ESCAPE '\\'
        AND relation.relkind IN ('r','v','m','p','f')
        AND NOT CASE
          WHEN relation.relkind IN ('v','m') THEN
            has_table_privilege('${ROLE_NAME}', format('%I.%I', namespace.nspname, relation.relname), 'SELECT')
          ELSE
            has_table_privilege('${ROLE_NAME}', format('%I.%I', namespace.nspname, relation.relname), 'SELECT,INSERT,UPDATE,DELETE')
        END
    ), missing_sequences AS (
      SELECT COUNT(*)::int AS count
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relname LIKE 'tai\\_%' ESCAPE '\\'
        AND relation.relkind = 'S'
        AND NOT has_sequence_privilege('${ROLE_NAME}', format('%I.%I', namespace.nspname, relation.relname), 'USAGE,SELECT,UPDATE')
    )
    SELECT missing_relations.count + missing_sequences.count
    FROM missing_relations, missing_sequences;")"
  [[ "$missing_tai_privileges" == 0 ]]

  effective_non_tai="$(psql_admin -Atc "
    SELECT COUNT(*)::int
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
      AND relation.relkind IN ('r','v','m','p','f')
      AND has_table_privilege('${ROLE_NAME}', format('%I.%I', namespace.nspname, relation.relname),
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');")"
  if [[ "$effective_non_tai" != 0 ]]; then
    set_internal_deploy_stage TAI_DEPLOY_DATABASE_ROLE_NON_TAI_PRIVILEGE_FAILED
    exit 17
  fi
fi
'''

deploy = deploy[:start] + role_block + deploy[end:]

checker_anchor = "  'TAI_DEPLOY_RUNTIME_ROLE_BOUNDARY_FAILED',\n"
checker_addition = """  'TAI_DEPLOY_RUNTIME_ROLE_BOUNDARY_FAILED',
  'TAI_DEPLOY_DATABASE_ADMIN_AUTHORITY_FAILED',
  'TAI_DEPLOY_DATABASE_ROLE_CREATE_FAILED',
  'TAI_DEPLOY_DATABASE_CONNECT_GRANT_FAILED',
  'TAI_DEPLOY_DATABASE_SCHEMA_GRANT_FAILED',
  'TAI_DEPLOY_DATABASE_RELATION_GRANTS_FAILED',
  'TAI_DEPLOY_DATABASE_ROLE_ATTESTATION_FAILED',
  'TAI_DEPLOY_DATABASE_ROLE_NON_TAI_PRIVILEGE_FAILED',
"""
if checker_anchor not in checker:
    raise SystemExit("checker role authority anchor not found")
checker = checker.replace(checker_anchor, checker_addition, 1)

forbid_anchor = "forbid(deploy, /docker\\s+compose[^\\n]+\\bdown\\b/iu, deployPath + ': full Compose shutdown is forbidden');\n"
forbid_addition = forbid_anchor + "forbid(deploy, /TAI_DEPLOY_DATABASE_ROLE_MATERIALIZATION_FAILED/u, deployPath + ': ambiguous database role materialization stage is forbidden');\n"
if forbid_anchor not in checker:
    raise SystemExit("checker forbid anchor not found")
checker = checker.replace(forbid_anchor, forbid_addition, 1)

ordering_anchor = "const mutationCalls = [\n"
ordering_check = """const roleCreatedMarker = deploy.indexOf('\\n  ROLE_CREATED=1\\n', deploy.indexOf('if [[ \"$role_exists\" == 0 ]]'));
const roleCreateMarker = deploy.indexOf('\\nCREATE ROLE ${ROLE_NAME}\\n');
if (roleCreatedMarker < 0 || roleCreateMarker < 0 || roleCreatedMarker >= roleCreateMarker) {
  violations.push(deployPath + ': rollback ownership must be armed before CREATE ROLE');
}

""" + ordering_anchor
if ordering_anchor not in checker:
    raise SystemExit("checker ordering anchor not found")
checker = checker.replace(ordering_anchor, ordering_check, 1)

DEPLOY.write_text(deploy, encoding="utf-8")
CHECKER.write_text(checker, encoding="utf-8")
