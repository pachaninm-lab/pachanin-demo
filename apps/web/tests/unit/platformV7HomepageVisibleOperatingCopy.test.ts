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
const internationalCss = read('styles/platform-v7-international-home-fix.css');

describe('platform-v7 visible public operating copy', () => {
  it('presents one seven-step Deal journey from product to closure across the homepage and workspace', () => {
    for (const step of [
      'Товар, потребность и условия',
      'Рынок, контрагент и предложение',
      'Переговоры, Сделка и договор',
      'Сервисы и логистика',
      'Приёмка, качество и проверки',
      'Документы, расчёт и учёт',
      'Закрытие и исключения',
    ]) {
      expect(storyOperating).toContain(`title: '${step}'`);
    }

    for (const roleStep of [
      'Товар и условия',
      'Торги и контрагент',
      'Сделка и договор',
      'Логистика и поставка',
      'Приёмка и качество',
      'Документы и расчёт',
      'Закрытие',
    ]) {
      expect(roleWorkspace).toContain(`label: '${roleStep}'`);
    }

    expect(storyOperating).toContain("label: '7 шагов'");
    expect(home).toContain("phases: ['Товар и условия', 'Торги и контрагент', 'Сделка и договор'");
    expect(roleWorkspace).toContain("stageLabel: 'Семь этапов одной Сделки'");
    expect(roleWorkspace).toContain('const [stageIndex, setStageIndex] = useState(0);');
    expect(roleWorkspace).toContain('const selectedStage = stageList[stageIndex]!;');
    expect(roleWorkspace).toContain("aria-current={index === stageIndex ? 'step' : undefined}");
    expect(roleWorkspace).toContain('onClick={() => setStageIndex(index)}');
    expect(roleWorkspace).not.toContain('styles.done');
    expect(roleWorkspace).not.toContain('status:');
  });

  it('uses exactly nine public visitor roles in the visible story and selector', () => {
    expect(storyOperating).toContain("label: '9 ролей'");
    expect(storyOperating).toContain("label: '9 roles'");
    expect(storyOperating).toContain("label: '9 个角色'");

    for (const role of ["'seller'", "'buyer'", "'logistics'", "'driver'", "'storage'", "'laboratory'", "'surveyor'", "'bank'", "'employee'"]) {
      expect(roleWorkspace).toContain(role);
    }

    for (const retiredPublicRole of ["| 'operator'", "| 'compliance'", "| 'arbitrator'", "| 'executive'"]) {
      expect(roleWorkspace).not.toContain(retiredPublicRole);
    }

    expect(storyOperating).toContain('Продавец, покупатель, логистика, водитель, элеватор или хранение, лаборатория, сюрвейер, банк или финансы и сотрудник платформы');
  });

  it('keeps the public role selector keyboard complete without granting authority', () => {
    expect(roleWorkspace).toContain("role='tablist'");
    expect(roleWorkspace).toContain("aria-orientation='horizontal'");
    expect(roleWorkspace).toContain("aria-controls='public-role-panel'");
    expect(roleWorkspace).toContain("id='public-role-panel'");
    expect(roleWorkspace).toContain('tabIndex={role === key ? 0 : -1}');
    expect(roleWorkspace).toContain('aria-labelledby={`public-role-tab-${role}`}');

    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
      expect(roleWorkspace).toContain(`case '${key}'`);
    }

    expect(roleWorkspace).toContain("querySelectorAll<HTMLButtonElement>('[role=\"tab\"]')");
    expect(roleWorkspace).toContain('event.preventDefault()');
    expect(roleWorkspace).toContain('tabs?.[nextIndex]?.focus()');
    expect(roleWorkspace).toContain('реальные полномочия определяются системой после регистрации и проверки организации');
  });

  it('changes the simplified workspace by Deal stage while role switching changes the participant lens', () => {
    expect(roleWorkspace).toContain('{selectedStage.focus}');
    expect(roleWorkspace).toContain('{selectedStage.title}');
    expect(roleWorkspace).toContain('{selectedStage.explanation}');
    expect(roleWorkspace).toContain('selectedStage.cards.map');
    expect(roleWorkspace).toContain('{selectedStage.next}');
    expect(roleWorkspace).toContain('{selectedStage.evidence}');
    expect(roleWorkspace).toContain('{selectedRole.lens}');
    expect(roleWorkspace).toContain('{selectedRole.responsibility}');
    expect(roleWorkspace).toContain('{selectedRole.money}');
    expect(roleWorkspace).toContain("deal: 'Одна Сделка · растениеводство'");
    expect(roleWorkspace).toContain('Упрощённый публичный пример');
  });

  it('embeds Gekta inside every Deal stage without transferring decision authority', () => {
    expect(roleWorkspace).toContain("gekta: 'Гекта в контексте Сделки'");
    expect(roleWorkspace).toContain('{selectedStage.gekta}');
    expect(roleWorkspace).toContain('{copy.gektaLimit}');
    expect(roleWorkspace).toContain('критическое решение остаётся за уполномоченным участником');
    expect(roleWorkspace).toContain("className={styles.gektaCard}");
  });

  it('treats mobile as a linear stage story rather than shrinking the desktop seven-column rail', () => {
    expect(roleWorkspaceCss).toContain('grid-template-columns: repeat(7, minmax(0, 1fr));');
    expect(roleWorkspaceCss).toContain('@media (max-width: 720px)');
    expect(roleWorkspaceCss).toContain('.stageRail {\n    display: flex;');
    expect(roleWorkspaceCss).toContain('min-width: 156px;');
    expect(roleWorkspaceCss).toContain('scroll-snap-type: x mandatory;');
    expect(roleWorkspaceCss).toContain('@media (max-width: 430px)');
    expect(roleWorkspaceCss).toContain('@media (max-width: 359px)');
    expect(roleWorkspaceCss).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('keeps crop positioning and registration-first conversion on the first screen', () => {
    expect(hero).toContain('Платформа управления агросделками в растениеводстве');
    expect(hero).toContain("title: 'Управляйте агросделкой'");
    expect(home).toContain("nav: { connect: 'Начать'");
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

  it('keeps the new role story free of public readiness/status badges and internal marketing language', () => {
    const renderedSources = [storyOperating, home, connect, hero, roleWorkspace].join('\n').toLowerCase();

    for (const phrase of [
      'controlled pilot',
      'pre-integration',
      'not_attested',
      'production-like simulation',
      'lead capture',
      'crm',
      "status: 'шаг",
      "status: 'step",
      "status: '第",
    ]) {
      expect(renderedSources).not.toContain(phrase);
    }

    expect(roleWorkspace).not.toContain('status:');
    expect(roleWorkspace).not.toContain('readiness');
    expect(roleWorkspace).not.toContain('maturity');
    expect(roleWorkspace).toContain("preview: 'Упрощённый экран рабочего кабинета'");
    expect(storyOperating).toContain("state: 'Факты · основания · следующий шаг'");
    expect(storyOperating).toContain('Публичная помощь с подключением остаётся отдельным каналом');
    expect(internationalCss).toContain("[data-testid='platform-v7-deal-card'] > div:first-child > b");
    expect(internationalCss).toContain("#live article[data-state] > div:first-child > b");
    expect(internationalCss).toContain('display: none !important');
  });

  it('adds purposeful scroll pacing with a static reduced-motion equivalent', () => {
    expect(internationalCss).toContain('#deal-path > div:has(> article)');
    expect(internationalCss).toContain('position: sticky !important');
    expect(internationalCss).toContain('@supports (animation-timeline: view())');
    expect(internationalCss).toContain('animation-timeline: view()');
    expect(internationalCss).toContain('@keyframes pc-public-story-reveal');
    expect(internationalCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(internationalCss).toContain('animation: none !important');
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
