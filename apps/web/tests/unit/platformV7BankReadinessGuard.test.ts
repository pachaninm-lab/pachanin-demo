import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const bankBasisSource = fs.readFileSync(path.join(process.cwd(), 'lib/platform-v7/bank-basis.ts'), 'utf8');
const bankBasisTestSource = fs.readFileSync(path.join(process.cwd(), 'tests/unit/platformV7BankBasis.test.ts'), 'utf8');

describe('platform-v7 bank readiness guard', () => {
  it('keeps bank confirmation tied to bank officer, bank organization, reference and trace ids', () => {
    const requiredRuntimeTerms = [
      'BANK_OFFICER_REQUIRED',
      'BANK_ORG_REQUIRED',
      'DUPLICATE_BANK_EVENT',
      'DUPLICATE_IDEMPOTENCY_KEY',
      'bankOrganizationId',
      'bankReference',
      'correlationId',
      'auditId',
      'idempotencyKey',
    ];

    for (const term of requiredRuntimeTerms) {
      expect(bankBasisSource, `${term} must remain in bank runtime`).toContain(term);
    }
  });

  it('keeps tests that deny non-bank roles from moving money', () => {
    expect(bankBasisTestSource).toContain('denies %s bank movement confirmation without mutating MoneyTree');
    expect(bankBasisTestSource).toContain('BANK_OFFICER_REQUIRED');
    expect(bankBasisTestSource).toContain('moneyTree: releaseRequestedTree');
  });

  it('keeps bank basis separate from payment confirmation', () => {
    expect(bankBasisSource).toContain('ready_for_bank_review');
    expect(bankBasisSource).toContain('sent_to_bank');
    expect(bankBasisSource).toContain('bank_confirmed');
    expect(bankBasisTestSource).toContain('keeps sent_to_bank separate from bank_confirmed until a bank event arrives');
  });
});
