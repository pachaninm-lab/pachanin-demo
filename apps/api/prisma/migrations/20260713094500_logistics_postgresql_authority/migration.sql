-- IR-10.2 Logistics PostgreSQL Authority
-- Adds tenant-scoped operational facts for shipments, append-only GPS/checkpoints,
-- durable PIN verification state and fail-closed RLS. No live telematics or GIS EPD.

ALTER TABLE public."shipments"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "driverPinHash" TEXT,
  ADD COLUMN IF NOT EXISTS "pinVerifiedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pinVerifiedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pinLockedUntil" TIMESTAMPTZ;

UPDATE public."shipments" s
SET "tenantId" = d."tenantId"
FROM public."deals" d
WHERE d."id" = s."dealId"
  AND s."tenantId" IS NULL;

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."shipments" WHERE "tenantId" IS NULL
  ) THEN
    RAISE EXCEPTION 'shipments tenant backfill incomplete';
  END IF;
END
$guard$;

ALTER TABLE public."shipments"
  ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.current_tenant_id'::text, true),
  ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE public."shipments"
  DROP CONSTRAINT IF EXISTS shipments_pin_failed_attempts_check;
ALTER TABLE public."shipments"
  ADD CONSTRAINT shipments_pin_failed_attempts_check
  CHECK ("pinFailedAttempts" >= 0 AND "pinFailedAttempts" <= 100);

ALTER TABLE public."shipments"
  DROP CONSTRAINT IF EXISTS shipments_pin_verifier_fk;
ALTER TABLE public."shipments"
  ADD CONSTRAINT shipments_pin_verifier_fk
  FOREIGN KEY ("pinVerifiedByUserId") REFERENCES public."users"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS shipments_tenant_updated_idx
  ON public."shipments" ("tenantId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS shipments_tenant_driver_status_idx
  ON public."shipments" ("tenantId", "driverUserId", "status");
CREATE INDEX IF NOT EXISTS shipments_tenant_carrier_status_idx
  ON public."shipments" ("tenantId", "carrierOrgId", "status");

ALTER TABLE public."checkpoints"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "commandId" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public."checkpoints" c
SET "tenantId" = s."tenantId"
FROM public."shipments" s
WHERE s."id" = c."shipmentId"
  AND c."tenantId" IS NULL;

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."checkpoints" WHERE "tenantId" IS NULL
  ) THEN
    RAISE EXCEPTION 'checkpoints tenant backfill incomplete';
  END IF;
END
$guard$;

ALTER TABLE public."checkpoints"
  ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.current_tenant_id'::text, true),
  ALTER COLUMN "tenantId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS checkpoints_idempotency_key_unique
  ON public."checkpoints" ("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS checkpoints_tenant_shipment_completed_idx
  ON public."checkpoints" ("tenantId", "shipmentId", "completedAt", "createdAt");
CREATE INDEX IF NOT EXISTS checkpoints_correlation_idx
  ON public."checkpoints" ("correlationId")
  WHERE "correlationId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS public."shipment_gps_points" (
  "id" TEXT PRIMARY KEY,
  "shipmentId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.current_tenant_id'::text, true),
  "actorUserId" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "speedKmh" DOUBLE PRECISION,
  "headingDeg" DOUBLE PRECISION,
  "accuracyM" DOUBLE PRECISION,
  "recordedAt" TIMESTAMPTZ NOT NULL,
  "commandId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "correlationId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shipment_gps_points_shipment_fk
    FOREIGN KEY ("shipmentId") REFERENCES public."shipments"("id") ON DELETE RESTRICT,
  CONSTRAINT shipment_gps_points_actor_fk
    FOREIGN KEY ("actorUserId") REFERENCES public."users"("id") ON DELETE RESTRICT,
  CONSTRAINT shipment_gps_points_lat_check CHECK ("lat" BETWEEN -90 AND 90),
  CONSTRAINT shipment_gps_points_lng_check CHECK ("lng" BETWEEN -180 AND 180),
  CONSTRAINT shipment_gps_points_speed_check CHECK ("speedKmh" IS NULL OR "speedKmh" BETWEEN 0 AND 250),
  CONSTRAINT shipment_gps_points_heading_check CHECK ("headingDeg" IS NULL OR "headingDeg" BETWEEN 0 AND 360),
  CONSTRAINT shipment_gps_points_accuracy_check CHECK ("accuracyM" IS NULL OR "accuracyM" BETWEEN 0 AND 10000),
  CONSTRAINT shipment_gps_points_idempotency_unique UNIQUE ("idempotencyKey")
);

CREATE INDEX IF NOT EXISTS shipment_gps_points_tenant_shipment_recorded_idx
  ON public."shipment_gps_points" ("tenantId", "shipmentId", "recordedAt", "id");
CREATE INDEX IF NOT EXISTS shipment_gps_points_correlation_idx
  ON public."shipment_gps_points" ("correlationId")
  WHERE "correlationId" IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_logistics_fact_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'logistics operational facts are append-only';
END
$function$;

DROP TRIGGER IF EXISTS checkpoints_append_only ON public."checkpoints";
CREATE TRIGGER checkpoints_append_only
BEFORE UPDATE OR DELETE ON public."checkpoints"
FOR EACH ROW EXECUTE FUNCTION public.prevent_logistics_fact_mutation();

DROP TRIGGER IF EXISTS shipment_gps_points_append_only ON public."shipment_gps_points";
CREATE TRIGGER shipment_gps_points_append_only
BEFORE UPDATE OR DELETE ON public."shipment_gps_points"
FOR EACH ROW EXECUTE FUNCTION public.prevent_logistics_fact_mutation();

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
CREATE POLICY shipments_delete ON public."shipments"
FOR DELETE USING (false);

DROP POLICY IF EXISTS checkpoints_select ON public."checkpoints";
CREATE POLICY checkpoints_select ON public."checkpoints"
FOR SELECT USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (
    SELECT 1
    FROM public."shipments" s
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
    SELECT 1
    FROM public."shipments" s
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
    SELECT 1
    FROM public."shipments" s
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
    SELECT 1
    FROM public."shipments" s
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

REVOKE ALL ON FUNCTION public.prevent_logistics_fact_mutation() FROM PUBLIC;
