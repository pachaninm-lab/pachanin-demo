-- Final decision activation, settlement-operation binding and evidence-based close.

CREATE OR REPLACE FUNCTION dispute.finalize_case(
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
  instruction_row dispute.money_instructions%ROWTYPE;
  audit_id text;
  event_id text;
  outbox_id text;
  result jsonb;
BEGIN
  PERFORM dispute.assert_roles(ARRAY['ARBITRATOR','SUPPORT_MANAGER','ADMIN']);
  replay := dispute.replay_command('FINALIZE', p_idempotency_key, p_request_fingerprint);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO case_row FROM dispute.cases c
  WHERE c.id = p_dispute_id
    AND c.tenant_id = current_setting('app.current_tenant_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'DISPUTE_NOT_FOUND'; END IF;
  IF case_row.status <> 'DECISION' OR case_row.appeal_deadline IS NULL
     OR transaction_timestamp() <= case_row.appeal_deadline THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_FINALIZATION_NOT_READY';
  END IF;
  IF case_row.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION';
  END IF;
  IF EXISTS (
    SELECT 1 FROM dispute.appeals a
    WHERE a.dispute_id = p_dispute_id AND a.status = 'PENDING'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_PENDING_APPEAL_BLOCKS_FINALIZATION';
  END IF;
  SELECT * INTO instruction_row FROM dispute.money_instructions i
  WHERE i.dispute_id = p_dispute_id
    AND i.decision_version = case_row.decision_version
  FOR UPDATE;
  IF NOT FOUND OR instruction_row.status <> 'PENDING_APPEAL' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_PENDING_INSTRUCTION_REQUIRED';
  END IF;

  UPDATE dispute.money_instructions SET status = 'READY'
  WHERE id = instruction_row.id AND status = 'PENDING_APPEAL';
  UPDATE dispute.cases
  SET status = 'RESOLVED', resolved_at = transaction_timestamp(),
      appeal_deadline = NULL, version = version + 1
  WHERE id = p_dispute_id AND version = p_expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION'; END IF;

  audit_id := dispute.append_audit('dispute.finalized', p_dispute_id, case_row.deal_id,
    jsonb_build_object('status',case_row.status,'version',case_row.version),
    jsonb_build_object('status','RESOLVED','version',case_row.version + 1,
      'instructionId',instruction_row.id), '{}'::jsonb, p_command_id);
  event_id := dispute.append_deal_event('DISPUTE_FINALIZED', p_dispute_id, case_row.deal_id,
    jsonb_build_object('instructionId',instruction_row.id,'outcome',case_row.outcome));
  outbox_id := dispute.append_outbox('DISPUTE_MONEY_INSTRUCTION_READY', p_dispute_id,
    case_row.deal_id, jsonb_build_object('instructionId',instruction_row.id,
      'action',instruction_row.action,'amountKopecks',instruction_row.amount_minor::text,
      'sellerAmountKopecks',instruction_row.seller_amount_minor::text,
      'buyerRefundKopecks',instruction_row.buyer_refund_minor::text),
    'dispute-instruction-ready:' || instruction_row.id, p_command_id, audit_id);

  SELECT dispute.case_json(c) || jsonb_build_object(
    'duplicate',false,'commandId',p_command_id,'auditId',audit_id,
    'eventId',event_id,'outboxId',outbox_id,'instructionId',instruction_row.id
  ) INTO result FROM dispute.cases c WHERE c.id = p_dispute_id;
  PERFORM dispute.save_command('FINALIZE', p_command_id, p_idempotency_key,
    p_request_fingerprint, result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.bind_instruction_operations(
  p_dispute_id text,
  p_instruction_id text,
  p_seller_operation_id text,
  p_buyer_operation_id text,
  p_expected_version bigint,
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
  case_row dispute.cases%ROWTYPE;
  instruction_row dispute.money_instructions%ROWTYPE;
  seller_operation settlement.bank_operations%ROWTYPE;
  buyer_operation settlement.bank_operations%ROWTYPE;
  audit_id text;
  event_id text;
  result jsonb;
BEGIN
  PERFORM dispute.assert_roles(ARRAY['ACCOUNTING','ARBITRATOR','SUPPORT_MANAGER','ADMIN']);
  replay := dispute.replay_command('BIND_OPERATIONS', p_idempotency_key, p_request_fingerprint);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO case_row FROM dispute.cases c
  WHERE c.id = p_dispute_id
    AND c.tenant_id = current_setting('app.current_tenant_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'DISPUTE_NOT_FOUND'; END IF;
  IF case_row.status <> 'RESOLVED' OR case_row.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_BIND_STATE_OR_VERSION_INVALID';
  END IF;
  SELECT * INTO instruction_row FROM dispute.money_instructions i
  WHERE i.id = p_instruction_id AND i.dispute_id = p_dispute_id
    AND i.decision_version = case_row.decision_version
  FOR UPDATE;
  IF NOT FOUND OR instruction_row.status <> 'READY' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_READY_INSTRUCTION_REQUIRED';
  END IF;
  IF instruction_row.seller_operation_id IS NOT NULL OR instruction_row.buyer_operation_id IS NOT NULL THEN
    IF instruction_row.seller_operation_id IS NOT DISTINCT FROM p_seller_operation_id
       AND instruction_row.buyer_operation_id IS NOT DISTINCT FROM p_buyer_operation_id THEN
      SELECT dispute.case_json(c) || jsonb_build_object('duplicate',true,'instructionId',instruction_row.id)
      INTO result FROM dispute.cases c WHERE c.id = p_dispute_id;
      RETURN result;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_OPERATION_BINDING_IMMUTABLE';
  END IF;

  IF instruction_row.seller_amount_minor > 0 THEN
    IF p_seller_operation_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_SELLER_OPERATION_REQUIRED';
    END IF;
    SELECT * INTO seller_operation FROM settlement.bank_operations operation
    WHERE operation.id = p_seller_operation_id
      AND operation.tenant_id = case_row.tenant_id
      AND operation.deal_id = case_row.deal_id
    FOR UPDATE;
    IF NOT FOUND OR seller_operation.operation_type <> 'RELEASE'
       OR seller_operation.amount_minor <> instruction_row.seller_amount_minor
       OR seller_operation.status NOT IN ('PENDING','CONFIRMED') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_SELLER_OPERATION_INVALID';
    END IF;
  ELSIF p_seller_operation_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_SELLER_OPERATION_UNEXPECTED';
  END IF;

  IF instruction_row.buyer_refund_minor > 0 THEN
    IF p_buyer_operation_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_BUYER_OPERATION_REQUIRED';
    END IF;
    SELECT * INTO buyer_operation FROM settlement.bank_operations operation
    WHERE operation.id = p_buyer_operation_id
      AND operation.tenant_id = case_row.tenant_id
      AND operation.deal_id = case_row.deal_id
    FOR UPDATE;
    IF NOT FOUND OR buyer_operation.operation_type <> 'REFUND'
       OR buyer_operation.amount_minor <> instruction_row.buyer_refund_minor
       OR buyer_operation.status NOT IN ('PENDING','CONFIRMED') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_BUYER_OPERATION_INVALID';
    END IF;
  ELSIF p_buyer_operation_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_BUYER_OPERATION_UNEXPECTED';
  END IF;

  UPDATE dispute.money_instructions
  SET seller_operation_id = p_seller_operation_id,
      buyer_operation_id = p_buyer_operation_id
  WHERE id = instruction_row.id
    AND seller_operation_id IS NULL AND buyer_operation_id IS NULL;
  UPDATE dispute.cases SET version = version + 1
  WHERE id = p_dispute_id AND version = p_expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION'; END IF;

  audit_id := dispute.append_audit('dispute.operations.bound', p_dispute_id, case_row.deal_id,
    jsonb_build_object('version',case_row.version),
    jsonb_build_object('version',case_row.version + 1,
      'instructionId',instruction_row.id,'sellerOperationId',p_seller_operation_id,
      'buyerOperationId',p_buyer_operation_id), '{}'::jsonb, p_command_id);
  event_id := dispute.append_deal_event('DISPUTE_SETTLEMENT_OPERATIONS_BOUND',
    p_dispute_id, case_row.deal_id,
    jsonb_build_object('instructionId',instruction_row.id,
      'sellerOperationId',p_seller_operation_id,'buyerOperationId',p_buyer_operation_id));

  SELECT dispute.case_json(c) || jsonb_build_object(
    'duplicate',false,'commandId',p_command_id,'auditId',audit_id,
    'eventId',event_id,'instructionId',instruction_row.id
  ) INTO result FROM dispute.cases c WHERE c.id = p_dispute_id;
  PERFORM dispute.save_command('BIND_OPERATIONS', p_command_id, p_idempotency_key,
    p_request_fingerprint, result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.close_case(
  p_dispute_id text,
  p_expected_version bigint,
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
  case_row dispute.cases%ROWTYPE;
  instruction_row dispute.money_instructions%ROWTYPE;
  hold_row settlement.holds%ROWTYPE;
  seller_operation settlement.bank_operations%ROWTYPE;
  buyer_operation settlement.bank_operations%ROWTYPE;
  audit_id text;
  event_id text;
  outbox_id text;
  result jsonb;
BEGIN
  PERFORM dispute.assert_roles(ARRAY['ACCOUNTING','ARBITRATOR','SUPPORT_MANAGER','ADMIN']);
  replay := dispute.replay_command('CLOSE', p_idempotency_key, p_request_fingerprint);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO case_row FROM dispute.cases c
  WHERE c.id = p_dispute_id
    AND c.tenant_id = current_setting('app.current_tenant_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'DISPUTE_NOT_FOUND'; END IF;
  IF case_row.status <> 'RESOLVED' OR case_row.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_CLOSE_STATE_OR_VERSION_INVALID';
  END IF;
  IF EXISTS (SELECT 1 FROM dispute.appeals a WHERE a.dispute_id = p_dispute_id AND a.status = 'PENDING') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_PENDING_APPEAL_BLOCKS_CLOSE';
  END IF;
  SELECT * INTO instruction_row FROM dispute.money_instructions i
  WHERE i.dispute_id = p_dispute_id
    AND i.decision_version = case_row.decision_version
  FOR UPDATE;
  IF NOT FOUND OR instruction_row.status <> 'READY' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_READY_INSTRUCTION_REQUIRED';
  END IF;

  IF case_row.settlement_hold_id IS NOT NULL THEN
    SELECT * INTO hold_row FROM settlement.holds h
    WHERE h.id = case_row.settlement_hold_id AND h.deal_id = case_row.deal_id;
    IF NOT FOUND OR hold_row.status <> 'RELEASED' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_SETTLEMENT_HOLD_NOT_RELEASED';
    END IF;
  END IF;

  IF instruction_row.seller_amount_minor > 0 THEN
    IF instruction_row.seller_operation_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_SELLER_OPERATION_NOT_BOUND';
    END IF;
    SELECT * INTO seller_operation FROM settlement.bank_operations operation
    WHERE operation.id = instruction_row.seller_operation_id;
    IF NOT FOUND OR seller_operation.status <> 'CONFIRMED'
       OR seller_operation.operation_type <> 'RELEASE'
       OR seller_operation.amount_minor <> instruction_row.seller_amount_minor THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_SELLER_OPERATION_NOT_CONFIRMED';
    END IF;
  END IF;
  IF instruction_row.buyer_refund_minor > 0 THEN
    IF instruction_row.buyer_operation_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_BUYER_OPERATION_NOT_BOUND';
    END IF;
    SELECT * INTO buyer_operation FROM settlement.bank_operations operation
    WHERE operation.id = instruction_row.buyer_operation_id;
    IF NOT FOUND OR buyer_operation.status <> 'CONFIRMED'
       OR buyer_operation.operation_type <> 'REFUND'
       OR buyer_operation.amount_minor <> instruction_row.buyer_refund_minor THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_BUYER_OPERATION_NOT_CONFIRMED';
    END IF;
  END IF;

  UPDATE dispute.money_instructions
  SET status = 'EXECUTED', executed_at = transaction_timestamp()
  WHERE id = instruction_row.id AND status = 'READY';
  UPDATE dispute.cases
  SET status = 'CLOSED', closed_at = transaction_timestamp(), version = version + 1
  WHERE id = p_dispute_id AND version = p_expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_STALE_VERSION'; END IF;

  audit_id := dispute.append_audit('dispute.closed', p_dispute_id, case_row.deal_id,
    jsonb_build_object('status',case_row.status,'version',case_row.version),
    jsonb_build_object('status','CLOSED','version',case_row.version + 1,
      'instructionId',instruction_row.id),
    jsonb_build_object('sellerOperationId',instruction_row.seller_operation_id,
      'buyerOperationId',instruction_row.buyer_operation_id), p_command_id);
  event_id := dispute.append_deal_event('DISPUTE_CLOSED', p_dispute_id, case_row.deal_id,
    jsonb_build_object('instructionId',instruction_row.id,
      'sellerOperationId',instruction_row.seller_operation_id,
      'buyerOperationId',instruction_row.buyer_operation_id));
  outbox_id := dispute.append_outbox('DISPUTE_CLOSED', p_dispute_id, case_row.deal_id,
    jsonb_build_object('instructionId',instruction_row.id,'status','CLOSED'),
    'dispute-closed:' || p_dispute_id, p_command_id, audit_id);

  SELECT dispute.case_json(c) || jsonb_build_object(
    'duplicate',false,'commandId',p_command_id,'auditId',audit_id,
    'eventId',event_id,'outboxId',outbox_id
  ) INTO result FROM dispute.cases c WHERE c.id = p_dispute_id;
  PERFORM dispute.save_command('CLOSE', p_command_id, p_idempotency_key,
    p_request_fingerprint, result);
  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION dispute.finalize_case(text,bigint,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.bind_instruction_operations(text,text,text,text,bigint,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.close_case(text,bigint,text,text,text) FROM PUBLIC;

DO $dispute_runtime_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT USAGE ON SCHEMA dispute TO app_deal;
    GRANT EXECUTE ON FUNCTION dispute.list_cases() TO app_deal;
    GRANT EXECUTE ON FUNCTION dispute.get_case(text) TO app_deal;
    GRANT EXECUTE ON FUNCTION dispute.open_case(text,text,text,text,bigint,text,text,text,text) TO app_deal;
    GRANT EXECUTE ON FUNCTION dispute.add_evidence(text,text,text,text,text,bigint,text,text,text) TO app_deal;
    GRANT EXECUTE ON FUNCTION dispute.triage_case(text,bigint,text,text,text) TO app_deal;
    GRANT EXECUTE ON FUNCTION dispute.decide_case(text,text,integer,text,bigint,text,text,text) TO app_deal;
    GRANT EXECUTE ON FUNCTION dispute.appeal_case(text,text,bigint,text,text,text) TO app_deal;
    GRANT EXECUTE ON FUNCTION dispute.resolve_appeal(text,text,text,integer,text,bigint,text,text,text) TO app_deal;
    GRANT EXECUTE ON FUNCTION dispute.finalize_case(text,bigint,text,text,text) TO app_deal;
    GRANT EXECUTE ON FUNCTION dispute.bind_instruction_operations(text,text,text,text,bigint,text,text,text) TO app_deal;
    GRANT EXECUTE ON FUNCTION dispute.close_case(text,bigint,text,text,text) TO app_deal;
  END IF;
END
$dispute_runtime_grants$;
