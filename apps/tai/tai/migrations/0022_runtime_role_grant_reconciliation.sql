BEGIN;

DO $tai_runtime_grants$
DECLARE
    role_row RECORD;
    relation_row RECORD;
    membership_count INTEGER;
    non_tai_grant_count INTEGER;
    missing_relation_count INTEGER;
    missing_sequence_count INTEGER;
BEGIN
    SELECT rolsuper, rolcreatedb, rolcreaterole, rolinherit,
           rolreplication, rolbypassrls, rolconnlimit
    INTO role_row
    FROM pg_catalog.pg_roles
    WHERE rolname = 'tai_runtime';

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF role_row.rolsuper
       OR role_row.rolcreatedb
       OR role_row.rolcreaterole
       OR role_row.rolinherit
       OR role_row.rolreplication
       OR role_row.rolbypassrls
       OR role_row.rolconnlimit <> 20 THEN
        RAISE EXCEPTION 'tai_runtime role attributes violate the least-privilege boundary';
    END IF;

    SELECT COUNT(*)::INTEGER
    INTO membership_count
    FROM pg_catalog.pg_auth_members
    WHERE member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'tai_runtime');

    IF membership_count <> 0 THEN
        RAISE EXCEPTION 'tai_runtime role membership boundary is not empty';
    END IF;

    SELECT COUNT(*)::INTEGER
    INTO non_tai_grant_count
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname NOT LIKE 'tai\_%' ESCAPE '\'
      AND relation.relkind IN ('r', 'v', 'm', 'p', 'f')
      AND has_table_privilege(
          'tai_runtime',
          format('%I.%I', namespace.nspname, relation.relname),
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
      );

    IF non_tai_grant_count <> 0 THEN
        RAISE EXCEPTION 'tai_runtime has a forbidden non-TAI relation grant';
    END IF;

    EXECUTE format(
        'GRANT CONNECT ON DATABASE %I TO %I',
        current_database(),
        'tai_runtime'
    );
    GRANT USAGE ON SCHEMA public TO tai_runtime;

    FOR relation_row IN
        SELECT namespace.nspname, relation.relname, relation.relkind
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname LIKE 'tai\_%' ESCAPE '\'
          AND relation.relkind IN ('r', 'v', 'm', 'p', 'f')
        ORDER BY relation.relname
    LOOP
        IF relation_row.relkind IN ('v', 'm') THEN
            EXECUTE format(
                'GRANT SELECT ON TABLE %I.%I TO %I',
                relation_row.nspname,
                relation_row.relname,
                'tai_runtime'
            );
        ELSE
            EXECUTE format(
                'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO %I',
                relation_row.nspname,
                relation_row.relname,
                'tai_runtime'
            );
        END IF;
    END LOOP;

    FOR relation_row IN
        SELECT namespace.nspname, relation.relname
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname LIKE 'tai\_%' ESCAPE '\'
          AND relation.relkind = 'S'
        ORDER BY relation.relname
    LOOP
        EXECUTE format(
            'GRANT USAGE, SELECT, UPDATE ON SEQUENCE %I.%I TO %I',
            relation_row.nspname,
            relation_row.relname,
            'tai_runtime'
        );
    END LOOP;

    IF NOT has_database_privilege('tai_runtime', current_database(), 'CONNECT') THEN
        RAISE EXCEPTION 'tai_runtime database CONNECT grant reconciliation failed';
    END IF;
    IF NOT has_schema_privilege('tai_runtime', 'public', 'USAGE') THEN
        RAISE EXCEPTION 'tai_runtime public schema USAGE grant reconciliation failed';
    END IF;

    SELECT COUNT(*)::INTEGER
    INTO missing_relation_count
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname LIKE 'tai\_%' ESCAPE '\'
      AND relation.relkind IN ('r', 'v', 'm', 'p', 'f')
      AND NOT (
          has_table_privilege(
              'tai_runtime',
              format('%I.%I', namespace.nspname, relation.relname),
              'SELECT'
          )
          AND (
              relation.relkind IN ('v', 'm')
              OR (
                  has_table_privilege(
                      'tai_runtime',
                      format('%I.%I', namespace.nspname, relation.relname),
                      'INSERT'
                  )
                  AND has_table_privilege(
                      'tai_runtime',
                      format('%I.%I', namespace.nspname, relation.relname),
                      'UPDATE'
                  )
                  AND has_table_privilege(
                      'tai_runtime',
                      format('%I.%I', namespace.nspname, relation.relname),
                      'DELETE'
                  )
              )
          )
      );

    SELECT COUNT(*)::INTEGER
    INTO missing_sequence_count
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname LIKE 'tai\_%' ESCAPE '\'
      AND relation.relkind = 'S'
      AND NOT (
          has_sequence_privilege(
              'tai_runtime',
              format('%I.%I', namespace.nspname, relation.relname),
              'USAGE'
          )
          AND has_sequence_privilege(
              'tai_runtime',
              format('%I.%I', namespace.nspname, relation.relname),
              'SELECT'
          )
          AND has_sequence_privilege(
              'tai_runtime',
              format('%I.%I', namespace.nspname, relation.relname),
              'UPDATE'
          )
      );

    IF missing_relation_count <> 0 OR missing_sequence_count <> 0 THEN
        RAISE EXCEPTION 'tai_runtime grant reconciliation is incomplete';
    END IF;
END;
$tai_runtime_grants$;

COMMIT;
