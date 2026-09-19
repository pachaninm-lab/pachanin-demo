import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const repoRoot = cwd.endsWith(path.join('apps', 'web')) ? path.resolve(cwd, '..', '..') : cwd;

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
    'operator',
    'buyer',
    'seller',
    'logistics',
    'driver',
    'elevator',
    'lab',
    'surveyor',
    'bank',
    'compliance',
    'arbitrator',
    'executive',
  ];

  it('keeps public entry screens free of direct cabinet action CTAs', () => {
    const leaks = publicEntryFiles.flatMap((file) => {
      const source = read(file);
      return operationalEntryLeaks.filter((snippet) => source.includes(snippet)).map((snippet) => `${file}: ${snippet}`);
    });

    expect(leaks).toEqual([]);
  });

  it('mounts public entry guards through the canonical platform template', () => {
    const template = read('apps/web/app/platform-v7/template.tsx');
    const guards = read('apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx');

    expect(template).toContain('PlatformV7TemplateGuards');
    expect(template).toContain('<PlatformV7TemplateGuards position="before" />');
    expect(template).toContain('<PlatformV7TemplateGuards position="after" />');
    expect(guards).toContain('PublicEntryCleanup');
  });

  it('routes every public role card through one login endpoint without role query parameters', () => {
    const page = read('apps/web/app/platform-v7/page.tsx');

    expect(page).toContain("href: '/platform-v7/login'");
    expect(page).not.toContain('/platform-v7/login?role=');
    expect(page).not.toContain("href: '/platform-v7/seller'");
    expect(page).not.toContain("href: '/platform-v7/buyer'");
    expect(page).not.toContain("href: '/platform-v7/bank'");
  });

  it('keeps all 12 role ids visible without allowing public role selection', () => {
    const source = read('apps/web/app/platform-v7/page.tsx');
    const missing = fullRoleSet.filter((role) => !source.includes(`key: '${role}'`));

    expect(missing).toEqual([]);
    expect(source).toContain("getTranslations('publicEntry.rolesCatalog')");
  });

  it('keeps the public mobile entry visible after returning from protected shell', () => {
    const cleanup = read('apps/web/components/platform-v7/PublicEntryCleanup.tsx');

    expect(cleanup).toContain("'.p7-mobile-tool-panel,[data-public-platform-handoff=\"true\"]'");
    expect(cleanup).toContain("document.body.classList.remove('seller-mobile-fix')");
    expect(cleanup).toContain('content-visibility:visible!important');
    expect(cleanup).toContain('.entry-control-tile{display:grid!important;opacity:1!important;visibility:visible!important');
  });

  it('does not use paint containment on the public entry surface', () => {
    const heroPatch = read('apps/web/components/platform-v7/PublicHeroWeightPatch.tsx');
    const cleanup = read('apps/web/components/platform-v7/PublicEntryCleanup.tsx');

    expect(heroPatch).not.toContain('contain:layout paint');
    expect(cleanup).not.toContain('contain:layout paint');
  });
});
