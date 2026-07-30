import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

const story = read('i18n/platform-v7-home-story-product.ts');
const home = read('i18n/platform-v7-home-v3-product.ts');
const hero = read('i18n/platform-v7-hero-message.ts');
const connect = read('i18n/platform-v7-organization-connect-product.ts');
const component = read('components/platform-v7/PlatformV7StrategicHome.tsx');
const tsconfig = JSON.parse(read('tsconfig.json')) as {
  compilerOptions?: { paths?: Record<string, string[]> };
};

describe('platform-v7 homepage operating-product copy', () => {
  it('keeps the approved structure and design entrypoints unchanged', () => {
    expect(component).toContain("import '@/styles/platform-v7-public-assistant.css'");
    expect(component).toContain("import styles from './PlatformV7StrategicHomeStory.module.css'");
    expect(component).toContain("className={`pc-v6-hero ${styles.hero}`}");
    expect(component).toContain("<OrganizationConnectForm locale={locale} />");
  });

  it('routes only copy imports through the product-copy layer', () => {
    const paths = tsconfig.compilerOptions?.paths ?? {};
    expect(paths['@/i18n/platform-v7-home-v3']).toEqual(['./i18n/platform-v7-home-v3-product.ts']);
    expect(paths['@/i18n/platform-v7-home-story']).toEqual(['./i18n/platform-v7-home-story-product.ts']);
    expect(paths['@/i18n/platform-v7-organization-connect']).toEqual(['./i18n/platform-v7-organization-connect-product.ts']);
  });

  it('presents one operating platform in RU EN ZH', () => {
    expect(hero).toContain('Одна платформа управляет торгами');
    expect(story).toContain('Полный контур агросделки собран в одной рабочей системе');
    expect(story).toContain('The complete agricultural Deal workflow in one operating system');
    expect(story).toContain('完整农业交易流程集中在同一工作系统');
    expect(story).toContain('Все функции работают как единая Сделка');
    expect(story).toContain('Every capability works as one Deal');
    expect(story).toContain('所有能力共同构成同一笔交易');
  });

  it('removes development-stage, demonstration and hidden integration-status wording', () => {
    const publicCopy = [story, home, hero, connect].join('\n');
    const forbidden = [
      'Демонстрационный сценарий',
      'Сценарий демонстрационный',
      'демонстрационной Сделки',
      'demonstration scenario',
      'Demonstration Deal',
      '演示场景',
      'В реализации',
      'In implementation',
      '实施中',
      'Подтверждается при подключении',
      'Требует адаптера',
      'Требует отдельного подключения',
      'fake-live',
      'план подключения',
    ];

    for (const phrase of forbidden) expect(publicCopy.toLowerCase()).not.toContain(phrase.toLowerCase());
  });

  it('ends with one clear, actionable next step in every locale', () => {
    expect(home).toContain("secondary: 'Начать работу с платформой'");
    expect(connect).toContain("submit: 'Начать подключение'");
    expect(connect).toContain("submit: 'Start connection'");
    expect(connect).toContain("submit: '开始接入'");
    expect(connect).toContain('После отправки вы получите номер заявки и подтверждённый следующий шаг.');
  });

  it('keeps critical decisions with the authorised participant', () => {
    expect(story).toContain('Критические решения подтверждает уполномоченный участник.');
    expect(story).toContain('Critical decisions are confirmed by an authorised participant.');
    expect(story).toContain('关键决定由获授权的参与方确认。');
  });
});
