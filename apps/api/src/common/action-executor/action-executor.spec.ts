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

function makeExecutor() {
  const audit = {
    log: jest.fn().mockReturnValue({ id: 'audit-1' }),
  } as unknown as AuditService;
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
        idempotencyKey: params.idempotencyKey ?? 'derived-key',
        maxRetries: 5,
        nextRetryAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };
      entries.push(entry);
      return entry;
    }),
    listPending: jest.fn(async () => entries.filter((entry) => entry.status === 'PENDING')),
  } as unknown as OutboxService;
  return { executor: new ActionExecutorService(audit, outbox), audit, outbox };
}

describe('ActionExecutorService', () => {
  it('enforces the role matrix', () => {
    const { executor } = makeExecutor();
    expect(() => executor.assertPermission(makeUser(Role.FARMER), 'deal.create')).not.toThrow();
    expect(() => executor.assertPermission(makeUser(Role.DRIVER), 'deal.create')).toThrow(ForbiddenException);

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
      expect(() => executor.assertPermission(makeUser(Role.EXECUTIVE), action)).toThrow(ForbiddenException);
    }
    expect(() => executor.assertPermission(makeUser(Role.EXECUTIVE), 'deal.view')).not.toThrow();
    expect(() => executor.assertPermission(makeUser(Role.LAB), 'lab.protocol.finalize')).not.toThrow();
    expect(() => executor.assertPermission(makeUser(Role.LAB), 'money.release.request')).toThrow(ForbiddenException);
  });

  it('enforces organization, driver and executive object scope', () => {
    const { executor } = makeExecutor();
    const driver = makeUser(Role.DRIVER, { id: 'driver-1' });
    expect(() => executor.assertObjectScope(driver, 'shipment.view', {
      objectType: 'shipment',
      objectId: 'shipment-1',
      assignedDriverUserId: 'driver-1',
    })).not.toThrow();
    expect(() => executor.assertObjectScope(driver, 'shipment.view', {
      objectType: 'shipment',
      objectId: 'shipment-2',
      assignedDriverUserId: 'driver-2',
    })).toThrow(ForbiddenException);

    expect(() => executor.assertObjectScope(
      makeUser(Role.FARMER, { orgId: 'org-a' }),
      'deal.view',
      { objectType: 'deal', objectId: 'deal-1', ownerOrgId: 'org-b' },
    )).toThrow(ForbiddenException);
    expect(() => executor.assertObjectScope(
      makeUser(Role.EXECUTIVE),
      'deal.transition',
      { objectType: 'deal', objectId: 'deal-1' },
    )).toThrow(ForbiddenException);
  });

  it('enforces state gates', () => {
    const { executor } = makeExecutor();
    expect(() => executor.assertStateGates('money.release.request', { disputeOpen: true })).toThrow(ForbiddenException);
    expect(() => executor.assertStateGates('money.release.request', { documentsComplete: false })).toThrow(ForbiddenException);
    expect(() => executor.assertStateGates('money.release.request', { reserveConfirmed: false })).toThrow(ForbiddenException);
    expect(() => executor.assertStateGates('deal.transition', {
      dealStatus: 'SIGNED',
      allowedFromStatuses: ['SIGNED'],
    })).not.toThrow();
  });

  it('awaits durable enqueue before returning the bank outbox id', async () => {
    const { executor, outbox, audit } = makeExecutor();
    const result = await executor.execute({
      user: makeUser(Role.ACCOUNTING),
      action: 'money.reserve.request',
      scope: { objectType: 'deal', objectId: 'DEAL-001' },
      bankOutbox: {
        type: 'BANK_RESERVE_REQUEST',
        idempotencyKey: 'reserve:DEAL-001',
        payload: { dealId: 'DEAL-001', amountKopecks: 10_000_000 },
      },
      fn: () => ({ status: 'RESERVE_PENDING' }),
    });

    expect(result).toEqual({ result: { status: 'RESERVE_PENDING' }, auditId: 'audit-1', outboxId: 'outbox-1' });
    expect(outbox.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'reserve:DEAL-001',
      triggeredByUserId: 'user-accounting',
    }));
    await expect(outbox.listPending()).resolves.toHaveLength(1);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ meta: { outboxId: 'outbox-1' } }));
  });

  it('does not execute or enqueue when permission or gates fail', async () => {
    const { executor, outbox } = makeExecutor();
    const fn = jest.fn();
    await expect(executor.execute({
      user: makeUser(Role.DRIVER),
      action: 'deal.create',
      scope: { objectType: 'deal', objectId: 'deal-1' },
      fn,
    })).rejects.toThrow(ForbiddenException);
    await expect(executor.execute({
      user: makeUser(Role.ACCOUNTING),
      action: 'money.release.request',
      scope: { objectType: 'deal', objectId: 'deal-1' },
      gates: { disputeOpen: true },
      bankOutbox: { type: 'BANK_RELEASE_REQUEST', payload: { dealId: 'deal-1' } },
      fn,
    })).rejects.toThrow(ForbiddenException);
    expect(fn).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
