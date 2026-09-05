import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

const storyOperating = read('i18n/platform-v7-home-story-operating.ts');
const storyEntry = read('i18n/platform-v7-home-story-product.ts');
const home = read('i18n/platform-v7-home-v3-operating.ts');
const homeEntry = read('i18n/platform-v7-home-v3-product.ts');
const connect = read('i18n/platform-v7-organization-connect-operating.ts');
const connectEntry = read('i18n/platform-v7-organization-connect-product.ts');
const hero = read('i18n/platform-v7-hero-message.ts');
const roleWorkspace = read('components/platform-v7/PublicDealRoleScenario.tsx');
const roleWorkspaceCss = read('components/platform-v7/PublicDealRoleScenario.module.css');

describe('platform-v7 visible public operating copy', () => {
  it('presents one seven-step ordinary Deal journey across the homepage and role preview', () => {
    for (const step of [
      'Товар и условия',
      'Торги и контрагент',
      'Сделка и договор',
      'Логистика и поставка',
      'Приёмка и качество',
      'Документы и готовность расчёта',
      'Расчёт и закрытие',
    ]) {
      expect(storyEntry).toContain(`title: '${step}'`);
      expect(roleWorkspace).toContain(`'${step}'`);
    }
    expect(storyEntry).toContain("journey: '7 шагов'");
    expect(home).toContain("phases: ['Товар и условия', 'Торги и контрагент', 'Сделка и договор'");
    expect(roleWorkspace).toContain("stageLabel: '7 шагов Сделки'");
    expect(roleWorkspace).toContain("status: 'Шаг 5 · Приёмка и качество'");
    expect(roleWorkspaceCss).toContain('grid-template-columns: repeat(7, minmax(0, 1fr));');
    expect(roleWorkspaceCss).toContain('grid-template-columns: repeat(7, minmax(86px, 1fr));');
    expect(storyEntry).not.toContain("navFunctions: '8 шагов Сделки'");
    expect(storyEntry).not.toContain("fullPathText: '19 этапов");
  });

  it('uses exactly nine public visitor roles in the visible proof and selector', () => {
    expect(storyEntry).toContain("label: '9 ролей'");
    expect(storyEntry).toContain("label: '9 roles'");
    expect(storyEntry).toContain("label: '9 个角色'");
    for (const role of ["'seller'", "'buyer'", "'logistics'", "'driver'", "'storage'", "'laboratory'", "'surveyor'", "'bank'", "'employee'"]) {
      expect(roleWorkspace).toContain(role);
    }
    for (const retiredPublicRole of ["| 'operator'", "| 'compliance'", "| 'arbitrator'", "| 'executive'"]) {
      expect(roleWorkspace).not.toContain(retiredPublicRole);
    }
  });

  it('keeps the public role selector keyboard complete without granting authority', () => {
    expect(roleWorkspace).toContain("role='tablist'");
    expect(roleWorkspace).toContain("aria-orientation='horizontal'");
    expect(roleWorkspace).toContain("aria-controls='public-role-panel'");
    expect(roleWorkspace).toContain("id='public-role-panel'");
    expect(roleWorkspace).toContain('tabIndex={role === key ? 0 : -1}');
    expect(roleWorkspace).toContain('aria-labelledby={`public-role-tab-${role}`}');
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
      expect(roleWorkspace).toContain(`case '${key}':`);
    }
    expect(roleWorkspace).toContain("querySelectorAll<HTMLButtonElement>('[role=\"tab\"]')");
    expect(roleWorkspace).toContain('event.preventDefault()');
    expect(roleWorkspace).toContain('tabs?.[nextIndex]?.focus()');
    expect(roleWorkspace).toContain('реальные полномочия определяются системой после регистрации и проверки организации');
  });

  it('keeps crop positioning and registration-first conversion on the first screen', () => {
    expect(hero).toContain('Платформа управления агросделками в растениеводстве');
    expect(hero).toContain("title: 'Управляйте агросделкой'");
    expect(home).toContain("nav: { connect: 'Зарегистрироваться'");
    expect(home).toContain("secondary: 'Зарегистрироваться'");
    expect(home).toContain("tertiary: 'Скачать презентацию'");
    expect(home).toContain("primary: 'Посмотреть, как работает Сделка'");
  });

  it('keeps organization intake as optional assistance rather than registration', () => {
    for (const task of [
      'Полный цикл Сделки',
      'Поставка, логистика и приёмка',
      'Качество, лаборатория и перерасчёт',
      'Документы, подписи и доказательства',
      'Финансирование, расчёты и сверка',
      'Единый обмен данными организации',
    ]) {
      expect(connect).toContain(task);
    }
    expect(connect).toContain("eyebrow: 'Дополнительная помощь'");
    expect(connect).toContain('Эта форма не является регистрацией');
    expect(connect).toContain("submit: 'Отправить запрос на помощь'");
    expect(connect).toContain('Для создания аккаунта используйте отдельную регистрацию платформы');
  });

  it('keeps examples honest while avoiding internal maturity jargon in final visible layers', () => {
    const renderedSources = [storyEntry, home, connect, hero, roleWorkspace].join('\n').toLowerCase();
    for (const phrase of [
      'controlled pilot',
      'pre-integration',
      'not_attested',
      'production-like simulation',
      'lead capture',
      'crm',
    ]) {
      expect(renderedSources).not.toContain(phrase);
    }
    expect(storyEntry).toContain('Обычное исполнение — основной сценарий');
    expect(storyEntry).toContain('Отклонение и спор — отдельные примеры исключений');
    expect(roleWorkspace).toContain("preview: 'Вымышленный пример Сделки'");
  });

  it('keeps source-resolution wrappers explicit without relying on stale base copy', () => {
    expect(storyEntry).toContain("from './platform-v7-home-story-operating'");
    expect(homeEntry).toContain("from './platform-v7-home-v3-operating'");
    expect(connectEntry).toContain("from './platform-v7-organization-connect-operating'");
    expect(storyOperating).toContain('export function getPlatformV7HomeStoryCopy');
    expect(roleWorkspace).toContain("role='tablist'");
    expect(roleWorkspace).toContain("role='tabpanel'");
  });
});