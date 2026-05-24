import { describe, expect, expectTypeOf, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { P7ActionIdempotencyContext, PlatformV7ActionBoundaryAuditPayload } from '@/lib/platform-v7/action-boundary';
import type { P7BankAuditPayload, P7BankBasisDecision } from '@/lib/platform-v7/bank-basis';
import type { PlatformV7MoneyTree } from '@/lib/platform-v7/money-tree';
import type {
  P7AuditEventSink,
  P7AuditPayload,
  P7IdempotencyStore,
  P7PersistedRecord,
  P7RepositoryResult,
  P7RuntimeResult,
  P7RuntimeUnitOfWork,
} from '@/lib/platform-v7/runtime/persistence-ports';

function version(resourceType: string, resourceId: string) {
  return {
    resourceType,
    resourceId,
    version: 'v1',
    updatedAt: '2026-05-24T00:00:00.000Z',
  };
}

const moneyTree: PlatformV7MoneyTree = {
  dealId: 'deal-1',
  currency: 'RUB',
  totalDealAmount: 1000,
  reservedAmount: 1000,
  readyToReleaseAmount: 1000,
  heldAmount: 0,
  manualReviewAmount: 0,
  releasedAmount: 0,
  refundedAmount: 0,
  platformFee: 0,
  bankFee: 0,
  status: 'reserved',
};

const moneyRecord: P7PersistedRecord<PlatformV7MoneyTree> = {
  recordId: 'money-record-1',
  dealId: 'deal-1',
  value: moneyTree,
  version: version('money', 'deal-1'),
  createdAt: '2026-05-24T00:00:00.000Z',
  updatedAt: '2026-05-24T00:00:00.000Z',
};

const bankDecision: P7BankBasisDecision = {
  dealId: 'deal-1',
  status: 'sent_to_bank',
  canSendToBank: false,
  blockerCodes: [],
  basisDocumentIds: ['contract', 'acceptance_act', 'lab_protocol', 'bank_basis'],
  amount: 1000,
  currency: 'RUB',
  correlationId: 'corr-1',
  auditId: 'audit-1',
  note: 'Sent to bank review.',
};

describe('platform-v7 runtime persistence ports', () => {
  it('requires idempotency context with processed keys, bank event ids and operation ids', () => {
    expectTypeOf<P7IdempotencyStore['loadContext']>().returns.resolves.toEqualTypeOf<P7ActionIdempotencyContext>();

    const context: P7ActionIdempotencyContext = {
      processedKeys: ['key-1'],
      processedBankEventIds: ['bank-event-1'],
      processedOperationIds: ['operation-1'],
    };

    expect(context.processedKeys).toEqual(['key-1']);
    expect(context.processedBankEventIds).toEqual(['bank-event-1']);
    expect(context.processedOperationIds).toEqual(['operation-1']);
  });

  it('accepts allowed denied blocked and duplicate audit payload shapes plus bank audit payloads', () => {
    const allowed: PlatformV7ActionBoundaryAuditPayload<PlatformV7MoneyTree> = {
      auditId: 'audit-allowed',
      correlationId: 'corr-allowed',
      actorId: 'bank-1',
      actorRole: 'bank_officer',
      organizationId: 'org-bank',
      resourceType: 'money',
      resourceId: 'money-1',
      action: 'release_confirmed',
      beforeState: moneyTree,
      afterState: { ...moneyTree, status: 'released' },
      reason: 'Bank event confirmed release.',
      idempotencyKey: 'key-allowed',
      createdAt: '2026-05-24T00:00:00.000Z',
      duplicate: false,
      auditCode: 'OK',
    };
    const denied: PlatformV7ActionBoundaryAuditPayload<PlatformV7MoneyTree> = {
      ...allowed,
      auditId: 'audit-denied',
      correlationId: 'corr-denied',
      reason: 'Role cannot confirm bank movement.',
      duplicate: false,
      auditCode: 'EXPLICIT_DENY',
    };
    const blocked: PlatformV7ActionBoundaryAuditPayload<PlatformV7MoneyTree> = {
      ...allowed,
      auditId: 'audit-blocked',
      correlationId: 'corr-blocked',
      reason: 'Bank confirmation is required.',
      duplicate: false,
      auditCode: 'BANK_CONFIRMATION_REQUIRED',
    };
    const duplicate: PlatformV7ActionBoundaryAuditPayload<PlatformV7MoneyTree> = {
      ...allowed,
      auditId: 'audit-duplicate',
      correlationId: 'corr-duplicate',
      reason: 'Idempotency key was already processed.',
      duplicate: true,
      auditCode: 'DUPLICATE_IDEMPOTENCY_KEY',
    };
    const bankAudit: P7BankAuditPayload = {
      auditId: 'audit-bank',
      correlationId: 'corr-bank',
      actorId: 'bank-1',
      actorRole: 'bank_officer',
      organizationId: 'org-bank',
      dealId: 'deal-1',
      moneyOperationId: 'bank:bank-event-1',
      beforeMoneyTree: moneyTree,
      afterMoneyTree: { ...moneyTree, status: 'released' },
      basisDocumentIds: ['contract', 'bank_basis'],
      bankEventId: 'bank-event-1',
      action: 'bank_release_confirmed',
      createdAt: '2026-05-24T00:00:00.000Z',
      outcome: 'allowed',
      code: 'OK',
      reason: 'Bank confirmed the release event.',
    };

    const payloads: readonly P7AuditPayload[] = [allowed, denied, blocked, duplicate, bankAudit];

    expectTypeOf<P7AuditEventSink['append']>().parameter(0).toEqualTypeOf<P7AuditPayload>();
    expectTypeOf<P7AuditEventSink['appendMany']>().parameter(0).toEqualTypeOf<readonly P7AuditPayload[]>();
    expectTypeOf(allowed).toMatchTypeOf<P7AuditPayload>();
    expectTypeOf(bankAudit).toMatchTypeOf<P7AuditPayload>();
    expect(payloads.map((payload) => payload.auditId)).toEqual([
      'audit-allowed',
      'audit-denied',
      'audit-blocked',
      'audit-duplicate',
      'audit-bank',
    ]);
  });

  it('types a MoneyTree and BankBasis transaction through runtime unit of work ports', async () => {
    async function loadForBankConfirmation(unitOfWork: P7RuntimeUnitOfWork) {
      return unitOfWork.runInTransaction(async (ports) => {
        const loadedMoney = await ports.moneyTree.loadByDealId('deal-1');
        const loadedBasis = await ports.bankBasis.loadByDealId('deal-1');

        expectTypeOf(ports.transaction.correlationId).toEqualTypeOf<string>();
        expectTypeOf(loadedMoney).toEqualTypeOf<P7RepositoryResult<P7PersistedRecord<PlatformV7MoneyTree>>>();
        expectTypeOf(loadedBasis).toEqualTypeOf<P7RepositoryResult<P7PersistedRecord<P7BankBasisDecision>>>();

        return {
          ok: true,
          value: { loadedMoney, loadedBasis },
          correlationId: ports.transaction.correlationId,
          auditId: ports.transaction.auditId,
        } as const;
      });
    }

    expectTypeOf(loadForBankConfirmation).returns.resolves.toEqualTypeOf<
      P7RuntimeResult<{
        readonly loadedMoney: P7RepositoryResult<P7PersistedRecord<PlatformV7MoneyTree>>;
        readonly loadedBasis: P7RepositoryResult<P7PersistedRecord<P7BankBasisDecision>>;
      }>
    >();
  });

  it('repository result can represent ok not_found conflict and error outcomes', () => {
    const ok: P7RepositoryResult<P7PersistedRecord<PlatformV7MoneyTree>> = {
      ok: true,
      status: 'ok',
      value: moneyRecord,
      version: moneyRecord.version,
    };
    const notFound: P7RepositoryResult<P7PersistedRecord<PlatformV7MoneyTree>> = {
      ok: false,
      status: 'not_found',
      error: { code: 'not_found', message: 'MoneyTree not found.' },
    };
    const conflict: P7RepositoryResult<P7PersistedRecord<PlatformV7MoneyTree>> = {
      ok: false,
      status: 'conflict',
      error: { code: 'conflict', message: 'Version conflict.' },
      currentVersion: version('money', 'deal-1'),
    };
    const error: P7RepositoryResult<P7PersistedRecord<PlatformV7MoneyTree>> = {
      ok: false,
      status: 'error',
      error: { code: 'persistence_error', message: 'Persistence failed.' },
    };

    expect([ok.status, notFound.status, conflict.status, error.status]).toEqual([
      'ok',
      'not_found',
      'conflict',
      'error',
    ]);
  });

  it('does not introduce module-level persistence state in runtime persistence ports', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/platform-v7/runtime/persistence-ports.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/new\s+Map\b/);
    expect(source).not.toMatch(/new\s+Set\b/);
    expect(source).not.toMatch(/const\s+\w+\s*=\s*\[\]/);
  });
});
