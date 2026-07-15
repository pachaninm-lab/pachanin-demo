-- The production SettlementPostgresqlRepository operates directly on the
-- canonical settlement schema and maintains public compatibility projections
-- under the restricted application principal. RLS and guarded projection
-- triggers remain the authorization boundary. No DELETE, ownership, role
-- inheritance or RLS-bypass privilege is granted.

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

    REVOKE DELETE ON ALL TABLES IN SCHEMA settlement FROM app_deal;

    GRANT EXECUTE ON FUNCTION settlement.context_ready() TO app_deal;
    GRANT EXECUTE ON FUNCTION settlement.deal_authorized(text, boolean) TO app_deal;

    GRANT SELECT ON TABLE
      public."deals",
      public."deal_participants",
      public."organizations",
      public."users",
      public."user_orgs",
      public."deal_events",
      public."audit_events",
      public."outbox_entries",
      public."payments",
      public."bank_operations",
      public."ledger_entries"
    TO app_deal;

    GRANT INSERT ON TABLE
      public."deal_events",
      public."audit_events",
      public."outbox_entries",
      public."payments",
      public."bank_operations",
      public."ledger_entries"
    TO app_deal;

    GRANT UPDATE ("status", "nextAction", "version", "updatedAt")
      ON TABLE public."deals" TO app_deal;

    GRANT UPDATE (
      "status", "amountKopecks", "holdAmountKopecks", "refundedKopecks",
      "callbackState", "bankRef", "reservedAt", "releasedAt", "version", "updatedAt"
    ) ON TABLE public."payments" TO app_deal;

    GRANT UPDATE (
      "status", "bankRef", "failureReason", "confirmedAt", "responsePayload", "updatedAt"
    ) ON TABLE public."bank_operations" TO app_deal;

    GRANT UPDATE ("status", "confirmedAt", "failedAt", "lastError")
      ON TABLE public."outbox_entries" TO app_deal;

    REVOKE DELETE ON TABLE
      public."deals",
      public."deal_participants",
      public."deal_events",
      public."audit_events",
      public."outbox_entries",
      public."payments",
      public."bank_operations",
      public."ledger_entries"
    FROM app_deal;
  END IF;
END
$settlement_app_role_grants$;
