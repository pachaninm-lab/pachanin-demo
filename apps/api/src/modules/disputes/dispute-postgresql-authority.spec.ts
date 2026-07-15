import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../../..');
const migrationPath = 'apps/api/prisma/migrations/20260715090000_dispute_postgresql_authority/migration.sql';
const commandPath = 'apps/api/src/modules/disputes/dispute-command.service.ts';
const queryPath = 'apps/api/src/modules/disputes/dispute-query.service.ts';
const modulePath = 'apps/api/src/modules/disputes/disputes.module.ts';
const arbitratorPath = 'apps/api/src/modules/arbitrator/arbitrator.service.ts';

const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

describe('IR-10.5 dispute PostgreSQL authority', () => {
  it('has one production owner and no runtime repository fallback', () => {
    const module = read(modulePath);
    expect(module).toContain('PostgreSQL is the only runtime owner');
    expect(module).toContain('DisputeCommandService');
    expect(module).toContain('DisputeQueryService');
    expect(module).not.toContain('DISPUTE_REPOSITORY');
    expect(module).not.toContain('PLATFORM_V7_DISPUTE_REPOSITORY');
    expect(existsSync(resolve(ROOT, 'apps/api/src/modules/disputes/runtime-dispute.repository.ts'))).toBe(false);
    expect(existsSync(resolve(ROOT, 'apps/api/src/modules/disputes/prisma-dispute.repository.ts'))).toBe(false);
  });

  it('uses serializable trusted transactions and PostgreSQL command functions', () => {
    const command = read(commandPath);
    expect(command).toContain('this.rls.withTrustedContext');
    expect(command).toContain('Prisma.TransactionIsolationLevel.Serializable');
    expect(command).toContain('maxConflictRetries: 5');
    for (const fn of [
      'dispute.open_case', 'dispute.triage_case', 'dispute.add_evidence',
      'dispute.assign_arbitrator', 'dispute.resolve_case',
      'dispute.open_appeal', 'dispute.resolve_appeal',
    ]) expect(command).toContain(fn);
  });

  it('keeps money in the shared append-only journal with canonical deal escrow accounts', () => {
    const migration = read(migrationPath);
    expect(migration).toContain('public.ledger_entries');
    expect(migration).toContain("'escrow:' || p_deal_id");
    expect(migration).toContain("'dispute-hold:' || case_id");
    expect(migration).toContain('DISPUTE_INSUFFICIENT_LEDGER_BALANCE');
    expect(migration).toContain('dispute.ledger_links');
    expect(migration).not.toContain("'sys:escrow'");
    expect(migration).not.toContain("'sys:dispute-hold'");
  });

  it('enforces tenant FORCE-RLS and function-only writes', () => {
    const migration = read(migrationPath);
    for (const table of ['cases', 'holds', 'evidence', 'appeals', 'ledger_links', 'command_receipts']) {
      expect(migration).toContain(`ALTER TABLE dispute.%I ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE dispute.%I FORCE ROW LEVEL SECURITY`);
      expect(migration).toContain(`dispute.${table}`);
    }
    expect(migration).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA dispute FROM PUBLIC, app_deal');
    expect(migration).toContain('GRANT SELECT ON dispute.cases');
    expect(migration).not.toMatch(/GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON\s+dispute\./i);
  });

  it('persists idempotency, audit hash chain, outbox and immutable evidence atomically', () => {
    const migration = read(migrationPath);
    expect(migration).toContain('dispute.command_receipts');
    expect(migration).toContain('DISPUTE_IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('dispute.append_audit');
    expect(migration).toContain('dispute.append_outbox');
    expect(migration).toContain('previous_hash');
    expect(migration).toContain('DISPUTE_APPEND_ONLY_RECORD');
    expect(migration).toContain('DISPUTE_SETTLEMENT_BASIS_READY');
    expect(migration).toContain('DISPUTE_FINAL_SETTLEMENT_BASIS_READY');
  });

  it('routes the arbitrator cockpit through the same command owner', () => {
    const arbitrator = read(arbitratorPath);
    expect(arbitrator).toContain('DisputeCommandService');
    expect(arbitrator).toContain('DisputeQueryService');
    expect(arbitrator).not.toContain('PrismaService');
    expect(arbitrator).not.toContain('LedgerV2Service');
    expect(arbitrator).not.toContain('AuditService');
  });

  it('reads only through trusted tenant context', () => {
    const query = read(queryPath);
    expect(query).toContain('this.rls.withTrustedContext');
    expect(query).toContain("current_setting('app.current_tenant_id', true)");
    expect(query).toContain('dispute.can_read_case');
  });
});
