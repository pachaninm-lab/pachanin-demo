import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_REQUIRED_CASE_PACK_KINDS,
  platformV7CasePackReadiness,
  platformV7CreateCasePackItems,
  type PlatformV7CasePackItem,
} from '@/lib/platform-v7/case-pack';

describe('platform-v7 case pack readiness', () => {
  it('creates the required evidence case pack skeleton', () => {
    const items = platformV7CreateCasePackItems('deal-1');

    expect(items.map((item) => item.kind)).toEqual(PLATFORM_V7_REQUIRED_CASE_PACK_KINDS);
    expect(items.every((item) => item.status === 'missing')).toBe(true);
  });

  it('blocks money release while required evidence is missing', () => {
    const readiness = platformV7CasePackReadiness(platformV7CreateCasePackItems('deal-1'));

    expect(readiness.complete).toBe(false);
    expect(readiness.moneyReleaseBlocked).toBe(true);
    expect(readiness.missingKinds).toEqual(PLATFORM_V7_REQUIRED_CASE_PACK_KINDS);
  });

  it('marks pack complete when every required item is verified', () => {
    const items: PlatformV7CasePackItem[] = platformV7CreateCasePackItems('deal-1').map((item) => ({
      ...item,
      status: 'verified',
    }));

    const readiness = platformV7CasePackReadiness(items);

    expect(readiness.complete).toBe(true);
    expect(readiness.moneyReleaseBlocked).toBe(false);
    expect(readiness.verifiedCount).toBe(PLATFORM_V7_REQUIRED_CASE_PACK_KINDS.length);
  });

  it('requires enough verified proof before dispute pack is ready', () => {
    const items: PlatformV7CasePackItem[] = [
      { kind: 'loading_photo', itemId: '1', status: 'verified', blocksMoneyRelease: true, disputeRequired: true },
      { kind: 'seal_photo', itemId: '2', status: 'verified', blocksMoneyRelease: true, disputeRequired: true },
      { kind: 'gps_point', itemId: '3', status: 'verified', blocksMoneyRelease: true, disputeRequired: true },
    ];

    expect(platformV7CasePackReadiness(items).disputeReady).toBe(true);
  });

  it('keeps manual review items blocking completion', () => {
    const items: PlatformV7CasePackItem[] = platformV7CreateCasePackItems('deal-1').map((item) => ({
      ...item,
      status: item.kind === 'lab_protocol' ? 'manual_review' : 'verified',
    }));

    const readiness = platformV7CasePackReadiness(items);

    expect(readiness.complete).toBe(false);
    expect(readiness.moneyReleaseBlocked).toBe(true);
    expect(readiness.manualReviewKinds).toEqual(['lab_protocol']);
  });
});
