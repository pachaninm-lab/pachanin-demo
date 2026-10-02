import { MarketingOutboxService } from './marketing-outbox.service';
import { MarketingPolicyService } from './marketing-policy.service';
import type { MarketingPublicationAdmissionCommand } from './marketing-publication-admission';

function command(
  overrides: Partial<MarketingPublicationAdmissionCommand> = {},
): MarketingPublicationAdmissionCommand {
  return {
    channel: 'TELEGRAM',
    text: 'Проверяемая публикация',
    idempotencyKey: 'legal-slot-1',
    editorialSlot: 0,
    policy: {
      classification: 'ADVERTISING',
      requiresEvidence: true,
      evidenceIds: ['legal-evidence-1'],
      requiresFreshness: false,
      riskClass: 'NONE',
      containsPersonalData: false,
      destinationRisk: 'CLEARED',
      isDirectMessage: false,
      advertising: {
        hasAdvertisingLabel: true,
        advertiserName: 'ООО «Прозрачная цена»',
        advertiserInn: '7707083893',
        erid: 'example-erid-from-ord',
        isPaidPlacement: false,
      },
    },
    ...overrides,
  };
}

describe('MarketingOutboxService admission boundary', () => {
  const originalOutbound = process.env.MARKETING_OUTBOUND_ENABLED;
  const validAdvertising = command().policy.advertising ?? {};

  beforeEach(() => {
    process.env.MARKETING_OUTBOUND_ENABLED = 'true';
  });

  afterEach(() => {
    if (originalOutbound === undefined) delete process.env.MARKETING_OUTBOUND_ENABLED;
    else process.env.MARKETING_OUTBOUND_ENABLED = originalOutbound;
    jest.restoreAllMocks();
  });

  it('delegates only non-authoritative caller input to PostgreSQL admission', async () => {
    const admission = {
      admitAndEnqueue: jest.fn().mockResolvedValue({
        entry: {
          id: 'outbox-1',
          type: 'MARKETING_SOCIAL_PUBLISH_V2',
          payload: {},
          status: 'PENDING',
          idempotencyKey: 'marketing:social-publish:v2:legal-slot-1',
          maxRetries: 6,
          retryCount: 0,
          createdAt: '2026-08-24T12:00:00.000Z',
        },
      }),
    };
    const service = new MarketingOutboxService(
      new MarketingPolicyService(),
      admission as never,
    );

    await expect(service.enqueue(command())).resolves.toMatchObject({ id: 'outbox-1' });
    expect(admission.admitAndEnqueue).toHaveBeenCalledWith(expect.not.objectContaining({
      history: expect.anything(),
      now: expect.anything(),
    }));
  });

  it('blocks invalid INN, ERID and evidence before reserving cadence', async () => {
    const admission = { admitAndEnqueue: jest.fn() };
    const service = new MarketingOutboxService(
      new MarketingPolicyService(),
      admission as never,
    );

    await expect(service.enqueue(command({
      policy: {
        ...command().policy,
        advertising: { ...validAdvertising, advertiserInn: '1234567890' },
      },
    }))).rejects.toThrow(/ADVERTISER_INN_INVALID/i);

    await expect(service.enqueue(command({
      policy: {
        ...command().policy,
        advertising: { ...validAdvertising, erid: 'bad erid' },
      },
    }))).rejects.toThrow(/ERID_MISSING/i);

    await expect(service.enqueue(command({
      policy: {
        ...command().policy,
        evidenceIds: [],
      },
    }))).rejects.toThrow(/UNSOURCED_FACTUAL_CONTENT/i);

    expect(admission.admitAndEnqueue).not.toHaveBeenCalled();
  });
});
