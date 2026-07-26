import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 final design project v4 homepage', () => {
  const component = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const heroCopy = read('i18n/platform-v7-hero-message.ts');
  const storyCopy = read('i18n/platform-v7-home-story.ts');
  const page = read('app/platform-v7/page.tsx');
  const storyCss = read('components/platform-v7/PlatformV7StrategicHomeStory.module.css');

  it('opens with the approved category, result and two conversion actions', () => {
    expect(heroCopy).toContain("kicker: 'Платформа управления агросделками в растениеводстве'");
    expect(heroCopy).toContain("title: 'Управляйте агросделкой'");
    expect(heroCopy).toContain("accent: 'от цены до расчёта'");
    expect(heroCopy).toContain('TAI находит отклонения и объясняет следующий шаг');
    expect(component).toContain("href='#live'");
    expect(component).toContain("href='#connect-organization'");
    expect(component).toContain("data-testid='platform-v7-deal-card'");
  });

  it('ships explicit RU EN ZH final copy without fallback spreading', () => {
    expect(heroCopy).toContain("const messages: Record<'ru' | 'en' | 'zh'");
    expect(heroCopy).toContain("title: 'Manage an agricultural Deal'");
    expect(heroCopy).toContain("title: '管理农业交易'");
    expect(storyCopy).toContain('"ru": {');
    expect(storyCopy).toContain('"en": {');
    expect(storyCopy).toContain('"zh": {');
    expect(storyCopy).not.toContain('...ru');
  });

  it('orders the approved argument from differentiation to connection', () => {
    const hero = component.indexOf("className={`pc-v6-hero ${styles.hero}`}");
    const difference = component.indexOf("id='difference'");
    const functions = component.indexOf("id='functions'");
    const path = component.indexOf("id='deal-path'");
    const live = component.indexOf("id='live'");
    const roles = component.indexOf("id='participants'");
    const tai = component.indexOf("id='tai'");
    const trust = component.indexOf("id='maturity'");
    const faq = component.indexOf("id='faq'");
    const connect = component.indexOf('<OrganizationConnectForm locale={locale} />');

    expect(hero).toBeGreaterThan(-1);
    expect(difference).toBeGreaterThan(hero);
    expect(functions).toBeGreaterThan(difference);
    expect(path).toBeGreaterThan(functions);
    expect(live).toBeGreaterThan(path);
    expect(roles).toBeGreaterThan(live);
    expect(tai).toBeGreaterThan(roles);
    expect(trust).toBeGreaterThan(tai);
    expect(faq).toBeGreaterThan(trust);
    expect(connect).toBeGreaterThan(faq);
  });

  it('implements normal, deviation and abstention states without fake authority', () => {
    expect(component).toContain("name='public-deal-state'");
    expect(component).toContain("defaultChecked={index === 1}");
    expect(storyCopy).toContain('"tab": "Норма"');
    expect(storyCopy).toContain('"tab": "Отклонение"');
    expect(storyCopy).toContain('"tab": "Спор / нет данных"');
    expect(storyCopy).toContain('TAI воздержался от вывода');
    expect(storyCopy).toContain('TAI не меняет договор и не разрешает расчёт самостоятельно');
    expect(storyCopy).toContain('не разрешает платёж и не выносит юридическое решение');
  });

  it('retains critical public layout, structured data and accessibility authority', () => {
    expect(page).toContain('CRITICAL_HOME_CSS');
    expect(page).toContain('--entry-public-header-offset');
    expect(component).toContain("type='application/ld+json'");
    expect(storyCss).toContain('@media (max-width: 767px)');
    expect(storyCss).toContain('@media (max-width: 359px)');
    expect(storyCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(storyCss).toContain('@media (forced-colors: active)');
    expect(storyCss).toContain('min-height: 44px');
  });
});
