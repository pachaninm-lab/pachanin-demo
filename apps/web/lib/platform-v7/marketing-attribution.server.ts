import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  buildMarketingCorrelationId,
  parseMarketingAttribution,
  type MarketingAttribution,
} from './marketing-attribution';

const SECRET_PATTERN = /^[A-Za-z0-9_-]{32,128}$/u;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/u;
const TOKEN_PART_PATTERN = /^[A-Za-z0-9_-]{1,12}$/u;
const MAX_TOKEN_LENGTH = 180;

function compact(value: string | undefined): string {
  return value && TOKEN_PART_PATTERN.test(value) ? value : '-';
}

function canonical(attribution: MarketingAttribution): string {
  return [
    'v1',
    attribution.source,
    attribution.campaign,
    attribution.content,
    compact(attribution.roleCode),
    compact(attribution.scenarioCode),
  ].join('.');
}

function normalizedAttribution(attribution: MarketingAttribution): MarketingAttribution | null {
  const params = new URLSearchParams({
    ms: String(attribution.source ?? ''),
    mca: String(attribution.campaign ?? ''),
    mco: String(attribution.content ?? ''),
  });
  if (attribution.roleCode) params.set('mr', attribution.roleCode);
  if (attribution.scenarioCode) params.set('mc', attribution.scenarioCode);
  const normalized = parseMarketingAttribution(params.toString());
  if (!normalized) return null;
  if (
    normalized.source !== attribution.source
    || normalized.campaign !== attribution.campaign
    || normalized.content !== attribution.content
    || normalized.roleCode !== attribution.roleCode
    || normalized.scenarioCode !== attribution.scenarioCode
  ) return null;
  return normalized;
}

export function marketingAttributionSecret(environment: NodeJS.ProcessEnv = process.env): string | null {
  const secret = String(environment.MARKETING_ATTRIBUTION_HMAC_SECRET ?? '').trim();
  return SECRET_PATTERN.test(secret) ? secret : null;
}

export function signMarketingAttribution(
  attribution: MarketingAttribution,
  secret: string,
): string {
  if (!SECRET_PATTERN.test(secret)) throw new Error('Marketing attribution HMAC secret is invalid');
  const normalized = normalizedAttribution(attribution);
  if (!normalized) throw new Error('Marketing attribution vocabulary is invalid');
  const unsigned = canonical(normalized);
  const signature = createHmac('sha256', secret).update(unsigned, 'utf8').digest('hex');
  return `${unsigned}.${signature}`;
}

export function verifyMarketingAttributionToken(
  token: string,
  secret: string,
): MarketingAttribution | null {
  if (!SECRET_PATTERN.test(secret)) return null;
  const normalizedToken = String(token ?? '').trim();
  if (!normalizedToken || normalizedToken.length > MAX_TOKEN_LENGTH) return null;
  const parts = normalizedToken.split('.');
  if (parts.length !== 7 || parts[0] !== 'v1') return null;
  const [version, source, campaign, content, role, scenario, signature] = parts;
  if (
    version !== 'v1'
    || !TOKEN_PART_PATTERN.test(source)
    || !TOKEN_PART_PATTERN.test(campaign)
    || !TOKEN_PART_PATTERN.test(content)
    || (role !== '-' && !TOKEN_PART_PATTERN.test(role))
    || (scenario !== '-' && !TOKEN_PART_PATTERN.test(scenario))
    || !SIGNATURE_PATTERN.test(signature)
  ) return null;

  const unsigned = parts.slice(0, 6).join('.');
  const expected = createHmac('sha256', secret).update(unsigned, 'utf8').digest('hex');
  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (
    actualBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(actualBuffer, expectedBuffer)
  ) return null;

  const params = new URLSearchParams({ ms: source, mca: campaign, mco: content });
  if (role !== '-') params.set('mr', role);
  if (scenario !== '-') params.set('mc', scenario);
  return parseMarketingAttribution(params.toString());
}

export function verifiedMarketingCorrelationId(
  token: string | null,
  uuid: string,
  environment: NodeJS.ProcessEnv = process.env,
): string | null {
  const secret = marketingAttributionSecret(environment);
  if (!secret || !token) return null;
  const attribution = verifyMarketingAttributionToken(token, secret);
  if (!attribution) return null;
  return buildMarketingCorrelationId(attribution, uuid);
}
