-- Align the dedicated production outbox runtime principal with the existing
-- FORCE RLS worker policies. The production-like worker connects as app_outbox;
-- the historical policy still named app_outbox_worker, so SQL table grants were
-- present while FORCE RLS made every claim SELECT return zero rows.
--
-- Least-privilege boundary:
--   * app_outbox gains worker SELECT/UPDATE visibility only;
--   * INSERT remains unchanged and is NOT granted by this migration;
--   * DELETE is still unavailable;
--   * no SUPERUSER/BYPASSRLS/role membership/table ownership is introduced;
--   * tenant-scoped application policies remain unchanged.

ALTER TABLE public."outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_entries_worker_select ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_worker_update ON public."outbox_entries";

CREATE POLICY outbox_entries_worker_select ON public."outbox_entries"
  FOR SELECT
  USING (current_user IN ('app_service', 'app_outbox_worker', 'app_outbox'));

CREATE POLICY outbox_entries_worker_update ON public."outbox_entries"
  FOR UPDATE
  USING (current_user IN ('app_service', 'app_outbox_worker', 'app_outbox'))
  WITH CHECK (current_user IN ('app_service', 'app_outbox_worker', 'app_outbox'));

COMMENT ON POLICY outbox_entries_worker_select ON public."outbox_entries" IS
  'Dedicated outbox runtimes may claim visible rows under FORCE RLS; app_outbox is the production-like runtime principal.';
COMMENT ON POLICY outbox_entries_worker_update ON public."outbox_entries" IS
  'Dedicated outbox runtimes may lease/ack/redrive rows under FORCE RLS; no INSERT/DELETE authority is added.';
