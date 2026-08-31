-- P0 identity RLS successor: make deal participant visibility part of the
-- forward-only migration chain, not an accidental property of a later deploy
-- artifact.
--
-- 20260807002000 correctly turned ENABLE + FORCE RLS on for
-- public.deal_participants. At that point the migration catalog contained the
-- bounded INSERT policy from 20260712193000, but no SELECT policy: the latter
-- existed only in infra/sql/production-rls-policies.sql. A migration-only
-- database therefore denied every participant SELECT. That is fail-closed, but
-- it also made bounded server-authoritative functions (for example the
-- logistics assignment projection) unable to prove that the authenticated
-- LOGISTICIAN is an ACTIVE participant of the exact Deal.
--
-- Install the same narrow participant SELECT boundary used by the production
-- RLS artifact. It is tenant + user + organization + role + ACTIVE status
-- scoped for ordinary actors; privileged roles remain tenant-scoped through
-- app_rls_privileged(). No identity bootstrap bypass or direct cross-tenant
-- branch is introduced.

ALTER TABLE public."deal_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deal_participants" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_participants_select ON public."deal_participants";
CREATE POLICY deal_participants_select ON public."deal_participants"
FOR SELECT USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR (
      "userId" = current_setting('app.current_user_id', true)
      AND "organizationId" = current_setting('app.current_org_id', true)
      AND "role" = current_setting('app.current_role', true)
      AND "status" = 'ACTIVE'
    )
  )
);

DO $deal_participants_select_authority_proof$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deal_participants'
      AND policyname = 'deal_participants_select'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'deal_participants SELECT policy is missing after FORCE RLS activation'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'public'
      AND relation.relname = 'deal_participants'
      AND (NOT relation.relrowsecurity OR NOT relation.relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'deal_participants must remain ENABLE + FORCE RLS'
      USING ERRCODE = '42501';
  END IF;
END;
$deal_participants_select_authority_proof$;
