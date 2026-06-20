import { buildSettlementSnapshot } from './settlement-calculation';

/**
 * CHARACTERIZATION tests — lock the CURRENT behavior of the float-rouble
 * settlement math before the kopecks migration (PR-B). These pin observable
 * outputs as they are today, including known weak spots (round2 float rounding).
 * They do NOT assert what the behavior *should* be — only what it *is*. Any PR-B
 * change that shifts these values must do so deliberately and update this file.
 *
 * Deterministic inputs: explicit paymentTerms override env so results do not
 * depend on environment variables.
 */

const BASE_TERMS = {
  logisticsRatePerShipment: 92000,
  platformFeePercent: 0.6,
  disputeHoldPercent: 18,
  prepaymentPercent: 5,
  expectedShipments: 1,
};

describe('settlement-calculation — characterization (current float behavior)', () => {
  describe('reserve amount calculation', () => {
    it('reservePlanned = baseAmount * prepaymentPercent (5%)', () => {
      const s = buildSettlementSnapshot(
        { price: 10000, volumeTons: 100, shipments: [], disputes: [], labSamples: [], paymentTerms: BASE_TERMS },
        BASE_TERMS,
      );
      expect(s.baseAmount).toBe(1000000);
      expect(s.reservePercent).toBe(5);
      expect(s.reservePlanned).toBe(50000);
    });
  });

  describe('funding / release target (no dispute, no lab)', () => {
    it('pins logistics, platform fee and funding target', () => {
      const s = buildSettlementSnapshot(
        { price: 10000, volumeTons: 100, shipments: [], disputes: [], labSamples: [], paymentTerms: BASE_TERMS },
        BASE_TERMS,
      );
      expect(s.logisticsAmount).toBe(92000);
      expect(s.idleAmount).toBe(0);
      expect(s.qualityDelta).toBe(0);
      expect(s.platformFee).toBe(-6000);
      expect(s.netFundingTarget).toBe(902000);
      expect(s.fundingTarget).toBe(902000);
      expect(s.releaseCandidate).toBe(902000);
    });
  });

  describe('dispute hold impact', () => {
    it('open dispute applies an 18% hold and lowers the release candidate', () => {
      const s = buildSettlementSnapshot(
        { price: 10000, volumeTons: 100, shipments: [], disputes: [{ status: 'OPEN' }], labSamples: [], paymentTerms: BASE_TERMS },
        BASE_TERMS,
      );
      expect(s.hasOpenDispute).toBe(true);
      expect(s.disputeHoldPercent).toBe(18);
      expect(s.disputeHold).toBe(180000);
      expect(s.releaseCandidate).toBe(722000); // 902000 − 180000
    });

    it('a DECISION-status dispute is NOT treated as open (current rule)', () => {
      const s = buildSettlementSnapshot(
        { price: 10000, volumeTons: 100, shipments: [], disputes: [{ status: 'DECISION' }], labSamples: [], paymentTerms: BASE_TERMS },
        BASE_TERMS,
      );
      expect(s.hasOpenDispute).toBe(false);
      expect(s.disputeHold).toBe(0);
    });
  });

  describe('quality delta', () => {
    it('a completed lab test priceDelta flows into qualityDelta and net target', () => {
      const s = buildSettlementSnapshot(
        {
          price: 10000,
          volumeTons: 100,
          shipments: [],
          disputes: [],
          labSamples: [{ tests: [{ status: 'COMPLETED', priceDelta: -50000 }] }],
          paymentTerms: BASE_TERMS,
        },
        BASE_TERMS,
      );
      expect(s.qualityDelta).toBe(-50000);
      expect(s.netFundingTarget).toBe(852000); // 1000000 − 50000 − 92000 − 6000
    });
  });

  describe('round2 rounding behavior (current float)', () => {
    it('rounds half-up to two decimals via Math.round(x*100)/100', () => {
      const up = buildSettlementSnapshot(
        { price: 1234.567, volumeTons: 1, shipments: [], disputes: [], labSamples: [], paymentTerms: BASE_TERMS },
        BASE_TERMS,
      );
      expect(up.baseAmount).toBe(1234.57); // .567 → .57

      const down = buildSettlementSnapshot(
        { price: 1234.564, volumeTons: 1, shipments: [], disputes: [], labSamples: [], paymentTerms: BASE_TERMS },
        BASE_TERMS,
      );
      expect(down.baseAmount).toBe(1234.56); // .564 → .56
    });
  });
});
