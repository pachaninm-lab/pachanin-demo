import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..'), file), 'utf8');

const legacyFiles = [
  'apps/web/components/platform-v7/PlatformV7LeadCapture.tsx',
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
  'apps/web/i18n/platform-v7-home-story.ts',
  'apps/web/i18n/platform-v7-home-story-product.ts',
  'apps/web/i18n/platform-v7-home-story-operating.ts',
  'apps/web/i18n/platform-v7-home-v3-operating.ts',
  'apps/web/i18n/platform-v7-accounting-value.ts',
  'apps/web/i18n/platform-v7-organization-connect-operating.ts',
  'apps/web/i18n/public-product-entry-variants.ts',
  'apps/web/i18n/public-product-experience-v3.ts',
  'apps/web/i18n/public-product-experience-v4.ts',
  'apps/web/i18n/public-deal-journey-v5.ts',
].map((file) => [file, read(file)] as const);

const aiExperience = read('apps/web/components/platform-v7/PublicAiInActionSimpleExperience.tsx');
const baseStory = read('apps/web/i18n/platform-v7-home-story.ts');
const detailedCopy = read('apps/web/i18n/public-product-experience-v3.ts');
const sharedCopy = read('apps/web/i18n/public-product-experience-v4.ts');
const journeyCopy = read('apps/web/i18n/public-deal-journey-v5.ts');
const entryCopy = read('apps/web/i18n/public-product-entry-variants.ts');
const accountingCopy = read('apps/web/i18n/platform-v7-accounting-value.ts');

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

const statusPresentationBanned = [
  'готовность расчёта',
  'settlement readiness',
  '结算准备',
  'готовность финансового действия',
  'financial-action readiness',
  '金融操作准备',
  'проверить готовность расчёта',
  'check settlement readiness',
  '检查结算准备',
  'только подтверждаемые статусы',
  'only verifiable statuses',
  '只展示可核验状态',
  'статусы интеграций',
  'integration statuses',
  '集成状态',
  'публичный статус',
  'public status',
  '公开状态',
  'active connection',
  'verified statuses',
  'settlement-ground status',
  'unconfirmed route',
  "href: '/platform-v7/status'",
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

  it('keeps every live Deal copy owner free of visitor-facing readiness and system-status marketing', () => {
    const publicDealCopy = [baseStory, detailedCopy, sharedCopy, journeyCopy, entryCopy, accountingCopy].join('\n').toLowerCase();
    for (const phrase of statusPresentationBanned) {
      expect(publicDealCopy, `public Deal copy must not contain ${phrase}`).not.toContain(phrase.toLowerCase());
    }

    expect(baseStory).toContain("settlementLabel: 'Основание расчёта'");
    expect(baseStory).toContain("settlementLabel: 'Settlement basis'");
    expect(baseStory).toContain("settlementLabel: '结算依据'");
    expect(baseStory).toContain("{ value: '9', label: 'публичных ролей одной Сделки' }");
    expect(baseStory).toContain("{ value: '7', label: 'понятных шагов публичного пути' }");
    expect(baseStory).not.toContain("ladder: ['Реализовано', 'Проверено', 'Интегрировано', 'Подключено'");

    expect(detailedCopy).toContain("statusLabel: 'Контекст этапа'");
    expect(detailedCopy).toContain("statusLabel: 'Stage context'");
    expect(detailedCopy).toContain("statusLabel: '阶段上下文'");
    expect(sharedCopy).toContain("href: '/platform-v7/trust'");
    expect(journeyCopy).toContain("settle: { label: 'Проверить основания расчёта'");
    expect(journeyCopy).toContain("settle: { label: 'Review settlement grounds'");
    expect(journeyCopy).toContain("settle: { label: '检查结算依据'");
    expect(entryCopy).toContain('Товар, условия, поставка, документы и основания расчёта.');
    expect(accountingCopy).toContain('Маршрут обмена определяется для конкретной организации');
  });

  it('keeps About and Contact chrome source-owned, understandable and registration-first', () => {
    const about = read('apps/web/app/platform-v7/about/page.tsx');
    const contact = read('apps/web/app/platform-v7/contact/ContactClient.tsx');
    const contactPage = read('apps/web/app/platform-v7/contact/page.tsx');
    const contactLayout = read('apps/web/app/platform-v7/contact/layout.tsx');
    const contactHeader = read('apps/web/components/platform-v7/ContactFixedHeader.tsx');
    const canonicalHeader = read('apps/web/components/platform-v7/PublicCanonicalPrimitives.tsx');

    expect(about).toContain('CanonicalPublicHeader');
    expect(about).toContain("activePath='/platform-v7/about'");
    expect(about).toContain('href={`/platform-v7/register?lang=${locale}`}');
    expect(about).toContain("application:'Подайте заявку на подключение организации.");
    expect(about).toContain("application:'Apply to connect your organisation.");
    expect(about).toContain("application:'请提交机构接入申请。");
    expect(about).toContain('href={`/platform-v7/how-it-works?lang=${locale}`}');
    expect(about).toContain("className='pc-cp-trust-grid'");
    expect(about).not.toContain('ABOUT_HEADER_CSS');
    expect(about).not.toContain('Что подтверждено, а что требует подключения');
    expect(about).not.toContain('статусы подключений');
    expect(about).not.toContain("href: '/platform-v7/status'");
    expect(about).not.toContain('href={`/platform-v7/status${lang}`}');
    expect(about).not.toContain('/platform-v7/secure-grain-deal');
    expect(about).not.toContain("href: '/platform-v7/grain-");
    expect(about).not.toContain('исторические адреса страниц');
    expect(about).not.toContain("content:'↪'");
    expect(about).not.toContain('font-size:0');

    expect(contact).not.toContain("className='p7-contact-header'");
    expect(contact).toContain("id='main-content' tabIndex={-1}");
    expect(contact).toContain("action='/api/platform-v7/inquiries'");
    expect(contact).toContain('Задайте вопрос о платформе, подключении организации или сотрудничестве.');
    expect(contact).toContain('Обращение не отправлено');
    expect(contact).toContain("href='tel:+79162778989'");
    expect(contactPage).toContain('failed={hasDeliveryError(params)}');
    expect(contactLayout).toContain('<ContactFixedHeader locale={locale} />');
    expect(contactHeader).toContain("href='#main-content'");
    expect(contactHeader).toContain('<CanonicalPublicHeader locale={lang} />');
    expect(canonicalHeader).toContain("className='pc-v6-header-cta' href={`/platform-v7/register${suffix}`}");
    expect(contactHeader).not.toContain('useSearchParams');
    expect(contactHeader).not.toContain('.pc-shell-root-v4');
    for (const providerDetail of ['provider_failure', 'smtp_failed', 'resend_failed']) {
      expect(contact).not.toContain(providerDetail);
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
    expect(howItWorks).toContain("e:'Как проходит сделка'");
    expect(howItWorks).toContain("p:'Семь этапов: кто выполняет задачу");
    expect(howItWorks).toContain('<CanonicalDealSpine locale={locale} currentIndex={null}/>');
    expect(home).toContain('<CanonicalDealSpine locale={locale} currentIndex={null} />');
  });

  it('exposes distinct protected registration entry points', () => {
    const home = read('apps/web/components/platform-v7/PlatformV7StrategicHome.tsx');
    expect(home).toContain('const registerBase = `/platform-v7/register?lang=${locale}`;');
    expect(home).toContain('href={`${registerBase}&intent=sell`}');
    expect(home).toContain('href={`${registerBase}&intent=buy`}');
    expect(home).toContain("GROUP_INTENTS = ['sell', 'buy', 'execution', 'finance']");
    expect(home).toContain('href={`${registerBase}&intent=${GROUP_INTENTS[index]!}`');
    expect(home).toContain('href={`/platform-v7/register?lang=${locale}`}');

  });

  it('keeps the public Deal-path exploration secondary to registration', () => {
    const home = read('apps/web/components/platform-v7/PlatformV7StrategicHome.tsx');
    expect(home).toContain("className='pc-cp-button' href={`${registerBase}&intent=sell`}");
    expect(home).toContain("className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/how-it-works?lang=${locale}`}");
    expect(home).toContain("className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/contact?lang=${locale}`}");

  });

  it('keeps protected role navigation understandable', () => {
    const routes = read('apps/web/lib/platform-v7/shellRoutes.ts');
    for (const label of ['Сделки', 'Документы', 'Деньги', 'Партии', 'Остановки']) {
      expect(routes).toContain(label);
    }
  });
});

// The retired registration DOM patch must not be reintroduced as public copy authority.
it('keeps the retired registration DOM patch absent', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  expect(fs.existsSync(path.join(root, 'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx'))).toBe(false);
});


describe('owner UX v2 public content truth', () => {
  it('names price behavior as sorting rather than a missing price filter in RU EN ZH', () => {
    const market = read('apps/web/app/platform-v7/market/page.tsx');
    expect(market).toContain('по региону и классу, а затем отсортировать по цене');
    expect(market).toContain('Filter published offers by region and grade, then sort them by price.');
    expect(market).toContain('先按地区和等级筛选已发布的供求信息，再按价格排序');
    expect(market).not.toContain('по региону, классу и цене');
    expect(market).not.toContain('Filter published offers by region, grade and price.');
    expect(market).not.toContain('按地区、等级和价格筛选');
  });

  it('keeps the twelve capability cards as an honest overview unless a real destination exists', () => {
    const capabilities = read('apps/web/app/platform-v7/capabilities/page.tsx');
    expect(capabilities).toContain('Ниже — обзор двенадцати задач');
    expect(capabilities).toContain('Below is an overview of twelve tasks');
    expect(capabilities).toContain('以下概览介绍支持交易工作的十二项任务');
    expect(capabilities).not.toContain('Выберите задачу и узнайте, как она устроена.');
    expect(capabilities).not.toContain('Choose a task to see how it works.');
    expect(capabilities).not.toContain('选择任务，了解其具体流程。');
    const itemKeys = ['market','trading','commitments','delivery','acceptance','documents','settlement','dispute','trust','gekta','roles','history'];
    for (const key of itemKeys) expect(capabilities).toContain(`${key}:[`);
  });

  it('keeps public Normal Deviation Dispute explanatory and non-interactive', () => {
    const deal = read('apps/web/app/platform-v7/deal-flow/page.tsx');
    const states = read('apps/web/components/platform-v7/PublicCanonicalPrimitives.tsx');
    expect(deal).toContain('<CanonicalStateLens');
    expect(deal).toContain('state={null}');
    expect(deal).toContain("presentation='explanation'");
    expect(states).toContain("presentation === 'explanation' ? null : state");
    expect(states).toContain("<CanonicalStateTabs locale={lang} state={visibleState} />");
    expect(states).toContain("role='list'");
    expect(states).toContain("className='pc-cp-state-tab'");
    expect(states).toContain("role='listitem'");
    expect(states).toContain("data-active={active ? 'true' : 'false'}");
    expect(states).not.toContain("<button className='pc-cp-state-tab'");
    expect(states).not.toContain("aria-selected='true'");
    expect(states).not.toContain('aria-pressed=');
  });
});
