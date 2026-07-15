-- The OPEN appeal row is the command authority. dispute.cases.status is a
-- materialized workflow projection and must not independently veto a valid,
-- locked appeal. This removes a dual-authority race while retaining a strict
-- requirement that the case has a prior terminal outcome.

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
  a dispute.appeals%ROWTYPE;
  deal_row public.deals%ROWTYPE;
  h dispute.holds%ROWTYPE;
  request_hash text;
  replay jsonb;
  result jsonb;
  audit_id text;
  hold_account text;
  old_buyer bigint := 0;
  old_seller bigint := 0;
  old_escrow bigint := 0;
  new_buyer bigint := 0;
  new_seller bigint := 0;
  new_escrow bigint := 0;
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

  SELECT * INTO a
  FROM dispute.appeals
  WHERE tenant_id=current_setting('app.current_tenant_id',true)
    AND case_id=p_case_id
    AND status='OPEN'
  FOR UPDATE;
  IF NOT FOUND OR c.outcome IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_STATE';
  END IF;

  SELECT * INTO deal_row FROM public.deals WHERE id=c.deal_id;
  SELECT * INTO h FROM dispute.holds WHERE tenant_id=c.tenant_id AND case_id=c.id;

  IF p_granted AND h.id IS NOT NULL THEN
    IF c.outcome='BUYER_WINS' THEN
      old_buyer:=h.amount_kopecks;
    ELSIF c.outcome='SELLER_WINS' THEN
      old_seller:=h.amount_kopecks;
    ELSIF c.outcome='SPLIT' THEN
      old_buyer:=(h.amount_kopecks*COALESCE(c.outcome_split_buyer_pct,50)+50)/100;
      old_seller:=h.amount_kopecks-old_buyer;
    ELSE
      old_escrow:=h.amount_kopecks;
    END IF;

    IF p_final_outcome='BUYER_WINS' THEN
      new_buyer:=h.amount_kopecks;
    ELSIF p_final_outcome='SELLER_WINS' THEN
      new_seller:=h.amount_kopecks;
    ELSIF p_final_outcome='SPLIT' THEN
      new_buyer:=(h.amount_kopecks*p_final_split_buyer_pct+50)/100;
      new_seller:=h.amount_kopecks-new_buyer;
    ELSE
      new_escrow:=h.amount_kopecks;
    END IF;

    hold_account:='dispute-hold:'||c.id;
    IF old_buyer>0 THEN
      PERFORM dispute.post_ledger(c.id,c.deal_id,'REFUND','buyer:'||deal_row."buyerOrgId",hold_account,old_buyer,'dispute-appeal:'||c.id||':reverse-buyer','Reverse prior buyer allocation');
    END IF;
    IF old_seller>0 THEN
      PERFORM dispute.post_ledger(c.id,c.deal_id,'REFUND','seller:'||deal_row."sellerOrgId",hold_account,old_seller,'dispute-appeal:'||c.id||':reverse-seller','Reverse prior seller allocation');
    END IF;
    IF old_escrow>0 THEN
      PERFORM dispute.post_ledger(c.id,c.deal_id,'HOLD','escrow:'||c.deal_id,hold_account,old_escrow,'dispute-appeal:'||c.id||':reverse-escrow','Restore appealed amount to dispute hold');
    END IF;
    IF new_buyer>0 THEN
      PERFORM dispute.post_ledger(c.id,c.deal_id,'REFUND',hold_account,'buyer:'||deal_row."buyerOrgId",new_buyer,'dispute-appeal:'||c.id||':buyer','Final buyer allocation');
    END IF;
    IF new_seller>0 THEN
      PERFORM dispute.post_ledger(c.id,c.deal_id,'RELEASE',hold_account,'seller:'||deal_row."sellerOrgId",new_seller,'dispute-appeal:'||c.id||':seller','Final seller allocation');
    END IF;
    IF new_escrow>0 THEN
      PERFORM dispute.post_ledger(c.id,c.deal_id,'REFUND',hold_account,'escrow:'||c.deal_id,new_escrow,'dispute-appeal:'||c.id||':escrow','Final return to escrow');
    END IF;

    UPDATE dispute.cases
    SET outcome=p_final_outcome,
        outcome_split_buyer_pct=CASE WHEN p_final_outcome='SPLIT' THEN p_final_split_buyer_pct ELSE NULL END,
        decision_reason=p_note,
        resolved_by_user_id=current_setting('app.current_user_id',true),
        resolved_at=clock_timestamp(),
        bank_basis_document_id='dispute-basis:'||c.id||':appeal'
    WHERE id=c.id;
  END IF;

  UPDATE dispute.appeals
  SET status=CASE WHEN p_granted THEN 'GRANTED' ELSE 'DENIED' END,
      decided_by_user_id=current_setting('app.current_user_id',true),
      decision_note=p_note,
      resolved_at=clock_timestamp()
  WHERE id=a.id;

  UPDATE dispute.cases SET status='FINAL' WHERE id=c.id;
  result:=dispute.case_snapshot(c.id);
  audit_id:=dispute.append_audit(
    'dispute:appeal_resolved',c.id,c.deal_id,NULL,result,
    jsonb_build_object('granted',p_granted),p_command_id
  );
  PERFORM dispute.append_outbox(
    'DISPUTE_FINAL_SETTLEMENT_BASIS_READY',c.id,c.deal_id,
    jsonb_build_object(
      'granted',p_granted,
      'outcome',CASE WHEN p_granted THEN p_final_outcome ELSE c.outcome END,
      'releaseEligible',true
    ),
    'dispute-final-basis:'||c.id,p_command_id,audit_id
  );
  PERFORM dispute.save_command(
    'RESOLVE_APPEAL',p_command_id,p_idempotency_key,request_hash,result
  );
  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION dispute.resolve_appeal(text,boolean,text,integer,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dispute.resolve_appeal(text,boolean,text,integer,text,text,text) TO app_deal;
