import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/page.tsx'), 'utf8');
const demoPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/demo/page.tsx'), 'utf8');
const contactPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/contact/page.tsx'), 'utf8');
const inquiryRoute = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/api/platform-v7/inquiries/route.ts'), 'utf8');

describe('platform-v7 public demo and question flow', () => {
  it('exposes demo and question CTAs from the public homepage', () => {
    expect(rootPage).toContain("href='/platform-v7/demo'");
    expect(rootPage).toContain('Посмотреть демо-сделку');
    expect(rootPage).toContain("href='/platform-v7/contact'");
    expect(rootPage).toContain('Задать вопрос');
    expect(rootPage).toContain('Демо работает без регистрации, на синтетических данных');
  });

  it('keeps demo as a public sandbox, not a cabinet bypass', () => {
    expect(demoPage).toContain('platform-v7-demo-public-workspace');
    expect(demoPage).toContain('Демо · без регистрации · без доступа в ЛК');
    expect(demoPage).toContain('Демо · синтетические данные');
    expect(demoPage).toContain('Выпуск денег недоступен в демо');
    expect(demoPage).toContain('Демо не создаёт сессию, не меняет роль и не открывает реальные кабинеты');

    expect(demoPage).not.toContain("href: '/platform-v7/buyer'");
    expect(demoPage).not.toContain("href: '/platform-v7/seller'");
    expect(demoPage).not.toContain("href: '/platform-v7/bank'");
    expect(demoPage).not.toContain("href: '/platform-v7/driver");
    expect(demoPage).not.toContain("href: '/platform-v7/disputes'");
  });

  it('adds a separate question form without creating access', () => {
    expect(contactPage).toContain('platform-v7-question-form-page');
    expect(contactPage).toContain("action='/api/platform-v7/inquiries'");
    expect(contactPage).toContain("name='website'");
    expect(contactPage).toContain("name='consent'");
    expect(contactPage).toContain('Форма не открывает личный кабинет и не создаёт роль');
  });

  it('validates inquiry input server-side and supports email delivery when configured', () => {
    expect(inquiryRoute).toContain('QUESTION_TYPES');
    expect(inquiryRoute).toContain('validate(inquiry)');
    expect(inquiryRoute).toContain('bot_trap');
    expect(inquiryRoute).toContain('RESEND_API_KEY');
    expect(inquiryRoute).toContain('NextResponse.redirect(url, 303)');
  });
});
