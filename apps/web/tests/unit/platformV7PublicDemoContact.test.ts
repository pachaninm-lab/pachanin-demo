import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/page.tsx'), 'utf8');
const rootRuMessages = fs.readFileSync(path.resolve(__dirname, '../../messages/ru.json'), 'utf8');
const dealFlowPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/deal-flow/page.tsx'), 'utf8');
const contactPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/contact/page.tsx'), 'utf8');
const contactClient = fs.readFileSync(path.resolve(__dirname, '../../app/platform-v7/contact/ContactClient.tsx'), 'utf8');
const contactSurface = contactPage + contactClient;
const inquiryRoute = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/api/platform-v7/inquiries/route.ts'), 'utf8');

describe('platform-v7 public production deal flow and question flow', () => {
  it('exposes production deal-flow and question CTAs from the public homepage', () => {
    expect(rootPage + rootRuMessages).toContain('Разобрать контур сделки');
    expect(rootPage + rootRuMessages).toContain('Задать вопрос');
    expect(rootPage + rootRuMessages).not.toContain('Демонстрационная сделка');
    expect(rootPage + rootRuMessages).not.toContain('Демонстрационный сценарий');
  });

  it('keeps the production deal-flow page public without promising live integrations', () => {
    expect(dealFlowPage).toContain('p7-deal-flow-page');
    expect(dealFlowPage).toContain('Контур сделки');
    expect(dealFlowPage).toContain('Платформа показывает основание для расчёта');
    expect(dealFlowPage).not.toContain('автоматический выпуск денег');
  });

  it('adds a separate question form without creating access', () => {
    expect(contactSurface).toContain('platform-v7-question-form-page');
    expect(contactSurface).toContain("action='/api/platform-v7/inquiries'");
    expect(contactSurface).toContain("name='website'");
    expect(contactSurface).toContain("name='consent'");
    expect(contactSurface).toContain('не открывает сделки, документы и закрытые разделы платформы');
    expect(contactSurface).not.toContain('пилотном проекте');
    expect(contactSurface).not.toContain('демонстрационном доступе');
  });

  it('preserves the active locale when the durable form redirect omits the lang query', () => {
    expect(contactPage).toContain("import { getLocale } from 'next-intl/server'");
    expect(contactPage).toContain('function localeOf(params: ContactSearchParams, fallbackLocale: string)');
    expect(contactPage.match(/localeOf\(params, await getLocale\(\)\)/g)?.length).toBe(2);
    expect(contactPage).toContain("if (lang === 'en' || lang === 'zh' || lang === 'ru') return lang;");
  });

  it('shows delivery failure without leaking provider error details or claiming success', () => {
    expect(contactPage).toContain('failed={hasDeliveryError(params)}');
    expect(contactClient).toContain("role='alert'");
    expect(contactClient).toContain('Обращение не отправлено');
    expect(contactClient).toContain("href='tel:+79162778989'");
    expect(contactClient).not.toContain('provider_failure');
    expect(contactClient).not.toContain('smtp_failed');
    expect(contactClient).not.toContain('resend_failed');
  });

  it('validates inquiry input server-side and supports email delivery when configured', () => {
    expect(inquiryRoute).toContain('QUESTION_TYPES');
    expect(inquiryRoute).toContain('validate(inquiry)');
    expect(inquiryRoute).toContain('bot_trap');
    expect(inquiryRoute).toContain('RESEND_API_KEY');
    expect(inquiryRoute).toContain('NextResponse.redirect(url, 303)');
  });
});
