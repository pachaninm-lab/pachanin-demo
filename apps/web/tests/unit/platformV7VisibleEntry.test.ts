import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, '../../app/platform-v7/page.tsx'), 'utf8');
const ruMessages = () => readFileSync(resolve(__dirname, '../../messages/ru.json'), 'utf8');
const publicMessages = () => readFileSync(resolve(__dirname, '../../i18n/public-entry-messages.ts'), 'utf8');

describe('platform-v7 visible entry (mobile home)', () => {
  it('shows the hero with two deliberate actions', () => {
    const page = pageSource();
    const copy = ruMessages();

    expect(copy).toContain('Главный риск сделки');
    expect(copy).toContain('Прозрачная Цена — цифровой контур исполнения зерновой сделки');
    expect(page).toContain("className='entry-primary-cta'");
    expect(page).toContain("className='entry-secondary-cta'");
    expect(page).not.toContain("className='entry-register-cta'");
    expect(copy).toContain('Подключить организацию');
  });

  it('shows participant workspaces without exposing role selection in the URL', () => {
    const page = pageSource();
    const copy = ruMessages();
    const entryCopy = publicMessages();

    expect(entryCopy).toContain('Рабочие места участников сделки');
    expect(entryCopy).toContain('Вход единый');
    expect(page).toContain("href: '/platform-v7/login'");
    expect(page).not.toContain('/platform-v7/login?role=');
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(copy).toContain('После согласования цены под контролем остаётся главное');
    expect(page).not.toContain('Не поиск зерна ради поиска');
    expect(copy).not.toContain('Не поиск зерна ради поиска');
  });

  it('keeps maturity honest and avoids fake-live claims', () => {
    const joined = pageSource() + ruMessages() + publicMessages();
    expect(joined).not.toMatch(/production-ready|fully live|fully integrated|bank connected|FGIS connected|EDO connected/i);
  });
});
