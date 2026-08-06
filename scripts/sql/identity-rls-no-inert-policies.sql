\set ON_ERROR_STOP on

-- Run only after the complete forward-only migration chain. A policy attached
-- to a table with relrowsecurity=false is decorative, not a security boundary.
DO $no_inert_rls_policies$
DECLARE
  inert text;
BEGIN
  SELECT string_agg(
    format('%I.%I:%I', policy.schemaname, policy.tablename, policy.policyname),
    ', ' ORDER BY policy.schemaname, policy.tablename, policy.policyname
  )
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
    RAISE EXCEPTION 'INERT_RLS_POLICIES:%', inert USING ERRCODE = '42501';
  END IF;
END;
$no_inert_rls_policies$;

-- The six P0 surfaces implicated by the registration audit must be stronger
-- than merely non-inert: owner bypass is prohibited as well.
DO $p0_force_rls$
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
    RAISE EXCEPTION 'P0_RLS_NOT_FORCED:%', bad USING ERRCODE = '42501';
  END IF;
END;
$p0_force_rls$;

SELECT 'NO_INERT_RLS_POLICIES:PASS' AS result;
