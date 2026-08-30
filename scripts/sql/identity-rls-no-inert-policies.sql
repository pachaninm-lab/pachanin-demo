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

-- A policy that permits everything is worse than a missing one: PostgreSQL
-- combines permissive policies with OR, so a single USING (true) granted to
-- PUBLIC neutralises every strict policy on the same table for that command.
-- The inert check above cannot see this - row security is enabled and the
-- policy is attached, so nothing looks wrong.
--
-- The distinction that matters is the grantee, not the qualifier. This schema
-- has around sixty policies written as `FOR SELECT TO pc_password_reset_authority
-- USING (true)` and similar: there the narrow role IS the boundary and the
-- qualifier is correctly trivial. A policy with the same qualifier and no TO
-- clause defaults to PUBLIC and applies to every role, including the runtime
-- roles app_deal, app_service and app_runtime. Only the second kind is a hole.
--
-- Exclusions are listed here, in source control, with the reason. An unlisted
-- table fails the gate. There are no silent exclusions.
DO $no_public_blanket_policies$
DECLARE
  excluded text[] := ARRAY[
    -- public.deals still carries deals_app_access USING (true) from
    -- 0001_postgresql_initial. Excluded rather than hidden: closing it needs a
    -- deals_update policy, which exists only in
    -- infra/sql/production-rls-policies.sql, and that artifact has drifted
    -- from this chain in both directions - its deals_insert is broader than
    -- the narrowing 20260712195000 installed, and its deals_select is missing
    -- the app_deal_basis_deal_visible branch this chain has. Copying it would
    -- revert a deliberate tightening, so deals needs its own pass with the
    -- deal command path exercised against it. Tracked as #4814.
    'deals',
    -- Shared reference data, not tenant data: regulatory_rule_versions carries
    -- ruleKey, versionTag, effective dates and payload, and no tenant or
    -- organization column of any kind. Every tenant reads the same regulatory
    -- rules, so a blanket read is the correct boundary rather than a missing one.
    'regulatory_rule_versions'
  ];
  blanket text;
BEGIN
  SELECT string_agg(
    format('%I.%I:%I', policy.schemaname, policy.tablename, policy.policyname),
    ', ' ORDER BY policy.tablename, policy.policyname
  )
  INTO blanket
  FROM pg_catalog.pg_policies policy
  JOIN pg_catalog.pg_namespace schema
    ON schema.nspname = policy.schemaname
  JOIN pg_catalog.pg_class relation
    ON relation.relnamespace = schema.oid
   AND relation.relname = policy.tablename
  WHERE policy.schemaname = 'public'
    AND relation.relkind IN ('r', 'p')
    AND policy.permissive = 'PERMISSIVE'
    AND 'public' = ANY (policy.roles)
    -- Every qualifier the policy carries is literally true. A policy always
    -- has at least one of qual and with_check, so this cannot match vacuously.
    AND coalesce(btrim(lower(policy.qual)), 'true') = 'true'
    AND coalesce(btrim(lower(policy.with_check)), 'true') = 'true'
    AND NOT (policy.tablename = ANY (excluded));

  IF blanket IS NOT NULL THEN
    RAISE EXCEPTION 'PUBLIC_BLANKET_RLS_POLICIES:%', blanket USING ERRCODE = '42501';
  END IF;
END;
$no_public_blanket_policies$;

SELECT 'NO_INERT_RLS_POLICIES:PASS' AS result;
