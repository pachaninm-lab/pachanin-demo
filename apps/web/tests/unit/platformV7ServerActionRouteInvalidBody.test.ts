import { describe, expect, it } from 'vitest';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route invalid body response', () => {
  it('does not mark incomplete route body as accepted for review', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'request_money_reserve',
      actorRole: 'buyer',
    });

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      ok: false,
      status: 'not_accepted',
      acceptedForReview: false,
      canClaimExecuted: false,
      persisted: false,
      attemptedRuntimeWrite: false,
    });
  });
});
