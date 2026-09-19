-- IR-10.3 preflight for forward-only public-schema alignment.
-- Create the new laboratory timestamp with the canonical Prisma type before
-- the main authority migration reaches its ADD COLUMN IF NOT EXISTS clause.
-- This avoids a destructive/rewriting ALTER COLUMN TYPE on baseline databases.

ALTER TABLE public."lab_samples"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
