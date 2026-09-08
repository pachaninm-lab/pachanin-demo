-- Registration decisions lock the application row before the auth-runtime CAS
-- and lock it again while the bounded identity transition validates the CAS
-- result. PostgreSQL requires UPDATE on at least one column of every relation
-- named by SELECT ... FOR UPDATE, even when the function never updates that
-- relation. Keep both row locks and grant only the immutable primary-key
-- column to the membership-free SECURITY DEFINER authority.

GRANT UPDATE (id) ON TABLE auth.registration_applications
  TO pc_registration_decision_authority;

DO $registration_decision_application_lock_privilege_proof$
DECLARE
  lock_source text;
  transition_source text;
BEGIN
  IF NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_roles role
       WHERE role.rolname = 'pc_registration_decision_authority'
         AND NOT role.rolcanlogin
         AND NOT role.rolinherit
         AND NOT role.rolsuper
         AND NOT role.rolbypassrls
         AND NOT role.rolcreatedb
         AND NOT role.rolcreaterole
         AND NOT role.rolreplication
     )
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_auth_members membership
       JOIN pg_catalog.pg_roles role
         ON role.oid = membership.roleid OR role.oid = membership.member
       WHERE role.rolname = 'pc_registration_decision_authority'
     ) THEN
    RAISE EXCEPTION 'Registration decision authority role boundary is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_proc procedure
    JOIN pg_catalog.pg_namespace schema ON schema.oid = procedure.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = procedure.proowner
    WHERE schema.nspname = 'auth'
      AND procedure.oid IN (
        to_regprocedure(
          'auth.lock_registration_decision_application(text,text,text,text,text,text,text)'
        ),
        to_regprocedure(
          'auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)'
        )
      )
      AND procedure.prosecdef
      AND owner.rolname = 'pc_registration_decision_authority'
      AND procedure.proconfig @> ARRAY[
        'search_path=public, auth, pg_temp',
        'row_security=on'
      ]::text[]
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.aclexplode(
          COALESCE(
            procedure.proacl,
            pg_catalog.acldefault('f', procedure.proowner)
          )
        ) acl
        WHERE acl.grantee = 0
          AND acl.privilege_type = 'EXECUTE'
      )
  ) <> 2 THEN
    RAISE EXCEPTION 'Registration decision lock functions are not bounded'
      USING ERRCODE = '42501';
  END IF;

  SELECT procedure.prosrc
  INTO lock_source
  FROM pg_catalog.pg_proc procedure
  JOIN pg_catalog.pg_namespace schema ON schema.oid = procedure.pronamespace
  JOIN pg_catalog.pg_roles owner ON owner.oid = procedure.proowner
  WHERE schema.nspname = 'auth'
    AND procedure.oid = to_regprocedure(
      'auth.lock_registration_decision_application(text,text,text,text,text,text,text)'
    )
    AND procedure.prosecdef
    AND owner.rolname = 'pc_registration_decision_authority';

  SELECT procedure.prosrc
  INTO transition_source
  FROM pg_catalog.pg_proc procedure
  JOIN pg_catalog.pg_namespace schema ON schema.oid = procedure.pronamespace
  JOIN pg_catalog.pg_roles owner ON owner.oid = procedure.proowner
  WHERE schema.nspname = 'auth'
    AND procedure.oid = to_regprocedure(
      'auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)'
    )
    AND procedure.prosecdef
    AND owner.rolname = 'pc_registration_decision_authority';

  IF lock_source IS NULL
     OR position('FOR UPDATE OF application, organization' IN lock_source) = 0
     OR transition_source IS NULL
     OR position('FOR UPDATE OF candidate, organization' IN transition_source) = 0 THEN
    RAISE EXCEPTION 'Registration decision application row locks must remain enabled'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_table_privilege(
       'pc_registration_decision_authority',
       'auth.registration_applications',
       'SELECT'
     )
     OR NOT has_column_privilege(
       'pc_registration_decision_authority',
       'auth.registration_applications',
       'id',
       'UPDATE'
     )
     OR has_any_column_privilege(
       'pc_registration_decision_authority',
       'auth.registration_applications',
       'UPDATE WITH GRANT OPTION'
     )
     OR has_table_privilege(
       'pc_registration_decision_authority',
       'auth.registration_applications',
       'UPDATE'
     )
     OR has_table_privilege(
       'pc_registration_decision_authority',
       'auth.registration_applications',
       'INSERT'
     )
     OR has_any_column_privilege(
       'pc_registration_decision_authority',
       'auth.registration_applications',
       'INSERT'
     )
     OR has_table_privilege(
       'pc_registration_decision_authority',
       'auth.registration_applications',
       'DELETE'
     )
     OR (
       SELECT count(*)
       FROM pg_catalog.pg_attribute attribute
       WHERE attribute.attrelid = 'auth.registration_applications'::regclass
         AND attribute.attnum > 0
         AND NOT attribute.attisdropped
         AND has_column_privilege(
           'pc_registration_decision_authority',
           'auth.registration_applications',
           attribute.attname,
           'UPDATE'
         )
     ) <> 1 THEN
    RAISE EXCEPTION 'Registration decision application lock privilege is broader than id-only UPDATE'
      USING ERRCODE = '42501';
  END IF;
END;
$registration_decision_application_lock_privilege_proof$;
