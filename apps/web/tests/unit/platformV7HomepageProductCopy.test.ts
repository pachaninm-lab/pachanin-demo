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
    expect(hero).toContain('Одна платформа управляет торгами');
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
    expect(story).toContain('Конкретная схема, доступность интеграции и права подтверждаются для организации до обмена данными.');
    expect(story).not.toContain('бухгалтер продолжает работать в привычной 1С и ЭДО');
    expect(story).not.toContain('без двойного ввода');
  });

  it('keeps internal maturity jargon out of final homepage copy while preserving honest example language', () => {
    const publicCopy = [story, home, homeOperating, hero, connect, page].join('\n').toLowerCase();
    for (const phrase of ['controlled pilot', 'pre-integration', 'not_attested', 'production-like simulation', 'fake-live']) {
      expect(publicCopy).not.toContain(phrase);
    }
    expect(story).toContain('Обычное исполнение — основной сценарий');
    expect(story).toContain('Отклонение и спор — отдельные примеры исключений');
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
    expect(story).toContain('Критические решения подтверждает уполномоченный участник.');
    expect(story).toContain('Critical decisions are confirmed by an authorised participant.');
    expect(story).toContain('关键决定由获授权的参与方确认。');
  });
});
