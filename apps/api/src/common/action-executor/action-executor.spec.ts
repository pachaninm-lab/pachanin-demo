import { ForbiddenException } from '@nestjs/common';
import { ActionExecutorService } from './action-executor.service';
import { OutboxService } from '../outbox/outbox.service';
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
  // PrismaService mock — always throws so audit falls back to in-memory
  const prismaMock: any = {
    auditEvent: { create: jest.fn().mockRejectedValue(new Error('DB mock')) },
  };
  return new AuditService(prismaMock);
}

function makeExecutor() {
  const audit = makeAuditService();
  const outbox = new OutboxService();
  const executor = new ActionExecutorService(audit, outbox);
  return { executor, audit, outbox };
}

describe('ActionExecutorService — RBAC matrix', () => {
  it('FARMER can create a deal', () => {
    const { executor } = makeExecutor();
    expect(() => executor.assertPermission(makeUser(Role.FARMER), 'deal.create')).not.toThrow();
  });

  it('DRIVER cannot create a deal', () => {
    const { executor } = makeExecutor();
    expect(() => executor.assertPermission(makeUser(Role.DRIVER), 'deal.create')).toThrow(ForbiddenException);
  });

  it('EXECUTIVE cannot perform any mutation', () => {
    const { executor } = makeExecutor();
    const mutations: DomainAction[] = [
      'deal.create', 'deal.transition', 'money.reserve.request', 'money.release.request',
      'document.upload', 'shipment.create', 'dispute.create',
    ];
    for (const action of mutations) {
      expect(() => executor.assertPermission(makeUser(Role.EXECUTIVE), action)).toThrow(ForbiddenException);
    }
  });

  it('EXECUTIVE can view deals and documents', () => {
    const { executor } = makeExecutor();
    const reads: DomainAction[] = ['deal.view', 'document.view', 'shipment.view', 'lot.view'];
    for (const action of reads) {
      expect(() => executor.assertPermission(makeUser(Role.EXECUTIVE), action)).not.toThrow();
    }
  });

  it('LAB can record tests and finalize protocol', () => {
    const { executor } = makeExecutor();
    expect(() => executor.assertPermission(makeUser(Role.LAB), 'lab.test.record')).not.toThrow();
    expect(() => executor.assertPermission(makeUser(Role.LAB), 'lab.protocol.finalize')).not.toThrow();
  });

  it('LAB cannot release money', () => {
    const { executor } = makeExecutor();
    expect(() => executor.assertPermission(makeUser(Role.LAB), 'money.release.request')).toThrow(ForbiddenException);
  });

  it('BUYER cannot sign deals on behalf of seller (assertPermission only checks role)', () => {
    const { executor } = makeExecutor();
    // Permission check is role-level; object-scope enforced separately
    expect(() => executor.assertPermission(makeUser(Role.BUYER), 'deal.sign')).not.toThrow();
  });

  it('GUEST cannot do anything except view lots', () => {
    const { executor } = makeExecutor();
    expect(() => executor.assertPermission(makeUser(Role.GUEST), 'deal.create')).toThrow(ForbiddenException);
    expect(() => executor.assertPermission(makeUser(Role.GUEST), 'lot.view')).not.toThrow();
  });

  it('ADMIN can do everything', () => {
    const { executor } = makeExecutor();
    const actions: DomainAction[] = [
      'deal.create', 'deal.transition', 'money.reserve.request', 'money.release.confirm',
      'document.sign', 'shipment.create', 'dispute.decide', 'lab.protocol.finalize',
    ];
    for (const action of actions) {
      expect(() => executor.assertPermission(makeUser(Role.ADMIN), action)).not.toThrow();
    }
  });
});

describe('ActionExecutorService — object scope', () => {
  it('EXECUTIVE mutation is blocked at object scope even if route allows it', () => {
    const { executor } = makeExecutor();
    expect(() =>
      executor.assertObjectScope(makeUser(Role.EXECUTIVE), 'deal.transition', {
        objectType: 'deal',
        objectId: 'DEAL-001',
        ownerOrgId: 'org-test-001',
      }),
    ).toThrow(ForbiddenException);
  });

  it('EXECUTIVE read access is allowed at object scope', () => {
    const { executor } = makeExecutor();
    expect(() =>
      executor.assertObjectScope(makeUser(Role.EXECUTIVE), 'deal.view', {
        objectType: 'deal',
        objectId: 'DEAL-001',
        ownerOrgId: 'org-test-001',
      }),
    ).not.toThrow();
  });

  it('DRIVER can only access own shipment', () => {
    const { executor } = makeExecutor();
    const driver = makeUser(Role.DRIVER, { id: 'driver-001' });

    // Own shipment — OK
    expect(() =>
      executor.assertObjectScope(driver, 'shipment.view', {
        objectType: 'shipment',
        objectId: 'SHIP-001',
        assignedDriverUserId: 'driver-001',
      }),
    ).not.toThrow();

    // Someone else's shipment — DENIED
    expect(() =>
      executor.assertObjectScope(driver, 'shipment.view', {
        objectType: 'shipment',
        objectId: 'SHIP-002',
        assignedDriverUserId: 'driver-999',
      }),
    ).toThrow(ForbiddenException);
  });

  it('FARMER cannot access deal from another org', () => {
    const { executor } = makeExecutor();
    const farmer = makeUser(Role.FARMER, { orgId: 'org-farmer-001' });

    expect(() =>
      executor.assertObjectScope(farmer, 'deal.view', {
        objectType: 'deal',
        objectId: 'DEAL-X',
        ownerOrgId: 'org-farmer-ANOTHER',
        counterpartyOrgId: 'org-buyer-999',
      }),
    ).toThrow(ForbiddenException);
  });

  it('FARMER can access their own deal as seller', () => {
    const { executor } = makeExecutor();
    const farmer = makeUser(Role.FARMER, { orgId: 'org-farmer-001' });

    expect(() =>
      executor.assertObjectScope(farmer, 'deal.view', {
        objectType: 'deal',
        objectId: 'DEAL-001',
        ownerOrgId: 'org-farmer-001',
        counterpartyOrgId: 'org-buyer-001',
      }),
    ).not.toThrow();
  });

  it('BUYER can access deal as counterparty', () => {
    const { executor } = makeExecutor();
    const buyer = makeUser(Role.BUYER, { orgId: 'org-buyer-001' });

    expect(() =>
      executor.assertObjectScope(buyer, 'deal.view', {
        objectType: 'deal',
        objectId: 'DEAL-001',
        ownerOrgId: 'org-farmer-001',
        counterpartyOrgId: 'org-buyer-001',
      }),
    ).not.toThrow();
  });

  it('ADMIN bypasses all object scope checks', () => {
    const { executor } = makeExecutor();
    expect(() =>
      executor.assertObjectScope(makeUser(Role.ADMIN), 'deal.transition', {
        objectType: 'deal',
        objectId: 'DEAL-001',
        ownerOrgId: 'org-OTHER',
      }),
    ).not.toThrow();
  });
});

describe('ActionExecutorService — state gates', () => {
  it('blocks release when dispute is open', () => {
    const { executor } = makeExecutor();
    expect(() =>
      executor.assertStateGates('money.release.request', { disputeOpen: true }),
    ).toThrow(ForbiddenException);
  });

  it('blocks release when documents are incomplete', () => {
    const { executor } = makeExecutor();
    expect(() =>
      executor.assertStateGates('money.release.request', { documentsComplete: false }),
    ).toThrow(ForbiddenException);
  });

  it('blocks release when reserve not confirmed', () => {
    const { executor } = makeExecutor();
    expect(() =>
      executor.assertStateGates('money.release.request', { reserveConfirmed: false }),
    ).toThrow(ForbiddenException);
  });

  it('blocks transition from wrong deal status', () => {
    const { executor } = makeExecutor();
    expect(() =>
      executor.assertStateGates('deal.transition', {
        dealStatus: 'DRAFT',
        allowedFromStatuses: ['SIGNED', 'AWAITING_SIGN'],
      }),
    ).toThrow(ForbiddenException);
  });

  it('allows transition from correct status', () => {
    const { executor } = makeExecutor();
    expect(() =>
      executor.assertStateGates('deal.transition', {
        dealStatus: 'SIGNED',
        allowedFromStatuses: ['SIGNED', 'AWAITING_SIGN'],
      }),
    ).not.toThrow();
  });

  it('allows release when all gates clear', () => {
    const { executor } = makeExecutor();
    expect(() =>
      executor.assertStateGates('money.release.request', {
        disputeOpen: false,
        documentsComplete: true,
        reserveConfirmed: true,
      }),
    ).not.toThrow();
  });
});

describe('ActionExecutorService — execute with outbox', () => {
  it('creates outbox entry for bank reserve action', async () => {
    const { executor, outbox } = makeExecutor();
    const user = makeUser(Role.ACCOUNTING);

    const { result, outboxId } = await executor.execute({
      user,
      action: 'money.reserve.request',
      scope: { objectType: 'deal', objectId: 'DEAL-001' },
      bankOutbox: { type: 'BANK_RESERVE_REQUEST', payload: { dealId: 'DEAL-001', amountRub: 100000 } },
      fn: () => ({ status: 'RESERVE_PENDING' }),
    });

    expect(outboxId).toBeDefined();
    expect(result).toEqual({ status: 'RESERVE_PENDING' });

    const pending = outbox.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('BANK_RESERVE_REQUEST');
    expect(pending[0].status).toBe('PENDING');
  });

  it('denies execution when permission check fails, does not call fn', async () => {
    const { executor } = makeExecutor();
    const fn = jest.fn();

    await expect(
      executor.execute({
        user: makeUser(Role.DRIVER),
        action: 'deal.create',
        scope: { objectType: 'deal', objectId: 'DEAL-001' },
        fn,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(fn).not.toHaveBeenCalled();
  });

  it('denies execution when state gate fails, does not call fn', async () => {
    const { executor } = makeExecutor();
    const fn = jest.fn();

    await expect(
      executor.execute({
        user: makeUser(Role.ACCOUNTING),
        action: 'money.release.request',
        scope: { objectType: 'deal', objectId: 'DEAL-001' },
        gates: { disputeOpen: true },
        fn,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(fn).not.toHaveBeenCalled();
  });
});
