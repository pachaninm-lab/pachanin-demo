import {
  contentPillarForSlot,
  type MarketingContentPillar as MarketingEditorialPillar,
} from './marketing-editorial-core';
import {
  ALLOWED_RU_MARKETING_CHANNELS,
  type MarketingChannel,
} from './marketing.types';

export const MARKETING_CADENCE_AUDIENCES = [
  'FARMER',
  'BUYER',
  'LOGISTICIAN',
  'DRIVER',
  'ELEVATOR',
  'LAB',
  'SURVEYOR',
  'BANK',
] as const;

export const MARKETING_CONTENT_ANGLES = [
  'PAIN',
  'PROCESS',
  'TRUST',
  'ECONOMICS',
] as const;

export const MARKETING_OPERATING_TIME_ZONE = 'Europe/Moscow' as const;

export type MarketingCadenceAudience = (typeof MARKETING_CADENCE_AUDIENCES)[number];
export type MarketingContentAngle = (typeof MARKETING_CONTENT_ANGLES)[number];

export interface MarketingPublishHistoryItem {
  channel: MarketingChannel;
  audience: MarketingCadenceAudience;
  angle: MarketingContentAngle;
  publishedAt: string;
}

export interface MarketingContentPlanRequest {
  /** Deliberately string: unknown/new channels must fail closed at the boundary. */
  channel: string;
  /** Explicit RFC 3339 timestamp with Z or a numeric offset. */
  now: string;
  /** Authoritative creative slot used by the existing 70/20/10 editorial policy. */
  editorialSlot: number;
  history: readonly MarketingPublishHistoryItem[];
}

export type MarketingContentPlanBlockReason =
  | 'INVALID_REQUEST'
  | 'CHANNEL_NOT_ALLOWLISTED'
  | 'INVALID_TIME'
  | 'INVALID_HISTORY'
  | 'FUTURE_HISTORY'
  | 'DUPLICATE_HISTORY'
  | 'HISTORY_TOO_LARGE'
  | 'CHANNEL_DAILY_LIMIT'
  | 'MIN_INTERVAL';

export type MarketingContentPlanDecision =
  | Readonly<{
    allowed: false;
    reason: MarketingContentPlanBlockReason;
    nextEligibleAt?: string;
  }>
  | Readonly<{
    allowed: true;
    reason: 'ALLOW';
    channel: MarketingChannel;
    audience: MarketingCadenceAudience;
    angle: MarketingContentAngle;
    editorialPillar: MarketingEditorialPillar;
    editorialSlot: number;
    operatingDay: string;
    channelSequence: number;
  }>;

const DAILY_LIMIT: Readonly<Record<MarketingChannel, number>> = Object.freeze({
  TELEGRAM: 3,
  VK: 3,
  DZEN: 1,
  RUTUBE: 1,
  OK: 2,
});

const MIN_INTERVAL_MINUTES: Readonly<Record<MarketingChannel, number>> = Object.freeze({
  TELEGRAM: 180,
  VK: 180,
  DZEN: 720,
  RUTUBE: 720,
  OK: 240,
});

const MAX_HISTORY_ITEMS = 5_000;
const FUTURE_SKEW_MS = 5 * 60 * 1_000;
const ROTATION_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1_000;
const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/u;
const OPERATING_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: MARKETING_OPERATING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const ANGLES_BY_PILLAR = {
  USEFUL: MARKETING_CONTENT_ANGLES,
  PRODUCT_PROOF: ['PROCESS', 'TRUST', 'ECONOMICS'] as const,
  CONVERSION: ['PROCESS', 'TRUST'] as const,
} satisfies Readonly<Record<MarketingEditorialPillar, readonly MarketingContentAngle[]>>;

interface NormalizedHistoryItem extends MarketingPublishHistoryItem {
  at: number;
}

function blocked(
  reason: MarketingContentPlanBlockReason,
  nextEligibleAt?: string,
): MarketingContentPlanDecision {
  return Object.freeze(nextEligibleAt
    ? { allowed: false as const, reason, nextEligibleAt }
    : { allowed: false as const, reason });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isOneOf<const T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/** Strict RFC 3339 parser. It rejects implicit local time and normalized invalid dates. */
function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  const match = RFC3339.exec(value);
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw, fractionRaw = '', zone] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  const millisecond = Number(fractionRaw.padEnd(3, '0'));

  if (year < 2000 || year > 2100 || hour > 23 || minute > 59 || second > 59) return null;

  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const wallClock = new Date(wallClockUtc);
  if (
    wallClock.getUTCFullYear() !== year
    || wallClock.getUTCMonth() !== month - 1
    || wallClock.getUTCDate() !== day
    || wallClock.getUTCHours() !== hour
    || wallClock.getUTCMinutes() !== minute
    || wallClock.getUTCSeconds() !== second
  ) return null;

  if (zone === 'Z') return wallClockUtc;

  const sign = zone[0] === '+' ? 1 : -1;
  const offsetHours = Number(zone.slice(1, 3));
  const offsetMinutes = Number(zone.slice(4, 6));
  if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) return null;
  return wallClockUtc - sign * (offsetHours * 60 + offsetMinutes) * 60_000;
}

function operatingDay(value: number): string {
  const parts = new Map(
    OPERATING_DAY_FORMATTER.formatToParts(new Date(value))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
}

function countKey<T extends MarketingCadenceAudience | MarketingContentAngle>(
  history: readonly NormalizedHistoryItem[],
  key: 'audience' | 'angle',
  candidate: T,
): number {
  return history.reduce((count, item) => count + (item[key] === candidate ? 1 : 0), 0);
}

function pickLeastUsed<T extends MarketingCadenceAudience | MarketingContentAngle>(
  candidates: readonly T[],
  history: readonly NormalizedHistoryItem[],
  key: 'audience' | 'angle',
): T {
  return [...candidates].sort((left, right) => {
    const countDifference = countKey(history, key, left) - countKey(history, key, right);
    if (countDifference !== 0) return countDifference;
    return candidates.indexOf(left) - candidates.indexOf(right);
  })[0];
}

type NormalizedHistoryResult =
  | Readonly<{ ok: true; history: readonly NormalizedHistoryItem[] }>
  | Readonly<{ ok: false; decision: MarketingContentPlanDecision }>;

function normalizeHistory(
  rawHistory: unknown,
  nowMs: number,
): NormalizedHistoryResult {
  if (!Array.isArray(rawHistory)) return Object.freeze({ ok: false, decision: blocked('INVALID_REQUEST') });
  if (rawHistory.length > MAX_HISTORY_ITEMS) {
    return Object.freeze({ ok: false, decision: blocked('HISTORY_TOO_LARGE') });
  }

  const normalized: NormalizedHistoryItem[] = [];
  const identities = new Set<string>();

  for (const rawItem of rawHistory) {
    if (!isRecord(rawItem)) return Object.freeze({ ok: false, decision: blocked('INVALID_HISTORY') });
    if (!isOneOf(rawItem.channel, ALLOWED_RU_MARKETING_CHANNELS)) {
      return Object.freeze({ ok: false, decision: blocked('INVALID_HISTORY') });
    }
    if (!isOneOf(rawItem.audience, MARKETING_CADENCE_AUDIENCES)) {
      return Object.freeze({ ok: false, decision: blocked('INVALID_HISTORY') });
    }
    if (!isOneOf(rawItem.angle, MARKETING_CONTENT_ANGLES)) {
      return Object.freeze({ ok: false, decision: blocked('INVALID_HISTORY') });
    }

    const at = parseTimestamp(rawItem.publishedAt);
    if (at === null) return Object.freeze({ ok: false, decision: blocked('INVALID_HISTORY') });
    if (at > nowMs + FUTURE_SKEW_MS) {
      return Object.freeze({ ok: false, decision: blocked('FUTURE_HISTORY') });
    }

    const identity = `${rawItem.channel}:${at}`;
    if (identities.has(identity)) {
      return Object.freeze({ ok: false, decision: blocked('DUPLICATE_HISTORY') });
    }
    identities.add(identity);

    normalized.push({
      channel: rawItem.channel,
      audience: rawItem.audience,
      angle: rawItem.angle,
      publishedAt: rawItem.publishedAt as string,
      at,
    });
  }

  return Object.freeze({
    ok: true,
    history: Object.freeze(normalized.sort((left, right) => right.at - left.at)),
  });
}

/**
 * Deterministic fail-closed planner for organic social cadence.
 * It does not generate copy, classify advertising or publish. Every creative
 * still has to pass MarketingPolicyService and durable outbox authority.
 */
export function planNextMarketingContent(
  request: MarketingContentPlanRequest,
): MarketingContentPlanDecision;
export function planNextMarketingContent(request: unknown): MarketingContentPlanDecision;
export function planNextMarketingContent(request: unknown): MarketingContentPlanDecision {
  if (!isRecord(request)) return blocked('INVALID_REQUEST');
  if (!isOneOf(request.channel, ALLOWED_RU_MARKETING_CHANNELS)) {
    return blocked('CHANNEL_NOT_ALLOWLISTED');
  }

  const nowMs = parseTimestamp(request.now);
  if (nowMs === null) return blocked('INVALID_TIME');
  if (typeof request.editorialSlot !== 'number' || !Number.isSafeInteger(request.editorialSlot) || request.editorialSlot < 0) {
    return blocked('INVALID_REQUEST');
  }

  const normalizedHistory = normalizeHistory(request.history, nowMs);
  if (normalizedHistory.ok === false) return normalizedHistory.decision;

  const channel = request.channel;
  const channelHistory = normalizedHistory.history.filter((item) => item.channel === channel);
  const currentOperatingDay = operatingDay(nowMs);
  const todayCount = channelHistory.filter((item) => operatingDay(item.at) === currentOperatingDay).length;
  if (todayCount >= DAILY_LIMIT[channel]) return blocked('CHANNEL_DAILY_LIMIT');

  const latestAt = channelHistory[0]?.at;
  if (latestAt !== undefined) {
    const nextEligibleMs = latestAt + MIN_INTERVAL_MINUTES[channel] * 60_000;
    if (nowMs < nextEligibleMs) return blocked('MIN_INTERVAL', new Date(nextEligibleMs).toISOString());
  }

  const rotationHistory = channelHistory.filter((item) => item.at >= nowMs - ROTATION_LOOKBACK_MS);
  const editorialSlot = request.editorialSlot;
  const editorialPillar = contentPillarForSlot(editorialSlot);
  const audience = pickLeastUsed(MARKETING_CADENCE_AUDIENCES, rotationHistory, 'audience');
  const angle = pickLeastUsed(ANGLES_BY_PILLAR[editorialPillar], rotationHistory, 'angle');

  return Object.freeze({
    allowed: true,
    reason: 'ALLOW',
    channel,
    audience,
    angle,
    editorialPillar,
    editorialSlot,
    operatingDay: currentOperatingDay,
    channelSequence: channelHistory.length + 1,
  });
}
