import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(webRoot, '../..');
const packageJson = JSON.parse(fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
};

function collectSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(absolute);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [absolute] : [];
  });
}

describe('Next.js 15 runtime boundary', () => {
  it('pins the minimum security-qualified Next.js release', () => {
    expect(packageJson.dependencies?.next).toBe('15.5.21');
  });

  it('does not couple the framework security patch to a React major migration', () => {
    expect(packageJson.dependencies?.react).toBe('18.3.1');
    expect(packageJson.dependencies?.['react-dom']).toBe('18.3.1');
  });

  it('retains the existing next-intl line that declares Next.js 15 and React 18 compatibility', () => {
    expect(packageJson.dependencies?.['next-intl']).toBe('^3.26.5');
  });

  it('keeps production builds fail-closed on TypeScript errors', () => {
    const nextConfig = fs.readFileSync(path.join(webRoot, 'next.config.js'), 'utf8');
    expect(nextConfig).not.toContain('ignoreBuildErrors');
  });

  it('contains no unresolved async request API codemod markers', () => {
    const sourceFiles = [
      ...collectSourceFiles(path.join(webRoot, 'app')),
      ...collectSourceFiles(path.join(webRoot, 'components')),
      ...collectSourceFiles(path.join(webRoot, 'lib')),
    ];
    const unresolved = sourceFiles.filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return source.includes('@next/codemod') || source.includes('UnsafeUnwrapped');
    });
    expect(unresolved).toEqual([]);
  });

  it('awaits catch-all staff route parameters before path authorization', () => {
    const routes = [
      path.join(webRoot, 'app/api/staff/[...path]/route.ts'),
      path.join(webRoot, 'app/staff/[...path]/route.ts'),
    ];
    for (const route of routes) {
      const source = fs.readFileSync(route, 'utf8');
      expect(source).toContain('params: Promise<{ path?: string[] }>');
      expect(source).toContain('await context.params');
    }
  });

  it('binds the lockfile exception to the frozen remediation branch only', () => {
    const guard = fs.readFileSync(path.join(repoRoot, 'scripts/p7-autopilot-guard.sh'), 'utf8');
    expect(guard).toContain('agent/ir-sec-next-15-5-16-final');
    expect(guard).not.toContain('agent/ir-sec-next-15-5-16"');
    expect(guard).toContain("NEXT15_REMEDIATION_SCOPE='apps/web/**");
  });

  it('contains no one-shot migration workflow in the final diff surface', () => {
    const dependencyWorkflow = fs.readFileSync(
      path.join(repoRoot, '.github/workflows/dependency-review.yml'),
      'utf8',
    );
    expect(dependencyWorkflow).not.toContain('retarget-next15-governance');
    expect(dependencyWorkflow).not.toContain('governed-next15');
  });
});
