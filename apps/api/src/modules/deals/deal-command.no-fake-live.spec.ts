import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('canonical deal command source invariants', () => {
  const source = readFileSync(join(__dirname, 'deal-command.service.ts'), 'utf8');

  it('contains no synthetic bank confirmation reference or random identifier', () => {
    expect(source).not.toContain('TEST-RESERVE-');
    expect(source).not.toContain('TEST-RELEASE-');
    expect(source).not.toContain('Math.random()');
    expect(source).toContain('requiredBankReference(payload)');
    expect(source).toContain('randomUUID()');
  });

  it('binds reads and mutations to the trusted RLS transaction service', () => {
    expect(source).toContain('RlsTransactionService');
    expect(source).toContain('withTrustedContext');
    // Per-deal ordering: advisory transaction lock instead of global
    // Serializable isolation (which thrashes under cross-deal concurrency).
    expect(source).toContain('pg_advisory_xact_lock');
  });
});
