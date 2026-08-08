-- P0: activating FORCE RLS on public.outbox_entries must not break the
-- application-side transactional outbox producer.
--
-- The worker/callback policies remain principal-specific and unchanged. These
-- two policies are the deal-scoped producer/read surface already defined by the
-- governed production RLS artifact, now made part of the forward-only migration
-- authority because 20260807002000 makes outbox RLS mandatory in every runtime.
--
-- No context-free INSERT/SELECT is admitted: the trusted transaction-local RLS
-- context must be complete, the row must be bound to a Deal, and that Deal must
-- already be visible to the current server-authoritative actor.

ALTER TABLE public."outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_entries_select ON public."outbox_entries";
CREATE POLICY outbox_entries_select
ON public."outbox_entries"
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND "dealId" IS NOT NULL
  AND public.app_rls_deal_visible("dealId")
);

DROP POLICY IF EXISTS outbox_entries_insert ON public."outbox_entries";
CREATE POLICY outbox_entries_insert
ON public."outbox_entries"
FOR INSERT
WITH CHECK (
  public.app_rls_context_ready()
  AND "dealId" IS NOT NULL
  AND public.app_rls_deal_visible("dealId")
);

-- Fail closed if a future edit turns this back into a decorative policy.
DO $outbox_application_rls_proof$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'public'
      AND relation.relname = 'outbox_entries'
      AND relation.relrowsecurity
      AND relation.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'public.outbox_entries must remain ENABLE + FORCE RLS'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outbox_entries'
      AND policyname = 'outbox_entries_insert'
      AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'deal-scoped outbox INSERT policy is missing'
      USING ERRCODE = '42501';
  END IF;
END
$outbox_application_rls_proof$;
