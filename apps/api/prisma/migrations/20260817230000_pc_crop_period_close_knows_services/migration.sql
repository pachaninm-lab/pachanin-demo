-- The close learns about service lines.
--
-- When the periods contour was written there were no service lines to count.
-- There are now, and they carry a rule that makes an undecided one a hazard
-- rather than an untidiness: the services guard refuses an approval whose line
-- falls in a closed month. A month closed over a RENDERED line therefore does
-- not defer that charge, it discards it.
--
-- The guard function is replaced whole rather than patched, so the version in
-- the database is always the one this file states.

CREATE OR REPLACE FUNCTION public.pc_crop_accounting_period_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  outstanding integer;
  undecided integer;
BEGIN
  -- Two periods covering one instant makes "which period is this document in"
  -- unanswerable, and every rule below depends on that answer.
  IF EXISTS (
    SELECT 1
      FROM public."accounting_periods" other
     WHERE other."organizationId" = NEW."organizationId"
       AND other."id" <> NEW."id"
       AND other."periodStart" < NEW."periodEnd"
       AND other."periodEnd" > NEW."periodStart"
  ) THEN
    RAISE EXCEPTION 'accounting periods do not overlap';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'OPEN' THEN
      RAISE EXCEPTION 'an accounting period is opened open';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'an accounting period never moves to another organization';
  END IF;

  -- The window is what everything else was judged against. Moving it after the
  -- fact would silently change which documents a past close covered.
  IF OLD."status" <> 'OPEN'
     AND (NEW."periodStart" IS DISTINCT FROM OLD."periodStart"
          OR NEW."periodEnd" IS DISTINCT FROM OLD."periodEnd") THEN
    RAISE EXCEPTION 'the window of a period being closed no longer moves';
  END IF;

  IF NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION 'an accounting period update must advance its version';
  END IF;

  IF OLD."status" = 'CLOSED' THEN
    -- A close that can be undone quietly is not a close. Reopening is a
    -- deliberate act with its own authority, and this slice does not grant it
    -- to anybody: there is no path here that moves a period back.
    RAISE EXCEPTION 'a closed accounting period does not reopen';
  END IF;

  IF NEW."status" = 'CLOSING' AND OLD."status" = 'OPEN' THEN
    NEW."closingStartedAt" := CURRENT_TIMESTAMP;
    RETURN NEW;
  END IF;

  IF NEW."status" = 'CLOSED' THEN
    IF OLD."status" <> 'CLOSING' THEN
      -- Straight from open to closed skips the moment where outstanding work is
      -- counted against a period nobody is still adding to.
      RAISE EXCEPTION 'an accounting period is closed from CLOSING, not from %',
        OLD."status";
    END IF;

    SELECT count(*) INTO outstanding
      FROM public."accounting_work_tasks" t
      JOIN public."accounting_documents" d ON d."id" = t."documentId"
     WHERE t."organizationId" = NEW."organizationId"
       AND t."origin" = 'DERIVED'
       AND t."status" NOT IN ('RESOLVED', 'CANCELLED')
       AND d."createdAt" >= NEW."periodStart"
       AND d."createdAt" < NEW."periodEnd";

    -- Service lines nobody decided. This is not tidiness: the services guard
    -- refuses an approval whose line falls in a closed month, so a line left
    -- RENDERED when the month closes can never become a charge. Closing over
    -- one does not defer it — it loses it, quietly, and the counterparty finds
    -- out when the act does not match their delivery notes.
    SELECT count(*) INTO undecided
      FROM public."accounting_deal_services" s
     WHERE s."organizationId" = NEW."organizationId"
       AND s."status" = 'RENDERED'
       AND s."renderedAt" >= NEW."periodStart"
       AND s."renderedAt" < NEW."periodEnd";

    IF undecided > 0 THEN
      RAISE EXCEPTION
        'the period still has % undecided service line(s); approving one after the close is refused, so closing over it discards the charge',
        undecided;
    END IF;

    IF outstanding > 0 THEN
      RAISE EXCEPTION
        'the period still has % outstanding derived task(s); a close declared over unfinished work is the report that gets believed and then contradicted',
        outstanding;
    END IF;

    NEW."closedAt" := CURRENT_TIMESTAMP;
    RETURN NEW;
  END IF;

  RETURN NEW;
END
$function$;
