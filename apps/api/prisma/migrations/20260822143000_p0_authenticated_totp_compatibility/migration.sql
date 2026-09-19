-- Reconcile the legacy public.users MFA flag only while the same transaction
-- is completing a freshly verified TOTP login. The authoritative secret,
-- enabled state and credential version remain in auth.credential_states.
-- Backup codes, historical challenges and broad data backfills are excluded.
CREATE OR REPLACE FUNCTION auth.finalize_authenticated_user_mfa(
  p_user_id text,
  p_session_id text,
  p_challenge_id text
)
RETURNS TABLE (updated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET row_security = on
AS $function$
DECLARE
  affected integer;
BEGIN
  UPDATE public."users" subject
  SET "mfaEnabled" = true
  WHERE subject."id" = p_user_id
    AND EXISTS (
      SELECT 1
      FROM auth.sessions session
      JOIN auth.mfa_challenges challenge
        ON challenge."id" = p_challenge_id
       AND challenge.session_id = session."id"
       AND challenge.user_id = p_user_id
       AND challenge."type" IN ('TOTP_ENROLL', 'TOTP_VERIFY')
       AND challenge."status" = 'VERIFIED'
       AND challenge.verified_at = pg_catalog.transaction_timestamp()
       AND challenge.expires_at > pg_catalog.transaction_timestamp()
      JOIN auth.credential_states credential
        ON credential.user_id = p_user_id
       AND credential.credential_version > 0
       AND credential.mfa_enabled = true
       AND credential.mfa_key_version = 'v1'
       AND credential.mfa_secret_ciphertext
         ~ '^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'
      WHERE session."id" = p_session_id
        AND session.user_id = p_user_id
        AND session."status" = 'ACTIVE'
        AND session.revoked_at IS NULL
        AND session.expires_at > pg_catalog.transaction_timestamp()
        AND session.mfa_level = 'TOTP'
        AND session.mfa_verified_method = 'TOTP'
        AND session.mfa_verified_at = pg_catalog.transaction_timestamp()
        AND challenge.verified_at = session.mfa_verified_at
        AND session.credential_version = credential.credential_version
    );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN QUERY SELECT affected = 1;
END;
$function$;

ALTER FUNCTION auth.finalize_authenticated_user_mfa(text, text, text)
  OWNER TO pc_auth_mfa_authority;
REVOKE ALL ON FUNCTION auth.finalize_authenticated_user_mfa(text, text, text)
  FROM PUBLIC;

DO $p0_authenticated_totp_compatibility_proof$
DECLARE
  function_body text;
  function_config text[];
BEGIN
  SELECT function.prosrc, function.proconfig
  INTO function_body, function_config
  FROM pg_catalog.pg_proc function
  JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
  JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
  WHERE schema.nspname = 'auth'
    AND function.proname = 'finalize_authenticated_user_mfa'
    AND function.pronargs = 3
    AND function.prosecdef
    AND owner.rolname = 'pc_auth_mfa_authority';

  IF function_body IS NULL
     OR function_config IS NULL
     OR NOT (function_config @> ARRAY['search_path=pg_catalog, pg_temp']::text[])
     OR NOT (function_config @> ARRAY['row_security=on']::text[])
     OR function_body NOT LIKE '%challenge."type" IN (''TOTP_ENROLL'', ''TOTP_VERIFY'')%'
     OR function_body NOT LIKE '%challenge.verified_at = pg_catalog.transaction_timestamp()%'
     OR function_body NOT LIKE '%challenge.expires_at > pg_catalog.transaction_timestamp()%'
     OR function_body NOT LIKE '%session.mfa_verified_method = ''TOTP''%'
     OR function_body NOT LIKE '%session.mfa_verified_at = pg_catalog.transaction_timestamp()%'
     OR function_body NOT LIKE '%challenge.verified_at = session.mfa_verified_at%'
     OR function_body NOT LIKE '%session.credential_version = credential.credential_version%'
     OR function_body !~ 'UPDATE public\."users"'
     OR function_body ~* '\m(INSERT|DELETE|TRUNCATE|MERGE|CALL|EXECUTE)\M'
     OR (
       length(lower(function_body))
       - length(replace(lower(function_body), 'update', ''))
     ) / length('update') <> 1 THEN
    RAISE EXCEPTION 'Authenticated TOTP compatibility function is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
       SELECT 1
       FROM pg_catalog.pg_proc function
       JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(
           function.proacl,
           pg_catalog.acldefault('f', function.proowner)
         )
       ) privilege
       WHERE schema.nspname = 'auth'
         AND function.proname = 'finalize_authenticated_user_mfa'
         AND function.pronargs = 3
         AND privilege.grantee = 0
         AND privilege.privilege_type = 'EXECUTE'
     )
     OR NOT has_column_privilege(
       'pc_auth_mfa_authority', 'public.users', 'id', 'SELECT'
     )
     OR NOT has_column_privilege(
       'pc_auth_mfa_authority', 'public.users', 'mfaEnabled', 'UPDATE'
     )
     OR has_table_privilege('pc_auth_mfa_authority', 'public.users', 'INSERT')
     OR has_table_privilege('pc_auth_mfa_authority', 'public.users', 'DELETE')
     OR has_table_privilege('pc_auth_mfa_authority', 'public.user_orgs', 'SELECT')
     OR has_table_privilege('pc_auth_mfa_authority', 'public.organizations', 'SELECT') THEN
    RAISE EXCEPTION 'Authenticated TOTP compatibility authority is invalid'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_authenticated_totp_compatibility_proof$;
