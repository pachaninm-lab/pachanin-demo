import { describe, expect, it } from 'vitest';
import { buildDisputeEvidenceOperationalProjection } from '@/lib/v7r/evidence-operational-projection';

describe('platform-v7 evidence operational projection', () => {
  it('links ready evidence pack to deal timeline and action log', () => {
    const projection = buildDisputeEvidenceOperationalProjection('DK-2024-89');

    expect(projection.disputeId).toBe('DK-2024-89');
    expect(projection.dealId).toBe('DL-9102');
    expect(projection.evidenceScore).toBe('100%');
    expect(projection.evidenceBlockers).toEqual([]);
    expect(projection.summary.evidenceObjects).toBe(4);
    expect(projection.summary.actionLogEntries).toBe(1);
    expect(projection.timeline.some((event) => event.actor === 'Evidence runtime')).toBe(true);
    expect(projection.operatorActionLog[0]).toMatchObject({
      scope: 'dispute',
      status: 'success',
      objectId: 'DK-2024-89',
      action: 'evidence-readiness-check',
    });
  });

  it('creates blocked projection for unknown dispute evidence pack', () => {
    const projection = buildDisputeEvidenceOperationalProjection('DK-UNKNOWN');

    expect(projection.dealId).toBeNull();
    expect(projection.evidenceScore).toBe('0%');
    expect(projection.evidenceBlockers.length).toBeGreaterThan(0);
    expect(projection.summary.evidenceObjects).toBe(0);
    expect(projection.operatorActionLog[0]).toMatchObject({
      scope: 'dispute',
      status: 'error',
      objectId: 'DK-UNKNOWN',
      action: 'evidence-readiness-check',
    });
  });
});
