-- P0.2-2A hardening: additive provider-evidence binding, pre-mutation
-- stale checks, tenant-scoped command identity and database-enforced scope.
-- No provider call, credential, raw XML, UI or lot publication is added here.

-- ── Composite scope keys and foreign keys ───────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "fgis_provider_config_scope_identity_key"
  ON public."fgis_grain_provider_configurations" ("id", "tenantId", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "fgis_tenant_read_claim_scope_identity_key"
  ON public."fgis_grain_tenant_read_provider_claims" ("id", "tenantId", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "fgis_tenant_read_audit_scope_claim_key"
  ON public."fgis_grain_tenant_read_audits"
  ("id", "tenantId", "organizationId", "providerClaimId");
CREATE UNIQUE INDEX IF NOT EXISTS "fgis_commodity_connection_scope_identity_key"
  ON public."fgis_grain_organization_connections" ("id", "tenantId", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "fgis_commodity_sync_scope_identity_key"
  ON public."fgis_grain_sync_runs" ("id", "tenantId", "organizationId", "connectionId");
CREATE UNIQUE INDEX IF NOT EXISTS "fgis_commodity_snapshot_scope_identity_key"
  ON public."fgis_grain_party_snapshots"
  ("id", "tenantId", "organizationId", "connectionId", "externalPartyId");
CREATE UNIQUE INDEX IF NOT EXISTS "fgis_commodity_snapshot_scope_short_key"
  ON public."fgis_grain_party_snapshots" ("id", "tenantId", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "fgis_commodity_current_scope_identity_key"
  ON public."fgis_grain_party_current" ("id", "tenantId", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "fgis_commodity_reservation_scope_identity_key"
  ON public."commodity_reservations" ("id", "tenantId", "organizationId");

ALTER TABLE public."fgis_grain_organization_connections"
  ADD CONSTRAINT "fgis_commodity_connection_config_scope_fk"
  FOREIGN KEY ("providerConfigurationId", "tenantId", "organizationId")
  REFERENCES public."fgis_grain_provider_configurations"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public."fgis_grain_sync_runs"
  ADD CONSTRAINT "fgis_commodity_sync_connection_scope_fk"
  FOREIGN KEY ("connectionId", "tenantId", "organizationId")
  REFERENCES public."fgis_grain_organization_connections"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public."fgis_grain_party_snapshots"
  ADD CONSTRAINT "fgis_commodity_snapshot_connection_scope_fk"
  FOREIGN KEY ("connectionId", "tenantId", "organizationId")
  REFERENCES public."fgis_grain_organization_connections"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_commodity_snapshot_sync_scope_fk"
  FOREIGN KEY ("syncRunId", "tenantId", "organizationId", "connectionId")
  REFERENCES public."fgis_grain_sync_runs"("id", "tenantId", "organizationId", "connectionId")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public."fgis_grain_party_current"
  ADD CONSTRAINT "fgis_commodity_current_connection_scope_fk"
  FOREIGN KEY ("connectionId", "tenantId", "organizationId")
  REFERENCES public."fgis_grain_organization_connections"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_commodity_current_snapshot_scope_fk"
  FOREIGN KEY ("currentSnapshotId", "tenantId", "organizationId", "connectionId", "externalPartyId")
  REFERENCES public."fgis_grain_party_snapshots"
    ("id", "tenantId", "organizationId", "connectionId", "externalPartyId")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public."commodity_reservations"
  ADD CONSTRAINT "fgis_commodity_reservation_current_scope_fk"
  FOREIGN KEY ("partyCurrentId", "tenantId", "organizationId")
  REFERENCES public."fgis_grain_party_current"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_commodity_reservation_snapshot_scope_fk"
  FOREIGN KEY ("sourceSnapshotId", "tenantId", "organizationId")
  REFERENCES public."fgis_grain_party_snapshots"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public."fgis_grain_lot_passports"
  ADD CONSTRAINT "fgis_commodity_passport_current_scope_fk"
  FOREIGN KEY ("partyCurrentId", "tenantId", "organizationId")
  REFERENCES public."fgis_grain_party_current"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_commodity_passport_snapshot_scope_fk"
  FOREIGN KEY ("sourceSnapshotId", "tenantId", "organizationId")
  REFERENCES public."fgis_grain_party_snapshots"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_commodity_passport_reservation_scope_fk"
  FOREIGN KEY ("reservationId", "tenantId", "organizationId")
  REFERENCES public."commodity_reservations"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public."fgis_grain_reconciliation_cases"
  ADD CONSTRAINT "fgis_commodity_reconciliation_current_scope_fk"
  FOREIGN KEY ("partyCurrentId", "tenantId", "organizationId")
  REFERENCES public."fgis_grain_party_current"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_commodity_reconciliation_previous_snapshot_scope_fk"
  FOREIGN KEY ("previousSnapshotId", "tenantId", "organizationId")
  REFERENCES public."fgis_grain_party_snapshots"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_commodity_reconciliation_actual_snapshot_scope_fk"
  FOREIGN KEY ("actualSnapshotId", "tenantId", "organizationId")
  REFERENCES public."fgis_grain_party_snapshots"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "fgis_commodity_reconciliation_reservation_scope_fk"
  FOREIGN KEY ("reservationId", "tenantId", "organizationId")
  REFERENCES public."commodity_reservations"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- ── Mandatory server-derived provider evidence ───────────────────────────────

ALTER TABLE public."fgis_grain_party_snapshots"
  ADD COLUMN "providerClaimId" text,
  ADD COLUMN "providerAuditId" text,
  ADD COLUMN "providerResponseReference" text,
  ADD COLUMN "providerResponseSha256" char(64);

CREATE OR REPLACE FUNCTION fgis_commodity.bind_snapshot_provider_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_claim_id text;
  v_audit_id text;
  v_response_reference text;
  v_response_sha256 text;
BEGIN
  SELECT audit."providerClaimId", audit."id", audit."responseReference", audit."responseSha256"
  INTO v_claim_id, v_audit_id, v_response_reference, v_response_sha256
  FROM public."fgis_grain_sync_runs" run
  JOIN public."fgis_grain_organization_connections" connection
    ON connection."id" = run."connectionId"
   AND connection."tenantId" = run."tenantId"
   AND connection."organizationId" = run."organizationId"
  JOIN public."fgis_grain_tenant_read_audits" audit
    ON audit."tenantId" = run."tenantId"
   AND audit."organizationId" = run."organizationId"
   AND audit."correlationId" = run."correlationId"
   AND audit."operationCode" = run."operationCode"
   AND audit."configurationId" = connection."providerConfigurationId"
   AND audit."decision" = 'SUCCEEDED'
  JOIN public."fgis_grain_tenant_read_provider_claims" claim
    ON claim."id" = audit."providerClaimId"
   AND claim."tenantId" = audit."tenantId"
   AND claim."organizationId" = audit."organizationId"
   AND claim."configurationId" = audit."configurationId"
   AND claim."operationCode" = audit."operationCode"
   AND claim."completedAuditId" = audit."id"
   AND claim."completedAt" IS NOT NULL
  WHERE run."id" = NEW."syncRunId"
    AND run."connectionId" = NEW."connectionId"
    AND run."tenantId" = NEW."tenantId"
    AND run."organizationId" = NEW."organizationId"
    AND run."operationCode" = 'GET_LIST_LOT'
    AND audit."responseReference" IS NOT NULL
    AND audit."responseSha256" IS NOT NULL
    AND audit."receivedAt" IS NOT NULL
  ORDER BY audit."createdAt" DESC, audit."id" DESC
  LIMIT 1;

  IF v_claim_id IS NULL OR v_audit_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_PARTY_PROVIDER_EVIDENCE_REQUIRED';
  END IF;

  NEW."providerClaimId" := v_claim_id;
  NEW."providerAuditId" := v_audit_id;
  NEW."providerResponseReference" := v_response_reference;
  NEW."providerResponseSha256" := v_response_sha256;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "00_fgis_grain_snapshot_provider_evidence"
BEFORE INSERT ON public."fgis_grain_party_snapshots"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.bind_snapshot_provider_evidence();

ALTER TABLE public."fgis_grain_party_snapshots"
  ADD CONSTRAINT "fgis_commodity_snapshot_provider_evidence_required_ck"
  CHECK (
    "providerClaimId" IS NOT NULL
    AND "providerAuditId" IS NOT NULL
    AND "providerResponseReference" IS NOT NULL
    AND "providerResponseSha256" IS NOT NULL
  ) NOT VALID,
  ADD CONSTRAINT "fgis_commodity_snapshot_provider_response_hash_ck"
  CHECK ("providerResponseSha256" ~ '^[a-f0-9]{64}$') NOT VALID,
  ADD CONSTRAINT "fgis_commodity_snapshot_provider_response_reference_ck"
  CHECK (
    length("providerResponseReference") <= 522
    AND "providerResponseReference" ~ '^(provider-response|object-store)://[A-Za-z0-9][A-Za-z0-9:_.\/-]{2}[A-Za-z0-9:_.\/-]*$'
    AND position('@' IN "providerResponseReference") = 0
    AND "providerResponseReference" !~* '(-----BEGIN|<Signature|<soap:|password=|token=|secret=|privateKey|certificateBytes|Authorization:)'
  ) NOT VALID,
  ADD CONSTRAINT "fgis_commodity_snapshot_provider_claim_scope_fk"
  FOREIGN KEY ("providerClaimId", "tenantId", "organizationId")
  REFERENCES public."fgis_grain_tenant_read_provider_claims"("id", "tenantId", "organizationId")
  ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT "fgis_commodity_snapshot_provider_audit_scope_fk"
  FOREIGN KEY ("providerAuditId", "tenantId", "organizationId", "providerClaimId")
  REFERENCES public."fgis_grain_tenant_read_audits"
    ("id", "tenantId", "organizationId", "providerClaimId")
  ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID;

ALTER TABLE public."fgis_grain_party_snapshots"
  VALIDATE CONSTRAINT "fgis_commodity_snapshot_provider_evidence_required_ck";
ALTER TABLE public."fgis_grain_party_snapshots"
  VALIDATE CONSTRAINT "fgis_commodity_snapshot_provider_response_hash_ck";
ALTER TABLE public."fgis_grain_party_snapshots"
  VALIDATE CONSTRAINT "fgis_commodity_snapshot_provider_response_reference_ck";
ALTER TABLE public."fgis_grain_party_snapshots"
  VALIDATE CONSTRAINT "fgis_commodity_snapshot_provider_claim_scope_fk";
ALTER TABLE public."fgis_grain_party_snapshots"
  VALIDATE CONSTRAINT "fgis_commodity_snapshot_provider_audit_scope_fk";

-- ── Tenant/org-scoped command identity ──────────────────────────────────────

ALTER TABLE public."fgis_grain_commodity_commands"
  DROP CONSTRAINT IF EXISTS "fgis_grain_commodity_commands_commandId_key";
ALTER TABLE public."fgis_grain_commodity_commands"
  ADD CONSTRAINT "fgis_grain_commodity_command_scoped_command_key"
  UNIQUE ("tenantId", "organizationId", "commandType", "commandId");

-- ── Verified snapshot command; original command is revoked from app roles ───

REVOKE ALL ON FUNCTION fgis_commodity.accept_party_snapshot(
  text, text, jsonb, bigint, text, text, text
) FROM PUBLIC;

DO $revoke$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_deal', 'app_service', 'app_runtime'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL ON FUNCTION fgis_commodity.accept_party_snapshot(text,text,jsonb,bigint,text,text,text) FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END
$revoke$;

CREATE OR REPLACE FUNCTION fgis_commodity.accept_party_snapshot_verified(
  p_connection_id text,
  p_sync_run_id text,
  p_snapshot jsonb,
  p_expected_current_version bigint,
  p_command_id text,
  p_idempotency_key text,
  p_correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_tenant text := NULLIF(current_setting('app.current_tenant_id', true), '');
  v_org text := NULLIF(current_setting('app.current_org_id', true), '');
  v_user text := NULLIF(current_setting('app.current_user_id', true), '');
  v_role text := NULLIF(current_setting('app.current_role', true), '');
  v_external_party_id text := NULLIF(btrim(p_snapshot->>'externalPartyId'), '');
  v_request_hash text;
  v_replay jsonb;
  v_current_version bigint;
  v_connection public."fgis_grain_organization_connections"%ROWTYPE;
  v_run public."fgis_grain_sync_runs"%ROWTYPE;
  v_provider_audit_id text;
  v_original_role text;
  v_result jsonb;
BEGIN
  IF v_tenant IS NULL OR v_org IS NULL OR v_user IS NULL OR v_role <> 'FGIS_GRAIN_PROVIDER' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_PARTY_PROVIDER_PRINCIPAL_REQUIRED';
  END IF;
  IF v_external_party_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_PARTY_EXTERNAL_ID_REQUIRED';
  END IF;

  v_request_hash := encode(digest(convert_to(concat_ws('|',
    p_connection_id, p_sync_run_id, p_snapshot::text, p_expected_current_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  v_replay := fgis_commodity.replay_command('ACCEPT_PARTY_SNAPSHOT', p_idempotency_key, v_request_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  PERFORM fgis_commodity.lock_key(v_tenant || ':party:' || v_external_party_id);

  SELECT * INTO v_connection
  FROM public."fgis_grain_organization_connections"
  WHERE "id" = p_connection_id AND "tenantId" = v_tenant AND "organizationId" = v_org
  FOR UPDATE;
  IF NOT FOUND OR v_connection."status" <> 'BOUND' THEN
    RETURN fgis_commodity.deny_command(
      'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_connection_id, 'FGIS_CONNECTION_NOT_BOUND', p_correlation_id, '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_run
  FROM public."fgis_grain_sync_runs"
  WHERE "id" = p_sync_run_id
    AND "connectionId" = p_connection_id
    AND "tenantId" = v_tenant
    AND "organizationId" = v_org
    AND "operationCode" = 'GET_LIST_LOT'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN fgis_commodity.deny_command(
      'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_SYNC_RUN', p_sync_run_id, 'FGIS_SYNC_RUN_NOT_PROCESSABLE', p_correlation_id, '{}'::jsonb
    );
  END IF;

  SELECT audit."id" INTO v_provider_audit_id
  FROM public."fgis_grain_tenant_read_audits" audit
  JOIN public."fgis_grain_tenant_read_provider_claims" claim
    ON claim."id" = audit."providerClaimId"
   AND claim."tenantId" = audit."tenantId"
   AND claim."organizationId" = audit."organizationId"
   AND claim."completedAuditId" = audit."id"
   AND claim."completedAt" IS NOT NULL
  WHERE audit."tenantId" = v_tenant
    AND audit."organizationId" = v_org
    AND audit."correlationId" = v_run."correlationId"
    AND audit."operationCode" = 'GET_LIST_LOT'
    AND audit."configurationId" = v_connection."providerConfigurationId"
    AND audit."decision" = 'SUCCEEDED'
    AND audit."responseReference" IS NOT NULL
    AND audit."responseSha256" IS NOT NULL
    AND audit."receivedAt" IS NOT NULL
  LIMIT 1;
  IF v_provider_audit_id IS NULL THEN
    RETURN fgis_commodity.deny_command(
      'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_SYNC_RUN', p_sync_run_id, 'FGIS_PARTY_PROVIDER_EVIDENCE_REQUIRED', p_correlation_id, '{}'::jsonb
    );
  END IF;

  SELECT "version" INTO v_current_version
  FROM public."fgis_grain_party_current"
  WHERE "tenantId" = v_tenant
    AND "organizationId" = v_org
    AND "externalPartyId" = v_external_party_id
  FOR UPDATE;

  IF FOUND AND v_current_version <> p_expected_current_version THEN
    RETURN fgis_commodity.deny_command(
      'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', v_external_party_id, 'FGIS_PARTY_CURRENT_STALE_VERSION', p_correlation_id,
      jsonb_build_object('actualVersion', v_current_version::text, 'expectedVersion', p_expected_current_version::text)
    );
  ELSIF NOT FOUND AND p_expected_current_version <> 0 THEN
    RETURN fgis_commodity.deny_command(
      'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', v_external_party_id, 'FGIS_PARTY_CURRENT_STALE_VERSION', p_correlation_id,
      jsonb_build_object('actualVersion', '0', 'expectedVersion', p_expected_current_version::text)
    );
  END IF;

  v_original_role := v_role;
  PERFORM set_config('app.current_role', 'SERVICE', true);
  v_result := fgis_commodity.accept_party_snapshot(
    p_connection_id, p_sync_run_id, p_snapshot, p_expected_current_version,
    p_command_id, p_idempotency_key, p_correlation_id
  );
  PERFORM set_config('app.current_role', v_original_role, true);
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION fgis_commodity.accept_party_snapshot_verified(
  text, text, jsonb, bigint, text, text, text
) FROM PUBLIC;

DO $grant$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_deal', 'app_service', 'app_runtime'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION fgis_commodity.accept_party_snapshot_verified(text,text,jsonb,bigint,text,text,text) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$grant$;
