-- P0 registration: restore the runtime privilege required by the durable
-- password-reset challenge repository.
--
-- The password-reset service resolves the identity and changes the password
-- only through bounded SECURITY DEFINER functions, but the challenge lifecycle
-- itself is deliberately stored in auth.password_reset_challenges and is read,
-- inserted and updated directly by the isolated auth datasource. The original
-- challenge migration granted that lifecycle surface only to the historical
-- app_service role; the later isolated auth principals therefore receive the
-- reset functions but not the challenge-table privilege those functions' caller
-- still requires. A public forgot-password request then returns the universal
-- 202 response while the challenge/audit/outbox transaction rolls back.
--
-- Keep the repair narrow: only authentication runtime principals get
-- SELECT/INSERT/UPDATE on the reset-challenge relation. DELETE/TRUNCATE and all
-- unrelated identity, organization, tenant and membership surfaces remain
-- unavailable.

DO $password_reset_challenge_runtime_grants$
DECLARE
  runtime_role text;
  runtime_super boolean;
  runtime_bypass boolean;
  runtime_inherit boolean;
BEGIN
  IF to_regclass('auth.password_reset_challenges') IS NULL THEN
    RAISE EXCEPTION 'auth.password_reset_challenges is required'
      USING ERRCODE = '42P01';
  END IF;

  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    SELECT rolsuper, rolbypassrls, rolinherit
      INTO runtime_super, runtime_bypass, runtime_inherit
    FROM pg_catalog.pg_roles
    WHERE rolname = runtime_role;

    IF runtime_super OR runtime_bypass OR runtime_inherit THEN
      RAISE EXCEPTION 'Password-reset runtime role % violates least-privilege boundary', runtime_role
        USING ERRCODE = '42501';
    END IF;

    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', runtime_role);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE ON auth.password_reset_challenges TO %I',
      runtime_role
    );
    EXECUTE format(
      'REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON auth.password_reset_challenges FROM %I',
      runtime_role
    );
  END LOOP;
END
$password_reset_challenge_runtime_grants$;

DO $password_reset_challenge_runtime_proof$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    IF NOT has_schema_privilege(runtime_role, 'auth', 'USAGE')
       OR NOT has_table_privilege(runtime_role, 'auth.password_reset_challenges', 'SELECT')
       OR NOT has_table_privilege(runtime_role, 'auth.password_reset_challenges', 'INSERT')
       OR NOT has_table_privilege(runtime_role, 'auth.password_reset_challenges', 'UPDATE')
       OR has_table_privilege(runtime_role, 'auth.password_reset_challenges', 'DELETE')
       OR has_table_privilege(runtime_role, 'auth.password_reset_challenges', 'TRUNCATE')
       OR has_table_privilege(runtime_role, 'auth.password_reset_challenges', 'REFERENCES')
       OR has_table_privilege(runtime_role, 'auth.password_reset_challenges', 'TRIGGER') THEN
      RAISE EXCEPTION 'Password-reset challenge privilege boundary is invalid for %', runtime_role
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF has_table_privilege('PUBLIC', 'auth.password_reset_challenges', 'SELECT')
     OR has_table_privilege('PUBLIC', 'auth.password_reset_challenges', 'INSERT')
     OR has_table_privilege('PUBLIC', 'auth.password_reset_challenges', 'UPDATE')
     OR has_table_privilege('PUBLIC', 'auth.password_reset_challenges', 'DELETE') THEN
    RAISE EXCEPTION 'Password-reset challenges must remain private from PUBLIC'
      USING ERRCODE = '42501';
  END IF;
END
$password_reset_challenge_runtime_proof$;
