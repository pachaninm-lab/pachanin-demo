import { serverApiUrl, serverAuthHeaders } from './server-api';

export type ReportingDeal = Readonly<{
  id: string;
  status: string | null;
  nextAction: string | null;
  updatedAt: string | null;
}>;

export type ReportingRegistry = Readonly<{
  available: boolean;
  deals: readonly ReportingDeal[];
}>;

const UNAVAILABLE: ReportingRegistry = Object.freeze({
  available: false,
  deals: Object.freeze([]),
});

export async function getReportingRegistry(): Promise<ReportingRegistry> {
  try {
    const response = await fetch(serverApiUrl('/deals'), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!response.ok) return UNAVAILABLE;
    return parseRegistry(await response.json());
  } catch {
    return UNAVAILABLE;
  }
}

function parseRegistry(value: unknown): ReportingRegistry {
  if (!Array.isArray(value)) return UNAVAILABLE;

  const deals: ReportingDeal[] = [];
  for (const item of value.slice(0, 100)) {
    const deal = parseDeal(item);
    if (!deal) return UNAVAILABLE;
    deals.push(deal);
  }

  return Object.freeze({
    available: true,
    deals: Object.freeze(deals),
  });
}

function parseDeal(value: unknown): ReportingDeal | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = requiredText(record.id ?? record.dealId);
  if (!id) return null;

  const updatedAt = optionalDate(record.updatedAt);
  if (record.updatedAt !== null && record.updatedAt !== undefined && record.updatedAt !== '' && !updatedAt) return null;

  return Object.freeze({
    id,
    status: optionalText(record.status),
    nextAction: optionalText(record.nextAction),
    updatedAt,
  });
}

function requiredText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredText(value);
}

function optionalDate(value: unknown): string | null {
  const normalized = optionalText(value);
  if (!normalized) return null;
  return Number.isNaN(Date.parse(normalized)) ? null : normalized;
}
