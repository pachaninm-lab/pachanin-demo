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

  it('mounts the public entry cleanup in the platform-v7 template', () => {
    const source = read('apps/web/app/platform-v7/template.tsx');

    expect(source).toContain('PublicEntryCleanup');
    expect(source).toContain('<PublicEntryCleanup />');
  });

  it('routes public role cards through the single login gate with the selected role', () => {
    const page = read('apps/web/app/platform-v7/page.tsx');
    const cleanup = read('apps/web/components/platform-v7/PublicEntryCleanup.tsx');

    expect(page).toContain('/platform-v7/login?role=seller');
    expect(page).toContain('/platform-v7/login?role=buyer');
    expect(page).toContain('/platform-v7/login?role=operator');
    expect(cleanup).not.toContain("link.setAttribute('href', '/platform-v7/login')");
    expect(cleanup).not.toContain('rewritePublicLinks');
  });

  it('keeps all 12 role ids available on the public role catalog', () => {
    const source = read('apps/web/app/platform-v7/page.tsx');

    const missing = fullRoleSet.filter((role) => !source.includes(`key: '${role}'`));
    expect(missing).toEqual([]);
  });

  it('keeps the public mobile entry visible after returning from protected shell', () => {
    const cleanup = read('apps/web/components/platform-v7/PublicEntryCleanup.tsx');

    expect(cleanup).toContain("'.p7-mobile-tool-panel,[data-public-platform-handoff=\"true\"]'");
    expect(cleanup).toContain("document.body.classList.remove('seller-mobile-fix')");
    expect(cleanup).toContain('content-visibility:visible!important');
    expect(cleanup).toContain('.entry-control-tile{display:grid!important;opacity:1!important;visibility:visible!important');
  });
});
