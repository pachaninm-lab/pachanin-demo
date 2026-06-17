import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Главный экран = публичная execution-витрина: бренд, герой, роли,
// процесс сделки и честная controlled-pilot оговорка. Без fake-live.
describe('platform-v7 root working entry (mobile home)', () => {
  const page = readFileSync(join(process.cwd(), 'app/platform-v7/page.tsx'), 'utf8');

  it('uses the public execution cockpit as the root entry surface', () => {
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(page).toContain('Прозрачная Цена');
    expect(page).toContain('Контур исполнения агросделки');
  });

  it('shows hero, role selection and execution process entry', () => {
    expect(page).toContain('После цены начинается главный риск сделки');
    expect(page).toContain('Выберите свою роль в сделке');
    expect(page).toContain('/platform-v7/seller');
    expect(page).toContain('Как проходит сделка');
  });

  it('keeps controlled-pilot maturity language without fake-live claims', () => {
    expect(page).toContain('Controlled pilot');
    expect(page).not.toMatch(/production-ready|fully live|fully integrated|bank connected|FGIS connected|EDO connected/i);
  });
});
