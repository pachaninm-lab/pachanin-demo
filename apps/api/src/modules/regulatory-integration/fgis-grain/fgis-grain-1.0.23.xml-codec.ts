import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import type {
  RegulatoryInboundEnvelope,
  RegulatorySignatureMetadata,
} from '../regulatory-integration.types';
import {
  FGIS_GRAIN_ADAPTER_CODE,
  FGIS_GRAIN_ADAPTER_IDENTITY,
  FGIS_GRAIN_API_VERSION,
  FGIS_GRAIN_BUSINESS_OPERATIONS,
  getFgisGrainBusinessOperation,
  toRegulatoryInboundEnvelope,
  type FgisGrainBusinessOperation,
  type FgisGrainEnvelopeDirection,
} from './fgis-grain-1.0.23.contract';
import {
  FGIS_GRAIN_1_0_23_MAPPING_VERSION,
  FGIS_GRAIN_1_0_23_RESPONSE_CODES,
  FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS,
  type FgisGrainBusinessOperationCode,
  type FgisGrainResponseCode,
  type FgisGrainTransportOperation,
} from './fgis-grain-1.0.23.generated';

export const FGIS_GRAIN_SOAP_11_NAMESPACE =
  'http://schemas.xmlsoap.org/soap/envelope/' as const;
export const FGIS_GRAIN_SOAP_12_NAMESPACE =
  'http://www.w3.org/2003/05/soap-envelope' as const;
export const FGIS_GRAIN_XMLDSIG_NAMESPACE =
  'http://www.w3.org/2000/09/xmldsig#' as const;
export const FGIS_GRAIN_XML_NAMESPACE =
  'http://www.w3.org/XML/1998/namespace' as const;
export const FGIS_GRAIN_XMLNS_NAMESPACE =
  'http://www.w3.org/2000/xmlns/' as const;
export const FGIS_GRAIN_MESSAGE_NAMESPACE =
  'urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5' as const;
export const FGIS_GRAIN_FAULT_QNAME =
  '{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/faults/1.0.5}ZernoFault' as const;

export const FGIS_GRAIN_XML_CODEC_LIMITS = Object.freeze({
  maxXmlBytes: 2 * 1024 * 1024,
  maxBusinessPayloadBytes: 1024 * 1024,
  maxDepth: 96,
  maxNodes: 20_000,
  maxAttributesPerElement: 128,
  maxNameLength: 200,
  maxScalarLength: 4096,
});

export const FGIS_GRAIN_SIGNING_POLICY = Object.freeze({
  evidenceDigestAlgorithm: 'SHA-256',
  digestPolicyId: 'FGIS_ZERNO_1_0_23_DIGEST_POLICY_PENDING_SIGNER',
  canonicalizationPolicyId:
    'FGIS_ZERNO_1_0_23_CANONICALIZATION_POLICY_PENDING_SIGNER',
  signaturePolicyId: 'FGIS_ZERNO_1_0_23_SIGNATURE_POLICY_PENDING_SIGNER',
  policyStatus: 'EXTERNAL_SIGNER_POLICY_REQUIRED',
});

export const FGIS_GRAIN_XML_CODEC_ERROR_CODES = [
  'XML_TOO_LARGE',
  'INVALID_UTF8',
  'INVALID_XML_DECLARATION',
  'FORBIDDEN_CONTROL_CHARACTER',
  'DTD_OR_DECLARATION_FORBIDDEN',
  'PROCESSING_INSTRUCTION_FORBIDDEN',
  'INVALID_XML_NAME',
  'INVALID_XML_SYNTAX',
  'INVALID_ENTITY_REFERENCE',
  'MULTIPLE_DOCUMENT_ROOTS',
  'TEXT_OUTSIDE_DOCUMENT_ROOT',
  'XML_DEPTH_LIMIT_EXCEEDED',
  'XML_NODE_LIMIT_EXCEEDED',
  'XML_ATTRIBUTE_LIMIT_EXCEEDED',
  'DUPLICATE_ATTRIBUTE',
  'DUPLICATE_XML_ID',
  'UNDECLARED_NAMESPACE_PREFIX',
  'NAMESPACE_REBINDING_FORBIDDEN',
  'RESERVED_NAMESPACE_VIOLATION',
  'SOAP_11_ENVELOPE_REQUIRED',
  'SOAP_HEADER_FORBIDDEN',
  'SOAP_BODY_REQUIRED',
  'MULTIPLE_SOAP_BODY_ELEMENTS',
  'SINGLE_SOAP_PAYLOAD_REQUIRED',
  'UNSUPPORTED_TRANSPORT_QNAME',
  'EXPECTED_TRANSPORT_OPERATION_REQUIRED',
  'TRANSPORT_OPERATION_MISMATCH',
  'UNEXPECTED_WRAPPER_CHILD',
  'RESPONSE_CODE_REQUIRED',
  'RESPONSE_CODE_FORBIDDEN',
  'RESPONSE_CODE_UNSUPPORTED',
  'MESSAGE_DATA_REQUIRED',
  'MESSAGE_DATA_ID_REQUIRED',
  'MESSAGE_DATA_STRUCTURE_INVALID',
  'MESSAGE_ID_INVALID',
  'REFERENCE_MESSAGE_ID_INVALID',
  'BUSINESS_PAYLOAD_REQUIRED',
  'BUSINESS_PAYLOAD_FORBIDDEN',
  'BUSINESS_PAYLOAD_QNAME_MISMATCH',
  'UNSUPPORTED_BUSINESS_PAYLOAD',
  'CALLER_SIGNATURE_OR_TRANSPORT_WRAPPER_FORBIDDEN',
  'XML_ID_INVALID',
  'INBOUND_ENVELOPE_REQUIRED',
  'INBOUND_SIGNATURE_REQUIRED',
  'INBOUND_IDENTIFIERS_REQUIRED',
] as const;

export type FgisGrainXmlCodecErrorCode =
  (typeof FGIS_GRAIN_XML_CODEC_ERROR_CODES)[number];

export class FgisGrainXmlCodecError extends Error {
  constructor(
    readonly code: FgisGrainXmlCodecErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = 'FgisGrainXmlCodecError';
  }
}

interface XmlName {
  readonly rawName: string;
  readonly prefix: string | null;
  readonly localName: string;
  readonly namespaceUri: string;
  readonly qName: string;
}

interface XmlAttribute extends XmlName {
  readonly value: string;
}

interface XmlElement extends XmlName {
  readonly attributes: readonly XmlAttribute[];
  readonly children: XmlElement[];
  readonly textSegments: string[];
  readonly namespaceBindings: ReadonlyMap<string, string>;
  readonly declaredNamespaces: ReadonlyMap<string, string>;
  readonly startOffset: number;
  openEndOffset: number;
  innerEndOffset: number;
  endOffset: number;
}

interface ParsedXmlDocument {
  readonly xml: string;
  readonly root: XmlElement;
  readonly hadXmlDeclaration: boolean;
  readonly xmlIds: ReadonlyMap<string, XmlElement>;
}

interface RawAttribute {
  readonly name: string;
  readonly value: string;
}

interface TransportResolution {
  readonly operation: FgisGrainTransportOperation;
  readonly direction: FgisGrainEnvelopeDirection;
  readonly wrapperQName: string;
}

export interface FgisGrainSoapDecodeOptions {
  readonly expectedTransportOperation?: FgisGrainTransportOperation;
  readonly expectedBusinessOperationCode?: FgisGrainBusinessOperationCode;
}

export interface FgisGrainSoapFaultMetadata {
  readonly qName: typeof FGIS_GRAIN_FAULT_QNAME;
  readonly soapFaultCode: string | null;
  readonly soapFaultString: string | null;
  readonly code: string | null;
  readonly description: string | null;
  readonly details: string | null;
}

export interface FgisGrainDecodedSoapEnvelope {
  readonly adapterCode: typeof FGIS_GRAIN_ADAPTER_CODE;
  readonly apiVersion: typeof FGIS_GRAIN_API_VERSION;
  readonly mappingVersion: typeof FGIS_GRAIN_1_0_23_MAPPING_VERSION;
  readonly transportOperation: FgisGrainTransportOperation;
  readonly direction: FgisGrainEnvelopeDirection;
  readonly wrapperQName: string;
  readonly responseCode: FgisGrainResponseCode | undefined;
  readonly messageId: string | null;
  readonly referenceMessageId: string | null;
  readonly messageDataId: string | null;
  readonly testMessage: boolean;
  readonly signaturePresent: boolean;
  readonly businessOperationCode: FgisGrainBusinessOperationCode | null;
  readonly businessPayloadKind: 'REQUEST' | 'RESPONSE' | null;
  readonly businessPayloadQName: string | null;
  readonly businessPayloadXml: string | null;
  readonly messageDataXml: string | null;
  readonly fault: FgisGrainSoapFaultMetadata | null;
  readonly rawBodySha256: string;
  readonly rawBodyBytes: Buffer;
}

export interface FgisGrainBuildUnsignedSoapEnvelopeInput {
  readonly transportOperation: FgisGrainTransportOperation;
  readonly businessOperationCode?: FgisGrainBusinessOperationCode;
  readonly businessPayloadXml?: string | Uint8Array;
  readonly messageId: string;
  readonly referenceMessageId: string;
  readonly messageDataId: string;
  readonly testMessage?: boolean;
}

export interface FgisGrainSigningInputDescriptor {
  readonly adapterIdentity: typeof FGIS_GRAIN_ADAPTER_IDENTITY;
  readonly apiVersion: typeof FGIS_GRAIN_API_VERSION;
  readonly mappingVersion: typeof FGIS_GRAIN_1_0_23_MAPPING_VERSION;
  readonly transportOperation: FgisGrainTransportOperation;
  readonly businessOperationCode: FgisGrainBusinessOperationCode | null;
  readonly messageDataXmlId: string;
  readonly signatureReferenceUri: string;
  readonly evidenceDigestAlgorithm: 'SHA-256';
  readonly digestPolicyId: string;
  readonly canonicalizationPolicyId: string;
  readonly signaturePolicyId: string;
  readonly policyStatus: 'EXTERNAL_SIGNER_POLICY_REQUIRED';
  readonly unsignedEnvelopeSha256: string;
  readonly messageDataSha256: string;
  readonly unsignedEnvelopeBytes: Buffer;
  readonly messageDataBytes: Buffer;
  readonly signatureInsertion: {
    readonly elementQName: `{${typeof FGIS_GRAIN_MESSAGE_NAMESPACE}}InformationSystemSignature`;
    readonly startByteOffset: number;
    readonly endByteOffset: number;
  };
}

export interface FgisGrainInboundMappingContext {
  readonly occurredAt: string;
  readonly signature: RegulatorySignatureMetadata;
  readonly externalEventId?: string;
  readonly correlationId?: string;
  readonly expectedBusinessOperationCode?: FgisGrainBusinessOperationCode;
}

const UUID_V1_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-1[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu;
const XML_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9._-]{0,127}$/u;
const XML_NAME_START = /[A-Za-z_]/u;
const XML_NAME_CHAR = /[A-Za-z0-9._-]/u;
const RESPONSE_CODES = new Set<string>(FGIS_GRAIN_1_0_23_RESPONSE_CODES);
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function codecError(
  code: FgisGrainXmlCodecErrorCode,
  message: string,
): never {
  throw new FgisGrainXmlCodecError(code, message);
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function clarkName(namespaceUri: string, localName: string): string {
  return `{${namespaceUri}}${localName}`;
}

function splitRawName(rawName: string): {
  readonly prefix: string | null;
  readonly localName: string;
} {
  const parts = rawName.split(':');
  if (parts.length === 1) {
    return { prefix: null, localName: parts[0] };
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { prefix: parts[0], localName: parts[1] };
  }
  return codecError('INVALID_XML_NAME', `Invalid qualified name ${rawName}`);
}

function assertSafeCharacters(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (
      code === 0
      || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)
      || code === 0xfffe
      || code === 0xffff
    ) {
      codecError(
        'FORBIDDEN_CONTROL_CHARACTER',
        `Forbidden XML character U+${code.toString(16).padStart(4, '0')}`,
      );
    }
  }
}

function decodeEntityReferences(value: string): string {
  let output = '';
  let cursor = 0;
  while (cursor < value.length) {
    const ampersand = value.indexOf('&', cursor);
    if (ampersand < 0) {
      output += value.slice(cursor);
      break;
    }
    output += value.slice(cursor, ampersand);
    const semicolon = value.indexOf(';', ampersand + 1);
    if (semicolon < 0 || semicolon - ampersand > 16) {
      codecError('INVALID_ENTITY_REFERENCE', 'Unterminated entity reference');
    }
    const entity = value.slice(ampersand + 1, semicolon);
    const predefined: Record<string, string> = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
    };
    if (Object.prototype.hasOwnProperty.call(predefined, entity)) {
      output += predefined[entity];
    } else if (/^#\d{1,7}$/u.test(entity)) {
      const codePoint = Number(entity.slice(1));
      if (!Number.isSafeInteger(codePoint)) {
        codecError('INVALID_ENTITY_REFERENCE', `Invalid entity &${entity};`);
      }
      output += String.fromCodePoint(codePoint);
    } else if (/^#x[\da-f]{1,6}$/iu.test(entity)) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      output += String.fromCodePoint(codePoint);
    } else {
      codecError('INVALID_ENTITY_REFERENCE', `Named entity &${entity}; is forbidden`);
    }
    cursor = semicolon + 1;
  }
  assertSafeCharacters(output);
  return output;
}

function escapeXmlText(value: string): string {
  assertSafeCharacters(value);
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value)
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function bytesFromInput(
  value: string | Uint8Array,
  maxBytes: number,
): { readonly bytes: Buffer; readonly xml: string } {
  const bytes = typeof value === 'string'
    ? Buffer.from(value, 'utf8')
    : Buffer.from(value);
  if (bytes.length > maxBytes) {
    codecError('XML_TOO_LARGE', `XML exceeds ${maxBytes} bytes`);
  }
  let xml: string;
  try {
    xml = UTF8_DECODER.decode(bytes);
  } catch {
    return codecError('INVALID_UTF8', 'XML is not valid UTF-8');
  }
  assertSafeCharacters(xml);
  return { bytes, xml };
}

class RestrictedXmlParser {
  private cursor = 0;
  private nodeCount = 0;
  private readonly stack: XmlElement[] = [];
  private root: XmlElement | null = null;
  private hadXmlDeclaration = false;
  private readonly xmlIds = new Map<string, XmlElement>();

  constructor(private readonly xml: string) {}

  parse(): ParsedXmlDocument {
    if (this.xml.charCodeAt(0) === 0xfeff) {
      this.cursor = 1;
    }
    if (this.xml.startsWith('<?xml', this.cursor)) {
      this.parseXmlDeclaration();
      this.hadXmlDeclaration = true;
    }

    while (this.cursor < this.xml.length) {
      if (this.xml[this.cursor] === '<') {
        if (this.xml.startsWith('</', this.cursor)) {
          this.parseEndTag();
        } else if (this.xml.startsWith('<?', this.cursor)) {
          codecError(
            'PROCESSING_INSTRUCTION_FORBIDDEN',
            'Processing instructions are forbidden',
          );
        } else if (this.xml.startsWith('<!', this.cursor)) {
          codecError(
            'DTD_OR_DECLARATION_FORBIDDEN',
            'DTD, entities, comments, CDATA and declarations are forbidden',
          );
        } else {
          this.parseStartTag();
        }
      } else {
        this.parseText();
      }
    }

    if (this.stack.length !== 0) {
      codecError('INVALID_XML_SYNTAX', 'Unclosed XML element');
    }
    if (!this.root) {
      codecError('INVALID_XML_SYNTAX', 'Document root is missing');
    }
    this.indexXmlIds(this.root);
    return {
      xml: this.xml,
      root: this.root,
      hadXmlDeclaration: this.hadXmlDeclaration,
      xmlIds: this.xmlIds,
    };
  }

  private parseXmlDeclaration(): void {
    const end = this.xml.indexOf('?>', this.cursor + 5);
    if (end < 0) {
      codecError('INVALID_XML_DECLARATION', 'XML declaration is unterminated');
    }
    const declaration = this.xml.slice(this.cursor + 5, end).trim();
    const attributes = this.parseDeclarationAttributes(declaration);
    if (attributes.get('version') !== '1.0') {
      codecError('INVALID_XML_DECLARATION', 'Only XML 1.0 is accepted');
    }
    const encoding = attributes.get('encoding');
    if (encoding && encoding.toUpperCase() !== 'UTF-8') {
      codecError('INVALID_XML_DECLARATION', 'Only UTF-8 encoding is accepted');
    }
    const standalone = attributes.get('standalone');
    if (standalone && standalone !== 'yes' && standalone !== 'no') {
      codecError('INVALID_XML_DECLARATION', 'Invalid standalone declaration');
    }
    for (const name of attributes.keys()) {
      if (!['version', 'encoding', 'standalone'].includes(name)) {
        codecError('INVALID_XML_DECLARATION', `Unexpected declaration field ${name}`);
      }
    }
    this.cursor = end + 2;
  }

  private parseDeclarationAttributes(value: string): Map<string, string> {
    const result = new Map<string, string>();
    let index = 0;
    while (index < value.length) {
      while (/\s/u.test(value[index] ?? '')) index += 1;
      if (index >= value.length) break;
      const nameStart = index;
      while (/[A-Za-z]/u.test(value[index] ?? '')) index += 1;
      const name = value.slice(nameStart, index);
      if (!name || result.has(name)) {
        codecError('INVALID_XML_DECLARATION', 'Duplicate or invalid declaration field');
      }
      while (/\s/u.test(value[index] ?? '')) index += 1;
      if (value[index] !== '=') {
        codecError('INVALID_XML_DECLARATION', `Expected = after ${name}`);
      }
      index += 1;
      while (/\s/u.test(value[index] ?? '')) index += 1;
      const quote = value[index];
      if (quote !== '"' && quote !== "'") {
        codecError('INVALID_XML_DECLARATION', `Expected quoted value for ${name}`);
      }
      const valueStart = index + 1;
      const valueEnd = value.indexOf(quote, valueStart);
      if (valueEnd < 0) {
        codecError('INVALID_XML_DECLARATION', `Unterminated value for ${name}`);
      }
      result.set(name, value.slice(valueStart, valueEnd));
      index = valueEnd + 1;
    }
    return result;
  }

  private parseStartTag(): void {
    const startOffset = this.cursor;
    this.cursor += 1;
    const rawName = this.parseName();
    const rawAttributes: RawAttribute[] = [];
    let selfClosing = false;

    while (true) {
      this.skipWhitespace();
      if (this.xml.startsWith('/>', this.cursor)) {
        this.cursor += 2;
        selfClosing = true;
        break;
      }
      if (this.xml[this.cursor] === '>') {
        this.cursor += 1;
        break;
      }
      if (this.cursor >= this.xml.length) {
        codecError('INVALID_XML_SYNTAX', `Unterminated start tag ${rawName}`);
      }
      if (rawAttributes.length >= FGIS_GRAIN_XML_CODEC_LIMITS.maxAttributesPerElement) {
        codecError(
          'XML_ATTRIBUTE_LIMIT_EXCEEDED',
          `Element ${rawName} has too many attributes`,
        );
      }
      const attributeName = this.parseName();
      this.skipWhitespace();
      if (this.xml[this.cursor] !== '=') {
        codecError('INVALID_XML_SYNTAX', `Expected = after ${attributeName}`);
      }
      this.cursor += 1;
      this.skipWhitespace();
      const quote = this.xml[this.cursor];
      if (quote !== '"' && quote !== "'") {
        codecError('INVALID_XML_SYNTAX', `Attribute ${attributeName} must be quoted`);
      }
      const valueStart = this.cursor + 1;
      const valueEnd = this.xml.indexOf(quote, valueStart);
      if (valueEnd < 0) {
        codecError('INVALID_XML_SYNTAX', `Unterminated attribute ${attributeName}`);
      }
      const rawValue = this.xml.slice(valueStart, valueEnd);
      if (rawValue.includes('<')) {
        codecError('INVALID_XML_SYNTAX', `Attribute ${attributeName} contains <`);
      }
      rawAttributes.push({
        name: attributeName,
        value: decodeEntityReferences(rawValue),
      });
      this.cursor = valueEnd + 1;
    }

    this.nodeCount += 1;
    if (this.nodeCount > FGIS_GRAIN_XML_CODEC_LIMITS.maxNodes) {
      codecError('XML_NODE_LIMIT_EXCEEDED', 'XML node limit exceeded');
    }
    if (this.stack.length + 1 > FGIS_GRAIN_XML_CODEC_LIMITS.maxDepth) {
      codecError('XML_DEPTH_LIMIT_EXCEEDED', 'XML depth limit exceeded');
    }

    const parentBindings = this.stack.length > 0
      ? this.stack[this.stack.length - 1].namespaceBindings
      : new Map<string, string>([['xml', FGIS_GRAIN_XML_NAMESPACE]]);
    const namespaceBindings = new Map(parentBindings);
    const declaredNamespaces = new Map<string, string>();
    const rawAttributeNames = new Set<string>();

    for (const attribute of rawAttributes) {
      if (rawAttributeNames.has(attribute.name)) {
        codecError('DUPLICATE_ATTRIBUTE', `Duplicate attribute ${attribute.name}`);
      }
      rawAttributeNames.add(attribute.name);
      const split = splitRawName(attribute.name);
      const namespacePrefix = attribute.name === 'xmlns'
        ? ''
        : split.prefix === 'xmlns'
          ? split.localName
          : null;
      if (namespacePrefix === null) continue;
      this.registerNamespace(
        namespaceBindings,
        declaredNamespaces,
        namespacePrefix,
        attribute.value,
      );
    }

    const elementName = this.resolveName(rawName, namespaceBindings, true);
    const attributes: XmlAttribute[] = [];
    const expandedAttributeNames = new Set<string>();
    for (const attribute of rawAttributes) {
      const split = splitRawName(attribute.name);
      if (attribute.name === 'xmlns' || split.prefix === 'xmlns') continue;
      const resolved = this.resolveName(attribute.name, namespaceBindings, false);
      if (expandedAttributeNames.has(resolved.qName)) {
        codecError(
          'DUPLICATE_ATTRIBUTE',
          `Duplicate expanded attribute ${resolved.qName}`,
        );
      }
      expandedAttributeNames.add(resolved.qName);
      attributes.push({ ...resolved, value: attribute.value });
    }

    const element: XmlElement = {
      ...elementName,
      attributes,
      children: [],
      textSegments: [],
      namespaceBindings,
      declaredNamespaces,
      startOffset,
      openEndOffset: this.cursor,
      innerEndOffset: this.cursor,
      endOffset: this.cursor,
    };

    const parent = this.stack[this.stack.length - 1];
    if (parent) {
      parent.children.push(element);
    } else if (this.root) {
      codecError('MULTIPLE_DOCUMENT_ROOTS', 'XML has multiple document roots');
    } else {
      this.root = element;
    }

    if (selfClosing) {
      element.innerEndOffset = this.cursor - 2;
      element.endOffset = this.cursor;
    } else {
      this.stack.push(element);
    }
  }

  private registerNamespace(
    bindings: Map<string, string>,
    declared: Map<string, string>,
    prefix: string,
    namespaceUri: string,
  ): void {
    if (!namespaceUri) {
      codecError('RESERVED_NAMESPACE_VIOLATION', 'Namespace URI cannot be empty');
    }
    if (declared.has(prefix)) {
      codecError('DUPLICATE_ATTRIBUTE', `Duplicate namespace declaration ${prefix}`);
    }
    if (prefix === 'xmlns' || namespaceUri === FGIS_GRAIN_XMLNS_NAMESPACE) {
      codecError('RESERVED_NAMESPACE_VIOLATION', 'xmlns namespace cannot be rebound');
    }
    if (
      prefix === 'xml'
      && namespaceUri !== FGIS_GRAIN_XML_NAMESPACE
    ) {
      codecError('RESERVED_NAMESPACE_VIOLATION', 'xml prefix has a fixed namespace');
    }
    if (
      prefix !== 'xml'
      && namespaceUri === FGIS_GRAIN_XML_NAMESPACE
    ) {
      codecError('RESERVED_NAMESPACE_VIOLATION', 'XML namespace requires xml prefix');
    }
    const inherited = bindings.get(prefix);
    if (inherited && inherited !== namespaceUri) {
      codecError(
        'NAMESPACE_REBINDING_FORBIDDEN',
        `Namespace prefix ${prefix || '(default)'} is rebound`,
      );
    }
    bindings.set(prefix, namespaceUri);
    declared.set(prefix, namespaceUri);
  }

  private parseEndTag(): void {
    const endTagOffset = this.cursor;
    this.cursor += 2;
    const rawName = this.parseName();
    this.skipWhitespace();
    if (this.xml[this.cursor] !== '>') {
      codecError('INVALID_XML_SYNTAX', `Invalid closing tag ${rawName}`);
    }
    this.cursor += 1;
    const element = this.stack.pop();
    if (!element || element.rawName !== rawName) {
      codecError('INVALID_XML_SYNTAX', `Mismatched closing tag ${rawName}`);
    }
    element.innerEndOffset = endTagOffset;
    element.endOffset = this.cursor;
  }

  private parseText(): void {
    const nextTag = this.xml.indexOf('<', this.cursor);
    const end = nextTag < 0 ? this.xml.length : nextTag;
    const rawText = this.xml.slice(this.cursor, end);
    if (rawText.includes(']]>')) {
      codecError('INVALID_XML_SYNTAX', 'CDATA terminator is forbidden');
    }
    const decoded = decodeEntityReferences(rawText);
    const current = this.stack[this.stack.length - 1];
    if (!current) {
      if (decoded.trim()) {
        codecError('TEXT_OUTSIDE_DOCUMENT_ROOT', 'Text outside document root');
      }
    } else {
      current.textSegments.push(decoded);
    }
    this.cursor = end;
  }

  private parseName(): string {
    const start = this.cursor;
    const first = this.xml[this.cursor];
    if (!first || !XML_NAME_START.test(first)) {
      codecError('INVALID_XML_NAME', `Invalid XML name at offset ${this.cursor}`);
    }
    this.cursor += 1;
    let colonCount = 0;
    while (this.cursor < this.xml.length) {
      const character = this.xml[this.cursor];
      if (character === ':') {
        colonCount += 1;
        if (colonCount > 1) break;
        this.cursor += 1;
        const next = this.xml[this.cursor];
        if (!next || !XML_NAME_START.test(next)) {
          codecError('INVALID_XML_NAME', 'Namespace prefix separator is malformed');
        }
        this.cursor += 1;
        continue;
      }
      if (!XML_NAME_CHAR.test(character)) break;
      this.cursor += 1;
    }
    const name = this.xml.slice(start, this.cursor);
    if (name.length > FGIS_GRAIN_XML_CODEC_LIMITS.maxNameLength) {
      codecError('INVALID_XML_NAME', 'XML name is too long');
    }
    return name;
  }

  private resolveName(
    rawName: string,
    bindings: ReadonlyMap<string, string>,
    applyDefaultNamespace: boolean,
  ): XmlName {
    const split = splitRawName(rawName);
    let namespaceUri = '';
    if (split.prefix) {
      const resolved = bindings.get(split.prefix);
      if (!resolved) {
        codecError(
          'UNDECLARED_NAMESPACE_PREFIX',
          `Namespace prefix ${split.prefix} is undeclared`,
        );
      }
      namespaceUri = resolved;
    } else if (applyDefaultNamespace) {
      namespaceUri = bindings.get('') ?? '';
    }
    return {
      rawName,
      prefix: split.prefix,
      localName: split.localName,
      namespaceUri,
      qName: clarkName(namespaceUri, split.localName),
    };
  }

  private indexXmlIds(element: XmlElement): void {
    for (const attribute of element.attributes) {
      if (attribute.localName.toLowerCase() !== 'id') continue;
      if (!attribute.value) continue;
      if (this.xmlIds.has(attribute.value)) {
        codecError('DUPLICATE_XML_ID', `Duplicate XML ID ${attribute.value}`);
      }
      this.xmlIds.set(attribute.value, element);
    }
    for (const child of element.children) this.indexXmlIds(child);
  }

  private skipWhitespace(): void {
    while (/\s/u.test(this.xml[this.cursor] ?? '')) this.cursor += 1;
  }
}

function parseRestrictedXml(
  value: string | Uint8Array,
  maxBytes = FGIS_GRAIN_XML_CODEC_LIMITS.maxXmlBytes,
): { readonly bytes: Buffer; readonly document: ParsedXmlDocument } {
  const input = bytesFromInput(value, maxBytes);
  const parser = new RestrictedXmlParser(input.xml);
  return { bytes: input.bytes, document: parser.parse() };
}

function textValue(element: XmlElement): string {
  if (element.children.length > 0) {
    codecError(
      'MESSAGE_DATA_STRUCTURE_INVALID',
      `Scalar element ${element.qName} contains child elements`,
    );
  }
  const value = element.textSegments.join('').trim();
  if (value.length > FGIS_GRAIN_XML_CODEC_LIMITS.maxScalarLength) {
    codecError('MESSAGE_DATA_STRUCTURE_INVALID', `Scalar ${element.qName} is too long`);
  }
  return value;
}

function directChild(
  parent: XmlElement,
  namespaceUri: string,
  localName: string,
  required = false,
): XmlElement | null {
  const matches = parent.children.filter(
    (child) => child.namespaceUri === namespaceUri && child.localName === localName,
  );
  if (matches.length > 1) {
    codecError(
      'MESSAGE_DATA_STRUCTURE_INVALID',
      `Multiple ${clarkName(namespaceUri, localName)} elements`,
    );
  }
  if (required && matches.length !== 1) {
    codecError(
      'MESSAGE_DATA_STRUCTURE_INVALID',
      `Required ${clarkName(namespaceUri, localName)} is missing`,
    );
  }
  return matches[0] ?? null;
}

function rawXml(document: ParsedXmlDocument, element: XmlElement): string {
  return document.xml.slice(element.startOffset, element.endOffset);
}

function findBusinessOperationByQName(qName: string): {
  readonly operation: FgisGrainBusinessOperation;
  readonly kind: 'REQUEST' | 'RESPONSE';
} | null {
  let match:
    | { readonly operation: FgisGrainBusinessOperation; readonly kind: 'REQUEST' | 'RESPONSE' }
    | null = null;
  for (const operation of FGIS_GRAIN_BUSINESS_OPERATIONS) {
    const kind = operation.requestQName === qName
      ? 'REQUEST'
      : operation.responseQName === qName
        ? 'RESPONSE'
        : null;
    if (!kind) continue;
    if (match) {
      codecError('UNSUPPORTED_BUSINESS_PAYLOAD', `Ambiguous business QName ${qName}`);
    }
    match = { operation, kind };
  }
  return match;
}

function transportByWrapperQName(
  qName: string,
  options: FgisGrainSoapDecodeOptions,
): TransportResolution | null {
  for (const operation of FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS) {
    if (operation.inputQName === qName) {
      return {
        operation: operation.name,
        direction: 'OUTBOUND_REQUEST',
        wrapperQName: qName,
      };
    }
    if (operation.outputQName === qName) {
      return {
        operation: operation.name,
        direction: 'INBOUND_RESPONSE',
        wrapperQName: qName,
      };
    }
  }
  if (qName === FGIS_GRAIN_FAULT_QNAME) {
    if (!options.expectedTransportOperation) {
      codecError(
        'EXPECTED_TRANSPORT_OPERATION_REQUIRED',
        'Fault QName is shared and requires expected transport operation',
      );
    }
    return {
      operation: options.expectedTransportOperation,
      direction: 'INBOUND_FAULT',
      wrapperQName: qName,
    };
  }
  return null;
}

function assertExpectedTransport(
  resolution: TransportResolution,
  options: FgisGrainSoapDecodeOptions,
): void {
  if (
    options.expectedTransportOperation
    && options.expectedTransportOperation !== resolution.operation
  ) {
    codecError(
      'TRANSPORT_OPERATION_MISMATCH',
      `Expected ${options.expectedTransportOperation}, got ${resolution.operation}`,
    );
  }
}

function parseFault(
  document: ParsedXmlDocument,
  payload: XmlElement,
  options: FgisGrainSoapDecodeOptions,
): {
  readonly resolution: TransportResolution;
  readonly metadata: FgisGrainSoapFaultMetadata;
} | null {
  let zernoFault: XmlElement | null = null;
  let soapFaultCode: string | null = null;
  let soapFaultString: string | null = null;

  if (payload.qName === FGIS_GRAIN_FAULT_QNAME) {
    zernoFault = payload;
  } else if (
    payload.namespaceUri === FGIS_GRAIN_SOAP_11_NAMESPACE
    && payload.localName === 'Fault'
  ) {
    const faultCode = directChild(payload, '', 'faultcode');
    const faultString = directChild(payload, '', 'faultstring');
    soapFaultCode = faultCode ? textValue(faultCode) : null;
    soapFaultString = faultString ? textValue(faultString) : null;
    const detail = directChild(payload, '', 'detail', true);
    if (!detail || detail.children.length !== 1) {
      codecError('SINGLE_SOAP_PAYLOAD_REQUIRED', 'SOAP Fault detail must contain one payload');
    }
    zernoFault = detail.children[0];
    if (zernoFault.qName !== FGIS_GRAIN_FAULT_QNAME) {
      codecError('UNSUPPORTED_TRANSPORT_QNAME', `Unexpected fault ${zernoFault.qName}`);
    }
  }

  if (!zernoFault) return null;
  const resolution = transportByWrapperQName(FGIS_GRAIN_FAULT_QNAME, options);
  if (!resolution) return null;
  assertExpectedTransport(resolution, options);
  const code = directChild(zernoFault, zernoFault.namespaceUri, 'Code');
  const description = directChild(zernoFault, zernoFault.namespaceUri, 'Description');
  const details = directChild(zernoFault, zernoFault.namespaceUri, 'Details');
  return {
    resolution,
    metadata: {
      qName: FGIS_GRAIN_FAULT_QNAME,
      soapFaultCode,
      soapFaultString,
      code: code ? textValue(code) : null,
      description: description ? textValue(description) : null,
      details: details ? rawXml(document, details) : null,
    },
  };
}

function parseMessageData(
  document: ParsedXmlDocument,
  wrapper: XmlElement,
): {
  readonly element: XmlElement | null;
  readonly messageDataId: string | null;
  readonly messageId: string | null;
  readonly referenceMessageId: string | null;
  readonly testMessage: boolean;
  readonly payload: XmlElement | null;
} {
  const messageData = directChild(
    wrapper,
    FGIS_GRAIN_MESSAGE_NAMESPACE,
    'MessageData',
  );
  if (!messageData) {
    return {
      element: null,
      messageDataId: null,
      messageId: null,
      referenceMessageId: null,
      testMessage: false,
      payload: null,
    };
  }
  const idAttributes = messageData.attributes.filter(
    (attribute) => attribute.namespaceUri === '' && attribute.localName === 'Id',
  );
  if (idAttributes.length !== 1 || !idAttributes[0].value) {
    codecError('MESSAGE_DATA_ID_REQUIRED', 'MessageData requires one Id attribute');
  }
  const messageDataId = idAttributes[0].value;
  if (!XML_ID_PATTERN.test(messageDataId)) {
    codecError('XML_ID_INVALID', `Invalid MessageData XML ID ${messageDataId}`);
  }
  if (document.xmlIds.get(messageDataId) !== messageData) {
    codecError('DUPLICATE_XML_ID', 'MessageData XML ID is not unique');
  }

  const allowed = new Set([
    'MessageID',
    'ReferenceMessageID',
    'MessagePrimaryContent',
    'TestMessage',
  ]);
  for (const child of messageData.children) {
    if (
      child.namespaceUri !== FGIS_GRAIN_MESSAGE_NAMESPACE
      || !allowed.has(child.localName)
    ) {
      codecError('MESSAGE_DATA_STRUCTURE_INVALID', `Unexpected ${child.qName}`);
    }
  }

  const messageIdElement = directChild(
    messageData,
    FGIS_GRAIN_MESSAGE_NAMESPACE,
    'MessageID',
    true,
  );
  const referenceElement = directChild(
    messageData,
    FGIS_GRAIN_MESSAGE_NAMESPACE,
    'ReferenceMessageID',
    true,
  );
  const primaryContent = directChild(
    messageData,
    FGIS_GRAIN_MESSAGE_NAMESPACE,
    'MessagePrimaryContent',
  );
  const testMessageElement = directChild(
    messageData,
    FGIS_GRAIN_MESSAGE_NAMESPACE,
    'TestMessage',
  );
  const messageId = messageIdElement ? textValue(messageIdElement) : '';
  const referenceMessageId = referenceElement ? textValue(referenceElement) : '';
  if (!UUID_V1_PATTERN.test(messageId)) {
    codecError('MESSAGE_ID_INVALID', `Invalid MessageID ${messageId}`);
  }
  if (!UUID_V1_PATTERN.test(referenceMessageId)) {
    codecError(
      'REFERENCE_MESSAGE_ID_INVALID',
      `Invalid ReferenceMessageID ${referenceMessageId}`,
    );
  }
  if (primaryContent && primaryContent.children.length !== 1) {
    codecError(
      'MESSAGE_DATA_STRUCTURE_INVALID',
      'MessagePrimaryContent must contain exactly one business payload',
    );
  }
  const testValue = testMessageElement ? textValue(testMessageElement) : '';
  if (testValue && testValue !== 'true' && testValue !== 'false') {
    codecError('MESSAGE_DATA_STRUCTURE_INVALID', 'TestMessage must be true or false');
  }
  return {
    element: messageData,
    messageDataId,
    messageId,
    referenceMessageId,
    testMessage: testValue === 'true',
    payload: primaryContent?.children[0] ?? null,
  };
}

function assertWrapperChildren(wrapper: XmlElement): void {
  const allowed = new Set([
    'ResponseCode',
    'MessageData',
    'InformationSystemSignature',
  ]);
  for (const child of wrapper.children) {
    if (
      child.namespaceUri !== FGIS_GRAIN_MESSAGE_NAMESPACE
      || !allowed.has(child.localName)
    ) {
      codecError('UNEXPECTED_WRAPPER_CHILD', `Unexpected wrapper child ${child.qName}`);
    }
  }
}

export function decodeFgisGrainSoapEnvelope(
  input: string | Uint8Array,
  options: FgisGrainSoapDecodeOptions = {},
): FgisGrainDecodedSoapEnvelope {
  const parsed = parseRestrictedXml(input);
  const { document, bytes } = parsed;
  const envelope = document.root;
  if (
    envelope.namespaceUri !== FGIS_GRAIN_SOAP_11_NAMESPACE
    || envelope.localName !== 'Envelope'
  ) {
    codecError(
      'SOAP_11_ENVELOPE_REQUIRED',
      `Expected SOAP 1.1 Envelope, got ${envelope.qName}`,
    );
  }
  if (
    envelope.children.some(
      (child) => child.namespaceUri === FGIS_GRAIN_SOAP_11_NAMESPACE
        && child.localName === 'Header',
    )
  ) {
    codecError('SOAP_HEADER_FORBIDDEN', 'SOAP Header is outside this adapter profile');
  }
  const bodies = envelope.children.filter(
    (child) => child.namespaceUri === FGIS_GRAIN_SOAP_11_NAMESPACE
      && child.localName === 'Body',
  );
  if (bodies.length === 0) {
    codecError('SOAP_BODY_REQUIRED', 'SOAP Body is missing');
  }
  if (bodies.length !== 1) {
    codecError('MULTIPLE_SOAP_BODY_ELEMENTS', 'SOAP Envelope has multiple Body elements');
  }
  if (envelope.children.length !== 1) {
    codecError('SOAP_BODY_REQUIRED', 'SOAP Envelope must contain only Body');
  }
  const body = bodies[0];
  if (body.children.length !== 1) {
    codecError(
      'SINGLE_SOAP_PAYLOAD_REQUIRED',
      'SOAP Body must contain exactly one payload root',
    );
  }
  const wrapper = body.children[0];
  const fault = parseFault(document, wrapper, options);
  if (fault) {
    return {
      adapterCode: FGIS_GRAIN_ADAPTER_CODE,
      apiVersion: FGIS_GRAIN_API_VERSION,
      mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
      transportOperation: fault.resolution.operation,
      direction: 'INBOUND_FAULT',
      wrapperQName: fault.resolution.wrapperQName,
      responseCode: undefined,
      messageId: null,
      referenceMessageId: null,
      messageDataId: null,
      testMessage: false,
      signaturePresent: false,
      businessOperationCode: options.expectedBusinessOperationCode ?? null,
      businessPayloadKind: null,
      businessPayloadQName: null,
      businessPayloadXml: null,
      messageDataXml: null,
      fault: fault.metadata,
      rawBodySha256: sha256(bytes),
      rawBodyBytes: Buffer.from(bytes),
    };
  }

  const resolution = transportByWrapperQName(wrapper.qName, options);
  if (!resolution) {
    codecError('UNSUPPORTED_TRANSPORT_QNAME', `Unsupported wrapper ${wrapper.qName}`);
  }
  assertExpectedTransport(resolution, options);
  assertWrapperChildren(wrapper);

  const responseCodeElement = directChild(
    wrapper,
    FGIS_GRAIN_MESSAGE_NAMESPACE,
    'ResponseCode',
  );
  const responseCodeValue = responseCodeElement
    ? textValue(responseCodeElement)
    : undefined;
  if (resolution.direction === 'OUTBOUND_REQUEST' && responseCodeValue !== undefined) {
    codecError('RESPONSE_CODE_FORBIDDEN', 'Request wrapper cannot contain ResponseCode');
  }
  if (resolution.direction === 'INBOUND_RESPONSE' && responseCodeValue === undefined) {
    codecError('RESPONSE_CODE_REQUIRED', 'Response wrapper requires ResponseCode');
  }
  if (responseCodeValue !== undefined && !RESPONSE_CODES.has(responseCodeValue)) {
    codecError('RESPONSE_CODE_UNSUPPORTED', `Unsupported response code ${responseCodeValue}`);
  }

  const signatureElements = wrapper.children.filter(
    (child) => child.namespaceUri === FGIS_GRAIN_MESSAGE_NAMESPACE
      && child.localName === 'InformationSystemSignature',
  );
  if (signatureElements.length > 1) {
    codecError('UNEXPECTED_WRAPPER_CHILD', 'Multiple signature containers');
  }
  const messageData = parseMessageData(document, wrapper);
  const business = messageData.payload
    ? findBusinessOperationByQName(messageData.payload.qName)
    : null;
  if (messageData.payload && !business) {
    codecError(
      'UNSUPPORTED_BUSINESS_PAYLOAD',
      `Business payload ${messageData.payload.qName} is not in accepted catalog`,
    );
  }
  if (
    options.expectedBusinessOperationCode
    && business?.operation.code !== options.expectedBusinessOperationCode
  ) {
    codecError(
      'BUSINESS_PAYLOAD_QNAME_MISMATCH',
      `Expected ${options.expectedBusinessOperationCode}, got ${business?.operation.code ?? 'none'}`,
    );
  }

  return {
    adapterCode: FGIS_GRAIN_ADAPTER_CODE,
    apiVersion: FGIS_GRAIN_API_VERSION,
    mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
    transportOperation: resolution.operation,
    direction: resolution.direction,
    wrapperQName: resolution.wrapperQName,
    responseCode: responseCodeValue as FgisGrainResponseCode | undefined,
    messageId: messageData.messageId,
    referenceMessageId: messageData.referenceMessageId,
    messageDataId: messageData.messageDataId,
    testMessage: messageData.testMessage,
    signaturePresent: signatureElements.length === 1,
    businessOperationCode: business?.operation.code ?? null,
    businessPayloadKind: business?.kind ?? null,
    businessPayloadQName: messageData.payload?.qName ?? null,
    businessPayloadXml: messageData.payload
      ? rawXml(document, messageData.payload)
      : null,
    messageDataXml: messageData.element
      ? rawXml(document, messageData.element)
      : null,
    fault: null,
    rawBodySha256: sha256(bytes),
    rawBodyBytes: Buffer.from(bytes),
  };
}

function assertPayloadHasNoForbiddenWrappers(root: XmlElement): void {
  const stack = [root];
  while (stack.length > 0) {
    const element = stack.pop();
    if (!element) continue;
    if (
      element.namespaceUri === FGIS_GRAIN_SOAP_11_NAMESPACE
      || element.namespaceUri === FGIS_GRAIN_SOAP_12_NAMESPACE
      || element.namespaceUri === FGIS_GRAIN_MESSAGE_NAMESPACE
      || element.namespaceUri === FGIS_GRAIN_XMLDSIG_NAMESPACE
      || /signature/iu.test(element.localName)
    ) {
      codecError(
        'CALLER_SIGNATURE_OR_TRANSPORT_WRAPPER_FORBIDDEN',
        `Caller payload contains forbidden ${element.qName}`,
      );
    }
    stack.push(...element.children);
  }
}

function validateOutboundPayload(
  input: FgisGrainBuildUnsignedSoapEnvelopeInput,
): {
  readonly operation: FgisGrainBusinessOperation | null;
  readonly payloadXml: string | null;
} {
  if (input.transportOperation === 'Ack') {
    if (input.businessOperationCode || input.businessPayloadXml !== undefined) {
      codecError('BUSINESS_PAYLOAD_FORBIDDEN', 'Ack cannot carry business payload');
    }
    return { operation: null, payloadXml: null };
  }
  if (!input.businessOperationCode || input.businessPayloadXml === undefined) {
    codecError(
      'BUSINESS_PAYLOAD_REQUIRED',
      `${input.transportOperation} requires operation and payload`,
    );
  }
  const operation = getFgisGrainBusinessOperation(input.businessOperationCode);
  if (!operation) {
    codecError(
      'UNSUPPORTED_BUSINESS_PAYLOAD',
      `Unknown operation ${input.businessOperationCode}`,
    );
  }
  const parsed = parseRestrictedXml(
    input.businessPayloadXml,
    FGIS_GRAIN_XML_CODEC_LIMITS.maxBusinessPayloadBytes,
  );
  if (parsed.document.hadXmlDeclaration) {
    codecError('INVALID_XML_DECLARATION', 'Business fragment cannot contain XML declaration');
  }
  assertPayloadHasNoForbiddenWrappers(parsed.document.root);
  const expectedQName = input.transportOperation === 'SendRequest'
    ? operation.requestQName
    : operation.responseQName;
  if (parsed.document.root.qName !== expectedQName) {
    codecError(
      'BUSINESS_PAYLOAD_QNAME_MISMATCH',
      `Expected ${expectedQName}, got ${parsed.document.root.qName}`,
    );
  }
  return {
    operation,
    payloadXml: parsed.document.xml,
  };
}

function validateOutboundIdentifiers(
  input: FgisGrainBuildUnsignedSoapEnvelopeInput,
): void {
  if (!UUID_V1_PATTERN.test(input.messageId)) {
    codecError('MESSAGE_ID_INVALID', `Invalid MessageID ${input.messageId}`);
  }
  if (!UUID_V1_PATTERN.test(input.referenceMessageId)) {
    codecError(
      'REFERENCE_MESSAGE_ID_INVALID',
      `Invalid ReferenceMessageID ${input.referenceMessageId}`,
    );
  }
  if (!XML_ID_PATTERN.test(input.messageDataId)) {
    codecError('XML_ID_INVALID', `Invalid XML ID ${input.messageDataId}`);
  }
}

function transportDefinition(operationName: FgisGrainTransportOperation) {
  const operation = FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS.find(
    (candidate) => candidate.name === operationName,
  );
  if (!operation) {
    codecError(
      'TRANSPORT_OPERATION_MISMATCH',
      `Unknown transport operation ${operationName}`,
    );
  }
  return operation;
}

function localNameFromClark(qName: string): string {
  const closing = qName.indexOf('}');
  if (!qName.startsWith('{') || closing < 2 || closing === qName.length - 1) {
    codecError('UNSUPPORTED_TRANSPORT_QNAME', `Invalid QName ${qName}`);
  }
  return qName.slice(closing + 1);
}

export function buildUnsignedFgisGrainSoapEnvelope(
  input: FgisGrainBuildUnsignedSoapEnvelopeInput,
): FgisGrainSigningInputDescriptor {
  validateOutboundIdentifiers(input);
  const payload = validateOutboundPayload(input);
  const transport = transportDefinition(input.transportOperation);
  const wrapperLocalName = localNameFromClark(transport.inputQName);
  const payloadXml = payload.payloadXml;
  const messagePrimaryContent = payloadXml === null
    ? ''
    : `<tns:MessagePrimaryContent>${payloadXml}</tns:MessagePrimaryContent>`;
  const testMessage = input.testMessage === undefined
    ? ''
    : `<tns:TestMessage>${input.testMessage ? 'true' : 'false'}</tns:TestMessage>`;
  const messageDataXml = [
    `<tns:MessageData Id="${escapeXmlAttribute(input.messageDataId)}">`,
    `<tns:MessageID>${escapeXmlText(input.messageId)}</tns:MessageID>`,
    `<tns:ReferenceMessageID>${escapeXmlText(input.referenceMessageId)}</tns:ReferenceMessageID>`,
    messagePrimaryContent,
    testMessage,
    '</tns:MessageData>',
  ].join('');
  const signatureOpen = '<tns:InformationSystemSignature>';
  const signatureClose = '</tns:InformationSystemSignature>';
  const envelopePrefix = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<soapenv:Envelope xmlns:soapenv="${FGIS_GRAIN_SOAP_11_NAMESPACE}" xmlns:tns="${FGIS_GRAIN_MESSAGE_NAMESPACE}">`,
    '<soapenv:Body>',
    `<tns:${wrapperLocalName}>`,
    messageDataXml,
    signatureOpen,
  ].join('');
  const envelopeSuffix = [
    signatureClose,
    `</tns:${wrapperLocalName}>`,
    '</soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('');
  const unsignedEnvelopeBytes = Buffer.from(envelopePrefix + envelopeSuffix, 'utf8');
  if (unsignedEnvelopeBytes.length > FGIS_GRAIN_XML_CODEC_LIMITS.maxXmlBytes) {
    codecError('XML_TOO_LARGE', 'Generated SOAP envelope exceeds size limit');
  }
  const messageDataBytes = Buffer.from(messageDataXml, 'utf8');
  const insertionOffset = Buffer.byteLength(envelopePrefix, 'utf8');

  return {
    adapterIdentity: FGIS_GRAIN_ADAPTER_IDENTITY,
    apiVersion: FGIS_GRAIN_API_VERSION,
    mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
    transportOperation: input.transportOperation,
    businessOperationCode: payload.operation?.code ?? null,
    messageDataXmlId: input.messageDataId,
    signatureReferenceUri: `#${input.messageDataId}`,
    evidenceDigestAlgorithm: FGIS_GRAIN_SIGNING_POLICY.evidenceDigestAlgorithm,
    digestPolicyId: FGIS_GRAIN_SIGNING_POLICY.digestPolicyId,
    canonicalizationPolicyId: FGIS_GRAIN_SIGNING_POLICY.canonicalizationPolicyId,
    signaturePolicyId: FGIS_GRAIN_SIGNING_POLICY.signaturePolicyId,
    policyStatus: FGIS_GRAIN_SIGNING_POLICY.policyStatus,
    unsignedEnvelopeSha256: sha256(unsignedEnvelopeBytes),
    messageDataSha256: sha256(messageDataBytes),
    unsignedEnvelopeBytes,
    messageDataBytes,
    signatureInsertion: {
      elementQName: `{${FGIS_GRAIN_MESSAGE_NAMESPACE}}InformationSystemSignature`,
      startByteOffset: insertionOffset,
      endByteOffset: insertionOffset,
    },
  };
}

export function mapDecodedFgisGrainInboundEnvelope(
  decoded: FgisGrainDecodedSoapEnvelope,
  context: FgisGrainInboundMappingContext,
): RegulatoryInboundEnvelope {
  if (
    decoded.direction !== 'INBOUND_RESPONSE'
    && decoded.direction !== 'INBOUND_FAULT'
  ) {
    codecError('INBOUND_ENVELOPE_REQUIRED', 'Outbound request cannot enter inbox');
  }
  if (!decoded.signaturePresent && decoded.direction !== 'INBOUND_FAULT') {
    codecError(
      'INBOUND_SIGNATURE_REQUIRED',
      'Accepted inbound response requires signature container',
    );
  }
  const businessOperationCode = decoded.businessOperationCode
    ?? context.expectedBusinessOperationCode;
  if (!businessOperationCode) {
    codecError(
      'UNSUPPORTED_BUSINESS_PAYLOAD',
      'Inbound operation code is unavailable',
    );
  }
  const operation = getFgisGrainBusinessOperation(businessOperationCode);
  if (!operation) {
    codecError('UNSUPPORTED_BUSINESS_PAYLOAD', `Unknown operation ${businessOperationCode}`);
  }
  const messageId = decoded.messageId ?? context.externalEventId;
  const referenceMessageId = decoded.referenceMessageId
    ?? context.correlationId
    ?? context.externalEventId;
  if (!messageId || !referenceMessageId) {
    codecError(
      'INBOUND_IDENTIFIERS_REQUIRED',
      'Inbound message and reference identifiers are required',
    );
  }
  const payloadQName = decoded.direction === 'INBOUND_FAULT'
    ? FGIS_GRAIN_FAULT_QNAME
    : decoded.businessPayloadQName ?? operation.responseQName;
  return toRegulatoryInboundEnvelope({
    adapterCode: FGIS_GRAIN_ADAPTER_CODE,
    apiVersion: FGIS_GRAIN_API_VERSION,
    mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
    direction: decoded.direction,
    transportOperation: decoded.transportOperation,
    businessOperationCode,
    payloadQName,
    messageId,
    referenceMessageId,
    occurredAt: context.occurredAt,
    rawBodySha256: decoded.rawBodySha256,
    signature: context.signature,
    responseCode: decoded.responseCode,
  });
}
