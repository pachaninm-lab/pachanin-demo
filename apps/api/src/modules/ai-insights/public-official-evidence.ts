import { createHash } from 'node:crypto';

const MAX_SOURCE_RESPONSE_BYTES = 524_288;
const MAX_SOURCE_EXCERPT_CHARS = 6_000;
const MAX_EVIDENCE_SOURCES = 3;
const DEFAULT_SOURCE_TIMEOUT_MS = 4_500;
const DEFAULT_CACHE_TTL_MS = 600_000;
const REDIRECT_LIMIT = 2;

export type PublicEvidenceLocale = 'ru' | 'en' | 'zh';
export type PublicEvidenceStatus = 'not_requested' | 'available' | 'partial' | 'unavailable';

export type PublicOfficialCitation = Readonly<{
  sourceId: string;
  title: string;
  owner: string;
  uri: string;
  geography: string;
  publishedAt: string;
  retrievedAt: string;
  observationPeriod: Readonly<{
    start: string | null;
    end: string;
    precision: 'publication_date';
  }>;
  topics: readonly string[];
}>;

export type PublicOfficialEvidence = PublicOfficialCitation & Readonly<{
  excerpt: string;
  contentSha256: string;
  excerptSha256: string;
}>;

export type PublicOfficialEvidenceBundle = Readonly<{
  requested: boolean;
  status: PublicEvidenceStatus;
  classifications: readonly string[];
  sources: readonly PublicOfficialEvidence[];
  unavailableSourceIds: readonly string[];
  retrievedAt: string;
}>;

type SourceDefinition = Readonly<{
  sourceId: string;
  title: string;
  owner: string;
  uri: string;
  allowedHosts: readonly string[];
  geography: string;
  topics: readonly string[];
  selectors: readonly RegExp[];
  markerTerms: readonly string[];
  maximumPublicationAgeMs: number;
}>;

type CacheEntry = Readonly<{
  expiresAtMs: number;
  evidence: PublicOfficialEvidence;
}>;

const DAY_MS = 86_400_000;

const SOURCES: readonly SourceDefinition[] = Object.freeze([
  Object.freeze({
    sourceId: 'official.specagro.news',
    title: 'Центр Агроаналитики — новости АПК',
    owner: 'ФГБУ «Центр Агроаналитики»',
    uri: 'https://specagro.ru/news',
    allowedHosts: Object.freeze(['specagro.ru', 'www.specagro.ru']),
    geography: 'Российская Федерация',
    topics: Object.freeze(['AGRO_NEWS', 'MARKET_PRICES', 'EXPORT_IMPORT', 'STATE_SUPPORT', 'MACHINERY']),
    selectors: Object.freeze([
      /новост|событи|последн|свеж|news|latest|recent|新闻|最新/iu,
      /экспорт|импорт|рынок|цен[аы]|господдерж|субсид|техник|export|import|market|price|support|subsid|machinery|出口|进口|市场|价格|补贴|农机/iu,
    ]),
    markerTerms: Object.freeze(['Новости', 'Российская Федерация', 'Растениеводство', 'Экспорт и импорт']),
    maximumPublicationAgeMs: 45 * DAY_MS,
  }),
  Object.freeze({
    sourceId: 'official.rosstat.agriculture',
    title: 'Росстат — сельское хозяйство',
    owner: 'Федеральная служба государственной статистики',
    uri: 'https://rosstat.gov.ru/enterprise_economy',
    allowedHosts: Object.freeze(['rosstat.gov.ru', 'www.rosstat.gov.ru']),
    geography: 'Российская Федерация',
    topics: Object.freeze(['AGRICULTURE_PRODUCTION', 'PLANTED_AREA', 'YIELD', 'HARVEST', 'HISTORICAL_STATISTICS']),
    selectors: Object.freeze([
      /статист|урожайн|урожай|валов|посевн|площад|производств|statistics|yield|harvest|planted|production|统计|单产|收获|播种|产量/iu,
      /сколько|динамик|по год|за \d{4}|how much|trend|by year|多少|趋势|年度/iu,
    ]),
    markerTerms: Object.freeze(['Сельское хозяйство', 'Растениеводство', 'Производство', 'Росстат']),
    maximumPublicationAgeMs: 180 * DAY_MS,
  }),
  Object.freeze({
    sourceId: 'official.meteoinfo.weather-bulletin',
    title: 'Гидрометцентр России — гидрометеорологический бюллетень',
    owner: 'ФГБУ «Гидрометцентр России» Росгидромета',
    uri: 'https://meteoinfo.ru/egmb',
    allowedHosts: Object.freeze(['meteoinfo.ru', 'www.meteoinfo.ru', 'mpr.meteoinfo.ru', 'pogoda.meteoinfo.ru']),
    geography: 'Российская Федерация; детализация по указанным в бюллетене регионам',
    topics: Object.freeze(['WEATHER', 'AGROMETEOROLOGY', 'HAZARDOUS_WEATHER']),
    selectors: Object.freeze([
      /погод|осадк|дожд|засух|температур|замороз|град|ветер|агрометео|weather|rain|drought|temperature|frost|hail|wind|天气|降水|干旱|温度|霜冻|冰雹|风/iu,
      /прогноз|сегодня|завтра|недел|forecast|today|tomorrow|week|预报|今天|明天|本周/iu,
    ]),
    markerTerms: Object.freeze(['ГИДРОМЕТЕОРОЛОГИЧЕСКИЙ БЮЛЛЕТЕНЬ', 'ПРОГНОЗ', 'Гидрометцентр России']),
    maximumPublicationAgeMs: 4 * DAY_MS,
  }),
  Object.freeze({
    sourceId: 'official.pravo.mcx-regulation',
    title: 'Официальное опубликование — акты Минсельхоза России',
    owner: 'Официальный интернет-портал правовой информации',
    uri: 'https://publication.pravo.gov.ru/documents/block/foiv266',
    allowedHosts: Object.freeze(['publication.pravo.gov.ru']),
    geography: 'Российская Федерация',
    topics: Object.freeze(['AGRICULTURAL_LAW', 'REGULATION', 'SUBSIDIES', 'SEEDS', 'SOILS']),
    selectors: Object.freeze([
      /закон|правил|приказ|постановлен|регулирован|норматив|субсид|льгот|семен|почв|law|regulation|order|decree|subsid|seed|soil|法律|法规|命令|补贴|种子|土壤/iu,
      /вступ|изменен|действу|опублик|current|effective|amend|published|生效|修订|发布/iu,
    ]),
    markerTerms: Object.freeze(['Министерство сельского хозяйства Российской Федерации', 'Дата опубликования', 'Приказ']),
    maximumPublicationAgeMs: 400 * DAY_MS,
  }),
  Object.freeze({
    sourceId: 'official.cbr.key-rate',
    title: 'Банк России — ключевая ставка',
    owner: 'Центральный банк Российской Федерации',
    uri: 'https://www.cbr.ru/hd_base/KeyRate/',
    allowedHosts: Object.freeze(['www.cbr.ru', 'cbr.ru']),
    geography: 'Российская Федерация',
    topics: Object.freeze(['FINANCE_RATES', 'CREDIT_COST']),
    selectors: Object.freeze([
      /ключев.*ставк|ставк.*цб|банк.*росси|кредит|финансирован|key rate|central bank|credit|financing|关键利率|央行|信贷|融资/iu,
    ]),
    markerTerms: Object.freeze(['Ключевая ставка', 'Банк России', 'Дата']),
    maximumPublicationAgeMs: 45 * DAY_MS,
  }),
  Object.freeze({
    sourceId: 'official.mintrans.rail-tariffs',
    title: 'Минтранс России — железнодорожные тарифы',
    owner: 'Министерство транспорта Российской Федерации',
    uri: 'https://mintrans.gov.ru/activities/222/documents',
    allowedHosts: Object.freeze(['mintrans.gov.ru', 'www.mintrans.gov.ru']),
    geography: 'Российская Федерация',
    topics: Object.freeze(['LOGISTICS', 'RAIL_TARIFFS', 'FREIGHT']),
    selectors: Object.freeze([
      /логист|перевоз|железнодорож|вагон|тариф|фрахт|доставк|logistics|rail|wagon|tariff|freight|delivery|物流|铁路|车皮|运价|货运|交付/iu,
    ]),
    markerTerms: Object.freeze(['Документы', 'железнодорож', 'тариф', 'Минтранс']),
    maximumPublicationAgeMs: 400 * DAY_MS,
  }),
  Object.freeze({
    sourceId: 'official.eec.grain-regulation',
    title: 'ЕЭК — регулирование и качество зерна',
    owner: 'Евразийская экономическая комиссия',
    uri: 'https://eec.eaeunion.org/news/vstupaet-v-silu-obnovlennyy-perechen-standartov-k-tekhreglamentu-na-zerno/',
    allowedHosts: Object.freeze(['eec.eaeunion.org']),
    geography: 'Евразийский экономический союз',
    topics: Object.freeze(['GRAIN_REGULATION', 'GRAIN_QUALITY', 'STANDARDS']),
    selectors: Object.freeze([
      /зерн.*качеств|стандарт|техрегламент|еаэс|еэк|grain quality|standard|technical regulation|eaeu|谷物质量|标准|技术法规|欧亚经济联盟/iu,
    ]),
    markerTerms: Object.freeze(['зерно', 'стандарт', 'техрегламент', 'Евразийская экономическая комиссия']),
    maximumPublicationAgeMs: 800 * DAY_MS,
  }),
  Object.freeze({
    sourceId: 'official.rosselhoscenter.agronomy',
    title: 'Россельхозцентр — агрономические рекомендации',
    owner: 'ФГБУ «Российский сельскохозяйственный центр»',
    uri: 'https://rosselhoscenter.ru/ob-uchrezhdenii/filialy/tsentralnyy-okrug/moskva/podgotovlen-fitosanitarnyy-prognoz-razvitiya-vrednykh-obektov-v-rf-na-2026-god/',
    allowedHosts: Object.freeze(['rosselhoscenter.ru', 'www.rosselhoscenter.ru']),
    geography: 'Российская Федерация',
    topics: Object.freeze(['AGRONOMY', 'SEEDS', 'FERTILIZERS', 'CROP_PROTECTION']),
    selectors: Object.freeze([
      /агроном|удобрен|семен|посев|защит.*растен|вредител|болезн.*растен|agronom|fertiliz|seed|sowing|crop protection|pest|plant disease|农艺|肥料|种子|播种|植保|害虫|病害/iu,
    ]),
    markerTerms: Object.freeze(['Россельхозцентр', 'прогноз', 'растений', 'сельскохозяйственных культур']),
    maximumPublicationAgeMs: 400 * DAY_MS,
  }),
  Object.freeze({
    sourceId: 'official.specagro.fgis-grain',
    title: 'Центр Агроаналитики — ФГИС «Зерно»',
    owner: 'ФГБУ «Центр Агроаналитики» — оператор ФГИС «Зерно»',
    uri: 'https://specagro.ru/fgis/ok',
    allowedHosts: Object.freeze(['specagro.ru', 'www.specagro.ru']),
    geography: 'Российская Федерация',
    topics: Object.freeze(['GRAIN_TRACEABILITY', 'STORAGE', 'ELEVATORS', 'QUALITY_DOCUMENTS']),
    selectors: Object.freeze([
      /фгис.*зерн|сдиз|прослеживаем|элеватор|хранен|партия.*зерн|fgis|grain trace|elevator|storage|grain lot|粮食系统|追溯|筒仓|仓储|粮食批次/iu,
    ]),
    markerTerms: Object.freeze(['ФГИС', 'Зерно', 'ОКПД2', 'прослеживаем']),
    maximumPublicationAgeMs: 400 * DAY_MS,
  }),
]);

const CURRENT_HINT = /(?:сегодня|сейчас|текущ|актуаль|последн|свеж|новост|на\s+данный\s+момент|за\s+20\d{2}|в\s+20\d{2}|по\s+состоянию|latest|current|today|recent|news|as\s+of|in\s+20\d{2}|最新|当前|今天|近期|新闻|截至|20\d{2}年)/iu;
const EXACT_DYNAMIC_FACT = /(?:какая\s+цена|сколько\s+стоит|ключев.*ставк|погода|прогноз|статистик|урожайн|посевн.*площад|валов.*сбор|экспорт|импорт|тариф|субсид|господдерж|вступ.*сил|действующ.*закон|what\s+is\s+the\s+price|how\s+much|key\s+rate|weather|forecast|statistics|yield|planted\s+area|harvest|export|import|tariff|subsid|current\s+law|价格是多少|多少钱|关键利率|天气|预报|统计|单产|播种面积|收获|出口|进口|运价|补贴|现行法律)/iu;
const WORD_PATTERN = /[\p{L}\p{N}]{3,}/gu;
const DATE_ISO_PATTERN = /\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/gu;
const DATE_DMY_PATTERN = /\b(0?[1-9]|[12]\d|3[01])[./-](0?[1-9]|1[0-2])[./-](20\d{2})\b/gu;
const DATE_RU_PATTERN = /\b(0?[1-9]|[12]\d|3[01])\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(20\d{2})\b/giu;
const RU_MONTHS: Readonly<Record<string, number>> = Object.freeze({
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12,
});

const cache = new Map<string, CacheEntry>();

export async function collectPublicOfficialEvidence(
  question: string,
  locale: PublicEvidenceLocale,
  options: Readonly<{
    fetchImpl?: typeof fetch;
    now?: () => Date;
    environment?: NodeJS.ProcessEnv;
  }> = {},
): Promise<PublicOfficialEvidenceBundle> {
  const now = options.now?.() ?? new Date();
  const retrievedAt = now.toISOString();
  const normalized = normalizeText(question, 1_200);
  const classifications = classifyCurrentQuestion(normalized);
  const requested = classifications.length > 0;
  if (!requested) {
    return Object.freeze({
      requested: false,
      status: 'not_requested',
      classifications: Object.freeze([]),
      sources: Object.freeze([]),
      unavailableSourceIds: Object.freeze([]),
      retrievedAt,
    });
  }

  const environment = options.environment ?? process.env;
  if ((environment.TAI_PUBLIC_LIVE_OFFICIAL_SOURCES_ENABLED || '').trim().toLowerCase() === 'false') {
    return Object.freeze({
      requested: true,
      status: 'unavailable',
      classifications: Object.freeze(classifications),
      sources: Object.freeze([]),
      unavailableSourceIds: Object.freeze(selectSources(normalized).map((source) => source.sourceId)),
      retrievedAt,
    });
  }

  const selected = selectSources(normalized);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = boundedInteger(environment.TAI_PUBLIC_SOURCE_TIMEOUT_MS, DEFAULT_SOURCE_TIMEOUT_MS, 1_000, 12_000);
  const cacheTtlMs = boundedInteger(environment.TAI_PUBLIC_SOURCE_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS, 30_000, 3_600_000);
  const settled = await Promise.all(selected.map(async (source) => {
    try {
      return await collectSource(source, normalized, fetchImpl, now, timeoutMs, cacheTtlMs);
    } catch {
      return null;
    }
  }));
  const sources = settled.filter((value): value is PublicOfficialEvidence => value !== null);
  const availableIds = new Set(sources.map((source) => source.sourceId));
  const unavailableSourceIds = selected
    .map((source) => source.sourceId)
    .filter((sourceId) => !availableIds.has(sourceId));
  const status: PublicEvidenceStatus = sources.length === 0
    ? 'unavailable'
    : sources.length === selected.length
      ? 'available'
      : 'partial';

  return Object.freeze({
    requested: true,
    status,
    classifications: Object.freeze(classifications),
    sources: Object.freeze(sources),
    unavailableSourceIds: Object.freeze(unavailableSourceIds),
    retrievedAt,
  });
}

export function publicCitation(source: PublicOfficialEvidence): PublicOfficialCitation {
  return Object.freeze({
    sourceId: source.sourceId,
    title: source.title,
    owner: source.owner,
    uri: source.uri,
    geography: source.geography,
    publishedAt: source.publishedAt,
    retrievedAt: source.retrievedAt,
    observationPeriod: source.observationPeriod,
    topics: source.topics,
  });
}

export function resetPublicOfficialEvidenceCacheForTests(): void {
  cache.clear();
}

function classifyCurrentQuestion(question: string): string[] {
  if (!CURRENT_HINT.test(question) && !EXACT_DYNAMIC_FACT.test(question)) return [];
  const classifications: string[] = [];
  for (const source of SOURCES) {
    if (source.selectors.some((selector) => selector.test(question))) {
      for (const topic of source.topics) {
        if (!classifications.includes(topic)) classifications.push(topic);
      }
    }
  }
  if (classifications.length === 0) classifications.push('CURRENT_AGRO_FACT');
  return classifications.slice(0, 12);
}

function selectSources(question: string): readonly SourceDefinition[] {
  const ranked = SOURCES.map((source, index) => ({
    source,
    index,
    score: source.selectors.reduce((score, selector) => score + (selector.test(question) ? 10 : 0), 0),
  }));
  const matched = ranked.filter((entry) => entry.score > 0);
  const candidates = matched.length > 0
    ? matched
    : ranked.filter((entry) => ['official.specagro.news', 'official.rosstat.agriculture', 'official.pravo.mcx-regulation'].includes(entry.source.sourceId));
  return Object.freeze(candidates
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, MAX_EVIDENCE_SOURCES)
    .map((entry) => entry.source));
}

async function collectSource(
  source: SourceDefinition,
  question: string,
  fetchImpl: typeof fetch,
  now: Date,
  timeoutMs: number,
  cacheTtlMs: number,
): Promise<PublicOfficialEvidence> {
  const cached = cache.get(source.sourceId);
  if (cached && cached.expiresAtMs > now.getTime()) return cached.evidence;

  const response = await fetchWithGovernedRedirects(source, fetchImpl, timeoutMs);
  if (!response.ok) throw new Error(`official_source_http_${response.status}`);
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new Error('official_source_content_type_forbidden');
  }
  const body = await readBoundedText(response, MAX_SOURCE_RESPONSE_BYTES);
  const visibleText = htmlToVisibleText(body);
  const publishedAt = latestPublicationDate(visibleText, now);
  if (!publishedAt) throw new Error('official_source_publication_date_missing');
  if (now.getTime() - publishedAt.getTime() > source.maximumPublicationAgeMs) {
    throw new Error('official_source_publication_stale');
  }
  const excerpt = buildRelevantExcerpt(visibleText, question, source, publishedAt);
  const contentSha256 = createHash('sha256').update(body, 'utf8').digest('hex');
  const excerptSha256 = createHash('sha256').update(excerpt, 'utf8').digest('hex');
  const evidence: PublicOfficialEvidence = Object.freeze({
    sourceId: source.sourceId,
    title: source.title,
    owner: source.owner,
    uri: source.uri,
    geography: source.geography,
    publishedAt: publishedAt.toISOString(),
    retrievedAt: now.toISOString(),
    observationPeriod: Object.freeze({
      start: null,
      end: publishedAt.toISOString().slice(0, 10),
      precision: 'publication_date',
    }),
    topics: source.topics,
    excerpt,
    contentSha256,
    excerptSha256,
  });
  cache.set(source.sourceId, Object.freeze({ expiresAtMs: now.getTime() + cacheTtlMs, evidence }));
  return evidence;
}

async function fetchWithGovernedRedirects(
  source: SourceDefinition,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<Response> {
  let current = new URL(source.uri);
  for (let redirectCount = 0; redirectCount <= REDIRECT_LIMIT; redirectCount += 1) {
    assertGovernedUrl(current, source);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        headers: {
          Accept: 'text/html, text/plain;q=0.9',
          'User-Agent': 'transparent-price/public-official-evidence',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (redirectCount === REDIRECT_LIMIT) throw new Error('official_source_redirect_limit');
    const location = response.headers.get('location');
    if (!location) throw new Error('official_source_redirect_missing_location');
    current = new URL(location, current);
  }
  throw new Error('official_source_redirect_limit');
}

function assertGovernedUrl(url: URL, source: SourceDefinition): void {
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('official_source_url_forbidden');
  }
  const hostname = url.hostname.toLowerCase();
  if (!source.allowedHosts.includes(hostname)) throw new Error('official_source_host_forbidden');
}

async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maximumBytes) throw new Error('official_source_response_too_large');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

function htmlToVisibleText(raw: string): string {
  const withoutHidden = raw
    .replace(/<!--[\s\S]*?-->/gu, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/giu, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/article|\/section)>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ');
  return decodeHtmlEntities(withoutHidden)
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
    .split(/\r?\n/gu)
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter((line) => line.length >= 3)
    .join('\n');
}

function decodeHtmlEntities(value: string): string {
  const named: Readonly<Record<string, string>> = Object.freeze({
    amp: '&',
    apos: "'",
    gt: '>',
    laquo: '«',
    lt: '<',
    nbsp: ' ',
    quot: '"',
    raquo: '»',
  });
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/giu, (entity, token: string) => {
    const normalized = token.toLowerCase();
    if (normalized.startsWith('#x')) {
      const code = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    if (normalized.startsWith('#')) {
      const code = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    return named[normalized] ?? entity;
  });
}

function latestPublicationDate(text: string, now: Date): Date | null {
  const candidates: Date[] = [];
  for (const match of text.matchAll(DATE_ISO_PATTERN)) {
    pushDateCandidate(candidates, Number(match[1]), Number(match[2]), Number(match[3]), now);
  }
  for (const match of text.matchAll(DATE_DMY_PATTERN)) {
    pushDateCandidate(candidates, Number(match[3]), Number(match[2]), Number(match[1]), now);
  }
  for (const match of text.matchAll(DATE_RU_PATTERN)) {
    pushDateCandidate(candidates, Number(match[3]), RU_MONTHS[match[2].toLowerCase()] || 0, Number(match[1]), now);
  }
  candidates.sort((left, right) => right.getTime() - left.getTime());
  return candidates[0] ?? null;
}

function pushDateCandidate(candidates: Date[], year: number, month: number, day: number, now: Date): void {
  if (month < 1 || month > 12 || day < 1 || day > 31) return;
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return;
  if (value.getTime() > now.getTime() + DAY_MS) return;
  candidates.push(value);
}

function buildRelevantExcerpt(
  visibleText: string,
  question: string,
  source: SourceDefinition,
  publishedAt: Date,
): string {
  const lines = uniqueLines(visibleText);
  const terms = new Set([
    ...question.toLowerCase().match(WORD_PATTERN) ?? [],
    ...source.markerTerms.map((term) => term.toLowerCase()),
    ...dateTokens(publishedAt),
  ]);
  const ranked = lines.map((line, index) => {
    const normalized = line.toLowerCase();
    const score = [...terms].reduce((total, term) => total + (normalized.includes(term) ? Math.min(12, term.length) : 0), 0);
    return { index, score };
  }).filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  if (ranked.length === 0) throw new Error('official_source_relevant_excerpt_missing');

  const selected = new Set<number>();
  let estimated = 0;
  for (const anchor of ranked.slice(0, 20)) {
    for (let index = Math.max(0, anchor.index - 2); index <= Math.min(lines.length - 1, anchor.index + 4); index += 1) {
      if (selected.has(index)) continue;
      selected.add(index);
      estimated += lines[index].length + 1;
    }
    if (estimated >= MAX_SOURCE_EXCERPT_CHARS) break;
  }
  let remaining = MAX_SOURCE_EXCERPT_CHARS;
  const excerpt: string[] = [];
  for (const index of [...selected].sort((left, right) => left - right)) {
    const line = lines[index];
    if (excerpt.length > 0) remaining -= 1;
    if (remaining <= 0) break;
    excerpt.push(line.slice(0, remaining));
    remaining -= Math.min(line.length, remaining);
  }
  const result = excerpt.join('\n').trim();
  if (result.length < 40) throw new Error('official_source_relevant_excerpt_too_short');
  return result;
}

function uniqueLines(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of text.split(/\r?\n/gu)) {
    const line = raw.replace(/\s+/gu, ' ').trim();
    const key = line.toLowerCase();
    if (line.length < 3 || seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

function dateTokens(value: Date): string[] {
  const day = value.getUTCDate();
  const month = value.getUTCMonth() + 1;
  const year = value.getUTCFullYear();
  const paddedDay = String(day).padStart(2, '0');
  const paddedMonth = String(month).padStart(2, '0');
  const ruMonth = Object.entries(RU_MONTHS).find(([, number]) => number === month)?.[0] || '';
  return [
    `${year}-${paddedMonth}-${paddedDay}`,
    `${paddedDay}.${paddedMonth}.${year}`,
    `${day}.${month}.${year}`,
    `${day} ${ruMonth} ${year}`,
  ].map((token) => token.toLowerCase());
}

function normalizeText(value: string, limit: number): string {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, limit);
}

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}
