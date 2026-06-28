/**
 * Security E2E Tests (ТЗ 15.2)
 * Покрывает сценарии №5, №6, №8 из критичных E2E сценариев:
 *   5. Unauthorized access — попытка доступа к чужой сделке → блокировка + audit log
 *   6. Money invariants — попытка double release → отклонение
 *   8. MFA enforcement — финансовая операция без MFA → требование подтверждения
 */

import { PolicyEngine, PolicyInput } from '../../common/security/policy-engine.service';
import { SettlementEngineService } from '../settlement-engine/settlement-engine.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../../common/outbox/outbox.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
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

// ── Сценарий 5: Unauthorized Access ──────────────────────────────────────────

describe('Security E2E №5 — Unauthorized access to another org deal', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  it('FARMER cannot read deal of another org (neither seller nor buyer)', () => {
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
    const result = engine.evaluate(input);
    expect(result.allowed).toBe(true);
  });

  it('ARBITRATOR cannot read deal they are not assigned to', () => {
    const input = makeInput({
      action: 'dispute:read',
      user: { id: 'user-arb', role: 'ARBITRATOR', organizationId: 'org-arb' },
      resource: { type: 'Dispute', id: 'dispute-1', assignedArbitratorId: 'user-other-arb' },
    });
    const result = engine.evaluate(input);
    expect(result.allowed).toBe(false);
  });

  it('ARBITRATOR can read dispute assigned to them', () => {
    const input = makeInput({
      action: 'dispute:read',
      user: { id: 'user-arb', role: 'ARBITRATOR', organizationId: 'org-arb' },
      resource: { type: 'Dispute', id: 'dispute-1', assignedArbitratorId: 'user-arb' },
    });
    const result = engine.evaluate(input);
    expect(result.allowed).toBe(true);
  });

  it('EXECUTIVE cannot modify any resource (read-only)', () => {
    const actions = ['deal:create', 'deal:update', 'payment:write'];
    for (const action of actions) {
      const input = makeInput({
        action,
        user: { id: 'user-exec', role: 'EXECUTIVE', organizationId: 'org-1' },
        resource: { type: 'Deal', id: 'deal-1' },
      });
      const result = engine.evaluate(input);
      expect(result.allowed).toBe(false);
    }
  });

  it('ADMIN can read any deal', () => {
    const input = makeInput({
      action: 'deal:read',
      user: { id: 'admin-1', role: 'ADMIN', organizationId: 'org-platform' },
      resource: { type: 'Deal', id: 'deal-foreign', sellerOrgId: 'org-x', buyerOrgId: 'org-y' },
    });
    const result = engine.evaluate(input);
    expect(result.allowed).toBe(true);
  });

  it('GUEST cannot access any deal', () => {
    const input = makeInput({
      action: 'deal:read',
      user: { id: 'guest-1', role: 'GUEST' },
      resource: { type: 'Deal', id: 'deal-1', sellerOrgId: 'org-1' },
    });
    const result = engine.evaluate(input);
    expect(result.allowed).toBe(false);
  });

  it('SUPPORT_MANAGER can view but cannot write financial data', () => {
    const writeInput = makeInput({
      action: 'payment:write',
      user: { id: 'support-1', role: 'SUPPORT_MANAGER', organizationId: 'org-platform' },
      resource: { type: 'Payment', id: 'pay-1' },
    });
    const result = engine.evaluate(writeInput);
    expect(result.allowed).toBe(false);
  });
});

// ── Сценарий 6: Money Invariants — Double Release ────────────────────────────

describe('Security E2E №6 — Money invariants: double release rejected', () => {
  let settlement: SettlementEngineService;
  let prisma: ReturnType<typeof makePrisma>;
  let audit: AuditService;
  let outbox: OutboxService;

  beforeEach(() => {
    prisma = makePrisma();
    audit = new AuditService(prisma as unknown as PrismaService);
    outbox = new OutboxService(prisma as unknown as PrismaService);
    settlement = new SettlementEngineService(
      prisma as unknown as PrismaService,
      audit,
      outbox,
    );
  });

  it('second release attempt on same deal is rejected (idempotency key)', async () => {
    // First release
    const deal = {
      id: 'deal-1',
      status: 'QUALITY_ACCEPTED',
      totalAmountKopecks: 1_000_000_00, // 1 млн ₽
      commissionKopecks: 10_000_00,
      buyerOrgId: 'org-buyer',
      sellerOrgId: 'org-seller',
    };

    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null); // no existing payment
    (prisma.deal.findUnique as jest.Mock).mockResolvedValue(deal);

    // First release should succeed
    const first = await settlement.releasePayment('deal-1', {
      actorId: 'admin-1',
      actorRole: 'ADMIN',
    }).catch(e => ({ error: e.message }));

    // Second release — same deal — should fail (idempotency)
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
      id: 'pay-existing',
      dealId: 'deal-1',
      type: 'RELEASE',
      status: 'COMPLETED',
    });

    const second = await settlement.releasePayment('deal-1', {
      actorId: 'admin-1',
      actorRole: 'ADMIN',
    }).catch(e => ({ error: e.message }));

    // Either first fails gracefully OR second is rejected
    // The key invariant: both cannot succeed simultaneously
    expect(second).toHaveProperty('error');
  });
});

// ── Сценарий 8: MFA Enforcement ───────────────────────────────────────────────

describe('Security E2E №8 — MFA enforcement on financial operations', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  it('financial write without MFA is denied when amount > 100 000 ₽', () => {
    const input = makeInput({
      action: 'payment:write',
      user: { id: 'user-1', role: 'FARMER', organizationId: 'org-1', mfaVerified: false },
      resource: {
        type: 'Payment',
        id: 'pay-1',
        requiresMfa: true,
        amountKopecks: 150_000_00, // 150 000 ₽ > 100 000 ₽ threshold
      },
    });
    const result = engine.evaluate(input);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some(r => r.toLowerCase().includes('mfa'))).toBe(true);
  });

  it('financial write with MFA verified is allowed for deal participant', () => {
    const input = makeInput({
      action: 'payment:write',
      user: { id: 'user-buyer', role: 'BUYER', organizationId: 'org-buyer', mfaVerified: true },
      resource: {
        type: 'Payment',
        id: 'pay-1',
        buyerOrgId: 'org-buyer',
        requiresMfa: true,
        amountKopecks: 150_000_00,
      },
    });
    const result = engine.evaluate(input);
    expect(result.allowed).toBe(true);
  });

  it('small payment without MFA is allowed (below threshold)', () => {
    const input = makeInput({
      action: 'payment:write',
      user: { id: 'user-buyer', role: 'BUYER', organizationId: 'org-buyer', mfaVerified: false },
      resource: {
        type: 'Payment',
        id: 'pay-small',
        buyerOrgId: 'org-buyer',
        amountKopecks: 50_000_00, // 50 000 ₽ < threshold
      },
    });
    const result = engine.evaluate(input);
    expect(result.allowed).toBe(true);
  });

  it('ADMIN role without MFA cannot perform high-value financial write', () => {
    const input = makeInput({
      action: 'payment:write',
      user: { id: 'admin-1', role: 'ADMIN', mfaVerified: false },
      resource: {
        type: 'Payment',
        requiresMfa: true,
        amountKopecks: 200_000_00, // 200 000 ₽
      },
    });
    const result = engine.evaluate(input);
    // ADMIN без MFA при requiresMfa должен быть заблокирован
    expect(result.allowed).toBe(false);
  });

  it('COMPLIANCE_OFFICER can access audit log without MFA (read-only, no threshold)', () => {
    const input = makeInput({
      action: 'audit:read',
      user: { id: 'compliance-1', role: 'COMPLIANCE_OFFICER', mfaVerified: false },
      resource: { type: 'AuditLog', id: 'log-1' },
    });
    const result = engine.evaluate(input);
    expect(result.allowed).toBe(true);
  });
});

// ── Audit Trail verification ───────────────────────────────────────────────────

describe('Security E2E — Audit trail immutability (hash chain)', () => {
  let audit: AuditService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    (prisma.auditEvent.create as jest.Mock).mockResolvedValue({});
    audit = new AuditService(prisma as unknown as PrismaService);
  });

  it('each audit entry has a non-empty hash', () => {
    const e1 = audit.log({ action: 'deal:create', actorUserId: 'u1', actorRole: 'FARMER', dealId: 'd1' });
    const e2 = audit.log({ action: 'deal:sign', actorUserId: 'u1', actorRole: 'FARMER', dealId: 'd1' });

    expect(e1.hash).toBeDefined();
    expect(e1.hash!.length).toBe(64); // SHA-256 hex
    expect(e2.hash).toBeDefined();
    expect(e2.hash).not.toBe(e1.hash); // different hashes
  });

  it('verifyChainIntegrity returns valid=true for in-memory entries', async () => {
    audit.log({ action: 'deal:create', actorUserId: 'u1', actorRole: 'FARMER' });
    audit.log({ action: 'deal:update', actorUserId: 'u1', actorRole: 'FARMER' });

    // Mock Prisma to return empty (chain verify uses in-memory in test)
    (prisma as any).auditEvent = {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    };

    const result = await audit.verifyChainIntegrity(100);
    expect(result.valid).toBe(true);
  });
});
