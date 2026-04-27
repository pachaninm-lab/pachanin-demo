import { describe, expect, it } from 'vitest';
import { buildStableDisputeEvidencePack, STABLE_DK_2024_89_EVIDENCE } from '@/lib/v7r/evidence-pack';

describe('platform-v7 evidence pack stable adapter', () => {
  it('builds ready evidence pack for DK-2024-89', () => {
    const pack = buildStableDisputeEvidencePack('DK-2024-89');

    expect(pack.disputeId).toBe('DK-2024-89');
    expect(pack.dealId).toBe('DL-9102');
    expect(pack.items).toHaveLength(4);
    expect(pack.readiness).toMatchObject({
      status: 'ready_for_review',
      total: 4,
      requiredTotal: 3,
      requiredReady: 3,
      score: 100,
      issues: [],
    });
  });

  it('uses pilot signature marker rather than УКЭП claim', () => {
    const signedItem = STABLE_DK_2024_89_EVIDENCE.find((item) => item.trust === 'signed');

    expect(signedItem?.signedBy).toBe('pilot-signature:lab.supervisor');
    expect(signedItem?.signedBy).not.toContain('УКЭП');
  });

  it('returns honest empty incomplete pack for unknown dispute', () => {
    const pack = buildStableDisputeEvidencePack('DK-UNKNOWN');

    expect(pack.dealId).toBeNull();
    expect(pack.items).toEqual([]);
    expect(pack.readiness.status).toBe('incomplete');
    expect(pack.readiness.score).toBe(0);
  });
});
