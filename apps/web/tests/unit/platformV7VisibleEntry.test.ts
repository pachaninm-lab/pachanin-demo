import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, '../../app/platform-v7/page.tsx'), 'utf8');
const landingCopy = () => readFileSync(resolve(__dirname, '../../i18n/public-landing-copy.ts'), 'utf8');
const loginCopy = () => readFileSync(resolve(__dirname, '../../i18n/public-login-copy.ts'), 'utf8');
const executionOverview = () => readFileSync(resolve(__dirname, '../../components/v7r/PlatformV7IntelligenceStrip.tsx'), 'utf8');

describe('platform-v7 visible entry (mobile home)', () => {
  it('shows a concrete hero with two deliberate actions', () => {
    const page = pageSource();
    const copy = landingCopy();

    expect(copy).toContain('Зерновая сделка');
    expect(copy).toContain('Платформа ведёт сделку через перевозку, приёмку, проверку качества, документы и расчёты');
    expect(page).toContain("className='entry-primary-cta'");
    expect(page).toContain("className='entry-secondary-cta'");
    expect(page).not.toContain("className='entry-register-cta'");
    expect(copy).toContain('Подключить организацию');
  });

  it('shows participants without exposing role selection in the URL', () => {
    const page = pageSource();
    const copy = landingCopy();

    expect(copy).toContain('Участники сделки');
    expect(copy).toContain('Один вход для всех участников');
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
