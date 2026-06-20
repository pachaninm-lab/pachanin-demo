import { RuntimeCoreService } from './runtime-core.service';

/**
 * CHARACTERIZATION tests — lock the CURRENT behavior of the RuntimeCore money
 * flow before the kopecks migration (PR-B). They pin what the runtime does
 * today, including known weak spots (non-idempotent repeated release/callback),
 * and assert the external `*Rub` contract shape that PR-B must preserve. These
 * describe behavior as-is, not as-it-should-be. PR-B must change them
 * deliberately, never incidentally.
 */

const USER = { id: 'user-test', sub: 'user-test', orgId: 'org-farmer-1', role: 'ADMIN' };

function svc() {
  return new RuntimeCoreService();
}

/** Builds a fresh deal with no blockers (docs generated, sample finalized, no shipment). */
function releaseReadyDeal(s: RuntimeCoreService): string {
  const deal = s.createDeal({ lotId: 'LOT-CHAR', buyerOrgId: 'org-buyer-1' }, USER);
  s.generateDealPackage(deal.id, USER); // 4 required docs, status GENERATED → completeness complete
  const sample = s.createSample({ dealId: deal.id }, USER);
  s.collectSample(sample.id, USER);
  s.finalizeSample(sample.id, USER); // sample FINALIZED → quality blocker cleared
  return deal.id;
}

describe('RuntimeCore money flow — characterization (current behavior)', () => {
  describe('1. reserve', () => {
    it('reservePrepayment sets RESERVE_PENDING and does NOT auto-confirm', () => {
      const s = svc();
      const result = s.reservePrepayment('DEAL-003', USER);
      expect(result.status).toBe('RESERVE_PENDING');
      expect(result).toHaveProperty('requestedAt');
      expect(result).toHaveProperty('bankEventId');
      expect(s.dealWorkspace('DEAL-003').payment.status).toBe('RESERVE_PENDING');
    });
  });

  describe('2. release allowed / blocked', () => {
    it('release is BLOCKED when gates are not cleared (DEAL-003)', () => {
      const s = svc();
      const result = s.releasePayment('DEAL-003', USER) as any;
      expect(result.released).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
      expect(result.payment.status).toBe('MANUAL_REVIEW');
    });

    it('release is ALLOWED when there are no blockers', () => {
      const s = svc();
      const dealId = releaseReadyDeal(s);
      const result = s.releasePayment(dealId, USER) as any;
      expect(result.released).toBe(true);
      expect(result.payment.status).toBe('RELEASED');
      expect(result.payment.releaseJournal).toHaveLength(1);
      expect(result.payment.releaseJournal[0].action).toBe('FINAL_RELEASE');
    });
  });

  describe('3. dispute hold impact (runtime)', () => {
    it('a deal in DISPUTE_OPEN holds the payment with reason "Открыт спор"', () => {
      const s = svc();
      const deal = s.createDeal({ lotId: 'LOT-D', buyerOrgId: 'org-buyer-1' }, USER);
      s.transitionDeal(deal.id, 'AWAITING_SIGN', USER);
      s.transitionDeal(deal.id, 'SIGNED', USER);
      s.transitionDeal(deal.id, 'DISPUTE_OPEN', USER);
      const ws = s.dealWorkspace(deal.id);
      expect(ws.payment.status).toBe('HOLD_ACTIVE');
      expect(ws.payment.holdReason).toBe('Открыт спор');
    });

    it('seeded DEAL-001 carries a quality-driven disputed amount of 250000', () => {
      const s = svc();
      const impact = s.worksheet('DEAL-001').moneyImpact;
      expect(impact.disputedAmountRub).toBe(250000);
      expect(impact.undisputedAmountRub).toBe(6125000);
    });
  });

  describe('4. partial release (current shape)', () => {
    it('release sets releasedRub to the full amount — there is no partial-amount path', () => {
      const s = svc();
      const dealId = releaseReadyDeal(s);
      const before = s.dealWorkspace(dealId).payment;
      const result = s.releasePayment(dealId, USER) as any;
      // releasedRub is assigned the whole amount (here 0 for a freshly created deal),
      // not a partial figure; PARTIAL_RELEASE_* statuses exist but are not driven here.
      expect(result.payment.releasedRub).toBe(before.amountRub);
      expect(result.payment.status).toBe('RELEASED');
    });
  });

  describe('5. quality delta from lab tests', () => {
    it('each failed test subtracts 125000 from sample.moneyDeltaRub', () => {
      const s = svc();
      const deal = s.createDeal({ lotId: 'LOT-Q', buyerOrgId: 'org-buyer-1' }, USER);
      const sample = s.createSample({ dealId: deal.id }, USER);
      s.collectSample(sample.id, USER);
      const first = s.recordTest(sample.id, { metric: 'moisture', value: 15, passed: false }, USER);
      expect(first.sample.moneyDeltaRub).toBe(-125000);
      const second = s.recordTest(sample.id, { metric: 'protein', value: 9, passed: false }, USER);
      expect(second.sample.moneyDeltaRub).toBe(-250000);
    });
  });

  describe('6. repeated callback / repeated release (current — NOT idempotent)', () => {
    it('repeated release_confirmed callbacks are appended (no dedup); releasedRub is assigned, not summed', () => {
      const s = svc();
      const payload = { dealId: 'DEAL-001', eventType: 'release_confirmed', status: 'SUCCESS' };
      s.registerSafeDealsCallback(payload);
      const second = s.registerSafeDealsCallback(payload);
      // releasedRub equals the amount once (assignment), not doubled
      expect(second.payment.releasedRub).toBe(6375000);
      // both callbacks are retained — there is no idempotency key
      expect(s.bankWorkspace('DEAL-001').callbacks).toHaveLength(2);
    });

    it('a second immediate releasePayment is blocked by the callback-pending state set by the first', () => {
      const s = svc();
      const dealId = releaseReadyDeal(s);
      const first = s.releasePayment(dealId, USER) as any;
      expect(first.released).toBe(true);
      // first release sets callbackState=PENDING, which the second call sees as a blocker
      const secondResult = s.releasePayment(dealId, USER) as any;
      expect(secondResult.released).toBe(false);
      expect(secondResult.payment.status).toBe('MANUAL_REVIEW');
      expect(secondResult.blockers.some((b: string) => b.includes('callback'))).toBe(true);
    });
  });

  describe('7. rounding — disputed/undisputed split from quality delta', () => {
    it('disputed = max(0, -moneyDelta), undisputed = amount - disputed (seeded DEAL-001)', () => {
      const s = svc();
      const ws = s.dealWorkspace('DEAL-001');
      expect(ws.payment.disputedAmountRub).toBe(250000); // -(-250000)
      expect(ws.payment.undisputedAmountRub).toBe(6375000 - 250000);
    });
  });

  describe('8. external *Rub contract shape (must survive PR-B)', () => {
    it('moneyImpact exposes rouble-named money fields', () => {
      const s = svc();
      const impact = s.worksheet('DEAL-001').moneyImpact;
      expect(Object.keys(impact).sort()).toEqual(
        ['amountRub', 'bankEventId', 'disputedAmountRub', 'qualityDeltaRub', 'undisputedAmountRub'].sort(),
      );
      expect(impact.amountRub).toBe(6375000);
      expect(impact.qualityDeltaRub).toBe(-250000);
    });

    it('worksheet.payment and dealPassport.money use *Rub naming', () => {
      const s = svc();
      const payment = s.worksheet('DEAL-001').payment;
      for (const key of ['amountRub', 'reservedRub', 'releasedRub', 'disputedAmountRub', 'undisputedAmountRub']) {
        expect(payment).toHaveProperty(key);
      }
      const money = s.dealPassport('DEAL-001').money;
      expect(Object.keys(money).sort()).toEqual(
        ['amountRub', 'bankEventId', 'disputedAmountRub', 'status', 'undisputedAmountRub'].sort(),
      );
    });
  });
});
