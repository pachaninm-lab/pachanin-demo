import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
const wrapper = read('components/platform-v7/PlatformV7StrategicHomeInternational.tsx');
const page = read('app/platform-v7/page.tsx');
const hero = read('i18n/platform-v7-hero-message.ts');
const story = read('i18n/platform-v7-home-story-product.ts');
const homeCopy = read('i18n/platform-v7-home-v3-operating.ts');
const roles = read('components/platform-v7/PublicDealRoleScenario.tsx');
const assistance = read('i18n/platform-v7-organization-connect-operating.ts');

describe('platform-v7 public entry clarity', () => {
  it('answers what the product is before asking for any form submission', () => {
    expect(hero).toContain('Платформа управления агросделками в растениеводстве');
    expect(hero).toContain("title: 'Управляйте агросделкой'");
    expect(hero).toContain('Одна платформа связывает товар и условия');
    expect(hero).toContain('отклонение или спор подключаются только при необходимости');
    expect(home).toContain("data-testid='platform-v7-deal-card'");
  });

  it('uses registration as the only primary conversion in header, hero and final CTA', () => {
    expect(home).toContain('const registerHref = `/platform-v7/register?lang=');
    expect(home.match(/href=\{registerHref\}/g)?.length).toBeGreaterThanOrEqual(3);
    expect(home.match(/eventName='registration_open'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(homeCopy).toContain("nav: { connect: 'Зарегистрироваться'");
    expect(homeCopy).toContain("primary: 'Зарегистрироваться'");
    expect(homeCopy).toContain("secondary: 'Нужна помощь с подключением'");
    expect(home).toContain("href='#live'");
    expect(home).toContain("href='/downloads/prozrachnaya-tsena-presentation.pdf'");
  });

  it('shows exactly nine public visitor roles and never treats selection as authority', () => {
    for (const key of ['seller', 'buyer', 'logistics', 'driver', 'storage', 'laboratory', 'surveyor', 'bank', 'employee']) {
      expect(roles).toContain(`| '${key}'`);
    }
    for (const internalKey of ['operator', 'compliance', 'arbitrator', 'executive']) {
      expect(roles).not.toContain(`| '${internalKey}'`);
    }
    expect(story).toContain("roles: '9 ролей'");
    expect(roles).toContain('реальные полномочия определяются системой после регистрации и проверки организации');
    expect(roles).not.toContain('accessToken');
    expect(roles).not.toContain('tenantId');
    expect(roles).not.toContain('fetch(');
  });

  it('uses one seven-step ordinary Deal mental model', () => {
    expect(story).toContain("journey: '7 шагов'");
    for (const step of [
      'Товар и условия',
      'Торги и контрагент',
      'Сделка и договор',
      'Логистика и поставка',
      'Приёмка и качество',
      'Документы и готовность расчёта',
      'Расчёт и закрытие',
    ]) expect(story).toContain(`title: '${step}'`);
    expect(story).toContain('Отклонение или спор не являются обязательным этапом');
    expect(story).not.toContain("fullPathText: '19 этапов");
  });

  it('keeps organization intake visibly separate from account registration', () => {
    expect(assistance).toContain("eyebrow: 'Дополнительная помощь'");
    expect(assistance).toContain('Эта форма не является регистрацией');
    expect(assistance).toContain("submit: 'Отправить запрос на помощь'");
    expect(assistance).toContain('Для создания аккаунта используйте отдельную регистрацию платформы');
  });

  it('has one visitor-visible source tree instead of post-render copy substitution', () => {
    expect(wrapper).toContain('return BasePlatformV7StrategicHome();');
    expect(wrapper).not.toContain('cloneElement');
    expect(wrapper).not.toContain('return null;');
    expect(page).not.toContain('.pc-v6-kicker::before');
    expect(page).not.toContain('font-size: 0');
  });
});
