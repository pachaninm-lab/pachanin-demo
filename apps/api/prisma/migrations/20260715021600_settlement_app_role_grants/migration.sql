-- The production SettlementPostgresqlRepository operates directly on the
-- canonical settlement schema under the restricted application principal.
-- RLS remains the authorization boundary; this migration only supplies the
-- SQL privileges required to reach those policies. No DELETE or RLS bypass is
-- granted.

DO $settlement_app_role_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT USAGE ON SCHEMA settlement TO app_deal;

    GRANT SELECT, INSERT ON TABLE
      settlement.payment_terms,
      settlement.beneficiaries,
      settlement.payments,
      settlement.holds,
      settlement.bank_operations,
      settlement.bank_callbacks,
      settlement.ledger_entries,
      settlement.reconciliation_facts
    TO app_deal;

    GRANT UPDATE ON TABLE
      settlement.payments,
      settlement.holds,
      settlement.bank_operations
    TO app_deal;

    GRANT EXECUTE ON FUNCTION settlement.context_ready() TO app_deal;
    GRANT EXECUTE ON FUNCTION settlement.deal_authorized(text, boolean) TO app_deal;
  END IF;
END
$settlement_app_role_grants$;
