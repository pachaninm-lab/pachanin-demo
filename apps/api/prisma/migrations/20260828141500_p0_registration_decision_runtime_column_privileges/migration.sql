-- P0 registration decision runtime: exact column privileges for the existing
-- server-authoritative decision service.
--
-- Production evidence from all-role run 33155036583 and the bounded read-only
-- classifier proved SQLSTATE 42501 before the ninth employee decision could
-- commit.  The bounded SECURITY DEFINER authorization/row-lock functions are
-- present and the row-lock privilege migration is applied; the remaining gap
-- is that the auth runtime executes a small, parameterized DML envelope on the
-- two auth registration relations after PostgreSQL has re-derived the actor
-- scope and locked the application.
--
-- Do not grant table-wide SELECT/INSERT/UPDATE/DELETE.  Give only the columns
-- that RegistrationDecisionService and the bounded production verifier read or
-- write. Identity, tenant, organization and membership mutation remains behind
-- the existing bounded SECURITY DEFINER functions.

DO $registration_decision_runtime_column_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', runtime_role);

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
END
$registration_decision_runtime_column_grants$;

DO $registration_decision_runtime_column_proof$
DECLARE
  runtime_role text;
  column_name text;
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
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    FOREACH column_name IN ARRAY application_select_columns LOOP
      IF NOT has_column_privilege(
        runtime_role, 'auth.registration_applications', column_name, 'SELECT'
      ) THEN
        RAISE EXCEPTION 'Missing registration application SELECT column privilege for %: %',
          runtime_role, column_name USING ERRCODE = '42501';
      END IF;
    END LOOP;

    FOREACH column_name IN ARRAY application_update_columns LOOP
      IF NOT has_column_privilege(
        runtime_role, 'auth.registration_applications', column_name, 'UPDATE'
      ) THEN
        RAISE EXCEPTION 'Missing registration application UPDATE column privilege for %: %',
          runtime_role, column_name USING ERRCODE = '42501';
      END IF;
    END LOOP;

    FOREACH column_name IN ARRAY event_select_columns LOOP
      IF NOT has_column_privilege(
        runtime_role, 'auth.registration_application_events', column_name, 'SELECT'
      ) THEN
        RAISE EXCEPTION 'Missing registration event SELECT column privilege for %: %',
          runtime_role, column_name USING ERRCODE = '42501';
      END IF;
    END LOOP;

    FOREACH column_name IN ARRAY event_insert_columns LOOP
      IF NOT has_column_privilege(
        runtime_role, 'auth.registration_application_events', column_name, 'INSERT'
      ) THEN
        RAISE EXCEPTION 'Missing registration event INSERT column privilege for %: %',
          runtime_role, column_name USING ERRCODE = '42501';
      END IF;
    END LOOP;

    IF has_table_privilege(runtime_role, 'auth.registration_applications', 'DELETE')
       OR has_table_privilege(runtime_role, 'auth.registration_application_events', 'DELETE')
       OR has_table_privilege(runtime_role, 'auth.registration_application_events', 'UPDATE')
       OR has_column_privilege(runtime_role, 'auth.registration_applications', 'id', 'UPDATE')
       OR has_column_privilege(runtime_role, 'auth.registration_applications', 'organization_id', 'UPDATE')
       OR has_column_privilege(runtime_role, 'auth.registration_applications', 'user_id', 'UPDATE')
       OR has_column_privilege(runtime_role, 'auth.registration_applications', 'membership_id', 'UPDATE')
       OR has_column_privilege(runtime_role, 'auth.registration_applications', 'requested_role', 'UPDATE')
       OR has_column_privilege(runtime_role, 'auth.registration_applications', 'requested_workspace', 'UPDATE')
    THEN
      RAISE EXCEPTION 'Registration decision runtime privilege is broader than the bounded DML envelope: %',
        runtime_role USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$registration_decision_runtime_column_proof$;
