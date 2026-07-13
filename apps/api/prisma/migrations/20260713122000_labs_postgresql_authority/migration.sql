-- IR-10.3 Prisma/public-schema reconciliation.
-- Cross-schema laboratory authority remains trigger-validated; public Prisma
-- models do not own the normalized labs schema.

ALTER TABLE public."lab_tests"
  DROP CONSTRAINT IF EXISTS "lab_tests_methodId_fkey",
  DROP CONSTRAINT IF EXISTS "lab_tests_equipmentId_fkey",
  DROP CONSTRAINT IF EXISTS "lab_tests_evidenceFileId_fkey",
  DROP CONSTRAINT IF EXISTS "lab_tests_actorUserId_fkey",
  DROP CONSTRAINT IF EXISTS "lab_tests_supersedesId_fkey";

DROP INDEX IF EXISTS public."lab_samples_tenant_sampleCode_key";
CREATE UNIQUE INDEX "lab_samples_tenant_sampleCode_key"
  ON public."lab_samples" ("tenantId", "sampleCode");

DROP INDEX IF EXISTS public."lab_tests_idempotencyKey_key";
CREATE UNIQUE INDEX "lab_tests_idempotencyKey_key"
  ON public."lab_tests" ("idempotencyKey");
