import { createHash } from 'node:crypto';
import type { MarketingContentClassification } from './marketing.types';

export const TRUSTED_MARKETING_SOURCES = Object.freeze([
  Object.freeze({
    id: 'MCX_RU',
    hosts: Object.freeze(['mcx.gov.ru', 'www.mcx.gov.ru']),
    authority: 1,
    maxAgeHours: 24 * 14,
    kind: 'PRIMARY_GOVERNMENT',
  }),
  Object.freeze({
    id: 'ROSSTAT_RU',
    hosts: Object.freeze(['rosstat.gov.ru', 'www.rosstat.gov.ru']),
    authority: 1,
    maxAgeHours: 24 * 90,
    kind: 'OFFICIAL_STATISTICS',
  }),
  Object.freeze({
    id: 'PRAVO_RU',
    hosts: Object.freeze(['publication.pravo.gov.ru']),
    authority: 1,
    maxAgeHours: 24 * 30,
    kind: 'OFFICIAL_LAW',
  }),
  Object.freeze({
    id: 'CBR_RU',
    hosts: Object.freeze(['cbr.ru', 'www.cbr.ru']),
    authority: 1,
    maxAgeHours: 24 * 7,
    kind: 'REGULATOR',
  }),
  Object.freeze({
    id: 'SPECAGRO_RU',
    hosts: Object.freeze(['specagro.ru', 'www.specagro.ru']),
    authority: 0.95,
    maxAgeHours: 24 * 14,
    kind: 'AGRO_ANALYTICS',
  }),
] as const);

export type TrustedMarketingSourceId = (typeof TRUSTED_MARKETING_SOURCES)[number]['id'];
export type MarketingEditorialTopic =
  | 'PRICE_MARKET'
  | 'QUALITY_LAB'
  | 'LOGISTICS'
  | 'REGULATION'
  | 'FINANCE'
  | 'PLATFORM_PROCESS'
  | 'GENERAL_AGRO';
export type MarketingAudienceRole =
  | 'SELLER'
  | 'BUYER'
  | 'LOGISTICS'
  | 'ELEVATOR'
  | 'LAB'
  | 'BANK'
  | 'SURVEYOR';
export type MarketingContentPillar = 'USEFUL' | 'PRODUCT_PROOF' | 'CONVERSION';

export type RadarQuarantineCode =
  | 'UNKNOWN_SOURCE'
  | 'SOURCE_URL_NOT_TRUSTED'
  | 'INVALID_CONTENT'
  | 'INVALID_TIMESTAMP'
  | 'FUTURE_EVIDENCE'
  | 'STALE_EVIDENCE'
  | 'PROMPT_INJECTION_SUSPECTED'
  | 'DUPLICATE_CONTENT';

export interface MarketingRadarObservation {
  sourceId: string;
  url: string;
  title: string;
  text: string;
  publishedAt: string;
  fetchedAt: string;
  topicHints?: readonly string[];
}

export interface MarketingEvidenceRecord {
  evidenceId: string;
  sourceId: TrustedMarketingSourceId;
  sourceUrl: string;
  sourceKind: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  fetchedAt: string;
  contentSha256: string;
  authorityScore: number;
  maxAgeHours: number;
  topicHints: readonly string[];
}

export type RadarEvidenceDecision =
  | Readonly<{ accepted: true; evidence: MarketingEvidenceRecord }>
  | Readonly<{ accepted: false; code: RadarQuarantineCode }>;

export interface MarketingTopicScore {
  evidenceId: string;
  contentSha256: string;
  topic: MarketingEditorialTopic;
  targetRoles: readonly MarketingAudienceRole[];
  relevance: number;
  authority: number;
  freshness: number;
  novelty: number;
  conversionPotential: number;
  total: number;
  eligible: boolean;
}

export interface MarketingContentPlan {
  pillar: MarketingContentPillar;
  series: string;
  topic: MarketingEditorialTopic;
  targetRoles: readonly MarketingAudienceRole[];
  evidenceIds: readonly string[];
  classificationHint: MarketingContentClassification;
  requiresLegalClassification: boolean;
  requiresEvidence: true;
  requiresFreshness: true;
  callToAction: 'NONE' | 'SOFT_PRODUCT_PROOF' | 'QWO_WAITLIST';
}

const SOURCE_BY_ID = new Map<string, (typeof TRUSTED_MARKETING_SOURCES)[number]>(
  TRUSTED_MARKETING_SOURCES.map((source) => [source.id, source]),
);
const MAX_TITLE_CHARS = 500;
const MAX_TEXT_CHARS = 12_000;
const MAX_EXCERPT_CHARS = 4_000;
const FUTURE_SKEW_MS = 5 * 60 * 1_000;
const MIN_TOPIC_SCORE = 0.62;

const PROMPT_INJECTION_PATTERNS = Object.freeze([
  /ignore\s+(?:all\s+)?previous\s+instructions/iu,
  /игнорируй\s+(?:все\s+)?(?:предыдущие\s+)?инструкц/iu,
  /system\s+prompt/iu,
  /developer\s+message/iu,
  /раскрой\s+(?:системн|служебн)\w*\s+(?:промпт|инструкц)/iu,
  /<\/?(?:system|assistant|developer)>/iu,
]);

const TOPIC_TERMS: Readonly<Record<MarketingEditorialTopic, readonly string[]>> = Object.freeze({
  PRICE_MARKET: Object.freeze(['цена', 'стоимость', 'котиров', 'рынок', 'экспорт', 'запас', 'зерн', 'пшениц', 'урожай']),
  QUALITY_LAB: Object.freeze(['качество', 'лаборатор', 'проб', 'влажност', 'клейковин', 'протеин', 'заражен', 'отклонен']),
  LOGISTICS: Object.freeze(['логист', 'перевоз', 'вагон', 'ржд', 'маршрут', 'достав', 'отгруз', 'элеватор']),
  REGULATION: Object.freeze(['закон', 'постановлен', 'приказ', 'регулирован', 'фгис', 'мониторинг', 'требован', 'правил']),
  FINANCE: Object.freeze(['ставк', 'кредит', 'финанс', 'банк', 'факторинг', 'расчет', 'платеж', 'субсид']),
  PLATFORM_PROCESS: Object.freeze(['сделк', 'договор', 'документ', 'спор', 'приемк', 'окончательн', 'расчет']),
  GENERAL_AGRO: Object.freeze(['апк', 'аграр', 'сельхоз', 'растениевод', 'посевн', 'фермер', 'урожай']),
});

const ROLE_TERMS: Readonly<Record<MarketingAudienceRole, readonly string[]>> = Object.freeze({
  SELLER: Object.freeze(['фермер', 'производител', 'сельхозтоваропроизвод', 'продавец', 'аграри']),
  BUYER: Object.freeze(['покупател', 'закуп', 'трейдер', 'переработ']),
  LOGISTICS: Object.freeze(['логист', 'перевоз', 'транспорт', 'ржд', 'вагон']),
  ELEVATOR: Object.freeze(['элеватор', 'хранен', 'зернохранил']),
  LAB: Object.freeze(['лаборатор', 'проб', 'качество', 'испытан']),
  BANK: Object.freeze(['банк', 'кредит', 'финанс', 'факторинг', 'платеж']),
  SURVEYOR: Object.freeze(['сюрвей', 'инспекц', 'осмотр', 'контроль качества']),
});

function cleanText(value: unknown, maxChars: number): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxChars);
}

function roundScore(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function trustedSourceUrl(raw: unknown, source: (typeof TRUSTED_MARKETING_SOURCES)[number]): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.port
      || !source.hosts.includes(url.hostname.toLowerCase() as never)
    ) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function looksLikePromptInjection(value: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

function canonicalEvidenceHash(sourceId: string, title: string, text: string): string {
  return createHash('sha256')
    .update([sourceId, title, text].join('\n'), 'utf8')
    .digest('hex');
}

function hasValidEvidenceIdentity(
  evidence: MarketingEvidenceRecord,
  source: (typeof TRUSTED_MARKETING_SOURCES)[number],
): boolean {
  if (typeof evidence.contentSha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(evidence.contentSha256)) return false;
  const expectedEvidenceId = `mktev.v1.${source.id.toLowerCase()}.${evidence.contentSha256.slice(0, 24)}`;
  return evidence.evidenceId === expectedEvidenceId
    && trustedSourceUrl(evidence.sourceUrl, source) !== null
    && evidence.sourceKind === source.kind
    && evidence.authorityScore === source.authority
    && evidence.maxAgeHours === source.maxAgeHours;
}

export function normalizeMarketingRadarObservation(
  observation: MarketingRadarObservation,
  nowMs: number = Date.now(),
  knownContentHashes: ReadonlySet<string> = new Set<string>(),
): RadarEvidenceDecision {
  const sourceId = cleanText(observation.sourceId, 80);
  const source = SOURCE_BY_ID.get(sourceId);
  if (!source) return Object.freeze({ accepted: false, code: 'UNKNOWN_SOURCE' });

  const sourceUrl = trustedSourceUrl(observation.url, source);
  if (!sourceUrl) return Object.freeze({ accepted: false, code: 'SOURCE_URL_NOT_TRUSTED' });

  const title = cleanText(observation.title, MAX_TITLE_CHARS);
  const text = cleanText(observation.text, MAX_TEXT_CHARS);
  if (title.length < 8 || text.length < 40) {
    return Object.freeze({ accepted: false, code: 'INVALID_CONTENT' });
  }

  if (looksLikePromptInjection(`${title}\n${text}`)) {
    return Object.freeze({ accepted: false, code: 'PROMPT_INJECTION_SUSPECTED' });
  }

  const publishedAtMs = parseTimestamp(observation.publishedAt);
  const fetchedAtMs = parseTimestamp(observation.fetchedAt);
  if (publishedAtMs === null || fetchedAtMs === null) {
    return Object.freeze({ accepted: false, code: 'INVALID_TIMESTAMP' });
  }
  if (
    !Number.isFinite(nowMs)
    || publishedAtMs > nowMs + FUTURE_SKEW_MS
    || fetchedAtMs > nowMs + FUTURE_SKEW_MS
    || publishedAtMs > fetchedAtMs + FUTURE_SKEW_MS
  ) {
    return Object.freeze({ accepted: false, code: 'FUTURE_EVIDENCE' });
  }

  const maxAgeMs = source.maxAgeHours * 60 * 60 * 1_000;
  if (nowMs - publishedAtMs > maxAgeMs) {
    return Object.freeze({ accepted: false, code: 'STALE_EVIDENCE' });
  }

  const contentSha256 = canonicalEvidenceHash(source.id, title, text);
  if (knownContentHashes.has(contentSha256)) {
    return Object.freeze({ accepted: false, code: 'DUPLICATE_CONTENT' });
  }

  const evidenceId = `mktev.v1.${source.id.toLowerCase()}.${contentSha256.slice(0, 24)}`;
  const topicHints = Object.freeze(
    [...new Set((observation.topicHints ?? []).map((hint) => cleanText(hint, 80)).filter(Boolean))].slice(0, 12),
  );

  return Object.freeze({
    accepted: true,
    evidence: Object.freeze({
      evidenceId,
      sourceId: source.id,
      sourceUrl,
      sourceKind: source.kind,
      title,
      excerpt: text.slice(0, MAX_EXCERPT_CHARS),
      publishedAt: new Date(publishedAtMs).toISOString(),
      fetchedAt: new Date(fetchedAtMs).toISOString(),
      contentSha256,
      authorityScore: source.authority,
      maxAgeHours: source.maxAgeHours,
      topicHints,
    }),
  });
}

function normalizedCorpus(evidence: MarketingEvidenceRecord): string {
  const topicHints = Array.isArray(evidence.topicHints)
    ? evidence.topicHints.map((hint) => cleanText(hint, 80)).filter(Boolean)
    : [];
  return `${cleanText(evidence.title, MAX_TITLE_CHARS)} ${cleanText(evidence.excerpt, MAX_EXCERPT_CHARS)} ${topicHints.join(' ')}`
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/gu, 'е');
}

function countMatches(corpus: string, terms: readonly string[]): number {
  return terms.reduce((count, term) => count + (corpus.includes(term) ? 1 : 0), 0);
}

function selectTopic(corpus: string): MarketingEditorialTopic {
  let selected: MarketingEditorialTopic = 'GENERAL_AGRO';
  let bestMatches = 0;
  for (const [topic, terms] of Object.entries(TOPIC_TERMS) as [MarketingEditorialTopic, readonly string[]][]) {
    const matches = countMatches(corpus, terms);
    if (matches > bestMatches) {
      selected = topic;
      bestMatches = matches;
    }
  }
  return selected;
}

function selectRoles(corpus: string): MarketingAudienceRole[] {
  return (Object.entries(ROLE_TERMS) as [MarketingAudienceRole, readonly string[]][])
    .filter(([, terms]) => countMatches(corpus, terms) > 0)
    .map(([role]) => role);
}

export function scoreMarketingEvidence(
  evidence: MarketingEvidenceRecord,
  nowMs: number = Date.now(),
  recentTopicKeys: ReadonlySet<string> = new Set<string>(),
): MarketingTopicScore {
  const sourceId = cleanText(evidence.sourceId, 80);
  const source = SOURCE_BY_ID.get(sourceId);
  const identityValid = source ? hasValidEvidenceIdentity(evidence, source) : false;
  const publishedAtMs = parseTimestamp(evidence.publishedAt);
  const fetchedAtMs = parseTimestamp(evidence.fetchedAt);
  const maxAgeMs = (source?.maxAgeHours ?? 1) * 60 * 60 * 1_000;
  const temporalValid = Boolean(
    identityValid
    && Number.isFinite(nowMs)
    && publishedAtMs !== null
    && fetchedAtMs !== null
    && publishedAtMs <= nowMs + FUTURE_SKEW_MS
    && fetchedAtMs <= nowMs + FUTURE_SKEW_MS
    && publishedAtMs <= fetchedAtMs + FUTURE_SKEW_MS
    && nowMs - publishedAtMs <= maxAgeMs,
  );
  const validEvidence = identityValid && temporalValid;

  const corpus = normalizedCorpus(evidence);
  const topic = selectTopic(corpus);
  const targetRoles = Object.freeze(selectRoles(corpus));
  const topicMatches = countMatches(corpus, TOPIC_TERMS[topic]);

  const relevance = validEvidence && topicMatches > 0
    ? clamp01(0.38 + Math.min(topicMatches, 4) * 0.12 + Math.min(targetRoles.length, 3) * 0.06)
    : 0;
  const authority = validEvidence && source ? source.authority : 0;
  const ageMs = validEvidence && publishedAtMs !== null ? Math.max(0, nowMs - publishedAtMs) : maxAgeMs;
  const freshness = validEvidence ? clamp01(1 - ageMs / maxAgeMs) : 0;
  const topicKey = `${topic}:${targetRoles.slice().sort().join(',') || 'ALL'}`;
  const novelty = validEvidence ? (recentTopicKeys.has(topicKey) ? 0.28 : 0.9) : 0;
  const conversionPotential = validEvidence
    ? clamp01(
      0.42
      + Math.min(targetRoles.length, 4) * 0.1
      + (topic === 'QUALITY_LAB' || topic === 'LOGISTICS' || topic === 'FINANCE' || topic === 'PLATFORM_PROCESS' ? 0.12 : 0),
    )
    : 0;
  const total = roundScore(
    relevance * 0.32
    + authority * 0.24
    + freshness * 0.18
    + novelty * 0.14
    + conversionPotential * 0.12,
  );

  return Object.freeze({
    evidenceId: identityValid ? evidence.evidenceId : '',
    contentSha256: identityValid ? evidence.contentSha256 : '',
    topic,
    targetRoles,
    relevance: roundScore(relevance),
    authority: roundScore(authority),
    freshness: roundScore(freshness),
    novelty: roundScore(novelty),
    conversionPotential: roundScore(conversionPotential),
    total,
    eligible: validEvidence && topicMatches > 0 && total >= MIN_TOPIC_SCORE,
  });
}

export function contentPillarForSlot(slot: number): MarketingContentPillar {
  const normalized = ((Math.trunc(slot) % 10) + 10) % 10;
  if (normalized <= 6) return 'USEFUL';
  if (normalized <= 8) return 'PRODUCT_PROOF';
  return 'CONVERSION';
}

function seriesForTopic(topic: MarketingEditorialTopic): string {
  switch (topic) {
    case 'PRICE_MARKET': return 'Цена и качество: где теряются деньги';
    case 'QUALITY_LAB': return 'Цена и качество: где теряются деньги';
    case 'LOGISTICS': return 'Разбор сделки';
    case 'REGULATION': return 'Что изменилось в АПК';
    case 'FINANCE': return 'ГЕКТА отвечает';
    case 'PLATFORM_PROCESS': return '1 проблема — 1 экран платформы';
    default: return 'ГЕКТА отвечает';
  }
}

export function planMarketingContent(
  evidence: MarketingEvidenceRecord,
  editorialSlot: number,
  nowMs: number = Date.now(),
  recentTopicKeys: ReadonlySet<string> = new Set<string>(),
): MarketingContentPlan | null {
  const score = scoreMarketingEvidence(evidence, nowMs, recentTopicKeys);
  if (!score.eligible) return null;
  const pillar = contentPillarForSlot(editorialSlot);
  const promotional = pillar !== 'USEFUL';

  return Object.freeze({
    pillar,
    series: seriesForTopic(score.topic),
    topic: score.topic,
    targetRoles: score.targetRoles,
    evidenceIds: Object.freeze([score.evidenceId]),
    classificationHint: promotional ? 'UNCERTAIN' : 'INFORMATIONAL',
    requiresLegalClassification: promotional,
    requiresEvidence: true,
    requiresFreshness: true,
    callToAction: pillar === 'CONVERSION' ? 'QWO_WAITLIST' : pillar === 'PRODUCT_PROOF' ? 'SOFT_PRODUCT_PROOF' : 'NONE',
  });
}
