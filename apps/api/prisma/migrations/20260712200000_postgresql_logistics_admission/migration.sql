-- Normalized PostgreSQL logistics admission registry.
--
-- Operational logistics authority is separated from Deal.sagaState. The global
-- registries describe verified carriers, drivers, vehicles, driver/vehicle links
-- and facilities. A Deal receives one immutable admission snapshot that can be
-- consumed exactly once by the assign_logistics command.

CREATE SCHEMA IF NOT EXISTS logistics;

CREATE TABLE logistics.carriers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by_user_id TEXT,
  source_hash TEXT NOT NULL,
  evidence_ref TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_carriers_org_fk FOREIGN KEY (organization_id)
    REFERENCES public."organizations"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_carriers_verifier_fk FOREIGN KEY (verified_by_user_id)
    REFERENCES public."users"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_carriers_tenant_org_unique UNIQUE (tenant_id, organization_id),
  CONSTRAINT logistics_carriers_status_check CHECK (status IN ('PENDING', 'VERIFIED', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT logistics_carriers_validity_check CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT logistics_carriers_hash_check CHECK (length(source_hash) >= 32)
);

CREATE TABLE logistics.drivers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  carrier_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by_user_id TEXT,
  source_hash TEXT NOT NULL,
  evidence_ref TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_drivers_carrier_fk FOREIGN KEY (carrier_id)
    REFERENCES logistics.carriers(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_drivers_user_fk FOREIGN KEY (user_id)
    REFERENCES public."users"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_drivers_verifier_fk FOREIGN KEY (verified_by_user_id)
    REFERENCES public."users"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_drivers_tenant_user_carrier_unique UNIQUE (tenant_id, user_id, carrier_id),
  CONSTRAINT logistics_drivers_status_check CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT logistics_drivers_validity_check CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT logistics_drivers_hash_check CHECK (length(source_hash) >= 32)
);

CREATE TABLE logistics.vehicles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  carrier_id TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  vehicle_type TEXT,
  capacity_tons NUMERIC(20,6),
  status TEXT NOT NULL DEFAULT 'PENDING',
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by_user_id TEXT,
  source_hash TEXT NOT NULL,
  evidence_ref TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_vehicles_carrier_fk FOREIGN KEY (carrier_id)
    REFERENCES logistics.carriers(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_vehicles_verifier_fk FOREIGN KEY (verified_by_user_id)
    REFERENCES public."users"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_vehicles_tenant_registration_unique UNIQUE (tenant_id, registration_number),
  CONSTRAINT logistics_vehicles_status_check CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT logistics_vehicles_capacity_check CHECK (capacity_tons IS NULL OR capacity_tons > 0),
  CONSTRAINT logistics_vehicles_validity_check CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT logistics_vehicles_hash_check CHECK (length(source_hash) >= 32)
);

CREATE TABLE logistics.driver_vehicle_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by_user_id TEXT,
  source_hash TEXT NOT NULL,
  evidence_ref TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_driver_vehicle_driver_fk FOREIGN KEY (driver_id)
    REFERENCES logistics.drivers(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_driver_vehicle_vehicle_fk FOREIGN KEY (vehicle_id)
    REFERENCES logistics.vehicles(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_driver_vehicle_verifier_fk FOREIGN KEY (verified_by_user_id)
    REFERENCES public."users"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_driver_vehicle_unique UNIQUE (tenant_id, driver_id, vehicle_id),
  CONSTRAINT logistics_driver_vehicle_status_check CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT logistics_driver_vehicle_validity_check CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT logistics_driver_vehicle_hash_check CHECK (length(source_hash) >= 32)
);

CREATE TABLE logistics.facilities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  status TEXT NOT NULL DEFAULT 'PENDING',
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by_user_id TEXT,
  source_hash TEXT NOT NULL,
  evidence_ref TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_facilities_org_fk FOREIGN KEY (organization_id)
    REFERENCES public."organizations"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_facilities_verifier_fk FOREIGN KEY (verified_by_user_id)
    REFERENCES public."users"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_facilities_kind_check CHECK (kind IN ('DISPATCH', 'ACCEPTANCE', 'BOTH')),
  CONSTRAINT logistics_facilities_status_check CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT logistics_facilities_lat_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT logistics_facilities_lng_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT logistics_facilities_validity_check CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT logistics_facilities_hash_check CHECK (length(source_hash) >= 32)
);

CREATE TABLE logistics.deal_admissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  carrier_id TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  driver_vehicle_link_id TEXT NOT NULL,
  route_from_facility_id TEXT NOT NULL,
  route_to_facility_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  approved_by_user_id TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  source_hash TEXT NOT NULL,
  evidence_ref TEXT,
  consumed_at TIMESTAMPTZ,
  consumed_by_user_id TEXT,
  consumed_by_command_id TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_deal_admissions_deal_fk FOREIGN KEY (deal_id)
    REFERENCES public."deals"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_deal_admissions_carrier_fk FOREIGN KEY (carrier_id)
    REFERENCES logistics.carriers(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_deal_admissions_driver_fk FOREIGN KEY (driver_id)
    REFERENCES logistics.drivers(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_deal_admissions_vehicle_fk FOREIGN KEY (vehicle_id)
    REFERENCES logistics.vehicles(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_deal_admissions_link_fk FOREIGN KEY (driver_vehicle_link_id)
    REFERENCES logistics.driver_vehicle_links(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_deal_admissions_from_fk FOREIGN KEY (route_from_facility_id)
    REFERENCES logistics.facilities(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_deal_admissions_to_fk FOREIGN KEY (route_to_facility_id)
    REFERENCES logistics.facilities(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_deal_admissions_approver_fk FOREIGN KEY (approved_by_user_id)
    REFERENCES public."users"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_deal_admissions_consumer_fk FOREIGN KEY (consumed_by_user_id)
    REFERENCES public."users"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_deal_admissions_deal_unique UNIQUE (deal_id),
  CONSTRAINT logistics_deal_admissions_status_check CHECK (status IN ('CONFIRMED', 'CONSUMED', 'REVOKED')),
  CONSTRAINT logistics_deal_admissions_validity_check CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT logistics_deal_admissions_hash_check CHECK (length(source_hash) >= 32),
  CONSTRAINT logistics_deal_admissions_consumption_check CHECK (
    (status = 'CONSUMED' AND consumed_at IS NOT NULL AND consumed_by_user_id IS NOT NULL AND consumed_by_command_id IS NOT NULL)
    OR (status IN ('CONFIRMED', 'REVOKED') AND consumed_at IS NULL AND consumed_by_user_id IS NULL AND consumed_by_command_id IS NULL)
  )
);

CREATE TABLE logistics.shipment_bindings (
  shipment_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  admission_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistics_shipment_bindings_shipment_fk FOREIGN KEY (shipment_id)
    REFERENCES public."shipments"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_shipment_bindings_deal_fk FOREIGN KEY (deal_id)
    REFERENCES public."deals"(id) ON DELETE RESTRICT,
  CONSTRAINT logistics_shipment_bindings_admission_fk FOREIGN KEY (admission_id)
    REFERENCES logistics.deal_admissions(id) ON DELETE RESTRICT
);

CREATE INDEX logistics_carriers_tenant_status_idx ON logistics.carriers (tenant_id, status);
CREATE INDEX logistics_drivers_tenant_carrier_status_idx ON logistics.drivers (tenant_id, carrier_id, status);
CREATE INDEX logistics_vehicles_tenant_carrier_status_idx ON logistics.vehicles (tenant_id, carrier_id, status);
CREATE INDEX logistics_driver_vehicle_tenant_status_idx ON logistics.driver_vehicle_links (tenant_id, status);
CREATE INDEX logistics_facilities_tenant_org_status_idx ON logistics.facilities (tenant_id, organization_id, status);
CREATE INDEX logistics_deal_admissions_tenant_status_idx ON logistics.deal_admissions (tenant_id, status);
CREATE INDEX logistics_shipment_bindings_deal_idx ON logistics.shipment_bindings (tenant_id, deal_id);

CREATE OR REPLACE FUNCTION logistics.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, logistics
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$function$;

CREATE TRIGGER logistics_carriers_touch BEFORE UPDATE ON logistics.carriers
  FOR EACH ROW EXECUTE FUNCTION logistics.touch_updated_at();
CREATE TRIGGER logistics_drivers_touch BEFORE UPDATE ON logistics.drivers
  FOR EACH ROW EXECUTE FUNCTION logistics.touch_updated_at();
CREATE TRIGGER logistics_vehicles_touch BEFORE UPDATE ON logistics.vehicles
  FOR EACH ROW EXECUTE FUNCTION logistics.touch_updated_at();
CREATE TRIGGER logistics_driver_vehicle_touch BEFORE UPDATE ON logistics.driver_vehicle_links
  FOR EACH ROW EXECUTE FUNCTION logistics.touch_updated_at();
CREATE TRIGGER logistics_facilities_touch BEFORE UPDATE ON logistics.facilities
  FOR EACH ROW EXECUTE FUNCTION logistics.touch_updated_at();
CREATE TRIGGER logistics_deal_admissions_touch BEFORE UPDATE ON logistics.deal_admissions
  FOR EACH ROW EXECUTE FUNCTION logistics.touch_updated_at();

CREATE OR REPLACE FUNCTION logistics.enforce_deal_admission_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, logistics
AS $function$
BEGIN
  IF ROW(
    OLD.tenant_id, OLD.deal_id, OLD.carrier_id, OLD.driver_id, OLD.vehicle_id,
    OLD.driver_vehicle_link_id, OLD.route_from_facility_id, OLD.route_to_facility_id,
    OLD.valid_from, OLD.valid_until, OLD.approved_by_user_id, OLD.approved_at,
    OLD.source_hash, OLD.evidence_ref
  ) IS DISTINCT FROM ROW(
    NEW.tenant_id, NEW.deal_id, NEW.carrier_id, NEW.driver_id, NEW.vehicle_id,
    NEW.driver_vehicle_link_id, NEW.route_from_facility_id, NEW.route_to_facility_id,
    NEW.valid_from, NEW.valid_until, NEW.approved_by_user_id, NEW.approved_at,
    NEW.source_hash, NEW.evidence_ref
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed logistics admission basis is immutable';
  END IF;

  IF OLD.status = 'CONFIRMED' AND NEW.status = 'CONSUMED' THEN
    IF current_setting('app.current_role', true) NOT IN ('LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN')
      OR NEW.consumed_at IS NULL
      OR NEW.consumed_by_user_id <> current_setting('app.current_user_id', true)
      OR NULLIF(NEW.consumed_by_command_id, '') IS NULL
      OR NEW.version <> OLD.version + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid logistics admission consumption';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'CONFIRMED' AND NEW.status = 'REVOKED' THEN
    IF NOT public.app_rls_privileged() OR NEW.version <> OLD.version + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid logistics admission revocation';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(OLD.status, OLD.consumed_at, OLD.consumed_by_user_id, OLD.consumed_by_command_id, OLD.version)
     IS DISTINCT FROM
     ROW(NEW.status, NEW.consumed_at, NEW.consumed_by_user_id, NEW.consumed_by_command_id, NEW.version) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'logistics admission transition is final';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER logistics_deal_admission_transition
  BEFORE UPDATE ON logistics.deal_admissions
  FOR EACH ROW EXECUTE FUNCTION logistics.enforce_deal_admission_transition();

CREATE OR REPLACE FUNCTION logistics.resolve_deal_admission(
  p_deal_id TEXT,
  p_carrier_org_id TEXT,
  p_driver_user_id TEXT,
  p_vehicle_id TEXT,
  p_route_from_facility_id TEXT,
  p_route_to_facility_id TEXT
)
RETURNS TABLE (
  admission_id TEXT,
  tenant_id TEXT,
  deal_id TEXT,
  carrier_id TEXT,
  carrier_org_id TEXT,
  carrier_name TEXT,
  carrier_source_hash TEXT,
  driver_id TEXT,
  driver_user_id TEXT,
  driver_name TEXT,
  driver_source_hash TEXT,
  vehicle_id TEXT,
  vehicle_registration_number TEXT,
  vehicle_type TEXT,
  vehicle_source_hash TEXT,
  driver_vehicle_link_id TEXT,
  driver_vehicle_source_hash TEXT,
  route_from_facility_id TEXT,
  route_from_name TEXT,
  route_from_source_hash TEXT,
  route_to_facility_id TEXT,
  route_to_name TEXT,
  route_to_source_hash TEXT,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  admission_source_hash TEXT,
  evidence_ref TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, logistics
STABLE
AS $function$
  SELECT
    da.id,
    da.tenant_id,
    da.deal_id,
    c.id,
    c.organization_id,
    carrier_org.name,
    c.source_hash,
    dr.id,
    dr.user_id,
    driver_user."fullName",
    dr.source_hash,
    v.id,
    v.registration_number,
    v.vehicle_type,
    v.source_hash,
    dvl.id,
    dvl.source_hash,
    origin.id,
    origin.name,
    origin.source_hash,
    destination.id,
    destination.name,
    destination.source_hash,
    da.valid_from,
    da.valid_until,
    da.source_hash,
    da.evidence_ref
  FROM logistics.deal_admissions da
  JOIN public."deals" deal ON deal.id = da.deal_id
  JOIN logistics.carriers c ON c.id = da.carrier_id
  JOIN public."organizations" carrier_org ON carrier_org.id = c.organization_id
  JOIN logistics.drivers dr ON dr.id = da.driver_id
  JOIN public."users" driver_user ON driver_user.id = dr.user_id
  JOIN public."user_orgs" driver_membership
    ON driver_membership."userId" = dr.user_id
   AND driver_membership."organizationId" = c.organization_id
   AND driver_membership.role = 'DRIVER'
  JOIN logistics.vehicles v ON v.id = da.vehicle_id
  JOIN logistics.driver_vehicle_links dvl ON dvl.id = da.driver_vehicle_link_id
  JOIN logistics.facilities origin ON origin.id = da.route_from_facility_id
  JOIN logistics.facilities destination ON destination.id = da.route_to_facility_id
  WHERE public.app_rls_context_ready()
    AND current_setting('app.current_role', true) IN ('LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN')
    AND da.tenant_id = current_setting('app.current_tenant_id', true)
    AND da.deal_id = p_deal_id
    AND public.app_rls_deal_visible(da.deal_id)
    AND c.organization_id = p_carrier_org_id
    AND dr.user_id = p_driver_user_id
    AND v.id = p_vehicle_id
    AND origin.id = p_route_from_facility_id
    AND destination.id = p_route_to_facility_id
    AND da.status = 'CONFIRMED'
    AND now() >= da.valid_from
    AND (da.valid_until IS NULL OR now() < da.valid_until)
    AND c.tenant_id = da.tenant_id
    AND c.status = 'VERIFIED'
    AND now() >= c.valid_from
    AND (c.valid_until IS NULL OR now() < c.valid_until)
    AND carrier_org."tenantId" = da.tenant_id
    AND carrier_org.status = 'VERIFIED'
    AND carrier_org."kycStatus" = 'APPROVED'
    AND dr.tenant_id = da.tenant_id
    AND dr.carrier_id = c.id
    AND dr.status = 'ACTIVE'
    AND now() >= dr.valid_from
    AND (dr.valid_until IS NULL OR now() < dr.valid_until)
    AND driver_user.status = 'ACTIVE'
    AND driver_user."deletedAt" IS NULL
    AND v.tenant_id = da.tenant_id
    AND v.carrier_id = c.id
    AND v.status = 'ACTIVE'
    AND now() >= v.valid_from
    AND (v.valid_until IS NULL OR now() < v.valid_until)
    AND dvl.tenant_id = da.tenant_id
    AND dvl.driver_id = dr.id
    AND dvl.vehicle_id = v.id
    AND dvl.status = 'ACTIVE'
    AND now() >= dvl.valid_from
    AND (dvl.valid_until IS NULL OR now() < dvl.valid_until)
    AND origin.tenant_id = da.tenant_id
    AND origin.organization_id = deal."sellerOrgId"
    AND origin.kind IN ('DISPATCH', 'BOTH')
    AND origin.status = 'ACTIVE'
    AND now() >= origin.valid_from
    AND (origin.valid_until IS NULL OR now() < origin.valid_until)
    AND destination.tenant_id = da.tenant_id
    AND destination.organization_id = deal."buyerOrgId"
    AND destination.kind IN ('ACCEPTANCE', 'BOTH')
    AND destination.status = 'ACTIVE'
    AND now() >= destination.valid_from
    AND (destination.valid_until IS NULL OR now() < destination.valid_until)
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION logistics.consume_deal_admission(
  p_admission_id TEXT,
  p_shipment_id TEXT,
  p_command_id TEXT
)
RETURNS TABLE (admission_id TEXT, status TEXT, version BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, logistics
AS $function$
DECLARE
  consumed logistics.deal_admissions%ROWTYPE;
  shipment_deal_id TEXT;
BEGIN
  IF NOT public.app_rls_context_ready()
    OR current_setting('app.current_role', true) NOT IN ('LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN')
    OR NULLIF(p_command_id, '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'trusted logistics command context is required';
  END IF;

  SELECT s."dealId" INTO shipment_deal_id
  FROM public."shipments" s
  WHERE s.id = p_shipment_id;

  UPDATE logistics.deal_admissions da
  SET status = 'CONSUMED',
      consumed_at = now(),
      consumed_by_user_id = current_setting('app.current_user_id', true),
      consumed_by_command_id = p_command_id,
      version = da.version + 1
  WHERE da.id = p_admission_id
    AND da.status = 'CONFIRMED'
    AND da.tenant_id = current_setting('app.current_tenant_id', true)
    AND da.deal_id = shipment_deal_id
    AND public.app_rls_deal_visible(da.deal_id)
  RETURNING da.* INTO consumed;

  IF consumed.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'logistics admission cannot be consumed';
  END IF;

  INSERT INTO logistics.shipment_bindings (shipment_id, tenant_id, deal_id, admission_id)
  VALUES (p_shipment_id, consumed.tenant_id, consumed.deal_id, consumed.id)
  ON CONFLICT (shipment_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM logistics.shipment_bindings sb
    WHERE sb.shipment_id = p_shipment_id
      AND sb.tenant_id = consumed.tenant_id
      AND sb.deal_id = consumed.deal_id
      AND sb.admission_id = consumed.id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'shipment is bound to a different logistics admission';
  END IF;

  RETURN QUERY SELECT consumed.id, consumed.status, consumed.version;
END
$function$;

REVOKE ALL ON FUNCTION logistics.resolve_deal_admission(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION logistics.consume_deal_admission(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION logistics.touch_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION logistics.enforce_deal_admission_transition() FROM PUBLIC;

ALTER TABLE logistics.carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.carriers FORCE ROW LEVEL SECURITY;
ALTER TABLE logistics.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.drivers FORCE ROW LEVEL SECURITY;
ALTER TABLE logistics.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.vehicles FORCE ROW LEVEL SECURITY;
ALTER TABLE logistics.driver_vehicle_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.driver_vehicle_links FORCE ROW LEVEL SECURITY;
ALTER TABLE logistics.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.facilities FORCE ROW LEVEL SECURITY;
ALTER TABLE logistics.deal_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.deal_admissions FORCE ROW LEVEL SECURITY;
ALTER TABLE logistics.shipment_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.shipment_bindings FORCE ROW LEVEL SECURITY;

CREATE POLICY logistics_carriers_select ON logistics.carriers FOR SELECT USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR organization_id = current_setting('app.current_org_id', true)
    OR EXISTS (
      SELECT 1 FROM logistics.deal_admissions da
      WHERE da.carrier_id = carriers.id AND public.app_rls_deal_visible(da.deal_id)
    )
  )
);
CREATE POLICY logistics_carriers_insert ON logistics.carriers FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
);
CREATE POLICY logistics_carriers_update ON logistics.carriers FOR UPDATE USING (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
) WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
);

CREATE POLICY logistics_drivers_select ON logistics.drivers FOR SELECT USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR EXISTS (SELECT 1 FROM logistics.carriers c WHERE c.id = drivers.carrier_id AND c.organization_id = current_setting('app.current_org_id', true))
    OR EXISTS (SELECT 1 FROM logistics.deal_admissions da WHERE da.driver_id = drivers.id AND public.app_rls_deal_visible(da.deal_id))
  )
);
CREATE POLICY logistics_drivers_insert ON logistics.drivers FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
);
CREATE POLICY logistics_drivers_update ON logistics.drivers FOR UPDATE USING (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
) WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
);

CREATE POLICY logistics_vehicles_select ON logistics.vehicles FOR SELECT USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR EXISTS (SELECT 1 FROM logistics.carriers c WHERE c.id = vehicles.carrier_id AND c.organization_id = current_setting('app.current_org_id', true))
    OR EXISTS (SELECT 1 FROM logistics.deal_admissions da WHERE da.vehicle_id = vehicles.id AND public.app_rls_deal_visible(da.deal_id))
  )
);
CREATE POLICY logistics_vehicles_insert ON logistics.vehicles FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
);
CREATE POLICY logistics_vehicles_update ON logistics.vehicles FOR UPDATE USING (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
) WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
);

CREATE POLICY logistics_driver_vehicle_select ON logistics.driver_vehicle_links FOR SELECT USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR EXISTS (SELECT 1 FROM logistics.deal_admissions da WHERE da.driver_vehicle_link_id = driver_vehicle_links.id AND public.app_rls_deal_visible(da.deal_id))
  )
);
CREATE POLICY logistics_driver_vehicle_insert ON logistics.driver_vehicle_links FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
);
CREATE POLICY logistics_driver_vehicle_update ON logistics.driver_vehicle_links FOR UPDATE USING (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
) WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
);

CREATE POLICY logistics_facilities_select ON logistics.facilities FOR SELECT USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR organization_id = current_setting('app.current_org_id', true)
    OR EXISTS (
      SELECT 1 FROM logistics.deal_admissions da
      WHERE (da.route_from_facility_id = facilities.id OR da.route_to_facility_id = facilities.id)
        AND public.app_rls_deal_visible(da.deal_id)
    )
  )
);
CREATE POLICY logistics_facilities_insert ON logistics.facilities FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
);
CREATE POLICY logistics_facilities_update ON logistics.facilities FOR UPDATE USING (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
) WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
);

CREATE POLICY logistics_deal_admissions_select ON logistics.deal_admissions FOR SELECT USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible(deal_id)
);
CREATE POLICY logistics_deal_admissions_insert ON logistics.deal_admissions FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible(deal_id)
);
CREATE POLICY logistics_deal_admissions_update ON logistics.deal_admissions FOR UPDATE USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND current_setting('app.current_role', true) IN ('LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN')
  AND public.app_rls_deal_visible(deal_id)
) WITH CHECK (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND current_setting('app.current_role', true) IN ('LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN')
  AND public.app_rls_deal_visible(deal_id)
);

CREATE POLICY logistics_shipment_bindings_select ON logistics.shipment_bindings FOR SELECT USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible(deal_id)
);
CREATE POLICY logistics_shipment_bindings_insert ON logistics.shipment_bindings FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND current_setting('app.current_role', true) IN ('LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN')
  AND public.app_rls_deal_visible(deal_id)
);

DO $grant_logistics_runtime$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_deal_api', 'one_deal_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA logistics TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION logistics.resolve_deal_admission(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION logistics.consume_deal_admission(TEXT, TEXT, TEXT) TO %I', role_name);
    END IF;
  END LOOP;
END
$grant_logistics_runtime$;

COMMENT ON SCHEMA logistics IS 'Tenant-isolated verified logistics registry and immutable per-deal admission snapshots.';
COMMENT ON FUNCTION logistics.resolve_deal_admission(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Returns one active normalized carrier/driver/vehicle/facility admission for a visible deal and trusted logistics actor.';
COMMENT ON FUNCTION logistics.consume_deal_admission(TEXT, TEXT, TEXT) IS
  'Atomically consumes one confirmed deal admission and binds it to one shipment.';
