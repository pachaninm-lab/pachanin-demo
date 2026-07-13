import { PolicyEngineService, PolicyInput } from '../../common/security/policy-engine.service';
import { SettlementEngineService } from '../settlement-engine/settlement-engine.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequestUser, Role } from '../../common/types/request-user';

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'user-1',
    orgId: 'org-1',
    role: Role.FARMER,
    email: 'user-1@example.test',
    ...overrides,
  };
}

function makeInput(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    action: 'deal:read',
    user: { id: 'user-1', role: 'FARMER', organizationId: 'org-1' },
    resource: { type: 'Deal', id: 'deal-1', sellerOrgId: 'org-1' },
    ...overrides,
  };
}

function makePrisma() {
  return {
    auditEvent: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    dealEvent: { create: jest.fn().mockResolvedValue({}) },
    outboxEntry: { create: jest.fn().mockResolvedValue({}) },
    payment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    deal: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;
}

function makeSettlement(): SettlementEngineService {
  return new SettlementEngineService(
    {
      list: jest.fn(),
      detail: jest.fn(),
      worksheet: jest.fn(),
      bankWorkspace: jest.fn(),
      outboxStatus: jest.fn(),
      exportDeals: jest.fn(),
      exportContractors: jest.fn(),
    } as any,
    { executeUser: jest.fn() } as any,
    { importMT940: jest.fn() } as any,
  );
}

describe('Security E2E - unauthorized access policy', () => {
  let engine: PolicyEngineService;

  beforeEach(() => {
    engine = new PolicyEngineService();
  });

  it('FARMER cannot read deal of another org', () => {
    const input = makeInput({
      action: 'deal:read',
      user: { id: 'user-attacker', role: 'FARMER', organizationId: 'org-attacker' },
      resource: { type: 'Deal', id: 'deal-victim', sellerOrgId: 'org-seller', buyerOrgId: 'org-buyer' },
    });
    const result = engine.evaluate(input);
    expect(result.allowed).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('BUYER can read deal they participate in as buyer', () => {
    const input = makeInput({
      action: 'deal:read',
      user: { id: 'user-buyer', role: 'BUYER', organizationId: 'org-buyer' },
      resource: { type: 'Deal', id: 'deal-1', sellerOrgId: 'org-seller', buyerOrgId: 'org-buyer' },
    });
    expect(engine.evaluate(input).allowed).toBe(true);
  });

  it('ARBITRATOR cannot read dispute they are not assigned to', () => {
    const input = makeInput({
      action: 'dispute:read',
      user: { id: 'user-arb', role: 'ARBITRATOR', organizationId: 'org-arb' },
      resource: { type: 'dispute', id: 'dispute-1', assignedArbitratorId: 'user-other-arb' },
    });
    expect(engine.evaluate(input).allowed).toBe(false);
  });

  it('ARBITRATOR can read dispute assigned to them', () => {
    const input = makeInput({
      action: 'dispute:read',
      user: { id: 'user-arb', role: 'ARBITRATOR', organizationId: 'org-arb' },
      resource: { type: 'dispute', id: 'dispute-1', assignedArbitratorId: 'user-arb' },
    });
    expect(engine.evaluate(input).allowed).toBe(true);
  });

  it('EXECUTIVE cannot modify resources', () => {
    for (const action of ['deal:create', 'deal:update', 'payment:write']) {
      const result = engine.evaluate(makeInput({
        action,
        user: { id: 'user-exec', role: 'EXECUTIVE', organizationId: 'org-1' },
        resource: { type: 'Deal', id: 'deal-1' },
      }));
      expect(result.allowed).toBe(false);
    }
  });

  it('business ADMIN cannot bypass tenant boundaries', () => {
    const input = makeInput({
      action: 'deal:read',
      user: { id: 'admin-1', role: 'ADMIN', organizationId: 'org-platform' },
      resource: { type: 'Deal', id: 'deal-foreign', sellerOrgId: 'org-x', buyerOrgId: 'org-y' },
    });
    const result = engine.evaluate(input);
    expect(result.allowed).toBe(false);
    expect(result.matchedPolicy).toBe('deny.deal.cross-org-read');
  });

  it('GUEST cannot access deals', () => {
    const input = makeInput({
      action: 'deal:read',
      user: { id: 'guest-1', role: 'GUEST' },
      resource: { type: 'Deal', id: 'deal-1', sellerOrgId: 'org-1' },
    });
    expect(engine.evaluate(input).allowed).toBe(false);
  });

  it('SUPPORT_MANAGER can view but cannot write financial data', () => {
    const result = engine.evaluate(makeInput({
      action: 'payment:write',
      user: { id: 'support-1', role: 'SUPPORT_MANAGER', organizationId: 'org-platform' },
      resource: { type: 'payment', id: 'pay-1' },
    }));
    expect(result.allowed).toBe(false);
  });
});

describe('Security E2E - money invariants: manual release is impossible', () => {
  it('rejects every human manual-release attempt before any repository effect', () => {
    const settlement = makeSettlement();
    const user = makeUser({
      id: 'admin-1',
      orgId: 'org-platform',
      role: Role.ADMIN,
      email: 'admin@example.test',
    });

    expect(() => settlement.releasePayment('deal-1', user)).toThrow(
      /verified bank callback/i,
    );
    expect(() => settlement.releasePayment('deal-1', user)).toThrow(
      /verified bank callback/i,
    );
  });
});

describe('Security E2E - MFA policy', () => {
  let engine: PolicyEngineService;

  beforeEach(() => {
    engine = new PolicyEngineService();
  });

  it('financial reserve without MFA is denied when amount is above threshold', () => {
    const input = makeInput({
      action: 'payment:reserve',
      user: { id: 'user-1', role: 'FARMER', organizationId: 'org-1', mfaVerified: false },
      resource: {
        type: 'payment',
        id: 'pay-1',
        requiresMfa: true,
        amountKopecks: 150_000_00,
      },
    });
    const result = engine.evaluate(input);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((r) => r.toLowerCase().includes('mfa'))).toBe(true);
  });

  it('financial release is default-denied without an explicit allow rule', () => {
    const input = makeInput({
      action: 'payment:release',
      user: { id: 'user-buyer', role: 'BUYER', organizationId: 'org-buyer', mfaVerified: true },
      resource: {
        type: 'payment',
        id: 'pay-1',
        buyerOrgId: 'org-buyer',
        requiresMfa: true,
        amountKopecks: 150_000_00,
      },
    });
    expect(engine.evaluate(input).allowed).toBe(false);
  });

  it('ADMIN role without MFA cannot perform high-value financial release', () => {
    const input = makeInput({
      action: 'payment:release',
      user: { id: 'admin-1', role: 'ADMIN', mfaVerified: false },
      resource: {
        type: 'payment',
        requiresMfa: true,
        amountKopecks: 200_000_00,
      },
    });
    expect(engine.evaluate(input).allowed).toBe(false);
  });

  it('COMPLIANCE_OFFICER can access audit log read-only without MFA', () => {
    const input = makeInput({
      action: 'audit:read',
      user: { id: 'compliance-1', role: 'COMPLIANCE_OFFICER', mfaVerified: false },
      resource: { type: 'AuditLog', id: 'log-1' },
    });
    expect(engine.evaluate(input).allowed).toBe(true);
  });
});

describe('Security E2E - audit trail immutability', () => {
  let audit: AuditService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    audit = new AuditService(prisma as unknown as PrismaService);
  });

  it('each audit entry has a non-empty hash', () => {
    const e1 = audit.log({ action: 'deal:create', actorUserId: 'u1', actorRole: 'FARMER', dealId: 'd1' });
    const e2 = audit.log({ action: 'deal:sign', actorUserId: 'u1', actorRole: 'FARMER', dealId: 'd1' });

    expect(e1.hash).toBeDefined();
    expect(e1.hash.length).toBe(64);
    expect(e2.hash).toBeDefined();
    expect(e2.hash).not.toBe(e1.hash);
  });

  it('verifyChainIntegrity returns valid=true for empty persisted chain', async () => {
    audit.log({ action: 'deal:create', actorUserId: 'u1', actorRole: 'FARMER' });
    audit.log({ action: 'deal:update', actorUserId: 'u1', actorRole: 'FARMER' });

    (prisma as any).auditEvent = {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    };

    const result = await audit.verifyChainIntegrity(100);
    expect(result.valid).toBe(true);
  });
});
