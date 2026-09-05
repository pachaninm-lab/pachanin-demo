import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

const story = read('i18n/platform-v7-home-story-product.ts');
const home = read('i18n/platform-v7-home-v3-product.ts');
const homeOperating = read('i18n/platform-v7-home-v3-operating.ts');
const hero = read('i18n/platform-v7-hero-message.ts');
const connect = read('i18n/platform-v7-organization-connect-product.ts');
const component = read('components/platform-v7/PlatformV7StrategicHome.tsx');
const page = read('app/platform-v7/page.tsx');
const tsconfig = JSON.parse(read('tsconfig.json')) as { compilerOptions?: { paths?: Record<string, string[]> } };
const about = read('app/platform-v7/about/page.tsx');
const contact = read('app/platform-v7/contact/ContactClient.tsx');
const contactPage = read('app/platform-v7/contact/page.tsx');
const contactLayout = read('app/platform-v7/contact/layout.tsx');
const contactHeader = read('components/platform-v7/ContactFixedHeader.tsx');
const ai = read('components/platform-v7/PublicAiInActionSimpleExperience.tsx');
const aiPage = read('app/platform-v7/ai-in-action/page.tsx');
const how = read('app/platform-v7/how-it-works/page.tsx');
const privacyPanel = read('components/platform-v7/PrivacyPortalPanel.tsx');
const privacyPolicy = read('app/platform-v7/privacy/page.tsx');
const accounting = read('i18n/platform-v7-accounting-value.ts');

describe('platform-v7 homepage product copy', () => {
  it('keeps the approved design entrypoints and durable optional assistance form', () => {
    expect(component).toContain("import '@/styles/platform-v7-public-assistant.css'");
    expect(component).toContain("import styles from './PlatformV7StrategicHomeStory.module.css'");
    expect(component).toContain("className={`pc-v6-hero ${styles.hero}`}");
    expect(component).toContain("<OrganizationConnectForm locale={locale} />");
  });

  it('routes live copy imports through product/operating layers without editing tsconfig', () => {
    const paths = tsconfig.compilerOptions?.paths ?? {};
    expect(paths['@/i18n/platform-v7-home-v3']).toEqual(['./i18n/platform-v7-home-v3-product.ts']);
    expect(paths['@/i18n/platform-v7-home-story']).toEqual(['./i18n/platform-v7-home-story-product.ts']);
    expect(paths['@/i18n/platform-v7-organization-connect']).toEqual(['./i18n/platform-v7-organization-connect-product.ts']);
  });

  it('presents one crop Deal product with nine roles and seven public steps in RU EN ZH', () => {
    expect(hero).toContain('ведёт одну агросделку от товара и торгов до поставки, качества, документов и расчёта');
    expect(hero).toContain('что уже подтверждено и что делать дальше');
    expect(hero).toContain('но не принимает решение вместо человека');
    expect(story).toContain('Полный контур агросделки собран в одной рабочей системе');
    expect(story).toContain('The complete agricultural Deal workflow in one operating system');
    expect(story).toContain('完整农业交易流程集中在同一工作系统');
    expect(story).toContain("roles: '9 ролей'");
    expect(story).toContain("roles: '9 roles'");
    expect(story).toContain("roles: '9 个角色'");
    expect(story).toContain("journey: '7 шагов'");
    expect(story).toContain("journey: '7 steps'");
    expect(story).toContain("journey: '7 个步骤'");
  });

  it('explains accounting and EDI as conditional external connections', () => {
    expect(story).toContain("accountingQ: 'Как бухгалтер работает с 1С и ЭДО?'");
    expect(story).toContain("accountingQ: 'How does an accountant work with 1C and EDI?'");
    expect(story).toContain("accountingQ: '会计人员如何使用 1C 和电子单据系统？'");
    expect(story).toContain('Внешние системы подключаются через отдельные управляемые интеграции');
    expect(story).toContain('Конкретная схема, доступность интеграции и права подтверждаются для организации до обмена данными.');
    expect(story).not.toContain('бухгалтер продолжает работать в привычной 1С и ЭДО');
    expect(story).not.toContain('без двойного ввода');
  });

  it('keeps examples explicitly fictional and internal maturity jargon out of final homepage copy', () => {
    const publicCopy = [story, home, homeOperating, hero, connect, page].join('\n').toLowerCase();
    for (const phrase of ['controlled pilot', 'pre-integration', 'not_attested', 'production-like simulation', 'fake-live']) {
      expect(publicCopy).not.toContain(phrase);
    }
    expect(story).toContain("heroSampleLabel: 'Вымышленный пример Сделки'");
    expect(story).toContain("heroSampleLabel: 'Fictional Deal example'");
    expect(story).toContain("heroSampleLabel: '虚构交易示例'");
    expect(story).toContain('Обычное исполнение — основной сценарий');
    expect(story).toContain('Ниже показан вымышленный пример Сделки');
    expect(story).toContain('The section below is a fictional Deal example');
    expect(story).toContain('下面展示的是虚构交易示例');
  });

  it('makes registration the clear next step and keeps organization help distinct', () => {
    expect(homeOperating).toContain("secondary: 'Зарегистрироваться'");
    expect(homeOperating).toContain("primary: 'Зарегистрироваться'");
    expect(connect).toContain("submit: 'Отправить запрос на помощь'");
    expect(connect).toContain("submit: 'Send assistance request'");
    expect(connect).toContain("submit: '发送协助请求'");
    expect(connect).toContain('Для создания аккаунта используйте отдельную регистрацию платформы');
  });

  it('describes Gekta as a bounded intelligence layer rather than an autonomous authority', () => {
    expect(page).toContain("title: 'Прозрачная Цена — единая система управления агросделкой'");
    expect(page).toContain('Гекта связаны в одной Сделке');
    expect(page).toContain('аграрным интеллектом Гекта');
    expect(page).not.toMatch(/\bTAI\b/u);
    expect(story).toContain("taiState: 'Пример анализа · по данным сценария'");
    expect(story).toContain('Она не назначает роли, не меняет права, не подписывает документы и не запускает движение денег.');
    expect(story).toContain('Critical decisions are confirmed by an authorised participant.');
    expect(story).toContain('关键决定由获授权的参与方确认。');
  });
});

describe('platform-v7 linked public-page trust', () => {
  it('keeps About crop-oriented and free of internal maturity shorthand', () => {
    expect(about).toContain("type Locale = 'ru' | 'en' | 'zh'");
    expect(about).toContain('агросделки в растениеводстве');
    expect(about).toContain('/platform-v7/register');
    expect(about.toLowerCase()).not.toContain('controlled pilot');
    expect(about.toLowerCase()).not.toContain('pre-integration');
    expect(about.toLowerCase()).not.toContain('зерновой сделки');
    expect(about).not.toContain('исторические адреса страниц');
  });

  it('keeps Contact a real inquiry channel and preserves one server-owned locale across content and chrome', () => {
    expect(contact).toContain("action='/api/platform-v7/inquiries'");
    expect(contact).toContain("name='consent'");
    expect(contact).toContain('Обращение в поддержку не создаёт аккаунт и не назначает роль.');
    expect(contact).toContain('Регистрация пользователя находится в отдельном разделе.');
    expect(contactPage).toContain("type Locale = 'ru' | 'en' | 'zh'");
    expect(contactPage).toContain("import { getLocale } from 'next-intl/server'");
    expect(contactPage.match(/localeOf\(params, await getLocale\(\)\)/g)?.length).toBe(2);
    expect(contactLayout).toContain("import { getLocale } from 'next-intl/server'");
    expect(contactLayout).toContain('const locale = await getLocale();');
    expect(contactLayout).toContain('<ContactFixedHeader locale={locale} />');
    expect(contactHeader).toContain('export function ContactFixedHeader({ locale }: { locale: string })');
    expect(contactHeader).not.toContain('useSearchParams');
    expect(contactHeader).toContain('/platform-v7/register?lang=');
    expect(contactHeader).toContain('p7-contact-register');
    expect(contactHeader).toContain('/platform-v7/login?lang=');
    const headerIndex = contactLayout.indexOf('<ContactFixedHeader locale={locale} />');
    const contentIndex = contactLayout.indexOf('{children}');
    expect(headerIndex).toBeGreaterThan(-1);
    expect(contentIndex).toBeGreaterThan(headerIndex);
    expect(contact.toLowerCase()).not.toContain('controlled pilot');
    expect(contact.toLowerCase()).not.toContain('pre-integration');
  });

  it('states Gekta authority boundaries in human language without fake live sources', () => {
    expect(ai).not.toContain("status: 'NOT_ATTESTED'");
    expect(ai).toContain('Неподключённая внешняя система не отображается как подключённая.');
    expect(ai).toContain('Гекта не назначает роль и не меняет права доступа.');
    expect(ai).toContain('Гекта не подписывает, не отправляет и не выпускает деньги без разрешённого человеческого действия.');
    expect(ai).not.toContain('Vercel');
    expect(ai).not.toContain('Netlify');
    expect(aiPage).toContain("title: 'Гекта в работе — Прозрачная Цена'");
    expect(aiPage).toContain('/platform-v7/register');
  });

  it('keeps How it works ordinary-journey first and examples explicitly fictional', () => {
    expect(how).toContain("heading: 'От условий до закрытия — один понятный путь'");
    expect(how).toContain('Сначала разберите обычное успешное исполнение.');
    expect(how).toContain('Ниже используется вымышленный пример.');
    expect(how).toContain('/platform-v7/register');
    expect(how.toLowerCase()).not.toContain('controlled pilot');
  });

  it('removes invented privacy records and fake local request success', () => {
    for (const invented of [
      'ООО «ГрейнФлоу»',
      'Yandex Cloud',
      'Selectel',
      'Сбер',
      'SPARK',
      'Diadoc',
      'SBIS',
      'Wialon',
    ]) expect(privacyPanel).not.toContain(invented);
    expect(privacyPanel).toContain('не показывает вымышленные персональные записи, согласия, обращения или статусы');
    expect(privacyPanel).toContain('обращение считается направленным только после фактической отправки');
    expect(privacyPanel).toContain("href='/platform-v7/contact'");
    expect(privacyPanel).not.toContain('setActionStatus');
    expect(privacyPanel).not.toContain('setConsents');
    expect(privacyPolicy).toContain('Юридически значимые реквизиты оператора персональных данных публикуются только после их подтверждения официальными документами.');
  });

  it('keeps named accounting/EDI systems conditional instead of claiming active connections', () => {
    expect(accounting).toContain('Возможные маршруты подключения');
    expect(accounting).toContain('Перечень показывает поддерживаемые направления интеграции, а не подтверждение активного соединения.');
    expect(accounting).toContain('доступность конкретного маршрута и фактический обмен подтверждаются отдельно для организации');
    for (const overclaim of ['1С подключена', 'Диадок подключён', 'Saby подключён', 'без двойного ввода']) {
      expect(accounting).not.toContain(overclaim);
    }
  });
});
