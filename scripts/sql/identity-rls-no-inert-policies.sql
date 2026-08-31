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
    -- public.deals no longer carries the blanket deals_app_access FOR ALL
    -- policy: 20260831180000 replaced it with deals_uncontexted_read (SELECT)
    -- and deals_uncontexted_update (UPDATE), closing INSERT and DELETE. The
    -- two survivors are still permissive and still match this check, so the
    -- exclusion stays - but it now covers two named commands rather than
    -- everything, and each survivor exists for a reason that was measured:
    --
    --   SELECT - 21 files read the deal model and the export and analytics
    --     readers take PrismaService rather than the RLS transaction service,
    --     so closing SELECT returns them nothing.
    --   UPDATE - DealAutoService.autoCancel sweeps every tenant on a six-hour
    --     timer with no user to derive a context from, and
    --     DealSagaService.persistSaga ends its write in .catch(() => {}), so a
    --     strict policy would stop the saga persisting silently. Restricting
    --     the update to that one transition is not expressible as a policy at
    --     all: USING sees the old row, WITH CHECK the new one, and no single
    --     expression sees both. That is a trigger, and its own pass.
    --
    -- Tracked as #4814. V8.2.2 and V8.4.1 stay FAIL while SELECT is open.
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

-- A permissive policy written with no FOR clause is recorded as cmd = ALL, and
-- for an ALL policy carrying no WITH CHECK, PostgreSQL applies the USING
-- expression to NEW rows as well. So `CREATE POLICY x ON t USING (true)` -
-- which reads like a read-only convenience - silently supplies
-- WITH CHECK (true) on INSERT and ORs away every strict INSERT policy on the
-- table.
--
-- That is not hypothetical. deals_app_access was written exactly this way in
-- 0001_postgresql_initial, and on a database built from this chain alone it
-- let the runtime role insert a deal that no auction produced: measured under
-- app_runtime with super=false, bypassrls=false and no RLS context, an INSERT
-- carrying status 'SIGNED' and an arbitrary sellerOrgId was accepted, which is
-- the whole of the confirmed-basis authority that 20260712193000 and
-- 20260712195000 exist to install. DELETE was open by the same mechanism.
--
-- The blanket check above does not catch this shape, because a table may be
-- excluded there for a deliberate SELECT fallback and would then carry the
-- ALL policy through the same exclusion. This check is therefore separate and
-- has NO exclusions: a permissive PUBLIC policy that covers every command with
-- trivial qualifiers is never the right answer. Narrow it to the commands
-- actually intended and the reason becomes reviewable.
DO $no_public_blanket_all_policies$
DECLARE
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
    AND policy.cmd = 'ALL'
    AND 'public' = ANY (policy.roles)
    AND coalesce(btrim(lower(policy.qual)), 'true') = 'true'
    AND coalesce(btrim(lower(policy.with_check)), 'true') = 'true';

  IF blanket IS NOT NULL THEN
    RAISE EXCEPTION 'PUBLIC_BLANKET_ALL_RLS_POLICIES:%', blanket USING ERRCODE = '42501';
  END IF;
END;
$no_public_blanket_all_policies$;

-- A table that carries a tenant and has no policy has no tenant boundary below
-- the service layer. V8.4.1 asks that a consumer operation NEVER affect a tenant
-- it has no relationship with, and "never" cannot rest on every caller
-- remembering to filter.
--
-- This is measured against the tables that NEED the control, not the tables that
-- have it. That distinction is why the requirement was first recorded PASS on
-- "72 tables with row level security and 268 policies": impressive numerators
-- over the wrong denominator. Counted correctly, 40 tables carry a tenant
-- column, and the exclusions below are the ones still uncovered.
--
-- Exclusions are listed here, in source control, with the reason. An unlisted
-- table fails the gate. There are no silent exclusions.
DO $tenant_tables_without_policy$
DECLARE
  excluded text[] := ARRAY[
    -- Written by the regulatory integration ingest through raw SQL across six
    -- repositories, and whether that path runs inside the RLS transaction has
    -- not been established. Enabling row security on an ingest that carries no
    -- tenant setting does not protect it, it stops it. Closing these needs that
    -- path traced first. Tracked as #4828, and V8.4.1 stays FAIL until then.
    'regulatory_integration_inbox_entries',
    'regulatory_integration_inbox_conflicts'
  ];
  uncovered text;
BEGIN
  SELECT string_agg(DISTINCT relation.relname, ', ' ORDER BY relation.relname)
  INTO uncovered
  FROM pg_catalog.pg_class relation
  JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
  JOIN pg_catalog.pg_attribute column_ ON column_.attrelid = relation.oid
   AND NOT column_.attisdropped
  WHERE schema.nspname = 'public'
    AND relation.relkind IN ('r', 'p')
    AND lower(column_.attname) IN ('tenantid', 'tenant_id')
    AND (
      NOT relation.relrowsecurity
      OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid = relation.oid)
    )
    AND NOT (relation.relname = ANY (excluded));

  IF uncovered IS NOT NULL THEN
    RAISE EXCEPTION 'TENANT_TABLE_WITHOUT_ROW_POLICY:%', uncovered USING ERRCODE = '42501';
  END IF;
END;
$tenant_tables_without_policy$;

SELECT 'NO_INERT_RLS_POLICIES:PASS' AS result;
