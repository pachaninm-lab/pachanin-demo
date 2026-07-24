import { createHash } from 'node:crypto';
import {
  FGIS_GRAIN_API_VERSION,
  FGIS_GRAIN_ADAPTER_CODE,
  getFgisGrainBusinessOperation,
} from './fgis-grain-1.0.23.contract';
import {
  FGIS_GRAIN_1_0_23_MAPPING_VERSION,
  type FgisGrainBusinessOperationCode,
} from './fgis-grain-1.0.23.generated';
import {
  FGIS_GRAIN_MESSAGE_DATA_PROFILE,
  FGIS_GRAIN_MESSAGE_DATA_PROFILE_SHA256,
} from './fgis-grain-1.0.23.message-data-profile.generated';

const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
const XMLDSIG_NAMESPACE = 'http://www.w3.org/2000/09/xmldsig#';
const XINCLUDE_NAMESPACE = 'http://www.w3.org/2001/XInclude';
const UUID_V1_PATTERN = /^[\da-f]{8}-[\da-f]{4}-1[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;
const NC_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9._-]*$/u;

export const FGIS_GRAIN_XML_FRAGMENT_ERROR_CODES = [
  'INPUT_STRING_REQUIRED',
  'UTF8_BOM_FORBIDDEN',
  'INVALID_XML_CHARACTER',
  'XML_SIZE_LIMIT_EXCEEDED',
  'FORBIDDEN_MARKUP',
  'MALFORMED_XML',
  'NAME_LIMIT_EXCEEDED',
  'DEPTH_LIMIT_EXCEEDED',
  'NODE_LIMIT_EXCEEDED',
  'ATTRIBUTE_LIMIT_EXCEEDED',
  'NAMESPACE_LIMIT_EXCEEDED',
  'ID_LIMIT_EXCEEDED',
  'DUPLICATE_ATTRIBUTE',
  'DUPLICATE_EXPANDED_ATTRIBUTE',
  'DUPLICATE_XML_ID',
  'INVALID_XML_ID',
  'UNDECLARED_PREFIX',
  'RESERVED_NAMESPACE_REBINDING',
  'FORBIDDEN_XINCLUDE',
  'FORBIDDEN_SIGNATURE_ELEMENT',
  'MULTIPLE_ROOTS',
  'TRAILING_MARKUP',
  'ROOT_QNAME_MISMATCH',
  'UNSUPPORTED_OPERATION',
  'ENTITY_REFERENCE_FORBIDDEN',
] as const;

export type FgisGrainXmlFragmentErrorCode =
  (typeof FGIS_GRAIN_XML_FRAGMENT_ERROR_CODES)[number];

export class FgisGrainXmlFragmentError extends Error {
  constructor(readonly code: FgisGrainXmlFragmentErrorCode) {
    super(`FGIS_GRAIN_XML_${code}`);
    this.name = 'FgisGrainXmlFragmentError';
  }
}

interface NamespaceFrame {
  readonly rawName: string;
  readonly localNamespaces: ReadonlyMap<string, string>;
}

interface ParsedAttribute {
  readonly rawName: string;
  readonly prefix: string;
  readonly localName: string;
  readonly value: string;
}

export interface FgisGrainScannedXmlFragment {
  readonly xml: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly rootQName: string;
  readonly nodeCount: number;
  readonly maxDepth: number;
  readonly namespaceDeclarationCount: number;
  readonly xmlIds: readonly string[];
}

export type FgisGrainBusinessPayloadDirection = 'REQUEST' | 'RESPONSE';

export interface FgisGrainScannedBusinessPayload
  extends FgisGrainScannedXmlFragment {
  readonly operationCode: FgisGrainBusinessOperationCode;
  readonly direction: FgisGrainBusinessPayloadDirection;
}

export type FgisGrainMessageDataMode =
  | 'SEND_REQUEST'
  | 'SEND_RESPONSE_POLL'
  | 'ACK';

interface FgisGrainMessageDataBaseInput {
  readonly mode: FgisGrainMessageDataMode;
  readonly messageId: string;
  readonly referenceMessageId: string;
  readonly testMessage?: boolean;
}

export interface FgisGrainSendRequestMessageDataInput
  extends FgisGrainMessageDataBaseInput {
  readonly mode: 'SEND_REQUEST';
  readonly operationCode: FgisGrainBusinessOperationCode;
  readonly businessPayloadXml: unknown;
}

export interface FgisGrainSendResponsePollMessageDataInput
  extends FgisGrainMessageDataBaseInput {
  readonly mode: 'SEND_RESPONSE_POLL';
  readonly operationCode?: never;
  readonly businessPayloadXml?: never;
}

export interface FgisGrainAckMessageDataInput
  extends FgisGrainMessageDataBaseInput {
  readonly mode: 'ACK';
  readonly operationCode?: never;
  readonly businessPayloadXml?: never;
}

export type FgisGrainMessageDataInput =
  | FgisGrainSendRequestMessageDataInput
  | FgisGrainSendResponsePollMessageDataInput
  | FgisGrainAckMessageDataInput;

export interface FgisGrainSigningInputDescriptor {
  readonly schemaVersion: 'pc-crop.fgis-grain-signing-input.v1';
  readonly adapterCode: typeof FGIS_GRAIN_ADAPTER_CODE;
  readonly apiVersion: typeof FGIS_GRAIN_API_VERSION;
  readonly mappingVersion: typeof FGIS_GRAIN_1_0_23_MAPPING_VERSION;
  readonly profileSha256: typeof FGIS_GRAIN_MESSAGE_DATA_PROFILE_SHA256;
  readonly messageDataMode: FgisGrainMessageDataMode;
  readonly businessOperationCode: FgisGrainBusinessOperationCode | null;
  readonly businessPayloadQName: string | null;
  readonly target: {
    readonly scope: 'ELEMENT_CONTENT';
    readonly elementQName: string;
    readonly xmlId: string;
    readonly referenceUri: string;
  };
  readonly unsignedMessageDataXml: string;
  readonly unsignedMessageDataByteLength: number;
  readonly unsignedMessageDataSha256: string;
  readonly targetContentXml: string;
  readonly targetContentByteLength: number;
  readonly targetContentSha256: string;
  readonly requiredCryptographicPolicy: typeof FGIS_GRAIN_MESSAGE_DATA_PROFILE.signingPolicy;
  readonly preparationStatus: 'PREPARED_NOT_CANONICALIZED';
  readonly signatureStatus: 'NOT_SIGNED';
  readonly verificationStatus: 'NOT_VERIFIED';
  readonly operationalStatus: 'NOT_ATTESTED';
}

export interface FgisGrainPreparedMessageData {
  readonly messageDataId: string;
  readonly messageDataXml: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly businessPayload: FgisGrainScannedBusinessPayload | null;
  readonly signingInput: FgisGrainSigningInputDescriptor;
}

function fail(code: FgisGrainXmlFragmentErrorCode): never {
  throw new FgisGrainXmlFragmentError(code);
}

function isNameStart(character: string): boolean {
  return /[A-Za-z_]/u.test(character);
}

function isNameCharacter(character: string): boolean {
  return /[A-Za-z0-9._:-]/u.test(character);
}

function validXmlCodePoint(codePoint: number): boolean {
  return codePoint === 0x9
    || codePoint === 0xa
    || codePoint === 0xd
    || (codePoint >= 0x20 && codePoint <= 0xd7ff)
    || (codePoint >= 0xe000 && codePoint <= 0xfffd)
    || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
}

function validateXmlCharacters(value: string): void {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || !validXmlCodePoint(codePoint)) {
      fail('INVALID_XML_CHARACTER');
    }
  }
}

function validateEntityReferences(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '&') continue;
    const end = value.indexOf(';', index + 1);
    if (end === -1) fail('MALFORMED_XML');
    const reference = value.slice(index + 1, end);
    if (['amp', 'lt', 'gt', 'apos', 'quot'].includes(reference)) {
      index = end;
      continue;
    }
    const decimal = /^#([0-9]+)$/u.exec(reference);
    const hexadecimal = /^#x([0-9A-Fa-f]+)$/u.exec(reference);
    if (!decimal && !hexadecimal) fail('ENTITY_REFERENCE_FORBIDDEN');
    const codePoint = Number.parseInt(
      decimal?.[1] ?? hexadecimal?.[1] ?? '',
      decimal ? 10 : 16,
    );
    if (!Number.isSafeInteger(codePoint) || !validXmlCodePoint(codePoint)) {
      fail('INVALID_XML_CHARACTER');
    }
    index = end;
  }
}

function decodeAttributeValue(value: string): string {
  validateEntityReferences(value);
  return value.replace(
    /&(amp|lt|gt|apos|quot|#\d+|#x[0-9A-Fa-f]+);/gu,
    (_match, reference: string) => {
      if (reference === 'amp') return '&';
      if (reference === 'lt') return '<';
      if (reference === 'gt') return '>';
      if (reference === 'apos') return "'";
      if (reference === 'quot') return '"';
      const hexadecimal = reference.startsWith('#x');
      const codePoint = Number.parseInt(
        reference.slice(hexadecimal ? 2 : 1),
        hexadecimal ? 16 : 10,
      );
      return String.fromCodePoint(codePoint);
    },
  );
}

function splitQName(rawName: string): { prefix: string; localName: string } {
  if (rawName.length > FGIS_GRAIN_MESSAGE_DATA_PROFILE.limits.maxNameLength) {
    fail('NAME_LIMIT_EXCEEDED');
  }
  const parts = rawName.split(':');
  if (
    parts.length > 2
    || parts.some((part) => !NC_NAME_PATTERN.test(part))
  ) {
    fail('MALFORMED_XML');
  }
  return parts.length === 1
    ? { prefix: '', localName: parts[0] }
    : { prefix: parts[0], localName: parts[1] };
}

function expandedQName(namespace: string, localName: string): string {
  return `{${namespace}}${localName}`;
}

function resolveNamespace(
  prefix: string,
  localNamespaces: ReadonlyMap<string, string>,
  stack: readonly NamespaceFrame[],
): string {
  if (prefix === 'xml') return XML_NAMESPACE;
  if (prefix === 'xmlns') fail('RESERVED_NAMESPACE_REBINDING');
  if (localNamespaces.has(prefix)) {
    return localNamespaces.get(prefix) ?? '';
  }
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const namespace = stack[index].localNamespaces.get(prefix);
    if (namespace !== undefined) return namespace;
  }
  if (prefix === '') return '';
  fail('UNDECLARED_PREFIX');
}

function parseQNameAt(
  xml: string,
  position: number,
): { rawName: string; prefix: string; localName: string; next: number } {
  if (!isNameStart(xml[position] ?? '')) fail('MALFORMED_XML');
  let next = position + 1;
  while (next < xml.length && isNameCharacter(xml[next])) next += 1;
  const rawName = xml.slice(position, next);
  const { prefix, localName } = splitQName(rawName);
  return { rawName, prefix, localName, next };
}

function skipWhitespace(xml: string, position: number): number {
  let next = position;
  while (next < xml.length && /[\t\n\r ]/u.test(xml[next])) next += 1;
  return next;
}

function parseStartTag(
  xml: string,
  start: number,
): {
  rawName: string;
  prefix: string;
  localName: string;
  attributes: readonly ParsedAttribute[];
  selfClosing: boolean;
  next: number;
} {
  const name = parseQNameAt(xml, start + 1);
  let position = name.next;
  const attributes: ParsedAttribute[] = [];
  const rawNames = new Set<string>();
  while (position < xml.length) {
    const beforeWhitespace = position;
    position = skipWhitespace(xml, position);
    const hadWhitespace = position > beforeWhitespace;
    if (xml.startsWith('/>', position)) {
      return { ...name, attributes, selfClosing: true, next: position + 2 };
    }
    if (xml[position] === '>') {
      return { ...name, attributes, selfClosing: false, next: position + 1 };
    }
    if (!hadWhitespace) fail('MALFORMED_XML');
    const attributeName = parseQNameAt(xml, position);
    if (rawNames.has(attributeName.rawName)) fail('DUPLICATE_ATTRIBUTE');
    rawNames.add(attributeName.rawName);
    position = skipWhitespace(xml, attributeName.next);
    if (xml[position] !== '=') fail('MALFORMED_XML');
    position = skipWhitespace(xml, position + 1);
    const quote = xml[position];
    if (quote !== '"' && quote !== "'") fail('MALFORMED_XML');
    const valueStart = position + 1;
    const valueEnd = xml.indexOf(quote, valueStart);
    if (valueEnd === -1) fail('MALFORMED_XML');
    const value = xml.slice(valueStart, valueEnd);
    if (value.includes('<')) fail('MALFORMED_XML');
    validateEntityReferences(value);
    attributes.push({
      rawName: attributeName.rawName,
      prefix: attributeName.prefix,
      localName: attributeName.localName,
      value,
    });
    if (
      attributes.length
      > FGIS_GRAIN_MESSAGE_DATA_PROFILE.limits.maxAttributesPerElement
    ) {
      fail('ATTRIBUTE_LIMIT_EXCEEDED');
    }
    position = valueEnd + 1;
  }
  fail('MALFORMED_XML');
}

function parseEndTag(
  xml: string,
  start: number,
): { rawName: string; next: number } {
  const name = parseQNameAt(xml, start + 2);
  const position = skipWhitespace(xml, name.next);
  if (xml[position] !== '>') fail('MALFORMED_XML');
  return { rawName: name.rawName, next: position + 1 };
}

function containsForbiddenMarkup(xml: string): boolean {
  const upper = xml.toUpperCase();
  return xml.includes('<?')
    || xml.includes('<!--')
    || xml.includes('<![CDATA[')
    || upper.includes('<!DOCTYPE')
    || upper.includes('<!ENTITY')
    || upper.includes('<!ATTLIST')
    || upper.includes('<!ELEMENT')
    || upper.includes('<!NOTATION');
}

export function scanFgisGrainXmlFragment(
  input: unknown,
  expectedRootQName: string,
): FgisGrainScannedXmlFragment {
  if (typeof input !== 'string') fail('INPUT_STRING_REQUIRED');
  if (input.startsWith('\uFEFF')) fail('UTF8_BOM_FORBIDDEN');
  validateXmlCharacters(input);
  const bytes = Buffer.from(input, 'utf8');
  if (bytes.byteLength > FGIS_GRAIN_MESSAGE_DATA_PROFILE.limits.maxBytes) {
    fail('XML_SIZE_LIMIT_EXCEEDED');
  }
  if (containsForbiddenMarkup(input)) fail('FORBIDDEN_MARKUP');

  const stack: NamespaceFrame[] = [];
  const ids = new Set<string>();
  let position = 0;
  let rootQName = '';
  let rootSeen = false;
  let rootClosed = false;
  let nodeCount = 0;
  let maximumDepth = 0;
  let namespaceDeclarationCount = 0;

  while (position < input.length) {
    if (input[position] !== '<') {
      const nextMarkup = input.indexOf('<', position);
      const end = nextMarkup === -1 ? input.length : nextMarkup;
      const text = input.slice(position, end);
      validateEntityReferences(text);
      if (text.includes(']]>')) fail('MALFORMED_XML');
      if (stack.length === 0 && text.trim().length > 0) {
        fail(rootSeen ? 'TRAILING_MARKUP' : 'MALFORMED_XML');
      }
      position = end;
      continue;
    }

    if (input.startsWith('</', position)) {
      if (stack.length === 0) fail('MALFORMED_XML');
      const closing = parseEndTag(input, position);
      const current = stack.pop();
      if (!current || current.rawName !== closing.rawName) fail('MALFORMED_XML');
      position = closing.next;
      if (stack.length === 0) rootClosed = true;
      continue;
    }
    if (input.startsWith('<!', position) || input.startsWith('<?', position)) {
      fail('FORBIDDEN_MARKUP');
    }
    if (rootClosed) fail('MULTIPLE_ROOTS');

    const opening = parseStartTag(input, position);
    nodeCount += 1;
    if (nodeCount > FGIS_GRAIN_MESSAGE_DATA_PROFILE.limits.maxNodes) {
      fail('NODE_LIMIT_EXCEEDED');
    }
    const depth = stack.length + 1;
    if (depth > FGIS_GRAIN_MESSAGE_DATA_PROFILE.limits.maxDepth) {
      fail('DEPTH_LIMIT_EXCEEDED');
    }
    maximumDepth = Math.max(maximumDepth, depth);

    const localNamespaces = new Map<string, string>();
    for (const attribute of opening.attributes) {
      const namespaceDeclaration = attribute.rawName === 'xmlns'
        || attribute.prefix === 'xmlns';
      if (!namespaceDeclaration) continue;
      const declaredPrefix = attribute.rawName === 'xmlns'
        ? ''
        : attribute.localName;
      const namespace = decodeAttributeValue(attribute.value);
      if (
        declaredPrefix === 'xml'
        || declaredPrefix === 'xmlns'
        || namespace === XML_NAMESPACE
        || namespace === XMLNS_NAMESPACE
        || (declaredPrefix !== '' && namespace === '')
      ) {
        fail('RESERVED_NAMESPACE_REBINDING');
      }
      localNamespaces.set(declaredPrefix, namespace);
      namespaceDeclarationCount += 1;
      if (
        namespaceDeclarationCount
        > FGIS_GRAIN_MESSAGE_DATA_PROFILE.limits.maxNamespaceDeclarations
      ) {
        fail('NAMESPACE_LIMIT_EXCEEDED');
      }
    }

    const elementNamespace = resolveNamespace(
      opening.prefix,
      localNamespaces,
      stack,
    );
    const elementQName = expandedQName(
      elementNamespace,
      opening.localName,
    );
    if (
      elementNamespace === XINCLUDE_NAMESPACE
      && ['include', 'fallback'].includes(opening.localName)
    ) {
      fail('FORBIDDEN_XINCLUDE');
    }
    if (elementNamespace === XMLDSIG_NAMESPACE) {
      fail('FORBIDDEN_SIGNATURE_ELEMENT');
    }

    const expandedAttributes = new Set<string>();
    for (const attribute of opening.attributes) {
      if (attribute.rawName === 'xmlns' || attribute.prefix === 'xmlns') continue;
      const namespace = attribute.prefix === ''
        ? ''
        : resolveNamespace(attribute.prefix, localNamespaces, stack);
      const attributeQName = expandedQName(namespace, attribute.localName);
      if (expandedAttributes.has(attributeQName)) {
        fail('DUPLICATE_EXPANDED_ATTRIBUTE');
      }
      expandedAttributes.add(attributeQName);
      const isXmlId = namespace === XML_NAMESPACE && attribute.localName === 'id';
      const isConventionalId = namespace === ''
        && ['Id', 'ID', 'id'].includes(attribute.localName);
      if (isXmlId || isConventionalId) {
        const value = decodeAttributeValue(attribute.value);
        if (!NC_NAME_PATTERN.test(value)) fail('INVALID_XML_ID');
        if (ids.has(value)) fail('DUPLICATE_XML_ID');
        ids.add(value);
        if (ids.size > FGIS_GRAIN_MESSAGE_DATA_PROFILE.limits.maxIdCount) {
          fail('ID_LIMIT_EXCEEDED');
        }
      }
    }

    if (!rootSeen) {
      rootSeen = true;
      rootQName = elementQName;
      if (rootQName !== expectedRootQName) fail('ROOT_QNAME_MISMATCH');
    }

    position = opening.next;
    if (opening.selfClosing) {
      if (stack.length === 0) rootClosed = true;
    } else {
      stack.push({ rawName: opening.rawName, localNamespaces });
    }
  }

  if (!rootSeen || stack.length !== 0 || !rootClosed) fail('MALFORMED_XML');
  return {
    xml: input,
    byteLength: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    rootQName,
    nodeCount,
    maxDepth: maximumDepth,
    namespaceDeclarationCount,
    xmlIds: [...ids],
  };
}

export function scanFgisGrainBusinessPayload(
  input: unknown,
  operationCode: FgisGrainBusinessOperationCode,
  direction: FgisGrainBusinessPayloadDirection,
): FgisGrainScannedBusinessPayload {
  const operation = getFgisGrainBusinessOperation(operationCode);
  if (!operation) fail('UNSUPPORTED_OPERATION');
  const expectedRootQName = direction === 'REQUEST'
    ? operation.requestQName
    : operation.responseQName;
  return {
    ...scanFgisGrainXmlFragment(input, expectedRootQName),
    operationCode,
    direction,
  };
}

function escapeXmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function validUuidV1(value: string): boolean {
  return UUID_V1_PATTERN.test(value);
}

function hashUtf8(value: string): { byteLength: number; sha256: string } {
  const bytes = Buffer.from(value, 'utf8');
  return {
    byteLength: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export function prepareFgisGrainMessageData(
  input: FgisGrainMessageDataInput,
): FgisGrainPreparedMessageData {
  if (!validUuidV1(input.messageId)) {
    throw new Error('FGIS_GRAIN_MESSAGE_ID_INVALID');
  }
  if (!validUuidV1(input.referenceMessageId)) {
    throw new Error('FGIS_GRAIN_REFERENCE_MESSAGE_ID_INVALID');
  }
  if (
    input.mode === 'SEND_REQUEST'
    && input.referenceMessageId !== input.messageId
  ) {
    throw new Error('FGIS_GRAIN_SEND_REQUEST_REFERENCE_MISMATCH');
  }

  const businessPayload = input.mode === 'SEND_REQUEST'
    ? scanFgisGrainBusinessPayload(
        input.businessPayloadXml,
        input.operationCode,
        'REQUEST',
      )
    : null;
  const messageDataId = `MessageData-${input.messageId}`;
  if (!NC_NAME_PATTERN.test(messageDataId)) {
    throw new Error('FGIS_GRAIN_MESSAGE_DATA_ID_INVALID');
  }
  if (businessPayload?.xmlIds.includes(messageDataId)) {
    throw new Error('FGIS_GRAIN_DUPLICATE_MESSAGE_DATA_ID');
  }

  const namespace = FGIS_GRAIN_MESSAGE_DATA_PROFILE.xml.typesNamespace;
  const contentParts = [
    `<types:MessageID>${escapeXmlText(input.messageId)}</types:MessageID>`,
    `<types:ReferenceMessageID>${escapeXmlText(input.referenceMessageId)}</types:ReferenceMessageID>`,
  ];
  if (businessPayload) {
    contentParts.push(
      `<types:MessagePrimaryContent>${businessPayload.xml}</types:MessagePrimaryContent>`,
    );
  }
  if (input.testMessage === true) {
    contentParts.push('<types:TestMessage/>');
  }
  const targetContentXml = contentParts.join('');
  const messageDataXml = `<types:MessageData xmlns:types="${namespace}" Id="${messageDataId}">${targetContentXml}</types:MessageData>`;
  const whole = hashUtf8(messageDataXml);
  if (whole.byteLength > FGIS_GRAIN_MESSAGE_DATA_PROFILE.limits.maxBytes) {
    throw new Error('FGIS_GRAIN_MESSAGE_DATA_SIZE_LIMIT_EXCEEDED');
  }
  const scanned = scanFgisGrainXmlFragment(
    messageDataXml,
    FGIS_GRAIN_MESSAGE_DATA_PROFILE.xml.messageData.qname,
  );
  if (!scanned.xmlIds.includes(messageDataId)) {
    throw new Error('FGIS_GRAIN_MESSAGE_DATA_ID_MISSING');
  }
  const targetContent = hashUtf8(targetContentXml);
  const policy = FGIS_GRAIN_MESSAGE_DATA_PROFILE.signingPolicy;
  return {
    messageDataId,
    messageDataXml,
    byteLength: whole.byteLength,
    sha256: whole.sha256,
    businessPayload,
    signingInput: {
      schemaVersion: 'pc-crop.fgis-grain-signing-input.v1',
      adapterCode: FGIS_GRAIN_ADAPTER_CODE,
      apiVersion: FGIS_GRAIN_API_VERSION,
      mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
      profileSha256: FGIS_GRAIN_MESSAGE_DATA_PROFILE_SHA256,
      messageDataMode: input.mode,
      businessOperationCode: businessPayload?.operationCode ?? null,
      businessPayloadQName: businessPayload?.rootQName ?? null,
      target: {
        scope: 'ELEMENT_CONTENT',
        elementQName: policy.targetElementQName,
        xmlId: messageDataId,
        referenceUri: `#${messageDataId}`,
      },
      unsignedMessageDataXml: messageDataXml,
      unsignedMessageDataByteLength: whole.byteLength,
      unsignedMessageDataSha256: whole.sha256,
      targetContentXml,
      targetContentByteLength: targetContent.byteLength,
      targetContentSha256: targetContent.sha256,
      requiredCryptographicPolicy: policy,
      preparationStatus: 'PREPARED_NOT_CANONICALIZED',
      signatureStatus: 'NOT_SIGNED',
      verificationStatus: 'NOT_VERIFIED',
      operationalStatus: 'NOT_ATTESTED',
    },
  };
}
