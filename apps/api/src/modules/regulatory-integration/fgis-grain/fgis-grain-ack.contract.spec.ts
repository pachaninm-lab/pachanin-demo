import {
  FGIS_GRAIN_ACK_PREPARATION_COMMAND_SCHEMA,
  computeFgisGrainAckAuthorityFingerprint,
  normalizeFgisGrainAckPreparationCommand,
  toFgisGrainAckDispatchPayload,
  type FgisGrainAckPreparationCommand,
} from './fgis-grain-ack.contract';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const ACK_MESSAGE_ID = '11111111-1111-1111-8111-111111111111';
const REFERENCE_MESSAGE_ID = '22222222-2222-1222-8222-222222222222';

function validCommand(
  overrides: Partial<FgisGrainAckPreparationCommand> = {},
): FgisGrainAckPreparationCommand {
  return {
    schemaVersion: FGIS_GRAIN_ACK_PREPARATION_COMMAND_SCHEMA,
    exchangeId: 'fgis-exchange-source-001',
    responseInboxEntryId: 'fgis-inbox-response-001',
    expectedExchangeVersion: '3',
    expectedInboxVersion: '7',
    commandId: 'fgis-ack-command-001',
    ackMessageId: ACK_MESSAGE_ID,
    referenceMessageId: REFERENCE_MESSAGE_ID,
    messageDataId: 'ack_message_data_001',
    unsignedEnvelopeReference: 'object-store://fgis/ack/unsigned-001.xml',
    unsignedEnvelopeSha256: HASH_A,
    unsignedEnvelopeSizeBytes: 512,
    messageDataSha256: HASH_B,
    sourceResponseFingerprint: HASH_A,
    providerConfigurationReference: 'config://fgis/provider-001',
    correlationId: 'fgis-correlation-001',
    causationId: 'fgis-inbox-response-001',
    idempotencyKey: 'fgis-ack-idempotency-001',
    reason: 'Acknowledge the verified and durably correlated FGIS response.',
    ...overrides,
  };
}

describe('FGIS Grain ACK authority contract', () => {
  it('normalizes only the exact governed command shape', () => {
    const normalized = normalizeFgisGrainAckPreparationCommand(validCommand());

    expect(normalized).toEqual(validCommand());
    expect(() => normalizeFgisGrainAckPreparationCommand({
      ...validCommand(),
      tenantId: 'client-selected-tenant',
    })).toThrow('ACK_PREPARATION_COMMAND_INVALID');
  });

  it('rejects malformed versions, UUIDs, hashes and references fail closed', () => {
    expect(() => normalizeFgisGrainAckPreparationCommand(validCommand({
      expectedExchangeVersion: '-1',
    }))).toThrow('ACK_PREPARATION_COMMAND_INVALID');
    expect(() => normalizeFgisGrainAckPreparationCommand(validCommand({
      ackMessageId: 'not-a-uuid',
    }))).toThrow('ACK_PREPARATION_COMMAND_INVALID');
    expect(() => normalizeFgisGrainAckPreparationCommand(validCommand({
      sourceResponseFingerprint: '0'.repeat(63),
    }))).toThrow('ACK_PREPARATION_COMMAND_INVALID');
    expect(() => normalizeFgisGrainAckPreparationCommand(validCommand({
      unsignedEnvelopeReference: 'https://provider.example/inline.xml',
    }))).toThrow('ACK_PREPARATION_COMMAND_INVALID');
  });

  it('derives the dispatch payload from server tenant/org context', () => {
    const command = normalizeFgisGrainAckPreparationCommand(validCommand());
    const payload = toFgisGrainAckDispatchPayload(
      command,
      'tenant-authority-001',
      'organization-authority-001',
    );

    expect(payload).toMatchObject({
      tenantId: 'tenant-authority-001',
      organizationId: 'organization-authority-001',
      transportOperation: 'Ack',
      businessOperationCode: null,
      messageId: ACK_MESSAGE_ID,
      referenceMessageId: REFERENCE_MESSAGE_ID,
      correlationId: command.correlationId,
      causationId: command.causationId,
    });
  });

  it('binds the fingerprint to source response authority and dispatch bytes', () => {
    const command = normalizeFgisGrainAckPreparationCommand(validCommand());
    const payload = toFgisGrainAckDispatchPayload(
      command,
      'tenant-authority-001',
      'organization-authority-001',
    );
    const first = computeFgisGrainAckAuthorityFingerprint(command, payload);
    const replay = computeFgisGrainAckAuthorityFingerprint(command, payload);
    const divergentCommand = normalizeFgisGrainAckPreparationCommand(validCommand({
      sourceResponseFingerprint: HASH_B,
    }));
    const divergent = computeFgisGrainAckAuthorityFingerprint(
      divergentCommand,
      toFgisGrainAckDispatchPayload(
        divergentCommand,
        'tenant-authority-001',
        'organization-authority-001',
      ),
    );

    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(replay).toBe(first);
    expect(divergent).not.toBe(first);
  });
});
