import { isValidRussianInn } from '../role-eligibility-policy';

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
    status: 'ACTIVE' | 'TERMINATED';
    primaryOkved: string | null;
    additionalOkved: string[];
    strongContradiction: false;
  };
  validFrom: Date | null;
  validUntil: Date | null;
};

type LegalEntityBlock = { attrs: string; body: string };

const MAX_XML_CHARS = 32 * 1024 * 1024;
const MAX_RECORDS_PER_XML = 1_000;
const ATTR_RE = /([\p{L}\p{N}_:.-]+)\s*=\s*(["'])(.*?)\2/gu;

function sourceError(code: string): Error {
  const error = new Error(code);
  error.name = 'FnsEgrulFeedError';
  return error;
}

function decodeXmlEntities(value: string): string {
  const decoded = value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (full, entity: string) => {
    if (entity === 'amp') return '&';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'quot') return '"';
    if (entity === 'apos') return "'";
    const point = entity.startsWith('#x')
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    if (!Number.isSafeInteger(point) || point < 0 || point > 0x10ffff) throw sourceError('FNS_EGRUL_XML_ENTITY_INVALID');
    return String.fromCodePoint(point);
  });
  if (/&[A-Za-z#][^;\s]{0,64};/.test(decoded)) throw sourceError('FNS_EGRUL_XML_ENTITY_UNSUPPORTED');
  return decoded;
}

function attributes(raw: string): Record<string, string> {
  const output: Record<string, string> = {};
  for (const match of raw.matchAll(ATTR_RE)) output[match[1]] = decodeXmlEntities(match[3]);
  return output;
}

function tagAttributes(block: string, tag: string): Record<string, string> | null {
  const match = block.match(new RegExp(`<${tag}(?=[\\s/>])([^>]*)\\/?>\\s*`, 'u'));
  return match ? attributes(match[1]) : null;
}

function tagsAttributes(block: string, tag: string): Array<Record<string, string>> {
  const output: Array<Record<string, string>> = [];
  const re = new RegExp(`<${tag}(?=[\\s/>])([^>]*)\\/?>`, 'gu');
  for (const match of block.matchAll(re)) output.push(attributes(match[1]));
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

function validateXmlStructure(xml: string): void {
  const stack: string[] = [];
  let cursor = 0;
  let rootSeen = false;
  let rootClosed = false;

  while (cursor < xml.length) {
    const open = xml.indexOf('<', cursor);
    if (open < 0) {
      const tail = xml.slice(cursor).replace(/^\uFEFF/u, '');
      if ((!rootSeen || rootClosed) && tail.trim()) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      break;
    }

    const rawText = xml.slice(cursor, open);
    const text = cursor === 0 ? rawText.replace(/^\uFEFF/u, '') : rawText;
    if ((!rootSeen || rootClosed) && text.trim()) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');

    if (xml.startsWith('<!--', open)) {
      const end = xml.indexOf('-->', open + 4);
      if (end < 0) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      cursor = end + 3;
      continue;
    }

    if (xml.startsWith('<?', open)) {
      const end = xml.indexOf('?>', open + 2);
      if (end < 0) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      if (rootSeen && /^<\?xml(?=[\s?])/iu.test(xml.slice(open, end + 2))) {
        throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      }
      cursor = end + 2;
      continue;
    }

    if (xml.startsWith('<![CDATA[', open)) {
      if (!rootSeen || rootClosed) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      const end = xml.indexOf(']]>', open + 9);
      if (end < 0) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      cursor = end + 3;
      continue;
    }

    if (xml.startsWith('<!', open)) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');

    const end = findTagEnd(xml, open);
    if (end < 0) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
    const raw = xml.slice(open + 1, end).trim();
    if (!raw) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');

    const closing = raw.startsWith('/');
    const selfClosing = !closing && raw.endsWith('/');
    const body = closing ? raw.slice(1).trim() : selfClosing ? raw.slice(0, -1).trim() : raw;
    const nameMatch = body.match(/^([^\s/>]+)([\s\S]*)$/u);
    if (!nameMatch) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
    const [, name, remainder] = nameMatch;
    if (closing && remainder.trim()) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
    if (rootClosed) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');

    if (closing) {
      if (!stack.length || stack[stack.length - 1] !== name) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      stack.pop();
      if (!stack.length) {
        if (name !== 'EGRUL') throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
        rootClosed = true;
      }
    } else if (!rootSeen) {
      if (name !== 'EGRUL') throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      rootSeen = true;
      if (selfClosing) rootClosed = true;
      else stack.push(name);
    } else {
      if (!stack.length) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
      if (!selfClosing) stack.push(name);
    }

    cursor = end + 1;
  }

  if (!rootSeen || !rootClosed || stack.length) throw sourceError('FNS_EGRUL_XML_STRUCTURE_INVALID');
}

function legalEntityBlocks(xml: string): LegalEntityBlock[] {
  const blocks: LegalEntityBlock[] = [];
  const tags = /<\/?СвЮЛ(?=[\s/>])[^>]*>/gu;
  let token: RegExpExecArray | null;

  while ((token = tags.exec(xml))) {
    if (token[0].startsWith('</')) throw sourceError('FNS_EGRUL_XML_UNBALANCED_LEGAL_ENTITY');
    if (token[0].endsWith('/>')) throw sourceError('FNS_EGRUL_EMPTY_LEGAL_ENTITY');
    if (blocks.length >= MAX_RECORDS_PER_XML) throw sourceError('FNS_EGRUL_RECORD_LIMIT_EXCEEDED');

    const opening = token[0].match(/^<СвЮЛ(?=[\s/>])([^>]*)>$/u);
    if (!opening) throw sourceError('FNS_EGRUL_LEGAL_ENTITY_OPEN_TAG_INVALID');
    const bodyStart = tags.lastIndex;
    let depth = 1;
    let bodyEnd = -1;

    while (depth > 0) {
      const nested = tags.exec(xml);
      if (!nested) throw sourceError('FNS_EGRUL_XML_UNBALANCED_LEGAL_ENTITY');
      if (nested[0].startsWith('</')) {
        depth -= 1;
        if (depth === 0) bodyEnd = nested.index;
      } else if (!nested[0].endsWith('/>')) {
        depth += 1;
      }
    }

    blocks.push({ attrs: opening[1], body: xml.slice(bodyStart, bodyEnd) });
  }

  return blocks;
}

function isoDate(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
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

export function isValidRussianOgrn(value: string): boolean {
  const normalized = String(value || '').trim();
  if (!/^\d{13}$/.test(normalized)) return false;
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
  if (/<!DOCTYPE|<!ENTITY|\bSYSTEM\s+["']|\bPUBLIC\s+["']/iu.test(xml)) throw sourceError('FNS_EGRUL_XML_EXTERNAL_ENTITY_FORBIDDEN');
  validateXmlStructure(xml);

  const root = xml.match(/<EGRUL(?=[\s/>])([^>]*)>/u);
  if (!root) throw sourceError('FNS_EGRUL_ROOT_MISSING');
  const rootAttrs = attributes(root[1]);
  const publishedAt = isoDate(rootAttrs['ДатаВыг']);
  if (!publishedAt) throw sourceError('FNS_EGRUL_PUBLICATION_DATE_INVALID');

  const blocks = legalEntityBlocks(xml);
  const records: FnsEgrulNormalizedRecord[] = [];
  const seenOgrn = new Set<string>();

  for (const block of blocks) {
    const top = attributes(block.attrs);
    const body = block.body;
    const inn = String(top['ИНН'] || '').trim();
    const ogrn = String(top['ОГРН'] || '').trim();
    if (!isValidRussianInn(inn) || inn.length !== 10) throw sourceError('FNS_EGRUL_INN_INVALID');
    if (!isValidRussianOgrn(ogrn)) throw sourceError('FNS_EGRUL_OGRN_INVALID');
    if (seenOgrn.has(ogrn)) throw sourceError('FNS_EGRUL_DUPLICATE_OGRN');
    seenOgrn.add(ogrn);

    const nameAttrs = tagAttributes(body, 'СвНаимЮЛ');
    const legalName = String(nameAttrs?.['НаимЮЛПолн'] || top['ПолнНаимОПФ'] || '').trim();
    if (!legalName) throw sourceError('FNS_EGRUL_LEGAL_NAME_MISSING');

    const termination = tagAttributes(body, 'СвПрекрЮЛ');
    const reportedPrimary = tagAttributes(body, 'СвОКВЭДОтчОсн')?.['КодОКВЭД']?.trim() || null;
    const declaredPrimary = tagAttributes(body, 'СвОКВЭДОсн')?.['КодОКВЭД']?.trim() || null;
    const primary = reportedPrimary || declaredPrimary;
    const reportedAdditional = tagsAttributes(body, 'СвОКВЭДОтчДоп')
      .map((entry) => entry['КодОКВЭД']?.trim())
      .filter((value): value is string => Boolean(value));
    const declaredAdditional = tagsAttributes(body, 'СвОКВЭДДоп')
      .map((entry) => entry['КодОКВЭД']?.trim())
      .filter((value): value is string => Boolean(value));
    const additionalOkved = [...new Set([
      ...reportedAdditional,
      ...(reportedPrimary && declaredPrimary ? [declaredPrimary] : []),
      ...declaredAdditional,
    ].filter((code) => code !== primary))].sort();

    const registrationDateRaw = top['ДатаОГРН']?.trim() || null;
    const validFrom = isoDate(registrationDateRaw);
    if (registrationDateRaw && !validFrom) throw sourceError('FNS_EGRUL_REGISTRATION_DATE_INVALID');

    const terminationDateRaw = termination?.['ДатаПрекрЮЛ']?.trim()
      || termination?.['ДатаЗаписиПрекрЮЛ']?.trim()
      || termination?.['ДатаЗаписи']?.trim()
      || null;
    const terminatedAt = isoDate(terminationDateRaw);
    if (terminationDateRaw && !terminatedAt) throw sourceError('FNS_EGRUL_TERMINATION_DATE_INVALID');
    const active = !termination;

    records.push({
      sourceRecordId: ogrn,
      subjectInn: inn,
      subjectOgrn: ogrn,
      recordType: 'EGRUL_LEGAL_ENTITY',
      normalizedPayload: {
        inn,
        ogrn,
        kpp: String(top['КПП'] || '').trim() || null,
        legalName,
        active,
        status: active ? 'ACTIVE' : 'TERMINATED',
        primaryOkved: primary,
        additionalOkved,
        strongContradiction: false,
      },
      validFrom,
      validUntil: terminatedAt,
    });
  }

  if (!records.length) throw sourceError('FNS_EGRUL_EMPTY_XML');
  return { publishedAt, records };
}
