import { BadRequestException } from '@nestjs/common';
import { TaiDelegatedIdentity } from './tai-tool-assertion';
import { TaiToolsService } from './tai-tools.service';

const IDENTITY: TaiDelegatedIdentity = {
  userId: '55555555-5555-4555-8555-555555555555',
  tenantId: '33333333-3333-4333-8333-333333333333',
  sessionId: '22222222-2222-4222-8222-222222222222',
  traceId: '44444444-4444-4444-8444-444444444444',
  callId: 'call-1',
  toolName: 'getDealSummary',
  mode: 'READ_ONLY',
  idempotencyKey: 'tai.tool.request.0001',
};

function workspace() {
  return {
    deal: {
      id: 'deal-2408',
      status: 'ADMISSION_APPROVED',
      version: '7',
      updatedAt: '2026-07-19T02:00:00.000Z',
    },
    roleProjection: {
      role: 'BUYER',
      canAct: true,
      primaryAction: {
        id: 'sign_contract',
        label: 'Подписать договор',
        source: 'USER',
        enabled: true,
      },
    },
    attention: 'Требуется действие: Подписать договор',
    blockers: [],
    money: null,
    spine: [{ id: 'sign_contract', status: 'CURRENT' }],
    documents: [
      { id: 'doc-1', type: 'CONTRACT', version: 2, status: 'SIGNED' },
      { id: 'doc-2', type: 'WAYBILL', version: 1, status: 'PENDING' },
    ],
    shipments: [
      { id: 'ship-1', status: 'IN_TRANSIT', checkpoints: [{ id: 'cp-1' }] },
    ],
    laboratory: [{ id: 'sample-1', status: 'TESTED', tests: [{ id: 'test-1' }] }],
    acceptance: [{ id: 'acc-1', status: 'ACCEPTED' }],
    disputes: [
      { id: 'dis-1', status: 'OPEN' },
      { id: 'dis-2', status: 'RESOLVED' },
    ],
    bankOperations: [{ id: 'bank-1', status: 'SETTLED' }],
    timeline: [{ id: 'ev-1' }, { id: 'ev-2' }],
  };
}

function integrationStatus() {
  return {
    dealId: 'deal-2408',
    entries: [
      {
        id: 'obx-1',
        type: 'DEAL_CONFIRMED',
        status: 'SENT',
        retryCount: 0,
        maxRetries: 5,
        createdAt: '2026-07-19T02:00:00.000Z',
        sentAt: '2026-07-19T02:00:01.000Z',
        confirmedAt: null,
        failedAt: null,
        deadLetterAt: null,
        nextRetryAt: '2026-07-19T02:00:00.000Z',
      },
    ],
    returnedCount: 1,
    truncated: false,
    countsByStatus: { SENT: 1 },
    deadLetterCount: 0,
  };
}

function makeGateway(ws: unknown = workspace()) {
  return {
    workspace: jest.fn().mockResolvedValue(ws),
    integrationStatus: jest.fn().mockResolvedValue(integrationStatus()),
  };
}

const READ_ONLY_TOOLS = [
  'getDealSummary',
  'getRoleNextActions',
  'getDealRisks',
  'getDocumentStatus',
  'getLogisticsStatus',
  'getLaboratoryStatus',
  'getMoneyReadiness',
  'getDisputeStatus',
  'getEvidenceTimeline',
] as const;

describe('TaiToolsService', () => {
  it('returns a bounded server-authoritative deal summary', async () => {
    const gateway = makeGateway();
    const service = new TaiToolsService(gateway as any);

    const result = await service.execute(
      'getDealSummary',
      { arguments: { dealId: 'deal-2408' } },
      IDENTITY,
    );

    expect(gateway.workspace).toHaveBeenCalledWith(
      'deal-2408',
      expect.objectContaining({
        id: IDENTITY.userId,
        tenantId: IDENTITY.tenantId,
        role: 'GUEST',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        schemaVersion: 'platform.deal-summary.v1',
        deal: expect.objectContaining({ id: 'deal-2408' }),
        roleProjection: expect.objectContaining({ role: 'BUYER' }),
      }),
    );
  });

  it('creates a non-executing command draft bound to current workspace authority', async () => {
    const gateway = makeGateway();
    const service = new TaiToolsService(gateway as any);
    const identity: TaiDelegatedIdentity = {
      ...IDENTITY,
      toolName: 'prepareCommandDraft',
      mode: 'DRAFT',
    };

    const result = await service.execute(
      'prepareCommandDraft',
      {
        arguments: {
          dealId: 'deal-2408',
          actionId: 'sign_contract',
          payload: { documentId: 'doc-1' },
        },
      },
      identity,
    );

    expect(result).toEqual(
      expect.objectContaining({
        schemaVersion: 'platform.deal-command-draft.v1',
        dealId: 'deal-2408',
        actionId: 'sign_contract',
        method: 'POST',
        endpoint: '/deals/deal-2408/commands/sign_contract',
        expectedUpdatedAt: '2026-07-19T02:00:00.000Z',
        expectedVersion: '7',
        requiresExplicitUserConfirmation: true,
      }),
    );
  });

  describe.each(READ_ONLY_TOOLS)('%s', (toolName) => {
    it('reads only the workspace the caller is already entitled to', async () => {
      const gateway = makeGateway();
      const service = new TaiToolsService(gateway as any);

      await service.execute(toolName, { arguments: { dealId: 'deal-2408' } }, {
        ...IDENTITY,
        toolName,
      });

      expect(gateway.workspace).toHaveBeenCalledTimes(1);
      expect(gateway.workspace).toHaveBeenCalledWith(
        'deal-2408',
        expect.objectContaining({ id: IDENTITY.userId, tenantId: IDENTITY.tenantId }),
      );
    });

    it('refuses an undeclared argument', async () => {
      const gateway = makeGateway();
      const service = new TaiToolsService(gateway as any);

      await expect(
        service.execute(
          toolName,
          { arguments: { dealId: 'deal-2408', tenantId: 'tenant-9' } },
          { ...IDENTITY, toolName },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(gateway.workspace).not.toHaveBeenCalled();
    });

    it('requires a deal', async () => {
      const gateway = makeGateway();
      const service = new TaiToolsService(gateway as any);

      await expect(
        service.execute(toolName, { arguments: {} }, { ...IDENTITY, toolName }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getIntegrationStatus', () => {
    const identity = { ...IDENTITY, toolName: 'getIntegrationStatus' } as const;

    it('reads outbox state on the membership authority, not the workspace', async () => {
      const gateway = makeGateway();
      const service = new TaiToolsService(gateway as any);

      const result = await service.execute(
        'getIntegrationStatus',
        { arguments: { dealId: 'deal-2408' } },
        identity,
      );

      expect(gateway.integrationStatus).toHaveBeenCalledWith(
        'deal-2408',
        expect.objectContaining({ id: IDENTITY.userId, tenantId: IDENTITY.tenantId }),
      );
      expect(gateway.workspace).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          schemaVersion: 'platform.integration-status.v1',
          dealId: 'deal-2408',
          returnedCount: 1,
          truncated: false,
          deadLetterCount: 0,
          countsByStatus: { SENT: 1 },
        }),
      );
    });

    it('never relays payloads, failure text or lease identifiers', async () => {
      const gateway = makeGateway();
      const service = new TaiToolsService(gateway as any);

      const result = await service.execute(
        'getIntegrationStatus',
        { arguments: { dealId: 'deal-2408' } },
        identity,
      );

      const serialized = JSON.stringify(result);
      for (const forbidden of [
        'payload',
        'lastError',
        'leaseToken',
        'leaseOwner',
        'idempotencyKey',
        'triggeredByUserId',
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    });

    it('refuses an undeclared argument', async () => {
      const gateway = makeGateway();
      const service = new TaiToolsService(gateway as any);

      await expect(
        service.execute(
          'getIntegrationStatus',
          { arguments: { dealId: 'deal-2408', tenantId: 'tenant-9' } },
          identity,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(gateway.integrationStatus).not.toHaveBeenCalled();
    });

    it('requires a deal', async () => {
      const gateway = makeGateway();
      const service = new TaiToolsService(gateway as any);

      await expect(
        service.execute('getIntegrationStatus', { arguments: {} }, identity),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('reports risks from server-derived blockers and open disputes', async () => {
    const gateway = makeGateway();
    const service = new TaiToolsService(gateway as any);

    const result = await service.execute(
      'getDealRisks',
      { arguments: { dealId: 'deal-2408' } },
      { ...IDENTITY, toolName: 'getDealRisks' },
    );

    expect(result).toEqual(
      expect.objectContaining({
        schemaVersion: 'platform.deal-risks.v1',
        dealId: 'deal-2408',
        status: 'ADMISSION_APPROVED',
        blockers: [],
        openDisputeCount: 1,
      }),
    );
  });

  it('narrows a document collection to the named document', async () => {
    const gateway = makeGateway();
    const service = new TaiToolsService(gateway as any);

    const all = await service.execute(
      'getDocumentStatus',
      { arguments: { dealId: 'deal-2408' } },
      { ...IDENTITY, toolName: 'getDocumentStatus' },
    );
    const one = await service.execute(
      'getDocumentStatus',
      { arguments: { dealId: 'deal-2408', documentId: 'doc-2' } },
      { ...IDENTITY, toolName: 'getDocumentStatus' },
    );

    expect(all.documentCount).toBe(2);
    expect(one.documentCount).toBe(1);
    expect(one.documents).toEqual([
      expect.objectContaining({ id: 'doc-2', type: 'WAYBILL' }),
    ]);
  });

  it('returns an empty projection when the named entry is not in the deal', async () => {
    const gateway = makeGateway();
    const service = new TaiToolsService(gateway as any);

    const result = await service.execute(
      'getDocumentStatus',
      { arguments: { dealId: 'deal-2408', documentId: 'doc-from-another-deal' } },
      { ...IDENTITY, toolName: 'getDocumentStatus' },
    );

    expect(result.documents).toEqual([]);
    expect(result.documentCount).toBe(0);
  });

  it('separates open disputes from the full dispute history', async () => {
    const gateway = makeGateway();
    const service = new TaiToolsService(gateway as any);

    const result = await service.execute(
      'getDisputeStatus',
      { arguments: { dealId: 'deal-2408' } },
      { ...IDENTITY, toolName: 'getDisputeStatus' },
    );

    expect(result.disputeCount).toBe(2);
    expect(result.openDisputeCount).toBe(1);
  });

  it('bounds a long timeline and says so', async () => {
    const long = workspace();
    (long as any).timeline = Array.from({ length: 250 }, (_, index) => ({
      id: `ev-${index}`,
    }));
    const gateway = makeGateway(long);
    const service = new TaiToolsService(gateway as any);

    const result = await service.execute(
      'getEvidenceTimeline',
      { arguments: { dealId: 'deal-2408' } },
      { ...IDENTITY, toolName: 'getEvidenceTimeline' },
    );

    expect(result.eventCount).toBe(250);
    expect(result.returnedCount).toBe(100);
    expect(result.truncated).toBe(true);
    expect((result.events as { id: string }[])[99]).toEqual({ id: 'ev-249' });
  });

  it('treats an absent collection as empty rather than malformed', async () => {
    const sparse = workspace();
    delete (sparse as any).shipments;
    const gateway = makeGateway(sparse);
    const service = new TaiToolsService(gateway as any);

    const result = await service.execute(
      'getLogisticsStatus',
      { arguments: { dealId: 'deal-2408' } },
      { ...IDENTITY, toolName: 'getLogisticsStatus' },
    );

    expect(result.shipments).toEqual([]);
    expect(result.shipmentCount).toBe(0);
  });

  it('rejects a model-selected action that is not the current server action', async () => {
    const gateway = makeGateway();
    const service = new TaiToolsService(gateway as any);

    await expect(
      service.execute(
        'prepareCommandDraft',
        { arguments: { dealId: 'deal-2408', actionId: 'request_release' } },
        { ...IDENTITY, toolName: 'prepareCommandDraft', mode: 'DRAFT' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
