import { describe, expect, it } from 'vitest';
import { driverFieldView, executionContourFixtures, scanForbiddenExternalTerms, acceptBid, createLogisticsRequestFromDeal, submitLogisticsQuote, acceptLogisticsQuoteCreateTrip } from '@/lib/platform-v7/execution-contour';

const REQUIRED_VIEWPORTS = [320, 360, 375, 390, 393, 402, 414, 430, 480, 540, 768, 820, 834, 1024, 1280, 1366, 1440, 1536] as const;

const ROUTE_PROGRESS = {
  '/platform-v7/lots': true,
  '/platform-v7/buyer': true,
  '/platform-v7/seller': true,
  '/platform-v7/logistics/requests': true,
  '/platform-v7/logistics/trips': true,
  '/platform-v7/driver': true,
  '/platform-v7/elevator': true,
  '/platform-v7/lab': true,
  '/platform-v7/lots/[lotId]/bids': false,
  '/platform-v7/deals/[id]': false,
  '/platform-v7/bank/release-safety': false,
} as const;

describe('platform-v7 execution progress guard', () => {
  it('keeps route progress explicit instead of pretending the whole route map is done', () => {
    const done = Object.values(ROUTE_PROGRESS).filter(Boolean).length;
    const total = Object.values(ROUTE_PROGRESS).length;

    expect(done).toBe(8);
    expect(total).toBe(11);
    expect(Math.round((done / total) * 100)).toBe(73);
  });

  it('keeps required mobile viewport list fixed for the next Playwright gate', () => {
    expect(REQUIRED_VIEWPORTS).toEqual([320, 360, 375, 390, 393, 402, 414, 430, 480, 540, 768, 820, 834, 1024, 1280, 1366, 1440, 1536]);
  });

  it('keeps driver field output clear of bank, bid and investor surfaces', () => {
    const accepted = acceptBid({ lot: executionContourFixtures.lots[0], bids: executionContourFixtures.bids, bidId: 'BID-7002' });
    const request = createLogisticsRequestFromDeal(accepted.deal);
    const quote = submitLogisticsQuote({
      requestId: request.requestId,
      carrierId: 'cp-carrier-1',
      rateType: 'per_ton',
      rate: 2400,
      vehicleType: 'зерновоз',
      etaPickup: '2026-05-02T08:00:00.000Z',
      etaDelivery: '2026-05-03T09:00:00.000Z',
    });
    const { trip } = acceptLogisticsQuoteCreateTrip({ request, quote, driverId: 'driver-2041', vehicleId: 'truck-2041' });
    const payload = JSON.stringify(driverFieldView(trip)).toLowerCase();

    expect(payload).not.toContain('банк');
    expect(payload).not.toContain('ставк');
    expect(payload).not.toContain('инвестор');
    expect(payload).not.toContain('роль');
    expect(payload).not.toContain('цена');
    expect(payload).not.toContain('сумма');
  });

  it('keeps external copy scanner strict for technical residues', () => {
    expect(scanForbiddenExternalTerms('Центр управления · выпуск денег · причина остановки · следующее действие')).toEqual([]);
    expect(scanForbiddenExternalTerms('AI Control Tower callback release hold debug')).toEqual(['AI', 'Control Tower', 'callback', 'release', 'hold', 'debug']);
  });
});
