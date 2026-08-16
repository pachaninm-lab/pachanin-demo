-- AlterTable
ALTER TABLE "accounting_work_tasks" ADD COLUMN     "periodId" TEXT;

-- AddForeignKey
ALTER TABLE "accounting_work_tasks" ADD CONSTRAINT "accounting_work_tasks_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A second verified condition ------------------------------------------------
--
-- Until now the guard could check exactly one thing for itself: whether a
-- document had been signed. "The month is ready to close" is the second, and it
-- is worth having precisely because it is the task somebody most wants to tick
-- off: the work is done, the close is the last step, and a checkbox there would
-- record a month as finished that nobody finished.
--
-- The condition clears when the period is actually CLOSED, which the period's
-- own guard already refuses to do while work is outstanding. So the two rules
-- compose rather than repeat: this one cannot be satisfied without satisfying
-- that one.

CREATE OR REPLACE FUNCTION public.pc_crop_work_task_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  terminal constant text[] := ARRAY['RESOLVED', 'CANCELLED'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" = ANY (terminal) THEN
      RAISE EXCEPTION 'a work task is raised open, never already closed';
    END IF;
    IF NEW."resolvedAt" IS NOT NULL
       OR NEW."resolvedByMembershipId" IS NOT NULL
       OR NEW."resolutionEventId" IS NOT NULL THEN
      RAISE EXCEPTION 'a new work task carries no resolution';
    END IF;
    IF NEW."origin" = 'DERIVED' AND NEW."openDerivationKey" IS DISTINCT FROM NEW."derivationKey" THEN
      RAISE EXCEPTION 'a derived work task is raised with its condition open';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'a work task never moves to another organization';
  END IF;
  IF NEW."taskType" IS DISTINCT FROM OLD."taskType"
     OR NEW."origin" IS DISTINCT FROM OLD."origin"
     OR NEW."resolutionMode" IS DISTINCT FROM OLD."resolutionMode"
     OR NEW."derivationKey" IS DISTINCT FROM OLD."derivationKey"
     OR NEW."documentId" IS DISTINCT FROM OLD."documentId"
     OR NEW."periodId" IS DISTINCT FROM OLD."periodId"
     OR NEW."dealId" IS DISTINCT FROM OLD."dealId"
     OR NEW."shipmentId" IS DISTINCT FROM OLD."shipmentId"
     OR NEW."sourceEventId" IS DISTINCT FROM OLD."sourceEventId"
     OR NEW."createdByMembershipId" IS DISTINCT FROM OLD."createdByMembershipId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'what a work task is about never changes';
  END IF;

  IF NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION 'a work task update must advance its version';
  END IF;

  IF OLD."status" = ANY (terminal) THEN
    RAISE EXCEPTION 'a closed work task does not reopen';
  END IF;

  IF NEW."status" = 'CANCELLED' THEN
    IF OLD."origin" = 'DERIVED' THEN
      RAISE EXCEPTION
        'a derived work task is not cancelled; it closes when its condition clears';
    END IF;
    IF NEW."resolvedByMembershipId" IS NULL THEN
      RAISE EXCEPTION 'a cancelled work task names who cancelled it';
    END IF;
    NEW."resolvedAt" := CURRENT_TIMESTAMP;
    NEW."openDerivationKey" := NULL;
    RETURN NEW;
  END IF;

  IF NEW."status" = 'RESOLVED' THEN
    IF OLD."resolutionMode" = 'HUMAN_JUDGEMENT' THEN
      IF NEW."resolvedByMembershipId" IS NULL THEN
        RAISE EXCEPTION 'a resolved work task names who resolved it';
      END IF;

    ELSIF OLD."resolutionMode" = 'SYSTEM_REPORTED' THEN
      IF NEW."resolutionEventId" IS NULL THEN
        RAISE EXCEPTION
          'a system-reported work task closes on a resolution event, not on assent';
      END IF;
      IF NEW."resolutionEventId" = OLD."sourceEventId" THEN
        RAISE EXCEPTION
          'the event that raised a work task cannot be the news that it cleared';
      END IF;

    ELSIF OLD."resolutionMode" = 'SYSTEM_VERIFIED' THEN
      IF OLD."taskType" = 'DOCUMENT_NOT_SIGNED' THEN
        IF OLD."documentId" IS NULL THEN
          RAISE EXCEPTION 'a document task without a document cannot be verified';
        END IF;
        IF NOT EXISTS (
          SELECT 1
          FROM public."accounting_document_versions" v
          WHERE v."documentId" = OLD."documentId"
            AND v."signedAt" IS NOT NULL
        ) THEN
          RAISE EXCEPTION
            'the document this task is about is still unsigned';
        END IF;

      ELSIF OLD."taskType" = 'PERIOD_READY_TO_CLOSE' THEN
        IF OLD."periodId" IS NULL THEN
          RAISE EXCEPTION 'a period task without a period cannot be verified';
        END IF;
        IF NOT EXISTS (
          SELECT 1
          FROM public."accounting_periods" p
          WHERE p."id" = OLD."periodId"
            AND p."status" = 'CLOSED'
        ) THEN
          RAISE EXCEPTION
            'the period this task is about is not closed yet';
        END IF;

      ELSE
        RAISE EXCEPTION
          'no verifier is registered for work task type %, so it cannot be resolved',
          OLD."taskType";
      END IF;
    END IF;

    NEW."resolvedAt" := CURRENT_TIMESTAMP;
    NEW."openDerivationKey" := NULL;
    RETURN NEW;
  END IF;

  IF NEW."openDerivationKey" IS DISTINCT FROM OLD."openDerivationKey" THEN
    RAISE EXCEPTION
      'an open work task keeps its condition open';
  END IF;
  IF NEW."resolvedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'an open work task has no resolution time';
  END IF;

  RETURN NEW;
END
$function$;

-- A task about a period belongs to the same organization as the period. Every
-- foreign key on such a row is satisfied without this, so only the guard
-- catches a task pointing at somebody else's month.
CREATE OR REPLACE FUNCTION public.pc_crop_work_task_period_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW."periodId" IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."accounting_periods" p
     WHERE p."id" = NEW."periodId"
       AND p."organizationId" = NEW."organizationId"
       AND p."tenantId" = NEW."tenantId"
  ) THEN
    RAISE EXCEPTION
      'a work task about a period must belong to that period''s organization';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS accounting_work_tasks_period_scope
  ON public."accounting_work_tasks";
CREATE TRIGGER accounting_work_tasks_period_scope
  BEFORE INSERT OR UPDATE ON public."accounting_work_tasks"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_work_task_period_scope();
