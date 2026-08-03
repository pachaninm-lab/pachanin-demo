BEGIN;

DO $tai_public_relation_privilege_boundary$
DECLARE
    affected_relation_count INTEGER;
    trusted_role_count INTEGER;
    privilege_row RECORD;
    trusted_role TEXT;
BEGIN
    SELECT COUNT(DISTINCT relation.oid)::INTEGER
    INTO affected_relation_count
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
    WHERE namespace.nspname = 'public'
      AND relation.relname NOT LIKE 'tai\_%' ESCAPE '\'
      AND relation.relkind IN ('r', 'v', 'm', 'p', 'f')
      AND acl.grantee = 0
      AND acl.privilege_type IN (
          'SELECT',
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE',
          'REFERENCES',
          'TRIGGER'
      );

    IF affected_relation_count = 0 THEN
        RETURN;
    END IF;

    IF affected_relation_count <> 2 THEN
        RAISE EXCEPTION
          'unexpected PUBLIC relation privilege boundary: expected 2 relations, found %',
          affected_relation_count;
    END IF;

    SELECT COUNT(*)::INTEGER
    INTO trusted_role_count
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('app_runtime', 'app_service');

    IF trusted_role_count = 0 THEN
        RAISE EXCEPTION
          'no trusted application runtime principal exists for PUBLIC privilege replacement';
    END IF;

    FOR privilege_row IN
        SELECT DISTINCT
               namespace.nspname AS schema_name,
               relation.relname AS relation_name,
               acl.privilege_type,
               acl.is_grantable
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
        WHERE namespace.nspname = 'public'
          AND relation.relname NOT LIKE 'tai\_%' ESCAPE '\'
          AND relation.relkind IN ('r', 'v', 'm', 'p', 'f')
          AND acl.grantee = 0
          AND acl.privilege_type IN (
              'SELECT',
              'INSERT',
              'UPDATE',
              'DELETE',
              'TRUNCATE',
              'REFERENCES',
              'TRIGGER'
          )
        ORDER BY namespace.nspname, relation.relname, acl.privilege_type
    LOOP
        FOREACH trusted_role IN ARRAY ARRAY['app_runtime', 'app_service']
        LOOP
            IF EXISTS (
                SELECT 1
                FROM pg_catalog.pg_roles
                WHERE rolname = trusted_role
            ) THEN
                EXECUTE format(
                    'GRANT %s ON TABLE %I.%I TO %I%s',
                    privilege_row.privilege_type,
                    privilege_row.schema_name,
                    privilege_row.relation_name,
                    trusted_role,
                    CASE
                      WHEN privilege_row.is_grantable THEN ' WITH GRANT OPTION'
                      ELSE ''
                    END
                );
            END IF;
        END LOOP;

        EXECUTE format(
            'REVOKE %s ON TABLE %I.%I FROM PUBLIC',
            privilege_row.privilege_type,
            privilege_row.schema_name,
            privilege_row.relation_name
        );
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
        WHERE namespace.nspname = 'public'
          AND relation.relname NOT LIKE 'tai\_%' ESCAPE '\'
          AND relation.relkind IN ('r', 'v', 'm', 'p', 'f')
          AND acl.grantee = 0
          AND acl.privilege_type IN (
              'SELECT',
              'INSERT',
              'UPDATE',
              'DELETE',
              'TRUNCATE',
              'REFERENCES',
              'TRIGGER'
          )
    ) THEN
        RAISE EXCEPTION 'PUBLIC relation privilege reconciliation is incomplete';
    END IF;
END;
$tai_public_relation_privilege_boundary$;

COMMIT;
