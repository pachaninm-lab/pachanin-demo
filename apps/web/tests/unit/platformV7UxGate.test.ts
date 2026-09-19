import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

// PR-5 UX-gate: фиксирует единую подачу кабинетов и мобильный фокус, чтобы
// регрессии (длинная простыня, разнобой хедеров, пропавшая навигация) ловились
// в web-unit. Визуальная сверка пикселей — owner-side; здесь — структурные инварианты.

const COCKPIT_HERO_ROLES = [
  'seller', 'buyer', 'bank', 'executive', 'compliance', 'elevator', 'lab', 'surveyor', 'driver/field',
];

describe('PR-5 UX gate', () => {
  it('keeps a unified premium hero (CockpitHero) across role cabinets', () => {
    for (const role of COCKPIT_HERO_ROLES) {
      const source = read(`app/platform-v7/${role}/page.tsx`);
      expect(source, `${role} must use CockpitHero`).toContain('CockpitHero');
    }
  });

  it('keeps mobile focus (свёрнутый хвост) for heavy cabinets in ScopedShellGuard', () => {
    const guard = read('components/platform-v7/ScopedShellGuard.tsx');
    for (const rule of ['buyerMobile', 'sellerMobile', 'bankMobile', 'complianceMobile', 'operatorMobile']) {
      expect(guard, `ScopedShellGuard must define ${rule}`).toContain(rule);
    }
    // правила должны быть применены в маршрутизации, а не лежать мёртвым кодом
    expect(guard).toContain('roleScopedExtra');
    expect(guard).toContain('operatorMobile}');
  });

  it('keeps role-scoped bottom navigation and theme toggle in the shell', () => {
    const shell = read('components/v7r/AppShellV4.tsx');
    expect(shell).toContain('pc-v4-bottomnav');
    expect(shell).toContain('Навигация кабинета');
    expect(shell).toContain('toggleTheme');
    // в кабинете нет переключателя всех ролей
    expect(shell).not.toContain("aria-label='Сменить роль'");
  });

  it('protects mobile from horizontal overflow via grid-shrink rule', () => {
    const css = read('styles/platform-v7-shell-clarity.css');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('max-width: 100%');
  });
});
