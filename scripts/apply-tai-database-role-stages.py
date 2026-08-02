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
  # CREATE ROLE is isolated from every grant. Once it succeeds, every later
  # failure deterministically reaches DROP OWNED / DROP ROLE rollback.
  ROLE_CREATED=1

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_CONNECT_GRANT_FAILED
  psql_admin -c "GRANT CONNECT ON DATABASE ${DB_NAME} TO ${ROLE_NAME};"

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_SCHEMA_GRANT_FAILED
  psql_admin -c "GRANT USAGE ON SCHEMA public TO ${ROLE_NAME};"

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_RELATION_GRANTS_FAILED
  psql_admin <<SQL
SELECT format(
  'GRANT %s ON TABLE %I.%I TO %I;',
  CASE
    WHEN relation.relkind IN ('v','m') THEN 'SELECT'
    ELSE 'SELECT, INSERT, UPDATE, DELETE'
  END,
  namespace.nspname,
  relation.relname,
  '${ROLE_NAME}'
)
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname LIKE 'tai\\_%' ESCAPE '\\'
  AND relation.relkind IN ('r','v','m','p','f')
ORDER BY relation.relname
\gexec
SQL

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_SEQUENCE_GRANTS_FAILED
  psql_admin <<SQL
SELECT format(
  'GRANT USAGE, SELECT, UPDATE ON SEQUENCE %I.%I TO %I;',
  namespace.nspname,
  relation.relname,
  '${ROLE_NAME}'
)
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname LIKE 'tai\\_%' ESCAPE '\\'
  AND relation.relkind = 'S'
ORDER BY relation.relname
\gexec
SQL

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_ROLE_ATTESTATION_FAILED
  created_role_boundary="$(psql_admin -AtF $'\t' <<SQL
WITH role_row AS (
  SELECT oid, rolsuper, rolcreatedb, rolcreaterole, rolinherit,
         rolreplication, rolbypassrls, rolconnlimit
  FROM pg_catalog.pg_roles
  WHERE rolname = '${ROLE_NAME}'
), non_tai AS (
  SELECT COUNT(*)::int AS count
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
    AND relation.relkind IN ('r','v','m','p','f')
    AND has_table_privilege('${ROLE_NAME}', format('%I.%I', namespace.nspname, relation.relname),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
), missing_relations AS (
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
SELECT role_row.rolsuper, role_row.rolcreatedb, role_row.rolcreaterole,
       role_row.rolinherit, role_row.rolreplication, role_row.rolbypassrls,
       role_row.rolconnlimit,
       (SELECT COUNT(*) FROM pg_catalog.pg_auth_members WHERE member = role_row.oid),
       non_tai.count, missing_relations.count, missing_sequences.count
FROM role_row, non_tai, missing_relations, missing_sequences;
SQL
)"
  IFS=$'\t' read -r created_super created_db created_createrole created_inherit created_replication created_bypass created_connlimit created_memberships created_non_tai created_missing_relations created_missing_sequences <<< "$created_role_boundary"
  [[ "$created_super" == f && "$created_db" == f && "$created_createrole" == f ]]
  [[ "$created_inherit" == f && "$created_replication" == f && "$created_bypass" == f ]]
  [[ "$created_connlimit" == 20 && "$created_memberships" == 0 ]]
  [[ "$created_missing_relations" == 0 && "$created_missing_sequences" == 0 ]]
  if [[ "$created_non_tai" != 0 ]]; then
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
  'TAI_DEPLOY_DATABASE_SEQUENCE_GRANTS_FAILED',
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

plpgsql_start_marker = "requireFragment(\n  deploy,\n  'END;\\n\\\\$grant\\\\$;',\n"
plpgsql_end_marker = "\n\nfor (const fragment of [\n  \"set -Eeuo pipefail\",\n"
plpgsql_start = checker.find(plpgsql_start_marker)
plpgsql_end = checker.find(plpgsql_end_marker, plpgsql_start)
if plpgsql_start < 0 or plpgsql_end < 0:
    raise SystemExit("legacy PL/pgSQL grant contract not found")
psql_contract = """requireFragment(
  deploy,
  '\\n\\\\gexec\\n',
  deployPath + ': generated least-privilege grants must execute through psql gexec',
);
forbid(
  deploy,
  /DO\\s+\\\\[$]grant\\\\[$]/u,
  deployPath + ': opaque PL/pgSQL grant loop is forbidden',
);
"""
checker = checker[:plpgsql_start] + psql_contract + checker[plpgsql_end:]

ordering_anchor = "const mutationCalls = [\n"
ordering_check = """const roleCreateMarker = deploy.indexOf('\\nCREATE ROLE ${ROLE_NAME}\\n');
const roleCreatedMarker = deploy.indexOf('\\n  ROLE_CREATED=1\\n', roleCreateMarker);
const firstRoleGrantMarker = deploy.indexOf('TAI_DEPLOY_DATABASE_CONNECT_GRANT_FAILED', roleCreateMarker);
if (
  roleCreateMarker < 0 ||
  roleCreatedMarker < 0 ||
  firstRoleGrantMarker < 0 ||
  roleCreatedMarker <= roleCreateMarker ||
  roleCreatedMarker >= firstRoleGrantMarker
) {
  violations.push(deployPath + ': rollback ownership must be armed immediately after CREATE ROLE and before grants');
}

""" + ordering_anchor
if ordering_anchor not in checker:
    raise SystemExit("checker ordering anchor not found")
checker = checker.replace(ordering_anchor, ordering_check, 1)

DEPLOY.write_text(deploy, encoding="utf-8")
CHECKER.write_text(checker, encoding="utf-8")
