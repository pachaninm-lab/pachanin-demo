-- P0 First Customer Access: no policy may exist on a table where RLS is off.
--
-- The registration gap audit built the database from the forward-only migration
-- chain only and found seven policies that looked protective but never ran:
-- organizations_select, deal_participants_insert, four outbox_entries policies
-- and integration_events_select. The identity migration already moved
-- organizations to ENABLE + FORCE RLS. The remaining three tables were protected
-- only when a separate deployment SQL artifact happened to run afterwards.
--
-- Make the protection a property of the canonical migration chain itself. This
-- does not widen any policy: it activates the policies already created by prior
-- migrations and forces even the table owner through them. The production RLS
-- artifact may still recreate/refine the same policies later; it is no longer
-- the step that switches their enforcement on.

ALTER TABLE public."deal_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deal_participants" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."integration_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."integration_events" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY;

-- Fail the migration rather than ship another decorative policy. This check is
-- intentionally repository-wide across ordinary/partitioned tables and every
-- non-system schema: a policy with relrowsecurity=false is never an acceptable
-- intermediate production state at the end of the migration chain.
DO $no_inert_rls_policies$
DECLARE
  inert text;
BEGIN
  SELECT string_agg(format('%I.%I:%I', policy.schemaname, policy.tablename, policy.policyname), ', ' ORDER BY policy.schemaname, policy.tablename, policy.policyname)
  INTO inert
  FROM pg_catalog.pg_policies policy
  JOIN pg_catalog.pg_namespace schema
    ON schema.nspname = policy.schemaname
  JOIN pg_catalog.pg_class relation
    ON relation.relnamespace = schema.oid
   AND relation.relname = policy.tablename
  WHERE relation.relkind IN ('r', 'p')
    AND NOT relation.relrowsecurity;

  IF inert IS NOT NULL THEN
    RAISE EXCEPTION 'Inert RLS policies remain after migration chain: %', inert
      USING ERRCODE = '42501';
  END IF;
END;
$no_inert_rls_policies$;

-- Pin the exact P0 tables that motivated this migration to FORCE as well as
-- ENABLE. If a preceding statement is edited or a future migration replaces a
-- table without restoring the flags, this migration itself fails closed.
DO $p0_force_rls_proof$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(format('%I.%I', schema.nspname, relation.relname), ', ' ORDER BY relation.relname)
  INTO bad
  FROM pg_catalog.pg_class relation
  JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
  WHERE schema.nspname = 'public'
    AND relation.relname IN (
      'users',
      'user_orgs',
      'organizations',
      'deal_participants',
      'integration_events',
      'outbox_entries'
    )
    AND (NOT relation.relrowsecurity OR NOT relation.relforcerowsecurity);

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'P0 protected tables are not ENABLE + FORCE RLS: %', bad
      USING ERRCODE = '42501';
  END IF;
END;
$p0_force_rls_proof$;
