import {
  DocumentFreshness,
  type FreshnessAssessment,
} from '../auth/accounting-document-staleness.policy';
import { FormatDenyReason } from '../auth/document-format.policy';
import { IntegrationCapabilityMaturity } from '../../../../../packages/domain-core/src';
import {
  TransmissionRefusal,
  evaluateTransmission,
} from './document-transmission.policy';

const SIGNED = new Date('2026-08-16T10:00:00.000Z');

function freshness(
  state: DocumentFreshness = DocumentFreshness.CURRENT,
): FreshnessAssessment {
  return { freshness: state, staleSources: [], unverifiableSources: [] };
}

function send(overrides: Record<string, unknown> = {}) {
  return evaluateTransmission({
    signedAt: SIGNED,
    freshness: freshness(),
    formatAllowed: true,
    formatReasons: [],
    integrationMaturity: IntegrationCapabilityMaturity.LIVE_ACCEPTED,
    acceptedExternalId: null,
    ...overrides,
  } as Parameters<typeof evaluateTransmission>[0]);
}

describe('handing a document over', () => {
  it('permits a signed, current document in a live adapter', () => {
    expect(send()).toEqual({ permitted: true, refusals: [], formatReasons: [] });
  });

  it('refuses an unsigned version', () => {
    expect(send({ signedAt: null }).refusals).toContain(
      TransmissionRefusal.VERSION_NOT_SIGNED,
    );
  });

  it('separates stale from unverifiable', () => {
    // Not the same refusal, because they are not the same problem: stale means
    // the platform knows the figures moved, unverifiable means it cannot tell.
    expect(
      send({ freshness: freshness(DocumentFreshness.STALE) }).refusals,
    ).toContain(TransmissionRefusal.VERSION_STALE);

    expect(
      send({ freshness: freshness(DocumentFreshness.UNVERIFIABLE) }).refusals,
    ).toContain(TransmissionRefusal.VERSION_UNVERIFIABLE);
  });

  it('carries the format reasons through rather than flattening them', () => {
    const decision = send({
      formatAllowed: false,
      formatReasons: [FormatDenyReason.FORMAT_SUPERSEDED],
    });
    expect(decision.refusals).toContain(TransmissionRefusal.FORMAT_REFUSED);
    expect(decision.formatReasons).toEqual([FormatDenyReason.FORMAT_SUPERSEDED]);
  });

  it('refuses every adapter maturity short of confirmed live', () => {
    for (const maturity of [
      IntegrationCapabilityMaturity.DISCOVERED,
      IntegrationCapabilityMaturity.PUBLIC_SPEC_VERIFIED,
      IntegrationCapabilityMaturity.CONTRACT_MAPPED,
      IntegrationCapabilityMaturity.ADAPTER_IMPLEMENTED,
      IntegrationCapabilityMaturity.CONTRACT_TESTED,
      IntegrationCapabilityMaturity.EXTERNAL_ACCESS_PENDING,
      IntegrationCapabilityMaturity.CONTRACT_PENDING,
      IntegrationCapabilityMaturity.LIVE_TESTING,
      IntegrationCapabilityMaturity.DEGRADED,
      IntegrationCapabilityMaturity.SUSPENDED,
    ]) {
      expect(send({ integrationMaturity: maturity }).refusals).toContain(
        TransmissionRefusal.ADAPTER_NOT_LIVE,
      );
    }
  });

  it('refuses a second delivery and says only that', () => {
    // Sending again would put a second document with the same number in front
    // of the counterparty, which is what a numbered sequence exists to prevent.
    expect(send({ acceptedExternalId: 'edo-77', signedAt: null })).toEqual({
      permitted: false,
      refusals: [TransmissionRefusal.ALREADY_ACCEPTED],
      formatReasons: [],
    });
  });

  it('reports every blocker at once', () => {
    const decision = send({
      signedAt: null,
      freshness: freshness(DocumentFreshness.STALE),
      formatAllowed: false,
      formatReasons: [FormatDenyReason.NO_FORMAT_IN_FORCE],
      integrationMaturity: IntegrationCapabilityMaturity.LIVE_TESTING,
    });

    expect(decision.refusals).toEqual(
      expect.arrayContaining([
        TransmissionRefusal.VERSION_NOT_SIGNED,
        TransmissionRefusal.VERSION_STALE,
        TransmissionRefusal.FORMAT_REFUSED,
        TransmissionRefusal.ADAPTER_NOT_LIVE,
      ]),
    );
  });
});
