-- Canonical PostgreSQL RLS overlay for the dedicated durable outbox principal.
--
-- app_outbox is the accepted runtime principal created by infrastructure and
-- constrained by 20260715143000_outbox_worker_principal. The base RLS policy
-- set historically referenced app_outbox_worker, which forced app_outbox into
-- tenant-context policies and made the worker query deal_participants. This
-- overlay aligns RLS identity with the least-privilege principal boundary.
-- The caller owns the transaction. Never add BEGIN/COMMIT here.

DROP POLICY IF EXISTS outbox_entries_worker_select ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_worker_insert ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_worker_update ON public."outbox_entries";

CREATE POLICY outbox_entries_worker_select ON public."outbox_entries" FOR SELECT
USING (current_user IN ('app_service', 'app_outbox'));

-- The delivery worker cannot create authoritative events. app_service remains
-- for compatibility with the service-authority contour; app_outbox has no
-- INSERT table privilege and is deliberately excluded from this policy.
CREATE POLICY outbox_entries_worker_insert ON public."outbox_entries" FOR INSERT
WITH CHECK (current_user = 'app_service');

CREATE POLICY outbox_entries_worker_update ON public."outbox_entries" FOR UPDATE
USING (current_user IN ('app_service', 'app_outbox'))
WITH CHECK (current_user IN ('app_service', 'app_outbox'));
