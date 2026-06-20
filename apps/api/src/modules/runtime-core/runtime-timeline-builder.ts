/**
 * RuntimeCore decomposition — Step 4: TimelineBuilder.
 *
 * Pure read-only projections — the synthetic deal timeline and the deal
 * passport — extracted verbatim from RuntimeCoreService. Stateless and
 * source-agnostic: each method takes the deal (and, for the passport, the
 * payment) passed in and returns a projection, so it can run over DB-sourced
 * objects later (scaling target) without a rewrite. The timeline is explicitly
 * *derived* from current status (not event-sourced) — same honest behavior as
 * before. Controlled-pilot / pre-integration.
 */

/** Ordered happy-path deal statuses used to derive the synthetic timeline. */
export const TIMELINE_STATUSES = [
  'DRAFT',
  'AWAITING_SIGN',
  'SIGNED',
  'PREPAYMENT_RESERVED',
  'LOADING',
  'IN_TRANSIT',
  'ARRIVED',
  'QUALITY_CHECK',
  'ACCEPTED',
  'FINAL_PAYMENT',
  'SETTLED',
  'CLOSED',
];

export interface TimelineEntry {
  status: string;
  label: string;
  timestamp: string;
  actor: string;
}

/** Stateless projection engine. Holds no state; safe to instantiate once and reuse. */
export class RuntimeTimelineBuilder {
  /**
   * Synthetic timeline derived from the deal's current status: one entry per
   * status up to the current one, with a +2h synthetic step between entries.
   */
  buildTimeline(deal: { status: string; createdAt: string; owner?: string | null }): TimelineEntry[] {
    const currentIdx = Math.max(TIMELINE_STATUSES.indexOf(deal.status), 0);
    return TIMELINE_STATUSES.slice(0, currentIdx + 1).map((status, idx) => ({
      status,
      label: status,
      timestamp: new Date(new Date(deal.createdAt).getTime() + idx * 2 * 60 * 60 * 1000).toISOString(),
      actor: idx === currentIdx ? (deal.owner as string) : 'system',
    }));
  }

  /** Read-only passport projection of a deal plus its payment money summary. */
  buildPassport(deal: any, payment: any) {
    return {
      id: deal.id,
      status: deal.status,
      parties: {
        seller: { orgId: deal.sellerOrgId },
        buyer: { orgId: deal.buyerOrgId },
      },
      metrics: {
        volumeTons: deal.volumeTons,
        pricePerTon: deal.pricePerTon,
        totalRub: deal.totalRub,
        currency: deal.currency,
      },
      lot: { id: deal.lotId, culture: deal.culture, region: deal.region },
      money: {
        status: payment.status,
        amountRub: payment.amountRub,
        disputedAmountRub: payment.disputedAmountRub,
        undisputedAmountRub: payment.undisputedAmountRub,
        bankEventId: payment.bankEventId,
      },
      dates: { createdAt: deal.createdAt, signedAt: deal.signedAt ?? null, updatedAt: deal.updatedAt ?? null },
    };
  }
}
