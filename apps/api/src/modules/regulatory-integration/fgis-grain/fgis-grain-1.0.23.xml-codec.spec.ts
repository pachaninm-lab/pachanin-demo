import { getFgisGrainBusinessOperation } from './fgis-grain-1.0.23.contract';
import {
  FGIS_GRAIN_MESSAGE_NAMESPACE,
  FGIS_GRAIN_SOAP_11_NAMESPACE,
  FGIS_GRAIN_SOAP_12_NAMESPACE,
  FGIS_GRAIN_XMLDSIG_NAMESPACE,
  FgisGrainXmlCodecError,
  buildUnsignedFgisGrainSoapEnvelope,
  decodeFgisGrainSoapEnvelope,
  mapDecodedFgisGrainInboundEnvelope,
} from './fgis-grain-1.0.23.xml-codec';
import { FgisGrainXmlCodecService } from './fgis-grain-xml-codec.service';

const MESSAGE_ID = 'f47ac10b-58cc-11cf-a447-001122334455';
const REFERENCE_MESSAGE_ID = 'd9428888-122b-11e1-b85c-61cd3cbb3210';
const MESSAGE_DATA_ID = 'message-data-1';

function splitClark(qName: string): { namespaceUri: string; localName: string } {
  const closing = qName.indexOf('}');
  if (!qName.startsWith('{') || closing < 2) throw new Error(`invalid QName ${qName}`);
  return {
    namespaceUri: qName.slice(1, closing),
    localName: qName.slice(closing + 1),
  };
}

function businessXml(qName: string, inner = ''): string {
  const name = splitClark(qName);
  return `<biz:${name.localName} xmlns:biz="${name.namespaceUri}">${inner}</biz:${name.localName}>`;
}

function responseEnvelope(): string {
  const operation = getFgisGrainBusinessOperation('GET_LIST_SDIZ');
  if (!operation) throw new Error('GET_LIST_SDIZ operation missing');
  const payload = businessXml(operation.responseQName, '<biz:items/>');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<soap:Envelope xmlns:soap="${FGIS_GRAIN_SOAP_11_NAMESPACE}" xmlns:tns="${FGIS_GRAIN_MESSAGE_NAMESPACE}">`,
    '<soap:Body>',
    '<tns:SendResponseResponse>',
    '<tns:ResponseCode>success</tns:ResponseCode>',
    `<tns:MessageData Id="${MESSAGE_DATA_ID}">`,
    `<tns:MessageID>${MESSAGE_ID}</tns:MessageID>`,
    `<tns:ReferenceMessageID>${REFERENCE_MESSAGE_ID}</tns:ReferenceMessageID>`,
    `<tns:MessagePrimaryContent>${payload}</tns:MessagePrimaryContent>`,
    '<tns:TestMessage>true</tns:TestMessage>',
    '</tns:MessageData>',
    `<tns:InformationSystemSignature><ds:Signature xmlns:ds="${FGIS_GRAIN_XMLDSIG_NAMESPACE}"/></tns:InformationSystemSignature>`,
    '</tns:SendResponseResponse>',
    '</soap:Body>',
    '</soap:Envelope>',
  ].join('');
}

function expectCodecError(
  action: () => unknown,
  expectedCode?: string,
): void {
  try {
    action();
    throw new Error('expected codec error');
  } catch (error) {
    expect(error).toBeInstanceOf(FgisGrainXmlCodecError);
    if (expectedCode) {
      expect((error as FgisGrainXmlCodecError).code).toBe(expectedCode);
    }
  }
}

describe('FGIS Grain API 1.0.23 hardened SOAP/XML codec', () => {
  it('builds deterministic unsigned SendRequest bytes and signing input', () => {
    const operation = getFgisGrainBusinessOperation('CREATE_SDIZ');
    if (!operation) throw new Error('CREATE_SDIZ operation missing');
    const input = {
      transportOperation: 'SendRequest' as const,
      businessOperationCode: 'CREATE_SDIZ' as const,
      businessPayloadXml: businessXml(operation.requestQName, '<biz:payload/>'),
      messageId: MESSAGE_ID,
      referenceMessageId: REFERENCE_MESSAGE_ID,
      messageDataId: MESSAGE_DATA_ID,
      testMessage: true,
    };
    const first = buildUnsignedFgisGrainSoapEnvelope(input);
    const second = buildUnsignedFgisGrainSoapEnvelope(input);

    expect(first.unsignedEnvelopeBytes.equals(second.unsignedEnvelopeBytes)).toBe(true);
    expect(first.unsignedEnvelopeSha256).toBe(second.unsignedEnvelopeSha256);
    expect(first.messageDataSha256).toBe(second.messageDataSha256);
    expect(first.signatureReferenceUri).toBe(`#${MESSAGE_DATA_ID}`);
    expect(first.policyStatus).toBe('EXTERNAL_SIGNER_POLICY_REQUIRED');
    expect(first.signatureInsertion.startByteOffset)
      .toBe(first.signatureInsertion.endByteOffset);
    expect(first.unsignedEnvelopeBytes.toString('utf8')).toContain(
      '<tns:InformationSystemSignature></tns:InformationSystemSignature>',
    );

    const decoded = decodeFgisGrainSoapEnvelope(first.unsignedEnvelopeBytes, {
      expectedTransportOperation: 'SendRequest',
      expectedBusinessOperationCode: 'CREATE_SDIZ',
    });
    expect(decoded).toEqual(expect.objectContaining({
      direction: 'OUTBOUND_REQUEST',
      transportOperation: 'SendRequest',
      businessOperationCode: 'CREATE_SDIZ',
      businessPayloadKind: 'REQUEST',
      messageId: MESSAGE_ID,
      referenceMessageId: REFERENCE_MESSAGE_ID,
      messageDataId: MESSAGE_DATA_ID,
      signaturePresent: true,
      testMessage: true,
      rawBodySha256: first.unsignedEnvelopeSha256,
    }));
  });

  it('decodes a signed logical SendResponse and maps it to the canonical inbox', () => {
    const xml = responseEnvelope();
    const decoded = decodeFgisGrainSoapEnvelope(xml, {
      expectedTransportOperation: 'SendResponse',
      expectedBusinessOperationCode: 'GET_LIST_SDIZ',
    });
    expect(decoded).toEqual(expect.objectContaining({
      direction: 'INBOUND_RESPONSE',
      transportOperation: 'SendResponse',
      responseCode: 'success',
      messageId: MESSAGE_ID,
      referenceMessageId: REFERENCE_MESSAGE_ID,
      messageDataId: MESSAGE_DATA_ID,
      testMessage: true,
      signaturePresent: true,
      businessOperationCode: 'GET_LIST_SDIZ',
      businessPayloadKind: 'RESPONSE',
    }));

    const inbox = mapDecodedFgisGrainInboundEnvelope(decoded, {
      occurredAt: '2026-07-24T12:00:00.000Z',
      signature: {
        algorithm: 'GOST-2012-256',
        keyReference: 'certificate-registry:fgis-zerno:test:1',
        keyVersion: '1',
        signatureVersion: 'XMLDSig-1',
        verificationPolicyVersion: 'fgis-zerno-1.0.23-signature.v1',
      },
    });
    expect(inbox).toEqual({
      provider: 'FGIS_ZERNO',
      externalEventId: MESSAGE_ID,
      schemaVersion: '1.0.23',
      mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
      occurredAt: '2026-07-24T12:00:00.000Z',
      rawBodySha256: decoded.rawBodySha256,
      signature: expect.objectContaining({ keyVersion: '1' }),
      correlationId: REFERENCE_MESSAGE_ID,
      causationId: REFERENCE_MESSAGE_ID,
    });
  });

  it('decodes the official ZernoFault QName without inventing provider state', () => {
    const fault = [
      `<soap:Envelope xmlns:soap="${FGIS_GRAIN_SOAP_11_NAMESPACE}">`,
      '<soap:Body><soap:Fault>',
      '<faultcode>soap:Server</faultcode>',
      '<faultstring>provider rejected message</faultstring>',
      '<detail>',
      '<z:ZernoFault xmlns:z="urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/faults/1.0.5">',
      '<z:Code>VALIDATION</z:Code>',
      '<z:Description>invalid SDIZ</z:Description>',
      '</z:ZernoFault>',
      '</detail>',
      '</soap:Fault></soap:Body></soap:Envelope>',
    ].join('');
    const decoded = decodeFgisGrainSoapEnvelope(fault, {
      expectedTransportOperation: 'SendRequest',
      expectedBusinessOperationCode: 'CREATE_SDIZ',
    });
    expect(decoded.direction).toBe('INBOUND_FAULT');
    expect(decoded.fault).toEqual(expect.objectContaining({
      soapFaultCode: 'soap:Server',
      soapFaultString: 'provider rejected message',
      code: 'VALIDATION',
      description: 'invalid SDIZ',
    }));
    expect(decoded.signaturePresent).toBe(false);
  });

  it('exposes the same governed functions through the Nest service', () => {
    const operation = getFgisGrainBusinessOperation('CREATE_SDIZ');
    if (!operation) throw new Error('CREATE_SDIZ operation missing');
    const service = new FgisGrainXmlCodecService();
    const built = service.buildUnsigned({
      transportOperation: 'SendRequest',
      businessOperationCode: 'CREATE_SDIZ',
      businessPayloadXml: businessXml(operation.requestQName),
      messageId: MESSAGE_ID,
      referenceMessageId: REFERENCE_MESSAGE_ID,
      messageDataId: MESSAGE_DATA_ID,
    });
    expect(service.decode(built.unsignedEnvelopeBytes).businessOperationCode)
      .toBe('CREATE_SDIZ');
  });

  const rejectedDocuments: ReadonlyArray<readonly [string, string | Uint8Array, string?]> = [
    [
      'DOCTYPE / XXE',
      `<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>`,
      'DTD_OR_DECLARATION_FORBIDDEN',
    ],
    [
      'processing instruction',
      `<?xml version="1.0"?><x><?target value?></x>`,
      'PROCESSING_INSTRUCTION_FORBIDDEN',
    ],
    [
      'SOAP 1.2',
      `<s:Envelope xmlns:s="${FGIS_GRAIN_SOAP_12_NAMESPACE}"><s:Body/></s:Envelope>`,
      'SOAP_11_ENVELOPE_REQUIRED',
    ],
    [
      'duplicate attributes',
      `<x a="1" a="2"/>`,
      'DUPLICATE_ATTRIBUTE',
    ],
    [
      'namespace shadowing',
      `<s:Envelope xmlns:s="${FGIS_GRAIN_SOAP_11_NAMESPACE}"><s:Body xmlns:s="urn:evil"/></s:Envelope>`,
      'NAMESPACE_REBINDING_FORBIDDEN',
    ],
    [
      'multiple roots',
      '<x/><y/>',
      'MULTIPLE_DOCUMENT_ROOTS',
    ],
    [
      'invalid UTF-8',
      Uint8Array.from([0xc3, 0x28]),
      'INVALID_UTF8',
    ],
    [
      'XInclude as transport payload',
      `<s:Envelope xmlns:s="${FGIS_GRAIN_SOAP_11_NAMESPACE}"><s:Body><xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///etc/passwd"/></s:Body></s:Envelope>`,
      'UNSUPPORTED_TRANSPORT_QNAME',
    ],
  ];

  it.each(rejectedDocuments)('rejects %s', (_name, xml, code) => {
    expectCodecError(() => decodeFgisGrainSoapEnvelope(xml), code);
  });

  it('rejects multiple SOAP Body and payload roots', () => {
    const multipleBodies = `<s:Envelope xmlns:s="${FGIS_GRAIN_SOAP_11_NAMESPACE}"><s:Body/><s:Body/></s:Envelope>`;
    expectCodecError(
      () => decodeFgisGrainSoapEnvelope(multipleBodies),
      'MULTIPLE_SOAP_BODY_ELEMENTS',
    );
    const multiplePayloads = `<s:Envelope xmlns:s="${FGIS_GRAIN_SOAP_11_NAMESPACE}"><s:Body><x/><y/></s:Body></s:Envelope>`;
    expectCodecError(
      () => decodeFgisGrainSoapEnvelope(multiplePayloads),
      'SINGLE_SOAP_PAYLOAD_REQUIRED',
    );
  });

  it('rejects duplicate XML IDs used by signature wrapping attacks', () => {
    const xml = responseEnvelope().replace(
      '<biz:items/>',
      `<biz:item Id="${MESSAGE_DATA_ID}"/>`,
    );
    expectCodecError(() => decodeFgisGrainSoapEnvelope(xml), 'DUPLICATE_XML_ID');
  });

  it('rejects signature blocks and transport wrappers inside caller payload', () => {
    const operation = getFgisGrainBusinessOperation('CREATE_SDIZ');
    if (!operation) throw new Error('CREATE_SDIZ operation missing');
    const payload = businessXml(
      operation.requestQName,
      `<ds:Signature xmlns:ds="${FGIS_GRAIN_XMLDSIG_NAMESPACE}"/>`,
    );
    expectCodecError(
      () => buildUnsignedFgisGrainSoapEnvelope({
        transportOperation: 'SendRequest',
        businessOperationCode: 'CREATE_SDIZ',
        businessPayloadXml: payload,
        messageId: MESSAGE_ID,
        referenceMessageId: REFERENCE_MESSAGE_ID,
        messageDataId: MESSAGE_DATA_ID,
      }),
      'CALLER_SIGNATURE_OR_TRANSPORT_WRAPPER_FORBIDDEN',
    );
  });

  it('rejects operation/QName mismatch, oversized XML and excessive depth', () => {
    const getList = getFgisGrainBusinessOperation('GET_LIST_SDIZ');
    if (!getList) throw new Error('GET_LIST_SDIZ operation missing');
    expectCodecError(
      () => buildUnsignedFgisGrainSoapEnvelope({
        transportOperation: 'SendRequest',
        businessOperationCode: 'CREATE_SDIZ',
        businessPayloadXml: businessXml(getList.requestQName),
        messageId: MESSAGE_ID,
        referenceMessageId: REFERENCE_MESSAGE_ID,
        messageDataId: MESSAGE_DATA_ID,
      }),
      'BUSINESS_PAYLOAD_QNAME_MISMATCH',
    );
    expectCodecError(
      () => decodeFgisGrainSoapEnvelope(new Uint8Array(2 * 1024 * 1024 + 1)),
      'XML_TOO_LARGE',
    );
    const nested = `${'<x>'.repeat(97)}${'</x>'.repeat(97)}`;
    expectCodecError(() => decodeFgisGrainSoapEnvelope(nested), 'XML_DEPTH_LIMIT_EXCEEDED');
  });
});
