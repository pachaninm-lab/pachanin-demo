-- PC-CROP Federal Accounting / 1C authority hardening.
--
-- The connector owner is deliberately isolated in both directions: nobody may
-- inherit it, and it may not inherit any other role. Keeping this as a separate
-- additive migration lets the large reviewed authority migration remain byte-
-- identical to its source while tightening the current migration chain.

ALTER ROLE pc_one_c_connector_authority
  NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

DO $one_c_authority_membership_guard$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_auth_members membership
      JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
      JOIN pg_catalog.pg_roles member_role ON member_role.oid = membership.member
     WHERE granted.rolname = 'pc_one_c_connector_authority'
        OR member_role.rolname = 'pc_one_c_connector_authority'
  ) THEN
    RAISE EXCEPTION 'pc_one_c_connector_authority must have no role memberships in either direction'
      USING ERRCODE = '42501';
  END IF;
END
$one_c_authority_membership_guard$;
