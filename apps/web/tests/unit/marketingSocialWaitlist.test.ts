import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMarketingCorrelationId,
  buildOrganizationWaitlistUrl,
  organizationIntakePrefill,
  parseMarketingAttribution,
} from '../../lib/platform-v7/marketing-attribution';
import {
  parseTelegramStart,
  telegramRoleUrlKeyboard,
} from '../../lib/platform-v7/telegram-marketing-qualification';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const webhook = read('app/api/marketing/telegram/webhook/route.ts');
const intakeForm = read('components/platform-v7/OrganizationConnectForm.tsx');

describe('marketing social waitlist attribution', () => {
  it('accepts only bounded non-PII source/campaign/content tags', () => {
    expect(parseMarketingAttribution('?ms=tg&mca=harvest26&mco=lab01&mr=ps&mc=ql')).toEqual({
      source: 'tg',
      campaign: 'harvest26',
      content: 'lab01',
      roleCode: 'ps',
      scenarioCode: 'ql',
    });

    expect(parseMarketingAttribution('?ms=unknown&mca=x&mco=y')).toBeNull();
    expect(parseMarketingAttribution('?ms=tg&mca=email%40example.com&mco=%2Fetc%2Fpasswd')).toEqual({
      source: 'tg',
      campaign: 'organic',
      content: 'unknown',
      roleCode: undefined,
      scenarioCode: undefined,
    });
  });

  it('encodes social provenance into the existing safe correlation-id vocabulary', () => {
    const attribution = parseMarketingAttribution('?ms=vk&mca=grain26&mco=post7');
    expect(attribution).not.toBeNull();
    const correlation = buildMarketingCorrelationId(
      attribution!,
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(correlation).toBe('mktg.vk.grain26.post7.550e8400-e29b-41d4-a716-446655440000');
    expect(correlation).toMatch(/^[A-Za-z0-9._:-]{8,128}$/u);
    expect(correlation).not.toMatch(/@|\+|\s/u);
  });

  it('builds HTTPS waitlist URLs and canonical role/scenario prefill', () => {
    const attribution = parseMarketingAttribution('?ms=tg&mca=grain26&mco=post7&mr=ls&mc=ql');
    expect(attribution).not.toBeNull();
    const url = buildOrganizationWaitlistUrl('https://процент-агро.рф', attribution!);
    const parsed = new URL(url);
    expect(parsed.protocol).toBe('https:');
    expect(parsed.pathname).toBe('/platform-v7');
    expect(parsed.searchParams.get('ms')).toBe('tg');
    expect(parsed.searchParams.get('mr')).toBe('ls');
    expect(parsed.hash).toBe('#connect-organization');
    expect(organizationIntakePrefill(attribution)).toEqual({
      organizationRole: 'LAB_SURVEYOR',
      scenario: 'QUALITY_LAB',
    });
  });

  it('rejects unsafe public origins', () => {
    const attribution = parseMarketingAttribution('?ms=tg&mca=x&mco=y')!;
    expect(() => buildOrganizationWaitlistUrl('http://example.com', attribution)).toThrow(/HTTPS origin/i);
    expect(() => buildOrganizationWaitlistUrl('https://user:pass@example.com', attribution)).toThrow(/HTTPS origin/i);
    expect(() => buildOrganizationWaitlistUrl('https://example.com/path', attribution)).toThrow(/must not include path/i);
  });
});

describe('Telegram qualification without Telegram PII persistence', () => {
  it('parses bounded deep-link attribution and degrades unknown input to organic', () => {
    expect(parseTelegramStart('/start q1_harvest26_lab01')).toEqual({
      campaign: 'harvest26',
      content: 'lab01',
    });
    expect(parseTelegramStart('/start unexpected payload')).toEqual({
      campaign: 'organic',
      content: 'bot',
    });
  });

  it('returns seven URL role choices and no callback state', () => {
    const keyboard = telegramRoleUrlKeyboard(
      'https://процент-агро.рф',
      { campaign: 'harvest26', content: 'lab01' },
    );
    expect(keyboard.inline_keyboard).toHaveLength(7);
    for (const row of keyboard.inline_keyboard) {
      expect(row).toHaveLength(1);
      expect(row[0].url).toContain('https://xn----8sbpahw2al5bza9c.xn--p1ai/platform-v7?');
      expect(row[0].url).toContain('ms=tg');
      expect(row[0]).not.toHaveProperty('callback_data');
    }
  });

  it('authenticates Telegram webhook requests and never needs a bot token at runtime', () => {
    expect(webhook).toContain("request.headers.get('x-telegram-bot-api-secret-token')");
    expect(webhook).toContain('timingSafeEqual');
    expect(webhook).toContain('MARKETING_TELEGRAM_WEBHOOK_SECRET');
    expect(webhook).toContain('MARKETING_OUTBOUND_ENABLED');
    expect(webhook).toContain('MARKETING_TELEGRAM_COMMUNITY_ENABLED');
    expect(webhook).toContain("method: 'sendMessage'");
    expect(webhook).not.toContain('MARKETING_TELEGRAM_BOT_TOKEN');
    expect(webhook).not.toContain('console.log');
    expect(webhook).not.toContain('console.error');
    expect(webhook).not.toMatch(/username|first_name|last_name|phone_number/);
  });

  it('passes bounded marketing provenance through the existing durable organization intake correlation', () => {
    expect(intakeForm).toContain('parseMarketingAttribution');
    expect(intakeForm).toContain('buildMarketingCorrelationId');
    expect(intakeForm).toContain("headers['x-correlation-id'] = marketingCorrelationId.current");
    expect(intakeForm).not.toMatch(/headers\[['"]x-correlation-id['"]\].*(email|phone|inn|contactName)/u);
  });
});
