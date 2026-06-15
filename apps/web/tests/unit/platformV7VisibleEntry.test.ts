import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Главный экран = мобильная витрина входа (reference mobile first screen):
// герой + единый primary CTA + выбор роли + честная подача без fake-live.
const pageSource = () => readFileSync(resolve(__dirname, '../../app/platform-v7/page.tsx'), 'utf8');

describe('platform-v7 visible entry (mobile home)', () => {
  it('shows the hero and a single primary action', () => {
    const page = pageSource();
    expect(page).toContain('Одна сделка.');
    expect(page).toContain('Полный контроль.');
    expect(page).toContain('Создать сделку');
  });

  it('shows role entry points from the role directory', () => {
    const page = pageSource();
    expect(page).toContain('Выберите свою роль');
    expect(page).toContain('platformV7RolesByGroup');
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(page).toContain('/platform-v7/deals');
  });

  it('keeps maturity honest and avoids fake-live claims', () => {
    const page = pageSource();
    expect(page).not.toMatch(/production-ready|fully live|fully integrated|bank connected|FGIS connected|EDO connected/i);
  });
});
