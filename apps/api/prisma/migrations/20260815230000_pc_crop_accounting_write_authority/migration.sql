-- PC-CROP federal accounting, Wave 2 fourth slice: a bounded write.
--
-- Until now the accounting tables accepted writes from the superuser only,
-- which meant the command policies had nowhere to land. This adds a write
-- principal and the policies that confine it.
--
-- What these policies deliberately do NOT do is re-implement the capability
-- model. Who may manage a signing authority is decided by job profile in
-- membership-capability.resolver.ts, and copying that table into SQL would
-- create a second source of truth that drifts the first time either side
-- changes. The database instead enforces what only the database can guarantee
-- no matter which call site is compromised:
--
--   * a row may only be written into the organization and tenant the writer
--     actually holds an ACTIVE membership in, resolved from user_orgs rather
--     than from a request setting;
--   * the writer cannot attribute its own act to somebody else — the granting
--     membership recorded on the row must be the writer's own;
--   * a delegation may only be created by the membership it flows from.
--
-- Attribution is the part worth having in the database. Capability checks can
-- be re-run by a reviewer reading the code; a forged "granted by" cannot be
-- detected after the fact at all, because the audit trail is the forged field.
--
-- Revocation is expressed as an UPDATE of status and revokedAt, and those are
-- the only columns the principal may write on an existing row. A revoked row
-- therefore cannot be quietly re-pointed at a different membership, a wider
-- amount ceiling or a longer window.

DO $accounting_command_principal$
DECLARE
  role_name text := 'pc_accounting_command_authority';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
    EXECUTE format(
      'CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE',
      role_name
    );
  END IF;
  EXECUTE format(
    'ALTER ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE',
    role_name
  );
END
$accounting_command_principal$;

-- Signing authorities -------------------------------------------------------

DROP POLICY IF EXISTS signing_authorities_accounting_insert ON public."signing_authorities";
CREATE POLICY signing_authorities_accounting_insert ON public."signing_authorities"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    -- The writer signs its own act. Attributing a grant to another membership
    -- is refused here rather than detected later.
    AND "grantedByMembershipId" = public.app_pc_crop_membership_id()
    -- Restating the two-person rule as an admission condition, so a row that
    -- the CHECK constraints would reject never reaches them.
    AND "secondApprovalMembershipId" IS NOT NULL
    AND "secondApprovalMembershipId" <> "membershipId"
    AND "secondApprovalMembershipId" <> "grantedByMembershipId"
  );

DROP POLICY IF EXISTS signing_authorities_accounting_update ON public."signing_authorities";
CREATE POLICY signing_authorities_accounting_update ON public."signing_authorities"
  FOR UPDATE
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  )
  WITH CHECK (
    "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

-- Delegations ---------------------------------------------------------------

DROP POLICY IF EXISTS membership_delegations_accounting_insert ON public."membership_delegations";
CREATE POLICY membership_delegations_accounting_insert ON public."membership_delegations"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    -- A delegation flows from the person creating it. Nobody hands out
    -- somebody else's authority.
    AND "fromMembershipId" = public.app_pc_crop_membership_id()
    AND "createdByMembershipId" = public.app_pc_crop_membership_id()
  );

DROP POLICY IF EXISTS membership_delegations_accounting_update ON public."membership_delegations";
CREATE POLICY membership_delegations_accounting_update ON public."membership_delegations"
  FOR UPDATE
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    -- Either party may end a delegation; the granter because it is theirs to
    -- withdraw, the recipient because a stand-in must be able to hand back a
    -- responsibility they did not ask for.
    AND (
      "fromMembershipId" = public.app_pc_crop_membership_id()
      OR "toMembershipId" = public.app_pc_crop_membership_id()
    )
  )
  WITH CHECK (
    "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

-- Privileges ----------------------------------------------------------------
--
-- INSERT is granted on the whole row because a new row must state all of it.
-- UPDATE is granted on two columns only, which is how "revocation" is
-- expressed and how everything else is made immutable: row level security can
-- admit or refuse a row, but only a column grant can stop an UPDATE from
-- widening an amount ceiling or moving an authority to another membership.

DO $accounting_command_grants$
DECLARE
  role_name text := 'pc_accounting_command_authority';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
    RETURN;
  END IF;

  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', role_name);

  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON public."signing_authorities" FROM %I', role_name);
  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON public."membership_delegations" FROM %I', role_name);

  EXECUTE format(
    'GRANT INSERT, SELECT ON public."signing_authorities" TO %I', role_name);
  EXECUTE format(
    'GRANT UPDATE ("status", "revokedAt") ON public."signing_authorities" TO %I', role_name);

  EXECUTE format(
    'GRANT INSERT, SELECT ON public."membership_delegations" TO %I', role_name);
  EXECUTE format(
    'GRANT UPDATE ("status", "revokedAt") ON public."membership_delegations" TO %I', role_name);

  -- Deleting an authority or a delegation would erase the record that it ever
  -- existed. Both are retired by status, never removed.
  EXECUTE format(
    'REVOKE DELETE ON public."signing_authorities" FROM %I', role_name);
  EXECUTE format(
    'REVOKE DELETE ON public."membership_delegations" FROM %I', role_name);
END
$accounting_command_grants$;

-- The read principal must not acquire a write path by sitting next to one.
DO $accounting_read_stays_read$
DECLARE
  role_name text := 'pc_accounting_authority';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE ON public."signing_authorities" FROM %I', role_name);
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE ON public."membership_delegations" FROM %I', role_name);
  END IF;
END
$accounting_read_stays_read$;
