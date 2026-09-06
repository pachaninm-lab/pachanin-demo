import { isValidRussianInn } from '../role-eligibility-policy';
import {
  interpretFnsEgrulStatus,
  type FnsEgrulExclusionDecisionFact,
  type FnsEgrulReliabilityFact,
  type FnsEgrulStatusEnvelope,
  type FnsEgrulStatusFact,
  type FnsEgrulTerminationFact,
} from './fns-egrul-status-policy';

export const FNS_EGRUL_SUPPORTED_FORMATS = ['4.08', '4.07'] as const;
export type FnsEgrulFormat = typeof FNS_EGRUL_SUPPORTED_FORMATS[number];

export type FnsEgrulNormalizedRecord = {
  sourceRecordId: string;
  subjectInn: string;
  subjectOgrn: string;
  recordType: 'EGRUL_LEGAL_ENTITY';
  normalizedPayload: {
    inn: string;
    ogrn: string;
    kpp: string | null;
    legalName: string;
    active: boolean;
    status: 'ACTIVE' | 'TERMINATED' | 'REVIEW_REQUIRED';
    primaryOkved: string | null;
    additionalOkved: string[];
    strongContradiction: false;
    /** Phase-A source envelope. Optional in the TS shape only for legacy test fixtures. */
    statusEnvelope?: FnsEgrulStatusEnvelope;
  };
  validFrom: Date | null;
  validUntil: Date | null;
};

type XmlNode = {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
};

type ParsedXml = {
  root: XmlNode;
  declarationEncoding: string | null;
};

const MAX_XML_CHARS = 32 * 1024 * 1024;
const MAX_RECORDS_PER_XML = 1_000;
const MAX_XML_DEPTH = 64;
const MAX_XML_NODES = 300_000;
const MAX_ATTRIBUTES_PER_NODE = 96;
const MAX_ATTRIBUTE_VALUE_CHARS = 64 * 1024;
const XML_NAME_RE = /^[\p{L}_:][\p{L}\p{N}_.:-]*$/u;

function sourceError(code: string): Error {
  const error = new Error(code);
  error.name = 'FnsEgrulFeedError';
  return error;
}

function validXmlCodePoint(point: number): boolean {
  return point === 0x09
    || point === 0x0a
    || point === 0x0d
    || (point >= 0x20 && point <= 0xd7ff)
    || (point >= 0xe000 && point <= 0xfffd)
    || (point >= 0x10000 && point <= 0x10ffff);
}

function validateXmlCharacters(value: string): void {
  for (const char of value) {
    const point = char.codePointAt(0);
    if (point === undefined || !validXmlCodePoint(point)) throw sourceError('FNS_EGRUL_XML_CHARACTER_INVALID');
  }
}

function decodeXmlEntities(value: string): string {
  let output = '';
  for (let index = 0; index < value.length;) {
    const char = value[index];
    if (char !== '&') {
      output += char;
      index += 1;
      continue;
    }

    const end = value.indexOf(';', index + 1);
    if (end < 0 || end - index > 18) throw sourceError('FNS_EGRUL_XML_ENTITY_UNSUPPORTED');
    const entity = value.slice(index + 1, end);
    if (entity === 'amp') output += '&';
    else if (entity === 'lt') output += '<';
    else if (entity === 'gt') output += '>';
    else if (entity === 'quot') output += '"';
    else if (entity === 'apos') output += "'";
    else if (/^#\d+$/u.test(entity) || /^#x[0-9a-fA-F]+$/u.test(entity)) {
      const point = entity.startsWith('#x')
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      if (!Number.isSafeInteger(point) || !validXmlCodePoint(point)) {
        throw sourceError('FNS_EGRUL_XML_ENTITY_INVALID');
      }
      output += String.fromCodePoint(point);
    } else {
      throw sourceError('FNS_EGRUL_XML_ENTITY_UNSUPPORTED');
    }
    index = end + 1;
  }
  return output;
}

function skipWhitespace(value: string, start: number): number {
  let index = start;
  while (index < value.length && /\s/u.test(value[index])) index += 1;
  return index;
}

function parseAttributes(raw: string): Record<string, string> {
  const output: Record<string, string> = {};
  let cursor = 0;
  let count = 0;

  while (true) {
    cursor = skipWhitespace(raw, cursor);
    if (cursor >= raw.length) break;

    const nameMatch = raw.slice(cursor).match(/^([\p{L}_:][\p{L}\p{N}_.:-]*)/u);
    if (!nameMatch || !XML_NAME_RE.test(nameMatch[1])) throw sourceError('FNS_EGRUL_XML_ATTRIBUTE_SYNTAX_INVALID');
    const name = nameMatch[1];
    cursor += name.length;
    cursor = skipWhitespace(raw, cursor);
    if (raw[cursor] !== '=') throw sourceError('FNS_EGRUL_XML_ATTRIBUTE_SYNTAX_INVALID');
    cursor += 1;
    cursor = skipWhitespace(raw, cursor);

    const quote = raw[cursor];
    if (quote !== '"' && quote !== "'") throw sourceError('FNS_EGRUL_XML_ATTRIBUTE_SYNTAX_INVALID');
    cursor += 1;
    const end = raw.indexOf(quote, cursor);
    if (end < 0) throw sourceError('FNS_EGRUL_XML_ATTRIBUTE_SYNTAX_INVALID');
    const encoded = raw.slice(cursor, end);
    if (encoded.length > MAX_ATTRIBUTE_VALUE_CHARS || encoded.includes('<')) {
      throw sourceError('FNS_EGRUL_XML_ATTRIBUTE_VALUE_INVALID');
    }
    if (Object.prototype.hasOwnProperty.call(output, name)) throw sourceError('FNS_EGRUL_XML_DUPLICATE_ATTRIBUTE');
    output[name] = decodeXmlEntities(encoded);
    count += 1;
    if (count > MAX_ATTRIBUTES_PER_NODE) throw sourceError('FNS_EGRUL_XML_ATTRIBUTE_LIMIT_EXCEEDED');
    cursor = end + 1;
  }

  return output;
}

function findTagEnd(xml: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start + 1; index < xml.length; index += 1) {
    const char = xml[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') return index;
  }
  return -1;
}

function parseDeclaration(body: string): string | null {
  const match = body.match(/^xml(?=\s|$)([\s\S]*)$/iu);
  if (!match) return null;
  const attrs = parseAttributes(match[1]);
  if (attrs.version && attrs.version !== '1.0') throw sourceError('FNS_EGRUL_XML_DECLARATION_INVALID');
  const encoding = String(attrs.encoding || '').trim();
  if (encoding && encoding.toLowerCase() !== 'windows-1251') {
    throw sourceError('FNS_EGRUL_XML_ENCODING_MISMATCH');
  }
  return encoding || null;
}

function tokenizeXml(xml: string): ParsedXml {
  validateXmlCharacters(xml);
  const stack: XmlNode[] = [];
  let root: XmlNode | null = null;
  let rootClosed = false;
  let declarationEncoding: string | null = null;
  let declarationSeen = false;
  let cursor = 0;
  let nodeCount = 0;

  while (cursor < xml.length) {
    const open = xml.indexOf('<', cursor);
    if (open < 0) {
      const rawTail = xml.slice(cursor);
      const tail = cursor === 0 ? rawTail.replace(/^\uFEFF/u, '') : rawTail;
      if (tail.includes(']]>')) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      if (tail.includes('&')) decodeXmlEntities(tail);
      if ((!root || rootClosed) && tail.trim()) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      break;
    }

    const rawText = xml.slice(cursor, open);
    const text = cursor === 0 ? rawText.replace(/^\uFEFF/u, '') : rawText;
    if (text.includes(']]>')) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
    if (text.includes('&')) decodeXmlEntities(text);
    if ((!root || rootClosed) && text.trim()) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');

    if (xml.startsWith('<!--', open)) {
      const end = xml.indexOf('-->', open + 4);
      if (end < 0) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      const body = xml.slice(open + 4, end);
      if (body.includes('--')) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      cursor = end + 3;
      continue;
    }

    if (xml.startsWith('<?', open)) {
      const end = xml.indexOf('?>', open + 2);
      if (end < 0) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      const body = xml.slice(open + 2, end).trim();
      const declaration = /^xml(?=\s|$)/iu.test(body);
      if (declaration) {
        if (declarationSeen || root) throw sourceError('FNS_EGRUL_XML_DECLARATION_INVALID');
        declarationEncoding = parseDeclaration(body);
        declarationSeen = true;
      }
      cursor = end + 2;
      continue;
    }

    if (xml.startsWith('<![CDATA[', open)) {
      if (!root || rootClosed || stack.length === 0) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      const end = xml.indexOf(']]>', open + 9);
      if (end < 0) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      cursor = end + 3;
      continue;
    }

    if (xml.startsWith('<!', open)) throw sourceError('FNS_EGRUL_XML_EXTERNAL_ENTITY_FORBIDDEN');

    const end = findTagEnd(xml, open);
    if (end < 0) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
    const raw = xml.slice(open + 1, end).trim();
    if (!raw) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');

    if (raw.startsWith('/')) {
      const closingName = raw.slice(1).trim();
      if (!XML_NAME_RE.test(closingName)) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      const current = stack.pop();
      if (!current || current.name !== closingName) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      if (stack.length === 0) rootClosed = true;
      cursor = end + 1;
      continue;
    }

    if (rootClosed) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
    const selfClosing = raw.endsWith('/');
    const openingBody = selfClosing ? raw.slice(0, -1).trimEnd() : raw;
    const nameMatch = openingBody.match(/^([\p{L}_:][\p{L}\p{N}_.:-]*)([\s\S]*)$/u);
    if (!nameMatch || !XML_NAME_RE.test(nameMatch[1])) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
    const node: XmlNode = {
      name: nameMatch[1],
      attrs: parseAttributes(nameMatch[2]),
      children: [],
    };
    nodeCount += 1;
    if (nodeCount > MAX_XML_NODES) throw sourceError('FNS_EGRUL_XML_NODE_LIMIT_EXCEEDED');

    if (!root) {
      if (node.name !== 'EGRUL') throw sourceError('FNS_EGRUL_ROOT_MISSING');
      root = node;
    } else {
      const parent = stack[stack.length - 1];
      if (!parent) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      parent.children.push(node);
    }

    if (!selfClosing) {
      stack.push(node);
      if (stack.length > MAX_XML_DEPTH) throw sourceError('FNS_EGRUL_XML_DEPTH_LIMIT_EXCEEDED');
    } else if (node === root) {
      rootClosed = true;
    }
    cursor = end + 1;
  }

  if (!root || !rootClosed || stack.length !== 0) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
  return { root, declarationEncoding };
}

function directChildren(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((child) => child.name === name);
}

function directChild(node: XmlNode, name: string): XmlNode | null {
  const children = directChildren(node, name);
  if (children.length > 1) throw sourceError(`FNS_EGRUL_DUPLICATE_${name}`);
  return children[0] || null;
}

function descendantsWithin(node: XmlNode, name: string): XmlNode[] {
  const output: XmlNode[] = [];
  const pending = [...node.children];
  while (pending.length) {
    const current = pending.shift()!;
    if (current.name === 'СвЮЛ') continue;
    if (current.name === name) output.push(current);
    pending.push(...current.children);
  }
  return output;
}

function isoDate(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) return null;
  return date;
}

function strictOptionalDate(value: string | undefined, errorCode: string): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (!isoDate(normalized)) throw sourceError(errorCode);
  return normalized;
}

function strictRequiredDate(value: string | undefined, errorCode: string): string {
  const normalized = String(value || '').trim();
  if (!normalized || !isoDate(normalized)) throw sourceError(errorCode);
  return normalized;
}

function statusFacts(subject: XmlNode): {
  statuses: FnsEgrulStatusFact[];
  decisions: FnsEgrulExclusionDecisionFact[];
  accessRestricted: boolean;
} {
  const statuses: FnsEgrulStatusFact[] = [];
  const decisions: FnsEgrulExclusionDecisionFact[] = [];
  let accessRestricted = false;

  for (const container of directChildren(subject, 'СвСтатус')) {
    const restriction = directChildren(container, 'ОгрДосСв').length > 0;
    accessRestricted ||= restriction;
    const grnDate = directChild(container, 'ГРНДата');
    const grn = grnDate ? String(grnDate.attrs['ГРН'] || '').trim() || null : null;
    const recordedAt = grnDate
      ? strictOptionalDate(grnDate.attrs['ДатаЗаписи'], 'FNS_EGRUL_STATUS_DATE_INVALID')
      : null;

    const statusNodes = container.attrs['КодСтатусЮЛ']
      ? [container]
      : directChildren(container, 'СвСтатус');
    for (const statusNode of statusNodes) {
      const code = String(statusNode.attrs['КодСтатусЮЛ'] || '').trim();
      const name = String(statusNode.attrs['НаимСтатусЮЛ'] || '').trim();
      if (!code || !name) throw sourceError('FNS_EGRUL_STATUS_FACT_INVALID');
      statuses.push({
        code,
        name,
        liquidationDeadline: strictOptionalDate(statusNode.attrs['СрокЛиквООО'], 'FNS_EGRUL_STATUS_DATE_INVALID'),
        grn,
        recordedAt,
        accessRestricted: restriction,
      });
    }

    for (const decisionNode of directChildren(container, 'СвРешИсклЮЛ')) {
      decisions.push({
        decisionDate: strictRequiredDate(decisionNode.attrs['ДатаРеш'], 'FNS_EGRUL_EXCLUSION_DECISION_DATE_INVALID'),
        decisionNumber: String(decisionNode.attrs['НомерРеш'] || '').trim(),
        publicationDate: strictOptionalDate(decisionNode.attrs['ДатаПубликации'], 'FNS_EGRUL_EXCLUSION_PUBLICATION_DATE_INVALID'),
        journalNumber: String(decisionNode.attrs['НомерЖурнала'] || '').trim() || null,
      });
    }
  }

  return { statuses, decisions, accessRestricted };
}

function terminationFact(subject: XmlNode): FnsEgrulTerminationFact | null {
  const termination = directChild(subject, 'СвПрекрЮЛ');
  if (!termination) return null;
  const method = directChild(termination, 'СпПрекрЮЛ');
  return {
    terminatedAt: strictRequiredDate(termination.attrs['ДатаПрекрЮЛ'], 'FNS_EGRUL_TERMINATION_DATE_INVALID'),
    methodCode: method ? String(method.attrs['КодСпПрекрЮЛ'] || method.attrs['КодСпПрекр'] || '').trim() || null : null,
    methodName: method ? String(method.attrs['НаимСпПрекрЮЛ'] || method.attrs['НаимСпПрекр'] || '').trim() || null : null,
  };
}

function reliabilityFacts(subject: XmlNode): FnsEgrulReliabilityFact[] {
  const output: FnsEgrulReliabilityFact[] = [];
  const address = directChild(subject, 'СвАдресЮЛ');
  if (address) {
    for (const node of directChildren(address, 'СвНедАдресЮЛ')) {
      const basisCode = String(node.attrs['ПризнНедАдресЮЛ'] || '').trim();
      if (basisCode) output.push({ area: 'ADDRESS', basisCode, sourceTag: 'СвНедАдресЮЛ' });
    }
  }

  for (const sectionName of ['СвУпрОрг', 'СведДолжнФЛ']) {
    for (const section of directChildren(subject, sectionName)) {
      for (const node of descendantsWithin(section, 'СвНедДанУпрОрг')) {
        const basisCode = String(node.attrs['ПризнНедДанУпрОрг'] || '').trim();
        if (basisCode) output.push({ area: 'MANAGEMENT', basisCode, sourceTag: 'СвНедДанУпрОрг' });
      }
    }
  }

  for (const section of directChildren(subject, 'СвУчредит')) {
    for (const node of descendantsWithin(section, 'СвНедДанУчр')) {
      const basisCode = String(node.attrs['ПризнНедДанУчр'] || '').trim();
      if (basisCode) output.push({ area: 'PARTICIPANT', basisCode, sourceTag: 'СвНедДанУчр' });
    }
  }
  return output;
}

export function isValidRussianOgrn(value: string): boolean {
  const normalized = String(value || '').trim();
  if (!/^\d{13}$/u.test(normalized)) return false;
  return Number(BigInt(normalized.slice(0, 12)) % 11n % 10n) === Number(normalized[12]);
}

export function decodeFnsEgrulXml(bytes: Uint8Array): string {
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_XML_CHARS) throw sourceError('FNS_EGRUL_XML_SIZE_INVALID');
  try {
    const text = new TextDecoder('windows-1251', { fatal: true }).decode(bytes);
    if (text.length > MAX_XML_CHARS) throw sourceError('FNS_EGRUL_XML_SIZE_INVALID');
    return text;
  } catch (error) {
    if (error instanceof Error && error.message === 'FNS_EGRUL_XML_SIZE_INVALID') throw error;
    throw sourceError('FNS_EGRUL_WINDOWS_1251_DECODE_FAILED');
  }
}

export function parseFnsEgrulXml(xml: string, format: FnsEgrulFormat): {
  publishedAt: Date;
  records: FnsEgrulNormalizedRecord[];
} {
  if (!FNS_EGRUL_SUPPORTED_FORMATS.includes(format)) throw sourceError('FNS_EGRUL_FORMAT_UNSUPPORTED');
  if (!xml || xml.length > MAX_XML_CHARS) throw sourceError('FNS_EGRUL_XML_SIZE_INVALID');
  if (/<!DOCTYPE|<!ENTITY|\bSYSTEM\s+["']|\bPUBLIC\s+["']/iu.test(xml)) {
    throw sourceError('FNS_EGRUL_XML_EXTERNAL_ENTITY_FORBIDDEN');
  }

  const parsed = tokenizeXml(xml);
  if (parsed.declarationEncoding && parsed.declarationEncoding.toLowerCase() !== 'windows-1251') {
    throw sourceError('FNS_EGRUL_XML_ENCODING_MISMATCH');
  }
  const publishedAt = isoDate(parsed.root.attrs['ДатаВыг']);
  if (!publishedAt) throw sourceError('FNS_EGRUL_PUBLICATION_DATE_INVALID');

  const subjects = directChildren(parsed.root, 'СвЮЛ');
  if (subjects.length > MAX_RECORDS_PER_XML) throw sourceError('FNS_EGRUL_RECORD_LIMIT_EXCEEDED');
  const records: FnsEgrulNormalizedRecord[] = [];
  const seenOgrn = new Set<string>();

  for (const subject of subjects) {
    const inn = String(subject.attrs['ИНН'] || '').trim();
    const ogrn = String(subject.attrs['ОГРН'] || '').trim();
    if (!isValidRussianInn(inn) || inn.length !== 10) throw sourceError('FNS_EGRUL_INN_INVALID');
    if (!isValidRussianOgrn(ogrn)) throw sourceError('FNS_EGRUL_OGRN_INVALID');
    if (seenOgrn.has(ogrn)) throw sourceError('FNS_EGRUL_DUPLICATE_OGRN');
    seenOgrn.add(ogrn);

    const nameNode = directChild(subject, 'СвНаимЮЛ');
    const legalName = String(nameNode?.attrs['НаимЮЛПолн'] || subject.attrs['ПолнНаимОПФ'] || '').trim();
    if (!legalName) throw sourceError('FNS_EGRUL_LEGAL_NAME_MISSING');

    const reportedPrimary = descendantsWithin(subject, 'СвОКВЭДОтчОсн')[0]?.attrs['КодОКВЭД']?.trim() || null;
    const declaredPrimary = descendantsWithin(subject, 'СвОКВЭДОсн')[0]?.attrs['КодОКВЭД']?.trim() || null;
    const primary = reportedPrimary || declaredPrimary;
    const reportedAdditional = descendantsWithin(subject, 'СвОКВЭДОтчДоп')
      .map((entry) => entry.attrs['КодОКВЭД']?.trim())
      .filter((value): value is string => Boolean(value));
    const declaredAdditional = descendantsWithin(subject, 'СвОКВЭДДоп')
      .map((entry) => entry.attrs['КодОКВЭД']?.trim())
      .filter((value): value is string => Boolean(value));
    const additionalOkved = [...new Set([
      ...reportedAdditional,
      ...(reportedPrimary && declaredPrimary ? [declaredPrimary] : []),
      ...declaredAdditional,
    ].filter((code) => code !== primary))].sort();

    const registrationDateRaw = subject.attrs['ДатаОГРН']?.trim() || null;
    const validFrom = isoDate(registrationDateRaw);
    if (registrationDateRaw && !validFrom) throw sourceError('FNS_EGRUL_REGISTRATION_DATE_INVALID');

    const status = statusFacts(subject);
    const termination = terminationFact(subject);
    const statusEnvelope = interpretFnsEgrulStatus({
      visibleStatuses: status.statuses,
      exclusionDecisions: status.decisions,
      termination,
      reliability: reliabilityFacts(subject),
      reorganizationPresent: directChildren(subject, 'СвРеорг').length > 0,
      accessRestricted: status.accessRestricted,
    });

    records.push({
      sourceRecordId: ogrn,
      subjectInn: inn,
      subjectOgrn: ogrn,
      recordType: 'EGRUL_LEGAL_ENTITY',
      normalizedPayload: {
        inn,
        ogrn,
        kpp: String(subject.attrs['КПП'] || '').trim() || null,
        legalName,
        active: statusEnvelope.compatibilityActive,
        status: statusEnvelope.compatibilityStatus,
        primaryOkved: primary,
        additionalOkved,
        strongContradiction: false,
        statusEnvelope,
      },
      validFrom,
      validUntil: termination ? isoDate(termination.terminatedAt) : null,
    });
  }

  if (!records.length) throw sourceError('FNS_EGRUL_EMPTY_XML');
  return { publishedAt, records };
}
