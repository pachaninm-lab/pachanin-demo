-- Canonical RLS overlay for IR-10.2 Logistics PostgreSQL Authority.
-- Apply after production-rls-policies.sql and the logistics authority migration.

ALTER TABLE public."shipments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shipments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."checkpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."checkpoints" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."shipment_gps_points" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shipment_gps_points" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipments_select ON public."shipments";
CREATE POLICY shipments_select ON public."shipments"
FOR SELECT USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
);

DROP POLICY IF EXISTS shipments_insert ON public."shipments";
CREATE POLICY shipments_insert ON public."shipments"
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
  AND current_setting('app.current_role', true) IN ('LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN')
);

DROP POLICY IF EXISTS shipments_update ON public."shipments";
CREATE POLICY shipments_update ON public."shipments"
FOR UPDATE USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
  AND current_setting('app.current_role', true) IN ('DRIVER', 'LOGISTICIAN', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN')
) WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
  AND current_setting('app.current_role', true) IN ('DRIVER', 'LOGISTICIAN', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN')
);

DROP POLICY IF EXISTS shipments_delete ON public."shipments";
CREATE POLICY shipments_delete ON public."shipments" FOR DELETE USING (false);

DROP POLICY IF EXISTS checkpoints_select ON public."checkpoints";
CREATE POLICY checkpoints_select ON public."checkpoints"
FOR SELECT USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM public."shipments" s
    WHERE s."id" = "checkpoints"."shipmentId"
      AND s."tenantId" = current_setting('app.current_tenant_id', true)
      AND public.app_rls_deal_visible(s."dealId")
  )
);

DROP POLICY IF EXISTS checkpoints_insert ON public."checkpoints";
CREATE POLICY checkpoints_insert ON public."checkpoints"
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "actorId" = current_setting('app.current_user_id', true)
  AND current_setting('app.current_role', true) IN ('DRIVER', 'LOGISTICIAN', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN')
  AND EXISTS (
    SELECT 1 FROM public."shipments" s
    WHERE s."id" = "checkpoints"."shipmentId"
      AND s."tenantId" = current_setting('app.current_tenant_id', true)
      AND public.app_rls_deal_visible(s."dealId")
      AND (
        current_setting('app.current_role', true) <> 'DRIVER'
        OR s."driverUserId" = current_setting('app.current_user_id', true)
      )
  )
);
DROP POLICY IF EXISTS checkpoints_update ON public."checkpoints";
DROP POLICY IF EXISTS checkpoints_delete ON public."checkpoints";

DROP POLICY IF EXISTS shipment_gps_points_select ON public."shipment_gps_points";
CREATE POLICY shipment_gps_points_select ON public."shipment_gps_points"
FOR SELECT USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM public."shipments" s
    WHERE s."id" = "shipment_gps_points"."shipmentId"
      AND s."tenantId" = current_setting('app.current_tenant_id', true)
      AND public.app_rls_deal_visible(s."dealId")
  )
);

DROP POLICY IF EXISTS shipment_gps_points_insert ON public."shipment_gps_points";
CREATE POLICY shipment_gps_points_insert ON public."shipment_gps_points"
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "actorUserId" = current_setting('app.current_user_id', true)
  AND current_setting('app.current_role', true) IN ('DRIVER', 'SUPPORT_MANAGER', 'ADMIN')
  AND EXISTS (
    SELECT 1 FROM public."shipments" s
    WHERE s."id" = "shipment_gps_points"."shipmentId"
      AND s."tenantId" = current_setting('app.current_tenant_id', true)
      AND public.app_rls_deal_visible(s."dealId")
      AND (
        current_setting('app.current_role', true) <> 'DRIVER'
        OR s."driverUserId" = current_setting('app.current_user_id', true)
      )
  )
);
DROP POLICY IF EXISTS shipment_gps_points_update ON public."shipment_gps_points";
DROP POLICY IF EXISTS shipment_gps_points_delete ON public."shipment_gps_points";
