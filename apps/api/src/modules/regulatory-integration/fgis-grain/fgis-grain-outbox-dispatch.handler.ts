import { createHash } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ClaimedOutboxEntry,
  DurableOutboxWorker,
} from '../../integration-events/durable-outbox.worker';
import {
  FGIS_GRAIN_OUTBOX_EVENT_TYPE,
  FGIS_GRAIN_SIGNING_POLICY_VERSION,
  FgisGrainCanonicalizationPort,
  FgisGrainDispatchError,
  FgisGrainImmutablePayloadStorePort,
  FgisGrainProviderConfigurationPort,
  FgisGrainSignedEnvelopeAssemblerPort,
  FgisGrainSigningProviderPort,
  FgisGrainSoapTransportPort,
  assertFgisGrainDispatchPayload,
  assertFgisGrainProviderConfiguration,
  type FgisGrainAssemblyResult,
  type FgisGrainCanonicalizationResult,
  type FgisGrainSigningResult,
  type FgisGrainStoredXmlObject,
  type FgisGrainTransportResult,
} from './fgis-grain-1.0.23.dispatch.contract';
import { decodeGovernedFgisGrainSoapEnvelope } from './fgis-grain-1.0.23.xml-policy';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_REFERENCE_PATTERN =
  /^(?:object-store|policy|signing-key|credential|tls|config|kms|vault):\/\/[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$/u;

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function permanent(code: ConstructorParameters<typeof FgisGrainDispatchError>[0], message: string): never {
  throw new FgisGrainDispatchError(code, message, false);
}

function transient(code: ConstructorParameters<typeof FgisGrainDispatchError>[0], message: string): never {
  throw new FgisGrainDispatchError(code, message, true);
}

function assertReference(value: string, field: string): void {
  if (!SAFE_REFERENCE_PATTERN.test(value)) {
    permanent('PAYLOAD_INTEGRITY_MISMATCH', `${field} is not an approved reference`);
  }
}

function assertHash(value: string, field: string): void {
  if (!SHA256_PATTERN.test(value)) {
    permanent('PAYLOAD_INTEGRITY_MISMATCH', `${field} is not SHA-256`);
  }
}

function assertStoredObject(
  stored: FgisGrainStoredXmlObject,
  expectedReference: string,
  expectedSha256: string,
  expectedSizeBytes: number,
): void {
  assertReference(stored.objectReference, 'stored.objectReference');
  assertHash(stored.sha256, 'stored.sha256');
  if (
    stored.objectReference !== expectedReference
    || stored.sha256 !== expectedSha256
    || stored.sizeBytes !== expectedSizeBytes
    || stored.mediaType !== 'application/xml'
    || stored.immutable !== true
    || stored.encryptedAtRest !== true
    || stored.bytes.byteLength !== expectedSizeBytes
    || sha256(stored.bytes) !== expectedSha256
  ) {
    permanent('PAYLOAD_INTEGRITY_MISMATCH', 'Immutable unsigned envelope does not match outbox authority');
  }
}

function assertCanonicalizationResult(
  result: FgisGrainCanonicalizationResult,
): void {
  assertReference(result.canonicalizedObjectReference, 'canonicalizedObjectReference');
  assertHash(result.canonicalizedSha256, 'canonicalizedSha256');
  if (
    result.canonicalizedSizeBytes < 1
    || result.policyVersion !== FGIS_GRAIN_SIGNING_POLICY_VERSION
    || !result.canonicalizationAlgorithm
    || !result.transformAlgorithm
  ) {
    permanent('POLICY_NOT_ATTESTED', 'Canonicalization result is not bound to accepted policy');
  }
}

function assertSigningResult(result: FgisGrainSigningResult): void {
  assertReference(result.signatureObjectReference, 'signatureObjectReference');
  assertReference(result.signerCertificateReference, 'signerCertificateReference');
  assertHash(result.signatureSha256, 'signatureSha256');
  if (
    result.signatureSizeBytes < 1
    || result.signingPolicyVersion !== FGIS_GRAIN_SIGNING_POLICY_VERSION
    || !result.signatureAlgorithm
    || !result.digestAlgorithm
  ) {
    permanent('POLICY_NOT_ATTESTED', 'Signing result is not bound to accepted policy');
  }
}

function assertAssemblyResult(
  result: FgisGrainAssemblyResult,
  messageDataId: string,
): void {
  assertReference(result.signedEnvelopeReference, 'signedEnvelopeReference');
  assertHash(result.signedEnvelopeSha256, 'signedEnvelopeSha256');
  if (
    result.signedEnvelopeSizeBytes < 1
    || result.signatureReferenceUri !== `#${messageDataId}`
  ) {
    permanent('PAYLOAD_INTEGRITY_MISMATCH', 'Signed envelope assembly result is invalid');
  }
}

function assertTransportAccepted(result: FgisGrainTransportResult): void {
  if (result.durationMs < 0 || !Number.isFinite(result.durationMs)) {
    permanent('TRANSPORT_RESPONSE_UNSUPPORTED', 'Transport duration is invalid');
  }
  if (
    result.delivered !== true
    || result.faultCode !== null
    || !['success', 'accepted'].includes(result.responseCode ?? '')
  ) {
    if (result.retryable) {
      transient('TRANSPORT_REJECTED', 'Provider transport did not accept the envelope');
    }
    permanent('TRANSPORT_REJECTED', 'Provider transport rejected the envelope');
  }
  if (result.responseBodySha256 !== null) {
    assertHash(result.responseBodySha256, 'responseBodySha256');
  }
}

@Injectable()
export class FgisGrainOutboxDispatchHandler implements OnModuleInit {
  constructor(
    private readonly worker: DurableOutboxWorker,
    private readonly configurationPort: FgisGrainProviderConfigurationPort,
    private readonly payloadStorePort: FgisGrainImmutablePayloadStorePort,
    private readonly canonicalizationPort: FgisGrainCanonicalizationPort,
    private readonly signingProviderPort: FgisGrainSigningProviderPort,
    private readonly assemblerPort: FgisGrainSignedEnvelopeAssemblerPort,
    private readonly transportPort: FgisGrainSoapTransportPort,
  ) {}

  onModuleInit(): void {
    this.worker.registerHandler(
      FGIS_GRAIN_OUTBOX_EVENT_TYPE,
      (entry) => this.dispatch(entry),
    );
  }

  async dispatch(entry: ClaimedOutboxEntry): Promise<void> {
    const payload = assertFgisGrainDispatchPayload(entry.payload);
    if (
      entry.type !== FGIS_GRAIN_OUTBOX_EVENT_TYPE
      || entry.correlationId !== payload.correlationId
      || entry.idempotencyKey.trim().length < 3
    ) {
      permanent('MALFORMED_DISPATCH_PAYLOAD', 'Outbox row authority does not match payload');
    }

    const rawConfiguration = await this.configurationPort.resolve(
      payload.providerConfigurationReference,
    );
    const configuration = assertFgisGrainProviderConfiguration(rawConfiguration);
    if (configuration.signingPolicyVersion !== payload.signingPolicyVersion) {
      permanent('SIGNING_POLICY_MISMATCH', 'Configuration and payload policy versions differ');
    }

    const stored = await this.payloadStorePort.load(
      payload.unsignedEnvelopeReference,
    );
    assertStoredObject(
      stored,
      payload.unsignedEnvelopeReference,
      payload.unsignedEnvelopeSha256,
      payload.unsignedEnvelopeSizeBytes,
    );

    const decoded = decodeGovernedFgisGrainSoapEnvelope(stored.bytes, {
      expectedTransportOperation: payload.transportOperation,
      expectedBusinessOperationCode: payload.businessOperationCode ?? undefined,
    });
    if (
      decoded.direction !== 'OUTBOUND_REQUEST'
      || decoded.rawBodySha256 !== payload.unsignedEnvelopeSha256
      || decoded.messageId !== payload.messageId
      || decoded.referenceMessageId !== payload.referenceMessageId
      || decoded.messageDataId !== payload.messageDataId
      || decoded.businessOperationCode !== payload.businessOperationCode
      || decoded.messageDataXml === null
    ) {
      permanent('PAYLOAD_INTEGRITY_MISMATCH', 'Decoded unsigned envelope does not match dispatch payload');
    }
    const messageDataBytes = Buffer.from(decoded.messageDataXml, 'utf8');
    if (sha256(messageDataBytes) !== payload.messageDataSha256) {
      permanent('PAYLOAD_INTEGRITY_MISMATCH', 'MessageData SHA-256 mismatch');
    }

    const canonicalized = await this.canonicalizationPort.canonicalize({
      sourceObjectReference: payload.unsignedEnvelopeReference,
      messageDataBytes,
      messageDataSha256: payload.messageDataSha256,
      signingPolicyVersion: payload.signingPolicyVersion,
    });
    assertCanonicalizationResult(canonicalized);

    const signature = await this.signingProviderPort.sign({
      canonicalizedObjectReference: canonicalized.canonicalizedObjectReference,
      canonicalizedSha256: canonicalized.canonicalizedSha256,
      signingKeyReference: configuration.signingKeyReference,
      credentialReference: configuration.credentialReference,
      signingPolicyVersion: payload.signingPolicyVersion,
    });
    assertSigningResult(signature);

    const signedEnvelope = await this.assemblerPort.assemble({
      unsignedEnvelopeReference: payload.unsignedEnvelopeReference,
      unsignedEnvelopeSha256: payload.unsignedEnvelopeSha256,
      signatureObjectReference: signature.signatureObjectReference,
      signatureSha256: signature.signatureSha256,
      signatureInsertionStartByteOffset: 0,
      signatureInsertionEndByteOffset: 0,
    });
    assertAssemblyResult(signedEnvelope, payload.messageDataId);

    const transportResult = await this.transportPort.send({
      adapterCode: payload.adapterCode,
      environment: configuration.environment,
      endpointReference: configuration.endpointReference,
      tlsPolicyReference: configuration.tlsPolicyReference,
      credentialReference: configuration.credentialReference,
      signedEnvelopeReference: signedEnvelope.signedEnvelopeReference,
      signedEnvelopeSha256: signedEnvelope.signedEnvelopeSha256,
      signedEnvelopeSizeBytes: signedEnvelope.signedEnvelopeSizeBytes,
      transportOperation: payload.transportOperation,
      messageId: payload.messageId,
      correlationId: payload.correlationId,
      idempotencyKey: entry.idempotencyKey,
    });
    assertTransportAccepted(transportResult);
  }
}
