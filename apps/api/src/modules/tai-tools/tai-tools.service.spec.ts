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
  };
}

describe('TaiToolsService', () => {
  it('returns a bounded server-authoritative deal summary', async () => {
    const gateway = { workspace: jest.fn().mockResolvedValue(workspace()) };
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
    const gateway = { workspace: jest.fn().mockResolvedValue(workspace()) };
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

  it('rejects a model-selected action that is not the current server action', async () => {
    const gateway = { workspace: jest.fn().mockResolvedValue(workspace()) };
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
