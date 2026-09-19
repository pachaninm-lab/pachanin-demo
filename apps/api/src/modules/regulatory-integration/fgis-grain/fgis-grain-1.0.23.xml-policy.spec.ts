import { getFgisGrainBusinessOperation } from './fgis-grain-1.0.23.contract';
import { FgisGrainXmlCodecError } from './fgis-grain-1.0.23.xml-codec';
import {
  FGIS_GRAIN_XINCLUDE_NAMESPACE,
  buildGovernedUnsignedFgisGrainSoapEnvelope,
} from './fgis-grain-1.0.23.xml-policy';

const MESSAGE_ID = 'f47ac10b-58cc-11cf-a447-001122334455';
const REFERENCE_MESSAGE_ID = 'd9428888-122b-11e1-b85c-61cd3cbb3210';

function createSdizPayload(inner: string): string {
  const operation = getFgisGrainBusinessOperation('CREATE_SDIZ');
  if (!operation) throw new Error('CREATE_SDIZ operation missing');
  const closing = operation.requestQName.indexOf('}');
  const namespaceUri = operation.requestQName.slice(1, closing);
  const localName = operation.requestQName.slice(closing + 1);
  return `<biz:${localName} xmlns:biz="${namespaceUri}">${inner}</biz:${localName}>`;
}

function build(payload: string): void {
  buildGovernedUnsignedFgisGrainSoapEnvelope({
    transportOperation: 'SendRequest',
    businessOperationCode: 'CREATE_SDIZ',
    businessPayloadXml: payload,
    messageId: MESSAGE_ID,
    referenceMessageId: REFERENCE_MESSAGE_ID,
    messageDataId: 'message-data-xinclude',
  });
}

function expectXIncludeRejected(payload: string): void {
  try {
    build(payload);
    throw new Error('expected XInclude rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(FgisGrainXmlCodecError);
    expect((error as FgisGrainXmlCodecError).code)
      .toBe('CALLER_SIGNATURE_OR_TRANSPORT_WRAPPER_FORBIDDEN');
    expect((error as Error).message).toContain('XInclude');
  }
}

describe('FGIS Grain governed XML policy', () => {
  it('rejects XInclude nested inside an otherwise valid SDIZ request', () => {
    expectXIncludeRejected(createSdizPayload(
      `<xi:include xmlns:xi="${FGIS_GRAIN_XINCLUDE_NAMESPACE}" href="file:///etc/passwd"/>`,
    ));
  });

  it('rejects entity-obfuscated XInclude namespace declarations', () => {
    expectXIncludeRejected(createSdizPayload(
      '<xi:include xmlns:xi="http://www.w3.org/2001/XIncl&#117;de" href="file:///etc/passwd"/>',
    ));
  });

  it('does not reject ordinary business text containing the namespace URI', () => {
    expect(() => build(createSdizPayload(
      `<biz:comment>${FGIS_GRAIN_XINCLUDE_NAMESPACE}</biz:comment>`,
    ))).not.toThrow();
  });
});
