import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Disputes PostgreSQL authority policy', () => {
  const moduleSource = source('src/modules/disputes/disputes.module.ts');
  const serviceSource = source('src/modules/disputes/disputes.service.ts');
  const repositorySource = source('src/modules/disputes/postgresql-dispute.repository.ts');
  const schemaMigration = source('prisma/migrations/20260715021000_dispute_postgresql_authority/migration.sql');
  const commandMigration = source('prisma/migrations/20260715021100_dispute_postgresql_commands/migration.sql');
  const lifecycleMigration = source('prisma/migrations/20260715021200_dispute_lifecycle_commands/migration.sql');
  const finalizationMigration = source('prisma/migrations/20260715021300_dispute_finalization_commands/migration.sql');
  const partyGuardMigration = source('prisma/migrations/20260715021400_dispute_party_initiator_guard/migration.sql');

  it('has one PostgreSQL production owner and no runtime selector', () => {
    expect(moduleSource).toContain('PostgresqlDisputeRepository');
    expect(moduleSource).not.toMatch(/RuntimeDisputeRepository|selectDisputeRepository|DISPUTE_REPOSITORY/);
    expect(serviceSource).toContain('PostgresqlDisputeRepository');
    expect(serviceSource).not.toMatch(/Map<|counter|claimAmountRub|RuntimeDisputeRepository/);
  });

  it('uses server-derived RLS transactions and integer minor units', () => {
    expect(repositorySource).toContain('RlsTransactionService');
    expect(repositorySource).toContain('Prisma.TransactionIsolationLevel.Serializable');
    expect(repositorySource).toContain('maxConflictRetries: 5');
    expect(repositorySource).toContain('claimAmountKopecks');
    expect(repositorySource).not.toContain('claimAmountRub');
  });

  it('persists tenant isolation, append-only evidence and atomic settlement holds', () => {
    expect(schemaMigration).toContain('CREATE SCHEMA IF NOT EXISTS dispute');
    expect(schemaMigration).toContain('FORCE ROW LEVEL SECURITY');
    expect(schemaMigration).toContain('dispute_evidence_append_only');
    expect(schemaMigration).toContain('claim_amount_minor bigint');
    expect(commandMigration).toContain('INSERT INTO settlement.holds');
    expect(commandMigration).toContain('UPDATE settlement.payments');
    expect(commandMigration).toContain('DISPUTE_HOLD_EXCEEDS_AVAILABLE_FUNDS');
  });

  it('allows only a contractual Deal party to originate the claim', () => {
    expect(partyGuardMigration).toContain('dispute_party_initiator_guard');
    expect(partyGuardMigration).toContain('DISPUTE_PARTY_INITIATOR_REQUIRED');
    expect(partyGuardMigration).toContain('DISPUTE_RESPONDENT_SCOPE_INVALID');
    expect(partyGuardMigration).toContain('deal_row."buyerOrgId"');
    expect(partyGuardMigration).toContain('deal_row."sellerOrgId"');
  });

  it('requires evidence, appeal control and confirmed settlement operations before close', () => {
    expect(lifecycleMigration).toContain('DISPUTE_EVIDENCE_REQUIRED');
    expect(lifecycleMigration).toContain('BLOCKED_BY_APPEAL');
    expect(lifecycleMigration).toContain('DISPUTE_MONEY_INSTRUCTION_READY');
    expect(finalizationMigration).toContain('seller_operation.status');
    expect(finalizationMigration).toContain('buyer_operation.status');
    expect(finalizationMigration).toContain("status <> 'CONFIRMED'");
    expect(finalizationMigration).toContain('DISPUTE_SETTLEMENT_HOLD_NOT_RELEASED');
  });
});
