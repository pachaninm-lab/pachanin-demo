import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoFile = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const schema = repoFile('apps/api/prisma/schema.prisma');
const contract = repoFile('apps/api/prisma/contracts/deal_workspace_runtime_snapshots.sql');
const migration = repoFile(
  'apps/api/prisma/migrations/20260710060000_deal_workspace_runtime_persistence/migration.sql',
);
const rollback = repoFile(
  'apps/api/prisma/migrations/20260710060000_deal_workspace_runtime_persistence/rollback.sql',
);

describe('VP-3.33 runtime persistence Prisma schema and migration', () => {
  it('declares canonical runtime snapshot and transaction-attempt models', () => {
    expect(schema).toContain('model DealWorkspaceRuntimeSnapshot');
    expect(schema).toContain('model DealWorkspaceRuntimeTransactionAttempt');
    expect(schema).toContain('@@map("deal_workspace_runtime_snapshots")');
    expect(schema).toContain('@@map("deal_workspace_runtime_transaction_attempts")');

    for (const field of [
      'runtimeSnapshotId',
      'idempotencyKey',
      'contractHash',
      'outboxEntryId',
      'auditEventId',
      'correlationId',
      'auditId',
    ]) {
      expect(schema, `${field} must remain in the runtime snapshot model`).toContain(field);
    }
  });

  it('reuses canonical outbox and audit tables instead of creating substitutes', () => {
    expect(migration).toContain('ALTER TABLE "outbox_entries"');
    expect(migration).toContain('ALTER TABLE "audit_events"');
    expect(migration).not.toContain('CREATE TABLE IF NOT EXISTS "runtime_outbox');
    expect(migration).not.toContain('CREATE TABLE IF NOT EXISTS "runtime_audit');
    expect(schema).not.toContain('model DealWorkspaceRuntimeOutbox');
    expect(schema).not.toContain('model DealWorkspaceRuntimeAudit');
  });

  it('enforces linkage consistency, evidence preservation and idempotency in SQL', () => {
    for (const requiredTerm of [
      'dw_runtime_snapshots_linkage_check',
      "'outbox_required'",
      "'audit_required'",
      "'fully_linked'",
      'dw_runtime_snapshots_deal_fkey',
      'dw_runtime_snapshots_outbox_fkey',
      'dw_runtime_snapshots_audit_fkey',
      'dw_runtime_attempts_snapshot_fkey',
      'ON DELETE RESTRICT',
      'dw_runtime_snapshots_runtime_snapshot_id_key',
      'dw_runtime_snapshots_idempotency_key_key',
      'dw_runtime_attempts_transaction_id_key',
    ]) {
      expect(migration, `${requiredTerm} must remain in the migration`).toContain(requiredTerm);
    }

    expect(migration).toContain('CHECK ("version" > 0)');
    expect(migration).toContain("'created', 'prepared', 'committed', 'rolled_back', 'failed'");
  });

  it('keeps the migration additive and production application explicit', () => {
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).toContain('Merging this file does not apply it to production');
    expect(contract).toContain('does not mean the production migration is applied');
  });

  it('provides dependency-safe operational rollback for migration-owned objects', () => {
    const attemptDrop = rollback.indexOf('DROP TABLE IF EXISTS "deal_workspace_runtime_transaction_attempts"');
    const snapshotDrop = rollback.indexOf('DROP TABLE IF EXISTS "deal_workspace_runtime_snapshots"');
    const outboxAlter = rollback.indexOf('ALTER TABLE "outbox_entries"');
    const auditAlter = rollback.indexOf('ALTER TABLE "audit_events"');

    expect(attemptDrop).toBeGreaterThanOrEqual(0);
    expect(snapshotDrop).toBeGreaterThan(attemptDrop);
    expect(outboxAlter).toBeGreaterThan(snapshotDrop);
    expect(auditAlter).toBeGreaterThan(snapshotDrop);
    expect(rollback).toContain('DROP COLUMN IF EXISTS "runtimeSnapshotId"');
    expect(rollback).toContain('Run only under an approved maintenance procedure');
  });
});
