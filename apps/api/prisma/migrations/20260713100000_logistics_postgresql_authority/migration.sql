-- IR-10.2 Logistics PostgreSQL Authority.
-- Public Shipment/Checkpoint/GPS facts are tenant-scoped and RLS protected.
-- Registry/admission authority is normalized in the dedicated logistics schema.

CREATE SCHEMA IF NOT EXISTS logistics;
REVOKE ALL ON SCHEMA logistics FROM PUBLIC;

ALTER TABLE public."shipments"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "driverPinHash" TEXT,
  ADD COLUMN IF NOT EXISTS "pinVerifiedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pinVerifiedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pinLockedUntil" TIMESTAMPTZ;

UPDATE public."shipments" shipment
SET "tenantId" = COALESCE(
  deal."tenantId",
  'legacy-quarantine-' || left(md5(shipment."dealId"), 16)
)
FROM public."deals" deal
WHERE deal."id" = shipment."dealId"
  AND shipment."tenantId" IS NULL;

DO $shipment_tenant_backfill$
BEGIN
  IF EXISTS (SELECT 1 FROM public."shipments" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'shipments tenant backfill is incomplete';
  END IF;
END
$shipment_tenant_backfill$;

ALTER TABLE public."shipments"
  ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.current_tenant_id'::text, true),
  ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "shipments_tenantId_idx" ON public."shipments" ("tenantId");
CREATE INDEX IF NOT EXISTS "shipments_carrierOrgId_idx" ON public."shipments" ("carrierOrgId");

ALTER TABLE public."checkpoints"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "commandId" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public."checkpoints" checkpoint
SET "tenantId" = shipment."tenantId"
FROM public."shipments" shipment
WHERE shipment."id" = checkpoint."shipmentId"
  AND checkpoint."tenantId" IS NULL;

DO $checkpoint_tenant_backfill$
BEGIN
  IF EXISTS (SELECT 1 FROM public."checkpoints" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'checkpoints tenant backfill is incomplete';
  END IF;
END
$checkpoint_tenant_backfill$;

ALTER TABLE public."checkpoints"
  ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.current_tenant_id'::text, true),
  ALTER COLUMN "tenantId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "checkpoints_idempotencyKey_key"
  ON public."checkpoints" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "checkpoints_tenantId_idx" ON public."checkpoints" ("tenantId");
CREATE INDEX IF NOT EXISTS "checkpoints_completedAt_idx" ON public."checkpoints" ("completedAt");
CREATE INDEX IF NOT EXISTS "checkpoints_correlationId_idx" ON public."checkpoints" ("correlationId");

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
  CONSTRAINT "shipment_gps_points_shipmentId_fkey"
    FOREIGN KEY ("shipmentId") REFERENCES public."shipments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "shipment_gps_points_lat_check" CHECK ("lat" BETWEEN -90 AND 90),
  CONSTRAINT "shipment_gps_points_lng_check" CHECK ("lng" BETWEEN -180 AND 180),
  CONSTRAINT "shipment_gps_points_speed_check" CHECK ("speedKmh" IS NULL OR "speedKmh" BETWEEN 0 AND 250),
  CONSTRAINT "shipment_gps_points_heading_check" CHECK ("headingDeg" IS NULL OR "headingDeg" BETWEEN 0 AND 360),
  CONSTRAINT "shipment_gps_points_accuracy_check" CHECK ("accuracyM" IS NULL OR "accuracyM" BETWEEN 0 AND 10000),
  CONSTRAINT "shipment_gps_points_idempotencyKey_key" UNIQUE ("idempotencyKey")
);
CREATE INDEX IF NOT EXISTS "shipment_gps_points_shipmentId_recordedAt_idx"
  ON public."shipment_gps_points" ("shipmentId", "recordedAt");
CREATE INDEX IF NOT EXISTS "shipment_gps_points_tenantId_idx"
  ON public."shipment_gps_points" ("tenantId");
CREATE INDEX IF NOT EXISTS "shipment_gps_points_actorUserId_idx"
  ON public."shipment_gps_points" ("actorUserId");
CREATE INDEX IF NOT EXISTS "shipment_gps_points_correlationId_idx"
  ON public."shipment_gps_points" ("correlationId");

CREATE TABLE IF NOT EXISTS logistics.carriers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  evidence_file_id TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_carriers_organization_fkey
    FOREIGN KEY (organization_id) REFERENCES public."organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_carriers_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_carriers_tenant_org_key UNIQUE (tenant_id, organization_id),
  CONSTRAINT logistics_carriers_status_check CHECK (status IN ('PENDING', 'VERIFIED', 'SUSPENDED', 'REVOKED'))
);

CREATE TABLE IF NOT EXISTS logistics.drivers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  carrier_org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  evidence_file_id TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_drivers_carrier_fkey
    FOREIGN KEY (carrier_org_id) REFERENCES public."organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_drivers_user_fkey
    FOREIGN KEY (user_id) REFERENCES public."users"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_drivers_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_drivers_tenant_user_key UNIQUE (tenant_id, user_id),
  CONSTRAINT logistics_drivers_status_check CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'))
);

CREATE TABLE IF NOT EXISTS logistics.vehicles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  carrier_org_id TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  vehicle_type TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  evidence_file_id TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_vehicles_carrier_fkey
    FOREIGN KEY (carrier_org_id) REFERENCES public."organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_vehicles_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_vehicles_tenant_registration_key UNIQUE (tenant_id, registration_number),
  CONSTRAINT logistics_vehicles_status_check CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'))
);

CREATE TABLE IF NOT EXISTS logistics.driver_vehicle_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_driver_vehicle_driver_fkey
    FOREIGN KEY (driver_id) REFERENCES logistics.drivers(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_driver_vehicle_vehicle_fkey
    FOREIGN KEY (vehicle_id) REFERENCES logistics.vehicles(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_driver_vehicle_pair_key UNIQUE (tenant_id, driver_id, vehicle_id),
  CONSTRAINT logistics_driver_vehicle_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED'))
);

CREATE TABLE IF NOT EXISTS logistics.facilities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  facility_type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  evidence_file_id TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_facilities_organization_fkey
    FOREIGN KEY (organization_id) REFERENCES public."organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_facilities_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_facilities_status_check CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'))
);

CREATE TABLE IF NOT EXISTS logistics.deal_admissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  carrier_org_id TEXT NOT NULL,
  driver_user_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  route_from_facility_id TEXT NOT NULL,
  route_to_facility_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  evidence_file_id TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  consumed_by_command_id TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_admissions_deal_fkey
    FOREIGN KEY (deal_id) REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_admissions_carrier_fkey
    FOREIGN KEY (carrier_org_id) REFERENCES public."organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_admissions_driver_fkey
    FOREIGN KEY (driver_user_id) REFERENCES public."users"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_admissions_vehicle_fkey
    FOREIGN KEY (vehicle_id) REFERENCES logistics.vehicles(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_admissions_from_fkey
    FOREIGN KEY (route_from_facility_id) REFERENCES logistics.facilities(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_admissions_to_fkey
    FOREIGN KEY (route_to_facility_id) REFERENCES logistics.facilities(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_admissions_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_admissions_status_check CHECK (status IN ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS logistics_deal_admissions_active_vehicle_key
  ON logistics.deal_admissions (deal_id, vehicle_id)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS logistics_deal_admissions_lookup_idx
  ON logistics.deal_admissions (
    tenant_id, deal_id, carrier_org_id, driver_user_id, vehicle_id,
    route_from_facility_id, route_to_facility_id, status
  );

CREATE TABLE IF NOT EXISTS logistics.shipment_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  admission_id TEXT NOT NULL,
  shipment_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_bindings_admission_fkey
    FOREIGN KEY (admission_id) REFERENCES logistics.deal_admissions(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_bindings_shipment_fkey
    FOREIGN KEY (shipment_id) REFERENCES public."shipments"("id") ON DELETE RESTRICT,
  CONSTRAINT logistics_bindings_admission_key UNIQUE (admission_id),
  CONSTRAINT logistics_bindings_shipment_key UNIQUE (shipment_id),
  CONSTRAINT logistics_bindings_command_key UNIQUE (tenant_id, command_id)
);

CREATE INDEX IF NOT EXISTS logistics_carriers_tenant_idx ON logistics.carriers (tenant_id, status);
CREATE INDEX IF NOT EXISTS logistics_drivers_carrier_idx ON logistics.drivers (tenant_id, carrier_org_id, status);
CREATE INDEX IF NOT EXISTS logistics_vehicles_carrier_idx ON logistics.vehicles (tenant_id, carrier_org_id, status);
CREATE INDEX IF NOT EXISTS logistics_facilities_org_idx ON logistics.facilities (tenant_id, organization_id, status);

CREATE OR REPLACE FUNCTION public.app_logistics_evidence_valid(
  p_evidence_id TEXT,
  p_tenant_id TEXT,
  p_deal_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public."deal_documents" evidence
    WHERE evidence."id" = p_evidence_id
      AND evidence."tenantId" = p_tenant_id
      AND (p_deal_id IS NULL OR evidence."dealId" = p_deal_id)
      AND evidence."type" = 'EVIDENCE_FILE'
      AND evidence."status" = 'VERIFIED'
      AND evidence."isImmutable"
      AND evidence."hash" IS NOT NULL
      AND evidence."s3Key" IS NOT NULL
  )
$function$;

CREATE OR REPLACE FUNCTION public.app_logistics_deal_authorized(
  p_deal_id TEXT,
  p_driver_user_id TEXT DEFAULT NULL,
  p_write BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT public.app_rls_context_ready()
    AND (
      public.app_rls_privileged()
      OR EXISTS (
        SELECT 1
        FROM public."deal_participants" participant
        WHERE participant."dealId" = p_deal_id
          AND participant."tenantId" = current_setting('app.current_tenant_id', true)
          AND participant."organizationId" = current_setting('app.current_org_id', true)
          AND participant."userId" = current_setting('app.current_user_id', true)
          AND participant."role" = current_setting('app.current_role', true)
          AND participant."status" = 'ACTIVE'
          AND participant."accessLevel" IN (
            CASE WHEN p_write THEN 'WORK' ELSE 'READ' END,
            CASE WHEN p_write THEN 'APPROVE' ELSE 'WORK' END,
            'APPROVE'
          )
      )
      OR (
        current_setting('app.current_role', true) = 'DRIVER'
        AND p_driver_user_id = current_setting('app.current_user_id', true)
      )
    )
$function$;

CREATE OR REPLACE FUNCTION public.app_logistics_derive_shipment_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  deal_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO deal_tenant FROM public."deals" WHERE "id" = NEW."dealId";
  IF NOT FOUND OR deal_tenant IS NULL THEN
    RAISE EXCEPTION 'shipment deal has no tenant authority' USING ERRCODE = '23514';
  END IF;
  NEW."tenantId" := deal_tenant;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS shipments_derive_tenant ON public."shipments";
CREATE TRIGGER shipments_derive_tenant
BEFORE INSERT OR UPDATE OF "dealId", "tenantId" ON public."shipments"
FOR EACH ROW EXECUTE FUNCTION public.app_logistics_derive_shipment_tenant();

CREATE OR REPLACE FUNCTION public.app_logistics_derive_child_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  shipment_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO shipment_tenant
  FROM public."shipments"
  WHERE "id" = NEW."shipmentId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shipment does not exist' USING ERRCODE = '23503';
  END IF;
  NEW."tenantId" := shipment_tenant;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS checkpoints_derive_tenant ON public."checkpoints";
CREATE TRIGGER checkpoints_derive_tenant
BEFORE INSERT OR UPDATE OF "shipmentId", "tenantId" ON public."checkpoints"
FOR EACH ROW EXECUTE FUNCTION public.app_logistics_derive_child_tenant();

DROP TRIGGER IF EXISTS shipment_gps_points_derive_tenant ON public."shipment_gps_points";
CREATE TRIGGER shipment_gps_points_derive_tenant
BEFORE INSERT OR UPDATE OF "shipmentId", "tenantId" ON public."shipment_gps_points"
FOR EACH ROW EXECUTE FUNCTION public.app_logistics_derive_child_tenant();

CREATE OR REPLACE FUNCTION public.app_logistics_validate_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, logistics
AS $function$
DECLARE
  admission logistics.deal_admissions%ROWTYPE;
  deal_record public."deals"%ROWTYPE;
BEGIN
  IF NEW."status" <> 'DRIVER_ASSIGNED'
     OR NEW."carrierOrgId" IS NULL
     OR NEW."driverUserId" IS NULL
     OR NEW."vehicleNumber" IS NULL
     OR NEW."routeFrom" IS NULL
     OR NEW."routeTo" IS NULL
  THEN
    RAISE EXCEPTION 'new shipment requires canonical DRIVER_ASSIGNED admission fields'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO deal_record FROM public."deals" WHERE "id" = NEW."dealId";
  IF NOT FOUND OR deal_record."tenantId" IS NULL OR deal_record."tenantId" <> NEW."tenantId" THEN
    RAISE EXCEPTION 'shipment deal tenant mismatch' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO admission
  FROM logistics.deal_admissions candidate
  WHERE candidate.tenant_id = NEW."tenantId"
    AND candidate.deal_id = NEW."dealId"
    AND candidate.carrier_org_id = NEW."carrierOrgId"
    AND candidate.driver_user_id = NEW."driverUserId"
    AND candidate.vehicle_id = NEW."vehicleNumber"
    AND candidate.route_from_facility_id = NEW."routeFrom"
    AND candidate.route_to_facility_id = NEW."routeTo"
    AND candidate.status = 'ACTIVE'
    AND candidate.valid_from <= now()
    AND (candidate.valid_until IS NULL OR candidate.valid_until > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active normalized logistics admission not found' USING ERRCODE = '23514';
  END IF;

  IF NOT public.app_logistics_evidence_valid(admission.evidence_file_id, admission.tenant_id, admission.deal_id) THEN
    RAISE EXCEPTION 'logistics admission evidence is not verified immutable Deal evidence'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM logistics.carriers carrier
    JOIN public."organizations" organization ON organization."id" = carrier.organization_id
    WHERE carrier.organization_id = admission.carrier_org_id
      AND carrier.tenant_id = admission.tenant_id
      AND carrier.status = 'VERIFIED'
      AND carrier.valid_from <= now()
      AND (carrier.valid_until IS NULL OR carrier.valid_until > now())
      AND organization."tenantId" = admission.tenant_id
      AND organization."status" = 'VERIFIED'
      AND organization."kycStatus" = 'APPROVED'
      AND public.app_logistics_evidence_valid(carrier.evidence_file_id, carrier.tenant_id, admission.deal_id)
  ) THEN
    RAISE EXCEPTION 'carrier is not verified for normalized logistics admission' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM logistics.drivers driver
    JOIN public."users" user_record ON user_record."id" = driver.user_id
    JOIN public."user_orgs" membership
      ON membership."userId" = driver.user_id
     AND membership."organizationId" = driver.carrier_org_id
    WHERE driver.user_id = admission.driver_user_id
      AND driver.carrier_org_id = admission.carrier_org_id
      AND driver.tenant_id = admission.tenant_id
      AND driver.status = 'ACTIVE'
      AND driver.valid_from <= now()
      AND (driver.valid_until IS NULL OR driver.valid_until > now())
      AND user_record."status" = 'ACTIVE'
      AND user_record."deletedAt" IS NULL
      AND public.app_logistics_evidence_valid(driver.evidence_file_id, driver.tenant_id, admission.deal_id)
  ) THEN
    RAISE EXCEPTION 'driver is not active for normalized logistics admission' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM logistics.vehicles vehicle
    JOIN logistics.drivers driver
      ON driver.user_id = admission.driver_user_id
     AND driver.carrier_org_id = admission.carrier_org_id
     AND driver.tenant_id = admission.tenant_id
    JOIN logistics.driver_vehicle_links link
      ON link.driver_id = driver.id
     AND link.vehicle_id = vehicle.id
     AND link.tenant_id = admission.tenant_id
    WHERE vehicle.id = admission.vehicle_id
      AND vehicle.carrier_org_id = admission.carrier_org_id
      AND vehicle.tenant_id = admission.tenant_id
      AND vehicle.status = 'ACTIVE'
      AND link.status = 'ACTIVE'
      AND vehicle.valid_from <= now()
      AND (vehicle.valid_until IS NULL OR vehicle.valid_until > now())
      AND link.valid_from <= now()
      AND (link.valid_until IS NULL OR link.valid_until > now())
      AND public.app_logistics_evidence_valid(vehicle.evidence_file_id, vehicle.tenant_id, admission.deal_id)
  ) THEN
    RAISE EXCEPTION 'vehicle or driver-vehicle link is not active' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM logistics.facilities facility
    WHERE facility.id = admission.route_from_facility_id
      AND facility.tenant_id = admission.tenant_id
      AND facility.organization_id = deal_record."sellerOrgId"
      AND facility.status = 'ACTIVE'
      AND facility.valid_from <= now()
      AND (facility.valid_until IS NULL OR facility.valid_until > now())
      AND public.app_logistics_evidence_valid(facility.evidence_file_id, facility.tenant_id, admission.deal_id)
  ) THEN
    RAISE EXCEPTION 'route origin is not an active seller facility' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM logistics.facilities facility
    WHERE facility.id = admission.route_to_facility_id
      AND facility.tenant_id = admission.tenant_id
      AND facility.organization_id = deal_record."buyerOrgId"
      AND facility.status = 'ACTIVE'
      AND facility.valid_from <= now()
      AND (facility.valid_until IS NULL OR facility.valid_until > now())
      AND public.app_logistics_evidence_valid(facility.evidence_file_id, facility.tenant_id, admission.deal_id)
  ) THEN
    RAISE EXCEPTION 'route destination is not an active buyer facility' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."shipments" conflict
    WHERE conflict."dealId" <> NEW."dealId"
      AND (conflict."driverUserId" = NEW."driverUserId" OR conflict."vehicleNumber" = NEW."vehicleNumber")
      AND conflict."status" NOT IN ('DELIVERED', 'COMPLETED', 'CANCELLED', 'CLOSED', 'FAILED')
  ) THEN
    RAISE EXCEPTION 'driver or vehicle has a conflicting active shipment' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS shipments_validate_assignment ON public."shipments";
CREATE TRIGGER shipments_validate_assignment
BEFORE INSERT ON public."shipments"
FOR EACH ROW EXECUTE FUNCTION public.app_logistics_validate_assignment();

CREATE OR REPLACE FUNCTION public.app_logistics_bind_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, logistics
AS $function$
DECLARE
  admission_id TEXT;
  command_id TEXT;
BEGIN
  command_id := current_setting('app.current_command_id', true);
  IF command_id IS NULL OR command_id = '' THEN
    RAISE EXCEPTION 'trusted command id is required for shipment admission consumption'
      USING ERRCODE = '23514';
  END IF;

  UPDATE logistics.deal_admissions admission
  SET status = 'CONSUMED',
      consumed_at = now(),
      consumed_by_command_id = command_id,
      version = version + 1,
      updated_at = now()
  WHERE admission.tenant_id = NEW."tenantId"
    AND admission.deal_id = NEW."dealId"
    AND admission.carrier_org_id = NEW."carrierOrgId"
    AND admission.driver_user_id = NEW."driverUserId"
    AND admission.vehicle_id = NEW."vehicleNumber"
    AND admission.route_from_facility_id = NEW."routeFrom"
    AND admission.route_to_facility_id = NEW."routeTo"
    AND admission.status = 'ACTIVE'
  RETURNING admission.id INTO admission_id;

  IF admission_id IS NULL THEN
    RAISE EXCEPTION 'logistics admission consumption lost a concurrency race'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO logistics.shipment_bindings (
    id, tenant_id, deal_id, admission_id, shipment_id, command_id
  ) VALUES (
    'binding-' || md5(NEW."id" || ':' || admission_id),
    NEW."tenantId", NEW."dealId", admission_id, NEW."id", command_id
  );

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS shipments_bind_assignment ON public."shipments";
CREATE TRIGGER shipments_bind_assignment
AFTER INSERT ON public."shipments"
FOR EACH ROW EXECUTE FUNCTION public.app_logistics_bind_assignment();

CREATE OR REPLACE FUNCTION public.app_logistics_assignment_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."dealId" IS DISTINCT FROM OLD."dealId"
    OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
    OR NEW."driverUserId" IS DISTINCT FROM OLD."driverUserId"
    OR NEW."vehicleNumber" IS DISTINCT FROM OLD."vehicleNumber"
    OR NEW."carrierOrgId" IS DISTINCT FROM OLD."carrierOrgId"
    OR NEW."routeFrom" IS DISTINCT FROM OLD."routeFrom"
    OR NEW."routeTo" IS DISTINCT FROM OLD."routeTo"
  THEN
    RAISE EXCEPTION 'shipment assignment basis is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS shipments_assignment_immutable ON public."shipments";
CREATE TRIGGER shipments_assignment_immutable
BEFORE UPDATE ON public."shipments"
FOR EACH ROW EXECUTE FUNCTION public.app_logistics_assignment_immutable();

CREATE OR REPLACE FUNCTION public.app_logistics_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION 'confirmed logistics facts are append-only' USING ERRCODE = '23514';
END
$function$;

DROP TRIGGER IF EXISTS checkpoints_append_only ON public."checkpoints";
CREATE TRIGGER checkpoints_append_only
BEFORE UPDATE OR DELETE ON public."checkpoints"
FOR EACH ROW EXECUTE FUNCTION public.app_logistics_append_only();

DROP TRIGGER IF EXISTS shipment_gps_points_append_only ON public."shipment_gps_points";
CREATE TRIGGER shipment_gps_points_append_only
BEFORE UPDATE OR DELETE ON public."shipment_gps_points"
FOR EACH ROW EXECUTE FUNCTION public.app_logistics_append_only();

ALTER TABLE public."shipments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shipments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."checkpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."checkpoints" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."shipment_gps_points" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shipment_gps_points" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipments_select ON public."shipments";
DROP POLICY IF EXISTS shipments_insert ON public."shipments";
DROP POLICY IF EXISTS shipments_update ON public."shipments";
DROP POLICY IF EXISTS shipments_delete ON public."shipments";

CREATE POLICY shipments_select ON public."shipments"
FOR SELECT USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_logistics_deal_authorized("dealId", "driverUserId", false)
);

CREATE POLICY shipments_insert ON public."shipments"
FOR INSERT WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "status" = 'DRIVER_ASSIGNED'
  AND public.app_logistics_deal_authorized("dealId", "driverUserId", true)
);

CREATE POLICY shipments_update ON public."shipments"
FOR UPDATE USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_logistics_deal_authorized("dealId", "driverUserId", true)
)
WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_logistics_deal_authorized("dealId", "driverUserId", true)
);

DROP POLICY IF EXISTS checkpoints_select ON public."checkpoints";
DROP POLICY IF EXISTS checkpoints_insert ON public."checkpoints";
DROP POLICY IF EXISTS checkpoints_update ON public."checkpoints";
DROP POLICY IF EXISTS checkpoints_delete ON public."checkpoints";

CREATE POLICY checkpoints_select ON public."checkpoints"
FOR SELECT USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM public."shipments" shipment
    WHERE shipment."id" = "shipmentId"
      AND public.app_logistics_deal_authorized(shipment."dealId", shipment."driverUserId", false)
  )
);

CREATE POLICY checkpoints_insert ON public."checkpoints"
FOR INSERT WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "actorId" = current_setting('app.current_user_id', true)
  AND EXISTS (
    SELECT 1 FROM public."shipments" shipment
    WHERE shipment."id" = "shipmentId"
      AND public.app_logistics_deal_authorized(shipment."dealId", shipment."driverUserId", true)
  )
);

DROP POLICY IF EXISTS shipment_gps_points_select ON public."shipment_gps_points";
DROP POLICY IF EXISTS shipment_gps_points_insert ON public."shipment_gps_points";
DROP POLICY IF EXISTS shipment_gps_points_update ON public."shipment_gps_points";
DROP POLICY IF EXISTS shipment_gps_points_delete ON public."shipment_gps_points";

CREATE POLICY shipment_gps_points_select ON public."shipment_gps_points"
FOR SELECT USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM public."shipments" shipment
    WHERE shipment."id" = "shipmentId"
      AND public.app_logistics_deal_authorized(shipment."dealId", shipment."driverUserId", false)
  )
);

CREATE POLICY shipment_gps_points_insert ON public."shipment_gps_points"
FOR INSERT WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "actorUserId" = current_setting('app.current_user_id', true)
  AND EXISTS (
    SELECT 1 FROM public."shipments" shipment
    WHERE shipment."id" = "shipmentId"
      AND public.app_logistics_deal_authorized(shipment."dealId", shipment."driverUserId", true)
  )
);

DO $runtime_grants$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_api', 'app_deal_api', 'one_deal_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA logistics TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public."shipments" TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT ON public."checkpoints" TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT ON public."shipment_gps_points" TO %I', role_name);
      EXECUTE format('REVOKE DELETE ON public."shipments", public."checkpoints", public."shipment_gps_points" FROM %I', role_name);
      EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA logistics TO %I', role_name);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA logistics FROM %I', role_name);
    END IF;
  END LOOP;
END
$runtime_grants$;

REVOKE ALL ON FUNCTION public.app_logistics_validate_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_logistics_bind_assignment() FROM PUBLIC;
