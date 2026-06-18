import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('platform-v7 public entry link policy', () => {
  const publicEntryFiles = [
    'apps/web/app/platform-v7/page.tsx',
    'apps/web/app/platform-v7/open/page.tsx',
  ];

  const operationalEntryLeaks = [
    '/platform-v7/seller/batches/new',
    '/platform-v7/buyer/rfq/new',
    'Выставить партию',
    'Создать запрос на закупку',
    'Открытый просмотр',
  ];

  const fullRoleSet = [
    'Продавец',
    'Покупатель',
    'Логистика',
    'Водитель',
    'Элеватор',
    'Лаборатория',
    'Сюрвейер',
    'Банк',
    'Комплаенс',
    'Арбитр',
    'Оператор',
    'Руководитель',
  ];

  it('keeps public entry screens free of direct cabinet action CTAs', () => {
    const leaks = publicEntryFiles.flatMap((file) => {
      const source = read(file);
      return operationalEntryLeaks.filter((snippet) => source.includes(snippet)).map((snippet) => `${file}: ${snippet}`);
    });

    expect(leaks).toEqual([]);
  });

  it('mounts the public entry cleanup in the platform-v7 template', () => {
    const source = read('apps/web/app/platform-v7/template.tsx');

    expect(source).toContain('PublicEntryCleanup');
    expect(source).toContain('<PublicEntryCleanup />');
  });

  it('routes public role cards through the single login gate at runtime', () => {
    const source = read('apps/web/components/platform-v7/PublicEntryCleanup.tsx');

    expect(source).toContain("link.setAttribute('href', '/platform-v7/login')");
    expect(source).toContain("item.setAttribute('href', '/platform-v7/login')");
    expect(source).toContain('Доступ после единого входа');
  });

  it('keeps all 12 role labels available on the public role catalog', () => {
    const source = [
      read('apps/web/app/platform-v7/page.tsx'),
      read('apps/web/components/platform-v7/PublicEntryCleanup.tsx'),
    ].join('\n');

    const missing = fullRoleSet.filter((role) => !source.includes(role));
    expect(missing).toEqual([]);
  });
});
