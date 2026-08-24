export const MARKETING_ATTRIBUTION_SOURCES = ['tg', 'vk', 'dz', 'rt', 'ok'] as const;
export type MarketingAttributionSource = (typeof MARKETING_ATTRIBUTION_SOURCES)[number];

export const MARKETING_ROLE_CODES = {
  ps: 'PRODUCER_SELLER',
  bp: 'BUYER_PROCESSOR',
  lg: 'LOGISTICS',
  se: 'STORAGE_ELEVATOR',
  ls: 'LAB_SURVEYOR',
  bf: 'BANK_FINANCE',
  pp: 'PUBLIC_INDUSTRY_PARTNER',
} as const;

export const MARKETING_SCENARIO_CODES = {
  de: 'DEAL_EXECUTION',
  la: 'LOGISTICS_ACCEPTANCE',
  ql: 'QUALITY_LAB',
  do: 'DOCUMENTS_EVIDENCE',
  fs: 'FINANCE_SETTLEMENT',
  ei: 'EXTERNAL_INTEGRATION',
} as const;

export type MarketingRoleCode = keyof typeof MARKETING_ROLE_CODES;
export type MarketingScenarioCode = keyof typeof MARKETING_SCENARIO_CODES;

export type MarketingAttribution = Readonly<{
  source: MarketingAttributionSource;
  campaign: string;
  content: string;
  roleCode?: MarketingRoleCode;
  scenarioCode?: MarketingScenarioCode;
}>;

const SOURCE_SET = new Set<string>(MARKETING_ATTRIBUTION_SOURCES);
const TAG_PATTERN = /^[A-Za-z0-9_-]{1,12}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function cleanTag(value: string | null, fallback: string): string {
  const normalized = String(value ?? '').trim();
  return TAG_PATTERN.test(normalized) ? normalized : fallback;
}

function isRoleCode(value: string): value is MarketingRoleCode {
  return Object.prototype.hasOwnProperty.call(MARKETING_ROLE_CODES, value);
}

function isScenarioCode(value: string): value is MarketingScenarioCode {
  return Object.prototype.hasOwnProperty.call(MARKETING_SCENARIO_CODES, value);
}

/**
 * Reads only a tiny allowlisted, non-PII attribution vocabulary from a public
 * landing URL. Unknown sources are ignored rather than being copied into audit.
 */
export function parseMarketingAttribution(search: string): MarketingAttribution | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const source = String(params.get('ms') ?? '').trim();
  if (!SOURCE_SET.has(source)) return null;

  const roleCandidate = String(params.get('mr') ?? '').trim();
  const scenarioCandidate = String(params.get('mc') ?? '').trim();

  return Object.freeze({
    source: source as MarketingAttributionSource,
    campaign: cleanTag(params.get('mca'), 'organic'),
    content: cleanTag(params.get('mco'), 'unknown'),
    roleCode: isRoleCode(roleCandidate) ? roleCandidate : undefined,
    scenarioCode: isScenarioCode(scenarioCandidate) ? scenarioCandidate : undefined,
  });
}

/**
 * Correlation ID is already durably persisted by the existing organization
 * intake authority. Encoding bounded non-PII attribution here avoids a second
 * lead database while preserving source/campaign/content provenance.
 */
export function buildMarketingCorrelationId(
  attribution: MarketingAttribution,
  uuid: string,
): string {
  if (!UUID_PATTERN.test(uuid)) throw new Error('A UUIDv4 correlation nonce is required');
  return [
    'mktg',
    attribution.source,
    attribution.campaign,
    attribution.content,
    uuid.toLowerCase(),
  ].join('.');
}

export function organizationIntakePrefill(attribution: MarketingAttribution | null): Readonly<{
  organizationRole?: string;
  scenario?: string;
}> {
  if (!attribution) return Object.freeze({});
  return Object.freeze({
    organizationRole: attribution.roleCode ? MARKETING_ROLE_CODES[attribution.roleCode] : undefined,
    scenario: attribution.scenarioCode ? MARKETING_SCENARIO_CODES[attribution.scenarioCode] : undefined,
  });
}

export function buildOrganizationWaitlistUrl(
  origin: string,
  attribution: MarketingAttribution,
): string {
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== 'https:' || parsedOrigin.username || parsedOrigin.password) {
    throw new Error('Marketing public origin must be an HTTPS origin without credentials');
  }
  if (parsedOrigin.pathname !== '/' || parsedOrigin.search || parsedOrigin.hash) {
    throw new Error('Marketing public origin must not include path, query or fragment');
  }

  const url = new URL('/platform-v7', parsedOrigin);
  url.searchParams.set('ms', attribution.source);
  url.searchParams.set('mca', attribution.campaign);
  url.searchParams.set('mco', attribution.content);
  if (attribution.roleCode) url.searchParams.set('mr', attribution.roleCode);
  if (attribution.scenarioCode) url.searchParams.set('mc', attribution.scenarioCode);
  url.hash = 'connect-organization';
  return url.toString();
}
