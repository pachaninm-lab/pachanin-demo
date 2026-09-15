import { MarketingPolicyService } from './marketing-policy.service';
import { MarketingPublicationAdmissionService } from './marketing-publication-admission';
import { MarketingPublisherService } from './marketing-publisher.service';

const SECRET = '0123456789abcdef0123456789abcdef';

function buildPublisher() {
  const admission = new MarketingPublicationAdmissionService({} as never);
  const telegram = {
    publish: jest.fn().mockResolvedValue({
      externalId: 'tg-1',
      publishedAt: '2026-08-24T12:00:00.000Z',
    }),
  };
  const vk = { publish: jest.fn() };
  const publisher = new MarketingPublisherService(
    new MarketingPolicyService(),
    admission,
    telegram as never,
    vk as never,
  );
  return { admission, telegram, vk, publisher };
}

function admitted(
  admission: MarketingPublicationAdmissionService,
  issuedAt = new Date(),
) {
  return admission.createAdmission({
    issuedAt,
    outboxIdempotencyKey: 'marketing:social-publish:v2:post-1',
    request: {
      channel: 'TELEGRAM',
      text: 'Проверяемая публикация',
      idempotencyKey: 'post-1',
      policy: {
        classification: 'INFORMATIONAL',
        requiresEvidence: true,
        evidenceIds: ['source-1'],
        requiresFreshness: false,
        riskClass: 'NONE',
        containsPersonalData: false,
        destinationRisk: 'CLEARED',
        isDirectMessage: false,
      },
    },
    cadence: {
      allowed: true,
      reason: 'ALLOW',
      channel: 'TELEGRAM',
      audience: 'FARMER',
      angle: 'PROCESS',
      editorialPillar: 'USEFUL',
      editorialSlot: 0,
      operatingDay: '2026-08-24',
      channelSequence: 1,
    },
  });
}

describe('MarketingPublisherService admission verification', () => {
  const originalSecret = process.env.MARKETING_PUBLICATION_ADMISSION_HMAC_SECRET;
  const originalOutbound = process.env.MARKETING_OUTBOUND_ENABLED;

  beforeEach(() => {
    process.env.MARKETING_PUBLICATION_ADMISSION_HMAC_SECRET = SECRET;
    process.env.MARKETING_OUTBOUND_ENABLED = 'true';
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.MARKETING_PUBLICATION_ADMISSION_HMAC_SECRET;
    else process.env.MARKETING_PUBLICATION_ADMISSION_HMAC_SECRET = originalSecret;
    if (originalOutbound === undefined) delete process.env.MARKETING_OUTBOUND_ENABLED;
    else process.env.MARKETING_OUTBOUND_ENABLED = originalOutbound;
    jest.restoreAllMocks();
  });

  it('rejects a forged admission before connector invocation', async () => {
    const { admission, publisher, telegram, vk } = buildPublisher();
    const envelope = admitted(admission);

    await expect(publisher.publish({
      ...envelope,
      contentSha256: '0'.repeat(64),
    }, 'marketing:social-publish:v2:post-1')).rejects.toThrow(/HMAC is invalid/i);

    expect(telegram.publish).not.toHaveBeenCalled();
    expect(vk.publish).not.toHaveBeenCalled();
  });

  it('rejects expired admission before connector invocation', async () => {
    const { admission, publisher, telegram } = buildPublisher();
    const envelope = admitted(admission, new Date(Date.now() - 20 * 60 * 1_000));

    await expect(publisher.publish(
      envelope,
      'marketing:social-publish:v2:post-1',
    )).rejects.toThrow(/expired/i);

    expect(telegram.publish).not.toHaveBeenCalled();
  });

  it('rejects wrong outbox idempotency binding before connector invocation', async () => {
    const { admission, publisher, telegram } = buildPublisher();
    const envelope = admitted(admission);

    await expect(publisher.publish(
      envelope,
      'marketing:social-publish:v2:other-row',
    )).rejects.toThrow(/idempotency binding/i);

    expect(telegram.publish).not.toHaveBeenCalled();
  });

  it('publishes only after admission and live policy verification', async () => {
    const { admission, publisher, telegram, vk } = buildPublisher();
    const envelope = admitted(admission);

    await expect(publisher.publish(
      envelope,
      'marketing:social-publish:v2:post-1',
    )).resolves.toMatchObject({ channel: 'TELEGRAM', externalId: 'tg-1' });

    expect(telegram.publish).toHaveBeenCalledWith('Проверяемая публикация');
    expect(vk.publish).not.toHaveBeenCalled();
  });
});
