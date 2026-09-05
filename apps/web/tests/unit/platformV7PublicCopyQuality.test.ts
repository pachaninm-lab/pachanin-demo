import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const legacyFiles = [
  'apps/web/components/platform-v7/PlatformV7LeadCapture.tsx',
  'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx',
  'apps/web/components/platform-v7/ContactCopyNormalizer.tsx',
  'apps/web/components/platform-v7/PublicHeroCopyNormalizer.tsx',
  'apps/web/app/platform-v7/open/page.tsx',
  'apps/web/app/platform-v7/register/page.tsx',
  'apps/web/app/platform-v7/docs/page.tsx',
  'apps/web/lib/platform-v7/shellRoutes.ts',
].map((file) => [file, read(file)] as const);

const changedPublicFiles = [
  'apps/web/app/platform-v7/about/page.tsx',
  'apps/web/app/platform-v7/ai-in-action/page.tsx',
  'apps/web/app/platform-v7/contact/ContactClient.tsx',
  'apps/web/app/platform-v7/contact/page.tsx',
  'apps/web/app/platform-v7/how-it-works/page.tsx',
  'apps/web/app/platform-v7/page.tsx',
  'apps/web/components/platform-v7/PlatformV7StrategicHome.tsx',
  'apps/web/components/platform-v7/PlatformV7StrategicHomeInternational.tsx',
  'apps/web/components/platform-v7/PrivacyPortalPanel.tsx',
  'apps/web/components/platform-v7/PublicDealRoleScenario.tsx',
  'apps/web/i18n/platform-v7-home-story-product.ts',
  'apps/web/i18n/platform-v7-home-v3-operating.ts',
  'apps/web/i18n/platform-v7-organization-connect-operating.ts',
].map((file) => [file, read(file)] as const);

const aiExperience = read('apps/web/components/platform-v7/PublicAiInActionSimpleExperience.tsx');

const legacyBanned = [
  'controlled pilot',
  'pre-integration',
  'CRM-контур',
  'лид',
  'автоответ',
  'этот ЛК',
  'заявка регистрируется',
  'контакт используется для ответа',
  'доступ к рабочим данным не предоставляется',
  'Посмотреть демо-сделку',
  'догонять сделку',
];

const publicBanned = [
  'controlled pilot',
  'pre-integration',
  'production-like simulation',
  'ООО «ГрейнФлоу»',
  'Yandex Cloud',
  'Selectel',
  'Netlify',
  'Vercel',
  'CRM-контур',
  'lead capture',
  'fake-live',
];

describe('platform-v7 public copy quality', () => {
  it('keeps legacy public copy and protected role navigation free of artificial wording', () => {
    for (const [file, source] of legacyFiles) {
      for (const phrase of legacyBanned) {
        expect(source, `${file} must not contain ${phrase}`).not.toContain(phrase);
      }
    }
  });

  it('keeps the changed homepage and linked public pages free of internal maturity jargon and invented entities', () => {
    for (const [file, source] of changedPublicFiles) {
      for (const phrase of publicBanned) {
        expect(source.toLowerCase(), `${file} must not contain ${phrase}`).not.toContain(phrase.toLowerCase());
      }
    }
  });

  it('allows legacy AI release markers only as hidden compatibility metadata', () => {
    expect(aiExperience).toContain("<span hidden aria-hidden='true' data-release-compat='ai-passport'>TAI — доказательный уровень исполнения сделки · NOT_ATTESTED · TAI готовит — человек подтверждает — адаптер исполняет</span>");
    expect(aiExperience).not.toContain("status: 'NOT_ATTESTED'");
    expect(aiExperience).not.toContain('Vercel');
    expect(aiExperience).not.toContain('Netlify');
  });

  it('keeps examples explicitly labelled without making demonstration the product proposition', () => {
    const home = read('apps/web/components/platform-v7/PlatformV7StrategicHome.tsx');
    const story = read('apps/web/i18n/platform-v7-home-story-product.ts');
    const howItWorks = read('apps/web/app/platform-v7/how-it-works/page.tsx');
    expect(story).toContain("processTitle: 'Семь шагов обычной агросделки'");
    expect(story).toContain('Ниже показан вымышленный пример Сделки');
    expect(story).toContain('The section below is a fictional Deal example');
    expect(story).toContain('下面展示的是虚构交易示例');
    expect(howItWorks).toContain("kicker: 'Как работает Сделка'");
    expect(howItWorks).toContain('вымышленный пример');
    expect(home).toContain('const normalState = story.demo.states[0]!;');
  });

  it('exposes distinct protected registration entry points', () => {
    const actions = read('apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx');
    const home = read('apps/web/components/platform-v7/PlatformV7StrategicHome.tsx');
    expect(actions).toContain('/platform-v7/register');
    expect(actions).toContain('Регистрация');
    expect(actions).toContain('Зарегистрироваться');
    expect(actions).toContain('Подать заявку на роль');
    expect(home).toContain('const registerHref = `/platform-v7/register?lang=');
    expect(home).toContain("eventName='registration_open'");
  });

  it('keeps the public Deal-path exploration secondary to registration', () => {
    const actions = read('apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx');
    const home = read('apps/web/components/platform-v7/PlatformV7StrategicHome.tsx');
    expect(actions).toContain('Посмотреть путь сделки');
    expect(actions).toContain("routeLink.href = '#process'");
    expect(home).toContain("href='#live'");
    expect(home).toContain("href='/downloads/prozrachnaya-tsena-presentation.pdf'");
  });

  it('keeps protected role navigation understandable', () => {
    const routes = read('apps/web/lib/platform-v7/shellRoutes.ts');
    for (const label of ['Сделки', 'Документы', 'Деньги', 'Партии', 'Блокеры']) {
      expect(routes).toContain(label);
    }
  });
});
