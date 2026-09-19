-- Dispute lifecycle: triage, initial decision, appeal and appeal resolution.

CREATE OR REPLACE FUNCTION dispute.triage_case(
  p_dispute_id text,
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
  audit_id text;
  event_id text;
  result jsonb;
BEGIN
  PERFORM dispute.assert_roles(ARRAY['ARBITRATOR','SUPPORT_MANAGER','ADMIN']);
  replay := dispute.replay_command('TRIAGE', p_idempotency_key, p_request_fingerprint);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO case_row FROM dispute.cases c
  WHERE c.id = p_dispute_id
    AND c.tenant_id = current_setting('app.current_tenant_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'DISPUTE_NOT_FOUND'; END IF;
  IF case_row.status <> 'OPEN' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_TRIAGE_STATE_INVALID';
  END IF;
  IF case_row.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION';
  END IF;

  UPDATE dispute.cases
  SET status = 'UNDER_REVIEW', owner_user_id = current_setting('app.current_user_id', true),
      owner_org_id = current_setting('app.current_org_id', true), version = version + 1
  WHERE id = p_dispute_id AND version = p_expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION'; END IF;

  audit_id := dispute.append_audit('dispute.triaged', p_dispute_id, case_row.deal_id,
    jsonb_build_object('status',case_row.status,'version',case_row.version),
    jsonb_build_object('status','UNDER_REVIEW','version',case_row.version + 1,
      'ownerUserId',current_setting('app.current_user_id', true)),
    '{}'::jsonb, p_command_id);
  event_id := dispute.append_deal_event('DISPUTE_TRIAGED', p_dispute_id, case_row.deal_id,
    jsonb_build_object('ownerUserId',current_setting('app.current_user_id', true)));

  SELECT dispute.case_json(c) || jsonb_build_object(
    'duplicate',false,'commandId',p_command_id,'auditId',audit_id,'eventId',event_id
  ) INTO result FROM dispute.cases c WHERE c.id = p_dispute_id;
  PERFORM dispute.save_command('TRIAGE', p_command_id, p_idempotency_key, p_request_fingerprint, result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.decide_case(
  p_dispute_id text,
  p_outcome text,
  p_seller_split_pct integer,
  p_note text,
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
  next_decision_version bigint;
  total_minor bigint;
  seller_minor bigint;
  buyer_minor bigint;
  action_value text;
  instruction_id text;
  audit_id text;
  event_id text;
  outbox_id text;
  result jsonb;
BEGIN
  PERFORM dispute.assert_roles(ARRAY['ARBITRATOR','SUPPORT_MANAGER','ADMIN']);
  replay := dispute.replay_command('DECIDE', p_idempotency_key, p_request_fingerprint);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO case_row FROM dispute.cases c
  WHERE c.id = p_dispute_id
    AND c.tenant_id = current_setting('app.current_tenant_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'DISPUTE_NOT_FOUND'; END IF;
  IF case_row.status NOT IN ('UNDER_REVIEW','EXPERTISE') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_DECISION_STATE_INVALID';
  END IF;
  IF case_row.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION';
  END IF;
  IF upper(p_outcome) NOT IN ('BUYER_WIN','SELLER_WIN','SPLIT','NO_CLAIM') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_OUTCOME_INVALID';
  END IF;
  IF upper(p_outcome) = 'SPLIT' AND (p_seller_split_pct IS NULL OR p_seller_split_pct NOT BETWEEN 1 AND 99) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_SPLIT_PERCENT_INVALID';
  END IF;
  IF upper(p_outcome) <> 'SPLIT' AND p_seller_split_pct IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_SPLIT_PERCENT_UNEXPECTED';
  END IF;
  IF p_note IS NULL OR char_length(btrim(p_note)) < 5 OR char_length(p_note) > 4000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_DECISION_NOTE_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM dispute.evidence e WHERE e.dispute_id = p_dispute_id) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_EVIDENCE_REQUIRED';
  END IF;

  next_decision_version := case_row.decision_version + 1;
  total_minor := COALESCE(case_row.claim_amount_minor, 0);
  IF total_minor = 0 THEN
    action_value := 'NO_MONEY'; seller_minor := 0; buyer_minor := 0;
  ELSIF upper(p_outcome) = 'BUYER_WIN' THEN
    action_value := 'REFUND_BUYER'; seller_minor := 0; buyer_minor := total_minor;
  ELSIF upper(p_outcome) IN ('SELLER_WIN','NO_CLAIM') THEN
    action_value := 'RELEASE_TO_SELLER'; seller_minor := total_minor; buyer_minor := 0;
  ELSE
    action_value := 'SPLIT_RELEASE';
    seller_minor := (total_minor * p_seller_split_pct) / 100;
    buyer_minor := total_minor - seller_minor;
  END IF;
  instruction_id := 'dispute-instruction-' || gen_random_uuid()::text;

  INSERT INTO dispute.money_instructions (
    id, tenant_id, dispute_id, deal_id, decision_version, action,
    amount_minor, seller_amount_minor, buyer_refund_minor, currency, status,
    basis_document_id, command_id, idempotency_key, request_fingerprint,
    created_by_user_id
  ) VALUES (
    instruction_id, case_row.tenant_id, case_row.id, case_row.deal_id,
    next_decision_version, action_value, total_minor, seller_minor, buyer_minor,
    case_row.currency, 'PENDING_APPEAL',
    'DISPUTE-BASIS-' || case_row.id || '-V' || next_decision_version::text,
    p_command_id, 'dispute-instruction:' || p_idempotency_key,
    p_request_fingerprint, current_setting('app.current_user_id', true)
  );

  UPDATE dispute.cases
  SET status = 'DECISION', outcome = upper(p_outcome), outcome_split_pct = p_seller_split_pct,
      decision_note = btrim(p_note), decided_at = transaction_timestamp(),
      appeal_deadline = transaction_timestamp() + interval '24 hours',
      decision_version = next_decision_version, version = version + 1
  WHERE id = p_dispute_id AND version = p_expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION'; END IF;

  audit_id := dispute.append_audit('dispute.decided', p_dispute_id, case_row.deal_id,
    jsonb_build_object('status',case_row.status,'version',case_row.version),
    jsonb_build_object('status','DECISION','version',case_row.version + 1,
      'outcome',upper(p_outcome),'decisionVersion',next_decision_version,
      'instructionId',instruction_id),
    jsonb_build_object('action',action_value,'amountKopecks',total_minor), p_command_id);
  event_id := dispute.append_deal_event('DISPUTE_DECIDED', p_dispute_id, case_row.deal_id,
    jsonb_build_object('outcome',upper(p_outcome),'decisionVersion',next_decision_version,
      'instructionId',instruction_id,'appealWindowHours',24));
  outbox_id := dispute.append_outbox('DISPUTE_DECISION_PENDING_APPEAL', p_dispute_id,
    case_row.deal_id, jsonb_build_object('instructionId',instruction_id,
      'action',action_value,'amountKopecks',total_minor::text),
    'dispute-decision:' || p_dispute_id || ':v' || next_decision_version::text,
    p_command_id, audit_id);

  SELECT dispute.case_json(c) || jsonb_build_object(
    'duplicate',false,'commandId',p_command_id,'auditId',audit_id,
    'eventId',event_id,'outboxId',outbox_id,'instructionId',instruction_id
  ) INTO result FROM dispute.cases c WHERE c.id = p_dispute_id;
  PERFORM dispute.save_command('DECIDE', p_command_id, p_idempotency_key, p_request_fingerprint, result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.appeal_case(
  p_dispute_id text,
  p_reason text,
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
  appeal_id text := 'dispute-appeal-' || gen_random_uuid()::text;
  audit_id text;
  event_id text;
  result jsonb;
BEGIN
  PERFORM dispute.assert_roles(ARRAY['BUYER','FARMER']);
  replay := dispute.replay_command('APPEAL', p_idempotency_key, p_request_fingerprint);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO case_row FROM dispute.cases c
  WHERE c.id = p_dispute_id
    AND c.tenant_id = current_setting('app.current_tenant_id', true)
  FOR UPDATE;
  IF NOT FOUND OR NOT dispute.case_visible(p_dispute_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'DISPUTE_NOT_FOUND';
  END IF;
  IF current_setting('app.current_org_id', true) NOT IN (case_row.initiator_org_id, case_row.respondent_org_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'DISPUTE_APPEAL_PARTY_REQUIRED';
  END IF;
  IF case_row.status <> 'DECISION' OR case_row.appeal_deadline IS NULL
     OR transaction_timestamp() > case_row.appeal_deadline THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_APPEAL_WINDOW_CLOSED';
  END IF;
  IF case_row.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 10 OR char_length(p_reason) > 4000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_APPEAL_REASON_INVALID';
  END IF;

  INSERT INTO dispute.appeals (
    id, tenant_id, dispute_id, deal_id, decision_version,
    filed_by_user_id, filed_by_org_id, reason, status,
    command_id, idempotency_key, request_fingerprint
  ) VALUES (
    appeal_id, case_row.tenant_id, case_row.id, case_row.deal_id,
    case_row.decision_version, current_setting('app.current_user_id', true),
    current_setting('app.current_org_id', true), btrim(p_reason), 'PENDING',
    p_command_id, p_idempotency_key, p_request_fingerprint
  );
  UPDATE dispute.money_instructions
  SET status = 'BLOCKED_BY_APPEAL'
  WHERE dispute_id = p_dispute_id AND decision_version = case_row.decision_version
    AND status = 'PENDING_APPEAL';
  UPDATE dispute.cases SET status = 'APPEALED', version = version + 1
  WHERE id = p_dispute_id AND version = p_expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION'; END IF;

  audit_id := dispute.append_audit('dispute.appealed', p_dispute_id, case_row.deal_id,
    jsonb_build_object('status',case_row.status,'version',case_row.version),
    jsonb_build_object('status','APPEALED','version',case_row.version + 1,'appealId',appeal_id),
    jsonb_build_object('decisionVersion',case_row.decision_version), p_command_id);
  event_id := dispute.append_deal_event('DISPUTE_APPEALED', p_dispute_id, case_row.deal_id,
    jsonb_build_object('appealId',appeal_id,'decisionVersion',case_row.decision_version));

  SELECT dispute.case_json(c) || jsonb_build_object(
    'duplicate',false,'commandId',p_command_id,'auditId',audit_id,
    'eventId',event_id,'appealId',appeal_id
  ) INTO result FROM dispute.cases c WHERE c.id = p_dispute_id;
  PERFORM dispute.save_command('APPEAL', p_command_id, p_idempotency_key, p_request_fingerprint, result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.resolve_appeal(
  p_dispute_id text,
  p_resolution text,
  p_final_outcome text,
  p_seller_split_pct integer,
  p_note text,
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
  appeal_row dispute.appeals%ROWTYPE;
  prior_instruction dispute.money_instructions%ROWTYPE;
  next_decision_version bigint;
  total_minor bigint;
  seller_minor bigint;
  buyer_minor bigint;
  action_value text;
  instruction_id text;
  audit_id text;
  event_id text;
  outbox_id text;
  result jsonb;
BEGIN
  PERFORM dispute.assert_roles(ARRAY['ARBITRATOR','SUPPORT_MANAGER','ADMIN']);
  replay := dispute.replay_command('RESOLVE_APPEAL', p_idempotency_key, p_request_fingerprint);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO case_row FROM dispute.cases c
  WHERE c.id = p_dispute_id
    AND c.tenant_id = current_setting('app.current_tenant_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'DISPUTE_NOT_FOUND'; END IF;
  IF case_row.status <> 'APPEALED' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_APPEAL_STATE_INVALID';
  END IF;
  IF case_row.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION';
  END IF;
  IF upper(p_resolution) NOT IN ('UPHELD','OVERTURNED','MODIFIED','REJECTED') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_APPEAL_RESOLUTION_INVALID';
  END IF;
  IF upper(p_final_outcome) NOT IN ('BUYER_WIN','SELLER_WIN','SPLIT','NO_CLAIM') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_OUTCOME_INVALID';
  END IF;
  IF upper(p_final_outcome) = 'SPLIT' AND (p_seller_split_pct IS NULL OR p_seller_split_pct NOT BETWEEN 1 AND 99) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_SPLIT_PERCENT_INVALID';
  END IF;
  IF upper(p_final_outcome) <> 'SPLIT' AND p_seller_split_pct IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_SPLIT_PERCENT_UNEXPECTED';
  END IF;
  IF p_note IS NULL OR char_length(btrim(p_note)) < 5 OR char_length(p_note) > 4000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DISPUTE_DECISION_NOTE_INVALID';
  END IF;

  SELECT * INTO appeal_row FROM dispute.appeals a
  WHERE a.dispute_id = p_dispute_id AND a.status = 'PENDING'
  ORDER BY a.created_at DESC, a.id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_PENDING_APPEAL_REQUIRED';
  END IF;
  SELECT * INTO prior_instruction FROM dispute.money_instructions i
  WHERE i.dispute_id = p_dispute_id AND i.decision_version = case_row.decision_version
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_PRIOR_INSTRUCTION_REQUIRED';
  END IF;

  next_decision_version := case_row.decision_version + 1;
  total_minor := COALESCE(case_row.claim_amount_minor, 0);
  IF total_minor = 0 THEN
    action_value := 'NO_MONEY'; seller_minor := 0; buyer_minor := 0;
  ELSIF upper(p_final_outcome) = 'BUYER_WIN' THEN
    action_value := 'REFUND_BUYER'; seller_minor := 0; buyer_minor := total_minor;
  ELSIF upper(p_final_outcome) IN ('SELLER_WIN','NO_CLAIM') THEN
    action_value := 'RELEASE_TO_SELLER'; seller_minor := total_minor; buyer_minor := 0;
  ELSE
    action_value := 'SPLIT_RELEASE';
    seller_minor := (total_minor * p_seller_split_pct) / 100;
    buyer_minor := total_minor - seller_minor;
  END IF;
  instruction_id := 'dispute-instruction-' || gen_random_uuid()::text;

  UPDATE dispute.appeals
  SET status = upper(p_resolution), resolution = upper(p_resolution),
      final_outcome = upper(p_final_outcome), final_split_pct = p_seller_split_pct,
      decision_note = btrim(p_note), decided_by_user_id = current_setting('app.current_user_id', true),
      decided_at = transaction_timestamp()
  WHERE id = appeal_row.id AND status = 'PENDING';
  UPDATE dispute.money_instructions SET status = 'SUPERSEDED'
  WHERE id = prior_instruction.id AND status = 'BLOCKED_BY_APPEAL';

  INSERT INTO dispute.money_instructions (
    id, tenant_id, dispute_id, deal_id, decision_version, action,
    amount_minor, seller_amount_minor, buyer_refund_minor, currency, status,
    basis_document_id, supersedes_id, command_id, idempotency_key,
    request_fingerprint, created_by_user_id
  ) VALUES (
    instruction_id, case_row.tenant_id, case_row.id, case_row.deal_id,
    next_decision_version, action_value, total_minor, seller_minor, buyer_minor,
    case_row.currency, 'READY',
    'DISPUTE-BASIS-' || case_row.id || '-V' || next_decision_version::text,
    prior_instruction.id, p_command_id, 'dispute-instruction:' || p_idempotency_key,
    p_request_fingerprint, current_setting('app.current_user_id', true)
  );
  UPDATE dispute.cases
  SET status = 'RESOLVED', outcome = upper(p_final_outcome),
      outcome_split_pct = p_seller_split_pct, decision_note = btrim(p_note),
      decided_at = transaction_timestamp(), appeal_deadline = NULL,
      resolved_at = transaction_timestamp(), decision_version = next_decision_version,
      version = version + 1
  WHERE id = p_dispute_id AND version = p_expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION'; END IF;

  audit_id := dispute.append_audit('dispute.appeal.resolved', p_dispute_id, case_row.deal_id,
    jsonb_build_object('status',case_row.status,'version',case_row.version,
      'decisionVersion',case_row.decision_version),
    jsonb_build_object('status','RESOLVED','version',case_row.version + 1,
      'decisionVersion',next_decision_version,'outcome',upper(p_final_outcome),
      'instructionId',instruction_id),
    jsonb_build_object('appealId',appeal_row.id,'resolution',upper(p_resolution)), p_command_id);
  event_id := dispute.append_deal_event('DISPUTE_APPEAL_RESOLVED', p_dispute_id, case_row.deal_id,
    jsonb_build_object('appealId',appeal_row.id,'resolution',upper(p_resolution),
      'instructionId',instruction_id));
  outbox_id := dispute.append_outbox('DISPUTE_MONEY_INSTRUCTION_READY', p_dispute_id,
    case_row.deal_id, jsonb_build_object('instructionId',instruction_id,
      'action',action_value,'amountKopecks',total_minor::text,
      'sellerAmountKopecks',seller_minor::text,'buyerRefundKopecks',buyer_minor::text),
    'dispute-instruction-ready:' || instruction_id, p_command_id, audit_id);

  SELECT dispute.case_json(c) || jsonb_build_object(
    'duplicate',false,'commandId',p_command_id,'auditId',audit_id,
    'eventId',event_id,'outboxId',outbox_id,'instructionId',instruction_id
  ) INTO result FROM dispute.cases c WHERE c.id = p_dispute_id;
  PERFORM dispute.save_command('RESOLVE_APPEAL', p_command_id, p_idempotency_key,
    p_request_fingerprint, result);
  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION dispute.triage_case(text,bigint,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.decide_case(text,text,integer,text,bigint,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.appeal_case(text,text,bigint,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.resolve_appeal(text,text,text,integer,text,bigint,text,text,text) FROM PUBLIC;
