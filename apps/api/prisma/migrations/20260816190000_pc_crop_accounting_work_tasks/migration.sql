-- CreateTable
CREATE TABLE "accounting_work_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "resolutionMode" TEXT NOT NULL,
    "derivationKey" TEXT,
    "openDerivationKey" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "title" TEXT NOT NULL,
    "humanDescription" TEXT NOT NULL,
    "responsibleCapability" TEXT NOT NULL,
    "assignedMembershipId" TEXT,
    "dealId" TEXT,
    "shipmentId" TEXT,
    "documentId" TEXT,
    "integrationJobId" TEXT,
    "sourceEventId" TEXT,
    "blockingRuleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "deadlineAt" TIMESTAMPTZ(6),
    "resolvedAt" TIMESTAMPTZ(6),
    "resolvedByMembershipId" TEXT,
    "resolutionEventId" TEXT,
    "createdByMembershipId" TEXT,
    "version" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_work_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_work_tasks_organizationId_status_priority_idx" ON "accounting_work_tasks"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "accounting_work_tasks_organizationId_assignedMembershipId_s_idx" ON "accounting_work_tasks"("organizationId", "assignedMembershipId", "status");

-- CreateIndex
CREATE INDEX "accounting_work_tasks_organizationId_responsibleCapability__idx" ON "accounting_work_tasks"("organizationId", "responsibleCapability", "status");

-- CreateIndex
CREATE INDEX "accounting_work_tasks_tenantId_idx" ON "accounting_work_tasks"("tenantId");

-- CreateIndex
CREATE INDEX "accounting_work_tasks_dealId_idx" ON "accounting_work_tasks"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_work_tasks_open_condition_idx" ON "accounting_work_tasks"("organizationId", "openDerivationKey");

-- AddForeignKey
ALTER TABLE "accounting_work_tasks" ADD CONSTRAINT "accounting_work_tasks_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organizations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_work_tasks" ADD CONSTRAINT "accounting_work_tasks_assignedMembershipId_organizationId_fkey" FOREIGN KEY ("assignedMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_work_tasks" ADD CONSTRAINT "accounting_work_tasks_createdByMembershipId_organizationId_fkey" FOREIGN KEY ("createdByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_work_tasks" ADD CONSTRAINT "accounting_work_tasks_resolvedByMembershipId_organizationI_fkey" FOREIGN KEY ("resolvedByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_work_tasks" ADD CONSTRAINT "accounting_work_tasks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "accounting_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Shape ---------------------------------------------------------------------

ALTER TABLE public."accounting_work_tasks"
  ADD CONSTRAINT accounting_work_tasks_origin_known
  CHECK ("origin" IN ('DERIVED', 'MANUAL'));

ALTER TABLE public."accounting_work_tasks"
  ADD CONSTRAINT accounting_work_tasks_resolution_mode_known
  CHECK ("resolutionMode" IN ('SYSTEM_VERIFIED', 'SYSTEM_REPORTED', 'HUMAN_JUDGEMENT'));

ALTER TABLE public."accounting_work_tasks"
  ADD CONSTRAINT accounting_work_tasks_status_known
  CHECK ("status" IN (
    'OPEN', 'ASSIGNED', 'IN_PROGRESS',
    'WAITING_INTERNAL', 'WAITING_COUNTERPARTY', 'WAITING_PROVIDER',
    'RESOLVED', 'CANCELLED'
  ));

-- The rule the whole table exists for, stated where it cannot be forgotten: a
-- task the platform derived is never closed on somebody's say-so.
ALTER TABLE public."accounting_work_tasks"
  ADD CONSTRAINT accounting_work_tasks_derived_is_never_human_judgement
  CHECK ("origin" = 'MANUAL' OR "resolutionMode" <> 'HUMAN_JUDGEMENT');

-- A derived task is the identity of a condition and must carry one; a manual
-- task is a person's own note and must not pretend to be a condition.
ALTER TABLE public."accounting_work_tasks"
  ADD CONSTRAINT accounting_work_tasks_derivation_key_matches_origin
  CHECK (
    ("origin" = 'DERIVED' AND "derivationKey" IS NOT NULL)
    OR ("origin" = 'MANUAL' AND "derivationKey" IS NULL)
  );

-- Nobody wrote a derived task, so nobody may be recorded as having written one.
ALTER TABLE public."accounting_work_tasks"
  ADD CONSTRAINT accounting_work_tasks_author_matches_origin
  CHECK (
    ("origin" = 'MANUAL' AND "createdByMembershipId" IS NOT NULL)
    OR ("origin" = 'DERIVED' AND "createdByMembershipId" IS NULL)
  );

-- A task nobody can read is not a task. Blank is not a description.
ALTER TABLE public."accounting_work_tasks"
  ADD CONSTRAINT accounting_work_tasks_speaks_to_a_human
  CHECK (btrim("title") <> '' AND btrim("humanDescription") <> '');

-- The open key mirrors the derivation key while the task is open and is null
-- once it closes; it is never some third value.
ALTER TABLE public."accounting_work_tasks"
  ADD CONSTRAINT accounting_work_tasks_open_key_mirrors_derivation
  CHECK ("openDerivationKey" IS NULL OR "openDerivationKey" = "derivationKey");

-- Resolution ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pc_crop_work_task_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  terminal constant text[] := ARRAY['RESOLVED', 'CANCELLED'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- A task is raised open. Inserting one already resolved would record work
    -- that was never seen, and would walk around every check below.
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

  -- What a task is about never changes. A different condition is a different
  -- task; editing this one in place would silently redirect whatever work has
  -- already been done against it.
  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'a work task never moves to another organization';
  END IF;
  IF NEW."taskType" IS DISTINCT FROM OLD."taskType"
     OR NEW."origin" IS DISTINCT FROM OLD."origin"
     OR NEW."resolutionMode" IS DISTINCT FROM OLD."resolutionMode"
     OR NEW."derivationKey" IS DISTINCT FROM OLD."derivationKey"
     OR NEW."documentId" IS DISTINCT FROM OLD."documentId"
     OR NEW."dealId" IS DISTINCT FROM OLD."dealId"
     OR NEW."shipmentId" IS DISTINCT FROM OLD."shipmentId"
     OR NEW."sourceEventId" IS DISTINCT FROM OLD."sourceEventId"
     OR NEW."createdByMembershipId" IS DISTINCT FROM OLD."createdByMembershipId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'what a work task is about never changes';
  END IF;

  -- Optimistic concurrency belongs in the database too. Two people acting on
  -- the same task from two screens must not silently overwrite each other.
  IF NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION 'a work task update must advance its version';
  END IF;

  IF OLD."status" = ANY (terminal) THEN
    RAISE EXCEPTION 'a closed work task does not reopen';
  END IF;

  IF NEW."status" = 'CANCELLED' THEN
    -- Cancelling is closing. Allowing it on a derived task would be the
    -- checkbox this table refuses, wearing a different word.
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
      -- The platform cannot see inside the provider, so it demands the next
      -- best thing: news that arrived after the news that raised the task. The
      -- same event cannot be both.
      IF NEW."resolutionEventId" IS NULL THEN
        RAISE EXCEPTION
          'a system-reported work task closes on a resolution event, not on assent';
      END IF;
      IF NEW."resolutionEventId" = OLD."sourceEventId" THEN
        RAISE EXCEPTION
          'the event that raised a work task cannot be the news that it cleared';
      END IF;

    ELSIF OLD."resolutionMode" = 'SYSTEM_VERIFIED' THEN
      -- Verified means the database goes and looks. A task type with no
      -- verifier here is refused rather than waved through: an unimplemented
      -- check that closes tasks is worse than no check, because it looks like
      -- one.
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

  -- Still open: the condition is still open with it.
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

DROP TRIGGER IF EXISTS accounting_work_tasks_guard ON public."accounting_work_tasks";
CREATE TRIGGER accounting_work_tasks_guard
  BEFORE INSERT OR UPDATE ON public."accounting_work_tasks"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_work_task_guard();

-- Row level security --------------------------------------------------------

ALTER TABLE public."accounting_work_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."accounting_work_tasks" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_work_tasks_member_select ON public."accounting_work_tasks";
CREATE POLICY accounting_work_tasks_member_select ON public."accounting_work_tasks"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

-- A person may raise their own note. They may not raise a derived task: the
-- platform derives those from conditions it can see, and a hand-written one
-- would be a claim about the world with nothing behind it.
DROP POLICY IF EXISTS accounting_work_tasks_command_insert ON public."accounting_work_tasks";
CREATE POLICY accounting_work_tasks_command_insert ON public."accounting_work_tasks"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND "origin" = 'MANUAL'
    AND "createdByMembershipId" = public.app_pc_crop_membership_id()
  );

DROP POLICY IF EXISTS accounting_work_tasks_command_update ON public."accounting_work_tasks";
CREATE POLICY accounting_work_tasks_command_update ON public."accounting_work_tasks"
  FOR UPDATE
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  )
  WITH CHECK (
    "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    -- Whoever is recorded as having closed it is the caller. A principal that
    -- can name somebody else can also blame somebody else.
    AND (
      "resolvedByMembershipId" IS NULL
      OR "resolvedByMembershipId" = public.app_pc_crop_membership_id()
    )
  );

DO $accounting_work_task_grants$
DECLARE
  read_role text := 'pc_accounting_authority';
  write_role text := 'pc_accounting_command_authority';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = read_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', read_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_work_tasks" FROM %I', read_role);
    EXECUTE format(
      'GRANT SELECT ON public."accounting_work_tasks" TO %I', read_role);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = write_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', write_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_work_tasks" FROM %I', write_role);
    EXECUTE format(
      'GRANT INSERT, SELECT ON public."accounting_work_tasks" TO %I', write_role);
    -- Working a task moves its status, its owner, its deadline and its
    -- resolution. What the task is about is not in this list, which is how the
    -- column grant says the same thing the guard says.
    EXECUTE format(
      'GRANT UPDATE ("status", "assignedMembershipId", "deadlineAt", "priority", '
      || '"resolvedAt", "resolvedByMembershipId", "resolutionEventId", '
      || '"openDerivationKey", "updatedAt", "version") '
      || 'ON public."accounting_work_tasks" TO %I',
      write_role);
    -- A task that was raised and then deleted is indistinguishable from one
    -- that was never raised, which is precisely what a record of outstanding
    -- work must not be.
    EXECUTE format(
      'REVOKE DELETE ON public."accounting_work_tasks" FROM %I', write_role);
  END IF;
END
$accounting_work_task_grants$;
