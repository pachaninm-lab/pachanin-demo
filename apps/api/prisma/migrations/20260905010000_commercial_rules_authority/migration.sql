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

-- Independent PostgreSQL evaluator: restricted INSERT cannot supply an
-- authoritative amount, allocation, status or hash that disagrees with rules.
CREATE FUNCTION public.app_commercial_evaluate(definition jsonb, facts jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $function$
DECLARE
  model text := definition ->> 'pricingModel';
  payer text := definition ->> 'payerMode';
  pricing jsonb := definition -> 'pricing';
  required_fields text[];
  allowed_fields text[];
  field text;
  value jsonb;
  amount numeric;
  variable_amount numeric;
  multiplier numeric;
  denominator numeric := 1;
  fact_name text;
  missing text[] := ARRAY[]::text[];
  shares jsonb := definition -> 'payerShares';
  share jsonb;
  payers text[] := ARRAY[]::text[];
  total_basis_points integer := 0;
  share_index integer := 0;
  allocated numeric := 0;
  allocation numeric;
  result_allocations jsonb := '[]'::jsonb;
  result_status text;
  max_amount constant numeric := 9223372036854775807;
BEGIN
  IF model IS NULL OR model NOT IN ('FREE','SUBSCRIPTION','ACCESS_FEE','FIXED','PER_TON','PER_KM','PER_TRIP','PER_HOUR','PERCENT','SUCCESS_FEE','CAPPED_PERCENT','HYBRID','MANUAL_QUOTE')
     OR payer IS NULL OR payer NOT IN ('SELLER','BUYER','INITIATOR','DELIVERY_RESPONSIBLE','SPLIT','CONTRACT_RULE','REQUIRES_CONFIRMATION')
     OR jsonb_typeof(pricing) IS DISTINCT FROM 'object' OR jsonb_typeof(facts) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'PC_COMMERCIAL_DEFINITION_INVALID' USING ERRCODE = '23000';
  END IF;
  required_fields := CASE
    WHEN model IN ('SUBSCRIPTION','ACCESS_FEE','FIXED','SUCCESS_FEE') THEN ARRAY['amountKopecks']
    WHEN model IN ('PER_TON','PER_KM','PER_TRIP','PER_HOUR') THEN ARRAY['rateKopecks']
    WHEN model = 'PERCENT' THEN ARRAY['basisPoints']
    WHEN model = 'CAPPED_PERCENT' THEN ARRAY['basisPoints','capKopecks']
    WHEN model = 'HYBRID' THEN ARRAY['fixedKopecks','basisPoints']
    ELSE ARRAY[]::text[] END;
  allowed_fields := required_fields;
  IF model = 'HYBRID' THEN allowed_fields := allowed_fields || ARRAY['capKopecks']; END IF;
  IF NOT pricing ?& required_fields OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(pricing) AS keys(key) WHERE NOT key = ANY(allowed_fields)
  ) THEN RAISE EXCEPTION 'PC_COMMERCIAL_PRICING_INVALID' USING ERRCODE = '23000'; END IF;
  FOR field, value IN SELECT * FROM jsonb_each(pricing) LOOP
    IF field = 'basisPoints' THEN
      IF jsonb_typeof(value) IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'PC_COMMERCIAL_BASIS_POINTS_INVALID' USING ERRCODE = '23000';
      END IF;
      IF value::text::numeric < 0 OR value::text::numeric > 10000 OR trunc(value::text::numeric) <> value::text::numeric THEN
        RAISE EXCEPTION 'PC_COMMERCIAL_BASIS_POINTS_INVALID' USING ERRCODE = '23000';
      END IF;
    ELSE
      IF jsonb_typeof(value) IS DISTINCT FROM 'string' OR btrim(value #>> '{}') !~ '^(0|[1-9][0-9]{0,18})$' THEN
        RAISE EXCEPTION 'PC_COMMERCIAL_PRICING_INTEGER_INVALID' USING ERRCODE = '23000';
      END IF;
      IF (value #>> '{}')::numeric > max_amount THEN
        RAISE EXCEPTION 'PC_COMMERCIAL_AMOUNT_OVERFLOW' USING ERRCODE = '23000';
      END IF;
    END IF;
  END LOOP;
  FOR field, value IN SELECT * FROM jsonb_each(facts) LOOP
    IF field = 'contractPayer' THEN
      RAISE EXCEPTION 'PC_COMMERCIAL_CONTRACT_PAYER_AUTHORITY_REQUIRED' USING ERRCODE = '42501';
    ELSIF field = 'success' THEN
      IF jsonb_typeof(value) IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'PC_COMMERCIAL_FACT_INVALID' USING ERRCODE = '23000';
      END IF;
    ELSIF field IN ('baseAmountKopecks','quantityMilliTons','distanceMeters','tripCount','durationMinutes','subscriptionPeriods','accessUnits') THEN
      IF jsonb_typeof(value) IS DISTINCT FROM 'string' OR (value #>> '{}') !~ '^(0|[1-9][0-9]{0,18})$' THEN
        RAISE EXCEPTION 'PC_COMMERCIAL_FACT_INVALID' USING ERRCODE = '23000';
      END IF;
      IF (value #>> '{}')::numeric > max_amount THEN
        RAISE EXCEPTION 'PC_COMMERCIAL_AMOUNT_OVERFLOW' USING ERRCODE = '23000';
      END IF;
    ELSE RAISE EXCEPTION 'PC_COMMERCIAL_FACT_INVALID' USING ERRCODE = '23000';
    END IF;
  END LOOP;
  IF payer = 'SPLIT' THEN
    IF jsonb_typeof(shares) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'PC_COMMERCIAL_SPLIT_INVALID' USING ERRCODE = '23000';
    END IF;
    IF jsonb_array_length(shares) NOT BETWEEN 2 AND 4 THEN
      RAISE EXCEPTION 'PC_COMMERCIAL_SPLIT_INVALID' USING ERRCODE = '23000';
    END IF;
    FOR share IN SELECT * FROM jsonb_array_elements(shares) LOOP
      IF share ->> 'payer' IS NULL OR share ->> 'payer' NOT IN ('SELLER','BUYER','INITIATOR','DELIVERY_RESPONSIBLE')
         OR share ->> 'payer' = ANY(payers) OR jsonb_typeof(share -> 'basisPoints') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'PC_COMMERCIAL_SPLIT_INVALID' USING ERRCODE = '23000';
      END IF;
      multiplier := (share ->> 'basisPoints')::numeric;
      IF multiplier < 0 OR multiplier > 10000 OR multiplier <> trunc(multiplier) THEN
        RAISE EXCEPTION 'PC_COMMERCIAL_SPLIT_INVALID' USING ERRCODE = '23000';
      END IF;
      total_basis_points := total_basis_points + multiplier::integer;
      payers := array_append(payers, share ->> 'payer');
    END LOOP;
    IF total_basis_points <> 10000 THEN
      RAISE EXCEPTION 'PC_COMMERCIAL_SPLIT_INVALID' USING ERRCODE = '23000';
    END IF;
  END IF;

  fact_name := CASE model
    WHEN 'SUBSCRIPTION' THEN 'subscriptionPeriods' WHEN 'ACCESS_FEE' THEN 'accessUnits'
    WHEN 'PER_TON' THEN 'quantityMilliTons' WHEN 'PER_KM' THEN 'distanceMeters'
    WHEN 'PER_TRIP' THEN 'tripCount' WHEN 'PER_HOUR' THEN 'durationMinutes'
    WHEN 'PERCENT' THEN 'baseAmountKopecks' WHEN 'CAPPED_PERCENT' THEN 'baseAmountKopecks'
    WHEN 'HYBRID' THEN 'baseAmountKopecks' WHEN 'SUCCESS_FEE' THEN 'success' END;
  IF fact_name IS NOT NULL AND NOT facts ? fact_name THEN
    missing := array_append(missing, fact_name);
  ELSIF model = 'FREE' THEN amount := 0;
  ELSIF model = 'FIXED' THEN amount := (pricing ->> 'amountKopecks')::numeric;
  ELSIF model = 'SUCCESS_FEE' THEN
    amount := CASE WHEN (facts ->> 'success')::boolean THEN (pricing ->> 'amountKopecks')::numeric ELSE 0 END;
  ELSIF model <> 'MANUAL_QUOTE' THEN
    multiplier := (facts ->> fact_name)::numeric;
    IF model IN ('PERCENT','CAPPED_PERCENT','HYBRID') THEN
      amount := (pricing ->> 'basisPoints')::numeric;
      denominator := 10000;
    ELSIF model IN ('SUBSCRIPTION','ACCESS_FEE') THEN amount := (pricing ->> 'amountKopecks')::numeric;
    ELSE
      amount := (pricing ->> 'rateKopecks')::numeric;
      denominator := CASE WHEN model IN ('PER_TON','PER_KM') THEN 1000 WHEN model = 'PER_HOUR' THEN 60 ELSE 1 END;
    END IF;
    -- Exact integer division: no numeric-division scale or float rounding.
    variable_amount := amount * multiplier;
    amount := div(variable_amount, denominator) + CASE WHEN mod(variable_amount, denominator) * 2 >= denominator THEN 1 ELSE 0 END;
    IF amount > max_amount THEN RAISE EXCEPTION 'PC_COMMERCIAL_AMOUNT_OVERFLOW' USING ERRCODE = '23000'; END IF;
    IF model IN ('CAPPED_PERCENT','HYBRID') AND pricing ? 'capKopecks' THEN
      amount := least(amount, (pricing ->> 'capKopecks')::numeric);
    END IF;
    IF model = 'HYBRID' THEN amount := amount + (pricing ->> 'fixedKopecks')::numeric; END IF;
  END IF;
  IF amount < 0 OR amount > max_amount THEN RAISE EXCEPTION 'PC_COMMERCIAL_AMOUNT_OVERFLOW' USING ERRCODE = '23000'; END IF;
  IF model = 'MANUAL_QUOTE' THEN result_status := 'MANUAL_QUOTE_REQUIRED';
  ELSIF cardinality(missing) > 0 THEN result_status := 'MISSING_FACTS';
  ELSIF payer = 'REQUIRES_CONFIRMATION' THEN result_status := 'PAYER_CONFIRMATION_REQUIRED';
  ELSIF payer = 'CONTRACT_RULE' THEN
    result_status := 'MISSING_FACTS'; missing := ARRAY['contractPayer'];
  ELSE result_status := 'CALCULATED';
  END IF;
  IF result_status = 'CALCULATED' THEN
    IF payer = 'SPLIT' THEN
      FOR share IN SELECT * FROM jsonb_array_elements(shares) LOOP
        share_index := share_index + 1;
        allocation := CASE WHEN share_index = jsonb_array_length(shares) THEN amount - allocated
          ELSE div(amount * (share ->> 'basisPoints')::numeric, 10000) END;
        allocated := allocated + allocation;
        result_allocations := result_allocations || jsonb_build_array(jsonb_build_object('payer', share ->> 'payer', 'amountKopecks', allocation::bigint::text));
      END LOOP;
    ELSE result_allocations := jsonb_build_array(jsonb_build_object('payer', payer, 'amountKopecks', amount::bigint::text));
    END IF;
  END IF;
  RETURN jsonb_build_object('status', result_status, 'amountKopecks', CASE WHEN result_status = 'CALCULATED' THEN amount::bigint::text ELSE NULL END,
    'payerAllocations', result_allocations, 'missingFacts', to_jsonb(missing));
END
$function$;

CREATE FUNCTION public.app_commercial_version_snapshot(aggregate_type text, row_data jsonb)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $function$
  SELECT CASE WHEN row_data IS NULL THEN 'null'::jsonb ELSE jsonb_build_object(
    'aggregateType', aggregate_type, 'aggregateId', row_data ->> 'id',
    'aggregateKey', CASE WHEN aggregate_type = 'RULE_SET' THEN row_data ->> 'ruleSetKey' ELSE row_data ->> 'rulePackKey' END,
    'version', row_data ->> 'version', 'stateVersion', row_data ->> 'stateVersion',
    'status', row_data ->> 'status', 'name', row_data ->> 'name', 'currency', row_data ->> 'currency',
    'contentHash', row_data ->> 'contentHash',
    'effectiveFrom', to_char((row_data ->> 'effectiveFrom')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'effectiveTo', to_char((row_data ->> 'effectiveTo')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'publishedAt', to_char((row_data ->> 'publishedAt')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'retiredAt', to_char((row_data ->> 'retiredAt')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ) END
$function$;

-- Trigger-only read authority sees linked outbox rows even when the application
-- principal deliberately has no SELECT policy for this outbox event type.
CREATE FUNCTION public.app_commercial_version_evidence_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $function$
DECLARE
  aggregate_type text := CASE WHEN TG_TABLE_NAME = 'commercial_rule_sets' THEN 'RULE_SET' ELSE 'RULE_PACK' END;
  expected_action text := CASE WHEN TG_OP = 'INSERT' THEN 'CREATE_VERSION' WHEN NEW."status" = 'PUBLISHED' THEN 'PUBLISH' ELSE 'RETIRE' END;
  before_snapshot jsonb := public.app_commercial_version_snapshot(aggregate_type, CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END);
  after_snapshot jsonb := public.app_commercial_version_snapshot(aggregate_type, to_jsonb(NEW));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."commercial_rule_events" event
     JOIN public."audit_events" audit ON audit."id" = event."auditEventId"
     JOIN public."outbox_entries" outbox ON outbox."id" = event."outboxEntryId"
    WHERE event."tenantId" = NEW."tenantId" AND event."organizationId" = NEW."organizationId"
      AND event."aggregateType" = aggregate_type AND event."aggregateId" = NEW."id"
      AND event."aggregateVersion" = NEW."stateVersion" AND event."resultStatus" = NEW."status" AND event."action" = expected_action
      AND event."actorMembershipId" = NEW."updatedByMembershipId"
      AND event."beforeState" IS NOT DISTINCT FROM before_snapshot AND event."afterState" = after_snapshot
      AND coalesce(audit."beforeState", 'null'::jsonb) = before_snapshot AND audit."afterState" = after_snapshot
      AND outbox."type" = 'commercial.rule.changed.v1' AND outbox."auditId" = event."auditEventId"
      AND outbox."correlationId" = event."correlationId" AND outbox."triggeredByUserId" = event."actorUserId"
      AND outbox."payload" ->> 'schema' = 'commercial-rule.command.v1'
      AND outbox."payload" ->> 'requestFingerprint' = event."requestFingerprint"
      AND outbox."payload" #>> '{event,commandId}' = event."commandId"
      AND outbox."payload" #>> '{event,aggregateId}' = NEW."id"
      AND outbox."payload" #>> '{event,aggregateVersion}' = NEW."stateVersion"::text
      AND outbox."payload" #>> '{event,status}' = NEW."status"
      AND outbox."payload" #>> '{receipt,idempotencyKey}' = event."idempotencyKey"
  ) THEN
    RAISE EXCEPTION 'PC_COMMERCIAL_VERSION_EVIDENCE_REQUIRED' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END
$function$;

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
  selected_rule jsonb;
  computed_output jsonb;
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
  IF NEW."input" ->> 'decisionKey' IS DISTINCT FROM NEW."decisionKey"
     OR NEW."input" ->> 'correlationId' IS DISTINCT FROM NEW."correlationId"
     OR NEW."input" ->> 'ruleSetId' IS DISTINCT FROM NEW."ruleSetId"
     OR NEW."input" ->> 'rulePackId' IS DISTINCT FROM NEW."rulePackId"
     OR jsonb_typeof(NEW."input" -> 'context') IS DISTINCT FROM 'object'
     OR NEW."inputHash" <> encode(sha256(convert_to(NEW."input"::text, 'UTF8')), 'hex')
     OR NEW."outputHash" <> encode(sha256(convert_to(NEW."output"::text, 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'PC_COMMERCIAL_DECISION_MATERIAL_MISMATCH' USING ERRCODE = '23000';
  END IF;
  IF (authority."effectiveFrom" IS NOT NULL AND authority."effectiveFrom" > clock_timestamp())
     OR (authority."effectiveTo" IS NOT NULL AND authority."effectiveTo" <= clock_timestamp())
     OR (pack."effectiveFrom" IS NOT NULL AND pack."effectiveFrom" > clock_timestamp())
     OR (pack."effectiveTo" IS NOT NULL AND pack."effectiveTo" <= clock_timestamp()) THEN
    RAISE EXCEPTION 'PC_COMMERCIAL_DECISION_RULE_NOT_EFFECTIVE' USING ERRCODE = '23000';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(authority."rules") rule WHERE rule ->> 'ruleKey' = NEW."input" ->> 'ruleKey') <> 1 THEN
    RAISE EXCEPTION 'PC_COMMERCIAL_DECISION_RULE_MISSING' USING ERRCODE = '23000';
  END IF;
  SELECT rule INTO selected_rule FROM jsonb_array_elements(authority."rules") rule WHERE rule ->> 'ruleKey' = NEW."input" ->> 'ruleKey';
  IF NOT coalesce((NEW."input" -> 'context') @> (selected_rule -> 'when'), false) THEN
    RAISE EXCEPTION 'PC_COMMERCIAL_DECISION_CONDITION_MISMATCH' USING ERRCODE = '23000';
  END IF;
  computed_output := public.app_commercial_evaluate(selected_rule -> 'commercial', NEW."input" -> 'facts');
  IF NEW."output" IS DISTINCT FROM computed_output OR NEW."decisionStatus" IS DISTINCT FROM computed_output ->> 'status'
     OR NEW."amountKopecks"::text IS DISTINCT FROM computed_output ->> 'amountKopecks' THEN
    RAISE EXCEPTION 'PC_COMMERCIAL_DECISION_OUTPUT_MISMATCH' USING ERRCODE = '23000';
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

CREATE CONSTRAINT TRIGGER commercial_rule_set_evidence_guard
AFTER INSERT OR UPDATE ON public."commercial_rule_sets"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.app_commercial_version_evidence_guard();
CREATE CONSTRAINT TRIGGER commercial_rule_pack_evidence_guard
AFTER INSERT OR UPDATE ON public."commercial_rule_packs"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.app_commercial_version_evidence_guard();

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
REVOKE ALL ON FUNCTION public.app_commercial_version_evidence_guard() FROM PUBLIC;

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
