import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public homepage entry', () => {
  const component = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const heroCopy = read('i18n/platform-v7-hero-message.ts');
  const storyCopy = read('i18n/platform-v7-home-story.ts');
  const productStory = read('i18n/platform-v7-home-story-product.ts');
  const homeCopy = read('i18n/platform-v7-home-v3-operating.ts');
  const page = read('app/platform-v7/page.tsx');
  const storyCss = read('components/platform-v7/PlatformV7StrategicHomeStory.module.css');

  it('keeps the approved crop category while making registration the primary conversion', () => {
    expect(heroCopy).toContain("kicker: 'Платформа управления агросделками в растениеводстве");
    expect(heroCopy).toContain("title: 'Управляйте агросделкой'");
    expect(heroCopy).toContain("accent: 'от цены до расчёта'");
    expect(component).toContain('const registerHref = `/platform-v7/register?lang=');
    expect(component).toContain("href={registerHref}");
    expect(component).toContain("eventName='registration_open'");
    expect(component).toContain("href='#live'");
    expect(component).toContain("href='/downloads/prozrachnaya-tsena-presentation.pdf'");
    expect(homeCopy).toContain("secondary: 'Зарегистрироваться'");
    expect(homeCopy).toContain("tertiary: 'Скачать презентацию'");
    expect(component).toContain("data-testid='platform-v7-deal-card'");
  });

  it('owns RU EN ZH semantic copy in source instead of CSS replacement', () => {
    expect(heroCopy).toContain("const messages: Record<'ru' | 'en' | 'zh'");
    expect(heroCopy).toContain("title: 'Manage an agricultural Deal'");
    expect(heroCopy).toContain("title: '管理农业交易'");
    expect(productStory).toContain("roles: '9 ролей'");
    expect(productStory).toContain("journey: '7 шагов'");
    expect(page).not.toContain(".pc-v6-kicker::before");
    expect(page).not.toContain("font-size: 0");
  });

  it('orders the visitor argument from role value through ordinary journey to trust and registration', () => {
    const hero = component.indexOf("className={`pc-v6-hero ${styles.hero}`}");
    const roles = component.indexOf("id='participants'");
    const difference = component.indexOf("id='difference'");
    const path = component.indexOf("id='deal-path'");
    const functions = component.indexOf("id='functions'");
    const live = component.indexOf("id='live'");
    const trust = component.indexOf("id='trust'");
    const tai = component.indexOf("id='tai'");
    const faq = component.indexOf("id='faq'");
    const final = component.indexOf("aria-labelledby='registration-title'");
    const connect = component.indexOf('<OrganizationConnectForm locale={locale} />');

    for (const index of [hero, roles, difference, path, functions, live, trust, tai, faq, final, connect]) {
      expect(index).toBeGreaterThan(-1);
    }
    expect(roles).toBeGreaterThan(hero);
    expect(difference).toBeGreaterThan(roles);
    expect(path).toBeGreaterThan(difference);
    expect(functions).toBeGreaterThan(path);
    expect(live).toBeGreaterThan(functions);
    expect(trust).toBeGreaterThan(live);
    expect(tai).toBeGreaterThan(trust);
    expect(faq).toBeGreaterThan(tai);
    expect(final).toBeGreaterThan(faq);
    expect(connect).toBeGreaterThan(final);
  });

  it('presents normal execution first and keeps deviation/dispute as explicit exception states', () => {
    expect(component).toContain("name='public-deal-state'");
    expect(component).toContain('defaultChecked={index === 0}');
    expect(storyCopy).toContain("tab: 'Норма'");
    expect(storyCopy).toContain("tab: 'Отклонение'");
    expect(storyCopy).toContain("tab: 'Спор / нет данных'");
    expect(productStory).toContain('Отклонение или спор не являются обязательным этапом');
    expect(productStory).toContain("processTitle: 'Семь шагов обычной агросделки'");
  });

  it('retains critical layout, structured data and accessibility authority', () => {
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
