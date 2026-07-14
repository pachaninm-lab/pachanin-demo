import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
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

const webPackage = JSON.parse(read('apps/web/package.json')) as {
  dependencies?: Record<string, string>;
};
const apiStaffRoute = read('apps/web/app/api/staff/[...path]/route.ts');
const staffRoute = read('apps/web/app/staff/[...path]/route.ts');

describe('Next.js 15 runtime contracts', () => {
  it('pins the patched Next.js line without coupling the change to React 19', () => {
    expect(webPackage.dependencies?.next).toBe('15.5.16');
    expect(webPackage.dependencies?.react).toBe('18.3.1');
    expect(webPackage.dependencies?.['react-dom']).toBe('18.3.1');
    expect(webPackage.dependencies?.['next-intl']).toBe('^3.26.5');
  });

  it('awaits dynamic staff route params before authorization and path dispatch', () => {
    for (const source of [apiStaffRoute, staffRoute]) {
      expect(source).toContain('params: Promise<{ path?: string[] }>');
      expect(source).toMatch(/await context\.params/);
      expect(source).not.toMatch(/context\.params\.path/);
    }
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

  it('does not retain one-shot migration authority after source normalization', () => {
    expect(fs.existsSync(path.join(ROOT, 'docs/platform-v7/autopilot/normalize-next15-codemod.mjs'))).toBe(false);
    expect(read('.github/workflows/dependency-review.yml')).not.toContain('governed-next15');
  });
});
