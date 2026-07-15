import { ForbiddenException } from '@nestjs/common';
import { ActionExecutorService } from './action-executor.service';
import { OutboxService, type OutboxEntry } from '../outbox/outbox.service';
import { AuditService } from '../../modules/audit/audit.service';
import { Role, RequestUser } from '../types/request-user';
import type { DomainAction } from './action-policy';

function makeUser(role: Role, extra?: Partial<RequestUser>): RequestUser {
  return {
    id: `user-${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@demo.ru`,
    orgId: 'org-test-001',
    role,
    ...extra,
  };
}

function makeAuditService() {
  const prismaMock: any = {
    auditEvent: { create: jest.fn().mockRejectedValue(new Error('DB mock')) },
  };
  return new AuditService(prismaMock);
}

function makeExecutor() {
  const audit = makeAuditService();
  const entries: OutboxEntry[] = [];
  const outbox = {
    enqueue: jest.fn(async (params: any) => {
      const entry: OutboxEntry = {
        id: `outbox-${entries.length + 1}`,
        type: params.type,
        dealId: params.dealId,
        payload: params.payload,
        status: 'PENDING',
        triggeredByUserId: params.triggeredByUserId,
        idempotencyKey: params.idempotencyKey,
        maxRetries: params.maxRetries ?? 5,
        retryCount: 0,
        nextRetryAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      entries.push(entry);
      return entry;
    }),
    listPending: jest.fn(async () => entries.filter((entry) => entry.status === 'PENDING')),
  } as unknown as OutboxService;
  const executor = new ActionExecutorService(audit, outbox);
  return { executor, audit, outbox };
}

describe('ActionExecutorService — RBAC matrix', () => {
  it('allows FARMER to create a deal', () => {
    expect(() => makeExecutor().executor.assertPermission(makeUser(Role.FARMER), 'deal.create')).not.toThrow();
  });

  it('blocks DRIVER from creating a deal', () => {
    expect(() => makeExecutor().executor.assertPermission(makeUser(Role.DRIVER), 'deal.create')).toThrow(
      ForbiddenException,
    );
  });

  it('keeps EXECUTIVE read-only', () => {
    const { executor } = makeExecutor();
    const mutations: DomainAction[] = [
      'deal.create',
      'deal.transition',
      'money.reserve.request',
      'money.release.request',
      'document.upload',
      'shipment.create',
      'dispute.create',
    ];
    for (const action of mutations) {
      expect(() => executor.assertPermission(makeUser(Role.EXECUTIVE), action)).toThrow(
        ForbiddenException,
      );
    }
    expect(() => executor.assertPermission(makeUser(Role.EXECUTIVE), 'deal.view')).not.toThrow();
  });

  it('allows LAB operations but blocks money release', () => {
    const { executor } = makeExecutor();
    expect(() => executor.assertPermission(makeUser(Role.LAB), 'lab.test.record')).not.toThrow();
    expect(() => executor.assertPermission(makeUser(Role.LAB), 'lab.protocol.finalize')).not.toThrow();
    expect(() => executor.assertPermission(makeUser(Role.LAB), 'money.release.request')).toThrow(
      ForbiddenException,
    );
  });

  it('allows ADMIN across representative authorities', () => {
    const { executor } = makeExecutor();
    const actions: DomainAction[] = [
      'deal.create',
      'deal.transition',
      'money.reserve.request',
      'money.release.confirm',
      'document.sign',
      'shipment.create',
      'dispute.decide',
      'lab.protocol.finalize',
    ];
    for (const action of actions) {
      expect(() => executor.assertPermission(makeUser(Role.ADMIN), action)).not.toThrow();
    }
  });
});

describe('ActionExecutorService — object and state scope', () => {
  it('blocks a DRIVER from another driver shipment', () => {
    const { executor } = makeExecutor();
    expect(() =>
      executor.assertObjectScope(makeUser(Role.DRIVER, { id: 'driver-001' }), 'shipment.view', {
        objectType: 'shipment',
        objectId: 'SHIP-002',
        assignedDriverUserId: 'driver-999',
      }),
    ).toThrow(ForbiddenException);
  });

  it('blocks cross-organization FARMER access', () => {
    const { executor } = makeExecutor();
    expect(() =>
      executor.assertObjectScope(makeUser(Role.FARMER, { orgId: 'org-farmer-001' }), 'deal.view', {
        objectType: 'deal',
        objectId: 'DEAL-X',
        ownerOrgId: 'org-other',
        counterpartyOrgId: 'org-buyer',
      }),
    ).toThrow(ForbiddenException);
  });

  it('allows a BUYER that is the counterparty', () => {
    const { executor } = makeExecutor();
    expect(() =>
      executor.assertObjectScope(makeUser(Role.BUYER, { orgId: 'org-buyer-001' }), 'deal.view', {
        objectType: 'deal',
        objectId: 'DEAL-001',
        ownerOrgId: 'org-farmer-001',
        counterpartyOrgId: 'org-buyer-001',
      }),
    ).not.toThrow();
  });

  it('blocks release when dispute, documents or reserve gates fail', () => {
    const { executor } = makeExecutor();
    expect(() => executor.assertStateGates('money.release.request', { disputeOpen: true })).toThrow(
      ForbiddenException,
    );
    expect(() =>
      executor.assertStateGates('money.release.request', { documentsComplete: false }),
    ).toThrow(ForbiddenException);
    expect(() =>
      executor.assertStateGates('money.release.request', { reserveConfirmed: false }),
    ).toThrow(ForbiddenException);
  });
});

describe('ActionExecutorService — durable outbox execution', () => {
  it('awaits PostgreSQL enqueue before running a bank command', async () => {
    const { executor, outbox } = makeExecutor();
    const result = await executor.execute({
      user: makeUser(Role.ACCOUNTING),
      action: 'money.reserve.request',
      scope: { objectType: 'deal', objectId: 'DEAL-001' },
      bankOutbox: {
        type: 'BANK_RESERVE_REQUEST',
        payload: { dealId: 'DEAL-001', amountKopecks: '10000000' },
      },
      fn: () => ({ status: 'RESERVE_PENDING' }),
    });

    expect(result.result).toEqual({ status: 'RESERVE_PENDING' });
    expect(result.outboxId).toBe('outbox-1');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'BANK_RESERVE_REQUEST',
        dealId: 'DEAL-001',
        triggeredByUserId: 'user-accounting',
      }),
    );
    await expect(outbox.listPending()).resolves.toHaveLength(1);
  });

  it('does not enqueue or invoke the command when permission fails', async () => {
    const { executor, outbox } = makeExecutor();
    const fn = jest.fn();

    await expect(
      executor.execute({
        user: makeUser(Role.DRIVER),
        action: 'deal.create',
        scope: { objectType: 'deal', objectId: 'DEAL-001' },
        bankOutbox: { type: 'BANK_RESERVE_REQUEST', payload: {} },
        fn,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(fn).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
