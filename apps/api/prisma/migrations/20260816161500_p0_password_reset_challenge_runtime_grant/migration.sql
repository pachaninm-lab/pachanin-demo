-- PC-CROP P0 registration: restore the bounded password-reset challenge authority.
--
-- Production evidence in reviewer reset run 31958135741 proved that the
-- ordinary reset request reaches the API (HTTP 202) but the atomic
-- challenge/audit/auth-mail transaction rolls back before any PASSWORD_RESET
-- outbox row exists. PasswordResetRepository performs direct SELECT/INSERT/
-- UPDATE operations on auth.password_reset_challenges through the dedicated
-- auth runtime principal, while the original table migration granted those
-- operations only to the legacy app_service role.
--
-- Keep the correction deliberately narrow: supported auth runtime principals
-- receive only the three operations the repository actually performs. No
-- DELETE/TRUNCATE, role membership, BYPASSRLS, SUPERUSER, staff authority, or
-- auth.mail_outbox table privilege is introduced. Durable mail enqueue remains
-- behind auth.enqueue_mail_outbox(...), its existing SECURITY DEFINER boundary.

DO $p0_password_reset_challenge_runtime_grant$
DECLARE
  runtime_role text;
BEGIN
  FOREACH runtime_role IN ARRAY ARRAY[
    'pc_auth_runtime',
    'one_deal_auth',
    'app_auth',
    'app_service'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = runtime_role) THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE ON TABLE auth.password_reset_challenges TO %I',
        runtime_role
      );

      IF NOT has_table_privilege(runtime_role, 'auth.password_reset_challenges', 'SELECT')
         OR NOT has_table_privilege(runtime_role, 'auth.password_reset_challenges', 'INSERT')
         OR NOT has_table_privilege(runtime_role, 'auth.password_reset_challenges', 'UPDATE')
         OR has_table_privilege(runtime_role, 'auth.password_reset_challenges', 'DELETE')
         OR has_table_privilege(runtime_role, 'auth.password_reset_challenges', 'TRUNCATE') THEN
        RAISE EXCEPTION 'password-reset challenge authority is not least-privilege for %', runtime_role
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;
END
$p0_password_reset_challenge_runtime_grant$;
