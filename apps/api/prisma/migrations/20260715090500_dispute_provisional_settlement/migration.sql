-- A first-instance dispute verdict is not an external money release. Until the
-- appeal window closes, funds remain inside dispute-controlled provisional
-- accounts. Only appeal finalization or the no-appeal finalizer can create a
-- release-eligible settlement basis and move value to beneficiary/escrow
-- accounts. This prevents an appeal from attempting to claw back money that the
-- platform already treated as externally released.

ALTER TABLE dispute.holds DROP CONSTRAINT IF EXISTS holds_status_check;
ALTER TABLE dispute.holds
  ADD CONSTRAINT dispute_holds_status_check
  CHECK (status IN ('HELD', 'PROVISIONAL', 'RELEASED'));

ALTER TABLE dispute.command_receipts DROP CONSTRAINT IF EXISTS command_receipts_command_type_check;
ALTER TABLE dispute.command_receipts
  ADD CONSTRAINT dispute_command_receipts_type_check
  CHECK (command_type IN (
    'OPEN_CASE', 'TRIAGE_CASE', 'ADD_EVIDENCE', 'ASSIGN_ARBITRATOR',
    'ADD_NOTE', 'RESOLVE_CASE', 'OPEN_APPEAL', 'RESOLVE_APPEAL',
    'FINALIZE_CASE'
  ));

CREATE OR REPLACE FUNCTION dispute.apply_final_allocation(
  p_case_id text,
  p_deal_id text,
  p_outcome text,
  p_split_buyer_pct integer,
  p_amount_kopecks bigint,
  p_idempotency_prefix text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  deal_row public.deals%ROWTYPE;
  hold_account text := 'dispute-hold:' || p_case_id;
  buyer_amount bigint := 0;
  seller_amount bigint := 0;
  escrow_amount bigint := 0;
BEGIN
  SELECT * INTO deal_row FROM public.deals WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_DEAL_NOT_FOUND';
  END IF;

  IF p_outcome='BUYER_WINS' THEN
    buyer_amount := p_amount_kopecks;
  ELSIF p_outcome='SELLER_WINS' THEN
    seller_amount := p_amount_kopecks;
  ELSIF p_outcome='SPLIT' THEN
    buyer_amount := (p_amount_kopecks * p_split_buyer_pct + 50) / 100;
    seller_amount := p_amount_kopecks - buyer_amount;
  ELSIF p_outcome='CANCELLED' THEN
    escrow_amount := p_amount_kopecks;
  ELSE
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_OUTCOME';
  END IF;

  IF buyer_amount > 0 THEN
    PERFORM dispute.post_ledger(
      p_case_id, p_deal_id, 'REFUND', hold_account,
      'buyer:' || deal_row."buyerOrgId", buyer_amount,
      p_idempotency_prefix || ':buyer', 'Final buyer dispute allocation'
    );
  END IF;
  IF seller_amount > 0 THEN
    PERFORM dispute.post_ledger(
      p_case_id, p_deal_id, 'RELEASE', hold_account,
      'seller:' || deal_row."sellerOrgId", seller_amount,
      p_idempotency_prefix || ':seller', 'Final seller dispute allocation'
    );
  END IF;
  IF escrow_amount > 0 THEN
    PERFORM dispute.post_ledger(
      p_case_id, p_deal_id, 'REFUND', hold_account,
      'escrow:' || p_deal_id, escrow_amount,
      p_idempotency_prefix || ':escrow', 'Final return of disputed amount to deal escrow'
    );
  END IF;

  RETURN jsonb_build_object(
    'buyerAmountKopecks', buyer_amount::text,
    'sellerAmountKopecks', seller_amount::text,
    'escrowAmountKopecks', escrow_amount::text
  );
END
$function$;

CREATE OR REPLACE FUNCTION dispute.resolve_case(
  p_case_id text,
  p_outcome text,
  p_split_buyer_pct integer,
  p_reason text,
  p_command_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  c dispute.cases%ROWTYPE;
  h dispute.holds%ROWTYPE;
  request_hash text;
  replay jsonb;
  before_state jsonb;
  result jsonb;
  audit_id text;
  hold_account text;
  provisional_account text;
  provisional_amount bigint := 0;
BEGIN
  PERFORM dispute.assert_actor(ARRAY['ARBITRATOR','ADMIN']);
  IF p_outcome NOT IN ('BUYER_WINS','SELLER_WINS','SPLIT','CANCELLED') THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_OUTCOME';
  END IF;
  IF p_outcome='SPLIT'
     AND (p_split_buyer_pct IS NULL OR p_split_buyer_pct NOT BETWEEN 0 AND 100) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_SPLIT';
  END IF;

  request_hash := encode(digest(convert_to(jsonb_build_object(
    'caseId',p_case_id,
    'outcome',p_outcome,
    'splitBuyerPct',p_split_buyer_pct,
    'reason',p_reason
  )::text,'UTF8'),'sha256'),'hex');
  replay := dispute.replay_command('RESOLVE_CASE',p_idempotency_key,request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('dispute:case:'||p_case_id,0));
  SELECT * INTO c
  FROM dispute.cases
  WHERE id=p_case_id
    AND tenant_id=current_setting('app.current_tenant_id',true)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_CASE_NOT_FOUND';
  END IF;
  IF c.status NOT IN ('UNDER_REVIEW','ARBITRATION') THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_STATE';
  END IF;
  IF c.assigned_arbitrator_user_id IS DISTINCT FROM current_setting('app.current_user_id',true)
     AND current_setting('app.current_role',true)<>'ADMIN' THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_ARBITRATOR_REQUIRED';
  END IF;

  SELECT * INTO h
  FROM dispute.holds
  WHERE tenant_id=c.tenant_id AND case_id=c.id
  FOR UPDATE;
  before_state := dispute.case_snapshot(p_case_id);

  IF h.id IS NOT NULL AND h.status='HELD' THEN
    hold_account := 'dispute-hold:' || c.id;
    provisional_account := 'dispute-provisional:' || c.id;
    provisional_amount := h.amount_kopecks;
    PERFORM dispute.post_ledger(
      c.id, c.deal_id, 'DISPUTE_PROVISIONAL', hold_account,
      provisional_account, h.amount_kopecks,
      'dispute-provisional:' || c.id,
      'Provisional dispute allocation pending appeal finality'
    );
    UPDATE dispute.holds
    SET status='PROVISIONAL',
        release_reason='FIRST_INSTANCE_VERDICT:' || p_outcome,
        version=version+1
    WHERE tenant_id=c.tenant_id AND case_id=c.id;
  END IF;

  UPDATE dispute.cases
  SET status='RESOLVED',
      outcome=p_outcome,
      outcome_split_buyer_pct=CASE WHEN p_outcome='SPLIT' THEN p_split_buyer_pct ELSE NULL END,
      decision_reason=p_reason,
      resolved_by_user_id=current_setting('app.current_user_id',true),
      resolved_at=clock_timestamp(),
      appeal_deadline_at=transaction_timestamp()+interval '7 days',
      bank_basis_document_id='dispute-provisional-basis:'||c.id||':'||(c.version+1)::text
  WHERE id=c.id;

  result := dispute.case_snapshot(p_case_id);
  audit_id := dispute.append_audit(
    'dispute:resolved',c.id,c.deal_id,before_state,result,
    jsonb_build_object(
      'outcome',p_outcome,
      'provisionalAmountKopecks',provisional_amount::text,
      'releaseEligible',false
    ),
    p_command_id
  );
  PERFORM dispute.append_outbox(
    'DISPUTE_SETTLEMENT_BASIS_READY',c.id,c.deal_id,
    jsonb_build_object(
      'outcome',p_outcome,
      'provisionalAmountKopecks',provisional_amount::text,
      'appealDeadlineAt',transaction_timestamp()+interval '7 days',
      'releaseEligible',false
    ),
    'dispute-settlement-basis:'||c.id||':'||(c.version+1)::text,
    p_command_id,
    audit_id
  );
  PERFORM dispute.save_command(
    'RESOLVE_CASE',p_command_id,p_idempotency_key,request_hash,result
  );
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.resolve_appeal(
  p_case_id text,
  p_granted boolean,
  p_final_outcome text,
  p_final_split_buyer_pct integer,
  p_note text,
  p_command_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  c dispute.cases%ROWTYPE;
  h dispute.holds%ROWTYPE;
  request_hash text;
  replay jsonb;
  result jsonb;
  audit_id text;
  appeal_rows integer := 0;
  provisional_account text;
  hold_account text;
  final_outcome text;
  final_split integer;
  allocation jsonb := jsonb_build_object(
    'buyerAmountKopecks','0',
    'sellerAmountKopecks','0',
    'escrowAmountKopecks','0'
  );
BEGIN
  PERFORM dispute.assert_actor(ARRAY['ARBITRATOR','ADMIN']);
  IF p_granted AND p_final_outcome NOT IN ('BUYER_WINS','SELLER_WINS','SPLIT','CANCELLED') THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_OUTCOME';
  END IF;
  IF p_granted AND p_final_outcome='SPLIT'
     AND (p_final_split_buyer_pct IS NULL OR p_final_split_buyer_pct NOT BETWEEN 0 AND 100) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_SPLIT';
  END IF;

  request_hash := encode(digest(convert_to(jsonb_build_object(
    'caseId',p_case_id,
    'granted',p_granted,
    'finalOutcome',p_final_outcome,
    'splitBuyerPct',p_final_split_buyer_pct,
    'note',p_note
  )::text,'UTF8'),'sha256'),'hex');
  replay := dispute.replay_command('RESOLVE_APPEAL',p_idempotency_key,request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('dispute:case:'||p_case_id,0));
  SELECT * INTO c
  FROM dispute.cases
  WHERE id=p_case_id
    AND tenant_id=current_setting('app.current_tenant_id',true)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_CASE_NOT_FOUND';
  END IF;

  UPDATE dispute.appeals
  SET status=CASE WHEN p_granted THEN 'GRANTED' ELSE 'DENIED' END,
      decided_by_user_id=current_setting('app.current_user_id',true),
      decision_note=p_note,
      resolved_at=clock_timestamp()
  WHERE tenant_id=c.tenant_id
    AND case_id=c.id
    AND status='OPEN';
  GET DIAGNOSTICS appeal_rows = ROW_COUNT;
  IF appeal_rows <> 1 THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_STATE';
  END IF;

  SELECT * INTO h
  FROM dispute.holds
  WHERE tenant_id=c.tenant_id AND case_id=c.id
  FOR UPDATE;

  final_outcome := CASE WHEN p_granted THEN p_final_outcome ELSE c.outcome END;
  final_split := CASE
    WHEN p_granted AND p_final_outcome='SPLIT' THEN p_final_split_buyer_pct
    WHEN NOT p_granted AND c.outcome='SPLIT' THEN c.outcome_split_buyer_pct
    ELSE NULL
  END;

  IF h.id IS NOT NULL AND h.status='PROVISIONAL' THEN
    provisional_account := 'dispute-provisional:' || c.id;
    hold_account := 'dispute-hold:' || c.id;
    PERFORM dispute.post_ledger(
      c.id,c.deal_id,'DISPUTE_PROVISIONAL_REVERSAL',
      provisional_account,hold_account,h.amount_kopecks,
      'dispute-appeal:'||c.id||':reverse-provisional',
      'Return provisional allocation to dispute hold before final disposition'
    );
    allocation := dispute.apply_final_allocation(
      c.id,c.deal_id,final_outcome,final_split,h.amount_kopecks,
      'dispute-appeal:'||c.id||':final'
    );
    UPDATE dispute.holds
    SET status='RELEASED',
        released_at=clock_timestamp(),
        release_reason='FINAL:' || final_outcome,
        version=version+1
    WHERE tenant_id=c.tenant_id AND case_id=c.id;
  END IF;

  UPDATE dispute.cases
  SET status='FINAL',
      outcome=final_outcome,
      outcome_split_buyer_pct=CASE WHEN final_outcome='SPLIT' THEN final_split ELSE NULL END,
      decision_reason=p_note,
      resolved_by_user_id=current_setting('app.current_user_id',true),
      resolved_at=clock_timestamp(),
      bank_basis_document_id='dispute-final-basis:'||c.id||':'||(c.version+1)::text
  WHERE id=c.id;

  result:=dispute.case_snapshot(c.id);
  audit_id:=dispute.append_audit(
    'dispute:appeal_resolved',c.id,c.deal_id,NULL,result,
    jsonb_build_object(
      'granted',p_granted,
      'outcome',final_outcome,
      'allocation',allocation,
      'releaseEligible',true
    ),
    p_command_id
  );
  PERFORM dispute.append_outbox(
    'DISPUTE_FINAL_SETTLEMENT_BASIS_READY',c.id,c.deal_id,
    jsonb_build_object(
      'granted',p_granted,
      'outcome',final_outcome,
      'allocation',allocation,
      'releaseEligible',true
    ),
    'dispute-final-basis:'||c.id,
    p_command_id,
    audit_id
  );
  PERFORM dispute.save_command(
    'RESOLVE_APPEAL',p_command_id,p_idempotency_key,request_hash,result
  );
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.finalize_case(
  p_case_id text,
  p_command_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  c dispute.cases%ROWTYPE;
  h dispute.holds%ROWTYPE;
  request_hash text;
  replay jsonb;
  result jsonb;
  audit_id text;
  provisional_account text;
  hold_account text;
  allocation jsonb := jsonb_build_object(
    'buyerAmountKopecks','0',
    'sellerAmountKopecks','0',
    'escrowAmountKopecks','0'
  );
BEGIN
  PERFORM dispute.assert_actor(ARRAY['ARBITRATOR','ADMIN']);
  request_hash := encode(digest(convert_to(
    jsonb_build_object('caseId',p_case_id)::text,'UTF8'
  ),'sha256'),'hex');
  replay := dispute.replay_command('FINALIZE_CASE',p_idempotency_key,request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('dispute:case:'||p_case_id,0));
  SELECT * INTO c
  FROM dispute.cases
  WHERE id=p_case_id
    AND tenant_id=current_setting('app.current_tenant_id',true)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_CASE_NOT_FOUND';
  END IF;
  IF c.status<>'RESOLVED'
     OR c.outcome IS NULL
     OR c.appeal_deadline_at IS NULL
     OR c.appeal_deadline_at>transaction_timestamp()
     OR EXISTS (
       SELECT 1 FROM dispute.appeals a
       WHERE a.tenant_id=c.tenant_id AND a.case_id=c.id AND a.status='OPEN'
     ) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_NOT_FINALIZABLE';
  END IF;

  SELECT * INTO h
  FROM dispute.holds
  WHERE tenant_id=c.tenant_id AND case_id=c.id
  FOR UPDATE;
  IF h.id IS NOT NULL AND h.status='PROVISIONAL' THEN
    provisional_account := 'dispute-provisional:' || c.id;
    hold_account := 'dispute-hold:' || c.id;
    PERFORM dispute.post_ledger(
      c.id,c.deal_id,'DISPUTE_PROVISIONAL_REVERSAL',
      provisional_account,hold_account,h.amount_kopecks,
      'dispute-finalize:'||c.id||':reverse-provisional',
      'Return provisional allocation to dispute hold before final disposition'
    );
    allocation := dispute.apply_final_allocation(
      c.id,c.deal_id,c.outcome,c.outcome_split_buyer_pct,h.amount_kopecks,
      'dispute-finalize:'||c.id||':final'
    );
    UPDATE dispute.holds
    SET status='RELEASED',
        released_at=clock_timestamp(),
        release_reason='FINAL_NO_APPEAL:' || c.outcome,
        version=version+1
    WHERE tenant_id=c.tenant_id AND case_id=c.id;
  END IF;

  UPDATE dispute.cases
  SET status='FINAL',
      bank_basis_document_id='dispute-final-basis:'||c.id||':'||(c.version+1)::text
  WHERE id=c.id;
  result:=dispute.case_snapshot(c.id);
  audit_id:=dispute.append_audit(
    'dispute:finalized_without_appeal',c.id,c.deal_id,NULL,result,
    jsonb_build_object(
      'outcome',c.outcome,
      'allocation',allocation,
      'releaseEligible',true
    ),
    p_command_id
  );
  PERFORM dispute.append_outbox(
    'DISPUTE_FINAL_SETTLEMENT_BASIS_READY',c.id,c.deal_id,
    jsonb_build_object(
      'outcome',c.outcome,
      'allocation',allocation,
      'releaseEligible',true,
      'finalizedWithoutAppeal',true
    ),
    'dispute-final-basis:'||c.id,
    p_command_id,
    audit_id
  );
  PERFORM dispute.save_command(
    'FINALIZE_CASE',p_command_id,p_idempotency_key,request_hash,result
  );
  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION dispute.apply_final_allocation(text,text,text,integer,bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.resolve_case(text,text,integer,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.resolve_appeal(text,boolean,text,integer,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.finalize_case(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dispute.resolve_case(text,text,integer,text,text,text) TO app_deal;
GRANT EXECUTE ON FUNCTION dispute.resolve_appeal(text,boolean,text,integer,text,text,text) TO app_deal;
GRANT EXECUTE ON FUNCTION dispute.finalize_case(text,text,text) TO app_deal;
