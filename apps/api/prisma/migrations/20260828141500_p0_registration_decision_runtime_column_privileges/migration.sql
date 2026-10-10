-- P0 registration decision runtime: exact column privileges for the existing
-- server-authoritative decision service.
--
-- Production evidence from all-role run 33155036583 and the bounded read-only
-- classifier proved SQLSTATE 42501 before the ninth employee decision could
-- commit. The bounded SECURITY DEFINER authorization/row-lock functions are
-- present and the row-lock privilege migration is applied; the remaining gap
-- is the small, parameterized registration decision DML envelope executed by
-- the authentication runtime after PostgreSQL has re-derived actor scope and
-- locked the application.
--
-- Production intentionally uses an unprivileged login principal. Fresh CI/DR
-- rehearsal databases intentionally omit that production-only login, matching
-- the earlier production_app_service_auth_principal_drift migration. Therefore
-- zero matching runtimes is a valid no-op only when the runtime principal is
-- absent; whenever a confined runtime exists, the grants and proof below are
-- mandatory. No staff/deal/storage/outbox authority and no table-wide DML is
-- admitted.

DO $registration_decision_runtime_column_grants$
DECLARE
  runtime_role text;
  target_count integer := 0;
BEGIN
  FOR runtime_role IN
    SELECT role.rolname
    FROM pg_catalog.pg_roles role
    WHERE
      role.rolcanlogin
      AND NOT role.rolsuper
      AND NOT role.rolbypassrls
      AND NOT role.rolcreatedb
      AND NOT role.rolcreaterole
      AND NOT role.rolreplication
      AND (
        role.rolname IN ('app_service', 'pc_auth_runtime', 'one_deal_auth', 'app_auth')
        OR (
          pg_catalog.has_schema_privilege(role.rolname, 'auth', 'USAGE')
          AND pg_catalog.has_function_privilege(
            role.rolname,
            'auth.resolve_login_credential(text)',
            'EXECUTE'
          )
          AND pg_catalog.has_function_privilege(
            role.rolname,
            'auth.registration_organization_join_queue(text,text,text,text,text,integer)',
            'EXECUTE'
          )
        )
      )
    ORDER BY role.rolname
  LOOP
    target_count := target_count + 1;

    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', runtime_role);

    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.registration_platform_actor_authorized(text,text) TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.registration_organization_admin_context(text,text,text,text,text) TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.registration_platform_review_queue(text,text,integer) TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.registration_organization_join_queue(text,text,text,text,text,integer) TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.lock_registration_decision_application(text,text,text,text,text,text,text) TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text) TO %I',
      runtime_role
    );

    EXECUTE format(
      'GRANT SELECT ('
      || 'id, kind, user_id, organization_id, membership_id, '
      || 'requested_workspace, requested_role, status, version, correlation_id, '
      || 'email, decision_reason, decided_at'
      || ') ON auth.registration_applications TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT UPDATE ('
      || 'status, decided_at, decision_reason, decision_actor_user_id, version, updated_at'
      || ') ON auth.registration_applications TO %I',
      runtime_role
    );

    EXECUTE format(
      'GRANT SELECT ('
      || 'id, application_id, actor_user_id, actor_kind, previous_status, new_status, '
      || 'reason, correlation_id, idempotency_key, application_version, metadata, created_at'
      || ') ON auth.registration_application_events TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT INSERT ('
      || 'id, application_id, actor_user_id, actor_kind, previous_status, new_status, '
      || 'reason, correlation_id, idempotency_key, application_version'
      || ') ON auth.registration_application_events TO %I',
      runtime_role
    );
  END LOOP;

  -- Fresh CI/DR databases intentionally have no production app-service login.
  -- Do not invent or broaden a runtime principal merely to make the migration
  -- pass; production already has the confined principal and therefore cannot
  -- take this no-op path.
  IF target_count < 1 THEN
    RETURN;
  END IF;
END
$registration_decision_runtime_column_grants$;

DO $registration_decision_runtime_column_proof$
DECLARE
  runtime_role text;
  column_name text;
  target_count integer := 0;
  application_select_columns constant text[] := ARRAY[
    'id', 'kind', 'user_id', 'organization_id', 'membership_id',
    'requested_workspace', 'requested_role', 'status', 'version', 'correlation_id',
    'email', 'decision_reason', 'decided_at'
  ];
  application_update_columns constant text[] := ARRAY[
    'status', 'decided_at', 'decision_reason', 'decision_actor_user_id', 'version', 'updated_at'
  ];
  event_select_columns constant text[] := ARRAY[
    'id', 'application_id', 'actor_user_id', 'actor_kind', 'previous_status', 'new_status',
    'reason', 'correlation_id', 'idempotency_key', 'application_version', 'metadata', 'created_at'
  ];
  event_insert_columns constant text[] := ARRAY[
    'id', 'application_id', 'actor_user_id', 'actor_kind', 'previous_status', 'new_status',
    'reason', 'correlation_id', 'idempotency_key', 'application_version'
  ];
BEGIN
  FOR runtime_role IN
    SELECT role.rolname
    FROM pg_catalog.pg_roles role
    WHERE
      role.rolcanlogin
      AND NOT role.rolsuper
      AND NOT role.rolbypassrls
      AND NOT role.rolcreatedb
      AND NOT role.rolcreaterole
      AND NOT role.rolreplication
      AND (
        role.rolname IN ('app_service', 'pc_auth_runtime', 'one_deal_auth', 'app_auth')
        OR (
          pg_catalog.has_schema_privilege(role.rolname, 'auth', 'USAGE')
          AND pg_catalog.has_function_privilege(
            role.rolname,
            'auth.resolve_login_credential(text)',
            'EXECUTE'
          )
          AND pg_catalog.has_function_privilege(
            role.rolname,
            'auth.registration_organization_join_queue(text,text,text,text,text,integer)',
            'EXECUTE'
          )
        )
      )
    ORDER BY role.rolname
  LOOP
    target_count := target_count + 1;

    IF NOT pg_catalog.has_schema_privilege(runtime_role, 'auth', 'USAGE')
       OR NOT pg_catalog.has_function_privilege(
         runtime_role,
         'auth.registration_organization_admin_context(text,text,text,text,text)',
         'EXECUTE'
       )
       OR NOT pg_catalog.has_function_privilege(
         runtime_role,
         'auth.registration_organization_join_queue(text,text,text,text,text,integer)',
         'EXECUTE'
       )
       OR NOT pg_catalog.has_function_privilege(
         runtime_role,
         'auth.lock_registration_decision_application(text,text,text,text,text,text,text)',
         'EXECUTE'
       )
       OR NOT pg_catalog.has_function_privilege(
         runtime_role,
         'auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)',
         'EXECUTE'
       ) THEN
      RAISE EXCEPTION 'Registration decision bounded function surface is incomplete for %', runtime_role
        USING ERRCODE = '42501';
    END IF;

    FOREACH column_name IN ARRAY application_select_columns LOOP
      IF NOT pg_catalog.has_column_privilege(
        runtime_role, 'auth.registration_applications', column_name, 'SELECT'
      ) THEN
        RAISE EXCEPTION 'Missing registration application SELECT column privilege for %: %',
          runtime_role, column_name USING ERRCODE = '42501';
      END IF;
    END LOOP;

    FOREACH column_name IN ARRAY application_update_columns LOOP
      IF NOT pg_catalog.has_column_privilege(
        runtime_role, 'auth.registration_applications', column_name, 'UPDATE'
      ) THEN
        RAISE EXCEPTION 'Missing registration application UPDATE column privilege for %: %',
          runtime_role, column_name USING ERRCODE = '42501';
      END IF;
    END LOOP;

    FOREACH column_name IN ARRAY event_select_columns LOOP
      IF NOT pg_catalog.has_column_privilege(
        runtime_role, 'auth.registration_application_events', column_name, 'SELECT'
      ) THEN
        RAISE EXCEPTION 'Missing registration event SELECT column privilege for %: %',
          runtime_role, column_name USING ERRCODE = '42501';
      END IF;
    END LOOP;

    FOREACH column_name IN ARRAY event_insert_columns LOOP
      IF NOT pg_catalog.has_column_privilege(
        runtime_role, 'auth.registration_application_events', column_name, 'INSERT'
      ) THEN
        RAISE EXCEPTION 'Missing registration event INSERT column privilege for %: %',
          runtime_role, column_name USING ERRCODE = '42501';
      END IF;
    END LOOP;

    IF pg_catalog.has_table_privilege(runtime_role, 'auth.registration_applications', 'DELETE')
       OR pg_catalog.has_table_privilege(runtime_role, 'auth.registration_application_events', 'DELETE')
       OR pg_catalog.has_table_privilege(runtime_role, 'auth.registration_application_events', 'UPDATE')
    THEN
      RAISE EXCEPTION 'Registration decision runtime has forbidden destructive capability: %',
        runtime_role USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF target_count < 1 THEN
    RETURN;
  END IF;
END
$registration_decision_runtime_column_proof$;
