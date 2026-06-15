import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Главный экран = мобильная витрина входа: бренд, герой, выбор роли из
// role-directory, нижняя навигация. Без fake-live.
describe('platform-v7 root working entry (mobile home)', () => {
  const page = readFileSync(join(process.cwd(), 'app/platform-v7/page.tsx'), 'utf8');

  it('uses the role directory as the root entry surface', () => {
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(page).toContain('PLATFORM_V7_ROLE_GROUPS');
    expect(page).toContain('Прозрачная Цена');
  });

  it('shows hero, role selection and bottom navigation', () => {
    expect(page).toContain('Одна сделка.');
    expect(page).toContain('Выберите свою роль');
    expect(page).toContain('/platform-v7/deals');
    expect(page).toContain('Прозрачность на каждом этапе');
  });

  it('makes no fake-live claims', () => {
    expect(page).not.toMatch(/production-ready|fully live|fully integrated|bank connected|FGIS connected|EDO connected/i);
  });
});
