-- Atomic dispute command functions: reads, opening and evidence.

CREATE OR REPLACE FUNCTION dispute.append_audit(
  p_action text,
  p_dispute_id text,
  p_deal_id text,
  p_before jsonb,
  p_after jsonb,
  p_metadata jsonb,
  p_command_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  audit_id text := 'dispute-audit-' || gen_random_uuid()::text;
  previous_hash text;
  material jsonb;
  audit_hash text;
BEGIN
  SELECT event."hash" INTO previous_hash
  FROM public."audit_events" event
  WHERE event."tenantId" = current_setting('app.current_tenant_id', true)
    AND event."objectType" = 'dispute'
    AND event."objectId" = p_dispute_id
  ORDER BY event."createdAt" DESC, event."id" DESC
  LIMIT 1;

  material := jsonb_build_object(
    'id', audit_id,
    'action', p_action,
    'actorUserId', current_setting('app.current_user_id', true),
    'actorRole', current_setting('app.current_role', true),
    'tenantId', current_setting('app.current_tenant_id', true),
    'orgId', current_setting('app.current_org_id', true),
    'dealId', p_deal_id,
    'disputeId', p_dispute_id,
    'objectType', 'dispute',
    'objectId', p_dispute_id,
    'beforeState', COALESCE(p_before, '{}'::jsonb),
    'afterState', COALESCE(p_after, '{}'::jsonb),
    'metadata', COALESCE(p_metadata, '{}'::jsonb),
    'correlationId', p_command_id,
    'prevHash', previous_hash
  );
  audit_hash := encode(digest(convert_to(material::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public."audit_events" (
    "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
    "dealId", "disputeId", "objectType", "objectId", "beforeState",
    "afterState", "outcome", "metadata", "correlationId", "hash",
    "prevHash", "createdAt"
  ) VALUES (
    audit_id, p_action, current_setting('app.current_user_id', true),
    current_setting('app.current_role', true), current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true), p_deal_id, p_dispute_id,
    'dispute', p_dispute_id, p_before, p_after, 'SUCCESS', p_metadata,
    p_command_id, audit_hash, previous_hash, transaction_timestamp()
  );
  RETURN audit_id;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.append_deal_event(
  p_event_type text,
  p_dispute_id text,
  p_deal_id text,
  p_payload jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  event_id text := 'dispute-event-' || gen_random_uuid()::text;
  previous_hash text;
  material jsonb;
  event_hash text;
BEGIN
  SELECT event."hash" INTO previous_hash
  FROM public."deal_events" event
  WHERE event."dealId" = p_deal_id
  ORDER BY event."createdAt" DESC, event."id" DESC
  LIMIT 1;

  material := jsonb_build_object(
    'id', event_id, 'dealId', p_deal_id, 'disputeId', p_dispute_id,
    'eventType', p_event_type,
    'actorId', current_setting('app.current_user_id', true),
    'actorRole', current_setting('app.current_role', true),
    'tenantId', current_setting('app.current_tenant_id', true),
    'payload', COALESCE(p_payload, '{}'::jsonb), 'prevHash', previous_hash
  );
  event_hash := encode(digest(convert_to(material::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public."deal_events" (
    "id", "dealId", "eventType", "actorId", "actorRole", "tenantId",
    "payload", "hash", "prevHash", "createdAt"
  ) VALUES (
    event_id, p_deal_id, p_event_type, current_setting('app.current_user_id', true),
    current_setting('app.current_role', true), current_setting('app.current_tenant_id', true),
    p_payload, event_hash, previous_hash, transaction_timestamp()
  );
  RETURN event_id;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.append_outbox(
  p_type text,
  p_dispute_id text,
  p_deal_id text,
  p_payload jsonb,
  p_idempotency_key text,
  p_command_id text,
  p_audit_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  outbox_id text := 'dispute-outbox-' || gen_random_uuid()::text;
BEGIN
  INSERT INTO public."outbox_entries" (
    "id", "type", "dealId", "payload", "status", "idempotencyKey",
    "maxRetries", "retryCount", "nextRetryAt", "correlationId", "auditId", "createdAt"
  ) VALUES (
    outbox_id, p_type, p_deal_id,
    COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object('disputeId', p_dispute_id),
    'PENDING', p_idempotency_key, 8, 0, transaction_timestamp(),
    p_command_id, p_audit_id, transaction_timestamp()
  );
  RETURN outbox_id;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.case_json(p_case dispute.cases)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
  SELECT jsonb_build_object(
    'id', p_case.id,
    'dealId', p_case.deal_id,
    'shipmentId', p_case.shipment_id,
    'status', p_case.status,
    'type', p_case.type,
    'description', p_case.description,
    'initiatorOrgId', p_case.initiator_org_id,
    'respondentOrgId', p_case.respondent_org_id,
    'claimAmountKopecks', CASE WHEN p_case.claim_amount_minor IS NULL THEN NULL ELSE p_case.claim_amount_minor::text END,
    'currency', p_case.currency,
    'severity', p_case.severity,
    'ownerUserId', p_case.owner_user_id,
    'slaDeadline', p_case.sla_deadline,
    'outcome', p_case.outcome,
    'outcomeSplitPct', p_case.outcome_split_pct,
    'decisionNote', p_case.decision_note,
    'decidedAt', p_case.decided_at,
    'appealDeadline', p_case.appeal_deadline,
    'resolvedAt', p_case.resolved_at,
    'closedAt', p_case.closed_at,
    'settlementHoldId', p_case.settlement_hold_id,
    'decisionVersion', p_case.decision_version::text,
    'version', p_case.version::text,
    'createdAt', p_case.created_at,
    'updatedAt', p_case.updated_at,
    'evidence', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'type', e.type, 'fileId', e.file_id,
        'description', e.description, 'source', e.source,
        'uploadedBy', e.submitted_by_user_id, 'uploadedByOrgId', e.submitted_by_org_id,
        'uploadedByRole', e.submitted_by_role, 'trusted', e.trusted,
        'prevHash', e.prev_hash, 'hash', e.hash, 'uploadedAt', e.created_at
      ) ORDER BY e.created_at, e.id)
      FROM dispute.evidence e WHERE e.dispute_id = p_case.id
    ), '[]'::jsonb),
    'appeals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'decisionVersion', a.decision_version::text,
        'filedByUserId', a.filed_by_user_id, 'filedByOrgId', a.filed_by_org_id,
        'reason', a.reason, 'status', a.status, 'resolution', a.resolution,
        'finalOutcome', a.final_outcome, 'finalSplitPct', a.final_split_pct,
        'decisionNote', a.decision_note, 'decidedByUserId', a.decided_by_user_id,
        'decidedAt', a.decided_at, 'createdAt', a.created_at
      ) ORDER BY a.created_at, a.id)
      FROM dispute.appeals a WHERE a.dispute_id = p_case.id
    ), '[]'::jsonb),
    'moneyInstructions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'decisionVersion', i.decision_version::text,
        'action', i.action, 'amountKopecks', i.amount_minor::text,
        'sellerAmountKopecks', i.seller_amount_minor::text,
        'buyerRefundKopecks', i.buyer_refund_minor::text,
        'currency', i.currency, 'status', i.status,
        'basisDocumentId', i.basis_document_id, 'supersedesId', i.supersedes_id,
        'createdAt', i.created_at, 'executedAt', i.executed_at
      ) ORDER BY i.created_at, i.id)
      FROM dispute.money_instructions i WHERE i.dispute_id = p_case.id
    ), '[]'::jsonb)
  )
$function$;

CREATE OR REPLACE FUNCTION dispute.list_cases()
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
  SELECT dispute.case_json(c)
  FROM dispute.cases c
  WHERE c.tenant_id = current_setting('app.current_tenant_id', true)
    AND dispute.case_visible(c.id)
  ORDER BY c.updated_at DESC, c.id
$function$;

CREATE OR REPLACE FUNCTION dispute.get_case(p_dispute_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  row dispute.cases%ROWTYPE;
BEGIN
  SELECT * INTO row FROM dispute.cases c
  WHERE c.id = p_dispute_id
    AND c.tenant_id = current_setting('app.current_tenant_id', true);
  IF NOT FOUND OR NOT dispute.case_visible(p_dispute_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'DISPUTE_NOT_FOUND';
  END IF;
  RETURN dispute.case_json(row);
END
$function$;

CREATE OR REPLACE FUNCTION dispute.open_case(
  p_deal_id text,
  p_shipment_id text,
  p_type text,
  p_description text,
  p_claim_amount_minor bigint,
  p_currency text,
  p_command_id text,
  p_idempotency_key text,
  p_request_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute, settlement
AS $function$
DECLARE
  replay jsonb;
  deal_row public."deals"%ROWTYPE;
  payment_row settlement.payments%ROWTYPE;
  dispute_id text := 'dispute-' || gen_random_uuid()::text;
  hold_id text;
  respondent_org text;
  severity_value text;
  sla_minutes integer;
  available_minor bigint;
  audit_id text;
  event_id text;
  outbox_id text;
  result jsonb;
BEGIN
  PERFORM dispute.assert_roles(ARRAY[
    'BUYER','FARMER','LAB','SURVEYOR','ELEVATOR','LOGISTICIAN','SUPPORT_MANAGER','ADMIN'
  ]);
  IF NOT dispute.deal_authorized(p_deal_id, true) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'DISPUTE_DEAL_ACCESS_DENIED';
  END IF;
  IF p_type IS NULL OR char_length(btrim(p_type)) < 2 OR char_length(p_type) > 100 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_TYPE_INVALID';
  END IF;
  IF p_description IS NULL OR char_length(btrim(p_description)) < 5 OR char_length(p_description) > 4000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_DESCRIPTION_INVALID';
  END IF;
  IF p_claim_amount_minor IS NOT NULL AND p_claim_amount_minor <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_CLAIM_AMOUNT_INVALID';
  END IF;
  IF p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_CURRENCY_INVALID';
  END IF;
  IF p_request_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_FINGERPRINT_INVALID';
  END IF;

  replay := dispute.replay_command('OPEN', p_idempotency_key, p_request_fingerprint);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('dispute:deal:' || p_deal_id, 0));
  SELECT * INTO deal_row FROM public."deals" deal
  WHERE deal."id" = p_deal_id
    AND deal."tenantId" = current_setting('app.current_tenant_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'DISPUTE_DEAL_NOT_FOUND';
  END IF;
  IF p_shipment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."shipments" shipment
    WHERE shipment."id" = p_shipment_id AND shipment."dealId" = p_deal_id
      AND shipment."tenantId" = current_setting('app.current_tenant_id', true)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_SHIPMENT_SCOPE_INVALID';
  END IF;
  IF EXISTS (
    SELECT 1 FROM dispute.cases c
    WHERE c.tenant_id = current_setting('app.current_tenant_id', true)
      AND c.deal_id = p_deal_id AND c.type = upper(btrim(p_type)) AND c.status <> 'CLOSED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'DISPUTE_ACTIVE_CASE_EXISTS';
  END IF;

  respondent_org := CASE
    WHEN current_setting('app.current_org_id', true) = deal_row."buyerOrgId" THEN deal_row."sellerOrgId"
    ELSE deal_row."buyerOrgId"
  END;
  severity_value := CASE
    WHEN COALESCE(p_claim_amount_minor, 0) >= 500000000 THEN 'CRITICAL'
    WHEN COALESCE(p_claim_amount_minor, 0) >= 50000000 THEN 'HIGH'
    WHEN COALESCE(p_claim_amount_minor, 0) > 0 THEN 'MEDIUM'
    ELSE 'LOW'
  END;
  sla_minutes := CASE severity_value WHEN 'CRITICAL' THEN 30 WHEN 'HIGH' THEN 120 ELSE 240 END;

  INSERT INTO dispute.cases (
    id, tenant_id, deal_id, shipment_id, status, type, description,
    initiator_org_id, initiator_user_id, respondent_org_id,
    claim_amount_minor, currency, severity, sla_deadline
  ) VALUES (
    dispute_id, current_setting('app.current_tenant_id', true), p_deal_id, p_shipment_id,
    'OPEN', upper(btrim(p_type)), btrim(p_description),
    current_setting('app.current_org_id', true), current_setting('app.current_user_id', true),
    respondent_org, p_claim_amount_minor, p_currency, severity_value,
    transaction_timestamp() + make_interval(mins => sla_minutes)
  );

  INSERT INTO dispute.participants (
    id, tenant_id, dispute_id, deal_id, organization_id, role, side
  ) VALUES
    ('dispute-party-' || gen_random_uuid()::text, current_setting('app.current_tenant_id', true),
      dispute_id, p_deal_id, deal_row."buyerOrgId", 'BUYER',
      CASE WHEN deal_row."buyerOrgId" = current_setting('app.current_org_id', true) THEN 'CLAIMANT' ELSE 'RESPONDENT' END),
    ('dispute-party-' || gen_random_uuid()::text, current_setting('app.current_tenant_id', true),
      dispute_id, p_deal_id, deal_row."sellerOrgId", 'FARMER',
      CASE WHEN deal_row."sellerOrgId" = current_setting('app.current_org_id', true) THEN 'CLAIMANT' ELSE 'RESPONDENT' END);

  IF p_claim_amount_minor IS NOT NULL THEN
    SELECT * INTO payment_row FROM settlement.payments payment
    WHERE payment.deal_id = p_deal_id
      AND payment.tenant_id = current_setting('app.current_tenant_id', true)
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_SETTLEMENT_PAYMENT_REQUIRED';
    END IF;
    available_minor := payment_row.confirmed_reserved_minor
      - payment_row.confirmed_released_minor - payment_row.pending_released_minor
      - payment_row.confirmed_refunded_minor - payment_row.pending_refunded_minor
      - payment_row.active_hold_minor;
    IF p_claim_amount_minor > available_minor THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_HOLD_EXCEEDS_AVAILABLE_FUNDS',
        DETAIL = 'availableKopecks=' || GREATEST(available_minor, 0)::text;
    END IF;

    hold_id := 'settlement-hold:dispute:' || dispute_id;
    INSERT INTO settlement.holds (
      id, tenant_id, deal_id, payment_id, amount_minor, status, basis_type,
      basis_id, reason, command_id, idempotency_key, request_fingerprint,
      created_by_user_id
    ) VALUES (
      hold_id, current_setting('app.current_tenant_id', true), p_deal_id, payment_row.id,
      p_claim_amount_minor, 'ACTIVE', 'DISPUTE', dispute_id,
      'Funds held for dispute ' || dispute_id, p_command_id,
      'dispute-hold:' || p_idempotency_key, p_request_fingerprint,
      current_setting('app.current_user_id', true)
    );
    UPDATE settlement.payments
    SET active_hold_minor = active_hold_minor + p_claim_amount_minor,
        status = 'HOLD_ACTIVE', version = version + 1
    WHERE id = payment_row.id AND version = payment_row.version;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_CONCURRENT_PAYMENT_UPDATE';
    END IF;
    UPDATE dispute.cases SET settlement_hold_id = hold_id, version = version + 1
    WHERE id = dispute_id AND version = 1;
  END IF;

  audit_id := dispute.append_audit(
    'dispute.opened', dispute_id, p_deal_id, '{}'::jsonb,
    jsonb_build_object('status','OPEN','claimAmountKopecks',p_claim_amount_minor,
      'settlementHoldId',hold_id,'severity',severity_value),
    jsonb_build_object('shipmentId',p_shipment_id,'slaMinutes',sla_minutes), p_command_id
  );
  event_id := dispute.append_deal_event('DISPUTE_OPENED', dispute_id, p_deal_id,
    jsonb_build_object('claimAmountKopecks',p_claim_amount_minor,'settlementHoldId',hold_id));
  outbox_id := dispute.append_outbox('DISPUTE_OPENED', dispute_id, p_deal_id,
    jsonb_build_object('eventId',event_id,'status','OPEN'),
    'dispute-opened:' || dispute_id, p_command_id, audit_id);

  SELECT dispute.case_json(c) || jsonb_build_object(
    'duplicate', false, 'commandId', p_command_id, 'auditId', audit_id,
    'eventId', event_id, 'outboxId', outbox_id
  ) INTO result FROM dispute.cases c WHERE c.id = dispute_id;
  PERFORM dispute.save_command('OPEN', p_command_id, p_idempotency_key, p_request_fingerprint, result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.add_evidence(
  p_dispute_id text,
  p_type text,
  p_file_id text,
  p_description text,
  p_source text,
  p_expected_version bigint,
  p_command_id text,
  p_idempotency_key text,
  p_request_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  replay jsonb;
  case_row dispute.cases%ROWTYPE;
  evidence_id text := 'dispute-evidence-' || gen_random_uuid()::text;
  previous_hash text;
  evidence_hash text;
  trusted_value boolean;
  audit_id text;
  event_id text;
  result jsonb;
BEGIN
  PERFORM dispute.assert_roles(ARRAY[
    'BUYER','FARMER','LAB','SURVEYOR','ELEVATOR','LOGISTICIAN','DRIVER',
    'ARBITRATOR','SUPPORT_MANAGER','ADMIN','COMPLIANCE_OFFICER'
  ]);
  replay := dispute.replay_command('ADD_EVIDENCE', p_idempotency_key, p_request_fingerprint);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO case_row FROM dispute.cases c
  WHERE c.id = p_dispute_id
    AND c.tenant_id = current_setting('app.current_tenant_id', true)
  FOR UPDATE;
  IF NOT FOUND OR NOT dispute.case_visible(p_dispute_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'DISPUTE_NOT_FOUND';
  END IF;
  IF case_row.status IN ('RESOLVED','CLOSED') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_EVIDENCE_TERMINAL_STATE';
  END IF;
  IF case_row.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION';
  END IF;
  IF upper(p_type) NOT IN ('PHOTO','DOCUMENT','GPS','WEIGHT','LAB','STATEMENT','OTHER') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_EVIDENCE_TYPE_INVALID';
  END IF;
  IF p_description IS NULL OR char_length(btrim(p_description)) < 2 OR char_length(p_description) > 4000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_EVIDENCE_DESCRIPTION_INVALID';
  END IF;
  IF p_source IS NULL OR char_length(btrim(p_source)) < 2 OR char_length(p_source) > 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_EVIDENCE_SOURCE_INVALID';
  END IF;

  SELECT e.hash INTO previous_hash FROM dispute.evidence e
  WHERE e.dispute_id = p_dispute_id
  ORDER BY e.created_at DESC, e.id DESC LIMIT 1;
  trusted_value := current_setting('app.current_role', true) IN (
    'LAB','SURVEYOR','ARBITRATOR','SUPPORT_MANAGER','ADMIN','COMPLIANCE_OFFICER'
  );
  evidence_hash := encode(digest(convert_to(jsonb_build_object(
    'id', evidence_id, 'tenantId', case_row.tenant_id, 'disputeId', p_dispute_id,
    'dealId', case_row.deal_id, 'type', upper(p_type), 'fileId', p_file_id,
    'description', btrim(p_description), 'source', btrim(p_source),
    'submittedByUserId', current_setting('app.current_user_id', true),
    'submittedByOrgId', current_setting('app.current_org_id', true),
    'submittedByRole', current_setting('app.current_role', true),
    'trusted', trusted_value, 'prevHash', previous_hash,
    'requestFingerprint', p_request_fingerprint
  )::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO dispute.evidence (
    id, tenant_id, dispute_id, deal_id, type, file_id, description, source,
    submitted_by_user_id, submitted_by_org_id, submitted_by_role, trusted,
    command_id, idempotency_key, request_fingerprint, prev_hash, hash
  ) VALUES (
    evidence_id, case_row.tenant_id, p_dispute_id, case_row.deal_id, upper(p_type),
    p_file_id, btrim(p_description), btrim(p_source),
    current_setting('app.current_user_id', true), current_setting('app.current_org_id', true),
    current_setting('app.current_role', true), trusted_value, p_command_id,
    p_idempotency_key, p_request_fingerprint, previous_hash, evidence_hash
  );
  UPDATE dispute.cases SET version = version + 1
  WHERE id = p_dispute_id AND version = p_expected_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION';
  END IF;

  audit_id := dispute.append_audit('dispute.evidence.added', p_dispute_id, case_row.deal_id,
    jsonb_build_object('version',p_expected_version),
    jsonb_build_object('version',p_expected_version + 1,'evidenceId',evidence_id,'trusted',trusted_value),
    jsonb_build_object('evidenceHash',evidence_hash,'prevHash',previous_hash), p_command_id);
  event_id := dispute.append_deal_event('DISPUTE_EVIDENCE_ADDED', p_dispute_id, case_row.deal_id,
    jsonb_build_object('evidenceId',evidence_id,'trusted',trusted_value,'hash',evidence_hash));

  SELECT dispute.case_json(c) || jsonb_build_object(
    'duplicate',false,'commandId',p_command_id,'auditId',audit_id,'eventId',event_id
  ) INTO result FROM dispute.cases c WHERE c.id = p_dispute_id;
  PERFORM dispute.save_command('ADD_EVIDENCE', p_command_id, p_idempotency_key,
    p_request_fingerprint, result);
  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION dispute.append_audit(text,text,text,jsonb,jsonb,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.append_deal_event(text,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.append_outbox(text,text,text,jsonb,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.case_json(dispute.cases) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.list_cases() FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.get_case(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.open_case(text,text,text,text,bigint,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.add_evidence(text,text,text,text,text,bigint,text,text,text) FROM PUBLIC;
