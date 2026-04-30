import { describe, expect, it } from 'vitest';
import {
  selectDealById,
  selectDisputeById,
  selectDisputesByDealId,
} from '@/lib/domain/selectors';

describe('platform-v7 deal dispute bank cross-consistency', () => {
  it('keeps disputed deal hold equal to the linked dispute hold amount', () => {
    const deal = selectDealById('DL-9102');
    const dispute = selectDisputeById('DK-2024-89');

    expect(deal?.id).toBe('DL-9102');
    expect(dispute?.dealId).toBe('DL-9102');
    expect(deal?.dispute?.id).toBe(dispute?.id);
    expect(deal?.holdAmount).toBe(dispute?.holdAmount);
  });

  it('keeps disputed deal blocked from release while dispute is open', () => {
    const deal = selectDealById('DL-9102');
    const dispute = selectDisputeById('DK-2024-89');

    expect(dispute?.status).toBe('open');
    expect(deal?.status).toBe('quality_disputed');
    expect(deal?.holdAmount).toBeGreaterThan(0);
    expect(deal?.releaseAmount ?? 0).toBe(0);
  });

  it('keeps dispute lookup consistent from deal id and dispute id', () => {
    const byDeal = selectDisputesByDealId('DL-9102');
    const byId = selectDisputeById('DK-2024-89');

    expect(byDeal).toHaveLength(1);
    expect(byDeal[0]?.id).toBe(byId?.id);
    expect(byDeal[0]?.holdAmount).toBe(byId?.holdAmount);
  });

  it('does not allow held disputed money to appear as ready-to-release money', () => {
    const deal = selectDealById('DL-9102');
    const dispute = selectDisputeById('DK-2024-89');

    expect(dispute?.status).toBe('open');
    expect(deal?.holdAmount).toBeGreaterThan(0);
    expect(deal?.status).not.toBe('release_requested');
    expect(deal?.status).not.toBe('release_approved');
    expect(deal?.status).not.toBe('closed');
  });
});
