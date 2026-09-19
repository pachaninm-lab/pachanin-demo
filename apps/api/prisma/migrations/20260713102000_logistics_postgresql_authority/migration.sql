-- IR-10.2 drift correction.
-- Prisma DateTime maps to timestamp(3) without time zone. Existing operational
-- instants are normalized to UTC during the forward-only type conversion.

ALTER TABLE public."checkpoints"
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3)
  USING ("createdAt" AT TIME ZONE 'UTC');

ALTER TABLE public."shipment_gps_points"
  ALTER COLUMN "recordedAt" TYPE TIMESTAMP(3)
  USING ("recordedAt" AT TIME ZONE 'UTC'),
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3)
  USING ("createdAt" AT TIME ZONE 'UTC');

ALTER TABLE public."shipments"
  ALTER COLUMN "pinVerifiedAt" TYPE TIMESTAMP(3)
  USING ("pinVerifiedAt" AT TIME ZONE 'UTC'),
  ALTER COLUMN "pinLockedUntil" TYPE TIMESTAMP(3)
  USING ("pinLockedUntil" AT TIME ZONE 'UTC');

DROP INDEX IF EXISTS public."checkpoints_idempotencyKey_key";
CREATE UNIQUE INDEX "checkpoints_idempotencyKey_key"
  ON public."checkpoints" ("idempotencyKey");
