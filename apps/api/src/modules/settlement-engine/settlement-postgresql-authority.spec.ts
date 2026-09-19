import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API_ROOT = resolve(__dirname, '../../..');
const REPO_ROOT = resolve(API_ROOT, '../..');

function apiFile(relativePath: string) {
  return readFileSync(resolve(API_ROOT, relativePath), 'utf8');
}

function repoFile(relativePath: string) {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

describe('IR-10.4 Settlement production graph is PostgreSQL authoritative', () => {
  const moduleSource = apiFile('src/modules/settlement-engine/settlement-engine.module.ts');
  const serviceSource = apiFile('src/modules/settlement-engine/settlement-engine.service.ts');
  const controllerSource = apiFile('src/modules/settlement-engine/settlement-engine.controller.ts');
  const repositorySource = apiFile('src/modules/settlement-engine/settlement-postgresql.repository.ts');
  const industrialModeSource = apiFile('src/common/config/industrial-mode.ts');
  const migrationSource = apiFile(
    'prisma/migrations/20260713140000_settlement_postgresql_authority/migration.sql',
  );

  it('contains no runtime, repository selector or optional persistence authority', () => {
    const productionGraph = [moduleSource, serviceSource, controllerSource].join('\n');
    expect(productionGraph).not.toContain('RuntimeCoreModule');
    expect(productionGraph).not.toContain('RuntimeCoreService');
    expect(productionGraph).not.toContain('ActionExecutorService');
    expect(productionGraph).not.toContain('payment-repository.factory');
    expect(productionGraph).not.toContain('OutboxService');
    expect(productionGraph).not.toMatch(/optional:\s*true/);
    expect(moduleSource).toContain('SettlementPostgresqlRepository');

    for (const removed of [
      'src/modules/settlement-engine/bank-callbacks.controller.ts',
      'src/modules/settlement-engine/payment-repository.factory.ts',
      'src/modules/settlement-engine/runtime-payment.repository.ts',
      'src/modules/settlement-engine/prisma-payment.repository.ts',
    ]) {
      expect(existsSync(resolve(API_ROOT, removed))).toBe(false);
    }
  });

  it('fails production startup closed unless settlement authority is Prisma/PostgreSQL', () => {
    expect(industrialModeSource).toContain("assertPrismaRepository(env, 'PLATFORM_V7_PAYMENT_REPOSITORY'");
    expect(industrialModeSource).toContain('payment and settlement');
  });

  it('forbids manual money confirmation and adjustment routes', () => {
    expect(controllerSource).not.toContain("@Post('deal/:id/confirm')");
    expect(controllerSource).not.toContain("@Post('deal/:id/adjust')");
    expect(controllerSource).not.toContain("@Post('import-bank-statement')");
    expect(controllerSource).not.toContain("@Controller('bank-callbacks')");
    expect(serviceSource).toContain('VERIFIED_BANK_CALLBACK_REQUIRED');
    expect(serviceSource).toContain('MANUAL_MONEY_ADJUSTMENT_FORBIDDEN');
  });

  it('uses only integer minor units in the authoritative repository and schema', () => {
    expect(repositorySource).not.toMatch(/amountRub|Float|DOUBLE PRECISION|parseFloat/);
    expect(migrationSource).toContain('amount_minor BIGINT');
    expect(migrationSource).toContain('reserve_amount_minor BIGINT');
    expect(migrationSource).toContain('confirmed_reserved_minor BIGINT');
  });

  it('never disables PostgreSQL constraints, triggers or RLS', () => {
    const implementation = [
      migrationSource,
      repoFile('infra/sql/postgresql-settlement-authority-policies.sql'),
      repositorySource,
    ].join('\n');
    expect(implementation).not.toMatch(/session_replication_role\s*=\s*replica/i);
    expect(implementation).not.toMatch(/DISABLE\s+TRIGGER/i);
    expect(implementation).not.toMatch(/BYPASSRLS/i);
    expect(implementation).toContain('FORCE ROW LEVEL SECURITY');
  });

  it('binds confirmation to verified callback identity and durable facts', () => {
    expect(controllerSource).toContain('x-bank-partner-id');
    expect(controllerSource).toContain('x-bank-key-id');
    expect(controllerSource).toContain('x-bank-event-id');
    expect(controllerSource).toContain('payloadFingerprint');
    expect(repositorySource).toContain('settlement.bank_callbacks');
    expect(repositorySource).toContain('settlement.ledger_entries');
    expect(repositorySource).toContain('tx.outboxEntry.create');
    expect(repositorySource).toContain('appendAudit');
  });
});
