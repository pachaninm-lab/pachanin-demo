import {
  FGIS_GRAIN_ACK_COMMAND_SCHEMA,
  FGIS_GRAIN_ACK_POLICY,
  FGIS_GRAIN_ACK_POLICY_VERSION,
  FgisGrainAckAuthorityError,
  buildFgisGrainAckDispatchPayload,
  normalizeGenerateFgisGrainAckCommand,
} from './fgis-grain-ack.contract';

const MESSAGE_ID = 'f47ac10b-58cc-11cf-a447-001122334455';

function command(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: FGIS_GRAIN_ACK_COMMAND_SCHEMA,
    inboxEntryId: 'inbox-entry-ack-001',
    expectedInboxVersion: '3',
    inboundTransportOperation: 'SendRequest',
    inboundMessageId: MESSAGE_ID,
    inboundReferenceMessageId: null,
    inboundResponseCode: 'accepted',
    verifiedPayloadFingerprint: 'a'.repeat(64),
    ackEnvelopeReference: 'object-store://fgis/ack/001.xml',
    ackEnvelopeSha256: 'b'.repeat(64),
    ackEnvelopeSizeBytes: 256,
    ackMessageDataId: 'ack-message-data-001',
    providerConfigurationReference: 'config://fgis-provider-001',
    correlationId: 'correlation.ack.001',
    causationId: 'causation.ack.001',
    idempotencyKey: 'ack.001',
    reason: 'Проверенное входящее сообщение требует детерминированного исходящего ACK',
    ...overrides,
  };
}

describe('PC-CROP-08I ACK contract authority', () => {
  it('pins the official package/catalog and deterministic policy hash', () => {
    expect(FGIS_GRAIN_ACK_POLICY).toEqual(expect.objectContaining({
      policyVersion: FGIS_GRAIN_ACK_POLICY_VERSION,
      packageSha256: '085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7',
      catalogSha256: '4fc7cc075b956f0adca26331a99627d07cde77d63ec2fc017d0cbbc5f701c87a',
      policyHash: '113c1937f42f7746fc0bbedd58378586ca6e7678393dd1db471768c4f2e3f05c',
      eligibleInboundTransportOperations: ['SendRequest', 'SendResponse'],
      ineligibleInboundTransportOperations: ['Ack'],
      operationalStatus: 'NOT_ATTESTED',
    }));
  });

  it('accepts an exact eligible ACK command and builds the canonical dispatch payload', () => {
    const normalized = normalizeGenerateFgisGrainAckCommand(command());
    expect(buildFgisGrainAckDispatchPayload({
      tenantId: 'tenant-ack-001',
      organizationId: 'org-ack-001',
      commandId: 'fgis-ack-command-001',
      messageId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
      referenceMessageId: normalized.inboundMessageId,
      envelopeReference: normalized.ackEnvelopeReference!,
      envelopeSha256: normalized.ackEnvelopeSha256!,
      envelopeSizeBytes: normalized.ackEnvelopeSizeBytes!,
      messageDataId: normalized.ackMessageDataId!,
      providerConfigurationReference: normalized.providerConfigurationReference!,
      correlationId: normalized.correlationId,
      causationId: normalized.causationId,
    })).toEqual(expect.objectContaining({
      transportOperation: 'Ack',
      businessOperationCode: null,
      referenceMessageId: MESSAGE_ID,
      adapterCode: 'FGIS_ZERNO',
      apiVersion: '1.0.23',
    }));
  });

  it('forbids ACK dispatch material for ACK-of-ACK and queue-empty decisions', () => {
    for (const input of [
      command({ inboundTransportOperation: 'Ack' }),
      command({ inboundResponseCode: 'queue-is-empty' }),
    ]) {
      expect(() => normalizeGenerateFgisGrainAckCommand(input)).toThrow(
        /ACK_ENVELOPE_FORBIDDEN/u,
      );
    }
  });

  it('accepts an explicit not-required decision only without dispatch material', () => {
    expect(normalizeGenerateFgisGrainAckCommand(command({
      inboundTransportOperation: 'Ack',
      inboundResponseCode: 'success',
      ackEnvelopeReference: null,
      ackEnvelopeSha256: null,
      ackEnvelopeSizeBytes: null,
      ackMessageDataId: null,
      providerConfigurationReference: null,
    }))).toEqual(expect.objectContaining({
      inboundTransportOperation: 'Ack',
      ackEnvelopeReference: null,
    }));
  });

  it('rejects unsupported fields, non-v1 message identity and missing eligible envelope', () => {
    const invalid = [
      command({ role: 'ADMIN' }),
      command({ inboundMessageId: 'not-a-uuid' }),
      command({ ackEnvelopeReference: null }),
      command({ verifiedPayloadFingerprint: 'a'.repeat(63) }),
    ];
    for (const input of invalid) {
      expect(() => normalizeGenerateFgisGrainAckCommand(input)).toThrow(FgisGrainAckAuthorityError);
    }
  });
});
