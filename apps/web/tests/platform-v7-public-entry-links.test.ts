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

  it('keeps public entry screens free of direct cabinet action CTAs', () => {
    const leaks = publicEntryFiles.flatMap((file) => {
      const source = read(file);
      return operationalEntryLeaks.filter((snippet) => source.includes(snippet)).map((snippet) => `${file}: ${snippet}`);
    });

    expect(leaks).toEqual([]);
  });

  it('keeps the client entry gate in place for cabinet routes', () => {
    const source = read('apps/web/components/platform-v7/PublicEntryCleanup.tsx');

    expect(source).toContain("const ENTRY_SESSION_KEY = 'pc-v7-entry-approved'");
    expect(source).toContain("pathname === '/platform-v7'");
    expect(source).toContain("router.replace('/platform-v7')");
    expect(source).toContain("'/platform-v7/role-preview'");
  });
});
