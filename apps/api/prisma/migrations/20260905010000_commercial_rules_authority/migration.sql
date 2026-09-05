-- PC-CROP W1-D: tenant-scoped CommercialRuleSet and RulePack authority.
-- Versions are immutable; only lifecycle state changes are allowed. Decisions
-- are append-only evidence and never create a ledger or payment obligation.

CREATE TABLE public."commercial_rule_sets" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "ruleSetKey" text NOT NULL,
  "version" bigint NOT NULL,
  "stateVersion" bigint NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "name" text NOT NULL,
  "currency" text NOT NULL,
  "rules" jsonb NOT NULL,
  "contentHash" text NOT NULL,
  "effectiveFrom" timestamptz(6),
  "effectiveTo" timestamptz(6),
  "publishedAt" timestamptz(6),
  "retiredAt" timestamptz(6),
  "createdByMembershipId" text NOT NULL,
  "updatedByMembershipId" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_rule_set_version_key" UNIQUE ("tenantId", "organizationId", "ruleSetKey", "version"),
  CONSTRAINT "commercial_rule_set_scope_identity_key" UNIQUE ("id", "tenantId", "organizationId"),
  CONSTRAINT "commercial_rule_set_organization_fkey"
    FOREIGN KEY ("organizationId", "tenantId") REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "commercial_rule_set_created_by_fkey"
    FOREIGN KEY ("createdByMembershipId", "organizationId") REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "commercial_rule_set_updated_by_fkey"
    FOREIGN KEY ("updatedByMembershipId", "organizationId") REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "commercial_rule_set_key_check" CHECK ("ruleSetKey" ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$'),
  CONSTRAINT "commercial_rule_set_name_check" CHECK (length(btrim("name")) BETWEEN 3 AND 160),
  CONSTRAINT "commercial_rule_set_currency_check" CHECK ("currency" IN ('RUB', 'USD', 'EUR', 'CNY')),
  CONSTRAINT "commercial_rule_set_rules_check" CHECK (jsonb_typeof("rules") = 'array' AND jsonb_array_length("rules") BETWEEN 1 AND 100),
  CONSTRAINT "commercial_rule_set_hash_check" CHECK ("contentHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "commercial_rule_set_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  CONSTRAINT "commercial_rule_set_version_check" CHECK ("version" >= 1 AND "stateVersion" >= 1),
  CONSTRAINT "commercial_rule_set_period_check" CHECK ("effectiveTo" IS NULL OR "effectiveFrom" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "commercial_rule_set_publication_check" CHECK (
    ("status" = 'DRAFT' AND "publishedAt" IS NULL AND "retiredAt" IS NULL)
    OR ("status" = 'PUBLISHED' AND "publishedAt" IS NOT NULL AND "retiredAt" IS NULL)
    OR ("status" = 'RETIRED' AND "publishedAt" IS NOT NULL AND "retiredAt" IS NOT NULL)
  )
);

CREATE INDEX "commercial_rule_set_lookup_idx"
  ON public."commercial_rule_sets" ("tenantId", "organizationId", "ruleSetKey", "status");
CREATE UNIQUE INDEX "commercial_rule_set_one_published_idx"
  ON public."commercial_rule_sets" ("tenantId", "organizationId", "ruleSetKey")
  WHERE "status" = 'PUBLISHED';

CREATE TABLE public."commercial_rule_packs" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "rulePackKey" text NOT NULL,
  "version" bigint NOT NULL,
  "stateVersion" bigint NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "name" text NOT NULL,
  "entries" jsonb NOT NULL,
  "contentHash" text NOT NULL,
  "effectiveFrom" timestamptz(6),
  "effectiveTo" timestamptz(6),
  "publishedAt" timestamptz(6),
  "retiredAt" timestamptz(6),
  "createdByMembershipId" text NOT NULL,
  "updatedByMembershipId" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_rule_pack_version_key" UNIQUE ("tenantId", "organizationId", "rulePackKey", "version"),
  CONSTRAINT "commercial_rule_pack_scope_identity_key" UNIQUE ("id", "tenantId", "organizationId"),
  CONSTRAINT "commercial_rule_pack_organization_fkey"
    FOREIGN KEY ("organizationId", "tenantId") REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "commercial_rule_pack_created_by_fkey"
    FOREIGN KEY ("createdByMembershipId", "organizationId") REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "commercial_rule_pack_updated_by_fkey"
    FOREIGN KEY ("updatedByMembershipId", "organizationId") REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "commercial_rule_pack_key_check" CHECK ("rulePackKey" ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$'),
  CONSTRAINT "commercial_rule_pack_name_check" CHECK (length(btrim("name")) BETWEEN 3 AND 160),
  CONSTRAINT "commercial_rule_pack_entries_check" CHECK (jsonb_typeof("entries") = 'array' AND jsonb_array_length("entries") BETWEEN 1 AND 100),
  CONSTRAINT "commercial_rule_pack_hash_check" CHECK ("contentHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "commercial_rule_pack_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  CONSTRAINT "commercial_rule_pack_version_check" CHECK ("version" >= 1 AND "stateVersion" >= 1),
  CONSTRAINT "commercial_rule_pack_period_check" CHECK ("effectiveTo" IS NULL OR "effectiveFrom" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "commercial_rule_pack_publication_check" CHECK (
    ("status" = 'DRAFT' AND "publishedAt" IS NULL AND "retiredAt" IS NULL)
    OR ("status" = 'PUBLISHED' AND "publishedAt" IS NOT NULL AND "retiredAt" IS NULL)
    OR ("status" = 'RETIRED' AND "publishedAt" IS NOT NULL AND "retiredAt" IS NOT NULL)
  )
);

CREATE INDEX "commercial_rule_pack_lookup_idx"
  ON public."commercial_rule_packs" ("tenantId", "organizationId", "rulePackKey", "status");
CREATE UNIQUE INDEX "commercial_rule_pack_one_published_idx"
  ON public."commercial_rule_packs" ("tenantId", "organizationId", "rulePackKey")
  WHERE "status" = 'PUBLISHED';

CREATE TABLE public."commercial_decisions" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "decisionKey" text NOT NULL,
  "ruleSetId" text NOT NULL,
  "ruleSetKey" text NOT NULL,
  "ruleSetVersion" bigint NOT NULL,
  "ruleSetContentHash" text NOT NULL,
  "rulePackId" text,
  "rulePackKey" text,
  "rulePackVersion" bigint,
  "rulePackContentHash" text,
  "input" jsonb NOT NULL,
  "inputHash" text NOT NULL,
  "output" jsonb NOT NULL,
  "outputHash" text NOT NULL,
  "decisionStatus" text NOT NULL,
  "amountKopecks" bigint,
  "currency" text NOT NULL,
  "actorUserId" text NOT NULL,
  "actorMembershipId" text NOT NULL,
  "correlationId" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_decision_key" UNIQUE ("tenantId", "organizationId", "decisionKey"),
  CONSTRAINT "commercial_decision_rule_set_fkey"
    FOREIGN KEY ("ruleSetId", "tenantId", "organizationId") REFERENCES public."commercial_rule_sets" ("id", "tenantId", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "commercial_decision_rule_pack_fkey"
    FOREIGN KEY ("rulePackId", "tenantId", "organizationId") REFERENCES public."commercial_rule_packs" ("id", "tenantId", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "commercial_decision_organization_fkey"
    FOREIGN KEY ("organizationId", "tenantId") REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "commercial_decision_actor_fkey"
    FOREIGN KEY ("actorMembershipId", "organizationId") REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "commercial_decision_key_check" CHECK ("decisionKey" ~ '^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$'),
  CONSTRAINT "commercial_decision_rule_ref_check" CHECK (
    "ruleSetKey" ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$'
    AND "ruleSetVersion" >= 1
    AND "ruleSetContentHash" ~ '^[0-9a-f]{64}$'
    AND (
      ("rulePackId" IS NULL AND "rulePackKey" IS NULL AND "rulePackVersion" IS NULL AND "rulePackContentHash" IS NULL)
      OR ("rulePackId" IS NOT NULL AND "rulePackKey" IS NOT NULL AND "rulePackVersion" >= 1 AND "rulePackContentHash" ~ '^[0-9a-f]{64}$')
    )
  ),
  CONSTRAINT "commercial_decision_hash_check" CHECK ("inputHash" ~ '^[0-9a-f]{64}$' AND "outputHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "commercial_decision_status_check" CHECK ("decisionStatus" IN ('CALCULATED', 'MANUAL_QUOTE_REQUIRED', 'PAYER_CONFIRMATION_REQUIRED', 'MISSING_FACTS')),
  CONSTRAINT "commercial_decision_amount_check" CHECK (
    ("decisionStatus" = 'CALCULATED' AND "amountKopecks" IS NOT NULL AND "amountKopecks" >= 0)
    OR ("decisionStatus" <> 'CALCULATED' AND "amountKopecks" IS NULL)
  ),
  CONSTRAINT "commercial_decision_currency_check" CHECK ("currency" IN ('RUB', 'USD', 'EUR', 'CNY'))
);

CREATE INDEX "commercial_decision_rule_set_idx"
  ON public."commercial_decisions" ("tenantId", "organizationId", "ruleSetId", "createdAt");

CREATE TABLE public."commercial_rule_events" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "aggregateType" text NOT NULL,
  "aggregateId" text NOT NULL,
  "action" text NOT NULL,
  "resultStatus" text NOT NULL,
  "commandId" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "requestFingerprint" text NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" text NOT NULL,
  "actorRole" text NOT NULL,
  "actorMembershipId" text NOT NULL,
  "correlationId" text NOT NULL,
  "beforeState" jsonb,
  "afterState" jsonb NOT NULL,
  "prevHash" text,
  "hash" text NOT NULL,
  "auditEventId" text NOT NULL,
  "outboxEntryId" text NOT NULL,
  "aggregateVersion" bigint NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_rule_event_command_key" UNIQUE ("tenantId", "organizationId", "commandId"),
  CONSTRAINT "commercial_rule_event_idempotency_key" UNIQUE ("tenantId", "organizationId", "idempotencyKey"),
  CONSTRAINT "commercial_rule_event_audit_key" UNIQUE ("auditEventId"),
  CONSTRAINT "commercial_rule_event_outbox_key" UNIQUE ("outboxEntryId"),
  CONSTRAINT "commercial_rule_event_organization_fkey"
    FOREIGN KEY ("organizationId", "tenantId") REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "commercial_rule_event_actor_fkey"
    FOREIGN KEY ("actorMembershipId", "organizationId") REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "commercial_rule_event_type_check" CHECK ("aggregateType" IN ('RULE_SET', 'RULE_PACK')),
  CONSTRAINT "commercial_rule_event_action_check" CHECK ("action" IN ('CREATE_VERSION', 'PUBLISH', 'RETIRE')),
  CONSTRAINT "commercial_rule_event_status_check" CHECK ("resultStatus" IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  CONSTRAINT "commercial_rule_event_hash_check" CHECK (
    "requestFingerprint" ~ '^[0-9a-f]{64}$' AND "hash" ~ '^[0-9a-f]{64}$'
    AND ("prevHash" IS NULL OR "prevHash" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "commercial_rule_event_reason_check" CHECK (length(btrim("reason")) BETWEEN 10 AND 2000),
  CONSTRAINT "commercial_rule_event_version_check" CHECK ("aggregateVersion" >= 1)
);

CREATE INDEX "commercial_rule_event_chain_idx"
  ON public."commercial_rule_events" ("tenantId", "organizationId", "aggregateType", "aggregateId", "createdAt", "id");

CREATE OR REPLACE FUNCTION public.app_commercial_version_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_VERSION_DELETE_FORBIDDEN';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" <> OLD."id" OR NEW."tenantId" <> OLD."tenantId" OR NEW."organizationId" <> OLD."organizationId"
       OR to_jsonb(NEW) - ARRAY['status','stateVersion','publishedAt','retiredAt','updatedByMembershipId','updatedAt']
          IS DISTINCT FROM
          to_jsonb(OLD) - ARRAY['status','stateVersion','publishedAt','retiredAt','updatedByMembershipId','updatedAt'] THEN
      RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_VERSION_CONTENT_IMMUTABLE';
    END IF;
    IF NEW."stateVersion" <> OLD."stateVersion" + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'PC_COMMERCIAL_VERSION_CONFLICT';
    END IF;
    IF NOT ((OLD."status" = 'DRAFT' AND NEW."status" = 'PUBLISHED') OR (OLD."status" = 'PUBLISHED' AND NEW."status" = 'RETIRED')) THEN
      RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_LIFECYCLE_INVALID';
    END IF;
    -- PostgreSQL resolves record fields before boolean short-circuiting. Keep
    -- rule-set-only fields in a statement that is never evaluated for packs.
    IF TG_TABLE_NAME = 'commercial_rule_sets' THEN
      IF OLD."status" = 'PUBLISHED' AND NEW."status" = 'RETIRED'
         AND EXISTS (
           SELECT 1 FROM public."commercial_rule_packs" pack,
             LATERAL jsonb_array_elements(pack."entries") entry
            WHERE pack."tenantId" = OLD."tenantId" AND pack."organizationId" = OLD."organizationId"
              AND pack."status" = 'PUBLISHED' AND entry ->> 'ruleSetId' = OLD."id"
              AND entry ->> 'ruleSetKey' = OLD."ruleSetKey"
              AND entry ->> 'ruleSetVersion' = OLD."version"::text
              AND entry ->> 'ruleSetContentHash' = OLD."contentHash"
         ) THEN
        RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_RULE_SET_IN_USE';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_commercial_decision_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $function$
DECLARE
  authority public."commercial_rule_sets"%ROWTYPE;
  pack public."commercial_rule_packs"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_DECISION_IMMUTABLE';
  END IF;
  SELECT * INTO authority FROM public."commercial_rule_sets"
   WHERE "id" = NEW."ruleSetId" AND "tenantId" = NEW."tenantId" AND "organizationId" = NEW."organizationId";
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_DECISION_RULE_AUTHORITY_MISSING';
  END IF;
  IF authority."status" <> 'PUBLISHED' OR authority."ruleSetKey" <> NEW."ruleSetKey"
     OR authority."version" <> NEW."ruleSetVersion" OR authority."contentHash" <> NEW."ruleSetContentHash"
     OR authority."currency" <> NEW."currency" THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_DECISION_RULE_AUTHORITY_MISMATCH';
  END IF;
  IF NEW."rulePackId" IS NOT NULL THEN
    SELECT * INTO pack FROM public."commercial_rule_packs"
     WHERE "id" = NEW."rulePackId" AND "tenantId" = NEW."tenantId" AND "organizationId" = NEW."organizationId";
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_DECISION_PACK_AUTHORITY_MISSING';
    END IF;
    IF pack."status" <> 'PUBLISHED' OR pack."rulePackKey" <> NEW."rulePackKey"
       OR pack."version" <> NEW."rulePackVersion" OR pack."contentHash" <> NEW."rulePackContentHash" THEN
      RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_DECISION_PACK_AUTHORITY_MISMATCH';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pack."entries") entry
       WHERE entry ->> 'ruleSetId' = NEW."ruleSetId"
         AND entry ->> 'ruleSetKey' = NEW."ruleSetKey"
         AND entry ->> 'ruleSetVersion' = NEW."ruleSetVersion"::text
         AND entry ->> 'ruleSetContentHash' = NEW."ruleSetContentHash"
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_DECISION_PACK_RULE_SET_MISMATCH';
    END IF;
  END IF;
  IF NEW."actorUserId" <> public.app_identity_user_id()
     OR NEW."actorMembershipId" IS DISTINCT FROM public.app_pc_crop_membership_id()
     OR NEW."organizationId" <> public.app_identity_org_id()
     OR NEW."tenantId" <> public.app_identity_tenant_id() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_COMMERCIAL_DECISION_ACTOR_CONTEXT_MISMATCH';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_commercial_rule_event_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $function$
DECLARE
  expected_prev_hash text;
  current_command_id text := nullif(current_setting('app.current_command_id', true), '');
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_RULE_EVENT_IMMUTABLE';
  END IF;
  IF current_command_id IS NULL OR NEW."commandId" <> current_command_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_COMMERCIAL_COMMAND_CONTEXT_MISMATCH';
  END IF;
  IF NEW."actorUserId" <> public.app_identity_user_id()
     OR NEW."actorMembershipId" IS DISTINCT FROM public.app_pc_crop_membership_id()
     OR NEW."organizationId" <> public.app_identity_org_id()
     OR NEW."tenantId" <> public.app_identity_tenant_id() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_COMMERCIAL_EVENT_ACTOR_CONTEXT_MISMATCH';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."audit_events" audit
     WHERE audit."id" = NEW."auditEventId" AND audit."tenantId" = NEW."tenantId"
       AND audit."orgId" = NEW."organizationId" AND audit."actorUserId" = NEW."actorUserId"
       AND audit."actorRole" = NEW."actorRole" AND audit."objectId" = NEW."aggregateId"
       AND audit."objectType" = 'COMMERCIAL_' || NEW."aggregateType"
       AND audit."action" = 'COMMERCIAL_' || NEW."aggregateType" || '_' || NEW."action"
       AND audit."outcome" = 'SUCCESS' AND audit."reason" = NEW."reason"
       AND audit."correlationId" = NEW."correlationId"
       AND audit."metadata" ->> 'commandId' = NEW."commandId"
       AND audit."metadata" ->> 'idempotencyKey' = NEW."idempotencyKey"
       AND audit."metadata" ->> 'requestFingerprint' = NEW."requestFingerprint"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_EVENT_AUDIT_MISMATCH';
  END IF;
  SELECT event."hash" INTO expected_prev_hash FROM public."commercial_rule_events" event
   WHERE event."tenantId" = NEW."tenantId" AND event."organizationId" = NEW."organizationId"
     AND event."aggregateType" = NEW."aggregateType" AND event."aggregateId" = NEW."aggregateId"
   ORDER BY event."createdAt" DESC, event."id" DESC LIMIT 1;
  IF NEW."prevHash" IS DISTINCT FROM expected_prev_hash THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_COMMERCIAL_EVENT_CHAIN_MISMATCH';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER commercial_rule_set_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."commercial_rule_sets"
FOR EACH ROW EXECUTE FUNCTION public.app_commercial_version_guard();
CREATE TRIGGER commercial_rule_pack_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."commercial_rule_packs"
FOR EACH ROW EXECUTE FUNCTION public.app_commercial_version_guard();
CREATE TRIGGER commercial_decision_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."commercial_decisions"
FOR EACH ROW EXECUTE FUNCTION public.app_commercial_decision_guard();
CREATE TRIGGER commercial_rule_event_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."commercial_rule_events"
FOR EACH ROW EXECUTE FUNCTION public.app_commercial_rule_event_guard();

ALTER TABLE public."commercial_rule_sets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."commercial_rule_sets" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."commercial_rule_packs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."commercial_rule_packs" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."commercial_decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."commercial_decisions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."commercial_rule_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."commercial_rule_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY commercial_rule_set_select ON public."commercial_rule_sets" FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
  AND ("status" = 'PUBLISHED' OR public.app_organization_capability_is_org_admin())
);
CREATE POLICY commercial_rule_set_insert ON public."commercial_rule_sets" FOR INSERT WITH CHECK (
  public.app_organization_capability_is_org_admin() AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id() AND "status" = 'DRAFT'
  AND "createdByMembershipId" = public.app_pc_crop_membership_id() AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);
CREATE POLICY commercial_rule_set_update ON public."commercial_rule_sets" FOR UPDATE USING (
  public.app_organization_capability_is_org_admin() AND "tenantId" = public.app_identity_tenant_id() AND "organizationId" = public.app_identity_org_id()
) WITH CHECK (
  public.app_organization_capability_is_org_admin() AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id() AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY commercial_rule_pack_select ON public."commercial_rule_packs" FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
  AND ("status" = 'PUBLISHED' OR public.app_organization_capability_is_org_admin())
);
CREATE POLICY commercial_rule_pack_insert ON public."commercial_rule_packs" FOR INSERT WITH CHECK (
  public.app_organization_capability_is_org_admin() AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id() AND "status" = 'DRAFT'
  AND "createdByMembershipId" = public.app_pc_crop_membership_id() AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);
CREATE POLICY commercial_rule_pack_update ON public."commercial_rule_packs" FOR UPDATE USING (
  public.app_organization_capability_is_org_admin() AND "tenantId" = public.app_identity_tenant_id() AND "organizationId" = public.app_identity_org_id()
) WITH CHECK (
  public.app_organization_capability_is_org_admin() AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id() AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY commercial_decision_select ON public."commercial_decisions" FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL AND "tenantId" = public.app_identity_tenant_id() AND "organizationId" = public.app_identity_org_id()
);
CREATE POLICY commercial_decision_insert ON public."commercial_decisions" FOR INSERT WITH CHECK (
  public.app_pc_crop_membership_id() IS NOT NULL AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id() AND "actorUserId" = public.app_identity_user_id()
  AND "actorMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY commercial_rule_event_select ON public."commercial_rule_events" FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL AND "tenantId" = public.app_identity_tenant_id() AND "organizationId" = public.app_identity_org_id()
);
CREATE POLICY commercial_rule_event_insert ON public."commercial_rule_events" FOR INSERT WITH CHECK (
  public.app_organization_capability_is_org_admin() AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id() AND "actorUserId" = public.app_identity_user_id()
  AND "actorMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY outbox_entries_commercial_rule_insert ON public."outbox_entries" FOR INSERT TO PUBLIC WITH CHECK (
  current_user IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api')
  AND public.app_rls_context_ready() AND "type" = 'commercial.rule.changed.v1' AND "dealId" IS NULL
  AND "triggeredByUserId" = public.app_identity_user_id() AND "correlationId" IS NOT NULL AND "auditId" IS NOT NULL
  AND "idempotencyKey" ~ '^commercial-rule:[0-9a-f]{64}$' AND "runtimeIdempotencyKey" = "idempotencyKey"
  AND "payload" ->> 'schema' = 'commercial-rule.command.v1'
  AND "payload" #>> '{event,type}' = "type"
  AND "payload" #>> '{event,tenantId}' = public.app_identity_tenant_id()
  AND "payload" #>> '{event,organizationId}' = public.app_identity_org_id()
  AND "payload" #>> '{event,auditId}' = "auditId"
  AND "payload" #>> '{event,correlationId}' = "correlationId"
  AND EXISTS (
    SELECT 1 FROM public."commercial_rule_events" event
     WHERE event."outboxEntryId" = "outbox_entries"."id" AND event."auditEventId" = "outbox_entries"."auditId"
       AND event."tenantId" = public.app_identity_tenant_id() AND event."organizationId" = public.app_identity_org_id()
       AND event."actorUserId" = public.app_identity_user_id() AND event."actorRole" = current_setting('app.current_role', true)
       AND event."correlationId" = "outbox_entries"."correlationId"
       AND event."commandId" = "payload" #>> '{event,commandId}'
       AND event."aggregateId" = "payload" #>> '{event,aggregateId}'
       AND event."aggregateType" = "payload" #>> '{event,aggregateType}'
       AND event."action" = "payload" #>> '{event,action}'
       AND event."resultStatus" = "payload" #>> '{event,status}'
       AND event."requestFingerprint" = "payload" ->> 'requestFingerprint'
       AND event."aggregateVersion"::text = "payload" #>> '{event,aggregateVersion}'
  )
);

REVOKE ALL ON FUNCTION public.app_commercial_version_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_commercial_decision_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_commercial_rule_event_guard() FROM PUBLIC;

DO $commercial_rule_runtime_grants$
DECLARE runtime_role text;
BEGIN
  FOR runtime_role IN SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public."commercial_rule_sets" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public."commercial_rule_packs" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT ON public."commercial_decisions" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT ON public."commercial_rule_events" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT ON public."audit_events" TO %I', runtime_role);
    EXECUTE format('GRANT INSERT ON public."outbox_entries" TO %I', runtime_role);
  END LOOP;
  FOR runtime_role IN SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime','pc_staff_runtime','pc_storage_runtime','pc_outbox_runtime','one_deal_auth','one_deal_staff','one_deal_storage','app_auth','app_staff','app_storage','app_outbox')
  LOOP
    EXECUTE format('REVOKE ALL ON public."commercial_rule_sets" FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON public."commercial_rule_packs" FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON public."commercial_decisions" FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON public."commercial_rule_events" FROM %I', runtime_role);
  END LOOP;
END
$commercial_rule_runtime_grants$;
