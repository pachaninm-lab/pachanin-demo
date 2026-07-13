import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('canonical bank callback boundary', () => {
  const controller = readFileSync(
    join(__dirname, '../settlement-engine/settlement-engine.controller.ts'),
    'utf8',
  );
  const repository = readFileSync(
    join(__dirname, '../settlement-engine/settlement-postgresql.repository.ts'),
    'utf8',
  );
  const policy = readFileSync(join(__dirname, 'deal-command.policy.ts'), 'utf8');
  const workspace = readFileSync(
    join(__dirname, '../../../../web/components/platform-v7/CanonicalDealWorkspace.tsx'),
    'utf8',
  );

  it('binds the signature to partner, key version, timestamp, event and canonical body hash', () => {
    expect(controller).toContain("@Headers('x-bank-partner-id')");
    expect(controller).toContain("@Headers('x-bank-key-id')");
    expect(controller).toContain("@Headers('x-bank-timestamp')");
    expect(controller).toContain("@Headers('x-bank-event-id')");
    expect(controller).toContain('canonicalizeBankPayload');
    expect(controller).toContain("createHash('sha256')");
    expect(controller).toContain('buildBankSignaturePayload');
    expect(controller).toContain('timingSafeEqual');
  });

  it('requires an opaque operation identifier returned by the PostgreSQL request receipt', () => {
    expect(controller).toContain('BANK_OPERATION_ID_MUST_COME_FROM_REQUEST_RECEIPT');
    expect(controller).toContain('operationId');
    expect(controller).not.toContain('`bank-reserve:${dealId}`');
    expect(controller).not.toContain('`bank-release:${dealId}`');
    expect(repository).toContain('operationId');
    expect(repository).toContain('settlement.bank_operations');
    expect(repository).toContain('BANK_CALLBACK_OPERATION_MISMATCH');
  });

  it('keeps money confirmation server-only across policy and UI', () => {
    expect(policy).toContain("roles: ['BANK_CALLBACK'], source: 'BANK_CALLBACK'");
    expect(workspace).toContain('Ручное подтверждение невозможно');
    expect(workspace).not.toContain('TEST-RESERVE-');
    expect(workspace).not.toContain('TEST-RELEASE-');
  });
});
