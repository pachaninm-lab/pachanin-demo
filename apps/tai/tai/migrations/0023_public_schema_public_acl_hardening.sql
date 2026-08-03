BEGIN;

-- A dedicated TAI runtime role must not inherit effective access to non-TAI
-- relations through PostgreSQL's pseudo-role PUBLIC.  The existing production
-- database contained two such effective grants.  They were not role-specific,
-- so revoking ACLs from tai_runtime could not remove them and the exact-main
-- deployment correctly failed closed.
--
-- This migration removes only PUBLIC ACL entries on non-TAI relations in the
-- public schema.  It does not modify object ownership, application-role ACLs,
-- tenant data, functions, policies, schemas, or any TAI relation.

DO $tai_public_schema_acl_hardening$
DECLARE
    relation_row RECORD;
    column_row RECORD;
BEGIN
    FOR relation_row IN
        SELECT namespace.nspname, relation.relname, relation.relkind
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname NOT LIKE 'tai\_%' ESCAPE '\'
          AND relation.relkind IN ('r', 'v', 'm', 'p', 'f', 'S')
          AND EXISTS (
              SELECT 1
              FROM aclexplode(relation.relacl) AS acl
              WHERE acl.grantee = 0
          )
        ORDER BY relation.relkind, relation.relname
    LOOP
        IF relation_row.relkind = 'S' THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM PUBLIC',
                relation_row.nspname,
                relation_row.relname
            );
        ELSE
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM PUBLIC',
                relation_row.nspname,
                relation_row.relname
            );
        END IF;
    END LOOP;

    -- Table-level REVOKE does not necessarily remove historical column ACLs.
    -- Revoke only the exact PUBLIC column privileges that are present.
    FOR column_row IN
        SELECT
            namespace.nspname,
            relation.relname,
            attribute.attname,
            string_agg(DISTINCT acl.privilege_type, ', ' ORDER BY acl.privilege_type) AS privileges
        FROM pg_catalog.pg_attribute AS attribute
        JOIN pg_catalog.pg_class AS relation
          ON relation.oid = attribute.attrelid
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        CROSS JOIN LATERAL aclexplode(attribute.attacl) AS acl
        WHERE namespace.nspname = 'public'
          AND relation.relname NOT LIKE 'tai\_%' ESCAPE '\'
          AND relation.relkind IN ('r', 'v', 'm', 'p', 'f')
          AND attribute.attnum > 0
          AND NOT attribute.attisdropped
          AND acl.grantee = 0
          AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
        GROUP BY namespace.nspname, relation.relname, attribute.attnum, attribute.attname
        ORDER BY namespace.nspname, relation.relname, attribute.attnum
    LOOP
        EXECUTE format(
            'REVOKE %s (%I) ON TABLE %I.%I FROM PUBLIC',
            column_row.privileges,
            column_row.attname,
            column_row.nspname,
            column_row.relname
        );
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname NOT LIKE 'tai\_%' ESCAPE '\'
          AND relation.relkind IN ('r', 'v', 'm', 'p', 'f', 'S')
          AND EXISTS (
              SELECT 1
              FROM aclexplode(relation.relacl) AS acl
              WHERE acl.grantee = 0
          )
    ) THEN
        RAISE EXCEPTION 'PUBLIC retains a relation ACL on a non-TAI public relation';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attribute AS attribute
        JOIN pg_catalog.pg_class AS relation
          ON relation.oid = attribute.attrelid
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname NOT LIKE 'tai\_%' ESCAPE '\'
          AND relation.relkind IN ('r', 'v', 'm', 'p', 'f')
          AND attribute.attnum > 0
          AND NOT attribute.attisdropped
          AND EXISTS (
              SELECT 1
              FROM aclexplode(attribute.attacl) AS acl
              WHERE acl.grantee = 0
          )
    ) THEN
        RAISE EXCEPTION 'PUBLIC retains a column ACL on a non-TAI public relation';
    END IF;
END;
$tai_public_schema_acl_hardening$;

COMMIT;
