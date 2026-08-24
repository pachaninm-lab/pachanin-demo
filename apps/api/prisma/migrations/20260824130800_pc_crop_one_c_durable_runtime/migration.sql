-- PC-CROP Federal Accounting / 1C durable connector runtime.
--
-- Adds bounded heartbeat evidence and a pull-only command runtime on top of the
-- already accepted installation/binding/machine-credential authority. Ordinary
-- application roles retain no connector-table CRUD. All scope is resolved from
-- persistent credential/binding facts by fixed SECURITY DEFINER functions.
-- No function accepts SQL, a procedure name, an RPC name, or an arbitrary
-- operation outside the seven commands in protocol v1.

-- Extend the canonical 1C audit writer with the durable job aggregate. Keep
-- the existing hash-chain and secret-field refusal unchanged.
CREATE OR REPLACE FUNCTION connector.append_one_c_audit(
  p_action text,
  p_actor_user_id text,
  p_actor_role text,
  p_tenant_id text,
  p_org_id text,
  p_object_type text,
  p_object_id text,
  p_outcome text,
  p_reason text,
  p_metadata jsonb,
  p_correlation_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_id text := 'one-c-audit-' || gen_random_uuid()::text;
  v_prev_hash text;
  v_hash text;
  v_material jsonb;
BEGIN
  IF p_action IS NULL OR length(btrim(p_action)) NOT BETWEEN 3 AND 128 THEN
    RAISE EXCEPTION 'ONE_C_AUDIT_ACTION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_object_type NOT IN (
    'ONE_C_PAIRING', 'ONE_C_BINDING', 'ONE_C_CREDENTIAL', 'ONE_C_JOB'
  ) THEN
    RAISE EXCEPTION 'ONE_C_AUDIT_OBJECT_TYPE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_outcome NOT IN ('SUCCESS', 'DENIED', 'FAILURE') THEN
    RAISE EXCEPTION 'ONE_C_AUDIT_OUTCOME_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_metadata::text ~* '(bearer|secret_hash|code_hash|lookup_hash|salt|pairingCode|authorization)' THEN
    RAISE EXCEPTION 'ONE_C_AUDIT_SECRET_FIELD_REFUSED' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'pc-one-c:' || p_tenant_id || ':' || p_org_id || ':'
        || p_object_type || ':' || p_object_id,
      0
    )
  );

  SELECT event."hash" INTO v_prev_hash
    FROM public.audit_events event
   WHERE event."tenantId" = p_tenant_id
     AND event."orgId" = p_org_id
     AND event."objectType" = p_object_type
     AND event."objectId" = p_object_id
   ORDER BY event."createdAt" DESC, event."id" DESC
   LIMIT 1;

  v_material := jsonb_build_object(
    'action', p_action,
    'actorUserId', p_actor_user_id,
    'actorRole', p_actor_role,
    'tenantId', p_tenant_id,
    'orgId', p_org_id,
    'objectType', p_object_type,
    'objectId', p_object_id,
    'outcome', p_outcome,
    'reason', p_reason,
    'metadata', COALESCE(p_metadata, '{}'::jsonb),
    'correlationId', p_correlation_id,
    'prevHash', v_prev_hash
  );
  v_hash := encode(digest(convert_to(v_material::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.audit_events (
    "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
    "objectType", "objectId", "outcome", "reason", "metadata",
    "correlationId", "hash", "prevHash", "createdAt"
  ) VALUES (
    v_id, p_action, p_actor_user_id, p_actor_role, p_tenant_id, p_org_id,
    p_object_type, p_object_id, p_outcome, p_reason,
    COALESCE(p_metadata, '{}'::jsonb), p_correlation_id, v_hash, v_prev_hash,
    clock_timestamp()
  );

  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION connector.one_c_diagnostics_are_valid(p_values text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, connector
AS $function$
  SELECT
    cardinality(p_values) BETWEEN 0 AND 8
    AND NOT EXISTS (
      SELECT 1
        FROM unnest(p_values) AS diagnostic(code)
       WHERE diagnostic.code NOT IN (
         'ONE_C_UNAVAILABLE', 'DATABASE_UNAVAILABLE',
         'EXTENSION_VERSION_MISMATCH', 'PERMISSION_DENIED', 'CLOCK_SKEW',
         'UNSUPPORTED_CONFIGURATION', 'BACKGROUND_JOB_DISABLED',
         'NETWORK_DEGRADED', 'LOCAL_QUEUE_BACKLOG'
       )
    )
    AND cardinality(p_values) = (
      SELECT count(DISTINCT diagnostic.code)::integer
        FROM unnest(p_values) AS diagnostic(code)
    );
$function$;

CREATE TABLE connector.one_c_runtime_state (
  binding_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  installation_id text NOT NULL,
  credential_id text NOT NULL,
  protocol_version text NOT NULL,
  reported_connector_version text NOT NULL,
  reported_platform_version text NOT NULL,
  reported_configuration_version text NOT NULL,
  health_state text NOT NULL,
  diagnostic_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  heartbeat_count bigint NOT NULL DEFAULT 1,
  first_heartbeat_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_correlation_id text NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT one_c_runtime_state_binding_fk FOREIGN KEY (binding_id)
    REFERENCES connector.one_c_bindings(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_runtime_state_installation_fk FOREIGN KEY (installation_id)
    REFERENCES connector.one_c_installations(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_runtime_state_credential_fk FOREIGN KEY (credential_id)
    REFERENCES connector.one_c_machine_credentials(credential_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_runtime_state_organization_fk FOREIGN KEY (organization_id, tenant_id)
    REFERENCES public.organizations(id, "tenantId") ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_runtime_state_protocol_ck CHECK (protocol_version = '1'),
  CONSTRAINT one_c_runtime_state_connector_version_ck CHECK (
    length(btrim(reported_connector_version)) BETWEEN 1 AND 64
    AND reported_connector_version ~ '^[A-Za-z0-9._+() -]+$'
  ),
  CONSTRAINT one_c_runtime_state_platform_version_ck CHECK (
    length(btrim(reported_platform_version)) BETWEEN 1 AND 96
    AND reported_platform_version ~ '^[A-Za-z0-9._+() -]+$'
  ),
  CONSTRAINT one_c_runtime_state_configuration_version_ck CHECK (
    length(btrim(reported_configuration_version)) BETWEEN 1 AND 96
    AND reported_configuration_version ~ '^[A-Za-z0-9._+() -]+$'
  ),
  CONSTRAINT one_c_runtime_state_health_ck CHECK (health_state IN ('READY', 'DEGRADED', 'BLOCKED')),
  CONSTRAINT one_c_runtime_state_diagnostics_ck CHECK (
    connector.one_c_diagnostics_are_valid(diagnostic_codes)
  ),
  CONSTRAINT one_c_runtime_state_health_diagnostics_ck CHECK (
    (health_state = 'READY' AND cardinality(diagnostic_codes) = 0)
    OR (health_state <> 'READY' AND cardinality(diagnostic_codes) BETWEEN 1 AND 8)
  ),
  CONSTRAINT one_c_runtime_state_count_ck CHECK (heartbeat_count >= 1),
  CONSTRAINT one_c_runtime_state_time_ck CHECK (last_heartbeat_at >= first_heartbeat_at),
  CONSTRAINT one_c_runtime_state_correlation_ck CHECK (
    last_correlation_id ~ '^[A-Za-z0-9:_.@-]{1,128}$'
  ),
  CONSTRAINT one_c_runtime_state_version_ck CHECK (version >= 0)
);

CREATE INDEX one_c_runtime_state_health_idx
  ON connector.one_c_runtime_state (health_state, last_heartbeat_at DESC, binding_id);
CREATE INDEX one_c_runtime_state_org_idx
  ON connector.one_c_runtime_state (tenant_id, organization_id, last_heartbeat_at DESC);

CREATE TRIGGER one_c_runtime_state_no_delete
BEFORE DELETE ON connector.one_c_runtime_state
FOR EACH ROW EXECUTE FUNCTION connector.reject_one_c_delete();

CREATE OR REPLACE FUNCTION connector.guard_one_c_runtime_state_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, connector
AS $function$
BEGIN
  IF NEW.binding_id IS DISTINCT FROM OLD.binding_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.installation_id IS DISTINCT FROM OLD.installation_id
     OR NEW.first_heartbeat_at IS DISTINCT FROM OLD.first_heartbeat_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION '1C runtime state identity is immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW.version <> OLD.version + 1 OR NEW.heartbeat_count <> OLD.heartbeat_count + 1 THEN
    RAISE EXCEPTION '1C heartbeat version and counter must advance by one' USING ERRCODE = '40001';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION connector.read_one_c_jobs(
  p_status text,
  p_limit integer,
  p_correlation_id text
)
RETURNS TABLE (
  job_id text, command text, payload_hash text, idempotency_key text,
  correlation_id text, external_id text, status text, sync_state text,
  revision bigint, attempt integer, max_attempts integer, terminal_code text,
  external_evidence_id text, acknowledged_at timestamptz,
  completed_at timestamptz, reconciliation_required_at timestamptz,
  dead_letter_at timestamptz, created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_tenant_id text := current_setting('app.current_tenant_id', true);
  v_org_id text := current_setting('app.current_org_id', true);
BEGIN
  IF public.app_pc_crop_membership_id() IS NULL THEN
    RAISE EXCEPTION 'ONE_C_ACTIVE_ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 100
     OR (p_status IS NOT NULL AND p_status NOT IN (
       'QUEUED', 'LEASED', 'ACKNOWLEDGED', 'SUCCEEDED', 'REJECTED',
       'RECONCILIATION_REQUIRED', 'DEAD_LETTER'
     )) OR p_correlation_id IS NULL
     OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$' THEN
    RAISE EXCEPTION 'ONE_C_JOB_READ_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM connector.expire_one_c_job_leases(
    v_tenant_id, v_org_id, NULL, p_correlation_id
  );
  RETURN QUERY
  SELECT job.id, job.command, job.payload_hash::text, job.idempotency_key,
         job.correlation_id, job.external_id, job.status, job.sync_state,
         job.revision, job.attempt, job.max_attempts, job.terminal_code,
         job.external_evidence_id, job.acknowledged_at, job.completed_at,
         job.reconciliation_required_at, job.dead_letter_at,
         job.created_at, job.updated_at
    FROM connector.one_c_jobs job
   WHERE job.tenant_id = v_tenant_id AND job.organization_id = v_org_id
     AND (p_status IS NULL OR job.status = p_status)
   ORDER BY job.created_at DESC, job.id DESC LIMIT p_limit;
END
$function$;

CREATE OR REPLACE FUNCTION connector.reconcile_one_c_job(
  p_job_id text,
  p_receipt_idempotency_key text,
  p_action text,
  p_reason_code text,
  p_external_evidence_id text,
  p_correlation_id text
)
RETURNS TABLE (job_id text, status text, sync_state text, revision bigint, replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_tenant_id text := current_setting('app.current_tenant_id', true);
  v_org_id text := current_setting('app.current_org_id', true);
  v_membership_id text := public.app_pc_crop_membership_id();
  v_job record;
  v_receipt record;
  v_actor record;
  v_hash text;
  v_target_status text;
  v_target_sync text;
  v_revision bigint;
  v_needs_evidence boolean;
BEGIN
  v_needs_evidence := p_action IN ('CONFIRM_CREATED_IN_1C', 'CONFIRM_POSTED');
  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'ONE_C_ACTIVE_ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_job_id IS NULL OR p_job_id !~ '^[A-Za-z0-9:_.@-]{1,240}$'
     OR p_receipt_idempotency_key IS NULL
     OR p_receipt_idempotency_key !~ '^[A-Za-z0-9:_.@-]{1,240}$'
     OR p_action NOT IN (
       'REQUEUE_CONFIRMED_NO_EFFECT', 'CONFIRM_CREATED_IN_1C', 'CONFIRM_POSTED',
       'CONFIRM_REJECTED', 'DEAD_LETTER'
     ) OR p_reason_code !~ '^[A-Z0-9][A-Z0-9_.:-]{0,95}$'
     OR (v_needs_evidence AND (
       p_external_evidence_id IS NULL
       OR p_external_evidence_id !~ '^[A-Za-z0-9:_.@/-]{1,240}$'
     )) OR (NOT v_needs_evidence AND p_external_evidence_id IS NOT NULL)
     OR p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$' THEN
    RAISE EXCEPTION 'ONE_C_JOB_RECONCILIATION_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT membership."userId" AS user_id, membership.role AS role
    INTO v_actor FROM public.user_orgs membership
   WHERE membership.id = v_membership_id AND membership."organizationId" = v_org_id
     AND membership.status = 'ACTIVE' LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONE_C_ACTIVE_ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_job FROM connector.one_c_jobs job
   WHERE job.id = p_job_id AND job.tenant_id = v_tenant_id
     AND job.organization_id = v_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ONE_C_JOB_NOT_FOUND' USING ERRCODE = 'P1C02'; END IF;

  v_hash := encode(digest(convert_to(jsonb_build_object(
    'kind', 'RECONCILIATION', 'jobId', p_job_id, 'action', p_action,
    'reasonCode', p_reason_code, 'externalEvidenceId', p_external_evidence_id
  )::text, 'UTF8'), 'sha256'), 'hex');
  SELECT * INTO v_receipt FROM connector.one_c_job_receipts receipt
   WHERE receipt.job_id = v_job.id AND receipt.idempotency_key = p_receipt_idempotency_key;
  IF FOUND THEN
    IF v_receipt.receipt_kind <> 'RECONCILIATION' OR v_receipt.receipt_hash <> v_hash THEN
      RAISE EXCEPTION 'ONE_C_JOB_RECEIPT_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P1C04';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.status, v_job.sync_state, v_job.revision, true;
    RETURN;
  END IF;
  IF v_job.status NOT IN ('RECONCILIATION_REQUIRED', 'DEAD_LETTER') THEN
    RAISE EXCEPTION 'ONE_C_JOB_RECONCILIATION_NOT_REQUIRED' USING ERRCODE = '40901';
  END IF;
  IF EXISTS (
    SELECT 1 FROM connector.one_c_job_leases lease
     WHERE lease.job_id = v_job.id AND lease.status IN ('ACTIVE', 'ACKNOWLEDGED')
  ) THEN
    RAISE EXCEPTION 'ONE_C_JOB_ACTIVE_LEASE_PRESENT' USING ERRCODE = '40901';
  END IF;

  IF p_action = 'REQUEUE_CONFIRMED_NO_EFFECT' THEN
    IF v_job.attempt >= v_job.max_attempts THEN
      RAISE EXCEPTION 'ONE_C_JOB_MAX_ATTEMPTS_EXHAUSTED' USING ERRCODE = '40901';
    END IF;
    v_target_status := 'QUEUED';
    v_target_sync := 'QUEUED';
    v_revision := v_job.revision + 1;
    UPDATE connector.one_c_jobs job
       SET status = v_target_status, sync_state = v_target_sync,
           revision = v_revision, terminal_code = NULL,
           external_evidence_id = NULL, completed_at = NULL,
           reconciliation_required_at = NULL, dead_letter_at = NULL,
           next_attempt_at = v_now, version = job.version + 1
     WHERE job.id = v_job.id;
    UPDATE public."outbox_entries" outbox
       SET "status" = 'PENDING', "nextRetryAt" = 'infinity'::timestamptz,
           "lastError" = NULL, "failedAt" = NULL, "deadLetterAt" = NULL,
           "leaseOwner" = NULL, "leaseToken" = NULL,
           "leaseExpiresAt" = NULL, "heartbeatAt" = NULL
     WHERE outbox."id" = v_job.outbox_entry_id
       AND outbox."status" IN ('MANUAL_REVIEW', 'DEAD_LETTER');
  ELSIF p_action IN ('CONFIRM_CREATED_IN_1C', 'CONFIRM_POSTED') THEN
    v_target_status := 'SUCCEEDED';
    v_target_sync := CASE WHEN p_action = 'CONFIRM_POSTED' THEN 'POSTED' ELSE 'CREATED_IN_1C' END;
    v_revision := v_job.revision;
    UPDATE connector.one_c_jobs job
       SET status = v_target_status, sync_state = v_target_sync,
           terminal_code = p_reason_code, external_evidence_id = p_external_evidence_id,
           completed_at = v_now, version = job.version + 1
     WHERE job.id = v_job.id;
  ELSIF p_action = 'CONFIRM_REJECTED' THEN
    v_target_status := 'REJECTED';
    v_target_sync := 'REJECTED';
    v_revision := v_job.revision;
    UPDATE connector.one_c_jobs job
       SET status = v_target_status, sync_state = v_target_sync,
           terminal_code = p_reason_code, completed_at = v_now,
           version = job.version + 1
     WHERE job.id = v_job.id;
  ELSE
    v_target_status := 'DEAD_LETTER';
    v_target_sync := 'RECONCILIATION_REQUIRED';
    v_revision := v_job.revision;
    UPDATE connector.one_c_jobs job
       SET status = v_target_status, sync_state = v_target_sync,
           terminal_code = p_reason_code, completed_at = v_now,
           reconciliation_required_at = COALESCE(job.reconciliation_required_at, v_now),
           dead_letter_at = v_now, version = job.version + 1
     WHERE job.id = v_job.id;
  END IF;

  IF v_target_status IN ('SUCCEEDED', 'REJECTED') THEN
    UPDATE public."outbox_entries" outbox
       SET "status" = 'PENDING', "nextRetryAt" = 'infinity'::timestamptz,
           "lastError" = NULL, "failedAt" = NULL, "deadLetterAt" = NULL
     WHERE outbox."id" = v_job.outbox_entry_id
       AND outbox."status" IN ('MANUAL_REVIEW', 'DEAD_LETTER');
    UPDATE public."outbox_entries" outbox
       SET "status" = 'PROCESSING', "leaseOwner" = 'one-c-reconciliation',
           "leaseToken" = gen_random_uuid()::text,
           "leaseExpiresAt" = 'infinity'::timestamptz, "heartbeatAt" = v_now
     WHERE outbox."id" = v_job.outbox_entry_id AND outbox."status" = 'PENDING';
    UPDATE public."outbox_entries" outbox
       SET "status" = 'SENT', "sentAt" = COALESCE(outbox."sentAt", v_now),
           "leaseOwner" = NULL, "leaseToken" = NULL,
           "leaseExpiresAt" = NULL, "heartbeatAt" = NULL
     WHERE outbox."id" = v_job.outbox_entry_id AND outbox."status" = 'PROCESSING';
    UPDATE public."outbox_entries" outbox
       SET "status" = 'CONFIRMED', "confirmedAt" = v_now
     WHERE outbox."id" = v_job.outbox_entry_id AND outbox."status" = 'SENT';
  ELSIF v_target_status = 'DEAD_LETTER' THEN
    UPDATE public."outbox_entries" outbox
       SET "status" = 'DEAD_LETTER', "lastError" = p_reason_code,
           "failedAt" = v_now, "deadLetterAt" = v_now,
           "leaseOwner" = NULL, "leaseToken" = NULL,
           "leaseExpiresAt" = NULL, "heartbeatAt" = NULL
     WHERE outbox."id" = v_job.outbox_entry_id
       AND outbox."status" IN ('PENDING', 'PROCESSING', 'MANUAL_REVIEW');
  END IF;

  INSERT INTO connector.one_c_job_receipts (
    id, job_id, tenant_id, organization_id, binding_id, membership_id,
    receipt_kind, idempotency_key, receipt_hash, result_code, resulting_status,
    external_evidence_id, correlation_id
  ) VALUES (
    'one-c-receipt-' || gen_random_uuid()::text, v_job.id, v_job.tenant_id,
    v_job.organization_id, v_job.binding_id, v_membership_id, 'RECONCILIATION',
    p_receipt_idempotency_key, v_hash, p_reason_code, v_target_status,
    p_external_evidence_id, p_correlation_id
  );
  PERFORM connector.append_one_c_audit(
    'ONE_C_JOB_RECONCILED', v_actor.user_id, v_actor.role, v_job.tenant_id,
    v_job.organization_id, 'ONE_C_JOB', v_job.id, 'SUCCESS', p_reason_code,
    jsonb_build_object('jobId', v_job.id, 'action', p_action,
      'resultingStatus', v_target_status, 'syncState', v_target_sync,
      'revision', v_revision, 'externalEvidenceId', p_external_evidence_id),
    p_correlation_id
  );
  RETURN QUERY SELECT v_job.id, v_target_status, v_target_sync, v_revision, false;
END
$function$;

CREATE OR REPLACE FUNCTION connector.ack_one_c_job(
  p_credential_id text,
  p_lease_id text,
  p_receipt_idempotency_key text,
  p_payload_hash text,
  p_revision bigint,
  p_attempt integer,
  p_correlation_id text
)
RETURNS TABLE (job_id text, status text, sync_state text, acknowledged_at timestamptz, replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_lease record;
  v_job record;
  v_receipt record;
  v_hash text;
BEGIN
  IF p_receipt_idempotency_key IS NULL
     OR p_receipt_idempotency_key !~ '^[A-Za-z0-9:_.@-]{1,240}$'
     OR p_payload_hash !~ '^[a-f0-9]{64}$'
     OR p_revision NOT BETWEEN 0 AND 9007199254740991
     OR p_attempt NOT BETWEEN 1 AND 100
     OR p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$' THEN
    RAISE EXCEPTION 'ONE_C_JOB_ACK_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_lease FROM connector.one_c_job_leases lease
   WHERE lease.lease_id = p_lease_id AND lease.credential_id = p_credential_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONE_C_JOB_LEASE_NOT_FOUND' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_job FROM connector.one_c_jobs job WHERE job.id = v_lease.job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ONE_C_JOB_NOT_FOUND' USING ERRCODE = '55000'; END IF;

  v_hash := encode(digest(convert_to(jsonb_build_object(
    'kind', 'ACK', 'jobId', v_job.id, 'leaseId', p_lease_id,
    'payloadHash', p_payload_hash, 'revision', p_revision, 'attempt', p_attempt
  )::text, 'UTF8'), 'sha256'), 'hex');
  SELECT * INTO v_receipt FROM connector.one_c_job_receipts receipt
   WHERE receipt.job_id = v_job.id AND receipt.idempotency_key = p_receipt_idempotency_key;
  IF FOUND THEN
    IF v_receipt.receipt_kind <> 'ACK' OR v_receipt.lease_id <> p_lease_id
       OR v_receipt.receipt_hash <> v_hash THEN
      RAISE EXCEPTION 'ONE_C_JOB_RECEIPT_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P1C04';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.status, v_job.sync_state,
      COALESCE(v_lease.acknowledged_at, v_job.acknowledged_at), true;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM connector.one_c_machine_credentials credential
    JOIN connector.one_c_bindings binding ON binding.id = credential.binding_id
    JOIN connector.one_c_installations installation ON installation.id = credential.installation_id
    WHERE credential.credential_id = p_credential_id
      AND credential.status = 'ACTIVE' AND credential.revoked_at IS NULL
      AND credential.expires_at > v_now AND binding.status = 'ACTIVE'
      AND installation.status = 'ACTIVE'
      AND credential.tenant_id = v_lease.tenant_id
      AND credential.organization_id = v_lease.organization_id
      AND credential.binding_id = v_lease.binding_id
      AND credential.installation_id = v_lease.installation_id
  ) THEN
    RAISE EXCEPTION 'ONE_C_JOB_CREDENTIAL_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  IF v_lease.status <> 'ACTIVE' OR v_lease.expires_at <= v_now
     OR v_job.status <> 'LEASED' THEN
    RAISE EXCEPTION 'ONE_C_JOB_LEASE_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  IF v_lease.payload_hash <> p_payload_hash OR v_lease.revision <> p_revision
     OR v_lease.attempt <> p_attempt OR v_job.payload_hash <> p_payload_hash
     OR v_job.revision <> p_revision OR v_job.attempt <> p_attempt THEN
    RAISE EXCEPTION 'ONE_C_JOB_RECEIPT_ENVELOPE_MISMATCH' USING ERRCODE = '40901';
  END IF;

  UPDATE connector.one_c_job_leases lease
     SET status = 'ACKNOWLEDGED', acknowledged_at = v_now, version = lease.version + 1
   WHERE lease.lease_id = p_lease_id;
  UPDATE connector.one_c_jobs job
     SET status = 'ACKNOWLEDGED', sync_state = 'DELIVERED_TO_CONNECTOR',
         acknowledged_at = v_now, version = job.version + 1
   WHERE job.id = v_job.id;
  UPDATE public."outbox_entries" outbox
     SET "status" = 'SENT', "sentAt" = v_now, "lastError" = NULL,
         "leaseOwner" = NULL, "leaseToken" = NULL,
         "leaseExpiresAt" = NULL, "heartbeatAt" = NULL
   WHERE outbox."id" = v_job.outbox_entry_id AND outbox."status" = 'PROCESSING';
  INSERT INTO connector.one_c_job_receipts (
    id, job_id, lease_id, tenant_id, organization_id, binding_id, credential_id,
    receipt_kind, idempotency_key, receipt_hash, result_code, resulting_status,
    correlation_id
  ) VALUES (
    'one-c-receipt-' || gen_random_uuid()::text, v_job.id, p_lease_id,
    v_job.tenant_id, v_job.organization_id, v_job.binding_id, p_credential_id,
    'ACK', p_receipt_idempotency_key, v_hash, 'ONE_C_JOB_ACKNOWLEDGED',
    'ACKNOWLEDGED', p_correlation_id
  );
  PERFORM connector.append_one_c_audit(
    'ONE_C_JOB_ACKNOWLEDGED', p_credential_id, 'CONNECTOR_MACHINE', v_job.tenant_id,
    v_job.organization_id, 'ONE_C_JOB', v_job.id, 'SUCCESS',
    'ONE_C_JOB_DELIVERED_TO_CONNECTOR',
    jsonb_build_object('jobId', v_job.id, 'leaseId', p_lease_id,
      'attempt', p_attempt, 'revision', p_revision, 'payloadHash', p_payload_hash),
    p_correlation_id
  );
  RETURN QUERY SELECT v_job.id, 'ACKNOWLEDGED', 'DELIVERED_TO_CONNECTOR', v_now, false;
END
$function$;

CREATE OR REPLACE FUNCTION connector.complete_one_c_job(
  p_credential_id text,
  p_lease_id text,
  p_receipt_idempotency_key text,
  p_payload_hash text,
  p_revision bigint,
  p_attempt integer,
  p_result_state text,
  p_result_code text,
  p_external_evidence_id text,
  p_correlation_id text
)
RETURNS TABLE (job_id text, status text, sync_state text, completed_at timestamptz, replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_lease record;
  v_job record;
  v_receipt record;
  v_hash text;
BEGIN
  IF p_receipt_idempotency_key IS NULL
     OR p_receipt_idempotency_key !~ '^[A-Za-z0-9:_.@-]{1,240}$'
     OR p_payload_hash !~ '^[a-f0-9]{64}$'
     OR p_revision NOT BETWEEN 0 AND 9007199254740991
     OR p_attempt NOT BETWEEN 1 AND 100
     OR p_result_state NOT IN ('CREATED_IN_1C', 'POSTED')
     OR p_result_code !~ '^[A-Z0-9][A-Z0-9_.:-]{0,95}$'
     OR p_external_evidence_id !~ '^[A-Za-z0-9:_.@/-]{1,240}$'
     OR p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$' THEN
    RAISE EXCEPTION 'ONE_C_JOB_RESULT_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_lease FROM connector.one_c_job_leases lease
   WHERE lease.lease_id = p_lease_id AND lease.credential_id = p_credential_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ONE_C_JOB_LEASE_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_job FROM connector.one_c_jobs job WHERE job.id = v_lease.job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ONE_C_JOB_NOT_FOUND' USING ERRCODE = '55000'; END IF;

  v_hash := encode(digest(convert_to(jsonb_build_object(
    'kind', 'RESULT', 'jobId', v_job.id, 'leaseId', p_lease_id,
    'payloadHash', p_payload_hash, 'revision', p_revision, 'attempt', p_attempt,
    'resultState', p_result_state, 'resultCode', p_result_code,
    'externalEvidenceId', p_external_evidence_id
  )::text, 'UTF8'), 'sha256'), 'hex');
  SELECT * INTO v_receipt FROM connector.one_c_job_receipts receipt
   WHERE receipt.job_id = v_job.id AND receipt.idempotency_key = p_receipt_idempotency_key;
  IF FOUND THEN
    IF v_receipt.receipt_kind <> 'RESULT' OR v_receipt.lease_id <> p_lease_id
       OR v_receipt.receipt_hash <> v_hash THEN
      RAISE EXCEPTION 'ONE_C_JOB_RECEIPT_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P1C04';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.status, v_job.sync_state,
      COALESCE(v_job.completed_at, v_lease.terminal_at), true;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM connector.one_c_machine_credentials credential
    JOIN connector.one_c_bindings binding ON binding.id = credential.binding_id
    JOIN connector.one_c_installations installation ON installation.id = credential.installation_id
    WHERE credential.credential_id = p_credential_id
      AND credential.status = 'ACTIVE' AND credential.revoked_at IS NULL
      AND credential.expires_at > v_now AND binding.status = 'ACTIVE'
      AND installation.status = 'ACTIVE'
      AND credential.tenant_id = v_lease.tenant_id
      AND credential.organization_id = v_lease.organization_id
      AND credential.binding_id = v_lease.binding_id
      AND credential.installation_id = v_lease.installation_id
  ) THEN RAISE EXCEPTION 'ONE_C_JOB_CREDENTIAL_NOT_ACTIVE' USING ERRCODE = '42501'; END IF;
  IF v_lease.status <> 'ACKNOWLEDGED' OR v_lease.expires_at <= v_now
     OR v_job.status <> 'ACKNOWLEDGED' THEN
    RAISE EXCEPTION 'ONE_C_JOB_LEASE_NOT_ACKNOWLEDGED' USING ERRCODE = '42501';
  END IF;
  IF v_lease.payload_hash <> p_payload_hash OR v_lease.revision <> p_revision
     OR v_lease.attempt <> p_attempt OR v_job.payload_hash <> p_payload_hash
     OR v_job.revision <> p_revision OR v_job.attempt <> p_attempt THEN
    RAISE EXCEPTION 'ONE_C_JOB_RECEIPT_ENVELOPE_MISMATCH' USING ERRCODE = '40901';
  END IF;

  UPDATE connector.one_c_job_leases lease
     SET status = 'TERMINAL', terminal_at = v_now, terminal_result = 'REPORTED_SUCCESS',
         terminal_code = p_result_code, external_evidence_id = p_external_evidence_id,
         version = lease.version + 1
   WHERE lease.lease_id = p_lease_id;
  IF p_result_state = 'POSTED' THEN
    -- Protocol v1 reaches POSTED only through CREATED_IN_1C. A single bounded
    -- report may prove both facts, but the durable state machine records both
    -- legal transitions in the same transaction.
    UPDATE connector.one_c_jobs job
       SET status = 'SUCCEEDED', sync_state = 'CREATED_IN_1C',
           terminal_code = p_result_code, external_evidence_id = p_external_evidence_id,
           completed_at = v_now, version = job.version + 1
     WHERE job.id = v_job.id;
  END IF;
  UPDATE connector.one_c_jobs job
     SET status = 'SUCCEEDED', sync_state = p_result_state,
         terminal_code = p_result_code, external_evidence_id = p_external_evidence_id,
         completed_at = v_now, version = job.version + 1
   WHERE job.id = v_job.id;
  UPDATE public."outbox_entries" outbox
     SET "status" = 'CONFIRMED', "confirmedAt" = v_now, "lastError" = NULL
   WHERE outbox."id" = v_job.outbox_entry_id AND outbox."status" = 'SENT';
  INSERT INTO connector.one_c_job_receipts (
    id, job_id, lease_id, tenant_id, organization_id, binding_id, credential_id,
    receipt_kind, idempotency_key, receipt_hash, result_code, resulting_status,
    external_evidence_id, correlation_id
  ) VALUES (
    'one-c-receipt-' || gen_random_uuid()::text, v_job.id, p_lease_id,
    v_job.tenant_id, v_job.organization_id, v_job.binding_id, p_credential_id,
    'RESULT', p_receipt_idempotency_key, v_hash, p_result_code, 'SUCCEEDED',
    p_external_evidence_id, p_correlation_id
  );
  PERFORM connector.append_one_c_audit(
    'ONE_C_JOB_RESULT_RECORDED', p_credential_id, 'CONNECTOR_MACHINE', v_job.tenant_id,
    v_job.organization_id, 'ONE_C_JOB', v_job.id, 'SUCCESS', p_result_code,
    jsonb_build_object('jobId', v_job.id, 'leaseId', p_lease_id,
      'syncState', p_result_state, 'externalEvidenceId', p_external_evidence_id,
      'attempt', p_attempt, 'revision', p_revision, 'payloadHash', p_payload_hash),
    p_correlation_id
  );
  RETURN QUERY SELECT v_job.id, 'SUCCEEDED', p_result_state, v_now, false;
END
$function$;

CREATE OR REPLACE FUNCTION connector.expire_one_c_job_leases(
  p_tenant_id text,
  p_organization_id text,
  p_binding_id text,
  p_correlation_id text
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_lease record;
  v_job record;
  v_count integer := 0;
  v_hash text;
  v_receipt_id text;
BEGIN
  IF p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$' THEN
    RAISE EXCEPTION 'ONE_C_CORRELATION_ID_INVALID' USING ERRCODE = '22023';
  END IF;
  FOR v_lease IN
    SELECT lease.* FROM connector.one_c_job_leases lease
     WHERE lease.tenant_id = p_tenant_id
       AND lease.organization_id = p_organization_id
       AND (p_binding_id IS NULL OR lease.binding_id = p_binding_id)
       AND lease.status IN ('ACTIVE', 'ACKNOWLEDGED')
       AND lease.expires_at <= clock_timestamp()
     ORDER BY lease.expires_at, lease.lease_id
     FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO v_job FROM connector.one_c_jobs job
     WHERE job.id = v_lease.job_id FOR UPDATE;
    IF NOT FOUND OR v_job.status NOT IN ('LEASED', 'ACKNOWLEDGED') THEN
      RAISE EXCEPTION 'ONE_C_JOB_LEASE_STATE_INCONSISTENT' USING ERRCODE = '55000';
    END IF;

    UPDATE connector.one_c_job_leases lease
       SET status = 'EXPIRED', terminal_at = clock_timestamp(),
           terminal_result = 'UNKNOWN_RESULT', terminal_code = 'ONE_C_LEASE_EXPIRED',
           version = lease.version + 1
     WHERE lease.lease_id = v_lease.lease_id;
    UPDATE connector.one_c_jobs job
       SET status = 'RECONCILIATION_REQUIRED', sync_state = 'RECONCILIATION_REQUIRED',
           terminal_code = 'ONE_C_LEASE_EXPIRED',
           reconciliation_required_at = clock_timestamp(),
           version = job.version + 1
     WHERE job.id = v_job.id;
    UPDATE public."outbox_entries" outbox
       SET "status" = 'MANUAL_REVIEW', "lastError" = 'ONE_C_LEASE_EXPIRED',
           "failedAt" = clock_timestamp(), "leaseOwner" = NULL,
           "leaseToken" = NULL, "leaseExpiresAt" = NULL, "heartbeatAt" = NULL
     WHERE outbox."id" = v_job.outbox_entry_id
       AND outbox."status" IN ('PENDING', 'PROCESSING');

    v_hash := encode(digest(convert_to(
      jsonb_build_object('kind', 'LEASE_EXPIRED', 'leaseId', v_lease.lease_id,
        'jobId', v_job.id, 'attempt', v_lease.attempt)::text,
      'UTF8'), 'sha256'), 'hex');
    v_receipt_id := 'one-c-receipt-' || gen_random_uuid()::text;
    INSERT INTO connector.one_c_job_receipts (
      id, job_id, lease_id, tenant_id, organization_id, binding_id,
      credential_id, receipt_kind, idempotency_key, receipt_hash,
      result_code, resulting_status, correlation_id
    ) VALUES (
      v_receipt_id, v_job.id, v_lease.lease_id, v_job.tenant_id,
      v_job.organization_id, v_job.binding_id, v_lease.credential_id,
      'LEASE_EXPIRED', 'lease-expired:' || v_lease.lease_id, v_hash,
      'ONE_C_LEASE_EXPIRED', 'RECONCILIATION_REQUIRED', p_correlation_id
    ) ON CONFLICT (job_id, idempotency_key) DO NOTHING;

    PERFORM connector.append_one_c_audit(
      'ONE_C_JOB_LEASE_EXPIRED', v_lease.credential_id, 'CONNECTOR_MACHINE', v_job.tenant_id,
      v_job.organization_id, 'ONE_C_JOB', v_job.id, 'SUCCESS',
      'ONE_C_RECONCILIATION_REQUIRED',
      jsonb_build_object('jobId', v_job.id, 'leaseId', v_lease.lease_id,
        'attempt', v_lease.attempt, 'payloadHash', v_job.payload_hash),
      p_correlation_id
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END
$function$;

CREATE OR REPLACE FUNCTION connector.lease_one_c_jobs(
  p_credential_id text,
  p_limit integer,
  p_lease_seconds integer,
  p_correlation_id text
)
RETURNS TABLE (
  job_id text, command text, payload jsonb, payload_hash text,
  idempotency_key text, correlation_id text, organization_id text,
  connection_id text, revision bigint, attempt integer,
  lease_bearer text, lease_expires_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_credential record;
  v_binding record;
  v_job record;
  v_lease_id text;
  v_secret text;
  v_salt text;
  v_hash text;
  v_bearer text;
  v_expires timestamptz;
  v_attempt integer;
BEGIN
  IF p_limit NOT BETWEEN 1 AND 25 OR p_lease_seconds NOT BETWEEN 30 AND 900
     OR p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$' THEN
    RAISE EXCEPTION 'ONE_C_JOB_LEASE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_credential FROM connector.one_c_machine_credentials credential
   WHERE credential.credential_id = p_credential_id FOR UPDATE;
  IF NOT FOUND OR v_credential.status <> 'ACTIVE' OR v_credential.revoked_at IS NOT NULL
     OR v_credential.expires_at <= v_now THEN
    RAISE EXCEPTION 'ONE_C_JOB_CREDENTIAL_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_binding FROM connector.one_c_bindings binding
   WHERE binding.id = v_credential.binding_id FOR UPDATE;
  IF NOT FOUND OR v_binding.status <> 'ACTIVE'
     OR v_binding.tenant_id <> v_credential.tenant_id
     OR v_binding.organization_id <> v_credential.organization_id
     OR v_binding.installation_id <> v_credential.installation_id
     OR v_binding.one_c_organization_guid <> v_credential.one_c_organization_guid THEN
    RAISE EXCEPTION 'ONE_C_JOB_BINDING_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM connector.one_c_installations installation
     WHERE installation.id = v_credential.installation_id
       AND installation.status = 'ACTIVE'
       AND installation.protocol_version = v_credential.protocol_version
  ) THEN
    RAISE EXCEPTION 'ONE_C_JOB_INSTALLATION_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;

  PERFORM connector.expire_one_c_job_leases(
    v_credential.tenant_id, v_credential.organization_id, v_binding.id, p_correlation_id
  );

  FOR v_job IN
    SELECT job.* FROM connector.one_c_jobs job
     WHERE job.tenant_id = v_credential.tenant_id
       AND job.organization_id = v_credential.organization_id
       AND job.binding_id = v_binding.id
       AND job.installation_id = v_credential.installation_id
       AND job.status = 'QUEUED'
       AND job.next_attempt_at <= v_now
       AND job.attempt < job.max_attempts
       AND job.command = ANY(v_credential.allowed_commands)
       AND job.command = ANY(v_binding.capability_profile)
     ORDER BY job.next_attempt_at, job.created_at, job.id
     LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    v_lease_id := gen_random_uuid()::text;
    v_secret := rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
    v_salt := encode(gen_random_bytes(16), 'hex');
    v_hash := encode(digest(convert_to(v_salt || '.' || v_secret, 'UTF8'), 'sha256'), 'hex');
    v_bearer := v_lease_id || '.' || v_secret;
    v_expires := v_now + make_interval(secs => p_lease_seconds);
    v_attempt := v_job.attempt + 1;

    INSERT INTO connector.one_c_job_leases (
      lease_id, job_id, tenant_id, organization_id, installation_id, binding_id,
      credential_id, provider_partition, salt, bearer_hash, issued_at, expires_at,
      status, revision, attempt, idempotency_key, correlation_id, payload_hash, version
    ) VALUES (
      v_lease_id, v_job.id, v_job.tenant_id, v_job.organization_id,
      v_job.installation_id, v_job.binding_id, v_credential.credential_id,
      'ONE_C', v_salt, v_hash, v_now, v_expires, 'ACTIVE', v_job.revision,
      v_attempt, v_job.idempotency_key, v_job.correlation_id, v_job.payload_hash, 0
    );
    UPDATE connector.one_c_jobs job
       SET status = 'LEASED', sync_state = 'DELIVERED_TO_CONNECTOR', attempt = v_attempt,
           version = job.version + 1
     WHERE job.id = v_job.id;
    UPDATE public."outbox_entries" outbox
       SET "status" = 'PROCESSING',
           "leaseOwner" = 'one-c-connector:' || v_credential.credential_id,
           "leaseToken" = v_lease_id, "leaseExpiresAt" = 'infinity'::timestamptz,
           "heartbeatAt" = v_now
     WHERE outbox."id" = v_job.outbox_entry_id AND outbox."status" = 'PENDING';

    PERFORM connector.append_one_c_audit(
      'ONE_C_JOB_LEASED', v_credential.credential_id, 'CONNECTOR_MACHINE', v_job.tenant_id,
      v_job.organization_id, 'ONE_C_JOB', v_job.id, 'SUCCESS', 'ONE_C_JOB_LEASED',
      jsonb_build_object('jobId', v_job.id, 'leaseId', v_lease_id,
        'credentialId', v_credential.credential_id, 'attempt', v_attempt,
        'revision', v_job.revision, 'payloadHash', v_job.payload_hash,
        'leaseExpiresAt', v_expires), p_correlation_id
    );

    RETURN QUERY SELECT v_job.id, v_job.command, v_job.payload, v_job.payload_hash::text,
      v_job.idempotency_key, v_job.correlation_id, v_job.organization_id,
      v_job.binding_id, v_job.revision, v_attempt, v_bearer, v_expires;
  END LOOP;

  UPDATE connector.one_c_machine_credentials credential
     SET last_used_at = v_now, version = credential.version + 1
   WHERE credential.credential_id = v_credential.credential_id
     AND credential.status = 'ACTIVE';
END
$function$;

CREATE OR REPLACE FUNCTION connector.read_one_c_job_lease_verifier(
  p_credential_id text,
  p_lease_id text
)
RETURNS TABLE (
  lease_id text, job_id text, tenant_id text, organization_id text,
  installation_id text, binding_id text, credential_id text,
  provider_partition text, salt text, bearer_hash text,
  issued_at timestamptz, expires_at timestamptz, acknowledged_at timestamptz,
  terminal_at timestamptz, terminal_result text, terminal_code text,
  external_evidence_id text, revision bigint, attempt integer,
  idempotency_key text, correlation_id text, payload_hash text
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = pg_catalog, connector
AS $function$
BEGIN
  RETURN QUERY SELECT lease.lease_id, lease.job_id, lease.tenant_id, lease.organization_id,
         lease.installation_id, lease.binding_id, lease.credential_id,
         lease.provider_partition, lease.salt, lease.bearer_hash::text,
         lease.issued_at, lease.expires_at, lease.acknowledged_at,
         lease.terminal_at, lease.terminal_result, lease.terminal_code,
         lease.external_evidence_id, lease.revision, lease.attempt,
         lease.idempotency_key, lease.correlation_id, lease.payload_hash::text
    FROM connector.one_c_job_leases lease
   WHERE lease.lease_id = p_lease_id AND lease.credential_id = p_credential_id
   LIMIT 1;
END
$function$;

CREATE TRIGGER one_c_runtime_state_guard
BEFORE UPDATE ON connector.one_c_runtime_state
FOR EACH ROW EXECUTE FUNCTION connector.guard_one_c_runtime_state_update();

-- The database repeats the application payload allow-list so a compromised
-- runtime principal cannot turn the queue into arbitrary connector execution.
CREATE OR REPLACE FUNCTION connector.one_c_job_payload_is_valid(
  p_command text,
  p_payload jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog, connector
AS $function$
DECLARE
  v_required text[];
  v_allowed text[];
BEGIN
  IF jsonb_typeof(p_payload) <> 'object' OR pg_column_size(p_payload) > 65536 THEN
    RETURN false;
  END IF;

  CASE p_command
    WHEN 'UPSERT_COUNTERPARTY' THEN
      v_required := ARRAY['counterpartyInn', 'counterpartyName'];
      v_allowed := ARRAY['counterpartyInn', 'counterpartyKpp', 'counterpartyName', 'externalCounterpartyId'];
    WHEN 'CREATE_SALES_DRAFT', 'CREATE_PURCHASE_DRAFT' THEN
      v_required := ARRAY['documentId', 'documentVersionId', 'documentType', 'documentNumber', 'payloadHash', 'counterpartyInn', 'formatRevision'];
      v_allowed := v_required;
    WHEN 'CREATE_CORRECTION_DRAFT' THEN
      v_required := ARRAY['documentId', 'documentVersionId', 'originalDocumentId', 'documentType', 'documentNumber', 'payloadHash', 'counterpartyInn', 'formatRevision'];
      v_allowed := v_required;
    WHEN 'GET_DOCUMENT_STATUS' THEN
      v_required := ARRAY['documentId'];
      v_allowed := ARRAY['documentId', 'externalDocumentId'];
    WHEN 'PUSH_PAYMENT_STATUS' THEN
      v_required := ARRAY['dealId', 'paymentId', 'status', 'amountKopecks', 'currency', 'paidAt'];
      v_allowed := v_required;
    WHEN 'GET_REFERENCE_CANDIDATES' THEN
      v_required := ARRAY['referenceType', 'query'];
      v_allowed := ARRAY['referenceType', 'query', 'limit'];
    ELSE
      RETURN false;
  END CASE;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_payload) AS key(value)
     WHERE NOT (key.value = ANY(v_allowed))
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_required) AS required(value)
     WHERE NOT (p_payload ? required.value)
  ) OR EXISTS (
    SELECT 1 FROM jsonb_each(p_payload) AS item(key, value)
     WHERE jsonb_typeof(item.value) NOT IN ('string', 'number', 'boolean')
        OR (jsonb_typeof(item.value) = 'string' AND (
          length(btrim(item.value #>> '{}')) NOT BETWEEN 1 AND 4096
        ))
  ) THEN
    RETURN false;
  END IF;

  IF p_command = 'PUSH_PAYMENT_STATUS'
     AND COALESCE(p_payload->>'amountKopecks', '') !~ '^-?[0-9]+$' THEN
    RETURN false;
  END IF;
  IF p_command = 'GET_REFERENCE_CANDIDATES' AND p_payload ? 'limit'
     AND (
       jsonb_typeof(p_payload->'limit') <> 'number'
       OR (p_payload->>'limit') !~ '^[0-9]+$'
       OR (p_payload->>'limit')::integer NOT BETWEEN 1 AND 100
     ) THEN
    RETURN false;
  END IF;
  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION connector.one_c_job_payload_canonical(p_payload jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, connector
AS $function$
  SELECT '{' || COALESCE(
    string_agg(to_jsonb(item.key)::text || ':' || item.value::text, ',' ORDER BY item.key),
    ''
  ) || '}'
  FROM jsonb_each(p_payload) AS item(key, value);
$function$;

CREATE TABLE connector.one_c_jobs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  installation_id text NOT NULL,
  binding_id text NOT NULL,
  created_by_membership_id text NOT NULL,
  command text NOT NULL,
  payload jsonb NOT NULL,
  payload_hash character(64) NOT NULL,
  idempotency_key text NOT NULL,
  correlation_id text NOT NULL,
  external_id text,
  status text NOT NULL DEFAULT 'QUEUED',
  sync_state text NOT NULL DEFAULT 'QUEUED',
  revision bigint NOT NULL,
  attempt integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  outbox_entry_id text NOT NULL UNIQUE,
  terminal_code text,
  external_evidence_id text,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  reconciliation_required_at timestamptz,
  dead_letter_at timestamptz,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT one_c_jobs_organization_fk FOREIGN KEY (organization_id, tenant_id)
    REFERENCES public.organizations(id, "tenantId") ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_jobs_installation_fk FOREIGN KEY (installation_id)
    REFERENCES connector.one_c_installations(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_jobs_binding_fk FOREIGN KEY (binding_id)
    REFERENCES connector.one_c_bindings(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_jobs_creator_fk FOREIGN KEY (created_by_membership_id, organization_id)
    REFERENCES public.user_orgs(id, "organizationId") ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_jobs_outbox_fk FOREIGN KEY (outbox_entry_id)
    REFERENCES public."outbox_entries"(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_jobs_command_ck CHECK (
    command IN ('UPSERT_COUNTERPARTY', 'CREATE_SALES_DRAFT', 'CREATE_PURCHASE_DRAFT',
      'CREATE_CORRECTION_DRAFT', 'GET_DOCUMENT_STATUS', 'PUSH_PAYMENT_STATUS',
      'GET_REFERENCE_CANDIDATES')
  ),
  CONSTRAINT one_c_jobs_payload_ck CHECK (connector.one_c_job_payload_is_valid(command, payload)),
  CONSTRAINT one_c_jobs_payload_hash_ck CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT one_c_jobs_payload_hash_match_ck CHECK (
    payload_hash = encode(digest(
      convert_to(connector.one_c_job_payload_canonical(payload), 'UTF8'), 'sha256'
    ), 'hex')
  ),
  CONSTRAINT one_c_jobs_idempotency_ck CHECK (idempotency_key ~ '^[A-Za-z0-9:_.@-]{1,240}$'),
  CONSTRAINT one_c_jobs_correlation_ck CHECK (correlation_id ~ '^[A-Za-z0-9:_.@-]{1,128}$'),
  CONSTRAINT one_c_jobs_external_id_ck CHECK (
    external_id IS NULL OR external_id ~ '^[A-Za-z0-9:_.@/-]{1,240}$'
  ),
  CONSTRAINT one_c_jobs_status_ck CHECK (status IN (
    'QUEUED', 'LEASED', 'ACKNOWLEDGED', 'SUCCEEDED', 'REJECTED',
    'RECONCILIATION_REQUIRED', 'DEAD_LETTER'
  )),
  CONSTRAINT one_c_jobs_sync_state_ck CHECK (sync_state IN (
    'QUEUED', 'DELIVERED_TO_CONNECTOR', 'CREATED_IN_1C', 'POSTED', 'REJECTED',
    'RECONCILIATION_REQUIRED'
  )),
  CONSTRAINT one_c_jobs_state_pair_ck CHECK (
    (status = 'QUEUED' AND sync_state = 'QUEUED')
    OR (status IN ('LEASED', 'ACKNOWLEDGED') AND sync_state = 'DELIVERED_TO_CONNECTOR')
    OR (status = 'SUCCEEDED' AND sync_state IN ('CREATED_IN_1C', 'POSTED'))
    OR (status = 'REJECTED' AND sync_state = 'REJECTED')
    OR (status = 'RECONCILIATION_REQUIRED' AND sync_state = 'RECONCILIATION_REQUIRED')
    OR (status = 'DEAD_LETTER' AND sync_state IN ('REJECTED', 'RECONCILIATION_REQUIRED'))
  ),
  CONSTRAINT one_c_jobs_revision_ck CHECK (revision BETWEEN 0 AND 9007199254740991),
  CONSTRAINT one_c_jobs_attempt_ck CHECK (attempt BETWEEN 0 AND 100),
  CONSTRAINT one_c_jobs_max_attempts_ck CHECK (max_attempts BETWEEN 1 AND 5),
  CONSTRAINT one_c_jobs_attempt_bound_ck CHECK (attempt <= max_attempts),
  CONSTRAINT one_c_jobs_terminal_code_ck CHECK (
    terminal_code IS NULL OR terminal_code ~ '^[A-Z0-9][A-Z0-9_.:-]{0,95}$'
  ),
  CONSTRAINT one_c_jobs_evidence_ck CHECK (
    external_evidence_id IS NULL OR external_evidence_id ~ '^[A-Za-z0-9:_.@/-]{1,240}$'
  ),
  CONSTRAINT one_c_jobs_version_ck CHECK (version >= 0),
  CONSTRAINT one_c_jobs_org_idempotency_key UNIQUE (tenant_id, organization_id, idempotency_key)
);

CREATE INDEX one_c_jobs_delivery_idx
  ON connector.one_c_jobs (binding_id, status, next_attempt_at, created_at, id);
CREATE INDEX one_c_jobs_org_idx
  ON connector.one_c_jobs (tenant_id, organization_id, created_at DESC, id DESC);
CREATE INDEX one_c_jobs_reconciliation_idx
  ON connector.one_c_jobs (status, reconciliation_required_at, id)
  WHERE status IN ('RECONCILIATION_REQUIRED', 'DEAD_LETTER');

CREATE TABLE connector.one_c_job_leases (
  lease_id text PRIMARY KEY,
  job_id text NOT NULL,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  installation_id text NOT NULL,
  binding_id text NOT NULL,
  credential_id text NOT NULL,
  provider_partition text NOT NULL DEFAULT 'ONE_C',
  salt text NOT NULL,
  bearer_hash character(64) NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  terminal_at timestamptz,
  terminal_result text,
  terminal_code text,
  external_evidence_id text,
  status text NOT NULL DEFAULT 'ACTIVE',
  revision bigint NOT NULL,
  attempt integer NOT NULL,
  idempotency_key text NOT NULL,
  correlation_id text NOT NULL,
  payload_hash character(64) NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT one_c_job_leases_job_fk FOREIGN KEY (job_id)
    REFERENCES connector.one_c_jobs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_job_leases_credential_fk FOREIGN KEY (credential_id)
    REFERENCES connector.one_c_machine_credentials(credential_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_job_leases_scope_ck CHECK (provider_partition = 'ONE_C'),
  CONSTRAINT one_c_job_leases_salt_ck CHECK (salt ~ '^[a-f0-9]{32}$'),
  CONSTRAINT one_c_job_leases_hash_ck CHECK (bearer_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT one_c_job_leases_window_ck CHECK (expires_at > issued_at),
  CONSTRAINT one_c_job_leases_status_ck CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'TERMINAL', 'EXPIRED')),
  CONSTRAINT one_c_job_leases_terminal_ck CHECK (
    (status IN ('ACTIVE', 'ACKNOWLEDGED') AND terminal_at IS NULL
      AND terminal_result IS NULL AND terminal_code IS NULL)
    OR (status IN ('TERMINAL', 'EXPIRED') AND terminal_at IS NOT NULL
      AND terminal_result IS NOT NULL AND terminal_code IS NOT NULL)
  ),
  CONSTRAINT one_c_job_leases_terminal_result_ck CHECK (
    terminal_result IS NULL OR terminal_result IN (
      'REPORTED_SUCCESS', 'BUSINESS_REJECTION', 'UNKNOWN_RESULT'
    )
  ),
  CONSTRAINT one_c_job_leases_terminal_code_ck CHECK (
    terminal_code IS NULL OR terminal_code ~ '^[A-Z0-9][A-Z0-9_.:-]{0,95}$'
  ),
  CONSTRAINT one_c_job_leases_evidence_ck CHECK (
    external_evidence_id IS NULL OR external_evidence_id ~ '^[A-Za-z0-9:_.@/-]{1,240}$'
  ),
  CONSTRAINT one_c_job_leases_revision_ck CHECK (revision BETWEEN 0 AND 9007199254740991),
  CONSTRAINT one_c_job_leases_attempt_ck CHECK (attempt BETWEEN 1 AND 100),
  CONSTRAINT one_c_job_leases_idempotency_ck CHECK (idempotency_key ~ '^[A-Za-z0-9:_.@-]{1,240}$'),
  CONSTRAINT one_c_job_leases_correlation_ck CHECK (correlation_id ~ '^[A-Za-z0-9:_.@-]{1,128}$'),
  CONSTRAINT one_c_job_leases_payload_hash_ck CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT one_c_job_leases_version_ck CHECK (version >= 0)
);

CREATE UNIQUE INDEX one_c_job_leases_one_active_job_idx
  ON connector.one_c_job_leases (job_id)
  WHERE status IN ('ACTIVE', 'ACKNOWLEDGED');
CREATE INDEX one_c_job_leases_expiry_idx
  ON connector.one_c_job_leases (credential_id, status, expires_at, lease_id);

-- Bounded connector reports are an inbox-style immutable receipt projection.
-- The canonical regulatory inbox requires provider signatures/environments and
-- therefore is intentionally not reused for an unsigned local machine bearer.
CREATE TABLE connector.one_c_job_receipts (
  id text PRIMARY KEY,
  job_id text NOT NULL,
  lease_id text,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  binding_id text NOT NULL,
  credential_id text,
  membership_id text,
  receipt_kind text NOT NULL,
  idempotency_key text NOT NULL,
  receipt_hash character(64) NOT NULL,
  result_code text NOT NULL,
  resulting_status text NOT NULL,
  external_evidence_id text,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT one_c_job_receipts_job_fk FOREIGN KEY (job_id)
    REFERENCES connector.one_c_jobs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_job_receipts_lease_fk FOREIGN KEY (lease_id)
    REFERENCES connector.one_c_job_leases(lease_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_job_receipts_credential_fk FOREIGN KEY (credential_id)
    REFERENCES connector.one_c_machine_credentials(credential_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_job_receipts_membership_fk FOREIGN KEY (membership_id, organization_id)
    REFERENCES public.user_orgs(id, "organizationId") ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_job_receipts_kind_ck CHECK (receipt_kind IN (
    'ACK', 'RESULT', 'FAIL', 'LEASE_EXPIRED', 'RECONCILIATION'
  )),
  CONSTRAINT one_c_job_receipts_idempotency_ck CHECK (
    idempotency_key ~ '^[A-Za-z0-9:_.@-]{1,240}$'
  ),
  CONSTRAINT one_c_job_receipts_hash_ck CHECK (receipt_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT one_c_job_receipts_result_code_ck CHECK (
    result_code ~ '^[A-Z0-9][A-Z0-9_.:-]{0,95}$'
  ),
  CONSTRAINT one_c_job_receipts_status_ck CHECK (resulting_status IN (
    'QUEUED', 'ACKNOWLEDGED', 'SUCCEEDED', 'REJECTED',
    'RECONCILIATION_REQUIRED', 'DEAD_LETTER'
  )),
  CONSTRAINT one_c_job_receipts_evidence_ck CHECK (
    external_evidence_id IS NULL OR external_evidence_id ~ '^[A-Za-z0-9:_.@/-]{1,240}$'
  ),
  CONSTRAINT one_c_job_receipts_correlation_ck CHECK (
    correlation_id ~ '^[A-Za-z0-9:_.@-]{1,128}$'
  ),
  CONSTRAINT one_c_job_receipts_idempotency_key UNIQUE (job_id, idempotency_key)
);

CREATE INDEX one_c_job_receipts_org_idx
  ON connector.one_c_job_receipts (tenant_id, organization_id, created_at DESC, id DESC);

CREATE TRIGGER one_c_jobs_no_delete BEFORE DELETE ON connector.one_c_jobs
FOR EACH ROW EXECUTE FUNCTION connector.reject_one_c_delete();
CREATE TRIGGER one_c_job_leases_no_delete BEFORE DELETE ON connector.one_c_job_leases
FOR EACH ROW EXECUTE FUNCTION connector.reject_one_c_delete();

CREATE OR REPLACE FUNCTION connector.reject_one_c_receipt_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, connector
AS $function$
BEGIN
  RAISE EXCEPTION '1C job receipts are append-only' USING ERRCODE = '55000';
END
$function$;

CREATE TRIGGER one_c_job_receipts_append_only
BEFORE UPDATE OR DELETE ON connector.one_c_job_receipts
FOR EACH ROW EXECUTE FUNCTION connector.reject_one_c_receipt_change();

CREATE OR REPLACE FUNCTION connector.guard_one_c_job_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, connector
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.installation_id IS DISTINCT FROM OLD.installation_id
     OR NEW.binding_id IS DISTINCT FROM OLD.binding_id
     OR NEW.created_by_membership_id IS DISTINCT FROM OLD.created_by_membership_id
     OR NEW.command IS DISTINCT FROM OLD.command OR NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
     OR NEW.external_id IS DISTINCT FROM OLD.external_id
     OR NEW.max_attempts IS DISTINCT FROM OLD.max_attempts
     OR NEW.outbox_entry_id IS DISTINCT FROM OLD.outbox_entry_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION '1C job identity and payload are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW.version <> OLD.version + 1 OR NEW.revision < OLD.revision OR NEW.attempt < OLD.attempt THEN
    RAISE EXCEPTION '1C job version/revision/attempt is stale' USING ERRCODE = '40001';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE TRIGGER one_c_jobs_guard BEFORE UPDATE ON connector.one_c_jobs
FOR EACH ROW EXECUTE FUNCTION connector.guard_one_c_job_update();

CREATE OR REPLACE FUNCTION connector.guard_one_c_job_lease_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, connector
AS $function$
BEGIN
  IF NEW.lease_id IS DISTINCT FROM OLD.lease_id OR NEW.job_id IS DISTINCT FROM OLD.job_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.installation_id IS DISTINCT FROM OLD.installation_id
     OR NEW.binding_id IS DISTINCT FROM OLD.binding_id
     OR NEW.credential_id IS DISTINCT FROM OLD.credential_id
     OR NEW.provider_partition IS DISTINCT FROM OLD.provider_partition
     OR NEW.salt IS DISTINCT FROM OLD.salt OR NEW.bearer_hash IS DISTINCT FROM OLD.bearer_hash
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.revision IS DISTINCT FROM OLD.revision OR NEW.attempt IS DISTINCT FROM OLD.attempt
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
     OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION '1C job lease identity and verifier are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION '1C job lease version must advance by one' USING ERRCODE = '40001';
  END IF;
  IF OLD.status = 'TERMINAL' OR OLD.status = 'EXPIRED' THEN
    RAISE EXCEPTION '1C terminal job lease is immutable' USING ERRCODE = '55000';
  END IF;
  IF OLD.status = 'ACKNOWLEDGED' AND NEW.status NOT IN ('ACKNOWLEDGED', 'TERMINAL', 'EXPIRED') THEN
    RAISE EXCEPTION '1C acknowledged lease transition is invalid' USING ERRCODE = '55000';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE TRIGGER one_c_job_leases_guard BEFORE UPDATE ON connector.one_c_job_leases
FOR EACH ROW EXECUTE FUNCTION connector.guard_one_c_job_lease_update();

ALTER TABLE connector.one_c_runtime_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_runtime_state FORCE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_job_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_job_leases FORCE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_job_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_job_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY one_c_runtime_state_authority_policy ON connector.one_c_runtime_state
  FOR ALL TO pc_one_c_connector_authority USING (true) WITH CHECK (true);
CREATE POLICY one_c_jobs_authority_policy ON connector.one_c_jobs
  FOR ALL TO pc_one_c_connector_authority USING (true) WITH CHECK (true);
CREATE POLICY one_c_job_leases_authority_policy ON connector.one_c_job_leases
  FOR ALL TO pc_one_c_connector_authority USING (true) WITH CHECK (true);
CREATE POLICY one_c_job_receipts_authority_policy ON connector.one_c_job_receipts
  FOR ALL TO pc_one_c_connector_authority USING (true) WITH CHECK (true);

REVOKE ALL ON connector.one_c_runtime_state, connector.one_c_jobs,
  connector.one_c_job_leases, connector.one_c_job_receipts FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON connector.one_c_runtime_state,
  connector.one_c_jobs, connector.one_c_job_leases TO pc_one_c_connector_authority;
GRANT SELECT, INSERT ON connector.one_c_job_receipts TO pc_one_c_connector_authority;

-- Canonical public outbox remains the single outbound receipt. ONE_C entries
-- stay PENDING with nextRetryAt=infinity until the connector claims them, so
-- the generic Kafka worker cannot compete for the dedicated pull transport.
DROP POLICY IF EXISTS outbox_entries_one_c_connector_select ON public."outbox_entries";
CREATE POLICY outbox_entries_one_c_connector_select ON public."outbox_entries"
FOR SELECT TO pc_one_c_connector_authority
USING (
  "type" = 'ONE_C_CONNECTOR_COMMAND'
  AND "idempotencyKey" LIKE 'one-c-job:%'
  AND "payload"->>'transport' = 'ONE_C_CONNECTOR'
);

DROP POLICY IF EXISTS outbox_entries_one_c_connector_insert ON public."outbox_entries";
CREATE POLICY outbox_entries_one_c_connector_insert ON public."outbox_entries"
FOR INSERT TO pc_one_c_connector_authority
WITH CHECK (
  "type" = 'ONE_C_CONNECTOR_COMMAND'
  AND "idempotencyKey" LIKE 'one-c-job:%'
  AND "payload"->>'transport' = 'ONE_C_CONNECTOR'
  AND "status" = 'PENDING'
  AND "nextRetryAt" = 'infinity'::timestamptz
);

DROP POLICY IF EXISTS outbox_entries_one_c_connector_update ON public."outbox_entries";
CREATE POLICY outbox_entries_one_c_connector_update ON public."outbox_entries"
FOR UPDATE TO pc_one_c_connector_authority
USING (
  "type" = 'ONE_C_CONNECTOR_COMMAND'
  AND "idempotencyKey" LIKE 'one-c-job:%'
  AND "payload"->>'transport' = 'ONE_C_CONNECTOR'
)
WITH CHECK (
  "type" = 'ONE_C_CONNECTOR_COMMAND'
  AND "idempotencyKey" LIKE 'one-c-job:%'
  AND "payload"->>'transport' = 'ONE_C_CONNECTOR'
  AND "status" IN ('PENDING', 'PROCESSING', 'SENT', 'CONFIRMED', 'MANUAL_REVIEW', 'DEAD_LETTER')
);

GRANT SELECT, INSERT ON public."outbox_entries" TO pc_one_c_connector_authority;
GRANT UPDATE (
  "status", "retryCount", "nextRetryAt", "lastError", "sentAt", "confirmedAt",
  "failedAt", "deadLetterAt", "leaseOwner", "leaseToken", "leaseExpiresAt", "heartbeatAt"
) ON public."outbox_entries" TO pc_one_c_connector_authority;

CREATE OR REPLACE FUNCTION connector.guard_one_c_outbox_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, connector
AS $function$
BEGIN
  IF OLD."type" <> 'ONE_C_CONNECTOR_COMMAND' THEN RETURN NEW; END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."type" IS DISTINCT FROM OLD."type"
     OR NEW."dealId" IS DISTINCT FROM OLD."dealId" OR NEW."payload" IS DISTINCT FROM OLD."payload"
     OR NEW."triggeredByUserId" IS DISTINCT FROM OLD."triggeredByUserId"
     OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
     OR NEW."maxRetries" IS DISTINCT FROM OLD."maxRetries"
     OR NEW."correlationId" IS DISTINCT FROM OLD."correlationId"
     OR NEW."auditId" IS DISTINCT FROM OLD."auditId"
     OR NEW."runtimeSnapshotId" IS DISTINCT FROM OLD."runtimeSnapshotId"
     OR NEW."runtimeIdempotencyKey" IS DISTINCT FROM OLD."runtimeIdempotencyKey"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION '1C canonical outbox identity is immutable' USING ERRCODE = '55000';
  END IF;
  IF NOT (
    (OLD."status" = 'PENDING' AND NEW."status" IN ('PROCESSING', 'MANUAL_REVIEW', 'DEAD_LETTER'))
    OR (OLD."status" = 'PROCESSING' AND NEW."status" IN ('PROCESSING', 'SENT', 'MANUAL_REVIEW', 'DEAD_LETTER'))
    OR (OLD."status" = 'SENT' AND NEW."status" IN ('SENT', 'CONFIRMED'))
    OR (OLD."status" IN ('MANUAL_REVIEW', 'DEAD_LETTER') AND NEW."status" IN ('PENDING', 'DEAD_LETTER'))
    OR OLD."status" = NEW."status"
  ) THEN
    RAISE EXCEPTION '1C canonical outbox transition is invalid' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER outbox_entries_one_c_guard
BEFORE UPDATE ON public."outbox_entries"
FOR EACH ROW WHEN (OLD."type" = 'ONE_C_CONNECTOR_COMMAND')
EXECUTE FUNCTION connector.guard_one_c_outbox_update();

CREATE OR REPLACE FUNCTION connector.record_one_c_heartbeat(
  p_credential_id text,
  p_protocol_version text,
  p_connector_version text,
  p_platform_version text,
  p_configuration_version text,
  p_health_state text,
  p_diagnostic_codes text[],
  p_correlation_id text
)
RETURNS TABLE (
  received_at timestamptz,
  health_state text,
  diagnostic_codes text[],
  heartbeat_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_credential connector.one_c_machine_credentials%ROWTYPE;
  v_binding connector.one_c_bindings%ROWTYPE;
  v_installation connector.one_c_installations%ROWTYPE;
  v_state connector.one_c_runtime_state%ROWTYPE;
  v_diagnostics text[];
  v_state_changed boolean := false;
  v_count bigint;
BEGIN
  IF p_credential_id IS NULL OR p_credential_id !~ '^[0-9A-Fa-f-]{36}$' THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_CREDENTIAL_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$' THEN
    RAISE EXCEPTION 'ONE_C_CORRELATION_ID_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_protocol_version <> '1' THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_PROTOCOL_INVALID' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(COALESCE(p_connector_version, ''))) NOT BETWEEN 1 AND 64
     OR p_connector_version !~ '^[A-Za-z0-9._+() -]+$'
     OR length(btrim(COALESCE(p_platform_version, ''))) NOT BETWEEN 1 AND 96
     OR p_platform_version !~ '^[A-Za-z0-9._+() -]+$'
     OR length(btrim(COALESCE(p_configuration_version, ''))) NOT BETWEEN 1 AND 96
     OR p_configuration_version !~ '^[A-Za-z0-9._+() -]+$' THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_VERSION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_health_state NOT IN ('READY', 'DEGRADED', 'BLOCKED') THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_HEALTH_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_diagnostic_codes IS NULL
     OR NOT connector.one_c_diagnostics_are_valid(p_diagnostic_codes)
     OR (p_health_state = 'READY' AND cardinality(p_diagnostic_codes) <> 0)
     OR (p_health_state <> 'READY' AND cardinality(p_diagnostic_codes) = 0) THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT ARRAY(SELECT code FROM unnest(p_diagnostic_codes) AS value(code) ORDER BY code)
    INTO v_diagnostics;

  SELECT * INTO v_credential FROM connector.one_c_machine_credentials credential
   WHERE credential.credential_id = p_credential_id FOR UPDATE;
  IF NOT FOUND OR v_credential.status <> 'ACTIVE' OR v_credential.revoked_at IS NOT NULL
     OR v_credential.expires_at <= v_now THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_CREDENTIAL_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_binding FROM connector.one_c_bindings binding
   WHERE binding.id = v_credential.binding_id FOR UPDATE;
  IF NOT FOUND OR v_binding.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_BINDING_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  IF v_binding.tenant_id <> v_credential.tenant_id
     OR v_binding.organization_id <> v_credential.organization_id
     OR v_binding.installation_id <> v_credential.installation_id
     OR v_binding.one_c_organization_guid <> v_credential.one_c_organization_guid THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_SCOPE_MISMATCH' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_installation FROM connector.one_c_installations installation
   WHERE installation.id = v_credential.installation_id FOR UPDATE;
  IF NOT FOUND OR v_installation.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_INSTALLATION_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  IF p_protocol_version <> v_credential.protocol_version
     OR p_protocol_version <> v_installation.protocol_version THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_PROTOCOL_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_state FROM connector.one_c_runtime_state runtime_state
   WHERE runtime_state.binding_id = v_binding.id FOR UPDATE;
  IF FOUND THEN
    v_state_changed := v_state.health_state IS DISTINCT FROM p_health_state
      OR v_state.diagnostic_codes IS DISTINCT FROM v_diagnostics;
    UPDATE connector.one_c_runtime_state runtime_state
       SET credential_id = v_credential.credential_id,
           protocol_version = p_protocol_version,
           reported_connector_version = btrim(p_connector_version),
           reported_platform_version = btrim(p_platform_version),
           reported_configuration_version = btrim(p_configuration_version),
           health_state = p_health_state,
           diagnostic_codes = v_diagnostics,
           heartbeat_count = runtime_state.heartbeat_count + 1,
           last_heartbeat_at = v_now,
           last_correlation_id = p_correlation_id,
           version = runtime_state.version + 1
     WHERE runtime_state.binding_id = v_binding.id
     RETURNING runtime_state.heartbeat_count INTO v_count;
  ELSE
    v_state_changed := true;
    INSERT INTO connector.one_c_runtime_state (
      binding_id, tenant_id, organization_id, installation_id, credential_id,
      protocol_version, reported_connector_version, reported_platform_version,
      reported_configuration_version, health_state, diagnostic_codes,
      heartbeat_count, first_heartbeat_at, last_heartbeat_at,
      last_correlation_id, version, created_at, updated_at
    ) VALUES (
      v_binding.id, v_binding.tenant_id, v_binding.organization_id,
      v_binding.installation_id, v_credential.credential_id,
      p_protocol_version, btrim(p_connector_version), btrim(p_platform_version),
      btrim(p_configuration_version), p_health_state, v_diagnostics,
      1, v_now, v_now, p_correlation_id, 0, v_now, v_now
    ) RETURNING one_c_runtime_state.heartbeat_count INTO v_count;
  END IF;

  UPDATE connector.one_c_installations installation
     SET last_heartbeat_at = v_now, version = installation.version + 1
   WHERE installation.id = v_installation.id;
  UPDATE connector.one_c_machine_credentials credential
     SET last_used_at = v_now, version = credential.version + 1
   WHERE credential.credential_id = v_credential.credential_id
     AND credential.status = 'ACTIVE';

  IF v_state_changed THEN
    PERFORM connector.append_one_c_audit(
      'ONE_C_HEARTBEAT_STATE_CHANGED', v_credential.credential_id, 'CONNECTOR_MACHINE',
      v_binding.tenant_id, v_binding.organization_id, 'ONE_C_BINDING', v_binding.id,
      'SUCCESS', 'ONE_C_RUNTIME_STATE_CHANGED',
      jsonb_build_object(
        'bindingId', v_binding.id, 'installationId', v_binding.installation_id,
        'health', p_health_state, 'diagnosticCodes', to_jsonb(v_diagnostics),
        'connectorVersion', btrim(p_connector_version),
        'platformVersion', btrim(p_platform_version),
        'configurationVersion', btrim(p_configuration_version)
      ), p_correlation_id
    );
  END IF;
  RETURN QUERY SELECT v_now, p_health_state, v_diagnostics, v_count;
END
$function$;

CREATE OR REPLACE FUNCTION connector.read_one_c_runtime_state()
RETURNS TABLE (
  binding_id text, last_heartbeat_at timestamptz, health_state text,
  diagnostic_codes text[], reported_connector_version text,
  reported_platform_version text, reported_configuration_version text,
  heartbeat_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_org_id text := current_setting('app.current_org_id', true);
  v_tenant_id text := current_setting('app.current_tenant_id', true);
BEGIN
  IF public.app_pc_crop_membership_id() IS NULL THEN
    RAISE EXCEPTION 'ONE_C_ACTIVE_ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT state.binding_id, state.last_heartbeat_at, state.health_state,
         state.diagnostic_codes, state.reported_connector_version,
         state.reported_platform_version, state.reported_configuration_version,
         state.heartbeat_count
    FROM connector.one_c_runtime_state state
    JOIN connector.one_c_bindings binding ON binding.id = state.binding_id
   WHERE binding.tenant_id = v_tenant_id AND binding.organization_id = v_org_id
     AND binding.status = 'ACTIVE'
   ORDER BY state.last_heartbeat_at DESC, state.binding_id DESC LIMIT 1;
END
$function$;

CREATE OR REPLACE FUNCTION connector.enqueue_one_c_job(
  p_command text,
  p_payload jsonb,
  p_payload_hash text,
  p_idempotency_key text,
  p_correlation_id text,
  p_external_id text,
  p_revision bigint,
  p_max_attempts integer
)
RETURNS TABLE (
  job_id text, command text, payload_hash text, idempotency_key text,
  correlation_id text, organization_id text, connection_id text,
  revision bigint, attempt integer, status text, sync_state text,
  outbox_entry_id text, replayed boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_tenant_id text := current_setting('app.current_tenant_id', true);
  v_org_id text := current_setting('app.current_org_id', true);
  v_membership_id text := public.app_pc_crop_membership_id();
  v_binding connector.one_c_bindings%ROWTYPE;
  v_existing connector.one_c_jobs%ROWTYPE;
  v_job_id text := 'one-c-job-' || gen_random_uuid()::text;
  v_outbox_id text := 'one-c-outbox-' || gen_random_uuid()::text;
  v_outbox_idempotency text;
  v_expected_hash text;
BEGIN
  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'ONE_C_ACTIVE_ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT connector.one_c_job_payload_is_valid(p_command, p_payload) THEN
    RAISE EXCEPTION 'ONE_C_JOB_PAYLOAD_INVALID' USING ERRCODE = '22023';
  END IF;
  v_expected_hash := encode(digest(
    convert_to(connector.one_c_job_payload_canonical(p_payload), 'UTF8'), 'sha256'
  ), 'hex');
  IF p_payload_hash IS NULL OR lower(p_payload_hash) <> v_expected_hash THEN
    RAISE EXCEPTION 'ONE_C_JOB_PAYLOAD_HASH_MISMATCH' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9:_.@-]{1,240}$'
     OR p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$'
     OR (p_external_id IS NOT NULL AND p_external_id !~ '^[A-Za-z0-9:_.@/-]{1,240}$')
     OR p_revision NOT BETWEEN 0 AND 9007199254740991
     OR p_max_attempts NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'ONE_C_JOB_ENVELOPE_INVALID' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'one-c-job:' || v_tenant_id || ':' || v_org_id || ':' || p_idempotency_key, 0
  ));
  SELECT * INTO v_existing FROM connector.one_c_jobs job
   WHERE job.tenant_id = v_tenant_id AND job.organization_id = v_org_id
     AND job.idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.command <> p_command OR v_existing.payload <> p_payload
       OR v_existing.payload_hash <> v_expected_hash
       OR v_existing.correlation_id <> p_correlation_id
       OR v_existing.external_id IS DISTINCT FROM p_external_id
       OR v_existing.revision <> p_revision
       OR v_existing.max_attempts <> p_max_attempts THEN
      RAISE EXCEPTION 'ONE_C_JOB_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P1C03';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.command, v_existing.payload_hash::text,
      v_existing.idempotency_key, v_existing.correlation_id, v_existing.organization_id,
      v_existing.binding_id, v_existing.revision, v_existing.attempt,
      v_existing.status, v_existing.sync_state, v_existing.outbox_entry_id, true;
    RETURN;
  END IF;

  SELECT * INTO v_binding FROM connector.one_c_bindings binding
   WHERE binding.tenant_id = v_tenant_id AND binding.organization_id = v_org_id
     AND binding.status = 'ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONE_C_ACTIVE_BINDING_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT (p_command = ANY(v_binding.capability_profile)) THEN
    RAISE EXCEPTION 'ONE_C_JOB_COMMAND_NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM connector.one_c_installations installation
     WHERE installation.id = v_binding.installation_id
       AND installation.status = 'ACTIVE'
       AND p_command = ANY(installation.capabilities)
  ) THEN
    RAISE EXCEPTION 'ONE_C_JOB_INSTALLATION_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;

  v_outbox_idempotency := 'one-c-job:' || encode(digest(
    convert_to(v_tenant_id || ':' || v_org_id || ':' || p_idempotency_key, 'UTF8'), 'sha256'
  ), 'hex');
  INSERT INTO public."outbox_entries" (
    "id", "type", "payload", "status", "triggeredByUserId", "idempotencyKey",
    "maxRetries", "retryCount", "nextRetryAt", "correlationId", "createdAt"
  ) VALUES (
    v_outbox_id, 'ONE_C_CONNECTOR_COMMAND',
    jsonb_build_object(
      'transport', 'ONE_C_CONNECTOR', 'protocolVersion', '1', 'jobId', v_job_id,
      'tenantId', v_tenant_id, 'organizationId', v_org_id,
      'connectionId', v_binding.id, 'command', p_command,
      'payloadHash', v_expected_hash, 'revision', p_revision
    ),
    'PENDING', current_setting('app.current_user_id', true), v_outbox_idempotency,
    p_max_attempts, 0, 'infinity'::timestamptz, p_correlation_id, clock_timestamp()
  );

  INSERT INTO connector.one_c_jobs (
    id, tenant_id, organization_id, installation_id, binding_id,
    created_by_membership_id, command, payload, payload_hash, idempotency_key,
    correlation_id, external_id, status, sync_state, revision, attempt,
    max_attempts, next_attempt_at, outbox_entry_id, version
  ) VALUES (
    v_job_id, v_tenant_id, v_org_id, v_binding.installation_id, v_binding.id,
    v_membership_id, p_command, p_payload, v_expected_hash, p_idempotency_key,
    p_correlation_id, p_external_id, 'QUEUED', 'QUEUED', p_revision, 0,
    p_max_attempts, clock_timestamp(), v_outbox_id, 0
  );

  PERFORM connector.append_one_c_audit(
    'ONE_C_JOB_ENQUEUED', current_setting('app.current_user_id', true),
    current_setting('app.current_role', true), v_tenant_id, v_org_id,
    'ONE_C_JOB', v_job_id, 'SUCCESS', 'ONE_C_JOB_QUEUED',
    jsonb_build_object(
      'jobId', v_job_id, 'connectionId', v_binding.id, 'command', p_command,
      'payloadHash', v_expected_hash, 'revision', p_revision,
      'maxAttempts', p_max_attempts, 'outboxEntryId', v_outbox_id
    ), p_correlation_id
  );

  RETURN QUERY SELECT v_job_id, p_command, v_expected_hash, p_idempotency_key,
    p_correlation_id, v_org_id, v_binding.id, p_revision, 0, 'QUEUED', 'QUEUED',
    v_outbox_id, false;
END
$function$;

CREATE OR REPLACE FUNCTION connector.fail_one_c_job(
  p_credential_id text,
  p_lease_id text,
  p_receipt_idempotency_key text,
  p_payload_hash text,
  p_revision bigint,
  p_attempt integer,
  p_failure_class text,
  p_effect_state text,
  p_result_code text,
  p_correlation_id text
)
RETURNS TABLE (job_id text, status text, sync_state text, next_attempt_at timestamptz, replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_lease record;
  v_job record;
  v_receipt record;
  v_hash text;
  v_target_status text;
  v_target_sync text;
  v_terminal_result text;
  v_next_attempt timestamptz;
  v_is_transient boolean;
BEGIN
  v_is_transient := p_failure_class IN (
    'TRANSIENT_NETWORK', 'TRANSIENT_TIMEOUT', 'TRANSIENT_RATE_LIMIT',
    'TRANSIENT_PROVIDER_5XX'
  );
  IF p_receipt_idempotency_key IS NULL
     OR p_receipt_idempotency_key !~ '^[A-Za-z0-9:_.@-]{1,240}$'
     OR p_payload_hash !~ '^[a-f0-9]{64}$'
     OR p_revision NOT BETWEEN 0 AND 9007199254740991
     OR p_attempt NOT BETWEEN 1 AND 100
     OR p_failure_class NOT IN (
       'TRANSIENT_NETWORK', 'TRANSIENT_TIMEOUT', 'TRANSIENT_RATE_LIMIT',
       'TRANSIENT_PROVIDER_5XX', 'BUSINESS_REJECTION', 'AUTHORIZATION_REJECTED',
       'PAYLOAD_INVALID', 'PAYLOAD_HASH_MISMATCH', 'STALE_REVISION',
       'UNKNOWN_RESULT', 'SECURITY_HOLD'
     )
     OR p_effect_state NOT IN ('CONFIRMED_NO_EFFECT', 'UNKNOWN')
     OR p_result_code !~ '^[A-Z0-9][A-Z0-9_.:-]{0,95}$'
     OR p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$'
     OR (p_failure_class = 'UNKNOWN_RESULT' AND p_effect_state <> 'UNKNOWN')
     OR (NOT v_is_transient AND p_failure_class <> 'UNKNOWN_RESULT'
       AND p_effect_state <> 'CONFIRMED_NO_EFFECT') THEN
    RAISE EXCEPTION 'ONE_C_JOB_FAILURE_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_lease FROM connector.one_c_job_leases lease
   WHERE lease.lease_id = p_lease_id AND lease.credential_id = p_credential_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ONE_C_JOB_LEASE_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_job FROM connector.one_c_jobs job WHERE job.id = v_lease.job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ONE_C_JOB_NOT_FOUND' USING ERRCODE = '55000'; END IF;

  v_hash := encode(digest(convert_to(jsonb_build_object(
    'kind', 'FAIL', 'jobId', v_job.id, 'leaseId', p_lease_id,
    'payloadHash', p_payload_hash, 'revision', p_revision, 'attempt', p_attempt,
    'failureClass', p_failure_class, 'effectState', p_effect_state,
    'resultCode', p_result_code
  )::text, 'UTF8'), 'sha256'), 'hex');
  SELECT * INTO v_receipt FROM connector.one_c_job_receipts receipt
   WHERE receipt.job_id = v_job.id AND receipt.idempotency_key = p_receipt_idempotency_key;
  IF FOUND THEN
    IF v_receipt.receipt_kind <> 'FAIL' OR v_receipt.lease_id <> p_lease_id
       OR v_receipt.receipt_hash <> v_hash THEN
      RAISE EXCEPTION 'ONE_C_JOB_RECEIPT_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P1C04';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.status, v_job.sync_state,
      CASE WHEN v_job.status = 'QUEUED' THEN v_job.next_attempt_at ELSE NULL END, true;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM connector.one_c_machine_credentials credential
    JOIN connector.one_c_bindings binding ON binding.id = credential.binding_id
    JOIN connector.one_c_installations installation ON installation.id = credential.installation_id
    WHERE credential.credential_id = p_credential_id
      AND credential.status = 'ACTIVE' AND credential.revoked_at IS NULL
      AND credential.expires_at > v_now AND binding.status = 'ACTIVE'
      AND installation.status = 'ACTIVE'
      AND credential.tenant_id = v_lease.tenant_id
      AND credential.organization_id = v_lease.organization_id
      AND credential.binding_id = v_lease.binding_id
      AND credential.installation_id = v_lease.installation_id
  ) THEN RAISE EXCEPTION 'ONE_C_JOB_CREDENTIAL_NOT_ACTIVE' USING ERRCODE = '42501'; END IF;
  IF v_lease.status <> 'ACKNOWLEDGED' OR v_lease.expires_at <= v_now
     OR v_job.status <> 'ACKNOWLEDGED' THEN
    RAISE EXCEPTION 'ONE_C_JOB_LEASE_NOT_ACKNOWLEDGED' USING ERRCODE = '42501';
  END IF;
  IF v_lease.payload_hash <> p_payload_hash OR v_lease.revision <> p_revision
     OR v_lease.attempt <> p_attempt OR v_job.payload_hash <> p_payload_hash
     OR v_job.revision <> p_revision OR v_job.attempt <> p_attempt THEN
    RAISE EXCEPTION 'ONE_C_JOB_RECEIPT_ENVELOPE_MISMATCH' USING ERRCODE = '40901';
  END IF;

  IF p_failure_class = 'BUSINESS_REJECTION' THEN
    v_target_status := 'REJECTED';
    v_target_sync := 'REJECTED';
    v_terminal_result := 'BUSINESS_REJECTION';
  ELSIF v_is_transient AND p_effect_state = 'CONFIRMED_NO_EFFECT'
        AND v_job.attempt < v_job.max_attempts THEN
    v_target_status := 'QUEUED';
    v_target_sync := 'QUEUED';
    v_terminal_result := 'UNKNOWN_RESULT';
    v_next_attempt := v_now + make_interval(secs => LEAST(
      900.0, 5.0 * power(2.0, LEAST(v_job.attempt - 1, 8)) * random()
    ));
  ELSIF v_is_transient AND p_effect_state = 'CONFIRMED_NO_EFFECT' THEN
    v_target_status := 'DEAD_LETTER';
    v_target_sync := 'RECONCILIATION_REQUIRED';
    v_terminal_result := 'UNKNOWN_RESULT';
  ELSIF p_failure_class = 'UNKNOWN_RESULT'
        OR (v_is_transient AND p_effect_state = 'UNKNOWN') THEN
    v_target_status := 'RECONCILIATION_REQUIRED';
    v_target_sync := 'RECONCILIATION_REQUIRED';
    v_terminal_result := 'UNKNOWN_RESULT';
  ELSE
    v_target_status := 'DEAD_LETTER';
    v_target_sync := CASE
      WHEN p_failure_class IN ('PAYLOAD_HASH_MISMATCH', 'SECURITY_HOLD')
        THEN 'RECONCILIATION_REQUIRED'
      ELSE 'REJECTED'
    END;
    v_terminal_result := 'BUSINESS_REJECTION';
  END IF;

  UPDATE connector.one_c_job_leases lease
     SET status = 'TERMINAL', terminal_at = v_now,
         terminal_result = v_terminal_result, terminal_code = p_result_code,
         version = lease.version + 1
   WHERE lease.lease_id = p_lease_id;
  IF v_target_status = 'QUEUED' THEN
    -- Delivery was acknowledged, so the protocol cannot jump directly back to
    -- QUEUED. The connector's explicit CONFIRMED_NO_EFFECT evidence first
    -- closes ambiguity in RECONCILIATION_REQUIRED, then permits bounded retry.
    UPDATE connector.one_c_jobs job
       SET status = 'RECONCILIATION_REQUIRED', sync_state = 'RECONCILIATION_REQUIRED',
           terminal_code = p_result_code, reconciliation_required_at = v_now,
           version = job.version + 1
     WHERE job.id = v_job.id;
  END IF;
  UPDATE connector.one_c_jobs job
     SET status = v_target_status, sync_state = v_target_sync,
         terminal_code = p_result_code,
         next_attempt_at = COALESCE(v_next_attempt, job.next_attempt_at),
         completed_at = CASE WHEN v_target_status IN ('REJECTED', 'DEAD_LETTER') THEN v_now ELSE NULL END,
         reconciliation_required_at = CASE
           WHEN v_target_status IN ('RECONCILIATION_REQUIRED', 'DEAD_LETTER') THEN v_now ELSE NULL END,
         dead_letter_at = CASE WHEN v_target_status = 'DEAD_LETTER' THEN v_now ELSE NULL END,
         version = job.version + 1
   WHERE job.id = v_job.id;

  IF v_target_status = 'REJECTED' THEN
    UPDATE public."outbox_entries" outbox
       SET "status" = 'CONFIRMED', "confirmedAt" = v_now, "lastError" = p_result_code
     WHERE outbox."id" = v_job.outbox_entry_id AND outbox."status" = 'SENT';
  ELSIF v_target_status = 'RECONCILIATION_REQUIRED' THEN
    UPDATE public."outbox_entries" outbox
       SET "status" = 'MANUAL_REVIEW', "lastError" = p_result_code,
           "failedAt" = v_now, "leaseOwner" = NULL, "leaseToken" = NULL,
           "leaseExpiresAt" = NULL, "heartbeatAt" = NULL
     WHERE outbox."id" = v_job.outbox_entry_id
       AND outbox."status" IN ('PENDING', 'PROCESSING');
  ELSIF v_target_status = 'DEAD_LETTER' THEN
    UPDATE public."outbox_entries" outbox
       SET "status" = 'DEAD_LETTER', "lastError" = p_result_code,
           "failedAt" = v_now, "deadLetterAt" = v_now,
           "leaseOwner" = NULL, "leaseToken" = NULL,
           "leaseExpiresAt" = NULL, "heartbeatAt" = NULL
     WHERE outbox."id" = v_job.outbox_entry_id
       AND outbox."status" IN ('PENDING', 'PROCESSING', 'MANUAL_REVIEW');
  END IF;

  INSERT INTO connector.one_c_job_receipts (
    id, job_id, lease_id, tenant_id, organization_id, binding_id, credential_id,
    receipt_kind, idempotency_key, receipt_hash, result_code, resulting_status,
    correlation_id
  ) VALUES (
    'one-c-receipt-' || gen_random_uuid()::text, v_job.id, p_lease_id,
    v_job.tenant_id, v_job.organization_id, v_job.binding_id, p_credential_id,
    'FAIL', p_receipt_idempotency_key, v_hash, p_result_code, v_target_status,
    p_correlation_id
  );
  PERFORM connector.append_one_c_audit(
    'ONE_C_JOB_FAILURE_RECORDED', p_credential_id, 'CONNECTOR_MACHINE', v_job.tenant_id,
    v_job.organization_id, 'ONE_C_JOB', v_job.id, 'SUCCESS', p_result_code,
    jsonb_build_object('jobId', v_job.id, 'leaseId', p_lease_id,
      'failureClass', p_failure_class, 'effectState', p_effect_state,
      'resultingStatus', v_target_status, 'attempt', p_attempt,
      'revision', p_revision, 'payloadHash', p_payload_hash), p_correlation_id
  );
  RETURN QUERY SELECT v_job.id, v_target_status, v_target_sync, v_next_attempt, false;
END
$function$;

ALTER FUNCTION connector.one_c_diagnostics_are_valid(text[]) OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.append_one_c_audit(text,text,text,text,text,text,text,text,text,jsonb,text)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.one_c_job_payload_is_valid(text,jsonb) OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.one_c_job_payload_canonical(jsonb) OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.guard_one_c_runtime_state_update() OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.guard_one_c_job_update() OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.guard_one_c_job_lease_update() OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.reject_one_c_receipt_change() OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.guard_one_c_outbox_update() OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.record_one_c_heartbeat(text,text,text,text,text,text,text[],text)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.read_one_c_runtime_state() OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.enqueue_one_c_job(text,jsonb,text,text,text,text,bigint,integer)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.expire_one_c_job_leases(text,text,text,text)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.lease_one_c_jobs(text,integer,integer,text)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.read_one_c_job_lease_verifier(text,text)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.ack_one_c_job(text,text,text,text,bigint,integer,text)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.complete_one_c_job(text,text,text,text,bigint,integer,text,text,text,text)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.fail_one_c_job(text,text,text,text,bigint,integer,text,text,text,text)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.read_one_c_jobs(text,integer,text) OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.reconcile_one_c_job(text,text,text,text,text,text)
  OWNER TO pc_one_c_connector_authority;

REVOKE ALL ON FUNCTION connector.one_c_diagnostics_are_valid(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.append_one_c_audit(text,text,text,text,text,text,text,text,text,jsonb,text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.one_c_job_payload_is_valid(text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.one_c_job_payload_canonical(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.guard_one_c_runtime_state_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.guard_one_c_job_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.guard_one_c_job_lease_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.reject_one_c_receipt_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.guard_one_c_outbox_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.record_one_c_heartbeat(text,text,text,text,text,text,text[],text) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.read_one_c_runtime_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.enqueue_one_c_job(text,jsonb,text,text,text,text,bigint,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.expire_one_c_job_leases(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.lease_one_c_jobs(text,integer,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.read_one_c_job_lease_verifier(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.ack_one_c_job(text,text,text,text,bigint,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.complete_one_c_job(text,text,text,text,bigint,integer,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.fail_one_c_job(text,text,text,text,bigint,integer,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.read_one_c_jobs(text,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.reconcile_one_c_job(text,text,text,text,text,text) FROM PUBLIC;

DO $one_c_durable_runtime_function_grants$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_runtime', 'app_service'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA connector TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION connector.record_one_c_heartbeat(text,text,text,text,text,text,text[],text) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION connector.lease_one_c_jobs(text,integer,integer,text) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION connector.read_one_c_job_lease_verifier(text,text) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION connector.ack_one_c_job(text,text,text,text,bigint,integer,text) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION connector.complete_one_c_job(text,text,text,text,bigint,integer,text,text,text,text) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION connector.fail_one_c_job(text,text,text,text,bigint,integer,text,text,text,text) TO %I', role_name);
    END IF;
  END LOOP;

  FOREACH role_name IN ARRAY ARRAY[
    'app_runtime', 'app_service', 'pc_accounting_authority', 'pc_accounting_command_authority'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA connector TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION connector.read_one_c_runtime_state() TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION connector.enqueue_one_c_job(text,jsonb,text,text,text,text,bigint,integer) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION connector.read_one_c_jobs(text,integer,text) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION connector.reconcile_one_c_job(text,text,text,text,text,text) TO %I', role_name);
    END IF;
  END LOOP;
END
$one_c_durable_runtime_function_grants$;

DO $one_c_durable_runtime_direct_table_denial$
DECLARE
  role_name text;
  table_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'app_runtime', 'app_service', 'pc_accounting_authority', 'pc_accounting_command_authority',
    'pc_staff_runtime', 'pc_registration_authority', 'pc_registration_decision_authority'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      FOREACH table_name IN ARRAY ARRAY[
        'one_c_runtime_state', 'one_c_jobs', 'one_c_job_leases', 'one_c_job_receipts'
      ] LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON connector.%I FROM %I', table_name, role_name);
      END LOOP;
    END IF;
  END LOOP;
END
$one_c_durable_runtime_direct_table_denial$;

DO $one_c_durable_runtime_authority_proof$
DECLARE
  v_role_oid oid;
BEGIN
  SELECT role.oid INTO v_role_oid FROM pg_catalog.pg_roles role
   WHERE role.rolname = 'pc_one_c_connector_authority';
  IF v_role_oid IS NULL OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles role WHERE role.oid = v_role_oid
      AND (role.rolcanlogin OR role.rolinherit OR role.rolsuper OR role.rolbypassrls
        OR role.rolcreatedb OR role.rolcreaterole)
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members membership
     WHERE membership.roleid = v_role_oid OR membership.member = v_role_oid
  ) THEN
    RAISE EXCEPTION '1C connector authority is no longer memberless and confined';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants privilege
     WHERE privilege.grantee IN (
       'app_runtime', 'app_service', 'pc_accounting_authority',
       'pc_accounting_command_authority', 'pc_staff_runtime'
     ) AND privilege.table_schema = 'connector'
       AND privilege.table_name IN (
         'one_c_runtime_state', 'one_c_jobs', 'one_c_job_leases', 'one_c_job_receipts'
       )
  ) THEN
    RAISE EXCEPTION 'ordinary application role acquired direct 1C runtime table privileges';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'connector'
      AND relation.relname IN (
        'one_c_runtime_state', 'one_c_jobs', 'one_c_job_leases', 'one_c_job_receipts'
      ) AND (NOT relation.relrowsecurity OR NOT relation.relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION '1C durable runtime table lost FORCE RLS';
  END IF;
END
$one_c_durable_runtime_authority_proof$;
