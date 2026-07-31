import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

const story = read('i18n/platform-v7-home-story-operating.ts');
const storyEntry = read('i18n/platform-v7-home-story-product.ts');
const home = read('i18n/platform-v7-home-v3-operating.ts');
const homeEntry = read('i18n/platform-v7-home-v3-product.ts');
const connect = read('i18n/platform-v7-organization-connect-operating.ts');
const connectEntry = read('i18n/platform-v7-organization-connect-product.ts');
const hero = read('i18n/platform-v7-hero-message.ts');
const roleWorkspace = read('components/platform-v7/PublicDealRoleScenario.tsx');

describe('platform-v7 complete visible operating-product copy', () => {
  it('shows the requested Deal scenario as seven explicit steps', () => {
    for (const step of [
      'Лот и условия',
      'Торги и выбор предложения',
      'Поставка',
      'Лабораторное отклонение',
      'Анализ TAI',
      'Решение участника',
      'Расчёт или спор',
    ]) {
      expect(story).toContain(`title: '${step}'`);
    }

    expect(story).toContain("title: 'Доказательства и аналитика'");
    expect(story).toContain('Семь шагов работают как одна Сделка');
  });

  it('puts concrete product scale and multilingual coverage in the visible proof strip', () => {
    expect(story).toContain("label: '12 ролей'");
    expect(story).toContain("label: '19 этапов'");
    expect(story).toContain("label: 'RU · EN · ZH'");
    expect(story).toContain("label: 'TAI внутри Сделки'");

    expect(story).toContain("label: '12 roles'");
    expect(story).toContain("label: '19 stages'");
    expect(story).toContain("label: '12 个角色'");
    expect(story).toContain("label: '19 个阶段'");
  });

  it('names the target participants and full Deal outcome on the first screen', () => {
    expect(hero).toContain('производитель, покупатель, логистика, элеватор, лаборатория, финансы и контроль');
    expect(hero).toContain('от лота до расчёта и спора');
    expect(home).toContain("proofLabel: '12 ролей · 19 этапов · RU/EN/ZH · TAI'");
    expect(home).toContain("primary: 'Посмотреть Сделку в работе'");
    expect(home).toContain("secondary: 'Начать работу с платформой'");
  });

  it('uses business tasks and one durable next step in the organization form', () => {
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

    expect(connect).toContain("submit: 'Начать подключение'");
    expect(connect).toContain('После отправки вы получите номер заявки и подтверждённый следующий шаг.');
  });

  it('removes residual example, stage and hidden-integration language from rendered sources', () => {
    const renderedSources = [story, home, connect, hero, roleWorkspace].join('\n');
    const forbidden = [
      'Демонстрационный сценарий',
      'Сценарий демонстрационный',
      'демонстрационной Сделки',
      'demonstration scenario',
      'Demonstration Deal',
      '演示场景',
      'Пример интерфейса',
      'Interface example',
      '界面示例',
      'Ролевое представление одного сценария',
      'Переключение не открывает данные и не меняет права',
      'Интеграция с внешней системой',
      'External-system integration',
      '外部系统集成',
      'В реализации',
      'In implementation',
      '实施中',
      'Подтверждается при подключении',
      'Требует адаптера',
      'Требует отдельного подключения',
      'fake-live',
      'план подключения',
    ];

    for (const phrase of forbidden) {
      expect(renderedSources.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it('keeps the existing public entrypoints while routing to the final copy layers', () => {
    expect(storyEntry).toContain("from './platform-v7-home-story-operating'");
    expect(homeEntry).toContain("from './platform-v7-home-v3-operating'");
    expect(connectEntry).toContain("from './platform-v7-organization-connect-operating'");
    expect(roleWorkspace).toContain("role='tablist'");
    expect(roleWorkspace).toContain("role='tabpanel'");
  });
});
