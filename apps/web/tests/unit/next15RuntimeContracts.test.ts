import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function sourceFiles(root: string): string[] {
  const absoluteRoot = path.join(ROOT, root);
  const files: string[] = [];

  for (const entry of fs.readdirSync(absoluteRoot, { withFileTypes: true })) {
    const relative = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(relative));
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) files.push(relative);
  }

  return files;
}

function hasUnawaitedCall(source: string, helper: string): boolean {
  const calls = source.match(new RegExp(`\\b${helper}\\s*\\(`, 'g'))?.length ?? 0;
  const awaited = source.match(new RegExp(`\\bawait\\s+${helper}\\s*\\(`, 'g'))?.length ?? 0;
  return calls !== awaited;
}

function isDynamicPage(file: string): boolean {
  return /\/\[[^/]+\]\//.test(file) && /\/page\.(?:ts|tsx)$/.test(file);
}

const webPackage = JSON.parse(read('apps/web/package.json')) as {
  dependencies?: Record<string, string>;
};
const apiStaffRoute = read('apps/web/app/api/staff/[...path]/route.ts');
const staffWorkspaceRoute = read('apps/web/app/api/staff/workspaces/[...path]/route.ts');
const staffRoute = read('apps/web/app/staff/[...path]/route.ts');
const dealDocumentsPage = read('apps/web/app/platform-v7/deals/[id]/documents/page.tsx');

describe('Next.js 15 runtime contracts', () => {
  it('pins the patched Next.js line without coupling the change to React 19', () => {
    expect(webPackage.dependencies?.next).toBe('15.5.21');
    expect(webPackage.dependencies?.react).toBe('18.3.1');
    expect(webPackage.dependencies?.['react-dom']).toBe('18.3.1');
    expect(webPackage.dependencies?.['next-intl']).toBe('^3.26.5');
  });

  it('awaits dynamic staff route params before authorization and path dispatch', () => {
    for (const source of [apiStaffRoute, staffWorkspaceRoute, staffRoute]) {
      expect(source).toContain('params: Promise<{ path?: string[] }>');
      expect(source).toMatch(/await context\.params/);
      expect(source).not.toMatch(/context\.params\.path/);
    }
  });

  it('reads client dynamic page parameters through the Next.js navigation API', () => {
    expect(dealDocumentsPage).toContain("import { useParams } from 'next/navigation'");
    expect(dealDocumentsPage).toContain('useParams<{ id: string }>()');
    expect(dealDocumentsPage).not.toContain('function DealDocumentsPage({ params }');
    expect(dealDocumentsPage).not.toContain('params.id');
  });

  it('has no synchronous dynamic page params left in the App Router', () => {
    const unresolved: string[] = [];

    for (const file of sourceFiles('apps/web/app').filter(isDynamicPage)) {
      const source = read(file);
      const synchronousDefaultParams = /export\s+default\s+(?:async\s+)?function[\s\S]{0,420}?\bparams\s*:\s*\{/.test(source);
      if (synchronousDefaultParams) unresolved.push(file);
    }

    expect(unresolved).toEqual([]);
  });

  it('contains no unresolved codemod escape hatches or generated compatibility artifacts', () => {
    const unresolved: string[] = [];

    for (const file of sourceFiles('apps/web/app')) {
      const source = read(file);
      if (
        source.includes('@next-codemod-error')
        || source.includes('UnsafeUnwrapped')
        || source.includes('Awaited<Awaited<')
        || source.includes('Promise<Promise<')
        || /import\s+\{\s*use\s*\}\s+from\s+['"]react['"]/.test(source)
      ) {
        unresolved.push(file);
      }
    }

    expect(unresolved).toEqual([]);
  });

  it('awaits every async authorization-header helper before use', () => {
    const unresolved: string[] = [];

    for (const file of sourceFiles('apps/web/app/api')) {
      if (file.endsWith('/runtime-auth-helpers.ts')) continue;
      if (hasUnawaitedCall(read(file), 'runtimeAuthHeaders')) unresolved.push(file);
    }
    for (const file of sourceFiles('apps/web/lib')) {
      if (file.endsWith('/server-api.ts')) continue;
      if (hasUnawaitedCall(read(file), 'serverAuthHeaders')) unresolved.push(file);
    }

    expect(unresolved).toEqual([]);
  });

  it('does not retain one-shot migration authority after source normalization', () => {
    expect(fs.existsSync(path.join(ROOT, 'docs/platform-v7/autopilot/normalize-next15-codemod.mjs'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'docs/platform-v7/autopilot/finalize-next15-clean.mjs'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'docs/platform-v7/autopilot/await-next15-request-headers.mjs'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'docs/platform-v7/autopilot/normalize-next15-dynamic-pages.mjs'))).toBe(false);
    expect(read('.github/workflows/dependency-review.yml')).not.toContain('governed-next15');
  });
});
