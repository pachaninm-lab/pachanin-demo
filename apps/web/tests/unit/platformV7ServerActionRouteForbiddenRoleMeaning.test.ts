import { describe, expect, it } from 'vitest';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route forbidden role response meaning', () => {
  it('marks forbidden role responses as not accepted without execution claims', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'confirm_money_released',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        amountMinor: 100_000,
        currency: 'RUB',
        bankReferenceId: 'BANK-REF-1',
        confirmedAt: '2026-05-07T10:00:00.000Z',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Release boundary checked.',
    });

    expect(result).toMatchObject({
      ok: false,
      status: 403,
      httpMeaning: 'not_accepted',
      body: {
        httpMeaning: 'not_accepted',
        response: {
          status: 'not_accepted',
          canClaimExecuted: false,
          persisted: false,
          attemptedRuntimeWrite: false,
        },
      },
    });
  });
});
