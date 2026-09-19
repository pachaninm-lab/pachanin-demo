-- Canonical RLS overlay for IR-10.4 Settlement PostgreSQL Authority.
-- Apply after production-rls-policies.sql and the settlement authority migration.

ALTER TABLE settlement.payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.payment_terms FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.beneficiaries FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.holds FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.bank_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.bank_operations FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.bank_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.bank_callbacks FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.ledger_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.reconciliation_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.reconciliation_facts FORCE ROW LEVEL SECURITY;

DO $settlement_policies$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'payment_terms','beneficiaries','payments','holds','bank_operations',
    'bank_callbacks','ledger_entries','reconciliation_facts'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON settlement.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_select ON settlement.%I FOR SELECT USING (%I.tenant_id = current_setting(''app.current_tenant_id'', true) AND settlement.deal_authorized(%I.deal_id, false))',
      table_name, table_name, table_name, table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON settlement.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_insert ON settlement.%I FOR INSERT WITH CHECK (%I.tenant_id = current_setting(''app.current_tenant_id'', true) AND settlement.deal_authorized(%I.deal_id, true))',
      table_name, table_name, table_name, table_name
    );
  END LOOP;
END
$settlement_policies$;

DROP POLICY IF EXISTS payments_update ON settlement.payments;
CREATE POLICY payments_update ON settlement.payments FOR UPDATE
USING (
  payments.tenant_id = current_setting('app.current_tenant_id', true)
  AND settlement.deal_authorized(payments.deal_id, true)
)
WITH CHECK (
  payments.tenant_id = current_setting('app.current_tenant_id', true)
  AND settlement.deal_authorized(payments.deal_id, true)
);

DROP POLICY IF EXISTS holds_update ON settlement.holds;
CREATE POLICY holds_update ON settlement.holds FOR UPDATE
USING (
  holds.tenant_id = current_setting('app.current_tenant_id', true)
  AND settlement.deal_authorized(holds.deal_id, true)
)
WITH CHECK (
  holds.tenant_id = current_setting('app.current_tenant_id', true)
  AND settlement.deal_authorized(holds.deal_id, true)
);

DROP POLICY IF EXISTS bank_operations_update ON settlement.bank_operations;
CREATE POLICY bank_operations_update ON settlement.bank_operations FOR UPDATE
USING (
  bank_operations.tenant_id = current_setting('app.current_tenant_id', true)
  AND settlement.deal_authorized(bank_operations.deal_id, true)
)
WITH CHECK (
  bank_operations.tenant_id = current_setting('app.current_tenant_id', true)
  AND settlement.deal_authorized(bank_operations.deal_id, true)
);

-- There are intentionally no DELETE policies. Terms, beneficiaries, callbacks,
-- ledger and reconciliation are append-only; payments/holds/operations are
-- lifecycle-managed through guarded updates only.
