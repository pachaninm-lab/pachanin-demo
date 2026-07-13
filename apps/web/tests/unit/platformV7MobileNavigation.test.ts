import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 mobile navigation', () => {
  it('keeps role bottom navigation limited to five items', () => {
    const source = read('apps/web/lib/platform-v7/shellRoutes.ts');

    expect(source).toContain('platformV7NavByRole');
    expect(source).toContain("label: 'Ещё'");
    expect(source).toContain("label: 'Главная'");
    expect(source).toContain("label: 'Рейс'");
    expect(source).toContain("label: 'Проблема'");
    expect(source).toContain("label: 'Основание'");
    expect(source).toContain("label: 'Риски'");
    expect(source).toContain("label: 'Допуск'");
  });

  it('keeps bank navigation away from live banking claims', () => {
    const source = read('apps/web/lib/platform-v7/shellRoutes.ts');

    expect(source).not.toContain("label: 'Выпуск'");
    expect(source).not.toContain("label: 'Кредит'");
    expect(source).not.toContain("label: 'Счёт'");
    expect(source).toContain("label: 'Платёжное основание'");
    expect(source).toContain("label: 'Деньги по сделкам'");
  });

  it('keeps bottom nav from closing primary CTA area', () => {
    const shell = read('apps/web/components/v7r/AppShellV4.tsx');
    const shellStyles = read('apps/web/components/v7r/AppShellV4.module.css');

    expect(shell).toContain('pc-v4-bottomnav');
    expect(shell).toContain('items.slice(0, 5)');
    expect(shellStyles).toContain('.bottomNav');
    expect(shellStyles).toContain('padding: calc(var(--shell-header-offset) + 12px) var(--ds-space-4) calc(env(safe-area-inset-bottom) + 84px)');
  });
});
