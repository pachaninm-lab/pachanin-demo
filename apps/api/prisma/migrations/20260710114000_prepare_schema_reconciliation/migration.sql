-- Prepare historical PostgreSQL indexes for canonical Prisma reconciliation.
--
-- The PostgreSQL baseline contains several partial or historically named indexes.
-- Prisma's canonical schema requires unconditional unique indexes with the same
-- names. PostgreSQL cannot replace them implicitly, so they are removed explicitly
-- immediately before the forward-only reconciliation migration recreates them.
--
-- This migration is verified only against an isolated PostgreSQL 16 database.
-- Production execution remains locked behind snapshot, backup and restore rehearsal.

DROP INDEX IF EXISTS "deals_dealNumber_key";
DROP INDEX IF EXISTS "outbox_entries_idempotencyKey_key";
DROP INDEX IF EXISTS "payments_idempotencyKey_key";
DROP INDEX IF EXISTS "accounts_orgId_idx";
