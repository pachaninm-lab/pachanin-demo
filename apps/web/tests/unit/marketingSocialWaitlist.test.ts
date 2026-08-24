import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMarketingCorrelationId,
  buildOrganizationWaitlistUrl,
  organizationIntakePrefill,
  parseMarketingAttribution,
  readMarketingAttributionToken,
} from '../../lib/platform-v7/marketing-attribution';
import {
  signMarketingAttribution,
  verifiedMarketingCorrelationId,
  verifyMarketingAttributionToken,
} from '../../lib/platform-v7/marketing-attribution.server';
import {
  parseTelegramStart,
  telegramRoleUrlKeyboard,
} from '../../lib/platform-v7/telegram-marketing-qualification';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const webhook = read('app/api/marketing/telegram/webhook/route.ts');
const intakeForm = read('components/platform-v7/OrganizationConnectForm.tsx');
const intakeBff = read('app/api/platform-v7/organization-connect/route.ts');
const SECRET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef_1234567890';
const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('marketing social waitlist attribution', () => {
  it('accepts only bounded non-PII source/campaign/content UX tags', () => {
    expect(parseMarketingAttribution('?ms=tg&mca=harvest26&mco=lab01&mr=ps&mc=ql')).toEqual({
      source: 'tg', campaign: 'harvest26', content: 'lab01', roleCode: 'ps', scenarioCode: 'ql',
    });
    expect(parseMarketingAttribution('?ms=unknown&mca=x&mco=y')).toBeNull();
    expect(parseMarketingAttribution('?ms=tg&mca=email%40example.com&mco=%2Fetc%2Fpasswd')).toEqual({
      source: 'tg', campaign: 'organic', content: 'unknown', roleCode: undefined, scenarioCode: undefined,
    });
  });

  it('requires a valid HMAC before producing trusted marketing correlation', () => {
    const attribution = parseMarketingAttribution('?ms=vk&mca=grain26&mco=post7&mr=bp')!;
    const token = signMarketingAttribution(attribution, SECRET);
    expect(verifyMarketingAttributionToken(token, SECRET)).toEqual(attribution);
    expect(verifiedMarketingCorrelationId(token, UUID, { MARKETING_ATTRIBUTION_HMAC_SECRET: SECRET }))
      .toBe(`mktg.vk.grain26.post7.${UUID}`);
    const tampered = token.replace('.grain26.', '.grain27.');
    expect(verifyMarketingAttributionToken(tampered, SECRET)).toBeNull();
    expect(verifiedMarketingCorrelationId(tampered, UUID, { MARKETING_ATTRIBUTION_HMAC_SECRET: SECRET })).toBeNull();
    expect(verifiedMarketingCorrelationId(token, UUID, {})).toBeNull();
  });

  it('keeps durable marketing correlation inside the existing safe vocabulary', () => {
    const attribution = parseMarketingAttribution('?ms=vk&mca=grain26&mco=post7')!;
    const correlation = buildMarketingCorrelationId(attribution, UUID);
    expect(correlation).toBe(`mktg.vk.grain26.post7.${UUID}`);
    expect(correlation).toMatch(/^[A-Za-z0-9._:-]{8,128}$/u);
    expect(correlation).not.toMatch(/@|\+|\s/u);
  });

  it('builds HTTPS waitlist URLs with an opaque signed token and canonical prefill', () => {
    const attribution = parseMarketingAttribution('?ms=tg&mca=grain26&mco=post7&mr=ls&mc=ql')!;
    const token = signMarketingAttribution(attribution, SECRET);
    const url = buildOrganizationWaitlistUrl('https://процент-агро.рф', attribution, token);
    const parsed = new URL(url);
    expect(parsed.protocol).toBe('https:');
    expect(parsed.pathname).toBe('/platform-v7');
    expect(parsed.searchParams.get('ms')).toBe('tg');
    expect(parsed.searchParams.get('mr')).toBe('ls');
    expect(readMarketingAttributionToken(parsed.search)).toBe(token);
    expect(parsed.hash).toBe('#connect-organization');
    expect(organizationIntakePrefill(attribution)).toEqual({ organizationRole: 'LAB_SURVEYOR', scenario: 'QUALITY_LAB' });
  });

  it('rejects unsafe origins and malformed signed-token envelopes', () => {
    const attribution = parseMarketingAttribution('?ms=tg&mca=x&mco=y')!;
    expect(() => buildOrganizationWaitlistUrl('http://example.com', attribution)).toThrow(/HTTPS origin/i);
    expect(() => buildOrganizationWaitlistUrl('https://user:pass@example.com', attribution)).toThrow(/HTTPS origin/i);
    expect(() => buildOrganizationWaitlistUrl('https://example.com/path', attribution)).toThrow(/must not include path/i);
    expect(() => buildOrganizationWaitlistUrl('https://example.com', attribution, 'forged')).toThrow(/token/i);
    expect(readMarketingAttributionToken('?ma=forged')).toBeNull();
  });
});

describe('Telegram qualification without Telegram PII persistence', () => {
  it('parses bounded deep-link attribution and degrades unknown input to organic', () => {
    expect(parseTelegramStart('/start q1_harvest26_lab01')).toEqual({ campaign: 'harvest26', content: 'lab01' });
    expect(parseTelegramStart('/start unexpected payload')).toEqual({ campaign: 'organic', content: 'bot' });
  });

  it('returns seven signed URL role choices and no callback state', () => {
    const keyboard = telegramRoleUrlKeyboard(
      'https://процент-агро.рф',
      { campaign: 'harvest26', content: 'lab01' },
      (attribution) => signMarketingAttribution(attribution, SECRET),
    );
    expect(keyboard.inline_keyboard).toHaveLength(7);
    for (const row of keyboard.inline_keyboard) {
      expect(row).toHaveLength(1);
      expect(row[0].url).toContain('https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7?');
      const parsed = new URL(row[0].url);
      expect(parsed.searchParams.get('ms')).toBe('tg');
      const token = readMarketingAttributionToken(parsed.search);
      expect(token).not.toBeNull();
      expect(verifyMarketingAttributionToken(token!, SECRET)?.source).toBe('tg');
      expect(row[0]).not.toHaveProperty('callback_data');
    }
  });

  it('authenticates Telegram webhook requests and signs attribution without exposing profile fields', () => {
    expect(webhook).toContain("request.headers.get('x-telegram-bot-api-secret-token')");
    expect(webhook).toContain('timingSafeEqual');
    expect(webhook).toContain('MARKETING_TELEGRAM_WEBHOOK_SECRET');
    expect(webhook).toContain('marketingAttributionSecret');
    expect(webhook).toContain('signMarketingAttribution');
    expect(webhook).toContain('MARKETING_OUTBOUND_ENABLED');
    expect(webhook).toContain('MARKETING_TELEGRAM_COMMUNITY_ENABLED');
    expect(webhook).toContain("method: 'sendMessage'");
    expect(webhook).not.toContain('MARKETING_TELEGRAM_BOT_TOKEN');
    expect(webhook).not.toContain('console.log');
    expect(webhook).not.toContain('console.error');
    const updateContract = webhook.slice(webhook.indexOf('type TelegramUpdate'), webhook.indexOf('function json'));
    expect(updateContract).not.toMatch(/username|first_name|last_name|phone_number/);
  });

  it('keeps mktg correlation authority server-side and rejects public spoofing of that prefix', () => {
    expect(intakeForm).toContain('readMarketingAttributionToken');
    expect(intakeForm).toContain("headers['x-marketing-attribution'] = marketingAttributionToken.current");
    expect(intakeForm).not.toContain('buildMarketingCorrelationId');
    expect(intakeForm).not.toContain("headers['x-correlation-id']");
    expect(intakeBff).toContain('verifiedMarketingCorrelationId');
    expect(intakeBff).toContain("request.headers.get('x-marketing-attribution')");
    expect(intakeBff).toContain("!requested.startsWith('mktg.')");
    expect(intakeBff).toContain("'x-correlation-id': correlationId");
  });
});
