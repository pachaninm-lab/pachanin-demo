import { PrismaService } from '../../common/prisma/prisma.service';
import {
  GENERIC_INTEGRATION_ERROR_CODE,
  safeIntegrationErrorCode,
  summarizeIntegrationPayload,
  toSafeIntegrationEventView,
} from './integration-event-redaction.policy';
import { IntegrationEventsService } from './integration-events.service';

describe('integration event redaction policy', () => {
  it('summarizes an object without preserving its keys or values', () => {
    const summary = summarizeIntegrationPayload({
      sensitiveField: 'PRIVATE_MARKER_A',
      privateField: 'PRIVATE_MARKER_B',
      accountField: 'PRIVATE_MARKER_C',
    });

    expect(summary).toEqual({
      kind: 'OBJECT',
      fieldCount: 3,
      truncated: false,
    });
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('sensitiveField');
    expect(serialized).not.toContain('PRIVATE_MARKER_A');
    expect(serialized).not.toContain('privateField');
    expect(serialized).not.toContain('PRIVATE_MARKER_C');
  });

  it('summarizes scalar values without preserving the original scalar', () => {
    const stringSummary = summarizeIntegrationPayload('PRIVATE_MARKER');
    expect(stringSummary).toEqual({
      kind: 'STRING',
      length: 14,
      truncated: false,
    });
    expect(JSON.stringify(stringSummary)).not.toContain('PRIVATE_MARKER');

    expect(summarizeIntegrationPayload(42)).toEqual({ kind: 'NUMBER' });
    expect(summarizeIntegrationPayload(true)).toEqual({ kind: 'BOOLEAN' });
    expect(summarizeIntegrationPayload(null)).toEqual({ kind: 'NULL' });
    expect(summarizeIntegrationPayload(undefined)).toBeNull();
  });

  it('keeps a bounded machine error code but collapses free text to a generic code', () => {
    expect(safeIntegrationErrorCode('ONE_C_TIMEOUT')).toBe('ONE_C_TIMEOUT');
    expect(safeIntegrationErrorCode('HTTP_429')).toBe('HTTP_429');
    expect(
      safeIntegrationErrorCode('provider detail contained PRIVATE_MARKER_D'),
    ).toBe(GENERIC_INTEGRATION_ERROR_CODE);
    expect(safeIntegrationErrorCode(null)).toBeNull();
  });

  it('projects staff event metadata without payload or raw error text', () => {
    const view = toSafeIntegrationEventView({
      id: 'event-1',
      adapterName: 'DIADOC',
      direction: 'OUTBOUND',
      eventType: 'SEND_DOCUMENT',
      status: 'ERROR',
      httpStatus: 500,
      durationMs: 812,
      errorMessage: 'provider detail PRIVATE_MARKER_E',
      createdAt: new Date('2026-08-18T18:00:00Z'),
    });

    expect(view).toEqual({
      id: 'event-1',
      adapterName: 'DIADOC',
      direction: 'OUTBOUND',
      eventType: 'SEND_DOCUMENT',
      status: 'ERROR',
      httpStatus: 500,
      durationMs: 812,
      safeErrorCode: GENERIC_INTEGRATION_ERROR_CODE,
      createdAt: new Date('2026-08-18T18:00:00Z'),
    });
    expect(Object.keys(view).sort()).toEqual([
      'adapterName',
      'createdAt',
      'direction',
      'durationMs',
      'eventType',
      'httpStatus',
      'id',
      'safeErrorCode',
      'status',
    ]);
  });
});

describe('IntegrationEventsService redaction', () => {
  it('persists only structural request/response metadata and a safe error code', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      integrationEvent: {
        create,
      },
    } as unknown as PrismaService;
    const service = new IntegrationEventsService(prisma);

    await service.log({
      adapterName: 'ONE_C',
      direction: 'OUTBOUND',
      eventType: 'CREATE_SALES_DRAFT',
      requestPayload: {
        sensitiveField: 'PRIVATE_MARKER_F',
        privateField: 'PRIVATE_MARKER_G',
      },
      responsePayload: {
        privateField: 'PRIVATE_MARKER_H',
      },
      status: 'ERROR',
      errorMessage: 'provider detail PRIVATE_MARKER_I',
      httpStatus: 500,
    });

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.requestPayload).toEqual({
      kind: 'OBJECT',
      fieldCount: 2,
      truncated: false,
    });
    expect(data.responsePayload).toEqual({
      kind: 'OBJECT',
      fieldCount: 1,
      truncated: false,
    });
    expect(data.errorMessage).toBe(GENERIC_INTEGRATION_ERROR_CODE);

    const serialized = JSON.stringify(data);
    for (const forbidden of [
      'PRIVATE_MARKER_F',
      'PRIVATE_MARKER_G',
      'PRIVATE_MARKER_H',
      'PRIVATE_MARKER_I',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('withLogging rethrows the original failure while storing only a generic safe error', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      integrationEvent: {
        create,
      },
    } as unknown as PrismaService;
    const service = new IntegrationEventsService(prisma);
    const failure = new Error('provider detail PRIVATE_MARKER_J');

    await expect(
      service.withLogging(
        {
          adapterName: 'SABY',
          direction: 'OUTBOUND',
          eventType: 'SEND',
          requestPayload: { sensitiveField: 'PRIVATE_MARKER_K' },
        },
        async () => {
          throw failure;
        },
      ),
    ).rejects.toBe(failure);

    const data = create.mock.calls[0][0].data;
    expect(data.errorMessage).toBe(GENERIC_INTEGRATION_ERROR_CODE);
    expect(JSON.stringify(data)).not.toContain('PRIVATE_MARKER_J');
    expect(JSON.stringify(data)).not.toContain('PRIVATE_MARKER_K');
  });
});
