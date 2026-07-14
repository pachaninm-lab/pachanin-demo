import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const repoRoot = cwd.endsWith(path.join('apps', 'web')) ? path.resolve(cwd, '..', '..') : cwd;

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function exists(relativePath: string) {
  return fs.existsSync(path.join(repoRoot, relativePath));
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
    'operator', 'buyer', 'seller', 'logistics', 'driver', 'elevator',
    'lab', 'surveyor', 'bank', 'compliance', 'arbitrator', 'executive',
  ];

  it('keeps public entry screens free of direct cabinet action CTAs', () => {
    const leaks = publicEntryFiles.flatMap((file) => {
      const source = read(file);
      return operationalEntryLeaks.filter((snippet) => source.includes(snippet)).map((snippet) => `${file}: ${snippet}`);
    });
    expect(leaks).toEqual([]);
  });

  it('keeps the platform template free of public DOM repair guards', () => {
    const template = read('apps/web/app/platform-v7/template.tsx');
    expect(template).toContain('return children');
    expect(template).not.toContain('PlatformV7TemplateGuards');
    expect(exists('apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx')).toBe(false);
    expect(exists('apps/web/components/platform-v7/PublicEntryCleanup.tsx')).toBe(false);
    expect(exists('apps/web/components/platform-v7/PublicHeroWeightPatch.tsx')).toBe(false);
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

  it('keeps lean public entry files free from legacy presentation runtimes', () => {
    for (const file of publicEntryFiles) {
      const source = read(file);
      expect(source).not.toContain('PlatformV7FullStyleRuntime');
      expect(source).not.toContain('MutationObserver');
      expect(source).not.toContain('ResizeObserver');
      expect(source).not.toContain('dangerouslySetInnerHTML');
    }
  });
});
