-- Provider-neutral attestation: the same governance artefact, a different subject.
--
-- The platform already has a four-gate attestation with a hash chain, mandatory
-- MFA, a validity window, idempotency and append-only enforcement. It lives in
-- public."fgis_grain_provider_attestations" and, until now, could only ever be
-- about an FGIS provider configuration.
--
-- Every other connection the platform will have to attest — an EDO operator, a
-- 1С connector, a bank — needs exactly that governance and nothing new. So this
-- EXTENDS that table rather than standing a second one beside it. Two
-- attestation stores would be two answers to "who approved this", and the one
-- somebody reads would depend on which screen they opened.
--
-- The table keeps its FGIS name. Renaming it would rewrite a contour this scope
-- does not own, for cosmetic gain; the name is a wart, and a wart is cheaper
-- than a rename that breaks somebody else's migrations, queries and tests.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
-- It does not police existing FGIS rows. `configurationId` loses its blanket
-- NOT NULL, and a CHECK immediately puts it back for every row whose subject is
-- an FGIS configuration — so an FGIS attestation still cannot exist without one.
-- But the chain-integrity and one-actor-per-version rules added below fire only
-- for the new subject kind. The FGIS contour enforces those in TypeScript and
-- seeds fixtures that do not satisfy them (four gates by one actor, prevHash
-- NULL on all four, hashes that are not chain hashes). A trigger that judged
-- those rows would break a workstream this scope does not own. Tightening the
-- FGIS side is the FGIS contour's decision to make, in its own scope.
--
-- The consequence is stated plainly rather than papered over: FGIS rows are as
-- governed as they were yesterday, no more and no less. Rows about a connection
-- subject are governed by the database itself.

-- AlterTable
ALTER TABLE "fgis_grain_provider_attestations" ADD COLUMN     "connectionSubjectId" TEXT,
ADD COLUMN     "subjectKind" TEXT NOT NULL DEFAULT 'FGIS_PROVIDER_CONFIGURATION',
ALTER COLUMN "configurationId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "connection_attestation_subjects" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionKind" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "createdByMembershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_attestation_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connection_attestation_subject_org_kind_idx" ON "connection_attestation_subjects"("organizationId", "connectionKind");

-- CreateIndex
CREATE UNIQUE INDEX "connection_attestation_subject_identity_key" ON "connection_attestation_subjects"("tenantId", "organizationId", "connectionKind", "providerCode", "environment");

-- CreateIndex
CREATE INDEX "fgis_grain_provider_attestation_subject_idx" ON "fgis_grain_provider_attestations"("connectionSubjectId", "configurationVersion", "gate", "createdAt" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "connection_attestation_subjects" ADD CONSTRAINT "connection_attestation_subjects_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organizations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_attestation_subjects" ADD CONSTRAINT "connection_attestation_subjects_createdByMembershipId_orga_fkey" FOREIGN KEY ("createdByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fgis_grain_provider_attestations" ADD CONSTRAINT "fgis_grain_provider_attestation_subject_fk" FOREIGN KEY ("connectionSubjectId") REFERENCES "connection_attestation_subjects"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- ---------------------------------------------------------------------------
-- What a neutral attestation is about
-- ---------------------------------------------------------------------------

-- The kinds are the connection contour's own vocabulary, verbatim. A governance
-- record that named connections differently from the screen that shows them
-- would let a connection be attested under one name and reported under another.
ALTER TABLE public."connection_attestation_subjects"
  ADD CONSTRAINT connection_attestation_subject_kind_check
  CHECK ("connectionKind" IN ('EDO', 'ONE_C', 'BANK_STATEMENT'));

-- Provider-neutral means exactly this: no vendor is named in the schema. The
-- code identifies whoever it is, normalized so that 'diadoc' and 'Diadoc'
-- cannot become two subjects with two separate approval histories.
ALTER TABLE public."connection_attestation_subjects"
  ADD CONSTRAINT connection_attestation_subject_provider_check
  CHECK ("providerCode" = upper(btrim("providerCode")) AND length("providerCode") BETWEEN 2 AND 64);

-- The same two environments the FGIS configuration uses. An attestation of a
-- test environment is not an attestation of production, and the difference has
-- to be in the row rather than in whoever remembers it.
ALTER TABLE public."connection_attestation_subjects"
  ADD CONSTRAINT connection_attestation_subject_environment_check
  CHECK ("environment" IN ('PRE_PRODUCTION', 'PRODUCTION'));

ALTER TABLE public."connection_attestation_subjects"
  ADD CONSTRAINT connection_attestation_subject_version_check
  CHECK ("version" >= 0);

ALTER TABLE public."connection_attestation_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."connection_attestation_subjects" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connection_attestation_subject_tenant_org_policy
  ON public."connection_attestation_subjects";
CREATE POLICY connection_attestation_subject_tenant_org_policy
  ON public."connection_attestation_subjects"
  USING (
    "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  )
  WITH CHECK (
    "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE OR REPLACE FUNCTION public.pc_crop_connection_subject_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $connection_subject_guard$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- A subject with attestations against it is the thing those attestations
    -- are about. Deleting it would leave approvals hanging over nothing.
    RAISE EXCEPTION 'a connection attestation subject is not deleted';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."version" <> 0 THEN
      RAISE EXCEPTION 'a connection attestation subject starts at version 0';
    END IF;
    RETURN NEW;
  END IF;

  -- Identity is what the attestations were about. Letting it move would carry
  -- four approvals of one operator's pre-production endpoint over to another
  -- operator, or to production.
  IF NEW."connectionKind" IS DISTINCT FROM OLD."connectionKind"
     OR NEW."providerCode" IS DISTINCT FROM OLD."providerCode"
     OR NEW."environment" IS DISTINCT FROM OLD."environment"
     OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'a connection attestation subject never changes what it is about';
  END IF;

  -- A version only moves forward, and only by one. Attestations pin a version;
  -- a jump would let a version exist that nothing was ever asked about, and
  -- going backwards would re-expose approvals that a change had retired.
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION
      'a connection attestation subject moves from version % to %, not to %',
      OLD."version", OLD."version" + 1, NEW."version";
  END IF;

  NEW."updatedAt" := clock_timestamp();
  RETURN NEW;
END
$connection_subject_guard$;

DROP TRIGGER IF EXISTS connection_attestation_subjects_guard
  ON public."connection_attestation_subjects";
CREATE TRIGGER connection_attestation_subjects_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public."connection_attestation_subjects"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_connection_subject_guard();

-- ---------------------------------------------------------------------------
-- The attestation table, extended
-- ---------------------------------------------------------------------------

ALTER TABLE public."fgis_grain_provider_attestations"
  ADD CONSTRAINT fgis_grain_provider_attestation_subject_kind_ck
  CHECK ("subjectKind" IN ('FGIS_PROVIDER_CONFIGURATION', 'CONNECTION_SUBJECT'));

-- Exactly one subject. Both would make the row ambiguous about what was
-- approved; neither would make it an approval of nothing.
ALTER TABLE public."fgis_grain_provider_attestations"
  ADD CONSTRAINT fgis_grain_provider_attestation_one_subject_ck
  CHECK (num_nonnulls("configurationId", "connectionSubjectId") = 1);

-- The FGIS guarantee, restored exactly. `configurationId` lost its blanket NOT
-- NULL so a neutral row can exist at all; this says that a row claiming to be
-- about an FGIS configuration must still carry one, and that a row carrying one
-- cannot claim to be about anything else. No FGIS row can exist today that
-- could not exist yesterday.
ALTER TABLE public."fgis_grain_provider_attestations"
  ADD CONSTRAINT fgis_grain_provider_attestation_subject_binding_ck
  CHECK (("subjectKind" = 'FGIS_PROVIDER_CONFIGURATION') = ("configurationId" IS NOT NULL));

CREATE OR REPLACE FUNCTION public.pc_crop_connection_attestation_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $connection_attestation_guard$
DECLARE
  subject_version bigint;
  subject_org text;
  subject_tenant text;
  previous_hash text;
  conflicting_gate text;
BEGIN
  -- Rows about an FGIS configuration leave here untouched. See the header: the
  -- FGIS contour's rules are its own, and its fixtures do not satisfy the ones
  -- below.
  IF NEW."subjectKind" <> 'CONNECTION_SUBJECT' THEN
    RETURN NEW;
  END IF;

  SELECT s."version", s."organizationId", s."tenantId"
    INTO subject_version, subject_org, subject_tenant
    FROM public."connection_attestation_subjects" s
   WHERE s."id" = NEW."connectionSubjectId"
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'the attested connection subject does not exist';
  END IF;

  IF subject_org <> NEW."organizationId" OR subject_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION
      'an attestation belongs to the organization of the subject it is about';
  END IF;

  -- The version is pinned so that approving a connection and then changing it
  -- does not carry the approval across. The subject's guard only moves the
  -- version forward, so an attestation of version N stays an attestation of
  -- version N for ever.
  IF NEW."configurationVersion" <> subject_version THEN
    RAISE EXCEPTION
      'this attestation is bound to version %, and the subject is at version %',
      NEW."configurationVersion", subject_version;
  END IF;

  -- One actor, one gate. Four gates exist so that four people look; letting one
  -- person answer two of them turns four-eyes into two.
  SELECT a."gate" INTO conflicting_gate
    FROM public."fgis_grain_provider_attestations" a
   WHERE a."connectionSubjectId" = NEW."connectionSubjectId"
     AND a."configurationVersion" = NEW."configurationVersion"
     AND a."actorUserId" = NEW."actorUserId"
     AND a."gate" <> NEW."gate"
     AND a."validUntil" > clock_timestamp()
   LIMIT 1;

  IF conflicting_gate IS NOT NULL THEN
    RAISE EXCEPTION
      'this actor already answered the % gate for this version',
      conflicting_gate;
  END IF;

  -- The chain. The FOR UPDATE above serialises two attestations racing for the
  -- same subject: without it both would read the same tail and both would link
  -- to it, and a chain that forks is a chain that proves nothing.
  SELECT a."hash" INTO previous_hash
    FROM public."fgis_grain_provider_attestations" a
   WHERE a."connectionSubjectId" = NEW."connectionSubjectId"
   ORDER BY a."createdAt" DESC, a."id" DESC
   LIMIT 1;

  IF previous_hash IS NULL THEN
    IF NEW."prevHash" IS NOT NULL THEN
      RAISE EXCEPTION 'the first attestation of a subject links to nothing';
    END IF;
  ELSIF NEW."prevHash" IS DISTINCT FROM previous_hash THEN
    RAISE EXCEPTION
      'this attestation does not continue the subject''s chain';
  END IF;

  RETURN NEW;
END
$connection_attestation_guard$;

DROP TRIGGER IF EXISTS connection_attestation_guard
  ON public."fgis_grain_provider_attestations";
CREATE TRIGGER connection_attestation_guard
  BEFORE INSERT ON public."fgis_grain_provider_attestations"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_connection_attestation_guard();

-- ---------------------------------------------------------------------------
-- Reading it from the accounting contour, without reaching into FGIS
-- ---------------------------------------------------------------------------

-- The connection centre needs to know whether a connection's contract has been
-- attested. Granting it SELECT on the attestation table would hand it the FGIS
-- governance history as well, which is a different contour's business. So it
-- gets a function that can only ever answer about connection subjects, and the
-- narrow read principal gets EXECUTE on that and nothing else.
CREATE OR REPLACE FUNCTION public.app_pc_crop_connection_attestation_state(
  subject_id text
)
RETURNS TABLE (
  "gate" text,
  "decision" text,
  "attestedVersion" bigint,
  "validUntil" timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $connection_attestation_state$
  SELECT a."gate", a."decision", a."configurationVersion", a."validUntil"
    FROM public."fgis_grain_provider_attestations" a
    JOIN public."connection_attestation_subjects" s
      ON s."id" = a."connectionSubjectId"
   WHERE a."subjectKind" = 'CONNECTION_SUBJECT'
     AND a."connectionSubjectId" = subject_id
     -- The definer owns both tables, so row level security does not confine it.
     -- The caller's organization is therefore demanded here explicitly, and the
     -- function answers about nothing else.
     AND s."organizationId" = current_setting('app.current_org_id', true)
     AND s."tenantId" = current_setting('app.current_tenant_id', true)
     AND a."configurationVersion" = s."version"
     AND a."validUntil" > clock_timestamp();
$connection_attestation_state$;

-- Not PUBLIC. It takes a subject id and answers about somebody's governance
-- record; anybody who could execute it could enumerate approvals.
REVOKE ALL ON FUNCTION public.app_pc_crop_connection_attestation_state(text) FROM PUBLIC;

DO $connection_attestation_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_accounting_authority') THEN
    GRANT SELECT ON public."connection_attestation_subjects" TO pc_accounting_authority;
    GRANT EXECUTE ON FUNCTION public.app_pc_crop_connection_attestation_state(text)
      TO pc_accounting_authority;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_accounting_command_authority') THEN
    GRANT SELECT, INSERT, UPDATE ("version", "updatedAt")
      ON public."connection_attestation_subjects" TO pc_accounting_command_authority;
    GRANT EXECUTE ON FUNCTION public.app_pc_crop_connection_attestation_state(text)
      TO pc_accounting_command_authority;
  END IF;
END
$connection_attestation_grants$;

-- ---------------------------------------------------------------------------
-- Recording one, without handing anybody the FGIS table
-- ---------------------------------------------------------------------------

-- The command principal has no INSERT on the attestation table and does not get
-- one: a grant there would also let it write rows about FGIS configurations,
-- which is a contour it has no business in. It gets this instead, which can
-- only ever write a CONNECTION_SUBJECT row.
--
-- Nothing that identifies the actor comes from the caller. The organization,
-- the tenant and the acting user are read from the session settings the same
-- way every other policy reads them, so a caller cannot record somebody else's
-- approval — and the hash is computed here, over the content, rather than
-- accepted as a parameter. A hash the writer chooses is not evidence of
-- anything; this one cannot disagree with the row it belongs to.
CREATE OR REPLACE FUNCTION public.app_pc_crop_record_connection_attestation(
  subject_id text,
  gate text,
  decision text,
  justification text,
  evidence_reference text,
  valid_until timestamptz,
  idempotency_key text,
  correlation_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $record_connection_attestation$
DECLARE
  actor text := current_setting('app.current_user_id', true);
  org text := current_setting('app.current_org_id', true);
  tenant text := current_setting('app.current_tenant_id', true);
  actor_role text;
  subject_version bigint;
  previous_hash text;
  new_id text;
  new_hash text;
BEGIN
  IF actor IS NULL OR btrim(actor) = '' OR org IS NULL OR btrim(org) = ''
     OR tenant IS NULL OR btrim(tenant) = '' THEN
    RAISE EXCEPTION 'an attestation is recorded inside an established session';
  END IF;

  -- The subject is locked here, before the gate is read, so two people
  -- answering different gates at the same moment cannot both read the same
  -- chain tail. The row guard takes the same lock; taking it here as well keeps
  -- the read of the tail below inside the lock rather than racing it.
  SELECT s."version" INTO subject_version
    FROM public."connection_attestation_subjects" s
   WHERE s."id" = subject_id
     AND s."organizationId" = org
     AND s."tenantId" = tenant
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such connection subject in this organization';
  END IF;

  -- The role is the caller's durable membership role, read from the database
  -- rather than believed. An attestation records who decided and in what
  -- capacity; a capacity the caller supplies is a capacity the caller chose.
  SELECT m."role" INTO actor_role
    FROM public."user_orgs" m
   WHERE m."userId" = actor
     AND m."organizationId" = org
   LIMIT 1;

  IF actor_role IS NULL THEN
    RAISE EXCEPTION 'the acting user holds no membership in this organization';
  END IF;

  SELECT a."hash" INTO previous_hash
    FROM public."fgis_grain_provider_attestations" a
   WHERE a."connectionSubjectId" = subject_id
   ORDER BY a."createdAt" DESC, a."id" DESC
   LIMIT 1;

  new_id := gen_random_uuid()::text;
  new_hash := encode(
    sha256(
      convert_to(
        concat_ws(
          '|', new_id, subject_id, subject_version::text, gate, decision, actor,
          actor_role, justification, evidence_reference,
          to_char(valid_until AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.USOF'),
          coalesce(previous_hash, '')
        ),
        'UTF8'
      )
    ),
    'hex'
  );

  INSERT INTO public."fgis_grain_provider_attestations" (
    "id", "subjectKind", "configurationId", "connectionSubjectId",
    "tenantId", "organizationId", "gate", "decision", "configurationVersion",
    "actorUserId", "actorRole", "mfaVerified", "justification",
    "evidenceReference", "validUntil", "idempotencyKey", "correlationId",
    "hash", "prevHash"
  ) VALUES (
    new_id, 'CONNECTION_SUBJECT', NULL, subject_id,
    tenant, org, gate, decision, subject_version,
    actor, actor_role, true, justification,
    evidence_reference, valid_until, idempotency_key, correlation_id,
    new_hash, previous_hash
  );

  RETURN new_id;
END
$record_connection_attestation$;

REVOKE ALL ON FUNCTION public.app_pc_crop_record_connection_attestation(
  text, text, text, text, text, timestamptz, text, text
) FROM PUBLIC;

DO $record_connection_attestation_grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles
              WHERE rolname = 'pc_accounting_command_authority') THEN
    GRANT EXECUTE ON FUNCTION public.app_pc_crop_record_connection_attestation(
      text, text, text, text, text, timestamptz, text, text
    ) TO pc_accounting_command_authority;
  END IF;
END
$record_connection_attestation_grant$;
