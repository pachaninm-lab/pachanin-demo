-- Forward correction for the aggregate reviewer login-readiness authority (#3791).
--
-- auth.credential_states is an authentication-internal table protected by
-- principal/column ACLs rather than table RLS. Creating a policy on a relation
-- without relrowsecurity made the policy inert and correctly failed the global
-- no-inert-policy gate. Do not turn RLS on here: the authentication runtime and
-- existing bounded MFA/password authorities have an intentionally separate ACL
-- model. Remove only the inert policy and prove the runtime remains table-free.

DROP POLICY IF EXISTS credential_states_staff_reviewer_readiness
  ON auth.credential_states;

DO $p0_reviewer_readiness_acl_correction$
DECLARE
  required_column text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies policy
    WHERE policy.schemaname = 'auth'
      AND policy.tablename = 'credential_states'
      AND policy.policyname = 'credential_states_staff_reviewer_readiness'
  ) THEN
    RAISE EXCEPTION 'credential-state reviewer readiness policy must not remain inert'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_authority'
      AND NOT rolcanlogin
      AND NOT rolinherit
      AND NOT rolsuper
      AND NOT rolbypassrls
      AND NOT rolcreatedb
      AND NOT rolcreaterole
  ) THEN
    RAISE EXCEPTION 'pc_staff_authority is not confined'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_staff_authority'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles member ON member.oid = membership.member
    WHERE member.rolname = 'pc_staff_authority'
  ) THEN
    RAISE EXCEPTION 'pc_staff_authority must remain membership-isolated'
      USING ERRCODE = '42501';
  END IF;

  FOREACH required_column IN ARRAY ARRAY[
    'user_id',
    'credential_version',
    'locked_until',
    'mfa_enabled',
    'mfa_secret_ciphertext',
    'mfa_key_version'
  ]
  LOOP
    IF NOT has_column_privilege(
      'pc_staff_authority',
      'auth.credential_states',
      required_column,
      'SELECT'
    ) THEN
      RAISE EXCEPTION 'pc_staff_authority credential-state column read is missing: %',
        required_column USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF has_table_privilege('pc_staff_authority', 'auth.credential_states', 'INSERT')
     OR has_table_privilege('pc_staff_authority', 'auth.credential_states', 'UPDATE')
     OR has_table_privilege('pc_staff_authority', 'auth.credential_states', 'DELETE')
     OR has_table_privilege('pc_staff_authority', 'auth.credential_states', 'TRUNCATE')
     OR has_table_privilege('pc_staff_authority', 'auth.credential_states', 'REFERENCES')
     OR has_table_privilege('pc_staff_authority', 'auth.credential_states', 'TRIGGER')
  THEN
    RAISE EXCEPTION 'pc_staff_authority received a credential-state write privilege'
      USING ERRCODE = '42501';
  END IF;

  IF has_table_privilege('pc_staff_runtime', 'auth.credential_states', 'SELECT')
     OR has_table_privilege('pc_staff_runtime', 'auth.credential_states', 'INSERT')
     OR has_table_privilege('pc_staff_runtime', 'auth.credential_states', 'UPDATE')
     OR has_table_privilege('pc_staff_runtime', 'auth.credential_states', 'DELETE')
     OR has_table_privilege('pc_staff_runtime', 'auth.credential_states', 'TRUNCATE')
     OR has_table_privilege('pc_staff_runtime', 'auth.credential_states', 'REFERENCES')
     OR has_table_privilege('pc_staff_runtime', 'auth.credential_states', 'TRIGGER')
  THEN
    RAISE EXCEPTION 'pc_staff_runtime must remain table-free for credential states'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'pc_staff_runtime',
    'auth.staff_reviewer_login_readiness()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime readiness EXECUTE grant is missing'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_readiness_acl_correction$;
