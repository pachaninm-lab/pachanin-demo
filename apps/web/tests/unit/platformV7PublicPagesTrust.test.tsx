import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const about = read('app/platform-v7/about/page.tsx');
const contact = read('app/platform-v7/contact/ContactClient.tsx');
const contactPage = read('app/platform-v7/contact/page.tsx');
const ai = read('components/platform-v7/PublicAiInActionSimpleExperience.tsx');
const aiPage = read('app/platform-v7/ai-in-action/page.tsx');
const how = read('app/platform-v7/how-it-works/page.tsx');
const privacyPanel = read('components/platform-v7/PrivacyPortalPanel.tsx');
const privacyPolicy = read('app/platform-v7/privacy/page.tsx');
const accounting = read('i18n/platform-v7-accounting-value.ts');

describe('platform-v7 linked public-page trust', () => {
  it('keeps About crop-oriented and free of internal maturity shorthand', () => {
    expect(about).toContain("type Locale = 'ru' | 'en' | 'zh'");
    expect(about).toContain('сделок в растениеводстве');
    expect(about).toContain('/platform-v7/register');
    expect(about.toLowerCase()).not.toContain('controlled pilot');
    expect(about.toLowerCase()).not.toContain('pre-integration');
    expect(about.toLowerCase()).not.toContain('зерновой сделки');
  });

  it('keeps Contact a real inquiry channel and never presents it as account registration', () => {
    expect(contact).toContain("action='/api/platform-v7/inquiries'");
    expect(contact).toContain("name='consent'");
    expect(contact).toContain('Отправка обращения не открывает сделки, документы и закрытые разделы платформы.');
    expect(contact).toContain('/platform-v7/register');
    expect(contactPage).toContain("type Locale = 'ru' | 'en' | 'zh'");
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
      'Diadok',
      'SBIS',
      'Wialon',
    ]) expect(privacyPanel).not.toContain(invented);
    expect(privacyPanel).toContain('не показывает вымышленные персональные записи, согласия, обращения или статусы');
    expect(privacyPanel).toContain('обращение считается направленным только после фактической отправки');
    expect(privacyPanel).toContain("href='/platform-v7/contact'");
    expect(privacyPanel).not.toContain('setActionStatus');
    expect(privacyPanel).not.toContain('setConsents');
    expect(privacyPolicy).toContain('Юридически значимые сведения');
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
