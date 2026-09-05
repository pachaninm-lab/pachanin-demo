CREATE TABLE public."service_marketplace_requests" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "requesterOrganizationId" text NOT NULL,
  "category" text NOT NULL,
  "serviceStage" text NOT NULL,
  "subjectType" text NOT NULL,
  "subjectId" text NOT NULL,
  "description" text NOT NULL,
  "targetRegion" text,
  "status" text NOT NULL DEFAULT 'REQUESTED',
  "stateVersion" bigint NOT NULL DEFAULT 1,
  "selectedQuoteId" text,
  "selectedProviderOrganizationId" text,
  "payerAssignmentId" text,
  "payerOrganizationId" text,
  "payerMembershipId" text,
  "payerConfirmedByMembershipId" text,
  "payerConfirmedAt" timestamptz(6),
  "executionReference" text,
  "evidenceReference" text,
  "evidenceHash" text,
  "acceptanceNote" text,
  "settlementReferenceType" text,
  "settlementReference" text,
  "createsFinancialObligation" boolean NOT NULL DEFAULT false,
  "createdByMembershipId" text NOT NULL,
  "updatedByMembershipId" text NOT NULL,
  "updatedByOrganizationId" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_request_scope_identity_key" UNIQUE ("id", "tenantId"),
  CONSTRAINT "service_request_selected_quote_key" UNIQUE ("selectedQuoteId"),
  CONSTRAINT "service_request_payer_assignment_key" UNIQUE ("tenantId", "requesterOrganizationId", "payerAssignmentId"),
  CONSTRAINT "service_request_requester_organization_fkey"
    FOREIGN KEY ("requesterOrganizationId", "tenantId") REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_request_payer_organization_fkey"
    FOREIGN KEY ("payerOrganizationId", "tenantId") REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_request_created_by_fkey"
    FOREIGN KEY ("createdByMembershipId", "requesterOrganizationId") REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_request_updated_by_fkey"
    FOREIGN KEY ("updatedByMembershipId", "updatedByOrganizationId") REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_request_payer_membership_fkey"
    FOREIGN KEY ("payerMembershipId", "payerOrganizationId") REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_request_payer_confirmed_by_fkey"
    FOREIGN KEY ("payerConfirmedByMembershipId", "payerOrganizationId") REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_request_category_check" CHECK ("category" ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  CONSTRAINT "service_request_stage_check" CHECK ("serviceStage" ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  CONSTRAINT "service_request_subject_check" CHECK (
    "subjectType" ~ '^[A-Z][A-Z0-9_]{2,79}$' AND "subjectId" ~ '^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$'
  ),
  CONSTRAINT "service_request_description_check" CHECK (length(btrim("description")) BETWEEN 10 AND 2000),
  CONSTRAINT "service_request_region_check" CHECK ("targetRegion" IS NULL OR "targetRegion" ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{1,119}$'),
  CONSTRAINT "service_request_status_check" CHECK ("status" IN (
    'REQUESTED','QUOTED','PROVIDER_SELECTED','PAYER_ASSIGNED','PAYER_CONFIRMED',
    'EXECUTING','EVIDENCE_SUBMITTED','ACCEPTED','SETTLEMENT_RECORDED'
  )),
  CONSTRAINT "service_request_version_check" CHECK ("stateVersion" >= 1),
  CONSTRAINT "service_request_nonfinancial_check" CHECK ("createsFinancialObligation" = false),
  CONSTRAINT "service_request_selection_shape_check" CHECK (
    ("status" IN ('REQUESTED','QUOTED') AND "selectedQuoteId" IS NULL AND "selectedProviderOrganizationId" IS NULL)
    OR ("status" NOT IN ('REQUESTED','QUOTED') AND "selectedQuoteId" IS NOT NULL AND "selectedProviderOrganizationId" IS NOT NULL)
  ),
  CONSTRAINT "service_request_payer_shape_check" CHECK (
    ("status" IN ('REQUESTED','QUOTED','PROVIDER_SELECTED') AND "payerAssignmentId" IS NULL
      AND "payerOrganizationId" IS NULL AND "payerMembershipId" IS NULL)
    OR ("status" NOT IN ('REQUESTED','QUOTED','PROVIDER_SELECTED') AND "payerAssignmentId" IS NOT NULL
      AND "payerOrganizationId" IS NOT NULL AND "payerMembershipId" IS NOT NULL)
  ),
  CONSTRAINT "service_request_confirmation_shape_check" CHECK (
    ("status" IN ('REQUESTED','QUOTED','PROVIDER_SELECTED','PAYER_ASSIGNED')
      AND "payerConfirmedByMembershipId" IS NULL AND "payerConfirmedAt" IS NULL)
    OR ("status" NOT IN ('REQUESTED','QUOTED','PROVIDER_SELECTED','PAYER_ASSIGNED')
      AND "payerConfirmedByMembershipId" IS NOT NULL AND "payerConfirmedAt" IS NOT NULL)
  ),
  CONSTRAINT "service_request_execution_shape_check" CHECK (
    ("status" IN ('REQUESTED','QUOTED','PROVIDER_SELECTED','PAYER_ASSIGNED','PAYER_CONFIRMED')
      AND "executionReference" IS NULL)
    OR ("status" NOT IN ('REQUESTED','QUOTED','PROVIDER_SELECTED','PAYER_ASSIGNED','PAYER_CONFIRMED')
      AND "executionReference" IS NOT NULL AND "executionReference" ~ '^[A-Za-z0-9][A-Za-z0-9:_.\/-]{2,239}$')
  ),
  CONSTRAINT "service_request_evidence_shape_check" CHECK (
    ("status" IN ('REQUESTED','QUOTED','PROVIDER_SELECTED','PAYER_ASSIGNED','PAYER_CONFIRMED','EXECUTING')
      AND "evidenceReference" IS NULL AND "evidenceHash" IS NULL)
    OR ("status" NOT IN ('REQUESTED','QUOTED','PROVIDER_SELECTED','PAYER_ASSIGNED','PAYER_CONFIRMED','EXECUTING')
      AND "evidenceReference" IS NOT NULL AND "evidenceHash" IS NOT NULL
      AND "evidenceReference" ~ '^[A-Za-z0-9][A-Za-z0-9:_.\/-]{2,239}$' AND "evidenceHash" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "service_request_acceptance_shape_check" CHECK (
    ("status" IN ('REQUESTED','QUOTED','PROVIDER_SELECTED','PAYER_ASSIGNED','PAYER_CONFIRMED','EXECUTING','EVIDENCE_SUBMITTED')
      AND "acceptanceNote" IS NULL)
    OR ("status" NOT IN ('REQUESTED','QUOTED','PROVIDER_SELECTED','PAYER_ASSIGNED','PAYER_CONFIRMED','EXECUTING','EVIDENCE_SUBMITTED')
      AND "acceptanceNote" IS NOT NULL AND length(btrim("acceptanceNote")) BETWEEN 10 AND 2000)
  ),
  CONSTRAINT "service_request_settlement_shape_check" CHECK (
    ("status" <> 'SETTLEMENT_RECORDED' AND "settlementReferenceType" IS NULL AND "settlementReference" IS NULL)
    OR ("status" = 'SETTLEMENT_RECORDED' AND "settlementReferenceType" IS NOT NULL AND "settlementReference" IS NOT NULL
      AND "settlementReferenceType" IN ('EXTERNAL','SETTLEMENT_PLAN_PENDING','LEDGER_PENDING')
      AND "settlementReference" ~ '^[A-Za-z0-9][A-Za-z0-9:_.\/-]{2,239}$')
  )
);

CREATE INDEX "service_request_requester_status_idx"
  ON public."service_marketplace_requests" ("tenantId", "requesterOrganizationId", "status", "updatedAt");
CREATE INDEX "service_request_provider_status_idx"
  ON public."service_marketplace_requests" ("tenantId", "selectedProviderOrganizationId", "status", "updatedAt");
CREATE INDEX "service_request_payer_status_idx"
  ON public."service_marketplace_requests" ("tenantId", "payerOrganizationId", "status", "updatedAt");

CREATE TABLE public."service_marketplace_quotes" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "requestId" text NOT NULL,
  "providerOrganizationId" text NOT NULL,
  "providerId" text NOT NULL,
  "capabilityId" text NOT NULL,
  "serviceOfferingId" text NOT NULL,
  "serviceOfferingVersion" bigint NOT NULL,
  "commercialDecisionId" text,
  "quoteType" text NOT NULL,
  "amountKopecks" bigint NOT NULL,
  "currency" text NOT NULL,
  "payerMode" text NOT NULL,
  "termsHash" text NOT NULL,
  "expiresAt" timestamptz(6) NOT NULL,
  "createdByMembershipId" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_quote_provider_offering_key" UNIQUE ("requestId", "providerOrganizationId", "serviceOfferingId"),
  CONSTRAINT "service_quote_request_identity_key" UNIQUE ("id", "requestId", "tenantId"),
  CONSTRAINT "service_quote_request_fkey"
    FOREIGN KEY ("requestId", "tenantId") REFERENCES public."service_marketplace_requests" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_quote_offering_fkey"
    FOREIGN KEY ("serviceOfferingId", "tenantId", "providerOrganizationId") REFERENCES public."service_offerings" ("id", "tenantId", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_quote_commercial_decision_fkey"
    FOREIGN KEY ("commercialDecisionId") REFERENCES public."commercial_decisions" ("id")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_quote_provider_organization_fkey"
    FOREIGN KEY ("providerOrganizationId", "tenantId") REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_quote_created_by_fkey"
    FOREIGN KEY ("createdByMembershipId", "providerOrganizationId") REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_quote_version_check" CHECK ("serviceOfferingVersion" >= 1),
  CONSTRAINT "service_quote_type_check" CHECK (
    ("quoteType" = 'RULE_DECISION' AND "commercialDecisionId" IS NOT NULL)
    OR ("quoteType" = 'MANUAL_QUOTE' AND "commercialDecisionId" IS NULL)
  ),
  CONSTRAINT "service_quote_amount_check" CHECK ("amountKopecks" >= 0),
  CONSTRAINT "service_quote_currency_check" CHECK ("currency" IN ('RUB','USD','EUR','CNY')),
  CONSTRAINT "service_quote_payer_check" CHECK ("payerMode" IN (
    'SELLER','BUYER','INITIATOR','DELIVERY_RESPONSIBLE','SPLIT','CONTRACT_RULE','REQUIRES_CONFIRMATION'
  )),
  CONSTRAINT "service_quote_hash_check" CHECK ("termsHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "service_quote_expiry_check" CHECK ("expiresAt" > "createdAt")
);

CREATE INDEX "service_quote_request_idx"
  ON public."service_marketplace_quotes" ("tenantId", "requestId", "createdAt");

ALTER TABLE public."service_marketplace_requests"
  ADD CONSTRAINT "service_marketplace_requests_selectedQuoteId_fkey"
  FOREIGN KEY ("selectedQuoteId") REFERENCES public."service_marketplace_quotes" ("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TABLE public."service_marketplace_events" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "requestId" text NOT NULL,
  "actorOrganizationId" text NOT NULL,
  "commandId" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "requestFingerprint" text NOT NULL,
  "action" text NOT NULL,
  "fromStatus" text,
  "toStatus" text NOT NULL,
  "actorUserId" text NOT NULL,
  "actorRole" text NOT NULL,
  "actorMembershipId" text NOT NULL,
  "correlationId" text NOT NULL,
  "reason" text NOT NULL,
  "payload" jsonb NOT NULL,
  "receipt" jsonb NOT NULL,
  "prevHash" text,
  "hash" text NOT NULL,
  "auditEventId" text NOT NULL,
  "outboxEntryId" text NOT NULL,
  "aggregateVersion" bigint NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_marketplace_event_command_key" UNIQUE ("tenantId", "actorOrganizationId", "commandId"),
  CONSTRAINT "service_marketplace_event_idempotency_key" UNIQUE ("tenantId", "actorOrganizationId", "idempotencyKey"),
  CONSTRAINT "service_marketplace_event_version_key" UNIQUE ("requestId", "aggregateVersion"),
  CONSTRAINT "service_marketplace_event_audit_key" UNIQUE ("auditEventId"),
  CONSTRAINT "service_marketplace_event_outbox_key" UNIQUE ("outboxEntryId"),
  CONSTRAINT "service_marketplace_event_request_fkey"
    FOREIGN KEY ("requestId", "tenantId") REFERENCES public."service_marketplace_requests" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_marketplace_event_actor_organization_fkey"
    FOREIGN KEY ("actorOrganizationId", "tenantId") REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_marketplace_event_actor_fkey"
    FOREIGN KEY ("actorMembershipId", "actorOrganizationId") REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_marketplace_event_action_check" CHECK ("action" IN (
    'CREATE_REQUEST','SUBMIT_QUOTE','SELECT_PROVIDER','ASSIGN_PAYER','CONFIRM_PAYER',
    'START_EXECUTION','SUBMIT_EVIDENCE','ACCEPT_SERVICE','RECORD_SETTLEMENT'
  )),
  CONSTRAINT "service_marketplace_event_status_check" CHECK (
    ("fromStatus" IS NULL OR "fromStatus" IN ('REQUESTED','QUOTED','PROVIDER_SELECTED','PAYER_ASSIGNED','PAYER_CONFIRMED','EXECUTING','EVIDENCE_SUBMITTED','ACCEPTED','SETTLEMENT_RECORDED'))
    AND "toStatus" IN ('REQUESTED','QUOTED','PROVIDER_SELECTED','PAYER_ASSIGNED','PAYER_CONFIRMED','EXECUTING','EVIDENCE_SUBMITTED','ACCEPTED','SETTLEMENT_RECORDED')
  ),
  CONSTRAINT "service_marketplace_event_hash_check" CHECK (
    "requestFingerprint" ~ '^[0-9a-f]{64}$' AND "hash" ~ '^[0-9a-f]{64}$'
    AND ("prevHash" IS NULL OR "prevHash" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "service_marketplace_event_reason_check" CHECK (length(btrim("reason")) BETWEEN 10 AND 2000),
  CONSTRAINT "service_marketplace_event_version_check" CHECK ("aggregateVersion" >= 1),
  CONSTRAINT "service_marketplace_event_nonfinancial_check" CHECK (
    coalesce(("receipt" ->> 'createsFinancialObligation')::boolean, true) = false
  )
);

CREATE INDEX "service_marketplace_event_chain_idx"
  ON public."service_marketplace_events" ("requestId", "createdAt", "id");

CREATE FUNCTION public.app_service_marketplace_participant(request_row public."service_marketplace_requests")
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $function$
  SELECT public.app_pc_crop_membership_id() IS NOT NULL
    AND request_row."tenantId" = public.app_identity_tenant_id()
    AND (
      request_row."requesterOrganizationId" = public.app_identity_org_id()
      OR request_row."selectedProviderOrganizationId" = public.app_identity_org_id()
      OR request_row."payerOrganizationId" = public.app_identity_org_id()
      OR (request_row."status" IN ('REQUESTED','QUOTED') AND EXISTS (
        SELECT 1 FROM public."service_offerings" offering
        JOIN public."provider_capabilities" capability
          ON capability."id" = offering."capabilityId" AND capability."providerId" = offering."providerId"
          AND capability."tenantId" = offering."tenantId" AND capability."organizationId" = offering."organizationId"
        JOIN public."providers" provider
          ON provider."id" = offering."providerId" AND provider."tenantId" = offering."tenantId"
          AND provider."organizationId" = offering."organizationId"
        WHERE offering."tenantId" = request_row."tenantId"
          AND offering."organizationId" = public.app_identity_org_id()
          AND offering."category" = request_row."category"
          AND request_row."serviceStage" = ANY(offering."stages")
          AND offering."status" = 'ACTIVE' AND capability."status" = 'ACTIVE' AND provider."status" = 'ACTIVE'
      ))
    )
$function$;

CREATE FUNCTION public.app_service_marketplace_quote_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $function$
DECLARE
  request_row public."service_marketplace_requests"%ROWTYPE;
  offering_row public."service_offerings"%ROWTYPE;
  decision_row public."commercial_decisions"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_QUOTE_IMMUTABLE';
  END IF;
  NEW."createdAt" := clock_timestamp();
  SELECT * INTO request_row FROM public."service_marketplace_requests"
    WHERE "id" = NEW."requestId" AND "tenantId" = NEW."tenantId";
  IF NOT FOUND OR request_row."status" NOT IN ('REQUESTED','QUOTED') THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_REQUEST_NOT_QUOTABLE';
  END IF;
  SELECT * INTO offering_row FROM public."service_offerings"
    WHERE "id" = NEW."serviceOfferingId" AND "tenantId" = NEW."tenantId"
      AND "organizationId" = NEW."providerOrganizationId";
  IF NOT FOUND OR offering_row."status" <> 'ACTIVE' OR offering_row."version" <> NEW."serviceOfferingVersion"
     OR offering_row."category" <> request_row."category" OR NOT request_row."serviceStage" = ANY(offering_row."stages")
     OR offering_row."providerId" <> NEW."providerId" OR offering_row."capabilityId" <> NEW."capabilityId" THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_OFFERING_NOT_ELIGIBLE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."provider_capabilities" capability
    JOIN public."providers" provider
      ON provider."id" = capability."providerId" AND provider."tenantId" = capability."tenantId"
      AND provider."organizationId" = capability."organizationId"
    WHERE capability."id" = NEW."capabilityId" AND capability."providerId" = NEW."providerId"
      AND capability."tenantId" = NEW."tenantId" AND capability."organizationId" = NEW."providerOrganizationId"
      AND capability."status" = 'ACTIVE' AND provider."status" = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_PROVIDER_NOT_ELIGIBLE';
  END IF;
  IF NEW."providerOrganizationId" <> public.app_identity_org_id()
     OR NEW."tenantId" <> public.app_identity_tenant_id()
     OR NEW."createdByMembershipId" IS DISTINCT FROM public.app_pc_crop_membership_id() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_SERVICE_QUOTE_ACTOR_MISMATCH';
  END IF;
  IF NEW."commercialDecisionId" IS NOT NULL THEN
    SELECT * INTO decision_row FROM public."commercial_decisions" WHERE "id" = NEW."commercialDecisionId";
    IF NOT FOUND OR decision_row."tenantId" <> NEW."tenantId"
       OR decision_row."organizationId" <> NEW."providerOrganizationId"
       OR decision_row."decisionStatus" <> 'CALCULATED'
       OR decision_row."amountKopecks" IS DISTINCT FROM NEW."amountKopecks"
       OR decision_row."currency" <> NEW."currency" THEN
      RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_QUOTE_DECISION_MISMATCH';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

CREATE FUNCTION public.app_service_marketplace_request_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $function$
DECLARE
  action_name text := nullif(current_setting('app.current_service_marketplace_action', true), '');
  actor_org text := public.app_identity_org_id();
  actor_membership text := public.app_pc_crop_membership_id();
  selected_quote public."service_marketplace_quotes"%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_REQUEST_DELETE_FORBIDDEN';
  END IF;
  IF NEW."createsFinancialObligation" THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_FINANCIAL_OBLIGATION_FORBIDDEN';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW."createdAt" := clock_timestamp();
    NEW."updatedAt" := NEW."createdAt";
    IF action_name <> 'CREATE_REQUEST' OR NEW."status" <> 'REQUESTED' OR NEW."stateVersion" <> 1
       OR NEW."requesterOrganizationId" <> actor_org OR NEW."tenantId" <> public.app_identity_tenant_id()
       OR NEW."createdByMembershipId" IS DISTINCT FROM actor_membership
       OR NEW."updatedByMembershipId" IS DISTINCT FROM actor_membership
       OR NEW."updatedByOrganizationId" <> actor_org THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_SERVICE_REQUEST_CREATE_CONTEXT_INVALID';
    END IF;
    RETURN NEW;
  END IF;
  NEW."updatedAt" := clock_timestamp();
  IF NEW."id" <> OLD."id" OR NEW."tenantId" <> OLD."tenantId"
     OR NEW."requesterOrganizationId" <> OLD."requesterOrganizationId"
     OR NEW."category" <> OLD."category" OR NEW."serviceStage" <> OLD."serviceStage"
     OR NEW."subjectType" <> OLD."subjectType" OR NEW."subjectId" <> OLD."subjectId"
     OR NEW."description" <> OLD."description" OR NEW."targetRegion" IS DISTINCT FROM OLD."targetRegion"
     OR NEW."createdByMembershipId" <> OLD."createdByMembershipId" OR NEW."createdAt" <> OLD."createdAt"
     OR NEW."stateVersion" <> OLD."stateVersion" + 1
     OR NEW."updatedByMembershipId" IS DISTINCT FROM actor_membership
     OR NEW."updatedByOrganizationId" <> actor_org THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_REQUEST_IMMUTABLE_OR_VERSION_CONFLICT';
  END IF;
  CASE action_name
    WHEN 'SUBMIT_QUOTE' THEN
      IF OLD."status" NOT IN ('REQUESTED','QUOTED') OR NEW."status" <> 'QUOTED'
         OR NOT public.app_service_marketplace_participant(OLD)
         OR to_jsonb(NEW) - ARRAY['status','stateVersion','updatedByMembershipId','updatedByOrganizationId','updatedAt']
            IS DISTINCT FROM to_jsonb(OLD) - ARRAY['status','stateVersion','updatedByMembershipId','updatedByOrganizationId','updatedAt'] THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_SERVICE_QUOTE_TRANSITION_INVALID';
      END IF;
    WHEN 'SELECT_PROVIDER' THEN
      SELECT * INTO selected_quote FROM public."service_marketplace_quotes"
        WHERE "id" = NEW."selectedQuoteId" AND "requestId" = NEW."id" AND "tenantId" = NEW."tenantId";
      IF OLD."status" <> 'QUOTED' OR NEW."status" <> 'PROVIDER_SELECTED'
         OR actor_org <> OLD."requesterOrganizationId" OR NOT FOUND
         OR selected_quote."expiresAt" <= clock_timestamp()
         OR NEW."selectedProviderOrganizationId" <> selected_quote."providerOrganizationId"
         OR to_jsonb(NEW) - ARRAY['status','stateVersion','selectedQuoteId','selectedProviderOrganizationId','updatedByMembershipId','updatedByOrganizationId','updatedAt']
            IS DISTINCT FROM to_jsonb(OLD) - ARRAY['status','stateVersion','selectedQuoteId','selectedProviderOrganizationId','updatedByMembershipId','updatedByOrganizationId','updatedAt'] THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_SERVICE_SELECTION_INVALID';
      END IF;
    WHEN 'ASSIGN_PAYER' THEN
      IF OLD."status" NOT IN ('PROVIDER_SELECTED','PAYER_ASSIGNED') OR NEW."status" <> 'PAYER_ASSIGNED'
         OR actor_org <> OLD."requesterOrganizationId"
         OR NEW."payerAssignmentId" IS NULL OR NEW."payerOrganizationId" IS NULL OR NEW."payerMembershipId" IS NULL
         OR NEW."payerConfirmedByMembershipId" IS NOT NULL OR NEW."payerConfirmedAt" IS NOT NULL
         OR to_jsonb(NEW) - ARRAY['status','stateVersion','payerAssignmentId','payerOrganizationId','payerMembershipId','payerConfirmedByMembershipId','payerConfirmedAt','updatedByMembershipId','updatedByOrganizationId','updatedAt']
            IS DISTINCT FROM to_jsonb(OLD) - ARRAY['status','stateVersion','payerAssignmentId','payerOrganizationId','payerMembershipId','payerConfirmedByMembershipId','payerConfirmedAt','updatedByMembershipId','updatedByOrganizationId','updatedAt'] THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_SERVICE_PAYER_ASSIGNMENT_INVALID';
      END IF;
    WHEN 'CONFIRM_PAYER' THEN
      NEW."payerConfirmedAt" := clock_timestamp();
      IF OLD."status" <> 'PAYER_ASSIGNED' OR NEW."status" <> 'PAYER_CONFIRMED'
         OR actor_org IS DISTINCT FROM OLD."payerOrganizationId" OR actor_membership IS DISTINCT FROM OLD."payerMembershipId"
         OR NEW."payerConfirmedByMembershipId" IS DISTINCT FROM actor_membership OR NEW."payerConfirmedAt" IS NULL
         OR to_jsonb(NEW) - ARRAY['status','stateVersion','payerConfirmedByMembershipId','payerConfirmedAt','updatedByMembershipId','updatedByOrganizationId','updatedAt']
            IS DISTINCT FROM to_jsonb(OLD) - ARRAY['status','stateVersion','payerConfirmedByMembershipId','payerConfirmedAt','updatedByMembershipId','updatedByOrganizationId','updatedAt'] THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_SERVICE_PAYER_CONFIRMATION_INVALID';
      END IF;
    WHEN 'START_EXECUTION' THEN
      IF OLD."status" <> 'PAYER_CONFIRMED' OR NEW."status" <> 'EXECUTING'
         OR actor_org IS DISTINCT FROM OLD."selectedProviderOrganizationId" OR NEW."executionReference" IS NULL
         OR to_jsonb(NEW) - ARRAY['status','stateVersion','executionReference','updatedByMembershipId','updatedByOrganizationId','updatedAt']
            IS DISTINCT FROM to_jsonb(OLD) - ARRAY['status','stateVersion','executionReference','updatedByMembershipId','updatedByOrganizationId','updatedAt'] THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_SERVICE_EXECUTION_INVALID';
      END IF;
    WHEN 'SUBMIT_EVIDENCE' THEN
      IF OLD."status" <> 'EXECUTING' OR NEW."status" <> 'EVIDENCE_SUBMITTED'
         OR actor_org IS DISTINCT FROM OLD."selectedProviderOrganizationId"
         OR NEW."evidenceReference" IS NULL OR NEW."evidenceHash" IS NULL
         OR to_jsonb(NEW) - ARRAY['status','stateVersion','evidenceReference','evidenceHash','updatedByMembershipId','updatedByOrganizationId','updatedAt']
            IS DISTINCT FROM to_jsonb(OLD) - ARRAY['status','stateVersion','evidenceReference','evidenceHash','updatedByMembershipId','updatedByOrganizationId','updatedAt'] THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_SERVICE_EVIDENCE_INVALID';
      END IF;
    WHEN 'ACCEPT_SERVICE' THEN
      IF OLD."status" <> 'EVIDENCE_SUBMITTED' OR NEW."status" <> 'ACCEPTED'
         OR actor_org <> OLD."requesterOrganizationId" OR NEW."acceptanceNote" IS NULL
         OR to_jsonb(NEW) - ARRAY['status','stateVersion','acceptanceNote','updatedByMembershipId','updatedByOrganizationId','updatedAt']
            IS DISTINCT FROM to_jsonb(OLD) - ARRAY['status','stateVersion','acceptanceNote','updatedByMembershipId','updatedByOrganizationId','updatedAt'] THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_SERVICE_ACCEPTANCE_INVALID';
      END IF;
    WHEN 'RECORD_SETTLEMENT' THEN
      IF OLD."status" <> 'ACCEPTED' OR NEW."status" <> 'SETTLEMENT_RECORDED'
         OR actor_org IS DISTINCT FROM OLD."payerOrganizationId" OR actor_membership IS DISTINCT FROM OLD."payerMembershipId"
         OR NEW."settlementReferenceType" IS NULL OR NEW."settlementReference" IS NULL
         OR to_jsonb(NEW) - ARRAY['status','stateVersion','settlementReferenceType','settlementReference','updatedByMembershipId','updatedByOrganizationId','updatedAt']
            IS DISTINCT FROM to_jsonb(OLD) - ARRAY['status','stateVersion','settlementReferenceType','settlementReference','updatedByMembershipId','updatedByOrganizationId','updatedAt'] THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_SERVICE_SETTLEMENT_INVALID';
      END IF;
    ELSE
      RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_ACTION_CONTEXT_INVALID';
  END CASE;
  RETURN NEW;
END
$function$;

CREATE FUNCTION public.app_service_marketplace_event_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $function$
DECLARE expected_prev_hash text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_EVENT_IMMUTABLE';
  END IF;
  NEW."createdAt" := clock_timestamp();
  IF NEW."tenantId" <> public.app_identity_tenant_id()
     OR NEW."actorOrganizationId" <> public.app_identity_org_id()
     OR NEW."actorUserId" <> public.app_identity_user_id()
     OR NEW."actorMembershipId" IS DISTINCT FROM public.app_pc_crop_membership_id()
     OR NEW."commandId" IS DISTINCT FROM nullif(current_setting('app.current_command_id', true), '')
     OR NEW."action" IS DISTINCT FROM nullif(current_setting('app.current_service_marketplace_action', true), '') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_SERVICE_EVENT_CONTEXT_MISMATCH';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."service_marketplace_requests" request_row
     WHERE request_row."id" = NEW."requestId" AND request_row."tenantId" = NEW."tenantId"
       AND request_row."status" = NEW."toStatus" AND request_row."stateVersion" = NEW."aggregateVersion"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_EVENT_REQUEST_MISMATCH';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."audit_events" audit
     WHERE audit."id" = NEW."auditEventId" AND audit."tenantId" = NEW."tenantId"
       AND audit."orgId" = NEW."actorOrganizationId" AND audit."actorUserId" = NEW."actorUserId"
       AND audit."actorRole" = NEW."actorRole" AND audit."objectId" = NEW."requestId"
       AND audit."objectType" = 'SERVICE_MARKETPLACE_REQUEST'
       AND audit."action" = 'SERVICE_MARKETPLACE_' || NEW."action"
       AND audit."outcome" = 'SUCCESS' AND audit."reason" = NEW."reason"
       AND audit."correlationId" = NEW."correlationId"
       AND audit."metadata" ->> 'commandId' = NEW."commandId"
       AND audit."metadata" ->> 'idempotencyKey' = NEW."idempotencyKey"
       AND audit."metadata" ->> 'requestFingerprint' = NEW."requestFingerprint"
       AND audit."metadata" ->> 'createsFinancialObligation' = 'false'
       AND audit."afterState" ->> 'id' = NEW."requestId"
       AND audit."afterState" ->> 'status' = NEW."toStatus"
       AND audit."afterState" ->> 'stateVersion' = NEW."aggregateVersion"::text
       AND audit."afterState" ->> 'createsFinancialObligation' = 'false'
       AND (
         (NEW."fromStatus" IS NULL AND coalesce(audit."beforeState", 'null'::jsonb) = 'null'::jsonb)
         OR (NEW."fromStatus" IS NOT NULL AND audit."beforeState" ->> 'id' = NEW."requestId"
           AND audit."beforeState" ->> 'status' = NEW."fromStatus"
           AND audit."beforeState" ->> 'stateVersion' = (NEW."aggregateVersion" - 1)::text)
       )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_EVENT_AUDIT_MISMATCH';
  END IF;
  IF NEW."payload" ->> 'requestId' IS DISTINCT FROM NEW."requestId"
     OR NEW."payload" ->> 'action' IS DISTINCT FROM NEW."action"
     OR NEW."payload" ->> 'commandId' IS DISTINCT FROM NEW."commandId"
     OR NEW."payload" ->> 'idempotencyKey' IS DISTINCT FROM NEW."idempotencyKey"
     OR NEW."payload" ->> 'correlationId' IS DISTINCT FROM NEW."correlationId"
     OR NEW."receipt" ->> 'requestId' IS DISTINCT FROM NEW."requestId"
     OR NEW."receipt" ->> 'action' IS DISTINCT FROM NEW."action"
     OR NEW."receipt" ->> 'status' IS DISTINCT FROM NEW."toStatus"
     OR NEW."receipt" ->> 'stateVersion' IS DISTINCT FROM NEW."aggregateVersion"::text
     OR NEW."receipt" ->> 'commandId' IS DISTINCT FROM NEW."commandId"
     OR NEW."receipt" ->> 'idempotencyKey' IS DISTINCT FROM NEW."idempotencyKey"
     OR NEW."receipt" ->> 'correlationId' IS DISTINCT FROM NEW."correlationId"
     OR NEW."receipt" ->> 'replayed' IS DISTINCT FROM 'false'
     OR NEW."receipt" ->> 'createsFinancialObligation' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_EVENT_MATERIAL_MISMATCH';
  END IF;
  SELECT event."hash" INTO expected_prev_hash FROM public."service_marketplace_events" event
   WHERE event."tenantId" = NEW."tenantId" AND event."requestId" = NEW."requestId"
   ORDER BY event."aggregateVersion" DESC LIMIT 1;
  IF NEW."prevHash" IS DISTINCT FROM expected_prev_hash THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_EVENT_CHAIN_MISMATCH';
  END IF;
  NEW."hash" := encode(sha256(convert_to((jsonb_build_object(
    'id', NEW."id", 'tenantId', NEW."tenantId", 'requestId', NEW."requestId",
    'actorOrganizationId', NEW."actorOrganizationId", 'commandId', NEW."commandId",
    'idempotencyKey', NEW."idempotencyKey", 'requestFingerprint', NEW."requestFingerprint",
    'action', NEW."action", 'fromStatus', NEW."fromStatus", 'toStatus', NEW."toStatus",
    'actorUserId', NEW."actorUserId", 'actorRole', NEW."actorRole",
    'actorMembershipId', NEW."actorMembershipId", 'correlationId', NEW."correlationId",
    'reason', NEW."reason", 'payload', NEW."payload", 'receipt', NEW."receipt",
    'prevHash', NEW."prevHash", 'auditEventId', NEW."auditEventId",
    'outboxEntryId', NEW."outboxEntryId", 'aggregateVersion', NEW."aggregateVersion"::text,
    'createdAt', to_char(NEW."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  ))::text, 'UTF8')), 'hex');
  RETURN NEW;
END
$function$;

CREATE FUNCTION public.app_service_marketplace_evidence_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $function$
DECLARE command_id text := nullif(current_setting('app.current_command_id', true), '');
DECLARE action_name text := nullif(current_setting('app.current_service_marketplace_action', true), '');
BEGIN
  IF command_id IS NULL OR action_name IS NULL OR NOT EXISTS (
    SELECT 1 FROM public."service_marketplace_events" event
     WHERE event."tenantId" = NEW."tenantId" AND event."requestId" = NEW."id"
       AND event."commandId" = command_id AND event."action" = action_name
       AND event."toStatus" = NEW."status" AND event."aggregateVersion" = NEW."stateVersion"
       AND event."receipt" ->> 'requestId' = NEW."id"
       AND event."receipt" ->> 'status' = NEW."status"
       AND event."receipt" ->> 'stateVersion' = NEW."stateVersion"::text
       AND event."receipt" ->> 'createsFinancialObligation' = 'false'
       AND EXISTS (
         SELECT 1 FROM public."outbox_entries" outbox
          WHERE outbox."id" = event."outboxEntryId" AND outbox."auditId" = event."auditEventId"
            AND outbox."type" = 'service.marketplace.changed.v1'
            AND outbox."correlationId" = event."correlationId"
            AND outbox."payload" ->> 'requestFingerprint' = event."requestFingerprint"
            AND outbox."payload" #>> '{event,commandId}' = event."commandId"
            AND outbox."payload" #>> '{event,requestId}' = event."requestId"
            AND outbox."payload" #>> '{event,status}' = event."toStatus"
            AND outbox."payload" #>> '{event,aggregateVersion}' = event."aggregateVersion"::text
       )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_REQUEST_EVIDENCE_REQUIRED';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER service_marketplace_request_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."service_marketplace_requests"
FOR EACH ROW EXECUTE FUNCTION public.app_service_marketplace_request_guard();
CREATE TRIGGER service_marketplace_quote_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."service_marketplace_quotes"
FOR EACH ROW EXECUTE FUNCTION public.app_service_marketplace_quote_guard();
CREATE TRIGGER service_marketplace_event_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."service_marketplace_events"
FOR EACH ROW EXECUTE FUNCTION public.app_service_marketplace_event_guard();
CREATE CONSTRAINT TRIGGER service_marketplace_request_evidence_guard
AFTER INSERT OR UPDATE ON public."service_marketplace_requests"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.app_service_marketplace_evidence_guard();

ALTER TABLE public."service_marketplace_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."service_marketplace_requests" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."service_marketplace_quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."service_marketplace_quotes" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."service_marketplace_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."service_marketplace_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY service_marketplace_request_select ON public."service_marketplace_requests" FOR SELECT USING (
  public.app_service_marketplace_participant("service_marketplace_requests")
);
CREATE POLICY service_marketplace_request_insert ON public."service_marketplace_requests" FOR INSERT WITH CHECK (
  public.app_pc_crop_membership_id() IS NOT NULL AND "tenantId" = public.app_identity_tenant_id()
  AND "requesterOrganizationId" = public.app_identity_org_id()
  AND "createdByMembershipId" = public.app_pc_crop_membership_id()
);
CREATE POLICY service_marketplace_request_update ON public."service_marketplace_requests" FOR UPDATE USING (
  public.app_service_marketplace_participant("service_marketplace_requests")
) WITH CHECK (
  "tenantId" = public.app_identity_tenant_id() AND "updatedByOrganizationId" = public.app_identity_org_id()
  AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY service_marketplace_quote_select ON public."service_marketplace_quotes" FOR SELECT USING (
  "tenantId" = public.app_identity_tenant_id() AND EXISTS (
    SELECT 1 FROM public."service_marketplace_requests" request_row
     WHERE request_row."id" = "service_marketplace_quotes"."requestId"
       AND (request_row."requesterOrganizationId" = public.app_identity_org_id()
         OR "service_marketplace_quotes"."providerOrganizationId" = public.app_identity_org_id()
         OR request_row."selectedProviderOrganizationId" = public.app_identity_org_id()
         OR request_row."payerOrganizationId" = public.app_identity_org_id())
  )
);
CREATE POLICY service_marketplace_quote_insert ON public."service_marketplace_quotes" FOR INSERT WITH CHECK (
  public.app_pc_crop_membership_id() IS NOT NULL AND "tenantId" = public.app_identity_tenant_id()
  AND "providerOrganizationId" = public.app_identity_org_id()
  AND "createdByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY service_marketplace_event_select ON public."service_marketplace_events" FOR SELECT USING (
  "tenantId" = public.app_identity_tenant_id() AND (
    "actorOrganizationId" = public.app_identity_org_id()
    OR EXISTS (
      SELECT 1 FROM public."service_marketplace_requests" request_row
       WHERE request_row."id" = "service_marketplace_events"."requestId"
         AND public.app_service_marketplace_participant(request_row)
    )
  )
);
CREATE POLICY service_marketplace_event_insert ON public."service_marketplace_events" FOR INSERT WITH CHECK (
  public.app_pc_crop_membership_id() IS NOT NULL AND "tenantId" = public.app_identity_tenant_id()
  AND "actorOrganizationId" = public.app_identity_org_id()
  AND "actorUserId" = public.app_identity_user_id()
  AND "actorMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY outbox_entries_service_marketplace_insert ON public."outbox_entries" FOR INSERT TO PUBLIC WITH CHECK (
  current_user IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api')
  AND public.app_rls_context_ready() AND "type" = 'service.marketplace.changed.v1' AND "dealId" IS NULL
  AND "triggeredByUserId" = public.app_identity_user_id() AND "correlationId" IS NOT NULL AND "auditId" IS NOT NULL
  AND "idempotencyKey" ~ '^service-marketplace:[0-9a-f]{64}$' AND "runtimeIdempotencyKey" = "idempotencyKey"
  AND "payload" ->> 'schema' = 'service-marketplace.command.v1'
  AND "payload" #>> '{event,type}' = "type"
  AND "payload" #>> '{event,tenantId}' = public.app_identity_tenant_id()
  AND "payload" #>> '{event,actorOrganizationId}' = public.app_identity_org_id()
  AND "payload" #>> '{event,auditId}' = "auditId"
  AND "payload" #>> '{event,correlationId}' = "correlationId"
  AND EXISTS (
    SELECT 1 FROM public."service_marketplace_events" event
     WHERE event."outboxEntryId" = "outbox_entries"."id" AND event."auditEventId" = "outbox_entries"."auditId"
       AND event."tenantId" = public.app_identity_tenant_id()
       AND event."actorOrganizationId" = public.app_identity_org_id()
       AND event."actorUserId" = public.app_identity_user_id()
       AND event."correlationId" = "outbox_entries"."correlationId"
       AND event."commandId" = "outbox_entries"."payload" #>> '{event,commandId}'
       AND event."requestId" = "outbox_entries"."payload" #>> '{event,requestId}'
       AND event."action" = "outbox_entries"."payload" #>> '{event,action}'
       AND event."toStatus" = "outbox_entries"."payload" #>> '{event,status}'
       AND event."aggregateVersion"::text = "outbox_entries"."payload" #>> '{event,aggregateVersion}'
       AND event."requestFingerprint" = "outbox_entries"."payload" ->> 'requestFingerprint'
  )
);

REVOKE ALL ON FUNCTION public.app_service_marketplace_participant(public."service_marketplace_requests") FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_service_marketplace_quote_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_service_marketplace_request_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_service_marketplace_event_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_service_marketplace_evidence_guard() FROM PUBLIC;

DO $service_marketplace_runtime_grants$
DECLARE runtime_role text;
BEGIN
  FOR runtime_role IN SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public."service_marketplace_requests" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT ON public."service_marketplace_quotes" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT ON public."service_marketplace_events" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT ON public."audit_events" TO %I', runtime_role);
    EXECUTE format('GRANT INSERT ON public."outbox_entries" TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.app_service_marketplace_participant(public."service_marketplace_requests") TO %I',
      runtime_role
    );
  END LOOP;
  FOR runtime_role IN SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime','pc_staff_runtime','pc_storage_runtime','pc_outbox_runtime','one_deal_auth','one_deal_staff','one_deal_storage','app_auth','app_staff','app_storage','app_outbox')
  LOOP
    EXECUTE format('REVOKE ALL ON public."service_marketplace_requests" FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON public."service_marketplace_quotes" FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON public."service_marketplace_events" FROM %I', runtime_role);
  END LOOP;
END
$service_marketplace_runtime_grants$;
