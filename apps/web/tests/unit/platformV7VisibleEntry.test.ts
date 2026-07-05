import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Главный экран = мобильная витрина входа:
// герой + единый primary CTA + выбор роли + честная подача без fake-live.
const pageSource = () => readFileSync(resolve(__dirname, '../../app/platform-v7/page.tsx'), 'utf8');
// Копия главной вынесена в next-intl сообщения; проверяем русский источник правды.
const ruMessages = () => readFileSync(resolve(__dirname, '../../messages/ru.json'), 'utf8');

describe('platform-v7 visible entry (mobile home)', () => {
  it('shows the hero and a single primary action', () => {
    const page = pageSource();
    const copy = ruMessages();
    expect(copy).toContain('Главный риск сделки');
    expect(copy).toContain('Прозрачная Цена — цифровой контур исполнения зерновой сделки');
    // The one visually-primary action on the hero is "Подключить организацию".
    expect(page).toContain('entry-primary-cta');
    expect(copy).toContain('Подключить организацию');
  });

  it('shows role entry points and human public copy', () => {
    const page = pageSource();
    const copy = ruMessages();
    expect(copy).toContain('Выберите свою роль');
    expect(page).toContain('/platform-v7/login?role=operator');
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(copy).toContain('После согласования цены под контролем остаётся главное');
    expect(page).not.toContain('Не поиск зерна ради поиска');
    expect(copy).not.toContain('Не поиск зерна ради поиска');
  });

  it('keeps maturity honest and avoids fake-live claims', () => {
    const joined = pageSource() + ruMessages();
    expect(joined).not.toMatch(/production-ready|fully live|fully integrated|bank connected|FGIS connected|EDO connected/i);
  });
});
