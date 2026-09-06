import {
  MARKETING_SOCIAL_PUBLISH_EVENT_TYPE,
  assertMarketingSocialPublishPayload,
} from './marketing-outbox.contract';

const admission = {
  schemaVersion: 'marketing.publication-admission.v1',
  admissionId: 'mktadm.v1.0123456789abcdef0123456789abcdef',
};

describe('marketing durable publish envelope', () => {
  it('uses a new event version that cannot claim legacy raw-policy rows', () => {
    expect(MARKETING_SOCIAL_PUBLISH_EVENT_TYPE).toBe('MARKETING_SOCIAL_PUBLISH_V2');
  });

  it('extracts only a nested admission envelope for HMAC verification', () => {
    expect(assertMarketingSocialPublishPayload({
      schemaVersion: 'marketing.social-publish.v2',
      admission,
    })).toBe(admission);
  });

  it('rejects legacy raw-policy and malformed envelopes', () => {
    expect(() => assertMarketingSocialPublishPayload({
      schemaVersion: 'marketing.social-publish.v1',
      channel: 'TELEGRAM',
      text: 'raw policy bypass',
      policy: { classification: 'INFORMATIONAL' },
    })).toThrow(/schema is invalid/i);

    expect(() => assertMarketingSocialPublishPayload({
      schemaVersion: 'marketing.social-publish.v2',
      admission: 'not-an-object',
    })).toThrow(/schema is invalid/i);
  });
});
