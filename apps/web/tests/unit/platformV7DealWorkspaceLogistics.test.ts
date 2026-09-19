import { describe, expect, it } from 'vitest';
import {
  platformV7DealLogisticsBadgeTone,
  platformV7DealLogisticsModel,
  type PlatformV7DealLogisticsTrip,
} from '@/lib/platform-v7/deal-workspace-logistics';

const acceptedTrip: PlatformV7DealLogisticsTrip = {
  id: 'TR-1',
  carrier: 'Перевозчик',
  driver: 'Водитель',
  vehicle: 'truck-1',
  status: 'accepted',
  eta: '2026-04-25T15:00:00.000Z',
  kmLeft: 0,
  blockers: [],
  ettnStatus: 'signed',
};

describe('platform-v7 deal workspace logistics', () => {
  it('marks missing trip as release blocker', () => {
    const model = platformV7DealLogisticsModel(null);

    expect(model.hasActiveTrip).toBe(false);
    expect(model.blocksRelease).toBe(true);
    expect(model.statusLabel).toBe('Нет активного рейса');
    expect(platformV7DealLogisticsBadgeTone(model)).toBe('danger');
  });

  it('marks accepted signed trip as release-ready', () => {
    const model = platformV7DealLogisticsModel(acceptedTrip);

    expect(model.hasActiveTrip).toBe(true);
    expect(model.blocksRelease).toBe(false);
    expect(model.blockers).toEqual([]);
    expect(platformV7DealLogisticsBadgeTone(model)).toBe('success');
  });

  it('adds missing ETTN blocker when transport docs are not signed', () => {
    const model = platformV7DealLogisticsModel({ ...acceptedTrip, ettnStatus: 'draft' });

    expect(model.blocksRelease).toBe(true);
    expect(model.blockers).toContain('missing-ettn');
    expect(platformV7DealLogisticsBadgeTone(model)).toBe('danger');
  });
});
