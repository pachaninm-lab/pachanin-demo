import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, '../../app/platform-v7/page.tsx'), 'utf8');
const landingCopy = () => readFileSync(resolve(__dirname, '../../i18n/public-landing-copy.ts'), 'utf8');
const loginCopy = () => readFileSync(resolve(__dirname, '../../i18n/public-login-copy.ts'), 'utf8');
const publicHeader = () => readFileSync(resolve(__dirname, '../../components/platform-v7/PublicSiteHeader.tsx'), 'utf8');
const executionOverview = () => readFileSync(resolve(__dirname, '../../components/v7r/PlatformV7IntelligenceStrip.tsx'), 'utf8');

describe('platform-v7 visible entry (mobile home)', () => {
  it('front-loads the user task and keeps two deliberate actions', () => {
    const page = pageSource();
    const copy = landingCopy();

    expect(page).toContain("ru: ['Управляйте зерновой сделкой', 'от условий до расчёта.']");
    expect(copy).toContain('Каждый участник видит статус и своё следующее действие');
    expect(page).toContain("className='entry-primary-cta'");
    expect(page).toContain("className='entry-secondary-cta'");
    expect(page).not.toContain("className='entry-register-cta'");
    expect(page).not.toContain('▷');
    expect(copy).toContain('Подключить организацию');
  });

  it('removes redundant mobile navigation and restores support', () => {
    const page = pageSource();
    const header = publicHeader();

    expect(page).toContain('showMobileMenu={false}');
    expect(header).toContain('nav && showMobileMenu');
    expect(header).toContain('<ChatSupportWidget />');
    expect(page).toContain('.pc-v7-public-entry .p7-support-chat-button');
    expect(page).toContain("bottom:calc(env(safe-area-inset-bottom,0px) + 18px)!important");
  });

  it('uses descriptive navigation and access labels', () => {
    const page = pageSource();
    const copy = landingCopy();
    const login = loginCopy();

    expect(copy).toContain('Участники сделки');
    expect(copy).toContain('Войдите один раз');
    expect(copy).toContain('Задать вопрос');
    expect(login).toContain('Восстановить доступ');
    expect(page).toContain("href='/platform-v7/login'");
    expect(page).not.toContain('/platform-v7/login?role=');
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
  });

  it('keeps landing and login copy free of demo, maturity and machine-written language', () => {
    const joined = [pageSource(), landingCopy(), loginCopy(), executionOverview()].join('\n');

    expect(joined).not.toMatch(/production-ready|fully live|fully integrated|bank connected|FGIS connected|EDO connected/i);
    expect(joined).not.toMatch(/\bpilot\b|\bdemo\b|пилот|демо/i);

    for (const phrase of [
      'цифровой контур',
      'единый контур',
      'проверяемая база',
      'исполнение под контролем',
      'главный риск начинается',
      'революционный',
      'инновационный',
      'нового поколения',
      'на базе искусственного интеллекта',
    ]) {
      expect(joined.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});
