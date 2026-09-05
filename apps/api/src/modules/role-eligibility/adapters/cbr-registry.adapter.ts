import { Injectable } from '@nestjs/common';
import {
  decodeUtf8Strict,
  fetchOfficialSource,
  sha256,
  stableJson,
  withParserTimeout,
} from '../role-eligibility-security';
import type { RegistryAdapterFetchResult } from '../role-eligibility.types';
import { EligibilitySourceError } from '../role-eligibility.types';

const CBR_FULL_LIST_URL = 'https://www.cbr.ru/banking_sector/credit/FullCoList/';
const PARSER_VERSION = 'cbr-fullcolist-html-v4';
const EXPECTED_HEADERS = [
  '№ п/п',
  'Вид',
  'Регистрационный номер',
  'ОГРН',
  'Наименование',
  'Организационно-правовая форма',
  'Дата регистрации Банком России',
  'Статус лицензии',
  'Местонахождение',
] as const;

type CbrAuthorityRecord = RegistryAdapterFetchResult['records'][number];

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&amp;|&#38;/gi, '&')
    .replace(/&lt;|&#60;/gi, '<')
    .replace(/&gt;|&#62;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function visibleText(html: string): string {
  return decodeEntities(html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function parsePublishedAt(text: string): Date {
  const match = text.match(/по\s+состоянию\s+на\s+(\d{2})\.(\d{2})\.(\d{4})/i);
  if (!match) throw new Error('CBR_PUBLISHED_AT_MISSING');
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) throw new Error('CBR_PUBLISHED_AT_INVALID');
  return date;
}

function authorityTable(html: string): string {
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((match) => match[0]);
  const table = tables.find((candidate) => {
    const text = visibleText(candidate);
    return EXPECTED_HEADERS.every((header) => text.includes(header));
  });
  if (!table) throw new Error('CBR_EXPECTED_AUTHORITY_TABLE_MISSING');
  return table;
}

function extractHeaders(table: string): string[] {
  const headerCells = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => visibleText(match[1])).filter(Boolean);
  if (headerCells.length >= EXPECTED_HEADERS.length) return headerCells.slice(0, EXPECTED_HEADERS.length);
  const firstRow = table.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1] || '';
  return [...firstRow.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) => visibleText(match[1])).filter(Boolean);
}

export function parseCbrAuthorityRow(cells: string[]): CbrAuthorityRecord | null {
  if (cells.length !== EXPECTED_HEADERS.length) return null;
  const [number, kind, registrationNumber, ogrn, legalName, legalForm, registeredAt, licenseStatus] = cells;
  if (!/^\d+$/.test(number)) return null;
  if (!/^\d{1,6}$/.test(registrationNumber)) {
    throw new Error('CBR_ROW_IDENTITY_SCHEMA_CHANGED');
  }

  // The official CBR full list contains historical liquidated organizations
  // registered before OGRN existed; those rows legitimately have an empty OGRN.
  // They cannot match a modern OGRN-backed applicant, so exclude them from the
  // machine authority instead of treating the documented legacy row as schema
  // drift. A non-empty malformed OGRN still fails closed.
  const normalizedOgrn = ogrn.trim();
  if (normalizedOgrn === '') return null;
  if (!/^\d{13}$/.test(normalizedOgrn)) {
    throw new Error('CBR_ROW_IDENTITY_SCHEMA_CHANGED');
  }

  const status = licenseStatus.trim();
  const active = status === '' || /действующ/i.test(status);
  const normalizedPayload = {
    registrationNumber,
    ogrn: normalizedOgrn,
    legalName,
    organizationKind: kind || 'BANK',
    legalForm,
    registeredAt,
    licenseStatus: status || 'Действующая',
    creditOrganization: true,
    active,
    licenseValid: active,
  };
  return {
    sourceRecordId: `${registrationNumber}:${normalizedOgrn}`,
    subjectInn: null,
    subjectOgrn: normalizedOgrn,
    recordType: 'CREDIT_ORGANIZATION',
    normalizedPayload,
    validFrom: null,
    validUntil: null,
  };
}

export function deduplicateCbrAuthorityRecords(records: CbrAuthorityRecord[]): CbrAuthorityRecord[] {
  const unique = new Map<string, { record: CbrAuthorityRecord; fingerprint: string }>();
  for (const record of records) {
    const fingerprint = stableJson(record);
    const existing = unique.get(record.sourceRecordId);
    if (!existing) {
      unique.set(record.sourceRecordId, { record, fingerprint });
      continue;
    }
    if (existing.fingerprint !== fingerprint) {
      throw new Error('CBR_DUPLICATE_SOURCE_RECORD_CONFLICT');
    }
  }
  return [...unique.values()].map(({ record }) => record);
}

function parseRows(table: string) {
  const records: RegistryAdapterFetchResult['records'] = [];
  for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => visibleText(match[1]));
    if (cells.length === 0) continue;
    const record = parseCbrAuthorityRow(cells);
    if (record) records.push(record);
  }
  const uniqueRecords = deduplicateCbrAuthorityRecords(records);
  if (uniqueRecords.length < 100) throw new Error('CBR_CARDINALITY_BELOW_SAFETY_FLOOR');
  return uniqueRecords;
}

@Injectable()
export class CbrRegistryAdapter {
  readonly source = 'CBR' as const;
  readonly sourceName = 'Банк России — список кредитных организаций';
  readonly origin = CBR_FULL_LIST_URL;

  async fetchGeneration(): Promise<RegistryAdapterFetchResult> {
    try {
      const response = await fetchOfficialSource(CBR_FULL_LIST_URL, {
        source: 'CBR',
        allowedHosts: ['www.cbr.ru', 'cbr.ru'],
        maxResponseBytes: 12 * 1024 * 1024,
        timeoutMs: 20_000,
        acceptedContentTypes: ['text/html'],
      });
      const html = decodeUtf8Strict(response.body, 'CBR');
      return await withParserTimeout('CBR', 8_000, () => {
        const publishedAt = parsePublishedAt(visibleText(html));
        const table = authorityTable(html);
        const headers = extractHeaders(table);
        if (headers.length !== EXPECTED_HEADERS.length || headers.some((header, index) => header !== EXPECTED_HEADERS[index])) {
          throw new Error('CBR_EXPECTED_SCHEMA_HEADERS_CHANGED');
        }
        const records = parseRows(table);
        const schemaVersion = sha256(stableJson(EXPECTED_HEADERS));
        return {
          source: 'CBR' as const,
          sourceName: this.sourceName,
          origin: CBR_FULL_LIST_URL,
          publishedAt,
          checkedAt: response.checkedAt,
          parserVersion: PARSER_VERSION,
          schemaVersion,
          contentSha256: sha256(response.body),
          records,
        };
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'CBR_UNKNOWN_FAILURE';
      const schema = /SCHEMA|COLUMN|HEADER|TABLE|CARDINALITY|DUPLICATE/i.test(code);
      throw new EligibilitySourceError('CBR', code, schema ? 'SCHEMA_CHANGED' : 'UNAVAILABLE');
    }
  }
}
