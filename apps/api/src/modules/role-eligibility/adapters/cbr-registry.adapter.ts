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
const PARSER_VERSION = 'cbr-fullcolist-html-v1';
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

function extractHeaders(html: string): string[] {
  const headerCells = [...html.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => visibleText(match[1]));
  return headerCells.filter(Boolean).slice(0, EXPECTED_HEADERS.length);
}

function parseRows(html: string) {
  const records: RegistryAdapterFetchResult['records'] = [];
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => visibleText(match[1]));
    if (cells.length === 0) continue;
    if (cells.length !== EXPECTED_HEADERS.length) throw new Error('CBR_TABLE_COLUMN_COUNT_CHANGED');
    const [number, kind, registrationNumber, ogrn, legalName, legalForm, registeredAt, licenseStatus] = cells;
    if (!/^\d+$/.test(number) || !/^\d{1,6}$/.test(registrationNumber) || !/^\d{13}$/.test(ogrn)) {
      throw new Error('CBR_ROW_IDENTITY_SCHEMA_CHANGED');
    }
    const status = licenseStatus.trim();
    const active = status === '' || /действующ/i.test(status);
    const normalizedPayload = {
      registrationNumber,
      ogrn,
      legalName,
      organizationKind: kind || 'BANK',
      legalForm,
      registeredAt,
      licenseStatus: status || 'Действующая',
      creditOrganization: true,
      active,
      licenseValid: active,
    };
    records.push({
      sourceRecordId: `${registrationNumber}:${ogrn}`,
      subjectInn: null,
      subjectOgrn: ogrn,
      recordType: 'CREDIT_ORGANIZATION',
      normalizedPayload,
      validFrom: null,
      validUntil: active ? null : new Date(0),
    });
  }
  if (records.length < 100) throw new Error('CBR_CARDINALITY_BELOW_SAFETY_FLOOR');
  const unique = new Set(records.map((record) => record.sourceRecordId));
  if (unique.size !== records.length) throw new Error('CBR_DUPLICATE_SOURCE_RECORD');
  return records;
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
        const text = visibleText(html);
        const publishedAt = parsePublishedAt(text);
        const headers = extractHeaders(html);
        if (headers.length !== EXPECTED_HEADERS.length || headers.some((header, index) => header !== EXPECTED_HEADERS[index])) {
          throw new Error('CBR_EXPECTED_SCHEMA_HEADERS_CHANGED');
        }
        const records = parseRows(html);
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
      const schema = /SCHEMA|COLUMN|HEADER|CARDINALITY|DUPLICATE/i.test(code);
      throw new EligibilitySourceError('CBR', code, schema ? 'SCHEMA_CHANGED' : 'UNAVAILABLE');
    }
  }
}
