import { describe, expect, it } from 'vitest';
import {
  selectRuntimeCallbacks,
  selectRuntimeDealByLotId,
  selectRuntimeDeals,
  selectRuntimeNotificationGroups,
  selectRuntimeNotifications,
  selectRuntimeRfqs,
} from '@/lib/domain/selectors';

describe('runtime selector helpers', () => {
  it('exposes runtime deal list through selector facade', () => {
    expect(selectRuntimeDeals().length).toBeGreaterThan(0);
  });

  it('finds linked deal by lot id without direct data import', () => {
    expect(selectRuntimeDealByLotId('LOT-2403')?.lotId).toBe('LOT-2403');
  });

  it('exposes RFQ list through selector facade', () => {
    expect(selectRuntimeRfqs().length).toBeGreaterThan(0);
  });

  it('exposes bank callbacks through selector facade', () => {
    expect(selectRuntimeCallbacks().length).toBeGreaterThan(0);
  });

  it('exposes notification data through selector facade', () => {
    expect(selectRuntimeNotifications().length).toBeGreaterThan(0);
    expect(selectRuntimeNotificationGroups().length).toBeGreaterThan(0);
  });
});
