import { describe, expect, it } from 'vitest';
import { getPlatformV7ActionServiceName } from '@/lib/platform-v7/action-service-map';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route service name alignment', () => {
  it('returns the mapped money service name for reserve actions', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        amountMinor: 100_000,
        currency: 'RUB',
        reason: 'Reserve request.',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Reserve boundary checked.',
    });

    expect(result.body.response).toMatchObject({
      actionId: 'money.request_reserve',
      serviceName: getPlatformV7ActionServiceName('money.request_reserve'),
    });
    expect(result.body.summary).toMatchObject({
      actionId: 'money.request_reserve',
      serviceName: 'money',
    });
  });

  it('returns the mapped trip service name for driver checkpoint actions', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'mark_trip_arrived',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'trip-1',
      entityType: 'trip',
      payload: {
        dealId: 'deal-1',
        tripId: 'trip-1',
        arrivedAt: '2026-05-07T10:00:00.000Z',
        geoPoint: { lat: 52.1, lon: 39.2 },
      },
      evidenceRefs: ['geo-1'],
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Trip checkpoint checked.',
    });

    expect(result.body.response).toMatchObject({
      actionId: 'driver.confirm_checkpoint',
      serviceName: getPlatformV7ActionServiceName('driver.confirm_checkpoint'),
    });
    expect(result.body.summary).toMatchObject({
      actionId: 'driver.confirm_checkpoint',
      serviceName: 'trip',
    });
  });
});
