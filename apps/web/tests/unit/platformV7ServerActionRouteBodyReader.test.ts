import { describe, expect, it } from 'vitest';
import {
  buildPlatformV7ServerActionInputFromRouteBody,
  readPlatformV7RouteDocumentId,
  readPlatformV7RouteExternalConfirmationReady,
  readPlatformV7RouteRiskSnapshotFromBody,
  readPlatformV7RouteTripId,
} from '@/lib/platform-v7/server-action-route-body-reader';

describe('platform-v7 server action route body reader', () => {
  it('rejects route body without required action identity fields', () => {
    expect(
      buildPlatformV7ServerActionInputFromRouteBody({
        boundaryId: 'upload_document',
        actorId: 'seller-1',
        actorRole: 'seller',
      }),
    ).toBeUndefined();
  });

  it('builds execution input with safe defaults and typed scalar fields', () => {
    const input = buildPlatformV7ServerActionInputFromRouteBody({
      boundaryId: 'upload_document',
      actorId: 'seller-1',
      actorRole: 'seller',
      entityId: 'deal-1',
      entityType: 'deal',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      evidenceRefs: ['evidence-1', '', 123],
      payload: { documentId: 'doc-1' },
    });

    expect(input).toMatchObject({
      boundaryId: 'upload_document',
      actorId: 'seller-1',
      actorRole: 'seller',
      entityId: 'deal-1',
      entityType: 'deal',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      occurredAt: new Date(0).toISOString(),
      summary: 'Platform-v7 action boundary checked.',
      evidenceRefs: ['evidence-1'],
      payload: { documentId: 'doc-1' },
    });
  });

  it('prefers top-level route fields over payload fallbacks for entity ids', () => {
    const body = {
      documentId: 'doc-top',
      tripId: 'trip-top',
      payload: { documentId: 'doc-payload', tripId: 'trip-payload' },
    };
    const payload = body.payload;

    expect(readPlatformV7RouteDocumentId(body, payload)).toBe('doc-top');
    expect(readPlatformV7RouteTripId(body, payload)).toBe('trip-top');
  });

  it('uses payload fallback when top-level route fields are absent', () => {
    const body = { payload: { documentId: 'doc-payload', tripId: 'trip-payload', externalConfirmationReady: true } };
    const payload = body.payload;

    expect(readPlatformV7RouteDocumentId(body, payload)).toBe('doc-payload');
    expect(readPlatformV7RouteTripId(body, payload)).toBe('trip-payload');
    expect(readPlatformV7RouteExternalConfirmationReady(body, payload)).toBe(true);
  });

  it('reads risk snapshot only when status is valid', () => {
    expect(
      readPlatformV7RouteRiskSnapshotFromBody(
        { riskSnapshot: { status: 'clear', score: 92, source: 'manual' } },
        {},
      ),
    ).toEqual({ status: 'clear', score: 92, source: 'manual' });

    expect(
      readPlatformV7RouteRiskSnapshotFromBody({ riskSnapshot: { status: 'bad', score: 92 } }, {}),
    ).toBeUndefined();
  });
});
