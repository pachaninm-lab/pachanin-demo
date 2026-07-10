-- Atomic dispute execution around the canonical Deal.
-- No physical deletion policies are introduced for disputes, holds, evidence, ledger, audit or outbox.

CREATE OR REPLACE FUNCTION public.app_rls_dispute_visible(p_dispute_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.disputes d
    JOIN public.deals deal ON deal.id = d."dealId"
    WHERE d.id = p_dispute_id
      AND deal."tenantId" = current_setting('app.current_tenant_id', true)
      AND (
        current_setting('app.current_role', true) IN (
          'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER'
        )
        OR (
          current_setting('app.current_role', true) = 'ARBITRATOR'
          AND (d."arbitratorId" IS NULL OR d."arbitratorId" = current_setting('app.current_user_id', true))
        )
        OR EXISTS (
          SELECT 1
          FROM public.deal_participants p
          WHERE p."dealId" = d."dealId"
            AND p."tenantId" = current_setting('app.current_tenant_id', true)
            AND p."organizationId" = current_setting('app.current_org_id', true)
            AND p."userId" = current_setting('app.current_user_id', true)
            AND p.role = current_setting('app.current_role', true)
            AND p.status = 'ACTIVE'
            AND p."accessLevel" IN ('READ', 'WORK', 'APPROVE')
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.app_rls_dispute_visible(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_rls_dispute_visible(TEXT) TO PUBLIC;

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS disputes_select ON public.disputes;
DROP POLICY IF EXISTS disputes_insert ON public.disputes;
DROP POLICY IF EXISTS disputes_update ON public.disputes;
DROP POLICY IF EXISTS disputes_delete ON public.disputes;

CREATE POLICY disputes_select ON public.disputes
FOR SELECT USING (public.app_rls_dispute_visible(id));

CREATE POLICY disputes_insert ON public.disputes
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "initiatorOrgId" = current_setting('app.current_org_id', true)
  AND EXISTS (
    SELECT 1
    FROM public.deals deal
    WHERE deal.id = "disputes"."dealId"
      AND deal."tenantId" = current_setting('app.current_tenant_id', true)
      AND (
        public.app_rls_privileged()
        OR EXISTS (
          SELECT 1
          FROM public.deal_participants p
          WHERE p."dealId" = deal.id
            AND p."tenantId" = current_setting('app.current_tenant_id', true)
            AND p."organizationId" = current_setting('app.current_org_id', true)
            AND p."userId" = current_setting('app.current_user_id', true)
            AND p.role = current_setting('app.current_role', true)
            AND p.status = 'ACTIVE'
            AND p."accessLevel" IN ('WORK', 'APPROVE')
        )
      )
  )
);

CREATE POLICY disputes_update ON public.disputes
FOR UPDATE USING (
  public.app_rls_dispute_visible(id)
  AND (
    public.app_rls_privileged()
    OR (
      current_setting('app.current_role', true) = 'ARBITRATOR'
      AND ("arbitratorId" IS NULL OR "arbitratorId" = current_setting('app.current_user_id', true))
    )
  )
)
WITH CHECK (
  public.app_rls_dispute_visible(id)
  AND (
    public.app_rls_privileged()
    OR (
      current_setting('app.current_role', true) = 'ARBITRATOR'
      AND "arbitratorId" = current_setting('app.current_user_id', true)
    )
  )
);

ALTER TABLE public.dispute_money_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_money_holds FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dispute_money_holds_select ON public.dispute_money_holds;
DROP POLICY IF EXISTS dispute_money_holds_insert ON public.dispute_money_holds;
DROP POLICY IF EXISTS dispute_money_holds_update ON public.dispute_money_holds;
DROP POLICY IF EXISTS dispute_money_holds_delete ON public.dispute_money_holds;

CREATE POLICY dispute_money_holds_select ON public.dispute_money_holds
FOR SELECT USING (public.app_rls_dispute_visible("disputeId"));

CREATE POLICY dispute_money_holds_insert ON public.dispute_money_holds
FOR INSERT WITH CHECK (
  public.app_rls_dispute_visible("disputeId")
  AND EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.id = "dispute_money_holds"."disputeId"
      AND (
        public.app_rls_privileged()
        OR d."initiatorOrgId" = current_setting('app.current_org_id', true)
      )
  )
);

CREATE POLICY dispute_money_holds_update ON public.dispute_money_holds
FOR UPDATE USING (
  public.app_rls_dispute_visible("disputeId")
  AND EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.id = "dispute_money_holds"."disputeId"
      AND (
        current_setting('app.current_role', true) = 'ADMIN'
        OR (
          current_setting('app.current_role', true) = 'ARBITRATOR'
          AND d."arbitratorId" = current_setting('app.current_user_id', true)
        )
      )
  )
)
WITH CHECK (
  public.app_rls_dispute_visible("disputeId")
  AND EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.id = "dispute_money_holds"."disputeId"
      AND (
        current_setting('app.current_role', true) = 'ADMIN'
        OR (
          current_setting('app.current_role', true) = 'ARBITRATOR'
          AND d."arbitratorId" = current_setting('app.current_user_id', true)
        )
      )
  )
);

ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_evidence FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dispute_evidence_select ON public.dispute_evidence;
DROP POLICY IF EXISTS dispute_evidence_insert ON public.dispute_evidence;
DROP POLICY IF EXISTS dispute_evidence_update ON public.dispute_evidence;
DROP POLICY IF EXISTS dispute_evidence_delete ON public.dispute_evidence;

CREATE POLICY dispute_evidence_select ON public.dispute_evidence
FOR SELECT USING (public.app_rls_dispute_visible("disputeId"));

CREATE POLICY dispute_evidence_insert ON public.dispute_evidence
FOR INSERT WITH CHECK (
  public.app_rls_dispute_visible("disputeId")
  AND "submittedBy" = current_setting('app.current_user_id', true)
  AND current_setting('app.current_role', true) <> 'EXECUTIVE'
);

DROP POLICY IF EXISTS ledger_entries_select ON public.ledger_entries;
DROP POLICY IF EXISTS ledger_entries_insert ON public.ledger_entries;

CREATE POLICY ledger_entries_select ON public.ledger_entries
FOR SELECT USING (
  public.app_rls_context_ready()
  AND (
    "debitAccount" = current_setting('app.current_org_id', true)
    OR "creditAccount" = current_setting('app.current_org_id', true)
    OR ("dealId" IS NOT NULL AND public.app_rls_deal_visible("dealId"))
    OR ("reference" IS NOT NULL AND public.app_rls_dispute_visible("reference"))
  )
);

CREATE POLICY ledger_entries_insert ON public.ledger_entries
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "createdByUserId" = current_setting('app.current_user_id', true)
  AND (
    (
      current_setting('app.current_role', true) IN ('ADMIN', 'ACCOUNTING', 'BANK_CALLBACK')
      AND ("dealId" IS NULL OR public.app_rls_deal_visible("dealId"))
    )
    OR (
      "entryType" = 'DISPUTE_HOLD'
      AND "reference" IS NOT NULL
      AND "dealId" IS NOT NULL
      AND "debitAccount" = 'escrow:' || "dealId"
      AND "creditAccount" = 'dispute:' || "reference"
      AND EXISTS (
        SELECT 1 FROM public.disputes d
        WHERE d.id = "ledger_entries"."reference"
          AND d."dealId" = "ledger_entries"."dealId"
          AND d."initiatorOrgId" = current_setting('app.current_org_id', true)
          AND public.app_rls_dispute_visible(d.id)
      )
    )
    OR (
      "entryType" IN ('DISPUTE_RETURN_TO_ESCROW', 'DISPUTE_REFUND_PENDING')
      AND "reference" IS NOT NULL
      AND "dealId" IS NOT NULL
      AND "debitAccount" = 'dispute:' || "reference"
      AND EXISTS (
        SELECT 1
        FROM public.disputes d
        JOIN public.deals deal ON deal.id = d."dealId"
        WHERE d.id = "ledger_entries"."reference"
          AND d."dealId" = "ledger_entries"."dealId"
          AND public.app_rls_dispute_visible(d.id)
          AND (
            current_setting('app.current_role', true) = 'ADMIN'
            OR (
              current_setting('app.current_role', true) = 'ARBITRATOR'
              AND d."arbitratorId" = current_setting('app.current_user_id', true)
            )
          )
          AND (
            (
              "ledger_entries"."entryType" = 'DISPUTE_RETURN_TO_ESCROW'
              AND "ledger_entries"."creditAccount" = 'escrow:' || d."dealId"
            )
            OR (
              "ledger_entries"."entryType" = 'DISPUTE_REFUND_PENDING'
              AND "ledger_entries"."creditAccount" =
                'refund_pending:' || d."dealId" || ':' || deal."buyerOrgId"
            )
          )
      )
    )
  )
);

DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
CREATE POLICY audit_events_insert ON public.audit_events
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "actorUserId" = current_setting('app.current_user_id', true)
  AND "actorRole" = current_setting('app.current_role', true)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "orgId" = current_setting('app.current_org_id', true)
  AND (
    "dealId" IS NULL
    OR public.app_rls_deal_visible("dealId")
    OR ("disputeId" IS NOT NULL AND public.app_rls_dispute_visible("disputeId"))
  )
);

DROP POLICY IF EXISTS outbox_entries_select ON public.outbox_entries;
DROP POLICY IF EXISTS outbox_entries_insert ON public.outbox_entries;

CREATE POLICY outbox_entries_select ON public.outbox_entries
FOR SELECT USING (
  public.app_rls_context_ready()
  AND "dealId" IS NOT NULL
  AND (
    public.app_rls_deal_visible("dealId")
    OR (
      ("payload" ->> 'disputeId') IS NOT NULL
      AND public.app_rls_dispute_visible("payload" ->> 'disputeId')
    )
  )
);

CREATE POLICY outbox_entries_insert ON public.outbox_entries
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "dealId" IS NOT NULL
  AND (
    public.app_rls_deal_visible("dealId")
    OR (
      ("payload" ->> 'disputeId') IS NOT NULL
      AND public.app_rls_dispute_visible("payload" ->> 'disputeId')
    )
  )
);
